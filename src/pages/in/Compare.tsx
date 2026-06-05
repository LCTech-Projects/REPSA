import { useState, useEffect, useRef, type CSSProperties } from "react";
import { useDispatch } from "react-redux";
import {
  useGetAvailableYearsQuery,
  useGetAvailableCountriesQuery,
  apiSlice,
} from "../../app/appSlices/apiSlice";
import { FilterField } from "../../components/inputs/FilterField";
import { SelectIcon } from "../../components/Icons";
import * as d3 from "d3";
import { getChartMargins, getChartSize } from "../../components/utils/ChartUtils";
import { useSidebar, SIDEBAR_WIDTH_COLLAPSED } from "../../app/SidebarContext";

type ChartType = "line" | "bar" | "pie";
type Metric =
  | "electricity_access"
  | "co2_emissions"
  | "population"
  | "electricity_demand"
  | "electricity_generation"
  | "electricity_demand_per_capita"
  | "electricity_demand_per_capita_with_access"
  | "clean_cooking_access"
  | "energy_poverty"
  | "energy_poverty_multidimensional"
  | "energy_poverty_rural"
  | "energy_poverty_urban";

const METRIC_LABELS: Record<Metric, string> = {
  electricity_access: "Electricity Access",
  co2_emissions: "CO2 Emissions",
  population: "Population",
  electricity_demand: "Electricity Demand",
  electricity_generation: "Electricity Generation",
  electricity_demand_per_capita: "Electricity Demand Per Capita",
  electricity_demand_per_capita_with_access:
    "Electricity Demand Per Capita with Access",
  clean_cooking_access: "Clean Cooking Access",
  energy_poverty: "Energy Poverty",
  energy_poverty_multidimensional: "Energy Poverty Multidimensional",
  energy_poverty_rural: "Energy Poverty Rural",
  energy_poverty_urban: "Energy Poverty Urban",
};

const METRIC_UNITS: Record<Metric, string> = {
  electricity_access: "%",
  co2_emissions: "gCO₂/kWh",
  population: "M",
  electricity_demand: "TWh",
  electricity_generation: "TWh",
  electricity_demand_per_capita: "MWh",
  electricity_demand_per_capita_with_access: "MWh",
  clean_cooking_access: "%",
  energy_poverty: "%",
  energy_poverty_multidimensional: "%",
  energy_poverty_rural: "%",
  energy_poverty_urban: "%",
};

export const Compare = () => {
  const { width: sidebarWidth, expanded: sidebarExpanded } = useSidebar();
  const filtersPanelWidth = 320;
  const chartAreaOffset = sidebarExpanded
    ? sidebarWidth + filtersPanelWidth - SIDEBAR_WIDTH_COLLAPSED
    : filtersPanelWidth;
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<Metric | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const chartRef = useRef<SVGSVGElement>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const countryDropdownRef = useRef<HTMLDivElement>(null);
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [chartSize, setChartSize] = useState({ width: 0, height: 320 });

  // Fetch available years
  const { data: yearsData } = useGetAvailableYearsQuery();
  const availableYears = yearsData?.data?.years || [];
  const latestYear = yearsData?.data?.latest_year || null;

  // Fetch available countries
  const { data: countriesData } = useGetAvailableCountriesQuery();
  const availableCountries = countriesData?.data || [];

  // Filter countries based on search query
  const filteredCountries = availableCountries.filter((country: string) =>
    country.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const dispatch = useDispatch<any>();
  const [countryDataMap, setCountryDataMap] = useState<Record<string, any>>({});

  // Fetch data for each selected country
  useEffect(() => {
    if (selectedCountries.length === 0 || !selectedYear) {
      setCountryDataMap({});
      return;
    }

    const fetchPromises = selectedCountries.map((country) =>
      dispatch(
        apiSlice.endpoints.getCountryDetails.initiate({
          country,
          selected_year: selectedYear,
        }),
      ).then((result: any) => ({
        country,
        data: result.data,
      })),
    );

    Promise.all(fetchPromises).then(
      (results: Array<{ country: string; data: any }>) => {
        const newMap: Record<string, any> = {};
        results.forEach(({ country, data }) => {
          // API returns { success: true, data: {...} }
          // RTK Query wraps it, so result.data is { success: true, data: {...} }
          if (data?.success && data?.data) {
            newMap[country] = data.data;
          }
        });
        setCountryDataMap(newMap);
      },
    );
  }, [selectedCountries, selectedYear, dispatch]);

  // Set default year to 2023 (or latest year if 2023 not available)
  useEffect(() => {
    if (!selectedYear && availableYears.length > 0) {
      // Default to 2023 if available, otherwise use latest year
      const defaultYear = availableYears.includes(2023) ? 2023 : latestYear;
      if (defaultYear) {
        setSelectedYear(defaultYear);
      }
    }
  }, [latestYear, selectedYear, availableYears]);

  // Get metric value from country data
  const getMetricValue = (countryData: any, metric: Metric): number | null => {
    if (!countryData?.time_series || countryData.time_series.length === 0) {
      return null;
    }

    const yearData = countryData.time_series.find(
      (entry: any) => entry.year === selectedYear,
    );

    if (!yearData) return null;

    switch (metric) {
      case "electricity_access":
        return yearData.electricity_access;
      case "co2_emissions":
        return yearData.carbon_intensity;
      case "population":
        return yearData.population ? yearData.population / 1000000 : null; // Convert to millions
      case "electricity_demand":
        return yearData.electricity_demand;
      case "electricity_generation":
        return yearData.electricity_generation;
      case "electricity_demand_per_capita":
        return yearData.electricity_demand_per_capita;
      case "electricity_demand_per_capita_with_access":
        return yearData.electricity_demand_per_capita_with_access;
      case "clean_cooking_access":
        return yearData.clean_cooking_access;
      case "energy_poverty":
        return yearData.energy_poverty;
      case "energy_poverty_multidimensional":
        return yearData.energy_poverty_multidimensional;
      case "energy_poverty_rural":
        return yearData.energy_poverty_rural;
      case "energy_poverty_urban":
        return yearData.energy_poverty_urban;
      default:
        return null;
    }
  };

  // Prepare chart data
  const chartData = selectedCountries
    .map((country) => {
      const countryData = countryDataMap[country];
      const value = countryData
        ? getMetricValue(countryData, selectedMetric!)
        : null;
      return {
        country,
        value: value !== null && value !== undefined ? value : 0,
      };
    })
    .filter((d) => d.value !== null && d.value !== undefined);

  // Observe chart container width for responsive D3 rendering
  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;

    const updateSize = () => {
      const containerWidth = container.offsetWidth || window.innerWidth;
      const { width } = getChartSize(containerWidth, 0, 0.55);
      setChartSize({
        width,
        height: Math.max(240, Math.min(400, width * 0.55)),
      });
    };

    updateSize();
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);
    window.addEventListener("resize", updateSize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateSize);
    };
  }, [selectedMetric, chartData.length, selectedYear]);

  // Render chart
  useEffect(() => {
    if (
      !chartRef.current ||
      !selectedMetric ||
      chartData.length === 0 ||
      !selectedYear ||
      chartSize.width === 0
    )
      return;

    const container = chartContainerRef.current;
    if (!container) return;

    const totalWidth = chartSize.width;
    const margin = getChartMargins(totalWidth, { rotateXLabels: true });
    const width = Math.max(80, totalWidth - margin.left - margin.right);
    const height = Math.max(
      140,
      chartSize.height - margin.top - margin.bottom,
    );
    const axisFontSize = totalWidth < 360 ? "10px" : "11px";

    const svg = d3.select(chartRef.current);
    svg.selectAll("*").remove();
    svg
      .attr("width", totalWidth)
      .attr("height", height + margin.top + margin.bottom)
      .attr(
        "viewBox",
        `0 0 ${totalWidth} ${height + margin.top + margin.bottom}`,
      )
      .attr("preserveAspectRatio", "xMidYMid meet");

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    if (chartType === "pie") {
      const isNarrow = totalWidth < 520;
      const radius = Math.min(width, isNarrow ? height * 0.45 : height) / 2 - 12;
      const pie = d3.pie<(typeof chartData)[0]>().value((d) => d.value);
      const arc = d3
        .arc<d3.PieArcDatum<(typeof chartData)[0]>>()
        .innerRadius(0)
        .outerRadius(Math.max(20, radius));

      const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

      const pieCenterX = isNarrow ? width / 2 : (width - 150) / 2;
      const pieCenterY = isNarrow ? height * 0.32 : height / 2;

      const arcs = g
        .selectAll(".arc")
        .data(pie(chartData))
        .enter()
        .append("g")
        .attr("class", "arc")
        .attr("transform", `translate(${pieCenterX},${pieCenterY})`);

      arcs
        .append("path")
        .attr("d", arc)
        .attr("fill", (d) => colorScale(d.data.country))
        .attr("stroke", "#fff")
        .attr("stroke-width", 2);

      const legend = g.append("g");

      if (isNarrow) {
        legend.attr(
          "transform",
          `translate(0, ${height * 0.62})`,
        );
      } else {
        legend.attr(
          "transform",
          `translate(${width - 140}, ${(height - chartData.length * 25) / 2})`,
        );
      }

      chartData.forEach((d, i) => {
        const legendItem = legend
          .append("g")
          .attr(
            "transform",
            isNarrow
              ? `translate(${(i % 2) * (width / 2)}, ${Math.floor(i / 2) * 22})`
              : `translate(0, ${i * 25})`,
          );

        legendItem
          .append("rect")
          .attr("width", 12)
          .attr("height", 12)
          .attr("fill", colorScale(d.country));

        legendItem
          .append("text")
          .attr("x", 18)
          .attr("y", 11)
          .style("font-size", axisFontSize)
          .style("font-family", "Inter, sans-serif")
          .style("fill", "#666")
          .text(
            `${d.country}: ${d.value.toFixed(2)}${METRIC_UNITS[selectedMetric]}`,
          );
      });
    } else if (chartType === "bar") {
      // Bar Chart
      const maxValue = d3.max(chartData, (d) => d.value) || 0;
      const x = d3
        .scaleBand()
        .domain(chartData.map((d) => d.country))
        .range([0, width])
        .padding(0.2);

      const y = d3
        .scaleLinear()
        .domain([0, maxValue > 0 ? maxValue : 100] as [number, number])
        .nice()
        .range([height, 0]);

      // Clear any existing bars first
      g.selectAll(".bar").remove();

      // Add bars
      g.selectAll(".bar")
        .data(chartData)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", (d) => x(d.country) || 0)
        .attr("width", x.bandwidth())
        .attr("y", (d) => y(d.value))
        .attr("height", (d) => Math.max(0, height - y(d.value)))
        .attr("fill", "#1E3A8A")
        .style("cursor", "pointer")
        .on("mouseover", function () {
          d3.select(this).attr("opacity", 0.7);
        })
        .on("mouseout", function () {
          d3.select(this).attr("opacity", 1);
        });

      // X-axis
      g.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .selectAll("text")
        .style("text-anchor", totalWidth < 480 ? "end" : "end")
        .style("font-size", axisFontSize)
        .attr("dx", "-.8em")
        .attr("dy", ".15em")
        .attr("transform", totalWidth < 480 ? "rotate(-60)" : "rotate(-45)");

      // Y-axis
      g.append("g").call(d3.axisLeft(y));

      // Y-axis label
      g.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 0 - margin.left)
        .attr("x", 0 - height / 2)
        .attr("dy", "1em")
        .style("text-anchor", "middle")
        .style("font-size", "12px")
        .style("font-family", "Inter, sans-serif")
        .style("fill", "#666")
        .text(
          `${METRIC_LABELS[selectedMetric]} (${METRIC_UNITS[selectedMetric]})`,
        );
    } else {
      // Line Chart
      const x = d3
        .scaleBand()
        .domain(chartData.map((d) => d.country))
        .range([0, width])
        .padding(0.2);

      const y = d3
        .scaleLinear()
        .domain([0, d3.max(chartData, (d) => d.value) || 0] as [number, number])
        .nice()
        .range([height, 0]);

      const line = d3
        .line<(typeof chartData)[0]>()
        .x((d) => (x(d.country) || 0) + x.bandwidth() / 2)
        .y((d) => y(d.value))
        .curve(d3.curveMonotoneX);

      g.append("path")
        .datum(chartData)
        .attr("fill", "none")
        .attr("stroke", "#1E3A8A")
        .attr("stroke-width", 2)
        .attr("d", line);

      // Add circles for data points
      g.selectAll(".dot")
        .data(chartData)
        .enter()
        .append("circle")
        .attr("class", "dot")
        .attr("cx", (d) => (x(d.country) || 0) + x.bandwidth() / 2)
        .attr("cy", (d) => y(d.value))
        .attr("r", 5)
        .attr("fill", "#1E3A8A")
        .style("cursor", "pointer")
        .on("mouseover", function () {
          d3.select(this).attr("r", 7);
        })
        .on("mouseout", function () {
          d3.select(this).attr("r", 5);
        });

      // X-axis
      g.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .selectAll("text")
        .style("text-anchor", totalWidth < 480 ? "end" : "end")
        .style("font-size", axisFontSize)
        .attr("dx", "-.8em")
        .attr("dy", ".15em")
        .attr("transform", totalWidth < 480 ? "rotate(-60)" : "rotate(-45)");

      // Y-axis
      g.append("g").call(d3.axisLeft(y));

      // Y-axis label
      g.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 0 - margin.left)
        .attr("x", 0 - height / 2)
        .attr("dy", "1em")
        .style("text-anchor", "middle")
        .style("font-size", axisFontSize)
        .style("font-family", "Inter, sans-serif")
        .style("fill", "#666")
        .text(
          `${METRIC_LABELS[selectedMetric]} (${METRIC_UNITS[selectedMetric]})`,
        );
    }
  }, [chartData, selectedMetric, chartType, selectedYear, chartSize]);

  const handleCountrySelect = (country: string) => {
    if (selectedCountries.includes(country)) {
      setSelectedCountries(selectedCountries.filter((c) => c !== country));
    } else if (selectedCountries.length < 5) {
      setSelectedCountries([...selectedCountries, country]);
    }
  };

  const handleCountryRemove = (country: string) => {
    setSelectedCountries(selectedCountries.filter((c) => c !== country));
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        countryDropdownRef.current &&
        !countryDropdownRef.current.contains(event.target as Node)
      ) {
        setIsCountryDropdownOpen(false);
      }
    };

    if (isCountryDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isCountryDropdownOpen]);

  const filtersPanel = (
    <>
      <h2 className="text-[1.25rem] font-inter font-semibold text-black-1 mb-2">
        Compare Countries
      </h2>
      <p className="text-[0.875rem] font-inter text-grey-2 mb-6">
        See how african countries use and produce energy
      </p>

      <div className="mb-6">
        <h3 className="text-[0.875rem] font-inter font-semibold text-black-1 mb-3">
          Select Countries
        </h3>
        {selectedCountries.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {selectedCountries.map((country) => (
              <div
                key={country}
                className="bg-blue-1 text-white-1 px-3 py-1 rounded-full text-[0.75rem] font-inter flex items-center gap-2"
              >
                <span>{country}</span>
                <button
                  onClick={() => handleCountryRemove(country)}
                  className="hover:bg-blue-600 rounded-full w-4 h-4 flex items-center justify-center"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="relative" ref={countryDropdownRef}>
          <button
            onClick={() => setIsCountryDropdownOpen(!isCountryDropdownOpen)}
            className="w-full bg-white-1 border border-grey-1 rounded-lg px-4 py-3 flex items-center justify-between text-[0.875rem] font-inter text-black-1 hover:border-grey-2 transition-colors"
          >
            <span className="text-grey-2">
              {selectedCountries.length === 0
                ? "Search Country..."
                : `Select ${selectedCountries.length < 5 ? "more" : ""} countries`}
            </span>
            <SelectIcon />
          </button>
          {isCountryDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white-1 border border-grey-1 rounded-lg shadow-lg z-50">
              <div className="p-2 border-b border-grey-1">
                <input
                  type="text"
                  placeholder="Search Country..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full bg-white-1 border border-grey-1 rounded-lg px-3 py-2 text-[0.875rem] font-inter text-black-1"
                />
              </div>
              <div className="max-h-50 overflow-y-auto">
                {filteredCountries
                  .filter(
                    (country: string) => !selectedCountries.includes(country),
                  )
                  .map((country: string) => (
                    <button
                      key={country}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleCountrySelect(country);
                        if (selectedCountries.length >= 3) {
                          setIsCountryDropdownOpen(false);
                        }
                      }}
                      disabled={selectedCountries.length >= 5}
                      className="w-full px-4 py-2 text-left text-[0.875rem] font-inter hover:bg-grey-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {country}
                    </button>
                  ))}
                {filteredCountries.filter(
                  (country: string) => !selectedCountries.includes(country),
                ).length === 0 && (
                  <div className="px-4 py-2 text-[0.875rem] font-inter text-grey-2 text-center">
                    No countries found
                  </div>
                )}
              </div>
              <div className="p-2 border-t border-grey-1">
                <p className="text-[0.75rem] font-inter text-grey-2">
                  You can select up to 5 countries
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-[0.875rem] font-inter font-semibold text-black-1 mb-3">
          Choose Metrics
        </h3>
        <div className="space-y-2">
          {Object.entries(METRIC_LABELS).map(([key, label]) => (
            <label
              key={key}
              className="flex items-center gap-2 cursor-pointer"
            >
              <input
                type="radio"
                name="metric"
                value={key}
                checked={selectedMetric === key}
                onChange={() => setSelectedMetric(key as Metric)}
                className="w-4.5 h-4.5 text-blue-1 cursor-pointer"
                style={{ minWidth: "18px", minHeight: "18px" }}
              />
              <span className="text-[0.875rem] font-inter text-black-1">
                {label}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <FilterField
          label="Select Year"
          placeholder="Select Year"
          options={availableYears.map((y: number) => y.toString()).reverse()}
          selectedValue={selectedYear ? selectedYear.toString() : null}
          onValueChange={(value) => {
            setSelectedYear(value ? Number(value) : null);
          }}
        />
      </div>

      <div className="mb-6">
        <h3 className="text-[0.875rem] font-inter font-semibold text-black-1 mb-3">
          Select Chart Type
        </h3>
        <div className="space-y-2">
          {(["line", "bar", "pie"] as ChartType[]).map((type) => (
            <label
              key={type}
              className="flex items-center gap-2 cursor-pointer"
            >
              <input
                type="radio"
                name="chartType"
                value={type}
                checked={chartType === type}
                onChange={() => setChartType(type)}
                className="w-4.5 h-4.5 text-blue-1 cursor-pointer"
                style={{ minWidth: "18px", minHeight: "18px" }}
              />
              <span className="text-[0.875rem] font-inter text-black-1 capitalize">
                {type} Chart
              </span>
            </label>
          ))}
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-grey-1">
      {isFiltersOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[60] lg:hidden"
          onClick={() => setIsFiltersOpen(false)}
          aria-hidden
        />
      )}

      <div
        className={`fixed top-0 bottom-0 z-[50] left-0 lg:left-[var(--sidebar-offset)] w-full max-w-[320px] bg-white-1 border-r border-grey-1 p-4 sm:p-6 overflow-y-auto shadow-[4px_0_12px_0_rgba(0,0,0,0.06)] transform transition-[transform,left] duration-300 ease-in-out ${
          isFiltersOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
        style={{ "--sidebar-offset": `${sidebarWidth}px` } as React.CSSProperties}
      >
        <div className="flex items-center justify-between mb-4 lg:hidden">
          <h2 className="text-[1rem] font-inter font-semibold text-black-1">
            Filters
          </h2>
          <button
            type="button"
            onClick={() => setIsFiltersOpen(false)}
            className="text-grey-2 hover:text-black-1"
            aria-label="Close filters"
          >
            ×
          </button>
        </div>
        {filtersPanel}
      </div>

      <div
        data-scroll-root
        className="min-h-screen overflow-y-auto p-4 md:p-6 ml-0 lg:ml-[var(--chart-offset)] transition-[margin] duration-300 ease-in-out"
        style={{ "--chart-offset": `${chartAreaOffset}px` } as CSSProperties}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
          <h1 className="text-[1.25rem] md:text-[1.5rem] font-inter font-semibold text-black-1">
            Overview
          </h1>
          <button
            type="button"
            onClick={() => setIsFiltersOpen(true)}
            className="lg:hidden shrink-0 self-start bg-white-1 border border-grey-1 rounded-lg px-4 py-2 text-[0.875rem] font-inter text-black-1 hover:bg-grey-1 transition-colors"
          >
            Filters
          </button>
        </div>

        {/* Chart Section */}
        {selectedMetric && chartData.length > 0 && selectedYear && (
          <div className="bg-white-1 border border-grey-1 rounded-lg p-4 md:p-6 mb-6 overflow-hidden">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
              <div className="min-w-0">
                <h2 className="text-[1.125rem] font-inter font-semibold text-black-1">
                  {METRIC_LABELS[selectedMetric]}
                </h2>
                <p className="text-[0.875rem] font-inter text-grey-2 break-words">
                  Comparing {selectedCountries.join(", ")}
                </p>
              </div>
              <div className="flex gap-2">
                <button className="p-2 hover:bg-grey-1 rounded">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M8 1V15M1 8H15"
                      stroke="#666"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
                <button className="p-2 hover:bg-grey-1 rounded">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M8 1L10.5 6H15.5L11.5 9.5L13 15L8 12L3 15L4.5 9.5L0.5 6H5.5L8 1Z"
                      stroke="#666"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            </div>
            <div ref={chartContainerRef} className="w-full min-w-0 overflow-x-auto">
              <svg ref={chartRef} className="w-full h-auto max-w-full"></svg>
            </div>
            {chartType !== "pie" && (
              <div className="mt-4 text-center">
                <span className="text-[0.75rem] font-inter text-grey-2">
                  {METRIC_LABELS[selectedMetric]} (
                  {METRIC_UNITS[selectedMetric]})
                </span>
              </div>
            )}
          </div>
        )}

        {/* Country Statistics */}
        {selectedCountries.length > 0 && selectedYear && (
          <div className="bg-white-1 border border-grey-1 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[1.125rem] font-inter font-semibold text-black-1">
                Country Statistics
              </h2>
              <div className="flex gap-2">
                <button className="p-2 hover:bg-grey-1 rounded">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M8 1V15M1 8H15"
                      stroke="#666"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
                <button className="p-2 hover:bg-grey-1 rounded">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M8 1L10.5 6H15.5L11.5 9.5L13 15L8 12L3 15L4.5 9.5L0.5 6H5.5L8 1Z"
                      stroke="#666"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {selectedCountries.map((country) => {
                const data = countryDataMap[country];
                const yearData = data?.time_series?.find(
                  (entry: any) => entry.year === selectedYear,
                );

                if (!yearData) return null;

                return (
                  <div key={country} className="bg-grey-1 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 bg-blue-1 rounded-full flex items-center justify-center text-white-1 text-[0.75rem] font-inter font-semibold">
                        {country.charAt(0)}
                      </div>
                      <span className="text-[0.875rem] font-inter font-semibold text-black-1">
                        {country}
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div className="text-[0.75rem] font-inter text-grey-2">
                        Access:{" "}
                        <span className="text-black-1 font-semibold">
                          {yearData.electricity_access
                            ? `${yearData.electricity_access.toFixed(0)}%`
                            : "N/A"}
                        </span>
                      </div>
                      <div className="text-[0.75rem] font-inter text-grey-2">
                        CO2:{" "}
                        <span className="text-black-1 font-semibold">
                          {yearData.carbon_intensity
                            ? `${yearData.carbon_intensity.toFixed(1)}t`
                            : "N/A"}
                        </span>
                      </div>
                      <div className="text-[0.75rem] font-inter text-grey-2">
                        Population:{" "}
                        <span className="text-black-1 font-semibold">
                          {yearData.population
                            ? `${(yearData.population / 1000000).toFixed(0)}M`
                            : "N/A"}
                        </span>
                      </div>
                      <div className="text-[0.75rem] font-inter text-grey-2">
                        Renewable:{" "}
                        <span className="text-black-1 font-semibold">
                          {yearData.renewable_share
                            ? `${yearData.renewable_share.toFixed(0)}%`
                            : "N/A"}
                        </span>
                      </div>
                      <div className="text-[0.75rem] font-inter text-grey-2">
                        EPI:{" "}
                        <span className="text-black-1 font-semibold">
                          {yearData.energy_poverty
                            ? `${yearData.energy_poverty.toFixed(0)}`
                            : "N/A"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {(!selectedMetric || chartData.length === 0) && (
          <div className="bg-white-1 border border-grey-1 rounded-lg p-12 text-center">
            <p className="text-grey-2 text-[0.875rem] font-inter">
              {!selectedMetric
                ? "Please select a metric to compare"
                : selectedCountries.length === 0
                  ? "Please select at least one country"
                  : "No data available for the selected countries and year"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
