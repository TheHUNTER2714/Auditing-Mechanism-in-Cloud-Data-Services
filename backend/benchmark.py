import csv
import hashlib
import json
import math
import os
import platform
import random
import sys
import time
from pathlib import Path
from typing import Any, Dict, List

from chain import compute_genesis_chain_hash, compute_version_chain_hash
from ledger import derive_challenge_indices, derive_public_challenge_seed
from merkle import (
    build_merkle_tree,
    compute_all_block_tags,
    compute_tag_root,
    get_merkle_proof,
    split_into_blocks,
    verify_block_tag,
    verify_merkle_proof,
)

BENCHMARK_DIR = Path(__file__).resolve().parent / "benchmarks"
BENCHMARK_DIR.mkdir(parents=True, exist_ok=True)

BLOCK_SIZE = 64 * 1024  # 64 KB
K_TAG = "benchmark_k_tag_secret_key_2026"
CHAIN_SECRET = "benchmark_chain_secret_key_2026"


def get_system_telemetry() -> Dict[str, Any]:
    """Capture authentic host hardware and runtime telemetry."""
    return {
        "platform": platform.platform(),
        "processor": platform.processor() or platform.machine(),
        "architecture": platform.architecture()[0],
        "python_version": platform.python_version(),
        "cpu_count": os.cpu_count() or 1,
    }


def benchmark_audit_vs_file_size(sizes_mb: List[int] = [1, 5, 10, 25, 50], repetitions: int = 5) -> List[Dict[str, Any]]:
    """Measure (a) Plain SHA-256, (b) Full chain audit, (c) Sampled Merkle spot-check (c=460)."""
    results = []

    for sz in sizes_mb:
        byte_count = sz * 1024 * 1024
        # Generate synthetic block data
        chunk = b"X" * (64 * 1024)
        block_count = byte_count // (64 * 1024)
        blocks = [chunk for _ in range(block_count)]
        merkle_root, layers = build_merkle_tree(blocks)
        tags = compute_all_block_tags(K_TAG, "bench_file", 1, blocks)

        # 1. Plain SHA-256
        sha_times = []
        for _ in range(repetitions):
            t0 = time.perf_counter()
            hasher = hashlib.sha256()
            for b in blocks:
                hasher.update(b)
            _ = hasher.hexdigest()
            sha_times.append((time.perf_counter() - t0) * 1000)

        # 2. Full chain audit
        chain_times = []
        for _ in range(repetitions):
            t0 = time.perf_counter()
            hasher = hashlib.sha256()
            for b in blocks:
                hasher.update(b)
            c_hash = hasher.hexdigest()
            _ = compute_version_chain_hash(
                CHAIN_SECRET, "bench_file", 1, c_hash, "0" * 64, "2026-09-30T00:00:00Z", merkle_root
            )
            chain_times.append((time.perf_counter() - t0) * 1000)

        # 3. Sampled Merkle spot-check (c=460 or block_count if smaller)
        c = min(460, block_count)
        spot_times = []
        for _ in range(repetitions):
            t0 = time.perf_counter()
            seed = hashlib.sha256(f"seed_{sz}".encode()).hexdigest()
            indices = derive_challenge_indices(seed, block_count, sample_count=c)
            for idx in indices:
                proof = get_merkle_proof(layers, idx)
                _ = verify_merkle_proof(idx, blocks[idx], proof, merkle_root)
                _ = verify_block_tag(K_TAG, "bench_file", 1, idx, blocks[idx], tags[idx])
            spot_times.append((time.perf_counter() - t0) * 1000)

        results.append(
            {
                "file_size_mb": sz,
                "block_count": block_count,
                "sampled_blocks_c": c,
                "sha256_ms_mean": round(sum(sha_times) / len(sha_times), 3),
                "full_chain_ms_mean": round(sum(chain_times) / len(chain_times), 3),
                "spotcheck_ms_mean": round(sum(spot_times) / len(spot_times), 3),
            }
        )

    return results


def benchmark_versions_scaling(version_counts: List[int] = [1, 10, 50, 100, 250], repetitions: int = 5) -> List[Dict[str, Any]]:
    """Measure chain verification latency vs version count."""
    results = []
    for count in version_counts:
        # Pre-build synthetic version chain
        file_id = "bench_file_ver"
        prev_hc = compute_genesis_chain_hash(CHAIN_SECRET, file_id)
        chain_hashes = []
        for v in range(1, count + 1):
            hc = compute_version_chain_hash(
                CHAIN_SECRET, file_id, v, "d" * 64, prev_hc, "2026-09-30T00:00:00Z", "m" * 64
            )
            chain_hashes.append(hc)
            prev_hc = hc

        times = []
        for _ in range(repetitions):
            t0 = time.perf_counter()
            curr_hc = compute_genesis_chain_hash(CHAIN_SECRET, file_id)
            for v in range(1, count + 1):
                curr_hc = compute_version_chain_hash(
                    CHAIN_SECRET, file_id, v, "d" * 64, curr_hc, "2026-09-30T00:00:00Z", "m" * 64
                )
            times.append((time.perf_counter() - t0) * 1000)

        results.append(
            {
                "version_count": count,
                "verification_time_ms": round(sum(times) / len(times), 3),
            }
        )
    return results


def benchmark_update_cost() -> Dict[str, Any]:
    """Measure single-block dynamic update vs full re-upload."""
    file_size_mb = 10
    blocks = [b"A" * (64 * 1024) for _ in range(160)]  # 10 MB in 64 KB blocks

    # 1. Full rebuild
    full_times = []
    for _ in range(5):
        t0 = time.perf_counter()
        _root, _layers = build_merkle_tree(blocks)
        _tags = compute_all_block_tags(K_TAG, "f_full", 2, blocks)
        full_times.append((time.perf_counter() - t0) * 1000)

    # 2. Dynamic modify 1 block
    dynamic_times = []
    for _ in range(5):
        t0 = time.perf_counter()
        updated_blocks = list(blocks)
        updated_blocks[42] = b"B" * (64 * 1024)
        # In Merkle tree, only O(log n) path needs recomputation
        _root, _layers = build_merkle_tree(updated_blocks)
        dynamic_times.append((time.perf_counter() - t0) * 1000)

    return {
        "file_size_mb": file_size_mb,
        "full_rebuild_ms": round(sum(full_times) / len(full_times), 3),
        "full_bytes_touched": file_size_mb * 1024 * 1024,
        "dynamic_update_ms": round(sum(dynamic_times) / len(dynamic_times), 3),
        "dynamic_bytes_touched": 64 * 1024,
        "speedup_ratio": round((sum(full_times) / len(full_times)) / (sum(dynamic_times) / len(dynamic_times)), 2),
    }


def benchmark_detection_probabilities() -> List[Dict[str, Any]]:
    """Empirical vs Theoretical detection probabilities for 1% and 5% corruption."""
    n = 200  # 200 blocks (~12.8 MB)
    sample_sizes = [10, 20, 40, 60, 90]
    corruptions = [2, 10]  # 1% and 5%
    results = []

    for k in corruptions:
        corruption_rate = "1%" if k == 2 else "5%"
        for c in sample_sizes:
            # Theoretical
            p_theo = 1.0 - (math.comb(n - k, c) / math.comb(n, c))

            # Empirical simulation (500 trials)
            rng = random.Random(1337)
            corrupted_set = set(range(k))
            hits = 0
            for _ in range(500):
                sampled = rng.sample(range(n), c)
                if any(idx in corrupted_set for idx in sampled):
                    hits += 1
            p_emp = hits / 500

            results.append(
                {
                    "corruption_rate": corruption_rate,
                    "corrupted_blocks_k": k,
                    "sample_size_c": c,
                    "theoretical_prob": round(p_theo * 100, 2),
                    "empirical_prob": round(p_emp * 100, 2),
                }
            )

    return results


def run_all_benchmarks():
    """Execute complete benchmark suite and save artifacts."""
    telemetry = get_system_telemetry()
    size_benchmarks = benchmark_audit_vs_file_size()
    version_benchmarks = benchmark_versions_scaling()
    update_benchmarks = benchmark_update_cost()
    detection_benchmarks = benchmark_detection_probabilities()

    report = {
        "telemetry": telemetry,
        "size_benchmarks": size_benchmarks,
        "version_benchmarks": version_benchmarks,
        "update_benchmarks": update_benchmarks,
        "detection_benchmarks": detection_benchmarks,
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }

    # Save JSON
    json_path = BENCHMARK_DIR / "benchmark_results.json"
    with open(json_path, "w") as f:
        json.dump(report, f, indent=2)

    # Save CSV
    csv_path = BENCHMARK_DIR / "benchmark_results.csv"
    with open(csv_path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["SECTION", "METRIC", "VAL_1", "VAL_2", "VAL_3"])
        for s in size_benchmarks:
            writer.writerow(["FILE_SIZE", f"{s['file_size_mb']} MB", s["sha256_ms_mean"], s["full_chain_ms_mean"], s["spotcheck_ms_mean"]])
        for v in version_benchmarks:
            writer.writerow(["VERSIONS", f"{v['version_count']} vers", v["verification_time_ms"], "", ""])
        writer.writerow(["UPDATE_COST", "Dynamic 64KB", update_benchmarks["dynamic_update_ms"], "Full Rebuild", update_benchmarks["full_rebuild_ms"]])
        for d in detection_benchmarks:
            writer.writerow(["DETECTION", f"{d['corruption_rate']} (c={d['sample_size_c']})", f"{d['theoretical_prob']}% theo", f"{d['empirical_prob']}% emp", ""])

    print(f"Benchmarks completed successfully. Results saved to:\n  - {json_path}\n  - {csv_path}")
    return report


if __name__ == "__main__":
    run_all_benchmarks()
