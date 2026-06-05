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
