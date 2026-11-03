"""Unit tests for shared projection helpers (Reviewer 4 / R1-6)."""

from __future__ import annotations

import math

from app.utils.statistical_projection import (
    confidence_interval,
    dampening_factor,
    project_absolute,
    project_percent_logistic,
)


def test_dampening_breakpoints():
    assert dampening_factor(1) == 1.0
    assert dampening_factor(2) == 1.0
    assert dampening_factor(3) == 0.7
    assert dampening_factor(5) == 0.7
    assert dampening_factor(6) == 0.4


def test_project_absolute_monotonic_for_positive_growth():
    """Year-by-year dampening must not drop between Δ=5 and Δ=6."""
    base = 100.0
    beta = 0.05
    year0 = 2020
    values = [
        project_absolute(base, year0, beta, year0 + delta)
        for delta in range(0, 12)
    ]
    for earlier, later in zip(values, values[1:]):
        assert later >= earlier - 1e-9


def test_project_absolute_matches_undamped_for_short_horizon():
    base = 50.0
    beta = 0.03
    projected = project_absolute(base, 2020, beta, 2022)
    expected = base * math.exp(beta) * math.exp(beta)
    assert abs(projected - expected) < 1e-9


def test_confidence_interval_widens_with_horizon():
    near = confidence_interval(100.0, r2=0.9, years_diff=1)
    far = confidence_interval(100.0, r2=0.9, years_diff=6)
    assert far["uncertainty_pct"] > near["uncertainty_pct"]
    assert far["upper"] - far["lower"] > near["upper"] - near["lower"]
    assert "heuristic" in near["method"]


def test_logistic_projection_stays_in_bounds():
    years = [2018, 2019, 2020, 2021]
    values = [40.0, 45.0, 50.0, 55.0]
    projected, r2 = project_percent_logistic(years, values, 2025)
    assert 0.0 <= projected <= 100.0
    assert r2 is not None
