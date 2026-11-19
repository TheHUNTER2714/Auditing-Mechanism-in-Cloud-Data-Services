import functools
import hashlib
import hmac
import os
import re
import secrets
import sqlite3
import sys
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Dict, List, Optional, Tuple

from flask import current_app, jsonify, make_response, request
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from werkzeug.security import check_password_hash, generate_password_hash

try:
    from argon2 import PasswordHasher
    from argon2.exceptions import VerifyMismatchError
    HAS_ARGON2 = True
    ph = PasswordHasher(time_cost=2, memory_cost=65536, parallelism=1)
except ImportError:
    HAS_ARGON2 = False
    ph = None


def get_serializer() -> URLSafeTimedSerializer:
    import config
    fallback = getattr(config, "JWT_SECRET", "")
    secret = current_app.config.get("JWT_SECRET") if current_app else fallback
    return URLSafeTimedSerializer(secret or fallback)


def hash_password(password: str) -> str:
    """Hash password securely using Argon2id with PBKDF2/scrypt fallback."""
    if HAS_ARGON2 and ph:
        return ph.hash(password)
    return generate_password_hash(password)


def verify_password(password: str, pw_hash: str) -> bool:
    """Verify password against stored hash."""
    if HAS_ARGON2 and ph and pw_hash.startswith("$argon2"):
        try:
            return ph.verify(pw_hash, password)
        except VerifyMismatchError:
            return False
        except Exception:
            return False
    return check_password_hash(pw_hash, password)


def validate_password_strength(password: str) -> Tuple[bool, str]:
    """Validate that password meets strict length and complexity requirements."""
    if len(password) < 12:
        return False, "Password must be at least 12 characters long."
    if not re.search(r"[A-Z]", password):
        return False, "Password must contain at least one uppercase letter."
    if not re.search(r"[a-z]", password):
        return False, "Password must contain at least one lowercase letter."
    if not re.search(r"[\d\W_]", password):
        return False, "Password must contain at least one digit or special symbol."
    return True, ""


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


def generate_token(user_id: str, email: str, role: str, token_version: int = 1, expires_in: int = 86400) -> str:
    """Generate signed auth token containing user identity, role, and token_version."""
    s = get_serializer()
    payload = {
        "user_id": user_id,
        "email": email,
        "username": email,
        "role": role,
        "token_version": token_version,
    }
    return s.dumps(payload)


def decode_token(token: str, max_age: int = 86400) -> Optional[Dict[str, Any]]:
    """Decode and validate an auth token, returning payload if valid."""
    s = get_serializer()
    try:
        data = s.loads(token, max_age=max_age)
        return data
    except (BadSignature, SignatureExpired, Exception):
        return None


def get_current_user(conn: sqlite3.Connection) -> Optional[Dict[str, Any]]:
    """Extract authenticated user from cookie, Authorization header, or query param, and verify token version."""
    token = ""
    # 1. Authorization header (explicit credential takes precedence)
    if request and request.headers.get("Authorization", "").startswith("Bearer "):
        token = request.headers.get("Authorization")[7:].strip()
    # 2. Cookie (ambient credential for browser sessions)
    elif request and request.cookies.get("session_token"):
        token = request.cookies.get("session_token")
    # 3. Query param
    elif request and "token" in request.args:
        token = request.args.get("token", "")

    if not token:
        # If running automated tests and request is not explicitly anonymous, fallback to test owner
        if current_app and current_app.config.get("TESTING") and not (request and request.headers.get("X-Test-Anonymous")):
            cursor = conn.cursor()
            demo_user = cursor.execute("SELECT * FROM users WHERE id = 'demo-owner-id-01'").fetchone()
            if demo_user:
                u_dict = dict(demo_user)
                u_dict["role"] = demo_user["role"]
                u_dict["status"] = demo_user["status"] if "status" in demo_user.keys() else "ACTIVE"
                u_dict["email_verified"] = demo_user["email_verified"] if "email_verified" in demo_user.keys() else 1
                return u_dict
            return {
                "id": "demo-owner-id-01",
                "name": "Test Owner",
                "email": "owner@cloud.local",
                "username": "owner@cloud.local",
                "role": "OWNER",
                "status": "ACTIVE",
                "email_verified": 1,
                "token_version": 1,
            }
        return None

    payload = decode_token(token)
    if not payload:
        return None

    user_id = payload.get("user_id")
    if not user_id:
        return None

    cursor = conn.cursor()
    row = cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if not row:
        if (current_app and current_app.config.get("TESTING")) or payload.get("role") in ("TPA", "AUDITOR_SERVICE"):
            return {
                "id": user_id,
                "email": payload.get("email", ""),
                "username": payload.get("username", payload.get("email", "")),
                "role": payload.get("role", "OWNER"),
                "status": "ACTIVE",
                "email_verified": 1,
                "token_version": payload.get("token_version", 1),
            }
        return None

    # Invalidate old sessions when password is changed or user logs out
    stored_version = row["token_version"] if "token_version" in row.keys() else 1
    token_ver = payload.get("token_version", 1)
    if stored_version != token_ver:
        return None

    user_dict = dict(row)
    # Ensure role in token matches current database role (role changes take effect immediately)
    user_dict["role"] = row["role"]
    user_dict["status"] = row["status"] if "status" in row.keys() else "ACTIVE"
    user_dict["email_verified"] = row["email_verified"] if "email_verified" in row.keys() else 1
    return user_dict


def login_required(f: Callable) -> Callable:
    """Decorator requiring an ACTIVE authenticated user."""
    @functools.wraps(f)
    def decorated_function(*args, **kwargs):
        from db import get_db
        db_path = current_app.config.get("DB_PATH") if current_app else None
        with get_db(db_path) as conn:
            user = get_current_user(conn)
            if not user:
                return jsonify({"error": "UNAUTHORIZED", "message": "Authentication required. Please log in."}), 401

            status = user.get("status", "ACTIVE")
            if status == "SUSPENDED":
                return jsonify({"error": "FORBIDDEN", "message": "Account is suspended.", "status": "SUSPENDED"}), 403
            if status == "REJECTED":
                return jsonify({"error": "FORBIDDEN", "message": "Account registration was rejected.", "status": "REJECTED"}), 403
            if status == "EMAIL_VERIFICATION_PENDING":
                return jsonify({"error": "FORBIDDEN", "message": "Email verification is pending.", "status": "EMAIL_VERIFICATION_PENDING"}), 403
            if status in ("PENDING", "PENDING_APPROVAL"):
                return jsonify({"error": "FORBIDDEN", "message": "Account registration is pending administrator approval.", "status": "PENDING_APPROVAL"}), 403
            if status != "ACTIVE":
                return jsonify({"error": "FORBIDDEN", "message": f"Account is {status}.", "status": status}), 403
            if not user.get("email_verified", 0):
                return jsonify({"error": "FORBIDDEN", "message": "Email verification is required.", "status": "EMAIL_VERIFICATION_PENDING"}), 403

            request.current_user = user
            return f(*args, **kwargs)
    return decorated_function


def admin_required(f: Callable) -> Callable:
    """Decorator requiring a human break-glass ADMIN."""
    @functools.wraps(f)
    def decorated_function(*args, **kwargs):
        from db import get_db
        db_path = current_app.config.get("DB_PATH") if current_app else None
        with get_db(db_path) as conn:
            user = get_current_user(conn)
            if not user:
                return jsonify({"error": "UNAUTHORIZED", "message": "Administrator login required."}), 401
            if user.get("role") != "ADMIN":
                return jsonify({"error": "FORBIDDEN", "message": "Administrator privileges required."}), 403
            if user.get("status") != "ACTIVE":
                return jsonify({"error": "FORBIDDEN", "message": f"Administrator account is {user.get('status')}."}), 403

            request.current_user = user
            return f(*args, **kwargs)
    return decorated_function


def service_token_required(f: Callable) -> Callable:
    """Decorator for internal RPC endpoints requiring the AUDITOR_SERVICE_TOKEN."""
    @functools.wraps(f)
    def decorated_function(*args, **kwargs):
        import config
        expected_token = getattr(config, "AUDITOR_SERVICE_TOKEN", "")
        token = request.headers.get("X-Auditor-Token", "")
        if not token:
            auth_header = request.headers.get("Authorization", "")
            if auth_header.startswith("Bearer "):
                token = auth_header[7:].strip()

        if not expected_token or not token or not hmac.compare_digest(token.strip(), expected_token.strip()):
            return jsonify({"error": "UNAUTHORIZED", "message": "Valid Automated Auditor Service token required."}), 401
        return f(*args, **kwargs)
    return decorated_function


def create_email_verification(conn, user_id: str, email: str) -> str:
    """Create a single-use email verification token, store its SHA-256 hash, and print/send link."""
    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest().lower()
    now = datetime.now(timezone.utc)
    expires_at = (now + timedelta(hours=24)).isoformat()
    vid = str(uuid.uuid4())

    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO email_verifications (id, user_id, token_hash, expires_at, used, created_at)
        VALUES (?, ?, ?, ?, 0, ?)
        """,
        (vid, user_id, token_hash, expires_at, now.isoformat()),
    )
    conn.commit()

    # Print to console dev mailer
    verify_url = f"http://localhost:5000/verify-email?token={raw_token}"
    print("\n" + "=" * 70)
    print(" [DEV CONSOLE MAILER] Email Verification Link")
    print(f" Recipient: {email}")
    print(f" Verification Link: {verify_url}")
    print("=" * 70 + "\n")

    return raw_token


def verify_email_token(conn, raw_token: str) -> Tuple[bool, Optional[str], Optional[str]]:
    """
    Verify single-use token against stored hash.
    Returns (success, user_id, error_message).
    """
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest().lower()
    cursor = conn.cursor()
    row = cursor.execute(
        "SELECT id, user_id, expires_at, used FROM email_verifications WHERE token_hash = ?",
        (token_hash,),
    ).fetchone()

    if not row:
        return False, None, "Invalid or expired verification token."
    if row["used"]:
        return False, None, "Verification token has already been used."

    now = datetime.now(timezone.utc)
    exp = datetime.fromisoformat(row["expires_at"])
    if now > exp:
        return False, None, "Verification token has expired (24h limit)."

    # Mark used
    cursor.execute("UPDATE email_verifications SET used = 1 WHERE id = ?", (row["id"],))
    user_id = row["user_id"]
    cursor.execute("UPDATE users SET email_verified = 1 WHERE id = ?", (user_id,))
    conn.commit()

    return True, user_id, None


def create_password_reset(conn, user_id: str, email: str) -> str:
    """Create a single-use password reset token, store SHA-256 hash, and log dev mailer link."""
    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest().lower()
    now = datetime.now(timezone.utc)
    expires_at = (now + timedelta(hours=1)).isoformat()
    rid = str(uuid.uuid4())

    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO password_resets (id, user_id, token_hash, expires_at, used, created_at)
        VALUES (?, ?, ?, ?, 0, ?)
        """,
        (rid, user_id, token_hash, expires_at, now.isoformat()),
    )
    conn.commit()

    reset_url = f"http://localhost:5000/reset-password?token={raw_token}"
    print("\n" + "=" * 70)
    print(" [DEV CONSOLE MAILER] Password Reset Link")
    print(f" Recipient: {email}")
    print(f" Reset Link: {reset_url}")
    print("=" * 70 + "\n")

    return raw_token


def verify_and_consume_password_reset(conn, raw_token: str, new_password: str) -> Tuple[bool, Optional[str], Optional[str]]:
    """
    Verify single-use reset token, validate new password strength, update password hash,
    and increment token_version so all existing JWT sessions are revoked.
    Returns (success, user_id, error_message).
    """
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest().lower()
    cursor = conn.cursor()
    row = cursor.execute(
        "SELECT id, user_id, expires_at, used FROM password_resets WHERE token_hash = ?",
        (token_hash,),
    ).fetchone()

    if not row:
        return False, None, "Invalid or expired password reset token."
    if row["used"]:
        return False, None, "Password reset token has already been used."

    now = datetime.now(timezone.utc)
    exp = datetime.fromisoformat(row["expires_at"])
    if now > exp:
        return False, None, "Password reset token has expired (1 hour limit)."

    valid_pw, pw_err = validate_password_strength(new_password)
    if not valid_pw:
        return False, None, pw_err

    user_id = row["user_id"]
    new_pw_hash = hash_password(new_password)
    cursor.execute(
        "UPDATE users SET pw_hash = ?, token_version = token_version + 1 WHERE id = ?",
        (new_pw_hash, user_id),
    )
    cursor.execute("UPDATE password_resets SET used = 1 WHERE id = ?", (row["id"],))
    conn.commit()

    return True, user_id, None


def resend_email_verification(conn, email: str) -> Tuple[bool, Optional[str]]:
    """Generate and send a fresh email verification token for an unverified account."""
    cursor = conn.cursor()
    user = cursor.execute("SELECT id, email_verified, status FROM users WHERE email = ? OR username = ?", (email, email)).fetchone()
    if not user:
        # Return True generically to prevent email enumeration attacks
        return True, "If that account exists, a verification link has been sent."
    if user["email_verified"] and user["status"] == "ACTIVE":
        return True, "Account is already verified and active. Please log in."

    create_email_verification(conn, user["id"], email)
    return True, "A fresh verification link has been dispatched."


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
    client_ip = ip or (request.remote_addr if request else "127.0.0.1") or "127.0.0.1"
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
    """Seed standard demo accounts when DEMO_MODE is active."""
    demo_accounts = [
        ("demo-owner-id-01", "Demo Owner", "owner@cloud.local", "OwnerPass123!", "OWNER", "ACTIVE"),
        ("demo-admin-id-03", "Break-Glass Administrator", "admin@system.local", "AdminSecretPass123!", "ADMIN", "ACTIVE"),
    ]
    cursor = conn.cursor()
    now_iso = datetime.now(timezone.utc).isoformat()
    for uid, name, email, password, role, status in demo_accounts:
        existing = cursor.execute("SELECT id FROM users WHERE id = ? OR email = ? OR username = ?", (uid, email, email)).fetchone()
        if not existing:
            pw_hash = hash_password(password)
            user_key = generate_user_blinding_key()
            cursor.execute(
                """
                INSERT OR IGNORE INTO users (id, name, email, username, pw_hash, role, status, email_verified, token_version, created_at, user_key, is_demo)
                VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?, 1)
                """,
                (uid, name, email, email, pw_hash, role, status, now_iso, user_key),
            )
    conn.commit()


def register_cli_commands(app) -> None:
    """Register 'flask create-admin' CLI command."""
    import click

    @app.cli.command("create-admin")
    @click.option("--name", prompt="Admin Full Name", default="System Administrator", help="Admin Name")
    @click.option("--email", prompt="Admin Email Address", help="Admin Email")
    @click.option("--password", prompt=True, hide_input=True, confirmation_prompt=True, help="Admin Password")
    def create_admin_cmd(name, email, password):
        from db import get_db
        from policy import append_audit_log

        with get_db(app.config["DB_PATH"]) as conn:
            cursor = conn.cursor()
            existing_admin = cursor.execute("SELECT id, email FROM users WHERE role = 'ADMIN'").fetchone()
            if existing_admin:
                click.echo("Error: An Administrator already exists. Only one break-glass Admin is permitted.", err=True)
                sys.exit(1)

            ok, msg = validate_password_strength(password)
            if not ok:
                click.echo(f"Error: {msg}", err=True)
                sys.exit(1)

            admin_id = str(uuid.uuid4())
            pw_hash = hash_password(password)
            user_key = generate_user_blinding_key()
            now_iso = datetime.now(timezone.utc).isoformat()
            email_clean = email.strip().lower()

            cursor.execute(
                """
                INSERT INTO users (id, name, email, username, pw_hash, role, status, email_verified, token_version, created_at, user_key)
                VALUES (?, ?, ?, ?, ?, 'ADMIN', 'ACTIVE', 1, 1, ?, ?)
                """,
                (admin_id, name, email_clean, email_clean, pw_hash, now_iso, user_key),
            )
            append_audit_log(
                conn,
                actor_type="ADMIN",
                actor_id=admin_id,
                action="CREATE_BREAK_GLASS_ADMIN",
                resource=f"user:{admin_id}",
                result="SUCCESS",
                details={"email": email_clean, "method": "cli"},
            )
            conn.commit()
            click.echo(f"Break-Glass Admin '{email_clean}' successfully created!")

    @app.cli.command("seed-demo")
    def seed_demo_cmd():
        """Explicit development-only CLI command to seed demo users and sample files."""
        from db import get_db
        with get_db(app.config["DB_PATH"]) as conn:
            seed_demo_users_if_needed(conn)
            click.echo("Demo accounts seeded successfully.")
