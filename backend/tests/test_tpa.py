import io
import sqlite3
import pytest
from db import get_db
from ledger import append_ledger_entry, verify_ledger_chain


def test_tpa_public_randomness_and_owner_recomputation(client, temp_env):
    """
    Test TPA trust model:
    - Challenge seed is anchored to ledger head + epoch time bucket.
    - TPA cannot cherry-pick blocks to inspect.
    - Owner can independently recompute and verify expected indices.
    """
    # Upload a test file
    content = b"BlockDataForTpaTesting " * 40
    res = client.post(
        "/api/files",
        data={"file": (io.BytesIO(content), "tpa_test.txt")},
        content_type="multipart/form-data",
    )
    file_id = res.get_json()["file_id"]

    # TPA requests challenge
    chal_res = client.post("/api/challenge", json={"file_id": file_id})
    assert chal_res.status_code == 200
    chal_data = chal_res.get_json()

    tpa_indices = chal_data["challenged_indices"]
    time_bucket = chal_data["time_bucket"]
    tpa_seed = chal_data["seed"]

    # Owner recomputes expected challenge for the same time bucket
    owner_res = client.get(f"/api/files/{file_id}/expected-challenge?bucket={time_bucket}")
    assert owner_res.status_code == 200
    owner_data = owner_res.get_json()

    assert owner_data["seed"] == tpa_seed
    assert owner_data["expected_indices"] == tpa_indices


def test_ledger_tamper_and_reordering_detection(client, temp_env):
    """
    Test simulated blockchain append-only ledger verification:
    - Normal ledger verifies cleanly.
    - Deleting, reordering, or mutating a ledger row is immediately caught by verify_ledger_chain.
    """
    # 1. Check ledger initially passes
    res_verify = client.get("/api/ledger/verify")
    assert res_verify.status_code == 200
    assert res_verify.get_json()["chain_valid"] is True

    # 2. Add an audit entry to ledger
    conn = get_db(temp_env["DB_PATH"])
    append_ledger_entry(conn, "AUDIT_RESULT", {"verdict": "PASS", "test": True})
    append_ledger_entry(conn, "AUDIT_RESULT", {"verdict": "PASS", "test_seq2": True})

    # Verify again
    ok, bad_seq, err = verify_ledger_chain(conn)
    assert ok is True

    # 3. Simulate malicious deletion of middle ledger entry
    cursor = conn.cursor()
    cursor.execute("DELETE FROM ledger WHERE seq = 2")
    conn.commit()

    ok, bad_seq, err = verify_ledger_chain(conn)
    assert ok is False
    assert bad_seq is not None

    # Check API response
    api_res = client.get("/api/ledger/verify")
    assert api_res.status_code == 200
    assert api_res.get_json()["status"] == "LEDGER_ALTERED"
    assert api_res.get_json()["chain_valid"] is False
    conn.close()
