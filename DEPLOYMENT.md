# Deployment Guide

**Project Title:** Auditing Mechanism in Cloud Data Services  
**Model:** Version-Based Dynamic Cloud Data Auditing  
**Repository:** `https://github.com/TheHUNTER2714/Auditing-Mechanism-in-Cloud-Data-Services` (Branch: `main-2`)

---

## 1. Deploying on Render (Recommended Blueprint)

The repository includes a ready-to-use [`render.yaml`](file:///c:/Users/ayush/OneDrive/Desktop/research%20paper/bt032/render.yaml) blueprint declaring both the Python backend and Vite frontend services.

### Option A: Blueprints (1-Click)
1. Go to [Render Dashboard](https://dashboard.render.com/) → **Blueprints** → **New Blueprint Instance**.
2. Connect your GitHub repository: `https://github.com/TheHUNTER2714/Auditing-Mechanism-in-Cloud-Data-Services`.
3. Select branch: `main-2`.
4. Render will automatically detect `render.yaml` and provision:
   - **`auditing-mechanism-cloud-api`** (Python Web Service running Flask + Gunicorn)
   - **`auditing-mechanism-cloud-ui`** (Vite Static Site automatically pointed to the API host)
5. Click **Apply**.

### Option B: Manual Web Service Setup on Render
- **Name:** `auditing-mechanism-cloud-api`
- **Runtime:** `Python 3`
- **Build Command:** `cd backend && pip install -r requirements.txt`
- **Start Command:** `cd backend && gunicorn --workers 2 --bind 0.0.0.0:$PORT "app:create_app()"`
- **Environment Variables:**
  - `ENABLE_DEMO_TAMPER`: `true`
  - `CHAIN_SECRET`: (Generate random 32+ character string)
  - `K_TAG`: (Generate random 32+ character string)
  - `JWT_SECRET`: (Generate random 32+ character string)
  - `CORS_ORIGINS`: `*`

---

## 2. Deploying on SnapDeploy

1. Log into your [SnapDeploy](https://snapdeploy.com) dashboard.
2. Link repository: `https://github.com/TheHUNTER2714/Auditing-Mechanism-in-Cloud-Data-Services` with branch `main-2`.
3. Use the following build settings (also defined in [`snapdeploy.json`](file:///c:/Users/ayush/OneDrive/Desktop/research%20paper/bt032/snapdeploy.json)):
   - **Root Directory:** `frontend`
   - **Build Command:** `npm install && npm run build`
   - **Output Directory:** `dist`
4. Set Environment Variable:
   - `VITE_API_URL`: Your Render backend URL (e.g. `https://auditing-mechanism-cloud-api.onrender.com`).
5. Deploy.

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
