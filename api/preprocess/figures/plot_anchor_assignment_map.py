"""Map of haversine anchor-country assignments across Africa.

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

from preprocess.scripts.country_centroids import ANCHOR_COUNTRIES, COUNTRY_CENTROIDS  # noqa: E402

ASSIGNMENTS_CSV = PREPROCESS_ROOT / "charts" / "validation" / "anchor_country_assignments.csv"
NE_URL = "https://naciscdn.org/naturalearth/110m/cultural/ne_110m_admin_0_countries.zip"

# Project country name -> Natural Earth 110m NAME
NE_NAME_MAP: dict[str, str] = {
    "Central African Republic": "Central African Rep.",
    "Congo": "Congo",
    "Democratic Republic of the Congo": "Dem. Rep. Congo",
    "Cote d'Ivoire": "Côte d'Ivoire",
    "Equatorial Guinea": "Eq. Guinea",
    "Eswatini": "eSwatini",
    "Sao Tome and Principe": "São Tomé and Principe",
}

ANCHOR_COLORS = {
    "Nigeria": "#E67E22",
    "South Africa": "#2980B9",
    "Morocco": "#27AE60",
}

ISLAND_COUNTRIES = {"Cape Verde", "Comoros", "Mauritius", "Sao Tome and Principe", "Seychelles"}


def _load_assignments(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path)
    required = {"country", "assigned_anchor"}
    missing = required.difference(df.columns)
    if missing:
        raise KeyError(f"Missing columns in {path}: {sorted(missing)}")
    return df


def _ne_name(country: str) -> str:
    return NE_NAME_MAP.get(country, country)


def plot_anchor_assignment_map(
    assignments_path: Path | None = None,
    output_path: Path | None = None,
) -> Path:
    assignments_path = assignments_path or ASSIGNMENTS_CSV
    if output_path is None:
        output_path = PREPROCESS_ROOT / "charts" / "anchor_assignment_map.png"

    assignments = _load_assignments(assignments_path)
    assignments["ne_name"] = assignments["country"].map(_ne_name)
    assignments["color"] = assignments["assigned_anchor"].map(ANCHOR_COLORS)

    world = gpd.read_file(NE_URL)
    africa = world[world["CONTINENT"] == "Africa"].copy()

    merged = africa.merge(
        assignments,
        left_on="NAME",
        right_on="ne_name",
        how="left",
    )

    fig, ax = plt.subplots(figsize=(10, 10))
    ax.set_facecolor("#E8EEF2")

    # Countries not in panel (rest of Africa on NE)
    merged.plot(
        ax=ax,
        color="#F5F5F5",
        edgecolor="white",
        linewidth=0.4,
        zorder=1,
    )

    panel = merged[merged["assigned_anchor"].notna()].copy()
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

    # Island states missing from 110m polygons
    for country in ISLAND_COUNTRIES:
        row = assignments[assignments["country"] == country]
        if row.empty or country not in COUNTRY_CENTROIDS:
            continue
        lat, lon = COUNTRY_CENTROIDS[country]
        anchor = row.iloc[0]["assigned_anchor"]
        ax.scatter(
            lon,
            lat,
            s=120,
            c=ANCHOR_COLORS[anchor],
            edgecolors="white",
            linewidths=0.8,
            zorder=4,
            marker="o",
        )

    # Anchor markers
    for anchor in ANCHOR_COUNTRIES:
        lat, lon = COUNTRY_CENTROIDS[anchor]
        ax.scatter(
            lon,
            lat,
            s=280,
            c=ANCHOR_COLORS[anchor],
            edgecolors="black",
            linewidths=1.2,
            zorder=5,
            marker="*",
        )
        ax.annotate(
            anchor,
            (lon, lat),
            xytext=(8, 6),
            textcoords="offset points",
            fontsize=10,
            fontweight="bold",
            color="#222222",
            zorder=6,
        )

    ax.set_xlim(-25, 55)
    ax.set_ylim(-36, 38)
    ax.set_aspect("equal", adjustable="box")
    ax.axis("off")

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
            markerfacecolor="#555555",
            markeredgecolor="black",
            markersize=14,
            label="Reference profile location",
        )
    )
    ax.legend(
        handles=legend_handles,
        loc="lower left",
        frameon=True,
        fontsize=10,
        title="Assigned reference profile",
        title_fontsize=10,
    )

    ax.set_title(
        "Haversine anchor-country assignments (54 countries)",
        fontsize=13,
        fontweight="bold",
        pad=12,
    )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(output_path, dpi=300, bbox_inches="tight", pad_inches=0.08)
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
