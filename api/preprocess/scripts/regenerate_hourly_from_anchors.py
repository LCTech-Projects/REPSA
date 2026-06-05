"""Regenerate hourly electricity demand CSVs via haversine nearest-anchor transfer.

Anchor reference years (one full calendar year each):
  - South Africa: 2024 (Eskom)
  - Nigeria: 2016 (suppressed demand)
  - Morocco: 2023 (aggregated smart-meter zones)

Run from repo root:
  python api/preprocess/scripts/regenerate_hourly_from_anchors.py
  python api/preprocess/scripts/regenerate_hourly_from_anchors.py --dry-run
"""

from __future__ import annotations

import argparse
import math
import shutil
import sys
from pathlib import Path

import numpy as np
import pandas as pd

PREPROCESS_ROOT = Path(__file__).resolve().parents[1]
API_ROOT = PREPROCESS_ROOT.parent
sys.path.insert(0, str(API_ROOT))

from preprocess.scripts.country_centroids import ANCHOR_COUNTRIES, COUNTRY_CENTROIDS  # noqa: E402
from preprocess.scripts.normalize_anchor_timeseries import (  # noqa: E402
    DEMAND_COL,
    load_morocco_timeseries,
    load_nigeria_timeseries,
    load_south_africa_timeseries,
    normalize_all,
)

YEARLY_CSV = API_ROOT / "data" / "historical" / "yearly_historical_data.csv"
HOURLY_DIR = API_ROOT / "data" / "historical" / "hourly"
PER_CAPITA_COL = "electricity_demand_per_capita (kWh/person)"
PER_CAPITA_WITH_ACCESS_COL = "electricity_demand_per_capita_with_access (kWh/person)"

ANCHOR_REFERENCE_YEARS = {
    "South Africa": 2024,
    "Nigeria": 2016,
    "Morocco": 2023,
}


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius_km = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * radius_km * math.asin(min(1.0, math.sqrt(a)))


def _nearest_anchor(country: str) -> str:
    if country in ANCHOR_COUNTRIES:
        return country
    if country not in COUNTRY_CENTROIDS:
        raise KeyError(f"No centroid for country: {country}")
    lat, lon = COUNTRY_CENTROIDS[country]
    distances = {
        anchor: _haversine_km(lat, lon, COUNTRY_CENTROIDS[anchor][0], COUNTRY_CENTROIDS[anchor][1])
        for anchor in ANCHOR_COUNTRIES
    }
    return min(distances, key=distances.get)


def _country_csv_name(country: str) -> str:
    return country.replace(" ", "_") + ".csv"


def _load_anchor_hourly() -> dict[str, pd.DataFrame]:
    loaders = {
        "South Africa": load_south_africa_timeseries,
        "Nigeria": load_nigeria_timeseries,
        "Morocco": load_morocco_timeseries,
    }
    return {name: loader() for name, loader in loaders.items()}


def _shape_lookup_table(anchor_df: pd.DataFrame, reference_year: int) -> pd.Series:
    year_df = anchor_df[anchor_df["datetime"].dt.year == reference_year].copy()
    if year_df.empty:
        raise ValueError(f"No anchor rows for reference year {reference_year}")

    year_df["month"] = year_df["datetime"].dt.month
    year_df["day"] = year_df["datetime"].dt.day
    year_df["hour"] = year_df["datetime"].dt.hour
    grouped = year_df.groupby(["month", "day", "hour"], as_index=True)[DEMAND_COL].sum()
    grouped = grouped.clip(lower=0)
    total = grouped.sum()
    if total <= 0:
        raise ValueError(f"Non-positive anchor demand total for year {reference_year}")
    weights = grouped / total

    month_hour = year_df.groupby(["month", "hour"])[DEMAND_COL].sum()
    month_hour = (month_hour / month_hour.sum()).rename("mh_weight")
    global_hour = year_df.groupby("hour")[DEMAND_COL].sum()
    global_hour = (global_hour / global_hour.sum()).rename("h_weight")

    weights.attrs["month_hour"] = month_hour
    weights.attrs["global_hour"] = global_hour
    return weights


def _lookup_weight(weights: pd.Series, month: int, day: int, hour: int) -> float:
    key = (month, day, hour)
    if key in weights.index:
        return float(weights.loc[key])

    if month == 2 and day == 29:
        fallback = (2, 28, hour)
        if fallback in weights.index:
            return float(weights.loc[fallback])

    month_hour = weights.attrs["month_hour"]
    mh_key = (month, hour)
    if mh_key in month_hour.index:
        return float(month_hour.loc[mh_key])

    global_hour = weights.attrs["global_hour"]
    return float(global_hour.loc[hour])


def _build_year_hourly(
    country: str,
    year: int,
    annual_demand_mwh: float,
    weights: pd.Series,
) -> pd.DataFrame:
    hours = pd.date_range(f"{year}-01-01 00:00:00", f"{year}-12-31 23:00:00", freq="h")
    raw = np.array(
        [_lookup_weight(weights, ts.month, ts.day, ts.hour) for ts in hours],
        dtype=float,
    )
    total = raw.sum()
    if total <= 0:
        raise ValueError(f"Zero weight sum for {country} {year}")
    shares = raw / total
    demand = shares * annual_demand_mwh
    return pd.DataFrame({"datetime": hours, DEMAND_COL: demand})


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Regenerate hourly CSVs from anchor shape transfer.")
    parser.add_argument("--yearly", type=Path, default=YEARLY_CSV)
    parser.add_argument("--output-dir", type=Path, default=HOURLY_DIR)
    parser.add_argument("--min-year", type=int, default=2016)
    parser.add_argument("--max-year", type=int, default=2023)
    parser.add_argument("--only", type=str, default=None, help="Single country name")
    parser.add_argument("--backup", action="store_true", help="Write .bak before overwrite")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--assignments-out",
        type=Path,
        default=PREPROCESS_ROOT / "charts" / "validation" / "anchor_country_assignments.csv",
    )
    return parser.parse_args()


def main() -> int:
    args = _parse_args()
    normalize_all()

    yearly = pd.read_csv(args.yearly)
    required = {
        "country",
        "year",
        "population",
        "electricity_demand (TWh)",
        "Access to electricity (% of total population)",
    }
    missing = required.difference(yearly.columns)
    if missing:
        raise KeyError(f"Yearly CSV missing columns: {sorted(missing)}")

    yearly = yearly.copy()
    yearly["year"] = pd.to_numeric(yearly["year"], errors="coerce").astype("Int64")
    yearly = yearly[
        (yearly["year"] >= args.min_year) & (yearly["year"] <= args.max_year)
    ].dropna(subset=["country", "year", "electricity_demand (TWh)"])

    countries = sorted(yearly["country"].unique())
    if args.only:
        countries = [c for c in countries if c.strip().casefold() == args.only.strip().casefold()]
        if not countries:
            raise ValueError(f"Country not found in yearly panel: {args.only}")

    anchor_hourly = _load_anchor_hourly()
    shape_tables = {
        anchor: _shape_lookup_table(anchor_hourly[anchor], ANCHOR_REFERENCE_YEARS[anchor])
        for anchor in ANCHOR_COUNTRIES
    }

    assignments = []
    for country in countries:
        anchor = _nearest_anchor(country)
        assignments.append(
            {
                "country": country,
                "assigned_anchor": anchor,
                "anchor_reference_year": ANCHOR_REFERENCE_YEARS[anchor],
            }
        )
    assignments_df = pd.DataFrame(assignments)
    if not args.dry_run:
        args.assignments_out.parent.mkdir(parents=True, exist_ok=True)
        assignments_df.to_csv(args.assignments_out, index=False)

    args.output_dir.mkdir(parents=True, exist_ok=True)
    ok = 0
    for country in countries:
        anchor = _nearest_anchor(country)
        weights = shape_tables[anchor]
        country_years = yearly[yearly["country"] == country].sort_values("year")
        parts = []
        for _, row in country_years.iterrows():
            year = int(row["year"])
            annual_mwh = float(row["electricity_demand (TWh)"]) * 1_000_000.0
            parts.append(_build_year_hourly(country, year, annual_mwh, weights))

        out = pd.concat(parts, ignore_index=True)
        pop_map = country_years.set_index("year")["population"].astype(float)
        access_map = country_years.set_index("year")[
            "Access to electricity (% of total population)"
        ].astype(float)
        out["year"] = out["datetime"].dt.year
        out["population"] = out["year"].map(pop_map)
        out["access_pct"] = out["year"].map(access_map)
        access_frac = out["access_pct"] / 100.0
        out[PER_CAPITA_COL] = np.where(
            out["population"] > 0,
            out[DEMAND_COL] / out["population"] * 1000.0,
            np.nan,
        )
        out[PER_CAPITA_WITH_ACCESS_COL] = np.where(
            (out["population"] > 0) & (access_frac > 0),
            out[DEMAND_COL] / (out["population"] * access_frac) * 1000.0,
            np.nan,
        )
        out["country"] = country
        out = out[
            [
                "datetime",
                "country",
                DEMAND_COL,
                PER_CAPITA_COL,
                PER_CAPITA_WITH_ACCESS_COL,
            ]
        ].copy()
        out["datetime"] = out["datetime"].dt.strftime("%Y-%m-%d %H:%M:%S")

        out_path = args.output_dir / _country_csv_name(country)
        if args.dry_run:
            print(f"[DRY] {country} -> {anchor} ({ANCHOR_REFERENCE_YEARS[anchor]}): {len(out)} rows")
            ok += 1
            continue

        if args.backup and out_path.is_file():
            shutil.copy2(out_path, out_path.with_suffix(out_path.suffix + ".bak"))
        out.to_csv(out_path, index=False)
        print(f"[OK]  {country} -> {anchor} ({ANCHOR_REFERENCE_YEARS[anchor]}): {len(out)} rows")
        ok += 1

    print(f"Done. Generated {ok}/{len(countries)} countries.")
    if not args.dry_run:
        print(f"Anchor assignments: {args.assignments_out}")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
