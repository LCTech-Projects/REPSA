import { useState, useEffect, useRef } from "react";
import { MetricCard } from "../../components/cards/MetricCard";
import { ChartCard } from "../../components/cards/ChartCard";
import { Slider } from "../../components/inputs/Slider";
import { FeedbackModal } from "../../components/modals/FeedbackModal";
import { useSimulateScenarioMutation } from "../../app/appSlices/apiSlice";
import { useGetAvailableCountriesQuery } from "../../app/appSlices/apiSlice";
import * as d3 from "d3";
import { calculateYearTicks } from "../../components/utils/ChartUtils";
import { ButtonSpinner } from "../../components/Utils/ButtonSpinner";

// Scenario Builder Interfaces
interface ScenarioParameters {
  renewable_target: number; // %
  energy_access_target: number; // %
  clean_cooking_target: number; // %
  demand_growth_rate: number; // decimal
  population_growth_rate: number; // decimal (e.g., 0.02 for 2%)
  gdp_growth_rate: number; // decimal
}

// Story Mode Interfaces
interface ForecastData {
  year: number;
  value: number;
}

interface ScenarioResult {
  scenario_params?: Record<string, number>;
  policy_metrics?: Record<string, number>;
  forecasts: {
    renewable_share: ForecastData[];
    electricity_demand: ForecastData[];
    co2_emissions: ForecastData[];
    energy_poverty: ForecastData[];
    energy_poverty_multidimensional?: ForecastData[];
    electricity_per_capita: ForecastData[];
    electricity_per_capita_with_access: ForecastData[];
    clean_cooking_access: ForecastData[];
  };
  summary: {
    renewable_share: number;
    electricity_demand: number;
    co2_emissions: number;
    energy_poverty: number;
    electricity_per_capita?: number;
    electricity_per_capita_with_access?: number;
    co2_per_capita?: number;
  };
  timeline: {
    start_year: number;
    end_year: number;
  };
}

export const Simulation = () => {
  // Scenario Builder State
  const [scenarioParams, setScenarioParams] = useState<ScenarioParameters>({
    renewable_target: 60,
    energy_access_target: 85,
    clean_cooking_target: 60,
    demand_growth_rate: 0.03,
    population_growth_rate: 0.02,
    gdp_growth_rate: 0.04,
  });

  const [scenarioCountry, setScenarioCountry] = useState<string>("Algeria");
  const [scenarioStartYear, setScenarioStartYear] = useState<number>(2025);
  const [scenarioEndYear, setScenarioEndYear] = useState<number>(2050);
  const [isParametersExpanded, setIsParametersExpanded] = useState(true);
  const [hasSimulated, setHasSimulated] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [scenarioResult, setScenarioResult] = useState<ScenarioResult | null>(
    null,
  );

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

  // Chart refs (Yearly-style charts, excluding population)
  const electricityAccessChartRef = useRef<SVGSVGElement>(null);
  const electricityAccessChartContainerRef = useRef<HTMLDivElement>(null);
  const co2EmissionChartRef = useRef<SVGSVGElement>(null);
  const co2EmissionChartContainerRef = useRef<HTMLDivElement>(null);
  const cleanCookingChartRef = useRef<SVGSVGElement>(null);
  const cleanCookingChartContainerRef = useRef<HTMLDivElement>(null);
  const electricityPerCapitaChartRef = useRef<SVGSVGElement>(null);
  const electricityPerCapitaChartContainerRef = useRef<HTMLDivElement>(null);
  const energyPovertyComparisonChartRef = useRef<SVGSVGElement>(null);
  const energyPovertyComparisonChartContainerRef = useRef<HTMLDivElement>(null);
  const energyPovertyRuralUrbanChartRef = useRef<SVGSVGElement>(null);
  const energyPovertyRuralUrbanChartContainerRef = useRef<HTMLDivElement>(null);

  // Scenario Builder Icons
  const TargetIcon = () => (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="#1E3A8A"
        strokeWidth="2"
        fill="none"
      />
      <circle
        cx="12"
        cy="12"
        r="6"
        stroke="#1E3A8A"
        strokeWidth="2"
        fill="none"
      />
      <circle cx="12" cy="12" r="2" fill="#1E3A8A" />
    </svg>
  );

  const RenewableIcon = () => (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 2L2 7L12 12L22 7L12 2Z"
        stroke="#10B981"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M2 17L12 22L22 17"
        stroke="#10B981"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M2 12L12 17L22 12"
        stroke="#10B981"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  const EnergyAccessIcon = () => (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M13 2L3 14H12L11 22L21 10H12L13 2Z"
        stroke="#3B82F6"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  const CleanCookingIcon = () => (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 2C8 2 5 5 5 9C5 13 8 16 12 16C16 16 19 13 19 9C19 5 16 2 12 2Z"
        stroke="#10B981"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 6V10"
        stroke="#10B981"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 9L15 9"
        stroke="#10B981"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 16V22"
        stroke="#10B981"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  const PopulationIcon = () => (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M17 21V19C17 17.9391 16.5786 16.9217 15.8284 16.1716C15.0783 15.4214 14.0609 15 13 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21"
        stroke="#9333EA"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="9"
        cy="7"
        r="4"
        stroke="#9333EA"
        strokeWidth="2"
        fill="none"
      />
      <path
        d="M23 21V19C22.9993 18.1137 22.7044 17.2528 22.1614 16.5523C21.6184 15.8519 20.8581 15.3516 20 15.13"
        stroke="#9333EA"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 3.13C16.8604 3.35031 17.623 3.85071 18.1676 4.55232C18.7122 5.25392 19.0078 6.11683 19.0078 7.005C19.0078 7.89318 18.7122 8.75608 18.1676 9.45769C17.623 10.1593 16.8604 10.6597 16 10.88"
        stroke="#9333EA"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  // Scenario Builder Handlers
  const handleSimulate = async () => {
    setIsSimulating(true);
    try {
      const result = await simulateScenario({
        policy_metrics: {
          renewable_target: scenarioParams.renewable_target,
          energy_access_target: scenarioParams.energy_access_target,
          clean_cooking_target: scenarioParams.clean_cooking_target,
          demand_growth_rate: scenarioParams.demand_growth_rate,
          population_growth_rate: scenarioParams.population_growth_rate,
          gdp_growth_rate: scenarioParams.gdp_growth_rate,
        },
        country: scenarioCountry,
        start_year: scenarioStartYear,
        target_year: scenarioEndYear,
      }).unwrap();

      if (result.success && result.data) {
        setScenarioResult(result.data);
        setHasSimulated(true);
      } else {
        const errorTitle = result.error || "Simulation Failed";
        const errorMessage =
          result.message ||
          "We couldn't simulate your scenario. Please check your parameters and try again.";
        showFeedback("error", errorTitle, errorMessage);
      }
    } catch (error: any) {
      let errorTitle = "Simulation Failed";
      let errorMessage =
        "We encountered an issue while simulating your scenario.";

      if (error?.data) {
        errorTitle = error.data.error || "Simulation Error";
        errorMessage =
          error.data.message ||
          error.message ||
          "An error occurred during scenario simulation.";
      } else if (error?.message) {
        errorMessage = error.message;
      }

      showFeedback("error", errorTitle, errorMessage);
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
    setFeedbackModal({
      isOpen: true,
      type,
      title,
      message,
      details: details || "",
    });
  };

  const closeFeedback = () => {
    setFeedbackModal({
      isOpen: false,
      type: "info",
      title: "",
      message: "",
      details: "",
    });
  };

  const formatPercentage = (value: number) => `${value.toFixed(1)}%`;

  // Chart dimensions and rendering for scenario results
  // Set up chart dimensions observer
  const [chartDimensions, setChartDimensions] = useState<
    Record<string, { width: number; height: number }>
  >({});

  useEffect(() => {
    if (!scenarioResult) return;

    const containerRefs = {
      electricityAccess: electricityAccessChartContainerRef,
      co2Emission: co2EmissionChartContainerRef,
      cleanCooking: cleanCookingChartContainerRef,
      electricityPerCapita: electricityPerCapitaChartContainerRef,
      energyPovertyComparison: energyPovertyComparisonChartContainerRef,
      energyPovertyRuralUrban: energyPovertyRuralUrbanChartContainerRef,
    };

    const updateDimensions = () => {
      const newDimensions: Record<string, { width: number; height: number }> =
        {};

      Object.keys(containerRefs).forEach((key) => {
        const container =
          containerRefs[key as keyof typeof containerRefs].current;
        if (container) {
          const containerWidth = container.offsetWidth || 500;
          const width = Math.max(300, containerWidth - 32);
          const height = Math.max(200, width * 0.6);
          newDimensions[key] = { width, height };
        }
      });

      if (Object.keys(newDimensions).length > 0) {
        setChartDimensions(newDimensions);
      }
    };

    const timer = setTimeout(updateDimensions, 100);
    const resizeObserver = new ResizeObserver(updateDimensions);

    Object.values(containerRefs).forEach((ref) => {
      if (ref.current) {
        resizeObserver.observe(ref.current);
      }
    });

    window.addEventListener("resize", updateDimensions);

    return () => {
      clearTimeout(timer);
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateDimensions);
    };
  }, [scenarioResult]);

  useEffect(() => {
    if (!scenarioResult || Object.keys(chartDimensions).length === 0) return;

    const margin = { top: 30, right: 30, bottom: 60, left: 70 };

    // Transform forecast data to time_series format for compatibility with yearly chart logic
    const demandData = scenarioResult.forecasts.electricity_demand || [];
    const renewableData = scenarioResult.forecasts.renewable_share || [];
    const co2Data = scenarioResult.forecasts.co2_emissions || [];
    const povertyData = scenarioResult.forecasts.energy_poverty || [];
    const povertyMultiData =
      scenarioResult.forecasts.energy_poverty_multidimensional || [];
    const cleanCookingData = scenarioResult.forecasts.clean_cooking_access || [];
    const perCapitaData = scenarioResult.forecasts.electricity_per_capita || [];
    const perCapitaAccessData =
      scenarioResult.forecasts.electricity_per_capita_with_access || [];

    // Create time_series-like structure by merging all forecast data by year
    const allYears = new Set([
      ...demandData.map((d) => d.year),
      ...renewableData.map((d) => d.year),
      ...co2Data.map((d) => d.year),
      ...povertyData.map((d) => d.year),
      ...povertyMultiData.map((d) => d.year),
      ...cleanCookingData.map((d) => d.year),
      ...perCapitaData.map((d) => d.year),
      ...perCapitaAccessData.map((d) => d.year),
    ]);

    const timeSeries = Array.from(allYears)
      .sort((a, b) => a - b)
      .map((year) => ({
        cleanCookingAccess:
          cleanCookingData.find((d) => d.year === year)?.value || 0,
        electricityPoverty:
          povertyData.find((d) => d.year === year)?.value || 0,
        year,
        electricity_demand: demandData.find((d) => d.year === year)?.value || 0,
        electricity_generation:
          demandData.find((d) => d.year === year)?.value || 0, // Use demand as proxy for generation
        ghg_emissions_co2e: co2Data.find((d) => d.year === year)?.value || 0,
        energy_poverty: povertyData.find((d) => d.year === year)?.value || 0,
        clean_cooking_access:
          cleanCookingData.find((d) => d.year === year)?.value || 0,
        electricity_demand_per_capita:
          perCapitaData.find((d) => d.year === year)?.value || 0,
        electricity_demand_per_capita_with_access:
          perCapitaAccessData.find((d) => d.year === year)?.value || 0,
        energy_poverty_multidimensional:
          povertyMultiData.find((d) => d.year === year)?.value || 0,
        energy_poverty_rural: povertyData.find((d) => d.year === year)?.value
          ? povertyData.find((d) => d.year === year)!.value * 1.2
          : 0, // Estimate rural as 20% higher
        energy_poverty_urban: povertyData.find((d) => d.year === year)?.value
          ? povertyData.find((d) => d.year === year)!.value * 0.8
          : 0, // Estimate urban as 20% lower
      }));

    // Create or select tooltip div
    let tooltip = d3.select("body").select<HTMLDivElement>(".chart-tooltip");
    if (tooltip.empty()) {
      tooltip = d3
        .select("body")
        .append("div")
        .attr("class", "chart-tooltip")
        .style("position", "fixed")
        .style("background", "rgba(0, 0, 0, 0.8)")
        .style("color", "white")
        .style("padding", "8px 12px")
        .style("border-radius", "4px")
        .style("font-size", "12px")
        .style("pointer-events", "none")
        .style("opacity", 0)
        .style("z-index", "1000")
        .style("font-family", "Inter, sans-serif")
        .style("max-width", "280px")
        .style("word-wrap", "break-word");
    }

    const keepTooltipInViewport = () => {
      const node = tooltip.node();
      if (!node) return;

      const viewportRight = window.innerWidth;
      const viewportBottom = window.innerHeight;
      const padding = 10;
      const edgeBuffer = 24;

      let left = parseFloat(tooltip.style("left")) || padding;
      let top = parseFloat(tooltip.style("top")) || padding;
      // Mouse handlers still set pageX/pageY values; convert to viewport coords for fixed tooltips.
      const scrollX = window.scrollX || window.pageXOffset;
      const scrollY = window.scrollY || window.pageYOffset;
      if (left > viewportRight + padding) left -= scrollX;
      if (top > viewportBottom + padding) top -= scrollY;
      const width = node.offsetWidth;
      const height = node.offsetHeight;

      // Flip before reaching the right edge.
      if (left + width + edgeBuffer > viewportRight) {
        left = left - width - 28;
      }
      // Clamp to viewport.
      if (left < padding) left = padding;
      if (top + height + edgeBuffer > viewportBottom) {
        top = viewportBottom - height - padding;
      }
      if (top < padding) top = padding;

      tooltip.style("left", `${left}px`).style("top", `${top}px`);
    };

    const tooltipNode = tooltip.node();
    const tooltipObserver = tooltipNode
      ? new MutationObserver(() => {
          keepTooltipInViewport();
        })
      : null;
    if (tooltipObserver && tooltipNode) {
      tooltipObserver.observe(tooltipNode, {
        attributes: true,
        attributeFilter: ["style"],
        childList: true,
        subtree: true,
      });
    }

    const showTooltip = (event: MouseEvent, html: string) => {
      tooltip
        .html(html)
        .style("left", `${event.clientX + 14}px`)
        .style("top", `${event.clientY - 16}px`)
        .style("opacity", 1);
    };

    const hideTooltip = () => {
      tooltip.transition().duration(120).style("opacity", 0);
    };

    const addYearOverlayTooltip = (
      g: d3.Selection<SVGGElement, unknown, null, undefined>,
      chartWidth: number,
      chartHeight: number,
      x: d3.ScaleLinear<number, number>,
      rows: (typeof timeSeries)[0][],
      renderHtml: (d: (typeof timeSeries)[0]) => string,
    ) => {
      const sortedRows = [...rows].sort((a, b) => a.year - b.year);
      const bisect = d3.bisector<(typeof sortedRows)[0], number>((r) => r.year).left;

      g.append("rect")
        .attr("class", "tooltip-overlay")
        .attr("width", chartWidth)
        .attr("height", chartHeight)
        .attr("fill", "transparent")
        .style("pointer-events", "all")
        .on("mousemove", function (event) {
          const [mx] = d3.pointer(event, this as any);
          const targetYear = x.invert(mx);
          const i = Math.max(
            0,
            Math.min(sortedRows.length - 1, bisect(sortedRows, targetYear)),
          );
          const d0 = sortedRows[Math.max(0, i - 1)];
          const d1 = sortedRows[Math.min(sortedRows.length - 1, i)];
          const nearest =
            Math.abs(targetYear - d0.year) <= Math.abs(d1.year - targetYear)
              ? d0
              : d1;
          showTooltip(event as MouseEvent, renderHtml(nearest));
        })
        .on("mouseleave", hideTooltip);
    };

    const chartRefs = {
      electricityAccess: electricityAccessChartRef,
      co2Emission: co2EmissionChartRef,
      cleanCooking: cleanCookingChartRef,
      electricityPerCapita: electricityPerCapitaChartRef,
      energyPovertyComparison: energyPovertyComparisonChartRef,
      energyPovertyRuralUrban: energyPovertyRuralUrbanChartRef,
    };

    // Helper function to render a chart
    const renderChart = (
      chartKey: keyof typeof chartRefs,
      renderFn: (
        svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
        dims: { width: number; height: number },
      ) => void,
    ) => {
      const ref = chartRefs[chartKey];
      const containerRef =
        chartKey === "electricityAccess"
          ? electricityAccessChartContainerRef
          : chartKey === "co2Emission"
            ? co2EmissionChartContainerRef
            : chartKey === "cleanCooking"
              ? cleanCookingChartContainerRef
              : chartKey === "electricityPerCapita"
                ? electricityPerCapitaChartContainerRef
                : chartKey === "energyPovertyComparison"
                  ? energyPovertyComparisonChartContainerRef
                  : energyPovertyRuralUrbanChartContainerRef;

      if (!ref.current || !containerRef.current) return;

      const dims = chartDimensions[chartKey] || { width: 500, height: 300 };
      const svg = d3.select(ref.current);
      svg.selectAll("*").remove();
      svg
        .attr("width", dims.width)
        .attr("height", dims.height)
        .attr("viewBox", `0 0 ${dims.width} ${dims.height}`)
        .attr("preserveAspectRatio", "xMidYMid meet");

      renderFn(svg, dims);
    };

    // 1. Electricity Demand & Generation Chart
    renderChart("electricityAccess", (svg, dims) => {
      const chartWidth = dims.width - margin.left - margin.right;
      const chartHeight = dims.height - margin.top - margin.bottom;
      const g = svg
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

      const yearExtent = d3.extent(timeSeries, (d: any) => d.year) as [
        number | undefined,
        number | undefined,
      ];
      const x = d3
        .scaleLinear()
        .domain(
          yearExtent[0] !== undefined && yearExtent[1] !== undefined
            ? ([yearExtent[0], yearExtent[1]] as [number, number])
            : [0, 1],
        )
        .range([0, chartWidth]);

      const y = d3
        .scaleLinear()
        .domain([
          0,
          d3.max(timeSeries, (d: any) =>
            Math.max(d.electricity_demand || 0, d.electricity_generation || 0),
          ) || 0,
        ] as [number, number])
        .range([chartHeight, 0]);

      const demandLine = d3
        .line<(typeof timeSeries)[0]>()
        .x((d: any) => x(d.year))
        .y((d: any) => y(d.electricity_demand || 0))
        .curve(d3.curveMonotoneX);

      const generationLine = d3
        .line<(typeof timeSeries)[0]>()
        .x((d: any) => x(d.year))
        .y((d: any) => y(d.electricity_generation || 0))
        .curve(d3.curveMonotoneX);

      g.append("path")
        .datum(timeSeries)
        .attr("fill", "none")
        .attr("stroke", "#1E3A8A")
        .attr("stroke-width", 2)
        .attr("d", demandLine)
        .attr("stroke-dasharray", function () {
          const length = this.getTotalLength();
          return `${length} ${length}`;
        })
        .attr("stroke-dashoffset", function () {
          return this.getTotalLength();
        })
        .transition()
        .duration(1500)
        .ease(d3.easeCubicInOut)
        .attr("stroke-dashoffset", 0);

      g.append("path")
        .datum(timeSeries)
        .attr("fill", "none")
        .attr("stroke", "#10B981")
        .attr("stroke-width", 2)
        .attr("d", generationLine)
        .attr("stroke-dasharray", function () {
          const length = this.getTotalLength();
          return `${length} ${length}`;
        })
        .attr("stroke-dashoffset", function () {
          return this.getTotalLength();
        })
        .transition()
        .duration(1500)
        .delay(200)
        .ease(d3.easeCubicInOut)
        .attr("stroke-dashoffset", 0);

      // Calculate year ticks
      const years = timeSeries.map((d: any) => d.year);
      const { tickValues } = calculateYearTicks(years);

      const xAxis = g
        .append("g")
        .attr("transform", `translate(0,${chartHeight})`)
        .call(
          d3.axisBottom(x).tickValues(tickValues).tickFormat(d3.format("d")),
        );

      xAxis
        .selectAll("text")
        .style("text-anchor", "end")
        .attr("dx", "-.8em")
        .attr("dy", ".15em")
        .attr("transform", "rotate(-45)");

      g.append("g").call(d3.axisLeft(y));
      addYearOverlayTooltip(
        g,
        chartWidth,
        chartHeight,
        x,
        timeSeries,
        (d: any) =>
          `Year: ${d.year}<br/>Demand: ${(d.electricity_demand || 0).toFixed(2)} TWh<br/>Generation: ${(d.electricity_generation || 0).toFixed(2)} TWh`,
      );

      g.selectAll(".demand-circle")
        .data(
          timeSeries.filter(
            (d: any) =>
              d.electricity_demand !== null &&
              d.electricity_demand !== undefined,
          ),
        )
        .enter()
        .append("circle")
        .attr("class", "demand-circle")
        .attr("cx", (d: any) => x(d.year))
        .attr("cy", (d: any) => y(d.electricity_demand || 0))
        .attr("r", 4)
        .attr("fill", "#1E3A8A")
        .attr("opacity", 0)
        .style("cursor", "pointer")
        .on("mouseover", function (event, d: any) {
          tooltip.transition().duration(200).style("opacity", 1);
          tooltip
            .html(
              `Year: ${d.year}<br/>Demand: ${(d.electricity_demand || 0).toFixed(2)} TWh`,
            )
            .style("left", event.pageX + 10 + "px")
            .style("top", event.pageY - 10 + "px");
          d3.select(this).attr("r", 6).attr("opacity", 1);
        })
        .on("mouseout", function () {
          tooltip.transition().duration(200).style("opacity", 0);
          d3.select(this).attr("r", 4).attr("opacity", 0);
        });

      g.selectAll(".generation-circle")
        .data(
          timeSeries.filter(
            (d: any) =>
              d.electricity_generation !== null &&
              d.electricity_generation !== undefined,
          ),
        )
        .enter()
        .append("circle")
        .attr("class", "generation-circle")
        .attr("cx", (d: any) => x(d.year))
        .attr("cy", (d: any) => y(d.electricity_generation || 0))
        .attr("r", 4)
        .attr("fill", "#10B981")
        .attr("opacity", 0)
        .style("cursor", "pointer")
        .on("mouseover", function (event, d: any) {
          tooltip.transition().duration(200).style("opacity", 1);
          tooltip
            .html(
              `Year: ${d.year}<br/>Generation: ${(d.electricity_generation || 0).toFixed(2)} TWh`,
            )
            .style("left", event.pageX + 10 + "px")
            .style("top", event.pageY - 10 + "px");
          d3.select(this).attr("r", 6).attr("opacity", 1);
        })
        .on("mouseout", function () {
          tooltip.transition().duration(200).style("opacity", 0);
          d3.select(this).attr("r", 4).attr("opacity", 0);
        });
    });

    // 2. GHG Emissions Chart
    renderChart("co2Emission", (svg, dims) => {
      const chartWidth = dims.width - margin.left - margin.right;
      const chartHeight = dims.height - margin.top - margin.bottom;
      const g = svg
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

      const yearExtent = d3.extent(timeSeries, (d: any) => d.year) as [
        number | undefined,
        number | undefined,
      ];
      const x = d3
        .scaleLinear()
        .domain(
          yearExtent[0] !== undefined && yearExtent[1] !== undefined
            ? ([yearExtent[0], yearExtent[1]] as [number, number])
            : [0, 1],
        )
        .range([0, chartWidth]);

      const y = d3
        .scaleLinear()
        .domain([
          0,
          d3.max(timeSeries, (d: any) => d.ghg_emissions_co2e || 0) || 0,
        ] as [number, number])
        .range([chartHeight, 0]);

      const line = d3
        .line<(typeof timeSeries)[0]>()
        .x((d: any) => x(d.year))
        .y((d: any) => y(d.ghg_emissions_co2e || 0))
        .curve(d3.curveMonotoneX);

      g.append("path")
        .datum(timeSeries)
        .attr("fill", "none")
        .attr("stroke", "#DC2626")
        .attr("stroke-width", 2)
        .attr("d", line)
        .attr("stroke-dasharray", function () {
          const length = this.getTotalLength();
          return `${length} ${length}`;
        })
        .attr("stroke-dashoffset", function () {
          return this.getTotalLength();
        })
        .transition()
        .duration(1500)
        .ease(d3.easeCubicInOut)
        .attr("stroke-dashoffset", 0);

      // Calculate year ticks
      const years = timeSeries.map((d: any) => d.year);
      const { tickValues } = calculateYearTicks(years);

      const xAxis = g
        .append("g")
        .attr("transform", `translate(0,${chartHeight})`)
        .call(
          d3.axisBottom(x).tickValues(tickValues).tickFormat(d3.format("d")),
        );

      xAxis
        .selectAll("text")
        .style("text-anchor", "end")
        .attr("dx", "-.8em")
        .attr("dy", ".15em")
        .attr("transform", "rotate(-45)");

      g.append("g").call(d3.axisLeft(y));
      addYearOverlayTooltip(
        g,
        chartWidth,
        chartHeight,
        x,
        timeSeries,
        (d: any) =>
          `Year: ${d.year}<br/>GHG Emissions: ${(d.ghg_emissions_co2e || 0).toFixed(2)} MtCO₂e`,
      );

      g.selectAll(".co2-circle")
        .data(
          timeSeries.filter(
            (d: any) =>
              d.ghg_emissions_co2e !== null &&
              d.ghg_emissions_co2e !== undefined,
          ),
        )
        .enter()
        .append("circle")
        .attr("class", "co2-circle")
        .attr("cx", (d: any) => x(d.year))
        .attr("cy", (d: any) => y(d.ghg_emissions_co2e || 0))
        .attr("r", 4)
        .attr("fill", "#DC2626")
        .attr("opacity", 0)
        .style("cursor", "pointer")
        .on("mouseover", function (event, d: any) {
          tooltip.transition().duration(200).style("opacity", 1);
          tooltip
            .html(
              `Year: ${d.year}<br/>GHG Emissions: ${(d.ghg_emissions_co2e || 0).toFixed(2)} MtCO₂e`,
            )
            .style("left", event.pageX + 10 + "px")
            .style("top", event.pageY - 10 + "px");
          d3.select(this).attr("r", 6).attr("opacity", 1);
        })
        .on("mouseout", function () {
          tooltip.transition().duration(200).style("opacity", 0);
          d3.select(this).attr("r", 4).attr("opacity", 0);
        });
    });

    // 3. Clean Cooking Access Chart (Line Chart)
    renderChart("cleanCooking", (svg, dims) => {
      const chartWidth = dims.width - margin.left - margin.right;
      const chartHeight = dims.height - margin.top - margin.bottom;
      const g = svg
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

      const yearExtent = d3.extent(timeSeries, (d: any) => d.year) as [
        number | undefined,
        number | undefined,
      ];
      const x = d3
        .scaleLinear()
        .domain(
          yearExtent[0] !== undefined && yearExtent[1] !== undefined
            ? ([yearExtent[0], yearExtent[1]] as [number, number])
            : [0, 1],
        )
        .range([0, chartWidth]);

      const y = d3
        .scaleLinear()
        .domain([0, 100] as [number, number])
        .range([chartHeight, 0]);

      const line = d3
        .line<(typeof timeSeries)[0]>()
        .x((d: any) => x(d.year))
        .y((d: any) => y(d.clean_cooking_access || 0))
        .curve(d3.curveMonotoneX);

      g.append("path")
        .datum(timeSeries)
        .attr("fill", "none")
        .attr("stroke", "#10B981")
        .attr("stroke-width", 2)
        .attr("d", line)
        .attr("stroke-dasharray", function () {
          const length = this.getTotalLength();
          return `${length} ${length}`;
        })
        .attr("stroke-dashoffset", function () {
          return this.getTotalLength();
        })
        .transition()
        .duration(1500)
        .ease(d3.easeCubicInOut)
        .attr("stroke-dashoffset", 0);

      // Calculate year ticks
      const years = timeSeries.map((d: any) => d.year);
      const { tickValues } = calculateYearTicks(years);

      const xAxis = g
        .append("g")
        .attr("transform", `translate(0,${chartHeight})`)
        .call(
          d3.axisBottom(x).tickValues(tickValues).tickFormat(d3.format("d")),
        );

      xAxis
        .selectAll("text")
        .style("text-anchor", "end")
        .attr("dx", "-.8em")
        .attr("dy", ".15em")
        .attr("transform", "rotate(-45)");

      g.append("g").call(d3.axisLeft(y));
      addYearOverlayTooltip(
        g,
        chartWidth,
        chartHeight,
        x,
        timeSeries,
        (d: any) =>
          `Year: ${d.year}<br/>Clean Cooking Access: ${(d.clean_cooking_access || 0).toFixed(1)}%`,
      );

      g.selectAll(".clean-cooking-circle")
        .data(
          timeSeries.filter(
            (d: any) =>
              d.clean_cooking_access !== null &&
              d.clean_cooking_access !== undefined,
          ),
        )
        .enter()
        .append("circle")
        .attr("class", "clean-cooking-circle")
        .attr("cx", (d: any) => x(d.year))
        .attr("cy", (d: any) => y(d.clean_cooking_access || 0))
        .attr("r", 4)
        .attr("fill", "#10B981")
        .attr("opacity", 0)
        .style("cursor", "pointer")
        .on("mouseover", function (event, d: any) {
          tooltip.transition().duration(200).style("opacity", 1);
          tooltip
            .html(
              `Year: ${d.year}<br/>Clean Cooking Access: ${(d.clean_cooking_access || 0).toFixed(1)}%`,
            )
            .style("left", event.pageX + 10 + "px")
            .style("top", event.pageY - 10 + "px");
          d3.select(this).attr("r", 6).attr("opacity", 1);
        })
        .on("mouseout", function () {
          tooltip.transition().duration(200).style("opacity", 0);
          d3.select(this).attr("r", 4).attr("opacity", 0);
        });
    });

    // 4. Electricity Per Capita Chart
    renderChart("electricityPerCapita", (svg, dims) => {
      const chartWidth = dims.width - margin.left - margin.right;
      const chartHeight = dims.height - margin.top - margin.bottom;
      const g = svg
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

      const yearExtent = d3.extent(timeSeries, (d: any) => d.year) as [
        number | undefined,
        number | undefined,
      ];
      const x = d3
        .scaleLinear()
        .domain(
          yearExtent[0] !== undefined && yearExtent[1] !== undefined
            ? ([yearExtent[0], yearExtent[1]] as [number, number])
            : [0, 1],
        )
        .range([0, chartWidth]);

      const y = d3
        .scaleLinear()
        .domain([
          0,
          d3.max(timeSeries, (d: any) =>
            Math.max(
              d.electricity_demand_per_capita || 0,
              d.electricity_demand_per_capita_with_access || 0,
            ),
          ) || 0,
        ] as [number, number])
        .range([chartHeight, 0]);

      const perCapitaLine = d3
        .line<(typeof timeSeries)[0]>()
        .x((d: any) => x(d.year))
        .y((d: any) => y(d.electricity_demand_per_capita || 0))
        .curve(d3.curveMonotoneX);

      const withAccessLine = d3
        .line<(typeof timeSeries)[0]>()
        .x((d: any) => x(d.year))
        .y((d: any) => y(d.electricity_demand_per_capita_with_access || 0))
        .curve(d3.curveMonotoneX);

      g.append("path")
        .datum(timeSeries)
        .attr("fill", "none")
        .attr("stroke", "#9333EA")
        .attr("stroke-width", 2)
        .attr("d", perCapitaLine)
        .attr("stroke-dasharray", function () {
          const length = this.getTotalLength();
          return `${length} ${length}`;
        })
        .attr("stroke-dashoffset", function () {
          return this.getTotalLength();
        })
        .transition()
        .duration(1500)
        .ease(d3.easeCubicInOut)
        .attr("stroke-dashoffset", 0);

      g.append("path")
        .datum(timeSeries)
        .attr("fill", "none")
        .attr("stroke", "#1E3A8A")
        .attr("stroke-width", 2)
        .attr("d", withAccessLine)
        .attr("stroke-dasharray", function () {
          const length = this.getTotalLength();
          return `${length} ${length}`;
        })
        .attr("stroke-dashoffset", function () {
          return this.getTotalLength();
        })
        .transition()
        .duration(1500)
        .delay(200)
        .ease(d3.easeCubicInOut)
        .attr("stroke-dashoffset", 0);

      // Calculate year ticks
      const years = timeSeries.map((d: any) => d.year);
      const { tickValues } = calculateYearTicks(years);

      const xAxis = g
        .append("g")
        .attr("transform", `translate(0,${chartHeight})`)
        .call(
          d3.axisBottom(x).tickValues(tickValues).tickFormat(d3.format("d")),
        );

      xAxis
        .selectAll("text")
        .style("text-anchor", "end")
        .attr("dx", "-.8em")
        .attr("dy", ".15em")
        .attr("transform", "rotate(-45)");

      g.append("g").call(d3.axisLeft(y));
      addYearOverlayTooltip(
        g,
        chartWidth,
        chartHeight,
        x,
        timeSeries,
        (d: any) =>
          `Year: ${d.year}<br/>Per Capita: ${(d.electricity_demand_per_capita || 0).toFixed(3)} MWh<br/>Per Capita (with Access): ${(d.electricity_demand_per_capita_with_access || 0).toFixed(3)} MWh`,
      );

      g.selectAll(".per-capita-circle")
        .data(
          timeSeries.filter(
            (d: any) =>
              d.electricity_demand_per_capita !== null &&
              d.electricity_demand_per_capita !== undefined,
          ),
        )
        .enter()
        .append("circle")
        .attr("class", "per-capita-circle")
        .attr("cx", (d: any) => x(d.year))
        .attr("cy", (d: any) => y(d.electricity_demand_per_capita || 0))
        .attr("r", 4)
        .attr("fill", "#9333EA")
        .attr("opacity", 0)
        .style("cursor", "pointer")
        .on("mouseover", function (event, d: any) {
          tooltip.transition().duration(200).style("opacity", 1);
          tooltip
            .html(
              `Year: ${d.year}<br/>Per Capita: ${(d.electricity_demand_per_capita || 0).toFixed(3)} MWh`,
            )
            .style("left", event.pageX + 10 + "px")
            .style("top", event.pageY - 10 + "px");
          d3.select(this).attr("r", 6).attr("opacity", 1);
        })
        .on("mouseout", function () {
          tooltip.transition().duration(200).style("opacity", 0);
          d3.select(this).attr("r", 4).attr("opacity", 0);
        });

      g.selectAll(".with-access-circle")
        .data(
          timeSeries.filter(
            (d: any) =>
              d.electricity_demand_per_capita_with_access !== null &&
              d.electricity_demand_per_capita_with_access !== undefined,
          ),
        )
        .enter()
        .append("circle")
        .attr("class", "with-access-circle")
        .attr("cx", (d: any) => x(d.year))
        .attr("cy", (d: any) =>
          y(d.electricity_demand_per_capita_with_access || 0),
        )
        .attr("r", 4)
        .attr("fill", "#1E3A8A")
        .attr("opacity", 0)
        .style("cursor", "pointer")
        .on("mouseover", function (event, d: any) {
          tooltip.transition().duration(200).style("opacity", 1);
          tooltip
            .html(
              `Year: ${d.year}<br/>Per Capita (with Access): ${(d.electricity_demand_per_capita_with_access || 0).toFixed(3)} MWh`,
            )
            .style("left", event.pageX + 10 + "px")
            .style("top", event.pageY - 10 + "px");
          d3.select(this).attr("r", 6).attr("opacity", 1);
        })
        .on("mouseout", function () {
          tooltip.transition().duration(200).style("opacity", 0);
          d3.select(this).attr("r", 4).attr("opacity", 0);
        });
    });

    // 5. Energy Poverty Chart
    renderChart("energyPovertyComparison", (svg, dims) => {
      const chartWidth = dims.width - margin.left - margin.right;
      const chartHeight = dims.height - margin.top - margin.bottom;
      const g = svg
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

      const yearExtent = d3.extent(timeSeries, (d: any) => d.year) as [
        number | undefined,
        number | undefined,
      ];
      const x = d3
        .scaleLinear()
        .domain(
          yearExtent[0] !== undefined && yearExtent[1] !== undefined
            ? ([yearExtent[0], yearExtent[1]] as [number, number])
            : [0, 1],
        )
        .range([0, chartWidth]);

      const maxValue =
        d3.max(timeSeries, (d: any) =>
          Math.max(
            d.energy_poverty || 0,
            d.energy_poverty_multidimensional || 0,
          ),
        ) || 0;

      const yMax = maxValue > 0 ? Math.max(5, maxValue * 1.15) : 5;

      const y = d3.scaleLinear().domain([0, yMax]).range([chartHeight, 0]);

      const electricityLine = d3
        .line<(typeof timeSeries)[0]>()
        .x((d: any) => x(d.year))
        .y((d: any) => y(d.energy_poverty || 0))
        .defined(
          (d: any) =>
            d.energy_poverty !== null && d.energy_poverty !== undefined,
        )
        .curve(d3.curveMonotoneX);

      const multidimensionalLine = d3
        .line<(typeof timeSeries)[0]>()
        .x((d: any) => x(d.year))
        .y((d: any) => y(d.energy_poverty_multidimensional || 0))
        .defined(
          (d: any) =>
            d.energy_poverty_multidimensional !== null &&
            d.energy_poverty_multidimensional !== undefined,
        )
        .curve(d3.curveMonotoneX);

      g.append("path")
        .datum(timeSeries)
        .attr("fill", "none")
        .attr("stroke", "#9333EA")
        .attr("stroke-width", 2)
        .attr("opacity", 0.75)
        .attr("d", multidimensionalLine)
        .attr("stroke-dasharray", function () {
          const length = this.getTotalLength();
          return `${length} ${length}`;
        })
        .attr("stroke-dashoffset", function () {
          return this.getTotalLength();
        })
        .transition()
        .duration(1500)
        .ease(d3.easeCubicInOut)
        .attr("stroke-dashoffset", 0);

      g.append("path")
        .datum(timeSeries)
        .attr("fill", "none")
        .attr("stroke", "#DC2626")
        .attr("stroke-width", 2.5)
        .attr("d", electricityLine)
        .attr("stroke-dasharray", function () {
          const length = this.getTotalLength();
          return `${length} ${length}`;
        })
        .attr("stroke-dashoffset", function () {
          return this.getTotalLength();
        })
        .transition()
        .duration(1500)
        .delay(200)
        .ease(d3.easeCubicInOut)
        .attr("stroke-dashoffset", 0);

      // Calculate year ticks
      const years = timeSeries.map((d: any) => d.year);
      const { tickValues } = calculateYearTicks(years);

      const xAxis = g
        .append("g")
        .attr("transform", `translate(0,${chartHeight})`)
        .call(
          d3.axisBottom(x).tickValues(tickValues).tickFormat(d3.format("d")),
        );

      xAxis
        .selectAll("text")
        .style("text-anchor", "end")
        .attr("dx", "-.8em")
        .attr("dy", ".15em")
        .attr("transform", "rotate(-45)");

      g.append("g").call(d3.axisLeft(y));
      addYearOverlayTooltip(
        g,
        chartWidth,
        chartHeight,
        x,
        timeSeries,
        (d: any) =>
          `Year: ${d.year}<br/>Electricity: ${(d.energy_poverty || 0).toFixed(1)}%<br/>Multidimensional: ${(d.energy_poverty_multidimensional || 0).toFixed(1)}%`,
      );

      g.selectAll(".ep-electricity-circle")
        .data(
          timeSeries.filter(
            (d: any) =>
              d.energy_poverty !== null && d.energy_poverty !== undefined,
          ),
        )
        .enter()
        .append("circle")
        .attr("class", "ep-electricity-circle")
        .attr("cx", (d: any) => x(d.year))
        .attr("cy", (d: any) => y(d.energy_poverty || 0))
        .attr("r", 4)
        .attr("fill", "#DC2626")
        .attr("opacity", 0)
        .style("cursor", "pointer")
        .on("mouseover", function (event, d: any) {
          tooltip.transition().duration(200).style("opacity", 1);
          tooltip
            .html(
              `Year: ${d.year}<br/>Electricity: ${(d.energy_poverty || 0).toFixed(1)}%`,
            )
            .style("left", event.pageX + 10 + "px")
            .style("top", event.pageY - 10 + "px");
          d3.select(this).attr("r", 6).attr("opacity", 1);
        })
        .on("mouseout", function () {
          tooltip.transition().duration(200).style("opacity", 0);
          d3.select(this).attr("r", 4).attr("opacity", 0);
        });

      g.selectAll(".ep-multidimensional-circle")
        .data(
          timeSeries.filter(
            (d: any) =>
              d.energy_poverty_multidimensional !== null &&
              d.energy_poverty_multidimensional !== undefined,
          ),
        )
        .enter()
        .append("circle")
        .attr("class", "ep-multidimensional-circle")
        .attr("cx", (d: any) => x(d.year))
        .attr("cy", (d: any) => y(d.energy_poverty_multidimensional || 0))
        .attr("r", 4)
        .attr("fill", "#9333EA")
        .attr("opacity", 0)
        .style("cursor", "pointer")
        .on("mouseover", function (event, d: any) {
          tooltip.transition().duration(200).style("opacity", 1);
          tooltip
            .html(
              `Year: ${d.year}<br/>Multidimensional: ${(d.energy_poverty_multidimensional || 0).toFixed(1)}%`,
            )
            .style("left", event.pageX + 10 + "px")
            .style("top", event.pageY - 10 + "px");
          d3.select(this).attr("r", 6).attr("opacity", 1);
        })
        .on("mouseout", function () {
          tooltip.transition().duration(200).style("opacity", 0);
          d3.select(this).attr("r", 4).attr("opacity", 0);
        });
    });

    // 7. Energy Poverty Rural vs Urban Chart
    renderChart("energyPovertyRuralUrban", (svg, dims) => {
      const chartWidth = dims.width - margin.left - margin.right;
      const chartHeight = dims.height - margin.top - margin.bottom;
      const g = svg
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

      const yearExtent = d3.extent(timeSeries, (d: any) => d.year) as [
        number | undefined,
        number | undefined,
      ];
      const x = d3
        .scaleLinear()
        .domain(
          yearExtent[0] !== undefined && yearExtent[1] !== undefined
            ? ([yearExtent[0], yearExtent[1]] as [number, number])
            : [0, 1],
        )
        .range([0, chartWidth]);

      const maxValue =
        d3.max(timeSeries, (d: any) =>
          Math.max(d.energy_poverty_rural || 0, d.energy_poverty_urban || 0),
        ) || 100;

      const y = d3
        .scaleLinear()
        .domain([0, Math.max(100, maxValue)])
        .range([chartHeight, 0]);

      const ruralLine = d3
        .line<(typeof timeSeries)[0]>()
        .x((d: any) => x(d.year))
        .y((d: any) => y(d.energy_poverty_rural || 0))
        .defined(
          (d: any) =>
            d.energy_poverty_rural !== null &&
            d.energy_poverty_rural !== undefined,
        )
        .curve(d3.curveMonotoneX);

      const urbanLine = d3
        .line<(typeof timeSeries)[0]>()
        .x((d: any) => x(d.year))
        .y((d: any) => y(d.energy_poverty_urban || 0))
        .defined(
          (d: any) =>
            d.energy_poverty_urban !== null &&
            d.energy_poverty_urban !== undefined,
        )
        .curve(d3.curveMonotoneX);

      g.append("path")
        .datum(timeSeries)
        .attr("fill", "none")
        .attr("stroke", "#F97316")
        .attr("stroke-width", 2)
        .attr("d", ruralLine)
        .attr("stroke-dasharray", function () {
          const length = this.getTotalLength();
          return `${length} ${length}`;
        })
        .attr("stroke-dashoffset", function () {
          return this.getTotalLength();
        })
        .transition()
        .duration(1500)
        .ease(d3.easeCubicInOut)
        .attr("stroke-dashoffset", 0);

      g.append("path")
        .datum(timeSeries)
        .attr("fill", "none")
        .attr("stroke", "#10B981")
        .attr("stroke-width", 2)
        .attr("d", urbanLine)
        .attr("stroke-dasharray", function () {
          const length = this.getTotalLength();
          return `${length} ${length}`;
        })
        .attr("stroke-dashoffset", function () {
          return this.getTotalLength();
        })
        .transition()
        .duration(1500)
        .delay(200)
        .ease(d3.easeCubicInOut)
        .attr("stroke-dashoffset", 0);

      // Calculate year ticks
      const years = timeSeries.map((d: any) => d.year);
      const { tickValues } = calculateYearTicks(years);

      const xAxis = g
        .append("g")
        .attr("transform", `translate(0,${chartHeight})`)
        .call(
          d3.axisBottom(x).tickValues(tickValues).tickFormat(d3.format("d")),
        );

      xAxis
        .selectAll("text")
        .style("text-anchor", "end")
        .attr("dx", "-.8em")
        .attr("dy", ".15em")
        .attr("transform", "rotate(-45)");

      g.append("g").call(d3.axisLeft(y));
      addYearOverlayTooltip(
        g,
        chartWidth,
        chartHeight,
        x,
        timeSeries,
        (d: any) =>
          `Year: ${d.year}<br/>Rural: ${(d.energy_poverty_rural || 0).toFixed(1)}%<br/>Urban: ${(d.energy_poverty_urban || 0).toFixed(1)}%`,
      );

      g.selectAll(".ep-rural-circle")
        .data(
          timeSeries.filter(
            (d: any) =>
              d.energy_poverty_rural !== null &&
              d.energy_poverty_rural !== undefined,
          ),
        )
        .enter()
        .append("circle")
        .attr("class", "ep-rural-circle")
        .attr("cx", (d: any) => x(d.year))
        .attr("cy", (d: any) => y(d.energy_poverty_rural || 0))
        .attr("r", 4)
        .attr("fill", "#F97316")
        .attr("opacity", 0)
        .style("cursor", "pointer")
        .on("mouseover", function (event, d: any) {
          tooltip.transition().duration(200).style("opacity", 1);
          tooltip
            .html(
              `Year: ${d.year}<br/>Rural: ${(d.energy_poverty_rural || 0).toFixed(1)}%`,
            )
            .style("left", event.pageX + 10 + "px")
            .style("top", event.pageY - 10 + "px");
          d3.select(this).attr("r", 6).attr("opacity", 1);
        })
        .on("mouseout", function () {
          tooltip.transition().duration(200).style("opacity", 0);
          d3.select(this).attr("r", 4).attr("opacity", 0);
        });

      g.selectAll(".ep-urban-circle")
        .data(
          timeSeries.filter(
            (d: any) =>
              d.energy_poverty_urban !== null &&
              d.energy_poverty_urban !== undefined,
          ),
        )
        .enter()
        .append("circle")
        .attr("class", "ep-urban-circle")
        .attr("cx", (d: any) => x(d.year))
        .attr("cy", (d: any) => y(d.energy_poverty_urban || 0))
        .attr("r", 4)
        .attr("fill", "#10B981")
        .attr("opacity", 0)
        .style("cursor", "pointer")
        .on("mouseover", function (event, d: any) {
          tooltip.transition().duration(200).style("opacity", 1);
          tooltip
            .html(
              `Year: ${d.year}<br/>Urban: ${(d.energy_poverty_urban || 0).toFixed(1)}%`,
            )
            .style("left", event.pageX + 10 + "px")
            .style("top", event.pageY - 10 + "px");
          d3.select(this).attr("r", 6).attr("opacity", 1);
        })
        .on("mouseout", function () {
          tooltip.transition().duration(200).style("opacity", 0);
          d3.select(this).attr("r", 4).attr("opacity", 0);
        });
    });

    // Cleanup tooltip on unmount
    return () => {
      if (tooltipObserver) tooltipObserver.disconnect();
      d3.select("body").select(".chart-tooltip").remove();
    };
  }, [scenarioResult, chartDimensions]);

  const yearOptions = Array.from({ length: 76 }, (_, i) => 2025 + i);

  return (
    <div className="p-6 bg-grey-1 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-[2rem] font-inter font-semibold text-black-1 mb-2">
            Scenario Simulation Lab
          </h1>
          <p className="text-[1rem] font-inter text-grey-2">
            Explore future energy pathways with real-time analytics and
            data-powered insights that adapt as you configure your scenarios.
          </p>
        </div>

        {/* Scenario Builder Content */}
                    {!hasSimulated ? (
              <div className="space-y-4">
                {/* Country and Timeline Selection */}
                <div className="bg-white-1 border border-grey-1 rounded-[8px] p-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-[0.875rem] font-inter text-grey-2 mb-2 block">
                        Country
                      </label>
                      <select
                        value={scenarioCountry}
                        onChange={(e) => setScenarioCountry(e.target.value)}
                        className="w-full bg-white-1 border border-grey-1 rounded-[8px] px-4 py-3 text-[0.875rem] font-inter text-black-1 hover:border-grey-2 transition-colors"
                      >
                        {availableCountries.map((country: string) => (
                          <option key={country} value={country}>
                            {country}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[0.875rem] font-inter text-grey-2 mb-2 block">
                        Start Year
                      </label>
                      <select
                        value={scenarioStartYear}
                        onChange={(e) =>
                          setScenarioStartYear(Number(e.target.value))
                        }
                        className="w-full bg-white-1 border border-grey-1 rounded-[8px] px-4 py-3 text-[0.875rem] font-inter text-black-1 hover:border-grey-2 transition-colors"
                      >
                        {yearOptions.slice(0, 50).map((year) => (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[0.875rem] font-inter text-grey-2 mb-2 block">
                        End Year
                      </label>
                      <select
                        value={scenarioEndYear}
                        onChange={(e) =>
                          setScenarioEndYear(Number(e.target.value))
                        }
                        className="w-full bg-white-1 border border-grey-1 rounded-[8px] px-4 py-3 text-[0.875rem] font-inter text-black-1 hover:border-grey-2 transition-colors"
                      >
                        {yearOptions
                          .filter((y) => y >= scenarioStartYear)
                          .map((year) => (
                            <option key={year} value={year}>
                              {year}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Scenario Parameters Section */}
                <div className="bg-white-1 border border-grey-1 rounded-[8px] overflow-hidden">
                  <button
                    onClick={() =>
                      setIsParametersExpanded(!isParametersExpanded)
                    }
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-grey-1 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <TargetIcon />
                      <span className="text-[1.125rem] font-inter font-semibold text-black-1">
                        Scenario Parameters
                      </span>
                    </div>
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 20 20"
                      fill="none"
                      className={`transition-transform ${isParametersExpanded ? "rotate-180" : ""}`}
                    >
                      <path
                        d="M5 7.5L10 12.5L15 7.5"
                        stroke="#666"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                  {isParametersExpanded && (
                    <div className="px-6 py-4 border-t border-grey-1 space-y-4">
                      <Slider
                        label="Renewable Energy Target"
                        icon={<RenewableIcon />}
                        value={scenarioParams.renewable_target}
                        min={0}
                        max={100}
                        step={1}
                        formatValue={formatPercentage}
                        onChange={(value) =>
                          setScenarioParams({
                            ...scenarioParams,
                            renewable_target: value,
                          })
                        }
                      />
                      <Slider
                        label="Electricity Access Target"
                        icon={<EnergyAccessIcon />}
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
                        label="Clean Cooking Access Target"
                        icon={<CleanCookingIcon />}
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
                      <Slider
                        label="Electricity Demand Growth"
                        icon={<TargetIcon />}
                        value={scenarioParams.demand_growth_rate * 100}
                        min={-2}
                        max={8}
                        step={0.1}
                        formatValue={(v) => `${v.toFixed(1)}%/yr`}
                        onChange={(value) =>
                          setScenarioParams({
                            ...scenarioParams,
                            demand_growth_rate: value / 100,
                          })
                        }
                      />
                      <Slider
                        label="Population Growth Rate"
                        icon={<PopulationIcon />}
                        value={scenarioParams.population_growth_rate * 100}
                        min={0}
                        max={5}
                        step={0.1}
                        formatValue={(v) => `${v.toFixed(1)}%`}
                        onChange={(value) =>
                          setScenarioParams({
                            ...scenarioParams,
                            population_growth_rate: value / 100,
                          })
                        }
                      />
                      <Slider
                        label="GDP Growth Rate"
                        icon={<TargetIcon />}
                        value={scenarioParams.gdp_growth_rate * 100}
                        min={-2}
                        max={10}
                        step={0.1}
                        formatValue={(v) => `${v.toFixed(1)}%/yr`}
                        onChange={(value) =>
                          setScenarioParams({
                            ...scenarioParams,
                            gdp_growth_rate: value / 100,
                          })
                        }
                      />
                    </div>
                  )}
                </div>

                {/* Ready to Simulate */}
                <button
                  onClick={handleSimulate}
                  disabled={isSimulating}
                  className="w-full border-2 border-dashed border-grey-2 rounded-[8px] p-12 flex flex-col items-center justify-center gap-4 hover:border-blue-1 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg
                    width="40"
                    height="40"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="text-blue-1"
                  >
                    <path
                      d="M13 2L3 14H12L11 22L21 10H12L13 2Z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <div className="text-center">
                    <p className="text-[1.125rem] font-inter font-semibold text-black-1 mb-1 flex items-center justify-center min-h-[1.75rem]">
                      {isSimulating ? (
                        <ButtonSpinner color="#1E3A8A" />
                      ) : (
                        "Ready to simulate"
                      )}
                    </p>
                    <p className="text-[0.875rem] font-inter text-grey-2">
                      Configure your scenario parameters and generate forecasts
                    </p>
                  </div>
                </button>
              </div>
            ) : (
              scenarioResult && (
                <div className="space-y-6">
                  {/* Overview Metrics */}
                  <div className="bg-white-1 border border-grey-1 rounded-lg p-6 flex items-center justify-between">
                    <h2 className="text-[1.5rem] font-inter font-semibold text-black-1">
                      Forecast Overview: {scenarioCountry} (
                      {scenarioResult.timeline.start_year} -{" "}
                      {scenarioResult.timeline.end_year})
                    </h2>
                    <button
                      onClick={() => {
                        setHasSimulated(false);
                        setScenarioResult(null);
                      }}
                      className="bg-yellow-1 text-blue-2 px-4 py-2 rounded-[8px] text-[0.875rem] font-inter font-medium hover:bg-yellow-200 transition-colors"
                    >
                      New Simulation
                    </button>
                  </div>

                  {/* Charts */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <ChartCard title="Electricity Demand (TWh)">
                      <div
                        ref={electricityAccessChartContainerRef}
                        className="w-full"
                      >
                        <svg
                          ref={electricityAccessChartRef}
                          className="w-full h-auto"
                        ></svg>
                      </div>
                      <div className="flex gap-4 mt-2 text-[0.75rem] font-inter">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-blue-1"></div>
                          <span className="text-grey-2">Demand</span>
                        </div>
                      </div>
                    </ChartCard>

                    <ChartCard title="Electricity Demand Per Capita (MWh/person)">
                      <div
                        ref={electricityPerCapitaChartContainerRef}
                        className="w-full"
                      >
                        <svg
                          ref={electricityPerCapitaChartRef}
                          className="w-full h-auto"
                        ></svg>
                      </div>
                      <div className="flex gap-4 mt-2 text-[0.75rem] font-inter">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3"
                            style={{ backgroundColor: "#9333EA" }}
                          ></div>
                          <span className="text-grey-2">Per capita</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-blue-1"></div>
                          <span className="text-grey-2">
                            Per capita (with Access)
                          </span>
                        </div>
                      </div>
                    </ChartCard>

                    <ChartCard title="Energy Poverty (%)">
                      <div
                        ref={energyPovertyComparisonChartContainerRef}
                        className="w-full"
                      >
                        <svg
                          ref={energyPovertyComparisonChartRef}
                          className="w-full h-auto"
                        ></svg>
                      </div>
                      <div className="flex gap-4 mt-2 text-[0.75rem] font-inter">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3"
                            style={{ backgroundColor: "#DC2626" }}
                          ></div>
                          <span className="text-grey-2">Electricity</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3"
                            style={{ backgroundColor: "#9333EA" }}
                          ></div>
                          <span className="text-grey-2">Multidimensional</span>
                        </div>
                      </div>
                    </ChartCard>

                    <ChartCard title="GHG Emissions (MtCO₂e)">
                      <div
                        ref={co2EmissionChartContainerRef}
                        className="w-full"
                      >
                        <svg
                          ref={co2EmissionChartRef}
                          className="w-full h-auto"
                        ></svg>
                      </div>
                    </ChartCard>
                  </div>

                  {/* Scenario Parameters Summary */}
                  <div className="bg-white-1 border border-grey-1 rounded-[8px] p-6">
                    <h2 className="text-[1.25rem] font-inter font-semibold text-black-1 mb-4">
                      Scenario Parameters
                    </h2>
                    <div className="bg-grey-1 rounded-[8px] p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[0.875rem] font-inter">
                        <div>
                          <span className="text-grey-2">
                            Renewable Target:{" "}
                          </span>
                          <span className="text-black-1 font-semibold">
                            {scenarioParams.renewable_target}%
                          </span>
                        </div>
                        <div>
                          <span className="text-grey-2">
                            Demand Growth Rate:{" "}
                          </span>
                          <span className="text-black-1 font-semibold">
                            {(scenarioParams.demand_growth_rate * 100).toFixed(
                              1,
                            )}
                            %
                          </span>
                        </div>
                        <div>
                          <span className="text-grey-2">
                            Electricity Access Target:{" "}
                          </span>
                          <span className="text-black-1 font-semibold">
                            {scenarioParams.energy_access_target}%
                          </span>
                        </div>
                        <div>
                          <span className="text-grey-2">GDP Growth Rate: </span>
                          <span className="text-black-1 font-semibold">
                            {(scenarioParams.gdp_growth_rate * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div>
                          <span className="text-grey-2">
                            Clean Cooking Target:{" "}
                          </span>
                          <span className="text-black-1 font-semibold">
                            {scenarioParams.clean_cooking_target}%
                          </span>
                        </div>
                        <div>
                          <span className="text-grey-2">
                            Population Growth Rate:{" "}
                          </span>
                          <span className="text-black-1 font-semibold">
                            {(
                              scenarioParams.population_growth_rate * 100
                            ).toFixed(1)}
                            %
                          </span>
                        </div>
                        <div>
                          <span className="text-grey-2">Timeline: </span>
                          <span className="text-black-1 font-semibold">
                            {scenarioStartYear} - {scenarioEndYear}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            )}

      </div>

      {/* Feedback Modal */}
      <FeedbackModal
        isOpen={feedbackModal.isOpen}
        onClose={closeFeedback}
        type={feedbackModal.type}
        title={feedbackModal.title}
        message={feedbackModal.message}
        details={feedbackModal.details}
      />
    </div>
  );
};
