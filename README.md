# Auditing Mechanism in Cloud Data Services

> **Academic B.Tech Engineering Prototype**  
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

This project implements a lightweight, tamper-evident verification engine termed **Version-Based Dynamic Cloud Data Auditing**. It establishes cryptographic accountability over **simulated cloud storage** through streaming SHA-256 hashing, secret-anchored HMAC-SHA256 version chaining, and client-held verification receipts.

---

## 2. Cryptographic Architecture

### 2.1 Content Hash ($D_v$)
Every file uploaded or updated is streamed in 1 MB chunks to calculate a deterministic SHA-256 digest:
$$D_v = \text{SHA-256}(\text{file bytes})$$

### 2.2 Genesis Anchor ($HC_0$)
Upon initial file registration ($V_1$), an initial genesis block is derived using a server-side secret key:
$$HC_0 = \text{HMAC-SHA256}(CHAIN\_SECRET, \text{"genesis|" } + file\_id)$$

### 2.3 Version Chain Block ($HC_v$)
Each authorized revision $V_v$ links the current content digest to the previous version's signature:
$$HC_v = \text{HMAC-SHA256}(CHAIN\_SECRET, f"\{file\_id\}|\{v\}|\{D_v\}|\{HC_{v-1}\}|\{created\_at\_utc\_iso\}")$$

- **Fixed UTC Timestamps:** ISO-8601 strings are generated once, stored in SQLite, and reused during audit verification.
- **Secret Isolation:** `CHAIN_SECRET` resides strictly in the environment configuration. It is **never stored in SQLite and never returned across any API endpoint**, ensuring attackers with database write access cannot forge valid signatures.
- **Owner Receipts:** The client caches verification receipts in `localStorage` (`{file_id, version, chain_hash, created_at}`). Audits verify the server's chain head against the client's receipt to block server rollback attacks.

---

## 3. Strict Precedence Auditing Logic

When an audit is executed (`POST /api/files/<id>/audit`):
1. **Load Entity:** Resolves file record and version history from SQLite. Returns 404 if file does not exist.
2. **Chain Verification (Precedence 1):**
   - Verifies sequence continuity ($V_1, V_2, \dots, V_n$ without gaps or duplicates).
   - Recalculates HMAC signatures from genesis up to version $n$ using `CHAIN_SECRET`.
   - Validates that stored historical version blobs on disk match recorded content digests.
   - If an owner receipt is supplied, asserts stored version $\ge$ receipt version and hashes match.
   - *Failure condition:* Immediate verdict **`VERSION_HISTORY_ALTERED`**.
3. **Active Content Verification (Precedence 2):**
   - Streams SHA-256 of `storage/current/<file_id>`.
   - If active file is missing on disk: returns **`TAMPERED`** with `reason: "FILE_MISSING"`.
   - Compares computed hash to recorded head hash $D_{\text{latest}}$.
   - *Failure condition:* Returns **`TAMPERED`**.
4. **Final Resolution:**
   - Returns **`PASS`** with a trace of real execution steps and millisecond stopwatch timings.

---

## 4. REST API Reference

| Method | Endpoint | Description | Payload / Notes |
|---|---|---|---|
| `GET` | `/api/health` | Health & system metadata | Returns project title, model, and simulated storage indicator |
| `GET` | `/api/config` | System configuration | Returns demo mode status and upload limits |
| `POST` | `/api/files` | Initial file upload | Multipart `file` field; creates V1 and returns `{status: "RECORDED_VERSION", receipt}` |
| `POST` | `/api/files/<id>/versions` | Authorized version update | Multipart `file` field; appends $V_{n+1}$ linked to $V_n$ |
| `GET` | `/api/files` | File inventory | Returns list with head version, size, and last audit status |
| `GET` | `/api/files/<id>/versions`| Version history | Returns ordered blocks with hashes and activities (no secret) |
| `POST` | `/api/files/<id>/audit` | Full integrity audit | Optional `{ "receipt": {...} }`; returns `PASS`, `TAMPERED`, or `VERSION_HISTORY_ALTERED` |
| `POST` | `/api/files/<id>/verify-chain` | Chain-only audit | Verifies HMAC continuity and receipts without inspecting active disk payload |
| `GET` | `/api/audits` | Forensic audit ledger | Filter by `file_id` or `status` (`PASS`, `TAMPERED`, `VERSION_HISTORY_ALTERED`) |
| `GET` | `/api/stats` | Real-time SQLite counters| Computed directly from SQLite database rows |
| `POST` | `/api/demo/tamper-file/<id>`| [DEMO] Disk file tampering | Directly corrupts bytes in `storage/current/<id>` (gated by flag) |
| `POST` | `/api/demo/tamper-history/<id>`| [DEMO] SQLite row tampering| Mutates version row in SQLite (gated by flag) |
| `POST` | `/api/demo/reset` | [DEMO] Reset storage & DB | Cleans simulated storage and wipes database tables |
| `POST` | `/api/demo/seed` | [DEMO] Load demo dataset | Seeds clean verified demo files with history |

---

## 5. Local Setup and Execution Guide

### 5.1 Backend Setup (Python 3.11+)

1. Navigate to the backend directory:
   ```powershell
   cd "bt032/backend"
   ```

2. Initialize virtual environment and install dependencies:
   ```powershell
   py -3 -m venv venv
   .\venv\Scripts\pip.exe install -r requirements.txt
   ```

3. Run the complete test suite (all 13 tests must pass):
   ```powershell
   .\venv\Scripts\pytest.exe -v
   ```

4. Start the backend server on port 5000:
   ```powershell
   $env:ENABLE_DEMO_TAMPER="true"
   $env:CHAIN_SECRET="bt032_cloud_audit_secret_key_2026"
   .\venv\Scripts\python.exe app.py
   ```

### 5.2 Frontend Setup (Node 18+)

1. Navigate to the frontend directory:
   ```powershell
   cd "bt032/frontend"
   ```

2. Install dependencies:
   ```powershell
   npm.cmd install
   ```

3. Start the Vite development server on port 5173:
   ```powershell
   npm.cmd run dev
   ```

4. Open **http://localhost:5173** in any web browser.

---

## 6. Official Demonstration Script

1. **Start System:** Launch the backend with `ENABLE_DEMO_TAMPER=true` and start the frontend.
2. **Initial Upload:** Navigate to `/upload` and upload `test.txt`. Observe the result card displaying `V1 CREATED`, real SHA-256 digest, and receipt cached in `localStorage`.
3. **Verify Integrity:** Click **"Run Full Audit"** $\rightarrow$ witness verdict **`Data Integrity Verified (PASS)`** with real millisecond stopwatch step timings.
4. **Authorized Update:** Navigate to `/files`, click **"Update File"**, and upload an updated revision. Observe creation of Version $V_2$ chained to $V_1$. Run audit $\rightarrow$ still returns **`PASS`**.
5. **Simulate Attacker Disk Corruption:** In the files table, click **"[Tamper Disk]"**. This injects silent corruption directly into `storage/current/<file_id>`. Click **"Run Full Audit"** $\rightarrow$ observe verdict **`Storage Corruption Detected (TAMPERED)`**!
6. **Simulate Attacker History Tampering:** Click **"Reset Storage & DB"**, upload a file, update it once, then click **"[Tamper DB]"** (mutates $V_1$ content hash directly in SQLite). Click **"Verify Chain"** $\rightarrow$ observe verdict **`Cryptographic Chain Broken (VERSION_HISTORY_ALTERED)`**!
7. **Forensic Audit Log:** Navigate to `/audits` to inspect all verification traces recorded permanently in the SQLite forensic ledger.

---

## 7. Honest Academic Scope and Limitations

To maintain academic rigor and transparency:
1. **Simulated Storage:** Cloud storage is simulated using isolated local directories (`storage/current` and `storage/versions`). Commercial cloud APIs (AWS S3, Google Cloud Storage) are not invoked.
2. **Full-File Streaming vs PDP Sampling:** This prototype streams SHA-256 over 1 MB chunks. While computationally feasible for prototype workloads up to 25 MB, large multi-gigabyte cloud archives benefit from sampling-based Provable Data Possession (PDP).
3. **Key Isolation:** The HMAC secret is kept in the environment outside SQLite. Production implementations would anchor this key in a Hardware Security Module (HSM) or cloud Key Management Service (KMS).
4. **Authentication Scope:** Access control and RBAC are omitted for demonstration clarity. Authorized operations are designated by invoking the designated update API endpoint.
