"""Unit tests for scenario explorer helpers."""

from __future__ import annotations

import pandas as pd

from app.services.scenario_simulation.scenario_helpers import (
    compute_country_envelope,
    demand_from_per_capita,
    interpolate_target,
    parameter_warnings,
    per_capita_with_access_from_total,
)


def test_demand_from_per_capita():
    # 0.175 MWh/person * 240e6 people = 42 TWh
    assert abs(demand_from_per_capita(0.175, 240_000_000) - 42.0) < 1e-9


def test_per_capita_with_access_from_total():
    assert abs(per_capita_with_access_from_total(0.1, 50.0) - 0.2) < 1e-12


def test_interpolate_target():
    assert abs(interpolate_target(50.0, 100.0, 0.0) - 50.0) < 1e-12
    assert abs(interpolate_target(50.0, 100.0, 1.0) - 100.0) < 1e-12
    assert abs(interpolate_target(50.0, 100.0, 0.5) - 75.0) < 1e-12


def test_envelope_floors_policy_targets_at_latest_levels():
    df = pd.DataFrame(
        {
            "year": [2020, 2021, 2022],
            "population": [1e6, 1.02e6, 1.04e6],
            "gdp": [1e9, 1.05e9, 1.1e9],
            "electricity_demand (TWh)": [10.0, 10.5, 11.0],
            "renewables_share_elec": [20.0, 22.0, 25.0],
            "Access to electricity (% of total population)": [70.0, 72.0, 80.0],
            "Access to Clean Fuels and Technologies for cooking (% of total population)": [
                40.0,
                42.0,
                45.0,
            ],
        }
    )
    envelope = compute_country_envelope(df)
    assert envelope["defaults"]["energy_access_target"] == 80.0
    assert envelope["slider_bounds"]["energy_access_target"]["min"] == 80.0
    assert envelope["slider_bounds"]["renewable_target"]["min"] == 25.0
    assert envelope["slider_bounds"]["clean_cooking_target"]["min"] == 45.0


def test_parameter_warnings_for_target_below_floor():
    envelope = {
        "slider_bounds": {"energy_access_target": {"min": 90.0, "max": 100.0}},
        "historical_cagr": {},
    }
    warnings = parameter_warnings({"energy_access_target": 85.0}, envelope)
    assert any("below" in w.lower() for w in warnings)
