"""
Columns from yearly_historical_data.csv referenced by API pipelines.

Used to trim fat CSVs for deployment. Order is stable for readable diffs.
Keep in sync when adding readers of new columns.
"""

# fmt: off
YEARLY_HISTORICAL_COLUMN_ALLOWLIST: tuple[str, ...] = (
    "country",
    "year",
    "population",
    "gdp",
    "Population growth (annual %)",
    "iso_code",
    # Core electricity (TWh)
    "electricity_demand (TWh)",
    "electricity_generation (TWh)",
    "electricity_production_aggregate (TWh)",
    "renewables_electricity",
    "renewables_share_elec",
    "fossil_share_elec",
    "low_carbon_share_elec",
    "carbon_intensity_elec",
    "solar_electricity",
    "wind_electricity",
    "hydro_electricity",
    "greenhouse_gas_emissions",
    # Access & welfare
    "Access to electricity (% of total population)",
    "Access to Clean Fuels and Technologies for cooking (% of total population)",
    "energy_poverty_electricity (% of total population)",
    "energy_poverty_multidimensional (% of total population)",
    "energy_poverty_electricity_rural (% of rural population)",
    "energy_poverty_electricity_urban (% of urban population)",
    # Per-capita demand (MWh; legacy kWh still read by migration helpers)
    "electricity_demand_per_capita (MWh)",
    "electricity_demand_per_capita_with_access (MWh)",
    "electricity_demand_per_capita (kWh)",
    "electricity_demand_per_capita_with_access (kWh)",
)

# Minimum set to refuse trimming if absent (avoids shipping a broken dataset).
YEARLY_HISTORICAL_CRITICAL_COLUMNS: tuple[str, ...] = (
    "country",
    "year",
    "population",
    "electricity_demand (TWh)",
)
