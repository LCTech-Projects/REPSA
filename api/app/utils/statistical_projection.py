"""Shared statistical projection helpers for nowcasting and panel extension.

Methods mirror RealtimeAggregator:
- absolute metrics: log-linear growth + dampened exponential projection
- access (%): logistic (logit-linear)
- other percentages: linear, clamped to bounds
"""

from __future__ import annotations

from typing import List, Optional, Sequence, Tuple

import numpy as np


def dampening_factor(years_diff: int) -> float:
    """Reduce effective growth for longer projection gaps."""
    if years_diff <= 2:
        return 1.0
    if years_diff <= 5:
        return 0.7
    return 0.4


def clamp(value: float, bounds: Optional[Tuple[float, float]]) -> float:
    if value is None or (isinstance(value, float) and np.isnan(value)):
        return 0.0
    if not bounds:
        return float(max(0.0, value))
    lo, hi = bounds
    return float(min(hi, max(lo, value)))


def clean_timeseries(
    years: Sequence[int],
    values: Sequence[float],
    kind: str,
) -> Tuple[List[int], List[float]]:
    """
    Clean timeseries by metric kind.
    - percent*: keep >= 0
    - absolute: keep > 0
    """
    cleaned: list[tuple[int, float]] = []
    for y, v in zip(years, values):
        if v is None or (isinstance(v, float) and np.isnan(v)):
            continue
        try:
            fv = float(v)
        except (TypeError, ValueError):
            continue
        if kind.startswith("percent"):
            if fv < 0:
                continue
            cleaned.append((int(y), fv))
        else:
            if fv <= 0:
                continue
            cleaned.append((int(y), fv))

    if not cleaned:
        return [], []
    cleaned.sort(key=lambda t: t[0])
    ys, vs = zip(*cleaned)
    return list(ys), list(vs)


def linear_fit_r2(years: Sequence[int], values: Sequence[float]) -> Tuple[float, float, float]:
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
    return a, b, float(max(0.0, min(1.0, r2)))


def log_linear_growth_rate(years: Sequence[int], values: Sequence[float]) -> Tuple[float, float]:
    """Estimate continuous growth rate b from log(v) = a + b*year. Returns (b, R²)."""
    if len(values) < 2:
        return 0.0, 0.0

    y = np.array(values, dtype=float)
    x = np.array(years, dtype=float)
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
    return b, float(max(0.0, min(1.0, r2)))


def project_absolute(
    latest_value: float,
    latest_year: int,
    growth_rate: float,
    target_year: int,
) -> float:
    """Dampened exponential projection for absolute metrics."""
    if latest_value is None or np.isnan(latest_value) or latest_value <= 0:
        return 0.0
    years_diff = int(target_year) - int(latest_year)
    if years_diff <= 0:
        return float(latest_value)
    effective_rate = float(growth_rate) * dampening_factor(years_diff)
    return max(0.0, float(latest_value) * float(np.exp(effective_rate * years_diff)))


def project_percent_linear(
    years: Sequence[int],
    values: Sequence[float],
    target_year: int,
    bounds: Tuple[float, float] = (0.0, 100.0),
) -> Tuple[float, float]:
    """Linear projection for bounded percentages. Returns (value, R²)."""
    a, b, r2 = linear_fit_r2(years, values)
    projected = float(a + b * float(target_year))
    return clamp(projected, bounds), r2


def project_percent_logistic(
    years: Sequence[int],
    values: Sequence[float],
    target_year: int,
    upper_bound: float = 100.0,
) -> Tuple[float, float]:
    """Logit-linear logistic projection for access-like percentages."""
    if len(values) < 2:
        v = float(values[-1]) if values else 0.0
        return clamp(v, (0.0, upper_bound)), 0.0

    L = float(upper_bound)
    eps = 1e-6
    clean: list[tuple[int, float]] = []
    for y, v in zip(years, values):
        fv = min(L - eps, max(eps, float(v)))
        clean.append((int(y), fv))

    ys = [c[0] for c in clean]
    vs = [c[1] for c in clean]
    z = [float(np.log(v / (L - v))) for v in vs]
    a, b, r2 = linear_fit_r2(ys, z)
    z_hat = float(a + b * float(target_year))
    projected = L / (1.0 + float(np.exp(-z_hat)))
    return clamp(projected, (0.0, L)), r2


def project_metric(
    years: Sequence[int],
    values: Sequence[float],
    target_year: int,
    kind: str,
    bounds: Optional[Tuple[float, float]] = None,
    population_growth_rate: Optional[float] = None,
) -> Tuple[Optional[float], str, Optional[float], Optional[int]]:
    """
    Project a single metric to target_year.

    Returns (projected_value, method, r_squared, base_year).
    """
    cleaned_years, cleaned_values = clean_timeseries(years, values, kind)
    if not cleaned_values:
        return None, "no_history", None, None

    latest_value = float(cleaned_values[-1])
    latest_year = int(cleaned_years[-1])
    if target_year <= latest_year:
        return latest_value, "observed_or_carry", None, latest_year

    if len(cleaned_values) < 2:
        if kind == "absolute" and population_growth_rate is not None:
            projected = project_absolute(
                latest_value, latest_year, float(population_growth_rate), target_year
            )
            return projected, "limit_year_population_growth_rate_exponential", None, latest_year
        return latest_value, "persistence", None, latest_year

    if kind == "percent_logistic":
        upper = bounds[1] if bounds else 100.0
        projected, r2 = project_percent_logistic(
            cleaned_years, cleaned_values, target_year, upper_bound=upper
        )
        return projected, "logistic_logit_linear", r2, latest_year

    if kind.startswith("percent"):
        projected, r2 = project_percent_linear(
            cleaned_years, cleaned_values, target_year, bounds=bounds or (0.0, 100.0)
        )
        return projected, "linear_projection", r2, latest_year

    # absolute
    if population_growth_rate is not None:
        projected = project_absolute(
            latest_value, latest_year, float(population_growth_rate), target_year
        )
        return projected, "limit_year_population_growth_rate_exponential", None, latest_year

    growth_rate, r2 = log_linear_growth_rate(cleaned_years, cleaned_values)
    projected = project_absolute(latest_value, latest_year, growth_rate, target_year)
    return projected, "dampened_exponential_log_linear", r2, latest_year
