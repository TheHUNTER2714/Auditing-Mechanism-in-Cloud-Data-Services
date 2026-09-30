import hashlib
import io
import json
import sqlite3
from pathlib import Path
import pytest

from db import get_db


def test_upload_and_update_chain(client):
    """Test 1: Upload creates V1, update creates V2 linked to V1, audit passes."""
    # 1. Upload initial file
    res = client.post(
        "/api/files",
        data={"file": (io.BytesIO(b"Initial cloud data payload content"), "test_document.txt")},
        content_type="multipart/form-data",
    )
    assert res.status_code == 201
    data = res.get_json()
    assert data["status"] == "RECORDED_VERSION"
    assert data["version"] == 1
    file_id = data["file_id"]
    v1_chain_hash = data["chain_hash"]
    v1_content_hash = data["content_hash"]
    receipt_v1 = data["receipt"]
    assert receipt_v1["version"] == 1
    assert receipt_v1["chain_hash"] == v1_chain_hash

    # 2. Run initial audit
    audit_res = client.post(f"/api/files/{file_id}/audit", json={"receipt": receipt_v1})
    assert audit_res.status_code == 200
    audit_data = audit_res.get_json()
    assert audit_data["status"] == "PASS"
    assert audit_data["chain_valid"] is True
    assert audit_data["content_ok"] is True
    assert len(audit_data["steps"]) >= 4

    # 3. Authorized update with new content
    upd_res = client.post(
        f"/api/files/{file_id}/versions",
        data={"file": (io.BytesIO(b"Updated authorized cloud payload revision 2"), "test_document.txt")},
        content_type="multipart/form-data",
    )
    assert upd_res.status_code == 201
    upd_data = upd_res.get_json()
    assert upd_data["status"] == "RECORDED_VERSION"
    assert upd_data["version"] == 2
    v2_chain_hash = upd_data["chain_hash"]
    receipt_v2 = upd_data["receipt"]
    assert receipt_v2["version"] == 2

    # 4. Verify version list
    ver_res = client.get(f"/api/files/{file_id}/versions")
    assert ver_res.status_code == 200
    versions = ver_res.get_json()["versions"]
    assert len(versions) == 2
    assert versions[0]["version"] == 1
    assert versions[1]["version"] == 2
    # Linkage verification: V2 prev_chain_hash matches V1 chain_hash
    assert versions[1]["prev_chain_hash"] == v1_chain_hash

    # 5. Run audit on updated file
    audit_v2 = client.post(f"/api/files/{file_id}/audit", json={"receipt": receipt_v2})
    assert audit_v2.status_code == 200
    assert audit_v2.get_json()["status"] == "PASS"


def test_editing_current_file_gives_tampered(client, app):
    """Test 2: Editing current file on disk gives TAMPERED."""
    res = client.post(
        "/api/files",
        data={"file": (io.BytesIO(b"Original pristine data"), "file1.txt")},
        content_type="multipart/form-data",
    )
    file_id = res.get_json()["file_id"]

    # Directly mutate the current file on disk
    current_path = Path(app.config["CURRENT_STORAGE_DIR"]) / file_id
    current_path.write_bytes(b"Maliciously altered content injected directly into disk storage")

    # Audit must detect content tampering
    audit_res = client.post(f"/api/files/{file_id}/audit")
    assert audit_res.status_code == 200
    data = audit_res.get_json()
    assert data["status"] == "TAMPERED"
    assert data["chain_valid"] is True
    assert data["content_ok"] is False


def test_editing_version_row_gives_version_history_altered(client, app):
    """Test 3: Editing a version row in SQLite gives VERSION_HISTORY_ALTERED."""
    res = client.post(
        "/api/files",
        data={"file": (io.BytesIO(b"Secure data record"), "file2.txt")},
        content_type="multipart/form-data",
    )
    file_id = res.get_json()["file_id"]

    # Mutate version row in SQLite
    conn = get_db(app.config["DB_PATH"])
    conn.execute(
        "UPDATE versions SET content_hash = ? WHERE file_id = ? AND version = 1",
        ("0" * 64, file_id),
    )
    conn.commit()
    conn.close()

    # Audit must report VERSION_HISTORY_ALTERED
    audit_res = client.post(f"/api/files/{file_id}/audit")
    assert audit_res.status_code == 200
    data = audit_res.get_json()
    assert data["status"] == "VERSION_HISTORY_ALTERED"
    assert data["chain_valid"] is False
    assert data["first_bad_version"] == 1


def test_history_recompute_without_secret_fails(client, app):
    """Test 4: Editing version row and recomputing hash WITHOUT the secret still gives VERSION_HISTORY_ALTERED."""
    res = client.post(
        "/api/files",
        data={"file": (io.BytesIO(b"Target data for forged recalculation"), "file3.txt")},
        content_type="multipart/form-data",
    )
    file_id = res.get_json()["file_id"]

    conn = get_db(app.config["DB_PATH"])
    row = conn.execute("SELECT * FROM versions WHERE file_id = ? AND version = 1", (file_id,)).fetchone()
    genesis_prev = row["prev_chain_hash"]
    created_at = row["created_at"]

    # Attacker alters content hash to new value
    new_content_hash = "f" * 64

    # Attacker attempts to forge chain_hash using SHA-256 or an arbitrary secret
    bogus_key = b"attacker_guess_key"
    forged_msg = f"{file_id}|1|{new_content_hash}|{genesis_prev}|{created_at}".encode("utf-8")
    forged_chain_hash = hashlib.sha256(forged_msg).hexdigest()

    conn.execute(
        "UPDATE versions SET content_hash = ?, chain_hash = ? WHERE file_id = ? AND version = 1",
        (new_content_hash, forged_chain_hash, file_id),
    )
    conn.commit()
    conn.close()

    audit_res = client.post(f"/api/files/{file_id}/audit")
    assert audit_res.status_code == 200
    data = audit_res.get_json()
    assert data["status"] == "VERSION_HISTORY_ALTERED"
    assert data["chain_valid"] is False


def test_deleting_or_reordering_versions_fails(client, app):
    """Test 5: Deleting or reordering a version row gives VERSION_HISTORY_ALTERED."""
    # Create V1, V2, V3
    res = client.post(
        "/api/files",
        data={"file": (io.BytesIO(b"Data V1"), "doc.txt")},
        content_type="multipart/form-data",
    )
    file_id = res.get_json()["file_id"]
    client.post(
        f"/api/files/{file_id}/versions",
        data={"file": (io.BytesIO(b"Data V2"), "doc.txt")},
        content_type="multipart/form-data",
    )
    client.post(
        f"/api/files/{file_id}/versions",
        data={"file": (io.BytesIO(b"Data V3"), "doc.txt")},
        content_type="multipart/form-data",
    )

    # Delete V2 to create a gap in history
    conn = get_db(app.config["DB_PATH"])
    conn.execute("DELETE FROM versions WHERE file_id = ? AND version = 2", (file_id,))
    conn.commit()
    conn.close()

    audit_res = client.post(f"/api/files/{file_id}/audit")
    assert audit_res.status_code == 200
    data = audit_res.get_json()
    assert data["status"] == "VERSION_HISTORY_ALTERED"
    assert data["chain_valid"] is False


def test_receipt_rollback_prevention(client, app):
    """Test 6: Rolling back to an older version with a newer receipt gives VERSION_HISTORY_ALTERED."""
    res = client.post(
        "/api/files",
        data={"file": (io.BytesIO(b"Version 1 Content"), "ledger.txt")},
        content_type="multipart/form-data",
    )
    file_id = res.get_json()["file_id"]

    res_v2 = client.post(
        f"/api/files/{file_id}/versions",
        data={"file": (io.BytesIO(b"Version 2 Authorized"), "ledger.txt")},
        content_type="multipart/form-data",
    )
    receipt_v2 = res_v2.get_json()["receipt"]

    # Malicious server / attacker deletes V2 and sets current_version back to 1
    conn = get_db(app.config["DB_PATH"])
    conn.execute("DELETE FROM versions WHERE file_id = ? AND version = 2", (file_id,))
    conn.execute("UPDATE files SET current_version = 1 WHERE id = ?", (file_id,))
    conn.commit()
    conn.close()

    # Client presents receipt for V2
    audit_res = client.post(f"/api/files/{file_id}/audit", json={"receipt": receipt_v2})
    assert audit_res.status_code == 200
    data = audit_res.get_json()
    assert data["status"] == "VERSION_HISTORY_ALTERED"
    assert "Rollback detected" in data["chain_reason"]


def test_missing_file_gives_tampered_file_missing(client, app):
    """Test 7: Missing current file on disk gives TAMPERED with FILE_MISSING."""
    res = client.post(
        "/api/files",
        data={"file": (io.BytesIO(b"Cloud content payload"), "vital.txt")},
        content_type="multipart/form-data",
    )
    file_id = res.get_json()["file_id"]

    # Delete current file on disk
    current_path = Path(app.config["CURRENT_STORAGE_DIR"]) / file_id
    current_path.unlink()

    audit_res = client.post(f"/api/files/{file_id}/audit")
    assert audit_res.status_code == 200
    data = audit_res.get_json()
    assert data["status"] == "TAMPERED"
    assert data["content_hash_actual"] == "FILE_MISSING"


def test_demo_routes_gated_by_flag(client, client_demo):
    """Test 8: Demo routes give 404 when ENABLE_DEMO_TAMPER=False, but succeed when True."""
    # 1. Flag is False -> returns 404
    res_tamper = client.post("/api/demo/tamper-file/fake-id")
    assert res_tamper.status_code == 404
    res_reset = client.post("/api/demo/reset")
    assert res_reset.status_code == 404
    res_seed = client.post("/api/demo/seed")
    assert res_seed.status_code == 404

    # 2. Flag is True -> succeed
    seed_res = client_demo.post("/api/demo/seed")
    assert seed_res.status_code == 200
    seed_data = seed_res.get_json()
    assert seed_data["status"] == "DEMO_SEEDED"
    assert seed_data["files_created"] == 2
    seeded_id = seed_data["file_ids"][0]

    # Tamper file with demo client
    tamper_res = client_demo.post(f"/api/demo/tamper-file/{seeded_id}")
    assert tamper_res.status_code == 200
    assert tamper_res.get_json()["status"] == "TAMPERED_ON_DISK"

    # Reset with demo client
    reset_res = client_demo.post("/api/demo/reset")
    assert reset_res.status_code == 200
    assert reset_res.get_json()["status"] == "RESET_SUCCESS"


def test_stats_numbers_match_db(client, client_demo, app_demo):
    """Test 9: Stats numbers accurately match counts from SQLite."""
    # Reset first
    client_demo.post("/api/demo/reset")

    stats_empty = client_demo.get("/api/stats").get_json()
    assert stats_empty["total_files"] == 0
    assert stats_empty["total_versions"] == 0
    assert stats_empty["audits_performed"] == 0
    assert stats_empty["tamper_events"] == 0

    # Seed demo files (2 files, 3 versions)
    client_demo.post("/api/demo/seed")

    conn = get_db(app_demo.config["DB_PATH"])
    file_count = conn.execute("SELECT COUNT(*) FROM files").fetchone()[0]
    version_count = conn.execute("SELECT COUNT(*) FROM versions").fetchone()[0]
    conn.close()

    stats_seeded = client_demo.get("/api/stats").get_json()
    assert stats_seeded["total_files"] == file_count
    assert stats_seeded["total_versions"] == version_count
    assert stats_seeded["is_demo_seeded"] is True
    assert stats_seeded["storage_infrastructure"] == "simulated cloud storage"
