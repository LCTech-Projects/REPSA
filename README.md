# REPSA

**Renewables and Energy Planning for Sustainable Africa** — an open-source web platform for electricity demand and energy poverty modelling across African countries. Explore harmonised country–year indicators, reconstructed hourly demand, statistical nowcasts, cross-country comparison, and scenario simulation.

**Live app:** [https://repsa.org](https://repsa.org)

This repository contains the deployable application: a React frontend, a Flask API, runtime CSV panels, and trained model artefacts (`api/data/`, `api/ml_models/`). Use this document for local development, onboarding, and deployment.

---

## Architecture

```mermaid
flowchart LR
  subgraph browser [Browser]
    UI[React SPA]
  end
  subgraph api [Flask API]
    Routes[REST routes]
    Services[Services and ML]
    CSV[CSV data and joblib models]
  end
  subgraph external [External services]
    Neon[(Neon Postgres)]
    Resend[Resend email]
  end
  UI -->|VITE_API_URL| Routes
  Routes --> Services
  Services --> CSV
  Routes --> Neon
  Routes --> Resend
```

| Layer | Technology | Role |
|--------|------------|------|
| Frontend | React 19, TypeScript, Vite 6, Tailwind CSS 4, Redux Toolkit, D3 | SPA: map, charts, scenario simulation, auth UI |
| API | Flask 3.1, Flask-CORS, Flask-Caching | JSON REST API under `/api/*` |
| Auth DB | PostgreSQL (Neon) | Users, password hashes, email verification |
| Email | Resend | Verification and password-reset messages |
| Analytics data | CSV files under `api/data/` | Historical yearly/hourly panels (not in Postgres) |
| Models | `joblib` under `api/ml_models/` | Scenario builder (`scenario_builder.joblib`) |

The API reads **energy data from the filesystem**, not from Postgres. Postgres is used **only for authentication**.

**Maintainer pipeline:** `api/preprocess/` holds scripts to regenerate CSVs, reconstruct hourly demand from anchor profiles, retrain models, and produce validation charts. These scripts are **not required at runtime** (committed CSVs and joblib artefacts are served directly). The production Docker image excludes `api/preprocess/` via `.dockerignore`.

**Data scope (committed runtime assets):**

| Asset | Location | Coverage |
|--------|----------|----------|
| Yearly panel | `api/data/historical/yearly_historical_data.csv` | 54 African countries; population, demand, access, poverty, generation, renewable shares |
| Hourly demand | `api/data/historical/hourly/*.csv` | 54 countries, 2016–2023; reconstructed from three anchor load shapes |
| Scenario model | `api/ml_models/scenario_builder.joblib` | Random Forest growth-panel model for scenario simulation |

Combined data + models are ~360 MB in a full clone.

---

## Main features

### Authenticated app (`/in`)

| Route | Purpose |
|--------|---------|
| `/in/map` | Africa map with energy poverty choropleth, year filter, country hover summary |
| `/in/visualization` | Historical and nowcast charts; yearly and hourly views; CSV/JSON export |
| `/in/compare` | Multi-country comparison (up to five countries, one indicator, one year) |
| `/in/scenario-simulation` | Scenario Simulation — Explore or Business-as-usual modes, slider assumptions, forecast charts |
| `/in/download-data` | Bulk hourly CSV download per country (latest available year) |

Content pages include `/in/methodology`, `/in/data-sources`, `/in/documentation`, `/in/help`, and related links from the sidebar profile menu.

Legacy redirect: `/in/simulation` → `/in/scenario-simulation`.

### Auth (`/sign-in`, `/sign-up`, etc.)

Email/password registration with sign-in (JWT), forgot/reset password. Google sign-in UI is present but not wired to a provider. Email verification is currently disabled; new accounts are active immediately after sign-up.

**Download gating:** Exporting CSV/JSON on **Visualization** requires sign-in. Guests see a modal and can sign in or sign up; after authentication they return to the same view and the download continues automatically. **Download Data** bulk hourly CSVs remain open without an account.

---

## Repository layout

```
REPSA/
├── src/                    # React frontend
│   ├── app/                # Redux store, RTK Query, AuthContext, auth API
│   ├── pages/              # Route pages (auth, in/*)
│   ├── components/         # UI, charts, map (africa.geojson), modals
│   └── Routes.tsx
├── public/                 # Static assets (flags, images, favicon)
├── api/
│   ├── run.py              # Dev entry: python api/run.py
│   ├── wsgi.py             # Production WSGI entry (Gunicorn)
│   ├── start.sh            # Production startup script
│   ├── app/                # Flask application factory, routes, services
│   ├── data/               # Historical CSVs (hourly per country, yearly panel)
│   ├── ml_models/          # Trained joblib models (committed)
│   ├── preprocess/         # Maintainer scripts (regenerate data, train, validate)
│   └── requirements.txt
├── Dockerfile              # Multi-stage: Node build + Python runtime
├── railway.toml            # Railway deployment config
├── scripts/                # e.g. Africa GeoJSON build
└── index.html              # Vite entry
```

---

## Prerequisites

- **Node.js** 20+ and npm (matches Docker frontend stage)
- **Python 3.12** (recommended; 3.14 may lack prebuilt wheels for some deps)
- **PostgreSQL** connection string (e.g. [Neon](https://neon.tech)) for auth
- **Resend** API key for transactional email
- Disk space for the repo clone (~360 MB data + models combined)

---

## Local development

### 1. Clone and install frontend

```bash
npm install --legacy-peer-deps
```

(`--legacy-peer-deps` avoids a peer conflict between React 19 and `react-loader-spinner`.)

### 2. Configure frontend environment

Create `.env` in the repo root (or `src/.env.local`):

```env
VITE_API_URL=http://127.0.0.1:5000
```

### 3. Install and run the API

```bash
cd api
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
```

Create `api/.env`:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DB?sslmode=require
SECRET_KEY=your-flask-secret
JWT_SECRET_KEY=your-jwt-secret
EMAIL_SENDER_API_KEY=re_xxxxxxxx
RESEND_FROM_EMAIL=REPSA <onboarding@yourdomain.com>

# Optional
YEAR_FILTER_LIMIT=2023
REALTIME_CACHE_TIMEOUT=60
```

Start the API from the **repo root**:

```bash
python api/run.py
```

Server defaults to `http://127.0.0.1:5000`. On first run with `DATABASE_URL` set, SQLAlchemy creates auth tables via `db.create_all()`.

### 4. Run the frontend

```bash
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

### 5. Data and models

Historical CSVs and `scenario_builder.joblib` are included in git. After clone, the API can serve map, visualization, compare, scenario simulation, and downloads without running preprocess.

**Maintainers** — generate hourly profiles, retrain the scenario model, and refresh validation artefacts:

```bash
# Hourly reconstruction (see api/preprocess/README.md)
python api/preprocess/scripts/generate_hourly_from_anchors.py

# Scenario model + walk-forward validation charts
python api/preprocess/train/scenario_builder.py
```

Outputs include updated files under `api/data/historical/`, `api/ml_models/scenario_builder.joblib`, and metrics under `api/preprocess/charts/yearly_global_growth_paper/`. Commit updated runtime artefacts after validation.

---

## API overview

Base URL: `{VITE_API_URL}` (default `http://127.0.0.1:5000`). In production, the SPA and API share the same origin (`VITE_API_URL` empty at build time).

### Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness check (`{"status": "ok"}`) |

### Auth — `/api/auth`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/register` | Create account (sends verification email) |
| POST | `/sign-in` | Returns JWT + user |
| POST | `/verify-email` | Confirm email with code |
| POST | `/resend-verification` | Resend code |
| POST | `/forgot-password` | Send reset code |
| POST | `/reset-password` | Set new password |
| GET | `/me` | Current user (Bearer token) |

### Historical — `/api/historical`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/country-details` | Country time series and key figures |
| GET | `/country-summary` | Summary for a country/year |
| GET | `/all-countries-energy-poverty` | Map overlay data |
| GET | `/available-countries` | Country list |
| GET | `/available-years` | Available years |
| GET | `/hourly-electricity-demand` | Hourly demand (query: country, year/date/month, format) |
| GET | `/energy-poverty` | Energy poverty series |
| GET | `/electricity-demand` | Electricity demand series |

### Realtime — `/api/realtime`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/realtime-data?country=` | Statistical nowcast of current-year indicators (cached) |

These are trend-based estimates, not live grid telemetry.

### Scenario simulation — `/api/scenario-simulation`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/simulate-scenario` | Run scenario from parameters |

Example request body:

```json
{
  "country": "Kenya",
  "start_year": 2025,
  "target_year": 2050,
  "scenario_mode": "explore",
  "scenario_params": {
    "renewable_target": 80,
    "energy_access_target": 100,
    "clean_cooking_target": 70,
    "population_growth_rate": 0.025
  }
}
```

`scenario_mode`: `explore` (user targets + population growth) or `bau` (historical CAGR extrapolation). Legacy field `policy_metrics` is accepted as an alias for `scenario_params`.

---

## Frontend structure (for contributors)

- **State:** Redux Toolkit + RTK Query in `src/app/appSlices/apiSlice.ts`; `AuthContext` + `authStorage` for JWT.
- **Scenario UI:** `src/pages/in/Simulation.tsx`, charts in `src/components/scenario/ScenarioExplorerCharts.tsx`.
- **Auth forms:** `react-hook-form` + Zod in `src/components/utils/Validations.ts`.
- **Styling:** Tailwind theme in `src/index.css` (`blue-1`, `yellow-1`, etc.).
- **Paths:** Imports use `pages/` and `components/` (lowercase). On Windows, align folder casing with git to avoid TypeScript `TS1261` warnings.

### Useful commands

```bash
npm run dev      # Development server
npm run build    # Production build → dist/
npm run preview  # Preview production build
npm run lint     # ESLint
```

---

## Production deployment

Production uses a **single Docker monolith**: Node builds the SPA; Python serves `/api/*` and static files from `api/static/dist/`.

### Railway (repsa.org)

1. Connect the GitHub repo to [Railway](https://railway.app).
2. Railway reads `railway.toml` and builds from the root `Dockerfile`.
3. Set environment variables in the Railway dashboard (same as `api/.env` above).
4. Health check: `GET /health` (timeout 300 s in `railway.toml`).
5. Gunicorn listens on `PORT` (default **8080** in the Dockerfile).

### Local Docker smoke test

```bash
docker build -t repsa .
docker run --rm -p 8080:8080 -e DATABASE_URL=... -e SECRET_KEY=... repsa
```

Build with `VITE_API_URL=` (empty) so the browser calls `/api/*` on the same host.

---

## Environment variables reference

### `api/.env`

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes (auth) | Postgres connection string |
| `SECRET_KEY` | Yes | Flask secret |
| `JWT_SECRET_KEY` | Recommended | JWT signing key |
| `EMAIL_SENDER_API_KEY` | Yes (auth emails) | Resend API key |
| `RESEND_FROM_EMAIL` | Recommended | From address for Resend |
| `JWT_ACCESS_EXPIRES_MINUTES` | No | Default `10080` (7 days) |
| `YEAR_FILTER_LIMIT` | No | Max filter year (default `2023`) |
| `REALTIME_CACHE_TIMEOUT` | No | Realtime cache seconds (default `60`) |
| `CORS_ORIGINS` | No | Comma-separated origins if needed |

### Frontend

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | No | API base URL; defaults to `http://127.0.0.1:5000`. Empty in production Docker build. |

Never commit `.env` files. Rotate any keys that were exposed in chat or logs.

---

## Troubleshooting

| Issue | Likely cause |
|-------|----------------|
| `SSL connection has been closed unexpectedly` on sign-in | Stale Neon connection; restart API (pool pre-ping is configured) |
| Pyright/import errors for `resend` | Wrong Python interpreter; use 3.12 and `pip install -r api/requirements.txt` |
| Empty map or 500 on historical routes | Missing `api/data/` CSVs |
| Scenario simulation fails | Missing `api/ml_models/scenario_builder.joblib` on server |
| CORS errors in browser | API not running or `VITE_API_URL` mismatch |
| `TS1261` file name casing | Align `src/pages` vs `Pages` with git on Windows |
| Unicode errors running preprocess on Windows | Set `PYTHONIOENCODING=utf-8` |

---

## Citation and attribution

When using REPSA in research or policy work, cite the platform and note which layer you used (yearly panel, hourly reconstruction, statistical nowcast, or scenario simulation). Methodology and data provenance are documented at `/in/methodology` and `/in/data-sources`.

Acknowledge underlying data providers (World Bank, Our World in Data, Eskom, Nigeria suppressed-demand dataset, Morocco electricity-demand dataset, and others listed in the app). Hourly profiles for non-anchor countries are reconstructed model outputs, not measured system data.

## License

This project is licensed under the [MIT License](LICENSE).
