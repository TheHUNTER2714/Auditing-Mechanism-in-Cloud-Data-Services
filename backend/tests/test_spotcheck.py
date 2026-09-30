import math
import random
import pytest
from merkle import (
    build_merkle_tree,
    get_merkle_proof,
    split_into_blocks,
    verify_merkle_proof,
)


def test_spotcheck_unmodified_file_passes():
    """Verify that every block in an unmodified file generates a valid Merkle audit path."""
    data = b"Merkle tree verification test block payload " * 100
    blocks = split_into_blocks(data, block_size=64)
    root, layers = build_merkle_tree(blocks)

    for i in range(len(blocks)):
        proof = get_merkle_proof(layers, i)
        assert verify_merkle_proof(i, blocks[i], proof, root) is True


def test_spotcheck_wrong_block_fails():
    """Verify that providing mismatched block bytes fails Merkle proof verification."""
    data = b"Original block data for Merkle integrity testing " * 50
    blocks = split_into_blocks(data, block_size=64)
    root, layers = build_merkle_tree(blocks)

    proof = get_merkle_proof(layers, 0)
    fake_block = b"Tampered block content that does not match original"

    assert verify_merkle_proof(0, fake_block, proof, root) is False


def test_spotcheck_detection_probability_matches_theoretical():
    """
    Mathematical Validation of Provable Data Possession (PDP) / Spot-Checking:
    Given n blocks with k corrupted blocks, sampling c random blocks detects corruption
    with probability:
    P_theoretical = 1 - C(n-k, c) / C(n, c)

    Verify that empirical detection rate over trials matches theoretical within statistical tolerance.
    """
    n = 50       # total blocks
    k = 5        # corrupted blocks (10% corruption)
    c = 15       # sampled challenge blocks

    # Theoretical detection probability
    p_theoretical = 1.0 - (math.comb(n - k, c) / math.comb(n, c))

    # Run deterministic Monte Carlo simulation
    rng = random.Random(42)  # fixed deterministic seed
    corrupted_indices = set(range(k))  # indices 0..4 are corrupted
    trials = 300
    detections = 0

    for _ in range(trials):
        # Sample c unique indices from n blocks
        sampled = rng.sample(range(n), c)
        if any(idx in corrupted_indices for idx in sampled):
            detections += 1

    p_empirical = detections / trials

    # Tolerance within +/- 0.06
    assert abs(p_empirical - p_theoretical) < 0.06, (
        f"Empirical detection rate {p_empirical:.4f} differed from theoretical {p_theoretical:.4f}"
    )
