"""Build or refresh yearly_historical_data.csv from raw OWID + World Bank files.

Run from repo root:
  python api/preprocess/scripts/build_yearly_historical_from_raw.py --refresh-owid
  python api/preprocess/scripts/build_yearly_historical_from_raw.py --refresh-owid --in-place
"""

from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import requests

PREPROCESS_ROOT = Path(__file__).resolve().parents[1]
API_ROOT = PREPROCESS_ROOT.parent
RAW_OWID = PREPROCESS_ROOT / "data" / "raw" / "owid.csv"
RAW_WB = PREPROCESS_ROOT / "data" / "raw" / "wb.csv"
DEFAULT_OUTPUT = API_ROOT / "data" / "historical" / "yearly_historical_data.csv"
OWID_URL = "https://raw.githubusercontent.com/owid/energy-data/master/owid-energy-data.csv"

WB_COUNTRY_ALIASES: dict[str, str] = {
    "Cape Verde": "Cabo Verde",
    "Congo": "Congo, Rep.",
    "Democratic Republic of the Congo": "Congo, Dem. Rep.",
    "Egypt": "Egypt, Arab Rep.",
    "Gambia": "Gambia, The",
    "Somalia": "Somalia, Fed. Rep.",
}

OWID_COUNTRY_ALIASES: dict[str, str] = {
    "Democratic Republic of the Congo": "Democratic Republic of Congo",
}

WB_SERIES = {
    "Access to electricity (% of total population)": "EG.ELC.ACCS.ZS",
    "Access to Clean Fuels and Technologies for cooking (% of total population)": "EG.CFT.ACCS.ZS",
    "energy_poverty_electricity_rural (% of rural population)": "EG.ELC.ACCS.RU.ZS",
    "energy_poverty_electricity_urban (% of urban population)": "EG.ELC.ACCS.UR.ZS",
    "Population growth (annual %)": "SP.POP.GROW",
}


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build yearly_historical_data.csv from raw OWID + WB.")
    parser.add_argument("--owid", type=Path, default=RAW_OWID)
    parser.add_argument("--wb", type=Path, default=RAW_WB)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--in-place", action="store_true", help="Overwrite --output with .bak backup")
    parser.add_argument("--refresh-owid", action="store_true", help="Download latest OWID CSV before building")
    parser.add_argument("--min-year", type=int, default=2016)
    parser.add_argument("--max-year", type=int, default=2023)
    parser.add_argument(
        "--countries-from",
        type=Path,
        default=API_ROOT / "data" / "historical" / "hourly",
        help="Use hourly CSV stems to determine country list",
    )
    parser.add_argument(
        "--preserve-multidimensional-from",
        type=Path,
        default=DEFAULT_OUTPUT,
        help="Existing yearly file to preserve multidimensional poverty values",
    )
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def _country_list(countries_from: Path) -> list[str]:
    if not countries_from.is_dir():
        raise FileNotFoundError(f"Country source directory not found: {countries_from}")
    return sorted(path.stem.replace("_", " ") for path in countries_from.glob("*.csv"))


def _refresh_owid(path: Path, *, retries: int = 3, timeout: tuple[float, float] = (30.0, 300.0)) -> None:
    """Download latest OWID energy CSV with retries.

    timeout is (connect, read) seconds. Raises the last network error if all
    attempts fail so callers can choose to abort or continue with a local file.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_suffix(path.suffix + ".download")
    last_error: Exception | None = None

    for attempt in range(1, retries + 1):
        try:
            print(f"  OWID download attempt {attempt}/{retries}...")
            with requests.get(
                OWID_URL,
                timeout=timeout,
                headers={"User-Agent": "REPSA preprocess/1.0"},
                stream=True,
            ) as response:
                response.raise_for_status()
                with tmp_path.open("wb") as handle:
                    for chunk in response.iter_content(chunk_size=1024 * 1024):
                        if chunk:
                            handle.write(chunk)
            tmp_path.replace(path)
            print(f"  Wrote {path} ({path.stat().st_size:,} bytes)")
            return
        except (requests.RequestException, TimeoutError, OSError) as exc:
            last_error = exc
            print(f"  OWID download failed: {exc}")
            if tmp_path.exists():
                tmp_path.unlink(missing_ok=True)

    assert last_error is not None
    raise last_error


def _parse_wb_year_column(column: str) -> int | None:
    if "[YR" not in column:
        return None
    try:
        return int(column.split("[YR", 1)[1].split("]", 1)[0])
    except ValueError:
        return None


def _parse_wb_value(value: object) -> float | np.nan:
    if value is None or (isinstance(value, float) and np.isnan(value)):
        return np.nan
    text = str(value).strip()
    if not text or text == "..":
        return np.nan
    return float(text)


def _load_wb_long(wb_path: Path, countries: list[str]) -> pd.DataFrame:
    wb = pd.read_csv(wb_path)
    year_columns = [(col, _parse_wb_year_column(col)) for col in wb.columns if _parse_wb_year_column(col)]
    if not year_columns:
        raise ValueError("Could not find year columns in WB CSV")

    rows: list[dict[str, object]] = []
    for panel_country in countries:
        wb_country = WB_COUNTRY_ALIASES.get(panel_country, panel_country)
        country_rows = wb[wb["Country Name"] == wb_country]
        if country_rows.empty:
            raise ValueError(f"No WB rows for country: {panel_country} ({wb_country})")

        for year_col, year in year_columns:
            record: dict[str, object] = {"country": panel_country, "year": year}
            for out_col, series_code in WB_SERIES.items():
                series = country_rows[country_rows["Series Code"] == series_code]
                if series.empty:
                    record[out_col] = np.nan
                    continue
                record[out_col] = _parse_wb_value(series.iloc[0][year_col])

            if pd.notna(record.get("energy_poverty_electricity_rural (% of rural population)")):
                record["energy_poverty_electricity_rural (% of rural population)"] = 100.0 - float(
                    record["energy_poverty_electricity_rural (% of rural population)"]
                )
            if pd.notna(record.get("energy_poverty_electricity_urban (% of urban population)")):
                record["energy_poverty_electricity_urban (% of urban population)"] = 100.0 - float(
                    record["energy_poverty_electricity_urban (% of urban population)"]
                )
            if pd.notna(record.get("Access to electricity (% of total population)")):
                record["energy_poverty_electricity (% of total population)"] = 100.0 - float(
                    record["Access to electricity (% of total population)"]
                )
            rows.append(record)

    return pd.DataFrame(rows)


def _load_owid_panel(owid_path: Path, countries: list[str], min_year: int, max_year: int) -> pd.DataFrame:
    owid = pd.read_csv(owid_path)
    owid_names = {country: OWID_COUNTRY_ALIASES.get(country, country) for country in countries}
    reverse_names = {v: k for k, v in owid_names.items()}
    owid = owid[owid["country"].isin(owid_names.values())].copy()
    owid["country"] = owid["country"].map(reverse_names)
    owid["year"] = pd.to_numeric(owid["year"], errors="coerce")
    owid = owid[(owid["year"] >= min_year) & (owid["year"] <= max_year)].copy()
    rename = {
        "electricity_demand": "electricity_demand (TWh)",
        "electricity_generation": "electricity_generation (TWh)",
    }
    keep = [
        "country",
        "year",
        "population",
        "gdp",
        "electricity_demand (TWh)",
        "electricity_generation (TWh)",
        "renewables_electricity",
        "renewables_share_elec",
        "fossil_share_elec",
        "low_carbon_share_elec",
        "carbon_intensity_elec",
        "solar_electricity",
        "wind_electricity",
        "hydro_electricity",
        "greenhouse_gas_emissions",
    ]
    owid = owid.rename(columns=rename)
    return owid[keep].copy()


def _preserve_multidimensional(existing_path: Path) -> pd.DataFrame | None:
    if not existing_path.is_file():
        return None
    existing = pd.read_csv(existing_path)
    col = "energy_poverty_multidimensional (% of total population)"
    if col not in existing.columns:
        return None
    return existing[["country", "year", col]].copy()


def build_panel(args: argparse.Namespace) -> pd.DataFrame:
    countries = _country_list(args.countries_from)
    if args.refresh_owid:
        print(f"Downloading latest OWID data to {args.owid}")
        try:
            _refresh_owid(args.owid)
        except Exception as exc:
            if args.owid.is_file():
                print(
                    f"[WARN] OWID refresh failed ({exc}). "
                    f"Continuing with existing local file: {args.owid}"
                )
            else:
                raise

    owid = _load_owid_panel(args.owid, countries, args.min_year, args.max_year)
    wb = _load_wb_long(args.wb, countries)
    panel = owid.merge(wb, on=["country", "year"], how="outer")

    multidimensional = _preserve_multidimensional(args.preserve_multidimensional_from)
    if multidimensional is not None:
        panel = panel.merge(multidimensional, on=["country", "year"], how="left")

    demand = pd.to_numeric(panel["electricity_demand (TWh)"], errors="coerce")
    generation = pd.to_numeric(panel["electricity_generation (TWh)"], errors="coerce")
    population = pd.to_numeric(panel["population"], errors="coerce")
    access = pd.to_numeric(panel["Access to electricity (% of total population)"], errors="coerce")

    panel["electricity_production_aggregate (TWh)"] = generation - demand
    panel["electricity_demand_per_capita (MWh)"] = np.where(
        population > 0,
        demand * 1_000_000.0 / population,
        np.nan,
    )
    panel["electricity_demand_per_capita_with_access (MWh)"] = np.where(
        (population > 0) & (access > 0),
        demand * 1_000_000.0 / (population * access / 100.0),
        np.nan,
    )

    columns = [
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
    panel = panel[columns].sort_values(["country", "year"]).reset_index(drop=True)
    return panel


def main() -> int:
    args = _parse_args()
    panel = build_panel(args)

    missing_demand = panel[panel["electricity_demand (TWh)"].isna()][["country", "year"]]
    missing_access = panel[panel["Access to electricity (% of total population)"].isna()][["country", "year"]]

    print(f"Built panel: {len(panel)} rows, {panel['country'].nunique()} countries")
    print(f"Year range: {int(panel['year'].min())}-{int(panel['year'].max())}")
    print(f"Missing demand rows: {len(missing_demand)}")
    if not missing_demand.empty:
        print(missing_demand.to_string(index=False))
    print(f"Missing access rows: {len(missing_access)}")
    if not missing_access.empty:
        print(missing_access.to_string(index=False))

    if args.dry_run:
        print("Dry run; no file written.")
        return 0

    out_path = args.output.resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    if args.in_place and out_path.is_file():
        backup = out_path.with_suffix(out_path.suffix + ".bak")
        shutil.copy2(out_path, backup)
        print(f"Backup: {backup}")

    panel.to_csv(out_path, index=False)
    print(f"Wrote: {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
