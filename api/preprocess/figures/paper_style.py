"""Shared publication style for data-descriptor figures.

Matches the Country-level Hourly Electricity Demand Profiles manuscript:
no gridlines, white backgrounds, legends placed outside the axes.
"""

from __future__ import annotations

import matplotlib as mpl
import matplotlib.pyplot as plt

LINE_BLUE = "#1f77b4"
LINE_ORANGE = "#ff7f0e"
CONN_GREY = "0.75"
# Previous map legend default was 9 pt; user asked for 1.3× that size.
LEGEND_FONTSIZE_PT = round(9 * 1.3, 1)  # 11.7 pt


def apply_paper_rc() -> None:
    mpl.rcParams.update(
        {
            "figure.facecolor": "white",
            "axes.facecolor": "white",
            "axes.grid": False,
            "axes.spines.top": True,
            "axes.spines.right": True,
            "axes.spines.bottom": True,
            "axes.spines.left": True,
            "legend.frameon": False,
            "legend.fontsize": LEGEND_FONTSIZE_PT,
            "font.size": 10,
            "axes.titlesize": 10,
            "axes.labelsize": 10,
            "xtick.labelsize": 9,
            "ytick.labelsize": 9,
            "savefig.dpi": 300,
            "savefig.bbox": "tight",
            "savefig.pad_inches": 0.08,
        }
    )


def clear_grid(ax: plt.Axes) -> None:
    ax.grid(False)
    ax.set_axisbelow(False)


def legend_below(
    fig: plt.Figure,
    handles=None,
    labels=None,
    *,
    ncol: int = 2,
    y: float = -0.02,
    fontsize: float = LEGEND_FONTSIZE_PT,
) -> None:
    """Place a horizontal legend below all axes (does not overlap data)."""
    kwargs = {
        "loc": "upper center",
        "bbox_to_anchor": (0.5, y),
        "ncol": ncol,
        "frameon": False,
        "fontsize": fontsize,
    }
    if handles is not None:
        fig.legend(handles=handles, labels=labels, **kwargs)
    else:
        fig.legend(**kwargs)


def legend_below_axes(
    ax: plt.Axes,
    handles,
    labels=None,
    *,
    ncol: int = 2,
    y: float = -0.002,
    fontsize: float = LEGEND_FONTSIZE_PT,
) -> None:
    """Place a legend tight under an axes (axes coordinates)."""
    ax.legend(
        handles=handles,
        labels=labels,
        loc="upper center",
        bbox_to_anchor=(0.5, y),
        ncol=ncol,
        frameon=False,
        fontsize=fontsize,
        borderaxespad=0.0,
        handlelength=1.4,
        handleheight=1.2,
        handletextpad=0.6,
        columnspacing=1.2,
        labelspacing=0.35,
    )


def fit_map_axes(ax: plt.Axes, xlim: tuple[float, float], ylim: tuple[float, float]) -> None:
    """Crop the axes box to the map extent so no empty band sits under Africa."""
    ax.set_xlim(*xlim)
    ax.set_ylim(*ylim)
    ax.set_aspect("equal")
    width = xlim[1] - xlim[0]
    height = ylim[1] - ylim[0]
    if width > 0:
        ax.set_box_aspect(height / width)
    ax.axis("off")
