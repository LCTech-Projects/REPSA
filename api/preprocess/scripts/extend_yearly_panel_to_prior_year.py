"""Extend yearly_historical_data.csv to (current_year - 1) using measured sources first.

Pipeline:
  1. Refresh OWID and World Bank cloud sources (unless --skip-refresh)
  2. Rebuild a measured panel from raw OWID + WB up to the target year
  3. Fill remaining gaps with RealtimeAggregator-style statistical projections
  4. Write the panel, a long-format provenance file, and panel_metadata.json
  5. Optionally regenerate hourly CSVs for the updated year range

Run from repo root:
  python api/preprocess/scripts/extend_yearly_panel_to_prior_year.py --dry-run
  python api/preprocess/scripts/extend_yearly_panel_to_prior_year.py --in-place
  python api/preprocess/scripts/extend_yearly_panel_to_prior_year.py --in-place --regenerate-hourly
  python api/preprocess/scripts/extend_yearly_panel_to_prior_year.py --skip-refresh --in-place
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import numpy as np
import pandas as pd
import requests

PREPROCESS_ROOT = Path(__file__).resolve().parents[1]
API_ROOT = PREPROCESS_ROOT.parent
REPO_ROOT = API_ROOT.parent
sys.path.insert(0, str(API_ROOT))

from app.utils.statistical_projection import project_metric  # noqa: E402
from preprocess.scripts.build_yearly_historical_from_raw import (  # noqa: E402
    DEFAULT_OUTPUT,
    RAW_OWID,
    RAW_WB,
    WB_SERIES,
    _country_list,
    _refresh_owid,
    build_panel,
)

PROVENANCE_OUTPUT = API_ROOT / "data" / "historical" / "yearly_historical_data_provenance.csv"
METADATA_OUTPUT = API_ROOT / "data" / "historical" / "panel_metadata.json"
WB_API_BASE = "https://api.worldbank.org/v2"

# Columns projected independently (not derived after fill).
PRIMARY_SPECS: dict[str, dict[str, Any]] = {
    "population": {"kind": "absolute", "bounds": None, "use_pop_growth": True},
    "gdp": {"kind": "absolute", "bounds": None},
    "Population growth (annual %)": {"kind": "percent_linear", "bounds": (-5.0, 10.0)},
    "electricity_demand (TWh)": {"kind": "absolute", "bounds": None},
    "electricity_generation (TWh)": {"kind": "absolute", "bounds": None},
    "renewables_electricity": {"kind": "absolute", "bounds": None},
    "renewables_share_elec": {"kind": "percent_linear", "bounds": (0.0, 100.0)},
    "fossil_share_elec": {"kind": "percent_linear", "bounds": (0.0, 100.0)},
    "low_carbon_share_elec": {"kind": "percent_linear", "bounds": (0.0, 100.0)},
    "carbon_intensity_elec": {"kind": "absolute", "bounds": None},
    "solar_electricity": {"kind": "absolute", "bounds": None},
    "wind_electricity": {"kind": "absolute", "bounds": None},
    "hydro_electricity": {"kind": "absolute", "bounds": None},
    "greenhouse_gas_emissions": {"kind": "absolute", "bounds": None},
    "Access to electricity (% of total population)": {
        "kind": "percent_logistic",
        "bounds": (0.0, 100.0),
    },
    "Access to Clean Fuels and Technologies for cooking (% of total population)": {
        "kind": "percent_linear",
        "bounds": (0.0, 100.0),
    },
    "energy_poverty_multidimensional (% of total population)": {
        "kind": "percent_linear",
        "bounds": (0.0, 100.0),
    },
    "energy_poverty_electricity_rural (% of rural population)": {
        "kind": "percent_linear",
        "bounds": (0.0, 100.0),
    },
    "energy_poverty_electricity_urban (% of urban population)": {
        "kind": "percent_linear",
        "bounds": (0.0, 100.0),
    },
}

PANEL_COLUMNS = [
    "country",
    "year",
    "population",
    "gdp",
    "Population growth (annual %)",
    "electricity_demand (TWh)",
    "electricity_generation (TWh)",
    "electricity_production_aggregate (TWh)",
    "renewables_electricity",
    "renewables_share_elec",
    "fossil_share_elec",
    "low_carbon_share_elec",
    "carbon_intensity_elec",
    "solar_electricity",
    "wind_electricity",
    "hydro_electricity",
    "greenhouse_gas_emissions",
    "Access to electricity (% of total population)",
    "Access to Clean Fuels and Technologies for cooking (% of total population)",
    "energy_poverty_electricity (% of total population)",
    "energy_poverty_multidimensional (% of total population)",
    "energy_poverty_electricity_rural (% of rural population)",
    "energy_poverty_electricity_urban (% of urban population)",
    "electricity_demand_per_capita (MWh)",
    "electricity_demand_per_capita_with_access (MWh)",
]


def _parse_args() -> argparse.Namespace:
    now = datetime.now(timezone.utc)
    parser = argparse.ArgumentParser(
        description=(
            "Extend yearly panel to prior calendar year. "
            "Always refreshes OWID and World Bank sources first (unless --skip-refresh), "
            "then fills remaining gaps with statistical projections."
        )
    )
    parser.add_argument("--owid", type=Path, default=RAW_OWID)
    parser.add_argument("--wb", type=Path, default=RAW_WB)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--provenance-out", type=Path, default=PROVENANCE_OUTPUT)
    parser.add_argument("--metadata-out", type=Path, default=METADATA_OUTPUT)
    parser.add_argument("--min-year", type=int, default=2016)
    parser.add_argument(
        "--target-year",
        type=int,
        default=now.year - 1,
        help="Last year to include (default: current calendar year - 1)",
    )
    parser.add_argument(
        "--skip-refresh",
        action="store_true",
        help="Skip cloud refresh and use existing local OWID/WB CSV files",
    )
    parser.add_argument("--in-place", action="store_true", help="Backup and overwrite output panel")
    parser.add_argument(
        "--regenerate-hourly",
        action="store_true",
        help="After writing the panel, regenerate hourly CSVs for min_year..target_year",
    )
    parser.add_argument(
        "--countries-from",
        type=Path,
        default=API_ROOT / "data" / "historical" / "hourly",
    )
    parser.add_argument(
        "--preserve-multidimensional-from",
        type=Path,
        default=DEFAULT_OUTPUT,
    )
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def _refresh_wb_api(
    wb_path: Path,
    min_year: int,
    max_year: int,
    *,
    retries: int = 3,
    timeout: tuple[float, float] = (30.0, 180.0),
) -> None:
    """Download selected World Bank indicators and rewrite the local wide CSV."""
    date_range = f"{min_year}:{max_year}"
    frames: list[pd.DataFrame] = []

    for series_name, series_code in WB_SERIES.items():
        url = f"{WB_API_BASE}/country/all/indicator/{series_code}"
        page = 1
        rows: list[dict[str, Any]] = []
        while True:
            last_error: Exception | None = None
            payload = None
            for attempt in range(1, retries + 1):
                try:
                    response = requests.get(
                        url,
                        params={
                            "format": "json",
                            "per_page": 20000,
                            "page": page,
                            "date": date_range,
                        },
                        timeout=timeout,
                        headers={"User-Agent": "REPSA preprocess/1.0"},
                    )
                    response.raise_for_status()
                    payload = response.json()
                    last_error = None
                    break
                except (requests.RequestException, TimeoutError, ValueError) as exc:
                    last_error = exc
                    print(f"  WB {series_code} page {page} attempt {attempt}/{retries} failed: {exc}")
            if last_error is not None:
                raise last_error
            if not isinstance(payload, list) or len(payload) < 2:
                break
            meta, data = payload[0], payload[1]
            for item in data or []:
                country = (item.get("country") or {}).get("value")
                year = item.get("date")
                value = item.get("value")
                if not country or year is None:
                    continue
                rows.append(
                    {
                        "Country Name": country,
                        "Country Code": (item.get("countryiso3code") or ""),
                        "Series Name": series_name,
                        "Series Code": series_code,
                        "year": int(year),
                        "value": value,
                    }
                )
            pages = int(meta.get("pages") or 1)
            if page >= pages:
                break
            page += 1

        if not rows:
            print(f"[WARN] No WB API rows for {series_code}")
            continue
        long_df = pd.DataFrame(rows)
        frames.append(long_df)

    if not frames:
        raise RuntimeError("World Bank API refresh returned no series")

    long_all = pd.concat(frames, ignore_index=True)
    long_all["value"] = pd.to_numeric(long_all["value"], errors="coerce")
    wide = long_all.pivot_table(
        index=["Country Name", "Country Code", "Series Name", "Series Code"],
        columns="year",
        values="value",
        aggfunc="first",
    ).reset_index()
    wide.columns = [
        col if not isinstance(col, (int, np.integer)) else f"{col} [YR{col}]"
        for col in wide.columns
    ]
    wb_path.parent.mkdir(parents=True, exist_ok=True)
    wide.to_csv(wb_path, index=False)
    print(f"Refreshed WB CSV: {wb_path} ({len(wide)} rows)")


def _refresh_sources(args: argparse.Namespace) -> None:
    """Always refresh OWID and World Bank before building the panel."""
    print(f"Refreshing OWID -> {args.owid}")
    try:
        _refresh_owid(args.owid)
    except Exception as exc:
        if args.owid.is_file():
            print(
                f"[WARN] OWID refresh failed ({exc}). "
                f"Continuing with existing local file: {args.owid}"
            )
        else:
            raise SystemExit(
                f"OWID refresh failed and no local file exists at {args.owid}: {exc}"
            ) from exc

    print(f"Refreshing World Bank indicators -> {args.wb}")
    try:
        _refresh_wb_api(args.wb, args.min_year, args.target_year)
    except Exception as exc:
        if args.wb.is_file():
            print(
                f"[WARN] World Bank refresh failed ({exc}). "
                f"Continuing with existing local file: {args.wb}"
            )
        else:
            raise SystemExit(
                f"World Bank refresh failed and no local file exists at {args.wb}: {exc}"
            ) from exc


def _complete_grid(measured: pd.DataFrame, countries: list[str], min_year: int, max_year: int) -> pd.DataFrame:
    index = pd.MultiIndex.from_product([countries, range(min_year, max_year + 1)], names=["country", "year"])
    grid = pd.DataFrame(index=index).reset_index()
    panel = grid.merge(measured, on=["country", "year"], how="left")
    return panel


def _recompute_derived(panel: pd.DataFrame) -> pd.DataFrame:
    out = panel.copy()
    demand = pd.to_numeric(out["electricity_demand (TWh)"], errors="coerce")
    generation = pd.to_numeric(out["electricity_generation (TWh)"], errors="coerce")
    population = pd.to_numeric(out["population"], errors="coerce")
    access = pd.to_numeric(out["Access to electricity (% of total population)"], errors="coerce")

    out["electricity_production_aggregate (TWh)"] = generation - demand
    out["electricity_demand_per_capita (MWh)"] = np.where(
        population > 0,
        demand * 1_000_000.0 / population,
        np.nan,
    )
    out["electricity_demand_per_capita_with_access (MWh)"] = np.where(
        (population > 0) & (access > 0),
        demand * 1_000_000.0 / (population * access / 100.0),
        np.nan,
    )
    # Keep national electricity poverty consistent with access when access exists.
    out["energy_poverty_electricity (% of total population)"] = np.where(
        access.notna(),
        100.0 - access,
        out.get("energy_poverty_electricity (% of total population)"),
    )
    return out


def _fill_panel(panel: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Fill missing primary columns; return (filled_panel, provenance_long)."""
    filled = panel.copy()
    provenance_rows: list[dict[str, Any]] = []

    for country, group in filled.groupby("country", sort=True):
        idx = group.index
        country_df = filled.loc[idx].sort_values("year")

        # Population growth rate (decimal) from latest non-null measured growth cell.
        growth_series = pd.to_numeric(
            country_df["Population growth (annual %)"], errors="coerce"
        ).dropna()
        pop_growth = float(growth_series.iloc[-1]) / 100.0 if not growth_series.empty else None

        for col, spec in PRIMARY_SPECS.items():
            if col not in filled.columns:
                continue

            series = pd.to_numeric(country_df[col], errors="coerce")
            measured_mask = series.notna()
            years = country_df.loc[measured_mask, "year"].astype(int).tolist()
            values = series.loc[measured_mask].astype(float).tolist()

            for row_idx, year in zip(country_df.index, country_df["year"].astype(int)):
                current = filled.at[row_idx, col]
                if pd.notna(current):
                    provenance_rows.append(
                        {
                            "country": country,
                            "year": int(year),
                            "column": col,
                            "value": float(current),
                            "source": "measured",
                            "method": "source_ingest",
                            "base_year": int(year),
                            "r_squared": np.nan,
                        }
                    )
                    continue

                use_pop = bool(spec.get("use_pop_growth")) and col == "population"
                projected, method, r2, base_year = project_metric(
                    years,
                    values,
                    int(year),
                    kind=str(spec["kind"]),
                    bounds=spec.get("bounds"),
                    population_growth_rate=pop_growth if use_pop else None,
                )
                if projected is None or (isinstance(projected, float) and np.isnan(projected)):
                    provenance_rows.append(
                        {
                            "country": country,
                            "year": int(year),
                            "column": col,
                            "value": np.nan,
                            "source": "missing",
                            "method": method,
                            "base_year": base_year,
                            "r_squared": r2 if r2 is not None else np.nan,
                        }
                    )
                    continue

                filled.at[row_idx, col] = float(projected)
                provenance_rows.append(
                    {
                        "country": country,
                        "year": int(year),
                        "column": col,
                        "value": float(projected),
                        "source": "estimated",
                        "method": method,
                        "base_year": base_year,
                        "r_squared": r2 if r2 is not None else np.nan,
                    }
                )
                # Keep fit history measured-only (do not append estimates into years/values).

        # After access fill, sync national electricity poverty for estimated years.
        for row_idx, year in zip(country_df.index, country_df["year"].astype(int)):
            access_val = filled.at[row_idx, "Access to electricity (% of total population)"]
            if pd.isna(access_val):
                continue
            poverty = 100.0 - float(access_val)
            filled.at[row_idx, "energy_poverty_electricity (% of total population)"] = poverty
            # Provenance for derived poverty
            access_src = next(
                (
                    r
                    for r in provenance_rows
                    if r["country"] == country
                    and r["year"] == int(year)
                    and r["column"] == "Access to electricity (% of total population)"
                ),
                None,
            )
            provenance_rows.append(
                {
                    "country": country,
                    "year": int(year),
                    "column": "energy_poverty_electricity (% of total population)",
                    "value": poverty,
                    "source": "derived" if access_src and access_src["source"] == "measured" else "estimated",
                    "method": "one_minus_access",
                    "base_year": access_src["base_year"] if access_src else None,
                    "r_squared": np.nan,
                }
            )

    provenance = pd.DataFrame(provenance_rows)
    return filled, provenance


def _write_metadata(
    path: Path,
    *,
    min_year: int,
    target_year: int,
    n_rows: int,
    n_countries: int,
    estimated_cells: int,
    measured_cells: int,
) -> None:
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "min_year": min_year,
        "extended_to": target_year,
        "prior_calendar_year": datetime.now(timezone.utc).year - 1,
        "rows": n_rows,
        "countries": n_countries,
        "measured_primary_cells": measured_cells,
        "estimated_primary_cells": estimated_cells,
        "method": "measured_first_statistical_completion",
        "projection_methods": [
            "dampened_exponential_log_linear",
            "logistic_logit_linear",
            "linear_projection",
            "limit_year_population_growth_rate_exponential",
        ],
        "notes": (
            "Years beyond last measured source values are statistically completed "
            "using the same method family as /api/realtime. Treat estimated cells "
            "as exploratory completions, not official statistics."
        ),
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def _regenerate_hourly(min_year: int, max_year: int, yearly_path: Path) -> int:
    script = PREPROCESS_ROOT / "scripts" / "generate_hourly_from_anchors.py"
    cmd = [
        sys.executable,
        str(script),
        "--yearly",
        str(yearly_path),
        "--min-year",
        str(min_year),
        "--max-year",
        str(max_year),
    ]
    print("Regenerating hourly:", " ".join(cmd))
    completed = subprocess.run(cmd, cwd=str(REPO_ROOT), check=False)
    return int(completed.returncode)


def main() -> int:
    args = _parse_args()
    if args.target_year < args.min_year:
        raise SystemExit("--target-year must be >= --min-year")

    countries = _country_list(args.countries_from)

    if args.skip_refresh:
        print("Skipping cloud refresh (--skip-refresh); using local OWID/WB files.")
    else:
        _refresh_sources(args)

    build_args = SimpleNamespace(
        owid=args.owid,
        wb=args.wb,
        output=args.output,
        in_place=False,
        refresh_owid=False,
        min_year=args.min_year,
        max_year=args.target_year,
        countries_from=args.countries_from,
        preserve_multidimensional_from=args.preserve_multidimensional_from,
        dry_run=True,
    )
    measured = build_panel(build_args)
    print(
        f"Measured ingest: {len(measured)} rows, "
        f"years {int(measured['year'].min())}-{int(measured['year'].max())}"
    )

    panel = _complete_grid(measured, countries, args.min_year, args.target_year)
    filled, provenance = _fill_panel(panel)
    filled = _recompute_derived(filled)
    filled = filled[PANEL_COLUMNS].sort_values(["country", "year"]).reset_index(drop=True)

    measured_cells = int((provenance["source"] == "measured").sum()) if not provenance.empty else 0
    estimated_cells = int((provenance["source"] == "estimated").sum()) if not provenance.empty else 0
    missing_demand = filled[filled["electricity_demand (TWh)"].isna()][["country", "year"]]

    print(f"Extended panel: {len(filled)} rows, {filled['country'].nunique()} countries")
    print(f"Year range: {int(filled['year'].min())}-{int(filled['year'].max())}")
    print(f"Provenance measured cells: {measured_cells}")
    print(f"Provenance estimated cells: {estimated_cells}")
    print(f"Missing demand after fill: {len(missing_demand)}")
    if not missing_demand.empty:
        print(missing_demand.head(20).to_string(index=False))

    if args.dry_run:
        print("Dry run; no files written.")
        return 0

    out_path = args.output.resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    if args.in_place and out_path.is_file():
        backup = out_path.with_suffix(out_path.suffix + ".bak")
        shutil.copy2(out_path, backup)
        print(f"Backup: {backup}")

    filled.to_csv(out_path, index=False)
    print(f"Wrote panel: {out_path}")

    provenance_path = args.provenance_out.resolve()
    provenance.sort_values(["country", "year", "column"]).to_csv(provenance_path, index=False)
    print(f"Wrote provenance: {provenance_path}")

    _write_metadata(
        args.metadata_out.resolve(),
        min_year=args.min_year,
        target_year=args.target_year,
        n_rows=len(filled),
        n_countries=int(filled["country"].nunique()),
        estimated_cells=estimated_cells,
        measured_cells=measured_cells,
    )
    print(f"Wrote metadata: {args.metadata_out.resolve()}")
    print(
        f"Panel extended to {args.target_year}. "
        "API historical year cap is current calendar year - 1."
    )

    if args.regenerate_hourly:
        code = _regenerate_hourly(args.min_year, args.target_year, out_path)
        if code != 0:
            print(f"[WARN] Hourly regeneration exited with code {code}")
            return code

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
