"""Validate that hourly demand sums match reported annual totals.

Run from repo root:
  python api/preprocess/figures/generate_hourly_consistency_validation.py
"""

from __future__ import annotations

import sys
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

API_ROOT = Path(__file__).resolve().parents[2]
PREPROCESS_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_ROOT))

YEARLY_DEMAND_COL = "electricity_demand (TWh)"
HOURLY_DEMAND_COL = "electricity_demand (MWh)"


def _country_from_stem(stem: str) -> str:
    return stem.replace("_", " ").strip()


def main() -> int:
    yearly_path = API_ROOT / "data" / "historical" / "yearly_historical_data.csv"
    hourly_dir = API_ROOT / "data" / "historical" / "hourly"
    out_dir = PREPROCESS_ROOT / "charts" / "validation"
    out_dir.mkdir(parents=True, exist_ok=True)

    yearly = pd.read_csv(yearly_path)
    if "country" not in yearly.columns or "year" not in yearly.columns:
        raise ValueError(f"Unexpected yearly schema in {yearly_path}")

    rows: list[dict[str, object]] = []
    for hourly_path in sorted(hourly_dir.glob("*.csv")):
        country = _country_from_stem(hourly_path.stem)
        hourly = pd.read_csv(hourly_path, parse_dates=["datetime"])
        if HOURLY_DEMAND_COL not in hourly.columns:
            print(f"[WARN] Skip {hourly_path.name}: missing {HOURLY_DEMAND_COL}")
            continue

        hourly["year"] = hourly["datetime"].dt.year
        hourly_sums = hourly.groupby("year", as_index=False)[HOURLY_DEMAND_COL].sum()
        country_yearly = yearly[yearly["country"] == country][["year", YEARLY_DEMAND_COL]].copy()
        merged = hourly_sums.merge(country_yearly, on="year", how="inner")
        for _, row in merged.iterrows():
            hourly_sum = float(row[HOURLY_DEMAND_COL])
            yearly_target = float(row[YEARLY_DEMAND_COL]) * 1_000_000.0
            abs_err = abs(hourly_sum - yearly_target)
            rel_err_pct = (abs_err / yearly_target * 100.0) if yearly_target else np.nan
            rows.append(
                {
                    "country": country,
                    "year": int(row["year"]),
                    "hourly_sum_mwh": hourly_sum,
                    "yearly_target_mwh": yearly_target,
                    "absolute_error_mwh": abs_err,
                    "relative_error_pct": rel_err_pct,
                }
            )

    detail = pd.DataFrame(rows)
    if detail.empty:
        print("[ERROR] No country-year pairs compared.")
        return 1

    summary = pd.DataFrame(
        [
            {
                "records_compared": len(detail),
                "countries_compared": detail["country"].nunique(),
                "years_compared_min": int(detail["year"].min()),
                "years_compared_max": int(detail["year"].max()),
                "mean_abs_error_mwh": detail["absolute_error_mwh"].mean(),
                "median_abs_error_mwh": detail["absolute_error_mwh"].median(),
                "max_abs_error_mwh": detail["absolute_error_mwh"].max(),
                "mean_relative_error_pct": detail["relative_error_pct"].mean(),
                "median_relative_error_pct": detail["relative_error_pct"].median(),
                "max_relative_error_pct": detail["relative_error_pct"].max(),
            }
        ]
    )

    detail_path = out_dir / "hourly_annual_consistency_detail.csv"
    summary_path = out_dir / "hourly_annual_consistency_summary.csv"
    plot_path = out_dir / "hourly_annual_consistency_error_distribution.png"

    detail.to_csv(detail_path, index=False)
    summary.to_csv(summary_path, index=False)

    plt.figure(figsize=(8, 5))
    rel = detail["relative_error_pct"].replace([np.inf, -np.inf], np.nan).dropna()
    plt.hist(rel, bins=40, color="#35609a", edgecolor="white")
    plt.xlabel("Relative error (%)")
    plt.ylabel("Country-year count")
    plt.title("Hourly vs annual demand consistency")
    plt.tight_layout()
    plt.savefig(plot_path, dpi=300)
    plt.close()

    print(f"[OK] {detail_path}")
    print(f"[OK] {summary_path}")
    print(f"[OK] {plot_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
