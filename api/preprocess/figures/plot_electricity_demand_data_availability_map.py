"""Choropleth map of electricity demand data availability across Africa.

Scores (0–5) are read from a CSV so the classification can be updated without
changing plotting code. Run from repo root:

  python api/preprocess/figures/plot_electricity_demand_data_availability_map.py
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import geopandas as gpd
import matplotlib.pyplot as plt
import pandas as pd
from matplotlib.patches import Patch

API_ROOT = Path(__file__).resolve().parents[2]
PREPROCESS_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_ROOT))

SCORES_CSV = PREPROCESS_ROOT / "data" / "electricity_demand_data_availability_scores.csv"
NE_URL = "https://naciscdn.org/naturalearth/110m/cultural/ne_110m_admin_0_countries.zip"
DEFAULT_OUTPUT = PREPROCESS_ROOT / "charts" / "electricity_demand_data_availability_map.png"

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

SCORE_COLORS: dict[int, str] = {
    0: "#6b3030",
    1: "#f05454",
    2: "#f7a440",
    3: "#f9d342",
    4: "#91cf50",
    5: "#008037",
}

SCORE_LABELS: dict[int, str] = {
    0: "0/5 No publicly available data",
    1: "1/5 Little or low-quality / old data",
    2: "2/5 Annual mostly high-level data",
    3: "3/5 Better-than-annual data with some disaggregation",
    4: "4/5 Good (monthly-or-better) data with high detail",
    5: "5/5 Real-time data of high quality",
}

NO_DATA_COLOR = "#a6a6a6"


def _load_scores(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path)
    required = {"country", "score"}
    missing = required.difference(df.columns)
    if missing:
        raise KeyError(f"Missing columns in {path}: {sorted(missing)}")
    df["score"] = pd.to_numeric(df["score"], errors="coerce").astype("Int64")
    invalid = df[~df["score"].between(0, 5)]
    if not invalid.empty:
        bad = invalid["country"].tolist()
        raise ValueError(f"Scores must be integers 0–5. Invalid rows: {bad}")
    return df


def _ne_name(country: str, africa_names: set[str]) -> str:
    mapped = NE_NAME_MAP.get(country, country)
    if mapped in africa_names:
        return mapped
    for name in africa_names:
        if country.replace("'", "").replace("'", "") in name.replace("'", "").replace("'", ""):
            return name
        if name.startswith("C") and "Ivoire" in name and country == "Cote d'Ivoire":
            return name
    return mapped


def plot_electricity_demand_data_availability_map(
    scores_path: Path | None = None,
    output_path: Path | None = None,
) -> Path:
    scores_path = scores_path or SCORES_CSV
    output_path = output_path or DEFAULT_OUTPUT

    scores = _load_scores(scores_path)
    world = gpd.read_file(NE_URL)
    africa = world[world["CONTINENT"] == "Africa"].copy()
    africa_names = set(africa["NAME"].tolist())

    scores["ne_name"] = scores["country"].map(lambda c: _ne_name(c, africa_names))
    merged = africa.merge(scores, left_on="NAME", right_on="ne_name", how="left")

    fig, ax = plt.subplots(figsize=(10, 10))
    ax.set_facecolor("#f0f0f0")

    no_data = merged[merged["score"].isna()]
    if not no_data.empty:
        no_data.plot(ax=ax, color=NO_DATA_COLOR, edgecolor="white", linewidth=0.5, zorder=1)

    for score in range(6):
        subset = merged[merged["score"] == score]
        if subset.empty:
            continue
        subset.plot(
            ax=ax,
            color=SCORE_COLORS[score],
            edgecolor="white",
            linewidth=0.5,
            zorder=2,
        )

    ax.set_xlim(-25, 55)
    ax.set_ylim(-36, 38)
    ax.set_aspect("equal", adjustable="box")
    ax.axis("off")

    legend_handles = [
        Patch(facecolor=SCORE_COLORS[s], edgecolor="white", label=SCORE_LABELS[s])
        for s in range(5, -1, -1)
    ]
    ax.legend(
        handles=legend_handles,
        loc="upper left",
        frameon=True,
        fontsize=9,
        handlelength=1.4,
        handleheight=1.2,
    )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(output_path, dpi=300, bbox_inches="tight", pad_inches=0.08)
    plt.close(fig)
    return output_path


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Plot electricity demand data availability map for Africa."
    )
    parser.add_argument("--scores", type=str, default=None, help="Path to scores CSV")
    parser.add_argument("--output", type=str, default=None, help="Output PNG path")
    args = parser.parse_args()

    out = plot_electricity_demand_data_availability_map(
        scores_path=Path(args.scores) if args.scores else None,
        output_path=Path(args.output) if args.output else None,
    )
    print(f"Saved map: {out}")


if __name__ == "__main__":
    main()
