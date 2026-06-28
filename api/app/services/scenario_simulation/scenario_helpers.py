"""Shared helpers for the scenario explorer."""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

MODEL_OUTPUT_KEYS = [
    "electricity_demand",
    "electricity_per_capita",
    "electricity_per_capita_with_access",
    "energy_poverty_multidimensional",
    "carbon_intensity_elec",
]

ASSUMPTION_KEYS = [
    "renewable_share",
    "electricity_access",
    "clean_cooking_access",
    "population",
]


def interpolate_target(
    base: float,
    target: Optional[float],
    progress: float,
) -> float:
    if target is None:
        return float(base)
    return float(base + (float(target) - base) * progress)


def band_log_growth(
    predicted_growth: float,
    target_col: str,
    residual_q: Dict[str, float],
) -> Tuple[float, float]:
    """Map one-step model growth to low/high band growth with sane caps."""
    if target_col == "carbon_intensity_elec":
        # Joint-model residuals are not used for intensity (separate sub-model path).
        delta = 0.04
        return predicted_growth - delta, predicted_growth + delta

    g_low = predicted_growth + float(residual_q.get("q10", 0.0))
    g_high = predicted_growth + float(residual_q.get("q90", 0.0))
    cap = 0.08 if "energy_poverty" in target_col else 0.12
    return max(-cap, g_low), min(cap, g_high)


def compound_series(
    start_value: float,
    growth_rate: float,
    years: List[int],
    start_year: int,
) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    start = float(start_value)
    for year in years:
        t = year - start_year
        value = start * ((1.0 + growth_rate) ** t)
        out.append({"year": int(year), "value": round(value, 4)})
    return out


def persistence_baseline(
    latest_values: Dict[str, float],
    years: List[int],
) -> Dict[str, List[Dict[str, Any]]]:
    return {
        key: [{"year": int(y), "value": round(float(latest_values.get(key, 0.0)), 4)} for y in years]
        for key in MODEL_OUTPUT_KEYS
    }


def trend_baseline(
    latest_values: Dict[str, float],
    growth_rates: Dict[str, float],
    years: List[int],
    start_year: int,
) -> Dict[str, List[Dict[str, Any]]]:
    return {
        key: compound_series(
            latest_values.get(key, 0.0),
            growth_rates.get(key, 0.0),
            years,
            start_year,
        )
        for key in MODEL_OUTPUT_KEYS
    }


def band_from_paths(
    scenario: List[Dict[str, Any]],
    low: List[Dict[str, Any]],
    high: List[Dict[str, Any]],
) -> Dict[str, List[Dict[str, Any]]]:
    return {"scenario": scenario, "low": low, "high": high}


def demand_from_per_capita(per_capita_mwh: float, population: float) -> float:
    return max(0.0, float(per_capita_mwh) * float(population) / 1_000_000.0)


def per_capita_with_access_from_total(per_capita_mwh: float, access_pct: float) -> float:
    """Population-average MWh/person implied by demand among connected users."""
    access_frac = max(0.01, min(1.0, float(access_pct) / 100.0))
    return max(0.0, float(per_capita_mwh)) / access_frac


def sync_per_capita_with_access(levels: Dict[str, float], access_pct: float) -> None:
    levels["electricity_demand_per_capita_with_access (MWh)"] = per_capita_with_access_from_total(
        levels.get("electricity_demand_per_capita (MWh)", 0.0),
        access_pct,
    )


def compute_supply_mix_features(
    renew_share: float,
    current_intensity: float,
    base_fossil_share: float,
    base_carbon_intensity: float,
) -> Dict[str, float]:
    """Derive mix features from the renewable path and model intensity state."""
    fossil_share = max(0.0, min(100.0, 100.0 - float(renew_share)))
    low_carbon_share = max(0.0, min(100.0, float(renew_share)))
    base_fossil = max(5.0, min(95.0, float(base_fossil_share)))
    base_intensity = max(0.0, float(base_carbon_intensity))
    mix_factor = fossil_share / base_fossil if base_fossil > 0 else 1.0
    mix_implied_intensity = base_intensity * mix_factor
    intensity = (
        max(0.0, float(current_intensity))
        if current_intensity > 0
        else mix_implied_intensity
    )
    return {
        "fossil_share_elec": fossil_share,
        "low_carbon_share_elec": low_carbon_share,
        "carbon_intensity_elec": intensity,
        "mix_implied_intensity": mix_implied_intensity,
    }


def inject_supply_mix_features(
    feature_row: Dict[str, Any],
    mix: Dict[str, float],
) -> None:
    feature_row["fossil_share_elec"] = float(mix["fossil_share_elec"])
    feature_row["low_carbon_share_elec"] = float(mix["low_carbon_share_elec"])
    feature_row["carbon_intensity_elec"] = float(mix["carbon_intensity_elec"])


def compute_country_envelope(country_df: pd.DataFrame) -> Dict[str, Any]:
    def cagr(col: str, default: float) -> float:
        if col not in country_df.columns:
            return default
        tmp = country_df[["year", col]].dropna().sort_values("year")
        if len(tmp) < 2:
            return default
        y0 = float(tmp.iloc[0][col])
        y1 = float(tmp.iloc[-1][col])
        n = int(tmp.iloc[-1]["year"]) - int(tmp.iloc[0]["year"])
        if n <= 0 or y0 <= 0 or y1 <= 0:
            return default
        return (y1 / y0) ** (1 / n) - 1

    def yoy_bounds(col: str) -> Dict[str, float]:
        if col not in country_df.columns:
            return {"min": 0.0, "max": 0.0, "p95": 0.0}
        tmp = country_df[[col, "year"]].dropna().sort_values("year")
        prev = tmp[col].shift(1)
        yoy = (tmp[col] / prev - 1).replace([np.inf, -np.inf], np.nan).dropna()
        if yoy.empty:
            return {"min": 0.0, "max": 0.0, "p95": 0.0}
        return {
            "min": float(yoy.min()),
            "max": float(yoy.max()),
            "p95": float(yoy.quantile(0.95)),
        }

    latest = country_df.sort_values("year").iloc[-1]
    pop_g = cagr("population", 0.02)

    defaults = {
        "renewable_target": float(latest.get("renewables_share_elec", 20.0) or 20.0),
        "energy_access_target": float(
            latest.get("Access to electricity (% of total population)", 70.0) or 70.0
        ),
        "clean_cooking_target": float(
            latest.get(
                "Access to Clean Fuels and Technologies for cooking (% of total population)",
                40.0,
            )
            or 40.0
        ),
        "population_growth_rate": pop_g,
    }

    slider_bounds = {
        "population_growth_rate": {"min": max(-0.01, yoy_bounds("population")["min"]), "max": min(0.05, max(0.05, yoy_bounds("population")["p95"] * 1.2))},
    }

    historical_cagr = {
        "population": pop_g,
        "gdp": cagr("gdp", 0.03),
        "electricity_demand": cagr("electricity_demand (TWh)", 0.03),
        "renewables_share_elec": cagr("renewables_share_elec", 0.01),
        "electricity_access": cagr("Access to electricity (% of total population)", 0.01),
        "clean_cooking_access": cagr(
            "Access to Clean Fuels and Technologies for cooking (% of total population)",
            0.01,
        ),
    }

    unused_series = [
        "electricity_generation (TWh)",
        "fossil_share_elec",
        "low_carbon_share_elec",
        "carbon_intensity_elec",
        "solar_electricity",
        "wind_electricity",
        "hydro_electricity",
        "energy_poverty_electricity_rural (% of rural population)",
        "energy_poverty_electricity_urban (% of urban population)",
    ]
    available_unused = [c for c in unused_series if c in country_df.columns]

    return {
        "defaults": defaults,
        "slider_bounds": slider_bounds,
        "historical_cagr": historical_cagr,
        "latest_year": int(latest["year"]),
        "available_extended_series": available_unused,
        "missing_but_useful": [
            "installed_capacity_by_technology",
            "transmission_and_distribution_losses",
            "grid_reliability_or_outages",
            "power_sector_capex_or_lcoe",
            "tariff_levels_or_subsidies",
        ],
    }


def parameter_warnings(
    params: Dict[str, Any],
    envelope: Dict[str, Any],
) -> List[str]:
    warnings: List[str] = []
    bounds = envelope.get("slider_bounds", {})
    hist = envelope.get("historical_cagr", {})

    checks = [
        ("population_growth_rate", "population"),
    ]
    for param_key, hist_key in checks:
        value = params.get(param_key)
        if value is None:
            continue
        b = bounds.get(param_key, {})
        if b.get("max") is not None and float(value) > float(b["max"]):
            warnings.append(
                f"{param_key.replace('_', ' ')} ({float(value)*100:.1f}%) exceeds the typical historical envelope for this country."
            )
        hist_val = hist.get(hist_key)
        if hist_val is not None and abs(float(value) - float(hist_val)) > 0.03:
            warnings.append(
                f"{param_key.replace('_', ' ')} differs from this country's historical CAGR ({float(hist_val)*100:.1f}%)."
            )
    return warnings
