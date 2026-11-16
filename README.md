# Auditing Mechanism in Cloud Data Services

> **Academic B.Tech Engineering Prototype & Research Implementation**  
> **Model Name:** Version-Based Dynamic Cloud Data Auditing  
> **Institution:** Bharat Ratna Babasaheb Bhimrao Ambedkar Rajkiya Engineering College, Pratapgarh  
> **Department:** Computer Science and Engineering (CSE)  
> **Students:** Ayush Agnihotri (Roll No: 2312160100022), Vivek Kushwaha (Roll No: 2312160100071)  
> **Guide / Supervisor:** Dr. Ashish Kumar Mishra  

---

## 1. Overview and Core Concept

In modern cloud computing, enterprises outsource sensitive storage to third-party cloud data services. Because physical control over the underlying drives is relinquished, cloud tenants face challenges with:
- **Silent Bit Rot & Drive Degradation:** Subtle physical media decay occurring undetected.
- **Unauthorized Byte Overwriting:** Direct file tampering on disk bypassing standard software channels.
- **Historical Revisionism:** Malicious alteration or deletion of previous document versions to mask compliance failures.
- **Server Rollback Attacks:** A malicious server quietly rolling back state to a previous valid version to revert recent authorized modifications.

This project implements a tamper-evident, fully automated cloud data auditing platform termed **Version-Based Dynamic Cloud Data Auditing**. It establishes cryptographic accountability over cloud data services through streaming SHA-256 content hashing, secret-anchored HMAC-SHA256 version chaining, block-level Merkle tree spot-check verification, an append-only simulated blockchain ledger, an isolated Automated TPA Auditor Service, and a rule-based Policy Engine.

---

## 2. System Architecture

```
                                  +------------------------------------+
                                  |         Browser (React SPA)        |
                                  |  Owner Portal / Break-Glass Admin  |
                                  +-----------------+------------------+
                                                    |
                                                    | JWT / Cookie / CSRF
                                                    v
                                  +------------------------------------+
                                  |        Main API Engine (Flask)     |
                                  |  - Route Auth & IDOR Enforcement   |
                                  |  - Dynamic Block Operations        |
                                  |  - Append-Only Receipts Ledger     |
                                  +--------+------------------+--------+
                                           |                  |
                       Metadata & Accounts |                  | Storage Payloads
                                           v                  v
                                  +-----------------+  +---------------+
                                  | SQLite Database |  |  File Storage |
                                  | (audit.db)      |  |  (storage/)   |
                                  +-----------------+  +---------------+
                                           ^
                                           | Internal RPC (X-Auditor-Token)
                                           v
    +---------------------------------------------------------------------------------+
    |                     Automated TPA Auditor Service (auditor/)                     |
    |  - Completely isolated background process holding ZERO server secrets           |
    |  - Dedicated SQLite database (auditor.db) with append-only receipt log          |
    |  - Random challenge generation: SHA-256(ledger_head || epoch)                   |
    |  - Spot-check Merkle proof verification against owner receipts                  |
    |  - Independent forensic verdict log & alert dispatching                         |
    +---------------------------------------------------------------------------------+
                                           ^
                                           | Watchdog Monitoring & Alerts
                                           v
    +---------------------------------------------------------------------------------+
    |                         Policy Engine & Background Scheduler                    |
    |  - Automatic registration evaluation (domain-based or policy auto-approve)      |
    |  - Brute-force protection: Auto-suspends accounts after 5 failed logins         |
    |  - IDOR probe detection & flagging                                              |
    |  - Distributed job locking in audit_jobs table to prevent concurrent execution  |
    |  - Soft-delete retention cleanup and watchdog alert for missed audit schedules  |
    +---------------------------------------------------------------------------------+
```

### 2.1 Role Boundaries & Separation of Duties
1. **Data Owner (`OWNER`):**
   - The only public user type.
   - Registers self-service with email verification.
   - Uploads files, dynamically updates blocks, soft-deletes files.
   - Delegates files to the Automated Auditor Service with custom intervals (e.g. 60 min).
   - Downloads signed offline receipt JSON (cryptographic anchor against server rollback).
   - All data queries strictly scoped to `owner_id`; unauthorized cross-owner requests return HTTP `404 Not Found` to prevent IDOR existence leakage.
2. **Automated TPA Auditor Service (`AUDITOR_SERVICE`):**
   - Logically isolated background daemon with its own service credentials (`AUDITOR_SERVICE_TOKEN`).
   - Maintains an independent `auditor.db` database.
   - Holds **zero knowledge of `CHAIN_SECRET`**; verifies data integrity strictly using owner receipts and sampled Merkle proofs.
   - Has read-only access to audit metadata; strictly forbidden from downloading, modifying, or deleting owner files.
3. **Break-Glass Human Administrator (`ADMIN`):**
   - One human administrator account created exclusively via the interactive CLI command: `flask create-admin`.
   - Has no public registration portal.
   - Performs break-glass tasks: user status overrides (suspensions, approvals, reactivations), reviewing security events, and assigning unowned/quarantined files.
   - Strictly forbidden from viewing or downloading owner file contents.

---

## 3. Cryptographic Specification

### 3.1 Content Digest ($D_v$)
Every uploaded or dynamically updated file is streamed to calculate an immutable SHA-256 digest:
$$D_v = \text{SHA-256}(\text{file bytes})$$

### 3.2 Genesis Anchor ($HC_0$)
Upon initial file registration ($V_1$), an initial genesis anchor is computed:
$$HC_0 = \text{HMAC-SHA256}(K_{chain}, \text{"genesis"} \parallel \text{file\_id})$$

### 3.3 Version Chain Block ($HC_v$)
Each authorized revision $V_v$ cryptographically binds the content digest, version number, activity type, and previous chain signature:
$$HC_v = \text{HMAC-SHA256}(K_{chain}, \text{file\_id} \parallel v \parallel D_v \parallel HC_{v-1} \parallel \text{activity} \parallel \text{created\_at})$$
- **Supported Activities:** `UPLOAD`, `AUTHORIZED_UPDATE`, `DYNAMIC_UPDATE`, `DELETE`.
- **Soft Delete:** Deleting a file records an authenticated `DELETE` version activity in the chain, maintaining cryptographic continuity until the retention expiration period.

### 3.4 Block Tags & Merkle Tree Spot-Checks
- Files are partitioned into 64 KB blocks ($B_1, B_2, \dots, B_m$).
- For each block, an HMAC tag is computed:
  $$T_{i,v} = \text{HMAC-SHA256}(K_{tag}, i \parallel v \parallel B_i)$$
- Block digests form the leaves of a Merkle Tree, generating root hash $R_v$.
- Auditors draw unmanipulable random indices and verify Merkle inclusion paths against $R_v$ without downloading raw file contents.

### 3.5 Tamper-Evident Audit Log
The system maintains an append-only audit log chained using `LOG_SECRET`:
$$\text{EntryHash}_n = \text{HMAC-SHA256}(LOG\_SECRET, \text{PrevHash} \parallel \text{seq} \parallel \text{actor\_type} \parallel \text{action} \parallel \text{result} \parallel \text{created\_at})$$
The integrity of the entire log can be verified at any time via `/api/admin/log/verify`.

---

## 4. Database Schema & Entities

The SQLite database (`backend/audit.db`) utilizes write-ahead logging (WAL) and foreign key constraints:

| Table | Primary Key | Description |
|---|---|---|
| `users` | `id` (UUID) | User accounts (`name`, `email`, `pw_hash`, `role`, `status`, `email_verified`, `token_version`, `user_key`) |
| `files` | `id` (UUID) | File metadata (`display_name`, `current_version`, `stored_path`, `owner_id`, `is_deleted`, `quarantined`) |
| `versions` | `(file_id, version)` | Chained version revisions (`content_hash`, `prev_chain_hash`, `chain_hash`, `merkle_root`, `activity`) |
| `audits` | `id` (Auto-inc) | Complete verification records with stopwatch timings, `actor_type`, and `trigger` |
| `receipts` | `id` (Auto-inc) | Append-only server log of owner receipts containing `chain_hash` and `merkle_root` |
| `delegations` | `id` (UUID) | Active file audit delegations for the Automated Auditor Service |
| `audit_jobs` | `id` (UUID) | Distributed job locking table (`job_id` UNIQUE, `file_id`, `status`, `retry_count`) |
| `email_verifications` | `id` (UUID) | Single-use SHA-256 hashed email verification tokens (24h expiry) |
| `password_resets` | `id` (UUID) | Single-use SHA-256 hashed password reset tokens (1h expiry) |
| `blocks_meta` | `(file_id, version)`| Block partitioning metadata (`block_size`, `block_count`) |
| `block_tags` | `(file_id, version, idx)` | Per-block HMAC authentication tags |
| `ledger` | `seq` (Sequential) | Append-only simulated blockchain ledger with SHA-256 hash chaining |
| `ownership` | `file_hash` | Zero-knowledge blinded ownership table (`blinded_owner`, `ledger_seq`) |
| `events` | `id` (Auto-inc) | Activity log with IP address attribution and timestamps |
| `alerts` | `id` (Auto-inc) | System security alerts (`severity`, `kind`, `file_ref`, `message`, `acknowledged`) |
| `schedules` | `id` (Auto-inc) | Periodic audit configurations (`interval_minutes`, `last_run`, `enabled`) |

---

## 5. REST API Reference

### 5.1 Authentication & Profile
- `POST /api/auth/register` — Owner self-registration. Validates password strength, assigns role `OWNER`, issues verification token.
- `POST /api/auth/verify-email` — Consumes single-use token and applies Policy Engine activation rules.
- `POST /api/auth/resend-verification` — Rate-limited verification token resend.
- `POST /api/auth/login` — Authenticates Owner credentials, returns signed JWT session.
- `POST /api/admin/login` — Authenticates Break-Glass Administrator credentials (portal matching enforced).
- `POST /api/auth/logout` — Logs out and revokes active session token.
- `GET /api/auth/me` — Fetches current session identity and revalidates `token_version`.
- `GET /api/auth/profile` — Views user profile information.
- `PUT /api/auth/profile` — Updates permitted profile fields (display name). Rejects attempts to alter role or ID.
- `POST /api/auth/change-password` — Validates current password, updates credentials, and revokes prior sessions.
- `POST /api/auth/forgot-password` — Requests single-use password reset token via dev console mailer.
- `POST /api/auth/reset-password` — Validates token and password complexity, updates hash, increments `token_version`.

### 5.2 File Management & Delegations
- `POST /api/files` — Uploads file, computes hashes, creates V1, records receipt and genesis ledger block.
- `GET /api/files` — Lists all active files belonging strictly to the authenticated owner.
- `GET /api/files/<id>` — Retrieves file details and head version.
- `GET /api/files/<id>/versions` — Retrieves full cryptographic version timeline.
- `GET /api/files/<id>/download` — Streams file plaintext (strictly blocked for Auditor and non-owners).
- `POST /api/files/<id>/versions` — Uploads authorized new file revision ($V_{n+1}$).
- `POST /api/files/<id>/blocks` — Executes dynamic block operations (`modify`, `insert`, `append`, `delete`).
- `DELETE /api/files/<id>` — Executes soft delete by recording a `DELETE` activity in the HMAC chain.
- `GET /api/files/<id>/receipt` — Retrieves latest signed receipt containing root hashes and anchors.
- `POST /api/files/<id>/delegate` — Delegates periodic audits to the Automated Auditor Service.
- `POST /api/files/<id>/revoke-delegation` — Revokes delegation; auditor halts scheduled verification.

### 5.3 Auditing & Verification
- `POST /api/files/<id>/audit` — Executes full integrity audit (verifies chain precedence then content bytes).
- `POST /api/files/<id>/verify-chain` — Verifies HMAC continuity and receipts without inspecting active disk payload.
- `POST /api/challenge` — Derives unmanipulable public challenge indices for spot-checking.
- `POST /api/proof` — Computes Merkle proof for specified block indices.
- `POST /api/verify-proof` — Verifies cryptographic proof against recorded Merkle root.
- `POST /api/audit/batch` — Executes batch audit over multiple files simultaneously.
- `GET /api/audits` — Retrieves forensic audit records with actor attribution and step timings.
- `GET /api/reports/audits.csv` — Exports signed audit report as CSV.
- `GET /api/reports/audits.pdf` — Exports signed audit report as PDF.

### 5.4 Internal Administration (Break-Glass Only)
- `GET /api/admin/overview` — System health and storage telemetry.
- `GET /api/admin/users` — Lists all registered accounts and their verification/approval status.
- `POST /api/admin/users/<id>/<action>` — Approves, rejects, suspends, or reactivates user accounts.
- `GET /api/admin/security-events` — Live security audit event feed.
- `GET /api/admin/policy` — Inspects active Policy Engine rules (`policy.yaml`).
- `GET /api/admin/log/verify` — Cryptographically validates the HMAC-SHA256 audit log chain.
- `POST /api/admin/files/<id>/assign-owner` — Assigns a legitimate owner to quarantined files.

### 5.5 Internal Service RPC (Auditor Only)
- `GET /internal/delegations` — Synchronizes active file delegations and receipts (`X-Auditor-Token` required).
- `POST /internal/challenge` — Requests public challenge parameters.
- `POST /internal/proof` — Requests Merkle proof for sampled blocks.
- `POST /internal/results` — Commits independent audit verdict into tamper-evident log.

---

## 6. Local Setup and Execution Guide

### 6.1 Prerequisites
- Python 3.11+
- Node.js 18+ and npm
- Git

### 6.2 Environment Configuration
Copy the environment template and ensure 64-character cryptographically secure keys:
```bash
# Linux / macOS
cp .env.example .env

# Windows (PowerShell)
Copy-Item .env.example .env
```

*Startup Security Enforcement:* The application strictly enforces that `CHAIN_SECRET`, `JWT_SECRET`, and `LOG_SECRET` are present, at least 32 characters in length, and not equal to example placeholders.

### 6.3 Backend Setup & Test Suite Execution
```bash
# 1. Create and activate virtual environment
cd backend
python -m venv venv

# Windows (PowerShell)
.\venv\Scripts\activate
pip install -r requirements.txt

# Linux / macOS
source venv/bin/activate
pip install -r requirements.txt

# 2. Run the complete test suite (59 tests must pass)
python -m pytest tests -v
```

### 6.4 Creating the Break-Glass Administrator
Run the interactive CLI bootstrap tool:
```bash
# Inside backend directory with virtual environment active:
flask create-admin
# Enter Admin Name, Email, and Password when prompted.
```

### 6.5 Running the Applications

#### Option A: Production Build with Unified Serving (Recommended)
Build the frontend SPA assets and serve everything from Flask on port 5000:
```bash
# 1. Build frontend
cd frontend
npm install
npm run build
cd ..

# 2. Start unified server
python backend/app.py
```
Open [http://localhost:5000](http://localhost:5000) in your web browser.

#### Option B: Independent Dev Servers
```bash
# Terminal 1: Backend API (Port 5000)
cd backend
python app.py

# Terminal 2: Frontend Vite Server (Port 5173)
cd frontend
npm run dev
```

---

## 7. Testing & Verification Summary

The test suite contains **59 automated unit and integration tests** verifying complete system functionality:
```
backend/tests/test_api.py .........                                      [ 15%]
backend/tests/test_batch.py .                                            [ 16%]
backend/tests/test_chain.py ....                                         [ 23%]
backend/tests/test_dedup.py .                                            [ 25%]
backend/tests/test_dynamic.py .                                          [ 27%]
backend/tests/test_forgery.py .                                          [ 28%]
backend/tests/test_master_implementation.py ......                       [ 38%]
backend/tests/test_monitoring.py ...                                     [ 44%]
backend/tests/test_privacy.py ..                                         [ 47%]
backend/tests/test_secret_safety.py ......                               [ 57%]
backend/tests/test_spotcheck.py ...                                      [ 62%]
backend/tests/test_tpa.py ..                                             [ 66%]
backend/tests/test_v3_features.py ....................                   [100%]

============================= 59 passed in 29.41s =============================
```

---

## 8. Academic Scope and Independence Assumptions

To maintain academic rigor and transparent peer review:
1. **Auditor Independence Disclaimer:** The Automated Auditor Service operates as a logically isolated verification daemon. When deployed in the same cloud environment as the storage server, it provides **high automation and automated verification, but not complete institutional independence**. True independent third-party auditing requires hosting the auditor daemon on an externally managed infrastructure holding only owner receipts.
2. **Key Isolation:** `CHAIN_SECRET` is kept in server environment variables and never exposed to the Auditor or Client. In enterprise production, this key should be stored inside a Hardware Security Module (HSM) or cloud KMS.
3. **Simulated Storage:** Cloud drive storage is simulated in local persistent directories (`storage/current` and `storage/versions`). When deploying to services like Render or AWS ECS, persistent volumes must be mounted to prevent container restarts from wiping stored files.
