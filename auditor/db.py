import hashlib
import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

AUDITOR_DB_PATH = Path(__file__).resolve().parent / "auditor.db"

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS auditor_receipts (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    owner_id TEXT NOT NULL,
    chain_hash TEXT NOT NULL,
    merkle_root TEXT NOT NULL,
    receipt_json TEXT NOT NULL,
    prev_hash TEXT NOT NULL,
    entry_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS auditor_verdicts (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    delegation_id TEXT NOT NULL,
    file_id TEXT NOT NULL,
    checked_version INTEGER NOT NULL,
    challenge_indices TEXT NOT NULL,
    verdict TEXT NOT NULL, -- 'PASS', 'TAMPERED', 'VERSION_HISTORY_ALTERED', 'UNREACHABLE'
    proof_valid INTEGER NOT NULL,
    timing_ms INTEGER NOT NULL,
    details_json TEXT NOT NULL,
    prev_hash TEXT NOT NULL,
    entry_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_aud_rec_file ON auditor_receipts(file_id, version);
CREATE INDEX IF NOT EXISTS idx_aud_verd_file ON auditor_verdicts(file_id, created_at);
"""


def get_auditor_db(db_path: Optional[Path] = None) -> sqlite3.Connection:
    target_path = str(db_path or AUDITOR_DB_PATH)
    conn = sqlite3.connect(target_path, timeout=15.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_auditor_db(db_path: Optional[Path] = None) -> None:
    target_path = db_path or AUDITOR_DB_PATH
    Path(target_path).parent.mkdir(parents=True, exist_ok=True)
    with get_auditor_db(target_path) as conn:
        conn.executescript(SCHEMA_SQL)
        conn.commit()


def append_receipt(conn: sqlite3.Connection, file_id: str, version: int, owner_id: str,
                   chain_hash: str, merkle_root: str, receipt_json: str) -> int:
    """Append receipt to append-only hash-chained table."""
    cursor = conn.cursor()
    last = cursor.execute("SELECT seq, entry_hash FROM auditor_receipts ORDER BY seq DESC LIMIT 1").fetchone()
    prev_hash = last["entry_hash"] if last else "0" * 64
    seq = (last["seq"] + 1) if last else 1
    created_at = datetime.now(timezone.utc).isoformat()

    msg = f"{prev_hash}|{file_id}|{version}|{owner_id}|{chain_hash}|{merkle_root}|{created_at}".encode("utf-8")
    entry_hash = hashlib.sha256(msg).hexdigest().lower()

    cursor.execute(
        """
        INSERT INTO auditor_receipts (seq, file_id, version, owner_id, chain_hash, merkle_root, receipt_json, prev_hash, entry_hash, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (seq, file_id, version, owner_id, chain_hash, merkle_root, receipt_json, prev_hash, entry_hash, created_at),
    )
    conn.commit()
    return seq


def append_verdict(
    conn: sqlite3.Connection,
    delegation_id: str,
    file_id: str,
    version: int,
    challenge_indices: List[int],
    verdict: str,
    proof_valid: bool,
    timing_ms: int,
    details: Dict[str, Any],
) -> int:
    """Append verdict to append-only hash-chained verdicts table."""
    cursor = conn.cursor()
    last = cursor.execute("SELECT seq, entry_hash FROM auditor_verdicts ORDER BY seq DESC LIMIT 1").fetchone()
    prev_hash = last["entry_hash"] if last else "0" * 64
    seq = (last["seq"] + 1) if last else 1
    created_at = datetime.now(timezone.utc).isoformat()
    indices_str = ",".join(map(str, challenge_indices))
    details_json = json.dumps(details, sort_keys=True)

    msg = f"{prev_hash}|{delegation_id}|{file_id}|{version}|{indices_str}|{verdict}|{int(proof_valid)}|{timing_ms}|{created_at}".encode("utf-8")
    entry_hash = hashlib.sha256(msg).hexdigest().lower()

    cursor.execute(
        """
        INSERT INTO auditor_verdicts (seq, delegation_id, file_id, checked_version, challenge_indices, verdict, proof_valid, timing_ms, details_json, prev_hash, entry_hash, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (seq, delegation_id, file_id, version, indices_str, verdict, 1 if proof_valid else 0, timing_ms, details_json, prev_hash, entry_hash, created_at),
    )
    conn.commit()
    return seq


def verify_verdict_chain(conn: sqlite3.Connection) -> Tuple[bool, Optional[int], Optional[str]]:
    """Verify hash chain integrity of auditor_verdicts table."""
    cursor = conn.cursor()
    rows = cursor.execute("SELECT * FROM auditor_verdicts ORDER BY seq ASC").fetchall()
    prev_hash = "0" * 64
    for idx, r in enumerate(rows):
        expected_seq = idx + 1
        if r["seq"] != expected_seq:
            return False, r["seq"], f"Sequence gap at {r['seq']}"
        if r["prev_hash"] != prev_hash:
            return False, r["seq"], f"Hash link broken at seq {r['seq']}"

        msg = f"{prev_hash}|{r['delegation_id']}|{r['file_id']}|{r['checked_version']}|{r['challenge_indices']}|{r['verdict']}|{r['proof_valid']}|{r['timing_ms']}|{r['created_at']}".encode("utf-8")
        calc = hashlib.sha256(msg).hexdigest().lower()
        if calc != r["entry_hash"]:
            return False, r["seq"], f"Entry hash forged or altered at seq {r['seq']}"
        prev_hash = r["entry_hash"]
    return True, None, "Auditor verdict chain verified"

