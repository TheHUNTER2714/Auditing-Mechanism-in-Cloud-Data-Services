import hashlib
import json
import sqlite3
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from config import TIME_BUCKET_SECONDS


def compute_entry_hash(prev_hash: str, entry_type: str, payload_json: str, created_at: str) -> str:
    """
    Simulated Blockchain entry hash:
    entry_hash = SHA256(prev_hash || entry_type || payload_json || created_at)
    """
    raw = f"{prev_hash}|{entry_type}|{payload_json}|{created_at}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest().lower()


def get_ledger_head(conn: sqlite3.Connection) -> Tuple[int, str]:
    """Retrieve the sequence and entry_hash of the current ledger head."""
    cursor = conn.cursor()
    row = cursor.execute("SELECT seq, entry_hash FROM ledger ORDER BY seq DESC LIMIT 1").fetchone()
    if row:
        return row[0], row[1]
    # Default to genesis anchor
    return 0, "0" * 64


def append_ledger_entry(
    conn: sqlite3.Connection,
    entry_type: str,
    payload: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Append an immutable, hash-chained record to the simulated local append-only ledger.
    Entry types: GENESIS, AUDIT_RESULT, CHALLENGE_SEED, DEDUP_REGISTER, RECEIPT, ALERT.
    """
    cursor = conn.cursor()
    last_seq, prev_hash = get_ledger_head(conn)
    
    # Deterministic JSON string without whitespace discrepancies
    payload_json = json.dumps(payload, sort_keys=True)
    created_at = datetime.now(timezone.utc).isoformat()
    
    entry_hash = compute_entry_hash(prev_hash, entry_type, payload_json, created_at)
    
    cursor.execute(
        """
        INSERT INTO ledger (entry_type, payload_json, prev_hash, entry_hash, created_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (entry_type, payload_json, prev_hash, entry_hash, created_at),
    )
    new_seq = cursor.lastrowid
    conn.commit()
    
    return {
        "seq": new_seq,
        "entry_type": entry_type,
        "payload": payload,
        "prev_hash": prev_hash,
        "entry_hash": entry_hash,
        "created_at": created_at,
    }


def verify_ledger_chain(conn: sqlite3.Connection) -> Tuple[bool, Optional[int], Optional[str]]:
    """
    Verify full cryptographic hash continuity of the simulated blockchain ledger.
    Checks:
    1. Seq continuity (1, 2, ..., N).
    2. Genesis row has prev_hash = '0'*64.
    3. Each row's prev_hash matches preceding row's entry_hash.
    4. Each row's entry_hash matches SHA256(prev_hash || entry_type || payload_json || created_at).
    Returns (is_valid, first_bad_seq, error_message).
    """
    cursor = conn.cursor()
    rows = cursor.execute("SELECT seq, entry_type, payload_json, prev_hash, entry_hash, created_at FROM ledger ORDER BY seq ASC").fetchall()
    
    if not rows:
        return True, None, None

    expected_prev = "0" * 64
    for idx, row in enumerate(rows):
        seq = row["seq"]
        e_type = row["entry_type"]
        p_json = row["payload_json"]
        stored_prev = row["prev_hash"]
        stored_hash = row["entry_hash"]
        c_at = row["created_at"]
        
        expected_seq = idx + 1
        if seq != expected_seq:
            return False, seq, f"Ledger sequence discontinuity: expected seq {expected_seq}, found {seq}"
            
        if stored_prev.lower() != expected_prev.lower():
            return False, seq, f"Broken ledger link at seq {seq}: prev_hash does not match preceding entry_hash"
            
        recalculated_hash = compute_entry_hash(stored_prev, e_type, p_json, c_at)
        if stored_hash.lower() != recalculated_hash.lower():
            return False, seq, f"Corrupted ledger entry hash at seq {seq}: entry_hash was tampered"
            
        expected_prev = stored_hash

    return True, None, None


def get_current_time_bucket(seconds_per_bucket: int = TIME_BUCKET_SECONDS) -> int:
    """Current epoch time bucket (floor(unix_time / bucket_seconds))."""
    return int(time.time() // seconds_per_bucket)


def derive_public_challenge_seed(ledger_head_hash: str, time_bucket: int) -> str:
    """
    Derive unmanipulable public randomness seed:
    seed = SHA256(ledger_head_hash || time_bucket)
    Ensures neither the TPA nor the cloud storage server can cherry-pick blocks.
    """
    raw = f"{ledger_head_hash}|{time_bucket}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest().lower()


def derive_challenge_indices(seed: str, block_count: int, sample_count: int = 10) -> List[int]:
    """
    Deterministic pseudo-random function (PRF) generating sample block indices:
    index = PRF(seed, i) mod block_count
    """
    if block_count <= 0:
        return []
    target_count = min(sample_count, block_count)
    indices: List[int] = []
    
    counter = 0
    while len(indices) < target_count and counter < 5000:
        prf_input = f"{seed}|{counter}".encode("utf-8")
        h = hashlib.sha256(prf_input).hexdigest()
        val = int(h, 16) % block_count
        if val not in indices:
            indices.append(val)
        counter += 1
        
    return sorted(indices)
