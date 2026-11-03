"""Ensure RealtimeAggregator delegates to shared statistical_projection."""

from __future__ import annotations

from app.services.realtime.aggregator import RealtimeAggregator
from app.utils import statistical_projection as sp


def test_aggregator_absolute_projection_matches_shared():
    agg = RealtimeAggregator()
    shared = sp.project_absolute(100.0, 2020, 0.04, 2027)
    via_agg = agg._project_absolute(100.0, 2020, 0.04, 2027)
    assert abs(shared - via_agg) < 1e-12


def test_aggregator_dampening_matches_shared():
    for years in (1, 2, 3, 5, 6, 10):
        assert RealtimeAggregator._dampening_factor(years) == sp.dampening_factor(years)


def test_aggregator_confidence_interval_includes_method_note():
    agg = RealtimeAggregator()
    ci = agg._confidence_interval(100.0, 0.8, 3)
    assert "method" in ci
    assert "note" in ci
