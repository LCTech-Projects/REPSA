/** Shared display helpers for REPSA UI metrics. */

export function formatPopulation(people: number | null | undefined): string {
  if (people == null || !Number.isFinite(people) || people < 0) return "N/A";
  if (people >= 1_000_000) {
    const millions = people / 1_000_000;
    return millions >= 10
      ? `${millions.toFixed(0)}M`
      : `${millions.toFixed(2)}M`;
  }
  if (people >= 1_000) {
    return `${(people / 1_000).toFixed(1)}K`;
  }
  return people.toFixed(0);
}

/** Compact energy totals: prefer TWh for large MWh values. */
export function formatEnergyAmount(
  value: number,
  unit: "MWh" | "TWh" = "MWh",
  significantDigits = 4,
): string {
  if (!Number.isFinite(value)) return "N/A";
  let display = value;
  let outUnit = unit;
  if (unit === "MWh" && Math.abs(value) >= 10_000) {
    display = value / 1e6;
    outUnit = "TWh";
  }
  const digits = Math.max(
    0,
    significantDigits - Math.floor(Math.log10(Math.abs(display) || 1)) - 1,
  );
  return `${display.toFixed(Math.min(3, Math.max(0, digits)))} ${outUnit}`;
}
