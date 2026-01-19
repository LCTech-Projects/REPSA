import { useState, useEffect, useRef } from "react";
import { MetricCard } from "../../components/cards/MetricCard";
import { ChartCard } from "../../components/cards/ChartCard";
import { Slider } from "../../components/inputs/Slider";
import { FeedbackModal } from "../../components/modals/FeedbackModal";
import { useAnalyzePolicyMutation, useSimulateScenarioMutation } from "../../appSlices/apiSlice";
import { useGetAvailableCountriesQuery } from "../../appSlices/apiSlice";
import * as d3 from "d3";
import { calculateYearTicks } from "../../utils/chartUtils";

// Scenario Builder Interfaces
interface ScenarioParameters {
    renewable_target: number; // %
    energy_access_target: number; // %
    energy_poverty_target: number; // %
    co2_reduction_target: number; // %
    clean_cooking_target: number; // %
    solar_target: number; // GW
    wind_target: number; // GW
    investment_amount: number; // $ billions
    population_growth_rate: number; // decimal (e.g., 0.02 for 2%)
}

// Story Mode Interfaces
interface ForecastData {
    year: number;
    value: number;
}

interface PolicyAnalysisResult {
    policy_metrics: {
        renewable_target?: number;
        investment_amount?: number;
        timeline_start?: number;
        timeline_end?: number;
        solar_target?: number;
        wind_target?: number;
        energy_access_target?: number;
        energy_poverty_target?: number;
        co2_reduction_target?: number;
        clean_cooking_target?: number;
        population_growth_rate?: number;
    };
    forecasts: {
        renewable_share: ForecastData[];
        electricity_demand: ForecastData[];
        co2_emissions: ForecastData[];
        energy_poverty: ForecastData[];
        electricity_per_capita: ForecastData[];
        electricity_per_capita_with_access: ForecastData[];
        clean_cooking_access: ForecastData[];
    };
    summary: {
        renewable_share: number;
        electricity_demand: number;
        co2_emissions: number;
        energy_poverty: number;
    };
    timeline: {
        start_year: number;
        end_year: number;
    };
    ai_overview?: string;
}

type TabMode = "builder" | "analyzer";

export const Simulation = () => {
    const [activeTab, setActiveTab] = useState<TabMode>("builder");

    // Scenario Builder State
    const [scenarioParams, setScenarioParams] = useState<ScenarioParameters>({
        renewable_target: 60,
        energy_access_target: 85,
        energy_poverty_target: 20,
        co2_reduction_target: 25,
        clean_cooking_target: 60,
        solar_target: 5,
        wind_target: 3,
        investment_amount: 25,
        population_growth_rate: 0.02,
    });

    const [scenarioCountry, setScenarioCountry] = useState<string>("Algeria");
    const [scenarioStartYear, setScenarioStartYear] = useState<number>(2025);
    const [scenarioEndYear, setScenarioEndYear] = useState<number>(2050);
    const [isParametersExpanded, setIsParametersExpanded] = useState(true);
    const [hasSimulated, setHasSimulated] = useState(false);
    const [isSimulating, setIsSimulating] = useState(false);
    const [scenarioResult, setScenarioResult] = useState<PolicyAnalysisResult | null>(null);

    // Policy Analyzer State
    const [policyText, setPolicyText] = useState("");
    const [selectedYear, setSelectedYear] = useState<number>(2100);
    const [selectedCountry, setSelectedCountry] = useState<string>("Algeria");
    const [analysisResult, setAnalysisResult] = useState<PolicyAnalysisResult | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [feedbackModal, setFeedbackModal] = useState({
        isOpen: false,
        type: "info" as "error" | "warning" | "info" | "success",
        title: "",
        message: "",
        details: ""
    });

    const [analyzePolicy, { isLoading: isAnalyzing }] = useAnalyzePolicyMutation();
    const [simulateScenario] = useSimulateScenarioMutation();
    const { data: countriesData } = useGetAvailableCountriesQuery();
    const availableCountries = countriesData?.data || [];

    // Policy Analyzer Chart refs (Yearly-style charts, excluding population)
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
    const SolarIcon = () => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="5" stroke="#F59E0B" strokeWidth="2" fill="none" />
            <path d="M12 2V4M12 20V22M22 12H20M4 12H2M19.07 4.93L17.66 6.34M6.34 17.66L4.93 19.07M19.07 19.07L17.66 17.66M6.34 6.34L4.93 4.93" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
        </svg>
    );

    const WindIcon = () => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9.59 4.59A2 2 0 1 1 11 8H2M10 12h10M9.59 15.41A2 2 0 1 0 11 20H2" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );

    const TargetIcon = () => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="#1E3A8A" strokeWidth="2" fill="none" />
            <circle cx="12" cy="12" r="6" stroke="#1E3A8A" strokeWidth="2" fill="none" />
            <circle cx="12" cy="12" r="2" fill="#1E3A8A" />
        </svg>
    );

    const RenewableIcon = () => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M2 17L12 22L22 17" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M2 12L12 17L22 12" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );

    const EnergyAccessIcon = () => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );

    const PovertyIcon = () => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 21H21" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M5 21V7L13 2L21 7V21" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M9 9V13" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M15 9V13" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );

    const CO2Icon = () => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M18 10A6 6 0 0 0 6 10C6 14 12 22 12 22C12 22 18 14 18 10Z" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="12" cy="10" r="2" stroke="#DC2626" strokeWidth="2" fill="none" />
        </svg>
    );

    const CleanCookingIcon = () => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C8 2 5 5 5 9C5 13 8 16 12 16C16 16 19 13 19 9C19 5 16 2 12 2Z" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M12 6V10" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M9 9L15 9" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M12 16V22" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );

    const InvestmentIcon = () => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2V22" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M17 5H9.5C8.57174 5 7.6815 5.36875 7.02513 6.02513C6.36875 6.6815 6 7.57174 6 8.5C6 9.42826 6.36875 10.3185 7.02513 10.9749C7.6815 11.6313 8.57174 12 9.5 12H14.5C15.4283 12 16.3185 12.3687 16.9749 13.0251C17.6313 13.6815 18 14.5717 18 15.5C18 16.4283 17.6313 17.3185 16.9749 17.9749C16.3185 18.6313 15.4283 19 14.5 19H6" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );

    const PopulationIcon = () => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M17 21V19C17 17.9391 16.5786 16.9217 15.8284 16.1716C15.0783 15.4214 14.0609 15 13 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21" stroke="#9333EA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="9" cy="7" r="4" stroke="#9333EA" strokeWidth="2" fill="none" />
            <path d="M23 21V19C22.9993 18.1137 22.7044 17.2528 22.1614 16.5523C21.6184 15.8519 20.8581 15.3516 20 15.13" stroke="#9333EA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M16 3.13C16.8604 3.35031 17.623 3.85071 18.1676 4.55232C18.7122 5.25392 19.0078 6.11683 19.0078 7.005C19.0078 7.89318 18.7122 8.75608 18.1676 9.45769C17.623 10.1593 16.8604 10.6597 16 10.88" stroke="#9333EA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
                    energy_poverty_target: scenarioParams.energy_poverty_target,
                    co2_reduction_target: scenarioParams.co2_reduction_target,
                    clean_cooking_target: scenarioParams.clean_cooking_target,
                    solar_target: scenarioParams.solar_target,
                    wind_target: scenarioParams.wind_target,
                    investment_amount: scenarioParams.investment_amount,
                    population_growth_rate: scenarioParams.population_growth_rate,
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
                const errorMessage = result.message || "We couldn't simulate your scenario. Please check your parameters and try again.";
                showFeedback("error", errorTitle, errorMessage);
            }
        } catch (error: any) {
            let errorTitle = "Simulation Failed";
            let errorMessage = "We encountered an issue while simulating your scenario.";

            if (error?.data) {
                errorTitle = error.data.error || "Simulation Error";
                errorMessage = error.data.message || error.message || "An error occurred during scenario simulation.";
            } else if (error?.message) {
                errorMessage = error.message;
            }

            showFeedback("error", errorTitle, errorMessage);
        } finally {
            setIsSimulating(false);
        }
    };

    // Policy Analyzer Handlers
    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target?.result as string;
                setPolicyText(text);
            };
            reader.readAsText(file);
        }
    };

    const showFeedback = (
        type: "error" | "warning" | "info" | "success",
        title: string,
        message: string,
        details?: string
    ) => {
        setFeedbackModal({
            isOpen: true,
            type,
            title,
            message,
            details: details || ""
        });
    };

    const closeFeedback = () => {
        setFeedbackModal({
            isOpen: false,
            type: "info",
            title: "",
            message: "",
            details: ""
        });
    };

    const handleAnalyze = async () => {
        if (!policyText.trim()) {
            showFeedback(
                "warning",
                "Policy Document Required",
                "Please enter or upload a policy document to analyze."
            );
            return;
        }

        try {
            const result = await analyzePolicy({
                policy_text: policyText,
                country: selectedCountry,
                target_year: selectedYear,
            }).unwrap();

            if (result.success && result.data) {
                setAnalysisResult(result.data);
            } else {
                const errorTitle = result.error || "Analysis Failed";
                const errorMessage = result.message || "We couldn't analyze your policy document. Please ensure it contains valid text and try again.";
                showFeedback("error", errorTitle, errorMessage);
            }
        } catch (error: any) {
            let errorTitle = "Analysis Failed";
            let errorMessage = "We encountered an issue while analyzing your policy document.";

            if (error?.status === 'FETCH_ERROR') {
                errorTitle = "Connection Error";
                errorMessage = "Unable to connect to the analysis server. Please check your internet connection and ensure the backend service is running. If the problem persists, try refreshing the page.";
            } else if (error?.status === 'PARSING_ERROR') {
                errorTitle = "Data Processing Error";
                errorMessage = "The server returned data in an unexpected format. This may be a temporary issue. Please try again in a moment.";
            } else if (error?.status === 'TIMEOUT_ERROR') {
                errorTitle = "Request Timeout";
                errorMessage = "The analysis is taking longer than expected. Your policy document might be very large. Please try again or consider breaking it into smaller sections.";
            } else if (error?.status === 'CUSTOM_ERROR') {
                errorTitle = error?.data?.error || "Analysis Error";
                errorMessage = error?.data?.message || error?.message || "An error occurred during policy analysis.";
            } else if (error?.data) {
                const serverErrorTitle = error.data.error;
                const serverErrorMessage = error.data.message;

                if (serverErrorMessage) {
                    errorMessage = serverErrorMessage;
                    errorTitle = serverErrorTitle || "Analysis Error";
                } else if (serverErrorTitle) {
                    errorTitle = serverErrorTitle;
                    errorMessage = "An error occurred while processing your policy document. Please check the document format and try again.";
                } else if (error.data.detail) {
                    errorTitle = "Invalid Request";
                    errorMessage = `The request could not be processed: ${error.data.detail}`;
                } else {
                    errorTitle = "Server Error";
                    errorMessage = "The server encountered an error while processing your policy. Please check your policy document format and try again.";
                }
            } else if (error?.message) {
                errorTitle = "Error";
                errorMessage = error.message;
            } else {
                errorTitle = "Unknown Error";
                errorMessage = "An unexpected error occurred. Please try again. If the problem persists, ensure your policy document contains valid text and try with a simpler document first.";
            }

            showFeedback("error", errorTitle, errorMessage);
        }
    };

    const handleReset = () => {
        setPolicyText("");
        setSelectedYear(2100);
        setAnalysisResult(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };


    const formatPercentage = (value: number) => `${value.toFixed(1)}%`;

    // Create or select tooltip div for Policy Analyzer
    useEffect(() => {
        if (activeTab === "analyzer") {
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
        }
    }, [activeTab]);

    // Chart Effects - Yearly-style charts (excluding population) - Works for both Scenario Builder and Policy Analyzer
    // Set up chart dimensions observer
    const [chartDimensions, setChartDimensions] = useState<Record<string, { width: number; height: number }>>({});

    useEffect(() => {
        const currentResult = activeTab === "analyzer" ? analysisResult : scenarioResult;
        if (!currentResult) return;

        const containerRefs = {
            electricityAccess: electricityAccessChartContainerRef,
            co2Emission: co2EmissionChartContainerRef,
            cleanCooking: cleanCookingChartContainerRef,
            electricityPerCapita: electricityPerCapitaChartContainerRef,
            energyPovertyComparison: energyPovertyComparisonChartContainerRef,
            energyPovertyRuralUrban: energyPovertyRuralUrbanChartContainerRef,
        };

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
    }, [analysisResult, scenarioResult, activeTab]);

    // Render all charts (Yearly-style, excluding population) - Works for both Scenario Builder and Policy Analyzer
    useEffect(() => {
        const currentResult = activeTab === "analyzer" ? analysisResult : scenarioResult;
        if (!currentResult || Object.keys(chartDimensions).length === 0) return;

        const margin = { top: 30, right: 30, bottom: 60, left: 70 };

        // Transform forecast data to time_series format for compatibility with yearly chart logic
        const demandData = currentResult.forecasts.electricity_demand || [];
        const renewableData = currentResult.forecasts.renewable_share || [];
        const co2Data = currentResult.forecasts.co2_emissions || [];
        const povertyData = currentResult.forecasts.energy_poverty || [];
        const cleanCookingData = currentResult.forecasts.clean_cooking_access || [];
        const perCapitaData = currentResult.forecasts.electricity_per_capita || [];
        const perCapitaAccessData = currentResult.forecasts.electricity_per_capita_with_access || [];

        // Create time_series-like structure by merging all forecast data by year
        const allYears = new Set([
            ...demandData.map(d => d.year),
            ...renewableData.map(d => d.year),
            ...co2Data.map(d => d.year),
            ...povertyData.map(d => d.year),
            ...cleanCookingData.map(d => d.year),
            ...perCapitaData.map(d => d.year),
            ...perCapitaAccessData.map(d => d.year),
        ]);

        const timeSeries = Array.from(allYears).sort((a, b) => a - b).map(year => ({
            year,
            electricity_demand: demandData.find(d => d.year === year)?.value || 0,
            electricity_generation: demandData.find(d => d.year === year)?.value || 0, // Use demand as proxy for generation
            carbon_intensity: co2Data.find(d => d.year === year)?.value || 0,
            energy_poverty: povertyData.find(d => d.year === year)?.value || 0,
            clean_cooking_access: cleanCookingData.find(d => d.year === year)?.value || 0,
            electricity_demand_per_capita: perCapitaData.find(d => d.year === year)?.value || 0,
            electricity_demand_per_capita_with_access: perCapitaAccessData.find(d => d.year === year)?.value || 0,
            energy_poverty_multidimensional: povertyData.find(d => d.year === year)?.value || 0, // Use same as energy_poverty
            energy_poverty_rural: povertyData.find(d => d.year === year)?.value ? (povertyData.find(d => d.year === year)!.value * 1.2) : 0, // Estimate rural as 20% higher
            energy_poverty_urban: povertyData.find(d => d.year === year)?.value ? (povertyData.find(d => d.year === year)!.value * 0.8) : 0, // Estimate urban as 20% lower
        }));

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
            renderFn: (svg: d3.Selection<SVGSVGElement, unknown, null, undefined>, dims: { width: number; height: number }) => void
        ) => {
            const ref = chartRefs[chartKey];
            const containerRef = chartKey === 'electricityAccess' ? electricityAccessChartContainerRef :
                chartKey === 'co2Emission' ? co2EmissionChartContainerRef :
                    chartKey === 'cleanCooking' ? cleanCookingChartContainerRef :
                        chartKey === 'electricityPerCapita' ? electricityPerCapitaChartContainerRef :
                            chartKey === 'energyPovertyComparison' ? energyPovertyComparisonChartContainerRef :
                                energyPovertyRuralUrbanChartContainerRef;

            if (!ref.current || !containerRef.current) return;

            const dims = chartDimensions[chartKey] || { width: 500, height: 300 };
            const svg = d3.select(ref.current);
            svg.selectAll("*").remove();
            svg.attr("width", dims.width)
                .attr("height", dims.height)
                .attr("viewBox", `0 0 ${dims.width} ${dims.height}`)
                .attr("preserveAspectRatio", "xMidYMid meet");

            renderFn(svg, dims);
        };

        // 1. Electricity Demand & Generation Chart
        renderChart('electricityAccess', (svg, dims) => {
            const chartWidth = dims.width - margin.left - margin.right;
            const chartHeight = dims.height - margin.top - margin.bottom;
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

            const demandLine = d3.line<typeof timeSeries[0]>()
                .x((d: any) => x(d.year))
                .y((d: any) => y(d.electricity_demand || 0))
                .curve(d3.curveMonotoneX);

            const generationLine = d3.line<typeof timeSeries[0]>()
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
        });

        // 2. CO2 Emission Chart
        renderChart('co2Emission', (svg, dims) => {
            const chartWidth = dims.width - margin.left - margin.right;
            const chartHeight = dims.height - margin.top - margin.bottom;
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
        });

        // 3. Clean Cooking Access Chart (Line Chart)
        renderChart('cleanCooking', (svg, dims) => {
            const chartWidth = dims.width - margin.left - margin.right;
            const chartHeight = dims.height - margin.top - margin.bottom;
            const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

            const yearExtent = d3.extent(timeSeries, (d: any) => d.year) as [number | undefined, number | undefined];
            const x = d3.scaleLinear()
                .domain(yearExtent[0] !== undefined && yearExtent[1] !== undefined
                    ? [yearExtent[0], yearExtent[1]] as [number, number]
                    : [0, 1])
                .range([0, chartWidth]);

            const y = d3.scaleLinear()
                .domain([0, 100] as [number, number])
                .range([chartHeight, 0]);

            const line = d3.line<typeof timeSeries[0]>()
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

            g.selectAll(".clean-cooking-circle")
                .data(timeSeries.filter((d: any) => d.clean_cooking_access !== null && d.clean_cooking_access !== undefined))
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
                    tooltip.html(`Year: ${d.year}<br/>Clean Cooking Access: ${(d.clean_cooking_access || 0).toFixed(1)}%`)
                        .style("left", (event.pageX + 10) + "px")
                        .style("top", (event.pageY - 10) + "px");
                    d3.select(this).attr("r", 6).attr("opacity", 1);
                })
                .on("mouseout", function () {
                    tooltip.transition().duration(200).style("opacity", 0);
                    d3.select(this).attr("r", 4).attr("opacity", 0);
                });
        });

        // 4. Electricity Per Capita Chart
        renderChart('electricityPerCapita', (svg, dims) => {
            const chartWidth = dims.width - margin.left - margin.right;
            const chartHeight = dims.height - margin.top - margin.bottom;
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
        });

        // 5. Energy Poverty Chart
        renderChart('energyPovertyComparison', (svg, dims) => {
            const chartWidth = dims.width - margin.left - margin.right;
            const chartHeight = dims.height - margin.top - margin.bottom;
            const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

            const yearExtent = d3.extent(timeSeries, (d: any) => d.year) as [number | undefined, number | undefined];
            const x = d3.scaleLinear()
                .domain(yearExtent[0] !== undefined && yearExtent[1] !== undefined
                    ? [yearExtent[0], yearExtent[1]] as [number, number]
                    : [0, 1])
                .range([0, chartWidth]);

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

            g.append("path")
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

            g.append("path")
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
        });

        // 7. Energy Poverty Rural vs Urban Chart
        renderChart('energyPovertyRuralUrban', (svg, dims) => {
            const chartWidth = dims.width - margin.left - margin.right;
            const chartHeight = dims.height - margin.top - margin.bottom;
            const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

            const yearExtent = d3.extent(timeSeries, (d: any) => d.year) as [number | undefined, number | undefined];
            const x = d3.scaleLinear()
                .domain(yearExtent[0] !== undefined && yearExtent[1] !== undefined
                    ? [yearExtent[0], yearExtent[1]] as [number, number]
                    : [0, 1])
                .range([0, chartWidth]);

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
        });

        // Cleanup tooltip on unmount
        return () => {
            d3.select("body").select(".chart-tooltip").remove();
        };
    }, [analysisResult, scenarioResult, activeTab, chartDimensions]);

    const yearOptions = Array.from({ length: 76 }, (_, i) => 2025 + i);

    return (
        <div className="p-6 bg-grey-1 min-h-screen">
            <div className="max-w-7xl mx-auto">
                <div className="mb-6">
                    <h1 className="text-[2rem] font-inter font-semibold text-black-1 mb-2">
                        Scenario Simulation Lab
                    </h1>
                    <p className="text-[1rem] font-inter text-grey-2">
                        Explore future energy pathways with real-time analytics and data-powered insights that adapt as you configure your scenarios.
                    </p>
                </div>

                {/* Tabs */}
                <div className="mb-6 flex gap-4 border-b border-grey-1">
                    <button
                        onClick={() => setActiveTab("builder")}
                        className={`px-6 py-3 text-[1rem] font-inter font-medium transition-colors border-b-2 ${activeTab === "builder"
                            ? "border-blue-1 text-blue-1"
                            : "border-transparent text-grey-2 hover:text-black-1"
                            }`}
                    >
                        Scenario Builder
                    </button>
                    <button
                        onClick={() => setActiveTab("analyzer")}
                        className={`px-6 py-3 text-[1rem] font-inter font-medium transition-colors border-b-2 ${activeTab === "analyzer"
                            ? "border-blue-1 text-blue-1"
                            : "border-transparent text-grey-2 hover:text-black-1"
                            }`}
                    >
                        Policy Analyzer
                    </button>
                </div>

                {/* Scenario Builder Content */}
                {activeTab === "builder" && (
                    <>
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
                                                onChange={(e) => setScenarioStartYear(Number(e.target.value))}
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
                                                onChange={(e) => setScenarioEndYear(Number(e.target.value))}
                                                className="w-full bg-white-1 border border-grey-1 rounded-[8px] px-4 py-3 text-[0.875rem] font-inter text-black-1 hover:border-grey-2 transition-colors"
                                            >
                                                {yearOptions.filter(y => y >= scenarioStartYear).map((year) => (
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
                                        onClick={() => setIsParametersExpanded(!isParametersExpanded)}
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
                                            className={`transition-transform ${isParametersExpanded ? 'rotate-180' : ''}`}
                                        >
                                            <path d="M5 7.5L10 12.5L15 7.5" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
                                                onChange={(value) => setScenarioParams({ ...scenarioParams, renewable_target: value })}
                                            />
                                            <Slider
                                                label="Energy Access Target"
                                                icon={<EnergyAccessIcon />}
                                                value={scenarioParams.energy_access_target}
                                                min={0}
                                                max={100}
                                                step={1}
                                                formatValue={formatPercentage}
                                                onChange={(value) => setScenarioParams({ ...scenarioParams, energy_access_target: value })}
                                            />
                                            <Slider
                                                label="Energy Poverty Target"
                                                icon={<PovertyIcon />}
                                                value={scenarioParams.energy_poverty_target}
                                                min={0}
                                                max={100}
                                                step={1}
                                                formatValue={formatPercentage}
                                                onChange={(value) => setScenarioParams({ ...scenarioParams, energy_poverty_target: value })}
                                            />
                                            <Slider
                                                label="CO2 Reduction Target"
                                                icon={<CO2Icon />}
                                                value={scenarioParams.co2_reduction_target}
                                                min={0}
                                                max={100}
                                                step={1}
                                                formatValue={formatPercentage}
                                                onChange={(value) => setScenarioParams({ ...scenarioParams, co2_reduction_target: value })}
                                            />
                                            <Slider
                                                label="Clean Cooking Access Target"
                                                icon={<CleanCookingIcon />}
                                                value={scenarioParams.clean_cooking_target}
                                                min={0}
                                                max={100}
                                                step={1}
                                                formatValue={formatPercentage}
                                                onChange={(value) => setScenarioParams({ ...scenarioParams, clean_cooking_target: value })}
                                            />
                                            <Slider
                                                label="Solar Capacity Target"
                                                icon={<SolarIcon />}
                                                value={scenarioParams.solar_target}
                                                min={0}
                                                max={50}
                                                step={0.5}
                                                formatValue={(v) => `${v.toFixed(1)} GW`}
                                                onChange={(value) => setScenarioParams({ ...scenarioParams, solar_target: value })}
                                            />
                                            <Slider
                                                label="Wind Capacity Target"
                                                icon={<WindIcon />}
                                                value={scenarioParams.wind_target}
                                                min={0}
                                                max={50}
                                                step={0.5}
                                                formatValue={(v) => `${v.toFixed(1)} GW`}
                                                onChange={(value) => setScenarioParams({ ...scenarioParams, wind_target: value })}
                                            />
                                            <Slider
                                                label="Investment Amount"
                                                icon={<InvestmentIcon />}
                                                value={scenarioParams.investment_amount}
                                                min={0}
                                                max={100}
                                                step={1}
                                                formatValue={(v) => `$${v.toFixed(1)}B`}
                                                onChange={(value) => setScenarioParams({ ...scenarioParams, investment_amount: value })}
                                            />
                                            <Slider
                                                label="Population Growth Rate"
                                                icon={<PopulationIcon />}
                                                value={scenarioParams.population_growth_rate * 100}
                                                min={0}
                                                max={5}
                                                step={0.1}
                                                formatValue={(v) => `${v.toFixed(1)}%`}
                                                onChange={(value) => setScenarioParams({ ...scenarioParams, population_growth_rate: value / 100 })}
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
                                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-blue-1">
                                        <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                    <div className="text-center">
                                        <p className="text-[1.125rem] font-inter font-semibold text-black-1 mb-1">
                                            {isSimulating ? "Simulating..." : "Ready to simulate"}
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
                                    <div className="bg-white-1 border border-grey-1 rounded-[8px] p-6">
                                        <div className="flex items-center justify-between mb-6">
                                            <h2 className="text-[1.5rem] font-inter font-semibold text-black-1">
                                                Forecast Overview ({scenarioResult.timeline.start_year} - {scenarioResult.timeline.end_year})
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
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                            <MetricCard
                                                title="RENEWABLE SHARE"
                                                value={scenarioResult.summary.renewable_share.toFixed(1)}
                                                unit="%"
                                            />
                                            <MetricCard
                                                title="ELECTRICITY DEMAND"
                                                value={scenarioResult.summary.electricity_demand.toFixed(1)}
                                                unit=" TWh"
                                            />
                                            <MetricCard
                                                title="CO2 EMISSIONS"
                                                value={scenarioResult.summary.co2_emissions.toFixed(1)}
                                                unit=" gCO₂/kWh"
                                            />
                                            <MetricCard
                                                title="ENERGY POVERTY"
                                                value={scenarioResult.summary.energy_poverty.toFixed(1)}
                                                unit="%"
                                            />
                                        </div>
                                    </div>

                                    {/* Charts Section - Same as Policy Analyzer */}
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        <ChartCard title="Electricity Demand & Generation (TWh)">
                                            <div ref={electricityAccessChartContainerRef} className="w-full">
                                                <svg ref={electricityAccessChartRef} className="w-full h-auto"></svg>
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
                                            <div ref={co2EmissionChartContainerRef} className="w-full">
                                                <svg ref={co2EmissionChartRef} className="w-full h-auto"></svg>
                                            </div>
                                        </ChartCard>

                                        <ChartCard title="Clean Cooking Access (%)">
                                            <div ref={cleanCookingChartContainerRef} className="w-full">
                                                <svg ref={cleanCookingChartRef} className="w-full h-auto"></svg>
                                            </div>
                                            <div className="flex gap-4 mt-2 text-[0.75rem] font-inter">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-3 h-3 bg-green-500"></div>
                                                    <span className="text-grey-2">Clean Cooking Access</span>
                                                </div>
                                            </div>
                                        </ChartCard>

                                        <ChartCard title="Electricity Demand Per Capita (kWh/year)">
                                            <div ref={electricityPerCapitaChartContainerRef} className="w-full">
                                                <svg ref={electricityPerCapitaChartRef} className="w-full h-auto"></svg>
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

                                        <ChartCard title="Energy Poverty (%)">
                                            <div ref={energyPovertyComparisonChartContainerRef} className="w-full">
                                                <svg ref={energyPovertyComparisonChartRef} className="w-full h-auto"></svg>
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
                                            <div ref={energyPovertyRuralUrbanChartContainerRef} className="w-full">
                                                <svg ref={energyPovertyRuralUrbanChartRef} className="w-full h-auto"></svg>
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
                                    </div>

                                    {/* Scenario Parameters Summary */}
                                    <div className="bg-white-1 border border-grey-1 rounded-[8px] p-6">
                                        <h2 className="text-[1.25rem] font-inter font-semibold text-black-1 mb-4">
                                            Scenario Parameters
                                        </h2>
                                        <div className="bg-grey-1 rounded-[8px] p-4">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[0.875rem] font-inter">
                                                <div>
                                                    <span className="text-grey-2">Renewable Target: </span>
                                                    <span className="text-black-1 font-semibold">{scenarioParams.renewable_target}%</span>
                                                </div>
                                                <div>
                                                    <span className="text-grey-2">Investment: </span>
                                                    <span className="text-black-1 font-semibold">${scenarioParams.investment_amount.toFixed(1)}B</span>
                                                </div>
                                                <div>
                                                    <span className="text-grey-2">Solar Target: </span>
                                                    <span className="text-black-1 font-semibold">{scenarioParams.solar_target.toFixed(1)} GW</span>
                                                </div>
                                                <div>
                                                    <span className="text-grey-2">Wind Target: </span>
                                                    <span className="text-black-1 font-semibold">{scenarioParams.wind_target.toFixed(1)} GW</span>
                                                </div>
                                                <div>
                                                    <span className="text-grey-2">Energy Access Target: </span>
                                                    <span className="text-black-1 font-semibold">{scenarioParams.energy_access_target}%</span>
                                                </div>
                                                <div>
                                                    <span className="text-grey-2">Energy Poverty Target: </span>
                                                    <span className="text-black-1 font-semibold">{scenarioParams.energy_poverty_target}%</span>
                                                </div>
                                                <div>
                                                    <span className="text-grey-2">CO2 Reduction Target: </span>
                                                    <span className="text-black-1 font-semibold">{scenarioParams.co2_reduction_target}%</span>
                                                </div>
                                                <div>
                                                    <span className="text-grey-2">Clean Cooking Target: </span>
                                                    <span className="text-black-1 font-semibold">{scenarioParams.clean_cooking_target}%</span>
                                                </div>
                                                <div>
                                                    <span className="text-grey-2">Population Growth Rate: </span>
                                                    <span className="text-black-1 font-semibold">{(scenarioParams.population_growth_rate * 100).toFixed(1)}%</span>
                                                </div>
                                                <div>
                                                    <span className="text-grey-2">Timeline: </span>
                                                    <span className="text-black-1 font-semibold">{scenarioStartYear} - {scenarioEndYear}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* AI Overview */}
                                    {scenarioResult.ai_overview && (
                                        <div className="bg-white-1 border border-grey-1 rounded-[8px] p-6">
                                            <h2 className="text-[1.25rem] font-inter font-semibold text-black-1 mb-4">
                                                Scenario Overview
                                            </h2>
                                            <div className="bg-grey-1 rounded-[8px] p-4">
                                                <p className="text-[0.875rem] font-inter text-black-1 leading-relaxed whitespace-pre-line">
                                                    {scenarioResult.ai_overview}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        )}
                    </>
                )}

                {/* Policy Analyzer Content */}
                {activeTab === "analyzer" && (
                    <>
                        {!analysisResult ? (
                            <div className="space-y-4">
                                {/* Policy Input Section */}
                                <div className="bg-white-1 border border-grey-1 rounded-[8px] p-6">
                                    <h2 className="text-[1.25rem] font-inter font-semibold text-black-1 mb-4">
                                        Policy Document
                                    </h2>

                                    {/* Country Selector */}
                                    <div className="mb-4">
                                        <label className="text-[0.875rem] font-inter text-grey-2 mb-2 block">
                                            Country (for context)
                                        </label>
                                        <select
                                            value={selectedCountry}
                                            onChange={(e) => setSelectedCountry(e.target.value)}
                                            className="w-full bg-white-1 border border-grey-1 rounded-[8px] px-4 py-3 text-[0.875rem] font-inter text-black-1 hover:border-grey-2 transition-colors"
                                        >
                                            {availableCountries.map((country: string) => (
                                                <option key={country} value={country}>
                                                    {country}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* File Upload */}
                                    <div className="mb-4">
                                        <label className="text-[0.875rem] font-inter text-grey-2 mb-2 block">
                                            Upload Document
                                        </label>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept=".txt"
                                            onChange={handleFileUpload}
                                            className="w-full bg-white-1 border border-grey-1 rounded-[8px] px-4 py-3 text-[0.875rem] font-inter text-black-1 hover:border-grey-2 transition-colors"
                                        />
                                        <p className="text-[0.75rem] font-inter text-grey-2 mt-2">
                                            Supported format: TXT (PDF/DOC support coming soon)
                                        </p>
                                    </div>

                                    {/* Text Input */}
                                    <div>
                                        <label className="text-[0.875rem] font-inter text-grey-2 mb-2 block">
                                            Or Type Policy Content
                                        </label>
                                        <textarea
                                            value={policyText}
                                            onChange={(e) => setPolicyText(e.target.value)}
                                            placeholder="Enter policy document content, statistics, or actions regarding energy sector initiatives..."
                                            className="w-full bg-white-1 border border-grey-1 rounded-[8px] px-4 py-3 text-[0.875rem] font-inter text-black-1 hover:border-grey-2 transition-colors min-h-[200px] resize-y"
                                        />
                                    </div>
                                </div>

                                {/* Year Selector */}
                                <div className="bg-white-1 border border-grey-1 rounded-[8px] p-6">
                                    <label className="text-[0.875rem] font-inter text-grey-2 mb-2 block">
                                        Forecast Limit Year
                                    </label>
                                    <select
                                        value={selectedYear}
                                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                                        className="w-full bg-white-1 border border-grey-1 rounded-[8px] px-4 py-3 text-[0.875rem] font-inter text-black-1 hover:border-grey-2 transition-colors"
                                    >
                                        {yearOptions.map((year) => (
                                            <option key={year} value={year}>
                                                {year}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Analyze Button */}
                                <button
                                    onClick={handleAnalyze}
                                    disabled={isAnalyzing || !policyText.trim()}
                                    className="w-full bg-blue-1 text-white-1 px-6 py-4 rounded-[8px] text-[1rem] font-inter font-medium cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {isAnalyzing ? (
                                        <>
                                            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            <span>Analyzing Policy...</span>
                                        </>
                                    ) : (
                                        <span>Generate Forecast</span>
                                    )}
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* Overview Metrics */}
                                <div className="bg-white-1 border border-grey-1 rounded-[8px] p-6">
                                    <div className="flex items-center justify-between mb-6">
                                        <h2 className="text-[1.5rem] font-inter font-semibold text-black-1">
                                            Forecast Overview ({analysisResult.timeline.start_year} - {analysisResult.timeline.end_year})
                                        </h2>
                                        <button
                                            onClick={handleReset}
                                            className="bg-yellow-1 text-blue-2 px-4 py-2 rounded-[8px] text-[0.875rem] font-inter font-medium hover:bg-yellow-200 transition-colors"
                                        >
                                            New Analysis
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                        <MetricCard
                                            title="RENEWABLE SHARE"
                                            value={analysisResult.summary.renewable_share.toFixed(1)}
                                            unit="%"
                                        />
                                        <MetricCard
                                            title="ELECTRICITY DEMAND"
                                            value={analysisResult.summary.electricity_demand.toFixed(1)}
                                            unit=" TWh"
                                        />
                                        <MetricCard
                                            title="CO2 EMISSIONS"
                                            value={analysisResult.summary.co2_emissions.toFixed(1)}
                                            unit=" gCO₂/kWh"
                                        />
                                        <MetricCard
                                            title="ENERGY POVERTY"
                                            value={analysisResult.summary.energy_poverty.toFixed(1)}
                                            unit="%"
                                        />
                                    </div>
                                </div>

                                {/* Charts Section - Yearly Charts (excluding population) */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <ChartCard title="Electricity Demand & Generation (TWh)">
                                        <div ref={electricityAccessChartContainerRef} className="w-full">
                                            <svg ref={electricityAccessChartRef} className="w-full h-auto"></svg>
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
                                        <div ref={co2EmissionChartContainerRef} className="w-full">
                                            <svg ref={co2EmissionChartRef} className="w-full h-auto"></svg>
                                        </div>
                                    </ChartCard>

                                    <ChartCard title="Clean Cooking Access (%)">
                                        <div ref={cleanCookingChartContainerRef} className="w-full">
                                            <svg ref={cleanCookingChartRef} className="w-full h-auto"></svg>
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

                                    <ChartCard title="Electricity Demand Per Capita (kWh/year)">
                                        <div ref={electricityPerCapitaChartContainerRef} className="w-full">
                                            <svg ref={electricityPerCapitaChartRef} className="w-full h-auto"></svg>
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

                                    <ChartCard title="Energy Poverty (%)">
                                        <div ref={energyPovertyComparisonChartContainerRef} className="w-full">
                                            <svg ref={energyPovertyComparisonChartRef} className="w-full h-auto"></svg>
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
                                        <div ref={energyPovertyRuralUrbanChartContainerRef} className="w-full">
                                            <svg ref={energyPovertyRuralUrbanChartRef} className="w-full h-auto"></svg>
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
                                </div>

                                {/* Extracted Policy Metrics */}
                                <div className="bg-white-1 border border-grey-1 rounded-[8px] p-6">
                                    <h2 className="text-[1.25rem] font-inter font-semibold text-black-1 mb-4">
                                        Extracted Policy Metrics
                                    </h2>
                                    <div className="bg-grey-1 rounded-[8px] p-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[0.875rem] font-inter">
                                            {analysisResult.policy_metrics.renewable_target && (
                                                <div>
                                                    <span className="text-grey-2">Renewable Target: </span>
                                                    <span className="text-black-1 font-semibold">{analysisResult.policy_metrics.renewable_target}%</span>
                                                </div>
                                            )}
                                            {analysisResult.policy_metrics.investment_amount && (
                                                <div>
                                                    <span className="text-grey-2">Investment: </span>
                                                    <span className="text-black-1 font-semibold">${analysisResult.policy_metrics.investment_amount}B</span>
                                                </div>
                                            )}
                                            {analysisResult.policy_metrics.solar_target && (
                                                <div>
                                                    <span className="text-grey-2">Solar Target: </span>
                                                    <span className="text-black-1 font-semibold">{analysisResult.policy_metrics.solar_target} GW</span>
                                                </div>
                                            )}
                                            {analysisResult.policy_metrics.wind_target && (
                                                <div>
                                                    <span className="text-grey-2">Wind Target: </span>
                                                    <span className="text-black-1 font-semibold">{analysisResult.policy_metrics.wind_target} GW</span>
                                                </div>
                                            )}
                                            {analysisResult.policy_metrics.energy_access_target && (
                                                <div>
                                                    <span className="text-grey-2">Energy Access Target: </span>
                                                    <span className="text-black-1 font-semibold">{analysisResult.policy_metrics.energy_access_target}%</span>
                                                </div>
                                            )}
                                            {analysisResult.policy_metrics.energy_poverty_target && (
                                                <div>
                                                    <span className="text-grey-2">Energy Poverty Target: </span>
                                                    <span className="text-black-1 font-semibold">{analysisResult.policy_metrics.energy_poverty_target}%</span>
                                                </div>
                                            )}
                                            {analysisResult.policy_metrics.co2_reduction_target && (
                                                <div>
                                                    <span className="text-grey-2">CO2 Reduction Target: </span>
                                                    <span className="text-black-1 font-semibold">{analysisResult.policy_metrics.co2_reduction_target}%</span>
                                                </div>
                                            )}
                                            {analysisResult.policy_metrics.clean_cooking_target && (
                                                <div>
                                                    <span className="text-grey-2">Clean Cooking Target: </span>
                                                    <span className="text-black-1 font-semibold">{analysisResult.policy_metrics.clean_cooking_target}%</span>
                                                </div>
                                            )}
                                            {analysisResult.timeline.start_year && analysisResult.timeline.end_year && (
                                                <div>
                                                    <span className="text-grey-2">Timeline: </span>
                                                    <span className="text-black-1 font-semibold">{analysisResult.timeline.start_year} - {analysisResult.timeline.end_year}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* AI Overview */}
                                {analysisResult.ai_overview && (
                                    <div className="bg-white-1 border border-grey-1 rounded-[8px] p-6">
                                        <h2 className="text-[1.25rem] font-inter font-semibold text-black-1 mb-4">
                                            AI Overview
                                        </h2>
                                        <div className="bg-grey-1 rounded-[8px] p-4">
                                            <p className="text-[0.875rem] font-inter text-black-1 leading-relaxed whitespace-pre-line">
                                                {analysisResult.ai_overview}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
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
