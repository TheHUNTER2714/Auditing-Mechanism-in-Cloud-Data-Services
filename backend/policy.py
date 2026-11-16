import hashlib
import hmac
import json
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import yaml

import config
from db import get_db

logger = logging.getLogger("policy_engine")
POLICY_FILE = Path(__file__).resolve().parent / "policy.yaml"

# In-memory tracking for failed logins and IDOR probes
FAILED_LOGINS: Dict[str, List[datetime]] = {}
IDOR_PROBES: Dict[str, List[datetime]] = {}


def load_policy() -> Dict[str, Any]:
    """Load policy rules from policy.yaml, with safe defaults."""
    default_policy = {
        "registration": {
            "auto_approve": config.AUTO_APPROVE,
            "allowed_email_domains": config.ALLOWED_EMAIL_DOMAINS or ["example.com", "university.edu", "cloud.local"],
        },
        "suspicious_activity": {
            "max_failed_logins": 5,
            "auto_suspend_minutes": 30,
            "idor_probe_threshold": 5,
        },
        "retention": {
            "soft_deleted_days": config.RETENTION_DAYS,
            "purge_schedule_hours": 24,
        },
        "alerts": {
            "escalate_failed_audits": True,
            "watchdog_multiplier": 2.0,
        },
    }
    if not POLICY_FILE.is_file():
        return default_policy
    try:
        with open(POLICY_FILE, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
            if isinstance(data, dict):
                # Merge with defaults
                for k, v in data.items():
                    if isinstance(v, dict) and k in default_policy:
                        default_policy[k].update(v)
                    else:
                        default_policy[k] = v
                return default_policy
    except Exception as e:
        logger.error(f"Failed to read policy.yaml: {e}")
    return default_policy


def save_policy(policy_data: Dict[str, Any]) -> None:
    """Save updated policy rules to policy.yaml."""
    try:
        with open(POLICY_FILE, "w", encoding="utf-8") as f:
            yaml.safe_dump(policy_data, f, default_flow_style=False)
    except Exception as e:
        logger.error(f"Failed to save policy.yaml: {e}")
        raise


def compute_entry_hash(log_secret: str, prev_hash: str, actor_type: str, actor_id: str,
                       action: str, resource: str, result: str, details_json: str, created_at: str) -> str:
    """Compute HMAC-SHA256 hash for a tamper-evident audit log entry."""
    msg = f"{prev_hash}|{actor_type}|{actor_id}|{action}|{resource}|{result}|{details_json}|{created_at}".encode("utf-8")
    key = log_secret.encode("utf-8")
    return hmac.new(key, msg, hashlib.sha256).hexdigest().lower()


def append_audit_log(
    conn,
    actor_type: str,
    actor_id: str,
    action: str,
    resource: str,
    result: str,
    details: Optional[Dict[str, Any]] = None,
    log_secret: Optional[str] = None,
) -> int:
    """
    Append an entry to the tamper-evident audit_log table.
    Enforces hash chaining with LOG_SECRET: entry_hash = HMAC(LOG_SECRET, prev_hash | fields).
    """
    secret = log_secret or config.LOG_SECRET
    cursor = conn.cursor()

    # Get prev_hash from last row
    last_row = cursor.execute("SELECT seq, entry_hash FROM audit_log ORDER BY seq DESC LIMIT 1").fetchone()
    if last_row:
        prev_hash = last_row["entry_hash"]
        expected_seq = last_row["seq"] + 1
    else:
        prev_hash = "0" * 64
        expected_seq = 1

    created_at = datetime.now(timezone.utc).isoformat()
    details_json = json.dumps(details or {}, sort_keys=True)
    entry_hash = compute_entry_hash(
        secret, prev_hash, actor_type, actor_id, action, resource, result, details_json, created_at
    )

    cursor.execute(
        """
        INSERT INTO audit_log (seq, actor_type, actor_id, action, resource, result, details_json, prev_hash, entry_hash, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (expected_seq, actor_type, actor_id, action, resource, result, details_json, prev_hash, entry_hash, created_at),
    )
    conn.commit()
    return expected_seq


def verify_log(conn, log_secret: Optional[str] = None) -> Tuple[bool, Optional[int], Optional[str]]:
    """
    Verify the entire tamper-evident audit log:
    1. Continuity of sequence numbers.
    2. Linkage: row(n).prev_hash == row(n-1).entry_hash.
    3. Cryptographic HMAC validity of each row using LOG_SECRET.
    Returns (valid, bad_seq, reason).
    """
    secret = log_secret or config.LOG_SECRET
    cursor = conn.cursor()
    rows = cursor.execute("SELECT * FROM audit_log ORDER BY seq ASC").fetchall()

    if not rows:
        return True, None, "Empty log"

    prev_hash = "0" * 64
    for idx, row in enumerate(rows):
        expected_seq = idx + 1
        seq = row["seq"]
        if seq != expected_seq:
            return False, seq, f"Sequence gap at seq {seq} (expected {expected_seq})"

        if row["prev_hash"] != prev_hash:
            return False, seq, f"Hash link broken at seq {seq}: prev_hash mismatch"

        computed = compute_entry_hash(
            secret,
            row["prev_hash"],
            row["actor_type"],
            row["actor_id"],
            row["action"],
            row["resource"],
            row["result"],
            row["details_json"],
            row["created_at"],
        )
        if computed.lower() != row["entry_hash"].lower():
            return False, seq, f"Signature mismatch at seq {seq}: entry was altered or forged"

        prev_hash = row["entry_hash"]

    return True, None, "Audit log verification passed"


def evaluate_registration_policy(email: str, email_verified: bool) -> Tuple[str, str]:
    """
    Determine if a newly verified user is auto-approved or left PENDING.
    Returns (status, rule_name).
    """
    if not email_verified:
        return "PENDING", "EMAIL_NOT_VERIFIED"

    policy = load_policy()
    reg_cfg = policy.get("registration", {})
    if reg_cfg.get("auto_approve", False):
        return "ACTIVE", "RULE_AUTO_APPROVE_ENABLED"

    allowed_domains = reg_cfg.get("allowed_email_domains", [])
    if "@" in email:
        domain = email.split("@", 1)[1].lower()
        for allowed in allowed_domains:
            if domain == allowed.lower() or domain.endswith("." + allowed.lower()):
                return "ACTIVE", f"RULE_DOMAIN_ALLOWED_{domain.upper()}"

    return "PENDING", "RULE_REQUIRES_ADMIN_APPROVAL"


def record_failed_login(conn, email_or_username: str, ip: str) -> bool:
    """
    Record a failed login. If threshold exceeded, suspend the user.
    Returns True if user was suspended, False otherwise.
    """
    now = datetime.now(timezone.utc)
    policy = load_policy()
    susp_cfg = policy.get("suspicious_activity", {})
    max_fails = susp_cfg.get("max_failed_logins", 5)
    suspend_mins = susp_cfg.get("auto_suspend_minutes", 30)

    key = email_or_username.lower()
    timestamps = FAILED_LOGINS.setdefault(key, [])
    # Keep only attempts within last 15 minutes
    cutoff = now - timedelta(minutes=15)
    timestamps = [t for t in timestamps if t > cutoff]
    timestamps.append(now)
    FAILED_LOGINS[key] = timestamps

    if len(timestamps) >= max_fails:
        cursor = conn.cursor()
        user_row = cursor.execute("SELECT id, role, status FROM users WHERE username = ? OR email = ?", (email_or_username, email_or_username)).fetchone()
        if user_row and user_row["role"] != "ADMIN": # Never auto-suspend the break-glass Admin
            cursor.execute("UPDATE users SET status = 'SUSPENDED' WHERE id = ?", (user_row["id"],))
            conn.commit()

            append_audit_log(
                conn,
                actor_type="SYSTEM",
                actor_id="policy-engine",
                action="AUTO_SUSPEND_USER",
                resource=f"user:{user_row['id']}",
                result="SUCCESS",
                details={
                    "rule": "RULE_EXCESSIVE_FAILED_LOGINS",
                    "failed_attempts": len(timestamps),
                    "suspend_minutes": suspend_mins,
                    "target_user": email_or_username,
                    "ip": ip,
                },
            )
            # Raise an alert
            cursor.execute(
                """
                INSERT INTO alerts (severity, kind, file_ref, message, created_at, acknowledged)
                VALUES ('critical', 'BRUTE_FORCE_SUSPENDED', NULL, ?, ?, 0)
                """,
                (f"User {email_or_username} automatically suspended after {len(timestamps)} failed login attempts from IP {ip}.", now.isoformat()),
            )
            conn.commit()
            return True
    return False


def record_idor_probe(conn, user_id: str, target_file_id: str, ip: str) -> None:
    """Record an unauthorized attempt to access another owner's resource (IDOR probe)."""
    now = datetime.now(timezone.utc)
    policy = load_policy()
    threshold = policy.get("suspicious_activity", {}).get("idor_probe_threshold", 5)

    key = f"{user_id}_{ip}"
    probes = IDOR_PROBES.setdefault(key, [])
    cutoff = now - timedelta(minutes=30)
    probes = [p for p in probes if p > cutoff]
    probes.append(now)
    IDOR_PROBES[key] = probes

    append_audit_log(
        conn,
        actor_type="SYSTEM",
        actor_id="policy-engine",
        action="IDOR_PROBE_DETECTED",
        resource=f"file:{target_file_id}",
        result="FLAGGED",
        details={
            "rule": "RULE_IDOR_PROBING_FLAG",
            "actor_id": user_id,
            "target_file_id": target_file_id,
            "probe_count": len(probes),
            "ip": ip,
        },
    )

    if len(probes) >= threshold:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO alerts (severity, kind, file_ref, message, created_at, acknowledged)
            VALUES ('warning', 'IDOR_PROBING_BURST', ?, ?, ?, 0)
            """,
            (target_file_id, f"Repeated unauthorized access probes from user {user_id} (IP {ip}): {len(probes)} probes in 30m.", now.isoformat()),
        )
        conn.commit()


def purge_expired_soft_deletes(conn, storage_dir: Path, versions_dir: Path) -> int:
    """
    Purge soft-deleted file blobs that have exceeded the retention period.
    NEVER touches audit_log or audits tables!
    """
    policy = load_policy()
    retention_days = policy.get("retention", {}).get("soft_deleted_days", 30)
    cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)
    cutoff_iso = cutoff.isoformat()

    cursor = conn.cursor()
    rows = cursor.execute(
        "SELECT id, stored_path FROM files WHERE is_deleted = 1 AND deleted_at IS NOT NULL AND deleted_at < ?",
        (cutoff_iso,),
    ).fetchall()

    purged_count = 0
    for r in rows:
        fid = r["id"]
        # Delete active blob
        active_blob = storage_dir / fid
        if active_blob.exists():
            try:
                active_blob.unlink()
            except Exception:
                pass

        # Purge version blobs
        v_rows = cursor.execute("SELECT blob_path FROM versions WHERE file_id = ?", (fid,)).fetchall()
        for vr in v_rows:
            p = Path(vr["blob_path"])
            if p.exists():
                try:
                    p.unlink()
                except Exception:
                    pass

        purged_count += 1
        append_audit_log(
            conn,
            actor_type="SYSTEM",
            actor_id="policy-engine",
            action="PURGE_EXPIRED_DATA",
            resource=f"file:{fid}",
            result="PURGED",
            details={"rule": "RULE_RETENTION_EXPIRED", "retention_days": retention_days},
        )

    return purged_count


def generate_nightly_summary(conn) -> Dict[str, Any]:
    """Generate daily audit and security summary."""
    now = datetime.now(timezone.utc)
    yesterday_iso = (now - timedelta(days=1)).isoformat()
    cursor = conn.cursor()

    total_audits = cursor.execute("SELECT COUNT(*) FROM audits WHERE created_at >= ?", (yesterday_iso,)).fetchone()[0]
    failed_audits = cursor.execute("SELECT COUNT(*) FROM audits WHERE created_at >= ? AND status != 'PASS'", (yesterday_iso,)).fetchone()[0]
    alerts_count = cursor.execute("SELECT COUNT(*) FROM alerts WHERE created_at >= ?", (yesterday_iso,)).fetchone()[0]
    active_files = cursor.execute("SELECT COUNT(*) FROM files WHERE is_deleted = 0").fetchone()[0]

    return {
        "report_date": now.strftime("%Y-%m-%d"),
        "generated_at": now.isoformat(),
        "total_audits_24h": total_audits,
        "failed_audits_24h": failed_audits,
        "alerts_24h": alerts_count,
        "active_files_count": active_files,
        "policy_status": "ENFORCED",
    }

