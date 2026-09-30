import hashlib
import hmac
from pathlib import Path
from typing import BinaryIO, Optional, Union

CHUNK_SIZE = 1024 * 1024  # 1 MB chunk streaming


def compute_file_content_hash(file_path: Union[str, Path]) -> str:
    """Compute hex SHA-256 hash of a file on disk by streaming in 1 MB chunks."""
    path = Path(file_path)
    if not path.is_file():
        raise FileNotFoundError(f"File not found: {file_path}")
    hasher = hashlib.sha256()
    with open(path, "rb") as f:
        while True:
            chunk = f.read(CHUNK_SIZE)
            if not chunk:
                break
            hasher.update(chunk)
    return hasher.hexdigest().lower()


def compute_stream_content_hash(stream: BinaryIO) -> str:
    """Compute hex SHA-256 hash from a readable binary stream in 1 MB chunks."""
    hasher = hashlib.sha256()
    # Seek to start if seekable
    if hasattr(stream, "seekable") and stream.seekable():
        stream.seek(0)
    while True:
        chunk = stream.read(CHUNK_SIZE)
        if not chunk:
            break
        hasher.update(chunk)
    if hasattr(stream, "seekable") and stream.seekable():
        stream.seek(0)
    return hasher.hexdigest().lower()


def compute_bytes_content_hash(data: bytes) -> str:
    """Compute hex SHA-256 hash of in-memory bytes."""
    return hashlib.sha256(data).hexdigest().lower()


def compute_genesis_chain_hash(secret: str, file_id: str) -> str:
    """
    Compute genesis chain hash HC_0:
    HC_0 = HMAC-SHA256(CHAIN_SECRET, "genesis|" + file_id)
    """
    key = secret.encode("utf-8")
    msg = f"genesis|{file_id}".encode("utf-8")
    return hmac.new(key, msg, hashlib.sha256).hexdigest().lower()


def compute_version_chain_hash(
    secret: str,
    file_id: str,
    version: int,
    content_hash: str,
    prev_chain_hash: str,
    created_at_utc_iso: str,
    merkle_root: Optional[str] = None,
) -> str:
    """
    Compute version chain hash HC_v:
    If merkle_root is provided:
        HC_v = HMAC-SHA256(CHAIN_SECRET, f"{file_id}|{v}|{D_v}|{merkle_root}|{HC_(v-1)}|{created_at_utc_iso}")
    Else (v1 fallback):
        HC_v = HMAC-SHA256(CHAIN_SECRET, f"{file_id}|{v}|{D_v}|{HC_(v-1)}|{created_at_utc_iso}")
    """
    key = secret.encode("utf-8")
    if merkle_root:
        msg = f"{file_id}|{version}|{content_hash.lower()}|{merkle_root.lower()}|{prev_chain_hash.lower()}|{created_at_utc_iso}".encode("utf-8")
    else:
        msg = f"{file_id}|{version}|{content_hash.lower()}|{prev_chain_hash.lower()}|{created_at_utc_iso}".encode("utf-8")
    return hmac.new(key, msg, hashlib.sha256).hexdigest().lower()


def verify_version_chain_step(
    secret: str,
    file_id: str,
    version: int,
    content_hash: str,
    prev_chain_hash: str,
    created_at_utc_iso: str,
    expected_chain_hash: str,
    merkle_root: Optional[str] = None,
) -> bool:
    """Verify that a version's chain hash matches the recalculated HMAC."""
    expected = expected_chain_hash.lower()
    actual = compute_version_chain_hash(
        secret=secret,
        file_id=file_id,
        version=version,
        content_hash=content_hash,
        prev_chain_hash=prev_chain_hash,
        created_at_utc_iso=created_at_utc_iso,
        merkle_root=merkle_root,
    )
    if not hmac.compare_digest(actual, expected) and merkle_root:
        # Fallback to legacy format if version was created under v1
        legacy = compute_version_chain_hash(
            secret=secret,
            file_id=file_id,
            version=version,
            content_hash=content_hash,
            prev_chain_hash=prev_chain_hash,
            created_at_utc_iso=created_at_utc_iso,
            merkle_root=None,
        )
        return hmac.compare_digest(legacy, expected)
    return hmac.compare_digest(actual, expected)

