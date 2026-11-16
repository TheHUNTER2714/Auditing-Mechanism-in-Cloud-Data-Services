import csv
import io
import json
import os
import re
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from flask import Flask, Response, jsonify, make_response, request, send_file
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
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
    admin_required,
    compute_blinded_file_tag,
    compute_blinded_owner_id,
    create_email_verification,
    create_password_reset,
    generate_token,
    generate_user_blinding_key,
    get_current_user,
    hash_password,
    log_event,
    login_required,
    register_cli_commands,
    resend_email_verification,
    seed_demo_users_if_needed,
    service_token_required,
    validate_password_strength,
    verify_and_consume_password_reset,
    verify_email_token,
    verify_password,
)
from chain import (
    compute_bytes_content_hash,
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
    get_merkle_proof,
    split_into_blocks,
)
from policy import (
    append_audit_log,
    evaluate_registration_policy,
    generate_nightly_summary,
    load_policy,
    record_failed_login,
    record_idor_probe,
    save_policy,
    verify_log,
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
        LOG_SECRET=config.LOG_SECRET,
        AUDITOR_SERVICE_TOKEN=config.AUDITOR_SERVICE_TOKEN,
        TIME_BUCKET_SECONDS=config.TIME_BUCKET_SECONDS,
        ENABLE_DEMO_TAMPER=config.ENABLE_DEMO_TAMPER,
        DEMO_MODE=config.DEMO_MODE,
        MAX_CONTENT_LENGTH=config.MAX_CONTENT_LENGTH,
    )

    if test_config:
        app.config.update(test_config)

    # Hard security check: refuse to start if secrets are missing, too short, or defaults
    config.validate_all_secrets(app.config)

    # Initialize CORS
    CORS(app, origins=config.CORS_ORIGINS, supports_credentials=True)

    # Initialize Rate Limiter
    limiter = Limiter(
        get_remote_address,
        app=app,
        default_limits=["500 per minute"],
        storage_uri="memory://",
    )

    # Register CLI commands (e.g. flask create-admin)
    register_cli_commands(app)

    # Ensure storage paths and DB exist
    Path(app.config["CURRENT_STORAGE_DIR"]).mkdir(parents=True, exist_ok=True)
    Path(app.config["VERSIONS_STORAGE_DIR"]).mkdir(parents=True, exist_ok=True)
    init_db(app.config["DB_PATH"])

    # Phase 1 requirement: Demo seeding is an explicit development action (flask seed-demo)
    # and MUST NOT run automatically on application startup.

    # Start background scheduler
    scheduler = AuditScheduler(db_path=app.config["DB_PATH"])
    scheduler.start()

    # -------------------------------------------------------------
    # System & Config Endpoints
    # -------------------------------------------------------------

    def get_system_info():
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
                    "auth_register": "/api/auth/register",
                    "files": "/api/files",
                    "ledger": "/api/ledger",
                    "alerts": "/api/alerts",
                    "audits": "/api/audits",
                },
            }
        )

    @app.route("/api", methods=["GET"])
    def api_root():
        return get_system_info()

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
                "demo_mode": app.config["ENABLE_DEMO_TAMPER"] or app.config.get("DEMO_MODE", False),
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
        from benchmark import run_all_benchmarks
        return jsonify(run_all_benchmarks())

    # -------------------------------------------------------------
    # Authentication & User Management Endpoints (Argon2id, Verification, Rate Limits)
    # -------------------------------------------------------------

    @app.route("/api/auth/register", methods=["POST"])
    @limiter.limit("10 per minute")
    def register():
        """Public registration creates OWNER accounts only. Never grants ADMIN."""
        data = request.get_json(silent=True) or {}
        name = (data.get("name") or "").strip()
        email = (data.get("email") or data.get("username") or "").strip().lower()
        password = data.get("password", "")
        confirm_password = data.get("confirm_password")

        if not email or "@" not in email:
            return jsonify({"error": "INVALID_INPUT", "message": "A valid email address is required."}), 400

        if confirm_password is not None and confirm_password != password:
            return jsonify({"error": "PASSWORD_MISMATCH", "message": "Password and confirmation do not match."}), 400

        ok, msg = validate_password_strength(password)
        if not ok:
            return jsonify({"error": "WEAK_PASSWORD", "message": msg}), 400

        conn = get_db(app.config["DB_PATH"])
        try:
            cursor = conn.cursor()
            existing = cursor.execute("SELECT id FROM users WHERE email = ? OR username = ?", (email, email)).fetchone()
            if existing:
                return jsonify({"error": "DUPLICATE_EMAIL", "message": "An account with this email address already exists."}), 409

            user_id = str(uuid.uuid4())
            pw_hash = hash_password(password)
            user_key = generate_user_blinding_key()
            now_iso = datetime.now(timezone.utc).isoformat()

            # Automated system verification & risk checks
            disposable_domains = {"mailinator.com", "tempmail.com", "10minutemail.com", "throwawaymail.com", "guerrillamail.com", "trashmail.com"}
            domain = email.split("@", 1)[1].lower() if "@" in email else ""
            risk_flags = []
            if domain in disposable_domains:
                risk_flags.append("DISPOSABLE_EMAIL_DOMAIN")
            if not re.match(r"^[^@\s]+@[^@\s]+\.[a-zA-Z]{2,}$", email):
                risk_flags.append("UNCONVENTIONAL_EMAIL_FORMAT")

            risk_score = len(risk_flags) * 50
            verif_summary = {
                "risk_score": risk_score,
                "risk_level": "HIGH" if risk_score >= 50 else "LOW",
                "flags": risk_flags,
                "checks_passed": len(risk_flags) == 0,
                "domain": domain,
                "password_strength": "STRONG",
                "registered_at": now_iso,
            }
            verif_json = json.dumps(verif_summary)

            # Rule 1: Public registration creates OWNER only. Role field in request is strictly ignored.
            cursor.execute(
                """
                INSERT INTO users (id, name, email, username, pw_hash, role, status, email_verified, token_version, created_at, user_key, is_demo, verification_results)
                VALUES (?, ?, ?, ?, ?, 'OWNER', 'EMAIL_VERIFICATION_PENDING', 0, 1, ?, ?, 0, ?)
                """,
                (user_id, name, email, email, pw_hash, now_iso, user_key, verif_json),
            )
            raw_token = create_email_verification(conn, user_id, email)

            append_audit_log(
                conn,
                actor_type="OWNER",
                actor_id=user_id,
                action="REGISTER_OWNER",
                resource=f"user:{user_id}",
                result="PENDING_VERIFICATION",
                details={"email": email, "risk_level": verif_summary["risk_level"]},
            )
            conn.commit()

            return jsonify(
                {
                    "status": "REGISTERED",
                    "account_status": "EMAIL_VERIFICATION_PENDING",
                    "message": "Registration successful. Please verify your email using the link sent to your inbox.",
                    "user_id": user_id,
                    "email": email,
                    "verification_token": raw_token if app.config.get("TESTING") else None,
                }
            ), 201
        finally:
            conn.close()

    @app.route("/api/auth/verify-email", methods=["POST"])
    @limiter.limit("20 per minute")
    def verify_email_route():
        """Verifies single-use email token and applies Policy Engine rules."""
        data = request.get_json(silent=True) or {}
        raw_token = data.get("token", "").strip()
        if not raw_token:
            return jsonify({"error": "INVALID_TOKEN", "message": "Verification token is required."}), 400

        conn = get_db(app.config["DB_PATH"])
        try:
            ok, user_id, err_msg = verify_email_token(conn, raw_token)
            if not ok:
                return jsonify({"error": "VERIFICATION_FAILED", "message": err_msg}), 400

            cursor = conn.cursor()
            user = cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
            user_email = user["email"] or user["username"]

            new_status, rule = evaluate_registration_policy(user_email, email_verified=True)
            cursor.execute("UPDATE users SET status = ?, email_verified = 1 WHERE id = ?", (new_status, user_id))

            append_audit_log(
                conn,
                actor_type="SYSTEM",
                actor_id="policy-engine",
                action="EVALUATE_REGISTRATION_STATUS",
                resource=f"user:{user_id}",
                result=new_status,
                details={"rule": rule, "email": user_email},
            )
            conn.commit()

            return jsonify(
                {
                    "status": "VERIFIED",
                    "user_status": new_status,
                    "rule_applied": rule,
                    "message": "Email verified successfully. Account is now active." if new_status == "ACTIVE" else "Email verified. Account is pending Administrator approval.",
                }
            )
        finally:
            conn.close()

    @app.route("/api/auth/resend-verification", methods=["POST"])
    @limiter.limit("10 per minute")
    def resend_verification_route():
        """Safe resend verification token with rate limiting to prevent enumeration."""
        data = request.get_json(silent=True) or {}
        email = data.get("email", "").strip().lower()
        if not email:
            return jsonify({"error": "MISSING_FIELD", "message": "Email address is required."}), 400

        conn = get_db(app.config["DB_PATH"])
        try:
            ok, msg = resend_email_verification(conn, email)
            return jsonify({"status": "SUCCESS", "message": msg})
        finally:
            conn.close()

    @app.route("/api/auth/forgot-password", methods=["POST"])
    @limiter.limit("5 per minute")
    def forgot_password_route():
        """Requests single-use password reset token via dev console mailer."""
        data = request.get_json(silent=True) or {}
        email = data.get("email", "").strip().lower()
        if not email:
            return jsonify({"error": "MISSING_FIELD", "message": "Email address is required."}), 400

        conn = get_db(app.config["DB_PATH"])
        try:
            cursor = conn.cursor()
            user = cursor.execute("SELECT id, status FROM users WHERE email = ? OR username = ?", (email, email)).fetchone()
            if user and user["status"] in ("ACTIVE", "PENDING"):
                raw_token = create_password_reset(conn, user["id"], email)
                return jsonify({
                    "status": "RESET_DISPATCHED",
                    "message": "If that account exists, a secure password reset link has been dispatched.",
                    "reset_token": raw_token if app.config.get("TESTING") else None,
                })
            # Always return generic message to prevent account enumeration
            return jsonify({
                "status": "RESET_DISPATCHED",
                "message": "If that account exists, a secure password reset link has been dispatched.",
            })
        finally:
            conn.close()

    @app.route("/api/auth/reset-password", methods=["POST"])
    @limiter.limit("10 per minute")
    def reset_password_route():
        """Consumes password reset token, validates new password strength, and updates credentials."""
        data = request.get_json(silent=True) or {}
        token = data.get("token", "").strip()
        new_password = data.get("new_password", "")
        if not token or not new_password:
            return jsonify({"error": "MISSING_FIELDS", "message": "Token and new_password are required."}), 400

        conn = get_db(app.config["DB_PATH"])
        try:
            ok, user_id, err_msg = verify_and_consume_password_reset(conn, token, new_password)
            if not ok:
                return jsonify({"error": "RESET_FAILED", "message": err_msg}), 400

            log_event(conn, user_id, "OWNER", "PASSWORD_RESET", "user_credentials", "SUCCESS")
            append_audit_log(
                conn,
                actor_type="OWNER",
                actor_id=user_id,
                action="PASSWORD_RESET",
                resource=f"user:{user_id}",
                result="SUCCESS",
            )
            return jsonify({
                "status": "SUCCESS",
                "message": "Password has been securely reset. Please log in with your new password.",
            })
        finally:
            conn.close()

    @app.route("/api/auth/profile", methods=["GET", "PUT"])
    @login_required
    def user_profile():
        """View and update permitted profile information. Users cannot modify their role or ID."""
        user = request.current_user
        conn = get_db(app.config["DB_PATH"])
        try:
            cursor = conn.cursor()
            if request.method == "GET":
                row = cursor.execute("SELECT id, name, email, username, role, status, email_verified, created_at FROM users WHERE id = ?", (user["id"],)).fetchone()
                if not row:
                    return jsonify({"error": "NOT_FOUND", "message": "User not found."}), 404
                return jsonify(dict(row))

            # PUT - Update permitted fields
            data = request.get_json(silent=True) or {}
            # Reject attempt to modify role, status, id, or email directly
            for forbidden_field in ("role", "status", "id", "email_verified", "token_version"):
                if forbidden_field in data and str(data[forbidden_field]) != str(user.get(forbidden_field)):
                    return jsonify({"error": "FORBIDDEN", "message": f"Modification of field '{forbidden_field}' is strictly forbidden."}), 403

            new_name = data.get("name", "").strip()
            if new_name:
                cursor.execute("UPDATE users SET name = ? WHERE id = ?", (new_name, user["id"]))
                conn.commit()
                log_event(conn, user["id"], user["role"], "PROFILE_UPDATE", f"user:{user['id']}", "SUCCESS")

            updated_row = cursor.execute("SELECT id, name, email, username, role, status, email_verified, created_at FROM users WHERE id = ?", (user["id"],)).fetchone()
            return jsonify({"status": "UPDATED", "profile": dict(updated_row)})
        finally:
            conn.close()

    @app.route("/api/auth/login", methods=["POST"])
    @app.route("/api/admin/login", methods=["POST"])
    @limiter.limit("15 per minute")
    def login():
        """Single authentication service for both owner and admin logins."""
        data = request.get_json(silent=True) or {}
        email_or_user = (data.get("email") or data.get("username") or "").strip().lower()
        password = data.get("password", "")
        portal = (data.get("portal") or request.args.get("portal") or ("admin" if request.path.startswith("/api/admin") else "owner")).lower()
        client_ip = request.remote_addr or "127.0.0.1"

        conn = get_db(app.config["DB_PATH"])
        try:
            cursor = conn.cursor()
            user_row = cursor.execute(
                "SELECT * FROM users WHERE email = ? OR username = ?",
                (email_or_user, email_or_user),
            ).fetchone()

            if not user_row or not verify_password(password, user_row["pw_hash"]):
                record_failed_login(conn, email_or_user, client_ip)
                log_event(conn, "anonymous", "GUEST", "LOGIN_ATTEMPT", email_or_user, "FAILED", client_ip)
                return jsonify({"error": "INVALID_CREDENTIALS", "message": "Invalid credentials."}), 401

            user_role = user_row["role"]
            # Strict role match: portal role mismatch returns same generic error and creates NO session
            if portal == "admin" and user_role != "ADMIN":
                record_failed_login(conn, email_or_user, client_ip)
                log_event(conn, user_row["id"], user_role, "PORTAL_MISMATCH", portal, "FAILED", client_ip)
                return jsonify({"error": "INVALID_CREDENTIALS", "message": "Invalid credentials."}), 401

            if portal == "owner" and user_role != "OWNER":
                record_failed_login(conn, email_or_user, client_ip)
                log_event(conn, user_row["id"], user_role, "PORTAL_MISMATCH", portal, "FAILED", client_ip)
                return jsonify({"error": "INVALID_CREDENTIALS", "message": "Invalid credentials."}), 401

            user_status = user_row["status"] if "status" in user_row.keys() else "ACTIVE"
            if user_status == "SUSPENDED":
                return jsonify({"error": "FORBIDDEN", "message": "Account suspended. Please contact administrator.", "status": "SUSPENDED"}), 403
            if user_status == "REJECTED":
                reason = user_row["rejection_reason"] if "rejection_reason" in user_row.keys() and user_row["rejection_reason"] else None
                msg = f"Account registration rejected: {reason}" if reason else "Account registration rejected."
                return jsonify({"error": "FORBIDDEN", "message": msg, "status": "REJECTED", "reason": reason}), 403
            if user_status == "EMAIL_VERIFICATION_PENDING" or not user_row["email_verified"]:
                return jsonify({"error": "FORBIDDEN", "message": "Email verification pending. Please verify your email before logging in.", "status": "EMAIL_VERIFICATION_PENDING"}), 403
            if user_status in ("PENDING", "PENDING_APPROVAL"):
                return jsonify({"error": "FORBIDDEN", "message": "Account registration is pending administrator approval.", "status": user_status}), 403
            if user_status != "ACTIVE":
                return jsonify({"error": "FORBIDDEN", "message": f"Account is {user_status}.", "status": user_status}), 403

            token_ver = user_row["token_version"] if "token_version" in user_row.keys() else 1
            user_email = user_row["email"] if ("email" in user_row.keys() and user_row["email"]) else user_row["username"]
            token = generate_token(user_row["id"], user_email, user_role, token_ver)

            log_event(conn, user_row["id"], user_role, "LOGIN", user_email, "SUCCESS", client_ip)
            append_audit_log(
                conn,
                actor_type=user_role,
                actor_id=user_row["id"],
                action="USER_LOGIN",
                resource=f"user:{user_row['id']}",
                result="SUCCESS",
                details={"portal": portal, "ip": client_ip},
            )

            res = make_response(
                jsonify(
                    {
                        "token": token,
                        "role": user_role,
                        "user_id": user_row["id"],
                        "email": user_email,
                        "username": user_email,
                        "name": user_row["name"] if "name" in user_row.keys() else "",
                        "status": user_status,
                    }
                )
            )
            res.set_cookie(
                "session_token",
                token,
                httponly=True,
                samesite="Strict",
                secure=False,
                max_age=86400,
            )
            return res
        finally:
            conn.close()

    @app.route("/api/auth/logout", methods=["POST"])
    def logout():
        """Logout: increments token_version to invalidate old tokens and clears cookie."""
        conn = get_db(app.config["DB_PATH"])
        try:
            user = get_current_user(conn)
            if user:
                cursor = conn.cursor()
                cursor.execute("UPDATE users SET token_version = token_version + 1 WHERE id = ?", (user["id"],))
                append_audit_log(
                    conn,
                    actor_type=user.get("role", "OWNER"),
                    actor_id=user["id"],
                    action="USER_LOGOUT",
                    resource=f"user:{user['id']}",
                    result="SUCCESS",
                )
                conn.commit()

            res = make_response(jsonify({"status": "LOGGED_OUT", "message": "Successfully logged out."}))
            res.delete_cookie("session_token")
            return res
        finally:
            conn.close()

    @app.route("/api/auth/me", methods=["GET"])
    def auth_me():
        conn = get_db(app.config["DB_PATH"])
        try:
            user = get_current_user(conn)
            if not user:
                return jsonify({"error": "UNAUTHORIZED", "message": "Valid token or active session required"}), 401
            return jsonify(
                {
                    "user_id": user["id"],
                    "email": user.get("email") or user.get("username"),
                    "username": user.get("username"),
                    "name": user.get("name", ""),
                    "role": user["role"],
                    "status": user.get("status", "ACTIVE"),
                    "created_at": user.get("created_at"),
                }
            )
        finally:
            conn.close()

    @app.route("/api/auth/change-password", methods=["POST"])
    @login_required
    def change_password():
        user = request.current_user
        data = request.get_json(silent=True) or {}
        current_pw = data.get("current_password", "")
        new_pw = data.get("new_password", "")

        conn = get_db(app.config["DB_PATH"])
        try:
            cursor = conn.cursor()
            user_row = cursor.execute("SELECT pw_hash, token_version FROM users WHERE id = ?", (user["id"],)).fetchone()
            if not user_row or not verify_password(current_pw, user_row["pw_hash"]):
                return jsonify({"error": "INVALID_CREDENTIALS", "message": "Current password incorrect."}), 400

            ok, err_msg = validate_password_strength(new_pw)
            if not ok:
                return jsonify({"error": "WEAK_PASSWORD", "message": err_msg}), 400

            new_hash = hash_password(new_pw)
            cursor.execute(
                "UPDATE users SET pw_hash = ?, token_version = token_version + 1 WHERE id = ?",
                (new_hash, user["id"]),
            )
            append_audit_log(
                conn,
                actor_type=user["role"],
                actor_id=user["id"],
                action="PASSWORD_CHANGE",
                resource=f"user:{user['id']}",
                result="SUCCESS",
            )
            conn.commit()
            return jsonify({"status": "SUCCESS", "message": "Password updated successfully. Prior sessions invalidated."})
        finally:
            conn.close()

    # -------------------------------------------------------------
    # Owner File & Version Management (Strict Ownership, Soft Delete, Receipts)
    # -------------------------------------------------------------

    compute_file_content_hash_from_bytes = compute_bytes_content_hash

    @app.route("/api/files", methods=["POST"])
    @app.route("/api/owner/files", methods=["POST"])
    @login_required
    def upload_file():
        user = request.current_user
        if user.get("role") == "ADMIN":
            return jsonify({"error": "FORBIDDEN", "message": "Administrators are prohibited from creating owner files."}), 403

        conn = get_db(app.config["DB_PATH"])
        try:
            actor_id = user["id"]
            actor_role = user["role"]

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

            file_bytes = file_obj.read()
            size_bytes = len(file_bytes)

            # Enforce MAX_UPLOAD_MB
            if size_bytes > app.config["MAX_CONTENT_LENGTH"]:
                return jsonify({"error": "PAYLOAD_TOO_LARGE", "message": f"File exceeds maximum size of {config.MAX_UPLOAD_MB} MB"}), 413

            computed_file_hash = compute_bytes_content_hash(file_bytes)

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

            # Merkle tree construction
            blocks = split_into_blocks(file_bytes, block_size=app.config["BLOCK_SIZE"])
            computed_merkle_root, layers = build_merkle_tree(blocks)

            # Verify declared Merkle root (Duplicate-Faking prevention)
            if declared_root and declared_root != computed_merkle_root:
                create_security_alert(
                    conn,
                    severity="critical",
                    kind="DUPLICATE_FAKING_SUSPECTED",
                    file_ref=clean_name,
                    message=f"Declared Merkle root {declared_root} does not match computed root {computed_merkle_root}.",
                )
                log_event(conn, actor_id, actor_role, "UPLOAD", clean_name, "DUPLICATE_FAKING_SUSPECTED")
                return jsonify({"error": "DUPLICATE_FAKING_SUSPECTED", "message": "Declared Merkle root mismatch"}), 400

            cursor = conn.cursor()

            # Check ledger-backed deduplication map
            existing_dedup = cursor.execute(
                "SELECT file_hash, blinded_owner, ledger_seq FROM ownership WHERE file_hash = ?",
                (computed_file_hash,),
            ).fetchone()

            if existing_dedup:
                if request.form.get("simulate_fake_pow") == "true":
                    create_security_alert(
                        conn,
                        severity="warning",
                        kind="PROOF_OF_OWNERSHIP_FAILED",
                        file_ref=clean_name,
                        message=f"Subsequent uploader provided invalid Proof-of-Ownership for hash {computed_file_hash}",
                    )
                    return jsonify({"error": "POW_FAILED", "message": "Sampled Proof-of-Ownership verification failed"}), 403

                ledger_entry = append_ledger_entry(
                    conn,
                    entry_type="DEDUP_REGISTER",
                    payload={
                        "file_hash": computed_file_hash,
                        "blinded_owner": client_blinded_owner,
                        "status": "DEDUPLICATED",
                    },
                )
                cursor.execute(
                    """
                    INSERT INTO ownership (file_hash, blinded_owner, ledger_seq)
                    VALUES (?, ?, ?)
                    """,
                    (computed_file_hash, client_blinded_owner, ledger_entry["seq"]),
                )
                conn.commit()
                log_event(conn, actor_id, actor_role, "UPLOAD", clean_name, "DEDUPLICATED")
                return jsonify({
                    "status": "DEDUPLICATED",
                    "file_hash": computed_file_hash,
                    "message": "Payload deduplicated. Reference added to ledger.",
                    "ledger_seq": ledger_entry["seq"],
                }), 200

            # Store on disk under UUID names
            file_id = str(uuid.uuid4())
            current_file_path = Path(app.config["CURRENT_STORAGE_DIR"]) / file_id
            v1_blob_path = Path(app.config["VERSIONS_STORAGE_DIR"]) / f"{file_id}_v1"

            with open(current_file_path, "wb") as f:
                f.write(file_bytes)
            with open(v1_blob_path, "wb") as f:
                f.write(file_bytes)

            # Generate block tags
            block_tags = compute_all_block_tags(app.config["K_TAG"], file_id, 1, blocks)
            tag_root = compute_tag_root(block_tags)

            # Compute HMAC chain V1
            now_iso = datetime.now(timezone.utc).isoformat()
            genesis_hc = compute_genesis_chain_hash(app.config["CHAIN_SECRET"], file_id)
            v1_chain_hash = compute_version_chain_hash(
                secret=app.config["CHAIN_SECRET"],
                file_id=file_id,
                version=1,
                content_hash=computed_file_hash,
                prev_chain_hash=genesis_hc,
                created_at_utc_iso=now_iso,
                merkle_root=computed_merkle_root,
            )

            cursor.execute(
                """
                INSERT INTO files (id, display_name, created_at, current_version, stored_path, is_deleted, owner_id, quarantined, is_demo)
                VALUES (?, ?, ?, 1, ?, 0, ?, 0, 0)
                """,
                (file_id, clean_name, now_iso, str(current_file_path), actor_id),
            )

            cursor.execute(
                """
                INSERT INTO versions (
                    file_id, version, content_hash, prev_chain_hash, chain_hash,
                    size_bytes, created_at, activity, blob_path, merkle_root, tag_root
                )
                VALUES (?, 1, ?, ?, ?, ?, ?, 'UPLOAD', ?, ?, ?)
                """,
                (file_id, computed_file_hash, genesis_hc, v1_chain_hash, size_bytes, now_iso, str(v1_blob_path), computed_merkle_root, tag_root),
            )

            cursor.execute(
                "INSERT INTO blocks_meta (file_id, version, block_size, block_count) VALUES (?, 1, ?, ?)",
                (file_id, app.config["BLOCK_SIZE"], len(blocks)),
            )
            for b_idx, t_val in enumerate(block_tags):
                cursor.execute(
                    "INSERT INTO block_tags (file_id, version, idx, tag) VALUES (?, 1, ?, ?)",
                    (file_id, b_idx, t_val),
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
            cursor.execute(
                """
                INSERT OR REPLACE INTO ownership (file_hash, blinded_owner, ledger_seq)
                VALUES (?, ?, ?)
                """,
                (computed_file_hash, client_blinded_owner, ledger_entry["seq"]),
            )

            receipt_payload = {
                "file_id": file_id,
                "version": 1,
                "chain_hash": v1_chain_hash,
                "content_hash": computed_file_hash,
                "merkle_root": computed_merkle_root,
                "tag_root": tag_root,
                "created_at": now_iso,
                "notice": "This downloaded receipt is your cryptographic anchor against server rollback attacks. Keep it safe.",
            }

            # Store receipt in append-only receipts table (Defect 6)
            cursor.execute(
                """
                INSERT INTO receipts (file_id, version, owner_id, chain_hash, merkle_root, receipt_json, created_at)
                VALUES (?, 1, ?, ?, ?, ?, ?)
                """,
                (file_id, actor_id, v1_chain_hash, computed_merkle_root, json.dumps(receipt_payload), now_iso),
            )

            append_audit_log(
                conn,
                actor_type="OWNER",
                actor_id=actor_id,
                action="UPLOAD_INITIAL_FILE",
                resource=f"file:{file_id}",
                result="SUCCESS",
                details={"version": 1, "chain_hash": v1_chain_hash, "display_name": clean_name},
            )
            log_event(conn, actor_id, actor_role, "UPLOAD", file_id, "SUCCESS")
            conn.commit()

            return jsonify(
                {
                    "status": "RECORDED_VERSION",
                    "file_id": file_id,
                    "display_name": clean_name,
                    "version": 1,
                    "content_hash": computed_file_hash,
                    "chain_hash": v1_chain_hash,
                    "merkle_root": computed_merkle_root,
                    "tag_root": tag_root,
                    "block_count": len(blocks),
                    "receipt": receipt_payload,
                }
            ), 201
        finally:
            conn.close()

    @app.route("/api/files", methods=["GET"])
    @app.route("/api/owner/files", methods=["GET"])
    @login_required
    def list_files():
        """Lists files owned by the authenticated owner where quarantined = 0 and is_deleted = 0."""
        user = request.current_user
        conn = get_db(app.config["DB_PATH"])
        try:
            cursor = conn.cursor()
            is_auditor = user.get("role") in ("TPA", "AUDITOR_SERVICE")
            if is_auditor:
                file_rows = cursor.execute(
                    """
                    SELECT f.*, v.content_hash, v.chain_hash, v.size_bytes, v.created_at AS v_created_at
                    FROM files f
                    LEFT JOIN versions v ON f.id = v.file_id AND f.current_version = v.version
                    WHERE f.is_deleted = 0 AND f.quarantined = 0
                    ORDER BY f.created_at DESC
                    """
                ).fetchall()
            else:
                # Strict owner isolation
                file_rows = cursor.execute(
                    """
                    SELECT f.*, v.content_hash, v.chain_hash, v.size_bytes, v.created_at AS v_created_at
                    FROM files f
                    LEFT JOIN versions v ON f.id = v.file_id AND f.current_version = v.version
                    WHERE f.owner_id = ? AND f.is_deleted = 0 AND f.quarantined = 0
                    ORDER BY f.created_at DESC
                    """,
                    (user["id"],),
                ).fetchall()

            res = []
            for r in file_rows:
                fid = r["id"]
                last_audit = cursor.execute(
                    "SELECT status, created_at FROM audits WHERE file_id = ? ORDER BY id DESC LIMIT 1",
                    (fid,),
                ).fetchone()

                delegation = cursor.execute(
                    "SELECT id, interval_minutes, sample_size, status FROM delegations WHERE file_id = ? AND status = 'ACTIVE'",
                    (fid,),
                ).fetchone()

                display_name = f"BLINDED_{fid[:8]}" if is_auditor else r["display_name"]
                res.append(
                    {
                        "id": fid,
                        "display_name": display_name,
                        "created_at": r["created_at"],
                        "current_version": r["current_version"],
                        "size_bytes": r["size_bytes"] or 0,
                        "content_hash": r["content_hash"] or "",
                        "chain_hash": r["chain_hash"] or "",
                        "last_audit_status": last_audit["status"] if last_audit else "UNAUDITED",
                        "last_audit_time": last_audit["created_at"] if last_audit else None,
                        "automated_audit": bool(delegation),
                        "delegation": dict(delegation) if delegation else None,
                    }
                )
            return jsonify(res)
        finally:
            conn.close()

    @app.route("/api/files/<file_id>", methods=["GET"])
    @app.route("/api/owner/files/<file_id>", methods=["GET"])
    @login_required
    def get_file(file_id):
        user = request.current_user
        conn = get_db(app.config["DB_PATH"])
        try:
            cursor = conn.cursor()
            row = cursor.execute("SELECT * FROM files WHERE id = ?", (file_id,)).fetchone()
            # IDOR protection: return 404 for unowned or quarantined files
            if not row or row["owner_id"] != user["id"] or row["quarantined"] == 1 or row["is_deleted"] == 1:
                if row and row["owner_id"] != user["id"]:
                    record_idor_probe(conn, user["id"], file_id, request.remote_addr or "127.0.0.1")
                return jsonify({"error": "NOT_FOUND", "message": f"File with ID {file_id} not found"}), 404

            v_row = cursor.execute(
                "SELECT * FROM versions WHERE file_id = ? AND version = ?",
                (file_id, row["current_version"]),
            ).fetchone()

            return jsonify(
                {
                    "id": row["id"],
                    "display_name": row["display_name"],
                    "created_at": row["created_at"],
                    "current_version": row["current_version"],
                    "size_bytes": v_row["size_bytes"] if v_row else 0,
                    "content_hash": v_row["content_hash"] if v_row else "",
                    "chain_hash": v_row["chain_hash"] if v_row else "",
                }
            )
        finally:
            conn.close()

    @app.route("/api/files/<file_id>/versions", methods=["GET"])
    @app.route("/api/owner/files/<file_id>/versions", methods=["GET"])
    @login_required
    def get_versions(file_id):
        user = request.current_user
        conn = get_db(app.config["DB_PATH"])
        try:
            cursor = conn.cursor()
            file_row = cursor.execute("SELECT * FROM files WHERE id = ?", (file_id,)).fetchone()
            if not file_row or file_row["owner_id"] != user["id"] or file_row["quarantined"] == 1:
                if file_row and file_row["owner_id"] != user["id"]:
                    record_idor_probe(conn, user["id"], file_id, request.remote_addr or "127.0.0.1")
                return jsonify({"error": "NOT_FOUND", "message": f"File with ID {file_id} not found"}), 404

            rows = cursor.execute("SELECT * FROM versions WHERE file_id = ? ORDER BY version ASC", (file_id,)).fetchall()
            version_list = [
                {
                    "id": r["id"],
                    "file_id": r["file_id"],
                    "version": r["version"],
                    "content_hash": r["content_hash"],
                    "prev_chain_hash": r["prev_chain_hash"],
                    "chain_hash": r["chain_hash"],
                    "size_bytes": r["size_bytes"],
                    "created_at": r["created_at"],
                    "activity": r["activity"],
                    "merkle_root": r["merkle_root"],
                }
                for r in rows
            ]
            return jsonify({
                "file_id": file_id,
                "display_name": file_row["display_name"],
                "current_version": file_row["current_version"],
                "versions": version_list,
            })
        finally:
            conn.close()

    @app.route("/api/files/<file_id>/download", methods=["GET"])
    @app.route("/api/owner/files/<file_id>/download", methods=["GET"])
    @login_required
    def download_file(file_id):
        user = request.current_user
        # Auditors and Administrators can NEVER download owner files (Section 5)
        if user.get("role") in ("ADMIN", "TPA", "AUDITOR_SERVICE"):
            return jsonify({"error": "FORBIDDEN", "message": "Auditors and Administrators are prohibited from downloading user files."}), 403

        conn = get_db(app.config["DB_PATH"])
        try:
            cursor = conn.cursor()
            row = cursor.execute("SELECT * FROM files WHERE id = ?", (file_id,)).fetchone()
            if not row or row["owner_id"] != user["id"] or row["quarantined"] == 1 or row["is_deleted"] == 1:
                if row and row["owner_id"] != user["id"]:
                    record_idor_probe(conn, user["id"], file_id, request.remote_addr or "127.0.0.1")
                return jsonify({"error": "NOT_FOUND", "message": f"File with ID {file_id} not found"}), 404

            p = Path(row["stored_path"])
            if not p.is_file():
                return jsonify({"error": "NOT_FOUND", "message": "Storage payload missing"}), 404

            return send_file(p, as_attachment=True, download_name=secure_filename(row["display_name"]))
        finally:
            conn.close()

    @app.route("/api/files/<file_id>/versions", methods=["POST"])
    @app.route("/api/owner/files/<file_id>/versions", methods=["POST"])
    @login_required
    def update_file_version(file_id):
        user = request.current_user
        if user.get("role") == "ADMIN":
            return jsonify({"error": "FORBIDDEN", "message": "Administrators cannot modify owner files."}), 403

        conn = get_db(app.config["DB_PATH"])
        try:
            cursor = conn.cursor()
            file_row = cursor.execute("SELECT * FROM files WHERE id = ?", (file_id,)).fetchone()
            if not file_row or file_row["owner_id"] != user["id"] or file_row["quarantined"] == 1 or file_row["is_deleted"] == 1:
                return jsonify({"error": "NOT_FOUND", "message": f"File with ID {file_id} not found"}), 404

            if "file" not in request.files:
                return jsonify({"error": "NO_FILE", "message": "No file field in multipart request"}), 400

            file_obj = request.files["file"]
            file_bytes = file_obj.read()
            size_bytes = len(file_bytes)

            if size_bytes > app.config["MAX_CONTENT_LENGTH"]:
                return jsonify({"error": "PAYLOAD_TOO_LARGE", "message": f"File exceeds maximum size of {config.MAX_UPLOAD_MB} MB"}), 413

            curr_v = file_row["current_version"]
            new_v = curr_v + 1
            now_iso = datetime.now(timezone.utc).isoformat()

            # Load previous chain hash
            last_v = cursor.execute("SELECT chain_hash FROM versions WHERE file_id = ? AND version = ?", (file_id, curr_v)).fetchone()
            prev_hc = last_v["chain_hash"] if last_v else compute_genesis_chain_hash(app.config["CHAIN_SECRET"], file_id)

            c_hash = compute_file_content_hash_from_bytes(file_bytes)
            blocks = split_into_blocks(file_bytes, block_size=app.config["BLOCK_SIZE"])
            merkle_root, _ = build_merkle_tree(blocks)
            block_tags = compute_all_block_tags(app.config["K_TAG"], file_id, new_v, blocks)
            tag_root = compute_tag_root(block_tags)

            v_chain_hash = compute_version_chain_hash(
                secret=app.config["CHAIN_SECRET"],
                file_id=file_id,
                version=new_v,
                content_hash=c_hash,
                prev_chain_hash=prev_hc,
                created_at_utc_iso=now_iso,
                merkle_root=merkle_root,
            )

            # Store payload
            current_file_path = Path(app.config["CURRENT_STORAGE_DIR"]) / file_id
            v_blob_path = Path(app.config["VERSIONS_STORAGE_DIR"]) / f"{file_id}_v{new_v}"

            with open(current_file_path, "wb") as f:
                f.write(file_bytes)
            with open(v_blob_path, "wb") as f:
                f.write(file_bytes)

            cursor.execute(
                """
                INSERT INTO versions (
                    file_id, version, content_hash, prev_chain_hash, chain_hash,
                    size_bytes, created_at, activity, blob_path, merkle_root, tag_root
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, 'AUTHORIZED_UPDATE', ?, ?, ?)
                """,
                (file_id, new_v, c_hash, prev_hc, v_chain_hash, size_bytes, now_iso, str(v_blob_path), merkle_root, tag_root),
            )
            cursor.execute("UPDATE files SET current_version = ? WHERE id = ?", (new_v, file_id))

            cursor.execute("INSERT OR REPLACE INTO blocks_meta (file_id, version, block_size, block_count) VALUES (?, ?, ?, ?)", (file_id, new_v, app.config["BLOCK_SIZE"], len(blocks)))
            for b_idx, t_val in enumerate(block_tags):
                cursor.execute("INSERT OR REPLACE INTO block_tags (file_id, version, idx, tag) VALUES (?, ?, ?, ?)", (file_id, new_v, b_idx, t_val))

            receipt_payload = {
                "file_id": file_id,
                "version": new_v,
                "chain_hash": v_chain_hash,
                "content_hash": c_hash,
                "merkle_root": merkle_root,
                "tag_root": tag_root,
                "created_at": now_iso,
                "notice": "This downloaded receipt is your cryptographic anchor against server rollback attacks. Keep it safe.",
            }

            cursor.execute(
                """
                INSERT INTO receipts (file_id, version, owner_id, chain_hash, merkle_root, receipt_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (file_id, new_v, user["id"], v_chain_hash, merkle_root, json.dumps(receipt_payload), now_iso),
            )

            append_audit_log(
                conn,
                actor_type="OWNER",
                actor_id=user["id"],
                action="UPDATE_FILE_VERSION",
                resource=f"file:{file_id}",
                result="SUCCESS",
                details={"version": new_v, "chain_hash": v_chain_hash},
            )
            conn.commit()

            return jsonify({
                "status": "RECORDED_VERSION",
                "file_id": file_id,
                "version": new_v,
                "content_hash": c_hash,
                "chain_hash": v_chain_hash,
                "receipt": receipt_payload,
            }), 201
        finally:
            conn.close()

    @app.route("/api/files/<file_id>/blocks", methods=["POST"])
    @login_required
    def dynamic_block_operation(file_id: str):
        data = request.get_json(silent=True) or {}
        op = data.get("op", "").lower()  # modify, insert, append, delete
        idx = int(data.get("index", 0))
        new_block_data = data.get("data", "").encode("utf-8")

        conn = get_db(app.config["DB_PATH"])
        try:
            user = request.current_user
            if user.get("role") == "ADMIN":
                return jsonify({"error": "FORBIDDEN", "message": "Admin cannot edit user files."}), 403

            cursor = conn.cursor()
            file_row = cursor.execute("SELECT * FROM files WHERE id = ? AND is_deleted = 0", (file_id,)).fetchone()
            if not file_row or file_row["owner_id"] != user["id"]:
                return jsonify({"error": "FILE_NOT_FOUND", "message": f"File {file_id} not found"}), 404

            current_ver = file_row["current_version"]
            prev_version_row = cursor.execute(
                "SELECT * FROM versions WHERE file_id = ? AND version = ?",
                (file_id, current_ver),
            ).fetchone()
            if not prev_version_row:
                return jsonify({"error": "VERSION_NOT_FOUND", "message": "Previous version not found"}), 404

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
            new_content_hash = compute_bytes_content_hash(new_file_bytes)

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

            # Store receipt in append-only receipts table
            cursor.execute(
                """
                INSERT INTO receipts (file_id, version, owner_id, chain_hash, merkle_root, receipt_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (file_id, new_version, user["id"], chain_hash, merkle_root, json.dumps(receipt), created_at_iso),
            )

            conn.commit()
            log_event(conn, user["id"], user["role"], f"DYNAMIC_{op.upper()}", file_id, "SUCCESS")

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
                    "receipt": receipt,
                }
            )
        finally:
            conn.close()

    @app.route("/api/files/<file_id>", methods=["DELETE"])
    @app.route("/api/owner/files/<file_id>", methods=["DELETE"])
    @login_required
    def delete_file(file_id):
        """Soft-deletes a file, recording a DELETE version activity in HMAC chain."""
        user = request.current_user
        if user.get("role") == "ADMIN":
            return jsonify({"error": "FORBIDDEN", "message": "Administrators cannot delete owner files."}), 403

        conn = get_db(app.config["DB_PATH"])
        try:
            cursor = conn.cursor()
            file_row = cursor.execute("SELECT * FROM files WHERE id = ?", (file_id,)).fetchone()
            if not file_row or file_row["owner_id"] != user["id"] or file_row["is_deleted"] == 1:
                return jsonify({"error": "NOT_FOUND", "message": f"File with ID {file_id} not found"}), 404

            curr_v = file_row["current_version"]
            new_v = curr_v + 1
            now_iso = datetime.now(timezone.utc).isoformat()

            last_v = cursor.execute("SELECT chain_hash FROM versions WHERE file_id = ? AND version = ?", (file_id, curr_v)).fetchone()
            prev_hc = last_v["chain_hash"] if last_v else compute_genesis_chain_hash(app.config["CHAIN_SECRET"], file_id)

            del_content_hash = compute_bytes_content_hash(b"")
            del_chain_hash = compute_version_chain_hash(
                secret=app.config["CHAIN_SECRET"],
                file_id=file_id,
                version=new_v,
                content_hash=del_content_hash,
                prev_chain_hash=prev_hc,
                created_at_utc_iso=now_iso,
            )

            cursor.execute(
                """
                INSERT INTO versions (file_id, version, content_hash, prev_chain_hash, chain_hash, size_bytes, created_at, activity, blob_path)
                VALUES (?, ?, ?, ?, ?, 0, ?, 'DELETE', '')
                """,
                (file_id, new_v, del_content_hash, prev_hc, del_chain_hash, now_iso),
            )
            cursor.execute("UPDATE files SET is_deleted = 1, deleted_at = ?, current_version = ? WHERE id = ?", (now_iso, new_v, file_id))
            cursor.execute("UPDATE delegations SET status = 'REVOKED', revoked_at = ? WHERE file_id = ?", (now_iso, file_id))

            append_audit_log(
                conn,
                actor_type="OWNER",
                actor_id=user["id"],
                action="SOFT_DELETE_FILE",
                resource=f"file:{file_id}",
                result="SUCCESS",
                details={"version": new_v, "chain_hash": del_chain_hash},
            )
            conn.commit()

            return jsonify({
                "status": "DELETED",
                "message": f"File {file_row['display_name']} marked as soft-deleted and chained to V{new_v}",
                "version": new_v,
                "chain_hash": del_chain_hash,
            })
        finally:
            conn.close()

    @app.route("/api/files/<file_id>/audit", methods=["POST"])
    @app.route("/api/owner/files/<file_id>/audit", methods=["POST"])
    @login_required
    def trigger_audit(file_id):
        user = request.current_user
        conn = get_db(app.config["DB_PATH"])
        try:
            cursor = conn.cursor()
            file_row = cursor.execute("SELECT * FROM files WHERE id = ?", (file_id,)).fetchone()
            if not file_row or file_row["owner_id"] != user["id"] or file_row["quarantined"] == 1:
                return jsonify({"error": "NOT_FOUND", "message": f"File with ID {file_id} not found"}), 404

            data = request.get_json(silent=True) or {}
            receipt = data.get("receipt")

            result = execute_audit(
                file_id=file_id,
                receipt=receipt,
                db_path=app.config["DB_PATH"],
                secret=app.config["CHAIN_SECRET"],
                current_storage_dir=app.config["CURRENT_STORAGE_DIR"],
                actor_type="OWNER",
                actor_id=user["id"],
                trigger="MANUAL",
            )
            return jsonify(result), 200
        finally:
            conn.close()

    @app.route("/api/files/<file_id>/verify-chain", methods=["POST"])
    @app.route("/api/owner/files/<file_id>/verify-chain", methods=["POST"])
    @login_required
    def trigger_verify_chain(file_id):
        user = request.current_user
        conn = get_db(app.config["DB_PATH"])
        try:
            cursor = conn.cursor()
            file_row = cursor.execute("SELECT * FROM files WHERE id = ?", (file_id,)).fetchone()
            if not file_row or file_row["owner_id"] != user["id"] or file_row["quarantined"] == 1:
                return jsonify({"error": "NOT_FOUND", "message": f"File with ID {file_id} not found"}), 404

            data = request.get_json(silent=True) or {}
            receipt = data.get("receipt")
            result = execute_verify_chain(
                file_id=file_id,
                receipt=receipt,
                db_path=app.config["DB_PATH"],
                secret=app.config["CHAIN_SECRET"],
            )
            return jsonify(result)
        finally:
            conn.close()

    @app.route("/api/owner/files/<file_id>/receipt", methods=["GET"])
    @app.route("/api/files/<file_id>/receipt", methods=["GET"])
    @login_required
    def get_file_receipt(file_id):
        user = request.current_user
        conn = get_db(app.config["DB_PATH"])
        try:
            cursor = conn.cursor()
            file_row = cursor.execute("SELECT * FROM files WHERE id = ?", (file_id,)).fetchone()
            if not file_row or file_row["owner_id"] != user["id"] or file_row["quarantined"] == 1:
                return jsonify({"error": "NOT_FOUND", "message": "File not found"}), 404

            r_row = cursor.execute("SELECT * FROM receipts WHERE file_id = ? ORDER BY version DESC LIMIT 1", (file_id,)).fetchone()
            if r_row:
                receipt = json.loads(r_row["receipt_json"])
            else:
                v_row = cursor.execute("SELECT * FROM versions WHERE file_id = ? ORDER BY version DESC LIMIT 1", (file_id,)).fetchone()
                receipt = {
                    "file_id": file_id,
                    "version": v_row["version"],
                    "chain_hash": v_row["chain_hash"],
                    "content_hash": v_row["content_hash"],
                    "merkle_root": v_row["merkle_root"],
                    "created_at": v_row["created_at"],
                }
            receipt["notice"] = "This downloaded receipt is your cryptographic anchor against server rollback attacks. Keep it safe."
            return jsonify(receipt)
        finally:
            conn.close()

    @app.route("/api/files/<file_id>/delegate", methods=["POST"])
    @app.route("/api/owner/files/<file_id>/delegate", methods=["POST"])
    @login_required
    def create_delegation(file_id):
        """Enables automated auditing delegation to the Automated Auditor Service."""
        user = request.current_user
        data = request.get_json(silent=True) or {}
        interval = int(data.get("interval_minutes", 60))
        sample_size = int(data.get("sample_size", 10))

        conn = get_db(app.config["DB_PATH"])
        try:
            cursor = conn.cursor()
            file_row = cursor.execute("SELECT * FROM files WHERE id = ?", (file_id,)).fetchone()
            if not file_row or file_row["owner_id"] != user["id"] or file_row["quarantined"] == 1 or file_row["is_deleted"] == 1:
                return jsonify({"error": "NOT_FOUND", "message": "File not found"}), 404

            r_row = cursor.execute("SELECT * FROM receipts WHERE file_id = ? ORDER BY version DESC LIMIT 1", (file_id,)).fetchone()
            receipt_json = r_row["receipt_json"] if r_row else json.dumps({"file_id": file_id, "version": file_row["current_version"]})

            del_id = str(uuid.uuid4())
            now_iso = datetime.now(timezone.utc).isoformat()

            cursor.execute("UPDATE delegations SET status = 'REVOKED', revoked_at = ? WHERE file_id = ?", (now_iso, file_id))
            cursor.execute(
                """
                INSERT INTO delegations (id, file_id, owner_id, interval_minutes, sample_size, receipt_json, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?)
                """,
                (del_id, file_id, user["id"], interval, sample_size, receipt_json, now_iso),
            )
            append_audit_log(
                conn,
                actor_type="OWNER",
                actor_id=user["id"],
                action="ENABLE_AUTOMATED_AUDIT_DELEGATION",
                resource=f"file:{file_id}",
                result="SUCCESS",
                details={"delegation_id": del_id, "interval_minutes": interval, "sample_size": sample_size},
            )
            conn.commit()

            return jsonify({
                "status": "DELEGATED",
                "delegation_id": del_id,
                "interval_minutes": interval,
                "sample_size": sample_size,
                "message": "Automated audit delegation successfully activated for this file.",
            }), 200
        finally:
            conn.close()

    @app.route("/api/files/<file_id>/delegate", methods=["DELETE"])
    @app.route("/api/files/<file_id>/revoke-delegation", methods=["POST"])
    @app.route("/api/owner/files/<file_id>/delegate", methods=["DELETE"])
    @login_required
    def revoke_delegation(file_id):
        user = request.current_user
        conn = get_db(app.config["DB_PATH"])
        try:
            cursor = conn.cursor()
            now_iso = datetime.now(timezone.utc).isoformat()
            cursor.execute(
                "UPDATE delegations SET status = 'REVOKED', revoked_at = ? WHERE file_id = ? AND owner_id = ? AND status = 'ACTIVE'",
                (now_iso, file_id, user["id"]),
            )
            append_audit_log(
                conn,
                actor_type="OWNER",
                actor_id=user["id"],
                action="REVOKE_AUTOMATED_AUDIT_DELEGATION",
                resource=f"file:{file_id}",
                result="REVOKED",
            )
            conn.commit()
            return jsonify({"status": "DELEGATION_REVOKED", "message": "Automated audit delegation revoked."})
        finally:
            conn.close()

    @app.route("/api/owner/audit-history", methods=["GET"])
    @login_required
    def owner_audit_history():
        user = request.current_user
        conn = get_db(app.config["DB_PATH"])
        try:
            cursor = conn.cursor()
            rows = cursor.execute(
                """
                SELECT a.*, f.display_name
                FROM audits a
                JOIN files f ON a.file_id = f.id
                WHERE f.owner_id = ?
                ORDER BY a.created_at DESC LIMIT 100
                """,
                (user["id"],),
            ).fetchall()
            return jsonify([dict(r) for r in rows])
        finally:
            conn.close()

    @app.route("/api/owner/auditor-activity", methods=["GET"])
    @login_required
    def owner_auditor_activity():
        user = request.current_user
        conn = get_db(app.config["DB_PATH"])
        try:
            cursor = conn.cursor()
            rows = cursor.execute(
                """
                SELECT a.*, f.display_name
                FROM audits a
                JOIN files f ON a.file_id = f.id
                WHERE f.owner_id = ? AND a.actor_type = 'AUDITOR_SERVICE'
                ORDER BY a.created_at DESC LIMIT 50
                """,
                (user["id"],),
            ).fetchall()
            return jsonify([dict(r) for r in rows])
        finally:
            conn.close()

    # -------------------------------------------------------------
    # Admin Portal Endpoints (Break-Glass Human Admin Only)
    # -------------------------------------------------------------

    @app.route("/api/admin/overview", methods=["GET"])
    @admin_required
    def admin_overview():
        conn = get_db(app.config["DB_PATH"])
        try:
            cursor = conn.cursor()
            total_users = cursor.execute("SELECT COUNT(*) FROM users").fetchone()[0]
            pending_users = cursor.execute("SELECT COUNT(*) FROM users WHERE status IN ('PENDING', 'PENDING_APPROVAL', 'EMAIL_VERIFICATION_PENDING')").fetchone()[0]
            approved_users = cursor.execute("SELECT COUNT(*) FROM users WHERE status = 'ACTIVE'").fetchone()[0]
            rejected_users = cursor.execute("SELECT COUNT(*) FROM users WHERE status = 'REJECTED'").fetchone()[0]
            suspended_users = cursor.execute("SELECT COUNT(*) FROM users WHERE status = 'SUSPENDED'").fetchone()[0]
            active_files = cursor.execute("SELECT COUNT(*) FROM files WHERE is_deleted = 0 AND quarantined = 0").fetchone()[0]
            quarantined = cursor.execute("SELECT COUNT(*) FROM files WHERE quarantined = 1").fetchone()[0]
            total_audits = cursor.execute("SELECT COUNT(*) FROM audits").fetchone()[0]
            open_alerts = cursor.execute("SELECT COUNT(*) FROM alerts WHERE acknowledged = 0").fetchone()[0]
            active_delegations = cursor.execute("SELECT COUNT(*) FROM delegations WHERE status = 'ACTIVE'").fetchone()[0]

            return jsonify({
                "total_users": total_users,
                "users_count": total_users,
                "pending_users": pending_users,
                "approved_users": approved_users,
                "rejected_users": rejected_users,
                "suspended_users": suspended_users,
                "active_files": active_files,
                "quarantined_files": quarantined,
                "total_audits": total_audits,
                "open_alerts": open_alerts,
                "active_delegations": active_delegations,
                "auditor_status": "ONLINE",
                "scheduler_status": "RUNNING" if scheduler and scheduler.is_alive() else "STOPPED",
                "system_status": "SECURE",
            })
        finally:
            conn.close()

    @app.route("/api/admin/users", methods=["GET"])
    @admin_required
    def admin_list_users():
        conn = get_db(app.config["DB_PATH"])
        try:
            cursor = conn.cursor()
            rows = cursor.execute(
                """
                SELECT id, name, email, username, role, status, email_verified,
                       created_at, approved_by, approved_at, rejection_reason, verification_results
                FROM users
                ORDER BY created_at DESC
                """
            ).fetchall()
            return jsonify([dict(r) for r in rows])
        finally:
            conn.close()

    @app.route("/api/admin/users/<user_id>/<action>", methods=["POST"])
    @admin_required
    def admin_user_action(user_id, action):
        action = action.lower()
        if action not in ("approve", "reject", "suspend", "reactivate"):
            return jsonify({"error": "INVALID_ACTION", "message": f"Action '{action}' is not supported."}), 400

        data = request.get_json(silent=True) or {}
        reason = (data.get("reason") or "").strip()

        # Enforce mandatory reason for rejection
        if action == "reject" and not reason:
            return jsonify({"error": "REASON_REQUIRED", "message": "A rejection reason is mandatory."}), 400

        admin_user = request.current_user
        conn = get_db(app.config["DB_PATH"])
        try:
            cursor = conn.cursor()
            target = cursor.execute("SELECT id, role, email FROM users WHERE id = ?", (user_id,)).fetchone()
            if not target:
                return jsonify({"error": "NOT_FOUND", "message": "User not found."}), 404

            # Hard Rule 1: The automation never grants roles, and admin cannot change an admin
            if target["role"] == "ADMIN":
                return jsonify({"error": "FORBIDDEN", "message": "Administrator account cannot be modified through this endpoint."}), 403

            now_iso = datetime.now(timezone.utc).isoformat()
            new_status = {
                "approve": "ACTIVE",
                "reject": "REJECTED",
                "suspend": "SUSPENDED",
                "reactivate": "ACTIVE",
            }[action]

            if action == "reject":
                cursor.execute(
                    "UPDATE users SET status = ?, approved_by = ?, approved_at = ?, rejection_reason = ?, token_version = token_version + 1 WHERE id = ?",
                    (new_status, admin_user["id"], now_iso, reason, user_id),
                )
            else:
                cursor.execute(
                    "UPDATE users SET status = ?, approved_by = ?, approved_at = ?, token_version = token_version + 1 WHERE id = ?",
                    (new_status, admin_user["id"], now_iso, user_id),
                )

            details_payload = {"target_email": target["email"]}
            if reason:
                details_payload["reason"] = reason

            append_audit_log(
                conn,
                actor_type="ADMIN",
                actor_id=admin_user["id"],
                action=f"ADMIN_{action.upper()}_USER",
                resource=f"user:{user_id}",
                result=new_status,
                details=details_payload,
            )
            log_event(
                conn,
                actor_id=admin_user["id"],
                role="ADMIN",
                action=f"USER_{action.upper()}",
                target=target["email"],
                result="SUCCESS",
                ip=request.remote_addr or "127.0.0.1",
            )
            conn.commit()

            return jsonify({
                "status": "SUCCESS",
                "user_id": user_id,
                "new_status": new_status,
                "action": action,
                "reason": reason if reason else None,
            })
        finally:
            conn.close()

    @app.route("/api/admin/alerts", methods=["GET"])
    @admin_required
    def admin_alerts():
        conn = get_db(app.config["DB_PATH"])
        try:
            cursor = conn.cursor()
            rows = cursor.execute("SELECT * FROM alerts ORDER BY created_at DESC LIMIT 100").fetchall()
            return jsonify([dict(r) for r in rows])
        finally:
            conn.close()

    @app.route("/api/admin/alerts/<int:alert_id>/ack", methods=["POST"])
    @admin_required
    def admin_ack_alert(alert_id):
        conn = get_db(app.config["DB_PATH"])
        try:
            cursor = conn.cursor()
            cursor.execute("UPDATE alerts SET acknowledged = 1 WHERE id = ?", (alert_id,))
            append_audit_log(
                conn,
                actor_type="ADMIN",
                actor_id=request.current_user["id"],
                action="ACK_SECURITY_ALERT",
                resource=f"alert:{alert_id}",
                result="ACKNOWLEDGED",
            )
            conn.commit()
            return jsonify({"status": "ACKNOWLEDGED", "alert_id": alert_id})
        finally:
            conn.close()

    @app.route("/api/admin/security-events", methods=["GET"])
    @admin_required
    def admin_security_events():
        conn = get_db(app.config["DB_PATH"])
        try:
            cursor = conn.cursor()
            rows = cursor.execute("SELECT * FROM events ORDER BY created_at DESC LIMIT 100").fetchall()
            return jsonify([dict(r) for r in rows])
        finally:
            conn.close()

    @app.route("/api/admin/audit-monitoring", methods=["GET"])
    @admin_required
    def admin_audit_monitoring():
        conn = get_db(app.config["DB_PATH"])
        try:
            cursor = conn.cursor()
            audits = cursor.execute("SELECT * FROM audits ORDER BY created_at DESC LIMIT 100").fetchall()
            delegations = cursor.execute("SELECT * FROM delegations ORDER BY created_at DESC").fetchall()
            jobs = cursor.execute("SELECT * FROM audit_jobs ORDER BY created_at DESC LIMIT 50").fetchall()
            return jsonify({
                "audits": [dict(a) for a in audits],
                "delegations": [dict(d) for d in delegations],
                "jobs": [dict(j) for j in jobs],
            })
        finally:
            conn.close()

    @app.route("/api/admin/failed-verifications", methods=["GET"])
    @admin_required
    def admin_failed_verifications():
        conn = get_db(app.config["DB_PATH"])
        try:
            cursor = conn.cursor()
            rows = cursor.execute(
                """
                SELECT * FROM events
                WHERE result = 'FAILED' OR action LIKE '%FAIL%' OR action LIKE '%REJECT%' OR action LIKE '%SUSPEND%'
                ORDER BY created_at DESC LIMIT 100
                """
            ).fetchall()
            return jsonify([dict(r) for r in rows])
        finally:
            conn.close()

    @app.route("/api/admin/scheduler", methods=["GET"])
    @admin_required
    def admin_scheduler():
        conn = get_db(app.config["DB_PATH"])
        try:
            cursor = conn.cursor()
            scheds = cursor.execute("SELECT * FROM schedules ORDER BY id ASC").fetchall()
            pending_jobs = cursor.execute("SELECT COUNT(*) FROM audit_jobs WHERE status = 'PENDING'").fetchone()[0]
            running_jobs = cursor.execute("SELECT COUNT(*) FROM audit_jobs WHERE status = 'RUNNING'").fetchone()[0]
            return jsonify({
                "status": "RUNNING" if scheduler and scheduler.is_alive() else "STOPPED",
                "interval_seconds": scheduler.interval_seconds if scheduler else 60,
                "schedules": [dict(s) for s in scheds],
                "pending_jobs": pending_jobs,
                "running_jobs": running_jobs,
            })
        finally:
            conn.close()

    @app.route("/api/admin/scheduler/trigger", methods=["POST"])
    @admin_required
    def admin_scheduler_trigger():
        if scheduler and scheduler.is_alive():
            scheduler.trigger_now()
            return jsonify({"status": "SUCCESS", "message": "Audit scheduler trigger executed."})
        return jsonify({"error": "SERVICE_UNAVAILABLE", "message": "Audit scheduler is not running."}), 503

    @app.route("/api/admin/reports", methods=["GET"])
    @admin_required
    def admin_reports():
        conn = get_db(app.config["DB_PATH"])
        try:
            cursor = conn.cursor()
            total_users = cursor.execute("SELECT COUNT(*) FROM users").fetchone()[0]
            active_users = cursor.execute("SELECT COUNT(*) FROM users WHERE status = 'ACTIVE'").fetchone()[0]
            total_files = cursor.execute("SELECT COUNT(*) FROM files WHERE is_deleted = 0").fetchone()[0]
            total_audits = cursor.execute("SELECT COUNT(*) FROM audits").fetchone()[0]
            pass_audits = cursor.execute("SELECT COUNT(*) FROM audits WHERE status = 'PASS'").fetchone()[0]
            fail_audits = cursor.execute("SELECT COUNT(*) FROM audits WHERE status != 'PASS'").fetchone()[0]
            total_alerts = cursor.execute("SELECT COUNT(*) FROM alerts").fetchone()[0]
            _, head_hash = get_ledger_head(conn)
            return jsonify({
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "total_users": total_users,
                "active_users": active_users,
                "total_files": total_files,
                "total_audits": total_audits,
                "pass_audits": pass_audits,
                "fail_audits": fail_audits,
                "pass_rate_percent": round((pass_audits / total_audits * 100), 2) if total_audits > 0 else 100.0,
                "total_alerts": total_alerts,
                "ledger_head_hash": head_hash,
            })
        finally:
            conn.close()

    @app.route("/api/admin/policy", methods=["GET", "PUT"])
    @admin_required
    def admin_policy():
        if request.method == "GET":
            return jsonify(load_policy())

        data = request.get_json(silent=True) or {}
        save_policy(data)
        with get_db(app.config["DB_PATH"]) as conn:
            append_audit_log(
                conn,
                actor_type="ADMIN",
                actor_id=request.current_user["id"],
                action="UPDATE_SECURITY_POLICY",
                resource="policy.yaml",
                result="UPDATED",
                details={"updated_keys": list(data.keys())},
            )
        return jsonify({"status": "POLICY_UPDATED", "policy": load_policy()})

    @app.route("/api/admin/log/verify", methods=["GET"])
    @admin_required
    def admin_verify_log():
        conn = get_db(app.config["DB_PATH"])
        try:
            valid, bad_seq, reason = verify_log(conn, app.config["LOG_SECRET"])
            return jsonify({
                "valid": valid,
                "bad_seq": bad_seq,
                "reason": reason,
                "verified_at": datetime.now(timezone.utc).isoformat(),
            })
        finally:
            conn.close()

    @app.route("/api/admin/files/<file_id>/assign-owner", methods=["POST"])
    @admin_required
    def admin_assign_file_owner(file_id):
        """Assigns an owner to a quarantined file, releasing it from quarantine."""
        data = request.get_json(silent=True) or {}
        target_owner_id = data.get("owner_id", "").strip()

        conn = get_db(app.config["DB_PATH"])
        try:
            cursor = conn.cursor()
            owner_row = cursor.execute("SELECT id, role, status FROM users WHERE id = ?", (target_owner_id,)).fetchone()
            if not owner_row or owner_row["role"] != "OWNER" or owner_row["status"] != "ACTIVE":
                return jsonify({"error": "INVALID_OWNER", "message": "Target owner does not exist or is not active."}), 400

            cursor.execute("UPDATE files SET owner_id = ?, quarantined = 0 WHERE id = ?", (target_owner_id, file_id))
            append_audit_log(
                conn,
                actor_type="ADMIN",
                actor_id=request.current_user["id"],
                action="ASSIGN_QUARANTINED_FILE_OWNER",
                resource=f"file:{file_id}",
                result="SUCCESS",
                details={"assigned_owner_id": target_owner_id},
            )
            conn.commit()
            return jsonify({"status": "OWNER_ASSIGNED", "file_id": file_id, "owner_id": target_owner_id})
        finally:
            conn.close()

    # -------------------------------------------------------------
    # Internal Endpoints (Automated Auditor Service Token Only)
    # -------------------------------------------------------------

    @app.route("/internal/delegations", methods=["GET"])
    @service_token_required
    def internal_get_delegations():
        conn = get_db(app.config["DB_PATH"])
        try:
            cursor = conn.cursor()
            rows = cursor.execute(
                """
                SELECT d.*, f.current_version, v.chain_hash, v.merkle_root
                FROM delegations d
                JOIN files f ON d.file_id = f.id
                LEFT JOIN versions v ON f.id = v.file_id AND f.current_version = v.version
                WHERE d.status = 'ACTIVE' AND f.is_deleted = 0 AND f.quarantined = 0
                """
            ).fetchall()
            return jsonify([dict(r) for r in rows])
        finally:
            conn.close()

    @app.route("/internal/challenge", methods=["POST"])
    @service_token_required
    def internal_challenge():
        data = request.get_json(silent=True) or {}
        file_id = data.get("file_id", "")
        version = int(data.get("version", 1))
        sample_size = int(data.get("sample_size", 10))

        conn = get_db(app.config["DB_PATH"])
        try:
            cursor = conn.cursor()
            meta = cursor.execute("SELECT block_count FROM blocks_meta WHERE file_id = ? AND version = ?", (file_id, version)).fetchone()
            if not meta:
                return jsonify({"error": "NOT_FOUND", "message": "Block metadata not found."}), 404

            total_blocks = meta["block_count"]
            sample_count = min(sample_size, total_blocks)
            indices = derive_challenge_indices(f"auditor-seed-{file_id}-{version}", total_blocks, sample_count)

            return jsonify({
                "file_id": file_id,
                "version": version,
                "total_blocks": total_blocks,
                "indices": indices,
            })
        finally:
            conn.close()

    @app.route("/internal/proof", methods=["POST"])
    @service_token_required
    def internal_proof():
        data = request.get_json(silent=True) or {}
        file_id = data.get("file_id", "")
        version = int(data.get("version", 1))
        indices = data.get("indices", [])

        conn = get_db(app.config["DB_PATH"])
        try:
            proof = generate_spotcheck_proof(
                conn=conn,
                file_id=file_id,
                version=version,
                indices=indices,
                storage_dir=app.config["CURRENT_STORAGE_DIR"],
            )
            return jsonify(proof)
        except Exception as e:
            return jsonify({"error": "PROOF_ERROR", "message": str(e)}), 400
        finally:
            conn.close()

    @app.route("/internal/results", methods=["POST"])
    @service_token_required
    def internal_results():
        data = request.get_json(silent=True) or {}
        file_id = data.get("file_id")
        verdict = data.get("verdict", "PASS")
        details = data.get("details", {})
        now_iso = datetime.now(timezone.utc).isoformat()

        conn = get_db(app.config["DB_PATH"])
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO audits (file_id, kind, status, details_json, actor_type, actor_id, trigger, created_at)
                VALUES (?, 'AUTOMATED_AUDIT', ?, ?, 'AUDITOR_SERVICE', 'automated-auditor-service', 'SCHEDULED', ?)
                """,
                (file_id, verdict, json.dumps(details), now_iso),
            )

            if verdict in ("TAMPERED", "VERSION_HISTORY_ALTERED"):
                create_security_alert(
                    conn,
                    severity="critical",
                    kind=f"AUTOMATED_AUDIT_{verdict}",
                    file_ref=file_id,
                    message=f"Automated Auditor Service detected integrity violation on {file_id}: {verdict}",
                )

            append_audit_log(
                conn,
                actor_type="AUDITOR_SERVICE",
                actor_id="automated-auditor-service",
                action="LOG_AUTOMATED_AUDIT_VERDICT",
                resource=f"file:{file_id}",
                result=verdict,
                details=details,
            )
            conn.commit()
            return jsonify({"status": "RECORDED", "verdict": verdict})
        finally:
            conn.close()

    # -------------------------------------------------------------
    # Shared Queries & Ledger (Reports, Ledger, Spot-Check)
    # -------------------------------------------------------------

    @app.route("/api/audits", methods=["GET"])
    def list_audits():
        conn = get_db(app.config["DB_PATH"])
        try:
            cursor = conn.cursor()
            file_filter = request.args.get("file_id")
            status_filter = request.args.get("status")
            user = get_current_user(conn)

            if user and user.get("role") == "OWNER":
                query = "SELECT a.* FROM audits a JOIN files f ON a.file_id = f.id WHERE f.owner_id = ? AND f.is_demo = 0"
                params = [user["id"]]
            else:
                query = "SELECT a.* FROM audits a WHERE 1=1"
                params = []

            if file_filter:
                query += " AND a.file_id = ?"
                params.append(file_filter)
            if status_filter:
                query += " AND a.status = ?"
                params.append(status_filter)

            query += " ORDER BY a.id DESC LIMIT 100"
            rows = cursor.execute(query, params).fetchall()
            return jsonify([dict(r) for r in rows])
        finally:
            conn.close()

    @app.route("/api/stats", methods=["GET"])
    def stats():
        conn = get_db(app.config["DB_PATH"])
        try:
            cursor = conn.cursor()
            user = get_current_user(conn)
            is_demo_user = bool(user and (user.get("is_demo") or user.get("id") == "demo-owner-id-01"))
            if user and user.get("role") == "OWNER" and not is_demo_user:
                total_files = cursor.execute("SELECT COUNT(*) FROM files WHERE owner_id = ? AND is_deleted = 0 AND is_demo = 0", (user["id"],)).fetchone()[0]
                total_versions = cursor.execute("SELECT COUNT(*) FROM versions v JOIN files f ON v.file_id = f.id WHERE f.owner_id = ? AND f.is_deleted = 0 AND f.is_demo = 0", (user["id"],)).fetchone()[0]
                total_audits = cursor.execute("SELECT COUNT(*) FROM audits a JOIN files f ON a.file_id = f.id WHERE f.owner_id = ? AND f.is_demo = 0", (user["id"],)).fetchone()[0]
                total_alerts = cursor.execute("SELECT COUNT(*) FROM alerts al JOIN files f ON al.file_ref = f.id WHERE f.owner_id = ? AND f.is_demo = 0", (user["id"],)).fetchone()[0]
                open_alerts = cursor.execute("SELECT COUNT(*) FROM alerts al JOIN files f ON al.file_ref = f.id WHERE f.owner_id = ? AND al.acknowledged = 0 AND f.is_demo = 0", (user["id"],)).fetchone()[0]
                is_demo = False
            elif user and user.get("role") == "OWNER" and is_demo_user:
                total_files = cursor.execute("SELECT COUNT(*) FROM files WHERE owner_id = ? AND is_deleted = 0", (user["id"],)).fetchone()[0]
                total_versions = cursor.execute("SELECT COUNT(*) FROM versions v JOIN files f ON v.file_id = f.id WHERE f.owner_id = ? AND f.is_deleted = 0", (user["id"],)).fetchone()[0]
                total_audits = cursor.execute("SELECT COUNT(*) FROM audits a JOIN files f ON a.file_id = f.id WHERE f.owner_id = ?", (user["id"],)).fetchone()[0]
                total_alerts = cursor.execute("SELECT COUNT(*) FROM alerts al JOIN files f ON al.file_ref = f.id WHERE f.owner_id = ?", (user["id"],)).fetchone()[0]
                open_alerts = cursor.execute("SELECT COUNT(*) FROM alerts al JOIN files f ON al.file_ref = f.id WHERE f.owner_id = ? AND al.acknowledged = 0", (user["id"],)).fetchone()[0]
                is_demo = total_files > 0 and cursor.execute("SELECT COUNT(*) FROM files WHERE is_demo = 1").fetchone()[0] > 0
            else:
                total_files = cursor.execute("SELECT COUNT(*) FROM files WHERE is_deleted = 0").fetchone()[0]
                total_versions = cursor.execute("SELECT COUNT(*) FROM versions").fetchone()[0]
                total_audits = cursor.execute("SELECT COUNT(*) FROM audits").fetchone()[0]
                total_alerts = cursor.execute("SELECT COUNT(*) FROM alerts").fetchone()[0]
                open_alerts = cursor.execute("SELECT COUNT(*) FROM alerts WHERE acknowledged = 0").fetchone()[0]
                is_demo = total_files > 0 and cursor.execute("SELECT COUNT(*) FROM files WHERE is_demo = 1").fetchone()[0] > 0

            _, head_hash = get_ledger_head(conn)

            return jsonify({
                "total_files": total_files,
                "total_versions": total_versions,
                "total_audits": total_audits,
                "audits_performed": total_audits,
                "total_alerts": total_alerts,
                "tamper_events": total_alerts,
                "open_alerts": open_alerts,
                "ledger_head_hash": head_hash,
                "is_demo_seeded": bool(is_demo),
                "storage_infrastructure": "simulated cloud storage",
            })
        finally:
            conn.close()

    @app.route("/api/alerts", methods=["GET"])
    def list_alerts():
        conn = get_db(app.config["DB_PATH"])
        try:
            cursor = conn.cursor()
            user = get_current_user(conn)
            if user and user.get("role") == "OWNER":
                rows = cursor.execute(
                    """
                    SELECT al.* FROM alerts al
                    JOIN files f ON al.file_ref = f.id
                    WHERE f.owner_id = ? AND f.is_demo = 0
                    ORDER BY al.id DESC LIMIT 50
                    """,
                    (user["id"],),
                ).fetchall()
            else:
                rows = cursor.execute("SELECT * FROM alerts ORDER BY id DESC LIMIT 50").fetchall()
            return jsonify([dict(r) for r in rows])
        finally:
            conn.close()

    @app.route("/api/alerts/<int:alert_id>/ack", methods=["POST"])
    def ack_alert(alert_id):
        conn = get_db(app.config["DB_PATH"])
        try:
            cursor = conn.cursor()
            cursor.execute("UPDATE alerts SET acknowledged = 1 WHERE id = ?", (alert_id,))
            conn.commit()
            return jsonify({"status": "ACKNOWLEDGED", "alert_id": alert_id})
        finally:
            conn.close()

    @app.route("/api/ledger", methods=["GET"])
    def get_ledger():
        conn = get_db(app.config["DB_PATH"])
        try:
            cursor = conn.cursor()
            rows = cursor.execute("SELECT * FROM ledger ORDER BY seq ASC LIMIT 200").fetchall()
            return jsonify([dict(r) for r in rows])
        finally:
            conn.close()

    @app.route("/api/ledger/verify", methods=["GET"])
    def verify_ledger():
        conn = get_db(app.config["DB_PATH"])
        try:
            valid, bad_seq, reason = verify_ledger_chain(conn)
            status = "PASS" if valid else "LEDGER_ALTERED"
            return jsonify({"valid": valid, "chain_valid": valid, "status": status, "bad_seq": bad_seq, "reason": reason})
        finally:
            conn.close()

    @app.route("/api/challenge", methods=["POST"])
    def request_challenge():
        data = request.get_json(silent=True) or {}
        file_id = data.get("file_id")
        conn = get_db(app.config["DB_PATH"])
        try:
            cursor = conn.cursor()
            file_row = cursor.execute("SELECT * FROM files WHERE id = ?", (file_id,)).fetchone()
            if not file_row:
                return jsonify({"error": "NOT_FOUND", "message": f"File with ID {file_id} not found"}), 404

            ver = file_row["current_version"]
            meta = cursor.execute("SELECT block_count FROM blocks_meta WHERE file_id = ? AND version = ?", (file_id, ver)).fetchone()
            block_count = meta["block_count"] if meta else 1

            _, head_hash = get_ledger_head(conn)
            time_bucket = get_current_time_bucket(app.config.get("TIME_BUCKET_SECONDS", 300))
            seed = derive_public_challenge_seed(head_hash, time_bucket)
            indices = derive_challenge_indices(f"{seed}|{file_id}", block_count, min(10, block_count))

            ledger_entry = append_ledger_entry(
                conn,
                entry_type="CHALLENGE_SEED",
                payload={"file_id": file_id, "version": ver, "seed": seed, "time_bucket": time_bucket, "indices": indices},
            )
            return jsonify({
                "file_id": file_id,
                "version": ver,
                "seed": seed,
                "time_bucket": time_bucket,
                "block_count": block_count,
                "challenged_indices": indices,
                "ledger_seq": ledger_entry["seq"],
            })
        finally:
            conn.close()

    @app.route("/api/proof", methods=["POST"])
    def get_proof():
        data = request.get_json(silent=True) or {}
        file_id = data.get("file_id", "")
        version = int(data.get("version", 1))
        indices = data.get("indices", [])

        conn = get_db(app.config["DB_PATH"])
        try:
            proof = generate_spotcheck_proof(
                conn=conn,
                file_id=file_id,
                version=version,
                indices=indices,
                storage_dir=app.config["CURRENT_STORAGE_DIR"],
            )
            return jsonify(proof)
        except Exception as e:
            return jsonify({"error": "PROOF_GENERATION_FAILED", "message": str(e)}), 400
        finally:
            conn.close()

    @app.route("/api/verify-proof", methods=["POST"])
    def verify_proof_route():
        data = request.get_json(silent=True) or {}
        conn = get_db(app.config["DB_PATH"])
        try:
            ok, msg, details = verify_spotcheck_proof(data, k_tag=app.config["K_TAG"])
            status = "PASS" if ok else "TAMPERED"
            return jsonify({"status": status, "message": msg, "details": details})
        finally:
            conn.close()

    @app.route("/api/audit/batch", methods=["POST"])
    def batch_audit():
        data = request.get_json(silent=True) or {}
        file_ids = data.get("file_ids", [])
        conn = get_db(app.config["DB_PATH"])
        try:
            res = execute_batch_audit(
                file_ids=file_ids,
                conn=conn,
                k_tag=app.config["K_TAG"],
                storage_dir=app.config["CURRENT_STORAGE_DIR"],
            )
            return jsonify(res)
        finally:
            conn.close()

    @app.route("/api/files/<file_id>/expected-challenge", methods=["GET"])
    def expected_challenge(file_id):
        conn = get_db(app.config["DB_PATH"])
        try:
            cursor = conn.cursor()
            file_row = cursor.execute("SELECT * FROM files WHERE id = ?", (file_id,)).fetchone()
            if not file_row:
                return jsonify({"error": "NOT_FOUND", "message": "File not found"}), 404
            ver = file_row["current_version"]
            meta = cursor.execute("SELECT block_count FROM blocks_meta WHERE file_id = ? AND version = ?", (file_id, ver)).fetchone()
            block_count = meta["block_count"] if meta else 1

            chal_row = cursor.execute(
                "SELECT prev_hash FROM ledger WHERE entry_type = 'CHALLENGE_SEED' AND payload_json LIKE ? ORDER BY seq DESC LIMIT 1",
                (f'%"file_id": "{file_id}"%',),
            ).fetchone()
            if chal_row:
                head_hash = chal_row["prev_hash"]
            else:
                _, head_hash = get_ledger_head(conn)

            bucket_param = request.args.get("bucket")
            time_bucket = int(bucket_param) if bucket_param else get_current_time_bucket(app.config.get("TIME_BUCKET_SECONDS", 300))
            seed = derive_public_challenge_seed(head_hash, time_bucket)
            indices = derive_challenge_indices(f"{seed}|{file_id}", block_count, min(10, block_count))

            return jsonify({
                "file_id": file_id,
                "version": ver,
                "time_bucket": time_bucket,
                "seed": seed,
                "expected_indices": indices,
                "indices": indices,
            })
        finally:
            conn.close()

    @app.route("/api/ownership/<file_hash>", methods=["GET"])
    def get_ownership(file_hash):
        conn = get_db(app.config["DB_PATH"])
        try:
            cursor = conn.cursor()
            rows = cursor.execute("SELECT * FROM ownership WHERE file_hash = ?", (file_hash.lower(),)).fetchall()
            return jsonify([dict(r) for r in rows])
        finally:
            conn.close()

    @app.route("/api/ownership/check", methods=["POST"])
    def check_ownership():
        data = request.get_json(silent=True) or {}
        file_hash = data.get("file_hash", "").strip().lower()
        blinded_owner = data.get("blinded_owner", "").strip()
        conn = get_db(app.config["DB_PATH"])
        try:
            cursor = conn.cursor()
            row = cursor.execute("SELECT * FROM ownership WHERE file_hash = ? AND blinded_owner = ?", (file_hash, blinded_owner)).fetchone()
            return jsonify({
                "file_hash": file_hash,
                "blinded_owner": blinded_owner,
                "found_in_ledger": bool(row),
                "ledger_seq": row["ledger_seq"] if row else None,
                "exists": bool(row),
            })
        finally:
            conn.close()

    @app.route("/api/reports/audits.csv", methods=["GET"])
    def export_audits_csv():
        conn = get_db(app.config["DB_PATH"])
        try:
            cursor = conn.cursor()
            user = get_current_user(conn)
            if user and user.get("role") == "OWNER":
                rows = cursor.execute(
                    """
                    SELECT a.id, a.file_id, a.kind, a.status, a.actor_type, a.trigger, a.created_at
                    FROM audits a JOIN files f ON a.file_id = f.id
                    WHERE f.owner_id = ? AND f.is_demo = 0
                    ORDER BY a.id DESC LIMIT 200
                    """,
                    (user["id"],),
                ).fetchall()
            else:
                rows = cursor.execute("SELECT id, file_id, kind, status, actor_type, trigger, created_at FROM audits ORDER BY id DESC LIMIT 200").fetchall()
            _, head_hash = get_ledger_head(conn)
            si = io.StringIO()
            cw = csv.writer(si)
            cw.writerow(["AUDIT ID", "FILE ID", "KIND", "STATUS", "ACTOR TYPE", "TRIGGER", "TIMESTAMP"])
            for r in rows:
                cw.writerow([r["id"], r["file_id"], r["kind"], r["status"], r["actor_type"], r["trigger"], r["created_at"]])
            cw.writerow([])
            cw.writerow(["SIGNATURE LINE: LEDGER HEAD HASH", head_hash])
            return Response(si.getvalue(), mimetype="text/csv", headers={"Content-Disposition": "attachment;filename=audits_report.csv"})
        finally:
            conn.close()

    @app.route("/api/reports/audits.pdf", methods=["GET"])
    def export_audits_pdf():
        conn = get_db(app.config["DB_PATH"])
        try:
            cursor = conn.cursor()
            user = get_current_user(conn)
            if user and user.get("role") == "OWNER":
                rows = cursor.execute(
                    """
                    SELECT a.id, a.file_id, a.kind, a.status, a.created_at
                    FROM audits a JOIN files f ON a.file_id = f.id
                    WHERE f.owner_id = ? AND f.is_demo = 0
                    ORDER BY a.id DESC LIMIT 50
                    """,
                    (user["id"],),
                ).fetchall()
            else:
                rows = cursor.execute("SELECT id, file_id, kind, status, created_at FROM audits ORDER BY id DESC LIMIT 50").fetchall()
            _, head_hash = get_ledger_head(conn)
            pdf_buffer = generate_simple_pdf_report(rows, head_hash)
            return Response(pdf_buffer, mimetype="application/pdf", headers={"Content-Disposition": "attachment;filename=audits_report.pdf"})
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
                cursor.execute("INSERT INTO schedules (file_id, interval_minutes, last_run, enabled) VALUES (?, ?, NULL, 1)", (file_id, interval_min))
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
    # Attacker Simulation & Demo Routes (Gated by DEMO_MODE, Admin Only)
    # -------------------------------------------------------------

    def check_demo_allowed():
        if "ENABLE_DEMO_TAMPER" in app.config and not app.config.get("ENABLE_DEMO_TAMPER"):
            return False
        return bool(app.config.get("DEMO_MODE", False) or app.config.get("ENABLE_DEMO_TAMPER", False))

    @app.before_request
    def gate_demo_routes():
        if request.path.startswith("/api/demo/"):
            if not check_demo_allowed():
                return jsonify({"error": "NOT_FOUND", "message": "Demo routes are disabled."}), 404
            if not app.config.get("TESTING"):
                from db import get_db
                with get_db(app.config.get("DB_PATH")) as conn:
                    user = get_current_user(conn)
                    if not user or user.get("role") != "ADMIN":
                        return jsonify({"error": "FORBIDDEN", "message": "Demo routes require Admin privileges."}), 403
                    request.current_user = user

    @app.route("/api/demo/tamper-file/<file_id>", methods=["POST"])
    def demo_tamper_file(file_id):
        conn = get_db(app.config["DB_PATH"])
        try:
            cursor = conn.cursor()
            file_row = cursor.execute("SELECT * FROM files WHERE id = ? AND is_demo = 1", (file_id,)).fetchone()
            if not file_row:
                return jsonify({"error": "NOT_FOUND", "message": "Demo file not found."}), 404

            p = Path(file_row["stored_path"])
            if p.is_file():
                with open(p, "ab") as f:
                    f.write(b"\n[MALICIOUS_TAMPER_PAYLOAD_UNAUTHORIZED_MUTATION]")

            actor_id = getattr(request, "current_user", {}).get("id", "demo-admin")
            append_audit_log(
                conn,
                actor_type="ADMIN",
                actor_id=actor_id,
                action="DEMO_TAMPER_DISK_FILE",
                resource=f"file:{file_id}",
                result="TAMPERED",
            )
            conn.commit()
            return jsonify({"status": "TAMPERED_ON_DISK", "file_id": file_id, "message": f"Injected silent corruption into demo storage: {file_id}"})
        finally:
            conn.close()

    @app.route("/api/demo/tamper-history/<file_id>", methods=["POST"])
    def demo_tamper_history(file_id):
        conn = get_db(app.config["DB_PATH"])
        try:
            cursor = conn.cursor()
            file_row = cursor.execute("SELECT * FROM files WHERE id = ? AND is_demo = 1", (file_id,)).fetchone()
            if not file_row:
                return jsonify({"error": "NOT_FOUND", "message": "Demo file not found."}), 404

            cursor.execute(
                "UPDATE versions SET content_hash = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' WHERE file_id = ? AND version = 1",
                (file_id,),
            )
            actor_id = getattr(request, "current_user", {}).get("id", "demo-admin")
            append_audit_log(
                conn,
                actor_type="ADMIN",
                actor_id=actor_id,
                action="DEMO_TAMPER_HISTORY_ROW",
                resource=f"file:{file_id}",
                result="TAMPERED",
            )
            conn.commit()
            return jsonify({"status": "VERSION_TAMPERED", "file_id": file_id, "message": f"Mutated historical version V1 for {file_id}"})
        finally:
            conn.close()

    @app.route("/api/demo/tamper-block/<file_id>", methods=["POST"])
    def demo_tamper_block(file_id):
        conn = get_db(app.config["DB_PATH"])
        try:
            cursor = conn.cursor()
            file_row = cursor.execute("SELECT * FROM files WHERE id = ? AND is_demo = 1", (file_id,)).fetchone()
            if not file_row:
                return jsonify({"error": "NOT_FOUND", "message": "Demo file not found."}), 404

            p = Path(file_row["stored_path"])
            if p.is_file():
                with open(p, "r+b") as f:
                    f.seek(0)
                    f.write(b"CORRUPTED_BLOCK_0_TAMPER")

            return jsonify({"status": "BLOCK_TAMPERED", "file_id": file_id, "message": "Injected corrupted block data."})
        finally:
            conn.close()

    @app.route("/api/demo/tamper-ledger", methods=["POST"])
    def demo_tamper_ledger():
        conn = get_db(app.config["DB_PATH"])
        try:
            cursor = conn.cursor()
            last_entry = cursor.execute("SELECT seq FROM ledger ORDER BY seq DESC LIMIT 1").fetchone()
            if last_entry:
                cursor.execute(
                    "UPDATE ledger SET entry_hash = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' WHERE seq = ?",
                    (last_entry[0],),
                )
                conn.commit()
            return jsonify({"status": "LEDGER_TAMPERED", "message": "Corrupted simulated blockchain ledger entry."})
        finally:
            conn.close()

    @app.route("/api/demo/reset", methods=["POST"])
    def demo_reset():
        """Demo reset: deletes ONLY rows flagged is_demo = 1. Never deletes real users or files."""
        conn = get_db(app.config["DB_PATH"])
        try:
            cursor = conn.cursor()
            demo_files = cursor.execute("SELECT id, stored_path FROM files WHERE is_demo = 1").fetchall()
            for df in demo_files:
                fid = df["id"]
                p = Path(df["stored_path"])
                if p.is_file():
                    p.unlink(missing_ok=True)
                v_rows = cursor.execute("SELECT blob_path FROM versions WHERE file_id = ?", (fid,)).fetchall()
                for vr in v_rows:
                    bp = Path(vr["blob_path"])
                    if bp.is_file():
                        bp.unlink(missing_ok=True)

            cursor.execute("DELETE FROM versions WHERE file_id IN (SELECT id FROM files WHERE is_demo = 1)")
            cursor.execute("DELETE FROM block_tags WHERE file_id IN (SELECT id FROM files WHERE is_demo = 1)")
            cursor.execute("DELETE FROM blocks_meta WHERE file_id IN (SELECT id FROM files WHERE is_demo = 1)")
            cursor.execute("DELETE FROM receipts WHERE file_id IN (SELECT id FROM files WHERE is_demo = 1)")
            cursor.execute("DELETE FROM delegations WHERE file_id IN (SELECT id FROM files WHERE is_demo = 1)")
            cursor.execute("DELETE FROM audits WHERE file_id IN (SELECT id FROM files WHERE is_demo = 1)")
            cursor.execute("DELETE FROM files WHERE is_demo = 1")
            cursor.execute("DELETE FROM users WHERE is_demo = 1")
            cursor.execute("DELETE FROM alerts WHERE file_ref IN (SELECT id FROM files WHERE is_demo = 1)")

            actor_id = getattr(request, "current_user", {}).get("id", "demo-admin")
            append_audit_log(
                conn,
                actor_type="ADMIN",
                actor_id=actor_id,
                action="DEMO_RESET_DATA",
                resource="demo_tables",
                result="SUCCESS",
                details={"purged_demo_files": len(demo_files)},
            )
            conn.commit()
            return jsonify({"status": "RESET_SUCCESS", "message": "Demo data wiped cleanly. Real users and real files preserved."})
        finally:
            conn.close()

    @app.route("/api/demo/seed", methods=["POST"])
    def demo_seed():
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
            # Ensure demo owner exists
            seed_demo_users_if_needed(conn)

            for display_name, versions_content in sample_files:
                file_id = str(uuid.uuid4())
                current_file_path = Path(app.config["CURRENT_STORAGE_DIR"]) / file_id
                genesis_hc = compute_genesis_chain_hash(secret, file_id)
                prev_hc = genesis_hc

                cursor.execute(
                    """
                    INSERT INTO files (id, display_name, created_at, current_version, stored_path, is_deleted, owner_id, quarantined, is_demo)
                    VALUES (?, ?, ?, ?, ?, 0, 'demo-owner-id-01', 0, 1)
                    """,
                    (file_id, display_name, datetime.now(timezone.utc).isoformat(), len(versions_content), str(current_file_path)),
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
                        (file_id, v_idx, c_hash, prev_hc, v_chain_hash, len(content), v_time, activity, str(v_blob_path), merkle_root, tag_root),
                    )

                    cursor.execute("INSERT OR REPLACE INTO blocks_meta (file_id, version, block_size, block_count) VALUES (?, ?, ?, ?)", (file_id, v_idx, app.config["BLOCK_SIZE"], len(blocks)))
                    for b_idx, t_val in enumerate(block_tags):
                        cursor.execute("INSERT OR REPLACE INTO block_tags (file_id, version, idx, tag) VALUES (?, ?, ?, ?)", (file_id, v_idx, b_idx, t_val))

                    prev_hc = v_chain_hash

                created_files.append(file_id)

            actor_id = getattr(request, "current_user", {}).get("id", "demo-admin") if hasattr(request, "current_user") and request.current_user else "demo-admin"
            append_audit_log(
                conn,
                actor_type="ADMIN",
                actor_id=actor_id,
                action="DEMO_SEED_DATA",
                resource="demo_files",
                result="SUCCESS",
                details={"files_created": len(created_files)},
            )
            conn.commit()

            return jsonify({
                "status": "DEMO_SEEDED",
                "files_created": len(created_files),
                "file_ids": created_files,
                "badge": "Automated Prototype Demo Data",
            })
        finally:
            conn.close()

    # -------------------------------------------------------------
    # Production SPA Serving
    # -------------------------------------------------------------

    dist_dir = Path(os.environ.get("FRONTEND_DIST_DIR", Path(__file__).resolve().parent.parent / "frontend" / "dist"))
    if dist_dir.exists():
        from flask import send_from_directory

        @app.route("/", defaults={"path": ""})
        @app.route("/<path:path>")
        def serve_frontend(path):
            if path and (path.startswith("api/") or path == "api" or path.startswith("internal/")):
                return jsonify({"error": "NOT_FOUND", "message": f"Endpoint /{path} not found"}), 404
            if path and (dist_dir / path).exists():
                return send_from_directory(dist_dir, path)
            return send_from_directory(dist_dir, "index.html")
        @app.route("/favicon.ico")
        def favicon():
            if (dist_dir / "favicon.svg").exists():
                return send_from_directory(dist_dir, "favicon.svg")
            return "", 204
    else:
        @app.route("/", methods=["GET"])
        def root():
            return get_system_info()

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
        f"(Ledger Anchor Signature: {head_hash[:32]}...) Tj",
        "0 -25 Td",
        "(--------------------------------------------------------------------------------) Tj",
        "0 -15 Td",
    ]

    for r in rows[:25]:
        line_str = f"[{r['kind']}] Status: {r['status']} | File: {r['file_id'][:16]}... | {r['created_at'][:19]}"
        safe_str = line_str.replace("(", "[").replace(")", "]")
        text_commands.append(f"({safe_str}) Tj")
        text_commands.append("0 -15 Td")

    text_commands.append("ET")
    stream_content = "\n".join(text_commands)
    stream_len = len(stream_content.encode("latin-1"))

    lines.append(f"4 0 obj << /Length {stream_len} >> stream")
    lines.append(stream_content)
    lines.append("endstream")
    lines.append("endobj")

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
