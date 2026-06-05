"""
Yearly panel forecasting pipeline (global, all countries).

What this script adds for defensibility:
1) Learns yearly growth rates (not only levels) for multiple targets.
2) Uses walk-forward temporal validation across years.
3) Compares against transparent baselines:
   - persistence (no-change)
   - country-average growth
4) Reports uncertainty via empirical residual intervals (80% PI).
5) Saves figures and machine-readable metrics.

Outputs
-------
Model bundle:
- api/ml_models/scenario_builder.joblib

Validation artifacts:
- api/preprocess/charts/yearly_global_growth_paper/
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Dict, List, Tuple

import joblib
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder


TARGET_COLUMNS = [
    "electricity_demand (TWh)",
    "electricity_demand_per_capita (MWh)",
    "electricity_demand_per_capita_with_access (MWh)",
    "energy_poverty_electricity (% of total population)",
    "energy_poverty_multidimensional (% of total population)",
    "greenhouse_gas_emissions",
]

EXOGENOUS_COLUMNS = [
    "population",
    "gdp",
    "Access to electricity (% of total population)",
    "Access to Clean Fuels and Technologies for cooking (% of total population)",
    "renewables_share_elec",
]

EPS = 1e-6
GHG_TARGET = "greenhouse_gas_emissions"

DISPLAY_TARGET_LABELS = {
    "greenhouse_gas_emissions": "greenhouse_gas_emissions (MtCO₂e)",
    "electricity_demand_per_capita (MWh)": "electricity_demand_per_capita (MWh/person)",
    "electricity_demand_per_capita_with_access (MWh)": "electricity_demand_per_capita_with_access (MWh/person)",
}


def _label_target(t: str) -> str:
    return DISPLAY_TARGET_LABELS.get(t, t)


def _paths() -> Dict[str, Path]:
    script_path = Path(__file__).resolve()
    api_root = script_path.parents[2]
    preprocess_root = script_path.parents[1]

    data_path = api_root / "data" / "historical" / "yearly_historical_data.csv"
    charts_dir = preprocess_root / "charts" / "yearly_global_growth_paper"
    model_dir = api_root / "ml_models"

    return {
        "data_path": data_path,
        "charts_dir": charts_dir,
        "model_dir": model_dir,
        "model_path": model_dir / "scenario_builder.joblib",
        "predictions_csv": charts_dir / "walkforward_predictions.csv",
        "metrics_csv": charts_dir / "metrics_by_model.csv",
        "fold_metrics_csv": charts_dir / "fold_metrics.csv",
        "summary_json": charts_dir / "summary.json",
    }


def _safe_growth(curr: np.ndarray, nxt: np.ndarray, eps: float = EPS) -> np.ndarray:
    return np.log((nxt + eps) / (curr + eps))


def _apply_growth(curr: np.ndarray, growth: np.ndarray, eps: float = EPS) -> np.ndarray:
    pred = (curr + eps) * np.exp(growth) - eps
    return np.maximum(pred, 0.0)


def _clean_data(df: pd.DataFrame) -> pd.DataFrame:
    required = ["country", "year"] + EXOGENOUS_COLUMNS + TARGET_COLUMNS
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise KeyError(f"Missing required columns: {missing}")

    out = df[required].copy()
    out["country"] = out["country"].astype(str).str.strip()
    out = out[out["country"] != ""].copy()

    for col in required:
        if col == "country":
            continue
        out[col] = pd.to_numeric(out[col], errors="coerce")

    out = out.dropna(subset=["year", "country"]).copy()
    out = out.sort_values(["country", "year"]).reset_index(drop=True)

    # Require valid targets at year t
    valid = np.ones(len(out), dtype=bool)
    for t in TARGET_COLUMNS:
        valid &= out[t].notna().to_numpy()
    out = out[valid].copy()

    return out


def _build_panel_learning_frame(df: pd.DataFrame) -> pd.DataFrame:
    panel = df.copy()

    # next-year levels for each target
    for t in TARGET_COLUMNS:
        panel[f"next::{t}"] = panel.groupby("country")[t].shift(-1)
        panel[f"lag_growth::{t}"] = panel.groupby("country")[t].transform(
            lambda s: _safe_growth(s.shift(1).to_numpy(dtype=float), s.to_numpy(dtype=float))
        )

    panel["forecast_year"] = panel["year"] + 1

    # keep rows where next-year outcome exists
    next_valid = np.ones(len(panel), dtype=bool)
    for t in TARGET_COLUMNS:
        next_valid &= panel[f"next::{t}"].notna().to_numpy()
    panel = panel[next_valid].copy()

    # build growth targets
    for t in TARGET_COLUMNS:
        panel[f"y_growth::{t}"] = _safe_growth(
            panel[t].to_numpy(dtype=float), panel[f"next::{t}"].to_numpy(dtype=float)
        )

    return panel.reset_index(drop=True)


def _feature_columns() -> Tuple[List[str], List[str]]:
    numeric = ["year"] + EXOGENOUS_COLUMNS + TARGET_COLUMNS + [f"lag_growth::{t}" for t in TARGET_COLUMNS]
    categorical = ["country"]
    return numeric, categorical


def _build_pipeline() -> Pipeline:
    numeric_cols, categorical_cols = _feature_columns()

    preprocess = ColumnTransformer(
        transformers=[
            ("num", SimpleImputer(strategy="median"), numeric_cols),
            ("cat", OneHotEncoder(handle_unknown="ignore"), categorical_cols),
        ]
    )

    model = RandomForestRegressor(
        n_estimators=700,
        min_samples_leaf=2,
        random_state=42,
        n_jobs=-1,
    )

    return Pipeline([
        ("preprocess", preprocess),
        ("model", model),
    ])


def _ghg_feature_columns() -> Tuple[List[str], List[str]]:
    numeric = [
        "year",
        "population",
        "gdp",
        "Access to electricity (% of total population)",
        "Access to Clean Fuels and Technologies for cooking (% of total population)",
        "renewables_share_elec",
        "electricity_demand (TWh)",
        "electricity_demand_per_capita (MWh)",
        "energy_poverty_electricity (% of total population)",
        "energy_poverty_multidimensional (% of total population)",
        "greenhouse_gas_emissions",
        "lag_growth::electricity_demand (TWh)",
        "lag_growth::electricity_demand_per_capita (MWh)",
        "lag_growth::electricity_demand_per_capita_with_access (MWh)",
        "lag_growth::energy_poverty_electricity (% of total population)",
        "lag_growth::energy_poverty_multidimensional (% of total population)",
        "lag_growth::greenhouse_gas_emissions",
    ]
    categorical = ["country"]
    return numeric, categorical


def _build_ghg_pipeline() -> Pipeline:
    numeric_cols, categorical_cols = _ghg_feature_columns()

    preprocess = ColumnTransformer(
        transformers=[
            ("num", SimpleImputer(strategy="median"), numeric_cols),
            ("cat", OneHotEncoder(handle_unknown="ignore"), categorical_cols),
        ]
    )

    model = RandomForestRegressor(
        n_estimators=700,
        min_samples_leaf=2,
        random_state=42,
        n_jobs=-1,
    )

    return Pipeline([
        ("preprocess", preprocess),
        ("model", model),
    ])


def _growth_target_cols() -> List[str]:
    return [f"y_growth::{t}" for t in TARGET_COLUMNS]


def _eval_per_target(actual: np.ndarray, pred: np.ndarray, model_name: str, split: str) -> List[Dict[str, float]]:
    rows: List[Dict[str, float]] = []
    for i, t in enumerate(TARGET_COLUMNS):
        yt = actual[:, i]
        yp = pred[:, i]
        rows.append(
            {
                "model": model_name,
                "split": split,
                "target": t,
                "r2": float(r2_score(yt, yp)),
                "rmse": float(np.sqrt(mean_squared_error(yt, yp))),
                "mae": float(mean_absolute_error(yt, yp)),
            }
        )
    return rows


def _country_growth_baseline(train_df: pd.DataFrame, test_df: pd.DataFrame) -> np.ndarray:
    growth_cols = _growth_target_cols()
    country_mean = train_df.groupby("country")[growth_cols].mean()
    global_mean = train_df[growth_cols].mean()

    out = np.zeros((len(test_df), len(TARGET_COLUMNS)), dtype=float)

    for i, (_, row) in enumerate(test_df.iterrows()):
        country = row["country"]
        if country in country_mean.index:
            g = country_mean.loc[country].to_numpy(dtype=float)
        else:
            g = global_mean.to_numpy(dtype=float)

        curr = np.array([float(row[t]) for t in TARGET_COLUMNS], dtype=float)
        out[i, :] = _apply_growth(curr, g)

    return out


def _build_walkforward_splits(panel: pd.DataFrame, min_train_years: int = 3) -> List[int]:
    forecast_years = sorted(panel["forecast_year"].astype(int).unique().tolist())
    if len(forecast_years) <= min_train_years:
        return []

    # test each forecast year where at least min_train_years historical years exist
    cut_years: List[int] = []
    for y in forecast_years:
        available_train_years = panel.loc[panel["forecast_year"] < y, "forecast_year"].nunique()
        if available_train_years >= min_train_years:
            cut_years.append(y)
    return cut_years


def run_walkforward(panel: pd.DataFrame) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    numeric_cols, categorical_cols = _feature_columns()
    feature_cols = categorical_cols + numeric_cols
    growth_cols = _growth_target_cols()

    test_years = _build_walkforward_splits(panel)
    if not test_years:
        raise ValueError("Not enough years to run walk-forward validation.")

    ghg_idx = TARGET_COLUMNS.index(GHG_TARGET)
    ghg_feature_cols = _ghg_feature_columns()[1] + _ghg_feature_columns()[0]
    ghg_growth_col = f"y_growth::{GHG_TARGET}"

    all_pred_rows: List[Dict[str, float]] = []
    fold_metric_rows: List[Dict[str, float]] = []

    for test_year in test_years:
        train_df = panel[panel["forecast_year"].astype(int) < int(test_year)].copy()
        test_df = panel[panel["forecast_year"].astype(int) == int(test_year)].copy()

        if train_df.empty or test_df.empty:
            continue

        X_train = train_df[feature_cols]
        y_train_growth = train_df[growth_cols].to_numpy(dtype=float)

        model = _build_pipeline()
        model.fit(X_train, y_train_growth)

        ghg_model = _build_ghg_pipeline()
        ghg_model.fit(train_df[ghg_feature_cols], train_df[ghg_growth_col].to_numpy(dtype=float))

        X_test = test_df[feature_cols]
        pred_growth = model.predict(X_test)

        ghg_pred_growth = ghg_model.predict(test_df[ghg_feature_cols])
        pred_growth = np.asarray(pred_growth, dtype=float)
        pred_growth[:, ghg_idx] = np.asarray(ghg_pred_growth, dtype=float)

        actual_next = test_df[[f"next::{t}" for t in TARGET_COLUMNS]].to_numpy(dtype=float)
        curr_levels = test_df[TARGET_COLUMNS].to_numpy(dtype=float)

        pred_model = _apply_growth(curr_levels, pred_growth)
        pred_persist = curr_levels.copy()
        pred_country_growth = _country_growth_baseline(train_df, test_df)

        fold_metric_rows.extend(_eval_per_target(actual_next, pred_model, "growth_model", f"wf_{test_year}"))
        fold_metric_rows.extend(_eval_per_target(actual_next, pred_persist, "persistence", f"wf_{test_year}"))
        fold_metric_rows.extend(_eval_per_target(actual_next, pred_country_growth, "country_growth", f"wf_{test_year}"))

        for i, (_, row) in enumerate(test_df.reset_index(drop=True).iterrows()):
            base_info = {
                "country": row["country"],
                "year_t": int(row["year"]),
                "year_t_plus_1": int(row["forecast_year"]),
            }
            for j, t in enumerate(TARGET_COLUMNS):
                all_pred_rows.append(
                    {
                        **base_info,
                        "target": t,
                        "actual": float(actual_next[i, j]),
                        "pred_growth_model": float(pred_model[i, j]),
                        "pred_persistence": float(pred_persist[i, j]),
                        "pred_country_growth": float(pred_country_growth[i, j]),
                    }
                )

    pred_df = pd.DataFrame(all_pred_rows)
    fold_df = pd.DataFrame(fold_metric_rows)

    # Aggregate pooled metrics per target and per model across all walk-forward folds
    cleaned_rows: List[Dict[str, float]] = []
    for model_col, model_name in [
        ("pred_growth_model", "growth_model"),
        ("pred_persistence", "persistence"),
        ("pred_country_growth", "country_growth"),
    ]:
        for t in TARGET_COLUMNS:
            d = pred_df[pred_df["target"] == t]
            yt = d["actual"].to_numpy(dtype=float)
            yp = d[model_col].to_numpy(dtype=float)
            cleaned_rows.append(
                {
                    "model": model_name,
                    "split": "walkforward_pooled",
                    "target": t,
                    "r2": float(r2_score(yt, yp)),
                    "rmse": float(np.sqrt(mean_squared_error(yt, yp))),
                    "mae": float(mean_absolute_error(yt, yp)),
                }
            )

    metrics_df = pd.DataFrame(cleaned_rows)
    return pred_df, metrics_df, fold_df


def _uncertainty_from_residuals(pred_df: pd.DataFrame, alpha: float = 0.2) -> pd.DataFrame:
    low_q = alpha / 2.0
    high_q = 1.0 - low_q

    rows: List[Dict[str, float]] = []
    model_df = pred_df.copy()
    model_df["residual"] = model_df["actual"] - model_df["pred_growth_model"]

    for t in TARGET_COLUMNS:
        d = model_df[model_df["target"] == t]
        q_low = float(d["residual"].quantile(low_q))
        q_high = float(d["residual"].quantile(high_q))

        lo = d["pred_growth_model"] + q_low
        hi = d["pred_growth_model"] + q_high
        coverage = float(((d["actual"] >= lo) & (d["actual"] <= hi)).mean())

        rows.append(
            {
                "target": t,
                "pi_nominal": 1.0 - alpha,
                "resid_q_low": q_low,
                "resid_q_high": q_high,
                "coverage_empirical": coverage,
            }
        )

    return pd.DataFrame(rows)


def _plot_model_vs_baseline(metrics_df: pd.DataFrame, out_path: Path) -> None:
    pivot = metrics_df.pivot(index="target", columns="model", values="rmse")
    pivot = pivot.reindex(TARGET_COLUMNS)

    x = np.arange(len(pivot.index))
    w = 0.25

    fig, ax = plt.subplots(figsize=(18, 8))
    models = ["growth_model", "persistence", "country_growth"]
    offsets = [-w, 0, w]

    for m, off in zip(models, offsets):
        if m in pivot.columns:
            ax.bar(x + off, pivot[m].to_numpy(dtype=float), width=w, label=m)

    ax.set_xticks(x)
    ax.set_xticklabels([_label_target(t) for t in pivot.index.tolist()], rotation=25, ha="right")  # default fontsize
    ax.set_ylabel("RMSE")
    ax.set_title("Walk-forward RMSE by Target: Model vs Baselines")
    ax.legend()
    ax.tick_params(axis='both', labelsize=14)  # reduced by 20%
    fig.tight_layout()
    fig.savefig(out_path, dpi=300, bbox_inches="tight")
    plt.close(fig)


def _plot_coverage(coverage_df: pd.DataFrame, out_path: Path) -> None:
    fig, ax = plt.subplots(figsize=(14, 7))
    x = np.arange(len(coverage_df))

    nominal = coverage_df["pi_nominal"].to_numpy(dtype=float)
    empirical = coverage_df["coverage_empirical"].to_numpy(dtype=float)

    ax.bar(x - 0.2, nominal, width=0.4, label="Nominal 80%")
    ax.bar(x + 0.2, empirical, width=0.4, label="Empirical")
    ax.set_xticks(x)
    ax.set_xticklabels([_label_target(t) for t in coverage_df["target"].tolist()], rotation=25, ha="right")  # default fontsize
    ax.set_ylim(0, 1)
    ax.set_ylabel("Coverage")
    ax.set_title("Prediction Interval Coverage by Target")
    ax.legend()
    ax.tick_params(axis='both', labelsize=14)  # reduced by 20%
    fig.tight_layout()
    fig.savefig(out_path, dpi=300, bbox_inches="tight")
    plt.close(fig)


def _plot_parity(pred_df: pd.DataFrame, out_path: Path) -> None:
    n_targets = len(TARGET_COLUMNS)
    cols = 3
    rows = int(np.ceil(n_targets / cols))

    fig, axes = plt.subplots(rows, cols, figsize=(18, 5.5 * rows))
    axes = np.array(axes).reshape(rows, cols)

    for i, t in enumerate(TARGET_COLUMNS):
        r, c = divmod(i, cols)
        ax = axes[r, c]
        d = pred_df[pred_df["target"] == t]
        yt = d["actual"].to_numpy(dtype=float)
        yp = d["pred_growth_model"].to_numpy(dtype=float)

        ax.scatter(yt, yp, alpha=0.5, s=18)
        lo = min(float(np.nanmin(yt)), float(np.nanmin(yp)))
        hi = max(float(np.nanmax(yt)), float(np.nanmax(yp)))
        ax.plot([lo, hi], [lo, hi], linestyle="--", linewidth=1)
        ax.set_title(_label_target(t))
        ax.set_xlabel("Actual")
        ax.set_ylabel("Predicted")
        ax.tick_params(axis='both', labelsize=12)  # reduced by 20%
        # ax.grid(True)  # gridlines removed
        fig.tight_layout()
        fig.savefig(out_path, dpi=300, bbox_inches="tight")
        plt.close(fig)


def _plot_residual_distributions(pred_df: pd.DataFrame, out_path: Path) -> None:
    n_targets = len(TARGET_COLUMNS)
    cols = 3
    rows = int(np.ceil(n_targets / cols))

    fig, axes = plt.subplots(rows, cols, figsize=(18, 5.5 * rows))
    axes = np.array(axes).reshape(rows, cols)

    for i, t in enumerate(TARGET_COLUMNS):
        r, c = divmod(i, cols)
        ax = axes[r, c]
        d = pred_df[pred_df["target"] == t]
        residual = d["actual"].to_numpy(dtype=float) - d["pred_growth_model"].to_numpy(dtype=float)

        ax.hist(residual, bins=40, alpha=0.8)
        ax.axvline(0.0, linestyle="--", linewidth=1)
        ax.set_title(_label_target(t))
        ax.set_xlabel("Residual (Actual - Predicted)")
        ax.set_ylabel("Count")
        ax.tick_params(axis='both', labelsize=12)  # reduced by 20%
        # ax.grid(True)  # gridlines removed
        fig.tight_layout()
        fig.savefig(out_path, dpi=300, bbox_inches="tight")
        plt.close(fig)


def _plot_time_series(pred_df: pd.DataFrame, out_path: Path) -> None:
    n_targets = len(TARGET_COLUMNS)
    cols = 3
    rows = int(np.ceil(n_targets / cols))

    fig, axes = plt.subplots(rows, cols, figsize=(18, 5.5 * rows))
    axes = np.array(axes).reshape(rows, cols)

    for i, t in enumerate(TARGET_COLUMNS):
        r, c = divmod(i, cols)
        ax = axes[r, c]
        d = pred_df[pred_df["target"] == t].copy()

        grouped = d.groupby("year_t_plus_1", as_index=False).agg(
            actual_mean=("actual", "mean"),
            pred_mean=("pred_growth_model", "mean"),
        )

        x = grouped["year_t_plus_1"].to_numpy(dtype=int)
        ax.plot(x, grouped["actual_mean"].to_numpy(dtype=float), linewidth=2, label="Actual")
        ax.plot(x, grouped["pred_mean"].to_numpy(dtype=float), linewidth=2, linestyle="--", label="Predicted")
        ax.set_title(_label_target(t))
        ax.set_xlabel("Year")
        ax.set_ylabel("Mean value across countries")
        ax.legend()
        ax.tick_params(axis='both', labelsize=12)
        # Remove mid-year ticks and decimals
        ax.set_xticks(x)
        ax.set_xticklabels([str(int(val)) for val in x])
        # ax.grid(True)  # gridlines removed
        fig.tight_layout()
        fig.savefig(out_path, dpi=300, bbox_inches="tight")
        plt.close(fig)


def train_final_model(panel: pd.DataFrame) -> Dict[str, object]:
    numeric_cols, categorical_cols = _feature_columns()
    feature_cols = categorical_cols + numeric_cols
    growth_cols = _growth_target_cols()

    X = panel[feature_cols]
    y_growth = panel[growth_cols].to_numpy(dtype=float)

    model = _build_pipeline()
    model.fit(X, y_growth)

    ghg_feature_cols = _ghg_feature_columns()[1] + _ghg_feature_columns()[0]
    ghg_growth_col = f"y_growth::{GHG_TARGET}"
    ghg_model = _build_ghg_pipeline()
    ghg_model.fit(panel[ghg_feature_cols], panel[ghg_growth_col].to_numpy(dtype=float))

    return {
        "pipeline": model,
        "ghg_pipeline": ghg_model,
        "ghg_feature_columns": ghg_feature_cols,
        "ghg_target_column": ghg_growth_col,
        "feature_columns": feature_cols,
        "target_columns": TARGET_COLUMNS,
        "growth_target_columns": growth_cols,
        "eps": EPS,
    }


def run_pipeline() -> Dict[str, str]:
    paths = _paths()
    paths["charts_dir"].mkdir(parents=True, exist_ok=True)
    paths["model_dir"].mkdir(parents=True, exist_ok=True)

    for item in paths["charts_dir"].iterdir():
        if item.is_file() or item.is_symlink():
            item.unlink(missing_ok=True)
        elif item.is_dir():
            shutil.rmtree(item, ignore_errors=True)

    if not paths["data_path"].exists():
        raise FileNotFoundError(f"Missing data file: {paths['data_path']}")

    raw = pd.read_csv(paths["data_path"])
    data = _clean_data(raw)
    panel = _build_panel_learning_frame(data)

    if len(panel) < 300:
        raise ValueError(f"Insufficient panel rows after preprocessing: {len(panel)}")

    pred_df, metrics_df, fold_df = run_walkforward(panel)
    coverage_df = _uncertainty_from_residuals(pred_df)

    pred_df.to_csv(paths["predictions_csv"], index=False)
    metrics_df.to_csv(paths["metrics_csv"], index=False)
    fold_df.to_csv(paths["fold_metrics_csv"], index=False)

    _plot_model_vs_baseline(metrics_df, paths["charts_dir"] / "model_vs_baseline_rmse.png")
    _plot_coverage(coverage_df, paths["charts_dir"] / "coverage_80pi_by_target.png")
    _plot_parity(pred_df, paths["charts_dir"] / "parity_model_test.png")
    _plot_parity(pred_df, paths["charts_dir"] / "test_parity_plots.png")
    _plot_residual_distributions(pred_df, paths["charts_dir"] / "test_residual_distributions.png")
    _plot_time_series(pred_df, paths["charts_dir"] / "test_yearly_mean_trends.png")

    final_model = train_final_model(panel)

    # residual quantiles for future PI construction
    residual_q = {}
    tmp = pred_df.copy()
    tmp["residual"] = tmp["actual"] - tmp["pred_growth_model"]
    for t in TARGET_COLUMNS:
        d = tmp[tmp["target"] == t]["residual"]
        residual_q[t] = {
            "q10": float(d.quantile(0.10)),
            "q90": float(d.quantile(0.90)),
        }

    model_bundle = {
        **final_model,
        "residual_quantiles": residual_q,
        "validation_metrics": metrics_df.to_dict(orient="records"),
    }
    joblib.dump(model_bundle, paths["model_path"])

    summary = {
        "rows_clean": int(len(data)),
        "rows_panel": int(len(panel)),
        "years_source": sorted(data["year"].astype(int).unique().tolist()),
        "forecast_years_eval": sorted(panel["forecast_year"].astype(int).unique().tolist()),
        "features": final_model["feature_columns"],
        "targets": TARGET_COLUMNS,
        "metrics": metrics_df.to_dict(orient="records"),
        "coverage": coverage_df.to_dict(orient="records"),
        "artifacts": {
            "predictions_csv": str(paths["predictions_csv"]),
            "metrics_csv": str(paths["metrics_csv"]),
            "fold_metrics_csv": str(paths["fold_metrics_csv"]),
            "model_path": str(paths["model_path"]),
            "plots": [
                str(paths["charts_dir"] / "model_vs_baseline_rmse.png"),
                str(paths["charts_dir"] / "coverage_80pi_by_target.png"),
                str(paths["charts_dir"] / "parity_model_test.png"),
                str(paths["charts_dir"] / "test_parity_plots.png"),
                str(paths["charts_dir"] / "test_residual_distributions.png"),
                str(paths["charts_dir"] / "test_yearly_mean_trends.png"),
            ],
        },
    }

    with open(paths["summary_json"], "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    return {
        "summary_json": str(paths["summary_json"]),
        "metrics_csv": str(paths["metrics_csv"]),
        "model_path": str(paths["model_path"]),
        "charts_dir": str(paths["charts_dir"]),
    }


if __name__ == "__main__":
    print("=" * 90)
    print("TRAIN SCENARIO BUILDER MODEL (PAPER PIPELINE)")
    print("=" * 90)
    outputs = run_pipeline()
    print("✅ Pipeline complete")
    print(f"Summary: {outputs['summary_json']}")
    print(f"Metrics: {outputs['metrics_csv']}")
    print(f"Model: {outputs['model_path']}")
    print(f"Charts: {outputs['charts_dir']}")
