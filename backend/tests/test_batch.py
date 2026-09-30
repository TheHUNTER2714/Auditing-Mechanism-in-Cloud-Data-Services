import io
from pathlib import Path
import pytest


def test_batch_auditing_mixed_files(client, temp_env):
    """
    Test batch auditing:
    Auditing multiple files concurrently returns correct per-file statuses
    and aggregate summary, and appends records to the simulated blockchain ledger.
    """
    # 1. Upload File 1 (Valid)
    res1 = client.post(
        "/api/files",
        data={"file": (io.BytesIO(b"Valid File 1 Payload Content For Batch Test"), "file1.txt")},
        content_type="multipart/form-data",
    )
    fid1 = res1.get_json()["file_id"]

    # 2. Upload File 2 (Will be tampered)
    res2 = client.post(
        "/api/files",
        data={"file": (io.BytesIO(b"File 2 Payload Content That Will Be Corrupted"), "file2.txt")},
        content_type="multipart/form-data",
    )
    fid2 = res2.get_json()["file_id"]

    # 3. Corrupt File 2 on disk
    curr_dir = Path(temp_env["CURRENT_STORAGE_DIR"])
    f2_path = curr_dir / fid2
    with open(f2_path, "wb") as f:
        f.write(b"CORRUPTED_BYTES_IN_FILE_2_STORAGE")

    # 4. Run batch audit over both files
    batch_res = client.post("/api/audit/batch", json={"file_ids": [fid1, fid2]})
    assert batch_res.status_code == 200
    batch_data = batch_res.get_json()

    # Aggregate status must be TAMPERED because one file failed
    assert batch_data["status"] == "TAMPERED"
    assert batch_data["total_files"] == 2
    assert batch_data["passed_files"] == 1
    assert batch_data["failed_files"] == 1

    results_map = {r["file_id"]: r for r in batch_data["results"]}
    assert results_map[fid1]["status"] == "PASS"
    assert results_map[fid1]["passed"] is True
    assert results_map[fid2]["status"] == "TAMPERED"
    assert results_map[fid2]["passed"] is False

    # Check ledger contains batch summary
    ledger_res = client.get("/api/ledger")
    assert ledger_res.status_code == 200
    entries = ledger_res.get_json()
    assert any(e["entry_type"] == "AUDIT_RESULT" for e in entries)
