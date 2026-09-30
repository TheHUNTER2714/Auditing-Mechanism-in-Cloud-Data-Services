import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

# Simulated cloud storage directory
STORAGE_DIR = Path(os.environ.get("STORAGE_DIR", BASE_DIR / "storage"))
CURRENT_STORAGE_DIR = STORAGE_DIR / "current"
VERSIONS_STORAGE_DIR = STORAGE_DIR / "versions"

# SQLite database file path
DB_PATH = Path(os.environ.get("DB_PATH", BASE_DIR / "audit.db"))

# Secret key for HMAC-SHA256 version chaining
# Non-negotiable: NEVER stored in SQLite, NEVER returned across any API endpoint
CHAIN_SECRET = os.environ.get("CHAIN_SECRET", "bt032-dev-insecure-fallback-secret-2026")

# Cryptographic block tag secret (K_tag), never stored in DB
K_TAG = os.environ.get("K_TAG", os.environ.get("TAG_SECRET", "bt032-k-tag-secret-integrity-2026"))

# Block size in bytes for Merkle tree and tag generation (default 64 KB)
BLOCK_SIZE = int(os.environ.get("BLOCK_SIZE", 64 * 1024))

# Secret for authentication tokens
JWT_SECRET = os.environ.get("JWT_SECRET", "bt032-auth-token-secret-2026")

# Public randomness epoch time bucket in seconds (5 minutes)
TIME_BUCKET_SECONDS = int(os.environ.get("TIME_BUCKET_SECONDS", 300))

# Demo attacker tamper routes flag (default False)
ENABLE_DEMO_TAMPER = os.environ.get("ENABLE_DEMO_TAMPER", "false").lower() in ("true", "1", "yes")

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
        "*",
    ]


def ensure_storage_dirs():
    """Ensure simulated cloud storage directories exist."""
    CURRENT_STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    VERSIONS_STORAGE_DIR.mkdir(parents=True, exist_ok=True)

