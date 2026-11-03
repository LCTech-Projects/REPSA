"""Multi-criteria anchor assignment for hourly shape transfer.

Default method (`full`) matches each country to South Africa, Nigeria, or
Algeria using access, demand per capita, income, urbanization, and
electricity sector shares, plus a small geographic weight. CDD/HDD enter
matching only where load can plausibly include thermal comfort (high access
and non-trivial per capita demand, or very high consumption). Low-access
systems are not treated as climate-driven. Nigeria is only eligible for
countries with access ≤ 80% and demand per capita ≤ 1000 kWh; its 2016
profile is suppressed demand, not a peer national load shape.

Sensitivity methods: `haversine` (legacy) and `climate` (CDD/HDD only, naive).

Run from repo root:
  python api/preprocess/pipeline/assign_anchors.py
  python api/preprocess/pipeline/assign_anchors.py --method haversine
"""

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

import numpy as np
import pandas as pd

PREPROCESS_ROOT = Path(__file__).resolve().parents[1]
API_ROOT = PREPROCESS_ROOT.parent
sys.path.insert(0, str(API_ROOT))

from preprocess.pipeline.country_centroids import (  # noqa: E402
    ANCHOR_COUNTRIES,
    ANCHOR_REFERENCE_YEARS,
    COUNTRY_CENTROIDS,
)

FEATURES_CSV = PREPROCESS_ROOT / "data" / "normalized" / "matching_features.csv"
ASSIGNMENTS_OUT = PREPROCESS_ROOT / "charts" / "validation" / "anchor_country_assignments.csv"
SENSITIVITY_OUT = PREPROCESS_ROOT / "charts" / "validation" / "anchor_assignment_sensitivity.csv"

# Nigeria 2016 shape is access-constrained / suppressed. Cap slightly above
# Nigeria's own access (~62.5%) so similar West/Central African grids remain
# eligible, while near-universal-access systems cannot inherit it.
NIGERIA_MAX_ACCESS_PCT = 80.0
NIGERIA_MAX_DEMAND_PC_KWH = 1000.0
# CDD/HDD is cooling/heating *potential*. Use it only if the grid can actually
# serve thermal comfort, or consumption is already high enough that AC/heat
# is visible in the national load (e.g. Libya).
CLIMATE_MIN_ACCESS_PCT = 80.0
CLIMATE_MIN_DEMAND_PC_KWH = 800.0
CLIMATE_HIGH_DEMAND_PC_KWH = 1500.0
GEO_WEIGHT_FULL = 0.15
GEO_SCALE_KM = 4000.0

CLIMATE_COLS = ("cdd_annual_sum", "hdd_annual_sum")
SOCIO_COLS = (
    "access_electricity_pct",
    "demand_pc_kwh",
    "gdp_pc_ppp_const",
    "urban_population_pct",
)
SECTOR_COLS = ("elec_industry_share", "elec_households_share")
LOG1P_COLS = frozenset({"cdd_annual_sum", "hdd_annual_sum", "demand_pc_kwh", "gdp_pc_ppp_const"})
FULL_COLS = CLIMATE_COLS + SOCIO_COLS + SECTOR_COLS


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius_km = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * radius_km * math.asin(min(1.0, math.sqrt(a)))


def load_matching_features(path: Path | None = None) -> pd.DataFrame:
    df = pd.read_csv(path or FEATURES_CSV, dtype={"iso2": str}, keep_default_na=False, na_values=[""])
    for col in FULL_COLS:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    return df


def nigeria_eligible(row: pd.Series) -> bool:
    access = row.get("access_electricity_pct")
    demand_pc = row.get("demand_pc_kwh")
    if pd.isna(access) or float(access) > NIGERIA_MAX_ACCESS_PCT:
        return False
    if pd.notna(demand_pc) and float(demand_pc) > NIGERIA_MAX_DEMAND_PC_KWH:
        return False
    return True


def climate_eligible(row: pd.Series) -> bool:
    """True when national load can reasonably include weather-sensitive demand."""
    access = row.get("access_electricity_pct")
    demand_pc = row.get("demand_pc_kwh")
    access_val = float(access) if pd.notna(access) else float("nan")
    demand_val = float(demand_pc) if pd.notna(demand_pc) else float("nan")
    if not math.isnan(demand_val) and demand_val >= CLIMATE_HIGH_DEMAND_PC_KWH:
        return True
    if math.isnan(access_val) or math.isnan(demand_val):
        return False
    return access_val >= CLIMATE_MIN_ACCESS_PCT and demand_val >= CLIMATE_MIN_DEMAND_PC_KWH


def _geo_distance_to_anchor(country: str, anchor: str) -> float:
    if country not in COUNTRY_CENTROIDS or anchor not in COUNTRY_CENTROIDS:
        return np.nan
    lat, lon = COUNTRY_CENTROIDS[country]
    alat, alon = COUNTRY_CENTROIDS[anchor]
    return haversine_km(lat, lon, alat, alon)


def _standardize(frame: pd.DataFrame, cols: tuple[str, ...]) -> pd.DataFrame:
    work = pd.DataFrame(index=frame.index)
    for col in cols:
        series = pd.to_numeric(frame[col], errors="coerce")
        if col in LOG1P_COLS:
            series = np.log1p(series.clip(lower=0))
        work[col] = series
    med = work.median(numeric_only=True)
    iqr = (work.quantile(0.75) - work.quantile(0.25)).replace(0, np.nan)
    iqr = iqr.fillna(1.0)
    filled = work.fillna(med)
    return (filled - med) / iqr


def _feature_distances(
    features: pd.DataFrame,
    cols: tuple[str, ...],
    climate_gate: bool = False,
) -> pd.DataFrame:
    z = _standardize(features, cols)
    z.index = features["country"].to_numpy()
    missing = [a for a in ANCHOR_COUNTRIES if a not in z.index]
    if missing:
        raise KeyError(f"Anchors missing from matching features: {missing}")
    feat_lookup = features.set_index("country")
    socio_sector = [c for c in (SOCIO_COLS + SECTOR_COLS) if c in z.columns]
    rows = []
    for country, vector in z.iterrows():
        rec = {"country": country}
        use_climate = True
        if climate_gate and country in feat_lookup.index:
            use_climate = climate_eligible(feat_lookup.loc[country])
        rec["climate_in_matching"] = bool(use_climate)
        active = list(z.columns) if use_climate else socio_sector
        if not active:
            active = list(z.columns)
        for anchor in ANCHOR_COUNTRIES:
            delta = vector.loc[active].to_numpy(dtype=float) - z.loc[anchor, active].to_numpy(dtype=float)
            rec[f"feat_dist_{anchor}"] = float(np.sqrt(np.nanmean(delta**2)))
        rows.append(rec)
    return pd.DataFrame(rows)


def assign_anchors(
    features: pd.DataFrame | None = None,
    method: str = "full",
    geo_weight: float = GEO_WEIGHT_FULL,
    apply_nigeria_rule: bool | None = None,
) -> pd.DataFrame:
    """Return one assignment row per country.

    ``apply_nigeria_rule`` defaults to True for ``full``, False otherwise.
    """
    if method not in {"haversine", "climate", "full"}:
        raise ValueError(f"Unknown method: {method}")
    features = load_matching_features() if features is None else features.copy()
    if apply_nigeria_rule is None:
        apply_nigeria_rule = method == "full"

    if method == "climate":
        dist = _feature_distances(features, CLIMATE_COLS, climate_gate=False)
        geo_weight = 0.0
    elif method == "full":
        dist = _feature_distances(features, FULL_COLS, climate_gate=True)
    else:
        dist = pd.DataFrame(
            {
                "country": features["country"],
                "climate_in_matching": False,
            }
        )
        geo_weight = 1.0

    feat_lookup = features.set_index("country")
    rows = []
    for _, drow in dist.iterrows():
        country = str(drow["country"])
        eligible = {
            anchor: True
            for anchor in ANCHOR_COUNTRIES
        }
        if apply_nigeria_rule and country != "Nigeria":
            if country in feat_lookup.index and not nigeria_eligible(feat_lookup.loc[country]):
                eligible["Nigeria"] = False

        scores = {}
        for anchor in ANCHOR_COUNTRIES:
            geo = _geo_distance_to_anchor(country, anchor)
            geo_unit = 0.0 if pd.isna(geo) else min(float(geo) / GEO_SCALE_KM, 2.0)
            feat = float(drow[f"feat_dist_{anchor}"]) if method != "haversine" else geo_unit
            if method == "haversine":
                score = geo_unit if not pd.isna(geo) else np.inf
            else:
                score = math.sqrt((1.0 - geo_weight) * feat**2 + geo_weight * geo_unit**2)
            scores[anchor] = {
                "score": score,
                "geo_km": geo,
                "feat_dist": None if method == "haversine" else feat,
                "eligible": eligible[anchor],
            }

        if country in ANCHOR_COUNTRIES:
            chosen = country
            reason = "self_anchor"
        else:
            candidates = [a for a in ANCHOR_COUNTRIES if scores[a]["eligible"]]
            if not candidates:
                candidates = list(ANCHOR_COUNTRIES)
            chosen = min(candidates, key=lambda a: scores[a]["score"])
            reason = "feature_nearest"
            if apply_nigeria_rule and not scores["Nigeria"]["eligible"]:
                reason = "nigeria_ineligible"

        rec = {
            "country": country,
            "assigned_anchor": chosen,
            "anchor_reference_year": ANCHOR_REFERENCE_YEARS[chosen],
            "assignment_method": method,
            "assignment_reason": reason,
            "nigeria_eligible": bool(scores["Nigeria"]["eligible"]) if country != "Nigeria" else True,
            "climate_in_matching": bool(drow["climate_in_matching"])
            if "climate_in_matching" in drow.index and method == "full"
            else method == "climate",
        }
        for anchor in ANCHOR_COUNTRIES:
            key = anchor.lower().replace(" ", "_")
            rec[f"score_{key}"] = scores[anchor]["score"]
            rec[f"geo_km_{key}"] = scores[anchor]["geo_km"]
            rec[f"feat_dist_{key}"] = scores[anchor]["feat_dist"]
        rows.append(rec)

    out = pd.DataFrame(rows).sort_values("country").reset_index(drop=True)
    return out


def assignment_sensitivity(features: pd.DataFrame | None = None) -> pd.DataFrame:
    features = load_matching_features() if features is None else features
    pieces = []
    for method in ("haversine", "climate", "full"):
        assigned = assign_anchors(features, method=method)
        pieces.append(
            assigned.rename(columns={"assigned_anchor": method})[["country", method]]
        )
    merged = pieces[0]
    for piece in pieces[1:]:
        merged = merged.merge(piece, on="country")
    merged["haversine_vs_full"] = merged["haversine"] != merged["full"]
    merged["climate_vs_full"] = merged["climate"] != merged["full"]
    return merged.sort_values("country").reset_index(drop=True)


def write_assignments(
    method: str = "full",
    assignments_out: Path | None = None,
    sensitivity_out: Path | None = None,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    features = load_matching_features()
    assigned = assign_anchors(features, method=method)
    sensitivity = assignment_sensitivity(features)
    assignments_path = assignments_out or ASSIGNMENTS_OUT
    sensitivity_path = sensitivity_out or SENSITIVITY_OUT
    assignments_path.parent.mkdir(parents=True, exist_ok=True)
    assigned.to_csv(assignments_path, index=False)
    sensitivity.to_csv(sensitivity_path, index=False)
    return assigned, sensitivity


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Assign countries to hourly demand anchors.")
    parser.add_argument("--method", choices=("haversine", "climate", "full"), default="full")
    parser.add_argument("--assignments-out", type=Path, default=ASSIGNMENTS_OUT)
    parser.add_argument("--sensitivity-out", type=Path, default=SENSITIVITY_OUT)
    return parser.parse_args()


def main() -> int:
    args = _parse_args()
    assigned, sensitivity = write_assignments(
        method=args.method,
        assignments_out=args.assignments_out,
        sensitivity_out=args.sensitivity_out,
    )
    counts = assigned["assigned_anchor"].value_counts().to_dict()
    switched = int(sensitivity["haversine_vs_full"].sum())
    print(f"Method: {args.method}")
    print(f"Assignments: {counts}")
    print(f"Countries differing haversine vs full: {switched}")
    print(f"Wrote {args.assignments_out}")
    print(f"Wrote {args.sensitivity_out}")
    nigeria_blocked = assigned[(assigned["assignment_reason"] == "nigeria_ineligible")]
    if not nigeria_blocked.empty:
        print("Nigeria-ineligible (assigned among Algeria/South Africa):")
        for _, row in nigeria_blocked.iterrows():
            print(f"  {row['country']} -> {row['assigned_anchor']}")
    if "climate_in_matching" in assigned.columns:
        climate_on = assigned[assigned["climate_in_matching"]]
        climate_off = assigned[~assigned["climate_in_matching"]]
        print(f"Climate used in matching: {len(climate_on)} countries")
        for _, row in climate_on.iterrows():
            print(f"  {row['country']} -> {row['assigned_anchor']}")
        print(f"Climate omitted (low access / low demand): {len(climate_off)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
