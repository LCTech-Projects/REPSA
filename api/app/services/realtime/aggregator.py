"""
Statistical Aggregation Service for "Realtime" Energy Data (Estimated)

This service estimates current-year values using authoritative historical yearly data.
"""

import os
import pandas as pd
import numpy as np
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime
from app.utils.config import Config
from app.utils.cache import cache
from app.utils.per_capita_units import (
    YEARLY_PER_CAPITA_KWH,
    YEARLY_PER_CAPITA_MWH,
)


class RealtimeAggregator:
    """
    Aggregates and projects "realtime" energy statistics based on historical data.

    Notes:
    - Values are estimates (current-year projections) derived from yearly time series.
    - "Live counters" are derived from these projected values.
    """

    # --- Metric configuration (edit here, not scattered in code) ---
    METRICS = {
        # key: (column_name, kind, bounds)
        # kind in {"absolute", "percent_logistic", "percent_linear"}
        "population": ("population", "absolute", None),
        "electricity_demand": ("electricity_demand (TWh)", "absolute", None),
        "electricity_generation": ("electricity_generation (TWh)", "absolute", None),
        "electricity_access": ("Access to electricity (% of total population)", "percent_logistic", (0.0, 100.0)),
        "renewable_share": ("renewables_share_elec", "percent_linear", (0.0, 100.0)),
        "energy_poverty": ("energy_poverty_electricity (% of total population)", "percent_linear", (0.0, 100.0)),
        "electricity_demand_per_capita": ("electricity_demand_per_capita (MWh)", "absolute", None),
    }
    POPULATION_GROWTH_COLUMN = "Population growth (annual %)"

    def __init__(self):
        self.data_dir = Config.DATA_DIR
        self.yearly_data_path = os.path.join(self.data_dir, "historical", "yearly_historical_data.csv")

    # ---------------------------
    # Data loading / normalization
    # ---------------------------
    def _load_yearly_data(self) -> pd.DataFrame:
        if not os.path.exists(self.yearly_data_path):
            raise FileNotFoundError(f"Yearly data file not found at {self.yearly_data_path}")
        df = pd.read_csv(self.yearly_data_path)
        # Basic sanity
        if "country" not in df.columns or "year" not in df.columns:
            raise ValueError("yearly_historical_data.csv must contain at least 'country' and 'year' columns.")
        if YEARLY_PER_CAPITA_MWH not in df.columns and YEARLY_PER_CAPITA_KWH in df.columns:
            df[YEARLY_PER_CAPITA_MWH] = pd.to_numeric(df[YEARLY_PER_CAPITA_KWH], errors="coerce") / 1000.0
        return df

    def _normalize_country_name(self, df: pd.DataFrame, country: str) -> pd.DataFrame:
        """Return a filtered copy for the requested country without mutating original df."""
        country_norm = (country or "").lower().strip()
        tmp = df.copy()
        tmp["country_normalized"] = tmp["country"].astype(str).str.lower().str.strip()
        filtered = tmp[tmp["country_normalized"] == country_norm].drop(columns=["country_normalized"])
        return filtered

    def _filter_valid_years(self, df: pd.DataFrame) -> pd.DataFrame:
        """Filter to years up to YEAR_FILTER_LIMIT and sort."""
        tmp = df.copy()
        tmp = tmp[tmp["year"] <= Config.YEAR_FILTER_LIMIT]
        return tmp.sort_values("year")

    # ---------------------------
    # Time helpers
    # ---------------------------
    @staticmethod
    def _estimate_year_progress(now: datetime) -> float:
        """How far through the current year we are (0..1)."""
        year_start = datetime(now.year, 1, 1)
        year_end = datetime(now.year + 1, 1, 1)
        total = (year_end - year_start).total_seconds()
        elapsed = (now - year_start).total_seconds()
        if total <= 0:
            return 0.0
        return float(min(1.0, max(0.0, elapsed / total)))

    # ---------------------------
    # Projection helpers
    # ---------------------------
    @staticmethod
    def _clamp(value: float, bounds: Optional[Tuple[float, float]]) -> float:
        if value is None or pd.isna(value):
            return 0.0
        if not bounds:
            return float(max(0.0, value))
        lo, hi = bounds
        return float(min(hi, max(lo, value)))

    @staticmethod
    def _dampening_factor(years_diff: int) -> float:
        """
        Dampening reduces growth rates for long projections:
        - 0-2 years: 100%
        - 3-5 years: 70%
        - 6+ years: 40%
        """
        if years_diff <= 2:
            return 1.0
        if years_diff <= 5:
            return 0.7
        return 0.4

    @staticmethod
    def _clean_timeseries(years: List[int], values: List[float], kind: str) -> Tuple[List[int], List[float]]:
        """
        Clean timeseries based on metric type:
        - Percent metrics: allow 0..100 (keep 0), drop NaN, drop negatives.
        - Absolute metrics: require >0 (drop 0, negatives), drop NaN.
        """
        cleaned = []
        for y, v in zip(years, values):
            if pd.isna(v):
                continue
            try:
                v = float(v)
            except (TypeError, ValueError):
                continue
            if kind.startswith("percent"):
                if v < 0:
                    continue
                cleaned.append((int(y), v))
            else:
                # absolute
                if v <= 0:
                    continue
                cleaned.append((int(y), v))

        if len(cleaned) < 1:
            return [], []
        cleaned.sort(key=lambda t: t[0])
        ys, vs = zip(*cleaned)
        return list(ys), list(vs)

    @staticmethod
    def _log_linear_growth_rate(years: List[int], values: List[float]) -> Tuple[float, float]:
        """
        Estimate exponential growth using log-linear regression:
        log(v) = a + b*year. Returns (b, R²).
        b is the continuous growth rate (per year).
        """
        if len(values) < 2:
            return 0.0, 0.0

        y = np.array(values, dtype=float)
        x = np.array(years, dtype=float)

        # guard: all positive already by cleaning
        logy = np.log(y)

        x_mean = x.mean()
        y_mean = logy.mean()

        denom = np.sum((x - x_mean) ** 2)
        if denom == 0:
            return 0.0, 0.0

        b = float(np.sum((x - x_mean) * (logy - y_mean)) / denom)
        pred = y_mean + b * (x - x_mean)

        ss_res = float(np.sum((logy - pred) ** 2))
        ss_tot = float(np.sum((logy - y_mean) ** 2))
        r2 = 1.0 - (ss_res / ss_tot) if ss_tot > 0 else 0.0
        r2 = float(max(0.0, min(1.0, r2)))
        return b, r2

    @staticmethod
    def _linear_fit_r2(years: List[int], values: List[float]) -> Tuple[float, float, float]:
        """Fit y = a + b*x. Return (a, b, R²)."""
        if len(values) < 2:
            v = float(values[-1]) if values else 0.0
            return v, 0.0, 0.0

        x = np.array(years, dtype=float)
        y = np.array(values, dtype=float)

        x_mean = x.mean()
        y_mean = y.mean()

        denom = np.sum((x - x_mean) ** 2)
        if denom == 0:
            return float(y_mean), 0.0, 0.0

        b = float(np.sum((x - x_mean) * (y - y_mean)) / denom)
        a = float(y_mean - b * x_mean)

        y_hat = a + b * x
        ss_res = float(np.sum((y - y_hat) ** 2))
        ss_tot = float(np.sum((y - y_mean) ** 2))
        r2 = 1.0 - (ss_res / ss_tot) if ss_tot > 0 else 0.0
        r2 = float(max(0.0, min(1.0, r2)))
        return a, b, r2

    def _project_absolute(self, latest_value: float, latest_year: int, growth_rate: float, target_year: int) -> float:
        """Dampened exponential projection for absolute metrics."""
        if latest_value is None or pd.isna(latest_value) or latest_value <= 0:
            return 0.0
        years_diff = int(target_year) - int(latest_year)
        if years_diff <= 0:
            return float(latest_value)

        damp = self._dampening_factor(years_diff)
        effective_rate = float(growth_rate) * damp
        projected = float(latest_value) * float(np.exp(effective_rate * years_diff))
        return max(0.0, projected)

    def _project_percent_linear(self, years: List[int], values: List[float], target_year: int, bounds=(0.0, 100.0)) -> Tuple[float, float]:
        """Linear projection for bounded percentages. Returns (projected_value, r2)."""
        a, b, r2 = self._linear_fit_r2(years, values)
        projected = float(a + b * float(target_year))
        return self._clamp(projected, bounds), r2

    def _project_percent_logistic(self, years: List[int], values: List[float], target_year: int, upper_bound: float = 100.0) -> Tuple[float, float]:
        """
        Simple logistic-style projection for access metrics:
        We do a transform: z = log(y/(L-y)) and fit z ~ a + b*t where 0<y<L.
        Then invert back. Returns (projected_value, pseudo_r2).

        This avoids hardcoding R² and uses a data-driven fit.
        """
        if len(values) < 2:
            v = float(values[-1]) if values else 0.0
            return self._clamp(v, (0.0, upper_bound)), 0.0

        L = float(upper_bound)
        eps = 1e-6

        # Keep only values strictly between (0, L) for logit transform
        clean = []
        for y, v in zip(years, values):
            v = float(v)
            v = min(L - eps, max(eps, v))
            clean.append((int(y), v))

        ys = [c[0] for c in clean]
        vs = [c[1] for c in clean]

        # logit transform
        z = [float(np.log(v / (L - v))) for v in vs]

        # fit z = a + b*year
        a, b, r2 = self._linear_fit_r2(ys, z)

        z_hat = float(a + b * float(target_year))
        # inverse logit: y = L / (1 + exp(-z))
        projected = L / (1.0 + float(np.exp(-z_hat)))
        projected = self._clamp(projected, (0.0, L))
        return projected, r2

    def _confidence_interval(self, projected_value: float, r2: Optional[float], years_diff: int) -> Dict[str, float]:
        """
        Confidence interval:
        - wider for longer projections
        - wider for low model fit
        """
        pv = float(projected_value) if projected_value is not None else 0.0
        r2 = 0.0 if r2 is None or pd.isna(r2) else float(r2)

        base_uncertainty = 0.05 + (0.03 * max(0, years_diff))  # 5% + 3% per year
        fit_factor = 1.0 + (1.0 - r2) * 0.6  # up to +60% uncertainty for poor fit
        total_unc = min(0.6, base_uncertainty * fit_factor)    # cap at 60%

        margin = abs(pv) * total_unc
        lower = max(0.0, pv - margin)
        upper = pv + margin

        confidence = max(0.45, min(0.95, r2 * (1.0 - max(0, years_diff) * 0.06)))

        return {
            "lower": float(lower),
            "upper": float(upper),
            "confidence_level": float(confidence),
            "uncertainty_pct": float(total_unc * 100.0),
        }

    def _get_timeseries_from_country_data(self, country_data: pd.DataFrame, column: str) -> Tuple[List[int], List[float]]:
        """Extract (years, values) from already-filtered country_data."""
        if country_data.empty or column not in country_data.columns:
            return [], []
        years = country_data["year"].astype(int).tolist()
        values = country_data[column].tolist()
        return years, values

    def _get_limit_year_population_growth_rate(self, latest_row: pd.Series) -> Optional[float]:
        """Return limit-year population growth rate as decimal (e.g., 0.02), or None when unavailable."""
        if self.POPULATION_GROWTH_COLUMN not in latest_row.index:
            return None
        raw_val = latest_row.get(self.POPULATION_GROWTH_COLUMN)
        if raw_val is None or pd.isna(raw_val):
            return None
        try:
            # CSV stores annual percent values; convert percent -> decimal.
            return float(raw_val) / 100.0
        except (TypeError, ValueError):
            return None

    # ---------------------------
    # Public API
    # ---------------------------
    @cache.memoize(timeout=Config.REALTIME_CACHE_TIMEOUT)
    def get_realtime_estimates(self, country: str) -> Dict[str, Any]:
        """
        Return projected current-year estimates for a country.

        This is cached for a short TTL (Config.REALTIME_CACHE_TIMEOUT seconds).
        Time-dependent fields (timestamp/year_progress)
        are recomputed per call but the memoized wrapper may return cached values.
        If you need the timestamp to always reflect "now", remove memoize or keep
        caching only for the heavy parts and patch timestamp outside the cache.
        """
        now = datetime.now()
        current_year = now.year
        year_progress = self._estimate_year_progress(now)

        df = self._load_yearly_data()
        country_data = self._normalize_country_name(df, country)
        if country_data.empty:
            return {
                "country": country,
                "timestamp": now.isoformat(),
                "error": f"No data found for country: {country}",
            }

        country_data = self._filter_valid_years(country_data)
        latest_year = int(country_data["year"].max())
        latest_row = country_data[country_data["year"] == latest_year].iloc[0]

        estimates: Dict[str, Any] = {}
        projections: Dict[str, Any] = {}

        for metric_key, (col, kind, bounds) in self.METRICS.items():
            if col not in country_data.columns:
                continue

            years_raw, values_raw = self._get_timeseries_from_country_data(country_data, col)
            years, values = self._clean_timeseries(years_raw, values_raw, kind)

            if len(values) < 2:
                # Not enough history: fallback to latest available cell
                latest_val = None
                try:
                    latest_val = float(latest_row[col]) if pd.notna(latest_row[col]) else None
                except Exception:
                    latest_val = None

                # clamp if percent
                if kind.startswith("percent") and latest_val is not None:
                    latest_val = self._clamp(latest_val, bounds)

                # Population special case: project with limit-year growth rate.
                if (
                    metric_key == "population"
                    and kind == "absolute"
                    and latest_val is not None
                    and latest_year < current_year
                ):
                    growth_rate = self._get_limit_year_population_growth_rate(latest_row)
                    # No regression fallback: when missing, assume flat growth.
                    if growth_rate is None:
                        growth_rate = 0.0

                    start_of_year = self._project_absolute(latest_val, latest_year, growth_rate, current_year)
                    end_of_year = self._project_absolute(latest_val, latest_year, growth_rate, current_year + 1)
                    current_estimate = start_of_year + (end_of_year - start_of_year) * year_progress

                    estimates[metric_key] = current_estimate
                    projections[metric_key] = {
                        "latest_value": latest_val,
                        "latest_year": latest_year,
                        "projected_value": start_of_year,
                        "current_estimate": current_estimate,
                        "projection_year": current_year,
                        "growth_rate": float(growth_rate),
                        "r_squared": None,
                        "year_progress": year_progress,
                        "method": "limit_year_population_growth_rate_exponential",
                        "confidence_interval": self._confidence_interval(float(current_estimate or 0.0), None, max(0, current_year - latest_year)),
                        "projection_distance_years": int(current_year - latest_year),
                    }
                    continue

                estimates[metric_key] = latest_val
                projections[metric_key] = {
                    "latest_value": latest_val,
                    "latest_year": latest_year,
                    "projected_value": latest_val,
                    "current_estimate": latest_val,
                    "projection_year": current_year,
                    "growth_rate": 0.0,
                    "r_squared": None,
                    "year_progress": year_progress,
                    "method": "no_projection",
                    "confidence_interval": self._confidence_interval(float(latest_val or 0.0), None, max(0, current_year - latest_year)),
                    "projection_distance_years": int(current_year - latest_year),
                }
                continue

            latest_value = float(values[-1])
            latest_year_metric = int(years[-1])
            years_diff = int(current_year - latest_year_metric)

            method = ""
            growth_rate = None
            r2 = None
            projected_value = None

            if kind == "percent_logistic":
                projected_value, r2 = self._project_percent_logistic(years, values, current_year, upper_bound=bounds[1] if bounds else 100.0)
                method = "logistic_logit_linear"
                growth_rate = None
            elif kind == "percent_linear":
                projected_value, r2 = self._project_percent_linear(years, values, current_year, bounds=bounds or (0.0, 100.0))
                method = "linear_projection"
                growth_rate = None
            else:
                # absolute
                if metric_key == "population":
                    growth_rate = self._get_limit_year_population_growth_rate(latest_row)
                    # No regression fallback: when missing, assume flat growth.
                    if growth_rate is None:
                        growth_rate = 0.0
                    r2 = None
                    projected_value = self._project_absolute(latest_value, latest_year_metric, growth_rate, current_year)
                    method = "limit_year_population_growth_rate_exponential"
                else:
                    growth_rate, r2 = self._log_linear_growth_rate(years, values)  # continuous growth
                    projected_value = self._project_absolute(latest_value, latest_year_metric, growth_rate, current_year)
                    method = "dampened_exponential_log_linear"

            # Intra-year interpolation (only for population, because it's continuously changing)
            if metric_key == "population" and latest_year_metric < current_year:
                # interpret projections at year boundaries:
                # start_of_year = estimate at Jan 1 of current_year
                # end_of_year   = estimate at Jan 1 of current_year+1
                # We approximate Jan 1 values using the same model.
                if kind == "absolute":
                    # start_of_year
                    start_of_year = self._project_absolute(latest_value, latest_year_metric, growth_rate or 0.0, current_year)
                    end_of_year = self._project_absolute(latest_value, latest_year_metric, growth_rate or 0.0, current_year + 1)
                    current_estimate = start_of_year + (end_of_year - start_of_year) * year_progress
                else:
                    current_estimate = projected_value
            else:
                current_estimate = projected_value

            # Clamp percent estimates
            if kind.startswith("percent"):
                current_estimate = self._clamp(float(current_estimate), bounds)
                projected_value = self._clamp(float(projected_value), bounds)

            # Confidence interval
            ci = self._confidence_interval(float(current_estimate or 0.0), r2, max(0, years_diff))

            estimates[metric_key] = current_estimate
            projections[metric_key] = {
                "latest_value": latest_value,
                "latest_year": latest_year_metric,
                "projected_value": projected_value,
                "current_estimate": current_estimate,
                "projection_year": current_year,
                "growth_rate": float(growth_rate) if growth_rate is not None else None,
                "r_squared": float(r2) if r2 is not None else None,
                "year_progress": year_progress,
                "method": method,
                "confidence_interval": ci,
                "projection_distance_years": int(years_diff),
            }

        # Derived metrics
        if estimates.get("population") and estimates.get("electricity_demand"):
            pop = float(estimates["population"]) if estimates["population"] else 0.0
            dem = float(estimates["electricity_demand"]) if estimates["electricity_demand"] else 0.0
            estimates["electricity_demand_per_capita_current"] = (dem * 1e6 / pop) if pop > 0 else None  # TWh -> MWh/capita·yr

        # Live counters (UI-facing)
        live_counters: Dict[str, Any] = {}
        if estimates.get("population"):
            live_counters["population"] = {
                "value": int(round(max(0.0, float(estimates["population"])))),
                "unit": "people",
                "description": "Estimated current population (interpolated within current year)",
            }

        if estimates.get("electricity_demand"):
            live_counters["electricity_demand"] = {
                "value": float(estimates["electricity_demand"]) * 1e6,  # TWh -> MWh
                "unit": "MWh",
                "description": "Estimated annual electricity demand (current-year projection)",
            }

        if estimates.get("electricity_generation"):
            live_counters["electricity_generation"] = {
                "value": float(estimates["electricity_generation"]) * 1e6,  # TWh -> MWh
                "unit": "MWh",
                "description": "Estimated annual electricity generation (current-year projection)",
            }

        if estimates.get("electricity_access") is not None:
            live_counters["electricity_access"] = {
                "value": float(estimates["electricity_access"]),
                "unit": "%",
                "description": "Estimated electricity access (current-year projection)",
            }

        return {
            "country": country,
            "timestamp": now.isoformat(),
            "current_year": current_year,
            "latest_data_year": latest_year,
            "data_age_years": int(current_year - latest_year),
            "estimates": estimates,
            "projections": projections,
            "live_counters": live_counters,
            "methodology": {
                "approach": "statistical_aggregation",
                "description": (
                    "Estimates based on historical trends from authoritative sources using metric-appropriate projections "
                    "(dampened exponential for absolute metrics, linear for bounded percentages, logit-linear for access). "
                ),
                "projection_methods": {
                    "dampened_exponential_log_linear": "Absolute metrics. Uses log-linear regression to estimate continuous growth rate, then projects with dampening based on distance.",
                    "limit_year_population_growth_rate_exponential": "Population only (optional). Uses the latest allowed year's 'Population growth (annual %)' as the growth rate and projects exponentially with dampening; no regression fallback is used.",
                    "linear_projection": "Bounded % metrics. Simple linear regression with bounds enforcement; R² computed from fit.",
                    "logistic_logit_linear": "Electricity access. Uses logit transform with linear regression (data-driven) and inverse transform to keep within 0–100; R² computed on transformed fit.",
                },
                "dampening": {
                    "0-2_years": "100% of estimated growth rate",
                    "3-5_years": "70% of estimated growth rate",
                    "6+_years": "40% of estimated growth rate",
                },
                "confidence_intervals": "Intervals widen with lower R² and longer projection distance.",
                "data_sources": [
                    "World Bank Open Data - Population, electricity access, energy poverty metrics",
                    "Our World in Data (OWID) - Historical energy and electricity statistics",
                ],
                "note": "These are estimates derived from annual historical data and should not be interpreted as measured real-time telemetry.",
            },
        }

    def get_realtime_data(self, country: str) -> Dict[str, Any]:
        """Compatibility alias."""
        return self.get_realtime_estimates(country)
