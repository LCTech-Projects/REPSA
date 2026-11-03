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
    """Dampened exponential projection for absolute metrics.

    Growth is applied year-by-year. The dampening factor for step k (years
    ahead of the base year) multiplies only that step's growth rate, so the
    projected path is monotonic in the horizon for a fixed growth sign:

        v_{t+k} = v_{t+k-1} * exp(β * δ(k))

    This replaces the previous closed form v * exp(δ(Δ)·β·Δ), which was
    non-monotonic in Δ (e.g. a drop between five and six years ahead).
    """
    if latest_value is None or np.isnan(latest_value) or latest_value <= 0:
        return 0.0
    years_diff = int(target_year) - int(latest_year)
    if years_diff <= 0:
        return float(latest_value)

    value = float(latest_value)
    beta = float(growth_rate)
    for step in range(1, years_diff + 1):
        value *= float(np.exp(beta * dampening_factor(step)))
    return max(0.0, value)


def confidence_interval(
    projected_value: float,
    r2: Optional[float],
    years_diff: int,
) -> dict:
    """Heuristic uncertainty margin around a point projection.

    Not a calibrated statistical interval. Width grows with projection
    distance and shrinks with higher fit R²; capped at 60% of |value|.
    """
    pv = float(projected_value) if projected_value is not None else 0.0
    r2_val = 0.0 if r2 is None or (isinstance(r2, float) and np.isnan(r2)) else float(r2)

    base_uncertainty = 0.05 + (0.03 * max(0, years_diff))
    fit_factor = 1.0 + (1.0 - r2_val) * 0.6
    total_unc = min(0.6, base_uncertainty * fit_factor)

    margin = abs(pv) * total_unc
    confidence = max(0.45, min(0.95, r2_val * (1.0 - max(0, years_diff) * 0.06)))

    return {
        "lower": float(max(0.0, pv - margin)),
        "upper": float(pv + margin),
        "confidence_level": float(confidence),
        "uncertainty_pct": float(total_unc * 100.0),
        "method": "heuristic_r2_horizon_scaled",
        "note": (
            "Indicative margin only: 5% base + 3% per projection year, "
            "scaled by (1 + 0.6*(1-R²)), capped at 60%. Not a formal CI."
        ),
    }


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


def _linear_interpolate(
    y0: int,
    v0: float,
    y1: int,
    v1: float,
    target_year: int,
    kind: str,
    bounds: Optional[Tuple[float, float]],
) -> float:
    if y1 == y0:
        return float(v0)
    weight = (float(target_year) - float(y0)) / (float(y1) - float(y0))
    projected = float(v0) + weight * (float(v1) - float(v0))
    if kind.startswith("percent"):
        return clamp(projected, bounds or (0.0, 100.0))
    return float(max(0.0, projected))


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

    Interior gaps (target between measured years) use linear interpolation
    between the nearest bracketing observations — never carry the latest
    measured value backward into earlier holes.

    Returns (projected_value, method, r_squared, base_year).
    """
    cleaned_years, cleaned_values = clean_timeseries(years, values, kind)
    if not cleaned_values:
        return None, "no_history", None, None

    earliest_value = float(cleaned_values[0])
    earliest_year = int(cleaned_years[0])
    latest_value = float(cleaned_values[-1])
    latest_year = int(cleaned_years[-1])

    for year, value in zip(cleaned_years, cleaned_values):
        if int(year) == int(target_year):
            return float(value), "observed_or_carry", None, int(year)

    # Before first observation: hold earliest measured value.
    if target_year < earliest_year:
        return earliest_value, "observed_or_carry", None, earliest_year

    # Interior gap: interpolate between bracketing measured points.
    if target_year < latest_year:
        for idx in range(len(cleaned_years) - 1):
            y0 = int(cleaned_years[idx])
            y1 = int(cleaned_years[idx + 1])
            if y0 < target_year < y1:
                projected = _linear_interpolate(
                    y0,
                    float(cleaned_values[idx]),
                    y1,
                    float(cleaned_values[idx + 1]),
                    target_year,
                    kind,
                    bounds,
                )
                return projected, "linear_interpolation", None, y0
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
