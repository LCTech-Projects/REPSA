# Railway deployment — REPSA monolith (repsa.org)

Single Railway service serves the React app and Flask API from one container.

## Files added

| File | Purpose |
|------|---------|
| `Dockerfile` | Builds frontend + Python API image |
| `railway.toml` | Railway build/deploy settings |
| `.dockerignore` | Keeps image smaller |
| `api/wsgi.py` | Gunicorn entrypoint |

## 1. Push to GitHub

Ensure `api/data/` and `api/ml_models/` are committed (required at runtime).

## 2. Create Railway project

1. [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
2. Select the REPSA repository
3. Railway reads `railway.toml` and builds with the root `Dockerfile`

## 3. Service settings

**Settings → Resources**

- RAM: start with **512 MB**; increase to **1 GB** if simulation or hourly exports fail

**Settings → Networking**

- Generate a Railway domain first (for testing)
- Add custom domain **repsa.org** (and optionally **www.repsa.org**)
- Point DNS to Railway as shown in the dashboard

## 4. Environment variables

In **Variables**, set:

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | Yes | Neon Postgres connection string |
| `SECRET_KEY` | Yes | Random hex string |
| `JWT_SECRET_KEY` | Yes | Random hex string |
| `EMAIL_SENDER_API_KEY` | Yes | Resend API key |
| `RESEND_FROM_EMAIL` | Yes | e.g. `REPSA <noreply@repsa.org>` (domain verified in Resend) |
| `CORS_ORIGINS` | Optional | `https://repsa.org,https://www.repsa.org` |
| `YEAR_FILTER_LIMIT` | Optional | Default `2023` |
| `DB_AUTO_CREATE_TABLES` | First deploy only | Set to `true` once, redeploy, then **remove** |

Do **not** set `VITE_API_URL` on Railway — the Docker build uses same-origin (`""`).

## 5. First deploy — create auth tables

**Option A (recommended):** Set `DB_AUTO_CREATE_TABLES=true`, deploy, confirm sign-up works, then delete the variable and redeploy.

**Option B:** Railway shell / one-off command:

```bash
python init_db.py
```

(from `/app/api` inside the container)

## 6. Verify

- `https://repsa.org/health` → `{"status":"ok"}`
- `https://repsa.org/in` → app loads
- `https://repsa.org/api/historical/available-countries` → JSON list
- Register / sign-in → Resend email + Neon auth

## 7. Local production smoke test

```bash
docker build -t repsa .
docker run --rm -p 8080:8080 --env-file api/.env -e PORT=8080 repsa
```

Open `http://localhost:8080`

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Build fails on `npm run build` | Check Node deps; build uses `npm ci --legacy-peer-deps` |
| 502 / slow first request | Neon cold start; wait or disable scale-to-zero on Neon |
| OOM on simulation | Increase Railway RAM to 1 GB |
| Auth emails fail | Verify domain in Resend; check `RESEND_FROM_EMAIL` |
| SPA routes 404 on refresh | Ensure `static/dist` exists in image (Docker build includes it) |

## Cost reminder

~**$69/year** floor: Railway Hobby ($5/mo) + domain (~$9/yr) + Neon Free + Resend Free.
