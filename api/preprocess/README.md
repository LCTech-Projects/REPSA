# Preprocess

Offline training, dataset maintenance, and validation. Not used by the Flask API at runtime.

## Layout

```
preprocess/
  data/           # local anchor datasets only (raw + normalized)
  scripts/        # dataset maintenance and regeneration
  train/          # model training
  figures/        # validation plots and paper tables
  charts/         # generated outputs (gitignored)
```

## Train models

```bash
python api/preprocess/train/forecasting_models.py
python api/preprocess/train/scenario_builder.py
```

Artifacts go to `api/ml_models/`.

## Data maintenance scripts

```bash
  python api/preprocess/scripts/build_yearly_historical_from_raw.py --refresh-owid --in-place
  python api/preprocess/scripts/extend_yearly_panel_to_prior_year.py --in-place
  python api/preprocess/scripts/extend_yearly_panel_to_prior_year.py --in-place --regenerate-hourly
  python api/preprocess/scripts/extend_yearly_panel_to_prior_year.py --skip-refresh --in-place
  python api/preprocess/scripts/trim_yearly_historical.py --min-year 2016 --in-place
  python api/preprocess/scripts/generate_hourly_from_anchors.py
  python api/preprocess/scripts/generate_hourly_from_yearly.py
```

### Extend panel to prior calendar year

`extend_yearly_panel_to_prior_year.py` **always refreshes OWID and World Bank first**,
rebuilds measured values through `current_year - 1`, then fills remaining gaps with
the same statistical methods used by realtime nowcasting (log-linear / logistic /
linear + dampening). Use `--skip-refresh` only when offline. It writes:

| Output | Purpose |
|--------|---------|
| `api/data/historical/yearly_historical_data.csv` | Extended panel |
| `api/data/historical/yearly_historical_data_provenance.csv` | measured / estimated / derived flags |
| `api/data/historical/panel_metadata.json` | Extension run metadata (`extended_to`, etc.) |

Example (2026 run targets 2025):

```bash
python api/preprocess/scripts/extend_yearly_panel_to_prior_year.py --dry-run
python api/preprocess/scripts/extend_yearly_panel_to_prior_year.py --in-place --regenerate-hourly
```

Estimated cells are exploratory completions, not official statistics.

Anchor reference years: South Africa **2024**, Nigeria **2016**, Morocco **2023**.
Haversine nearest-anchor assignments are written to
`api/preprocess/charts/validation/anchor_country_assignments.csv`.

### Anchor truth timeseries (local raw inputs)

Place measured hourly sources under `api/preprocess/data/`:

| File | Source |
|------|--------|
| `south_africa_timeseries.csv` | Eskom hourly system data |
| `nigeria_timeseries.xlsx` | Mendeley suppressed national demand |
| `morocco_timeseries.xlsx` | UCI smart-meter zone data |

Normalize to a common schema:

```bash
python api/preprocess/scripts/normalize_anchor_timeseries.py
```

Writes `api/preprocess/data/normalized/*_hourly_truth.csv` with columns:
`datetime`, `country`, `electricity_demand (MWh)`, `renewables_electricity (MWh)`.

Canonical yearly data: `api/data/historical/yearly_historical_data.csv`.

## Figures / validation

```bash
python api/preprocess/figures/plot_hourly_reference_patterns.py
python api/preprocess/figures/validate_hourly_anchor_profiles.py
python api/preprocess/figures/generate_hourly_consistency_validation.py
python api/preprocess/figures/generate_section4_tables.py
python api/preprocess/figures/plot_yearly_demand_benchmarks.py
python api/preprocess/figures/plot_anchor_assignment_map.py
python api/preprocess/figures/plot_electricity_demand_data_availability_map.py
```

Outputs: `api/preprocess/charts/`.

## Notes

- Use `api/run.py` only for the web API.
- Run scripts from the **repo root** so default paths like `api/data/historical/...` resolve correctly.
