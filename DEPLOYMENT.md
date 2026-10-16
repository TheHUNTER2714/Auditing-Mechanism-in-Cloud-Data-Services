# Deployment Guide

**Project Title:** Auditing Mechanism in Cloud Data Services  
**Model:** Version-Based Dynamic Cloud Data Auditing  
**Repository:** `https://github.com/TheHUNTER2714/Auditing-Mechanism-in-Cloud-Data-Services` (Branch: `main-2`)

---

## 1. Deploying on Render

Render is the recommended hosting platform because it natively supports both the **Python Flask Web Service** (backend API, database, cryptography, scheduler) and the **Vite + React Static Site** (frontend UI).

### Option A: 1-Click Blueprint (Recommended)

1. Open [Render Dashboard](https://dashboard.render.com/) and click **New +** → **Blueprint**.
2. Connect your GitHub repository: `https://github.com/TheHUNTER2714/Auditing-Mechanism-in-Cloud-Data-Services`.
3. In the branch field, make sure to select: **`main-2`** (the active branch).
4. Render will detect [`render.yaml`](file:///c:/Users/ayush/OneDrive/Desktop/research%20paper/bt032/render.yaml) and automatically configure two services:
   - **`auditing-mechanism-cloud-api`** (Python Web Service running Flask + Gunicorn)
   - **`auditing-mechanism-cloud-ui`** (React Static Site with SPA routing and automatic API URL linkage)
5. Click **Apply**.
6. Once deployed, Render gives you a public URL for the UI (e.g., `https://auditing-mechanism-cloud-ui.onrender.com`) and the API (e.g., `https://auditing-mechanism-cloud-api.onrender.com`).

---

### Option B: Manual Service Creation on Render

If you prefer to configure the services manually on Render instead of using the Blueprint:

#### Step 1: Deploy Backend Web Service
1. Click **New +** → **Web Service**.
2. Connect `https://github.com/TheHUNTER2714/Auditing-Mechanism-in-Cloud-Data-Services` (Branch: **`main-2`**).
3. Fill in the service configuration:
   - **Name:** `auditing-mechanism-cloud-api`
   - **Region:** `Oregon (US West)` or nearest
   - **Root Directory:** `backend`
   - **Runtime:** `Python 3`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `gunicorn --workers 1 --threads 4 --bind 0.0.0.0:$PORT "app:create_app()"`
   - **Instance Type:** `Free`
4. Add **Environment Variables**:
   - `PYTHON_VERSION`: `3.11.9`
   - `ENABLE_DEMO_TAMPER`: `true`
   - `CHAIN_SECRET`: *(Any 32-character random string, e.g. `bt032_cloud_chain_secret_key_2026_xyz`)*
   - `K_TAG`: *(Any 32-character random string, e.g. `bt032_k_tag_secret_integrity_2026_abc`)*
   - `JWT_SECRET`: *(Any 32-character random string, e.g. `bt032_auth_token_jwt_secret_2026_jwt`)*
   - `CORS_ORIGINS`: `*`
5. Click **Create Web Service**. Wait for it to deploy and copy your backend URL (e.g. `https://auditing-mechanism-cloud-api.onrender.com`).

#### Step 2: Deploy Frontend Static Site
1. Click **New +** → **Static Site**.
2. Connect `https://github.com/TheHUNTER2714/Auditing-Mechanism-in-Cloud-Data-Services` (Branch: **`main-2`**).
3. Fill in the build settings:
   - **Name:** `auditing-mechanism-cloud-ui`
   - **Root Directory:** `frontend`
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `dist`
4. Add **Environment Variable**:
   - `VITE_API_URL`: Your backend URL from Step 1 (e.g. `https://auditing-mechanism-cloud-api.onrender.com`).
5. Under **Redirects/Rewrites**:
   - Add a rewrite rule:
     - **Source:** `/*`
     - **Destination:** `/index.html`
     - **Action:** `Rewrite`
6. Click **Create Static Site**.

---

## 2. Why SnapDeploy Had Issues & How to Use It (If Desired)

- **Root Cause of SnapDeploy failure:** SnapDeploy is typically designed only for static HTML/JS frontend hosting or edge functions. It does **not** run persistent Python WSGI backend processes with SQLite databases and background daemon threads.
- The repository's `snapdeploy.json` was set to proxy `/api/*` to `https://auditing-mechanism-cloud-api.onrender.com`. If the Render backend was not yet deployed and active, any request to SnapDeploy returned a network error or 502/404.
- **To use SnapDeploy properly for frontend:**
  1. First deploy the Python backend on **Render** (as shown in Step 1 above).
  2. In SnapDeploy, set the Environment Variable `VITE_API_URL` to your Render backend URL (e.g. `https://auditing-mechanism-cloud-api.onrender.com`).
  3. Deploy the frontend on SnapDeploy with Root Directory `frontend`, Build Command `npm install && npm run build`, and Output Directory `dist`.

---

## 3. Local Verification

1. **Start Backend:**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # or venv\Scripts\activate on Windows
   pip install -r requirements.txt
   python app.py
   ```
   *Runs at `http://localhost:5000`*

2. **Start Frontend:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   *Runs at `http://localhost:5173`*
