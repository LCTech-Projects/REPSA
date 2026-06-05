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
python api/preprocess/scripts/normalize_anchor_timeseries.py
python api/preprocess/scripts/regenerate_hourly_from_anchors.py
python api/preprocess/scripts/trim_yearly_historical.py --min-year 2016 --in-place
python api/preprocess/scripts/regenerate_hourly_from_yearly.py
```

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
