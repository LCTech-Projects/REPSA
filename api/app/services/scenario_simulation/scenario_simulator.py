"""Scenario explorer: growth-panel simulation from manual parameters."""

from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

import joblib
import numpy as np
import pandas as pd

from app.services.scenario_simulation.scenario_helpers import (
    MODEL_OUTPUT_KEYS,
    compute_country_envelope,
    compute_supply_mix_features,
    demand_from_per_capita,
    sync_per_capita_with_access,
    inject_supply_mix_features,
    interpolate_target,
    parameter_warnings,
    persistence_baseline,
    band_log_growth,
    trend_baseline,
)
from app.utils.config import Config
from app.utils.per_capita_units import (
    YEARLY_PER_CAPITA_MWH,
    YEARLY_PER_CAPITA_WITH_ACCESS_MWH,
    yearly_per_capita_mwh,
)


class ScenarioSimulator:
    """Loads scenario_builder.joblib and runs year-by-year scenario simulation."""

    def __init__(
        self,
        yearly_data_path: Optional[str] = None,
        default_country: str = "Algeria",
        verbose: bool = True,
    ):
        self.verbose = verbose
        self.default_country = default_country

        data_dir = getattr(Config, "DATA_DIR", None)
        if yearly_data_path:
            self.yearly_data_path = yearly_data_path
        else:
            self.yearly_data_path = (
                os.path.join(data_dir, "historical", "yearly_historical_data.csv")
                if data_dir
                else None
            )

        self.historical_data = self._load_historical_data(self.yearly_data_path)
        self.growth_panel_bundle: Optional[Dict[str, Any]] = None
        self.growth_panel_pipeline: Any = None
        self.growth_panel_feature_columns: List[str] = []
        self.growth_panel_target_columns: List[str] = []
        self.growth_panel_eps: float = 1e-6
        self.growth_panel_intensity_pipeline: Any = None
        self.growth_panel_intensity_feature_columns: List[str] = []
        self.residual_quantiles: Dict[str, Dict[str, float]] = {}
        self.validation_metrics: List[Dict[str, Any]] = []

        self._load_growth_panel_model()

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
            intensity_pipeline = bundle.get("intensity_pipeline") or bundle.get("ghg_pipeline")
            intensity_feature_columns = bundle.get("intensity_feature_columns") or bundle.get(
                "ghg_feature_columns", []
            )

            if pipeline is None or not feature_columns or not target_columns:
                return

            self.growth_panel_bundle = bundle
            self.growth_panel_pipeline = pipeline
            self.growth_panel_feature_columns = [str(c) for c in feature_columns]
            self.growth_panel_target_columns = [str(c) for c in target_columns]
            self.growth_panel_eps = eps
            self.growth_panel_intensity_pipeline = intensity_pipeline
            self.growth_panel_intensity_feature_columns = [
                str(c) for c in intensity_feature_columns
            ]
            self.residual_quantiles = bundle.get("residual_quantiles", {}) or {}
            self.validation_metrics = bundle.get("validation_metrics", []) or []

            if self.verbose:
                print(f"✅ Loaded scenario builder model: {model_path}")
        except Exception as e:
            if self.verbose:
                print(f"⚠️ Could not load scenario builder model: {e}")

    def _country_df(self, country: str) -> pd.DataFrame:
        if self.historical_data is None or self.historical_data.empty:
            return pd.DataFrame()
        country_df = self.historical_data[
            self.historical_data["country"].astype(str).str.lower() == str(country).lower()
        ].copy()
        if country_df.empty:
            return self.historical_data.copy()
        return country_df

    def get_country_envelope(self, country: str) -> Dict[str, Any]:
        country_df = self._country_df(country)
        if country_df.empty:
            return {
                "defaults": {},
                "slider_bounds": {},
                "historical_cagr": {},
                "latest_year": None,
                "available_extended_series": [],
                "missing_but_useful": [],
            }
        return compute_country_envelope(country_df)

    def get_validation_summary(self) -> Dict[str, Any]:
        return {
            "metrics": self.validation_metrics,
            "has_uncertainty_bands": bool(self.residual_quantiles),
            "note": "Walk-forward validation on the historical panel.",
        }

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

    def _country_growth_rate(self, country_df: pd.DataFrame, col: str, default: float) -> float:
        if col not in country_df.columns:
            return default
        g = self._calculate_growth_rate(country_df[["year", col]].dropna(), col)
        return default if g == 0.0 else float(g)

    def _generate_default_forecast(
        self, start_year: int, end_year: int
    ) -> Dict[str, Any]:
        years = list(range(start_year, end_year + 1))
        base = {
            "electricity_demand": 150.0,
            "electricity_per_capita": 1.5,
            "electricity_per_capita_with_access": 2.0,
            "energy_poverty_multidimensional": 25.0,
            "carbon_intensity_elec": 2.5,
        }
        forecasts = {k: [] for k in MODEL_OUTPUT_KEYS}
        for year in years:
            t = year - start_year
            demand = base["electricity_demand"] * (1.03**t)
            intensity = max(0.0, base["carbon_intensity_elec"] * (0.99**t))
            for key, val in base.items():
                if key == "electricity_demand":
                    forecasts[key].append({"year": year, "value": round(demand, 2)})
                elif key == "carbon_intensity_elec":
                    forecasts[key].append({"year": year, "value": round(intensity, 4)})
                else:
                    forecasts[key].append(
                        {"year": year, "value": round(val * (1.02**t), 2)}
                    )
        return {
            "forecasts": {k: {"scenario": v, "low": v, "high": v} for k, v in forecasts.items()},
            "assumptions": {},
            "baselines": {},
            "summary": {k: forecasts[k][-1]["value"] for k in MODEL_OUTPUT_KEYS if forecasts[k]},
            "warnings": [],
            "validation": self.get_validation_summary(),
        }

    def _simulate_with_growth_panel_model(
        self,
        country_df: pd.DataFrame,
        country: str,
        start_year: int,
        end_year: int,
        scenario_params: Dict[str, Any],
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

        scenario_mode = str(scenario_params.get("scenario_mode", "explore")).lower()
        is_bau = scenario_mode == "bau"

        target_cols = [
            "electricity_demand (TWh)",
            YEARLY_PER_CAPITA_MWH,
            YEARLY_PER_CAPITA_WITH_ACCESS_MWH,
            "energy_poverty_electricity (% of total population)",
            "energy_poverty_multidimensional (% of total population)",
            "carbon_intensity_elec",
        ]

        latest_year = int(country_df["year"].max())
        latest_row = country_df[country_df["year"] == latest_year].iloc[-1]
        envelope = compute_country_envelope(country_df)

        access_base = _clamp_pct(
            latest_row.get("Access to electricity (% of total population)", 70.0) or 70.0
        )
        clean_base = _clamp_pct(
            latest_row.get(
                "Access to Clean Fuels and Technologies for cooking (% of total population)",
                40.0,
            )
            or 40.0
        )
        renew_base = _clamp_pct(latest_row.get("renewables_share_elec", 20.0) or 20.0)
        base_fossil_share = _clamp_pct(
            latest_row.get("fossil_share_elec", max(0.0, 100.0 - renew_base)) or (100.0 - renew_base)
        )
        base_carbon_intensity = _safe_float(
            latest_row.get("carbon_intensity_elec", 0.0),
            0.0,
        )
        if base_carbon_intensity <= 0:
            mix = compute_supply_mix_features(
                renew_base, 0.0, base_fossil_share, 1.0
            )
            base_carbon_intensity = mix["mix_implied_intensity"]
        demand_base = _safe_float(latest_row.get("electricity_demand (TWh)", 100.0), 100.0)
        pop_base = _safe_float(latest_row.get("population", 10_000_000.0), 10_000_000.0)
        gdp_base = _safe_float(latest_row.get("gdp", 1e11), 1e11)

        pc_mwh = yearly_per_capita_mwh(latest_row, with_access=False)
        pc_wa_mwh = yearly_per_capita_mwh(latest_row, with_access=True)
        current_levels: Dict[str, float] = {
            "electricity_demand (TWh)": demand_base,
            YEARLY_PER_CAPITA_MWH: _safe_float(pc_mwh, 1.5),
            YEARLY_PER_CAPITA_WITH_ACCESS_MWH: _safe_float(pc_wa_mwh, 2.0),
            "energy_poverty_electricity (% of total population)": _clamp_pct(
                latest_row.get("energy_poverty_electricity (% of total population)", 20.0) or 20.0
            ),
            "energy_poverty_multidimensional (% of total population)": _clamp_pct(
                latest_row.get("energy_poverty_multidimensional (% of total population)", 25.0)
                or 25.0
            ),
            "carbon_intensity_elec": max(0.0, base_carbon_intensity),
        }
        low_levels = dict(current_levels)
        high_levels = dict(current_levels)

        demand_growth_hist = self._country_growth_rate(
            country_df, "electricity_demand (TWh)", 0.03
        )
        pop_growth_hist = self._country_growth_rate(country_df, "population", 0.02)
        gdp_growth_hist = self._country_growth_rate(country_df, "gdp", 0.03)
        access_growth_hist = self._country_growth_rate(
            country_df, "Access to electricity (% of total population)", 0.01
        )
        clean_growth_hist = self._country_growth_rate(
            country_df,
            "Access to Clean Fuels and Technologies for cooking (% of total population)",
            0.01,
        )
        renew_growth_hist = self._country_growth_rate(country_df, "renewables_share_elec", 0.01)

        if start_year > latest_year:
            t0 = start_year - latest_year
            demand_base *= (1 + demand_growth_hist) ** t0
            pop_base *= (1 + pop_growth_hist) ** t0
            gdp_base *= (1 + gdp_growth_hist) ** t0
            access_base = _clamp_pct(access_base * ((1 + access_growth_hist) ** t0))
            clean_base = _clamp_pct(clean_base * ((1 + clean_growth_hist) ** t0))
            renew_base = _clamp_pct(renew_base * ((1 + renew_growth_hist) ** t0))
            for col in target_cols:
                g = self._country_growth_rate(country_df, col, 0.0)
                current_levels[col] = max(0.0, current_levels[col] * ((1 + g) ** t0))
            low_levels = dict(current_levels)
            high_levels = dict(current_levels)

        sync_per_capita_with_access(current_levels, access_base)
        sync_per_capita_with_access(low_levels, access_base)
        sync_per_capita_with_access(high_levels, access_base)

        if is_bau:
            access_target = None
            clean_target = None
            renew_target = None
            pop_growth = pop_growth_hist
        else:
            access_target = scenario_params.get("energy_access_target")
            clean_target = scenario_params.get("clean_cooking_target")
            renew_target = scenario_params.get("renewable_target")
            pop_growth = float(
                scenario_params.get("population_growth_rate", pop_growth_hist) or pop_growth_hist
            )

        demand_growth = demand_growth_hist
        gdp_growth = gdp_growth_hist

        lag_growth = {f"lag_growth::{col}": 0.0 for col in target_cols}
        if len(country_df) >= 2:
            sorted_df = country_df.sort_values("year")
            for col in target_cols:
                prev_val = _safe_float(sorted_df.iloc[-2].get(col, np.nan), np.nan)
                curr_val = _safe_float(sorted_df.iloc[-1].get(col, np.nan), np.nan)
                if (
                    np.isfinite(prev_val)
                    and np.isfinite(curr_val)
                    and prev_val >= 0
                    and curr_val >= 0
                ):
                    lag_growth[f"lag_growth::{col}"] = float(
                        np.log(
                            (curr_val + self.growth_panel_eps)
                            / (prev_val + self.growth_panel_eps)
                        )
                    )

        years = list(range(start_year, end_year + 1))
        assumptions: Dict[str, List[Dict[str, Any]]] = {
            "renewable_share": [],
            "electricity_access": [],
            "clean_cooking_access": [],
            "population": [],
        }
        scenario_series: Dict[str, List[Dict[str, Any]]] = {k: [] for k in MODEL_OUTPUT_KEYS}
        low_series: Dict[str, List[Dict[str, Any]]] = {k: [] for k in MODEL_OUTPUT_KEYS}
        high_series: Dict[str, List[Dict[str, Any]]] = {k: [] for k in MODEL_OUTPUT_KEYS}

        anchor_population = max(1.0, float(pop_base))
        anchor_output_values = {
            "electricity_demand": round(
                demand_from_per_capita(
                    current_levels[YEARLY_PER_CAPITA_MWH], anchor_population
                ),
                4,
            ),
            "electricity_per_capita": round(
                max(0.0, current_levels[YEARLY_PER_CAPITA_MWH]), 4
            ),
            "electricity_per_capita_with_access": round(
                max(0.0, current_levels[YEARLY_PER_CAPITA_WITH_ACCESS_MWH]), 4
            ),
            "energy_poverty_multidimensional": round(
                _clamp_pct(
                    current_levels[
                        "energy_poverty_multidimensional (% of total population)"
                    ]
                ),
                4,
            ),
            "carbon_intensity_elec": round(
                max(0.0, current_levels["carbon_intensity_elec"]), 4
            ),
        }

        prev_demand = current_levels["electricity_demand (TWh)"]

        for idx, year in enumerate(years):
            raw_p = 0.0 if end_year <= start_year else (year - start_year) / (end_year - start_year)
            progress = max(0.0, min(1.0, float(raw_p)))
            t = year - start_year

            if is_bau:
                access = _clamp_pct(access_base * ((1 + access_growth_hist) ** t))
                clean = _clamp_pct(clean_base * ((1 + clean_growth_hist) ** t))
                renew = _clamp_pct(renew_base * ((1 + renew_growth_hist) ** t))
            else:
                access = _clamp_pct(
                    interpolate_target(access_base, access_target, progress)
                )
                clean = _clamp_pct(interpolate_target(clean_base, clean_target, progress))
                renew = _clamp_pct(interpolate_target(renew_base, renew_target, progress))

            sync_per_capita_with_access(current_levels, access)
            sync_per_capita_with_access(low_levels, access)
            sync_per_capita_with_access(high_levels, access)

            population = max(1.0, pop_base * ((1 + pop_growth) ** t))
            gdp = max(1.0, gdp_base * ((1 + gdp_growth) ** t))

            assumptions["renewable_share"].append({"year": int(year), "value": round(renew, 2)})
            assumptions["electricity_access"].append({"year": int(year), "value": round(access, 2)})
            assumptions["clean_cooking_access"].append({"year": int(year), "value": round(clean, 2)})
            assumptions["population"].append({"year": int(year), "value": round(population, 0)})

            demand_twh = demand_from_per_capita(
                current_levels[YEARLY_PER_CAPITA_MWH], population
            )
            current_levels["electricity_demand (TWh)"] = demand_twh
            low_demand = demand_from_per_capita(
                low_levels[YEARLY_PER_CAPITA_MWH], population
            )
            high_demand = demand_from_per_capita(
                high_levels[YEARLY_PER_CAPITA_MWH], population
            )

            intensity = max(0.0, current_levels["carbon_intensity_elec"])
            low_intensity = max(0.0, low_levels["carbon_intensity_elec"])
            high_intensity = max(0.0, high_levels["carbon_intensity_elec"])

            scenario_series["electricity_demand"].append(
                {"year": int(year), "value": round(demand_twh, 2)}
            )
            scenario_series["electricity_per_capita"].append(
                {
                    "year": int(year),
                    "value": round(max(0.0, current_levels[YEARLY_PER_CAPITA_MWH]), 2),
                }
            )
            scenario_series["electricity_per_capita_with_access"].append(
                {
                    "year": int(year),
                    "value": round(
                        max(0.0, current_levels[YEARLY_PER_CAPITA_WITH_ACCESS_MWH]), 2
                    ),
                }
            )
            scenario_series["energy_poverty_multidimensional"].append(
                {
                    "year": int(year),
                    "value": round(
                        _clamp_pct(
                            current_levels[
                                "energy_poverty_multidimensional (% of total population)"
                            ]
                        ),
                        2,
                    ),
                }
            )
            mix = compute_supply_mix_features(
                renew,
                intensity,
                base_fossil_share,
                base_carbon_intensity,
            )

            scenario_series["carbon_intensity_elec"].append(
                {"year": int(year), "value": round(intensity, 4)}
            )

            low_series["electricity_demand"].append(
                {"year": int(year), "value": round(low_demand, 2)}
            )
            high_series["electricity_demand"].append(
                {"year": int(year), "value": round(high_demand, 2)}
            )
            for key, col in [
                ("electricity_per_capita", YEARLY_PER_CAPITA_MWH),
                ("electricity_per_capita_with_access", YEARLY_PER_CAPITA_WITH_ACCESS_MWH),
                (
                    "energy_poverty_multidimensional",
                    "energy_poverty_multidimensional (% of total population)",
                ),
            ]:
                low_series[key].append(
                    {"year": int(year), "value": round(max(0.0, low_levels[col]), 2)}
                )
                high_series[key].append(
                    {"year": int(year), "value": round(max(0.0, high_levels[col]), 2)}
                )
            low_series["carbon_intensity_elec"].append(
                {"year": int(year), "value": round(low_intensity, 4)}
            )
            high_series["carbon_intensity_elec"].append(
                {"year": int(year), "value": round(high_intensity, 4)}
            )

            if idx == len(years) - 1:
                continue

            feature_row: Dict[str, Any] = {
                "country": country,
                "year": float(year),
                "population": float(population),
                "gdp": float(gdp),
                "Access to electricity (% of total population)": _clamp_pct(access),
                "Access to Clean Fuels and Technologies for cooking (% of total population)": _clamp_pct(
                    clean
                ),
                "renewables_share_elec": _clamp_pct(renew),
            }
            for col in target_cols:
                feature_row[col] = float(max(0.0, current_levels[col]))
            feature_row.update(lag_growth)
            inject_supply_mix_features(feature_row, mix)

            X_row = pd.DataFrame([feature_row])
            for col in self.growth_panel_feature_columns:
                if col not in X_row.columns:
                    X_row[col] = np.nan
            X_row = X_row[self.growth_panel_feature_columns]

            pred_growth = self.growth_panel_pipeline.predict(X_row)
            pred_growth = np.asarray(pred_growth, dtype=float).reshape(1, -1)[0]

            if (
                self.growth_panel_intensity_pipeline is not None
                and self.growth_panel_intensity_feature_columns
            ):
                X_intensity = X_row.copy()
                for col in self.growth_panel_intensity_feature_columns:
                    if col not in X_intensity.columns:
                        X_intensity[col] = np.nan
                X_intensity = X_intensity[self.growth_panel_intensity_feature_columns]
                intensity_growth_pred = self.growth_panel_intensity_pipeline.predict(X_intensity)
                intensity_idx = target_cols.index("carbon_intensity_elec")
                pred_growth[intensity_idx] = float(
                    np.asarray(intensity_growth_pred, dtype=float).reshape(-1)[0]
                )

            next_levels: Dict[str, float] = {}
            next_low: Dict[str, float] = {}
            next_high: Dict[str, float] = {}

            for j, col in enumerate(target_cols):
                g = float(pred_growth[j]) if j < len(pred_growth) else 0.0
                q = self.residual_quantiles.get(col, {})
                g_low, g_high = band_log_growth(g, col, q)

                for levels, growth, bucket in (
                    (current_levels, g, next_levels),
                    (low_levels, g_low, next_low),
                    (high_levels, g_high, next_high),
                ):
                    curr = max(0.0, float(levels[col]))
                    nxt = (curr + self.growth_panel_eps) * np.exp(growth) - self.growth_panel_eps
                    nxt = max(0.0, float(nxt))
                    if "energy_poverty" in col:
                        nxt = _clamp_pct(nxt)
                    if col == "carbon_intensity_elec":
                        nxt = max(0.0, float(nxt))
                    bucket[col] = nxt

                lag_growth[f"lag_growth::{col}"] = g

            sync_per_capita_with_access(next_levels, access)
            sync_per_capita_with_access(next_low, access)
            sync_per_capita_with_access(next_high, access)
            prev_wa = max(0.0, float(current_levels[YEARLY_PER_CAPITA_WITH_ACCESS_MWH]))
            new_wa = max(0.0, float(next_levels[YEARLY_PER_CAPITA_WITH_ACCESS_MWH]))
            lag_growth[f"lag_growth::{YEARLY_PER_CAPITA_WITH_ACCESS_MWH}"] = float(
                np.log(
                    (new_wa + self.growth_panel_eps)
                    / (prev_wa + self.growth_panel_eps)
                )
            )

            current_levels = next_levels
            low_levels = next_low
            high_levels = next_high
            prev_demand = current_levels["electricity_demand (TWh)"]

        latest_output_values = {
            "electricity_demand": scenario_series["electricity_demand"][-1]["value"],
            "electricity_per_capita": scenario_series["electricity_per_capita"][-1]["value"],
            "electricity_per_capita_with_access": scenario_series[
                "electricity_per_capita_with_access"
            ][-1]["value"],
            "energy_poverty_multidimensional": scenario_series[
                "energy_poverty_multidimensional"
            ][-1]["value"],
            "carbon_intensity_elec": scenario_series["carbon_intensity_elec"][-1]["value"],
        }

        output_growth_rates = {
            "electricity_demand": demand_growth,
            "electricity_per_capita": self._country_growth_rate(
                country_df, YEARLY_PER_CAPITA_MWH, 0.02
            ),
            "electricity_per_capita_with_access": self._country_growth_rate(
                country_df, YEARLY_PER_CAPITA_WITH_ACCESS_MWH, 0.02
            ),
            "energy_poverty_multidimensional": self._country_growth_rate(
                country_df,
                "energy_poverty_multidimensional (% of total population)",
                -0.01,
            ),
            "carbon_intensity_elec": (
                self._country_growth_rate(country_df, "carbon_intensity_elec", -0.01)
                if "carbon_intensity_elec" in country_df.columns
                else -0.01
            ),
        }

        baselines = {
            "persistence": persistence_baseline(anchor_output_values, years),
            "historical_trend": trend_baseline(
                anchor_output_values, output_growth_rates, years, start_year
            ),
        }

        forecasts = {
            key: {
                "scenario": scenario_series[key],
                "low": low_series[key],
                "high": high_series[key],
            }
            for key in MODEL_OUTPUT_KEYS
        }

        warnings = parameter_warnings(scenario_params, envelope)
        if is_bau:
            warnings.insert(
                0,
                "Business-as-usual mode extrapolates historical growth rates without policy targets.",
            )

        return {
            "forecasts": forecasts,
            "assumptions": assumptions,
            "baselines": baselines,
            "summary": latest_output_values,
            "warnings": warnings,
            "country_envelope": envelope,
            "validation": self.get_validation_summary(),
        }

    def simulate_scenario(
        self,
        country: str,
        start_year: int,
        end_year: int,
        scenario_params: Dict[str, Any],
    ) -> Dict[str, Any]:
        if self.historical_data is None or self.historical_data.empty:
            return self._generate_default_forecast(start_year, end_year)

        country_df = self._country_df(country)

        if self.growth_panel_pipeline is not None:
            return self._simulate_with_growth_panel_model(
                country_df=country_df,
                country=country,
                start_year=start_year,
                end_year=end_year,
                scenario_params=scenario_params,
            )

        raise RuntimeError(
            "Scenario builder model is unavailable. "
            "Retrain and place scenario_builder.joblib in api/ml_models."
        )
