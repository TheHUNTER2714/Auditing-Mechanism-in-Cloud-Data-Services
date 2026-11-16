import logging
import threading
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from audit import execute_audit, execute_batch_audit
from db import get_db
from policy import append_audit_log, load_policy, purge_expired_soft_deletes
import config

logger = logging.getLogger("audit_scheduler")


class AuditScheduler:
    """
    Production-grade background thread for periodic audit orchestration:
    - Enforces distributed job locking in audit_jobs table to prevent duplicate runs across multi-worker deployments.
    - Tracks audit job lifecycle (PENDING -> RUNNING -> COMPLETED / FAILED).
    - Automatically recovers orphaned/crashed jobs upon startup.
    - Executes policy engine watchdogs and retention cleanup.
    """

    def __init__(self, db_path: Optional[Path] = None, check_interval_seconds: int = 30):
        self.db_path = db_path
        self.check_interval = check_interval_seconds
        self._running = False
        self._thread: Optional[threading.Thread] = None

    def start(self):
        if self._running:
            return
        self._running = True
        self.recover_orphaned_jobs()
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()
        logger.info("AuditScheduler background thread started with distributed job locking.")

    def stop(self):
        self._running = False
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2.0)

    def _loop(self):
        while self._running:
            try:
                self.run_pending_schedules()
                self.run_policy_watchdog()
            except Exception as e:
                logger.error(f"Error in scheduler execution cycle: {e}")
            time.sleep(self.check_interval)

    def recover_orphaned_jobs(self):
        """Recover pending or stalled RUNNING jobs left behind after process restarts."""
        conn = get_db(self.db_path)
        try:
            cursor = conn.cursor()
            now_iso = datetime.now(timezone.utc).isoformat()
            # Mark stalled RUNNING jobs as PENDING (for retry) or FAILED (if max retries exceeded)
            stalled = cursor.execute("SELECT id, retry_count FROM audit_jobs WHERE status = 'RUNNING'").fetchall()
            for job in stalled:
                if job["retry_count"] < 3:
                    cursor.execute(
                        "UPDATE audit_jobs SET status = 'PENDING', retry_count = retry_count + 1, updated_at = ? WHERE id = ?",
                        (now_iso, job["id"]),
                    )
                else:
                    cursor.execute(
                        "UPDATE audit_jobs SET status = 'FAILED', error_message = 'Failed after max worker restart retries', updated_at = ? WHERE id = ?",
                        (now_iso, job["id"]),
                    )
            conn.commit()
        except Exception as e:
            logger.warning(f"Could not recover orphaned jobs: {e}")
        finally:
            conn.close()

    def run_pending_schedules(self):
        """Runs scheduled audits using database-level job locking to avoid duplicate execution."""
        conn = get_db(self.db_path)
        try:
            cursor = conn.cursor()
            rows = cursor.execute("SELECT id, file_id, interval_minutes, last_run, enabled FROM schedules WHERE enabled = 1").fetchall()
            now = datetime.now(timezone.utc)

            for r in rows:
                sch_id = r["id"]
                fid = r["file_id"]
                interval = r["interval_minutes"]
                last_run_str = r["last_run"]

                should_run = False
                if not last_run_str:
                    should_run = True
                else:
                    try:
                        last_run_dt = datetime.fromisoformat(last_run_str)
                        elapsed_min = (now - last_run_dt).total_seconds() / 60.0
                        if elapsed_min >= interval:
                            should_run = True
                    except Exception:
                        should_run = True

                if should_run:
                    # Construct deterministic cycle key for distributed job locking
                    time_bucket = now.strftime("%Y%m%d%H%M")
                    job_key = f"sch-{sch_id}-{fid or 'all'}-{time_bucket}"

                    # Determine owner
                    owner_id = "system"
                    if fid:
                        f_row = cursor.execute("SELECT owner_id FROM files WHERE id = ?", (fid,)).fetchone()
                        if f_row and f_row["owner_id"]:
                            owner_id = f_row["owner_id"]

                    # Attempt to acquire lock by inserting into audit_jobs
                    job_uuid = str(uuid.uuid4())
                    now_iso = now.isoformat()
                    try:
                        cursor.execute(
                            """
                            INSERT INTO audit_jobs (id, job_id, file_id, owner_id, status, retry_count, created_at, updated_at)
                            VALUES (?, ?, ?, ?, 'RUNNING', 0, ?, ?)
                            """,
                            (job_uuid, job_key, fid, owner_id, now_iso, now_iso),
                        )
                        conn.commit()
                    except Exception as lock_err:
                        # Another worker process already acquired this schedule slot
                        logger.debug(f"Job slot {job_key} could not be acquired: {lock_err}")
                        continue

                    # Execute audit with error tracking
                    try:
                        if fid:
                            execute_audit(file_id=fid, db_path=self.db_path, actor_type="SYSTEM", trigger="SCHEDULED")
                        else:
                            all_files = [f["id"] for f in cursor.execute("SELECT id FROM files WHERE is_deleted = 0 AND quarantined = 0").fetchall()]
                            if all_files:
                                execute_batch_audit(file_ids=all_files, conn=conn)

                        cursor.execute(
                            "UPDATE audit_jobs SET status = 'COMPLETED', updated_at = ? WHERE id = ?",
                            (datetime.now(timezone.utc).isoformat(), job_uuid),
                        )
                        cursor.execute("UPDATE schedules SET last_run = ? WHERE id = ?", (now_iso, sch_id))
                        conn.commit()
                    except Exception as exc:
                        logger.error(f"Audit job {job_key} execution failed: {exc}")
                        cursor.execute(
                            "UPDATE audit_jobs SET status = 'FAILED', error_message = ?, updated_at = ? WHERE id = ?",
                            (str(exc), datetime.now(timezone.utc).isoformat(), job_uuid),
                        )
                        conn.commit()
        finally:
            conn.close()

    def run_policy_watchdog(self):
        """Watchdog: verifies scheduled audits executed within 2 x interval, raises AUDIT_MISSED if skipped."""
        conn = get_db(self.db_path)
        try:
            cursor = conn.cursor()
            now = datetime.now(timezone.utc)
            delegations = cursor.execute("SELECT * FROM delegations WHERE status = 'ACTIVE'").fetchall()

            for d in delegations:
                fid = d["file_id"]
                interval = d["interval_minutes"]
                watchdog_window_min = interval * 2.0

                # Find latest audit for this file
                last_audit = cursor.execute(
                    "SELECT created_at FROM audits WHERE file_id = ? ORDER BY id DESC LIMIT 1",
                    (fid,),
                ).fetchone()

                reference_time_str = last_audit["created_at"] if last_audit else d["created_at"]
                try:
                    ref_dt = datetime.fromisoformat(reference_time_str)
                    elapsed_min = (now - ref_dt).total_seconds() / 60.0
                    if elapsed_min > watchdog_window_min:
                        # Check if we already alerted for this recently
                        recent_alert = cursor.execute(
                            "SELECT id FROM alerts WHERE kind = 'AUDIT_MISSED' AND file_ref = ? AND acknowledged = 0",
                            (fid,),
                        ).fetchone()
                        if not recent_alert:
                            cursor.execute(
                                """
                                INSERT INTO alerts (severity, kind, file_ref, message, created_at, acknowledged)
                                VALUES ('warning', 'AUDIT_MISSED', ?, ?, ?, 0)
                                """,
                                (
                                    fid,
                                    f"Watchdog detected missed audit: delegation on {fid} was not audited within 2x interval ({int(watchdog_window_min)} min).",
                                    now.isoformat(),
                                ),
                            )
                            append_audit_log(
                                conn,
                                actor_type="SYSTEM",
                                actor_id="policy-watchdog",
                                action="RAISE_AUDIT_MISSED_ALERT",
                                resource=f"file:{fid}",
                                result="ALERTED",
                                details={"rule": "RULE_WATCHDOG_MISSED_AUDIT", "elapsed_minutes": elapsed_min, "threshold": watchdog_window_min},
                            )
                            conn.commit()
                except Exception:
                    pass

            # Also run soft-deleted data purge check
            purge_expired_soft_deletes(conn, config.CURRENT_STORAGE_DIR, config.VERSIONS_STORAGE_DIR)
        finally:
            conn.close()
