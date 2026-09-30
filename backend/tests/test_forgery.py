import hashlib
import hmac
import pytest
from merkle import (
    build_merkle_tree,
    compute_block_tag,
    get_merkle_proof,
    split_into_blocks,
    verify_block_tag,
    verify_merkle_proof,
)


def test_tag_binding_and_cross_file_forgery_resistance():
    """
    Wang et al. (2024) Anti-Forgery Verification:
    Assert that tags are strictly bound to file_id, version, and block index:
    tag = HMAC(K_tag, file_id || v || i || SHA256(block_i))
    No component is shared across files.
    Tags from file A must fail in file B even at identical block content and index.
    """
    k_tag = "test_k_tag_secret_key_forgery_2026"

    file_a = "file-id-alpha"
    file_b = "file-id-beta"
    file_c = "file-id-gamma"

    block_data_0 = b"Common block bytes across files for testing"
    block_data_1 = b"Second unique block content for linear combination testing"

    # Compute valid tag for File A, Version 1, Index 0
    tag_a_0 = compute_block_tag(k_tag, file_a, 1, 0, block_data_0)
    tag_a_1 = compute_block_tag(k_tag, file_a, 1, 1, block_data_1)

    # 1. Assert valid tag passes on matching parameters
    assert verify_block_tag(k_tag, file_a, 1, 0, block_data_0, tag_a_0) is True

    # 2. Replay attack: Assert tag from File A FAILS in File B at the same index
    assert verify_block_tag(k_tag, file_b, 1, 0, block_data_0, tag_a_0) is False

    # 3. Cross-index attack: Assert tag from File A, Index 0 FAILS at Index 1
    assert verify_block_tag(k_tag, file_a, 1, 1, block_data_0, tag_a_0) is False

    # 4. Cross-version attack: Assert tag from File A, V1 FAILS in V2
    assert verify_block_tag(k_tag, file_a, 2, 0, block_data_0, tag_a_0) is False

    # 5. Linear combination attack (Wang et al. 2024 attack shape):
    # In flawed pairing/homomorphic schemes, an attacker combines tag_a_0 and tag_a_1
    # to forge a tag for a linear combination of blocks. Here, XORing or combining tags
    # must fail cryptographic HMAC verification.
    combined_forged_tag = hmac.new(
        k_tag.encode(),
        (tag_a_0 + tag_a_1).encode(),
        hashlib.sha256,
    ).hexdigest()

    assert verify_block_tag(k_tag, file_c, 1, 0, block_data_0, combined_forged_tag) is False
    assert verify_block_tag(k_tag, file_a, 1, 0, block_data_0 + block_data_1, combined_forged_tag) is False

    # 6. Modified block bytes fail tag verification
    tampered_bytes = b"Common block bytes across files for testing (TAMPERED)"
    assert verify_block_tag(k_tag, file_a, 1, 0, tampered_bytes, tag_a_0) is False
