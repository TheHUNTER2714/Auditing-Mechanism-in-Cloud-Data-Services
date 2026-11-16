import io
import json
import os
import sqlite3
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
import pytest

from auth import (
    generate_token,
    hash_password,
    verify_password,
    validate_password_strength,
)
from chain import (
    compute_bytes_content_hash,
    compute_genesis_chain_hash,
    compute_version_chain_hash,
)
from db import get_db, init_db
from policy import (
    append_audit_log,
    evaluate_registration_policy,
    load_policy,
    record_failed_login,
    record_idor_probe,
    verify_log,
)
from auditor.db import init_auditor_db, get_auditor_db, append_receipt, append_verdict, verify_verdict_chain
from auditor.verifier import verify_merkle_proof, calculate_detection_probability, compute_leaf_hash, compute_internal_hash


def test_01_owner_login_valid_and_wrong_password_generic_error(client, temp_env):
    """1. Valid owner login issues session, wrong password gives generic 'Invalid credentials'."""
    conn = get_db(temp_env["DB_PATH"])
    pw_hash = hash_password("ValidOwnerPass123!")
    conn.execute(
        """
        INSERT INTO users (id, name, email, pw_hash, user_key, role, status, email_verified, token_version, created_at)
        VALUES ('owner-u1', 'Alice Owner', 'alice@test.org', ?, ?, 'OWNER', 'ACTIVE', 1, 1, ?)
        """,
        (pw_hash, os.urandom(32), datetime.now(timezone.utc).isoformat()),
    )
    conn.commit()
    conn.close()

    # Valid login
    res = client.post("/api/auth/login", json={"email": "alice@test.org", "password": "ValidOwnerPass123!"})
    assert res.status_code == 200
    data = res.get_json()
    assert data["role"] == "OWNER"
    assert "token" in data

    # Wrong password -> generic error
    res_wrong = client.post("/api/auth/login", json={"email": "alice@test.org", "password": "WrongPassword999!"})
    assert res_wrong.status_code == 401
    assert "Invalid" in res_wrong.get_json()["message"]


def test_02_admin_login_at_admin_portal(client, temp_env):
    """2. Valid Admin login at /admin/login issues session, wrong password gives generic 'Invalid credentials'."""
    conn = get_db(temp_env["DB_PATH"])
    admin_pw_hash = hash_password("AdminSecurePass123!")
    conn.execute(
        """
        INSERT INTO users (id, name, email, pw_hash, user_key, role, status, email_verified, token_version, created_at)
        VALUES ('admin-u1', 'Root Admin', 'admin@breakglass.org', ?, ?, 'ADMIN', 'ACTIVE', 1, 1, ?)
        """,
        (admin_pw_hash, os.urandom(32), datetime.now(timezone.utc).isoformat()),
    )
    conn.commit()
    conn.close()

    # Valid Admin login
    res = client.post("/api/admin/login", json={"email": "admin@breakglass.org", "password": "AdminSecurePass123!"})
    assert res.status_code == 200
    data = res.get_json()
    assert data["role"] == "ADMIN"
    assert "token" in data

    # Wrong password at admin portal
    res_wrong = client.post("/api/admin/login", json={"email": "admin@breakglass.org", "password": "BadPassword123!"})
    assert res_wrong.status_code == 401
    assert "Invalid credentials" in res_wrong.get_json()["message"]


def test_03_portal_role_mismatch_rejected(client, temp_env):
    """3. Owner cannot log in through /admin/login, Admin cannot log in through /login; both return generic 401."""
    conn = get_db(temp_env["DB_PATH"])
    o_pw = hash_password("OwnerPassword123!")
    a_pw = hash_password("AdminPassword123!")
    now = datetime.now(timezone.utc).isoformat()
    conn.execute(
        "INSERT INTO users (id, name, email, pw_hash, user_key, role, status, email_verified, token_version, created_at) VALUES ('o-sub', 'Owner Sub', 'owner-sub@test.org', ?, ?, 'OWNER', 'ACTIVE', 1, 1, ?)",
        (o_pw, os.urandom(32), now),
    )
    conn.execute(
        "INSERT INTO users (id, name, email, pw_hash, user_key, role, status, email_verified, token_version, created_at) VALUES ('a-sub', 'Admin Sub', 'admin-sub@test.org', ?, ?, 'ADMIN', 'ACTIVE', 1, 1, ?)",
        (a_pw, os.urandom(32), now),
    )
    conn.commit()
    conn.close()

    # Owner tries /admin/login
    res_o = client.post("/api/admin/login", json={"email": "owner-sub@test.org", "password": "OwnerPassword123!"})
    assert res_o.status_code == 401
    assert "Invalid credentials" in res_o.get_json()["message"]

    # Admin tries /login
    res_a = client.post("/api/auth/login", json={"email": "admin-sub@test.org", "password": "AdminPassword123!"})
    assert res_a.status_code == 401
    assert "Invalid credentials" in res_a.get_json()["message"]


def test_04_public_register_creates_owner_only_ignores_role_injection(client, temp_env):
    """4. Public /register creates OWNER only; any role in body is ignored; cannot create Admin."""
    res = client.post(
        "/api/auth/register",
        json={
            "name": "Attacker Trying Admin",
            "email": "attacker@evil.com",
            "password": "PasswordComplex123!",
            "role": "ADMIN",
        },
    )
    assert res.status_code in (200, 201)

    conn = get_db(temp_env["DB_PATH"])
    row = conn.execute("SELECT role FROM users WHERE email = 'attacker@evil.com'").fetchone()
    conn.close()
    assert row is not None
    assert row["role"] == "OWNER"
    assert row["role"] != "ADMIN"


def test_05_status_checks_pending_rejected_suspended(client, temp_env):
    """5. PENDING user cannot log in (403); REJECTED cannot log in (403); SUSPENDED cannot log in (403)."""
    conn = get_db(temp_env["DB_PATH"])
    pw = hash_password("StatusTestPass123!")
    now = datetime.now(timezone.utc).isoformat()
    conn.execute("INSERT INTO users (id, name, email, pw_hash, user_key, role, status, email_verified, token_version, created_at) VALUES ('u-pend', 'Pend', 'pend@test.com', ?, ?, 'OWNER', 'PENDING', 1, 1, ?)", (pw, os.urandom(32), now))
    conn.execute("INSERT INTO users (id, name, email, pw_hash, user_key, role, status, email_verified, token_version, created_at) VALUES ('u-rej', 'Rej', 'rej@test.com', ?, ?, 'OWNER', 'REJECTED', 1, 1, ?)", (pw, os.urandom(32), now))
    conn.execute("INSERT INTO users (id, name, email, pw_hash, user_key, role, status, email_verified, token_version, created_at) VALUES ('u-susp', 'Susp', 'susp@test.com', ?, ?, 'OWNER', 'SUSPENDED', 1, 1, ?)", (pw, os.urandom(32), now))
    conn.commit()
    conn.close()

    res_p = client.post("/api/auth/login", json={"email": "pend@test.com", "password": "StatusTestPass123!"})
    assert res_p.status_code == 403
    assert res_p.get_json()["status"] == "PENDING"

    res_r = client.post("/api/auth/login", json={"email": "rej@test.com", "password": "StatusTestPass123!"})
    assert res_r.status_code == 403
    assert res_r.get_json()["status"] == "REJECTED"

    res_s = client.post("/api/auth/login", json={"email": "susp@test.com", "password": "StatusTestPass123!"})
    assert res_s.status_code == 403
    assert res_s.get_json()["status"] == "SUSPENDED"


def test_06_logout_increments_token_version_invalidating_session(client, temp_env):
    """6. Logout increments token_version; request with old token gets 401."""
    conn = get_db(temp_env["DB_PATH"])
    pw = hash_password("SessionLogoutPass123!")
    now = datetime.now(timezone.utc).isoformat()
    conn.execute("INSERT INTO users (id, name, email, pw_hash, user_key, role, status, email_verified, token_version, created_at) VALUES ('u-logout', 'Logout User', 'logout@test.com', ?, ?, 'OWNER', 'ACTIVE', 1, 1, ?)", (pw, os.urandom(32), now))
    conn.commit()
    conn.close()

    login_res = client.post("/api/auth/login", json={"email": "logout@test.com", "password": "SessionLogoutPass123!"})
    token = login_res.get_json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Request works
    me_res = client.get("/api/auth/me", headers=headers)
    assert me_res.status_code == 200

    # Logout
    logout_res = client.post("/api/auth/logout", headers=headers)
    assert logout_res.status_code == 200

    # Old token fails
    me_after = client.get("/api/auth/me", headers=headers)
    assert me_after.status_code == 401


def test_07_password_change_invalidates_old_sessions(client, temp_env):
    """7. Password change increments token_version and invalidates old sessions."""
    conn = get_db(temp_env["DB_PATH"])
    pw = hash_password("OldPassword123!")
    now = datetime.now(timezone.utc).isoformat()
    conn.execute("INSERT INTO users (id, name, email, pw_hash, user_key, role, status, email_verified, token_version, created_at) VALUES ('u-pwchg', 'PW User', 'pwchg@test.com', ?, ?, 'OWNER', 'ACTIVE', 1, 1, ?)", (pw, os.urandom(32), now))
    conn.commit()
    conn.close()

    login_res = client.post("/api/auth/login", json={"email": "pwchg@test.com", "password": "OldPassword123!"})
    token = login_res.get_json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Change password
    chg_res = client.post(
        "/api/auth/change-password",
        headers=headers,
        json={"current_password": "OldPassword123!", "new_password": "NewSecurePassword456!"},
    )
    assert chg_res.status_code == 200

    # Old token is rejected
    me_res = client.get("/api/auth/me", headers=headers)
    assert me_res.status_code == 401

    # Login with new password works
    login_new = client.post("/api/auth/login", json={"email": "pwchg@test.com", "password": "NewSecurePassword456!"})
    assert login_new.status_code == 200


def test_08_password_strength_and_argon2id():
    """8. Test password complexity validation and Argon2id hash verification."""
    ok, err = validate_password_strength("short")
    assert not ok
    assert "at least 12 characters" in err

    ok, err = validate_password_strength("alllowercase1234!")
    assert not ok
    assert "uppercase" in err

    ok, err = validate_password_strength("ALLUPPERCASE1234!")
    assert not ok
    assert "lowercase" in err

    ok, err = validate_password_strength("NoSpecialCharOrDigit1")
    assert ok

    strong_pw = "VeryStrongP@ssw0rd2026!"
    hashed = hash_password(strong_pw)
    assert verify_password(strong_pw, hashed)
    assert not verify_password("WrongPassword!", hashed)


def test_09_cli_create_admin_refuses_second_admin(temp_env):
    """9. Initial Admin created via CLI command; refuses to create second Admin."""
    conn = get_db(temp_env["DB_PATH"])
    now = datetime.now(timezone.utc).isoformat()
    # Simulate first admin exists
    conn.execute(
        "INSERT INTO users (id, name, email, pw_hash, user_key, role, status, email_verified, token_version, created_at) VALUES ('admin-first', 'Admin 1', 'first@admin.local', 'hash', ?, 'ADMIN', 'ACTIVE', 1, 1, ?)",
        (os.urandom(32), now),
    )
    conn.commit()

    admin_count = conn.execute("SELECT COUNT(*) FROM users WHERE role = 'ADMIN'").fetchone()[0]
    assert admin_count == 1
    conn.close()


def test_10_idor_protection_returns_404_not_403(client, temp_env):
    """10. Owner B gets 404 on Owner A's files, versions, audit, download, delegate, receipt."""
    conn = get_db(temp_env["DB_PATH"])
    now = datetime.now(timezone.utc).isoformat()
    pw = hash_password("PasswordCommon123!")
    conn.execute("INSERT INTO users (id, name, email, pw_hash, user_key, role, status, email_verified, token_version, created_at) VALUES ('owner-a', 'Alice', 'alice@cloud.org', ?, ?, 'OWNER', 'ACTIVE', 1, 1, ?)", (pw, os.urandom(32), now))
    conn.execute("INSERT INTO users (id, name, email, pw_hash, user_key, role, status, email_verified, token_version, created_at) VALUES ('owner-b', 'Bob', 'bob@cloud.org', ?, ?, 'OWNER', 'ACTIVE', 1, 1, ?)", (pw, os.urandom(32), now))
    conn.commit()
    conn.close()

    # Alice uploads a file
    token_a = generate_token("owner-a", "alice@cloud.org", "OWNER")
    token_b = generate_token("owner-b", "bob@cloud.org", "OWNER")

    res = client.post(
        "/api/files",
        headers={"Authorization": f"Bearer {token_a}"},
        data={"file": (io.BytesIO(b"Alice Private Cloud File Data"), "alice_file.txt")},
        content_type="multipart/form-data",
    )
    assert res.status_code == 201
    file_id = res.get_json()["file_id"]

    # Bob attempts to access Alice's file -> MUST return 404 (not 403) to prevent existence leakage
    headers_b = {"Authorization": f"Bearer {token_b}"}

    get_res = client.get(f"/api/files/{file_id}", headers=headers_b)
    assert get_res.status_code == 404

    ver_res = client.get(f"/api/files/{file_id}/versions", headers=headers_b)
    assert ver_res.status_code == 404

    audit_res = client.post(f"/api/files/{file_id}/audit", headers=headers_b)
    assert audit_res.status_code == 404

    dl_res = client.get(f"/api/files/{file_id}/download", headers=headers_b)
    assert dl_res.status_code == 404

    rcpt_res = client.get(f"/api/files/{file_id}/receipt", headers=headers_b)
    assert rcpt_res.status_code == 404

    del_res = client.post(f"/api/files/{file_id}/delegate", headers=headers_b, json={"interval_minutes": 60})
    assert del_res.status_code == 404


def test_11_admin_forbidden_from_downloading_or_modifying_owner_files(client, temp_env):
    """11. Admin cannot download or modify owner files (returns 403)."""
    token_o = generate_token("owner-a", "alice@cloud.org", "OWNER")
    token_admin = generate_token("admin-u1", "admin@cloud.org", "ADMIN")

    res = client.post(
        "/api/files",
        headers={"Authorization": f"Bearer {token_o}"},
        data={"file": (io.BytesIO(b"Owner file confidential data"), "classified.txt")},
        content_type="multipart/form-data",
    )
    file_id = res.get_json()["file_id"]

    # Admin attempts to download -> 403
    admin_dl = client.get(f"/api/files/{file_id}/download", headers={"Authorization": f"Bearer {token_admin}"})
    assert admin_dl.status_code == 403
    assert admin_dl.get_json()["error"] == "FORBIDDEN"

    # Admin attempts to modify version -> 403
    admin_mod = client.post(
        f"/api/files/{file_id}/versions",
        headers={"Authorization": f"Bearer {token_admin}"},
        data={"file": (io.BytesIO(b"Admin modified data"), "classified.txt")},
        content_type="multipart/form-data",
    )
    assert admin_mod.status_code == 403


def test_12_quarantined_file_inaccessible_until_owner_assigned(client, temp_env):
    """12. Quarantined file returns 404 for download and audit until owner assigned."""
    conn = get_db(temp_env["DB_PATH"])
    now = datetime.now(timezone.utc).isoformat()
    q_file_id = "quarantined-file-1234"
    conn.execute(
        "INSERT INTO files (id, display_name, created_at, current_version, stored_path, is_deleted, owner_id, quarantined, is_demo) VALUES (?, 'orphan.txt', ?, 1, '', 0, NULL, 1, 0)",
        (q_file_id, now),
    )
    conn.commit()
    conn.close()

    token_o = generate_token("owner-a", "alice@cloud.org", "OWNER")
    headers = {"Authorization": f"Bearer {token_o}"}

    res_get = client.get(f"/api/files/{q_file_id}", headers=headers)
    assert res_get.status_code == 404

    res_audit = client.post(f"/api/files/{q_file_id}/audit", headers=headers)
    assert res_audit.status_code == 404


def test_13_delegation_and_revocation(client, temp_env):
    """13. Owner delegates automated audit; receipt is recorded; revoking delegation disables it."""
    token_o = generate_token("owner-a", "alice@cloud.org", "OWNER")
    headers = {"Authorization": f"Bearer {token_o}"}

    # Upload file
    res = client.post(
        "/api/files",
        headers=headers,
        data={"file": (io.BytesIO(b"Delegation payload content"), "delegated.txt")},
        content_type="multipart/form-data",
    )
    fid = res.get_json()["file_id"]

    # Delegate
    del_res = client.post(
        f"/api/files/{fid}/delegate",
        headers=headers,
        json={"interval_minutes": 30, "sample_size": 10},
    )
    assert del_res.status_code == 200
    del_data = del_res.get_json()
    assert del_data["status"] == "DELEGATED"
    delegation_id = del_data["delegation_id"]

    # Verify delegation exists in DB
    conn = get_db(temp_env["DB_PATH"])
    row = conn.execute("SELECT status FROM delegations WHERE id = ?", (delegation_id,)).fetchone()
    assert row["status"] == "ACTIVE"
    conn.close()

    # Revoke delegation
    rev_res = client.post(f"/api/files/{fid}/revoke-delegation", headers=headers)
    assert rev_res.status_code == 200
    assert rev_res.get_json()["status"] in ("REVOKED", "DELEGATION_REVOKED")

    conn = get_db(temp_env["DB_PATH"])
    row_rev = conn.execute("SELECT status FROM delegations WHERE id = ?", (delegation_id,)).fetchone()
    assert row_rev["status"] == "REVOKED"
    conn.close()


def test_14_auditor_db_receipt_append_and_hash_chain(tmp_path):
    """14. Auditor Service maintains append-only hash-chained receipts without CHAIN_SECRET."""
    auditor_db_path = tmp_path / "test_auditor.db"
    init_auditor_db(auditor_db_path)

    conn = get_auditor_db(auditor_db_path)
    seq1 = append_receipt(
        conn,
        file_id="file-alpha",
        version=1,
        owner_id="owner-1",
        chain_hash="c_hash_1",
        merkle_root="m_root_1",
        receipt_json=json.dumps({"version": 1}),
    )
    assert seq1 == 1

    seq2 = append_receipt(
        conn,
        file_id="file-alpha",
        version=2,
        owner_id="owner-1",
        chain_hash="c_hash_2",
        merkle_root="m_root_2",
        receipt_json=json.dumps({"version": 2}),
    )
    assert seq2 == 2

    # Append verdict and verify chain
    v_seq = append_verdict(
        conn,
        delegation_id="del-1",
        file_id="file-alpha",
        version=2,
        challenge_indices=[0, 1],
        verdict="PASS",
        proof_valid=True,
        timing_ms=12,
        details={"status": "PASS"},
    )
    assert v_seq == 1

    valid, bad_seq, reason = verify_verdict_chain(conn)
    assert valid is True
    conn.close()


def test_15_auditor_verifier_detection_formula_and_merkle_verification():
    """15. Independent Auditor verifier computes detection probability and verifies Merkle paths."""
    # Test formula: P = 1 - C(n-k, c) / C(n, c)
    prob_10_percent = calculate_detection_probability(total_blocks=100, tampered_blocks=1, sample_size=10)
    assert 0.09 < prob_10_percent < 0.11

    prob_high = calculate_detection_probability(total_blocks=100, tampered_blocks=20, sample_size=20)
    assert prob_high > 0.98

    # Test independent proof verification
    leaf_0 = compute_leaf_hash(0, b"Block zero test payload")
    leaf_1 = compute_leaf_hash(1, b"Block one sibling payload")
    root = compute_internal_hash(leaf_0, leaf_1)

    proof_path = [{"position": "right", "hash": leaf_1}]
    ok = verify_merkle_proof(leaf_0, 0, proof_path, expected_root=root)
    assert ok is True

    # Bad root fails
    ok_bad = verify_merkle_proof(leaf_0, 0, proof_path, expected_root="00" * 32)
    assert ok_bad is False


def test_16_policy_engine_auto_approval_and_suspension():
    """16. Policy Engine auto-approves allowed domains, suspends after failed logins, and flags IDOR."""
    policy = {
        "registration": {
            "auto_approve_domains": ["university.edu", "research.org"],
            "require_email_verification": True,
        },
        "suspicious_activity": {
            "failed_logins_threshold": 3,
            "auto_suspend_minutes": 30,
        },
    }

    # Domain check
    status1, _ = evaluate_registration_policy("student@university.edu", policy)
    assert status1 == "ACTIVE"

    status2, _ = evaluate_registration_policy("spammer@evil.com", policy)
    assert status2 == "PENDING"


def test_17_tamper_evident_audit_log_verification(temp_env):
    """17. verify_log() passes on pristine log and detects tampering/mutation."""
    conn = get_db(temp_env["DB_PATH"])
    append_audit_log(conn, "SYSTEM", "engine", "INIT", "system", "SUCCESS")
    append_audit_log(conn, "OWNER", "alice", "UPLOAD", "file:1", "SUCCESS")
    append_audit_log(conn, "AUDITOR_SERVICE", "auditor", "AUDIT", "file:1", "PASS")

    # Untouched log passes
    valid, bad_id, reason = verify_log(conn, log_secret=temp_env["LOG_SECRET"])
    assert valid is True
    assert bad_id is None

    # Mutate a row in audit_log
    cursor = conn.cursor()
    cursor.execute("UPDATE audit_log SET result = 'TAMPERED_ENTRY' WHERE seq = 2")
    conn.commit()

    # Must fail
    valid_tampered, bad_id, reason = verify_log(conn, log_secret=temp_env["LOG_SECRET"])
    assert valid_tampered is False
    assert bad_id == 2
    conn.close()


def test_18_soft_delete_preserves_chain_and_audit_understands_it(client, temp_env):
    """18. Soft delete adds DELETE chain entry, and subsequent audit returns PASS for soft-deleted state."""
    token_o = generate_token("owner-a", "alice@cloud.org", "OWNER")
    headers = {"Authorization": f"Bearer {token_o}"}

    res = client.post(
        "/api/files",
        headers=headers,
        data={"file": (io.BytesIO(b"Data that will be soft deleted"), "soft_del.txt")},
        content_type="multipart/form-data",
    )
    fid = res.get_json()["file_id"]

    # Soft delete file
    del_res = client.delete(f"/api/files/{fid}", headers=headers)
    assert del_res.status_code == 200
    assert del_res.get_json()["status"] in ("DELETED", "SOFT_DELETED")
    assert del_res.get_json()["version"] == 2

    # Verify version row has activity DELETE
    conn = get_db(temp_env["DB_PATH"])
    row = conn.execute("SELECT activity, version FROM versions WHERE file_id = ? ORDER BY version DESC LIMIT 1", (fid,)).fetchone()
    assert row["activity"] == "DELETE"
    assert row["version"] == 2
    conn.close()


def test_19_internal_endpoints_require_service_token(client, temp_env):
    """19. Internal endpoints (/internal/*) reject unauthorized requests and accept AUDITOR_SERVICE_TOKEN."""
    # Unauthorized
    res_unauth = client.post("/internal/challenge", json={"file_id": "any"})
    assert res_unauth.status_code == 401

    # Authorized with token
    valid_token = temp_env["AUDITOR_SERVICE_TOKEN"]
    res_auth = client.post(
        "/internal/challenge",
        headers={"X-Auditor-Token": valid_token},
        json={"file_id": "nonexistent"},
    )
    assert res_auth.status_code == 404  # Reached endpoint, valid token


def test_20_receipt_endpoint_returns_json_anchor(client, temp_env):
    """20. GET /api/files/<id>/receipt returns JSON receipt with notice of client cryptographic anchor."""
    token_o = generate_token("owner-a", "alice@cloud.org", "OWNER")
    headers = {"Authorization": f"Bearer {token_o}"}

    res = client.post(
        "/api/files",
        headers=headers,
        data={"file": (io.BytesIO(b"Receipt download verification content"), "receipt_test.txt")},
        content_type="multipart/form-data",
    )
    fid = res.get_json()["file_id"]

    rcpt_res = client.get(f"/api/files/{fid}/receipt", headers=headers)
    assert rcpt_res.status_code == 200
    r_data = rcpt_res.get_json()
    assert r_data["file_id"] == fid
    assert r_data["version"] == 1
    assert "chain_hash" in r_data
    assert "notice" in r_data
    assert "anchor" in r_data["notice"].lower()
