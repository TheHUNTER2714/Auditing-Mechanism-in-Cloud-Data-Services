import hashlib
import json
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from config import CHAIN_SECRET, CURRENT_STORAGE_DIR, K_TAG
from chain import (
    compute_file_content_hash,
    compute_genesis_chain_hash,
    compute_version_chain_hash,
    verify_version_chain_step,
)
from db import get_db
from ledger import append_ledger_entry, derive_challenge_indices, derive_public_challenge_seed, get_ledger_head, get_current_time_bucket
from merkle import build_merkle_tree, get_merkle_proof, split_into_blocks, verify_block_tag, verify_merkle_proof


class Stopwatch:
    """Helper to record execution steps with millisecond accuracy."""

    def __init__(self):
        self.steps: List[Dict[str, Any]] = []

    def record(self, name: str, action_fn) -> Any:
        start = time.perf_counter()
        ok = False
        try:
            res = action_fn()
            ok = True
            return res
        finally:
            elapsed_ms = max(1, int((time.perf_counter() - start) * 1000))
            self.steps.append({"name": name, "ok": ok, "ms": elapsed_ms})


def create_security_alert(
    conn,
    severity: str,
    kind: str,
    file_ref: Optional[str],
    message: str,
) -> Dict[str, Any]:
    """Create a security alert in the database and append an ALERT event to the simulated blockchain ledger."""
    cursor = conn.cursor()
    now_iso = datetime.now(timezone.utc).isoformat()
    cursor.execute(
        """
        INSERT INTO alerts (severity, kind, file_ref, message, created_at, acknowledged)
        VALUES (?, ?, ?, ?, ?, 0)
        """,
        (severity, kind, file_ref, message, now_iso),
    )
    alert_id = cursor.lastrowid
    conn.commit()

    # Append alert to ledger
    append_ledger_entry(
        conn,
        entry_type="ALERT",
        payload={
            "alert_id": alert_id,
            "severity": severity,
            "kind": kind,
            "file_ref": file_ref,
            "message": message,
        },
    )
    return {"id": alert_id, "severity": severity, "kind": kind, "file_ref": file_ref, "message": message}


def verify_chain_logic(
    file_id: str,
    versions: List[Dict[str, Any]],
    secret: str,
    receipt: Optional[Dict[str, Any]] = None,
    stopwatch: Optional[Stopwatch] = None,
) -> Tuple[bool, Optional[int], Optional[str]]:
    """
    Verify chain integrity for a file:
    1. Continuity: Version numbers must strictly be 1, 2, ..., N with no gaps or duplicates.
    2. Genesis check: V1 prev_chain_hash must equal HC_0.
    3. Cryptographic chain: Recalculate HC_v using CHAIN_SECRET (and optional merkle_root), compare with stored chain_hash.
    4. Linkage: V(n) prev_chain_hash must equal V(n-1) chain_hash.
    5. Disk blob check: Stored blob SHA-256 must match recorded content_hash.
    6. Owner receipt check: If receipt supplied, ensure server is not rolled back and chain_hash matches.
    """
    if not versions:
        return False, 1, "No versions recorded"

    # 1. Continuity check
    for idx, v_row in enumerate(versions):
        expected_ver = idx + 1
        if v_row["version"] != expected_ver:
            return False, v_row["version"], f"Version sequence gap: expected {expected_ver}, got {v_row['version']}"

    # 2. Genesis & Chain verification
    genesis_hc = compute_genesis_chain_hash(secret, file_id)
    prev_hc = genesis_hc

    for idx, v_row in enumerate(versions):
        v_num = v_row["version"]
        c_hash = v_row["content_hash"]
        stored_prev = v_row["prev_chain_hash"]
        stored_hc = v_row["chain_hash"]
        created_at = v_row["created_at"]
        blob_path = Path(v_row["blob_path"])
        merkle_root = v_row.get("merkle_root") or ""

        # Linkage check
        if stored_prev.lower() != prev_hc.lower():
            return False, v_num, f"Previous chain hash mismatch at V{v_num}"

        # Recomputed HMAC check (supports both v1 and v2 merkle-anchored formats)
        if not verify_version_chain_step(
            secret=secret,
            file_id=file_id,
            version=v_num,
            content_hash=c_hash,
            prev_chain_hash=stored_prev,
            created_at_utc_iso=created_at,
            expected_chain_hash=stored_hc,
            merkle_root=merkle_root if merkle_root else None,
        ):
            return False, v_num, f"HMAC chain signature invalid at V{v_num}"

        # Blob on disk check
        if not blob_path.is_file():
            return False, v_num, f"Historical version blob missing on disk at V{v_num}"

        blob_actual_hash = compute_file_content_hash(blob_path)
        if blob_actual_hash.lower() != c_hash.lower():
            return False, v_num, f"Historical version blob altered on disk at V{v_num}"

        prev_hc = stored_hc

    # 3. Owner receipt verification
    if receipt:
        receipt_ver = int(receipt.get("version", 0))
        receipt_hash = str(receipt.get("chain_hash", "")).lower()

        latest_ver = versions[-1]["version"]
        if latest_ver < receipt_ver:
            return False, latest_ver, f"Rollback detected: server version V{latest_ver} < receipt V{receipt_ver}"

        # Find matching version row
        matching = next((v for v in versions if v["version"] == receipt_ver), None)
        if not matching:
            return False, receipt_ver, f"Receipt version V{receipt_ver} missing in history"

        if matching["chain_hash"].lower() != receipt_hash:
            return False, receipt_ver, f"Receipt chain hash mismatch for V{receipt_ver}"

    return True, None, None


def execute_audit(
    file_id: str,
    receipt: Optional[Dict[str, Any]] = None,
    db_path: Optional[Path] = None,
    secret: Optional[str] = None,
    current_storage_dir: Optional[Path] = None,
) -> Dict[str, Any]:
    """
    Perform full audit with strict precedence:
    1. Chain check (including version blobs & receipts) -> VERSION_HISTORY_ALTERED if broken
    2. Content check (storage/current/<file_id>) -> TAMPERED if missing or SHA-256 differs
    3. PASS if both pass
    """
    chain_secret = secret or CHAIN_SECRET
    storage_dir = Path(current_storage_dir or CURRENT_STORAGE_DIR)
    stopwatch = Stopwatch()
    audited_at = datetime.now(timezone.utc).isoformat()

    conn = get_db(db_path)
    try:
        file_row = None

        def load_records():
            nonlocal file_row
            cursor = conn.cursor()
            file_row = cursor.execute("SELECT * FROM files WHERE id = ?", (file_id,)).fetchone()
            if not file_row:
                return []
            return cursor.execute(
                "SELECT * FROM versions WHERE file_id = ? ORDER BY version ASC",
                (file_id,),
            ).fetchall()

        version_rows = stopwatch.record("Loading file record and versions", load_records)

        if not file_row:
            return {
                "error": "FILE_NOT_FOUND",
                "message": f"File with ID {file_id} not found",
                "status_code": 404,
            }

        versions_data = [dict(r) for r in version_rows]
        latest_version = file_row["current_version"]
        latest_v_row = next((v for v in versions_data if v["version"] == latest_version), None)
        expected_content_hash = latest_v_row["content_hash"] if latest_v_row else ""

        # Step 2: Chain check (Precedence 1)
        chain_valid = False
        first_bad_ver = None
        chain_reason = None

        def run_chain_validation():
            nonlocal chain_valid, first_bad_ver, chain_reason
            chain_valid, first_bad_ver, chain_reason = verify_chain_logic(
                file_id=file_id,
                versions=versions_data,
                secret=chain_secret,
                receipt=receipt,
                stopwatch=stopwatch,
            )
            return chain_valid

        stopwatch.record("Verifying cryptographic hash chain & version history", run_chain_validation)

        # Step 3 & 4: Current content check
        current_file_path = storage_dir / file_id
        actual_content_hash = ""
        file_exists = False
        content_ok = False

        def compute_current_hash():
            nonlocal actual_content_hash, file_exists, content_ok
            if not current_file_path.is_file():
                file_exists = False
                actual_content_hash = "FILE_MISSING"
                content_ok = False
                return False
            file_exists = True
            actual_content_hash = compute_file_content_hash(current_file_path)
            content_ok = actual_content_hash.lower() == expected_content_hash.lower()
            return content_ok

        stopwatch.record("Computing SHA-256 of active storage payload", compute_current_hash)

        # Step 5: Synthesize verdict based on strict precedence
        def determine_verdict() -> str:
            if not chain_valid:
                return "VERSION_HISTORY_ALTERED"
            if not content_ok:
                return "TAMPERED"
            return "PASS"

        status = stopwatch.record("Synthesizing audit verification verdict", determine_verdict)

        result_payload = {
            "status": status,
            "file_id": file_id,
            "display_name": file_row["display_name"],
            "checked_version": latest_version,
            "content_hash_expected": expected_content_hash,
            "content_hash_actual": actual_content_hash,
            "content_ok": content_ok,
            "chain_valid": chain_valid,
            "first_bad_version": first_bad_ver,
            "chain_reason": chain_reason,
            "receipt_checked": bool(receipt),
            "steps": stopwatch.steps,
            "audited_at": audited_at,
        }

        # Write audit row to SQLite
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO audits (file_id, kind, status, details_json, created_at)
            VALUES (?, 'AUDIT', ?, ?, ?)
            """,
            (file_id, status, json.dumps(result_payload), audited_at),
        )
        conn.commit()

        # If tamper or broken chain, raise security alert
        if status in ("TAMPERED", "VERSION_HISTORY_ALTERED"):
            create_security_alert(
                conn,
                severity="critical",
                kind=status,
                file_ref=file_id,
                message=f"Integrity failure for {file_row['display_name']} ({file_id}): {status} (Reason: {chain_reason or 'Content mismatch'})",
            )

        # Append audit result to ledger
        append_ledger_entry(
            conn,
            entry_type="AUDIT_RESULT",
            payload={
                "audit_type": "FULL_CHAIN_AUDIT",
                "file_id": file_id,
                "status": status,
                "checked_version": latest_version,
                "content_hash": actual_content_hash,
                "chain_valid": chain_valid,
            },
        )

        return result_payload

    finally:
        conn.close()


def execute_verify_chain(
    file_id: str,
    receipt: Optional[Dict[str, Any]] = None,
    db_path: Optional[Path] = None,
    secret: Optional[str] = None,
) -> Dict[str, Any]:
    """Perform chain-only verification without inspecting active payload."""
    chain_secret = secret or CHAIN_SECRET
    stopwatch = Stopwatch()
    audited_at = datetime.now(timezone.utc).isoformat()

    conn = get_db(db_path)
    try:
        file_row = None

        def load_versions():
            nonlocal file_row
            cursor = conn.cursor()
            file_row = cursor.execute("SELECT * FROM files WHERE id = ?", (file_id,)).fetchone()
            if not file_row:
                return []
            return cursor.execute(
                "SELECT * FROM versions WHERE file_id = ? ORDER BY version ASC",
                (file_id,),
            ).fetchall()

        version_rows = stopwatch.record("Loading version history", load_versions)

        if not file_row:
            return {
                "error": "FILE_NOT_FOUND",
                "message": f"File with ID {file_id} not found",
                "status_code": 404,
            }

        versions_data = [dict(r) for r in version_rows]
        chain_valid = False
        first_bad_ver = None
        chain_reason = None

        def run_chain_check():
            nonlocal chain_valid, first_bad_ver, chain_reason
            chain_valid, first_bad_ver, chain_reason = verify_chain_logic(
                file_id=file_id,
                versions=versions_data,
                secret=chain_secret,
                receipt=receipt,
                stopwatch=stopwatch,
            )
            return chain_valid

        stopwatch.record("Verifying cryptographic version chain", run_chain_check)

        status = "PASS" if chain_valid else "VERSION_HISTORY_ALTERED"

        result_payload = {
            "status": status,
            "file_id": file_id,
            "display_name": file_row["display_name"],
            "current_version": file_row["current_version"],
            "chain_valid": chain_valid,
            "first_bad_version": first_bad_ver,
            "chain_reason": chain_reason,
            "receipt_checked": bool(receipt),
            "steps": stopwatch.steps,
            "audited_at": audited_at,
        }

        # Write audit row to SQLite
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO audits (file_id, kind, status, details_json, created_at)
            VALUES (?, 'VERIFY_CHAIN', ?, ?, ?)
            """,
            (file_id, status, json.dumps(result_payload), audited_at),
        )
        conn.commit()

        if status == "VERSION_HISTORY_ALTERED":
            create_security_alert(
                conn,
                severity="critical",
                kind="VERSION_HISTORY_ALTERED",
                file_ref=file_id,
                message=f"Version chain broken for {file_row['display_name']} ({file_id}): {chain_reason}",
            )

        append_ledger_entry(
            conn,
            entry_type="AUDIT_RESULT",
            payload={
                "audit_type": "VERIFY_CHAIN_ONLY",
                "file_id": file_id,
                "status": status,
                "chain_valid": chain_valid,
            },
        )

        return result_payload

    finally:
        conn.close()


def generate_spotcheck_proof(
    conn,
    file_id: str,
    version: int,
    indices: List[int],
    storage_dir: Optional[Path] = None,
) -> Dict[str, Any]:
    """
    Generate Merkle spot-check proof for challenged indices:
    Returns sampled blocks, Merkle paths, and block tags.
    """
    curr_dir = Path(storage_dir or CURRENT_STORAGE_DIR)
    file_path = curr_dir / file_id
    if not file_path.is_file():
        raise FileNotFoundError(f"File payload {file_id} not found in storage")

    with open(file_path, "rb") as f:
        file_bytes = f.read()

    blocks = split_into_blocks(file_bytes)
    root, layers = build_merkle_tree(blocks)

    cursor = conn.cursor()
    tag_rows = cursor.execute(
        "SELECT idx, tag FROM block_tags WHERE file_id = ? AND version = ? ORDER BY idx ASC",
        (file_id, version),
    ).fetchall()
    tag_map = {r["idx"]: r["tag"] for r in tag_rows}

    proofs = []
    for idx in indices:
        if 0 <= idx < len(blocks):
            b_data = blocks[idx]
            m_proof = get_merkle_proof(layers, idx)
            proofs.append(
                {
                    "index": idx,
                    "block_bytes_hex": b_data.hex(),
                    "merkle_proof": m_proof,
                    "tag": tag_map.get(idx, ""),
                }
            )

    return {
        "file_id": file_id,
        "version": version,
        "merkle_root": root,
        "block_count": len(blocks),
        "sampled_proofs": proofs,
    }


def verify_spotcheck_proof(
    proof_payload: Dict[str, Any],
    k_tag: Optional[str] = None,
) -> Tuple[bool, str, List[Dict[str, Any]]]:
    """
    TPA verifies Merkle audit paths against declared Merkle root,
    and validates cryptographic block tags against (file_id, version, idx).
    """
    tag_secret = k_tag or K_TAG
    file_id = proof_payload.get("file_id", "")
    version = proof_payload.get("version", 1)
    merkle_root = proof_payload.get("merkle_root", "")
    samples = proof_payload.get("sampled_proofs", [])

    step_results = []
    for s in samples:
        idx = s["index"]
        b_data = bytes.fromhex(s["block_bytes_hex"])
        m_proof = s["merkle_proof"]
        tag = s.get("tag", "")

        # 1. Verify Merkle inclusion path
        m_valid = verify_merkle_proof(idx, b_data, m_proof, merkle_root)
        if not m_valid:
            step_results.append({"index": idx, "passed": False, "reason": "MERKLE_PATH_INVALID"})
            return False, f"Merkle proof invalid at block {idx}", step_results

        # 2. Verify Wang et al. (2024) block tag binding
        if tag:
            t_valid = verify_block_tag(tag_secret, file_id, version, idx, b_data, tag)
            if not t_valid:
                step_results.append({"index": idx, "passed": False, "reason": "TAG_FORGERY_DETECTED"})
                return False, f"Block tag signature forged or invalid at block {idx}", step_results

        step_results.append({"index": idx, "passed": True, "reason": "VALID"})

    return True, "All sampled blocks and tags verified against Merkle root", step_results


def execute_batch_audit(
    file_ids: List[str],
    conn,
    k_tag: Optional[str] = None,
    storage_dir: Optional[Path] = None,
) -> Dict[str, Any]:
    """Audit multiple files in a single batch request and append individual & summary ledger records."""
    tag_secret = k_tag or K_TAG
    curr_dir = Path(storage_dir or CURRENT_STORAGE_DIR)
    results = []
    overall_status = "PASS"

    cursor = conn.cursor()
    last_seq, head_hash = get_ledger_head(conn)
    time_bucket = get_current_time_bucket()
    seed = derive_public_challenge_seed(head_hash, time_bucket)

    for fid in file_ids:
        f_row = cursor.execute("SELECT id, display_name, current_version FROM files WHERE id = ?", (fid,)).fetchone()
        if not f_row:
            results.append({"file_id": fid, "status": "FILE_NOT_FOUND", "passed": False})
            overall_status = "TAMPERED"
            continue

        ver = f_row["current_version"]
        v_row = cursor.execute("SELECT merkle_root, content_hash FROM versions WHERE file_id = ? AND version = ?", (fid, ver)).fetchone()
        if not v_row:
            results.append({"file_id": fid, "status": "VERSION_NOT_FOUND", "passed": False})
            overall_status = "TAMPERED"
            continue

        meta_row = cursor.execute("SELECT block_count FROM blocks_meta WHERE file_id = ? AND version = ?", (fid, ver)).fetchone()
        b_count = meta_row["block_count"] if meta_row else 1
        indices = derive_challenge_indices(f"{seed}|{fid}", b_count, sample_count=10)

        try:
            proof = generate_spotcheck_proof(conn, fid, ver, indices, storage_dir=curr_dir)
            ok, msg, details = verify_spotcheck_proof(proof, k_tag=tag_secret)
            file_status = "PASS" if ok else "TAMPERED"
            if not ok:
                overall_status = "TAMPERED"

            results.append({
                "file_id": fid,
                "display_name": f_row["display_name"],
                "version": ver,
                "status": file_status,
                "passed": ok,
                "sampled_indices": indices,
                "message": msg,
            })

            # Append individual ledger entry
            append_ledger_entry(
                conn,
                entry_type="AUDIT_RESULT",
                payload={
                    "audit_type": "BATCH_ITEM_SPOTCHECK",
                    "file_id": fid,
                    "status": file_status,
                    "version": ver,
                    "indices": indices,
                },
            )

        except Exception as e:
            results.append({"file_id": fid, "status": "ERROR", "passed": False, "message": str(e)})
            overall_status = "TAMPERED"

    # Append batch summary entry to ledger
    batch_summary_entry = append_ledger_entry(
        conn,
        entry_type="AUDIT_RESULT",
        payload={
            "audit_type": "BATCH_SUMMARY",
            "files_count": len(file_ids),
            "passed_count": sum(1 for r in results if r.get("passed")),
            "overall_status": overall_status,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )

    return {
        "status": overall_status,
        "batch_seq": batch_summary_entry["seq"],
        "total_files": len(file_ids),
        "passed_files": sum(1 for r in results if r.get("passed")),
        "failed_files": sum(1 for r in results if not r.get("passed")),
        "results": results,
    }
