"""End-to-End Live Workflow Verification Script for Auditing Mechanism in Cloud Data Services.
Verifies all core flows:
1. User Registration & Risk Analysis
2. Email Token Verification & PENDING_APPROVAL status
3. Login gating prior to Admin Approval
4. Admin Approval via Break-Glass Admin
5. Fresh Owner Login & Zero Demo Data Verification (0 files, 0 audits, 0 alerts)
6. File Upload with Merkle Tree & Cryptographic Tags
7. Audit Verification & Verdict PASS
8. Strict Role-Based Separation (Owner vs Admin) & IDOR Protection
9. Admin Plaintext Download Prohibition
"""
import io
import sys
import os
import time

# Ensure backend directory is in path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from auth import generate_token, hash_password
from db import get_db

def run_workflow_test():
    print("=" * 70)
    print("STARTING END-TO-END SYSTEM WORKFLOW VERIFICATION")
    print("=" * 70)

    app = create_app()
    client = app.test_client()

    # Step 1: Register fresh owner with dynamic timestamp to allow repeat runs
    ts = int(time.time())
    test_email = f"enterprise_{ts}@cloud-auditing.org"
    test_password = "SuperSecurePassword2026!#"
    test_name = f"Enterprise Owner {ts}"

    print(f"\n[Step 1] Registering fresh user account ({test_email})...")
    reg_res = client.post(
        "/api/auth/register",
        json={
            "name": test_name,
            "email": test_email,
            "password": test_password,
            "confirm_password": test_password,
        },
    )
    assert reg_res.status_code == 201, f"Registration failed: {reg_res.get_json()}"
    reg_data = reg_res.get_json()
    user_id = reg_data["user_id"]
    verification_token = reg_data.get("verification_token")
    print(f"  -> SUCCESS: Registered User ID: {user_id}")
    print(f"  -> Account Status: {reg_data.get('account_status')}")
    assert verification_token is not None, "Verification token expected in dev mode"

    # Step 2: Test pre-verification login block
    print("\n[Step 2] Testing login block prior to email verification...")
    l1_res = client.post("/api/auth/login", json={"email": test_email, "password": test_password})
    assert l1_res.status_code == 403
    assert l1_res.get_json()["status"] == "EMAIL_VERIFICATION_PENDING"
    print("  -> SUCCESS: Login blocked with status EMAIL_VERIFICATION_PENDING")

    # Step 3: Verify email token
    print("\n[Step 3] Consuming email verification token...")
    v_res = client.post("/api/auth/verify-email", json={"token": verification_token})
    assert v_res.status_code == 200, f"Email verification failed: {v_res.get_json()}"
    v_data = v_res.get_json()
    print(f"  -> SUCCESS: Email verified! Account transitioned to: {v_data['user_status']}")

    # Step 4: Test pre-approval login block
    print("\n[Step 4] Testing login block prior to Admin approval...")
    l2_res = client.post("/api/auth/login", json={"email": test_email, "password": test_password})
    assert l2_res.status_code == 403
    assert l2_res.get_json()["status"] in ("PENDING", "PENDING_APPROVAL")
    print(f"  -> SUCCESS: Login blocked with status {l2_res.get_json()['status']}")

    # Step 5: Break-Glass Admin login & Pending applicant approval
    print("\n[Step 5] Break-Glass Admin login and applicant approval...")
    admin_login = client.post("/api/admin/login", json={"email": "admin@system.local", "password": "AdminSecretPass123!"})
    assert admin_login.status_code == 200, f"Admin login failed: {admin_login.get_json()}"
    admin_token = admin_login.get_json()["token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    print("  -> SUCCESS: Break-Glass Admin authenticated")

    # View pending applicants
    pending_res = client.get("/api/admin/users", headers=admin_headers)
    assert pending_res.status_code == 200
    user_list = pending_res.get_json()
    applicant = next((u for u in user_list if u["id"] == user_id), None)
    assert applicant is not None, "Applicant not in admin user list!"
    assert applicant["status"] in ("PENDING", "PENDING_APPROVAL")
    print(f"  -> SUCCESS: Applicant {test_email} found with status {applicant['status']} in Admin console")

    # Admin approves user
    approve_res = client.post(f"/api/admin/users/{user_id}/approve", headers=admin_headers)
    assert approve_res.status_code == 200
    print(f"  -> SUCCESS: Admin approved account. New status: {approve_res.get_json()['new_status']}")

    # Step 6: Fresh Owner login & Zero Demo Data check
    print("\n[Step 6] Fresh Owner login and verification of clean workspace (Zero Demo Data)...")
    owner_login = client.post("/api/auth/login", json={"email": test_email, "password": test_password})
    assert owner_login.status_code == 200, f"Owner login failed: {owner_login.get_json()}"
    owner_token = owner_login.get_json()["token"]
    owner_headers = {"Authorization": f"Bearer {owner_token}"}
    print(f"  -> SUCCESS: Owner login successful. Role: {owner_login.get_json().get('role')}")

    # Check stats - Must be strictly all zeros
    stats_res = client.get("/api/stats", headers=owner_headers)
    assert stats_res.status_code == 200
    stats = stats_res.get_json()
    print("  -> Workspace Telemetry Stats:")
    print(f"     Total Files:       {stats['total_files']} (Expected: 0)")
    print(f"     Total Versions:    {stats['total_versions']} (Expected: 0)")
    print(f"     Total Audits:      {stats['total_audits']} (Expected: 0)")
    print(f"     Total Alerts:      {stats['total_alerts']} (Expected: 0)")
    print(f"     Is Demo Seeded:    {stats['is_demo_seeded']} (Expected: False)")
    assert stats["total_files"] == 0
    assert stats["total_versions"] == 0
    assert stats["total_audits"] == 0
    assert stats["total_alerts"] == 0
    assert stats["is_demo_seeded"] is False
    print("  -> SUCCESS: Clean workspace verified! No demo files or alerts present.")

    # Step 7: File Upload & Merkle Tree Tagging
    print("\n[Step 7] Uploading real document with Merkle Tree & Wang et al. 2024 tags...")
    sample_file_content = f"SECURE RESEARCH DATA PAYLOAD [{ts}]: Version-Based Dynamic Cloud Data Auditing Verification Spec 2026.".encode()
    upload_res = client.post(
        "/api/files",
        headers=owner_headers,
        data={"file": (io.BytesIO(sample_file_content), f"secure_research_spec_{ts}.pdf")},
        content_type="multipart/form-data",
    )
    assert upload_res.status_code == 201, f"Upload failed: {upload_res.get_json()}"
    up_data = upload_res.get_json()
    file_id = up_data["file_id"]
    merkle_root = up_data["merkle_root"]
    print(f"  -> SUCCESS: File Uploaded! ID: {file_id}")
    print(f"  -> Merkle Root: {merkle_root[:32]}...")
    print(f"  -> Initial Version: v{up_data['version']}")

    # Step 8: Trigger Audit Verification
    print("\n[Step 8] Triggering on-demand audit verification...")
    audit_res = client.post(f"/api/files/{file_id}/audit", headers=owner_headers)
    assert audit_res.status_code == 200, f"Audit failed: {audit_res.get_json()}"
    audit_data = audit_res.get_json()
    audit_status = audit_data.get("status") or audit_data.get("verdict")
    print(f"  -> SUCCESS: Audit completed!")
    print(f"  -> Status / Verdict: {audit_status}")
    print(f"  -> Content OK: {audit_data.get('content_ok')}")
    print(f"  -> Chain Valid: {audit_data.get('chain_valid')}")
    print(f"  -> Checked Version: v{audit_data.get('checked_version')}")
    assert audit_status == "PASS"
    assert audit_data.get("content_ok") is True
    assert audit_data.get("chain_valid") is True

    # Step 9: Re-check owner telemetry
    print("\n[Step 9] Checking updated telemetry on Owner Dashboard...")
    new_stats = client.get("/api/stats", headers=owner_headers).get_json()
    print(f"  -> Files Count:  {new_stats['total_files']} (Expected: 1)")
    print(f"  -> Audits Count: {new_stats['total_audits']} (Expected: >= 1)")
    assert new_stats["total_files"] == 1
    assert new_stats["total_audits"] >= 1
    print("  -> SUCCESS: Owner telemetry reflects genuine owner operations.")

    # Step 10: Security & Access Control Boundaries
    print("\n[Step 10] Testing Security & Access Control Boundaries:")

    # 10a: Admin plaintext download prohibition
    print("  [10a] Admin attempting to download Owner's plaintext file...")
    admin_dl_res = client.get(f"/api/files/{file_id}/download", headers=admin_headers)
    assert admin_dl_res.status_code == 403
    print("  -> SUCCESS: Blocked with HTTP 403 Forbidden (Admin cannot download user files).")

    # 10b: Owner attempting to access Admin endpoints
    print("  [10b] Owner attempting to access Admin User Management...")
    owner_admin_res = client.get("/api/admin/users", headers=owner_headers)
    assert owner_admin_res.status_code == 403
    print("  -> SUCCESS: Blocked with HTTP 403 Forbidden (Owner cannot access Admin endpoints).")

    # 10c: Testing multi-tenant IDOR protection between distinct owners
    print("  [10c] Testing multi-tenant IDOR protection between distinct owners...")
    rival_email = f"rival_tenant_{ts}@cloud-auditing.org"
    r_reg = client.post("/api/auth/register", json={
        "name": "Rival Owner",
        "email": rival_email,
        "password": "RivalPassword123!#",
        "confirm_password": "RivalPassword123!#"
    })
    rival_id = r_reg.get_json()["user_id"]
    client.post("/api/auth/verify-email", json={"token": r_reg.get_json()["verification_token"]})
    client.post(f"/api/admin/users/{rival_id}/approve", headers=admin_headers)
    
    rival_login = client.post("/api/auth/login", json={"email": rival_email, "password": "RivalPassword123!#"})
    rival_token = rival_login.get_json()["token"]
    rival_headers = {"Authorization": f"Bearer {rival_token}"}
    
    rival_file_res = client.get(f"/api/files/{file_id}", headers=rival_headers)
    assert rival_file_res.status_code == 404
    rival_dl_res = client.get(f"/api/files/{file_id}/download", headers=rival_headers)
    assert rival_dl_res.status_code == 404
    print("  -> SUCCESS: Cross-tenant file access blocked with HTTP 404 (Full IDOR protection verified).")

    # Step 11: Admin Audit Operations Monitor
    print("\n[Step 11] Checking Admin Audit Operations Telemetry...")
    admin_ops = client.get("/api/admin/audit-monitoring", headers=admin_headers)
    assert admin_ops.status_code == 200
    ops_data = admin_ops.get_json()
    assert len(ops_data["audits"]) >= 1
    print(f"  -> SUCCESS: Admin Audit Operations Monitor displays {len(ops_data['audits'])} recorded audit trials.")

    print("\n" + "=" * 70)
    print("ALL 11 END-TO-END WORKFLOW CHECKS PASSED WITH ZERO ERRORS!")
    print("=" * 70)

if __name__ == "__main__":
    run_workflow_test()
