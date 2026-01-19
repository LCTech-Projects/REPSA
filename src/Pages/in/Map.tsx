import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import * as d3 from "d3";
import { geoMercator, geoPath } from "d3-geo";
import { CountryPopup } from "../../components/CountryPopup";
import { africanCountries } from "../../components/Utils/countryData";
import { ArrowBlackIcon } from "../../components/Icons";
import { FilterDrawer } from "../../components/FilterDrawer";
import { apiSlice } from "../../appSlices/apiSlice";
import { useAppDispatch } from "../../app/hooks";

// Function to get color based on energy poverty level
// Gradient: Dark Green (best) -> Light Green -> Yellow -> Orange -> Red/Dark Red (worst)
const getCountryColorByEnergyPoverty = (energyPoverty: number | null | undefined): string => {
    if (energyPoverty === null || energyPoverty === undefined) return "#E5E5E5"; // Default grey for no data

    // Energy poverty ranges (higher = worse)
    if (energyPoverty >= 50) return '#DC2626'; // Dark Red (worst)
    if (energyPoverty >= 30) return '#F97316'; // Orange
    if (energyPoverty >= 15) return '#FCD34D'; // Yellow
    if (energyPoverty >= 5) return '#86EFAC'; // Light Green
    return '#065F46'; // Dark Green (best)
};

export const Map = () => {
    const navigate = useNavigate();
    const [hoveredCountryName, setHoveredCountryName] = useState<string | null>(null);
    const [hoveredCountryFlag, setHoveredCountryFlag] = useState<string>("");
    const [countrySummary, setCountrySummary] = useState<any>(null);
    const [summaryLoading, setSummaryLoading] = useState(false);
    const [geoData, setGeoData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [selectedYear, setSelectedYear] = useState<number | null>(null);
    const [availableYears, setAvailableYears] = useState<number[]>([]);
    const [energyPovertyMap, setEnergyPovertyMap] = useState<Record<string, number | null>>({});

    const handleYearChange = (year: number | null) => {
        setSelectedYear(year);
    };
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const dispatch = useAppDispatch();

    // Fetch available years on mount and set default to 2023 (or latest year if 2023 not available)
    useEffect(() => {
        dispatch(apiSlice.endpoints.getAvailableYears.initiate())
            .then((result: any) => {
                if (result.data?.success) {
                    const years = result.data.data.years;
                    const latestYear = result.data.data.latest_year;
                    setAvailableYears(years);
                    // Default to 2023 if available, otherwise use latest year
                    const defaultYear = years.includes(2023) ? 2023 : latestYear;
                    setSelectedYear(defaultYear);
                }
            })
            .catch(() => {
                // Handle error
            });
    }, [dispatch]);

    // Fetch energy poverty data for all countries when year changes
    useEffect(() => {
        if (selectedYear !== null) {
            dispatch(apiSlice.endpoints.getAllCountriesEnergyPoverty.initiate({ year: selectedYear }))
                .then((result: any) => {
                    if (result.data?.success) {
                        setEnergyPovertyMap(result.data.data);
                    }
                })
                .catch(() => {
                    // Handle error
                });
        }
    }, [selectedYear, dispatch]);

    // Refresh hover popup when year changes
    useEffect(() => {
        if (hoveredCountryName && selectedYear !== null) {
            setSummaryLoading(true);
            dispatch(apiSlice.endpoints.getCountrySummary.initiate({
                country: hoveredCountryName,
                year: selectedYear
            }))
                .then((result: any) => {
                    if (result.data?.success) {
                        setCountrySummary(result.data.data);
                    }
                    setSummaryLoading(false);
                })
                .catch(() => {
                    setSummaryLoading(false);
                });
        }
    }, [selectedYear, hoveredCountryName, dispatch]);

    useEffect(() => {
        setLoading(true);
        setError(null);
        // Fetch world GeoJSON data
        fetch("https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson")
            .then((res) => {
                if (!res.ok) throw new Error('Failed to fetch GeoJSON');
                return res.json();
            })
            .then((data) => {
                // Filter to show only African countries
                const africanCountryNames = [
                    "Algeria", "Angola", "Benin", "Botswana", "Burkina Faso", "Burundi", "Cabo Verde", "Cameroon",
                    "Central African Republic", "Chad", "Comoros", "Congo", "Côte d'Ivoire", "Ivory Coast", "Djibouti",
                    "DR Congo", "Democratic Republic of the Congo", "Egypt", "Equatorial Guinea", "Eritrea", "Eswatini",
                    "Ethiopia", "Gabon", "Gambia", "Ghana", "Guinea", "Guinea-Bissau", "Kenya", "Lesotho", "Liberia",
                    "Libya", "Madagascar", "Malawi", "Mali", "Mauritania", "Mauritius", "Morocco", "Mozambique",
                    "Namibia", "Niger", "Nigeria", "Rwanda", "São Tomé and Príncipe", "Senegal", "Seychelles",
                    "Sierra Leone", "Somalia", "South Africa", "South Sudan", "Sudan", "Tanzania", "Togo", "Tunisia",
                    "Uganda", "Zambia", "Zimbabwe"
                ];

                const africanData = {
                    ...data,
                    features: data.features.filter((feature: any) => {
                        const countryName = feature.properties.NAME || feature.properties.name || "";
                        const nameLower = countryName.toLowerCase();

                        return africanCountryNames.some(name =>
                            nameLower === name.toLowerCase() ||
                            nameLower.includes(name.toLowerCase()) ||
                            name.toLowerCase().includes(nameLower)
                        ) || africanCountries.some(c =>
                            c.name.toLowerCase() === nameLower ||
                            nameLower.includes(c.name.toLowerCase()) ||
                            c.name.toLowerCase().includes(nameLower)
                        );
                    })
                };
                console.log('African countries found:', africanData.features.length);
                setGeoData(africanData);
                setLoading(false);
            })
            .catch((err) => {
                console.error("Error loading GeoJSON:", err);
                setError(err.message);
                setLoading(false);
            });
    }, []);

    // Update dimensions on resize and initial load
    useEffect(() => {
        const updateDimensions = () => {
            if (containerRef.current) {
                const width = containerRef.current.offsetWidth || window.innerWidth;
                const height = containerRef.current.offsetHeight || window.innerHeight;
                setDimensions({
                    width,
                    height
                });
            }
        };

        // Initial update
        updateDimensions();

        // Use ResizeObserver for better dimension tracking
        const resizeObserver = new ResizeObserver(() => {
            updateDimensions();
        });

        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }

        window.addEventListener('resize', updateDimensions);

        return () => {
            window.removeEventListener('resize', updateDimensions);
            if (containerRef.current) {
                resizeObserver.unobserve(containerRef.current);
            }
        };
    }, []);

    // Draw map function - extracted so it can be called when energy poverty data changes
    const drawMap = useCallback(() => {
        if (!geoData || !svgRef.current) return;

        // Ensure we have valid dimensions
        const width = dimensions.width || (containerRef.current?.offsetWidth || window.innerWidth);
        const height = dimensions.height || (containerRef.current?.offsetHeight || window.innerHeight);

        if (width === 0 || height === 0) return;

        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove(); // Clear previous render

        // Set up projection - centered on Africa
        const projection = geoMercator()
            .center([20, 5])
            .scale(800)
            .translate([width / 2, height / 2]);

        const pathGenerator = geoPath().projection(projection);

        // Calculate bounds and fit to container - center the map
        // Make it bigger/zoomed in to cover ~80% of the page
        const bounds = pathGenerator.bounds(geoData as any);
        const dx = bounds[1][0] - bounds[0][0];
        const dy = bounds[1][1] - bounds[0][1];
        // Increase scale to zoom in more - 1.70 means map will be 70% larger (zoomed in)
        // This makes it cover about 80% of the viewport
        const scale = 1.70 / Math.max(dx / width, dy / height);

        // Center the map in the viewport
        const translateX = width / 2;
        const translateY = height / 2;

        // Adjust projection to center on the geographic center of Africa
        projection
            .scale(scale * 800)
            .translate([translateX, translateY])
            .center([20, 5]); // Center on Africa

        // Create country paths
        const countries = svg.append("g").attr("class", "countries");

        geoData.features.forEach((feature: any) => {
            const countryName = feature.properties.NAME || feature.properties.name || "";
            // More strict matching to avoid false positives (e.g., Niger matching Nigeria)
            const country = africanCountries.find(c => {
                const cNameLower = c.name.toLowerCase();
                const geoNameLower = countryName.toLowerCase();

                // Exact match (highest priority)
                if (cNameLower === geoNameLower) return true;

                // Check if GeoJSON name contains our country name as a complete word
                // This handles cases like "Democratic Republic of the Congo" matching "DR Congo"
                const wordBoundaryRegex = new RegExp(`\\b${cNameLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
                if (wordBoundaryRegex.test(geoNameLower)) return true;

                // Check if our country name contains GeoJSON name as a complete word
                // This handles cases like "Côte d'Ivoire" matching "Ivory Coast"
                const reverseWordBoundaryRegex = new RegExp(`\\b${geoNameLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
                if (reverseWordBoundaryRegex.test(cNameLower)) return true;

                return false;
            });

            // Get energy poverty for this country
            const countryEnergyPoverty = country ? energyPovertyMap[country.name] : null;
            const fillColor = getCountryColorByEnergyPoverty(countryEnergyPoverty);

            countries
                .append("path")
                .datum(feature)
                .attr("d", pathGenerator)
                .attr("fill", fillColor)
                .attr("fill-opacity", 0.7)
                .attr("stroke", "#FFFFFF")
                .attr("stroke-width", 1)
                .style("cursor", "pointer")
                .on("mouseenter", function () {
                    if (country) {
                        setHoveredCountryName(country.name);
                        setHoveredCountryFlag(country.flag);
                        setSummaryLoading(true);
                        // Fetch country summary with selected year
                        dispatch(apiSlice.endpoints.getCountrySummary.initiate({
                            country: country.name,
                            year: selectedYear || undefined
                        }))
                            .then((result: any) => {
                                if (result.data?.success) {
                                    setCountrySummary(result.data.data);
                                }
                                setSummaryLoading(false);
                            })
                            .catch(() => {
                                setSummaryLoading(false);
                            });
                        d3.select(this)
                            .attr("fill-opacity", 0.9)
                            .attr("stroke-width", 2)
                            .attr("stroke", "#1E3A8A");
                    }
                })
                .on("mouseleave", function () {
                    setHoveredCountryName(null);
                    setCountrySummary(null);
                    d3.select(this)
                        .attr("fill-opacity", 0.7)
                        .attr("stroke-width", 1)
                        .attr("stroke", "#FFFFFF");
                })
                .on("click", function () {
                    if (country) {
                        // Navigate to Visualization page with country and year
                        navigate("/in/visualization", {
                            state: {
                                country: country.name,
                                year: selectedYear
                            }
                        });
                    }
                });
        });

        // Add zoom behavior
        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.5, 4])
            .on("zoom", (event) => {
                countries.attr("transform", event.transform.toString());
            });

        svg.call(zoom as any);
    }, [geoData, dimensions, energyPovertyMap, selectedYear, dispatch, setHoveredCountryName, setHoveredCountryFlag, setSummaryLoading, setCountrySummary, navigate]);

    // Draw map when data and dimensions are ready
    useEffect(() => {
        if (!geoData || !svgRef.current) return;

        // Ensure we have valid dimensions
        const width = dimensions.width || (containerRef.current?.offsetWidth || window.innerWidth);
        const height = dimensions.height || (containerRef.current?.offsetHeight || window.innerHeight);

        if (width === 0 || height === 0) {
            // Retry after a short delay if dimensions aren't ready
            const timer = setTimeout(() => {
                if (containerRef.current) {
                    const w = containerRef.current.offsetWidth || window.innerWidth;
                    const h = containerRef.current.offsetHeight || window.innerHeight;
                    if (w > 0 && h > 0) {
                        setDimensions({ width: w, height: h });
                    }
                }
            }, 100);
            return () => clearTimeout(timer);
        }

        drawMap();
    }, [geoData, dimensions, drawMap, energyPovertyMap]);

    return (
        <section className="w-full h-screen relative bg-[url('/images/bg1.png')] bg-cover bg-center bg-no-repeat">
            {/* Filter Button */}
            <div className="absolute top-4 left-4 z-50">
                <button
                    onClick={() => setIsFilterOpen(true)}
                    className="bg-white-1 rounded-[8px] shadow-lg px-4 py-2 flex items-center gap-2 text-[0.875rem] font-inter hover:bg-grey-1 transition-colors"
                >
                    Filters
                    <ArrowBlackIcon />
                </button>
            </div>

            {/* Filter Drawer */}
            <FilterDrawer
                isOpen={isFilterOpen}
                onClose={() => setIsFilterOpen(false)}
                availableYears={availableYears}
                selectedYear={selectedYear}
                onYearChange={handleYearChange}
            />

            {/* Hover Popup */}
            {hoveredCountryName && (
                <div className="absolute top-20 left-4 z-50">
                    <CountryPopup
                        countryName={hoveredCountryName}
                        countryFlag={hoveredCountryFlag}
                        summary={countrySummary}
                        loading={summaryLoading}
                    />
                </div>
            )}

            {/* Loading State */}
            {loading && (
                <div className="w-full h-full flex items-center justify-center">
                    <p className="text-blue-1 text-[1rem] font-inter">Loading map...</p>
                </div>
            )}

            {/* Error State */}
            {error && (
                <div className="w-full h-full flex items-center justify-center">
                    <p className="text-red-500 text-[1rem] font-inter">Error: {error}</p>
                </div>
            )}

            {/* D3 Map */}
            {geoData && !loading && !error && (
                <div ref={containerRef} className="w-full h-full flex items-center justify-center">
                    <svg
                        ref={svgRef}
                        width="100%"
                        height="100%"
                        style={{ cursor: 'grab' }}
                    />
                </div>
            )}
        </section>
    );
};


