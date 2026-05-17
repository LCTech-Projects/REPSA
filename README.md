# REPSA

**Renewables and Energy Planning for Sustainable Africa** — an open web platform for exploring energy poverty, historical and near-real-time electricity indicators, cross-country comparison, policy analysis, and scenario planning across African countries.

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
| Models | `joblib` under `api/ml_models/` | Forecasting, scenario builder, hourly shapes |

The API reads **energy data from the filesystem**, not from Postgres. Postgres is used **only for authentication**.

**Not in this repo:** `api/preprocess/` holds local-only scripts for training models, regenerating CSVs, and research validation. That folder is gitignored and is not required to run the hosted app if you already have `api/data/` and `api/ml_models/`.

---

## Main features

### Authenticated app (`/in`)

| Route | Purpose |
|--------|---------|
| `/in` | Home and onboarding |
| `/in/map` | Africa map, energy poverty overlay, country hover summary |
| `/in/visualization` | Historical / realtime charts, yearly and hourly views, data download |
| `/in/compare` | Multi-country comparison |
| `/in/simulation` | Scenario builder and policy analyzer (story mode) |

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
│   ├── ml_models/          # Trained models (often gitignored; see below)
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
- Disk space for `api/data/` and `api/ml_models/` (not fully committed to git)

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
USE_NLP=false
USE_ML_FORECASTING=true
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

### 5. Data and models (required for full functionality)

Many paths under `api/data/historical/` and `api/ml_models/` are **gitignored**. Without them, map/historical/simulation endpoints may error or return empty results.

Obtain or build those assets through your team’s internal workflow. The runtime API does **not** import `api/preprocess/`; that directory is only for maintainers who regenerate CSVs or retrain models locally (gitignored).

Canonical yearly panel path: `api/data/historical/yearly_historical_data.csv`.

Optional spaCy for richer policy NLP:

```bash
pip install spacy
python -m spacy download en_core_web_sm
# Set USE_NLP=true in api/.env
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

### Story mode — `/api/story-mode`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/analyze-policy` | NLP/policy analysis and forecasts |
| POST | `/simulate-scenario` | Scenario builder from policy metrics |

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

REPSA is **two deployable parts** plus external services. Typical shared hosting (PHP/static only) cannot run the Python API with pandas, scikit-learn, and optional spaCy.

### Recommended split

| Component | Suggested hosting |
|-----------|-------------------|
| Frontend (`dist/`) | Static host: Netlify, Cloudflare Pages, S3+CDN, or any web host |
| Flask API | VPS, Railway, Render, Fly.io, or similar with Python 3.12 |
| Database | Neon Postgres (or any managed Postgres) |
| Email | Resend with a verified domain |

### Frontend build

```bash
npm run build
```

Deploy contents of `dist/`. Set `VITE_API_URL` to the public API origin **at build time**.

Configure the static host so client routes fall back to `index.html` (SPA).

### API production notes

- Run with **gunicorn** (or similar), not Flask’s dev server.
- Set `DATABASE_URL`, secrets, and Resend variables on the host.
- `SQLALCHEMY_ENGINE_OPTIONS` uses `pool_pre_ping` and `pool_recycle` for Neon-style Postgres (see `api/app/utils/config.py`).
- Ensure `api/data/` and `api/ml_models/` are present on the server or mounted from storage.
- Enable CORS for your frontend origin (Flask-CORS is installed; tighten origins in production).
- Optional: Redis for `ProductionConfig` caching if you switch `CACHE_TYPE`.

### What not to use for the full stack

UK2 (and similar) **shared Linux hosting** plans are fine for the static site and email domains, but not for the Flask + ML API. Use their **VPS** tier or a Python PaaS for the API.

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
| `USE_NLP` | No | `true` to enable spaCy policy NLP |
| `NLP_BACKEND` / `NLP_MODEL_NAME` | No | NLP configuration |
| `USE_ML_FORECASTING` | No | Default `true` |
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
| Simulation / policy analysis fails | Missing `api/ml_models/` or run training scripts |
| CORS errors in browser | API not running or `VITE_API_URL` mismatch |
| `TS1261` file name casing | Align `src/pages` vs `Pages` with git on Windows |

---

## License and attribution

Add your license and citation text here if applicable. REPSA is intended as a research and planning tool for African energy systems; acknowledge data sources and model limitations in public deployments.
