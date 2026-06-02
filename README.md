# REPSA

**Renewables and Energy Planning for Sustainable Africa** — an open web platform for exploring energy poverty, historical and near-real-time electricity indicators, cross-country comparison, and scenario planning across African countries.

This repository contains the **deployable application**: a React frontend, a Flask API, and the runtime assets they need (`api/data/`, `api/ml_models/`). Use this document for local development, onboarding, and deployment planning.

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
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, Redux Toolkit, D3 | SPA: map, charts, simulation, auth UI |
| API | Flask 3, Flask-CORS, Flask-Caching | JSON REST API under `/api/*` |
| Auth DB | PostgreSQL (Neon) | Users, password hashes, email verification |
| Email | Resend | Verification and password-reset messages |
| Analytics data | CSV files under `api/data/` | Historical yearly/hourly panels (not in Postgres) |
| Models | `joblib` under `api/ml_models/` | Scenario builder (`scenario_builder.joblib`) |

The API reads **energy data from the filesystem**, not from Postgres. Postgres is used **only for authentication**.

**Not in this repo:** `api/preprocess/` (gitignored) holds maintainer scripts to regenerate CSVs, retrain models, and run validation. **Runtime assets are in the repo:** historical CSVs under `api/data/historical/` (~330 MB hourly + yearly panel) and `api/ml_models/scenario_builder.joblib`, which the API loads for scenario simulation.

---

## Main features

### Authenticated app (`/in`)

| Route | Purpose |
|--------|---------|
| `/in` | Home and onboarding |
| `/in/map` | Africa map, energy poverty overlay, country hover summary |
| `/in/visualization` | Historical / realtime charts, yearly and hourly views, data download |
| `/in/compare` | Multi-country comparison |
| `/in/simulation` | Scenario builder (slider-driven forecasts) |

### Auth (`/sign-in`, `/sign-up`, etc.)

Email/password registration with verification codes, sign-in (JWT), forgot/reset password. Google sign-in UI is present but not wired to a provider.

**Download gating:** Exporting CSV/JSON on Visualization requires sign-in. Guests see a modal and are returned after login with the chosen format downloaded automatically.

---

## Repository layout

```
REPSA/
├── src/                    # React frontend
│   ├── app/                # Redux store, RTK Query, AuthContext, auth API
│   ├── pages/              # Route pages (auth, in/*)
│   ├── components/         # UI, modals, inputs, charts helpers
│   └── Routes.tsx
├── public/                 # Static assets (flags, images, favicon)
├── api/
│   ├── run.py              # Dev entry: python api/run.py
│   ├── app/                # Flask application factory and routes
│   ├── data/               # Historical CSVs (hourly per country, yearly panel)
│   ├── ml_models/          # Trained joblib models (committed)
│   └── requirements.txt
├── scripts/                # e.g. Africa GeoJSON build
└── index.html              # Vite entry
```

`api/preprocess/` may exist on your machine for rebuilding data and models; it is **not published to GitHub**.

---

## Prerequisites

- **Node.js** 18+ and npm
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

Create `src/.env` (or `.env.local`):

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

**Historical CSVs** (`api/data/historical/`) and **`api/ml_models/`** are included in git. After clone, the API can serve map, visualization, simulation, and story mode without running preprocess.

To regenerate data or retrain models, maintainers use `api/preprocess/` locally, then commit updated files under `api/data/historical/` and/or `api/ml_models/`.

Retrain the scenario builder (maintainers, local `api/preprocess/`):

```bash
python api/preprocess/train/scenario_builder.py
```

---

## API overview

Base URL: `{VITE_API_URL}` (default `http://127.0.0.1:5000`).

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

Includes country summary, country details, available years/countries, energy poverty map data, hourly electricity demand, and related endpoints used by Map, Visualization, and Compare.

### Realtime — `/api/realtime`

Near-real-time style indicators per country (cached; see `REALTIME_CACHE_TIMEOUT`).

### Scenario simulation — `/api/story-mode`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/simulate-scenario` | Run scenario builder from manual parameters (`policy_metrics` or `scenario_params`) |

---

## Frontend structure (for contributors)

- **State:** Redux Toolkit + RTK Query in `src/app/appSlices/apiSlice.ts` for data APIs; `AuthContext` + `authStorage` for JWT.
- **Auth forms:** `react-hook-form` + Zod schemas in `src/components/utils/Validations.ts`.
- **Modals:** `src/components/modals/` (onboarding, country summary, sign-in required, logout confirm, feedback).
- **Styling:** Tailwind theme in `src/index.css` (`blue-1`, `yellow-1`, etc.).
- **Paths:** Imports use `pages/` and `components/` (lowercase). On Windows, the folder may display as `Pages`; align casing with git to avoid TypeScript `TS1261` warnings.

### Useful commands

```bash
npm run dev      # Development server
npm run build    # Production build → dist/
npm run preview  # Preview production build
npm run lint     # ESLint
```

---

## Production deployment

**Railway (monolith, repsa.org):** see [DEPLOY.md](DEPLOY.md) for Dockerfile, `railway.toml`, env vars, and first-deploy steps.

REPSA is **two deployable parts** plus external services in development; production uses a **single Railway service** that serves the built React app and Flask API together.

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
| `REALTIME_CACHE_TIMEOUT` | No | Realtime cache seconds |

### Frontend

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | No | API base URL; defaults to `http://127.0.0.1:5000` |

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

---

## License and attribution

Add your license and citation text here if applicable. REPSA is intended as a research and planning tool for African energy systems; acknowledge data sources and model limitations in public deployments.
