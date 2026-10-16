# ==============================================================================
# Production Multi-Stage Dockerfile for SnapDeploy, Render, and Container Clouds
# ==============================================================================

# Stage 1: Build the React + Vite Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# Stage 2: Python Flask Backend + Embedded SPA Serving
FROM python:3.11-slim
WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PORT=5000 \
    ENABLE_DEMO_TAMPER=true \
    FRONTEND_DIST_DIR=/app/frontend/dist

# Install lightweight dependencies
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r ./backend/requirements.txt

# Copy backend source
COPY backend/ ./backend/

# Copy compiled frontend from Stage 1
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:${PORT:-5000}/api/health || exit 1

CMD ["sh", "-c", "cd backend && gunicorn --workers 1 --threads 4 --bind 0.0.0.0:${PORT:-5000} 'app:create_app()'"]
