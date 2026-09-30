import hashlib
import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from config import DB_PATH

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    current_version INTEGER NOT NULL,
    stored_path TEXT NOT NULL,
    is_deleted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    content_hash TEXT NOT NULL,
    prev_chain_hash TEXT NOT NULL,
    chain_hash TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    activity TEXT NOT NULL, -- 'UPLOAD', 'AUTHORIZED_UPDATE', 'DYNAMIC_UPDATE', etc.
    blob_path TEXT NOT NULL,
    merkle_root TEXT DEFAULT '',
    tag_root TEXT DEFAULT '',
    FOREIGN KEY(file_id) REFERENCES files(id) ON DELETE CASCADE,
    UNIQUE(file_id, version)
);

CREATE TABLE IF NOT EXISTS audits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id TEXT NOT NULL,
    kind TEXT NOT NULL,     -- 'AUDIT', 'VERIFY_CHAIN', 'SPOT_CHECK', 'BATCH'
    status TEXT NOT NULL,   -- 'PASS', 'TAMPERED', 'VERSION_HISTORY_ALTERED'
    details_json TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    pw_hash TEXT NOT NULL,
    role TEXT NOT NULL,     -- 'OWNER', 'TPA', 'ADMIN'
    user_key BLOB NOT NULL, -- k_u (blinding key, never returned across API)
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS blocks_meta (
    file_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    block_size INTEGER NOT NULL,
    block_count INTEGER NOT NULL,
    PRIMARY KEY(file_id, version),
    FOREIGN KEY(file_id) REFERENCES files(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS block_tags (
    file_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    idx INTEGER NOT NULL,
    tag TEXT NOT NULL,
    PRIMARY KEY(file_id, version, idx),
    FOREIGN KEY(file_id) REFERENCES files(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ledger (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_type TEXT NOT NULL, -- 'GENESIS', 'AUDIT_RESULT', 'CHALLENGE_SEED', 'DEDUP_REGISTER', 'RECEIPT', 'ALERT'
    payload_json TEXT NOT NULL,
    prev_hash TEXT NOT NULL,
    entry_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ownership (
    file_hash TEXT NOT NULL,
    blinded_owner TEXT NOT NULL,
    ledger_seq INTEGER NOT NULL,
    PRIMARY KEY(file_hash, blinded_owner)
);

CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_id TEXT NOT NULL,
    role TEXT NOT NULL,
    action TEXT NOT NULL,
    target TEXT NOT NULL,
    result TEXT NOT NULL,
    ip TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    severity TEXT NOT NULL, -- 'info', 'warning', 'critical'
    kind TEXT NOT NULL,     -- 'TAMPERED', 'VERSION_HISTORY_ALTERED', 'LEDGER_ALTERED', 'DUPLICATE_FAKING_SUSPECTED', etc.
    file_ref TEXT,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL,
    acknowledged INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id TEXT,           -- NULL means all files
    interval_minutes INTEGER NOT NULL,
    last_run TEXT,
    enabled INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_versions_file_ver ON versions(file_id, version);
CREATE INDEX IF NOT EXISTS idx_audits_file_created ON audits(file_id, created_at);
CREATE INDEX IF NOT EXISTS idx_block_tags_lookup ON block_tags(file_id, version, idx);
CREATE INDEX IF NOT EXISTS idx_ledger_seq ON ledger(seq);
CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at);
CREATE INDEX IF NOT EXISTS idx_alerts_ack ON alerts(acknowledged, created_at);
"""


def get_db(db_path: Optional[Path] = None) -> sqlite3.Connection:
    """Connect to SQLite database with Row factory and foreign keys enabled."""
    target_path = str(db_path or DB_PATH)
    conn = sqlite3.connect(target_path, timeout=15.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def _migrate_columns_if_needed(conn: sqlite3.Connection) -> None:
    """Apply non-destructive schema column additions to existing tables."""
    cursor = conn.cursor()
    
    # Check versions table columns
    v_cols = [row[1] for row in cursor.execute("PRAGMA table_info(versions)").fetchall()]
    if "merkle_root" not in v_cols:
        cursor.execute("ALTER TABLE versions ADD COLUMN merkle_root TEXT DEFAULT ''")
    if "tag_root" not in v_cols:
        cursor.execute("ALTER TABLE versions ADD COLUMN tag_root TEXT DEFAULT ''")
        
    # Check files table columns
    f_cols = [row[1] for row in cursor.execute("PRAGMA table_info(files)").fetchall()]
    if "is_deleted" not in f_cols:
        cursor.execute("ALTER TABLE files ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0")
        
    conn.commit()


def _ensure_genesis_ledger(conn: sqlite3.Connection) -> None:
    """Ensure the simulated blockchain ledger has a valid genesis entry."""
    cursor = conn.cursor()
    count = cursor.execute("SELECT COUNT(*) FROM ledger").fetchone()[0]
    if count == 0:
        prev_hash = "0" * 64
        entry_type = "GENESIS"
        payload_json = json.dumps({"description": "Simulated Blockchain Append-Only Ledger Genesis", "version": "2.0"})
        created_at = datetime.now(timezone.utc).isoformat()
        
        entry_data = f"{prev_hash}|{entry_type}|{payload_json}|{created_at}".encode("utf-8")
        entry_hash = hashlib.sha256(entry_data).hexdigest().lower()
        
        cursor.execute(
            """
            INSERT INTO ledger (seq, entry_type, payload_json, prev_hash, entry_hash, created_at)
            VALUES (1, ?, ?, ?, ?, ?)
            """,
            (entry_type, payload_json, prev_hash, entry_hash, created_at),
        )
        conn.commit()


def init_db(db_path: Optional[Path] = None) -> None:
    """Initialize SQLite database tables, run migrations, and seed genesis ledger."""
    target_path = db_path or DB_PATH
    Path(target_path).parent.mkdir(parents=True, exist_ok=True)
    with get_db(target_path) as conn:
        conn.executescript(SCHEMA_SQL)
        _migrate_columns_if_needed(conn)
        _ensure_genesis_ledger(conn)
        conn.commit()
