# Preprocess

Offline dataset maintenance, hourly reconstruction, model training, and paper figures.
Not used by the Flask API at runtime.

## What goes where

| Folder | Role |
|--------|------|
| **`pipeline/`** | Builds / updates **data**: yearly panel, anchor assignment, hourly reconstruction → `api/data/historical/` |
| **`figures/`** | Builds **plots and QC tables** for the data-descriptor paper (and related validation) |
| **`train/`** | Trains ML models → `api/ml_models/` (+ scenario QC under `charts/scenario_builder/`) |
| **`data/`** | Offline inputs (raw downloads, normalized tables, measured anchor timeseries) |
| **`charts/`** | Generated artefacts only (never edit by hand) |

`pipeline/` changes the historical dataset the app serves.  
`figures/` only visualizes / validates what is already on disk.

## Layout

```
preprocess/
  data/
    raw/                 # upstream downloads
    normalized/          # cleaned tables + anchor hourly truth
    *.csv|xlsx           # measured anchor timeseries
  pipeline/              # yearly panel, anchors, hourly rebuild
  figures/               # paper plotters + validation helpers
  train/                 # scenario builder trainer
  charts/
    paper/               # manuscript PNGs
    validation/          # assignment / consistency CSVs (+ QC histogram)
    scenario_builder/    # walk-forward metrics + train QC plots
```

## Pipeline (data)

```bash
python api/preprocess/pipeline/build_yearly_historical_from_raw.py --refresh-owid --in-place
python api/preprocess/pipeline/extend_yearly_panel_to_prior_year.py --in-place --regenerate-hourly
python api/preprocess/pipeline/trim_yearly_historical.py --min-year 2016 --in-place
python api/preprocess/pipeline/assign_anchors.py
python api/preprocess/pipeline/generate_hourly_from_anchors.py
python api/preprocess/pipeline/normalize_anchor_timeseries.py
```

### Extend panel to prior calendar year

`extend_yearly_panel_to_prior_year.py` refreshes OWID and World Bank first,
rebuilds measured values through `current_year - 1`, then fills remaining gaps with
the same statistical methods used by realtime nowcasting. Use `--skip-refresh` offline.

| Output | Purpose |
|--------|---------|
| `api/data/historical/yearly_historical_data.csv` | Extended panel |
| `api/data/historical/yearly_historical_data_provenance.csv` | measured / estimated / derived flags |
| `api/data/historical/panel_metadata.json` | Extension run metadata |

### Anchor assignment and hourly reconstruction

Anchor reference years: South Africa **2024**, Nigeria **2016**, Algeria **2019**.

| File | Purpose |
|------|---------|
| `charts/validation/anchor_country_assignments.csv` | Chosen anchors |
| `charts/validation/anchor_assignment_sensitivity.csv` | haversine vs climate vs full |

```bash
python api/preprocess/pipeline/assign_anchors.py
python api/preprocess/pipeline/generate_hourly_from_anchors.py
```

### Anchor truth timeseries

Place measured hourly sources under `api/preprocess/data/`:

| File | Source |
|------|--------|
| `south_africa_timeseries.csv` | Eskom hourly system data |
| `nigeria_timeseries.xlsx` | Mendeley suppressed national demand |
| `raw/algeria/BDD_E.xlsx` | Sonelgaz hourly consumption (Mendeley) |

```bash
python api/preprocess/pipeline/normalize_anchor_timeseries.py
```

Writes `data/normalized/*_hourly_truth.csv`.

## Train models

```bash
python api/preprocess/train/scenario_builder.py
```

Artifacts: `api/ml_models/scenario_builder.joblib`. Scenario QC: `charts/scenario_builder/`.

## Figures (paper)

Plot scripts share `figures/paper_style.py` (no gridlines; legends outside axes).
Outputs go to `charts/paper/`.

| Script | Output |
|--------|--------|
| `plot_yearly_demand_benchmarks.py` | `electricity_demand_per_capita_benchmarks_2022_log.png` |
| `plot_electricity_demand_data_availability_map.py` | `electricity_demand_data_availability_map.png` |
| `plot_anchor_assignment_map.py` | `anchor_assignment_map.png` |
| `plot_hourly_reference_patterns.py` | `south_africa_…`, `nigeria_…`, `algeria_…_demand_pattern.png` |
| `validate_hourly_anchor_profiles.py` | diurnal + seasonal validation PNGs (+ metrics CSVs) |
| `generate_hourly_consistency_validation.py` | consistency CSVs + QC histogram under `charts/validation/` |
| `generate_section4_tables.py` | Section 4 summary CSVs under `charts/validation/` |

```bash
python api/preprocess/figures/plot_yearly_demand_benchmarks.py --year 2022
python api/preprocess/figures/plot_electricity_demand_data_availability_map.py
python api/preprocess/figures/plot_hourly_reference_patterns.py
python api/preprocess/figures/plot_anchor_assignment_map.py
python api/preprocess/figures/validate_hourly_anchor_profiles.py
python api/preprocess/figures/generate_hourly_consistency_validation.py
python api/preprocess/figures/generate_section4_tables.py
```

## Notes

- Use `api/run.py` only for the web API.
- Run scripts from the **repo root** so paths like `api/data/historical/...` resolve.
