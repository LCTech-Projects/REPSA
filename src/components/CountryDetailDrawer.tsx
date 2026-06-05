import { useEffect, useRef, useState } from "react";
import { apiSlice } from "../app/appSlices/apiSlice";
import { useAppDispatch } from "../app/hooks";
import * as d3 from "d3";
import { calculateYearTicks, getChartMargins, getChartSize } from "./utils/ChartUtils";

interface CountryDetailDrawerProps {
  countryName: string;
  onClose: () => void;
  selectedYear?: number | null;
}

interface CountryDetails {
  country: string;
  iso_code: string;
  key_figures: {
    electricity_access: number | null;
    population: number | null;
    energy_poverty: number | null;
  };
  time_series: Array<{
    year: number;
    electricity_demand: number | null;
    electricity_generation: number | null;
    electricity_demand_per_capita: number | null;
    electricity_demand_per_capita_with_access: number | null;
    population: number | null;
    clean_cooking_access: number | null;
    energy_poverty: number | null;
    energy_poverty_multidimensional: number | null;
    energy_poverty_rural: number | null;
    energy_poverty_urban: number | null;
    carbon_intensity: number | null;
    renewable_share: number | null;
    solar_electricity: number | null;
    wind_electricity: number | null;
    hydro_electricity: number | null;
    fossil_share: number | null;
    electricity_access: number | null;
  }>;
}

type TimeSeriesRow = CountryDetails["time_series"][number];

export const CountryDetailDrawer = ({
  countryName,
  onClose,
  selectedYear,
}: CountryDetailDrawerProps) => {
  const [details, setDetails] = useState<CountryDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const dispatch = useAppDispatch();

  // Calculate start_year for time series (show last 9 years or from 2016)
  const getStartYear = (): number => {
    if (selectedYear) {
      return Math.max(2016, selectedYear - 8); // Show 9 years including selected
    }
    return 2016;
  };
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

  const [chartDimensions, setChartDimensions] = useState<
    Record<string, { width: number; height: number }>
  >({});

  useEffect(() => {
    setLoading(true);
    const startYear = getStartYear();
    const endYear = selectedYear || 2023;

    dispatch(
      apiSlice.endpoints.getCountryDetails.initiate({
        country: countryName,
        start_year: startYear,
        end_year: endYear,
        selected_year: selectedYear || undefined,
      }),
    )
      .then((result: any) => {
        if (result.data?.success) {
          setDetails(result.data.data);
        }
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [countryName, selectedYear, dispatch]);

  // Observe container sizes for responsive charts
  useEffect(() => {
    if (!details) return;

    const updateDimensions = () => {
      const newDimensions: Record<string, { width: number; height: number }> =
        {};

      Object.keys(containerRefs).forEach((key) => {
        const container =
          containerRefs[key as keyof typeof containerRefs].current;
        if (container) {
          const { width, height } = getChartSize(container.offsetWidth || 0, 32); // Maintain aspect ratio
          newDimensions[key] = { width, height };
        }
      });

      if (Object.keys(newDimensions).length > 0) {
        setChartDimensions(newDimensions);
      }
    };

    // Initial update after a short delay to ensure containers are rendered
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
  }, [details]);

  useEffect(() => {
    if (
      !details ||
      !details.time_series.length ||
      Object.keys(chartDimensions).length === 0
    )
      return;

    const narrowestWidth = Math.min(
      ...Object.values(chartDimensions).map((d) => d?.width ?? 500),
    );
    const margin = getChartMargins(narrowestWidth, { rotateXLabels: true });
    const plotWidthForTicks = narrowestWidth - margin.left - margin.right;

    // Create or select tooltip div
    let tooltip = d3.select("body").select<HTMLDivElement>(".chart-tooltip");
    if (tooltip.empty()) {
      tooltip = d3
        .select("body")
        .append<HTMLDivElement>("div")
        .attr("class", "chart-tooltip")
        .style("position", "fixed")
        .style("background", "rgba(0, 0, 0, 0.8)")
        .style("color", "white")
        .style("padding", "8px 12px")
        .style("border-radius", "4px")
        .style("font-size", "12px")
        .style("pointer-events", "none")
        .style("opacity", 0)
        .style("z-index", 1000)
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
      rows: TimeSeriesRow[],
      renderHtml: (d: TimeSeriesRow) => string,
    ) => {
      const sortedRows = [...rows].sort((a, b) => a.year - b.year);
      const bisect = d3.bisector<TimeSeriesRow, number>((r) => r.year).left;

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

    const addBandOverlayTooltip = (
      g: d3.Selection<SVGGElement, unknown, null, undefined>,
      chartWidth: number,
      chartHeight: number,
      xBand: d3.ScaleBand<string>,
      rows: TimeSeriesRow[],
      renderHtml: (d: TimeSeriesRow) => string,
    ) => {
      const byYear = new Map(rows.map((r) => [String(r.year), r]));
      const domain = xBand.domain();
      const step = xBand.step() || 1;

      g.append("rect")
        .attr("class", "tooltip-overlay")
        .attr("width", chartWidth)
        .attr("height", chartHeight)
        .attr("fill", "transparent")
        .style("pointer-events", "all")
        .on("mousemove", function (event) {
          const [mx] = d3.pointer(event, this as any);
          const idx = Math.max(
            0,
            Math.min(domain.length - 1, Math.floor(mx / step)),
          );
          const yearKey = domain[idx];
          const row = byYear.get(yearKey);
          if (!row) return;
          showTooltip(event as MouseEvent, renderHtml(row));
        })
        .on("mouseleave", hideTooltip);
    };

    // Electricity Access Chart (Line Chart)
    if (chartRefs.electricityAccess.current && details.time_series.length > 0) {
      const dims = chartDimensions.electricityAccess || {
        width: 500,
        height: 300,
      };
      const chartWidth = dims.width - margin.left - margin.right;
      const chartHeight = dims.height - margin.top - margin.bottom;

      const svg = d3.select(chartRefs.electricityAccess.current);
      svg.selectAll("*").remove();
      svg
        .attr("width", dims.width)
        .attr("height", dims.height)
        .attr("viewBox", `0 0 ${dims.width} ${dims.height}`)
        .attr("preserveAspectRatio", "xMidYMid meet");

      const g = svg
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

      const x = d3
        .scaleLinear()
        .domain(
          d3.extent(details.time_series, (d) => d.year) as [number, number],
        )
        .range([0, chartWidth]);

      const y = d3
        .scaleLinear()
        .domain([
          0,
          d3.max(details.time_series, (d) =>
            Math.max(d.electricity_demand || 0, d.electricity_generation || 0),
          ) || 0,
        ] as [number, number])
        .range([chartHeight, 0]);

      // Demand line
      const demandLine = d3
        .line<(typeof details.time_series)[0]>()
        .x((d) => x(d.year))
        .y((d) => y(d.electricity_demand || 0))
        .curve(d3.curveMonotoneX);

      // Generation line
      const generationLine = d3
        .line<(typeof details.time_series)[0]>()
        .x((d) => x(d.year))
        .y((d) => y(d.electricity_generation || 0))
        .curve(d3.curveMonotoneX);

      // Add animated paths
      g.append("path")
        .datum(details.time_series)
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
        .datum(details.time_series)
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
      const years = details.time_series.map((d) => d.year);
      const { tickValues } = calculateYearTicks(years, plotWidthForTicks);

      // X-axis with rotated labels
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
        details.time_series,
        (d) =>
          `Year: ${d.year}<br/>Demand: ${(d.electricity_demand || 0).toFixed(2)} TWh<br/>Generation: ${(d.electricity_generation || 0).toFixed(2)} TWh`,
      );

      // Add hover circles for demand line
      g.selectAll(".demand-circle")
        .data(
          details.time_series.filter(
            (d) =>
              d.electricity_demand !== null &&
              d.electricity_demand !== undefined,
          ),
        )
        .enter()
        .append("circle")
        .attr("class", "demand-circle")
        .attr("cx", (d) => x(d.year))
        .attr("cy", (d) => y(d.electricity_demand || 0))
        .attr("r", 4)
        .attr("fill", "#1E3A8A")
        .attr("opacity", 0)
        .style("cursor", "pointer")
        .on("mouseover", function (event, d) {
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

      // Add hover circles for generation line
      g.selectAll(".generation-circle")
        .data(
          details.time_series.filter(
            (d) =>
              d.electricity_generation !== null &&
              d.electricity_generation !== undefined,
          ),
        )
        .enter()
        .append("circle")
        .attr("class", "generation-circle")
        .attr("cx", (d) => x(d.year))
        .attr("cy", (d) => y(d.electricity_generation || 0))
        .attr("r", 4)
        .attr("fill", "#10B981")
        .attr("opacity", 0)
        .style("cursor", "pointer")
        .on("mouseover", function (event, d) {
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
    }

    // CO2 Emission Chart
    if (chartRefs.co2Emission.current && details.time_series.length > 0) {
      const dims = chartDimensions.co2Emission || { width: 500, height: 300 };
      const chartWidth = dims.width - margin.left - margin.right;
      const chartHeight = dims.height - margin.top - margin.bottom;

      const svg = d3.select(chartRefs.co2Emission.current);
      svg.selectAll("*").remove();
      svg
        .attr("width", dims.width)
        .attr("height", dims.height)
        .attr("viewBox", `0 0 ${dims.width} ${dims.height}`)
        .attr("preserveAspectRatio", "xMidYMid meet");

      const g = svg
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

      const x = d3
        .scaleLinear()
        .domain(
          d3.extent(details.time_series, (d) => d.year) as [number, number],
        )
        .range([0, chartWidth]);

      const y = d3
        .scaleLinear()
        .domain([
          0,
          d3.max(details.time_series, (d) => d.carbon_intensity || 0) || 0,
        ] as [number, number])
        .range([chartHeight, 0]);

      const line = d3
        .line<(typeof details.time_series)[0]>()
        .x((d) => x(d.year))
        .y((d) => y(d.carbon_intensity || 0))
        .curve(d3.curveMonotoneX);

      g.append("path")
        .datum(details.time_series)
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
      const years = details.time_series.map((d) => d.year);
      const { tickValues } = calculateYearTicks(years, plotWidthForTicks);

      // X-axis with rotated labels
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
        details.time_series,
        (d) =>
          `Year: ${d.year}<br/>CO₂ Intensity: ${(d.carbon_intensity || 0).toFixed(2)} gCO₂/kWh`,
      );

      // Add hover circles
      g.selectAll(".co2-circle")
        .data(
          details.time_series.filter(
            (d) =>
              d.carbon_intensity !== null && d.carbon_intensity !== undefined,
          ),
        )
        .enter()
        .append("circle")
        .attr("class", "co2-circle")
        .attr("cx", (d) => x(d.year))
        .attr("cy", (d) => y(d.carbon_intensity || 0))
        .attr("r", 4)
        .attr("fill", "#DC2626")
        .attr("opacity", 0)
        .style("cursor", "pointer")
        .on("mouseover", function (event, d) {
          tooltip.transition().duration(200).style("opacity", 1);
          tooltip
            .html(
              `Year: ${d.year}<br/>CO₂ Intensity: ${(d.carbon_intensity || 0).toFixed(2)} gCO₂/kWh`,
            )
            .style("left", event.pageX + 10 + "px")
            .style("top", event.pageY - 10 + "px");
          d3.select(this).attr("r", 6).attr("opacity", 1);
        })
        .on("mouseout", function () {
          tooltip.transition().duration(200).style("opacity", 0);
          d3.select(this).attr("r", 4).attr("opacity", 0);
        });
    }

    // Population Chart
    if (chartRefs.population.current && details.time_series.length > 0) {
      const dims = chartDimensions.population || { width: 500, height: 300 };
      const chartWidth = dims.width - margin.left - margin.right;
      const chartHeight = dims.height - margin.top - margin.bottom;

      const svg = d3.select(chartRefs.population.current);
      svg.selectAll("*").remove();
      svg
        .attr("width", dims.width)
        .attr("height", dims.height)
        .attr("viewBox", `0 0 ${dims.width} ${dims.height}`)
        .attr("preserveAspectRatio", "xMidYMid meet");

      const g = svg
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

      const x = d3
        .scaleLinear()
        .domain(
          d3.extent(details.time_series, (d) => d.year) as [number, number],
        )
        .range([0, chartWidth]);

      const y = d3
        .scaleLinear()
        .domain([
          0,
          d3.max(details.time_series, (d) => (d.population || 0) / 1000000) ||
            0,
        ] as [number, number])
        .range([chartHeight, 0]);

      const area = d3
        .area<(typeof details.time_series)[0]>()
        .x((d) => x(d.year))
        .y0(chartHeight)
        .y1((d) => y((d.population || 0) / 1000000))
        .curve(d3.curveMonotoneX);

      g.append("path")
        .datum(details.time_series)
        .attr("fill", "#9333EA")
        .attr("fill-opacity", 0)
        .attr("d", area)
        .transition()
        .duration(1500)
        .ease(d3.easeCubicInOut)
        .attr("fill-opacity", 0.6);

      // Calculate year ticks
      const years = details.time_series.map((d) => d.year);
      const { tickValues } = calculateYearTicks(years, plotWidthForTicks);

      // X-axis with rotated labels
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
        details.time_series,
        (d) => {
          const popMillions = (d.population || 0) / 1000000;
          return `Year: ${d.year}<br/>Population: ${popMillions.toFixed(2)}M`;
        },
      );

      // Add hover circles for area chart
      g.selectAll(".population-circle")
        .data(
          details.time_series.filter(
            (d) => d.population !== null && d.population !== undefined,
          ),
        )
        .enter()
        .append("circle")
        .attr("class", "population-circle")
        .attr("cx", (d) => x(d.year))
        .attr("cy", (d) => y((d.population || 0) / 1000000))
        .attr("r", 4)
        .attr("fill", "#9333EA")
        .attr("opacity", 0)
        .style("cursor", "pointer")
        .on("mouseover", function (event, d) {
          tooltip.transition().duration(200).style("opacity", 1);
          const popMillions = (d.population || 0) / 1000000;
          tooltip
            .html(`Year: ${d.year}<br/>Population: ${popMillions.toFixed(2)}M`)
            .style("left", event.pageX + 10 + "px")
            .style("top", event.pageY - 10 + "px");
          d3.select(this).attr("r", 6).attr("opacity", 1);
        })
        .on("mouseout", function () {
          tooltip.transition().duration(200).style("opacity", 0);
          d3.select(this).attr("r", 4).attr("opacity", 0);
        });
    }

    // Clean Cooking Access Chart (Stacked Bar)
    if (chartRefs.cleanCooking.current && details.time_series.length > 0) {
      const dims = chartDimensions.cleanCooking || { width: 500, height: 300 };
      const chartWidth = dims.width - margin.left - margin.right;
      const chartHeight = dims.height - margin.top - margin.bottom;

      const svg = d3.select(chartRefs.cleanCooking.current);
      svg.selectAll("*").remove();
      svg
        .attr("width", dims.width)
        .attr("height", dims.height)
        .attr("viewBox", `0 0 ${dims.width} ${dims.height}`)
        .attr("preserveAspectRatio", "xMidYMid meet");

      const g = svg
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

      // Filter to most recent 16 years and calculate tick values
      const allYears = details.time_series.map((d) => d.year);
      const { tickValues } = calculateYearTicks(allYears, plotWidthForTicks);

      // Filter time series to only show years in tickValues (max 16)
      const filteredTimeSeries = details.time_series.filter((d) =>
        tickValues.includes(d.year),
      );
      const uniqueYears = tickValues;

      const x = d3
        .scaleBand()
        .domain(uniqueYears.map((y) => y.toString()))
        .range([0, chartWidth])
        .padding(0.2);

      const y = d3.scaleLinear().domain([0, 100]).range([chartHeight, 0]);

      filteredTimeSeries.forEach((d, i) => {
        const clean = d.clean_cooking_access || 0;
        const traditional = 100 - clean;

        g.append("rect")
          .attr("x", x(d.year?.toString() || "") || 0)
          .attr("y", y(100))
          .attr("width", x.bandwidth())
          .attr("height", 0)
          .attr("fill", "#10B981")
          .style("cursor", "pointer")
          .on("mouseover", function (event) {
          showTooltip(
            event as MouseEvent,
            `Year: ${d.year}<br/>Clean: ${clean.toFixed(1)}%<br/>Traditional: ${traditional.toFixed(1)}%`,
          );
            d3.select(this).attr("opacity", 0.8);
          })
          .on("mouseout", function () {
          hideTooltip();
            d3.select(this).attr("opacity", 1);
          })
          .transition()
          .duration(800)
          .delay(i * 100)
          .ease(d3.easeCubicInOut)
          .attr("y", y(clean))
          .attr("height", chartHeight - y(clean));

        g.append("rect")
          .attr("x", x(d.year?.toString() || "") || 0)
          .attr("y", y(100))
          .attr("width", x.bandwidth())
          .attr("height", 0)
          .attr("fill", "#F97316")
          .style("cursor", "pointer")
          .on("mouseover", function (event) {
          showTooltip(
            event as MouseEvent,
            `Year: ${d.year}<br/>Clean: ${clean.toFixed(1)}%<br/>Traditional: ${traditional.toFixed(1)}%`,
          );
            d3.select(this).attr("opacity", 0.8);
          })
          .on("mouseout", function () {
          hideTooltip();
            d3.select(this).attr("opacity", 1);
          })
          .transition()
          .duration(800)
          .delay(i * 100 + 50)
          .ease(d3.easeCubicInOut)
          .attr("height", chartHeight - y(traditional));
      });

      // X-axis with rotated labels (full year)
      const xAxis = g
        .append("g")
        .attr("transform", `translate(0,${chartHeight})`)
        .call(
          d3.axisBottom(x).tickValues(uniqueYears.map((y) => y.toString())),
        );

      xAxis
        .selectAll("text")
        .style("text-anchor", "end")
        .attr("dx", "-.8em")
        .attr("dy", ".15em")
        .attr("transform", "rotate(-45)");

      g.append("g").call(d3.axisLeft(y));
      addBandOverlayTooltip(
        g,
        chartWidth,
        chartHeight,
        x,
        filteredTimeSeries,
        (d) => {
          const clean = d.clean_cooking_access || 0;
          const traditional = 100 - clean;
          return `Year: ${d.year}<br/>Clean: ${clean.toFixed(1)}%<br/>Traditional: ${traditional.toFixed(1)}%`;
        },
      );
    }

    // Energy Poverty Chart (Bar Chart)
    if (chartRefs.energyPoverty.current && details.time_series.length > 0) {
      const dims = chartDimensions.energyPoverty || { width: 500, height: 300 };
      const chartWidth = dims.width - margin.left - margin.right;
      const chartHeight = dims.height - margin.top - margin.bottom;

      const svg = d3.select(chartRefs.energyPoverty.current);
      svg.selectAll("*").remove();
      svg
        .attr("width", dims.width)
        .attr("height", dims.height)
        .attr("viewBox", `0 0 ${dims.width} ${dims.height}`)
        .attr("preserveAspectRatio", "xMidYMid meet");

      const g = svg
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

      // Get unique years and calculate tick values
      const allYears = details.time_series.map((d) => d.year);
      const { tickValues } = calculateYearTicks(allYears, plotWidthForTicks);

      // Limit displayed years to tick values (max 16)
      const uniqueYears = tickValues;

      const x = d3
        .scaleBand()
        .domain(uniqueYears.map((y) => y.toString()))
        .range([0, chartWidth])
        .padding(0.2);

      const y = d3.scaleLinear().domain([0, 100]).range([chartHeight, 0]);

      details.time_series.forEach((d, i) => {
        g.append("rect")
          .attr("x", x(d.year?.toString() || "0") || 0)
          .attr("y", chartHeight)
          .attr("width", x.bandwidth())
          .attr("height", 0)
          .attr("fill", "#DC2626")
          .style("cursor", "pointer")
          .on("mouseover", function (event) {
          showTooltip(
            event as MouseEvent,
            `Year: ${d.year}<br/>Energy Poverty: ${(d.energy_poverty || 0).toFixed(1)}%`,
          );
            d3.select(this).attr("opacity", 0.8);
          })
          .on("mouseout", function () {
          hideTooltip();
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
      const xAxis = g
        .append("g")
        .attr("transform", `translate(0,${chartHeight})`)
        .call(
          d3.axisBottom(x).tickValues(uniqueYears.map((y) => y.toString())),
        );

      xAxis
        .selectAll("text")
        .style("text-anchor", "end")
        .attr("dx", "-.8em")
        .attr("dy", ".15em")
        .attr("transform", "rotate(-45)");

      g.append("g").call(d3.axisLeft(y));
      addBandOverlayTooltip(
        g,
        chartWidth,
        chartHeight,
        x,
        details.time_series,
        (d) =>
          `Year: ${d.year}<br/>Electricity: ${(d.energy_poverty || 0).toFixed(1)}%<br/>Multidimensional: ${(d.energy_poverty_multidimensional || 0).toFixed(1)}%`,
      );
    }

    // Electricity Per Capita Chart
    if (
      chartRefs.electricityPerCapita.current &&
      details.time_series.length > 0
    ) {
      const dims = chartDimensions.electricityPerCapita || {
        width: 500,
        height: 300,
      };
      const chartWidth = dims.width - margin.left - margin.right;
      const chartHeight = dims.height - margin.top - margin.bottom;

      const svg = d3.select(chartRefs.electricityPerCapita.current);
      svg.selectAll("*").remove();
      svg
        .attr("width", dims.width)
        .attr("height", dims.height)
        .attr("viewBox", `0 0 ${dims.width} ${dims.height}`)
        .attr("preserveAspectRatio", "xMidYMid meet");

      const g = svg
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

      const x = d3
        .scaleLinear()
        .domain(
          d3.extent(details.time_series, (d) => d.year) as [number, number],
        )
        .range([0, chartWidth]);

      const y = d3
        .scaleLinear()
        .domain([
          0,
          d3.max(details.time_series, (d) =>
            Math.max(
              d.electricity_demand_per_capita || 0,
              d.electricity_demand_per_capita_with_access || 0,
            ),
          ) || 0,
        ] as [number, number])
        .range([chartHeight, 0]);

      const perCapitaLine = d3
        .line<(typeof details.time_series)[0]>()
        .x((d) => x(d.year))
        .y((d) => y(d.electricity_demand_per_capita || 0))
        .curve(d3.curveMonotoneX);

      const withAccessLine = d3
        .line<(typeof details.time_series)[0]>()
        .x((d) => x(d.year))
        .y((d) => y(d.electricity_demand_per_capita_with_access || 0))
        .curve(d3.curveMonotoneX);

      g.append("path")
        .datum(details.time_series)
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
        .datum(details.time_series)
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
      const years = details.time_series.map((d) => d.year);
      const { tickValues } = calculateYearTicks(years, plotWidthForTicks);

      // X-axis with rotated labels
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
        details.time_series,
        (d) =>
          `Year: ${d.year}<br/>Rural: ${(d.energy_poverty_rural || 0).toFixed(1)}%<br/>Urban: ${(d.energy_poverty_urban || 0).toFixed(1)}%`,
      );

      // Add hover circles for per capita line
      g.selectAll(".per-capita-circle")
        .data(
          details.time_series.filter(
            (d) =>
              d.electricity_demand_per_capita !== null &&
              d.electricity_demand_per_capita !== undefined,
          ),
        )
        .enter()
        .append("circle")
        .attr("class", "per-capita-circle")
        .attr("cx", (d) => x(d.year))
        .attr("cy", (d) => y(d.electricity_demand_per_capita || 0))
        .attr("r", 4)
        .attr("fill", "#9333EA")
        .attr("opacity", 0)
        .style("cursor", "pointer")
        .on("mouseover", function (event, d) {
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

      // Add hover circles for with access line
      g.selectAll(".with-access-circle")
        .data(
          details.time_series.filter(
            (d) =>
              d.electricity_demand_per_capita_with_access !== null &&
              d.electricity_demand_per_capita_with_access !== undefined,
          ),
        )
        .enter()
        .append("circle")
        .attr("class", "with-access-circle")
        .attr("cx", (d) => x(d.year))
        .attr("cy", (d) => y(d.electricity_demand_per_capita_with_access || 0))
        .attr("r", 4)
        .attr("fill", "#1E3A8A")
        .attr("opacity", 0)
        .style("cursor", "pointer")
        .on("mouseover", function (event, d) {
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
    }

    // Energy Poverty Comparison Chart (Electricity vs Multidimensional)
    if (
      chartRefs.energyPovertyComparison.current &&
      details.time_series.length > 0
    ) {
      const dims = chartDimensions.energyPovertyComparison || {
        width: 500,
        height: 300,
      };
      const chartWidth = dims.width - margin.left - margin.right;
      const chartHeight = dims.height - margin.top - margin.bottom;

      const svg = d3.select(chartRefs.energyPovertyComparison.current);
      svg.selectAll("*").remove();
      svg
        .attr("width", dims.width)
        .attr("height", dims.height)
        .attr("viewBox", `0 0 ${dims.width} ${dims.height}`)
        .attr("preserveAspectRatio", "xMidYMid meet");

      const g = svg
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

      const x = d3
        .scaleLinear()
        .domain(
          d3.extent(details.time_series, (d) => d.year) as [number, number],
        )
        .range([0, chartWidth]);

      // Calculate max value from both series
      const maxValue =
        d3.max(details.time_series, (d) =>
          Math.max(
            d.energy_poverty || 0,
            d.energy_poverty_multidimensional || 0,
          ),
        ) || 100;

      const y = d3
        .scaleLinear()
        .domain([0, Math.max(100, maxValue)])
        .range([chartHeight, 0]);

      const electricityLine = d3
        .line<(typeof details.time_series)[0]>()
        .x((d) => x(d.year))
        .y((d) => y(d.energy_poverty || 0))
        .defined(
          (d) => d.energy_poverty !== null && d.energy_poverty !== undefined,
        )
        .curve(d3.curveMonotoneX);

      const multidimensionalLine = d3
        .line<(typeof details.time_series)[0]>()
        .x((d) => x(d.year))
        .y((d) => y(d.energy_poverty_multidimensional || 0))
        .defined(
          (d) =>
            d.energy_poverty_multidimensional !== null &&
            d.energy_poverty_multidimensional !== undefined,
        )
        .curve(d3.curveMonotoneX);

      g.append("path")
        .datum(details.time_series)
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
        .datum(details.time_series)
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
      const years = details.time_series.map((d) => d.year);
      const { tickValues } = calculateYearTicks(years, plotWidthForTicks);

      // X-axis with rotated labels
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

      // Add hover circles for electricity line
      g.selectAll(".ep-electricity-circle")
        .data(
          details.time_series.filter(
            (d) => d.energy_poverty !== null && d.energy_poverty !== undefined,
          ),
        )
        .enter()
        .append("circle")
        .attr("class", "ep-electricity-circle")
        .attr("cx", (d) => x(d.year))
        .attr("cy", (d) => y(d.energy_poverty || 0))
        .attr("r", 4)
        .attr("fill", "#DC2626")
        .attr("opacity", 0)
        .style("cursor", "pointer")
        .on("mouseover", function (event, d) {
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

      // Add hover circles for multidimensional line
      g.selectAll(".ep-multidimensional-circle")
        .data(
          details.time_series.filter(
            (d) =>
              d.energy_poverty_multidimensional !== null &&
              d.energy_poverty_multidimensional !== undefined,
          ),
        )
        .enter()
        .append("circle")
        .attr("class", "ep-multidimensional-circle")
        .attr("cx", (d) => x(d.year))
        .attr("cy", (d) => y(d.energy_poverty_multidimensional || 0))
        .attr("r", 4)
        .attr("fill", "#9333EA")
        .attr("opacity", 0)
        .style("cursor", "pointer")
        .on("mouseover", function (event, d) {
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
    }

    // Energy Poverty Rural vs Urban Chart
    if (
      chartRefs.energyPovertyRuralUrban.current &&
      details.time_series.length > 0
    ) {
      const dims = chartDimensions.energyPovertyRuralUrban || {
        width: 500,
        height: 300,
      };
      const chartWidth = dims.width - margin.left - margin.right;
      const chartHeight = dims.height - margin.top - margin.bottom;

      const svg = d3.select(chartRefs.energyPovertyRuralUrban.current);
      svg.selectAll("*").remove();
      svg
        .attr("width", dims.width)
        .attr("height", dims.height)
        .attr("viewBox", `0 0 ${dims.width} ${dims.height}`)
        .attr("preserveAspectRatio", "xMidYMid meet");

      const g = svg
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

      const x = d3
        .scaleLinear()
        .domain(
          d3.extent(details.time_series, (d) => d.year) as [number, number],
        )
        .range([0, chartWidth]);

      // Calculate max value from both series
      const maxValue =
        d3.max(details.time_series, (d) =>
          Math.max(d.energy_poverty_rural || 0, d.energy_poverty_urban || 0),
        ) || 100;

      const y = d3
        .scaleLinear()
        .domain([0, Math.max(100, maxValue)])
        .range([chartHeight, 0]);

      const ruralLine = d3
        .line<(typeof details.time_series)[0]>()
        .x((d) => x(d.year))
        .y((d) => y(d.energy_poverty_rural || 0))
        .defined(
          (d) =>
            d.energy_poverty_rural !== null &&
            d.energy_poverty_rural !== undefined,
        )
        .curve(d3.curveMonotoneX);

      const urbanLine = d3
        .line<(typeof details.time_series)[0]>()
        .x((d) => x(d.year))
        .y((d) => y(d.energy_poverty_urban || 0))
        .defined(
          (d) =>
            d.energy_poverty_urban !== null &&
            d.energy_poverty_urban !== undefined,
        )
        .curve(d3.curveMonotoneX);

      g.append("path")
        .datum(details.time_series)
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
        .datum(details.time_series)
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
      const years = details.time_series.map((d) => d.year);
      const { tickValues } = calculateYearTicks(years, plotWidthForTicks);

      // X-axis with rotated labels
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

      // Add hover circles for rural line
      g.selectAll(".ep-rural-circle")
        .data(
          details.time_series.filter(
            (d) =>
              d.energy_poverty_rural !== null &&
              d.energy_poverty_rural !== undefined,
          ),
        )
        .enter()
        .append("circle")
        .attr("class", "ep-rural-circle")
        .attr("cx", (d) => x(d.year))
        .attr("cy", (d) => y(d.energy_poverty_rural || 0))
        .attr("r", 4)
        .attr("fill", "#F97316")
        .attr("opacity", 0)
        .style("cursor", "pointer")
        .on("mouseover", function (event, d) {
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

      // Add hover circles for urban line
      g.selectAll(".ep-urban-circle")
        .data(
          details.time_series.filter(
            (d) =>
              d.energy_poverty_urban !== null &&
              d.energy_poverty_urban !== undefined,
          ),
        )
        .enter()
        .append("circle")
        .attr("class", "ep-urban-circle")
        .attr("cx", (d) => x(d.year))
        .attr("cy", (d) => y(d.energy_poverty_urban || 0))
        .attr("r", 4)
        .attr("fill", "#10B981")
        .attr("opacity", 0)
        .style("cursor", "pointer")
        .on("mouseover", function (event, d) {
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
    }

    // Cleanup tooltip on unmount
    return () => {
      if (tooltipObserver) tooltipObserver.disconnect();
      d3.select("body").select(".chart-tooltip").remove();
    };
  }, [details, chartDimensions]);

  const formatNumber = (
    value: number | null | undefined,
    unit: string = "",
  ): string => {
    if (value === null || value === undefined) return "N/A";
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M${unit}`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K${unit}`;
    return `${value.toFixed(1)}${unit}`;
  };

  const formatPercentage = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return "N/A";
    return `${value.toFixed(1)}%`;
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed top-0 right-0 h-full w-full bg-white-1 shadow-xl z-50 transform transition-transform duration-300 ease-in-out overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[1.5rem] font-inter font-semibold text-black-1">
              {countryName}
            </h2>
            <button
              onClick={onClose}
              className="text-grey-2 hover:text-black-1 transition-colors"
              aria-label="Close drawer"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path
                  d="M18 6L6 18M6 6L18 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <span className="text-grey-2 text-[1rem] font-inter">
                Loading country data...
              </span>
            </div>
          ) : details ? (
            <>
              {/* Key Figures */}
              <div className="flex flex-wrap gap-4 mb-6">
                <div
                  className="rounded-[8px] p-4 text-white-1 flex-1 min-w-[200px]"
                  style={{ backgroundColor: "#BE2628" }}
                >
                  <div className="text-[0.875rem] font-inter mb-1">
                    Electricity
                  </div>
                  <div className="text-[2rem] font-inter font-bold">
                    {formatPercentage(details.key_figures.electricity_access)}
                  </div>
                </div>
                <div className="bg-grey-1 rounded-[8px] p-4 flex-1 min-w-[200px]">
                  <div className="text-[0.875rem] font-inter text-grey-2 mb-1">
                    Population
                  </div>
                  <div className="text-[2rem] font-inter font-bold text-black-1">
                    {formatNumber(details.key_figures.population)}
                  </div>
                </div>
                <div className="bg-grey-1 rounded-[8px] p-4 flex-1 min-w-[200px]">
                  <div className="text-[0.875rem] font-inter text-grey-2 mb-1">
                    Energy Poverty
                  </div>
                  <div className="text-[2rem] font-inter font-bold text-black-1">
                    {formatPercentage(details.key_figures.energy_poverty)}
                  </div>
                </div>
              </div>

              {/* Charts Grid */}
              <div className="flex flex-wrap gap-4">
                {/* Electricity Access Chart */}
                <div className="bg-white-1 border border-grey-1 rounded-[8px] p-4 flex-1 min-w-0 w-full max-w-full">
                  <h3 className="text-[0.875rem] font-inter font-semibold text-black-1 mb-4">
                    Electricity Demand & Generation (TWh)
                  </h3>
                  <div ref={containerRefs.electricityAccess} className="w-full">
                    <svg
                      ref={chartRefs.electricityAccess}
                      className="w-full h-auto"
                    ></svg>
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
                </div>

                {/* CO2 Emission Chart */}
                <div className="bg-white-1 border border-grey-1 rounded-[8px] p-4 flex-1 min-w-0 w-full max-w-full">
                  <h3 className="text-[0.875rem] font-inter font-semibold text-black-1 mb-4">
                    CO2 Emission per Capita (gCO₂/kWh)
                  </h3>
                  <div ref={containerRefs.co2Emission} className="w-full">
                    <svg
                      ref={chartRefs.co2Emission}
                      className="w-full h-auto"
                    ></svg>
                  </div>
                </div>

                {/* Population Chart */}
                <div className="bg-white-1 border border-grey-1 rounded-[8px] p-4 flex-1 min-w-0 w-full max-w-full">
                  <h3 className="text-[0.875rem] font-inter font-semibold text-black-1 mb-4">
                    Population (Millions)
                  </h3>
                  <div ref={containerRefs.population} className="w-full">
                    <svg
                      ref={chartRefs.population}
                      className="w-full h-auto"
                    ></svg>
                  </div>
                </div>

                {/* Clean Cooking Access Chart */}
                <div className="bg-white-1 border border-grey-1 rounded-[8px] p-4 flex-1 min-w-0 w-full max-w-full">
                  <h3 className="text-[0.875rem] font-inter font-semibold text-black-1 mb-4">
                    Clean Cooking Access (%)
                  </h3>
                  <div ref={containerRefs.cleanCooking} className="w-full">
                    <svg
                      ref={chartRefs.cleanCooking}
                      className="w-full h-auto"
                    ></svg>
                  </div>
                  <div className="flex gap-4 mt-2 text-[0.75rem] font-inter">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-500"></div>
                      <span className="text-grey-2">Clean</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-orange-500"></div>
                      <span className="text-grey-2">Traditional</span>
                    </div>
                  </div>
                </div>

                {/* Energy Poverty Chart */}
                <div className="bg-white-1 border border-grey-1 rounded-[8px] p-4 flex-1 min-w-0 w-full max-w-full">
                  <h3 className="text-[0.875rem] font-inter font-semibold text-black-1 mb-4">
                    Energy Poverty Index (%)
                  </h3>
                  <div ref={containerRefs.energyPoverty} className="w-full">
                    <svg
                      ref={chartRefs.energyPoverty}
                      className="w-full h-auto"
                    ></svg>
                  </div>
                </div>

                {/* Electricity Per Capita Chart */}
                <div className="bg-white-1 border border-grey-1 rounded-[8px] p-4 flex-1 min-w-0 w-full max-w-full">
                  <h3 className="text-[0.875rem] font-inter font-semibold text-black-1 mb-4">
                    Electricity Per Capita (MWh/year)
                  </h3>
                  <div
                    ref={containerRefs.electricityPerCapita}
                    className="w-full"
                  >
                    <svg
                      ref={chartRefs.electricityPerCapita}
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
                </div>

                {/* Energy Poverty Comparison Chart */}
                <div className="bg-white-1 border border-grey-1 rounded-[8px] p-4 flex-1 min-w-0 w-full max-w-full">
                  <h3 className="text-[0.875rem] font-inter font-semibold text-black-1 mb-4">
                    Energy Poverty Comparison (%)
                  </h3>
                  <div
                    ref={containerRefs.energyPovertyComparison}
                    className="w-full"
                  >
                    <svg
                      ref={chartRefs.energyPovertyComparison}
                      className="w-full h-auto"
                    ></svg>
                  </div>
                  <div className="flex gap-4 mt-2 text-[0.75rem] font-inter">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-red-600"></div>
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
                </div>

                {/* Energy Poverty Rural vs Urban Chart */}
                <div className="bg-white-1 border border-grey-1 rounded-[8px] p-4 flex-1 min-w-0 w-full max-w-full">
                  <h3 className="text-[0.875rem] font-inter font-semibold text-black-1 mb-4">
                    Energy Poverty: Rural vs Urban (%)
                  </h3>
                  <div
                    ref={containerRefs.energyPovertyRuralUrban}
                    className="w-full"
                  >
                    <svg
                      ref={chartRefs.energyPovertyRuralUrban}
                      className="w-full h-auto"
                    ></svg>
                  </div>
                  <div className="flex gap-4 mt-2 text-[0.75rem] font-inter">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-orange-500"></div>
                      <span className="text-grey-2">Rural</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-500"></div>
                      <span className="text-grey-2">Urban</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center py-20">
              <span className="text-grey-2 text-[1rem] font-inter">
                No data available for this country
              </span>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
