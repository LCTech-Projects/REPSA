"""Regenerate hourly per-capita columns from the yearly panel (no weather model).

Run from repo root:
  python api/preprocess/scripts/regenerate_hourly_from_yearly.py
"""

from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Regenerate hourly per-capita columns from yearly panel.")
    p.add_argument(
        "--hourly-dir",
        type=Path,
        default=Path("api/data/historical/hourly"),
        help="Directory containing country hourly CSVs",
    )
    p.add_argument(
        "--yearly",
        type=Path,
        default=Path("api/data/historical/yearly_historical_data.csv"),
        help="Yearly panel CSV",
    )
    p.add_argument("--min-year", type=int, default=2016, help="Keep hourly rows with year >= this value")
    p.add_argument("--max-year", type=int, default=2023, help="Keep hourly rows with year <= this value")
    p.add_argument("--only", type=str, default=None, help="Only process one country (matches filename stem)")
    p.add_argument("--backup", action="store_true", help="Write <file>.bak before overwriting")
    p.add_argument("--dry-run", action="store_true", help="Plan only; do not write files")
    return p.parse_args()


def main() -> int:
    args = _parse_args()
    try:
        import pandas as pd
        import numpy as np
    except Exception as e:
        print(f"[ERROR] pandas/numpy required: {e}", file=sys.stderr)
        return 1

    hourly_dir = args.hourly_dir.resolve()
    yearly_path = args.yearly.resolve()
    if not hourly_dir.is_dir():
        print(f"[ERROR] Hourly dir not found: {hourly_dir}", file=sys.stderr)
        return 1
    if not yearly_path.is_file():
        print(f"[ERROR] Yearly CSV not found: {yearly_path}", file=sys.stderr)
        return 1

    yearly = pd.read_csv(yearly_path)
    required_yearly = {
        "country",
        "year",
        "population",
        "Access to electricity (% of total population)",
        "electricity_demand (TWh)",
    }
    missing_yearly = sorted(required_yearly.difference(set(yearly.columns)))
    if missing_yearly:
        print(f"[ERROR] Yearly CSV missing columns: {missing_yearly}", file=sys.stderr)
        return 1

    yearly["country_norm"] = yearly["country"].astype(str).str.strip().str.casefold()
    yearly["year"] = pd.to_numeric(yearly["year"], errors="coerce")
    yearly["population"] = pd.to_numeric(yearly["population"], errors="coerce")
    yearly["access_pct"] = pd.to_numeric(
        yearly["Access to electricity (% of total population)"], errors="coerce"
    )
    yearly["demand_twh"] = pd.to_numeric(yearly["electricity_demand (TWh)"], errors="coerce")
    yearly = yearly.dropna(subset=["country_norm", "year", "population"]).copy()
    yearly["year"] = yearly["year"].astype(int)

    files = sorted(hourly_dir.glob("*.csv"))
    if args.only:
        want = args.only.strip().casefold()
        files = [p for p in files if p.stem.strip().casefold() == want]
        if not files:
            print(f"[ERROR] No hourly file matched --only {args.only!r}", file=sys.stderr)
            return 1

    print(f"Yearly: {yearly_path}")
    print(f"Hourly: {hourly_dir} ({len(files)} files)")
    print(f"Window: {args.min_year}..{args.max_year}")

    ok = 0
    for path in files:
        country = path.stem.replace("_", " ").strip()
        country_norm = country.casefold()
        try:
            df = pd.read_csv(path)
            if "datetime" not in df.columns or "electricity_demand (MWh)" not in df.columns:
                print(f"[WARN] Skip {path.name}: missing datetime or electricity_demand (MWh)")
                continue

            df["datetime"] = pd.to_datetime(df["datetime"], errors="coerce")
            df = df.dropna(subset=["datetime"]).copy()
            df["year"] = df["datetime"].dt.year.astype(int)
            df = df[df["year"] >= args.min_year].copy()
            if df.empty:
                print(f"[WARN] Skip {path.name}: no rows in year window")
                continue

            df["electricity_demand (MWh)"] = pd.to_numeric(df["electricity_demand (MWh)"], errors="coerce")

            y = yearly[yearly["country_norm"] == country_norm][
                ["year", "population", "access_pct", "demand_twh"]
            ].copy()
            if y.empty:
                print(f"[WARN] Skip {path.name}: no yearly rows for country")
                continue

            df = df.merge(y, on="year", how="left")

            # Extend missing years up to max_year if needed, using the latest available year's hourly shape.
            have_years = sorted(int(v) for v in df["year"].dropna().unique().tolist())
            max_have = max(have_years) if have_years else None
            if max_have is not None and args.max_year > max_have:
                shape_year = max_have
                base = df[df["year"] == shape_year].copy()
                if len(base) >= 24:
                    base_sum = float(pd.to_numeric(base["electricity_demand (MWh)"], errors="coerce").sum())
                    if base_sum > 0:
                        base["share"] = pd.to_numeric(base["electricity_demand (MWh)"], errors="coerce") / base_sum
                        for new_year in range(shape_year + 1, args.max_year + 1):
                            y_row = y[y["year"] == new_year]
                            if y_row.empty:
                                continue
                            demand_twh = float(y_row.iloc[0]["demand_twh"]) if pd.notna(y_row.iloc[0]["demand_twh"]) else None
                            pop_new = float(y_row.iloc[0]["population"]) if pd.notna(y_row.iloc[0]["population"]) else None
                            access_new = float(y_row.iloc[0]["access_pct"]) if pd.notna(y_row.iloc[0]["access_pct"]) else None
                            if demand_twh is None or pop_new is None:
                                continue
                            demand_mwh_total = demand_twh * 1_000_000.0

                            ext = base[["datetime", "share"]].copy()
                            # shift by year delta
                            ext["datetime"] = ext["datetime"] + pd.DateOffset(years=(new_year - shape_year))
                            ext["year"] = new_year
                            ext["population"] = pop_new
                            ext["access_pct"] = access_new
                            ext["demand_twh"] = demand_twh
                            ext["electricity_demand (MWh)"] = ext["share"] * demand_mwh_total
                            df = pd.concat([df, ext.drop(columns=["share"])], ignore_index=True)

            # Apply max-year window after extending.
            df = df[df["year"] <= args.max_year].copy()
            df = df.sort_values("datetime").reset_index(drop=True)
            pop = df["population"]
            access_frac = df["access_pct"] / 100.0
            demand = df["electricity_demand (MWh)"]

            df["electricity_demand_per_capita (MWh/person)"] = np.where(
                pop > 0, demand / pop, np.nan
            )
            df["electricity_demand_per_capita_with_access (MWh/person)"] = np.where(
                (pop > 0) & (access_frac > 0),
                demand / (pop * access_frac),
                np.nan,
            )

            out = df[
                [
                    "datetime",
                    "country",
                    "electricity_demand (MWh)",
                    "electricity_demand_per_capita (MWh/person)",
                    "electricity_demand_per_capita_with_access (MWh/person)",
                ]
            ].copy()
            out["datetime"] = out["datetime"].dt.strftime("%Y-%m-%d %H:%M:%S")
            out["country"] = country

            if args.dry_run:
                print(f"[DRY] {path.name}: {len(out)} rows")
                ok += 1
                continue

            if args.backup:
                bak = path.with_suffix(path.suffix + ".bak")
                shutil.copy2(path, bak)
            out.to_csv(path, index=False)
            print(f"[OK]  {path.name}: {len(out)} rows")
            ok += 1
        except Exception as e:
            print(f"[FAIL] {path.name}: {e}", file=sys.stderr)

    print(f"Done. Processed: {ok}/{len(files)}")
    return 0 if ok else 2


if __name__ == "__main__":
    raise SystemExit(main())

