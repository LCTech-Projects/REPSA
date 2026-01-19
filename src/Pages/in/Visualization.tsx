import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import {
    useGetAvailableYearsQuery,
    useGetCountryDetailsQuery,
    useGetAvailableCountriesQuery,
    useGetAvailableDatesQuery,
    useGetRealtimeDataQuery,
    useGetHourlyElectricityDemandQuery
} from "../../appSlices/apiSlice";
import { MetricCard } from "../../components/cards/MetricCard";
import { ChartCard } from "../../components/cards/ChartCard";
import { FilterField } from "../../components/inputs/FilterField";
import * as d3 from "d3";
import { calculateYearTicks } from "../../utils/chartUtils";

type ViewMode = "yearly" | "hourly";
type DataMode = "historical" | "realtime";

export const Visualization = () => {
    const location = useLocation();
    const navigationState = location.state as { country?: string; year?: number | null } | null;

    const [dataMode, setDataMode] = useState<DataMode>("historical");
    const [viewMode, setViewMode] = useState<ViewMode>("yearly");
    const [selectedYear, setSelectedYear] = useState<number | null>(navigationState?.year || null);
    const [selectedDate, setSelectedDate] = useState<string>("");
    const [selectedCountry, setSelectedCountry] = useState<string>(navigationState?.country || "Algeria");

    // Fetch available years
    const { data: yearsData } = useGetAvailableYearsQuery();
    const availableYears = yearsData?.data?.years || [];
    const latestYear = yearsData?.data?.latest_year || null;

    // Fetch available countries for hourly
    const { data: countriesData } = useGetAvailableCountriesQuery();
    const availableCountries = countriesData?.data || [];

    // Fetch available years for hourly data (to get dates later)
    const { data: hourlyYearsData } = useGetAvailableDatesQuery(
        { country: selectedCountry },
        { skip: !selectedCountry || viewMode !== "hourly" || dataMode !== "historical" }
    );
    const hourlyYears = hourlyYearsData?.data?.data || [];

    // Set default year
    useEffect(() => {
        if (latestYear && !selectedYear) {
            setSelectedYear(latestYear);
        }
    }, [latestYear, selectedYear]);

    // Set default date when switching to hourly mode
    useEffect(() => {
        if (viewMode === "hourly" && dataMode === "historical" && !selectedDate) {
            if (hourlyYears.length > 0) {
                // Use the latest available year from hourly data
                const latestYear = hourlyYears[hourlyYears.length - 1];
                setSelectedDate(`${latestYear}-01-01`);
            } else if (availableYears.length > 0) {
                // Fallback to available years if hourly years not loaded yet
                const latestYear = availableYears[availableYears.length - 1];
                setSelectedDate(`${latestYear}-01-01`);
            }
        }
    }, [viewMode, selectedDate, hourlyYears, availableYears, dataMode]);

    // Calculate start_year for time series (show last 9 years or from 2016)
    const getStartYear = (): number => {
        if (selectedYear) {
            return Math.max(2016, selectedYear - 8); // Show 9 years including selected
        }
        return 2016;
    };

    // Fetch yearly data (only for historical mode) - using same logic as drawer
    const { data: yearlyData, isLoading: yearlyLoading } = useGetCountryDetailsQuery(
        {
            country: selectedCountry,
            start_year: getStartYear(),
            end_year: selectedYear || 2023,
            selected_year: selectedYear || undefined
        },
        { skip: !selectedCountry || !selectedYear || viewMode !== "yearly" || dataMode !== "historical" }
    );

    // Fetch country details for hourly mode (using drawer charts which are yearly)
    const shouldFetchCountryDetails = dataMode === "historical" &&
        viewMode === "hourly" &&
        selectedCountry;

    const { data: countryDetailsData, isLoading: countryDetailsLoading, error: countryDetailsError } = useGetCountryDetailsQuery(
        {
            country: selectedCountry,
            start_year: getStartYear(),
            end_year: selectedYear || 2023,
            selected_year: selectedYear || undefined
        },
        {
            skip: !shouldFetchCountryDetails,
            refetchOnMountOrArgChange: true
        }
    );

    const countryDetails = countryDetailsData?.data?.data || null;

    // Fetch hourly data (only for historical mode)
    // API accepts date parameter (required for hourly)
    const shouldFetchHourly = dataMode === "historical" &&
        viewMode === "hourly" &&
        selectedCountry &&
        selectedDate;

    const { data: hourlyData, isLoading: hourlyLoading, error: hourlyError } = useGetHourlyElectricityDemandQuery(
        {
            country: selectedCountry,
            date: selectedDate || undefined,
        },
        {
            skip: !shouldFetchHourly,
            // Refetch when parameters change
            refetchOnMountOrArgChange: true
        }
    );

    // Fetch realtime data
    const { data: realtimeData, isLoading: realtimeLoading } = useGetRealtimeDataQuery(
        { country: selectedCountry },
        { skip: dataMode !== "realtime" || !selectedCountry }
    );

    const isLoading = dataMode === "historical"
        ? (viewMode === "yearly" ? yearlyLoading : countryDetailsLoading)
        : realtimeLoading;

    // Calculate key metrics for yearly view
    const calculateYearlyMetrics = () => {
        if (!yearlyData?.data?.time_series || yearlyData.data.time_series.length === 0) {
            return {
                totalGeneration: 0,
                totalDemand: 0,
                totalConsumption: 0,
                renewableShare: 0,
                energyPoverty: 0,
            };
        }

        const selectedYearData = yearlyData.data.time_series.find(
            (d: any) => d.year === selectedYear
        ) || yearlyData.data.time_series[yearlyData.data.time_series.length - 1];

        const totalGeneration = selectedYearData?.electricity_generation || 0;
        const totalDemand = selectedYearData?.electricity_demand || 0;
        const renewableShare = selectedYearData?.renewable_share || 0;
        const energyPoverty = selectedYearData?.energy_poverty || 0;

        return {
            totalGeneration,
            totalDemand,
            totalConsumption: totalDemand,
            renewableShare,
            energyPoverty,
        };
    };

    // Calculate key metrics for hourly view (now using country details)
    const calculateHourlyMetrics = () => {
        // API returns country details with time_series
        const timeSeries = countryDetails?.time_series || [];

        if (!Array.isArray(timeSeries) || timeSeries.length === 0) {
            return {
                totalGeneration: 0,
                totalDemand: 0,
                totalConsumption: 0,
                renewableShare: 0,
                energyPoverty: 0,
            };
        }

        // Get the latest year's data or selected year's data
        const latestData = selectedYear
            ? timeSeries.find((d: any) => d.year === selectedYear)
            : timeSeries[timeSeries.length - 1];

        if (!latestData) {
            return {
                totalGeneration: 0,
                totalDemand: 0,
                totalConsumption: 0,
                renewableShare: 0,
                energyPoverty: 0,
            };
        }

        return {
            totalGeneration: (latestData.electricity_generation || 0) * 1000, // Convert TWh to GWh
            totalDemand: (latestData.electricity_demand || 0) * 1000, // Convert TWh to GWh
            totalConsumption: (latestData.electricity_demand || 0) * 1000, // Convert TWh to GWh
            renewableShare: latestData.renewable_share || 0,
            energyPoverty: latestData.energy_poverty || 0,
        };
    };

    const metrics = viewMode === "yearly" ? calculateYearlyMetrics() : calculateHourlyMetrics();

    return (
        <div className="p-6 bg-white-1 min-h-screen">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-[2rem] font-inter font-semibold text-black-1 mb-4">
                    Visualization
                </h1>

                {/* Filters Section */}
                <div className="bg-grey-1 rounded-[8px] p-4 mb-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Data Mode Toggle (Historical/Realtime) */}
                        <FilterField
                            label="Data Mode"
                            placeholder="Select Mode"
                            options={["Historical", "Realtime"]}
                            selectedValue={dataMode === "historical" ? "Historical" : "Realtime"}
                            onValueChange={(value) => {
                                if (value === "Historical") {
                                    setDataMode("historical");
                                    setViewMode("yearly");
                                } else if (value === "Realtime") {
                                    setDataMode("realtime");
                                }
                            }}
                        />

                        {/* View Mode Toggle (Yearly/Hourly) - Only for Historical */}
                        {dataMode === "historical" && (
                            <FilterField
                                label="View"
                                placeholder="Select View"
                                options={["Yearly", "Hourly"]}
                                selectedValue={viewMode === "yearly" ? "Yearly" : "Hourly"}
                                onValueChange={(value) => {
                                    setViewMode(value === "Yearly" ? "yearly" : "hourly");
                                }}
                            />
                        )}

                        {/* Country Selector */}
                        <FilterField
                            label="Country"
                            placeholder="Select Country"
                            options={availableCountries}
                            selectedValue={selectedCountry}
                            onValueChange={(value) => {
                                if (value) setSelectedCountry(value);
                            }}
                        />

                        {/* Year Filter (Yearly mode - Historical) */}
                        {dataMode === "historical" && viewMode === "yearly" && (
                            <FilterField
                                label="Year"
                                placeholder="Select Year"
                                options={availableYears.map((y: number) => y.toString()).reverse()}
                                selectedValue={selectedYear ? selectedYear.toString() : null}
                                onValueChange={(value) => {
                                    setSelectedYear(value ? Number(value) : null);
                                }}
                            />
                        )}

                        {/* Date Filter for hourly mode - Allow any date from available years */}
                        {dataMode === "historical" && viewMode === "hourly" && (
                            <div className="w-full">
                                <label className="text-[0.875rem] font-inter text-grey-2 mb-[8px] block">Date</label>
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    min={hourlyYears.length > 0 ? `${Math.min(...hourlyYears)}-01-01` : (availableYears.length > 0 ? `${Math.min(...availableYears)}-01-01` : undefined)}
                                    max={hourlyYears.length > 0 ? `${Math.max(...hourlyYears)}-12-31` : (availableYears.length > 0 ? `${Math.max(...availableYears)}-12-31` : undefined)}
                                    className="w-full bg-white-1 border border-grey-1 rounded-[8px] px-4 py-3 text-[0.875rem] font-inter text-black-1 hover:border-grey-2 transition-colors"
                                />
                            </div>
                        )}

                        {/* Realtime Mode Info */}
                        {dataMode === "realtime" && (
                            <div className="col-span-full flex items-center gap-2 text-[0.875rem] font-inter text-grey-2 italic">
                                <span>Data sources: Worldometer, Renewables.ninja, Electricity Maps</span>
                            </div>
                        )}
                    </div>

                </div>
            </div>

            {dataMode === "realtime" ? (
                <div className="flex items-center justify-center py-20">
                    <div className="text-center w-full max-w-2xl">
                        <h2 className="text-[1.5rem] font-inter font-semibold text-black-1 mb-4">
                            Realtime Energy Data
                        </h2>
                        {realtimeLoading ? (
                            <p className="text-grey-2 text-[1rem] font-inter">Loading realtime data...</p>
                        ) : realtimeData?.data?.data || realtimeData?.data ? (
                            (() => {
                                const data = realtimeData.data.data || realtimeData.data;
                                return (
                                    <div className="bg-white-1 border border-grey-1 rounded-[8px] p-6 text-left">
                                        <div className="mb-4">
                                            <h3 className="text-[1rem] font-inter font-semibold text-black-1 mb-2">
                                                {data.country || selectedCountry} - Realtime Data
                                            </h3>
                                            <p className="text-[0.875rem] font-inter text-grey-2">
                                                Last updated: {data.timestamp ? new Date(data.timestamp).toLocaleString() : 'N/A'}
                                            </p>
                                        </div>
                                        <div className="space-y-4">
                                            {data.sources && Object.keys(data.sources).length > 0 ? (
                                                Object.entries(data.sources).map(([source, sourceData]: [string, any]) => (
                                                    <div key={source} className="border-t border-grey-1 pt-4">
                                                        <h4 className="text-[0.875rem] font-inter font-semibold text-black-1 mb-2 capitalize">
                                                            {source.replace('_', ' ')}
                                                        </h4>
                                                        {sourceData?.error ? (
                                                            <p className="text-[0.75rem] font-inter text-red-500">
                                                                Error: {sourceData.error}
                                                            </p>
                                                        ) : (
                                                            <div className="space-y-2">
                                                                {sourceData?.data && (
                                                                    <pre className="text-[0.75rem] font-inter text-grey-2 bg-grey-1 p-3 rounded overflow-auto">
                                                                        {JSON.stringify(sourceData.data, null, 2)}
                                                                    </pre>
                                                                )}
                                                                {sourceData?.note && (
                                                                    <p className="text-[0.75rem] font-inter text-grey-2 italic">
                                                                        {sourceData.note}
                                                                    </p>
                                                                )}
                                                                {!sourceData?.data && !sourceData?.note && (
                                                                    <pre className="text-[0.75rem] font-inter text-grey-2 bg-grey-1 p-3 rounded overflow-auto">
                                                                        {JSON.stringify(sourceData, null, 2)}
                                                                    </pre>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="text-[0.875rem] font-inter text-grey-2">
                                                    No source data available yet. The scraper is configured but needs implementation.
                                                </p>
                                            )}
                                        </div>
                                        <div className="mt-6 pt-4 border-t border-grey-1">
                                            <p className="text-[0.75rem] font-inter text-grey-2">
                                                <strong>Note:</strong> Realtime data scraping requires API keys and proper authentication for:
                                            </p>
                                            <ul className="text-[0.75rem] font-inter text-grey-2 list-disc list-inside mt-2 space-y-1">
                                                <li>Renewables.ninja - API key required</li>
                                                <li>Electricity Maps - API key required</li>
                                                <li>Worldometer - Web scraping implementation needed</li>
                                            </ul>
                                        </div>
                                    </div>
                                );
                            })()
                        ) : realtimeData?.error ? (
                            <div className="bg-white-1 border border-red-200 rounded-[8px] p-6 text-left">
                                <h3 className="text-[1rem] font-inter font-semibold text-red-500 mb-2">
                                    Error Loading Realtime Data
                                </h3>
                                <p className="text-[0.875rem] font-inter text-grey-2">
                                    {realtimeData.error.data?.error || realtimeData.error.data?.message || 'Unknown error occurred'}
                                </p>
                            </div>
                        ) : (
                            <div className="bg-white-1 border border-grey-1 rounded-[8px] p-6 text-left">
                                <h3 className="text-[1rem] font-inter font-semibold text-black-1 mb-2">
                                    Realtime Data Status
                                </h3>
                                <p className="text-[0.875rem] font-inter text-grey-2 mb-4">
                                    The realtime data scraper is configured and ready. The backend will return placeholder data until API keys are configured.
                                </p>
                                <div className="space-y-2 text-[0.75rem] font-inter text-grey-2">
                                    <p><strong>Current Status:</strong></p>
                                    <ul className="list-disc list-inside ml-4 space-y-1">
                                        <li>Backend endpoint: <code>/api/realtime/realtime-data</code></li>
                                        <li>Country: {selectedCountry}</li>
                                        <li>Response received: {realtimeData ? 'Yes' : 'No'}</li>
                                    </ul>
                                </div>
                                <div className="mt-4 pt-4 border-t border-grey-1">
                                    <p className="text-[0.75rem] font-inter text-grey-2">
                                        <strong>To enable full functionality:</strong>
                                    </p>
                                    <ul className="text-[0.75rem] font-inter text-grey-2 list-disc list-inside mt-2 space-y-1">
                                        <li>Configure API keys in environment variables</li>
                                        <li>Implement Worldometer web scraping</li>
                                        <li>Test API connections</li>
                                    </ul>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ) : isLoading ? (
                <div className="flex items-center justify-center py-20">
                    <span className="text-grey-2 text-[1rem] font-inter">Loading data...</span>
                </div>
            ) : countryDetailsError && viewMode === "hourly" ? (
                <div className="flex items-center justify-center py-20">
                    <div className="text-center">
                        <p className="text-red-500 text-[1rem] font-inter mb-2">Error loading country data</p>
                        <p className="text-grey-2 text-[0.875rem] font-inter">
                            {(countryDetailsError as any)?.data?.error || (countryDetailsError as any)?.message || "Unknown error"}
                        </p>
                        <p className="text-grey-2 text-[0.75rem] font-inter mt-2">
                            Make sure you have selected a country and year.
                        </p>
                    </div>
                </div>
            ) : (
                <>
                    {/* Key Metrics */}
                    <div className="mb-6">
                        <h2 className="text-[1.25rem] font-inter font-semibold text-black-1 mb-4">
                            {viewMode === "yearly" ? "Energy Yearly Energy Trends" : "Energy Overview"}
                        </h2>
                        <div className="flex flex-wrap gap-4">
                            <MetricCard
                                title="Total Generation"
                                value={metrics.totalGeneration}
                                unit={viewMode === "yearly" ? " TWh" : " MWh"}
                            />
                            <MetricCard
                                title="Total Demand"
                                value={metrics.totalDemand}
                                unit={viewMode === "yearly" ? " TWh" : " MWh"}
                            />
                            <MetricCard
                                title="Total Consumption"
                                value={metrics.totalConsumption}
                                unit={viewMode === "yearly" ? " TWh" : " MWh"}
                            />
                            <MetricCard
                                title="Renewable Share"
                                value={metrics.renewableShare}
                                unit="%"
                            />
                            <MetricCard
                                title="Energy Poverty"
                                value={metrics.energyPoverty}
                                unit="%"
                            />
                        </div>
                    </div>

                    {/* Charts Section - Two Column Layout */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {viewMode === "yearly" ? (
                            <YearlyCharts data={yearlyData?.data} />
                        ) : (
                            <>
                                {countryDetailsError && (
                                    <div className="col-span-2 bg-red-50 border border-red-200 rounded-[8px] p-4 mb-4">
                                        <p className="text-red-600 text-[0.875rem] font-inter font-semibold mb-2">
                                            Error loading country data:
                                        </p>
                                        <p className="text-red-500 text-[0.75rem] font-inter">
                                            {(countryDetailsError as any)?.data?.error || (countryDetailsError as any)?.message || 'Unknown error'}
                                        </p>
                                    </div>
                                )}
                                <HourlyCharts data={hourlyData} />
                            </>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

// Yearly Charts Component (from Map drawer)
const YearlyCharts = ({ data }: { data: any }) => {
    const chartRefs = {
        electricityAccess: useRef<SVGSVGElement>(null),
        co2Emission: useRef<SVGSVGElement>(null),
        population: useRef<SVGSVGElement>(null),
        cleanCooking: useRef<SVGSVGElement>(null),
        energyPoverty: useRef<SVGSVGElement>(null),
        electricityPerCapita: useRef<SVGSVGElement>(null),
        energyPovertyComparison: useRef<SVGSVGElement>(null),
        energyPovertyRuralUrban: useRef<SVGSVGElement>(null),
    };

    const containerRefs = {
        electricityAccess: useRef<HTMLDivElement>(null),
        co2Emission: useRef<HTMLDivElement>(null),
        population: useRef<HTMLDivElement>(null),
        cleanCooking: useRef<HTMLDivElement>(null),
        energyPoverty: useRef<HTMLDivElement>(null),
        electricityPerCapita: useRef<HTMLDivElement>(null),
        energyPovertyComparison: useRef<HTMLDivElement>(null),
        energyPovertyRuralUrban: useRef<HTMLDivElement>(null),
    };

    const [chartDimensions, setChartDimensions] = useState<Record<string, { width: number; height: number }>>({});

    // Observe container sizes
    useEffect(() => {
        if (!data) return;

        const updateDimensions = () => {
            const newDimensions: Record<string, { width: number; height: number }> = {};

            Object.keys(containerRefs).forEach((key) => {
                const container = containerRefs[key as keyof typeof containerRefs].current;
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

        Object.values(containerRefs).forEach(ref => {
            if (ref.current) {
                resizeObserver.observe(ref.current);
            }
        });

        window.addEventListener('resize', updateDimensions);

        return () => {
            clearTimeout(timer);
            resizeObserver.disconnect();
            window.removeEventListener('resize', updateDimensions);
        };
    }, [data]);

    // Render charts
    useEffect(() => {
        if (!data?.time_series || Object.keys(chartDimensions).length === 0) return;

        const margin = { top: 30, right: 30, bottom: 60, left: 70 };
        const timeSeries = data.time_series;

        // Create or select tooltip div
        let tooltip = d3.select("body").select<HTMLDivElement>(".chart-tooltip");
        if (tooltip.empty()) {
            tooltip = d3.select("body")
                .append("div")
                .attr("class", "chart-tooltip")
                .style("position", "absolute")
                .style("background", "rgba(0, 0, 0, 0.8)")
                .style("color", "white")
                .style("padding", "8px 12px")
                .style("border-radius", "4px")
                .style("font-size", "12px")
                .style("pointer-events", "none")
                .style("opacity", 0)
                .style("z-index", "1000")
                .style("font-family", "Inter, sans-serif");
        }

        // Electricity Demand & Generation Chart (from drawer)
        if (chartRefs.electricityAccess.current && timeSeries.length > 0) {
            const dims = chartDimensions.electricityAccess || { width: 500, height: 300 };
            const chartWidth = dims.width - margin.left - margin.right;
            const chartHeight = dims.height - margin.top - margin.bottom;

            const svg = d3.select(chartRefs.electricityAccess.current);
            svg.selectAll("*").remove();
            svg.attr("width", dims.width)
                .attr("height", dims.height)
                .attr("viewBox", `0 0 ${dims.width} ${dims.height}`)
                .attr("preserveAspectRatio", "xMidYMid meet");

            const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

            const yearExtent = d3.extent(timeSeries, (d: any) => d.year) as [number | undefined, number | undefined];
            const x = d3.scaleLinear()
                .domain(yearExtent[0] !== undefined && yearExtent[1] !== undefined
                    ? [yearExtent[0], yearExtent[1]] as [number, number]
                    : [0, 1])
                .range([0, chartWidth]);

            const y = d3.scaleLinear()
                .domain([0, d3.max(timeSeries, (d: any) => Math.max(
                    d.electricity_demand || 0,
                    d.electricity_generation || 0
                )) || 0] as [number, number])
                .range([chartHeight, 0]);

            // Demand line
            const demandLine = d3.line<typeof timeSeries[0]>()
                .x((d: any) => x(d.year))
                .y((d: any) => y(d.electricity_demand || 0))
                .curve(d3.curveMonotoneX);

            // Generation line
            const generationLine = d3.line<typeof timeSeries[0]>()
                .x((d: any) => x(d.year))
                .y((d: any) => y(d.electricity_generation || 0))
                .curve(d3.curveMonotoneX);

            // Add animated paths
            const demandPath = g.append("path")
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

            const generationPath = g.append("path")
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
            
            // X-axis with rotated labels
            const xAxis = g.append("g")
                .attr("transform", `translate(0,${chartHeight})`)
                .call(d3.axisBottom(x).tickValues(tickValues).tickFormat(d3.format("d")));

            xAxis.selectAll("text")
                .style("text-anchor", "end")
                .attr("dx", "-.8em")
                .attr("dy", ".15em")
                .attr("transform", "rotate(-45)");

            g.append("g")
                .call(d3.axisLeft(y));

            // Add hover circles for demand line
            g.selectAll(".demand-circle")
                .data(timeSeries.filter((d: any) => d.electricity_demand !== null && d.electricity_demand !== undefined))
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
                    tooltip.html(`Year: ${d.year}<br/>Demand: ${(d.electricity_demand || 0).toFixed(2)} TWh`)
                        .style("left", (event.pageX + 10) + "px")
                        .style("top", (event.pageY - 10) + "px");
                    d3.select(this).attr("r", 6).attr("opacity", 1);
                })
                .on("mouseout", function () {
                    tooltip.transition().duration(200).style("opacity", 0);
                    d3.select(this).attr("r", 4).attr("opacity", 0);
                });

            // Add hover circles for generation line
            g.selectAll(".generation-circle")
                .data(timeSeries.filter((d: any) => d.electricity_generation !== null && d.electricity_generation !== undefined))
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
                    tooltip.html(`Year: ${d.year}<br/>Generation: ${(d.electricity_generation || 0).toFixed(2)} TWh`)
                        .style("left", (event.pageX + 10) + "px")
                        .style("top", (event.pageY - 10) + "px");
                    d3.select(this).attr("r", 6).attr("opacity", 1);
                })
                .on("mouseout", function () {
                    tooltip.transition().duration(200).style("opacity", 0);
                    d3.select(this).attr("r", 4).attr("opacity", 0);
                });
        }

        // CO2 Emission Chart
        if (chartRefs.co2Emission.current && timeSeries.length > 0) {
            const dims = chartDimensions.co2Emission || { width: 500, height: 300 };
            const chartWidth = dims.width - margin.left - margin.right;
            const chartHeight = dims.height - margin.top - margin.bottom;

            const svg = d3.select(chartRefs.co2Emission.current);
            svg.selectAll("*").remove();
            svg.attr("width", dims.width)
                .attr("height", dims.height)
                .attr("viewBox", `0 0 ${dims.width} ${dims.height}`)
                .attr("preserveAspectRatio", "xMidYMid meet");

            const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

            const yearExtent = d3.extent(timeSeries, (d: any) => d.year) as [number | undefined, number | undefined];
            const x = d3.scaleLinear()
                .domain(yearExtent[0] !== undefined && yearExtent[1] !== undefined
                    ? [yearExtent[0], yearExtent[1]] as [number, number]
                    : [0, 1])
                .range([0, chartWidth]);

            const y = d3.scaleLinear()
                .domain([0, d3.max(timeSeries, (d: any) => d.carbon_intensity || 0) || 0] as [number, number])
                .range([chartHeight, 0]);

            const line = d3.line<typeof timeSeries[0]>()
                .x((d: any) => x(d.year))
                .y((d: any) => y(d.carbon_intensity || 0))
                .curve(d3.curveMonotoneX);

            const co2Path = g.append("path")
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
            
            // X-axis with rotated labels
            const xAxis = g.append("g")
                .attr("transform", `translate(0,${chartHeight})`)
                .call(d3.axisBottom(x).tickValues(tickValues).tickFormat(d3.format("d")));

            xAxis.selectAll("text")
                .style("text-anchor", "end")
                .attr("dx", "-.8em")
                .attr("dy", ".15em")
                .attr("transform", "rotate(-45)");

            g.append("g")
                .call(d3.axisLeft(y));

            // Add hover circles
            g.selectAll(".co2-circle")
                .data(timeSeries.filter((d: any) => d.carbon_intensity !== null && d.carbon_intensity !== undefined))
                .enter()
                .append("circle")
                .attr("class", "co2-circle")
                .attr("cx", (d: any) => x(d.year))
                .attr("cy", (d: any) => y(d.carbon_intensity || 0))
                .attr("r", 4)
                .attr("fill", "#DC2626")
                .attr("opacity", 0)
                .style("cursor", "pointer")
                .on("mouseover", function (event, d: any) {
                    tooltip.transition().duration(200).style("opacity", 1);
                    tooltip.html(`Year: ${d.year}<br/>CO₂ Intensity: ${(d.carbon_intensity || 0).toFixed(2)} gCO₂/kWh`)
                        .style("left", (event.pageX + 10) + "px")
                        .style("top", (event.pageY - 10) + "px");
                    d3.select(this).attr("r", 6).attr("opacity", 1);
                })
                .on("mouseout", function () {
                    tooltip.transition().duration(200).style("opacity", 0);
                    d3.select(this).attr("r", 4).attr("opacity", 0);
                });
        }

        // Population Chart
        if (chartRefs.population.current && timeSeries.length > 0) {
            const dims = chartDimensions.population || { width: 500, height: 300 };
            const chartWidth = dims.width - margin.left - margin.right;
            const chartHeight = dims.height - margin.top - margin.bottom;

            const svg = d3.select(chartRefs.population.current);
            svg.selectAll("*").remove();
            svg.attr("width", dims.width)
                .attr("height", dims.height)
                .attr("viewBox", `0 0 ${dims.width} ${dims.height}`)
                .attr("preserveAspectRatio", "xMidYMid meet");

            const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

            const yearExtent = d3.extent(timeSeries, (d: any) => d.year) as [number | undefined, number | undefined];
            const x = d3.scaleLinear()
                .domain(yearExtent[0] !== undefined && yearExtent[1] !== undefined
                    ? [yearExtent[0], yearExtent[1]] as [number, number]
                    : [0, 1])
                .range([0, chartWidth]);

            const y = d3.scaleLinear()
                .domain([0, d3.max(timeSeries, (d: any) => (d.population || 0) / 1000000) || 0] as [number, number])
                .range([chartHeight, 0]);

            const area = d3.area<typeof timeSeries[0]>()
                .x((d: any) => x(d.year))
                .y0(chartHeight)
                .y1((d: any) => y((d.population || 0) / 1000000))
                .curve(d3.curveMonotoneX);

            const areaPath = g.append("path")
                .datum(timeSeries)
                .attr("fill", "#9333EA")
                .attr("fill-opacity", 0)
                .attr("d", area)
                .transition()
                .duration(1500)
                .ease(d3.easeCubicInOut)
                .attr("fill-opacity", 0.6);

            // Calculate year ticks
            const years = timeSeries.map((d: any) => d.year);
            const { tickValues } = calculateYearTicks(years);
            
            // X-axis with rotated labels
            const xAxis = g.append("g")
                .attr("transform", `translate(0,${chartHeight})`)
                .call(d3.axisBottom(x).tickValues(tickValues).tickFormat(d3.format("d")));

            xAxis.selectAll("text")
                .style("text-anchor", "end")
                .attr("dx", "-.8em")
                .attr("dy", ".15em")
                .attr("transform", "rotate(-45)");

            g.append("g")
                .call(d3.axisLeft(y));

            // Add hover circles for area chart
            g.selectAll(".population-circle")
                .data(timeSeries.filter((d: any) => d.population !== null && d.population !== undefined))
                .enter()
                .append("circle")
                .attr("class", "population-circle")
                .attr("cx", (d: any) => x(d.year))
                .attr("cy", (d: any) => y((d.population || 0) / 1000000))
                .attr("r", 4)
                .attr("fill", "#9333EA")
                .attr("opacity", 0)
                .style("cursor", "pointer")
                .on("mouseover", function (event, d: any) {
                    tooltip.transition().duration(200).style("opacity", 1);
                    const popMillions = (d.population || 0) / 1000000;
                    tooltip.html(`Year: ${d.year}<br/>Population: ${popMillions.toFixed(2)}M`)
                        .style("left", (event.pageX + 10) + "px")
                        .style("top", (event.pageY - 10) + "px");
                    d3.select(this).attr("r", 6).attr("opacity", 1);
                })
                .on("mouseout", function () {
                    tooltip.transition().duration(200).style("opacity", 0);
                    d3.select(this).attr("r", 4).attr("opacity", 0);
                });
        }

        // Clean Cooking Access Chart (Stacked Bar)
        if (chartRefs.cleanCooking.current && timeSeries.length > 0) {
            const dims = chartDimensions.cleanCooking || { width: 500, height: 300 };
            const chartWidth = dims.width - margin.left - margin.right;
            const chartHeight = dims.height - margin.top - margin.bottom;

            const svg = d3.select(chartRefs.cleanCooking.current);
            svg.selectAll("*").remove();
            svg.attr("width", dims.width)
                .attr("height", dims.height)
                .attr("viewBox", `0 0 ${dims.width} ${dims.height}`)
                .attr("preserveAspectRatio", "xMidYMid meet");

            const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

            // Filter to most recent 16 years and calculate tick values
            const allYears = timeSeries.map((d: any) => d.year);
            const { tickValues } = calculateYearTicks(allYears);
            
            // Filter time series to only show years in tickValues (max 16)
            const filteredTimeSeries = timeSeries.filter((d: any) => tickValues.includes(d.year));
            const uniqueYears = tickValues;

            const x = d3.scaleBand()
                .domain(uniqueYears.map((yr: any) => yr.toString()))
                .range([0, chartWidth])
                .padding(0.2);

            const y = d3.scaleLinear()
                .domain([0, 100])
                .range([chartHeight, 0]);

            filteredTimeSeries.forEach((d: any, i: number) => {
                const clean = d.clean_cooking_access || 0;
                const traditional = 100 - clean;

                const cleanRect = g.append("rect")
                    .attr("x", x(d.year.toString()) || 0)
                    .attr("y", y(100))
                    .attr("width", x.bandwidth())
                    .attr("height", 0)
                    .attr("fill", "#10B981")
                    .style("cursor", "pointer")
                    .on("mouseover", function (event) {
                        tooltip.transition().duration(200).style("opacity", 1);
                        tooltip.html(`Year: ${d.year}<br/>Clean: ${clean.toFixed(1)}%<br/>Traditional: ${traditional.toFixed(1)}%`)
                            .style("left", (event.pageX + 10) + "px")
                            .style("top", (event.pageY - 10) + "px");
                        d3.select(this).attr("opacity", 0.8);
                    })
                    .on("mouseout", function () {
                        tooltip.transition().duration(200).style("opacity", 0);
                        d3.select(this).attr("opacity", 1);
                    })
                    .transition()
                    .duration(800)
                    .delay(i * 100)
                    .ease(d3.easeCubicInOut)
                    .attr("y", y(clean))
                    .attr("height", chartHeight - y(clean));

                const traditionalRect = g.append("rect")
                    .attr("x", x(d.year.toString()) || 0)
                    .attr("y", y(100))
                    .attr("width", x.bandwidth())
                    .attr("height", 0)
                    .attr("fill", "#F97316")
                    .style("cursor", "pointer")
                    .on("mouseover", function (event) {
                        tooltip.transition().duration(200).style("opacity", 1);
                        tooltip.html(`Year: ${d.year}<br/>Clean: ${clean.toFixed(1)}%<br/>Traditional: ${traditional.toFixed(1)}%`)
                            .style("left", (event.pageX + 10) + "px")
                            .style("top", (event.pageY - 10) + "px");
                        d3.select(this).attr("opacity", 0.8);
                    })
                    .on("mouseout", function () {
                        tooltip.transition().duration(200).style("opacity", 0);
                        d3.select(this).attr("opacity", 1);
                    })
                    .transition()
                    .duration(800)
                    .delay(i * 100 + 50)
                    .ease(d3.easeCubicInOut)
                    .attr("height", chartHeight - y(traditional));
            });

            // X-axis with rotated labels (full year)
            const xAxis = g.append("g")
                .attr("transform", `translate(0,${chartHeight})`)
                .call(d3.axisBottom(x).tickValues(uniqueYears.map((y: any) => y.toString())));

            xAxis.selectAll("text")
                .style("text-anchor", "end")
                .attr("dx", "-.8em")
                .attr("dy", ".15em")
                .attr("transform", "rotate(-45)");

            g.append("g")
                .call(d3.axisLeft(y));
        }

        // Energy Poverty Chart (Bar Chart)
        if (chartRefs.energyPoverty.current && timeSeries.length > 0) {
            const dims = chartDimensions.energyPoverty || { width: 500, height: 300 };
            const chartWidth = dims.width - margin.left - margin.right;
            const chartHeight = dims.height - margin.top - margin.bottom;

            const svg = d3.select(chartRefs.energyPoverty.current);
            svg.selectAll("*").remove();
            svg.attr("width", dims.width)
                .attr("height", dims.height)
                .attr("viewBox", `0 0 ${dims.width} ${dims.height}`)
                .attr("preserveAspectRatio", "xMidYMid meet");

            const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

            // Filter to most recent 16 years and calculate tick values
            const allYears = timeSeries.map((d: any) => d.year);
            const { tickValues } = calculateYearTicks(allYears);
            
            // Filter time series to only show years in tickValues (max 16)
            const filteredTimeSeries = timeSeries.filter((d: any) => tickValues.includes(d.year));
            const uniqueYears = tickValues;

            const x = d3.scaleBand()
                .domain(uniqueYears.map((yr: any) => yr.toString()))
                .range([0, chartWidth])
                .padding(0.2);

            const y = d3.scaleLinear()
                .domain([0, 100])
                .range([chartHeight, 0]);

            filteredTimeSeries.forEach((d: any, i: number) => {
                g.append("rect")
                    .attr("x", x(d.year.toString()) || 0)
                    .attr("y", chartHeight)
                    .attr("width", x.bandwidth())
                    .attr("height", 0)
                    .attr("fill", "#DC2626")
                    .style("cursor", "pointer")
                    .on("mouseover", function (event) {
                        tooltip.transition().duration(200).style("opacity", 1);
                        tooltip.html(`Year: ${d.year}<br/>Energy Poverty: ${(d.energy_poverty || 0).toFixed(1)}%`)
                            .style("left", (event.pageX + 10) + "px")
                            .style("top", (event.pageY - 10) + "px");
                        d3.select(this).attr("opacity", 0.8);
                    })
                    .on("mouseout", function () {
                        tooltip.transition().duration(200).style("opacity", 0);
                        d3.select(this).attr("opacity", 1);
                    })
                    .transition()
                    .duration(800)
                    .delay(i * 100)
                    .ease(d3.easeCubicInOut)
                    .attr("y", y(d.energy_poverty || 0))
                    .attr("height", chartHeight - y(d.energy_poverty || 0));
            });

            // X-axis with rotated labels (full year)
            const xAxis = g.append("g")
                .attr("transform", `translate(0,${chartHeight})`)
                .call(d3.axisBottom(x).tickValues(uniqueYears.map((y: any) => y.toString())));

            xAxis.selectAll("text")
                .style("text-anchor", "end")
                .attr("dx", "-.8em")
                .attr("dy", ".15em")
                .attr("transform", "rotate(-45)");

            g.append("g")
                .call(d3.axisLeft(y));
        }

        // Electricity Per Capita Chart
        if (chartRefs.electricityPerCapita.current && timeSeries.length > 0) {
            const dims = chartDimensions.electricityPerCapita || { width: 500, height: 300 };
            const chartWidth = dims.width - margin.left - margin.right;
            const chartHeight = dims.height - margin.top - margin.bottom;

            const svg = d3.select(chartRefs.electricityPerCapita.current);
            svg.selectAll("*").remove();
            svg.attr("width", dims.width)
                .attr("height", dims.height)
                .attr("viewBox", `0 0 ${dims.width} ${dims.height}`)
                .attr("preserveAspectRatio", "xMidYMid meet");

            const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

            const yearExtent = d3.extent(timeSeries, (d: any) => d.year) as [number | undefined, number | undefined];
            const x = d3.scaleLinear()
                .domain(yearExtent[0] !== undefined && yearExtent[1] !== undefined
                    ? [yearExtent[0], yearExtent[1]] as [number, number]
                    : [0, 1])
                .range([0, chartWidth]);

            const y = d3.scaleLinear()
                .domain([0, d3.max(timeSeries, (d: any) => Math.max(
                    d.electricity_demand_per_capita || 0,
                    d.electricity_demand_per_capita_with_access || 0
                )) || 0] as [number, number])
                .range([chartHeight, 0]);

            const perCapitaLine = d3.line<typeof timeSeries[0]>()
                .x((d: any) => x(d.year))
                .y((d: any) => y(d.electricity_demand_per_capita || 0))
                .curve(d3.curveMonotoneX);

            const withAccessLine = d3.line<typeof timeSeries[0]>()
                .x((d: any) => x(d.year))
                .y((d: any) => y(d.electricity_demand_per_capita_with_access || 0))
                .curve(d3.curveMonotoneX);

            const perCapitaPath = g.append("path")
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

            const withAccessPath = g.append("path")
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
            
            // X-axis with rotated labels
            const xAxis = g.append("g")
                .attr("transform", `translate(0,${chartHeight})`)
                .call(d3.axisBottom(x).tickValues(tickValues).tickFormat(d3.format("d")));

            xAxis.selectAll("text")
                .style("text-anchor", "end")
                .attr("dx", "-.8em")
                .attr("dy", ".15em")
                .attr("transform", "rotate(-45)");

            g.append("g")
                .call(d3.axisLeft(y));

            // Add hover circles for per capita line
            g.selectAll(".per-capita-circle")
                .data(timeSeries.filter((d: any) => d.electricity_demand_per_capita !== null && d.electricity_demand_per_capita !== undefined))
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
                    tooltip.html(`Year: ${d.year}<br/>Per Capita: ${(d.electricity_demand_per_capita || 0).toFixed(0)} kWh`)
                        .style("left", (event.pageX + 10) + "px")
                        .style("top", (event.pageY - 10) + "px");
                    d3.select(this).attr("r", 6).attr("opacity", 1);
                })
                .on("mouseout", function () {
                    tooltip.transition().duration(200).style("opacity", 0);
                    d3.select(this).attr("r", 4).attr("opacity", 0);
                });

            // Add hover circles for with access line
            g.selectAll(".with-access-circle")
                .data(timeSeries.filter((d: any) => d.electricity_demand_per_capita_with_access !== null && d.electricity_demand_per_capita_with_access !== undefined))
                .enter()
                .append("circle")
                .attr("class", "with-access-circle")
                .attr("cx", (d: any) => x(d.year))
                .attr("cy", (d: any) => y(d.electricity_demand_per_capita_with_access || 0))
                .attr("r", 4)
                .attr("fill", "#1E3A8A")
                .attr("opacity", 0)
                .style("cursor", "pointer")
                .on("mouseover", function (event, d: any) {
                    tooltip.transition().duration(200).style("opacity", 1);
                    tooltip.html(`Year: ${d.year}<br/>Per Capita (with Access): ${(d.electricity_demand_per_capita_with_access || 0).toFixed(0)} kWh`)
                        .style("left", (event.pageX + 10) + "px")
                        .style("top", (event.pageY - 10) + "px");
                    d3.select(this).attr("r", 6).attr("opacity", 1);
                })
                .on("mouseout", function () {
                    tooltip.transition().duration(200).style("opacity", 0);
                    d3.select(this).attr("r", 4).attr("opacity", 0);
                });
        }

        // Energy Poverty Comparison Chart (Electricity vs Multidimensional)
        if (chartRefs.energyPovertyComparison.current && timeSeries.length > 0) {
            const dims = chartDimensions.energyPovertyComparison || { width: 500, height: 300 };
            const chartWidth = dims.width - margin.left - margin.right;
            const chartHeight = dims.height - margin.top - margin.bottom;

            const svg = d3.select(chartRefs.energyPovertyComparison.current);
            svg.selectAll("*").remove();
            svg.attr("width", dims.width)
                .attr("height", dims.height)
                .attr("viewBox", `0 0 ${dims.width} ${dims.height}`)
                .attr("preserveAspectRatio", "xMidYMid meet");

            const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

            const yearExtent = d3.extent(timeSeries, (d: any) => d.year) as [number | undefined, number | undefined];
            const x = d3.scaleLinear()
                .domain(yearExtent[0] !== undefined && yearExtent[1] !== undefined
                    ? [yearExtent[0], yearExtent[1]] as [number, number]
                    : [0, 1])
                .range([0, chartWidth]);

            // Calculate max value from both series
            const maxValue = d3.max(timeSeries, (d: any) =>
                Math.max(
                    d.energy_poverty || 0,
                    d.energy_poverty_multidimensional || 0
                )
            ) || 100;

            const y = d3.scaleLinear()
                .domain([0, Math.max(100, maxValue)])
                .range([chartHeight, 0]);

            const electricityLine = d3.line<typeof timeSeries[0]>()
                .x((d: any) => x(d.year))
                .y((d: any) => y(d.energy_poverty || 0))
                .defined((d: any) => d.energy_poverty !== null && d.energy_poverty !== undefined)
                .curve(d3.curveMonotoneX);

            const multidimensionalLine = d3.line<typeof timeSeries[0]>()
                .x((d: any) => x(d.year))
                .y((d: any) => y(d.energy_poverty_multidimensional || 0))
                .defined((d: any) => d.energy_poverty_multidimensional !== null && d.energy_poverty_multidimensional !== undefined)
                .curve(d3.curveMonotoneX);

            const electricityPath = g.append("path")
                .datum(timeSeries)
                .attr("fill", "none")
                .attr("stroke", "#DC2626")
                .attr("stroke-width", 2)
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
                .ease(d3.easeCubicInOut)
                .attr("stroke-dashoffset", 0);

            const multidimensionalPath = g.append("path")
                .datum(timeSeries)
                .attr("fill", "none")
                .attr("stroke", "#9333EA")
                .attr("stroke-width", 2)
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
                .delay(200)
                .ease(d3.easeCubicInOut)
                .attr("stroke-dashoffset", 0);

            // Calculate year ticks
            const years = timeSeries.map((d: any) => d.year);
            const { tickValues } = calculateYearTicks(years);
            
            // X-axis with rotated labels
            const xAxis = g.append("g")
                .attr("transform", `translate(0,${chartHeight})`)
                .call(d3.axisBottom(x).tickValues(tickValues).tickFormat(d3.format("d")));

            xAxis.selectAll("text")
                .style("text-anchor", "end")
                .attr("dx", "-.8em")
                .attr("dy", ".15em")
                .attr("transform", "rotate(-45)");

            g.append("g")
                .call(d3.axisLeft(y));

            // Add hover circles for electricity line
            g.selectAll(".ep-electricity-circle")
                .data(timeSeries.filter((d: any) => d.energy_poverty !== null && d.energy_poverty !== undefined))
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
                    tooltip.html(`Year: ${d.year}<br/>Electricity: ${(d.energy_poverty || 0).toFixed(1)}%`)
                        .style("left", (event.pageX + 10) + "px")
                        .style("top", (event.pageY - 10) + "px");
                    d3.select(this).attr("r", 6).attr("opacity", 1);
                })
                .on("mouseout", function () {
                    tooltip.transition().duration(200).style("opacity", 0);
                    d3.select(this).attr("r", 4).attr("opacity", 0);
                });

            // Add hover circles for multidimensional line
            g.selectAll(".ep-multidimensional-circle")
                .data(timeSeries.filter((d: any) => d.energy_poverty_multidimensional !== null && d.energy_poverty_multidimensional !== undefined))
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
                    tooltip.html(`Year: ${d.year}<br/>Multidimensional: ${(d.energy_poverty_multidimensional || 0).toFixed(1)}%`)
                        .style("left", (event.pageX + 10) + "px")
                        .style("top", (event.pageY - 10) + "px");
                    d3.select(this).attr("r", 6).attr("opacity", 1);
                })
                .on("mouseout", function () {
                    tooltip.transition().duration(200).style("opacity", 0);
                    d3.select(this).attr("r", 4).attr("opacity", 0);
                });
        }

        // Energy Poverty Rural vs Urban Chart
        if (chartRefs.energyPovertyRuralUrban.current && timeSeries.length > 0) {
            const dims = chartDimensions.energyPovertyRuralUrban || { width: 500, height: 300 };
            const chartWidth = dims.width - margin.left - margin.right;
            const chartHeight = dims.height - margin.top - margin.bottom;

            const svg = d3.select(chartRefs.energyPovertyRuralUrban.current);
            svg.selectAll("*").remove();
            svg.attr("width", dims.width)
                .attr("height", dims.height)
                .attr("viewBox", `0 0 ${dims.width} ${dims.height}`)
                .attr("preserveAspectRatio", "xMidYMid meet");

            const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

            const yearExtent = d3.extent(timeSeries, (d: any) => d.year) as [number | undefined, number | undefined];
            const x = d3.scaleLinear()
                .domain(yearExtent[0] !== undefined && yearExtent[1] !== undefined
                    ? [yearExtent[0], yearExtent[1]] as [number, number]
                    : [0, 1])
                .range([0, chartWidth]);

            // Calculate max value from both series
            const maxValue = d3.max(timeSeries, (d: any) =>
                Math.max(
                    d.energy_poverty_rural || 0,
                    d.energy_poverty_urban || 0
                )
            ) || 100;

            const y = d3.scaleLinear()
                .domain([0, Math.max(100, maxValue)])
                .range([chartHeight, 0]);

            const ruralLine = d3.line<typeof timeSeries[0]>()
                .x((d: any) => x(d.year))
                .y((d: any) => y(d.energy_poverty_rural || 0))
                .defined((d: any) => d.energy_poverty_rural !== null && d.energy_poverty_rural !== undefined)
                .curve(d3.curveMonotoneX);

            const urbanLine = d3.line<typeof timeSeries[0]>()
                .x((d: any) => x(d.year))
                .y((d: any) => y(d.energy_poverty_urban || 0))
                .defined((d: any) => d.energy_poverty_urban !== null && d.energy_poverty_urban !== undefined)
                .curve(d3.curveMonotoneX);

            const ruralPath = g.append("path")
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

            const urbanPath = g.append("path")
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
            
            // X-axis with rotated labels
            const xAxis = g.append("g")
                .attr("transform", `translate(0,${chartHeight})`)
                .call(d3.axisBottom(x).tickValues(tickValues).tickFormat(d3.format("d")));

            xAxis.selectAll("text")
                .style("text-anchor", "end")
                .attr("dx", "-.8em")
                .attr("dy", ".15em")
                .attr("transform", "rotate(-45)");

            g.append("g")
                .call(d3.axisLeft(y));

            // Add hover circles for rural line
            g.selectAll(".ep-rural-circle")
                .data(timeSeries.filter((d: any) => d.energy_poverty_rural !== null && d.energy_poverty_rural !== undefined))
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
                    tooltip.html(`Year: ${d.year}<br/>Rural: ${(d.energy_poverty_rural || 0).toFixed(1)}%`)
                        .style("left", (event.pageX + 10) + "px")
                        .style("top", (event.pageY - 10) + "px");
                    d3.select(this).attr("r", 6).attr("opacity", 1);
                })
                .on("mouseout", function () {
                    tooltip.transition().duration(200).style("opacity", 0);
                    d3.select(this).attr("r", 4).attr("opacity", 0);
                });

            // Add hover circles for urban line
            g.selectAll(".ep-urban-circle")
                .data(timeSeries.filter((d: any) => d.energy_poverty_urban !== null && d.energy_poverty_urban !== undefined))
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
                    tooltip.html(`Year: ${d.year}<br/>Urban: ${(d.energy_poverty_urban || 0).toFixed(1)}%`)
                        .style("left", (event.pageX + 10) + "px")
                        .style("top", (event.pageY - 10) + "px");
                    d3.select(this).attr("r", 6).attr("opacity", 1);
                })
                .on("mouseout", function () {
                    tooltip.transition().duration(200).style("opacity", 0);
                    d3.select(this).attr("r", 4).attr("opacity", 0);
                });
        }

        // Cleanup tooltip on unmount
        return () => {
            d3.select("body").select(".chart-tooltip").remove();
        };

    }, [data, chartDimensions]);

    if (!data?.time_series || data.time_series.length === 0) {
        return (
            <div className="col-span-2">
                <p className="text-grey-2">No yearly data available</p>
            </div>
        );
    }

    return (
        <>
            <ChartCard title="Electricity Demand & Generation (TWh)">
                <div ref={containerRefs.electricityAccess} className="w-full">
                    <svg ref={chartRefs.electricityAccess} className="w-full h-auto"></svg>
                </div>
                <div className="flex gap-4 mt-2 text-[0.75rem] font-inter">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-blue-1"></div>
                        <span className="text-grey-2">Demand</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-green-500"></div>
                        <span className="text-grey-2">Generation</span>
                    </div>
                </div>
            </ChartCard>

            <ChartCard title="CO2 Emission per Capita (gCO₂/kWh)">
                <div ref={containerRefs.co2Emission} className="w-full">
                    <svg ref={chartRefs.co2Emission} className="w-full h-auto"></svg>
                </div>
            </ChartCard>

            <ChartCard title="Population (Millions)">
                <div ref={containerRefs.population} className="w-full">
                    <svg ref={chartRefs.population} className="w-full h-auto"></svg>
                </div>
            </ChartCard>

            <ChartCard title="Clean Cooking Access (%)">
                <div ref={containerRefs.cleanCooking} className="w-full">
                    <svg ref={chartRefs.cleanCooking} className="w-full h-auto"></svg>
                </div>
                <div className="flex gap-4 mt-2 text-[0.75rem] font-inter">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-green-500"></div>
                        <span className="text-grey-2">Clean</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3" style={{ backgroundColor: '#F97316' }}></div>
                        <span className="text-grey-2">Traditional</span>
                    </div>
                </div>
            </ChartCard>

            <ChartCard title="Energy Poverty Index (%)">
                <div ref={containerRefs.energyPoverty} className="w-full">
                    <svg ref={chartRefs.energyPoverty} className="w-full h-auto"></svg>
                </div>
            </ChartCard>

            <ChartCard title="Electricity Per Capita (kWh/year)">
                <div ref={containerRefs.electricityPerCapita} className="w-full">
                    <svg ref={chartRefs.electricityPerCapita} className="w-full h-auto"></svg>
                </div>
                <div className="flex gap-4 mt-2 text-[0.75rem] font-inter">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3" style={{ backgroundColor: '#9333EA' }}></div>
                        <span className="text-grey-2">Per capita</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-blue-1"></div>
                        <span className="text-grey-2">Per capita (with Access)</span>
                    </div>
                </div>
            </ChartCard>

            <ChartCard title="Energy Poverty Comparison (%)">
                <div ref={containerRefs.energyPovertyComparison} className="w-full">
                    <svg ref={chartRefs.energyPovertyComparison} className="w-full h-auto"></svg>
                </div>
                <div className="flex gap-4 mt-2 text-[0.75rem] font-inter">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3" style={{ backgroundColor: '#DC2626' }}></div>
                        <span className="text-grey-2">Electricity</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3" style={{ backgroundColor: '#9333EA' }}></div>
                        <span className="text-grey-2">Multidimensional</span>
                    </div>
                </div>
            </ChartCard>

            <ChartCard title="Energy Poverty: Rural vs Urban (%)">
                <div ref={containerRefs.energyPovertyRuralUrban} className="w-full">
                    <svg ref={chartRefs.energyPovertyRuralUrban} className="w-full h-auto"></svg>
                </div>
                <div className="flex gap-4 mt-2 text-[0.75rem] font-inter">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3" style={{ backgroundColor: '#F97316' }}></div>
                        <span className="text-grey-2">Rural</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-green-500"></div>
                        <span className="text-grey-2">Urban</span>
                    </div>
                </div>
            </ChartCard>
        </>
    );
};

// Hourly Charts Component
const HourlyCharts = ({ data }: { data: any }) => {
    const chartRefs = {
        hourlyDemand: useRef<SVGSVGElement>(null),
        perCapitaDemand: useRef<SVGSVGElement>(null),
    };

    const containerRefs = {
        hourlyDemand: useRef<HTMLDivElement>(null),
        perCapitaDemand: useRef<HTMLDivElement>(null),
    };

    const [chartDimensions, setChartDimensions] = useState<Record<string, { width: number; height: number }>>({});

    // Observe container sizes
    useEffect(() => {
        if (!data) return;

        const updateDimensions = () => {
            const newDimensions: Record<string, { width: number; height: number }> = {};

            Object.keys(containerRefs).forEach((key) => {
                const container = containerRefs[key as keyof typeof containerRefs].current;
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

        Object.values(containerRefs).forEach(ref => {
            if (ref.current) {
                resizeObserver.observe(ref.current);
            }
        });

        window.addEventListener('resize', updateDimensions);

        return () => {
            clearTimeout(timer);
            resizeObserver.disconnect();
            window.removeEventListener('resize', updateDimensions);
        };
    }, [data]);

    // Render charts
    useEffect(() => {
        // Backend returns: { success: true, data: [...], metadata: {...} }
        // RTK Query wraps it: { data: { success: true, data: [...], metadata: {...} } }
        // So data.data.data is the array, or data.data if it's already unwrapped
        const hourlyRecords = data?.data?.data || data?.data || [];

        if (!Array.isArray(hourlyRecords) || hourlyRecords.length === 0 || Object.keys(chartDimensions).length === 0) {
            console.log('HourlyCharts render effect: No data or dimensions', {
                hasData: !!data,
                recordsLength: Array.isArray(hourlyRecords) ? hourlyRecords.length : 0,
                dimensionsKeys: Object.keys(chartDimensions).length,
                dataStructure: data ? Object.keys(data) : null,
                dataDataStructure: data?.data ? (Array.isArray(data.data) ? 'array' : Object.keys(data.data)) : null
            });
            return;
        }

        const margin = { top: 30, right: 30, bottom: 60, left: 70 };

        // Create or select tooltip div
        let tooltip = d3.select("body").select<HTMLDivElement>(".chart-tooltip");
        if (tooltip.empty()) {
            tooltip = d3.select("body")
                .append("div")
                .attr("class", "chart-tooltip")
                .style("position", "absolute")
                .style("background", "rgba(0, 0, 0, 0.8)")
                .style("color", "white")
                .style("padding", "8px 12px")
                .style("border-radius", "4px")
                .style("font-size", "12px")
                .style("pointer-events", "none")
                .style("opacity", 0)
                .style("z-index", "1000")
                .style("font-family", "Inter, sans-serif");
        }

        // Parse datetime and prepare data
        const parsedData = hourlyRecords.map((record: any) => ({
            datetime: new Date(record.datetime),
            demand: record.electricity_demand_MWh || 0,
            perCapita: record.electricity_demand_per_capita_kWh || 0,
            perCapitaWithAccess: record.electricity_demand_per_capita_with_access_kWh || 0,
        }));

        // Electricity Demand Chart
        if (chartRefs.hourlyDemand.current && parsedData.length > 0) {
            const dims = chartDimensions.hourlyDemand || { width: 500, height: 300 };
            const chartWidth = dims.width - margin.left - margin.right;
            const chartHeight = dims.height - margin.top - margin.bottom;

            const svg = d3.select(chartRefs.hourlyDemand.current);
            svg.selectAll("*").remove();
            svg.attr("width", dims.width)
                .attr("height", dims.height)
                .attr("viewBox", `0 0 ${dims.width} ${dims.height}`)
                .attr("preserveAspectRatio", "xMidYMid meet");

            const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

            const dateExtent = d3.extent(parsedData, (d: typeof parsedData[0]) => d.datetime) as [Date | undefined, Date | undefined];
            const x = d3.scaleTime()
                .domain(dateExtent[0] && dateExtent[1] ? [dateExtent[0], dateExtent[1]] as [Date, Date] : [new Date(), new Date()])
                .range([0, chartWidth]);

            const y = d3.scaleLinear()
                .domain([0, d3.max(parsedData, (d: typeof parsedData[0]) => d.demand) || 0] as [number, number])
                .range([chartHeight, 0]);

            // Area chart for demand
            const area = d3.area<typeof parsedData[0]>()
                .x(d => x(d.datetime))
                .y0(chartHeight)
                .y1(d => y(d.demand))
                .curve(d3.curveMonotoneX);

            // Line chart for demand
            const demandLine = d3.line<typeof parsedData[0]>()
                .x(d => x(d.datetime))
                .y(d => y(d.demand))
                .curve(d3.curveMonotoneX);

            // Add area chart
            g.append("path")
                .datum(parsedData)
                .attr("fill", "#1E3A8A")
                .attr("fill-opacity", 0.3)
                .attr("d", area);

            // Add line chart
            g.append("path")
                .datum(parsedData)
                .attr("fill", "none")
                .attr("stroke", "#1E3A8A")
                .attr("stroke-width", 2)
                .attr("d", demandLine);

            // X-axis with time format
            const timeFormat = d3.timeFormat("%H:%M");
            const xAxis = g.append("g")
                .attr("transform", `translate(0,${chartHeight})`)
                .call(d3.axisBottom(x).tickFormat((d) => {
                    if (d instanceof Date) {
                        return timeFormat(d);
                    }
                    return "";
                }));

            g.append("g")
                .call(d3.axisLeft(y));

            g.append("text")
                .attr("transform", "rotate(-90)")
                .attr("y", 0 - margin.left)
                .attr("x", 0 - (chartHeight / 2))
                .attr("dy", "1em")
                .style("text-anchor", "middle")
                .style("font-size", "12px")
                .style("fill", "#666")
                .text("Demand (MWh)");
        }

        // Electricity Per Capita Chart
        if (chartRefs.perCapitaDemand.current && parsedData.length > 0) {
            const dims = chartDimensions.perCapitaDemand || { width: 500, height: 300 };
            const chartWidth = dims.width - margin.left - margin.right;
            const chartHeight = dims.height - margin.top - margin.bottom;

            const svg = d3.select(chartRefs.perCapitaDemand.current);
            svg.selectAll("*").remove();
            svg.attr("width", dims.width)
                .attr("height", dims.height)
                .attr("viewBox", `0 0 ${dims.width} ${dims.height}`)
                .attr("preserveAspectRatio", "xMidYMid meet");

            const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

            const dateExtent2 = d3.extent(parsedData, (d: typeof parsedData[0]) => d.datetime) as [Date | undefined, Date | undefined];
            const x = d3.scaleTime()
                .domain(dateExtent2[0] && dateExtent2[1] ? [dateExtent2[0], dateExtent2[1]] as [Date, Date] : [new Date(), new Date()])
                .range([0, chartWidth]);

            const y = d3.scaleLinear()
                .domain([0, d3.max(parsedData, (d: typeof parsedData[0]) => Math.max(d.perCapita, d.perCapitaWithAccess)) || 0] as [number, number])
                .range([chartHeight, 0]);

            const perCapitaLine = d3.line<typeof parsedData[0]>()
                .x(d => x(d.datetime))
                .y(d => y(d.perCapita))
                .curve(d3.curveMonotoneX);

            const withAccessLine = d3.line<typeof parsedData[0]>()
                .x(d => x(d.datetime))
                .y(d => y(d.perCapitaWithAccess))
                .curve(d3.curveMonotoneX);

            g.append("path")
                .datum(parsedData)
                .attr("fill", "none")
                .attr("stroke", "#9333EA")
                .attr("stroke-width", 2)
                .attr("d", perCapitaLine);

            g.append("path")
                .datum(parsedData)
                .attr("fill", "none")
                .attr("stroke", "#1E3A8A")
                .attr("stroke-width", 2)
                .attr("d", withAccessLine);

            // Add legend
            const legend = g.append("g")
                .attr("transform", `translate(${chartWidth - 150}, 20)`);

            legend.append("line")
                .attr("x1", 0)
                .attr("x2", 20)
                .attr("y1", 0)
                .attr("y2", 0)
                .attr("stroke", "#9333EA")
                .attr("stroke-width", 2);

            legend.append("text")
                .attr("x", 25)
                .attr("y", 4)
                .style("font-size", "11px")
                .style("fill", "#666")
                .text("Per Capita");

            legend.append("line")
                .attr("x1", 0)
                .attr("x2", 20)
                .attr("y1", 15)
                .attr("y2", 15)
                .attr("stroke", "#1E3A8A")
                .attr("stroke-width", 2);

            legend.append("text")
                .attr("x", 25)
                .attr("y", 19)
                .style("font-size", "11px")
                .style("fill", "#666")
                .text("With Access");

            // X-axis with time format
            const timeFormat2 = d3.timeFormat("%H:%M");
            const xAxis2 = g.append("g")
                .attr("transform", `translate(0,${chartHeight})`)
                .call(d3.axisBottom(x).tickFormat((d) => {
                    if (d instanceof Date) {
                        return timeFormat2(d);
                    }
                    return "";
                }));

            g.append("g")
                .call(d3.axisLeft(y));

            g.append("text")
                .attr("transform", "rotate(-90)")
                .attr("y", 0 - margin.left)
                .attr("x", 0 - (chartHeight / 2))
                .attr("dy", "1em")
                .style("text-anchor", "middle")
                .style("font-size", "12px")
                .style("fill", "#666")
                .text("Demand (kWh)");
        }

    }, [data, chartDimensions]);

    // Backend returns: { success: true, data: [...], metadata: {...} }
    // RTK Query wraps it: { data: { success: true, data: [...], metadata: {...} } }
    // So data.data.data is the array, or data.data if it's already unwrapped
    const hourlyRecords = data?.data?.data || data?.data || [];

    if (!Array.isArray(hourlyRecords) || hourlyRecords.length === 0) {
        return (
            <div className="w-full col-span-2">
                <p className="text-grey-2 text-center py-8">
                    No hourly data available. Please select a country and date.
                </p>
            </div>
        );
    }

    return (
        <>
            <ChartCard title="Electricity Demand">
                <div ref={containerRefs.hourlyDemand} className="w-full">
                    <svg ref={chartRefs.hourlyDemand} className="w-full h-auto"></svg>
                </div>
            </ChartCard>

            <ChartCard title="Electricity Demand Per Capita">
                <div ref={containerRefs.perCapitaDemand} className="w-full">
                    <svg ref={chartRefs.perCapitaDemand} className="w-full h-auto"></svg>
                </div>
                <div className="flex gap-4 mt-2 text-[0.75rem] font-inter">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3" style={{ backgroundColor: '#9333EA' }}></div>
                        <span className="text-grey-2">Per capita</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-blue-1"></div>
                        <span className="text-grey-2">Per capita (with Access)</span>
                    </div>
                </div>
            </ChartCard>
        </>
    );
};

