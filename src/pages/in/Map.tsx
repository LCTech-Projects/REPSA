import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import * as d3 from "d3";
import {
  AFRICAN_GEO_DATA,
  createAfricaProjection,
  normalizeCountryName,
} from "../../components/utils/MapGeo";
import { CountryModal } from "../../components/modals/CountryModal";
import { africanCountries } from "../../components/utils/CountryData";
import { getCountryFlag } from "../../components/utils/Flags";
import { ArrowBlackIcon } from "../../components/Icons";
import { FilterDrawer } from "../../components/FilterDrawer";
import { apiSlice } from "../../app/appSlices/apiSlice";
import { useAppDispatch } from "../../app/hooks";

const ENERGY_POVERTY_COLORS = {
  minimal: "#065F46",
  low: "#86EFAC",
  moderate: "#FCD34D",
  high: "#F97316",
  severe: "#DC2626",
  noData: "#E5E5E5",
};

// Function to get color based on energy poverty level
// Gradient: Dark Green (best) -> Light Green -> Yellow -> Orange -> Red/Dark Red (worst)
const getCountryColorByEnergyPoverty = (
  energyPoverty: number | null | undefined,
): string => {
  if (energyPoverty === null || energyPoverty === undefined)
    return ENERGY_POVERTY_COLORS.noData; // Default grey for no data

  // Energy poverty ranges (higher = worse)
  if (energyPoverty >= 50) return ENERGY_POVERTY_COLORS.severe; // Dark Red (worst)
  if (energyPoverty >= 30) return ENERGY_POVERTY_COLORS.high; // Orange
  if (energyPoverty >= 15) return ENERGY_POVERTY_COLORS.moderate; // Yellow
  if (energyPoverty >= 5) return ENERGY_POVERTY_COLORS.low; // Light Green
  return ENERGY_POVERTY_COLORS.minimal; // Dark Green (best)
};

export const Map = () => {
  const navigate = useNavigate();
  const [hoveredCountryName, setHoveredCountryName] = useState<string | null>(
    null,
  );
  const [hoveredCountryFlag, setHoveredCountryFlag] = useState<string>("");
  const [countrySummary, setCountrySummary] = useState<any>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const geoData = AFRICAN_GEO_DATA;
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [energyPovertyMap, setEnergyPovertyMap] = useState<
    Record<string, number | null>
  >({});

  const normalizedEnergyCountryMap = useMemo(() => {
    const m: Record<string, string> = {};
    Object.keys(energyPovertyMap || {}).forEach((name) => {
      m[normalizeCountryName(name)] = name;
    });
    return m;
  }, [energyPovertyMap]);

  const normalizedFallbackMap = useMemo(() => {
    const m: Record<string, string> = {};
    africanCountries.forEach((c) => {
      m[normalizeCountryName(c.name)] = c.name;
    });
    return m;
  }, []);

  const findCountryByName = useCallback(
    (rawName: string): string | null => {
      const normalized = normalizeCountryName(rawName);
      return (
        normalizedEnergyCountryMap[normalized] ||
        normalizedFallbackMap[normalized] ||
        null
      );
    },
    [normalizedEnergyCountryMap, normalizedFallbackMap],
  );

  const handleYearChange = (year: number | null) => {
    setSelectedYear(year);
  };

  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const dispatch = useAppDispatch();
  const legendStops = [
    { label: "<5%", color: ENERGY_POVERTY_COLORS.minimal },
    { label: "5-14%", color: ENERGY_POVERTY_COLORS.low },
    { label: "15-29%", color: ENERGY_POVERTY_COLORS.moderate },
    { label: "30-49%", color: ENERGY_POVERTY_COLORS.high },
    { label: ">=50%", color: ENERGY_POVERTY_COLORS.severe },
  ];
  const legendGradient = legendStops.map((stop) => stop.color).join(", ");
  const legendTicks = [0, 20, 40, 60, 80, 100];

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
      dispatch(
        apiSlice.endpoints.getAllCountriesEnergyPoverty.initiate({
          year: selectedYear,
        }),
      )
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
      dispatch(
        apiSlice.endpoints.getCountrySummary.initiate({
          country: hoveredCountryName,
          year: selectedYear,
        }),
      )
        .then((result: any) => {
          if (result.data?.success) {
            setCountrySummary(result.data.data);
          } else {
            setCountrySummary(null);
          }
          setSummaryLoading(false);
        })
        .catch(() => {
          setCountrySummary(null);
          setSummaryLoading(false);
        });
    }
  }, [selectedYear, hoveredCountryName, dispatch]);

  // Update dimensions on resize and initial load
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth || window.innerWidth;
        const height = containerRef.current.offsetHeight || window.innerHeight;
        setDimensions({
          width,
          height,
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

    window.addEventListener("resize", updateDimensions);

    return () => {
      window.removeEventListener("resize", updateDimensions);
      if (containerRef.current) {
        resizeObserver.unobserve(containerRef.current);
      }
    };
  }, []);

  // Draw map function - extracted so it can be called when energy poverty data changes
  const drawMap = useCallback(() => {
    if (!geoData || !svgRef.current) return;

    // Ensure we have valid dimensions
    const width =
      dimensions.width ||
      containerRef.current?.offsetWidth ||
      window.innerWidth;
    const height =
      dimensions.height ||
      containerRef.current?.offsetHeight ||
      window.innerHeight;

    if (width === 0 || height === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous render

    const { pathGenerator } = createAfricaProjection(geoData, width, height);

    // Create country paths
    const countries = svg.append("g").attr("class", "countries");

    geoData.features.forEach((feature: any) => {
      const countryName =
        feature.properties.NAME || feature.properties.name || "";
      const resolvedCountryName = findCountryByName(countryName);

      // Get energy poverty for this country
      const countryEnergyPoverty = resolvedCountryName
        ? energyPovertyMap[resolvedCountryName]
        : null;
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
          if (resolvedCountryName) {
            setHoveredCountryName(resolvedCountryName);
            setHoveredCountryFlag(getCountryFlag(resolvedCountryName));
            setSummaryLoading(true);
            // Fetch country summary with selected year
            dispatch(
              apiSlice.endpoints.getCountrySummary.initiate({
                country: resolvedCountryName,
                year: selectedYear || undefined,
              }),
            )
              .then((result: any) => {
                if (result.data?.success) {
                  setCountrySummary(result.data.data);
                } else {
                  setCountrySummary(null);
                }
                setSummaryLoading(false);
              })
              .catch(() => {
                setCountrySummary(null);
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
          if (resolvedCountryName) {
            // Navigate to Visualization page with country and year
            navigate("/in/visualization", {
              state: {
                country: resolvedCountryName,
                year: selectedYear,
              },
            });
          }
        });
    });

    // Add zoom behavior
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 4])
      .on("zoom", (event) => {
        countries.attr("transform", event.transform.toString());
      });

    svg.call(zoom as any);
  }, [
    geoData,
    dimensions,
    energyPovertyMap,
    selectedYear,
    dispatch,
    setHoveredCountryName,
    setHoveredCountryFlag,
    setSummaryLoading,
    setCountrySummary,
    navigate,
  ]);

  // Draw map when data and dimensions are ready
  useEffect(() => {
    if (!geoData || !svgRef.current) return;

    // Ensure we have valid dimensions
    const width =
      dimensions.width ||
      containerRef.current?.offsetWidth ||
      window.innerWidth;
    const height =
      dimensions.height ||
      containerRef.current?.offsetHeight ||
      window.innerHeight;

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
          className="bg-white-1 rounded-lg shadow-lg px-4 py-2 flex items-center gap-2 text-[0.875rem] font-inter hover:bg-grey-1 transition-colors"
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
          <CountryModal
            countryName={hoveredCountryName}
            countryFlag={hoveredCountryFlag}
            summary={countrySummary}
            loading={summaryLoading}
          />
        </div>
      )}


      <div
        ref={containerRef}
        className="w-full h-full flex items-center justify-center"
      >
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          style={{ cursor: "grab" }}
        />
      </div>

      {/* Energy poverty color bar legend */}
      <div className="absolute bottom-6 left-6 z-40 max-w-[320px]">
        <div className="bg-black/60 text-white rounded-xl px-4 py-3 backdrop-blur-md shadow-lg">
          <p className="text-[0.75rem] uppercase tracking-[0.15em] mb-2 text-white/80">
            Energy Poverty Level (%)
          </p>
          <div>
            <div
              className="h-3 rounded-full"
              style={{
                background: `linear-gradient(90deg, ${legendGradient})`,
              }}
            />
            <div className="flex justify-between text-[0.65rem] mt-1 text-white/80">
              {legendTicks.map((tick) => (
                <span key={tick}>{tick}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
