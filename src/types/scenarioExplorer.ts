export type ScenarioMode = "explore" | "bau";

export interface ForecastPoint {
  year: number;
  value: number;
}

export interface ForecastSeries {
  scenario: ForecastPoint[];
  low: ForecastPoint[];
  high: ForecastPoint[];
}

export interface ScenarioParameters {
  renewable_target: number;
  energy_access_target: number;
  clean_cooking_target: number;
  population_growth_rate: number;
}

export interface CountryEnvelope {
  defaults: Partial<ScenarioParameters>;
  slider_bounds: Record<string, { min: number; max: number }>;
  historical_cagr: Record<string, number>;
  latest_year: number | null;
  available_extended_series: string[];
  missing_but_useful: string[];
}

export interface ScenarioResult {
  scenario_mode: ScenarioMode;
  scenario_params?: Record<string, number | string>;
  assumptions: Record<string, ForecastPoint[]>;
  forecasts: Record<string, ForecastSeries>;
  baselines: {
    persistence: Record<string, ForecastPoint[]>;
    historical_trend: Record<string, ForecastPoint[]>;
  };
  summary: Record<string, number>;
  warnings: string[];
  country_envelope?: CountryEnvelope;
  validation?: {
    metrics: Array<Record<string, unknown>>;
    has_uncertainty_bands: boolean;
    note: string;
  };
  timeline: {
    start_year: number;
    end_year: number;
  };
}

export const OUTPUT_CHARTS = [
  {
    key: "electricity_demand",
    title: "Electricity Demand (TWh)",
    yLabel: "TWh",
  },
  {
    key: "electricity_per_capita",
    title: "Electricity Demand Per Capita (MWh/person)",
    yLabel: "MWh/person",
  },
  {
    key: "electricity_per_capita_with_access",
    title: "Per Capita Demand (with access)",
    yLabel: "MWh/person",
  },
  {
    key: "energy_poverty_multidimensional",
    title: "Multidimensional Energy Poverty (%)",
    yLabel: "%",
  },
  {
    key: "carbon_intensity_elec",
    title: "Carbon Intensity of Electricity",
    yLabel: "MtCO₂e/TWh",
  },
] as const;
