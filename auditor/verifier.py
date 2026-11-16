import hashlib
import math
from typing import Any, Dict, List, Optional, Tuple


def compute_leaf_hash(index: int, block_data: bytes) -> str:
    """Leaf hash: SHA256(0x00 || 4-byte big-endian index || block_bytes)"""
    prefix = b"\x00" + index.to_bytes(4, byteorder="big")
    return hashlib.sha256(prefix + block_data).hexdigest().lower()


def compute_internal_hash(left_hex: str, right_hex: str) -> str:
    """Internal node hash: SHA256(0x01 || left || right)"""
    prefix = b"\x01"
    content = prefix + bytes.fromhex(left_hex) + bytes.fromhex(right_hex)
    return hashlib.sha256(content).hexdigest().lower()


def verify_merkle_proof(leaf_hash: str, index: int, proof_path: List[Dict[str, str]], expected_root: str) -> bool:
    """
    Verify Merkle membership proof independently against receipt root without server secrets.
    Each proof step has {'position': 'left'|'right', 'hash': hex_str}.
    """
    current = leaf_hash.lower()
    for step in proof_path:
        pos = step.get("position")
        sibling = step.get("hash", "").lower()
        if pos == "left":
            current = compute_internal_hash(sibling, current)
        elif pos == "right":
            current = compute_internal_hash(current, sibling)
        else:
            return False
    return current.lower() == expected_root.lower()


def calculate_detection_probability(total_blocks: int, tampered_blocks: int, sample_size: int) -> float:
    """
    Calculate detection probability:
    P = 1 - C(n - k, c) / C(n, c)
    """
    n = max(1, total_blocks)
    k = max(1, min(tampered_blocks, n))
    c = max(1, min(sample_size, n))

    if c >= n or k >= n:
        return 1.0

    try:
        # P = 1 - ( (n-k)! / (c! * (n-k-c)!) ) / ( n! / (c! * (n-c)!) )
        comb_total = math.comb(n, c)
        if (n - k) < c:
            return 1.0
        comb_missed = math.comb(n - k, c)
        prob = 1.0 - (comb_missed / comb_total)
        return round(prob, 6)
    except Exception:
        return 0.99

