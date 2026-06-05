"""Plot diurnal demand patterns from normalized anchor truth data.

Run from repo root:
  python api/preprocess/figures/plot_hourly_reference_patterns.py
"""

from __future__ import annotations

import sys
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

API_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(API_ROOT))

from preprocess.scripts.normalize_anchor_timeseries import (  # noqa: E402
    DEMAND_COL,
    MOROCCO_HOURLY_TRUTH,
    NIGERIA_HOURLY_TRUTH,
    SOUTH_AFRICA_HOURLY_TRUTH,
    load_morocco_timeseries,
    load_nigeria_timeseries,
    load_south_africa_timeseries,
    normalize_all,
)

PREPROCESS_ROOT = Path(__file__).resolve().parents[1]
CHARTS_DIR = PREPROCESS_ROOT / "charts"


def _mean_diurnal_profile(df: pd.DataFrame) -> pd.Series:
    frame = df.copy()
    frame["hour"] = frame["datetime"].dt.hour
    hourly_mean = frame.groupby("hour")[DEMAND_COL].mean()
    if hourly_mean.sum() <= 0:
        return hourly_mean
    return hourly_mean / hourly_mean.mean()


def _load_or_normalize(path: Path, loader) -> pd.DataFrame:
    if path.is_file():
        return pd.read_csv(path, parse_dates=["datetime"])
    normalize_all()
    if path.is_file():
        return pd.read_csv(path, parse_dates=["datetime"])
    return loader()


def main() -> None:
    out_dir = CHARTS_DIR / "hourly_reference_patterns"
    out_dir.mkdir(parents=True, exist_ok=True)

    datasets = {
        "south_africa_demand_pattern.png": (
            _load_or_normalize(SOUTH_AFRICA_HOURLY_TRUTH, load_south_africa_timeseries),
            "South Africa (Eskom residual demand)",
        ),
        "nigeria_suppressed_demand_pattern.png": (
            _load_or_normalize(NIGERIA_HOURLY_TRUTH, load_nigeria_timeseries),
            "Nigeria (suppressed national demand, 2016)",
        ),
        "morocco_aggregated_demand_pattern.png": (
            _load_or_normalize(MOROCCO_HOURLY_TRUTH, load_morocco_timeseries),
            "Morocco (aggregated smart-meter zones, hourly)",
        ),
    }

    fig, axes = plt.subplots(3, 1, figsize=(10, 10), sharex=True)
    hours = np.arange(24)

    for ax, (filename, (df, title)) in zip(axes, datasets.items()):
        profile = _mean_diurnal_profile(df)
        ax.plot(hours, profile.reindex(hours), marker="o", linewidth=2)
        ax.set_title(title)
        ax.set_ylabel("Relative demand (mean=1)")
        ax.grid(alpha=0.3)
        single_path = out_dir / filename
        single_fig, single_ax = plt.subplots(figsize=(8, 4))
        single_ax.plot(hours, profile.reindex(hours), marker="o", linewidth=2, color="#35609a")
        single_ax.set_title(title)
        single_ax.set_xlabel("Hour of day")
        single_ax.set_ylabel("Relative demand (mean=1)")
        single_ax.grid(alpha=0.3)
        single_fig.tight_layout()
        single_fig.savefig(single_path, dpi=300)
        plt.close(single_fig)
        print(f"[OK] Saved {single_path}")

    axes[-1].set_xlabel("Hour of day")
    fig.suptitle("Anchor hourly demand diurnal patterns", y=0.995)
    fig.tight_layout()
    combined_path = out_dir / "combined_demand_patterns.png"
    fig.savefig(combined_path, dpi=300)
    plt.close(fig)
    print(f"[OK] Saved {combined_path}")


if __name__ == "__main__":
    main()
