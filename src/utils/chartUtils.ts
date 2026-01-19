/**
 * Calculate appropriate year tick interval based on the number of years
 * Ensures no more than 16 years are displayed and uses intervals of 1, 5, or 10
 * 
 * @param years - Array of years in the data
 * @param maxYears - Maximum number of years to display (default: 16)
 * @returns Object with tickInterval and tickValues
 */
export function calculateYearTicks(
    years: number[],
    maxYears: number = 16
): { tickInterval: number; tickValues: number[] } {
    if (years.length === 0) {
        return { tickInterval: 1, tickValues: [] };
    }

    // Sort and get unique years
    const uniqueYears = [...new Set(years)].sort((a, b) => a - b);
    
    // If we have more than maxYears, limit the displayed years
    let displayYears = uniqueYears;
    if (uniqueYears.length > maxYears) {
        // Take the most recent maxYears years
        displayYears = uniqueYears.slice(-maxYears);
    }
    
    const displayRange = displayYears[displayYears.length - 1] - displayYears[0] + 1;
    const numYears = displayYears.length;
    
    // Calculate appropriate interval based on number of years
    let tickInterval: number;
    if (numYears <= 8) {
        tickInterval = 1; // Show every year if 8 or fewer years
    } else if (numYears <= 16) {
        tickInterval = 2; // Show every 2 years if 9-16 years
    } else if (displayRange <= 50) {
        tickInterval = 5; // Show every 5 years if 17-50 years
    } else {
        tickInterval = 10; // Show every 10 years if more than 50 years
    }
    
    // Generate tick values
    const minYear = displayYears[0];
    const maxYear = displayYears[displayYears.length - 1];
    const tickValues: number[] = [];
    
    // Always include the first and last year
    for (let year = minYear; year <= maxYear; year += tickInterval) {
        tickValues.push(year);
    }
    
    // Ensure the last year is included if it's not already
    if (tickValues[tickValues.length - 1] !== maxYear) {
        tickValues.push(maxYear);
    }
    
    return { tickInterval, tickValues };
}
