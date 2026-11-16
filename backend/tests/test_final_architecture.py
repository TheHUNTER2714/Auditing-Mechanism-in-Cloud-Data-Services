import io
import json
from auth import generate_token, hash_password
from db import get_db


def test_fresh_owner_empty_workspace(client, temp_env):
    """Phase 1 & 6: Fresh owner starts with 0 files, 0 versions, 0 audits, 0 alerts, is_demo_seeded=False."""
    # 1. Register a fresh owner with allowed domain so they become active upon email verification
    r = client.post(
        "/api/auth/register",
        json={
            "name": "Fresh Owner",
            "email": "freshowner@cloud.local",
            "password": "StrongPassword123!#",
            "confirm_password": "StrongPassword123!#",
        },
    )
    assert r.status_code == 201
    data = r.get_json()
    assert data["account_status"] == "EMAIL_VERIFICATION_PENDING"
    token = data["verification_token"]

    # Verify email
    v_res = client.post("/api/auth/verify-email", json={"token": token})
    assert v_res.status_code == 200
    assert v_res.get_json()["user_status"] == "ACTIVE"

    # Login
    l_res = client.post("/api/auth/login", json={"email": "freshowner@cloud.local", "password": "StrongPassword123!#"})
    assert l_res.status_code == 200
    auth_token = l_res.get_json()["token"]
    headers = {"Authorization": f"Bearer {auth_token}"}

    # Telemetry stats must be all zeros
    stats_res = client.get("/api/stats", headers=headers)
    assert stats_res.status_code == 200
    s_data = stats_res.get_json()
    assert s_data["total_files"] == 0
    assert s_data["total_versions"] == 0
    assert s_data["total_audits"] == 0
    assert s_data["total_alerts"] == 0
    assert s_data["open_alerts"] == 0
    assert s_data["is_demo_seeded"] is False

    # Files, audits, alerts must be completely empty
    files_res = client.get("/api/files", headers=headers)
    assert files_res.status_code == 200
    assert files_res.get_json() == []

    audits_res = client.get("/api/audits", headers=headers)
    assert audits_res.status_code == 200
    assert audits_res.get_json() == []

    alerts_res = client.get("/api/alerts", headers=headers)
    assert alerts_res.status_code == 200
    assert alerts_res.get_json() == []


def test_registration_lifecycle_pending_approval_and_admin_approval(client, temp_env):
    """Phase 2: Status transitions from EMAIL_VERIFICATION_PENDING -> PENDING_APPROVAL -> ACTIVE (via Admin)."""
    # 1. Register with non-whitelisted domain (requires admin approval)
    r = client.post(
        "/api/auth/register",
        json={
            "name": "Applicant Alice",
            "email": "alice@external-corp.org",
            "password": "SecurePassword123!#",
            "confirm_password": "SecurePassword123!#",
        },
    )
    assert r.status_code == 201
    user_id = r.get_json()["user_id"]
    token = r.get_json()["verification_token"]

    # 2. Login fails before email verification (EMAIL_VERIFICATION_PENDING)
    l1 = client.post("/api/auth/login", json={"email": "alice@external-corp.org", "password": "SecurePassword123!#"})
    assert l1.status_code == 403
    assert l1.get_json()["status"] == "EMAIL_VERIFICATION_PENDING"

    # 3. Verify email -> transitions to PENDING_APPROVAL / PENDING
    v_res = client.post("/api/auth/verify-email", json={"token": token})
    assert v_res.status_code == 200
    assert v_res.get_json()["user_status"] in ("PENDING", "PENDING_APPROVAL")

    # 4. Login fails while PENDING / PENDING_APPROVAL
    l2 = client.post("/api/auth/login", json={"email": "alice@external-corp.org", "password": "SecurePassword123!#"})
    assert l2.status_code == 403
    assert l2.get_json()["status"] in ("PENDING", "PENDING_APPROVAL")

    # 5. Create Admin token and approve registration
    admin_token = generate_token("admin-01", "admin@cloud.local", "ADMIN")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    app_res = client.post(f"/api/admin/users/{user_id}/approve", headers=admin_headers)
    assert app_res.status_code == 200
    assert app_res.get_json()["new_status"] == "ACTIVE"

    # 6. Now login succeeds
    l3 = client.post("/api/auth/login", json={"email": "alice@external-corp.org", "password": "SecurePassword123!#"})
    assert l3.status_code == 200
    assert l3.get_json()["status"] == "ACTIVE"


def test_admin_rejection_requires_mandatory_reason(client, temp_env):
    """Phase 2: Admin rejection MUST require non-empty reason; saves reason and blocks login."""
    # 1. Register candidate
    r = client.post(
        "/api/auth/register",
        json={
            "name": "Spammer Bob",
            "email": "bob@suspicious.biz",
            "password": "SecurePassword123!#",
        },
    )
    assert r.status_code == 201
    user_id = r.get_json()["user_id"]
    token = r.get_json()["verification_token"]

    # Verify email
    client.post("/api/auth/verify-email", json={"token": token})

    admin_token = generate_token("admin-01", "admin@cloud.local", "ADMIN")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 2. Reject with empty reason fails with 400 REASON_REQUIRED
    rej_fail = client.post(f"/api/admin/users/{user_id}/reject", headers=admin_headers, json={"reason": ""})
    assert rej_fail.status_code == 400
    assert rej_fail.get_json()["error"] == "REASON_REQUIRED"

    # 3. Reject with valid mandatory reason succeeds
    rej_ok = client.post(
        f"/api/admin/users/{user_id}/reject",
        headers=admin_headers,
        json={"reason": "Suspicious business domain detected."},
    )
    assert rej_ok.status_code == 200
    assert rej_ok.get_json()["new_status"] == "REJECTED"
    assert rej_ok.get_json()["reason"] == "Suspicious business domain detected."

    # 4. Login blocked with rejection details
    l_rej = client.post("/api/auth/login", json={"email": "bob@suspicious.biz", "password": "SecurePassword123!#"})
    assert l_rej.status_code == 403
    assert l_rej.get_json()["status"] == "REJECTED"
    assert "Suspicious business domain detected" in l_rej.get_json()["message"]


def test_strict_owner_isolation_and_admin_download_restriction(client, temp_env):
    """Phase 5: IDOR protection (404 on unowned files) & Admin forbidden from downloading files."""
    # Owner A token
    token_a = generate_token("owner-a", "alice@cloud.local", "OWNER")
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # Owner B token
    token_b = generate_token("owner-b", "bob@cloud.local", "OWNER")
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # Admin token
    token_admin = generate_token("admin-01", "admin@cloud.local", "ADMIN")
    headers_admin = {"Authorization": f"Bearer {token_admin}"}

    # Owner A uploads a private file
    up_res = client.post(
        "/api/files",
        headers=headers_a,
        data={"file": (io.BytesIO(b"Owner A Private Secret Research Data"), "owner_a_data.txt")},
        content_type="multipart/form-data",
    )
    assert up_res.status_code == 201
    file_id = up_res.get_json()["file_id"]

    # Owner A can read and download
    assert client.get(f"/api/files/{file_id}", headers=headers_a).status_code == 200
    assert client.get(f"/api/files/{file_id}/download", headers=headers_a).status_code == 200

    # Owner B gets 404 (IDOR protection)
    assert client.get(f"/api/files/{file_id}", headers=headers_b).status_code == 404
    assert client.get(f"/api/files/{file_id}/download", headers=headers_b).status_code == 404

    # Admin gets 403 on download (Auditors and Admins forbidden from downloading plaintext)
    admin_dl = client.get(f"/api/files/{file_id}/download", headers=headers_admin)
    assert admin_dl.status_code == 403
    assert "prohibited from downloading user files" in admin_dl.get_json()["message"]
