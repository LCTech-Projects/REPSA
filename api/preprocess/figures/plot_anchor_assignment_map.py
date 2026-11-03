"""Map of multi-criteria anchor-country assignments across Africa.

Style matches the data-descriptor manuscript: white background, no grid,
country borders retained, Western Sahara filled with Morocco's assigned anchor, legend centered
below the map with a small gap.

Run from repo root:
  python api/preprocess/figures/plot_anchor_assignment_map.py
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import geopandas as gpd
import matplotlib.pyplot as plt
import pandas as pd
from matplotlib.lines import Line2D
from matplotlib.patches import Patch

API_ROOT = Path(__file__).resolve().parents[2]
PREPROCESS_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_ROOT))

from preprocess.figures.paper_style import (  # noqa: E402
    apply_paper_rc,
    fit_map_axes,
    legend_below_axes,
)
from preprocess.pipeline.country_centroids import ANCHOR_COUNTRIES, COUNTRY_CENTROIDS  # noqa: E402

ASSIGNMENTS_CSV = PREPROCESS_ROOT / "charts" / "validation" / "anchor_country_assignments.csv"
NE_URL = "https://naciscdn.org/naturalearth/110m/cultural/ne_110m_admin_0_countries.zip"

NE_NAME_MAP: dict[str, str] = {
    "Central African Republic": "Central African Rep.",
    "Congo": "Congo",
    "Democratic Republic of the Congo": "Dem. Rep. Congo",
    "Cote d'Ivoire": "Côte d'Ivoire",
    "Equatorial Guinea": "Eq. Guinea",
    "Eswatini": "eSwatini",
    "Sao Tome and Principe": "São Tomé and Principe",
    "South Sudan": "S. Sudan",
}

ANCHOR_COLORS = {
    "Nigeria": "#E67E22",
    "South Africa": "#2980B9",
    "Algeria": "#27AE60",
}


def _load_assignments(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path)
    required = {"country", "assigned_anchor"}
    missing = required.difference(df.columns)
    if missing:
        raise KeyError(f"Missing columns in {path}: {sorted(missing)}")
    return df


def _ne_name(country: str) -> str:
    return NE_NAME_MAP.get(country, country)


def _is_western_sahara(frame: gpd.GeoDataFrame) -> pd.Series:
    name = frame["NAME"].astype(str)
    admin = frame["ADMIN"].astype(str) if "ADMIN" in frame.columns else pd.Series("", index=frame.index)
    return name.eq("W. Sahara") | admin.eq("Western Sahara")


def _is_somaliland(frame: gpd.GeoDataFrame) -> pd.Series:
    name = frame["NAME"].astype(str)
    admin = frame["ADMIN"].astype(str) if "ADMIN" in frame.columns else pd.Series("", index=frame.index)
    return name.str.contains("Somaliland", case=False, na=False) | admin.str.contains(
        "Somaliland", case=False, na=False
    )


def plot_anchor_assignment_map(
    assignments_path: Path | None = None,
    output_path: Path | None = None,
) -> Path:
    apply_paper_rc()
    assignments_path = assignments_path or ASSIGNMENTS_CSV
    if output_path is None:
        output_path = PREPROCESS_ROOT / "charts" / "paper" / "anchor_assignment_map.png"

    assignments = _load_assignments(assignments_path)
    assignments["ne_name"] = assignments["country"].map(_ne_name)

    world = gpd.read_file(NE_URL)
    africa = world[world["CONTINENT"] == "Africa"].copy()

    merged = africa.merge(
        assignments,
        left_on="NAME",
        right_on="ne_name",
        how="left",
    )
    # Natural Earth splits Western Sahara; fill it with Morocco's assigned anchor.
    morocco_anchor = merged.loc[merged["NAME"].eq("Morocco"), "assigned_anchor"]
    if not morocco_anchor.empty and pd.notna(morocco_anchor.iloc[0]):
        merged.loc[_is_western_sahara(merged), "assigned_anchor"] = morocco_anchor.iloc[0]
    # Natural Earth splits Somaliland; fill it like Somalia.
    somalia_anchor = merged.loc[merged["NAME"].eq("Somalia"), "assigned_anchor"]
    if not somalia_anchor.empty and pd.notna(somalia_anchor.iloc[0]):
        merged.loc[_is_somaliland(merged), "assigned_anchor"] = somalia_anchor.iloc[0]

    fig, ax = plt.subplots(figsize=(9.5, 9.2))
    ax.set_facecolor("white")
    fig.patch.set_facecolor("white")

    merged.plot(
        ax=ax,
        color="#F7F7F7",
        edgecolor="white",
        linewidth=0.45,
        zorder=1,
    )

    panel = merged[merged["assigned_anchor"].notna()]
    for anchor in ANCHOR_COUNTRIES:
        subset = panel[panel["assigned_anchor"] == anchor]
        if subset.empty:
            continue
        subset.plot(
            ax=ax,
            color=ANCHOR_COLORS[anchor],
            edgecolor="white",
            linewidth=0.5,
            zorder=2,
        )

    # Ensure Western Sahara is painted even if a join edge-case drops it.
    ws = merged.loc[_is_western_sahara(merged)]
    if not ws.empty:
        ws_anchor = ws["assigned_anchor"].iloc[0]
        if pd.notna(ws_anchor) and ws_anchor in ANCHOR_COLORS:
            ws.plot(
                ax=ax,
                color=ANCHOR_COLORS[str(ws_anchor)],
                edgecolor="white",
                linewidth=0.5,
                zorder=3,
            )

    for anchor in ANCHOR_COUNTRIES:
        lat, lon = COUNTRY_CENTROIDS[anchor]
        ax.scatter(
            lon,
            lat,
            s=260,
            facecolors="none",
            edgecolors="black",
            linewidths=1.4,
            zorder=5,
            marker="*",
        )

    fit_map_axes(ax, (-25, 55), (-35, 37.5))

    legend_handles = [
        Patch(facecolor=ANCHOR_COLORS[a], edgecolor="white", label=f"{a} anchor")
        for a in ANCHOR_COUNTRIES
    ]
    legend_handles.append(
        Line2D(
            [0],
            [0],
            marker="*",
            color="w",
            markerfacecolor="none",
            markeredgecolor="black",
            markersize=14,
            label="Reference profile location",
        )
    )
    labels = [h.get_label() for h in legend_handles]
    legend_below_axes(ax, legend_handles, labels, ncol=2, y=-0.002)
    fig.subplots_adjust(left=0.02, right=0.98, top=0.99, bottom=0.09)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(output_path, dpi=300, bbox_inches="tight", pad_inches=0.02, facecolor="white")
    plt.close(fig)
    return output_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Plot anchor assignment map for Africa.")
    parser.add_argument("--assignments", type=str, default=None)
    parser.add_argument("--output", type=str, default=None)
    args = parser.parse_args()

    out = plot_anchor_assignment_map(
        assignments_path=Path(args.assignments) if args.assignments else None,
        output_path=Path(args.output) if args.output else None,
    )
    print(f"Saved map: {out}")


if __name__ == "__main__":
    main()
