import { useState, useEffect, useRef } from "react";
import { useDispatch } from "react-redux";
import {
    useGetAvailableYearsQuery,
    useGetAvailableCountriesQuery,
    apiSlice,
} from "../../appSlices/apiSlice";
import { FilterField } from "../../components/inputs/FilterField";
import { SelectIcon } from "../../components/Icons";
import * as d3 from "d3";

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
    electricity_demand_per_capita_with_access: "Electricity Demand Per Capita with Access",
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
    electricity_demand_per_capita: "kWh",
    electricity_demand_per_capita_with_access: "kWh",
    clean_cooking_access: "%",
    energy_poverty: "%",
    energy_poverty_multidimensional: "%",
    energy_poverty_rural: "%",
    energy_poverty_urban: "%",
};

export const Compare = () => {
    const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
    const [selectedMetric, setSelectedMetric] = useState<Metric | null>(null);
    const [selectedYear, setSelectedYear] = useState<number | null>(null);
    const [chartType, setChartType] = useState<ChartType>("bar");
    const [searchQuery, setSearchQuery] = useState<string>("");

    const chartRef = useRef<SVGSVGElement>(null);
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const countryDropdownRef = useRef<HTMLDivElement>(null);
    const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);

    // Fetch available years
    const { data: yearsData } = useGetAvailableYearsQuery();
    const availableYears = yearsData?.data?.years || [];
    const latestYear = yearsData?.data?.latest_year || null;

    // Fetch available countries
    const { data: countriesData } = useGetAvailableCountriesQuery();
    const availableCountries = countriesData?.data || [];

    // Filter countries based on search query
    const filteredCountries = availableCountries.filter((country: string) =>
        country.toLowerCase().includes(searchQuery.toLowerCase())
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
                })
            ).then((result: any) => ({
                country,
                data: result.data,
            }))
        );

        Promise.all(fetchPromises).then((results: Array<{ country: string; data: any }>) => {
            const newMap: Record<string, any> = {};
            results.forEach(({ country, data }) => {
                // API returns { success: true, data: {...} }
                // RTK Query wraps it, so result.data is { success: true, data: {...} }
                if (data?.success && data?.data) {
                    newMap[country] = data.data;
                }
            });
            setCountryDataMap(newMap);
        });
    }, [selectedCountries, selectedYear, dispatch]);

    // Set default year
    useEffect(() => {
        if (latestYear && !selectedYear) {
            setSelectedYear(latestYear);
        }
    }, [latestYear, selectedYear]);

    // Get metric value from country data
    const getMetricValue = (countryData: any, metric: Metric): number | null => {
        if (!countryData?.time_series || countryData.time_series.length === 0) {
            return null;
        }

        const yearData = countryData.time_series.find(
            (entry: any) => entry.year === selectedYear
        );

        if (!yearData) return null;

        switch (metric) {
            case "electricity_access":
                return yearData.electricity_access;
            case "co2_emissions":
                return yearData.carbon_intensity;
            case "population":
                return yearData.population ? (yearData.population / 1000000) : null; // Convert to millions
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

    // Render chart
    useEffect(() => {
        if (!chartRef.current || !selectedMetric || chartData.length === 0 || !selectedYear) return;

        const container = chartContainerRef.current;
        if (!container) return;

        const margin = { top: 30, right: 30, bottom: 60, left: 70 };
        const containerWidth = container.offsetWidth || 800;
        const width = Math.max(300, containerWidth - margin.left - margin.right);
        const height = 400 - margin.top - margin.bottom;

        const svg = d3.select(chartRef.current);
        svg.selectAll("*").remove();
        svg.attr("width", containerWidth)
            .attr("height", height + margin.top + margin.bottom)
            .attr("viewBox", `0 0 ${containerWidth} ${height + margin.top + margin.bottom}`)
            .attr("preserveAspectRatio", "xMidYMid meet");

        const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

        if (chartType === "pie") {
            // Pie Chart
            const radius = Math.min(width, height) / 2 - 20; // Leave space for legend
            const pie = d3.pie<typeof chartData[0]>().value((d) => d.value);
            const arc = d3
                .arc<d3.PieArcDatum<typeof chartData[0]>>()
                .innerRadius(0)
                .outerRadius(radius);

            const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

            // Calculate legend width to position pie chart properly
            const legendWidth = 150;
            const pieCenterX = (width - legendWidth) / 2;
            const pieCenterY = height / 2;

            const arcs = g
                .selectAll(".arc")
                .data(pie(chartData))
                .enter()
                .append("g")
                .attr("class", "arc")
                .attr("transform", `translate(${pieCenterX},${pieCenterY})`);

            arcs.append("path")
                .attr("d", arc)
                .attr("fill", (d) => colorScale(d.data.country))
                .attr("stroke", "#fff")
                .attr("stroke-width", 2);

            // Legend - positioned to the right of the pie chart
            const legend = g
                .append("g")
                .attr("transform", `translate(${width - legendWidth + 10}, ${(height - chartData.length * 25) / 2})`);

            chartData.forEach((d, i) => {
                const legendItem = legend
                    .append("g")
                    .attr("transform", `translate(0, ${i * 25})`);

                legendItem
                    .append("rect")
                    .attr("width", 15)
                    .attr("height", 15)
                    .attr("fill", colorScale(d.country));

                legendItem
                    .append("text")
                    .attr("x", 20)
                    .attr("y", 12)
                    .style("font-size", "11px")
                    .style("font-family", "Inter, sans-serif")
                    .style("fill", "#666")
                    .text(`${d.country}: ${d.value.toFixed(2)}${METRIC_UNITS[selectedMetric]}`);
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
                .style("text-anchor", "end")
                .attr("dx", "-.8em")
                .attr("dy", ".15em")
                .attr("transform", "rotate(-45)");

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
                .text(`${METRIC_LABELS[selectedMetric]} (${METRIC_UNITS[selectedMetric]})`);
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
                .line<typeof chartData[0]>()
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
                .style("text-anchor", "end")
                .attr("dx", "-.8em")
                .attr("dy", ".15em")
                .attr("transform", "rotate(-45)");

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
                .text(`${METRIC_LABELS[selectedMetric]} (${METRIC_UNITS[selectedMetric]})`);
        }
    }, [chartData, selectedMetric, chartType, selectedYear]);

    const handleCountrySelect = (country: string) => {
        if (selectedCountries.includes(country)) {
            setSelectedCountries(selectedCountries.filter((c) => c !== country));
        } else if (selectedCountries.length < 4) {
            setSelectedCountries([...selectedCountries, country]);
        }
    };

    const handleCountryRemove = (country: string) => {
        setSelectedCountries(selectedCountries.filter((c) => c !== country));
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (countryDropdownRef.current && !countryDropdownRef.current.contains(event.target as Node)) {
                setIsCountryDropdownOpen(false);
            }
        };

        if (isCountryDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isCountryDropdownOpen]);

    return (
        <div className="flex h-screen bg-grey-1">
            {/* Left Sidebar */}
            <div className="w-[320px] bg-white-1 border-r border-grey-1 p-6 overflow-y-auto">
                <h2 className="text-[1.25rem] font-inter font-semibold text-black-1 mb-2">
                    Compare Countries
                </h2>
                <p className="text-[0.875rem] font-inter text-grey-2 mb-6">
                    See how african countries use and produce energy
                </p>

                {/* Select Countries */}
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
                            className="w-full bg-white-1 border border-grey-1 rounded-[8px] px-4 py-3 flex items-center justify-between text-[0.875rem] font-inter text-black-1 hover:border-grey-2 transition-colors"
                        >
                            <span className="text-grey-2">
                                {selectedCountries.length === 0 ? "Search Country..." : `Select ${selectedCountries.length < 4 ? "more" : ""} countries`}
                            </span>
                            <SelectIcon />
                        </button>
                        {isCountryDropdownOpen && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white-1 border border-grey-1 rounded-[8px] shadow-lg z-50">
                                <div className="p-2 border-b border-grey-1">
                                    <input
                                        type="text"
                                        placeholder="Search Country..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                        className="w-full bg-white-1 border border-grey-1 rounded-[8px] px-3 py-2 text-[0.875rem] font-inter text-black-1"
                                    />
                                </div>
                                <div className="max-h-[200px] overflow-y-auto">
                                    {filteredCountries
                                        .filter((country: string) => !selectedCountries.includes(country))
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
                                                disabled={selectedCountries.length >= 4}
                                                className="w-full px-4 py-2 text-left text-[0.875rem] font-inter hover:bg-grey-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {country}
                                            </button>
                                        ))}
                                    {filteredCountries.filter((country: string) => !selectedCountries.includes(country)).length === 0 && (
                                        <div className="px-4 py-2 text-[0.875rem] font-inter text-grey-2 text-center">
                                            No countries found
                                        </div>
                                    )}
                                </div>
                                <div className="p-2 border-t border-grey-1">
                                    <p className="text-[0.75rem] font-inter text-grey-2">
                                        You can select up to 4 countries
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Choose Metrics */}
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
                                    className="w-[18px] h-[18px] text-blue-1 cursor-pointer"
                                    style={{ minWidth: '18px', minHeight: '18px' }}
                                />
                                <span className="text-[0.875rem] font-inter text-black-1">
                                    {label}
                                </span>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Select Year */}
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

                {/* Select Chart Type */}
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
                                    className="w-[18px] h-[18px] text-blue-1 cursor-pointer"
                                    style={{ minWidth: '18px', minHeight: '18px' }}
                                />
                                <span className="text-[0.875rem] font-inter text-black-1 capitalize">
                                    {type} Chart
                                </span>
                            </label>
                        ))}
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-6">
                <h1 className="text-[1.5rem] font-inter font-semibold text-black-1 mb-6">
                    Overview
                </h1>

                {/* Chart Section */}
                {selectedMetric && chartData.length > 0 && selectedYear && (
                    <div className="bg-white-1 border border-grey-1 rounded-[8px] p-6 mb-6">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-[1.125rem] font-inter font-semibold text-black-1">
                                    {METRIC_LABELS[selectedMetric]}
                                </h2>
                                <p className="text-[0.875rem] font-inter text-grey-2">
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
                        <div ref={chartContainerRef} className="w-full">
                            <svg ref={chartRef} className="w-full h-auto"></svg>
                        </div>
                        {chartType !== "pie" && (
                            <div className="mt-4 text-center">
                                <span className="text-[0.75rem] font-inter text-grey-2">
                                    {METRIC_LABELS[selectedMetric]} ({METRIC_UNITS[selectedMetric]})
                                </span>
                            </div>
                        )}
                    </div>
                )}

                {/* Country Statistics */}
                {selectedCountries.length > 0 && selectedYear && (
                    <div className="bg-white-1 border border-grey-1 rounded-[8px] p-6">
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
                                    (entry: any) => entry.year === selectedYear
                                );

                                if (!yearData) return null;

                                return (
                                    <div
                                        key={country}
                                        className="bg-grey-1 rounded-[8px] p-4"
                                    >
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
                    <div className="bg-white-1 border border-grey-1 rounded-[8px] p-12 text-center">
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

