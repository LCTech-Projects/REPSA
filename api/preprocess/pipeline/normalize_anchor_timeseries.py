"""Normalize raw anchor hourly timeseries to a common schema.

Run from repo root:
  python api/preprocess/pipeline/normalize_anchor_timeseries.py

Raw inputs (api/preprocess/data/):
  - south_africa_timeseries.csv          (Eskom)
  - nigeria_timeseries.xlsx              (Mendeley suppressed demand)
  - raw/algeria/BDD_E.xlsx              (Sonelgaz / Mendeley hourly consumption)

Outputs (api/preprocess/data/normalized/):
  - south_africa_hourly_truth.csv
  - nigeria_hourly_truth.csv
  - algeria_hourly_truth.csv
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pandas as pd

PREPROCESS_ROOT = Path(__file__).resolve().parents[1]
PREPROCESS_DATA_DIR = PREPROCESS_ROOT / "data"
NORMALIZED_ANCHOR_DIR = PREPROCESS_DATA_DIR / "normalized"

SOUTH_AFRICA_TIMESERIES = PREPROCESS_DATA_DIR / "south_africa_timeseries.csv"
NIGERIA_TIMESERIES = PREPROCESS_DATA_DIR / "nigeria_timeseries.xlsx"
ALGERIA_TIMESERIES = PREPROCESS_DATA_DIR / "raw" / "algeria" / "BDD_E.xlsx"

SOUTH_AFRICA_HOURLY_TRUTH = NORMALIZED_ANCHOR_DIR / "south_africa_hourly_truth.csv"
NIGERIA_HOURLY_TRUTH = NORMALIZED_ANCHOR_DIR / "nigeria_hourly_truth.csv"
ALGERIA_HOURLY_TRUTH = NORMALIZED_ANCHOR_DIR / "algeria_hourly_truth.csv"

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


def load_algeria_timeseries(path: Path | None = None) -> pd.DataFrame:
    """Sonelgaz hourly consumption (Mendeley: 10.17632/z5x2d3mhw7.1).

    Wide day × 24-hour layout. Values are treated as MW ≈ MWh per hour.
    """
    path = Path(path or ALGERIA_TIMESERIES)
    if not path.is_file():
        raise FileNotFoundError(f"Algeria timeseries not found: {path}")

    raw = pd.read_excel(path, sheet_name="Feuil1")
    if "Date" not in raw.columns:
        raise ValueError(f"Algeria sheet must include a Date column: {path.name}")
    hour_cols = [c for c in raw.columns if str(c).endswith("h") and str(c)[:-1].isdigit()]
    if len(hour_cols) != 24:
        raise ValueError(f"Expected 24 hour columns in {path.name}, found {hour_cols}")

    long = raw.melt(id_vars="Date", value_vars=hour_cols, var_name="hour_label", value_name=DEMAND_COL)
    long["hour"] = long["hour_label"].str.replace("h", "", regex=False).astype(int) - 1
    long["datetime"] = pd.to_datetime(long["Date"], errors="coerce") + pd.to_timedelta(
        long["hour"], unit="h"
    )
    return _finalize_hourly(long[["datetime", DEMAND_COL]], "Algeria")


def normalize_all(output_dir: Path | None = None) -> dict[str, Path]:
    output_dir = Path(output_dir or NORMALIZED_ANCHOR_DIR)
    output_dir.mkdir(parents=True, exist_ok=True)

    outputs = {
        "South Africa": output_dir / SOUTH_AFRICA_HOURLY_TRUTH.name,
        "Nigeria": output_dir / NIGERIA_HOURLY_TRUTH.name,
        "Algeria": output_dir / ALGERIA_HOURLY_TRUTH.name,
    }

    loaders = {
        "South Africa": load_south_africa_timeseries,
        "Nigeria": load_nigeria_timeseries,
        "Algeria": load_algeria_timeseries,
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
    parser.add_argument("--only", choices=["South Africa", "Nigeria", "Algeria"], default=None)
    return parser.parse_args()


def main() -> int:
    args = _parse_args()
    if args.only:
        loaders = {
            "South Africa": (load_south_africa_timeseries, SOUTH_AFRICA_HOURLY_TRUTH.name),
            "Nigeria": (load_nigeria_timeseries, NIGERIA_HOURLY_TRUTH.name),
            "Algeria": (load_algeria_timeseries, ALGERIA_HOURLY_TRUTH.name),
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
