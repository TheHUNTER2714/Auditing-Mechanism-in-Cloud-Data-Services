import io
import pytest


def test_dedup_pow_and_dpd_resistance(client, temp_env):
    """
    Test deduplication pattern degradation resistance, PoW verification, and duplicate-faking prevention.
    """
    file_bytes = b"Deterministic payload for deduplication and PoW testing 2026." * 10
    blinded_owner_1 = "blinded_owner_user_1_hex_signature"
    blinded_owner_2 = "blinded_owner_user_2_hex_signature"

    # 1. Initial upload by User 1
    res1 = client.post(
        "/api/files",
        data={
            "file": (io.BytesIO(file_bytes), "original_report.dat"),
            "blinded_owner": blinded_owner_1,
        },
        content_type="multipart/form-data",
    )
    assert res1.status_code == 201
    file_hash = res1.get_json()["content_hash"]
    assert res1.get_json()["status"] == "RECORDED_VERSION"

    # 2. Subsequent upload by User 2 with identical content -> Deduplication applied
    res2 = client.post(
        "/api/files",
        data={
            "file": (io.BytesIO(file_bytes), "second_report.dat"),
            "blinded_owner": blinded_owner_2,
        },
        content_type="multipart/form-data",
    )
    assert res2.status_code == 200
    res2_data = res2.get_json()
    assert res2_data["status"] == "DEDUPLICATED"
    assert res2_data["file_hash"] == file_hash

    # 3. Forged subsequent upload simulating invalid Proof-of-Ownership
    res_fake_pow = client.post(
        "/api/files",
        data={
            "file": (io.BytesIO(file_bytes), "fake_pow_report.dat"),
            "blinded_owner": "blinded_attacker",
            "simulate_fake_pow": "true",
        },
        content_type="multipart/form-data",
    )
    assert res_fake_pow.status_code == 403
    assert res_fake_pow.get_json()["error"] == "POW_FAILED"

    # 4. Duplicate-faking attack: upload with incorrect declared Merkle root
    res_fake_root = client.post(
        "/api/files",
        data={
            "file": (io.BytesIO(b"Unique content for fake root test"), "fake_root.txt"),
            "merkle_root": "00112233445566778899aabbccddeeff" * 2,
        },
        content_type="multipart/form-data",
    )
    assert res_fake_root.status_code == 400
    assert res_fake_root.get_json()["error"] == "DUPLICATE_FAKING_SUSPECTED"

    # 5. DPD check: Owner 1 and Owner 2 verify their blinded IDs exist in ledger
    check1 = client.post(
        "/api/ownership/check",
        json={"file_hash": file_hash, "blinded_owner": blinded_owner_1},
    )
    assert check1.status_code == 200
    assert check1.get_json()["found_in_ledger"] is True

    check2 = client.post(
        "/api/ownership/check",
        json={"file_hash": file_hash, "blinded_owner": blinded_owner_2},
    )
    assert check2.status_code == 200
    assert check2.get_json()["found_in_ledger"] is True

    # Unregistered owner check returns false
    check_fake = client.post(
        "/api/ownership/check",
        json={"file_hash": file_hash, "blinded_owner": "nonexistent_owner"},
    )
    assert check_fake.status_code == 200
    assert check_fake.get_json()["found_in_ledger"] is False
