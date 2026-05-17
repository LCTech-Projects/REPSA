// Pick year tick spacing from the data range.
export function calculateYearTicks(years: number[]): {
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

  return { tickInterval, tickValues };
}
