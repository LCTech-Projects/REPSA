"""Normalize raw anchor hourly timeseries to a common schema.

Run from repo root:
  python api/preprocess/scripts/normalize_anchor_timeseries.py

Raw inputs (api/preprocess/data/):
  - south_africa_timeseries.csv   (Eskom)
  - nigeria_timeseries.xlsx       (Mendeley suppressed demand)
  - morocco_timeseries.xlsx       (UCI smart-meter zones)

Outputs (api/preprocess/data/normalized/):
  - south_africa_hourly_truth.csv
  - nigeria_hourly_truth.csv
  - morocco_hourly_truth.csv
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Iterable, List

import pandas as pd

PREPROCESS_ROOT = Path(__file__).resolve().parents[1]
PREPROCESS_DATA_DIR = PREPROCESS_ROOT / "data"
NORMALIZED_ANCHOR_DIR = PREPROCESS_DATA_DIR / "normalized"

SOUTH_AFRICA_TIMESERIES = PREPROCESS_DATA_DIR / "south_africa_timeseries.csv"
NIGERIA_TIMESERIES = PREPROCESS_DATA_DIR / "nigeria_timeseries.xlsx"
MOROCCO_TIMESERIES = PREPROCESS_DATA_DIR / "morocco_timeseries.xlsx"

SOUTH_AFRICA_HOURLY_TRUTH = NORMALIZED_ANCHOR_DIR / "south_africa_hourly_truth.csv"
NIGERIA_HOURLY_TRUTH = NORMALIZED_ANCHOR_DIR / "nigeria_hourly_truth.csv"
MOROCCO_HOURLY_TRUTH = NORMALIZED_ANCHOR_DIR / "morocco_hourly_truth.csv"

API_ROOT = PREPROCESS_ROOT.parent
sys.path.insert(0, str(API_ROOT))

DEMAND_COL = "electricity_demand (MWh)"
RE_COL = "renewables_electricity (MWh)"

NIGERIA_SHEET = "Demand Timeseries"
NIGERIA_HEADER_ROW = 3


def _finalize_hourly(df: pd.DataFrame, country: str) -> pd.DataFrame:
    out = df.copy()
    out["datetime"] = pd.to_datetime(out["datetime"], errors="coerce")
    out[DEMAND_COL] = pd.to_numeric(out[DEMAND_COL], errors="coerce")
    if RE_COL in out.columns:
        out[RE_COL] = pd.to_numeric(out[RE_COL], errors="coerce")
    else:
        out[RE_COL] = 0.0

    out = out.dropna(subset=["datetime", DEMAND_COL]).copy()
    out["country"] = country
    out = out.sort_values("datetime").drop_duplicates(subset=["datetime"], keep="last")
    return out[["datetime", "country", DEMAND_COL, RE_COL]].reset_index(drop=True)


def load_south_africa_timeseries(path: Path | None = None) -> pd.DataFrame:
    path = Path(path or SOUTH_AFRICA_TIMESERIES)
    if not path.is_file():
        raise FileNotFoundError(f"South Africa timeseries not found: {path}")

    raw = pd.read_csv(path)
    datetime_col = "Date Time Hour Beginning"
    demand_col = "Residual Demand"
    re_col = "Total RE"
    missing = [c for c in (datetime_col, demand_col, re_col) if c not in raw.columns]
    if missing:
        raise ValueError(f"Missing columns in {path.name}: {missing}")

    df = pd.DataFrame(
        {
            "datetime": raw[datetime_col],
            # Eskom hourly MW values are treated as MWh for one-hour intervals.
            DEMAND_COL: raw[demand_col],
            RE_COL: raw[re_col],
        }
    )
    return _finalize_hourly(df, "South Africa")


def load_nigeria_timeseries(path: Path | None = None) -> pd.DataFrame:
    path = Path(path or NIGERIA_TIMESERIES)
    if not path.is_file():
        raise FileNotFoundError(f"Nigeria timeseries not found: {path}")

    raw = pd.read_excel(path, sheet_name=NIGERIA_SHEET, header=NIGERIA_HEADER_ROW)
    datetime_col = "date time"
    demand_col = "National Suppressed Demand"
    missing = [c for c in (datetime_col, demand_col) if c not in raw.columns]
    if missing:
        raise ValueError(f"Missing columns in {path.name}: {missing}")

    df = pd.DataFrame(
        {
            "datetime": raw[datetime_col],
            DEMAND_COL: raw[demand_col],
        }
    )
    # Mendeley export uses end-of-hour timestamps (e.g. 22:59:59); align to hour start.
    df["datetime"] = pd.to_datetime(df["datetime"], errors="coerce")
    df["datetime"] = df["datetime"].dt.ceil("h")
    return _finalize_hourly(df, "Nigeria")


def _morocco_sheet_to_hourly(raw: pd.DataFrame) -> pd.DataFrame:
    if "DateTime" not in raw.columns:
        raise ValueError("Morocco sheet must include a DateTime column")

    zone_cols = [c for c in raw.columns if str(c).startswith("zone")]
    if not zone_cols:
        raise ValueError("Morocco sheet must include zone columns")

    frame = raw.copy()
    frame["DateTime"] = pd.to_datetime(frame["DateTime"], errors="coerce")
    frame = frame.dropna(subset=["DateTime"]).copy()
    frame["power_kw"] = frame[zone_cols].sum(axis=1)
    # 10-minute kW readings -> interval energy (kWh), then hourly MWh.
    frame["energy_kwh"] = frame["power_kw"] * (10.0 / 60.0)
    hourly = (
        frame.set_index("DateTime")["energy_kwh"]
        .resample("h")
        .sum()
        .div(1000.0)
        .rename(DEMAND_COL)
        .reset_index()
        .rename(columns={"DateTime": "datetime"})
    )
    return hourly


def load_morocco_timeseries(path: Path | None = None, sheets: Iterable[str] | None = None) -> pd.DataFrame:
    path = Path(path or MOROCCO_TIMESERIES)
    if not path.is_file():
        raise FileNotFoundError(f"Morocco timeseries not found: {path}")

    workbook = pd.ExcelFile(path)
    sheet_names: List[str] = list(sheets) if sheets is not None else workbook.sheet_names
    if not sheet_names:
        raise ValueError(f"No sheets found in {path.name}")

    hourly_parts: List[pd.DataFrame] = []
    for sheet in sheet_names:
        raw = pd.read_excel(path, sheet_name=sheet)
        hourly_parts.append(_morocco_sheet_to_hourly(raw))

    combined = pd.concat(hourly_parts, ignore_index=True)
    combined = (
        combined.groupby("datetime", as_index=False)[DEMAND_COL]
        .sum()
        .sort_values("datetime")
        .reset_index(drop=True)
    )
    return _finalize_hourly(combined, "Morocco")


def normalize_all(output_dir: Path | None = None) -> dict[str, Path]:
    output_dir = Path(output_dir or NORMALIZED_ANCHOR_DIR)
    output_dir.mkdir(parents=True, exist_ok=True)

    outputs = {
        "South Africa": output_dir / SOUTH_AFRICA_HOURLY_TRUTH.name,
        "Nigeria": output_dir / NIGERIA_HOURLY_TRUTH.name,
        "Morocco": output_dir / MOROCCO_HOURLY_TRUTH.name,
    }

    loaders = {
        "South Africa": load_south_africa_timeseries,
        "Nigeria": load_nigeria_timeseries,
        "Morocco": load_morocco_timeseries,
    }

    written: dict[str, Path] = {}
    for country, loader in loaders.items():
        df = loader()
        out_path = outputs[country]
        df.to_csv(out_path, index=False)
        written[country] = out_path
        print(
            f"[OK] {country}: {len(df):,} rows "
            f"({df['datetime'].min()} -> {df['datetime'].max()}) -> {out_path}"
        )

    return written


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Normalize anchor hourly truth timeseries.")
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=NORMALIZED_ANCHOR_DIR,
        help="Directory for normalized CSV outputs",
    )
    parser.add_argument("--only", choices=["South Africa", "Nigeria", "Morocco"], default=None)
    return parser.parse_args()


def main() -> int:
    args = _parse_args()
    if args.only:
        loaders = {
            "South Africa": (load_south_africa_timeseries, SOUTH_AFRICA_HOURLY_TRUTH.name),
            "Nigeria": (load_nigeria_timeseries, NIGERIA_HOURLY_TRUTH.name),
            "Morocco": (load_morocco_timeseries, MOROCCO_HOURLY_TRUTH.name),
        }
        loader, filename = loaders[args.only]
        args.output_dir.mkdir(parents=True, exist_ok=True)
        out_path = args.output_dir / filename
        df = loader()
        df.to_csv(out_path, index=False)
        print(f"[OK] {args.only}: {len(df):,} rows -> {out_path}")
        return 0

    normalize_all(args.output_dir)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
