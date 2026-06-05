"""Trim yearly_historical_data.csv to pipeline columns.

Run from repo root:
  python api/preprocess/scripts/trim_yearly_historical.py --min-year 2016 --in-place
"""

from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

API_ROOT = Path(__file__).resolve().parents[2]


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Trim yearly_historical_data.csv to pipeline-relevant columns.")
    p.add_argument(
        "--input",
        type=Path,
        default=API_ROOT / "data" / "historical" / "yearly_historical_data.csv",
        help="Source CSV path",
    )
    p.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Destination CSV (default: stdout path only when not dry-run and not in-place)",
    )
    p.add_argument(
        "--in-place",
        action="store_true",
        help="Overwrite --input after copying it to input.bak",
    )
    p.add_argument("--dry-run", action="store_true", help="Print plan only; do not write")
    p.add_argument(
        "--min-year",
        type=int,
        default=None,
        help="If set, keep only rows where year >= this value (e.g. 2016)",
    )
    p.add_argument(
        "--also-copy-to",
        type=Path,
        default=None,
        help="After writing, copy the result to this path",
    )
    p.add_argument(
        "--max-year",
        type=int,
        default=None,
        help="If set, keep only rows where year <= this value (e.g. 2023)",
    )
    return p.parse_args()


def main() -> int:
    args = _parse_args()
    sys.path.insert(0, str(API_ROOT))

    import pandas as pd

    from app.utils.yearly_historical_columns import (
        YEARLY_HISTORICAL_COLUMN_ALLOWLIST,
        YEARLY_HISTORICAL_CRITICAL_COLUMNS,
    )

    inp = args.input.resolve()
    if not inp.is_file():
        print(f"ERROR: Input not found: {inp}", file=sys.stderr)
        return 1

    df = pd.read_csv(inp)
    rows_in = len(df)
    ncol_in = len(df.columns)

    if args.min_year is not None or args.max_year is not None:
        if "year" not in df.columns:
            print("ERROR: --min-year/--max-year requires a 'year' column", file=sys.stderr)
            return 1
        df["year"] = pd.to_numeric(df["year"], errors="coerce")
        before_year = len(df)
        if args.min_year is not None:
            df = df[df["year"] >= args.min_year].copy()
        if args.max_year is not None:
            df = df[df["year"] <= args.max_year].copy()
        dropped_year_rows = before_year - len(df)
        bounds = []
        if args.min_year is not None:
            bounds.append(f">= {args.min_year}")
        if args.max_year is not None:
            bounds.append(f"<= {args.max_year}")
        print(f"Year filter: {' and '.join(bounds)} (dropped {dropped_year_rows} rows outside bounds or invalid year)")

    allow = list(YEARLY_HISTORICAL_COLUMN_ALLOWLIST)
    keep = [c for c in allow if c in df.columns]
    drop = [c for c in df.columns if c not in allow]

    missing_critical = [c for c in YEARLY_HISTORICAL_CRITICAL_COLUMNS if c not in df.columns]
    if missing_critical:
        print(f"ERROR: Input missing critical columns {missing_critical}", file=sys.stderr)
        return 1

    size_in = inp.stat().st_size

    print(f"Input:  {inp}")
    print(f"Rows:   {rows_in} -> {len(df)} (after year filter)" if args.min_year is not None else f"Rows:   {rows_in}")
    print(f"Before: {ncol_in} columns, {size_in:,} bytes (original file)")
    print(f"After:  {len(keep)} columns (dropping {len(drop)})")
    if drop:
        preview = drop[:30]
        more = len(drop) - len(preview)
        print(f"Dropped sample: {preview}{' ...' if more > 0 else ''}")

    out_df = df[keep].copy()

    if args.dry_run:
        print("Dry run; no file written.")
        return 0

    if args.in_place:
        out_path = inp
        bak = inp.with_suffix(inp.suffix + ".bak")
        shutil.copy2(inp, bak)
        print(f"Backup: {bak}")
    elif args.output:
        out_path = args.output.resolve()
        out_path.parent.mkdir(parents=True, exist_ok=True)
    else:
        print("ERROR: Specify --output path or --in-place", file=sys.stderr)
        return 1

    out_df.to_csv(out_path, index=False)
    size_out = out_path.stat().st_size if out_path.is_file() else 0
    print(f"Wrote:  {out_path} ({size_out:,} bytes)")
    if size_in:
        print(f"Saved:  {100.0 * (size_in - size_out) / size_in:.1f}% vs original file size")

    if args.also_copy_to:
        dest = args.also_copy_to.resolve()
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(out_path, dest)
        print(f"Copy:   {dest}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
