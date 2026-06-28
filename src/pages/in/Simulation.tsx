import { useState } from "react";
import { Slider } from "../../components/inputs/Slider";
import { FilterField } from "../../components/inputs/FilterField";
import { FeedbackModal } from "../../components/modals/FeedbackModal";
import { ScenarioExplorerCharts } from "../../components/scenario/ScenarioExplorerCharts";
import {
  useGetAvailableCountriesQuery,
  useSimulateScenarioMutation,
} from "../../app/appSlices/apiSlice";
import { ButtonSpinner } from "../../components/utils/ButtonSpinner";
import type {
  CountryEnvelope,
  ScenarioMode,
  ScenarioParameters,
  ScenarioResult,
} from "../../types/scenarioExplorer";

const DEFAULT_PARAMS: ScenarioParameters = {
  renewable_target: 60,
  energy_access_target: 85,
  clean_cooking_target: 60,
  population_growth_rate: 0.02,
};

const MODE_OPTIONS: { value: ScenarioMode; label: string }[] = [
  { value: "explore", label: "Explore" },
  { value: "bau", label: "Business as usual" },
];

export const Simulation = () => {
  const [scenarioMode, setScenarioMode] = useState<ScenarioMode>("explore");
  const [scenarioParams, setScenarioParams] =
    useState<ScenarioParameters>(DEFAULT_PARAMS);
  const [scenarioCountry, setScenarioCountry] = useState("Algeria");
  const [scenarioStartYear, setScenarioStartYear] = useState(2025);
  const [scenarioEndYear, setScenarioEndYear] = useState(2050);
  const [hasSimulated, setHasSimulated] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [scenarioResult, setScenarioResult] = useState<ScenarioResult | null>(
    null,
  );
  const [envelopeCache, setEnvelopeCache] = useState<
    Record<string, CountryEnvelope>
  >({});
  const [feedbackModal, setFeedbackModal] = useState({
    isOpen: false,
    type: "info" as "error" | "warning" | "info" | "success",
    title: "",
    message: "",
    details: "",
  });

  const [simulateScenario] = useSimulateScenarioMutation();
  const { data: countriesData } = useGetAvailableCountriesQuery();
  const availableCountries = countriesData?.data || [];
  const envelope = envelopeCache[scenarioCountry];

  const applyEnvelopeDefaults = (country: string) => {
    const cached = envelopeCache[country]?.defaults;
    if (!cached) return;
    const d = cached as Partial<ScenarioParameters>;
    setScenarioParams((prev) => ({
      ...prev,
      ...(d.renewable_target != null && { renewable_target: d.renewable_target }),
      ...(d.energy_access_target != null && {
        energy_access_target: d.energy_access_target,
      }),
      ...(d.clean_cooking_target != null && {
        clean_cooking_target: d.clean_cooking_target,
      }),
      ...(d.population_growth_rate != null && {
        population_growth_rate: d.population_growth_rate,
      }),
    }));
  };

  const showPolicySliders = scenarioMode !== "bau";

  const sliderMax = (key: keyof ScenarioParameters, fallback: number) => {
    const bound = envelope?.slider_bounds?.[key]?.max;
    return bound != null ? Math.round(bound * 1000) / 10 : fallback;
  };

  const sliderMin = (key: keyof ScenarioParameters, fallback: number) => {
    const bound = envelope?.slider_bounds?.[key]?.min;
    return bound != null ? Math.round(bound * 1000) / 10 : fallback;
  };

  const handleSimulate = async () => {
    setIsSimulating(true);
    try {
      const result = await simulateScenario({
        policy_metrics: {
          renewable_target: scenarioParams.renewable_target,
          energy_access_target: scenarioParams.energy_access_target,
          clean_cooking_target: scenarioParams.clean_cooking_target,
          population_growth_rate: scenarioParams.population_growth_rate,
        },
        country: scenarioCountry,
        start_year: scenarioStartYear,
        target_year: scenarioEndYear,
        scenario_mode: scenarioMode,
      }).unwrap();

      if (result.success && result.data) {
        setScenarioResult(result.data);
        if (result.data.country_envelope) {
          setEnvelopeCache((prev) => ({
            ...prev,
            [scenarioCountry]: result.data.country_envelope,
          }));
        }
        setHasSimulated(true);
      } else {
        showFeedback(
          "error",
          result.error || "Scenario run failed",
          result.message ||
            "We couldn't run your scenario. Please check your parameters and try again.",
        );
      }
    } catch (error: any) {
      showFeedback(
        "error",
        error?.data?.error || "Scenario run failed",
        error?.data?.message ||
          error?.message ||
          "An error occurred while running the scenario.",
      );
    } finally {
      setIsSimulating(false);
    }
  };

  const showFeedback = (
    type: "error" | "warning" | "info" | "success",
    title: string,
    message: string,
    details?: string,
  ) => {
    setFeedbackModal({ isOpen: true, type, title, message, details: details || "" });
  };

  const formatPercentage = (value: number) => `${value.toFixed(1)}%`;
  const yearOptions = Array.from({ length: 76 }, (_, i) => 2025 + i);

  return (
    <div className="p-4 md:p-6 bg-grey-1 min-h-screen min-w-0 overflow-x-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-[1.5rem] md:text-[2rem] font-inter font-semibold text-black-1">
            Scenario Simulation
          </h1>
        </div>

        {!hasSimulated ? (
          <div className="space-y-4">
            <div className="bg-white-1 border border-grey-1 rounded-[8px] p-6 space-y-4">
              <div>
                <label className="text-[0.875rem] font-inter text-grey-2 mb-2 block">
                  Scenario mode
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {MODE_OPTIONS.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setScenarioMode(value)}
                      className={`text-left rounded-[8px] border px-4 py-3 transition-colors ${
                        scenarioMode === value
                          ? "border-blue-1 bg-blue-50"
                          : "border-grey-1 hover:border-grey-2"
                      }`}
                    >
                      <span className="block text-[0.9375rem] font-semibold text-black-1">
                        {label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FilterField
                  label="Country"
                  placeholder="Select country"
                  options={availableCountries}
                  selectedValue={scenarioCountry}
                  onValueChange={(value) => {
                    if (value && value !== scenarioCountry) {
                      setScenarioCountry(value);
                      applyEnvelopeDefaults(value);
                    }
                  }}
                />
                <FilterField
                  label="Start year"
                  placeholder="Select start year"
                  options={yearOptions.slice(0, 50).map(String)}
                  selectedValue={String(scenarioStartYear)}
                  onValueChange={(value) => {
                    if (value) {
                      const nextStart = Number(value);
                      setScenarioStartYear(nextStart);
                      if (scenarioEndYear < nextStart) {
                        setScenarioEndYear(nextStart);
                      }
                    }
                  }}
                />
                <FilterField
                  label="End year"
                  placeholder="Select end year"
                  options={yearOptions
                    .filter((y) => y >= scenarioStartYear)
                    .map(String)}
                  selectedValue={String(scenarioEndYear)}
                  onValueChange={(value) => {
                    if (value) setScenarioEndYear(Number(value));
                  }}
                />
              </div>
            </div>

            {showPolicySliders && (
              <div className="bg-white-1 border border-grey-1 rounded-[8px] p-6 space-y-4">
                <h3 className="text-[1.125rem] font-inter font-semibold text-black-1">
                  Assumptions
                </h3>
                <Slider
                      label={`Renewable electricity target (${scenarioEndYear})`}
                      value={scenarioParams.renewable_target}
                      min={0}
                      max={100}
                      step={1}
                      formatValue={formatPercentage}
                      onChange={(value) =>
                        setScenarioParams({ ...scenarioParams, renewable_target: value })
                      }
                    />
                    <Slider
                      label={`Electricity access target (${scenarioEndYear})`}
                      value={scenarioParams.energy_access_target}
                      min={0}
                      max={100}
                      step={1}
                      formatValue={formatPercentage}
                      onChange={(value) =>
                        setScenarioParams({
                          ...scenarioParams,
                          energy_access_target: value,
                        })
                      }
                    />
                    <Slider
                      label={`Clean cooking access target (${scenarioEndYear})`}
                      value={scenarioParams.clean_cooking_target}
                      min={0}
                      max={100}
                      step={1}
                      formatValue={formatPercentage}
                      onChange={(value) =>
                        setScenarioParams({
                          ...scenarioParams,
                          clean_cooking_target: value,
                        })
                      }
                    />
                {scenarioMode === "explore" && (
                  <Slider
                    label="Population growth rate"
                    value={scenarioParams.population_growth_rate * 100}
                    min={Math.max(0, sliderMin("population_growth_rate", 0))}
                    max={sliderMax("population_growth_rate", 5)}
                    step={0.1}
                    formatValue={(v) => `${v.toFixed(1)}%/yr`}
                    onChange={(value) =>
                      setScenarioParams({
                        ...scenarioParams,
                        population_growth_rate: value / 100,
                      })
                    }
                  />
                )}
              </div>
            )}

            <button
              type="button"
              onClick={handleSimulate}
              disabled={isSimulating}
              className="w-full border-2 border-dashed border-grey-2 rounded-[8px] p-12 flex flex-col items-center justify-center gap-4 hover:border-blue-1 hover:bg-blue-50 transition-colors disabled:opacity-50"
            >
              <p className="text-[1.125rem] font-inter font-semibold text-black-1 min-h-[1.75rem] flex items-center">
                {isSimulating ? (
                  <ButtonSpinner color="#1E3A8A" />
                ) : (
                  "Run scenario"
                )}
              </p>
            </button>
          </div>
        ) : (
          scenarioResult && (
            <div className="space-y-6">
              <div className="bg-white-1 border border-grey-1 rounded-lg p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-[1.25rem] md:text-[1.5rem] font-inter font-semibold text-black-1">
                    {scenarioCountry}: {scenarioResult.timeline.start_year} to{" "}
                    {scenarioResult.timeline.end_year}
                  </h2>
                  {scenarioResult.scenario_mode === "bau" && (
                    <p className="text-[0.875rem] text-grey-2 mt-1">
                      Business as usual
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setHasSimulated(false);
                    setScenarioResult(null);
                  }}
                  className="bg-yellow-1 text-blue-2 px-4 py-2 rounded-[8px] text-[0.875rem] font-medium shrink-0 self-start"
                >
                  New scenario
                </button>
              </div>

              {scenarioResult.warnings?.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-[8px] p-4">
                  <ul className="list-disc pl-5 text-[0.875rem] text-grey-2 space-y-1">
                    {scenarioResult.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="bg-white-1 border border-grey-1 rounded-[8px] p-6">
                <h3 className="text-[1.125rem] font-semibold text-black-1 mb-4">
                  Assumptions
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[0.875rem]">
                  {scenarioResult.scenario_mode !== "bau" && (
                    <>
                      <div className="bg-grey-1 rounded p-3">
                        <span className="text-grey-2">Renewable target</span>
                        <div className="font-semibold">
                          {scenarioParams.renewable_target.toFixed(1)}%
                        </div>
                      </div>
                      <div className="bg-grey-1 rounded p-3">
                        <span className="text-grey-2">Access target</span>
                        <div className="font-semibold">
                          {scenarioParams.energy_access_target.toFixed(1)}%
                        </div>
                      </div>
                      <div className="bg-grey-1 rounded p-3">
                        <span className="text-grey-2">Clean cooking target</span>
                        <div className="font-semibold">
                          {scenarioParams.clean_cooking_target.toFixed(1)}%
                        </div>
                      </div>
                    </>
                  )}
                  {scenarioResult.scenario_mode === "explore" && (
                    <div className="bg-grey-1 rounded p-3">
                      <span className="text-grey-2">Population growth</span>
                      <div className="font-semibold">
                        {(scenarioParams.population_growth_rate * 100).toFixed(1)}%/yr
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <ScenarioExplorerCharts result={scenarioResult} />
            </div>
          )
        )}

        <FeedbackModal
          isOpen={feedbackModal.isOpen}
          onClose={() => setFeedbackModal({ ...feedbackModal, isOpen: false })}
          type={feedbackModal.type}
          title={feedbackModal.title}
          message={feedbackModal.message}
          details={feedbackModal.details}
        />
      </div>
    </div>
  );
};
