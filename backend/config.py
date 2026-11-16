import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

def load_dotenv(path: Path) -> None:
    """Zero-dependency .env file parser."""
    if not path.is_file():
        return
    try:
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                k = k.strip()
                v = v.strip().strip("'\"")
                if k and k not in os.environ:
                    os.environ[k] = v
    except Exception:
        pass

# Automatically load .env from backend directory or project root
load_dotenv(BASE_DIR / ".env")
load_dotenv(BASE_DIR.parent / ".env")

# Simulated cloud storage directory
STORAGE_DIR = Path(os.environ.get("STORAGE_DIR", BASE_DIR / "storage"))
CURRENT_STORAGE_DIR = STORAGE_DIR / "current"
VERSIONS_STORAGE_DIR = STORAGE_DIR / "versions"

# SQLite database file path
DB_PATH = Path(os.environ.get("DB_PATH", BASE_DIR / "audit.db"))

# Secret key for HMAC-SHA256 version chaining
CHAIN_SECRET = os.environ.get("CHAIN_SECRET", "")

# Cryptographic block tag secret (K_tag), never stored in DB
K_TAG = os.environ.get("K_TAG", os.environ.get("TAG_SECRET", ""))

# Secret for authentication tokens
JWT_SECRET = os.environ.get("JWT_SECRET", "")

# Secret for tamper-evident system audit log
LOG_SECRET = os.environ.get("LOG_SECRET", "")

# Automated Auditor Service Token
AUDITOR_SERVICE_TOKEN = os.environ.get("AUDITOR_SERVICE_TOKEN", "")

# Block size in bytes for Merkle tree and tag generation (default 64 KB)
BLOCK_SIZE = int(os.environ.get("BLOCK_SIZE", 64 * 1024))

# Public randomness epoch time bucket in seconds (5 minutes)
TIME_BUCKET_SECONDS = int(os.environ.get("TIME_BUCKET_SECONDS", 300))

# Demo attacker tamper routes flag (default False)
DEMO_MODE = os.environ.get("DEMO_MODE", os.environ.get("ENABLE_DEMO_TAMPER", "false")).lower() in ("true", "1", "yes")
ENABLE_DEMO_TAMPER = DEMO_MODE

# Policy Engine settings
AUTO_APPROVE = os.environ.get("AUTO_APPROVE", "false").lower() in ("true", "1", "yes")
ALLOWED_EMAIL_DOMAINS = [d.strip().lower() for d in os.environ.get("ALLOWED_EMAIL_DOMAINS", "").split(",") if d.strip()]
RETENTION_DAYS = int(os.environ.get("RETENTION_DAYS", 30))

# Maximum upload size in megabytes (default 25 MB)
MAX_UPLOAD_MB = int(os.environ.get("MAX_UPLOAD_MB", 25))
MAX_CONTENT_LENGTH = MAX_UPLOAD_MB * 1024 * 1024

# Allowed CORS origins
cors_env = os.environ.get("CORS_ORIGINS", "")
if cors_env:
    CORS_ORIGINS = [o.strip() for o in cors_env.split(",") if o.strip()]
else:
    CORS_ORIGINS = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5000",
        "http://127.0.0.1:5000",
    ]

FORBIDDEN_SECRETS = {
    "bt032-dev-insecure-fallback-secret-2026",
    "bt032-auth-token-secret-2026",
    "bt032-k-tag-secret-integrity-2026",
    "bt032_cloud_audit_secret_key_2026",
    "bt032_cloud_chain_secret_key_2026_xyz",
    "bt032_k_tag_secret_integrity_2026_abc",
    "bt032_auth_token_jwt_secret_2026_jwt",
    "replace_with_at_least_32_random_characters_secret_for_chain",
    "replace_with_at_least_32_random_characters_secret_for_jwt",
    "replace_with_at_least_32_random_characters_secret_for_log",
    "replace_with_at_least_32_random_characters_secret_for_tags",
    "replace_with_at_least_32_random_characters_service_token",
    "changeme",
    "secret",
    "password",
}


def validate_secret(name: str, val: str) -> None:
    """Validate that a secret is non-empty, at least 32 characters, and not a known default."""
    if not val:
        raise ValueError(f"Secret '{name}' is missing. It must be provided via environment or .env file.")
    if len(val) < 32:
        raise ValueError(f"Secret '{name}' must be at least 32 characters long (got {len(val)}).")
    if val.lower() in FORBIDDEN_SECRETS or "replace_with" in val.lower() or "example" in val.lower():
        raise ValueError(f"Secret '{name}' is set to an insecure default/placeholder. You must configure a unique secret.")


def validate_all_secrets(config_mapping: dict) -> None:
    """Validate all critical application secrets before application startup."""
    validate_secret("CHAIN_SECRET", str(config_mapping.get("CHAIN_SECRET") or ""))
    validate_secret("JWT_SECRET", str(config_mapping.get("JWT_SECRET") or ""))
    validate_secret("LOG_SECRET", str(config_mapping.get("LOG_SECRET") or ""))


def ensure_storage_dirs():
    """Ensure simulated cloud storage directories exist."""
    CURRENT_STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    VERSIONS_STORAGE_DIR.mkdir(parents=True, exist_ok=True)
