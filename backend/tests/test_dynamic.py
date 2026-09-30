import io
from pathlib import Path
import pytest


def test_dynamic_operations_and_history_verification(client, temp_env):
    """
    Test dynamic operations: modify, insert, append, delete.
    Each operation must:
    - Create a new chained version without full rebuild.
    - Preserve prior version blobs so historical chain remains verifiable.
    - Detect any tampering with historical version blobs.
    """
    # 1. Initial file upload (V1)
    initial_content = b"Block0_Initial_Bytes_For_Dynamic_Update_Testing"
    res = client.post(
        "/api/files",
        data={"file": (io.BytesIO(initial_content), "dynamic_doc.txt")},
        content_type="multipart/form-data",
    )
    assert res.status_code == 201
    file_id = res.get_json()["file_id"]
    assert res.get_json()["version"] == 1

    # 2. Modify block (V2)
    res_mod = client.post(
        f"/api/files/{file_id}/blocks",
        json={"op": "modify", "index": 0, "data": "Block0_MODIFIED_CONTENT"},
    )
    assert res_mod.status_code == 200
    assert res_mod.get_json()["version"] == 2
    assert res_mod.get_json()["status"] == "DYNAMIC_UPDATE_RECORDED"

    # 3. Insert block (V3)
    res_ins = client.post(
        f"/api/files/{file_id}/blocks",
        json={"op": "insert", "index": 1, "data": "Block1_INSERTED_CONTENT"},
    )
    assert res_ins.status_code == 200
    assert res_ins.get_json()["version"] == 3

    # 4. Append block (V4)
    res_app = client.post(
        f"/api/files/{file_id}/blocks",
        json={"op": "append", "data": "Block2_APPENDED_CONTENT"},
    )
    assert res_app.status_code == 200
    assert res_app.get_json()["version"] == 4

    # 5. Delete block (V5)
    res_del = client.post(
        f"/api/files/{file_id}/blocks",
        json={"op": "delete", "index": 0},
    )
    assert res_del.status_code == 200
    assert res_del.get_json()["version"] == 5

    # 6. Verify entire version chain up to V5
    res_audit = client.post(f"/api/files/{file_id}/audit")
    assert res_audit.status_code == 200
    assert res_audit.get_json()["status"] == "PASS"
    assert res_audit.get_json()["chain_valid"] is True

    # 7. Tamper with an old historical version blob on disk (e.g. V2 blob)
    vers_dir = Path(temp_env["VERSIONS_STORAGE_DIR"])
    v2_blob = vers_dir / f"{file_id}_v2"
    assert v2_blob.is_file()

    with open(v2_blob, "wb") as f:
        f.write(b"MALICIOUS_SILENT_HISTORICAL_ALTERATION_BY_ATTACKER")

    # Audit must detect broken history (Precedence 1)
    res_tampered_audit = client.post(f"/api/files/{file_id}/audit")
    assert res_tampered_audit.status_code == 200
    assert res_tampered_audit.get_json()["status"] == "VERSION_HISTORY_ALTERED"
    assert res_tampered_audit.get_json()["first_bad_version"] == 2
