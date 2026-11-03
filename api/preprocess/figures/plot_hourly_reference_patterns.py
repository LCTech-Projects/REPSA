"""Plot full-year hourly demand traces for the three anchor countries.

Matches manuscript Figure 4 style and canvas size: Electricity (MW) vs Date,
no gridlines, 1430×536 px @ 220 dpi.

Run from repo root:
  python api/preprocess/figures/plot_hourly_reference_patterns.py
"""

from __future__ import annotations

import sys
from pathlib import Path

import matplotlib as mpl
import matplotlib.dates as mdates
import matplotlib.pyplot as plt
import pandas as pd

API_ROOT = Path(__file__).resolve().parents[2]
PREPROCESS_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_ROOT))

from preprocess.figures.paper_style import LINE_BLUE, apply_paper_rc, clear_grid  # noqa: E402
from preprocess.pipeline.country_centroids import ANCHOR_REFERENCE_YEARS  # noqa: E402
from preprocess.pipeline.normalize_anchor_timeseries import (  # noqa: E402
    DEMAND_COL,
    ALGERIA_HOURLY_TRUTH,
    NIGERIA_HOURLY_TRUTH,
    SOUTH_AFRICA_HOURLY_TRUTH,
    load_algeria_timeseries,
    load_nigeria_timeseries,
    load_south_africa_timeseries,
    normalize_all,
)

CHARTS_DIR = PREPROCESS_ROOT / "charts" / "paper"

# Manuscript Fig.4 panel canvas (data-descriptor docx image4–6).
MS_FIGSIZE_IN = (6.50, 2.436)
MS_DPI = 220
LABEL_FS = 8.0
TICK_FS = 7.0

PANELS = (
    {
        "filename": "south_africa_demand_pattern.png",
        "truth_path": SOUTH_AFRICA_HOURLY_TRUTH,
        "loader": load_south_africa_timeseries,
        "country": "South Africa",
        "year": ANCHOR_REFERENCE_YEARS["South Africa"],
    },
    {
        "filename": "nigeria_suppressed_demand_pattern.png",
        "truth_path": NIGERIA_HOURLY_TRUTH,
        "loader": load_nigeria_timeseries,
        "country": "Nigeria",
        "year": ANCHOR_REFERENCE_YEARS["Nigeria"],
    },
    {
        "filename": "algeria_demand_pattern.png",
        "truth_path": ALGERIA_HOURLY_TRUTH,
        "loader": load_algeria_timeseries,
        "country": "Algeria",
        "year": ANCHOR_REFERENCE_YEARS["Algeria"],
    },
)


def _load_or_normalize(path: Path, loader) -> pd.DataFrame:
    if path.is_file():
        return pd.read_csv(path, parse_dates=["datetime"])
    normalize_all()
    if path.is_file():
        return pd.read_csv(path, parse_dates=["datetime"])
    return loader()


def _year_frame(df: pd.DataFrame, year: int) -> pd.DataFrame:
    out = df[df["datetime"].dt.year == year].copy()
    if out.empty:
        raise ValueError(f"No rows for year {year}")
    out = out.sort_values("datetime")
    # Hourly MWh ≈ average MW for that hour.
    out["mw"] = pd.to_numeric(out[DEMAND_COL], errors="coerce")
    return out.dropna(subset=["mw"])


def _style_time_axis(ax: plt.Axes) -> None:
    ax.set_xlabel("Date", fontsize=LABEL_FS)
    ax.set_ylabel("Electricity (MW)", fontsize=LABEL_FS)
    ax.tick_params(axis="both", labelsize=TICK_FS)
    ax.xaxis.set_major_locator(mdates.MonthLocator())
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%b-%d"))
    for label in ax.get_xticklabels():
        label.set_rotation(30)
        label.set_ha("right")
    clear_grid(ax)


def _plot_year_trace(df: pd.DataFrame, out_path: Path) -> None:
    fig, ax = plt.subplots(figsize=MS_FIGSIZE_IN)
    ax.plot(df["datetime"], df["mw"], color=LINE_BLUE, linewidth=0.55)
    _style_time_axis(ax)
    fig.subplots_adjust(left=0.11, right=0.985, bottom=0.28, top=0.96)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with mpl.rc_context({"savefig.bbox": None, "savefig.pad_inches": 0.0}):
        fig.savefig(out_path, dpi=MS_DPI, facecolor="white")
    plt.close(fig)


def main() -> None:
    apply_paper_rc()
    CHARTS_DIR.mkdir(parents=True, exist_ok=True)

    for panel in PANELS:
        df = _year_frame(
            _load_or_normalize(panel["truth_path"], panel["loader"]),
            int(panel["year"]),
        )
        out_path = CHARTS_DIR / panel["filename"]
        _plot_year_trace(df, out_path)
        print(f"[OK] Saved {out_path} ({df['mw'].min():.1f}–{df['mw'].max():.1f} MW)")


if __name__ == "__main__":
    main()
