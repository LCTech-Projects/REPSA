"""Validate anchor-country hourly profile consistency.

Compares observed vs reconstructed mean diurnal and monthly profiles for the
three self-anchored countries. Figure style matches the data-descriptor paper
(no gridlines; legend below the axes).

Run from repo root:
  python api/preprocess/figures/validate_hourly_anchor_profiles.py
"""

from __future__ import annotations

import sys
from pathlib import Path

import matplotlib as mpl
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

API_ROOT = Path(__file__).resolve().parents[2]
PREPROCESS_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_ROOT))

from preprocess.figures.paper_style import (  # noqa: E402
    LINE_BLUE,
    LINE_ORANGE,
    apply_paper_rc,
    clear_grid,
)

# Manuscript Fig.6/7 canvas (data-descriptor docx image8–9): 1431×526 @ 220 dpi.
MS_FIGSIZE_IN = (6.50, 2.39)
MS_DPI = 220
TITLE_FS = 7.5
LABEL_FS = 7.5
TICK_FS = 6.5
LEGEND_FS = 7.5
MARKER_SIZE = 3.5
LINE_WIDTH = 1.4
from preprocess.pipeline.normalize_anchor_timeseries import (  # noqa: E402
    DEMAND_COL,
    ALGERIA_HOURLY_TRUTH,
    NIGERIA_HOURLY_TRUTH,
    SOUTH_AFRICA_HOURLY_TRUTH,
    normalize_all,
)

HOURLY_DIR = API_ROOT / "data" / "historical" / "hourly"
# PNGs → charts/paper/; CSV metrics → charts/validation/.
PAPER_DIR = PREPROCESS_ROOT / "charts" / "paper"
OUT_DIR = PREPROCESS_ROOT / "charts" / "validation"
MONTH_LABELS = list("JFMAMJJASOND")

ANCHORS = (
    {
        "country": "South Africa",
        "truth_path": SOUTH_AFRICA_HOURLY_TRUTH,
        "recon_file": "South_Africa.csv",
        "reference": "Eskom residual demand",
        "anchor_reference_year": 2024,
    },
    {
        "country": "Nigeria",
        "truth_path": NIGERIA_HOURLY_TRUTH,
        "recon_file": "Nigeria.csv",
        "reference": "Mendeley suppressed national demand",
        "anchor_reference_year": 2016,
    },
    {
        "country": "Algeria",
        "truth_path": ALGERIA_HOURLY_TRUTH,
        "recon_file": "Algeria.csv",
        "reference": "Sonelgaz hourly consumption",
        "anchor_reference_year": 2019,
    },
)


def _load_hourly_csv(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path, parse_dates=["datetime"])
    if DEMAND_COL not in df.columns:
        raise ValueError(f"{path} missing {DEMAND_COL}")
    df = df.dropna(subset=["datetime", DEMAND_COL]).copy()
    df["datetime"] = pd.to_datetime(df["datetime"], errors="coerce").dt.floor("h")
    df[DEMAND_COL] = pd.to_numeric(df[DEMAND_COL], errors="coerce")
    df = df.dropna(subset=[DEMAND_COL])
    return df.sort_values("datetime").drop_duplicates(subset=["datetime"], keep="last")


def _year_slice(df: pd.DataFrame, year: int) -> pd.DataFrame:
    out = df[df["datetime"].dt.year == year].copy()
    if out.empty:
        raise ValueError(f"No rows for calendar year {year}")
    return out


def _mean_diurnal_profile(df: pd.DataFrame) -> pd.Series:
    frame = df.copy()
    frame["hour"] = frame["datetime"].dt.hour
    profile = frame.groupby("hour")[DEMAND_COL].mean().reindex(range(24))
    if profile.mean() > 0:
        profile = profile / profile.mean()
    return profile


def _monthly_share_profile(df: pd.DataFrame) -> pd.Series:
    frame = df.copy()
    frame["month"] = frame["datetime"].dt.month
    monthly = frame.groupby("month")[DEMAND_COL].sum().reindex(range(1, 13))
    total = float(monthly.sum())
    if total > 0:
        monthly = monthly / total
    return monthly


def _profile_metrics(truth_profile: pd.Series, recon_profile: pd.Series) -> tuple[float, float]:
    mask = truth_profile.notna() & recon_profile.notna() & (truth_profile > 0)
    t = truth_profile[mask].to_numpy(dtype=float)
    r = recon_profile[mask].to_numpy(dtype=float)
    if len(t) < 2:
        return float("nan"), float("nan")
    pearson_r = float(np.corrcoef(t, r)[0, 1])
    mape = float(np.mean(np.abs(r - t) / t) * 100.0)
    return pearson_r, mape


def _pick_recon_year(recon: pd.DataFrame, anchor_year: int) -> int:
    years = sorted(int(y) for y in recon["datetime"].dt.year.unique())
    if anchor_year in years:
        return anchor_year
    return max(years)


def _validate_country(spec: dict) -> dict:
    truth_path = Path(spec["truth_path"])
    recon_path = HOURLY_DIR / spec["recon_file"]
    anchor_year = int(spec["anchor_reference_year"])

    if not truth_path.is_file():
        normalize_all()
    if not truth_path.is_file():
        raise FileNotFoundError(f"Missing truth file: {truth_path}")
    if not recon_path.is_file():
        raise FileNotFoundError(f"Missing reconstructed file: {recon_path}")

    truth = _load_hourly_csv(truth_path)
    recon = _load_hourly_csv(recon_path)
    recon_year = _pick_recon_year(recon, anchor_year)

    truth_year = _year_slice(truth, anchor_year)
    recon_year_df = _year_slice(recon, recon_year)

    truth_diurnal = _mean_diurnal_profile(truth_year)
    recon_diurnal = _mean_diurnal_profile(recon_year_df)
    diurnal_r, diurnal_mape = _profile_metrics(truth_diurnal, recon_diurnal)

    truth_monthly = _monthly_share_profile(truth_year)
    recon_monthly = _monthly_share_profile(recon_year_df)
    monthly_r, monthly_mape = _profile_metrics(truth_monthly, recon_monthly)

    same_year = anchor_year == recon_year
    return {
        "country": spec["country"],
        "reference_source": spec["reference"],
        "anchor_reference_year": anchor_year,
        "recon_comparison_year": recon_year,
        "same_calendar_year": same_year,
        "diurnal_pearson_r": diurnal_r,
        "diurnal_profile_mape_pct": diurnal_mape,
        "monthly_pearson_r": monthly_r,
        "monthly_profile_mape_pct": monthly_mape,
        "truth_diurnal": truth_diurnal,
        "recon_diurnal": recon_diurnal,
        "truth_monthly": truth_monthly,
        "recon_monthly": recon_monthly,
    }


def _year_note(result: dict) -> str:
    if result["same_calendar_year"]:
        return f"ref {result['anchor_reference_year']}"
    return f"ref {result['anchor_reference_year']} vs recon {result['recon_comparison_year']}"


def _plot_triple(
    results: list[dict],
    *,
    x,
    truth_key: str,
    recon_key: str,
    r_key: str,
    mape_key: str,
    xlabel: str,
    ylabel: str,
    out_path: Path,
    xticklabels=None,
) -> None:
    fig, axes = plt.subplots(1, 3, figsize=MS_FIGSIZE_IN, sharey=True)
    for ax, result in zip(axes, results):
        truth = result[truth_key].reindex(x)
        recon = result[recon_key].reindex(x)
        ax.plot(
            x,
            truth,
            color=LINE_BLUE,
            marker="o",
            linewidth=LINE_WIDTH,
            markersize=MARKER_SIZE,
            label="Observed (reference)",
        )
        ax.plot(
            x,
            recon,
            color=LINE_ORANGE,
            marker="s",
            linewidth=LINE_WIDTH,
            linestyle="--",
            markersize=MARKER_SIZE,
            label="Reconstructed",
        )
        ax.set_title(
            f"{result['country']} ({_year_note(result)})\n"
            f"r={result[r_key]:.3f}, MAPE={result[mape_key]:.2f}%",
            fontsize=TITLE_FS,
        )
        ax.set_xlabel(xlabel, fontsize=LABEL_FS)
        ax.tick_params(axis="both", labelsize=TICK_FS)
        if xticklabels is not None:
            ax.set_xticks(list(x))
            ax.set_xticklabels(xticklabels)
        else:
            ax.set_xticks([0, 6, 12, 18, 23])
        clear_grid(ax)

    axes[0].set_ylabel(ylabel, fontsize=LABEL_FS)
    handles, labels = axes[0].get_legend_handles_labels()
    fig.subplots_adjust(left=0.08, right=0.995, bottom=0.28, top=0.82, wspace=0.12)
    fig.legend(
        handles,
        labels,
        loc="upper center",
        bbox_to_anchor=(0.5, 0.12),
        ncol=2,
        frameon=False,
        fontsize=LEGEND_FS,
    )
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with mpl.rc_context({"savefig.bbox": None, "savefig.pad_inches": 0.0}):
        fig.savefig(out_path, dpi=MS_DPI, facecolor="white")
    plt.close(fig)


def main() -> None:
    apply_paper_rc()
    PAPER_DIR.mkdir(parents=True, exist_ok=True)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    results = [_validate_country(spec) for spec in ANCHORS]

    profile_keys = {
        "truth_diurnal",
        "recon_diurnal",
        "truth_monthly",
        "recon_monthly",
    }
    detail = pd.DataFrame([{k: v for k, v in r.items() if k not in profile_keys} for r in results])
    detail_path = OUT_DIR / "hourly_anchor_profile_metrics.csv"
    detail.to_csv(detail_path, index=False)

    summary = pd.DataFrame(
        [
            {
                "n_anchor_countries": len(results),
                "median_diurnal_pearson_r": float(detail["diurnal_pearson_r"].median()),
                "median_diurnal_profile_mape_pct": float(detail["diurnal_profile_mape_pct"].median()),
                "min_diurnal_pearson_r": float(detail["diurnal_pearson_r"].min()),
                "max_diurnal_profile_mape_pct": float(detail["diurnal_profile_mape_pct"].max()),
                "median_monthly_pearson_r": float(detail["monthly_pearson_r"].median()),
                "median_monthly_profile_mape_pct": float(detail["monthly_profile_mape_pct"].median()),
            }
        ]
    )
    summary_path = OUT_DIR / "hourly_anchor_profile_summary.csv"
    summary.to_csv(summary_path, index=False)

    seasonal_metrics = detail[
        [
            "country",
            "anchor_reference_year",
            "recon_comparison_year",
            "monthly_pearson_r",
            "monthly_profile_mape_pct",
        ]
    ]
    seasonal_metrics_path = OUT_DIR / "hourly_anchor_seasonal_metrics.csv"
    seasonal_metrics.to_csv(seasonal_metrics_path, index=False)

    diurnal_path = PAPER_DIR / "hourly_anchor_diurnal_validation.png"
    _plot_triple(
        results,
        x=range(24),
        truth_key="truth_diurnal",
        recon_key="recon_diurnal",
        r_key="diurnal_pearson_r",
        mape_key="diurnal_profile_mape_pct",
        xlabel="Hour of day",
        ylabel="Relative demand (daily mean = 1)",
        out_path=diurnal_path,
    )

    seasonal_path = PAPER_DIR / "hourly_anchor_seasonal_validation.png"
    _plot_triple(
        results,
        x=range(1, 13),
        truth_key="truth_monthly",
        recon_key="recon_monthly",
        r_key="monthly_pearson_r",
        mape_key="monthly_profile_mape_pct",
        xlabel="Month",
        ylabel="Share of annual demand",
        out_path=seasonal_path,
        xticklabels=MONTH_LABELS,
    )

    print(f"[OK] Detail:   {detail_path}")
    print(f"[OK] Summary:  {summary_path}")
    print(f"[OK] Seasonal: {seasonal_metrics_path}")
    print(f"[OK] Figure:   {diurnal_path}")
    print(f"[OK] Figure:   {seasonal_path}")
    print()
    print(
        detail[
            [
                "country",
                "diurnal_pearson_r",
                "diurnal_profile_mape_pct",
                "monthly_pearson_r",
                "monthly_profile_mape_pct",
            ]
        ].to_string(index=False)
    )


if __name__ == "__main__":
    main()
