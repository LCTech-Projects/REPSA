import { useEffect, useRef } from "react";
import * as d3 from "d3";
import { ChartCard } from "../cards/ChartCard";
import {
  OUTPUT_CHARTS,
  type ForecastPoint,
  type ScenarioResult,
} from "../../types/scenarioExplorer";
import {
  calculateYearTicks,
  formatChartAxisValue,
  getAxisFontSize,
  getChartMargins,
  getChartSize,
  getChartTooltip,
  getYAxisMargin,
  hideChartTooltip,
  showChartTooltip,
} from "../utils/ChartUtils";

interface ScenarioExplorerChartsProps {
  result: ScenarioResult;
}

const formatTooltipValue = (value: number) => {
  if (!Number.isFinite(value)) return "n/a";
  if (Math.abs(value) >= 10_000) return formatChartAxisValue(value);
  return d3.format(",.2f")(value);
};

const renderChart = (
  svg: SVGSVGElement,
  width: number,
  title: string,
  yLabel: string,
  scenario: ForecastPoint[],
  low: ForecastPoint[],
  high: ForecastPoint[],
  persistence: ForecastPoint[],
  trend: ForecastPoint[],
) => {
  const allValues = [
    ...scenario.map((d) => d.value),
    ...low.map((d) => d.value),
    ...high.map((d) => d.value),
    ...persistence.map((d) => d.value),
    ...trend.map((d) => d.value),
  ];
  const height = Math.max(220, Math.round(width * 0.45));
  const baseMargin = getChartMargins(width, { rotateXLabels: true });
  const yMax = d3.max(allValues)! * 1.08 || 1;
  const margin = {
    ...baseMargin,
    left: getYAxisMargin(yMax, baseMargin.left),
  };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  const svgSel = d3.select(svg);
  svgSel.selectAll("*").remove();
  svgSel.attr("width", width).attr("height", height);

  const x = d3
    .scaleLinear()
    .domain(d3.extent(scenario, (d) => d.year) as [number, number])
    .range([0, plotWidth]);
  const y = d3
    .scaleLinear()
    .domain([0, yMax])
    .nice()
    .range([plotHeight, 0]);

  const g = svgSel
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const yearTickInfo = calculateYearTicks(
    scenario.map((d) => d.year),
    plotWidth,
  );

  g.append("g")
    .attr("transform", `translate(0,${plotHeight})`)
    .call(
      d3
        .axisBottom(x)
        .tickValues(yearTickInfo.tickValues)
        .tickFormat(d3.format("d")),
    )
    .selectAll("text")
    .attr("transform", "rotate(-35)")
    .style("text-anchor", "end");

  g.append("g")
    .call(d3.axisLeft(y).ticks(5).tickFormat((d) => formatChartAxisValue(Number(d))))
    .selectAll("text")
    .attr("font-size", getAxisFontSize(width));
  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", -(margin.left - 8))
    .attr("x", -plotHeight / 2)
    .attr("text-anchor", "middle")
    .attr("fill", "#666")
    .attr("font-size", "11px")
    .text(yLabel);

  const area = d3
    .area<ForecastPoint>()
    .x((d) => x(d.year))
    .y0((d, i) => y(low[i]?.value ?? d.value))
    .y1((d, i) => y(high[i]?.value ?? d.value))
    .curve(d3.curveMonotoneX);

  g.append("path")
    .datum(scenario)
    .attr("fill", "#93C5FD")
    .attr("opacity", 0.35)
    .attr("d", area as any);

  const line = d3
    .line<ForecastPoint>()
    .x((d) => x(d.year))
    .y((d) => y(d.value))
    .curve(d3.curveMonotoneX);

  g.append("path")
    .datum(persistence)
    .attr("fill", "none")
    .attr("stroke", "#9CA3AF")
    .attr("stroke-width", 1.5)
    .attr("stroke-dasharray", "4 4")
    .attr("d", line);

  g.append("path")
    .datum(trend)
    .attr("fill", "none")
    .attr("stroke", "#F59E0B")
    .attr("stroke-width", 1.5)
    .attr("stroke-dasharray", "6 3")
    .attr("d", line);

  g.append("path")
    .datum(scenario)
    .attr("fill", "none")
    .attr("stroke", "#1E3A8A")
    .attr("stroke-width", 2.5)
    .attr("d", line);

  const tooltip = getChartTooltip();

  const byYear = (points: ForecastPoint[]) =>
    new Map(points.map((point) => [point.year, point.value]));

  const scenarioByYear = byYear(scenario);
  const lowByYear = byYear(low);
  const highByYear = byYear(high);
  const persistenceByYear = byYear(persistence);
  const trendByYear = byYear(trend);
  const years = scenario.map((point) => point.year);
  const bisect = d3.bisector<number, number>((year) => year).left;

  g.append("rect")
    .attr("width", plotWidth)
    .attr("height", plotHeight)
    .attr("fill", "transparent")
    .style("cursor", "crosshair")
    .on("mousemove", function (event) {
      const [mx] = d3.pointer(event, this);
      const targetYear = x.invert(mx);
      const index = Math.max(0, Math.min(years.length - 1, bisect(years, targetYear)));
      const year = years[index];

      showChartTooltip(
        tooltip,
        event,
        `<strong>${title}</strong><br/>Year: ${year}<br/>Scenario: ${formatTooltipValue(scenarioByYear.get(year) ?? NaN)} ${yLabel}<br/>80% band: ${formatTooltipValue(lowByYear.get(year) ?? NaN)} – ${formatTooltipValue(highByYear.get(year) ?? NaN)}<br/>Persistence: ${formatTooltipValue(persistenceByYear.get(year) ?? NaN)}<br/>Historical trend: ${formatTooltipValue(trendByYear.get(year) ?? NaN)}`,
      );
    })
    .on("mouseleave", () => {
      hideChartTooltip(tooltip);
    });
};

const ChartBlock = ({
  title,
  yLabel,
  scenario,
  low,
  high,
  persistence,
  trend,
}: {
  title: string;
  yLabel: string;
  scenario: ForecastPoint[];
  low: ForecastPoint[];
  high: ForecastPoint[];
  persistence: ForecastPoint[];
  trend: ForecastPoint[];
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const svg = svgRef.current;
    if (!container || !svg || scenario.length === 0) return;

    const draw = () => {
      const width = container.offsetWidth || 500;
      const { width: chartWidth } = getChartSize(width);
      renderChart(
        svg,
        chartWidth,
        title,
        yLabel,
        scenario,
        low,
        high,
        persistence,
        trend,
      );
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(container);
    return () => {
      observer.disconnect();
      hideChartTooltip(getChartTooltip());
    };
  }, [title, scenario, low, high, persistence, trend, yLabel]);

  return (
    <ChartCard title={title}>
      <div ref={containerRef} className="w-full">
        <svg ref={svgRef} className="w-full h-auto" />
      </div>
      <div className="flex flex-wrap gap-4 mt-2 text-[0.75rem] font-inter">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-blue-1" />
          <span className="text-grey-2">Scenario</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-2 bg-blue-200 opacity-70" />
          <span className="text-grey-2">80% band</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-0 border-t-2 border-dashed border-grey-2" />
          <span className="text-grey-2">Persistence</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-0 border-t-2 border-dashed border-yellow-500" />
          <span className="text-grey-2">Historical trend</span>
        </div>
      </div>
    </ChartCard>
  );
};

export const ScenarioExplorerCharts = ({ result }: ScenarioExplorerChartsProps) => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-w-0">
    {OUTPUT_CHARTS.map(({ key, title, yLabel }) => {
      const series = result.forecasts[key];
      if (!series) return null;
      return (
        <ChartBlock
          key={key}
          title={title}
          yLabel={yLabel}
          scenario={series.scenario}
          low={series.low}
          high={series.high}
          persistence={result.baselines.persistence[key] || []}
          trend={result.baselines.historical_trend[key] || []}
        />
      );
    })}
  </div>
);
