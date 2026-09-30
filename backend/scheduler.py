import logging
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from audit import execute_audit, execute_batch_audit
from db import get_db

logger = logging.getLogger("audit_scheduler")


class AuditScheduler:
    """Lightweight background thread that periodically runs configured audits."""

    def __init__(self, db_path: Optional[Path] = None, check_interval_seconds: int = 30):
        self.db_path = db_path
        self.check_interval = check_interval_seconds
        self._running = False
        self._thread: Optional[threading.Thread] = None

    def start(self):
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()
        logger.info("AuditScheduler background thread started.")

    def stop(self):
        self._running = False
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2.0)

    def _loop(self):
        while self._running:
            try:
                self.run_pending_schedules()
            except Exception as e:
                logger.error(f"Error in scheduler execution cycle: {e}")
            time.sleep(self.check_interval)

    def run_pending_schedules(self):
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
                    if fid:
                        execute_audit(file_id=fid, db_path=self.db_path)
                    else:
                        all_files = [f["id"] for f in cursor.execute("SELECT id FROM files WHERE is_deleted = 0").fetchall()]
                        if all_files:
                            execute_batch_audit(file_ids=all_files, conn=conn)

                    cursor.execute("UPDATE schedules SET last_run = ? WHERE id = ?", (now.isoformat(), sch_id))
                    conn.commit()
        finally:
            conn.close()
