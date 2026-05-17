
# ---------------------------------------------------------
# Policy analyzer (REGEX + optional spaCy via HybridExtractor)
# - No OpenAI/Anthropic dependence here.
# - Connects to nlp_extractor through HybridExtractor.extract(...)
# - Actually uses: nlp_backend + country
# ---------------------------------------------------------

import os
import re
from typing import Dict, List, Optional, Any, TYPE_CHECKING

import numpy as np
import pandas as pd
import joblib

try:
    from sklearn.ensemble import RandomForestRegressor
    SKLEARN_AVAILABLE = True
except ImportError:
    RandomForestRegressor = None
    SKLEARN_AVAILABLE = False

from app.utils.config import Config
from app.utils.per_capita_units import (
    YEARLY_PER_CAPITA_MWH,
    YEARLY_PER_CAPITA_WITH_ACCESS_MWH,
    add_yearly_per_capita_mwh_columns,
    yearly_per_capita_mwh,
)

# Optional NLP
try:
    from app.services.story_mode.nlp_extractor import HybridExtractor
    NLP_AVAILABLE = True
except ImportError:
    HybridExtractor = None
    NLP_AVAILABLE = False

# Optional ML forecasting
try:
    from app.utils.ml_forecasting import MLForecaster
    ML_FORECASTING_AVAILABLE = True
except ImportError:
    MLForecaster = None
    ML_FORECASTING_AVAILABLE = False

# Type-only imports to avoid "Variable not allowed in type expression"
if TYPE_CHECKING:
    from app.services.story_mode.nlp_extractor import HybridExtractor as HybridExtractorType
    from app.utils.ml_forecasting import MLForecaster as MLForecasterType


class PolicyAnalyzer:
    """
    Extract policy metrics + produce baseline forecasts + apply policy adjustments.

    Connection to NLP:
      - If use_nlp=True and HybridExtractor available, we call:
          HybridExtractor.extract(policy_text, regex_extractor_fn)
      - HybridExtractor returns a merged metrics dict (NLP-first, regex fallback).
      - Country can be extracted by NLP (GPE) and used downstream.

    Notes:
      - This file does NOT call OpenAI.
      - nlp_backend is passed into HybridExtractor so you can switch spaCy models.
    """

    def __init__(
        self,
        use_nlp: Optional[bool] = None,
        nlp_backend: Optional[str] = None,
        use_ml_forecasting: Optional[bool] = None,
        yearly_data_path: Optional[str] = None,
        default_country: str = "Algeria",
        verbose: bool = True,
    ):
        self.verbose = verbose
        self.default_country = default_country

        # Config defaults
        if use_nlp is None:
            use_nlp = getattr(Config, "USE_NLP", False)
        if nlp_backend is None:
            nlp_backend = getattr(Config, "NLP_BACKEND", "spacy")
        if use_ml_forecasting is None:
            use_ml_forecasting = True

        self.use_nlp = bool(use_nlp and NLP_AVAILABLE and HybridExtractor is not None)
        self.nlp_backend = nlp_backend
        self.nlp_extractor: Optional["HybridExtractorType"] = None

        # Historical path
        data_dir = getattr(Config, "DATA_DIR", None)
        if yearly_data_path:
            self.yearly_data_path = yearly_data_path
        else:
            self.yearly_data_path = (
                os.path.join(data_dir, "historical", "yearly_historical_data.csv")
                if data_dir else None
            )

        self.historical_data = self._load_historical_data(self.yearly_data_path)

        # Init NLP extractor (spaCy)
        if self.use_nlp:
            try:
                spacy_model = getattr(Config, "NLP_MODEL_NAME", "en_core_web_sm")
                self.nlp_extractor = HybridExtractor(
                    nlp_backend=self.nlp_backend,
                    use_nlp=True,
                    model=spacy_model,
                    verbose=verbose,
                )
                if self.verbose:
                    print(f"✅ NLP enabled: backend={self.nlp_backend}")
            except Exception as e:
                self.use_nlp = False
                self.nlp_extractor = None
                if self.verbose:
                    print(f"⚠️  NLP init failed ({self.nlp_backend}): {e}")
                    print("   Falling back to regex-only.")

        # ML forecaster is initialized lazily only when analyze-policy path needs it.
        self.use_ml_forecasting = bool(use_ml_forecasting and ML_FORECASTING_AVAILABLE and MLForecaster is not None)
        self.ml_forecaster: Optional["MLForecasterType"] = None

        self.scenario_feature_columns = [
            "access_to_electricity_pct",
            "clean_cooking_access_pct",
            "renewables_share_elec",
            "electricity_demand_twh",
            "population",
            "gdp",
            "fossil_share_elec",
            "low_carbon_share_elec",
            "year",
        ]
        self.scenario_target_columns = [
            "electricity_demand_per_capita_mwh",
            "electricity_demand_per_capita_with_access_mwh",
            "energy_poverty_pct",
            "energy_poverty_multidimensional_pct",
            "greenhouse_gas_emissions",
        ]
        self.scenario_models: Dict[str, Any] = {}
        self.scenario_country_codes: Dict[str, int] = {}
        self.scenario_feature_medians: Dict[str, float] = {}
        self.growth_panel_bundle: Optional[Dict[str, Any]] = None
        self.growth_panel_pipeline: Any = None
        self.growth_panel_feature_columns: List[str] = []
        self.growth_panel_target_columns: List[str] = []
        self.growth_panel_eps: float = 1e-6
        self.growth_panel_ghg_pipeline: Any = None
        self.growth_panel_ghg_feature_columns: List[str] = []

        self._load_growth_panel_model()

    def _load_growth_panel_model(self) -> None:
        model_dir = getattr(Config, "MODEL_DIR", None)
        if not model_dir:
            return

        model_path = os.path.join(model_dir, "scenario_builder.joblib")
        if not os.path.exists(model_path):
            return

        try:
            bundle = joblib.load(model_path)
            pipeline = bundle.get("pipeline")
            feature_columns = bundle.get("feature_columns", [])
            target_columns = bundle.get("target_columns", [])
            eps = float(bundle.get("eps", 1e-6))
            ghg_pipeline = bundle.get("ghg_pipeline")
            ghg_feature_columns = bundle.get("ghg_feature_columns", [])

            if pipeline is None or not feature_columns or not target_columns:
                return

            self.growth_panel_bundle = bundle
            self.growth_panel_pipeline = pipeline
            self.growth_panel_feature_columns = [str(c) for c in feature_columns]
            self.growth_panel_target_columns = [str(c) for c in target_columns]
            self.growth_panel_eps = eps
            self.growth_panel_ghg_pipeline = ghg_pipeline
            self.growth_panel_ghg_feature_columns = [str(c) for c in ghg_feature_columns]

            if self.verbose:
                print(f"✅ Loaded growth panel scenario model: {model_path}")
        except Exception as e:
            if self.verbose:
                print(f"⚠️ Could not load growth panel model: {e}")

    def _ensure_ml_forecaster(self) -> None:
        if not self.use_ml_forecasting:
            raise RuntimeError("ML forecasting is disabled or unavailable.")
        if self.ml_forecaster is not None:
            return

        try:
            self.ml_forecaster = MLForecaster()
            ok = getattr(self.ml_forecaster, "load_models", lambda: False)()
            if not ok:
                if self.verbose:
                    print("ℹ️  ML models not found on disk; training now...")
                train_fn = getattr(self.ml_forecaster, "train_models", None)
                if callable(train_fn):
                    train_fn()
                ok = getattr(self.ml_forecaster, "load_models", lambda: False)()
                if not ok:
                    raise RuntimeError("ML forecasting models unavailable after training.")
            elif self.verbose:
                print("✅ ML forecasting enabled")
        except Exception as e:
            raise RuntimeError(f"ML forecasting initialization failed: {e}")

    def _prepare_scenario_training_frame(self) -> pd.DataFrame:
        if self.historical_data is None or self.historical_data.empty:
            return pd.DataFrame()

        df = add_yearly_per_capita_mwh_columns(self.historical_data.copy())
        rename_map = {
            "Access to electricity (% of total population)": "access_to_electricity_pct",
            "Access to Clean Fuels and Technologies for cooking (% of total population)": "clean_cooking_access_pct",
            "electricity_demand (TWh)": "electricity_demand_twh",
            "energy_poverty_electricity (% of total population)": "energy_poverty_pct",
            "energy_poverty_multidimensional (% of total population)": "energy_poverty_multidimensional_pct",
        }
        df = df.rename(columns=rename_map)

        required = [
            "country",
            "year",
            "access_to_electricity_pct",
            "clean_cooking_access_pct",
            "renewables_share_elec",
            "electricity_demand_twh",
            "population",
            "gdp",
            "fossil_share_elec",
            "low_carbon_share_elec",
            "electricity_demand_per_capita_mwh",
            "electricity_demand_per_capita_with_access_mwh",
            "energy_poverty_pct",
            "energy_poverty_multidimensional_pct",
            "greenhouse_gas_emissions",
        ]
        missing = [c for c in required if c not in df.columns]
        if missing:
            if self.verbose:
                print(f"⚠️ Scenario model training skipped. Missing columns: {missing}")
            return pd.DataFrame()

        for col in required:
            if col in ("country",):
                continue
            df[col] = pd.to_numeric(df[col], errors="coerce")

        df = df[df["population"] > 0].copy()
        df = df.replace([np.inf, -np.inf], np.nan)
        df = df.dropna(subset=[
            "country",
            "year",
            "access_to_electricity_pct",
            "clean_cooking_access_pct",
            "renewables_share_elec",
            "electricity_demand_twh",
            "population",
            "gdp",
            "fossil_share_elec",
            "low_carbon_share_elec",
            "electricity_demand_per_capita_mwh",
            "electricity_demand_per_capita_with_access_mwh",
            "energy_poverty_pct",
            "energy_poverty_multidimensional_pct",
            "greenhouse_gas_emissions",
        ]).copy()
        if df.empty:
            return df

        df["country"] = df["country"].astype(str)
        countries = sorted(df["country"].unique().tolist())
        self.scenario_country_codes = {c: i for i, c in enumerate(countries)}
        df["country_code"] = df["country"].map(self.scenario_country_codes).astype(float)

        return df

    def _train_scenario_models(self) -> None:
        self.scenario_models = {}
        self.scenario_feature_medians = {}

        if not SKLEARN_AVAILABLE:
            if self.verbose:
                print("⚠️ scikit-learn not available; scenario simulator will use fallback trajectories.")
            return

        train_df = self._prepare_scenario_training_frame()
        if train_df.empty:
            if self.verbose:
                print("⚠️ Scenario model training data unavailable; using fallback trajectories.")
            return

        X = train_df[self.scenario_feature_columns].copy()
        self.scenario_feature_medians = X.median(numeric_only=True).to_dict()
        X = X.fillna(self.scenario_feature_medians)

        for target in self.scenario_target_columns:
            y = pd.to_numeric(train_df[target], errors="coerce")
            valid = y.notna()
            if valid.sum() < 80:
                continue

            model = RandomForestRegressor(
                n_estimators=300,
                random_state=42,
                min_samples_leaf=3,
                n_jobs=-1,
            )
            model.fit(X.loc[valid], y.loc[valid])
            self.scenario_models[target] = model

        if self.verbose and self.scenario_models:
            print(f"✅ Scenario models trained: {list(self.scenario_models.keys())}")

    def _country_growth_rate(self, country_df: pd.DataFrame, col: str, default: float) -> float:
        if col not in country_df.columns:
            return default
        g = self._calculate_growth_rate(country_df[["year", col]].dropna(), col)
        return default if g == 0.0 else float(g)

    def _simulate_feature_trajectories(
        self,
        country_df: pd.DataFrame,
        country: str,
        start_year: int,
        end_year: int,
        policy_metrics: Dict[str, Any],
    ) -> pd.DataFrame:
        def _clamp_pct(value: float) -> float:
            return max(0.0, min(100.0, float(value)))

        latest_year = int(country_df["year"].max())
        latest_row = country_df[country_df["year"] == latest_year].iloc[0]

        access_base = _clamp_pct(latest_row.get("Access to electricity (% of total population)", 70.0) or 70.0)
        clean_base = _clamp_pct(latest_row.get("Access to Clean Fuels and Technologies for cooking (% of total population)", 40.0) or 40.0)
        renew_base = _clamp_pct(latest_row.get("renewables_share_elec", 20.0) or 20.0)
        demand_base = float(latest_row.get("electricity_demand (TWh)", 100.0) or 100.0)
        pop_base = float(latest_row.get("population", 10_000_000.0) or 10_000_000.0)
        gdp_base = float(latest_row.get("gdp", 1e11) or 1e11)
        fossil_base = _clamp_pct(latest_row.get("fossil_share_elec", 70.0) or 70.0)
        low_carbon_base = _clamp_pct(latest_row.get("low_carbon_share_elec", 30.0) or 30.0)

        if start_year > latest_year:
            t0 = start_year - latest_year
            demand_growth_hist = self._country_growth_rate(country_df, "electricity_demand (TWh)", 0.03)
            pop_growth_hist = self._country_growth_rate(country_df, "population", 0.02)
            gdp_growth_hist = self._country_growth_rate(country_df, "gdp", 0.03)

            demand_base *= (1 + demand_growth_hist) ** t0
            pop_base *= (1 + pop_growth_hist) ** t0
            gdp_base *= (1 + gdp_growth_hist) ** t0

        access_target = policy_metrics.get("energy_access_target")
        clean_target = policy_metrics.get("clean_cooking_target")
        renew_target = policy_metrics.get("renewable_target")

        demand_growth = float(policy_metrics.get("demand_growth_rate", self._country_growth_rate(country_df, "electricity_demand (TWh)", 0.03)) or 0.03)
        pop_growth = float(policy_metrics.get("population_growth_rate", self._country_growth_rate(country_df, "population", 0.02)) or 0.02)
        gdp_growth = float(policy_metrics.get("gdp_growth_rate", self._country_growth_rate(country_df, "gdp", 0.03)) or 0.03)

        rows = []
        country_code = float(self.scenario_country_codes.get(country, 0))

        for year in range(start_year, end_year + 1):
            p = 0.0 if end_year <= start_year else (year - start_year) / (end_year - start_year)
            p = max(0.0, min(1.0, p))
            t = year - start_year

            access = access_base if access_target is None else access_base + (float(access_target) - access_base) * p
            clean = clean_base if clean_target is None else clean_base + (float(clean_target) - clean_base) * p
            renew = renew_base if renew_target is None else renew_base + (float(renew_target) - renew_base) * p

            demand = demand_base * ((1 + demand_growth) ** t)
            population = pop_base * ((1 + pop_growth) ** t)
            gdp = gdp_base * ((1 + gdp_growth) ** t)

            low_carbon = max(0.0, min(100.0, low_carbon_base + 0.6 * (renew - renew_base)))
            fossil = max(0.0, min(100.0, fossil_base - 0.6 * (renew - renew_base)))

            rows.append({
                "access_to_electricity_pct": max(0.0, min(100.0, access)),
                "clean_cooking_access_pct": max(0.0, min(100.0, clean)),
                "renewables_share_elec": max(0.0, min(100.0, renew)),
                "electricity_demand_twh": max(0.0, demand),
                "population": max(1.0, population),
                "gdp": max(1.0, gdp),
                "fossil_share_elec": fossil,
                "low_carbon_share_elec": low_carbon,
                "country_code": country_code,
                "year": float(year),
            })

        return pd.DataFrame(rows)

    def _simulate_with_growth_panel_model(
        self,
        country_df: pd.DataFrame,
        country: str,
        start_year: int,
        end_year: int,
        policy_metrics: Dict[str, Any],
    ) -> Dict[str, Any]:
        if self.growth_panel_pipeline is None or not self.growth_panel_feature_columns:
            raise RuntimeError("Growth panel model is not loaded.")

        def _clamp_pct(value: float) -> float:
            return max(0.0, min(100.0, float(value)))

        def _safe_float(v: Any, default: float) -> float:
            try:
                vv = float(v)
                if np.isfinite(vv):
                    return vv
            except Exception:
                pass
            return float(default)

        target_cols = [
            "electricity_demand (TWh)",
            YEARLY_PER_CAPITA_MWH,
            YEARLY_PER_CAPITA_WITH_ACCESS_MWH,
            "energy_poverty_electricity (% of total population)",
            "energy_poverty_multidimensional (% of total population)",
            "greenhouse_gas_emissions",
        ]

        latest_year = int(country_df["year"].max())
        latest_row = country_df[country_df["year"] == latest_year].iloc[-1]

        access_base = _clamp_pct(latest_row.get("Access to electricity (% of total population)", 70.0) or 70.0)
        clean_base = _clamp_pct(latest_row.get("Access to Clean Fuels and Technologies for cooking (% of total population)", 40.0) or 40.0)
        renew_base = _clamp_pct(latest_row.get("renewables_share_elec", 20.0) or 20.0)
        demand_base = _safe_float(latest_row.get("electricity_demand (TWh)", 100.0), 100.0)
        pop_base = _safe_float(latest_row.get("population", 10_000_000.0), 10_000_000.0)
        gdp_base = _safe_float(latest_row.get("gdp", 1e11), 1e11)

        pc_mwh = yearly_per_capita_mwh(latest_row, with_access=False)
        pc_wa_mwh = yearly_per_capita_mwh(latest_row, with_access=True)
        current_levels: Dict[str, float] = {
            "electricity_demand (TWh)": demand_base,
            YEARLY_PER_CAPITA_MWH: _safe_float(pc_mwh, 1.5),
            YEARLY_PER_CAPITA_WITH_ACCESS_MWH: _safe_float(pc_wa_mwh, 2.0),
            "energy_poverty_electricity (% of total population)": _clamp_pct(latest_row.get("energy_poverty_electricity (% of total population)", 20.0) or 20.0),
            "energy_poverty_multidimensional (% of total population)": _clamp_pct(latest_row.get("energy_poverty_multidimensional (% of total population)", 25.0) or 25.0),
            "greenhouse_gas_emissions": _safe_float(latest_row.get("greenhouse_gas_emissions", 100.0), 100.0),
        }

        demand_growth_hist = self._country_growth_rate(country_df, "electricity_demand (TWh)", 0.03)
        pop_growth_hist = self._country_growth_rate(country_df, "population", 0.02)
        gdp_growth_hist = self._country_growth_rate(country_df, "gdp", 0.03)

        if start_year > latest_year:
            t0 = start_year - latest_year
            demand_base *= (1 + demand_growth_hist) ** t0
            pop_base *= (1 + pop_growth_hist) ** t0
            gdp_base *= (1 + gdp_growth_hist) ** t0

            for col in target_cols:
                g = self._country_growth_rate(country_df, col, 0.0)
                current_levels[col] = max(0.0, current_levels[col] * ((1 + g) ** t0))

        access_target = policy_metrics.get("energy_access_target")
        clean_target = policy_metrics.get("clean_cooking_target")
        renew_target = policy_metrics.get("renewable_target")

        demand_growth = float(policy_metrics.get("demand_growth_rate", demand_growth_hist) or demand_growth_hist)
        pop_growth = float(policy_metrics.get("population_growth_rate", pop_growth_hist) or pop_growth_hist)
        gdp_growth = float(policy_metrics.get("gdp_growth_rate", gdp_growth_hist) or gdp_growth_hist)

        lag_growth = {f"lag_growth::{col}": 0.0 for col in target_cols}
        if len(country_df) >= 2:
            sorted_df = country_df.sort_values("year")
            for col in target_cols:
                prev_val = _safe_float(sorted_df.iloc[-2].get(col, np.nan), np.nan)
                curr_val = _safe_float(sorted_df.iloc[-1].get(col, np.nan), np.nan)
                if np.isfinite(prev_val) and np.isfinite(curr_val) and prev_val >= 0 and curr_val >= 0:
                    lag_growth[f"lag_growth::{col}"] = float(np.log((curr_val + self.growth_panel_eps) / (prev_val + self.growth_panel_eps)))

        years = list(range(start_year, end_year + 1))
        forecasts = {
            "electricity_per_capita": [],
            "electricity_per_capita_with_access": [],
            "energy_poverty": [],
            "energy_poverty_multidimensional": [],
            "co2_emissions": [],
            "electricity_demand": [],
            "renewable_share": [],
            "clean_cooking_access": [],
        }

        for idx, year in enumerate(years):
            p = 0.0 if end_year <= start_year else (year - start_year) / (end_year - start_year)
            p = max(0.0, min(1.0, p))
            t = year - start_year

            access = access_base if access_target is None else access_base + (float(access_target) - access_base) * p
            clean = clean_base if clean_target is None else clean_base + (float(clean_target) - clean_base) * p
            renew = renew_base if renew_target is None else renew_base + (float(renew_target) - renew_base) * p

            demand_exog = max(0.0, demand_base * ((1 + demand_growth) ** t))
            population = max(1.0, pop_base * ((1 + pop_growth) ** t))
            gdp = max(1.0, gdp_base * ((1 + gdp_growth) ** t))

            current_levels["electricity_demand (TWh)"] = demand_exog

            forecasts["electricity_per_capita"].append({"year": int(year), "value": round(max(0.0, current_levels[YEARLY_PER_CAPITA_MWH]), 2)})
            forecasts["electricity_per_capita_with_access"].append({"year": int(year), "value": round(max(0.0, current_levels[YEARLY_PER_CAPITA_WITH_ACCESS_MWH]), 2)})
            forecasts["energy_poverty"].append({"year": int(year), "value": round(_clamp_pct(100.0 - access), 2)})
            forecasts["energy_poverty_multidimensional"].append({"year": int(year), "value": round(_clamp_pct(current_levels["energy_poverty_multidimensional (% of total population)"]), 2)})
            forecasts["co2_emissions"].append({"year": int(year), "value": round(max(0.0, current_levels["greenhouse_gas_emissions"]), 2)})
            forecasts["electricity_demand"].append({"year": int(year), "value": round(demand_exog, 2)})
            forecasts["renewable_share"].append({"year": int(year), "value": round(_clamp_pct(renew), 2)})
            forecasts["clean_cooking_access"].append({"year": int(year), "value": round(_clamp_pct(clean), 2)})

            if idx == len(years) - 1:
                continue

            feature_row: Dict[str, Any] = {
                "country": country,
                "year": float(year),
                "population": float(population),
                "gdp": float(gdp),
                "Access to electricity (% of total population)": _clamp_pct(access),
                "Access to Clean Fuels and Technologies for cooking (% of total population)": _clamp_pct(clean),
                "renewables_share_elec": _clamp_pct(renew),
            }
            for col in target_cols:
                feature_row[col] = float(max(0.0, current_levels[col]))
            feature_row.update(lag_growth)

            X_row = pd.DataFrame([feature_row])
            for col in self.growth_panel_feature_columns:
                if col not in X_row.columns:
                    X_row[col] = np.nan
            X_row = X_row[self.growth_panel_feature_columns]

            pred_growth = self.growth_panel_pipeline.predict(X_row)
            pred_growth = np.asarray(pred_growth, dtype=float).reshape(1, -1)[0]

            if self.growth_panel_ghg_pipeline is not None and self.growth_panel_ghg_feature_columns:
                X_ghg = X_row.copy()
                for col in self.growth_panel_ghg_feature_columns:
                    if col not in X_ghg.columns:
                        X_ghg[col] = np.nan
                X_ghg = X_ghg[self.growth_panel_ghg_feature_columns]
                ghg_growth_pred = self.growth_panel_ghg_pipeline.predict(X_ghg)
                ghg_idx = target_cols.index("greenhouse_gas_emissions")
                pred_growth[ghg_idx] = float(np.asarray(ghg_growth_pred, dtype=float).reshape(-1)[0])

            next_levels: Dict[str, float] = {}
            for j, col in enumerate(target_cols):
                g = float(pred_growth[j]) if j < len(pred_growth) else 0.0
                curr = max(0.0, float(current_levels[col]))
                nxt = (curr + self.growth_panel_eps) * np.exp(g) - self.growth_panel_eps
                nxt = max(0.0, float(nxt))
                if "energy_poverty" in col:
                    nxt = _clamp_pct(nxt)
                next_levels[col] = nxt
                lag_growth[f"lag_growth::{col}"] = g

            current_levels = next_levels

        summary = {
            "electricity_per_capita": forecasts["electricity_per_capita"][-1]["value"],
            "electricity_per_capita_with_access": forecasts["electricity_per_capita_with_access"][-1]["value"],
            "energy_poverty": forecasts["energy_poverty"][-1]["value"],
            "renewable_share": forecasts["renewable_share"][-1]["value"],
            "electricity_demand": forecasts["electricity_demand"][-1]["value"],
            "co2_emissions": forecasts["co2_emissions"][-1]["value"],
        }

        return {"forecasts": forecasts, "summary": summary}

    def simulate_model_driven_scenario(
        self,
        country: str,
        start_year: int,
        end_year: int,
        policy_metrics: Dict[str, Any],
    ) -> Dict[str, Any]:
        if self.historical_data is None or self.historical_data.empty:
            baseline = self._generate_default_forecast(start_year, end_year)
            return {
                "forecasts": baseline,
                "summary": {
                    "electricity_per_capita": baseline["electricity_per_capita"][-1]["value"],
                    "electricity_per_capita_with_access": baseline["electricity_per_capita_with_access"][-1]["value"],
                    "energy_poverty": baseline["energy_poverty"][-1]["value"],
                    "co2_per_capita": baseline["co2_emissions"][-1]["value"],
                },
            }

        country_df = self.historical_data[
            self.historical_data["country"].astype(str).str.lower() == str(country).lower()
        ].copy()
        if country_df.empty:
            country_df = self.historical_data.copy()

        if self.growth_panel_pipeline is not None:
            return self._simulate_with_growth_panel_model(
                country_df=country_df,
                country=country,
                start_year=start_year,
                end_year=end_year,
                policy_metrics=policy_metrics,
            )
        raise RuntimeError(
            "Scenario growth panel model is unavailable. Please retrain and place scenario_builder.joblib in api/ml_models."
        )

    # ----------------------------
    # NLP mode control
    # ----------------------------
    def set_nlp_mode(self, use_nlp: bool, nlp_backend: str = "spacy") -> None:
        self.nlp_backend = nlp_backend

        if use_nlp and not (NLP_AVAILABLE and HybridExtractor):
            self.use_nlp = False
            self.nlp_extractor = None
            if self.verbose:
                print("⚠️  NLP requested but HybridExtractor unavailable.")
            return

        self.use_nlp = bool(use_nlp)
        if not self.use_nlp:
            self.nlp_extractor = None
            return

        try:
            spacy_model = getattr(Config, "NLP_MODEL_NAME", "en_core_web_sm")
            self.nlp_extractor = HybridExtractor(
                nlp_backend=self.nlp_backend,
                use_nlp=True,
                model=spacy_model,
                verbose=self.verbose,
            )
            if self.verbose:
                print(f"✅ NLP enabled: backend={self.nlp_backend}")
        except Exception as e:
            self.use_nlp = False
            self.nlp_extractor = None
            if self.verbose:
                print(f"⚠️  NLP init failed: {e}")
                print("   Falling back to regex-only.")

    # ----------------------------
    # Loading
    # ----------------------------
    def _load_historical_data(self, path: Optional[str]) -> pd.DataFrame:
        if not path:
            return pd.DataFrame()
        try:
            if os.path.exists(path):
                df = pd.read_csv(path)
                if "country" in df.columns:
                    df["country"] = df["country"].astype(str)
                if "year" in df.columns:
                    df["year"] = pd.to_numeric(df["year"], errors="coerce")
                return df
        except Exception:
            pass
        return pd.DataFrame()

    # ----------------------------
    # Extraction
    # ----------------------------
    def extract_policy_metrics(self, policy_text: str) -> Dict[str, Any]:
        """
        If NLP enabled: HybridExtractor merges NLP + regex.
        Else: regex only.
        """
        if self.use_nlp and self.nlp_extractor:
            merged = self.nlp_extractor.extract(policy_text, self._extract_with_regex)
            return self._normalize_metrics(merged)
        return self._normalize_metrics(self._extract_with_regex(policy_text))

    def _normalize_metrics(self, metrics: Dict[str, Any]) -> Dict[str, Any]:
        base = {
            "country": None,
            "renewable_target": None,
            "investment_amount": None,     # billions USD
            "timeline_start": None,
            "timeline_end": None,
            "solar_target": None,          # GW
            "wind_target": None,           # GW
            "energy_access_target": None,  # %
            "energy_poverty_target": None, # %
            "co2_reduction_target": None,  # %
            "clean_cooking_target": None,  # %
            "population_growth_rate": None # decimal
        }
        base.update(metrics or {})

        # Clean country
        if base.get("country") is not None:
            c = str(base["country"]).strip()
            base["country"] = c if c else None

        def f(x):
            try:
                if x is None or (isinstance(x, float) and pd.isna(x)):
                    return None
                return float(x)
            except Exception:
                return None

        def i(x):
            try:
                if x is None or (isinstance(x, float) and pd.isna(x)):
                    return None
                return int(float(x))
            except Exception:
                return None

        for k in ["renewable_target", "investment_amount", "solar_target", "wind_target",
                  "energy_access_target", "energy_poverty_target", "co2_reduction_target",
                  "clean_cooking_target", "population_growth_rate"]:
            base[k] = f(base.get(k))

        for k in ["timeline_start", "timeline_end"]:
            base[k] = i(base.get(k))

        return base

    def _extract_with_regex(self, policy_text: str) -> Dict[str, Any]:
        text = (policy_text or "").lower()
        m: Dict[str, Any] = {
            "country": None,  # NLP extractor should fill this if possible
            "renewable_target": None,
            "investment_amount": None,
            "timeline_start": None,
            "timeline_end": None,
            "solar_target": None,
            "wind_target": None,
            "energy_access_target": None,
            "energy_poverty_target": None,
            "co2_reduction_target": None,
            "clean_cooking_target": None,
            "population_growth_rate": None,
        }

        # Renewable target
        renewable_patterns = [
            r'(\d+(?:\.\d+)?)\s*%\s*(?:renewable|renewables)',
            r'renewable\s*(?:energy\s*)?(?:share|target|goal).*?(\d+(?:\.\d+)?)\s*%',
            r'(\d+(?:\.\d+)?)\s*%\s*renewable.*?(?:by|in)\s*(\d{4})',
        ]
        for p in renewable_patterns:
            mm = re.search(p, text)
            if mm:
                m["renewable_target"] = float(mm.group(1))
                if len(mm.groups()) > 1 and mm.group(2):
                    m["timeline_end"] = int(mm.group(2))
                break

        # Investment (billions USD)
        investment_patterns = [
            r'\$(\d+(?:\.\d+)?)\s*(?:billion|b|million|m)\b',
            r'(\d+(?:\.\d+)?)\s*(?:billion|billion\s*dollars|b)\s*(?:investment|invest|funding)',
        ]
        for p in investment_patterns:
            mm = re.search(p, text)
            if mm:
                amount = float(mm.group(1))
                token = mm.group(0).lower()
                if "million" in token or re.search(r"\b[m]\b", token):
                    amount = amount / 1000.0
                m["investment_amount"] = amount
                break

        # Timeline range
        timeline_patterns = [
            r'policy\s+(?:\w+\s+){0,5}(\d{4})\s*(?:to|-)\s*(\d{4})',
            r'(?:transition|timeline|period|phase).*?(\d{4})\s*(?:to|-)\s*(\d{4})',
            r'^[^\n]*?(\d{4})\s*(?:to|-)\s*(\d{4})',
        ]
        for p in timeline_patterns:
            mm = re.search(p, text, re.IGNORECASE | re.MULTILINE)
            if mm:
                m["timeline_start"] = int(mm.group(1))
                m["timeline_end"] = int(mm.group(2))
                break

        if m["timeline_start"] is None and m["timeline_end"] is None:
            years: List[int] = []
            for p in [r'phase\s*\d+.*?[\(]?(\d{4})\s*(?:to|-)?\s*(\d{4})?[\)]?', r'(?:by|until)\s*(\d{4})']:
                hits = re.findall(p, text)
                for h in hits:
                    if isinstance(h, tuple):
                        years.extend([int(y) for y in h if y])
                    else:
                        years.append(int(h))
            if years:
                years = sorted(set(years))
                m["timeline_start"] = years[0] if len(years) >= 2 else None
                m["timeline_end"] = years[-1]

        # Solar / Wind targets (GW)
        for p in [r'(\d+(?:\.\d+)?)\s*(?:gw|gigawatt).*?solar', r'solar.*?(\d+(?:\.\d+)?)\s*(?:gw|gigawatt)']:
            mm = re.search(p, text)
            if mm:
                m["solar_target"] = float(mm.group(1))
                break

        for p in [r'(\d+(?:\.\d+)?)\s*(?:gw|gigawatt).*?wind', r'wind.*?(\d+(?:\.\d+)?)\s*(?:gw|gigawatt)']:
            mm = re.search(p, text)
            if mm:
                m["wind_target"] = float(mm.group(1))
                break

        # Access / poverty (%)
        for p in [r'(\d+(?:\.\d+)?)\s*%\s*(?:electricity\s*)?access', r'access.*?(\d+(?:\.\d+)?)\s*%']:
            mm = re.search(p, text)
            if mm:
                m["energy_access_target"] = float(mm.group(1))
                break

        for p in [r'reduce.*?energy\s*poverty.*?to\s*(\d+(?:\.\d+)?)\s*%', r'energy\s*poverty.*?(\d+(?:\.\d+)?)\s*%']:
            mm = re.search(p, text)
            if mm:
                m["energy_poverty_target"] = float(mm.group(1))
                break

        # CO2 reduction (%)
        for p in [r'reduce.*?co2.*?by\s*(\d+(?:\.\d+)?)\s*%', r'(\d+(?:\.\d+)?)\s*%\s*reduction.*?co2', r'co2.*?(\d+(?:\.\d+)?)\s*%']:
            mm = re.search(p, text)
            if mm:
                m["co2_reduction_target"] = float(mm.group(1))
                break

        # Clean cooking (%)
        for p in [r'clean\s*cooking.*?(\d+(?:\.\d+)?)\s*%', r'(\d+(?:\.\d+)?)\s*%\s*clean\s*cooking']:
            mm = re.search(p, text)
            if mm:
                m["clean_cooking_target"] = float(mm.group(1))
                break

        # Population growth (decimal)
        for p in [r'population.*?growth.*?(\d+(?:\.\d+)?)\s*%', r'annual.*?growth.*?(\d+(?:\.\d+)?)\s*%']:
            mm = re.search(p, text)
            if mm:
                m["population_growth_rate"] = float(mm.group(1)) / 100.0
                break

        return m

    # ----------------------------
    # Forecasting + adjustments
    # ----------------------------
    def generate_baseline_forecast(self, country: str, start_year: int, end_year: int) -> Dict[str, List[Dict[str, Any]]]:
        self._ensure_ml_forecaster()
        if self.ml_forecaster is None:
            raise RuntimeError("ML forecasting is required but not available.")

        fc = self.ml_forecaster.forecast(
            country=country,
            start_year=start_year,
            end_year=end_year,
            historical_data=self.historical_data,
        )
        if fc and any(isinstance(v, list) and len(v) > 0 for v in fc.values()):
            return fc

        raise RuntimeError("ML forecasting produced no outputs.")

    def _calculate_growth_rate(self, data: pd.DataFrame, column: str) -> float:
        if column not in data.columns or len(data) < 2:
            return 0.0
        tmp = data[["year", column]].dropna().sort_values("year")
        if len(tmp) < 2:
            return 0.0
        y0 = float(tmp.iloc[0][column])
        y1 = float(tmp.iloc[-1][column])
        x0 = int(tmp.iloc[0]["year"])
        x1 = int(tmp.iloc[-1]["year"])
        n = x1 - x0
        if n <= 0 or y0 <= 0 or y1 <= 0:
            return 0.0
        return (y1 / y0) ** (1 / n) - 1

    def _generate_default_forecast(self, start_year: int, end_year: int) -> Dict[str, List[Dict[str, Any]]]:
        fc = {
            "renewable_share": [],
            "electricity_demand": [],
            "co2_emissions": [],
            "energy_poverty": [],
            "electricity_per_capita": [],
            "electricity_per_capita_with_access": [],
            "clean_cooking_access": [],
        }
        base = {
            "renewable_share": 25.0,
            "electricity_demand": 150.0,
            "co2_emissions": 400.0,
            "energy_poverty": 25.0,
            "electricity_per_capita": 1.5,
            "electricity_per_capita_with_access": 2.0,
            "clean_cooking_access": 45.0,
        }

        for year in range(start_year, end_year + 1):
            t = year - start_year
            fc["renewable_share"].append({"year": year, "value": round(min(100.0, base["renewable_share"] * (1.02 ** t)), 2)})
            fc["electricity_demand"].append({"year": year, "value": round(base["electricity_demand"] * (1.03 ** t), 2)})
            fc["co2_emissions"].append({"year": year, "value": round(max(0.0, base["co2_emissions"] * (0.99 ** t)), 2)})
            fc["energy_poverty"].append({"year": year, "value": round(max(0.0, base["energy_poverty"] * (0.98 ** t)), 2)})
            fc["electricity_per_capita"].append({"year": year, "value": round(base["electricity_per_capita"] * (1.025 ** t), 2)})
            fc["electricity_per_capita_with_access"].append({"year": year, "value": round(base["electricity_per_capita_with_access"] * (1.03 ** t), 2)})
            fc["clean_cooking_access"].append({"year": year, "value": round(min(100.0, base["clean_cooking_access"] * (1.015 ** t)), 2)})
        return fc

    def apply_policy_adjustments(
        self,
        baseline_forecast: Dict[str, List[Dict[str, Any]]],
        policy_metrics: Dict[str, Any],
        target_year: int,
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Linear ramp to targets by target_year (simple + stable).
        """
        adjusted = {k: [] for k in baseline_forecast.keys()}

        def value_at(series: List[Dict[str, Any]], year: int, default: float) -> float:
            for item in series:
                if item.get("year") == year:
                    return float(item.get("value", default))
            return float(series[-1]["value"]) if series else default

        start_year = baseline_forecast["renewable_share"][0]["year"] if baseline_forecast.get("renewable_share") else target_year

        def prog(y: int) -> float:
            if target_year <= start_year:
                return 1.0
            p = (y - start_year) / (target_year - start_year)
            return max(0.0, min(1.0, p))

        renewable_target = policy_metrics.get("renewable_target")
        poverty_target = policy_metrics.get("energy_poverty_target")
        co2_reduction = policy_metrics.get("co2_reduction_target")  # %

        base_renew_t = value_at(baseline_forecast.get("renewable_share", []), target_year, 25.0)
        base_pov_t = value_at(baseline_forecast.get("energy_poverty", []), target_year, 25.0)

        for item in baseline_forecast.get("renewable_share", []):
            y, v = int(item["year"]), float(item["value"])
            if renewable_target is not None:
                v = v + (float(renewable_target) - base_renew_t) * prog(y)
                v = max(0.0, min(100.0, v))
            adjusted["renewable_share"].append({"year": y, "value": round(v, 2)})

        adjusted["electricity_demand"] = list(baseline_forecast.get("electricity_demand", []))
        adjusted["electricity_per_capita"] = list(baseline_forecast.get("electricity_per_capita", []))
        adjusted["electricity_per_capita_with_access"] = list(baseline_forecast.get("electricity_per_capita_with_access", []))
        adjusted["clean_cooking_access"] = list(baseline_forecast.get("clean_cooking_access", []))

        for item in baseline_forecast.get("co2_emissions", []):
            y, v = int(item["year"]), float(item["value"])
            if co2_reduction is not None:
                v = v * (1 - (float(co2_reduction) / 100.0) * prog(y))
                v = max(0.0, v)
            adjusted["co2_emissions"].append({"year": y, "value": round(v, 2)})

        for item in baseline_forecast.get("energy_poverty", []):
            y, v = int(item["year"]), float(item["value"])
            if poverty_target is not None:
                v = v + (float(poverty_target) - base_pov_t) * prog(y)
                v = max(0.0, min(100.0, v))
            adjusted["energy_poverty"].append({"year": y, "value": round(v, 2)})

        return adjusted

    def analyze_policy(self, policy_text: str, country: Optional[str] = None, target_year: int = 2100) -> Dict[str, Any]:
        policy_metrics = self.extract_policy_metrics(policy_text)

        resolved_country = (
            (country.strip() if isinstance(country, str) and country.strip() else None)
            or policy_metrics.get("country")
            or self.default_country
        )

        start_year = int(policy_metrics.get("timeline_start") or 2025)
        end_year = int(policy_metrics.get("timeline_end") or target_year)

        baseline = self.generate_baseline_forecast(resolved_country, start_year, end_year)
        adjusted = self.apply_policy_adjustments(baseline, policy_metrics, end_year)

        summary = {
            "country": resolved_country,
            "renewable_share": adjusted["renewable_share"][-1]["value"] if adjusted.get("renewable_share") else 0.0,
            "electricity_demand": adjusted["electricity_demand"][-1]["value"] if adjusted.get("electricity_demand") else 0.0,
            "co2_emissions": adjusted["co2_emissions"][-1]["value"] if adjusted.get("co2_emissions") else 0.0,
            "energy_poverty": adjusted["energy_poverty"][-1]["value"] if adjusted.get("energy_poverty") else 0.0,
        }

        overview = self._generate_ai_overview(policy_metrics, adjusted, summary, start_year, end_year)

        return {
            "policy_metrics": policy_metrics,
            "country": resolved_country,
            "forecasts": adjusted,
            "summary": summary,
            "timeline": {"start_year": start_year, "end_year": end_year},
            "ai_overview": overview,
        }

    def _generate_ai_overview(
        self,
        policy_metrics: Dict[str, Any],
        forecasts: Dict[str, List[Dict[str, Any]]],
        summary: Dict[str, float],
        start_year: int,
        end_year: int,
    ) -> str:
        parts: List[str] = []
        c = summary.get("country") or "the selected country"

        rt = policy_metrics.get("renewable_target")
        if rt is not None:
            parts.append(f"For {c}, the policy targets {rt:.1f}% renewable electricity share")
        else:
            parts.append(f"For {c}, based on current trends and policy signals")

        if forecasts.get("renewable_share"):
            parts.append(f", renewable share is projected to reach {forecasts['renewable_share'][-1]['value']:.1f}% by {end_year}.")

        if forecasts.get("energy_poverty"):
            p0 = forecasts["energy_poverty"][0]["value"]
            p1 = forecasts["energy_poverty"][-1]["value"]
            parts.append(f"\n\nEnergy poverty changes from {p0:.1f}% to {p1:.1f}% by {end_year}.")

        if forecasts.get("co2_emissions"):
            c0 = forecasts["co2_emissions"][0]["value"]
            c1 = forecasts["co2_emissions"][-1]["value"]
            if c0 > 0:
                parts.append(f"\n\nCO₂ intensity proxy decreases from {c0:.1f} to {c1:.1f} (≈{((c0-c1)/c0*100):.1f}% reduction).")
            else:
                parts.append(f"\n\nCO₂ intensity proxy is {c1:.1f} by {end_year}.")

        inv = policy_metrics.get("investment_amount")
        if inv is not None:
            parts.append(f"\n\nPlanned investment: ${inv:.1f}B over {start_year}–{end_year}.")

        return "".join(parts)
