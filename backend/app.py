import csv
import io
import json
import os
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from flask import Flask, Response, jsonify, request, send_file
from flask_cors import CORS
from werkzeug.utils import secure_filename

import config
from audit import (
    create_security_alert,
    execute_audit,
    execute_batch_audit,
    execute_verify_chain,
    generate_spotcheck_proof,
    verify_spotcheck_proof,
)
from auth import (
    compute_blinded_file_tag,
    compute_blinded_owner_id,
    generate_token,
    generate_user_blinding_key,
    get_current_user,
    hash_password,
    log_event,
    seed_demo_users_if_needed,
    verify_password,
)
from chain import (
    compute_file_content_hash,
    compute_genesis_chain_hash,
    compute_version_chain_hash,
)
from db import get_db, init_db
from ledger import (
    append_ledger_entry,
    derive_challenge_indices,
    derive_public_challenge_seed,
    get_current_time_bucket,
    get_ledger_head,
    verify_ledger_chain,
)
from merkle import (
    build_merkle_tree,
    compute_all_block_tags,
    compute_tag_root,
    dynamic_append_block,
    dynamic_delete_block,
    dynamic_insert_block,
    dynamic_modify_block,
    split_into_blocks,
)
from scheduler import AuditScheduler


def create_app(test_config: Dict[str, Any] = None) -> Flask:
    """Application factory for the Auditing Mechanism backend."""
    app = Flask(__name__)

    # Default configuration
    app.config.from_mapping(
        STORAGE_DIR=config.STORAGE_DIR,
        CURRENT_STORAGE_DIR=config.CURRENT_STORAGE_DIR,
        VERSIONS_STORAGE_DIR=config.VERSIONS_STORAGE_DIR,
        DB_PATH=config.DB_PATH,
        CHAIN_SECRET=config.CHAIN_SECRET,
        K_TAG=config.K_TAG,
        BLOCK_SIZE=config.BLOCK_SIZE,
        JWT_SECRET=config.JWT_SECRET,
        TIME_BUCKET_SECONDS=config.TIME_BUCKET_SECONDS,
        ENABLE_DEMO_TAMPER=config.ENABLE_DEMO_TAMPER,
        MAX_CONTENT_LENGTH=config.MAX_CONTENT_LENGTH,
    )

    if test_config:
        app.config.update(test_config)

    # Initialize CORS
    CORS(app, origins=config.CORS_ORIGINS, supports_credentials=True)

    # Ensure storage paths and DB exist
    Path(app.config["CURRENT_STORAGE_DIR"]).mkdir(parents=True, exist_ok=True)
    Path(app.config["VERSIONS_STORAGE_DIR"]).mkdir(parents=True, exist_ok=True)
    init_db(app.config["DB_PATH"])

    # Seed demo users if demo mode is enabled
    if app.config["ENABLE_DEMO_TAMPER"]:
        with get_db(app.config["DB_PATH"]) as conn:
            seed_demo_users_if_needed(conn)

    # Start background scheduler
    scheduler = AuditScheduler(db_path=app.config["DB_PATH"])
    scheduler.start()

    # -------------------------------------------------------------
    # System & Config Endpoints
    # -------------------------------------------------------------

    @app.route("/", methods=["GET"])
    def root():
        return jsonify(
            {
                "project_title": "Auditing Mechanism in Cloud Data Services",
                "model_name": "Version-Based Dynamic Cloud Data Auditing",
                "status": "online",
                "storage_infrastructure": "simulated cloud storage",
                "ledger_type": "simulated local append-only ledger (simulated blockchain)",
                "cryptographic_scheme": "lightweight non-pairing analogue (SHA-256, HMAC, Merkle Trees)",
                "endpoints": {
                    "health": "/api/health",
                    "config": "/api/config",
                    "auth_login": "/api/auth/login",
                    "files": "/api/files",
                    "ledger": "/api/ledger",
                    "alerts": "/api/alerts",
                    "audits": "/api/audits",
                },
            }
        )

    @app.route("/api/health", methods=["GET"])
    def health():
        return jsonify(
            {
                "status": "online",
                "project_title": "Auditing Mechanism in Cloud Data Services",
                "model_name": "Version-Based Dynamic Cloud Data Auditing",
                "storage_infrastructure": "simulated cloud storage",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        )

    @app.route("/api/config", methods=["GET"])
    def get_config():
        return jsonify(
            {
                "demo_mode": app.config["ENABLE_DEMO_TAMPER"],
                "max_upload_mb": config.MAX_UPLOAD_MB,
                "block_size_bytes": app.config["BLOCK_SIZE"],
                "time_bucket_seconds": app.config["TIME_BUCKET_SECONDS"],
                "storage_type": "simulated cloud storage",
            }
        )

    @app.route("/api/benchmarks", methods=["GET"])
    def get_benchmarks():
        bench_file = Path(__file__).resolve().parent / "benchmarks" / "benchmark_results.json"
        if bench_file.is_file():
            with open(bench_file, "r") as f:
                data = json.load(f)
            return jsonify(data)
        # Fallback to running benchmark if not yet executed
        from benchmark import run_all_benchmarks
        return jsonify(run_all_benchmarks())

    # -------------------------------------------------------------
    # Authentication & User Management Endpoints
    # -------------------------------------------------------------

    @app.route("/api/auth/login", methods=["POST"])
    def login():
        data = request.get_json(silent=True) or {}
        username = data.get("username", "").strip()
        password = data.get("password", "")

        conn = get_db(app.config["DB_PATH"])
        try:
            cursor = conn.cursor()
            user_row = cursor.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
            if not user_row or not verify_password(password, user_row["pw_hash"]):
                log_event(conn, "anonymous", "GUEST", "LOGIN_ATTEMPT", username, "FAILED")
                return jsonify({"error": "INVALID_CREDENTIALS", "message": "Invalid username or password"}), 401

            token = generate_token(user_row["id"], user_row["username"], user_row["role"])
            log_event(conn, user_row["id"], user_row["role"], "LOGIN", user_row["username"], "SUCCESS")
            return jsonify(
                {
                    "token": token,
                    "role": user_row["role"],
                    "user_id": user_row["id"],
                    "username": user_row["username"],
                }
            )
        finally:
            conn.close()

    @app.route("/api/auth/me", methods=["GET"])
    def auth_me():
        conn = get_db(app.config["DB_PATH"])
        try:
            user = get_current_user(conn)
            if not user:
                return jsonify({"error": "UNAUTHORIZED", "message": "Valid token required"}), 401
            return jsonify(
                {
                    "user_id": user["id"],
                    "username": user["username"],
                    "role": user["role"],
                    "created_at": user["created_at"],
                }
            )
        finally:
            conn.close()

    # -------------------------------------------------------------
    # File & Version Management Endpoints (Upload, Merkle, Dedup)
    # -------------------------------------------------------------

    @app.route("/api/files", methods=["POST"])
    def upload_file():
        conn = get_db(app.config["DB_PATH"])
        try:
            current_user = get_current_user(conn)
            actor_id = current_user["id"] if current_user else "demo-owner"
            actor_role = current_user["role"] if current_user else "OWNER"

            if "file" not in request.files:
                return jsonify({"error": "NO_FILE", "message": "No file field in multipart request"}), 400

            file_obj = request.files["file"]
            if not file_obj or file_obj.filename == "":
                return jsonify({"error": "EMPTY_FILENAME", "message": "Uploaded file has no filename"}), 400

            raw_filename = file_obj.filename
            clean_name = secure_filename(raw_filename) or "unnamed_document"

            # Optional client-side values
            declared_root = request.form.get("merkle_root", "").strip().lower()
            declared_hash = request.form.get("file_hash", "").strip().lower()
            client_blinded_owner = request.form.get("blinded_owner", "").strip()

            # Read uploaded bytes
            file_bytes = file_obj.read()
            size_bytes = len(file_bytes)
            computed_file_hash = compute_file_content_hash_from_bytes(file_bytes)

            # Check declared file hash
            if declared_hash and declared_hash != computed_file_hash:
                create_security_alert(
                    conn,
                    severity="critical",
                    kind="TAMPERED",
                    file_ref=clean_name,
                    message="Declared file hash does not match computed file bytes.",
                )
                return jsonify({"error": "HASH_MISMATCH", "message": "Declared hash mismatch"}), 400

            # Divide into blocks and construct Merkle tree
            blocks = split_into_blocks(file_bytes, block_size=app.config["BLOCK_SIZE"])
            computed_merkle_root, layers = build_merkle_tree(blocks)

            # Verify declared Merkle root (Duplicate-Faking prevention)
            if declared_root and declared_root != computed_merkle_root:
                create_security_alert(
                    conn,
                    severity="critical",
                    kind="DUPLICATE_FAKING_SUSPECTED",
                    file_ref=clean_name,
                    message=f"Declared Merkle root {declared_root} does not match computed root {computed_merkle_root}. Possible duplicate-faking attack.",
                )
                log_event(conn, actor_id, actor_role, "UPLOAD", clean_name, "DUPLICATE_FAKING_SUSPECTED")
                return jsonify({"error": "DUPLICATE_FAKING_SUSPECTED", "message": "Declared Merkle root mismatch"}), 400

            # Derive blinded owner ID
            if not client_blinded_owner:
                user_key = current_user["user_key"] if current_user else b"demo_owner_blinding_secret_key"
                client_blinded_owner = compute_blinded_owner_id(user_key, computed_file_hash)

            cursor = conn.cursor()

            # Check ledger-backed deduplication map (DEDUP_REGISTER)
            existing_dedup = cursor.execute(
                "SELECT file_hash, blinded_owner, ledger_seq FROM ownership WHERE file_hash = ?",
                (computed_file_hash,),
            ).fetchone()

            if existing_dedup:
                # Deduplication branch:
                # Subsequent upload. Check if Proof-of-Ownership (PoW) is provided or simulated
                pow_response = request.form.get("pow_proof", "")
                if request.form.get("simulate_fake_pow") == "true":
                    # Forged PoW attack simulation
                    create_security_alert(
                        conn,
                        severity="warning",
                        kind="PROOF_OF_OWNERSHIP_FAILED",
                        file_ref=clean_name,
                        message=f"Subsequent uploader provided invalid Proof-of-Ownership for hash {computed_file_hash}",
                    )
                    return jsonify({"error": "POW_FAILED", "message": "Sampled Proof-of-Ownership verification failed"}), 403

                # Append DEDUP_REGISTER to simulated blockchain ledger
                ledger_entry = append_ledger_entry(
                    conn,
                    entry_type="DEDUP_REGISTER",
                    payload={
                        "file_hash": computed_file_hash,
                        "blinded_owner": client_blinded_owner,
                        "status": "DEDUPLICATED",
                    },
                )

                # Record ownership entry
                cursor.execute(
                    """
                    INSERT OR REPLACE INTO ownership (file_hash, blinded_owner, ledger_seq)
                    VALUES (?, ?, ?)
                    """,
                    (computed_file_hash, client_blinded_owner, ledger_entry["seq"]),
                )
                conn.commit()

                log_event(conn, actor_id, actor_role, "DEDUPLICATE", computed_file_hash, "SUCCESS")

                return (
                    jsonify(
                        {
                            "status": "DEDUPLICATED",
                            "message": "File matched existing hash in ledger. Deduplication applied; no duplicate blocks stored.",
                            "file_hash": computed_file_hash,
                            "blinded_owner": client_blinded_owner,
                            "ledger_seq": ledger_entry["seq"],
                        }
                    ),
                    200,
                )

            # Initial upload branch
            file_id = str(uuid.uuid4())
            created_at_iso = datetime.now(timezone.utc).isoformat()

            current_file_path = Path(app.config["CURRENT_STORAGE_DIR"]) / file_id
            version_blob_path = Path(app.config["VERSIONS_STORAGE_DIR"]) / f"{file_id}_v1"

            # Write file payload to current storage and immutable version archive
            with open(current_file_path, "wb") as f:
                f.write(file_bytes)
            with open(version_blob_path, "wb") as f:
                f.write(file_bytes)

            # Compute block tags (Wang et al. 2024 anti-forgery binding)
            k_tag = app.config["K_TAG"]
            block_tags = compute_all_block_tags(k_tag, file_id, 1, blocks)
            tag_root = compute_tag_root(block_tags)

            # Compute genesis hash and version chain hash
            secret = app.config["CHAIN_SECRET"]
            genesis_hc = compute_genesis_chain_hash(secret, file_id)
            chain_hash = compute_version_chain_hash(
                secret=secret,
                file_id=file_id,
                version=1,
                content_hash=computed_file_hash,
                prev_chain_hash=genesis_hc,
                created_at_utc_iso=created_at_iso,
                merkle_root=computed_merkle_root,
            )

            # Save records in SQLite
            cursor.execute(
                """
                INSERT INTO files (id, display_name, created_at, current_version, stored_path, is_deleted)
                VALUES (?, ?, ?, 1, ?, 0)
                """,
                (file_id, clean_name, created_at_iso, str(current_file_path)),
            )

            cursor.execute(
                """
                INSERT INTO versions (
                    file_id, version, content_hash, prev_chain_hash, chain_hash,
                    size_bytes, created_at, activity, blob_path, merkle_root, tag_root
                )
                VALUES (?, 1, ?, ?, ?, ?, ?, 'UPLOAD', ?, ?, ?)
                """,
                (
                    file_id,
                    computed_file_hash,
                    genesis_hc,
                    chain_hash,
                    size_bytes,
                    created_at_iso,
                    str(version_blob_path),
                    computed_merkle_root,
                    tag_root,
                ),
            )

            # Store blocks metadata and individual block tags
            cursor.execute(
                """
                INSERT INTO blocks_meta (file_id, version, block_size, block_count)
                VALUES (?, 1, ?, ?)
                """,
                (file_id, app.config["BLOCK_SIZE"], len(blocks)),
            )

            for idx, tag_val in enumerate(block_tags):
                cursor.execute(
                    """
                    INSERT INTO block_tags (file_id, version, idx, tag)
                    VALUES (?, 1, ?, ?)
                    """,
                    (file_id, idx, tag_val),
                )

            # Append DEDUP_REGISTER to simulated blockchain ledger
            ledger_entry = append_ledger_entry(
                conn,
                entry_type="DEDUP_REGISTER",
                payload={
                    "file_id": file_id,
                    "file_hash": computed_file_hash,
                    "blinded_owner": client_blinded_owner,
                    "merkle_root": computed_merkle_root,
                    "status": "INITIAL_UPLOAD",
                },
            )

            # Record ownership
            cursor.execute(
                """
                INSERT OR REPLACE INTO ownership (file_hash, blinded_owner, ledger_seq)
                VALUES (?, ?, ?)
                """,
                (computed_file_hash, client_blinded_owner, ledger_entry["seq"]),
            )

            receipt = {
                "file_id": file_id,
                "version": 1,
                "chain_hash": chain_hash,
                "created_at": created_at_iso,
                "merkle_root": computed_merkle_root,
                "ledger_seq": ledger_entry["seq"],
            }

            conn.commit()
            log_event(conn, actor_id, actor_role, "UPLOAD", file_id, "SUCCESS")

            return (
                jsonify(
                    {
                        "status": "RECORDED_VERSION",
                        "file_id": file_id,
                        "display_name": clean_name,
                        "version": 1,
                        "content_hash": computed_file_hash,
                        "merkle_root": computed_merkle_root,
                        "tag_root": tag_root,
                        "block_count": len(blocks),
                        "chain_hash": chain_hash,
                        "receipt": receipt,
                    }
                ),
                201,
            )
        finally:
            conn.close()

    @app.route("/api/files/<file_id>/versions", methods=["POST"])
    def update_file_version(file_id: str):
        conn = get_db(app.config["DB_PATH"])
        try:
            current_user = get_current_user(conn)
            actor_id = current_user["id"] if current_user else "demo-owner"
            actor_role = current_user["role"] if current_user else "OWNER"

            if "file" not in request.files:
                return jsonify({"error": "NO_FILE", "message": "No file field in multipart request"}), 400

            file_obj = request.files["file"]
            if not file_obj or file_obj.filename == "":
                return jsonify({"error": "EMPTY_FILENAME", "message": "Uploaded file has no filename"}), 400

            cursor = conn.cursor()
            file_row = cursor.execute("SELECT * FROM files WHERE id = ? AND is_deleted = 0", (file_id,)).fetchone()
            if not file_row:
                return jsonify({"error": "FILE_NOT_FOUND", "message": f"File {file_id} not found"}), 404

            current_ver = file_row["current_version"]
            prev_version_row = cursor.execute(
                "SELECT * FROM versions WHERE file_id = ? AND version = ?",
                (file_id, current_ver),
            ).fetchone()
            if not prev_version_row:
                return jsonify({"error": "CORRUPT_STATE", "message": "Previous version record missing"}), 500

            file_bytes = file_obj.read()
            size_bytes = len(file_bytes)
            content_hash = compute_file_content_hash_from_bytes(file_bytes)

            new_version = current_ver + 1
            created_at_iso = datetime.now(timezone.utc).isoformat()

            current_file_path = Path(app.config["CURRENT_STORAGE_DIR"]) / file_id
            version_blob_path = Path(app.config["VERSIONS_STORAGE_DIR"]) / f"{file_id}_v{new_version}"

            # Save new content
            with open(current_file_path, "wb") as f:
                f.write(file_bytes)
            with open(version_blob_path, "wb") as f:
                f.write(file_bytes)

            blocks = split_into_blocks(file_bytes, block_size=app.config["BLOCK_SIZE"])
            merkle_root, _ = build_merkle_tree(blocks)
            k_tag = app.config["K_TAG"]
            block_tags = compute_all_block_tags(k_tag, file_id, new_version, blocks)
            tag_root = compute_tag_root(block_tags)

            secret = app.config["CHAIN_SECRET"]
            prev_chain_hash = prev_version_row["chain_hash"]
            chain_hash = compute_version_chain_hash(
                secret=secret,
                file_id=file_id,
                version=new_version,
                content_hash=content_hash,
                prev_chain_hash=prev_chain_hash,
                created_at_utc_iso=created_at_iso,
                merkle_root=merkle_root,
            )

            receipt = {
                "file_id": file_id,
                "version": new_version,
                "chain_hash": chain_hash,
                "created_at": created_at_iso,
                "merkle_root": merkle_root,
            }

            cursor.execute("UPDATE files SET current_version = ? WHERE id = ?", (new_version, file_id))
            cursor.execute(
                """
                INSERT INTO versions (
                    file_id, version, content_hash, prev_chain_hash, chain_hash,
                    size_bytes, created_at, activity, blob_path, merkle_root, tag_root
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, 'AUTHORIZED_UPDATE', ?, ?, ?)
                """,
                (
                    file_id,
                    new_version,
                    content_hash,
                    prev_chain_hash,
                    chain_hash,
                    size_bytes,
                    created_at_iso,
                    str(version_blob_path),
                    merkle_root,
                    tag_root,
                ),
            )

            cursor.execute(
                """
                INSERT INTO blocks_meta (file_id, version, block_size, block_count)
                VALUES (?, ?, ?, ?)
                """,
                (file_id, new_version, app.config["BLOCK_SIZE"], len(blocks)),
            )

            for idx, tag_val in enumerate(block_tags):
                cursor.execute(
                    """
                    INSERT INTO block_tags (file_id, version, idx, tag)
                    VALUES (?, ?, ?, ?)
                    """,
                    (file_id, new_version, idx, tag_val),
                )

            conn.commit()
            log_event(conn, actor_id, actor_role, "UPDATE", file_id, "SUCCESS")

            return (
                jsonify(
                    {
                        "status": "RECORDED_VERSION",
                        "file_id": file_id,
                        "display_name": file_row["display_name"],
                        "version": new_version,
                        "content_hash": content_hash,
                        "merkle_root": merkle_root,
                        "tag_root": tag_root,
                        "chain_hash": chain_hash,
                        "receipt": receipt,
                    }
                ),
                201,
            )
        finally:
            conn.close()

    # -------------------------------------------------------------
    # Dynamic Block-Level Operations (Modify, Insert, Append, Delete)
    # -------------------------------------------------------------

    @app.route("/api/files/<file_id>/blocks", methods=["POST"])
    def dynamic_block_operation(file_id: str):
        data = request.get_json(silent=True) or {}
        op = data.get("op", "").lower()  # modify, insert, append, delete
        idx = int(data.get("index", 0))
        new_block_data = data.get("data", "").encode("utf-8")

        conn = get_db(app.config["DB_PATH"])
        try:
            current_user = get_current_user(conn)
            actor_id = current_user["id"] if current_user else "demo-owner"
            actor_role = current_user["role"] if current_user else "OWNER"

            cursor = conn.cursor()
            file_row = cursor.execute("SELECT * FROM files WHERE id = ? AND is_deleted = 0", (file_id,)).fetchone()
            if not file_row:
                return jsonify({"error": "FILE_NOT_FOUND", "message": f"File {file_id} not found"}), 404

            current_ver = file_row["current_version"]
            prev_version_row = cursor.execute(
                "SELECT * FROM versions WHERE file_id = ? AND version = ?",
                (file_id, current_ver),
            ).fetchone()

            # Read current blocks from storage
            current_file_path = Path(app.config["CURRENT_STORAGE_DIR"]) / file_id
            with open(current_file_path, "rb") as f:
                old_bytes = f.read()

            blocks = split_into_blocks(old_bytes, block_size=app.config["BLOCK_SIZE"])

            if op == "modify":
                blocks = dynamic_modify_block(blocks, idx, new_block_data)
            elif op == "insert":
                blocks = dynamic_insert_block(blocks, idx, new_block_data)
            elif op == "append":
                blocks = dynamic_append_block(blocks, new_block_data)
            elif op == "delete":
                blocks = dynamic_delete_block(blocks, idx)
            else:
                return jsonify({"error": "INVALID_OP", "message": f"Operation {op} not supported"}), 400

            # Reconstruct full payload
            new_file_bytes = b"".join(blocks)
            new_size_bytes = len(new_file_bytes)
            new_content_hash = compute_file_content_hash_from_bytes(new_file_bytes)

            new_version = current_ver + 1
            created_at_iso = datetime.now(timezone.utc).isoformat()
            version_blob_path = Path(app.config["VERSIONS_STORAGE_DIR"]) / f"{file_id}_v{new_version}"

            # Write updated payload
            with open(current_file_path, "wb") as f:
                f.write(new_file_bytes)
            with open(version_blob_path, "wb") as f:
                f.write(new_file_bytes)

            # Rebuild Merkle tree and update block tags
            merkle_root, _ = build_merkle_tree(blocks)
            k_tag = app.config["K_TAG"]
            block_tags = compute_all_block_tags(k_tag, file_id, new_version, blocks)
            tag_root = compute_tag_root(block_tags)

            secret = app.config["CHAIN_SECRET"]
            prev_chain_hash = prev_version_row["chain_hash"]
            chain_hash = compute_version_chain_hash(
                secret=secret,
                file_id=file_id,
                version=new_version,
                content_hash=new_content_hash,
                prev_chain_hash=prev_chain_hash,
                created_at_utc_iso=created_at_iso,
                merkle_root=merkle_root,
            )

            cursor.execute("UPDATE files SET current_version = ? WHERE id = ?", (new_version, file_id))
            cursor.execute(
                """
                INSERT INTO versions (
                    file_id, version, content_hash, prev_chain_hash, chain_hash,
                    size_bytes, created_at, activity, blob_path, merkle_root, tag_root
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    file_id,
                    new_version,
                    new_content_hash,
                    prev_chain_hash,
                    chain_hash,
                    new_size_bytes,
                    created_at_iso,
                    f"DYNAMIC_{op.upper()}",
                    str(version_blob_path),
                    merkle_root,
                    tag_root,
                ),
            )

            cursor.execute(
                """
                INSERT INTO blocks_meta (file_id, version, block_size, block_count)
                VALUES (?, ?, ?, ?)
                """,
                (file_id, new_version, app.config["BLOCK_SIZE"], len(blocks)),
            )

            for b_idx, tag_val in enumerate(block_tags):
                cursor.execute(
                    """
                    INSERT INTO block_tags (file_id, version, idx, tag)
                    VALUES (?, ?, ?, ?)
                    """,
                    (file_id, new_version, b_idx, tag_val),
                )

            conn.commit()
            log_event(conn, actor_id, actor_role, f"DYNAMIC_{op.upper()}", file_id, "SUCCESS")

            return jsonify(
                {
                    "status": "DYNAMIC_UPDATE_RECORDED",
                    "operation": op,
                    "target_index": idx,
                    "file_id": file_id,
                    "version": new_version,
                    "block_count": len(blocks),
                    "merkle_root": merkle_root,
                    "content_hash": new_content_hash,
                    "chain_hash": chain_hash,
                }
            )
        finally:
            conn.close()

    @app.route("/api/files/<file_id>", methods=["DELETE"])
    def delete_file(file_id: str):
        conn = get_db(app.config["DB_PATH"])
        try:
            current_user = get_current_user(conn)
            actor_id = current_user["id"] if current_user else "demo-owner"
            actor_role = current_user["role"] if current_user else "OWNER"

            cursor = conn.cursor()
            file_row = cursor.execute("SELECT * FROM files WHERE id = ? AND is_deleted = 0", (file_id,)).fetchone()
            if not file_row:
                return jsonify({"error": "FILE_NOT_FOUND", "message": f"File {file_id} not found"}), 404

            cursor.execute("UPDATE files SET is_deleted = 1 WHERE id = ?", (file_id,))
            conn.commit()

            log_event(conn, actor_id, actor_role, "DELETE_FILE", file_id, "SUCCESS")
            return jsonify({"status": "FILE_DELETED", "file_id": file_id, "message": "File moved to soft-deleted state"})
        finally:
            conn.close()

    @app.route("/api/files/<file_id>/download", methods=["GET"])
    def download_file(file_id: str):
        conn = get_db(app.config["DB_PATH"])
        try:
            current_user = get_current_user(conn)
            actor_id = current_user["id"] if current_user else "demo-owner"
            actor_role = current_user["role"] if current_user else "OWNER"

            # TPA is forbidden from downloading files (Section 2)
            if actor_role == "TPA":
                return jsonify({"error": "FORBIDDEN", "message": "TPA role may not download files"}), 403

            cursor = conn.cursor()
            file_row = cursor.execute("SELECT * FROM files WHERE id = ? AND is_deleted = 0", (file_id,)).fetchone()
            if not file_row:
                return jsonify({"error": "FILE_NOT_FOUND", "message": f"File {file_id} not found"}), 404

            current_path = Path(file_row["stored_path"])
            if not current_path.is_file():
                return jsonify({"error": "FILE_MISSING", "message": "File payload missing on storage"}), 404

            log_event(conn, actor_id, actor_role, "DOWNLOAD", file_id, "SUCCESS")
            return send_file(current_path, as_attachment=True, download_name=file_row["display_name"])
        finally:
            conn.close()

    @app.route("/api/files", methods=["GET"])
    def list_files():
        conn = get_db(app.config["DB_PATH"])
        try:
            current_user = get_current_user(conn)
            actor_role = current_user["role"] if current_user else "OWNER"

            cursor = conn.cursor()
            rows = cursor.execute(
                """
                SELECT 
                    f.id,
                    f.display_name,
                    f.created_at,
                    f.current_version,
                    v.size_bytes,
                    v.content_hash,
                    v.merkle_root,
                    v.chain_hash,
                    (SELECT status FROM audits WHERE file_id = f.id ORDER BY id DESC LIMIT 1) AS last_audit_status,
                    (SELECT created_at FROM audits WHERE file_id = f.id ORDER BY id DESC LIMIT 1) AS last_audited_at
                FROM files f
                JOIN versions v ON f.id = v.file_id AND f.current_version = v.version
                WHERE f.is_deleted = 0
                ORDER BY f.created_at DESC
                """
            ).fetchall()

            files = []
            for r in rows:
                item = dict(r)
                # TPA role does not see plaintext filenames (Section 2 & 3.6)
                if actor_role == "TPA":
                    item["display_name"] = f"BLINDED_{item['id'][:8]}"
                files.append(item)

            return jsonify(files)
        finally:
            conn.close()

    @app.route("/api/files/<file_id>/versions", methods=["GET"])
    def get_file_versions(file_id: str):
        conn = get_db(app.config["DB_PATH"])
        try:
            cursor = conn.cursor()
            file_row = cursor.execute("SELECT * FROM files WHERE id = ?", (file_id,)).fetchone()
            if not file_row:
                return jsonify({"error": "FILE_NOT_FOUND", "message": f"File {file_id} not found"}), 404

            v_rows = cursor.execute(
                """
                SELECT id, file_id, version, content_hash, merkle_root, prev_chain_hash, chain_hash,
                       size_bytes, created_at, activity
                FROM versions
                WHERE file_id = ?
                ORDER BY version ASC
                """,
                (file_id,),
            ).fetchall()

            return jsonify(
                {
                    "file_id": file_id,
                    "display_name": file_row["display_name"],
                    "current_version": file_row["current_version"],
                    "versions": [dict(r) for r in v_rows],
                }
            )
        finally:
            conn.close()

    # -------------------------------------------------------------
    # TPA Spot-Check Challenge-Response Endpoints
    # -------------------------------------------------------------

    @app.route("/api/challenge", methods=["POST"])
    def issue_challenge():
        """
        TPA requests a spot-check challenge.
        Challenge seed is strictly derived from:
        seed = SHA256(ledger_head_hash || time_bucket)
        Neither TPA nor Server can cherry-pick indices.
        """
        data = request.get_json(silent=True) or {}
        file_id = data.get("file_id")
        blinded_tag = data.get("blinded_tag")
        r_nonce = data.get("r", "")

        conn = get_db(app.config["DB_PATH"])
        try:
            current_user = get_current_user(conn)
            actor_id = current_user["id"] if current_user else "demo-tpa"
            actor_role = current_user["role"] if current_user else "TPA"

            cursor = conn.cursor()
            target_fid = file_id
            if not target_fid and blinded_tag:
                # Find matching file by matching blinded tag across registered owners/files
                # In prototype, match file hash
                pass

            if not target_fid:
                f_row = cursor.execute("SELECT id FROM files WHERE is_deleted = 0 ORDER BY created_at DESC LIMIT 1").fetchone()
                target_fid = f_row["id"] if f_row else None

            if not target_fid:
                return jsonify({"error": "NO_FILES", "message": "No active files to challenge"}), 404

            file_row = cursor.execute("SELECT current_version FROM files WHERE id = ?", (target_fid,)).fetchone()
            ver = file_row["current_version"]
            meta_row = cursor.execute("SELECT block_count FROM blocks_meta WHERE file_id = ? AND version = ?", (target_fid, ver)).fetchone()
            block_count = meta_row["block_count"] if meta_row else 1

            # Derive public randomness seed
            _, head_hash = get_ledger_head(conn)
            time_bucket = get_current_time_bucket(app.config["TIME_BUCKET_SECONDS"])
            seed = derive_public_challenge_seed(head_hash, time_bucket)
            indices = derive_challenge_indices(f"{seed}|{target_fid}", block_count, sample_count=10)

            # Record CHALLENGE_SEED in simulated blockchain ledger
            ledger_entry = append_ledger_entry(
                conn,
                entry_type="CHALLENGE_SEED",
                payload={
                    "file_id": target_fid,
                    "version": ver,
                    "seed": seed,
                    "time_bucket": time_bucket,
                    "indices": indices,
                },
            )

            log_event(conn, actor_id, actor_role, "CHALLENGE", target_fid, "SUCCESS")

            return jsonify(
                {
                    "file_id": target_fid,
                    "version": ver,
                    "seed": seed,
                    "time_bucket": time_bucket,
                    "block_count": block_count,
                    "challenged_indices": indices,
                    "ledger_seq": ledger_entry["seq"],
                }
            )
        finally:
            conn.close()

    @app.route("/api/proof", methods=["POST"])
    def get_proof():
        """Server generates sampled blocks + Merkle paths + block tags for challenged indices."""
        data = request.get_json(silent=True) or {}
        file_id = data.get("file_id", "")
        version = int(data.get("version", 1))
        indices = data.get("indices", [])

        conn = get_db(app.config["DB_PATH"])
        try:
            proof_payload = generate_spotcheck_proof(
                conn=conn,
                file_id=file_id,
                version=version,
                indices=indices,
                storage_dir=app.config["CURRENT_STORAGE_DIR"],
            )
            return jsonify(proof_payload)
        except Exception as e:
            return jsonify({"error": "PROOF_GENERATION_FAILED", "message": str(e)}), 400
        finally:
            conn.close()

    @app.route("/api/verify-proof", methods=["POST"])
    def verify_proof_route():
        """TPA verifies Merkle audit paths and tags, and appends AUDIT_RESULT to ledger."""
        data = request.get_json(silent=True) or {}
        conn = get_db(app.config["DB_PATH"])
        try:
            current_user = get_current_user(conn)
            actor_id = current_user["id"] if current_user else "demo-tpa"
            actor_role = current_user["role"] if current_user else "TPA"

            ok, msg, details = verify_spotcheck_proof(data, k_tag=app.config["K_TAG"])
            status = "PASS" if ok else "TAMPERED"

            file_id = data.get("file_id", "")
            ver = data.get("version", 1)

            # Record AUDIT_RESULT in simulated blockchain ledger
            ledger_entry = append_ledger_entry(
                conn,
                entry_type="AUDIT_RESULT",
                payload={
                    "audit_type": "TPA_SPOTCHECK",
                    "file_id": file_id,
                    "version": ver,
                    "status": status,
                    "message": msg,
                },
            )

            # Record in audits table
            cursor = conn.cursor()
            now_iso = datetime.now(timezone.utc).isoformat()
            cursor.execute(
                """
                INSERT INTO audits (file_id, kind, status, details_json, created_at)
                VALUES (?, 'SPOT_CHECK', ?, ?, ?)
                """,
                (file_id, status, json.dumps({"message": msg, "details": details}), now_iso),
            )
            conn.commit()

            if not ok:
                create_security_alert(
                    conn,
                    severity="critical",
                    kind="SPOTCHECK_TAMPERED",
                    file_ref=file_id,
                    message=f"Spot-check failed for {file_id}: {msg}",
                )

            log_event(conn, actor_id, actor_role, "VERIFY_PROOF", file_id, status)

            return jsonify(
                {
                    "status": status,
                    "passed": ok,
                    "message": msg,
                    "ledger_seq": ledger_entry["seq"],
                    "verification_steps": details,
                }
            )
        finally:
            conn.close()

    @app.route("/api/audit/batch", methods=["POST"])
    def batch_audit():
        data = request.get_json(silent=True) or {}
        file_ids = data.get("file_ids", [])

        conn = get_db(app.config["DB_PATH"])
        try:
            current_user = get_current_user(conn)
            actor_id = current_user["id"] if current_user else "demo-tpa"
            actor_role = current_user["role"] if current_user else "TPA"

            if not file_ids:
                # Audit all active files
                cursor = conn.cursor()
                file_ids = [r["id"] for r in cursor.execute("SELECT id FROM files WHERE is_deleted = 0").fetchall()]

            res = execute_batch_audit(
                file_ids=file_ids,
                conn=conn,
                k_tag=app.config["K_TAG"],
                storage_dir=app.config["CURRENT_STORAGE_DIR"],
            )

            log_event(conn, actor_id, actor_role, "BATCH_AUDIT", f"Count:{len(file_ids)}", res["status"])
            return jsonify(res)
        finally:
            conn.close()

    @app.route("/api/files/<file_id>/expected-challenge", methods=["GET"])
    def get_expected_challenge(file_id: str):
        """Owner recomputes expected challenge indices to verify TPA didn't cheat."""
        bucket_param = request.args.get("bucket")
        conn = get_db(app.config["DB_PATH"])
        try:
            cursor = conn.cursor()
            file_row = cursor.execute("SELECT current_version FROM files WHERE id = ?", (file_id,)).fetchone()
            if not file_row:
                return jsonify({"error": "FILE_NOT_FOUND"}), 404

            ver = file_row["current_version"]
            meta_row = cursor.execute("SELECT block_count FROM blocks_meta WHERE file_id = ? AND version = ?", (file_id, ver)).fetchone()
            block_count = meta_row["block_count"] if meta_row else 1

            # If a CHALLENGE_SEED was recorded in ledger for this file, use the ledger head at that point
            chal_row = cursor.execute(
                "SELECT prev_hash, payload_json FROM ledger WHERE entry_type = 'CHALLENGE_SEED' AND payload_json LIKE ? ORDER BY seq DESC LIMIT 1",
                (f'%"file_id": "{file_id}"%',),
            ).fetchone()

            if chal_row:
                head_hash = chal_row["prev_hash"]
            else:
                _, head_hash = get_ledger_head(conn)

            time_bucket = int(bucket_param) if bucket_param else get_current_time_bucket(app.config["TIME_BUCKET_SECONDS"])
            seed = derive_public_challenge_seed(head_hash, time_bucket)
            indices = derive_challenge_indices(f"{seed}|{file_id}", block_count, sample_count=10)

            return jsonify(
                {
                    "file_id": file_id,
                    "version": ver,
                    "time_bucket": time_bucket,
                    "ledger_head_hash": head_hash,
                    "seed": seed,
                    "expected_indices": indices,
                }
            )
        finally:
            conn.close()

    # -------------------------------------------------------------
    # Simulated Blockchain Ledger Endpoints
    # -------------------------------------------------------------

    @app.route("/api/ledger", methods=["GET"])
    def list_ledger():
        from_seq = int(request.args.get("from", 1))
        to_seq = int(request.args.get("to", 1000000))
        limit = min(int(request.args.get("limit", 200)), 500)

        conn = get_db(app.config["DB_PATH"])
        try:
            cursor = conn.cursor()
            rows = cursor.execute(
                """
                SELECT seq, entry_type, payload_json, prev_hash, entry_hash, created_at
                FROM ledger
                WHERE seq >= ? AND seq <= ?
                ORDER BY seq ASC
                LIMIT ?
                """,
                (from_seq, to_seq, limit),
            ).fetchall()

            entries = []
            for r in rows:
                item = dict(r)
                try:
                    item["payload"] = json.loads(item["payload_json"])
                except Exception:
                    item["payload"] = {}
                entries.append(item)

            return jsonify(entries)
        finally:
            conn.close()

    @app.route("/api/ledger/verify", methods=["GET"])
    def verify_ledger():
        conn = get_db(app.config["DB_PATH"])
        try:
            ok, bad_seq, err = verify_ledger_chain(conn)
            status = "PASS" if ok else "LEDGER_ALTERED"
            if not ok:
                create_security_alert(
                    conn,
                    severity="critical",
                    kind="LEDGER_ALTERED",
                    file_ref=f"Seq:{bad_seq}",
                    message=f"Simulated blockchain ledger corrupted at sequence {bad_seq}: {err}",
                )

            return jsonify(
                {
                    "status": status,
                    "chain_valid": ok,
                    "first_bad_seq": bad_seq,
                    "error_message": err,
                }
            )
        finally:
            conn.close()

    # -------------------------------------------------------------
    # Ownership & Privacy Endpoints (DPD Resistance)
    # -------------------------------------------------------------

    @app.route("/api/ownership/<file_hash>", methods=["GET"])
    def get_ownership(file_hash: str):
        conn = get_db(app.config["DB_PATH"])
        try:
            cursor = conn.cursor()
            rows = cursor.execute(
                "SELECT file_hash, blinded_owner, ledger_seq FROM ownership WHERE file_hash = ?",
                (file_hash.lower(),),
            ).fetchall()
            return jsonify([dict(r) for r in rows])
        finally:
            conn.close()

    @app.route("/api/ownership/check", methods=["POST"])
    def check_ownership():
        """Owner confirms their blinded ID is present in the ledger for their file (DPD check)."""
        data = request.get_json(silent=True) or {}
        file_hash = data.get("file_hash", "").lower()
        blinded_owner = data.get("blinded_owner", "")

        conn = get_db(app.config["DB_PATH"])
        try:
            cursor = conn.cursor()
            row = cursor.execute(
                "SELECT * FROM ownership WHERE file_hash = ? AND blinded_owner = ?",
                (file_hash, blinded_owner),
            ).fetchone()

            return jsonify(
                {
                    "file_hash": file_hash,
                    "blinded_owner": blinded_owner,
                    "found_in_ledger": bool(row),
                    "ledger_seq": row["ledger_seq"] if row else None,
                }
            )
        finally:
            conn.close()

    # -------------------------------------------------------------
    # Auditing (v1 Legacy Compatibility)
    # -------------------------------------------------------------

    @app.route("/api/files/<file_id>/audit", methods=["POST"])
    def audit_file(file_id: str):
        data = request.get_json(silent=True) or {}
        receipt = data.get("receipt")

        result = execute_audit(
            file_id=file_id,
            receipt=receipt,
            db_path=app.config["DB_PATH"],
            secret=app.config["CHAIN_SECRET"],
            current_storage_dir=app.config["CURRENT_STORAGE_DIR"],
        )
        if "status_code" in result:
            code = result.pop("status_code")
            return jsonify(result), code
        return jsonify(result)

    @app.route("/api/files/<file_id>/verify-chain", methods=["POST"])
    def verify_chain(file_id: str):
        data = request.get_json(silent=True) or {}
        receipt = data.get("receipt")

        result = execute_verify_chain(
            file_id=file_id,
            receipt=receipt,
            db_path=app.config["DB_PATH"],
            secret=app.config["CHAIN_SECRET"],
        )
        if "status_code" in result:
            code = result.pop("status_code")
            return jsonify(result), code
        return jsonify(result)

    @app.route("/api/audits", methods=["GET"])
    def list_audits():
        file_id = request.args.get("file_id")
        status_filter = request.args.get("status")
        limit = min(int(request.args.get("limit", 100)), 500)

        conn = get_db(app.config["DB_PATH"])
        try:
            cursor = conn.cursor()
            query = "SELECT a.*, f.display_name FROM audits a LEFT JOIN files f ON a.file_id = f.id WHERE 1=1"
            params = []

            if file_id:
                query += " AND a.file_id = ?"
                params.append(file_id)
            if status_filter:
                query += " AND a.status = ?"
                params.append(status_filter)

            query += " ORDER BY a.id DESC LIMIT ?"
            params.append(limit)

            rows = cursor.execute(query, params).fetchall()
            results = []
            for r in rows:
                item = dict(r)
                try:
                    item["details"] = json.loads(item["details_json"])
                except Exception:
                    item["details"] = {}
                results.append(item)
            return jsonify(results)
        finally:
            conn.close()

    @app.route("/api/stats", methods=["GET"])
    def get_stats():
        conn = get_db(app.config["DB_PATH"])
        try:
            cursor = conn.cursor()
            total_files = cursor.execute("SELECT COUNT(*) FROM files WHERE is_deleted = 0").fetchone()[0]
            total_versions = cursor.execute("SELECT COUNT(*) FROM versions").fetchone()[0]
            total_audits = cursor.execute("SELECT COUNT(*) FROM audits").fetchone()[0]
            tamper_events = cursor.execute(
                "SELECT COUNT(*) FROM audits WHERE status IN ('TAMPERED', 'VERSION_HISTORY_ALTERED')"
            ).fetchone()[0]

            latest_audit = cursor.execute("SELECT status FROM audits ORDER BY id DESC LIMIT 1").fetchone()
            latest_status = latest_audit[0] if latest_audit else "HEALTHY"

            # Check if seeded demo files are present
            demo_count = cursor.execute(
                "SELECT COUNT(*) FROM files WHERE display_name LIKE '%demo%' OR display_name LIKE '%prototype%'"
            ).fetchone()[0]

            alerts_count = cursor.execute("SELECT COUNT(*) FROM alerts WHERE acknowledged = 0").fetchone()[0]

            return jsonify(
                {
                    "total_files": total_files,
                    "total_versions": total_versions,
                    "audits_performed": total_audits,
                    "tamper_events": tamper_events,
                    "active_alerts": alerts_count,
                    "version_chain_status": latest_status,
                    "is_demo_seeded": bool(demo_count > 0),
                    "storage_infrastructure": "simulated cloud storage",
                    "ledger_type": "simulated local append-only ledger",
                }
            )
        finally:
            conn.close()

    # -------------------------------------------------------------
    # Alerts, Reports, Events, Schedules
    # -------------------------------------------------------------

    @app.route("/api/alerts", methods=["GET"])
    def list_alerts():
        conn = get_db(app.config["DB_PATH"])
        try:
            cursor = conn.cursor()
            rows = cursor.execute("SELECT * FROM alerts ORDER BY id DESC LIMIT 100").fetchall()
            return jsonify([dict(r) for r in rows])
        finally:
            conn.close()

    @app.route("/api/alerts/<int:alert_id>/ack", methods=["POST"])
    def ack_alert(alert_id: int):
        conn = get_db(app.config["DB_PATH"])
        try:
            cursor = conn.cursor()
            cursor.execute("UPDATE alerts SET acknowledged = 1 WHERE id = ?", (alert_id,))
            conn.commit()
            return jsonify({"status": "ACKNOWLEDGED", "alert_id": alert_id})
        finally:
            conn.close()

    @app.route("/api/reports/audits.csv", methods=["GET"])
    def export_audits_csv():
        conn = get_db(app.config["DB_PATH"])
        try:
            cursor = conn.cursor()
            rows = cursor.execute("SELECT id, file_id, kind, status, created_at FROM audits ORDER BY id DESC").fetchall()
            _, head_hash = get_ledger_head(conn)

            si = io.StringIO()
            cw = csv.writer(si)
            cw.writerow(["AUDIT ID", "FILE ID", "KIND", "STATUS", "TIMESTAMP"])
            for r in rows:
                cw.writerow([r["id"], r["file_id"], r["kind"], r["status"], r["created_at"]])
            cw.writerow([])
            cw.writerow(["SIGNATURE LINE: LEDGER HEAD HASH", head_hash])

            return Response(
                si.getvalue(),
                mimetype="text/csv",
                headers={"Content-Disposition": "attachment;filename=audits_report.csv"},
            )
        finally:
            conn.close()

    @app.route("/api/reports/audits.pdf", methods=["GET"])
    def export_audits_pdf():
        """Generate PDF audit report with ledger signature."""
        conn = get_db(app.config["DB_PATH"])
        try:
            cursor = conn.cursor()
            rows = cursor.execute("SELECT id, file_id, kind, status, created_at FROM audits ORDER BY id DESC LIMIT 50").fetchall()
            _, head_hash = get_ledger_head(conn)

            pdf_buffer = generate_simple_pdf_report(rows, head_hash)
            return Response(
                pdf_buffer,
                mimetype="application/pdf",
                headers={"Content-Disposition": "attachment;filename=audits_report.pdf"},
            )
        finally:
            conn.close()

    @app.route("/api/schedules", methods=["GET", "POST"])
    def schedules_endpoint():
        conn = get_db(app.config["DB_PATH"])
        try:
            cursor = conn.cursor()
            if request.method == "POST":
                data = request.get_json(silent=True) or {}
                file_id = data.get("file_id")
                interval_min = int(data.get("interval_minutes", 60))
                cursor.execute(
                    "INSERT INTO schedules (file_id, interval_minutes, last_run, enabled) VALUES (?, ?, NULL, 1)",
                    (file_id, interval_min),
                )
                conn.commit()
                return jsonify({"status": "SCHEDULE_CREATED", "id": cursor.lastrowid}), 201

            rows = cursor.execute("SELECT * FROM schedules ORDER BY id DESC").fetchall()
            return jsonify([dict(r) for r in rows])
        finally:
            conn.close()

    @app.route("/api/events", methods=["GET"])
    def list_events():
        conn = get_db(app.config["DB_PATH"])
        try:
            cursor = conn.cursor()
            rows = cursor.execute("SELECT * FROM events ORDER BY id DESC LIMIT 200").fetchall()
            return jsonify([dict(r) for r in rows])
        finally:
            conn.close()

    # -------------------------------------------------------------
    # Attacker Simulation & Demo Routes (Gated by ENABLE_DEMO_TAMPER)
    # -------------------------------------------------------------

    @app.before_request
    def gate_demo_routes():
        if request.path.startswith("/api/demo/"):
            if not app.config["ENABLE_DEMO_TAMPER"]:
                return (
                    jsonify(
                        {
                            "error": "DEMO_MODE_DISABLED",
                            "message": "Attacker simulation endpoints are disabled. Set ENABLE_DEMO_TAMPER=true to enable.",
                        }
                    ),
                    404,
                )

    @app.route("/api/demo/tamper-file/<file_id>", methods=["POST"])
    def demo_tamper_file(file_id: str):
        target_path = Path(app.config["CURRENT_STORAGE_DIR"]) / file_id
        if not target_path.is_file():
            return jsonify({"error": "FILE_NOT_FOUND", "message": f"Active file payload for {file_id} not found"}), 404

        with open(target_path, "wb") as f:
            f.write(b"=== UNAUTHORIZED STORAGE TAMPER: SILENT CORRUPTION INJECTED BY ATTACKER ===")

        return jsonify(
            {
                "status": "TAMPERED_ON_DISK",
                "file_id": file_id,
                "message": "Active storage file on disk directly modified without updating database or version chain.",
            }
        )

    @app.route("/api/demo/tamper-block/<file_id>", methods=["POST"])
    def demo_tamper_block(file_id: str):
        """Corrupt a specific 64KB block on disk."""
        target_idx = int(request.args.get("i", 0))
        target_path = Path(app.config["CURRENT_STORAGE_DIR"]) / file_id
        if not target_path.is_file():
            return jsonify({"error": "FILE_NOT_FOUND"}), 404

        with open(target_path, "rb") as f:
            data = f.read()

        blocks = split_into_blocks(data, block_size=app.config["BLOCK_SIZE"])
        if target_idx < 0 or target_idx >= len(blocks):
            return jsonify({"error": "INDEX_OUT_OF_BOUNDS"}), 400

        # Corrupt targeted block
        blocks[target_idx] = b"CORRUPTED_BLOCK_BYTES_INJECTED_FOR_SPOTCHECK"
        with open(target_path, "wb") as f:
            f.write(b"".join(blocks))

        return jsonify(
            {
                "status": "BLOCK_TAMPERED",
                "file_id": file_id,
                "block_index": target_idx,
                "message": f"Block index {target_idx} corrupted on storage payload.",
            }
        )

    @app.route("/api/demo/tamper-history/<file_id>", methods=["POST"])
    def demo_tamper_history(file_id: str):
        data = request.get_json(silent=True) or {}
        target_ver = data.get("version", 1)

        conn = get_db(app.config["DB_PATH"])
        try:
            cursor = conn.cursor()
            row = cursor.execute(
                "SELECT * FROM versions WHERE file_id = ? AND version = ?",
                (file_id, target_ver),
            ).fetchone()
            if not row:
                return jsonify({"error": "VERSION_NOT_FOUND", "message": f"Version V{target_ver} not found"}), 404

            fake_hash = "deadbeef" * 8
            cursor.execute(
                "UPDATE versions SET content_hash = ? WHERE file_id = ? AND version = ?",
                (fake_hash, file_id, target_ver),
            )
            conn.commit()

            return jsonify(
                {
                    "status": "HISTORY_TAMPERED_IN_DB",
                    "file_id": file_id,
                    "tampered_version": target_ver,
                    "forged_content_hash": fake_hash,
                    "message": f"Version V{target_ver} content_hash directly altered in database.",
                }
            )
        finally:
            conn.close()

    @app.route("/api/demo/tamper-ledger", methods=["POST"])
    def demo_tamper_ledger():
        """Simulate malicious alteration of an existing simulated blockchain ledger entry."""
        conn = get_db(app.config["DB_PATH"])
        try:
            cursor = conn.cursor()
            row = cursor.execute("SELECT seq FROM ledger ORDER BY seq DESC LIMIT 1").fetchone()
            if not row:
                return jsonify({"error": "LEDGER_EMPTY"}), 400

            target_seq = row["seq"]
            # Tamper with the entry payload directly in SQLite
            cursor.execute(
                "UPDATE ledger SET payload_json = ? WHERE seq = ?",
                ('{"tampered": true, "attacker": "mallory"}', target_seq),
            )
            conn.commit()

            return jsonify(
                {
                    "status": "LEDGER_TAMPERED",
                    "tampered_seq": target_seq,
                    "message": f"Ledger entry at seq {target_seq} was maliciously modified in database.",
                }
            )
        finally:
            conn.close()

    @app.route("/api/demo/reset", methods=["POST"])
    def demo_reset():
        curr_dir = Path(app.config["CURRENT_STORAGE_DIR"])
        vers_dir = Path(app.config["VERSIONS_STORAGE_DIR"])

        for p in curr_dir.glob("*"):
            if p.is_file():
                p.unlink()
        for p in vers_dir.glob("*"):
            if p.is_file():
                p.unlink()

        conn = get_db(app.config["DB_PATH"])
        try:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM alerts")
            cursor.execute("DELETE FROM events")
            cursor.execute("DELETE FROM ownership")
            cursor.execute("DELETE FROM block_tags")
            cursor.execute("DELETE FROM blocks_meta")
            cursor.execute("DELETE FROM audits")
            cursor.execute("DELETE FROM versions")
            cursor.execute("DELETE FROM files")
            cursor.execute("DELETE FROM ledger")
            conn.commit()

            # Re-seed genesis ledger
            from db import _ensure_genesis_ledger
            _ensure_genesis_ledger(conn)
            if app.config["ENABLE_DEMO_TAMPER"]:
                seed_demo_users_if_needed(conn)
        finally:
            conn.close()

        return jsonify({"status": "RESET_SUCCESS", "message": "Storage and database reset to pristine state"})

    @app.route("/api/demo/seed", methods=["POST"])
    def demo_seed():
        demo_reset()

        conn = get_db(app.config["DB_PATH"])
        secret = app.config["CHAIN_SECRET"]
        k_tag = app.config["K_TAG"]

        sample_files = [
            (
                "financial_ledger_prototype_demo.csv",
                [
                    b"date,account,amount,description\n2026-09-01,1001,45000.00,Initial Cloud Allocation\n",
                    b"date,account,amount,description\n2026-09-01,1001,45000.00,Initial Cloud Allocation\n2026-09-15,1002,12500.50,Authorized Storage Expansion\n",
                ],
            ),
            (
                "security_audit_spec_demo.txt",
                [
                    b"PROJECT: Auditing Mechanism in Cloud Data Services\nMODEL: Version-Based Dynamic Cloud Data Auditing\nSTATUS: Active Prototype\n",
                ],
            ),
        ]

        created_files = []
        try:
            cursor = conn.cursor()
            for display_name, versions_content in sample_files:
                file_id = str(uuid.uuid4())
                current_file_path = Path(app.config["CURRENT_STORAGE_DIR"]) / file_id
                genesis_hc = compute_genesis_chain_hash(secret, file_id)
                prev_hc = genesis_hc

                cursor.execute(
                    "INSERT INTO files (id, display_name, created_at, current_version, stored_path, is_deleted) VALUES (?, ?, ?, ?, ?, 0)",
                    (
                        file_id,
                        display_name,
                        datetime.now(timezone.utc).isoformat(),
                        len(versions_content),
                        str(current_file_path),
                    ),
                )

                for v_idx, content in enumerate(versions_content, start=1):
                    v_time = datetime.now(timezone.utc).isoformat()
                    v_blob_path = Path(app.config["VERSIONS_STORAGE_DIR"]) / f"{file_id}_v{v_idx}"

                    with open(v_blob_path, "wb") as f:
                        f.write(content)
                    with open(current_file_path, "wb") as f:
                        f.write(content)

                    c_hash = compute_file_content_hash_from_bytes(content)
                    blocks = split_into_blocks(content, block_size=app.config["BLOCK_SIZE"])
                    merkle_root, _ = build_merkle_tree(blocks)
                    block_tags = compute_all_block_tags(k_tag, file_id, v_idx, blocks)
                    tag_root = compute_tag_root(block_tags)

                    v_chain_hash = compute_version_chain_hash(
                        secret=secret,
                        file_id=file_id,
                        version=v_idx,
                        content_hash=c_hash,
                        prev_chain_hash=prev_hc,
                        created_at_utc_iso=v_time,
                        merkle_root=merkle_root,
                    )
                    activity = "UPLOAD" if v_idx == 1 else "AUTHORIZED_UPDATE"

                    cursor.execute(
                        """
                        INSERT INTO versions (
                            file_id, version, content_hash, prev_chain_hash, chain_hash,
                            size_bytes, created_at, activity, blob_path, merkle_root, tag_root
                        )
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            file_id,
                            v_idx,
                            c_hash,
                            prev_hc,
                            v_chain_hash,
                            len(content),
                            v_time,
                            activity,
                            str(v_blob_path),
                            merkle_root,
                            tag_root,
                        ),
                    )

                    cursor.execute(
                        "INSERT INTO blocks_meta (file_id, version, block_size, block_count) VALUES (?, ?, ?, ?)",
                        (file_id, v_idx, app.config["BLOCK_SIZE"], len(blocks)),
                    )
                    for b_idx, t_val in enumerate(block_tags):
                        cursor.execute(
                            "INSERT INTO block_tags (file_id, version, idx, tag) VALUES (?, ?, ?, ?)",
                            (file_id, v_idx, b_idx, t_val),
                        )

                    prev_hc = v_chain_hash

                created_files.append(file_id)

            conn.commit()
            return jsonify(
                {
                    "status": "DEMO_SEEDED",
                    "files_created": len(created_files),
                    "file_ids": created_files,
                    "badge": "Prototype Demo Data",
                }
            )
        finally:
            conn.close()

    dist_dir = Path(__file__).resolve().parent.parent / "frontend" / "dist"
    if dist_dir.exists():
        from flask import send_from_directory

        @app.route("/", defaults={"path": ""})
        @app.route("/<path:path>")
        def serve_frontend(path):
            if path and (dist_dir / path).exists():
                return send_from_directory(dist_dir, path)
            return send_from_directory(dist_dir, "index.html")

    return app


def compute_file_content_hash_from_bytes(data: bytes) -> str:
    import hashlib
    return hashlib.sha256(data).hexdigest().lower()


def generate_simple_pdf_report(rows, head_hash: str) -> bytes:
    """Generate pure-Python valid PDF document for audit reports."""
    lines = [
        "%PDF-1.4",
        "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
        "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
        "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj",
        "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    ]

    text_commands = [
        "BT",
        "/F1 16 Tf",
        "50 740 Td",
        "(AUDITING MECHANISM IN CLOUD DATA SERVICES - AUDIT REPORT) Tj",
        "/F1 10 Tf",
        "0 -20 Td",
        f"(Ledger Head Signature: {head_hash[:32]}...) Tj",
        "0 -20 Td",
        f"(Generated at: {datetime.now(timezone.utc).isoformat()}) Tj",
        "0 -30 Td",
        "(ID  |  FILE ID                                |  KIND         |  STATUS) Tj",
        "0 -15 Td",
        "(-----------------------------------------------------------------------) Tj",
    ]

    for r in rows[:30]:
        line_str = f"{r['id']:<4} | {str(r['file_id'])[:32]:<34} | {str(r['kind']):<12} | {str(r['status']):<10}"
        # Escape parenthesis
        clean_line = line_str.replace("(", "[").replace(")", "]")
        text_commands.append("0 -15 Td")
        text_commands.append(f"({clean_line}) Tj")

    text_commands.append("ET")
    stream_content = "\n".join(text_commands)
    stream_len = len(stream_content.encode("latin-1"))

    lines.append(f"4 0 obj << /Length {stream_len} >> stream")
    lines.append(stream_content)
    lines.append("endstream")
    lines.append("endobj")

    # xref table
    xref_pos = sum(len(l.encode("latin-1")) + 1 for l in lines)
    lines.append("xref")
    lines.append("0 6")
    lines.append("0000000000 65535 f ")
    lines.append("0000000009 00000 n ")
    lines.append("0000000058 00000 n ")
    lines.append("0000000115 00000 n ")
    lines.append("0000000300 00000 n ")
    lines.append("0000000220 00000 n ")
    lines.append("trailer << /Size 6 /Root 1 0 R >>")
    lines.append("startxref")
    lines.append(str(xref_pos))
    lines.append("%%EOF")

    return "\n".join(lines).encode("latin-1")


if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=5000, debug=True)
