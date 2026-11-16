"""
Automated Auditor Service (TPA Automation) Package.
Runs in a separate process, maintains isolated auditor.db, holds zero server secrets.
"""
from auditor.db import get_auditor_db, init_auditor_db
from auditor.verifier import verify_merkle_proof, calculate_detection_probability
from auditor.service import AutomatedAuditorService

__all__ = [
    "get_auditor_db",
    "init_auditor_db",
    "verify_merkle_proof",
    "calculate_detection_probability",
    "AutomatedAuditorService",
]

