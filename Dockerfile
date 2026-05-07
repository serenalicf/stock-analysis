# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — Build React frontend
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Install dependencies first (layer-cached unless package.json changes)
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --silent

# Copy source and build
COPY frontend/ ./
RUN npm run build
# Output lands at /app/static  (vite.config.js: outDir: '../static')


# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — Python runtime
# ─────────────────────────────────────────────────────────────────────────────
FROM python:3.11-slim AS runtime

# Security: run as non-root user
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser

WORKDIR /app

# Install Python deps (layer-cached unless requirements.txt changes)
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY main.py scoring.py ./
COPY data/ ./data/

# Copy built React output from stage 1
COPY --from=frontend-builder /app/static ./static/

# Switch to non-root
USER appuser

# Expose port
EXPOSE 8000

# Healthcheck — Docker/Claw Cloud can auto-restart on failure
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD sh -c "python -c \"import urllib.request; urllib.request.urlopen('http://localhost:${PORT:-8000}/health')\""

# Start uvicorn — use $PORT if set (required by Render), fallback to 8000
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 2 --log-level info"]
