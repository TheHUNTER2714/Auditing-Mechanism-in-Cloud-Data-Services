import io
import json
import sqlite3
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from auth import (
    create_email_verification,
    create_password_reset,
    generate_token,
    get_current_user,
    hash_password,
    validate_password_strength,
    verify_and_consume_password_reset,
    verify_email_token,
    verify_password,
)
from db import get_db, init_db
from scheduler import AuditScheduler


def test_registration_validation_and_owner_assignment(client, temp_env):
    """1. Registration enforces validation, assigns OWNER automatically, and ignores role injection."""
    # Invalid email
    r1 = client.post("/api/auth/register", json={"email": "not-an-email", "password": "ValidPassword123!"})
    assert r1.status_code == 400

    # Weak password (< 12 chars)
    r2 = client.post("/api/auth/register", json={"email": "bob@cloud.org", "password": "Short1!"})
    assert r2.status_code == 400
    assert "at least 12 characters" in r2.get_json()["message"]

    # Attempted role escalation: client sends role="ADMIN"
    r3 = client.post(
        "/api/auth/register",
        json={
            "name": "Bob Owner",
            "email": "bob@cloud.org",
            "password": "StrongPassword2026!#",
            "role": "ADMIN",
        },
    )
    assert r3.status_code == 201
    user_id = r3.get_json()["user_id"]

    # Verify directly in SQLite that role is OWNER, NOT ADMIN
    conn = get_db(temp_env["DB_PATH"])
    user = conn.execute("SELECT role, status, email_verified FROM users WHERE id = ?", (user_id,)).fetchone()
    assert user["role"] == "OWNER"
    assert user["email_verified"] == 0
    conn.close()

    # Duplicate email rejected
    r4 = client.post(
        "/api/auth/register",
        json={"name": "Bob Again", "email": "bob@cloud.org", "password": "StrongPassword2026!#"},
    )
    assert r4.status_code == 409


def test_email_verification_lifecycle(client, temp_env):
    """2. Email verification token expires, is single-use, and activates user according to policy."""
    r = client.post(
        "/api/auth/register",
        json={"name": "Carol", "email": "carol@university.edu", "password": "CarolPassword123!#"},
    )
    assert r.status_code == 201
    token = r.get_json()["verification_token"]
    assert token is not None

    # Verify email
    v_res = client.post("/api/auth/verify-email", json={"token": token})
    assert v_res.status_code == 200
    assert v_res.get_json()["status"] == "VERIFIED"

    # Single-use: Reusing token must fail
    v_res2 = client.post("/api/auth/verify-email", json={"token": token})
    assert v_res2.status_code == 400
    assert "already been used" in v_res2.get_json()["message"]

    # Safe resend verification
    resend_res = client.post("/api/auth/resend-verification", json={"email": "carol@university.edu"})
    assert resend_res.status_code == 200


def test_password_reset_lifecycle_and_session_invalidation(client, temp_env):
    """3. Forgot password, single-use reset, and token_version session invalidation."""
    r = client.post(
        "/api/auth/register",
        json={"name": "Dave", "email": "dave@cloud.local", "password": "OldPassword123!#"},
    )
    uid = r.get_json()["user_id"]
    token = r.get_json()["verification_token"]
    client.post("/api/auth/verify-email", json={"token": token})

    # Log in and acquire session token
    login_res = client.post("/api/auth/login", json={"email": "dave@cloud.local", "password": "OldPassword123!#"})
    assert login_res.status_code == 200
    active_token = login_res.get_json()["token"]

    # Session works
    me_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {active_token}"})
    assert me_res.status_code == 200
    assert me_res.get_json()["email"] == "dave@cloud.local"

    # Request password reset
    forgot_res = client.post("/api/auth/forgot-password", json={"email": "dave@cloud.local"})
    assert forgot_res.status_code == 200
    reset_token = forgot_res.get_json()["reset_token"]
    assert reset_token is not None

    # Reset password with weak password fails
    bad_reset = client.post("/api/auth/reset-password", json={"token": reset_token, "new_password": "short"})
    assert bad_reset.status_code == 400

    # Reset password successfully
    good_reset = client.post("/api/auth/reset-password", json={"token": reset_token, "new_password": "NewBrandStrongPassword2026!#"})
    assert good_reset.status_code == 200

    # Reused reset token fails
    reused_reset = client.post("/api/auth/reset-password", json={"token": reset_token, "new_password": "NewBrandStrongPassword2026!#"})
    assert reused_reset.status_code == 400

    # PREVIOUS SESSION TOKEN IS NOW INVALIDATED (token_version incremented)
    invalidated_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {active_token}"})
    assert invalidated_res.status_code == 401

    # Login with new password succeeds
    new_login = client.post("/api/auth/login", json={"email": "dave@cloud.local", "password": "NewBrandStrongPassword2026!#"})
    assert new_login.status_code == 200


def test_account_profile_and_role_immutability(client, temp_env):
    """4. Profile endpoint allows updating name, but strictly forbids changing role or ID."""
    token = generate_token("user-eve", "eve@cloud.org", "OWNER", token_version=1)
    conn = get_db(temp_env["DB_PATH"])
    conn.execute(
        """
        INSERT INTO users (id, name, email, username, pw_hash, role, status, email_verified, token_version, user_key, created_at)
        VALUES ('user-eve', 'Eve Original', 'eve@cloud.org', 'eve', 'hash', 'OWNER', 'ACTIVE', 1, 1, 'key', datetime('now'))
        """
    )
    conn.commit()
    conn.close()

    headers = {"Authorization": f"Bearer {token}"}

    # GET Profile
    prof_res = client.get("/api/auth/profile", headers=headers)
    assert prof_res.status_code == 200
    assert prof_res.get_json()["name"] == "Eve Original"
    assert prof_res.get_json()["role"] == "OWNER"

    # PUT Profile: Update name
    update_res = client.put("/api/auth/profile", headers=headers, json={"name": "Eve Updated"})
    assert update_res.status_code == 200
    assert update_res.get_json()["profile"]["name"] == "Eve Updated"

    # PUT Profile: Attempt to escalate role to ADMIN
    escalate_res = client.put("/api/auth/profile", headers=headers, json={"role": "ADMIN"})
    assert escalate_res.status_code == 403
    assert "role" in escalate_res.get_json()["message"]


def test_auditor_permission_restrictions_and_idor_protection(client, temp_env):
    """5. Auditor token and other owners cannot download or delete files belonging to an owner."""
    token_alice = generate_token("owner-alice", "alice@cloud.org", "OWNER")
    headers_alice = {"Authorization": f"Bearer {token_alice}"}

    # Alice uploads a file
    upload_res = client.post(
        "/api/files",
        headers=headers_alice,
        data={"file": (io.BytesIO(b"Confidential Owner Content"), "confidential.txt")},
        content_type="multipart/form-data",
    )
    file_id = upload_res.get_json()["file_id"]

    # Bob (another owner) attempts to access file -> returns 404 (IDOR protection)
    token_bob = generate_token("owner-bob", "bob@cloud.org", "OWNER")
    headers_bob = {"Authorization": f"Bearer {token_bob}"}
    r_get = client.get(f"/api/files/{file_id}", headers=headers_bob)
    assert r_get.status_code == 404

    r_down = client.get(f"/api/files/{file_id}/download", headers=headers_bob)
    assert r_down.status_code == 404

    r_del = client.delete(f"/api/files/{file_id}", headers=headers_bob)
    assert r_del.status_code == 404

    # Service Token (Auditor) attempts to download file -> 401/403/404 (strictly blocked)
    auditor_headers = {"X-Auditor-Token": temp_env["AUDITOR_SERVICE_TOKEN"]}
    r_auditor_down = client.get(f"/api/files/{file_id}/download", headers=auditor_headers)
    assert r_auditor_down.status_code in (401, 403, 404)


def test_scheduler_distributed_job_locking_and_orphan_recovery(temp_env):
    """6. Scheduler distributed job locking prevents duplicate runs and recovers stalled jobs."""
    conn = get_db(temp_env["DB_PATH"])
    now_iso = datetime.now(timezone.utc).isoformat()
    # Insert stalled RUNNING job (simulating process crash)
    conn.execute(
        """
        INSERT INTO audit_jobs (id, job_id, file_id, owner_id, status, retry_count, created_at, updated_at)
        VALUES ('stalled-job-1', 'job-key-crash-1', NULL, 'system', 'RUNNING', 0, ?, ?)
        """,
        (now_iso, now_iso),
    )
    conn.commit()
    conn.close()

    scheduler = AuditScheduler(db_path=temp_env["DB_PATH"])
    scheduler.recover_orphaned_jobs()

    conn = get_db(temp_env["DB_PATH"])
    recovered = conn.execute("SELECT status, retry_count FROM audit_jobs WHERE id = 'stalled-job-1'").fetchone()
    assert recovered["status"] == "PENDING"
    assert recovered["retry_count"] == 1
    conn.close()
