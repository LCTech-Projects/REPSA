"""Flask API smoke tests for core endpoints."""

from __future__ import annotations


def test_health(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.get_json()["status"] == "ok"


def test_available_countries(client):
    resp = client.get("/api/historical/available-countries")
    assert resp.status_code == 200
    body = resp.get_json()
    assert body.get("success") is True or "data" in body
    countries = body.get("data") or body.get("countries") or []
    assert isinstance(countries, list)
    assert len(countries) >= 50


def test_country_envelope(client):
    resp = client.get("/api/scenario-simulation/country-envelope", query_string={"country": "Kenya"})
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["success"] is True
    data = body["data"]
    assert "defaults" in data
    assert "slider_bounds" in data
    assert data["slider_bounds"]["energy_access_target"]["min"] <= 100.0
    assert data["defaults"]["energy_access_target"] >= data["slider_bounds"]["energy_access_target"]["min"] - 1e-6


def test_hourly_electricity_demand_csv_shape(client):
    resp = client.get(
        "/api/historical/hourly-electricity-demand",
        query_string={"country": "Nigeria", "year": 2024},
    )
    assert resp.status_code == 200
    body = resp.get_json()
    # Accept either wrapped or raw payloads used by the API
    rows = None
    if isinstance(body, dict):
        data = body.get("data", body)
        if isinstance(data, list):
            rows = data
        elif isinstance(data, dict):
            rows = data.get("data") or data.get("records") or data.get("hourly")
    assert rows is not None, f"Unexpected hourly payload keys: {body.keys() if isinstance(body, dict) else type(body)}"
    assert len(rows) >= 24
    sample = rows[0]
    keys = {str(k).lower() for k in sample.keys()}
    assert any("demand" in k for k in keys)
