"""Unit tests for yearly per-capita unit helpers."""

from __future__ import annotations

import pandas as pd

from app.utils.per_capita_units import (
    YEARLY_PER_CAPITA_KWH,
    YEARLY_PER_CAPITA_MWH,
    add_yearly_per_capita_mwh_columns,
    yearly_per_capita_mwh,
)


def test_yearly_per_capita_prefers_mwh_column():
    row = pd.Series({YEARLY_PER_CAPITA_MWH: 0.175, YEARLY_PER_CAPITA_KWH: 999.0})
    assert abs(yearly_per_capita_mwh(row, with_access=False) - 0.175) < 1e-12


def test_yearly_per_capita_falls_back_to_kwh():
    row = pd.Series({YEARLY_PER_CAPITA_KWH: 175.0})
    assert abs(yearly_per_capita_mwh(row, with_access=False) - 0.175) < 1e-12


def test_add_yearly_per_capita_mwh_columns_from_legacy_kwh():
    df = pd.DataFrame({YEARLY_PER_CAPITA_KWH: [100.0, 200.0]})
    out = add_yearly_per_capita_mwh_columns(df)
    assert abs(out["electricity_demand_per_capita_mwh"].iloc[0] - 0.1) < 1e-12
    assert abs(out["electricity_demand_per_capita_mwh"].iloc[1] - 0.2) < 1e-12
