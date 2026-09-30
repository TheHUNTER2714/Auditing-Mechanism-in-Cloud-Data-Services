import io
from pathlib import Path
import pytest
from scheduler import AuditScheduler


def test_monitoring_events_and_tamper_alerts(client, temp_env):
    """
    Test activity monitoring, actor-attributed event logging, and automatic alert generation.
    """
    # 1. Upload a file
    res = client.post(
        "/api/files",
        data={"file": (io.BytesIO(b"Monitoring test file bytes"), "monitored_file.txt")},
        content_type="multipart/form-data",
    )
    fid = res.get_json()["file_id"]

    # Check event log records the upload
    events_res = client.get("/api/events")
    assert events_res.status_code == 200
    events = events_res.get_json()
    assert len(events) >= 1
    upload_event = next(e for e in events if e["action"] == "UPLOAD")
    assert upload_event["target"] == fid

    # 2. Corrupt storage on disk
    curr_dir = Path(temp_env["CURRENT_STORAGE_DIR"])
    f_path = curr_dir / fid
    with open(f_path, "wb") as f:
        f.write(b"CORRUPTED_MONITORING_PAYLOAD")

    # Run audit to trigger security alert
    audit_res = client.post(f"/api/files/{fid}/audit")
    assert audit_res.status_code == 200
    assert audit_res.get_json()["status"] == "TAMPERED"

    # Verify alert was generated
    alerts_res = client.get("/api/alerts")
    assert alerts_res.status_code == 200
    alerts = alerts_res.get_json()
    assert len(alerts) >= 1
    tamper_alert = next(a for a in alerts if a["kind"] == "TAMPERED")
    assert tamper_alert["severity"] == "critical"
    assert fid in tamper_alert["file_ref"]

    # 3. Acknowledge alert
    ack_res = client.post(f"/api/alerts/{tamper_alert['id']}/ack")
    assert ack_res.status_code == 200
    assert ack_res.get_json()["status"] == "ACKNOWLEDGED"


def test_audit_reports_export(client, temp_env):
    """
    Test CSV and PDF audit reports export with ledger signature.
    """
    # Upload and audit to populate audit table
    res = client.post(
        "/api/files",
        data={"file": (io.BytesIO(b"Report test content"), "report_file.txt")},
        content_type="multipart/form-data",
    )
    fid = res.get_json()["file_id"]
    client.post(f"/api/files/{fid}/audit")

    # 1. CSV export
    csv_res = client.get("/api/reports/audits.csv")
    assert csv_res.status_code == 200
    assert csv_res.mimetype == "text/csv"
    csv_text = csv_res.data.decode("utf-8")
    assert "AUDIT ID" in csv_text
    assert "SIGNATURE LINE: LEDGER HEAD HASH" in csv_text

    # 2. PDF export
    pdf_res = client.get("/api/reports/audits.pdf")
    assert pdf_res.status_code == 200
    assert pdf_res.mimetype == "application/pdf"
    assert pdf_res.data.startswith(b"%PDF-")


def test_scheduled_audit_execution(client, temp_env):
    """
    Test background audit scheduling registration and execution.
    """
    # 1. Register a schedule
    sch_res = client.post("/api/schedules", json={"interval_minutes": 10})
    assert sch_res.status_code == 201
    sch_id = sch_res.get_json()["id"]

    # 2. List schedules
    list_res = client.get("/api/schedules")
    assert list_res.status_code == 200
    assert len(list_res.get_json()) >= 1

    # 3. Run pending schedules using scheduler instance
    scheduler = AuditScheduler(db_path=temp_env["DB_PATH"])
    scheduler.run_pending_schedules()

    # Verify last_run timestamp was updated
    updated_res = client.get("/api/schedules")
    sch_item = next(s for s in updated_res.get_json() if s["id"] == sch_id)
    assert sch_item["last_run"] is not None
