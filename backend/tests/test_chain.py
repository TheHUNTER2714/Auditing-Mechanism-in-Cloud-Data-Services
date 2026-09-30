import hashlib
import hmac
from pathlib import Path
import pytest

from chain import (
    compute_bytes_content_hash,
    compute_file_content_hash,
    compute_genesis_chain_hash,
    compute_version_chain_hash,
    verify_version_chain_step,
)


def test_content_hash_streaming(tmp_path):
    data = b"Hello, Cloud Auditing Verification World!" * 1000
    file_path = tmp_path / "sample.txt"
    file_path.write_bytes(data)

    expected_hash = hashlib.sha256(data).hexdigest().lower()
    streamed_hash = compute_file_content_hash(file_path)
    mem_hash = compute_bytes_content_hash(data)

    assert streamed_hash == expected_hash
    assert mem_hash == expected_hash


def test_genesis_chain_hash_determinism():
    secret = "sample_secret_key"
    file_id = "test-file-uuid-001"

    hc_0_a = compute_genesis_chain_hash(secret, file_id)
    hc_0_b = compute_genesis_chain_hash(secret, file_id)

    assert hc_0_a == hc_0_b
    assert len(hc_0_a) == 64

    # Different file_id gives different genesis hash
    hc_other = compute_genesis_chain_hash(secret, "different-uuid")
    assert hc_0_a != hc_other


def test_version_chain_hash_sensitivity():
    secret = "sample_secret_key"
    file_id = "file-123"
    version = 1
    content_hash = "a" * 64
    prev_hash = "b" * 64
    created_at = "2026-09-29T12:00:00Z"

    base_hash = compute_version_chain_hash(
        secret, file_id, version, content_hash, prev_hash, created_at
    )

    # 1. Modifying secret changes hash
    assert base_hash != compute_version_chain_hash(
        "other_secret", file_id, version, content_hash, prev_hash, created_at
    )

    # 2. Modifying file_id changes hash
    assert base_hash != compute_version_chain_hash(
        secret, "other-file", version, content_hash, prev_hash, created_at
    )

    # 3. Modifying version changes hash
    assert base_hash != compute_version_chain_hash(
        secret, file_id, 2, content_hash, prev_hash, created_at
    )

    # 4. Modifying content_hash changes hash
    assert base_hash != compute_version_chain_hash(
        secret, file_id, version, "c" * 64, prev_hash, created_at
    )

    # 5. Modifying prev_hash changes hash
    assert base_hash != compute_version_chain_hash(
        secret, file_id, version, content_hash, "d" * 64, created_at
    )

    # 6. Modifying timestamp changes hash
    assert base_hash != compute_version_chain_hash(
        secret, file_id, version, content_hash, prev_hash, "2026-09-29T12:00:01Z"
    )


def test_verify_version_chain_step():
    secret = "auth_key_123"
    file_id = "doc-99"
    v = 1
    c_hash = "e" * 64
    p_hash = "f" * 64
    t = "2026-09-29T10:00:00Z"

    valid_hash = compute_version_chain_hash(secret, file_id, v, c_hash, p_hash, t)

    assert verify_version_chain_step(secret, file_id, v, c_hash, p_hash, t, valid_hash)
    assert not verify_version_chain_step(secret, file_id, v, c_hash, p_hash, t, "0" * 64)
