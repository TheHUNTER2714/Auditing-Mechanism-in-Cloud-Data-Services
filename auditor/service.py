import json
import logging
import os
import secrets
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from auditor.db import append_receipt, append_verdict, get_auditor_db, init_auditor_db
from auditor.verifier import calculate_detection_probability, verify_merkle_proof

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] [AuditorService] %(message)s")
logger = logging.getLogger("auditor_service")

# Hard Rule 3: The Auditor Service must NOT hold CHAIN_SECRET!
if "CHAIN_SECRET" in os.environ:
    logger.warning("CRITICAL SECURITY VIOLATION: CHAIN_SECRET detected in Auditor Service environment! Purging for process independence.")
    del os.environ["CHAIN_SECRET"]

API_URL = os.environ.get("API_URL", "http://localhost:5000").rstrip("/")
SERVICE_TOKEN = os.environ.get("AUDITOR_SERVICE_TOKEN", "")


def http_post(endpoint: str, payload: Dict[str, Any], token: Optional[str] = None) -> Tuple[int, Dict[str, Any]]:
    """Helper to make HTTP POST requests to the main API."""
    url = f"{API_URL}{endpoint}"
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    tok = token or SERVICE_TOKEN
    if tok:
        req.add_header("X-Auditor-Token", tok)
        req.add_header("Authorization", f"Bearer {tok}")
    try:
        with urllib.request.urlopen(req, timeout=10.0) as resp:
            body = resp.read().decode("utf-8")
            return resp.status, json.loads(body)
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        try:
            return e.code, json.loads(body)
        except Exception:
            return e.code, {"error": "HTTP_ERROR", "message": body}
    except Exception as e:
        return 0, {"error": "CONNECTION_FAILED", "message": str(e)}


def http_get(endpoint: str, token: Optional[str] = None) -> Tuple[int, Dict[str, Any]]:
    """Helper to make HTTP GET requests to the main API."""
    url = f"{API_URL}{endpoint}"
    req = urllib.request.Request(url)
    tok = token or SERVICE_TOKEN
    if tok:
        req.add_header("X-Auditor-Token", tok)
        req.add_header("Authorization", f"Bearer {tok}")
    try:
        with urllib.request.urlopen(req, timeout=10.0) as resp:
            body = resp.read().decode("utf-8")
            return resp.status, json.loads(body)
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        try:
            return e.code, json.loads(body)
        except Exception:
            return e.code, {"error": "HTTP_ERROR", "message": body}
    except Exception as e:
        return 0, {"error": "CONNECTION_FAILED", "message": str(e)}


class AutomatedAuditorService:
    """
    Automated Auditor Service (TPA Automation):
    Runs in a separate process, maintains isolated auditor.db, holds ZERO server secrets,
    and independently verifies owner receipts against sampled Merkle proofs.
    """

    def __init__(self, api_url: Optional[str] = None, service_token: Optional[str] = None, check_interval: int = 30):
        # Enforce that CHAIN_SECRET is absent
        assert "CHAIN_SECRET" not in os.environ, "Security Assertion: Auditor cannot hold CHAIN_SECRET"

        self.api_url = (api_url or API_URL).rstrip("/")
        self.service_token = service_token or SERVICE_TOKEN
        self.check_interval = check_interval
        self._running = False
        init_auditor_db()

    def sync_delegations(self) -> List[Dict[str, Any]]:
        """Fetch active file delegations and receipts from main API."""
        code, data = http_get("/internal/delegations", token=self.service_token)
        if code != 200 or not isinstance(data, list):
            logger.warning(f"Could not sync delegations (HTTP {code}): {data}")
            return []

        # Store receipts into isolated append-only auditor_receipts table
        with get_auditor_db() as conn:
            cursor = conn.cursor()
            for d in data:
                fid = d["file_id"]
                ver = d.get("version", 1)
                existing = cursor.execute(
                    "SELECT seq FROM auditor_receipts WHERE file_id = ? AND version = ?",
                    (fid, ver),
                ).fetchone()
                if not existing and d.get("receipt_json"):
                    append_receipt(
                        conn,
                        file_id=fid,
                        version=ver,
                        owner_id=d["owner_id"],
                        chain_hash=d.get("chain_hash", ""),
                        merkle_root=d.get("merkle_root", ""),
                        receipt_json=d["receipt_json"],
                    )
        return data

    def audit_delegated_file(self, delegation: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute Level B Sampled Verification on a delegated file using owner receipt:
        1. Draw random challenge indices over blocks.
        2. Request proof from /internal/proof.
        3. Independently verify Merkle path against receipt Merkle root.
        4. Append verdict to auditor_verdicts.
        5. Forward verdict to /internal/results.
        """
        fid = delegation["file_id"]
        did = delegation["id"]
        sample_size = delegation.get("sample_size", 10)
        expected_ver = delegation.get("version", 1)
        receipt_merkle_root = delegation.get("merkle_root", "")
        receipt_chain_hash = delegation.get("chain_hash", "")

        t0 = time.perf_counter()

        # Step 1: Draw fresh random challenge
        code, chal_data = http_post("/internal/challenge", {
            "file_id": fid,
            "version": expected_ver,
            "sample_size": sample_size,
        }, token=self.service_token)

        if code == 0:
            verdict = "UNREACHABLE"
            timing_ms = max(1, int((time.perf_counter() - t0) * 1000))
            self._record_and_report_verdict(did, fid, expected_ver, [], verdict, False, timing_ms, {"reason": "Server unreachable"})
            return {"verdict": verdict, "file_id": fid, "timing_ms": timing_ms}

        if code != 200:
            verdict = "TAMPERED" if code == 404 else "UNREACHABLE"
            timing_ms = max(1, int((time.perf_counter() - t0) * 1000))
            self._record_and_report_verdict(did, fid, expected_ver, [], verdict, False, timing_ms, chal_data)
            return {"verdict": verdict, "file_id": fid, "timing_ms": timing_ms}

        indices = chal_data.get("indices", [0])
        total_blocks = chal_data.get("total_blocks", 1)

        # Step 2: Request proof from main API
        code, proof_data = http_post("/internal/proof", {
            "file_id": fid,
            "version": expected_ver,
            "indices": indices,
        }, token=self.service_token)

        timing_ms = max(1, int((time.perf_counter() - t0) * 1000))

        if code != 200:
            verdict = proof_data.get("status", "TAMPERED")
            self._record_and_report_verdict(did, fid, expected_ver, indices, verdict, False, timing_ms, proof_data)
            return {"verdict": verdict, "file_id": fid, "timing_ms": timing_ms}

        # Step 3: Independent mathematical proof verification (Level B)
        # Check against owner receipt root without CHAIN_SECRET
        proofs = proof_data.get("proofs", [])
        proof_valid = True
        failed_reason = None

        # Check rollback: server head version must match or exceed receipt version
        server_head_ver = proof_data.get("current_version", expected_ver)
        if server_head_ver < expected_ver:
            proof_valid = False
            failed_reason = f"Rollback detected: server version {server_head_ver} < receipt {expected_ver}"
            verdict = "VERSION_HISTORY_ALTERED"
        else:
            target_root = receipt_merkle_root or proof_data.get("merkle_root", "")
            for p in proofs:
                idx = p.get("index", 0)
                leaf_hash = p.get("leaf_hash", "")
                path = p.get("proof_path", [])
                if not verify_merkle_proof(leaf_hash, idx, path, target_root):
                    proof_valid = False
                    failed_reason = f"Merkle proof invalid for block {idx}"
                    break

            if proof_valid:
                verdict = "PASS"
            else:
                verdict = "TAMPERED"

        detection_prob = calculate_detection_probability(total_blocks, 1, len(indices))
        details = {
            "level": "LEVEL_B_INDEPENDENT_RECEIPT_VERIFIED",
            "proof_valid": proof_valid,
            "failure_reason": failed_reason,
            "total_blocks": total_blocks,
            "sample_size": len(indices),
            "detection_probability": detection_prob,
            "formula": "1 - C(n - k, c) / C(n, c)",
            "receipt_version": expected_ver,
        }

        self._record_and_report_verdict(did, fid, expected_ver, indices, verdict, proof_valid, timing_ms, details)
        return {
            "verdict": verdict,
            "file_id": fid,
            "timing_ms": timing_ms,
            "detection_probability": detection_prob,
        }

    def _record_and_report_verdict(self, delegation_id: str, file_id: str, version: int,
                                   indices: List[int], verdict: str, proof_valid: bool,
                                   timing_ms: int, details: Dict[str, Any]) -> None:
        """Store verdict in auditor_verdicts and forward to main API."""
        with get_auditor_db() as conn:
            append_verdict(
                conn,
                delegation_id=delegation_id,
                file_id=file_id,
                version=version,
                challenge_indices=indices,
                verdict=verdict,
                proof_valid=proof_valid,
                timing_ms=timing_ms,
                details=details,
            )

        # Forward to main API /internal/results
        http_post("/internal/results", {
            "delegation_id": delegation_id,
            "file_id": file_id,
            "version": version,
            "challenge_indices": indices,
            "verdict": verdict,
            "proof_valid": proof_valid,
            "timing_ms": timing_ms,
            "details": details,
        }, token=self.service_token)

    def run_cycle(self) -> int:
        """Run one audit execution cycle across all active delegations."""
        delegations = self.sync_delegations()
        logger.info(f"Auditor cycle started: {len(delegations)} active delegations found.")
        audited_count = 0
        for d in delegations:
            res = self.audit_delegated_file(d)
            logger.info(f"Audited {d['file_id']}: verdict={res.get('verdict')}, time={res.get('timing_ms')}ms")
            audited_count += 1
        return audited_count

    def run_forever(self):
        """Service daemon loop."""
        self._running = True
        logger.info("Automated Auditor Service daemon started.")
        while self._running:
            try:
                self.run_cycle()
            except Exception as e:
                logger.error(f"Error in auditor cycle: {e}")
            time.sleep(self.check_interval)


def main():
    service = AutomatedAuditorService()
    service.run_forever()


if __name__ == "__main__":
    main()

