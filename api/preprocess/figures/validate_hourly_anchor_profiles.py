"""Validate anchor-country hourly profile consistency.

Each anchor country (South Africa, Nigeria, Morocco) is assigned to its own
reference shape. Validation compares the normalized mean diurnal profile from
the designated anchor reference year against the reconstructed series for the
same country (equal treatment for all three self-anchored cases).

Run from repo root:
  python api/preprocess/figures/validate_hourly_anchor_profiles.py
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

from preprocess.scripts.normalize_anchor_timeseries import (  # noqa: E402
    DEMAND_COL,
    MOROCCO_HOURLY_TRUTH,
    NIGERIA_HOURLY_TRUTH,
    SOUTH_AFRICA_HOURLY_TRUTH,
    normalize_all,
)

HOURLY_DIR = API_ROOT / "data" / "historical" / "hourly"
OUT_DIR = PREPROCESS_ROOT / "charts" / "validation"

# One full calendar year per anchor used to define the transferable load shape.
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
        "country": "Morocco",
        "truth_path": MOROCCO_HOURLY_TRUTH,
        "recon_file": "Morocco.csv",
        "reference": "UCI smart-meter zones (aggregated)",
        "anchor_reference_year": 2023,
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


def _mean_diurnal_profile(df: pd.DataFrame, demand_col: str = DEMAND_COL) -> pd.Series:
    frame = df.copy()
    frame["hour"] = frame["datetime"].dt.hour
    profile = frame.groupby("hour")[demand_col].mean()
    profile = profile.reindex(range(24))
    if profile.mean() > 0:
        profile = profile / profile.mean()
    return profile


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

    truth_profile = _mean_diurnal_profile(truth_year)
    recon_profile = _mean_diurnal_profile(recon_year_df)
    diurnal_r, diurnal_mape = _profile_metrics(truth_profile, recon_profile)

    same_year = anchor_year == recon_year
    hourly_shape_r = float("nan")
    n_hours = int(min(len(truth_year), len(recon_year_df)))
    if same_year:
        merged = truth_year.merge(recon_year_df, on="datetime", suffixes=("_t", "_r"))
        merged = merged.rename(columns={f"{DEMAND_COL}_t": "truth_mwh", f"{DEMAND_COL}_r": "recon_mwh"})
        merged = merged[(merged["truth_mwh"] > 0) & (merged["recon_mwh"] > 0)]
        if not merged.empty:
            truth_share = merged["truth_mwh"] / merged["truth_mwh"].sum()
            recon_share = merged["recon_mwh"] / merged["recon_mwh"].sum()
            hourly_shape_r = float(np.corrcoef(truth_share, recon_share)[0, 1])
            n_hours = int(len(merged))

    return {
        "country": spec["country"],
        "reference_source": spec["reference"],
        "anchor_reference_year": anchor_year,
        "recon_comparison_year": recon_year,
        "same_calendar_year": same_year,
        "n_hours": n_hours,
        "diurnal_pearson_r": diurnal_r,
        "diurnal_profile_mape_pct": diurnal_mape,
        "hourly_shape_pearson_r": hourly_shape_r,
        "truth_profile": truth_profile,
        "recon_profile": recon_profile,
    }


def _plot_diurnal_validation(results: list[dict], out_path: Path) -> None:
    fig, axes = plt.subplots(1, 3, figsize=(12, 4), sharey=True)
    hours = np.arange(24)

    for ax, result in zip(axes, results):
        truth_profile = result["truth_profile"].reindex(hours)
        recon_profile = result["recon_profile"].reindex(hours)
        year_note = (
            f"ref {result['anchor_reference_year']}"
            if result["same_calendar_year"]
            else f"ref {result['anchor_reference_year']} vs recon {result['recon_comparison_year']}"
        )

        ax.plot(hours, truth_profile, marker="o", linewidth=2, label="Observed (reference)")
        ax.plot(hours, recon_profile, marker="s", linewidth=2, linestyle="--", label="REPSA reconstructed")
        ax.set_title(
            f"{result['country']} ({year_note})\n"
            f"r={result['diurnal_pearson_r']:.3f}, "
            f"MAPE={result['diurnal_profile_mape_pct']:.1f}%"
        )
        ax.set_xlabel("Hour of day")
        ax.grid(alpha=0.3)
        ax.set_xticks([0, 6, 12, 18, 23])

    axes[0].set_ylabel("Relative demand (daily mean = 1)")
    axes[-1].legend(loc="upper right", fontsize=8)
    fig.suptitle(
        "Anchor profile consistency: observed vs reconstructed diurnal shapes (self-anchored countries)",
        y=1.02,
    )
    fig.tight_layout()
    fig.savefig(out_path, dpi=300, bbox_inches="tight")
    plt.close(fig)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    results = [_validate_country(spec) for spec in ANCHORS]

    detail = pd.DataFrame([{k: v for k, v in r.items() if not k.endswith("_profile")} for r in results])
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
            }
        ]
    )
    summary_path = OUT_DIR / "hourly_anchor_profile_summary.csv"
    summary.to_csv(summary_path, index=False)

    fig_path = OUT_DIR / "hourly_anchor_diurnal_validation.png"
    _plot_diurnal_validation(results, fig_path)

    print(f"[OK] Detail:  {detail_path}")
    print(f"[OK] Summary: {summary_path}")
    print(f"[OK] Figure:  {fig_path}")
    print()
    print(
        detail[
            [
                "country",
                "anchor_reference_year",
                "recon_comparison_year",
                "same_calendar_year",
                "diurnal_pearson_r",
                "diurnal_profile_mape_pct",
            ]
        ].to_string(index=False)
    )
    print()
    print(summary.to_string(index=False))
    print()
    s = summary.iloc[0]
    print(
        "Abstract-ready sentence:\n"
        f"For the three self-anchored reference countries, diurnal profile consistency checks "
        f"against measured anchor-year demand shapes yielded median Pearson correlations of "
        f"{s['median_diurnal_pearson_r']:.2f} and median diurnal-profile MAPE of "
        f"{s['median_diurnal_profile_mape_pct']:.1f}%."
    )


if __name__ == "__main__":
    main()
