import * as d3 from "d3";

export type ChartMargin = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export function getChartSize(
  containerWidth: number,
  padding = 0,
  aspectRatio = 0.6,
) {
  const width = Math.max(200, containerWidth - padding);
  const height = Math.max(160, width * aspectRatio);
  return { width, height };
}

export function getChartMargins(
  totalWidth: number,
  options?: { rotateXLabels?: boolean },
): ChartMargin {
  const narrow = totalWidth < 480;
  const veryNarrow = totalWidth < 360;

  return {
    top: veryNarrow ? 24 : 30,
    right: veryNarrow ? 12 : narrow ? 20 : 30,
    bottom: options?.rotateXLabels
      ? veryNarrow
        ? 72
        : narrow
          ? 64
          : 60
      : narrow
        ? 48
        : 60,
    left: veryNarrow ? 40 : narrow ? 52 : 70,
  };
}

export function measureChartContainer(
  container: HTMLElement | null,
  padding = 0,
  aspectRatio = 0.6,
) {
  const containerWidth = container?.offsetWidth ?? 0;
  return getChartSize(containerWidth, padding, aspectRatio);
}

// Pick year tick spacing from the data range.
export function calculateYearTicks(
  years: number[],
  chartWidth?: number,
): {
  tickInterval: number;
  tickValues: number[];
} {
  if (years.length === 0) {
    return { tickInterval: 1, tickValues: [] };
  }

  const uniqueYears = [...new Set(years)].sort((a, b) => a - b);

  const minYear = uniqueYears[0];
  const maxYear = uniqueYears[uniqueYears.length - 1];
  const yearRange = maxYear - minYear;

  let tickInterval: number;
  if (yearRange <= 10) {
    tickInterval = 1;
  } else if (yearRange <= 20) {
    tickInterval = 2;
  } else if (yearRange <= 30) {
    tickInterval = 5;
  } else if (yearRange <= 50) {
    tickInterval = 5;
  } else if (yearRange <= 100) {
    tickInterval = 10;
  } else {
    tickInterval = 20;
  }

  const tickValues: number[] = [];
  tickValues.push(minYear);

  for (let year = minYear + tickInterval; year < maxYear; year += tickInterval) {
    tickValues.push(year);
  }

  if (tickValues[tickValues.length - 1] !== maxYear) {
    tickValues.push(maxYear);
  }

  if (chartWidth && chartWidth < 480 && tickValues.length > 6) {
    const step = Math.max(2, Math.ceil(tickValues.length / 5));
    const thinned = tickValues.filter(
      (_, index) =>
        index === 0 ||
        index === tickValues.length - 1 ||
        index % step === 0,
    );
    return { tickInterval, tickValues: thinned };
  }

  return { tickInterval, tickValues };
}

export function getAxisFontSize(totalWidth: number) {
  return totalWidth < 360 ? "10px" : totalWidth < 480 ? "11px" : "12px";
}

const SUPERSCRIPT_DIGITS = "⁰¹²³⁴⁵⁶⁷⁸⁹";

function toSuperscript(value: number): string {
  if (value === 0) return "⁰";
  const digits = String(Math.abs(value)).split("");
  return digits.map((d) => SUPERSCRIPT_DIGITS[Number(d)]).join("");
}

/** Compact tick labels; uses mantissa×10ⁿ for large magnitudes. */
export function formatChartAxisValue(value: number): string {
  if (!Number.isFinite(value)) return "";
  const abs = Math.abs(value);
  if (abs === 0) return "0";
  if (abs < 10_000) {
    return abs >= 100 ? d3.format(",.0f")(value) : d3.format(".2~f")(value);
  }
  const exponent = Math.floor(Math.log10(abs));
  const mantissa = value / 10 ** exponent;
  const mantissaText =
    Math.abs(mantissa) >= 10
      ? d3.format(".0f")(mantissa)
      : d3.format(".1f")(mantissa);
  return `${mantissaText}×10${toSuperscript(exponent)}`;
}

export function getYAxisMargin(maxValue: number, baseLeft: number): number {
  const sample = formatChartAxisValue(maxValue * 1.08 || 1);
  const extra = Math.max(0, sample.length - 5) * 6;
  return baseLeft + extra;
}

type ChartTooltip = d3.Selection<HTMLDivElement, unknown, HTMLElement, unknown>;

let chartTooltipObserver: MutationObserver | null = null;

export function keepChartTooltipInViewport(tooltip: ChartTooltip) {
  const node = tooltip.node();
  if (!node) return;

  const viewportRight = window.innerWidth;
  const viewportBottom = window.innerHeight;
  const padding = 10;
  const edgeBuffer = 24;
  let left = parseFloat(tooltip.style("left")) || padding;
  let top = parseFloat(tooltip.style("top")) || padding;
  const scrollX = window.scrollX || window.pageXOffset;
  const scrollY = window.scrollY || window.pageYOffset;
  if (left > viewportRight + padding) left -= scrollX;
  if (top > viewportBottom + padding) top -= scrollY;
  const width = node.offsetWidth;
  const height = node.offsetHeight;

  if (left + width + edgeBuffer > viewportRight) {
    left = left - width - 28;
  }
  if (left < padding) left = padding;
  if (top + height + edgeBuffer > viewportBottom) {
    top = viewportBottom - height - padding;
  }
  if (top < padding) top = padding;

  tooltip.style("left", `${left}px`).style("top", `${top}px`);
}

export function getChartTooltip(className = "chart-tooltip"): ChartTooltip {
  let tooltip = d3.select("body").select<HTMLDivElement>(className);
  if (tooltip.empty()) {
    tooltip = d3
      .select("body")
      .append("div")
      .attr("class", className)
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

  const node = tooltip.node();
  if (node && !chartTooltipObserver) {
    chartTooltipObserver = new MutationObserver(() => {
      keepChartTooltipInViewport(tooltip);
    });
    chartTooltipObserver.observe(node, {
      attributes: true,
      attributeFilter: ["style"],
      childList: true,
      subtree: true,
    });
  }

  return tooltip;
}

export function showChartTooltip(
  tooltip: ChartTooltip,
  event: MouseEvent,
  html: string,
) {
  tooltip
    .html(html)
    .style("left", `${event.clientX + 14}px`)
    .style("top", `${event.clientY - 16}px`)
    .style("opacity", 1);
  keepChartTooltipInViewport(tooltip);
}

export function hideChartTooltip(tooltip: ChartTooltip) {
  tooltip.transition().duration(120).style("opacity", 0);
}
