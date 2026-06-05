"""Build summary tables for Section 4 validation write-ups.

Run from repo root:
  python api/preprocess/figures/generate_section4_tables.py
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd

API_ROOT = Path(__file__).resolve().parents[2]
PREPROCESS_ROOT = Path(__file__).resolve().parents[1]


def _display_target(target: str) -> str:
    return (
        target.replace(" (MWh)", " (kWh)")
        .replace("electricity_demand_per_capita (kWh)", "electricity_demand_per_capita (kWh)")
    )


def main() -> int:
    growth_dir = PREPROCESS_ROOT / "charts" / "yearly_global_growth_paper"
    validation_dir = PREPROCESS_ROOT / "charts" / "validation"
    validation_dir.mkdir(parents=True, exist_ok=True)

    metrics_path = growth_dir / "metrics_by_model.csv"
    consistency_path = validation_dir / "hourly_annual_consistency_summary.csv"
    if not metrics_path.is_file():
        raise FileNotFoundError(f"Missing metrics file: {metrics_path}")
    if not consistency_path.is_file():
        raise FileNotFoundError(
            f"Missing hourly consistency summary: {consistency_path}. "
            "Run generate_hourly_consistency_validation.py first."
        )

    metrics = pd.read_csv(metrics_path)
    pooled = metrics[metrics["split"] == "walkforward_pooled"].copy()
    if pooled.empty:
        raise ValueError("No walkforward_pooled rows in metrics_by_model.csv")

    best_rows = []
    for target, group in pooled.groupby("target"):
        best = group.sort_values("rmse").iloc[0]
        best_rows.append(
            {
                "target": _display_target(str(target)),
                "best_model_by_rmse": best["model"],
                "rmse": best["rmse"],
                "mae": best["mae"],
                "r2": best["r2"],
            }
        )
    best_df = pd.DataFrame(best_rows)

    consistency = pd.read_csv(consistency_path).iloc[0]
    section4 = pd.DataFrame(
        [
            {
                "check": "Hourly annual consistency (sum_h d_hat = D)",
                "records_compared": int(consistency["records_compared"]),
                "countries": int(consistency["countries_compared"]),
                "years": f"{int(consistency['years_compared_min'])}-{int(consistency['years_compared_max'])}",
                "mean_relative_error_pct": consistency["mean_relative_error_pct"],
                "max_relative_error_pct": consistency["max_relative_error_pct"],
            }
        ]
    )

    best_path = validation_dir / "scenario_walkforward_best_by_target.csv"
    section4_path = validation_dir / "section4_validation_summary.csv"
    best_df.to_csv(best_path, index=False)
    section4.to_csv(section4_path, index=False)

    print(f"[OK] {best_path}")
    print(f"[OK] {section4_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
