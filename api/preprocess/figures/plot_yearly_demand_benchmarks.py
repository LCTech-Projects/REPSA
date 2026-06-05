"""Plot yearly electricity demand per-capita benchmark chart (dumbbell style).

Call ``plot_yearly_demand_benchmarks(...)`` directly with your variables.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

# Benchmarks in kWh/person/year (IEA 100 kWh; MEM 1000 kWh).
DEFAULT_IEA_BENCHMARK_KWH = 100.0
DEFAULT_MEM_BENCHMARK_KWH = 1000.0

# Publication width (reviewer: ~7 pt text when rendered at 16 cm wide).
FIG_WIDTH_CM = 16.0
FIG_WIDTH_IN = FIG_WIDTH_CM / 2.54
FONT_SIZE = 7
FONT_SCALE = 1.66  # reviewer: increase all text by 66 %

PANEL_A_END = "Senegal"
PANEL_B_START = "Angola"
PANEL_A_XLIM = (0.0, 1000.0)
PANEL_B_XLIM = (0.0, 7000.0)


def _font(size: float) -> float:
    return size * FONT_SCALE


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def default_yearly_data_path() -> Path:
    return _repo_root() / "api" / "data" / "historical" / "yearly_historical_data.csv"


def resolve_output_path(output_arg: str | None, year: int, layout: str) -> Path:
    if output_arg:
        return Path(output_arg)

    charts_dir = Path(__file__).resolve().parent / "charts"
    charts_dir.mkdir(parents=True, exist_ok=True)
    suffix = "" if layout == "linear" else f"_{layout}"
    return charts_dir / f"electricity_demand_per_capita_benchmarks_{year}{suffix}.png"


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


def _draw_dumbbell_panel(
    ax: plt.Axes,
    plot_df: pd.DataFrame,
    *,
    iea_benchmark: float,
    mem_benchmark: float,
    xlim: tuple[float, float] | None,
    log_x: bool,
    show_ylabels: bool,
    show_legend: bool,
) -> None:
    countries = plot_df["country"].tolist()
    y_positions = list(range(len(countries)))

    for _, row in plot_df.iterrows():
        x_total = row["total_kwh"]
        x_access = row["with_access_kwh"]
        if pd.notna(x_total) and pd.notna(x_access):
            ax.plot([x_total, x_access], y_positions, color="0.75", linewidth=1.5, zorder=1)

    ax.scatter(
        plot_df["with_access_kwh"],
        y_positions,
        s=36,
        color="#1f77b4",
        label="Electricity demand per capita with access",
        zorder=3,
    )
    ax.scatter(
        plot_df["total_kwh"],
        y_positions,
        s=36,
        color="#ff7f0e",
        label="Electricity demand per capita",
        zorder=3,
    )

    ax.axvline(
        iea_benchmark,
        color="#d62728",
        linestyle="--",
        linewidth=1.5,
        label=f"IEA Benchmark: {iea_benchmark:.0f} kWh",
    )
    ax.axvline(
        mem_benchmark,
        color="#2ca02c",
        linestyle="--",
        linewidth=1.5,
        label=f"MEM Benchmark: {mem_benchmark:.0f} kWh",
    )

    if show_ylabels:
        ax.set_yticks(y_positions)
        ax.set_yticklabels(countries, fontsize=_font(FONT_SIZE))
    else:
        ax.set_yticks(y_positions)
        ax.set_yticklabels([])

    ax.set_xlabel("Electricity Demand Per Capita (kWh)", fontsize=_font(FONT_SIZE + 1))
    ax.tick_params(axis="x", labelsize=_font(FONT_SIZE))
    ax.grid(axis="x", alpha=0.25)
    ax.set_axisbelow(True)
    ax.invert_yaxis()

    if log_x:
        positive = plot_df[["total_kwh", "with_access_kwh"]].replace(0, np.nan).min().min()
        ax.set_xscale("log")
        ax.set_xlim(max(positive * 0.8, 1.0), xlim[1] if xlim else plot_df[["total_kwh", "with_access_kwh"]].max().max() * 1.05)
    elif xlim is not None:
        ax.set_xlim(*xlim)

    if show_legend:
        ax.legend(loc="lower right", frameon=True, fontsize=_font(FONT_SIZE))


def plot_chart(
    plot_df: pd.DataFrame,
    iea_benchmark: float,
    mem_benchmark: float,
    out_path: Path,
    *,
    layout: str = "twopanel",
) -> None:
    if layout == "twopanel":
        _plot_twopanel(plot_df, iea_benchmark, mem_benchmark, out_path)
    elif layout == "log":
        _plot_single(plot_df, iea_benchmark, mem_benchmark, out_path, log_x=True)
    elif layout == "linear":
        _plot_single(plot_df, iea_benchmark, mem_benchmark, out_path, log_x=False)
    else:
        raise ValueError(f"Unknown layout: {layout!r}. Use 'twopanel', 'log', or 'linear'.")


def _plot_single(
    plot_df: pd.DataFrame,
    iea_benchmark: float,
    mem_benchmark: float,
    out_path: Path,
    *,
    log_x: bool,
) -> None:
    countries = plot_df["country"].tolist()
    fig_h = max(8.0, len(countries) * 0.22)
    fig, ax = plt.subplots(figsize=(FIG_WIDTH_IN, fig_h))

    _draw_dumbbell_panel(
        ax,
        plot_df,
        iea_benchmark=iea_benchmark,
        mem_benchmark=mem_benchmark,
        xlim=None,
        log_x=log_x,
        show_ylabels=True,
        show_legend=True,
    )

    plt.tight_layout()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out_path, dpi=300)
    plt.close(fig)


def _plot_twopanel(
    plot_df: pd.DataFrame,
    iea_benchmark: float,
    mem_benchmark: float,
    out_path: Path,
) -> None:
    countries = plot_df["country"].tolist()
    if PANEL_A_END not in countries or PANEL_B_START not in countries:
        raise ValueError(
            f"Expected panel split countries {PANEL_A_END!r} and {PANEL_B_START!r} in sorted country list."
        )

    end_idx = countries.index(PANEL_A_END)
    start_idx = countries.index(PANEL_B_START)
    if start_idx != end_idx + 1:
        raise ValueError(
            f"Panel split mismatch: {PANEL_A_END!r} at index {end_idx}, "
            f"{PANEL_B_START!r} at index {start_idx} (expected consecutive)."
        )

    panel_a = plot_df.iloc[: end_idx + 1].reset_index(drop=True)
    panel_b = plot_df.iloc[start_idx:].reset_index(drop=True)

    fig_h = max(8.0, len(countries) * 0.22)
    fig, axes = plt.subplots(
        1,
        2,
        figsize=(FIG_WIDTH_IN * 2, fig_h),
        gridspec_kw={"width_ratios": [1.6, 1.0], "wspace": 0.08},
    )

    _draw_dumbbell_panel(
        axes[0],
        panel_a,
        iea_benchmark=iea_benchmark,
        mem_benchmark=mem_benchmark,
        xlim=PANEL_A_XLIM,
        log_x=False,
        show_ylabels=True,
        show_legend=False,
    )
    axes[0].text(
        0.02,
        0.02,
        "(a)",
        transform=axes[0].transAxes,
        fontsize=_font(FONT_SIZE + 1),
        fontweight="bold",
        va="bottom",
        ha="left",
    )

    _draw_dumbbell_panel(
        axes[1],
        panel_b,
        iea_benchmark=iea_benchmark,
        mem_benchmark=mem_benchmark,
        xlim=PANEL_B_XLIM,
        log_x=False,
        show_ylabels=False,
        show_legend=True,
    )
    axes[1].text(
        0.02,
        0.02,
        "(b)",
        transform=axes[1].transAxes,
        fontsize=_font(FONT_SIZE + 1),
        fontweight="bold",
        va="bottom",
        ha="left",
    )

    plt.tight_layout()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out_path, dpi=300)
    plt.close(fig)


def plot_yearly_demand_benchmarks(
    target_year: int | None = None,
    yearly_data_path: str | Path | None = None,
    output_path: str | None = None,
    iea_benchmark_kwh: float = DEFAULT_IEA_BENCHMARK_KWH,
    mem_benchmark_kwh: float = DEFAULT_MEM_BENCHMARK_KWH,
    layout: str = "twopanel",
) -> Path:
    """Generate and save the yearly per-capita benchmark chart.

    Args:
        target_year: Year to plot. If None, latest year in the data is used.
        yearly_data_path: Path to yearly historical CSV file.
        output_path: Optional image output path. Auto-generated when None.
        iea_benchmark_kwh: IEA benchmark in kWh/person/year.
        mem_benchmark_kwh: MEM benchmark in kWh/person/year.
        layout: ``twopanel`` (reviewer option 2), ``log`` (option 1), or ``linear``.

    Returns:
        Path to the saved chart image.
    """
    data_path = Path(yearly_data_path) if yearly_data_path else default_yearly_data_path()
    if not data_path.is_absolute():
        data_path = Path(__file__).resolve().parent / data_path
    if not data_path.exists():
        raise FileNotFoundError(f"Data file not found: {data_path}")

    plot_df, year = load_plot_frame(data_path, target_year)
    out_path = resolve_output_path(output_path, year, layout)

    plot_chart(
        plot_df=plot_df,
        iea_benchmark=float(iea_benchmark_kwh),
        mem_benchmark=float(mem_benchmark_kwh),
        out_path=out_path,
        layout=layout,
    )

    print(f"Saved chart: {out_path}")
    print(f"Countries plotted: {len(plot_df)}")
    print(f"Layout: {layout}")
    return out_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Plot yearly electricity demand per-capita benchmarks.")
    parser.add_argument("--year", type=int, default=2022, help="Target year (default: 2022).")
    parser.add_argument(
        "--layout",
        choices=("twopanel", "log", "linear", "all"),
        default="all",
        help="Figure layout (default: all).",
    )
    parser.add_argument("--output", type=str, default=None, help="Optional output PNG path.")
    parser.add_argument(
        "--data",
        type=str,
        default=None,
        help="Path to yearly_historical_data.csv (default: api/data/historical/...).",
    )
    args = parser.parse_args()

    layouts = ("twopanel", "log", "linear") if args.layout == "all" else (args.layout,)
    for layout in layouts:
        plot_yearly_demand_benchmarks(
            target_year=args.year,
            yearly_data_path=args.data,
            output_path=args.output if len(layouts) == 1 else None,
            layout=layout,
        )


if __name__ == "__main__":
    main()
