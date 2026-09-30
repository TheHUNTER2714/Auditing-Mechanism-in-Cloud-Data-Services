import hashlib
import hmac
from typing import Any, Dict, List, Optional, Tuple
from config import BLOCK_SIZE, K_TAG


def split_into_blocks(data: bytes, block_size: int = BLOCK_SIZE) -> List[bytes]:
    """Divide binary data into sequential blocks of size block_size."""
    if not data:
        return [b""]
    blocks = []
    for i in range(0, len(data), block_size):
        blocks.append(data[i : i + block_size])
    return blocks


def compute_leaf_hash(index: int, block_data: bytes) -> str:
    """
    Leaf hash: L_i = SHA256(0x00 || i || block_i)
    Uses 4-byte big-endian representation for index i.
    """
    prefix = b"\x00" + index.to_bytes(4, byteorder="big")
    return hashlib.sha256(prefix + block_data).hexdigest().lower()


def compute_internal_hash(left_hex: str, right_hex: str) -> str:
    """
    Internal node hash: SHA256(0x01 || left || right)
    """
    prefix = b"\x01"
    content = prefix + bytes.fromhex(left_hex) + bytes.fromhex(right_hex)
    return hashlib.sha256(content).hexdigest().lower()


def build_merkle_tree(blocks: List[bytes]) -> Tuple[str, List[List[str]]]:
    """
    Construct a binary Merkle tree over blocks:
    - Leaf L_i = SHA256(0x00 || i || block_i)
    - Internal = SHA256(0x01 || left || right)
    - Odd node promoted directly to the next level.
    Returns (merkle_root_hex, tree_layers) where tree_layers[0] are the leaves.
    """
    if not blocks:
        empty_root = hashlib.sha256(b"\x00").hexdigest().lower()
        return empty_root, [[empty_root]]

    leaves = [compute_leaf_hash(i, b) for i, b in enumerate(blocks)]
    layers: List[List[str]] = [leaves]

    current_layer = leaves
    while len(current_layer) > 1:
        next_layer: List[str] = []
        n = len(current_layer)
        for i in range(0, n, 2):
            if i + 1 < n:
                parent = compute_internal_hash(current_layer[i], current_layer[i + 1])
                next_layer.append(parent)
            else:
                # Odd node promoted directly
                next_layer.append(current_layer[i])
        layers.append(next_layer)
        current_layer = next_layer

    root = current_layer[0]
    return root, layers


def get_merkle_proof(layers: List[List[str]], index: int) -> List[Dict[str, Any]]:
    """
    Generate the Merkle audit path (proof) for leaf at index.
    Each step indicates:
      - 'sibling': sibling hash hex (or None if promoted)
      - 'position': 'left' if sibling is to the left, 'right' if to the right, 'promoted' if odd
    """
    proof: List[Dict[str, Any]] = []
    idx = index

    for level in range(len(layers) - 1):
        layer = layers[level]
        if idx % 2 == 1:
            # We are right child -> sibling is left child at idx - 1
            sibling = layer[idx - 1]
            proof.append({"position": "left", "hash": sibling})
        else:
            # We are left child -> sibling is right child at idx + 1 if it exists
            if idx + 1 < len(layer):
                sibling = layer[idx + 1]
                proof.append({"position": "right", "hash": sibling})
            else:
                # Promoted node with no sibling at this level
                proof.append({"position": "promoted", "hash": None})
        idx = idx // 2

    return proof


def verify_merkle_proof(index: int, block_data: bytes, proof: List[Dict[str, Any]], expected_root: str) -> bool:
    """
    Verify that block_data at index satisfies the Merkle proof leading to expected_root.
    """
    current_hash = compute_leaf_hash(index, block_data)

    for step in proof:
        pos = step.get("position")
        sibling = step.get("hash")
        if pos == "promoted" or sibling is None:
            # Node was promoted, hash remains current_hash
            continue
        elif pos == "left":
            current_hash = compute_internal_hash(sibling, current_hash)
        elif pos == "right":
            current_hash = compute_internal_hash(current_hash, sibling)
        else:
            return False

    return hmac.compare_digest(current_hash.lower(), expected_root.lower())


def compute_block_tag(
    k_tag: str,
    file_id: str,
    version: int,
    index: int,
    block_data: bytes,
) -> str:
    """
    Wang et al. (2024) Anti-Forgery Tag Binding:
    tag = HMAC(K_tag, file_id || v || i || SHA256(block_i))
    Bound strictly to file_id, version, and block index.
    Tags from file A or version 1 cannot be reused in file B or index j.
    """
    block_sha = hashlib.sha256(block_data).hexdigest().lower()
    msg = f"{file_id}|{version}|{index}|{block_sha}".encode("utf-8")
    return hmac.new(k_tag.encode("utf-8"), msg, hashlib.sha256).hexdigest().lower()


def verify_block_tag(
    k_tag: str,
    file_id: str,
    version: int,
    index: int,
    block_data: bytes,
    expected_tag: str,
) -> bool:
    """Verify that a block tag matches its cryptographic HMAC binding."""
    computed = compute_block_tag(k_tag, file_id, version, index, block_data)
    return hmac.compare_digest(computed.lower(), expected_tag.lower())


def compute_all_block_tags(
    k_tag: str,
    file_id: str,
    version: int,
    blocks: List[bytes],
) -> List[str]:
    """Compute HMAC tags for all blocks in a version."""
    return [compute_block_tag(k_tag, file_id, version, i, b) for i, b in enumerate(blocks)]


def compute_tag_root(tags: List[str]) -> str:
    """Collective hash digest over all ordered block tags."""
    if not tags:
        return hashlib.sha256(b"").hexdigest().lower()
    hasher = hashlib.sha256()
    for tag in tags:
        hasher.update(tag.encode("utf-8"))
    return hasher.hexdigest().lower()


# Dynamic block-level operations
def dynamic_modify_block(blocks: List[bytes], index: int, new_data: bytes) -> List[bytes]:
    """Modify block at index with new_data."""
    if index < 0 or index >= len(blocks):
        raise IndexError(f"Block index {index} out of bounds (0..{len(blocks)-1})")
    updated = list(blocks)
    updated[index] = new_data
    return updated


def dynamic_insert_block(blocks: List[bytes], index: int, new_data: bytes) -> List[bytes]:
    """Insert new block at index, shifting subsequent blocks right."""
    if index < 0 or index > len(blocks):
        raise IndexError(f"Insert index {index} out of bounds (0..{len(blocks)})")
    updated = list(blocks)
    updated.insert(index, new_data)
    return updated


def dynamic_append_block(blocks: List[bytes], new_data: bytes) -> List[bytes]:
    """Append new block to the end."""
    updated = list(blocks)
    updated.append(new_data)
    return updated


def dynamic_delete_block(blocks: List[bytes], index: int) -> List[bytes]:
    """Delete block at index, shifting subsequent blocks left."""
    if index < 0 or index >= len(blocks):
        raise IndexError(f"Delete index {index} out of bounds (0..{len(blocks)-1})")
    if len(blocks) <= 1:
        # A file must have at least one empty block if all contents deleted
        return [b""]
    updated = list(blocks)
    del updated[index]
    return updated
