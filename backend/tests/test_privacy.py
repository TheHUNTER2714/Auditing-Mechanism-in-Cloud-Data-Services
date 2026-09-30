import io
import pytest
from auth import (
    compute_blinded_file_tag,
    generate_token,
    generate_user_blinding_key,
)


def test_blinded_file_tag_unlinkability():
    """
    Ownership Privacy Verification:
    Two audits of the exact same file using different nonces r must yield
    cryptographically unlinkable tags to any entity without user secret key k_u.
    """
    user_key = generate_user_blinding_key()
    file_hash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"

    r1 = "nonce_random_alpha_1"
    r2 = "nonce_random_beta_2"

    tag1 = compute_blinded_file_tag(user_key, file_hash, r1)
    tag2 = compute_blinded_file_tag(user_key, file_hash, r2)

    assert tag1 != tag2
    assert len(tag1) == 64
    assert len(tag2) == 64

    # Tag with different user key must also differ completely
    other_user_key = generate_user_blinding_key()
    tag_other = compute_blinded_file_tag(other_user_key, file_hash, r1)
    assert tag1 != tag_other


def test_tpa_endpoint_privacy_and_download_restriction(client, temp_env):
    """
    TPA Role Privacy Enforcement:
    - TPA receives blinded names, not raw sensitive display names.
    - TPA is strictly forbidden from downloading file payloads.
    """
    # 1. Upload a file as Owner
    content = b"Confidential business data that TPA must not download."
    res = client.post(
        "/api/files",
        data={"file": (io.BytesIO(content), "confidential_financial_report.pdf")},
        content_type="multipart/form-data",
    )
    assert res.status_code == 201
    file_id = res.get_json()["file_id"]

    # 2. Create TPA token
    tpa_token = generate_token("tpa-test-id", "tpa@auditor.org", "TPA")
    headers = {"Authorization": f"Bearer {tpa_token}"}

    # 3. TPA lists files: plaintext name must be blinded
    files_res = client.get("/api/files", headers=headers)
    assert files_res.status_code == 200
    files_data = files_res.get_json()
    assert len(files_data) >= 1
    tpa_item = next(f for f in files_data if f["id"] == file_id)

    assert "confidential_financial_report.pdf" not in tpa_item["display_name"]
    assert tpa_item["display_name"].startswith("BLINDED_")

    # 4. TPA attempts to download file: must be rejected with 403 Forbidden
    dl_res = client.get(f"/api/files/{file_id}/download", headers=headers)
    assert dl_res.status_code == 403
    assert dl_res.get_json()["error"] == "FORBIDDEN"
