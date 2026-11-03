"""Plot yearly electricity demand per-capita benchmark chart (log dumbbell).

Manuscript Fig.1 style. Writes to ``charts/paper/``.

Run from repo root:
  python api/preprocess/figures/plot_yearly_demand_benchmarks.py --year 2022
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import matplotlib as mpl
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

API_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(API_ROOT))

from preprocess.figures.paper_style import (  # noqa: E402
    CONN_GREY,
    LINE_BLUE,
    LINE_ORANGE,
    apply_paper_rc,
    clear_grid,
)

DEFAULT_IEA_BENCHMARK_KWH = 100.0
DEFAULT_MEM_BENCHMARK_KWH = 1000.0


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def default_yearly_data_path() -> Path:
    return _repo_root() / "api" / "data" / "historical" / "yearly_historical_data.csv"


def resolve_output_path(output_arg: str | None, year: int) -> Path:
    if output_arg:
        return Path(output_arg)
    charts_dir = Path(__file__).resolve().parents[1] / "charts" / "paper"
    charts_dir.mkdir(parents=True, exist_ok=True)
    return charts_dir / f"electricity_demand_per_capita_benchmarks_{year}_log.png"


def load_plot_frame(data_path: Path, year: int | None) -> tuple[pd.DataFrame, int]:
    df = pd.read_csv(data_path)

    required = {
        "country",
        "year",
        "electricity_demand_per_capita (MWh)",
        "electricity_demand_per_capita_with_access (MWh)",
    }
    missing = sorted(required.difference(df.columns))
    if missing:
        raise KeyError(f"Missing required columns in {data_path}: {missing}")

    df["year"] = pd.to_numeric(df["year"], errors="coerce")
    df = df.dropna(subset=["year"]).copy()
    df["year"] = df["year"].astype(int)

    if year is None:
        if df.empty:
            raise ValueError("Input data is empty after year cleaning.")
        year = int(df["year"].max())

    year_df = df[df["year"] == year].copy()
    if year_df.empty:
        raise ValueError(f"No rows found for year={year} in {data_path}.")

    year_df = year_df[
        [
            "country",
            "electricity_demand_per_capita (MWh)",
            "electricity_demand_per_capita_with_access (MWh)",
        ]
    ].copy()

    year_df = year_df.rename(
        columns={
            "electricity_demand_per_capita (MWh)": "total_kwh",
            "electricity_demand_per_capita_with_access (MWh)": "with_access_kwh",
        }
    )

    year_df["total_kwh"] = pd.to_numeric(year_df["total_kwh"], errors="coerce") * 1000.0
    year_df["with_access_kwh"] = pd.to_numeric(year_df["with_access_kwh"], errors="coerce") * 1000.0

    year_df = year_df.dropna(subset=["total_kwh", "with_access_kwh"], how="all")
    if year_df.empty:
        raise ValueError(
            "No plottable rows: both per-capita columns are null for all countries in the selected year."
        )

    year_df = year_df.sort_values("total_kwh", na_position="first").reset_index(drop=True)
    return year_df, year


def _draw_dumbbell(ax: plt.Axes, plot_df: pd.DataFrame, *, iea_benchmark: float, mem_benchmark: float) -> None:
    countries = plot_df["country"].tolist()
    y_positions = list(range(len(countries)))

    for i, (_, row) in enumerate(plot_df.iterrows()):
        x_total = row["total_kwh"]
        x_access = row["with_access_kwh"]
        if pd.notna(x_total) and pd.notna(x_access):
            ax.hlines(
                i,
                xmin=min(x_total, x_access),
                xmax=max(x_total, x_access),
                color=CONN_GREY,
                linewidth=1.2,
                zorder=1,
            )

    ax.scatter(
        plot_df["with_access_kwh"],
        y_positions,
        s=18,
        color=LINE_BLUE,
        label="Electricity demand per capita with access",
        zorder=3,
    )
    ax.scatter(
        plot_df["total_kwh"],
        y_positions,
        s=18,
        color=LINE_ORANGE,
        label="Electricity demand per capita",
        zorder=3,
    )
    ax.axvline(iea_benchmark, color="#d62728", linestyle="--", linewidth=1.1, label=f"IEA Benchmark: {iea_benchmark:.0f} kWh")
    ax.axvline(mem_benchmark, color="#2ca02c", linestyle="--", linewidth=1.1, label=f"MEM Benchmark: {mem_benchmark:.0f} kWh")

    ax.set_yticks(y_positions)
    ax.set_yticklabels(countries, fontsize=6.5)
    ax.set_xlabel("Electricity Demand Per Capita (kWh)", fontsize=8.0)
    ax.tick_params(axis="both", which="both", labelsize=6.5, top=False, right=False, direction="out")
    clear_grid(ax)
    ax.invert_yaxis()

    positive = plot_df[["total_kwh", "with_access_kwh"]].replace(0, np.nan).min().min()
    ax.set_xscale("log")
    ax.set_xlim(max(positive * 0.8, 1.0), plot_df[["total_kwh", "with_access_kwh"]].max().max() * 1.05)


def _plot_log(
    plot_df: pd.DataFrame,
    iea_benchmark: float,
    mem_benchmark: float,
    out_path: Path,
) -> None:
    fig_w, fig_h = 6.50, 6.94
    ax_left, ax_bottom, ax_width, ax_height = 0.259, 0.128, 0.734, 0.865
    fig = plt.figure(figsize=(fig_w, fig_h))
    ax = fig.add_axes([ax_left, ax_bottom, ax_width, ax_height])
    _draw_dumbbell(ax, plot_df, iea_benchmark=iea_benchmark, mem_benchmark=mem_benchmark)

    handles, labels = ax.get_legend_handles_labels()
    fig.legend(
        handles,
        labels,
        loc="upper center",
        bbox_to_anchor=(ax_left + ax_width / 2, 0.075),
        ncol=2,
        frameon=True,
        fancybox=False,
        edgecolor="0.45",
        framealpha=1.0,
        fontsize=7.5,
        borderpad=0.5,
        handletextpad=0.4,
        columnspacing=1.0,
        labelspacing=0.4,
        markerscale=0.85,
        handlelength=1.8,
    )

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with mpl.rc_context({"savefig.bbox": None, "savefig.pad_inches": 0.0}):
        fig.savefig(out_path, dpi=220, facecolor="white")
    plt.close(fig)


def plot_yearly_demand_benchmarks(
    target_year: int | None = None,
    yearly_data_path: str | Path | None = None,
    output_path: str | None = None,
    iea_benchmark_kwh: float = DEFAULT_IEA_BENCHMARK_KWH,
    mem_benchmark_kwh: float = DEFAULT_MEM_BENCHMARK_KWH,
) -> Path:
    data_path = Path(yearly_data_path) if yearly_data_path else default_yearly_data_path()
    if not data_path.is_absolute():
        data_path = Path(__file__).resolve().parent / data_path
    if not data_path.exists():
        raise FileNotFoundError(f"Data file not found: {data_path}")

    apply_paper_rc()
    plot_df, year = load_plot_frame(data_path, target_year)
    out_path = resolve_output_path(output_path, year)
    _plot_log(plot_df, float(iea_benchmark_kwh), float(mem_benchmark_kwh), out_path)

    print(f"Saved chart: {out_path}")
    print(f"Countries plotted: {len(plot_df)}")
    return out_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Plot yearly electricity demand per-capita benchmarks (log).")
    parser.add_argument("--year", type=int, default=2022, help="Target year (default: 2022).")
    parser.add_argument("--output", type=str, default=None, help="Optional output PNG path.")
    parser.add_argument(
        "--data",
        type=str,
        default=None,
        help="Path to yearly_historical_data.csv (default: api/data/historical/...).",
    )
    args = parser.parse_args()
    plot_yearly_demand_benchmarks(
        target_year=args.year,
        yearly_data_path=args.data,
        output_path=args.output,
    )


if __name__ == "__main__":
    main()
