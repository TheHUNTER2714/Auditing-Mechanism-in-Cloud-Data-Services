import functools
import hashlib
import hmac
import os
import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional, Tuple

from flask import current_app, jsonify, request
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from werkzeug.security import check_password_hash, generate_password_hash

from config import JWT_SECRET


def get_serializer() -> URLSafeTimedSerializer:
    secret = current_app.config.get("JWT_SECRET", JWT_SECRET) if current_app else JWT_SECRET
    return URLSafeTimedSerializer(secret)


def hash_password(password: str) -> str:
    """Hash password securely using Werkzeug PBKDF2/scrypt."""
    return generate_password_hash(password)


def verify_password(password: str, pw_hash: str) -> bool:
    """Verify password against stored hash."""
    return check_password_hash(pw_hash, password)


def generate_user_blinding_key() -> bytes:
    """Generate 32-byte cryptographically secure random blinding key (k_u)."""
    return os.urandom(32)


def compute_blinded_owner_id(user_key: bytes, file_hash: str) -> str:
    """
    Blinded owner ID: bo = HMAC(k_u, file_hash)
    Stored in ledger DEDUP_REGISTER entries and ownership table.
    Reveals no identity to the TPA or public ledger viewers.
    """
    return hmac.new(user_key, file_hash.lower().encode("utf-8"), hashlib.sha256).hexdigest().lower()


def compute_blinded_file_tag(user_key: bytes, file_hash: str, r: str) -> str:
    """
    Blinded per-request audit tag: tag = HMAC(k_u, file_hash || r)
    Uses fresh per-audit nonce r so two audits of the same file are unlinkable to the TPA.
    """
    msg = f"{file_hash.lower()}|{r}".encode("utf-8")
    return hmac.new(user_key, msg, hashlib.sha256).hexdigest().lower()


def generate_token(user_id: str, username: str, role: str, expires_in: int = 86400) -> str:
    """Generate signed auth token containing user identity and role."""
    s = get_serializer()
    payload = {
        "user_id": user_id,
        "username": username,
        "role": role,
    }
    return s.dumps(payload)


def decode_token(token: str, max_age: int = 86400) -> Optional[Dict[str, Any]]:
    """Decode and validate an auth token, returning payload if valid."""
    s = get_serializer()
    try:
        data = s.loads(token, max_age=max_age)
        return data
    except (BadSignature, SignatureExpired):
        return None


def get_current_user(conn: sqlite3.Connection) -> Optional[Dict[str, Any]]:
    """Extract authenticated user from Authorization: Bearer <token> header or query param."""
    auth_header = request.headers.get("Authorization", "")
    token = ""
    if auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
    elif "token" in request.args:
        token = request.args.get("token", "")

    if not token:
        return None

    payload = decode_token(token)
    if not payload:
        return None

    cursor = conn.cursor()
    row = cursor.execute("SELECT id, username, role, user_key, created_at FROM users WHERE id = ?", (payload["user_id"],)).fetchone()
    if row:
        return {
            "id": row["id"],
            "username": row["username"],
            "role": row["role"],
            "user_key": row["user_key"],
            "created_at": row["created_at"],
        }
    # Valid signed token with role
    return {
        "id": payload.get("user_id", "unknown"),
        "username": payload.get("username", "user"),
        "role": payload.get("role", "OWNER"),
        "user_key": b"",
        "created_at": "",
    }


def log_event(
    conn: sqlite3.Connection,
    actor_id: str,
    role: str,
    action: str,
    target: str,
    result: str,
    ip: Optional[str] = None,
) -> None:
    """Record an actor-attributed activity event in the events table."""
    client_ip = ip or request.remote_addr or "127.0.0.1"
    created_at = datetime.now(timezone.utc).isoformat()
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO events (actor_id, role, action, target, result, ip, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (actor_id, role, action, target, result, client_ip, created_at),
    )
    conn.commit()


def seed_demo_users_if_needed(conn: sqlite3.Connection) -> None:
    """Seed three standard demo accounts (OWNER, TPA, ADMIN) for demonstration."""
    demo_accounts = [
        ("demo-owner-id-01", "owner@cloud.local", "OwnerPass123!", "OWNER"),
        ("demo-tpa-id-02", "tpa@audit.org", "TpaPass123!", "TPA"),
        ("demo-admin-id-03", "admin@system.local", "AdminPass123!", "ADMIN"),
    ]
    cursor = conn.cursor()
    now_iso = datetime.now(timezone.utc).isoformat()
    for uid, uname, password, role in demo_accounts:
        existing = cursor.execute("SELECT id FROM users WHERE username = ?", (uname,)).fetchone()
        if not existing:
            pw_hash = hash_password(password)
            user_key = generate_user_blinding_key()
            cursor.execute(
                """
                INSERT INTO users (id, username, pw_hash, role, user_key, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (uid, uname, pw_hash, role, user_key, now_iso),
            )
    conn.commit()
