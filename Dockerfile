# REPSA monolith: React SPA + Flask API (Railway)
# Build from repo root: docker build -t repsa .

FROM node:20-bookworm-slim AS frontend

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json eslint.config.js ./
COPY src ./src
COPY public ./public

# Same-origin API in production (Flask serves /api/* on the same host).
ENV VITE_API_URL=
RUN npm run build


FROM python:3.12-slim AS runtime

WORKDIR /app/api

RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq5 \
    && rm -rf /var/lib/apt/lists/*

COPY api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY api/ .

COPY --from=frontend /app/dist ./static/dist

ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app/api

EXPOSE 8080

CMD ["sh", "-c", "gunicorn wsgi:app --bind 0.0.0.0:${PORT:-8080} --workers 1 --threads 4 --timeout 120 --access-logfile - --error-logfile -"]
