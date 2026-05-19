"""Scenario builder: growth-panel simulation from manual parameters."""

import os
from typing import Any, Dict, List, Optional

import joblib
import numpy as np
import pandas as pd

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
        self.growth_panel_ghg_pipeline: Any = None
        self.growth_panel_ghg_feature_columns: List[str] = []

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
                print(f"✅ Loaded scenario builder model: {model_path}")
        except Exception as e:
            if self.verbose:
                print(f"⚠️ Could not load scenario builder model: {e}")

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
    ) -> Dict[str, List[Dict[str, Any]]]:
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
            fc["renewable_share"].append(
                {"year": year, "value": round(min(100.0, base["renewable_share"] * (1.02**t)), 2)}
            )
            fc["electricity_demand"].append(
                {"year": year, "value": round(base["electricity_demand"] * (1.03**t), 2)}
            )
            fc["co2_emissions"].append(
                {"year": year, "value": round(max(0.0, base["co2_emissions"] * (0.99**t)), 2)}
            )
            fc["energy_poverty"].append(
                {"year": year, "value": round(max(0.0, base["energy_poverty"] * (0.98**t)), 2)}
            )
            fc["electricity_per_capita"].append(
                {"year": year, "value": round(base["electricity_per_capita"] * (1.025**t), 2)}
            )
            fc["electricity_per_capita_with_access"].append(
                {"year": year, "value": round(base["electricity_per_capita_with_access"] * (1.03**t), 2)}
            )
            fc["clean_cooking_access"].append(
                {"year": year, "value": round(min(100.0, base["clean_cooking_access"] * (1.015**t)), 2)}
            )
        return fc

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
            "greenhouse_gas_emissions": _safe_float(
                latest_row.get("greenhouse_gas_emissions", 100.0), 100.0
            ),
        }

        demand_growth_hist = self._country_growth_rate(
            country_df, "electricity_demand (TWh)", 0.03
        )
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

        access_target = scenario_params.get("energy_access_target")
        clean_target = scenario_params.get("clean_cooking_target")
        renew_target = scenario_params.get("renewable_target")

        demand_growth = float(
            scenario_params.get("demand_growth_rate", demand_growth_hist) or demand_growth_hist
        )
        pop_growth = float(
            scenario_params.get("population_growth_rate", pop_growth_hist) or pop_growth_hist
        )
        gdp_growth = float(scenario_params.get("gdp_growth_rate", gdp_growth_hist) or gdp_growth_hist)

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

            access = (
                access_base
                if access_target is None
                else access_base + (float(access_target) - access_base) * p
            )
            clean = (
                clean_base
                if clean_target is None
                else clean_base + (float(clean_target) - clean_base) * p
            )
            renew = (
                renew_base
                if renew_target is None
                else renew_base + (float(renew_target) - renew_base) * p
            )

            demand_exog = max(0.0, demand_base * ((1 + demand_growth) ** t))
            population = max(1.0, pop_base * ((1 + pop_growth) ** t))
            gdp = max(1.0, gdp_base * ((1 + gdp_growth) ** t))

            current_levels["electricity_demand (TWh)"] = demand_exog

            forecasts["electricity_per_capita"].append(
                {
                    "year": int(year),
                    "value": round(max(0.0, current_levels[YEARLY_PER_CAPITA_MWH]), 2),
                }
            )
            forecasts["electricity_per_capita_with_access"].append(
                {
                    "year": int(year),
                    "value": round(
                        max(0.0, current_levels[YEARLY_PER_CAPITA_WITH_ACCESS_MWH]), 2
                    ),
                }
            )
            forecasts["energy_poverty"].append(
                {"year": int(year), "value": round(_clamp_pct(100.0 - access), 2)}
            )
            forecasts["energy_poverty_multidimensional"].append(
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
            forecasts["co2_emissions"].append(
                {
                    "year": int(year),
                    "value": round(max(0.0, current_levels["greenhouse_gas_emissions"]), 2),
                }
            )
            forecasts["electricity_demand"].append(
                {"year": int(year), "value": round(demand_exog, 2)}
            )
            forecasts["renewable_share"].append(
                {"year": int(year), "value": round(_clamp_pct(renew), 2)}
            )
            forecasts["clean_cooking_access"].append(
                {"year": int(year), "value": round(_clamp_pct(clean), 2)}
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
                pred_growth[ghg_idx] = float(
                    np.asarray(ghg_growth_pred, dtype=float).reshape(-1)[0]
                )

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
            "electricity_per_capita_with_access": forecasts[
                "electricity_per_capita_with_access"
            ][-1]["value"],
            "energy_poverty": forecasts["energy_poverty"][-1]["value"],
            "renewable_share": forecasts["renewable_share"][-1]["value"],
            "electricity_demand": forecasts["electricity_demand"][-1]["value"],
            "co2_emissions": forecasts["co2_emissions"][-1]["value"],
        }

        return {"forecasts": forecasts, "summary": summary}

    def simulate_scenario(
        self,
        country: str,
        start_year: int,
        end_year: int,
        scenario_params: Dict[str, Any],
    ) -> Dict[str, Any]:
        if self.historical_data is None or self.historical_data.empty:
            baseline = self._generate_default_forecast(start_year, end_year)
            return {
                "forecasts": baseline,
                "summary": {
                    "electricity_per_capita": baseline["electricity_per_capita"][-1]["value"],
                    "electricity_per_capita_with_access": baseline[
                        "electricity_per_capita_with_access"
                    ][-1]["value"],
                    "energy_poverty": baseline["energy_poverty"][-1]["value"],
                    "co2_emissions": baseline["co2_emissions"][-1]["value"],
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
                scenario_params=scenario_params,
            )

        raise RuntimeError(
            "Scenario builder model is unavailable. "
            "Retrain and place scenario_builder.joblib in api/ml_models."
        )
