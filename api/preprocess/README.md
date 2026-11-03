# Preprocess

Offline dataset maintenance for REPSA: yearly panel construction, hourly demand reconstruction, scenario-model training, and paper figures. Not used by the Flask API at runtime.

## Layout

| Folder | Role |
|--------|------|
| **`data/`** | Offline inputs: raw downloads, measured anchor timeseries, normalized tables |
| **`pipeline/`** | Build/update the yearly panel, assign anchors, regenerate hourly demand → `api/data/historical/` |
| **`figures/`** | Plotters and QC tables for the data paper |
| **`train/`** | Train the scenario builder → `api/ml_models/` |
| **`charts/`** | Generated figures and validation tables (do not edit by hand) |

```
preprocess/
  data/
    raw/              # upstream downloads (gitignored except this README)
    normalized/       # cleaned tables + anchor hourly truth
    *.csv|xlsx        # measured anchor timeseries
  pipeline/
  figures/
  train/
  charts/
    paper/
    validation/
    scenario_builder/
```

## Rebuild yearly panel and hourly demand

Run from the **repository root**:

```bash
python api/preprocess/pipeline/normalize_anchor_timeseries.py
python api/preprocess/pipeline/build_yearly_historical_from_raw.py --refresh-owid --in-place
python api/preprocess/pipeline/extend_yearly_panel_to_prior_year.py --in-place --regenerate-hourly
python api/preprocess/pipeline/trim_yearly_historical.py --min-year 2016 --in-place
python api/preprocess/pipeline/assign_anchors.py
python api/preprocess/pipeline/generate_hourly_from_anchors.py
```

Use `--skip-refresh` on `extend_yearly_panel_to_prior_year.py` when working fully offline from the deposited `data/raw/` files.

| Output | Purpose |
|--------|---------|
| `api/data/historical/yearly_historical_data.csv` | Country–year panel |
| `api/data/historical/yearly_historical_data_provenance.csv` | measured / estimated / derived flags |
| `api/data/historical/panel_metadata.json` | Extension run metadata |
| `api/data/historical/hourly/*.csv` | Reconstructed hourly demand by country |

### Anchor reference years

| Anchor | Year | Notes |
|--------|------|--------|
| South Africa | 2024 | Eskom system demand |
| Nigeria | 2016 | Access-constrained (suppressed) national demand |
| Algeria | 2019 | Sonelgaz hourly consumption |

Measured sources live under `data/` (`south_africa_timeseries.csv`, `nigeria_timeseries.xlsx`, `raw/algeria/BDD_E.xlsx`). Normalization writes `data/normalized/*_hourly_truth.csv`.

## Train the scenario model

```bash
python api/preprocess/train/scenario_builder.py
```

Artefact: `api/ml_models/scenario_builder.joblib`. QC plots/tables: `charts/scenario_builder/`.

## Paper figures

Plot scripts share `figures/paper_style.py`. Outputs go to `charts/paper/` and `charts/validation/`.

```bash
python api/preprocess/figures/plot_yearly_demand_benchmarks.py --year 2022
python api/preprocess/figures/plot_electricity_demand_data_availability_map.py
python api/preprocess/figures/plot_hourly_reference_patterns.py
python api/preprocess/figures/plot_anchor_assignment_map.py
python api/preprocess/figures/validate_hourly_anchor_profiles.py
python api/preprocess/figures/generate_hourly_consistency_validation.py
python api/preprocess/figures/generate_validation_summary_tables.py
```

## Zenodo deposit

The data-paper DOI package is a **lean** archive: `pipeline/`, `data/` (including `raw/`), and this README — enough to regenerate the yearly panel and hourly demand offline. Figures, training, and chart artefacts stay in the GitHub repository.

## Notes

- Use `api/run.py` only for the web API.
- Run scripts from the repository root so paths such as `api/data/historical/...` resolve.
