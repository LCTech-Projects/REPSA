import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../app/AuthContext";
import type {
  ReturnLocationState,
  HourlyDownloadScope,
} from "../../app/authNavigation";
import { getApiBaseUrl } from "../../app/apiBaseUrl";
import { SignInRequiredModal } from "../../components/modals/SignInRequiredModal";
import {
  useGetAvailableYearsQuery,
  useGetCountryDetailsQuery,
  useGetAvailableCountriesQuery,
  useGetAvailableDatesQuery,
  useGetRealtimeDataQuery,
  useGetHourlyElectricityDemandQuery,
} from "../../app/appSlices/apiSlice";
import { MetricCard } from "../../components/cards/MetricCard";
import { ChartCard } from "../../components/cards/ChartCard";
import { FilterField } from "../../components/inputs/FilterField";
import { AnimatedNumber } from "../../components/AnimatedNumber";
import * as d3 from "d3";
import { calculateYearTicks } from "../../components/utils/ChartUtils";

type ViewMode = "yearly" | "hourly";
type DataMode = "historical" | "realtime";
const TICKING_LIVE_COUNTER_KEYS = [
  "population",
  "electricity_demand",
  "electricity_generation",
] as const;

export const Visualization = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const navigationState = location.state as {
    country?: string;
    year?: number | null;
  } | null;

  const [dataMode, setDataMode] = useState<DataMode>("historical");
  const [viewMode, setViewMode] = useState<ViewMode>("yearly");
  const [selectedYear, setSelectedYear] = useState<number | null>(
    navigationState?.year || null,
  );
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedCountry, setSelectedCountry] = useState<string>(
    navigationState?.country || "Algeria",
  );
  const [showDownloadPopup, setShowDownloadPopup] = useState(false);
  const [showSignInRequired, setShowSignInRequired] = useState(false);
  const [pendingDownloadFormat, setPendingDownloadFormat] = useState<
    "csv" | "json" | null
  >(null);
  const [hourlyDownloadScope, setHourlyDownloadScope] =
    useState<HourlyDownloadScope>("day");
  const [pendingHourlyDownloadScope, setPendingHourlyDownloadScope] =
    useState<HourlyDownloadScope | null>(null);
  const pendingDownloadAfterAuthRef = useRef<{
    format: "csv" | "json";
    hourlyScope?: HourlyDownloadScope;
  } | null>(null);
  const [liveRealtimeCounterValues, setLiveRealtimeCounterValues] = useState<
    Record<string, number>
  >({});

  // Fetch available years
  const { data: yearsData } = useGetAvailableYearsQuery();
  const availableYears = yearsData?.data?.years || [];
  const latestYear = yearsData?.data?.latest_year || null;

  // Fetch available countries for hourly
  const { data: countriesData } = useGetAvailableCountriesQuery();
  const availableCountries = countriesData?.data || [];

  // Fetch available years for hourly data (to get dates later)
  const { data: hourlyYearsData } = useGetAvailableDatesQuery(
    { country: selectedCountry },
    {
      skip:
        !selectedCountry || viewMode !== "hourly" || dataMode !== "historical",
    },
  );
  const hourlyYears = hourlyYearsData?.data?.data || [];

  // Set default year
  useEffect(() => {
    if (latestYear && !selectedYear) {
      setSelectedYear(latestYear);
    }
  }, [latestYear, selectedYear]);

  // Set default date when switching to hourly mode
  useEffect(() => {
    if (viewMode === "hourly" && dataMode === "historical" && !selectedDate) {
      if (hourlyYears.length > 0) {
        // Use the latest available year from hourly data
        const latestYear = hourlyYears[hourlyYears.length - 1];
        setSelectedDate(`${latestYear}-01-01`);
      } else if (availableYears.length > 0) {
        // Fallback to available years if hourly years not loaded yet
        const latestYear = availableYears[availableYears.length - 1];
        setSelectedDate(`${latestYear}-01-01`);
      }
    }
  }, [viewMode, selectedDate, hourlyYears, availableYears, dataMode]);

  // Calculate start_year for time series (show last 9 years or from 2016)
  const getStartYear = (): number => {
    if (selectedYear) {
      return Math.max(2016, selectedYear - 8); // Show 9 years including selected
    }
    return 2016;
  };

  // Fetch yearly data (only for historical mode) - using same logic as drawer
  const { data: yearlyData, isLoading: yearlyLoading } =
    useGetCountryDetailsQuery(
      {
        country: selectedCountry,
        start_year: getStartYear(),
        end_year: selectedYear || 2023,
        selected_year: selectedYear || undefined,
      },
      {
        skip:
          !selectedCountry ||
          !selectedYear ||
          viewMode !== "yearly" ||
          dataMode !== "historical",
      },
    );

  // Fetch country details for hourly mode (using drawer charts which are yearly)
  const shouldFetchCountryDetails =
    dataMode === "historical" && viewMode === "hourly" && selectedCountry;

  const {
    data: countryDetailsData,
    isLoading: countryDetailsLoading,
    error: countryDetailsError,
  } = useGetCountryDetailsQuery(
    {
      country: selectedCountry,
      start_year: getStartYear(),
      end_year: selectedYear || 2023,
      selected_year: selectedYear || undefined,
    },
    {
      skip: !shouldFetchCountryDetails,
      refetchOnMountOrArgChange: true,
    },
  );

  const countryDetails = countryDetailsData?.data?.data || null;

  // Fetch hourly data (only for historical mode)
  // API accepts date parameter (required for hourly)
  const shouldFetchHourly =
    dataMode === "historical" &&
    viewMode === "hourly" &&
    selectedCountry &&
    selectedDate;

  const { data: hourlyData } = useGetHourlyElectricityDemandQuery(
    {
      country: selectedCountry,
      date: selectedDate || undefined,
    },
    {
      skip: !shouldFetchHourly,
      // Refetch when parameters change
      refetchOnMountOrArgChange: true,
    },
  );

  // Fetch realtime data
  const { data: realtimeData, isLoading: realtimeLoading } =
    useGetRealtimeDataQuery(
      { country: selectedCountry },
      { skip: dataMode !== "realtime" || !selectedCountry },
    );

  // Keep selected realtime counters ticking using metric-specific growth and timestamp anchor.
  useEffect(() => {
    if (dataMode !== "realtime") {
      setLiveRealtimeCounterValues({});
      return;
    }

    const realtimePayload = realtimeData?.data?.data || realtimeData?.data;
    if (!realtimePayload) {
      setLiveRealtimeCounterValues({});
      return;
    }

    const serverTimestampMs = Date.parse(realtimePayload?.timestamp || "");
    const secondsPerYear = 365.25 * 24 * 60 * 60;
    const timeoutIds: number[] = [];

    TICKING_LIVE_COUNTER_KEYS.forEach((metricKey) => {
      const baseValue =
        typeof realtimePayload?.live_counters?.[metricKey]?.value === "number"
          ? realtimePayload.live_counters[metricKey].value
          : null;

      if (baseValue === null) {
        return;
      }

      const growthRate =
        typeof realtimePayload?.projections?.[metricKey]?.growth_rate ===
        "number"
          ? realtimePayload.projections[metricKey].growth_rate
          : 0;

      const growthPerSecond = Number(growthRate) / secondsPerYear;
      const storageKey = `realtime-${metricKey}-${selectedCountry.toLowerCase()}`;

      const computeValueAt = (atMs: number) => {
        const elapsedSinceServerSeconds = Number.isFinite(serverTimestampMs)
          ? Math.max(0, (atMs - serverTimestampMs) / 1000)
          : 0;
        const exactValue =
          Number(baseValue) *
          Math.exp(
            Number(growthRate) * (elapsedSinceServerSeconds / secondsPerYear),
          );
        return {
          exact: Math.max(0, exactValue),
          integer: Math.max(0, Math.floor(exactValue)),
        };
      };

      const readPersisted = () => {
        try {
          const raw = window.sessionStorage.getItem(storageKey);
          if (!raw) return null;
          const parsed = JSON.parse(raw) as { value?: number };
          return typeof parsed?.value === "number" ? parsed.value : null;
        } catch {
          return null;
        }
      };

      const writePersisted = (value: number) => {
        try {
          window.sessionStorage.setItem(
            storageKey,
            JSON.stringify({ value, savedAt: Date.now() }),
          );
        } catch {
          // Ignore storage errors.
        }
      };

      const nowValue = computeValueAt(Date.now()).integer;
      const persistedValue = readPersisted();
      const initialValue =
        typeof persistedValue === "number"
          ? Math.max(persistedValue, nowValue)
          : nowValue;

      setLiveRealtimeCounterValues((prev) => ({
        ...prev,
        [metricKey]: initialValue,
      }));
      writePersisted(initialValue);

      const scheduleNextUpdate = () => {
        const nowMs = Date.now();
        const { exact, integer } = computeValueAt(nowMs);
        const monotonicValue = Math.max(integer, readPersisted() ?? integer);

        setLiveRealtimeCounterValues((prev) => ({
          ...prev,
          [metricKey]: monotonicValue,
        }));
        writePersisted(monotonicValue);

        if (growthPerSecond <= 0) {
          const timeoutId = window.setTimeout(scheduleNextUpdate, 60_000);
          timeoutIds.push(timeoutId);
          return;
        }

        const nextInteger = Math.max(monotonicValue + 1, integer + 1);
        const ratio = nextInteger / Math.max(exact, 1e-9);
        const secondsUntilNext = Math.max(
          0.05,
          Math.log(ratio) / growthPerSecond,
        );
        const msUntilNext = Math.min(
          2_147_000_000,
          Math.ceil(secondsUntilNext * 1000),
        );
        const timeoutId = window.setTimeout(scheduleNextUpdate, msUntilNext);
        timeoutIds.push(timeoutId);
      };

      scheduleNextUpdate();
    });

    return () => {
      timeoutIds.forEach((id) => window.clearTimeout(id));
    };
  }, [dataMode, realtimeData]);

  const isLoading =
    dataMode === "historical"
      ? viewMode === "yearly"
        ? yearlyLoading
        : countryDetailsLoading
      : realtimeLoading;

  // Calculate key metrics for yearly view
  const calculateYearlyMetrics = () => {
    if (
      !yearlyData?.data?.time_series ||
      yearlyData.data.time_series.length === 0
    ) {
      return {
        totalGeneration: 0,
        totalDemand: 0,
        totalConsumption: 0,
        renewableShare: 0,
        energyPoverty: 0,
      };
    }

    const selectedYearData =
      yearlyData.data.time_series.find((d: any) => d.year === selectedYear) ||
      yearlyData.data.time_series[yearlyData.data.time_series.length - 1];

    const totalGeneration = selectedYearData?.electricity_generation || 0;
    const totalDemand = selectedYearData?.electricity_demand || 0;
    const renewableShare = selectedYearData?.renewable_share || 0;
    const energyPoverty = selectedYearData?.energy_poverty || 0;

    return {
      totalGeneration,
      totalDemand,
      totalConsumption: totalDemand,
      renewableShare,
      energyPoverty,
    };
  };

  // Calculate key metrics for hourly view (now using country details)
  const calculateHourlyMetrics = () => {
    // API returns country details with time_series
    const timeSeries = countryDetails?.time_series || [];

    if (!Array.isArray(timeSeries) || timeSeries.length === 0) {
      return {
        totalGeneration: 0,
        totalDemand: 0,
        totalConsumption: 0,
        renewableShare: 0,
        energyPoverty: 0,
      };
    }

    // Get the latest year's data or selected year's data
    const latestData = selectedYear
      ? timeSeries.find((d: any) => d.year === selectedYear)
      : timeSeries[timeSeries.length - 1];

    if (!latestData) {
      return {
        totalGeneration: 0,
        totalDemand: 0,
        totalConsumption: 0,
        renewableShare: 0,
        energyPoverty: 0,
      };
    }

    return {
      totalGeneration: (latestData.electricity_generation || 0) * 1000, // Convert TWh to GWh
      totalDemand: (latestData.electricity_demand || 0) * 1000, // Convert TWh to GWh
      totalConsumption: (latestData.electricity_demand || 0) * 1000, // Convert TWh to GWh
      renewableShare: latestData.renewable_share || 0,
      energyPoverty: latestData.energy_poverty || 0,
    };
  };

  const metrics =
    viewMode === "yearly" ? calculateYearlyMetrics() : calculateHourlyMetrics();

  const formatTimestamp24 = (value?: string | null): string => {
    if (!value) return "N/A";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "N/A";
    return d.toLocaleString([], {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  };

  const getCurrentDownloadData = () => {
    if (dataMode === "realtime") {
      return realtimeData?.data?.data || realtimeData?.data || null;
    }

    if (viewMode === "yearly") {
      return yearlyData?.data?.time_series || yearlyData?.data || null;
    }

    return hourlyData?.data || hourlyData || null;
  };

  const hasDownloadData =
    dataMode === "historical" && viewMode === "hourly"
      ? !!(selectedCountry && selectedDate)
      : !!getCurrentDownloadData();

  const escapeCsvCell = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    const raw =
      typeof value === "object" ? JSON.stringify(value) : String(value);
    const escaped = raw.replace(/"/g, '""');
    return `"${escaped}"`;
  };

  const toCsvRows = (data: unknown): Record<string, unknown>[] => {
    if (Array.isArray(data)) {
      if (data.length === 0) return [];
      if (typeof data[0] === "object" && data[0] !== null) {
        return data as Record<string, unknown>[];
      }
      return data.map((item) => ({ value: item }));
    }

    if (typeof data === "object" && data !== null) {
      const obj = data as Record<string, unknown>;
      if (Array.isArray(obj.data)) {
        return toCsvRows(obj.data);
      }
      return [obj];
    }

    return [{ value: data }];
  };

  const getUnitLabel = (
    key: string,
    mode: "historical" | "realtime",
    historicalView: "yearly" | "hourly",
  ): string | null => {
    const normalized = key.trim();
    const common: Record<string, string> = {
      electricity_demand: "TWh",
      electricity_generation: "TWh",
      renewable_share: "%",
      energy_poverty: "%",
      population: "people",
      electricity_access: "%",
      electricity_demand_per_capita: "MWh/person",
      electricity_demand_per_capita_with_access: "MWh/person",
      electricity_demand_per_capita_current: "MWh/person",
      clean_cooking_access: "%",
      carbon_intensity: "gCO₂/kWh",
      co2_emissions: "MtCO₂e",
      greenhouse_gas_emissions: "MtCO₂e",
      fossil_share: "%",
      energy_poverty_multidimensional: "%",
      energy_poverty_rural: "%",
      energy_poverty_urban: "%",
      datetime: "timestamp",
      year: "year",
    };

    if (mode === "historical" && historicalView === "hourly") {
      const hourly: Record<string, string> = {
        "electricity_demand (MWh)": "MWh",
        electricity_demand_MWh: "MWh",
        electricity_demand_per_capita_kWh: "kWh/person",
        electricity_demand_per_capita_with_access_kWh: "kWh/person",
        electricity_demand_per_capita_MWh: "kWh/person",
        electricity_demand_per_capita_with_access_MWh: "kWh/person",
        "electricity_demand_per_capita (kWh/person)": "kWh/person",
        "electricity_demand_per_capita_with_access (kWh/person)": "kWh/person",
        "electricity_demand_per_capita (MWh/person)": "kWh/person",
        "electricity_demand_per_capita_with_access (MWh/person)": "kWh/person",
      };
      return hourly[normalized] || common[normalized] || null;
    }

    if (mode === "historical" && historicalView === "yearly") {
      const yearly: Record<string, string> = {
        electricity_demand: "TWh",
        electricity_generation: "TWh",
        electricity_demand_per_capita: "MWh/person",
        electricity_demand_per_capita_with_access: "MWh/person",
        renewable_share: "%",
        clean_cooking_access: "%",
        energy_poverty: "%",
      };
      return yearly[normalized] || common[normalized] || null;
    }

    return common[normalized] || null;
  };

  const getHourlyDownloadColumnName = (key: string, unit: string | null) => {
    if (key === "electricity_demand_MWh") return "electricity_demand (MWh)";
    if (key === "electricity_demand_per_capita_kWh") {
      return "electricity_demand_per_capita (kWh/person)";
    }
    if (key === "electricity_demand_per_capita_with_access_kWh") {
      return "electricity_demand_per_capita_with_access (kWh/person)";
    }
    return unit ? `${key} (${unit})` : key;
  };

  const withUnitHeaders = (
    rows: Record<string, unknown>[],
    mode: "historical" | "realtime",
    historicalView: "yearly" | "hourly",
  ): Record<string, unknown>[] => {
    return rows.map((row) => {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row)) {
        const unit = getUnitLabel(k, mode, historicalView);
        const header =
          mode === "historical" && historicalView === "hourly"
            ? getHourlyDownloadColumnName(k, unit)
            : unit
              ? `${k} (${unit})`
              : k;
        out[header] = v;
      }
      return out;
    });
  };

  const filterDownloadRows = (
    rows: Record<string, unknown>[],
    mode: "historical" | "realtime",
    historicalView: "yearly" | "hourly",
  ): Record<string, unknown>[] => {
    if (mode !== "historical" || historicalView !== "yearly") {
      return rows;
    }

    // Keep yearly exports focused on relevant, user-facing fields only.
    const yearlyAllowlist = new Set<string>([
      "country",
      "year",
      "electricity_demand",
      "electricity_generation",
      "electricity_demand_per_capita",
      "electricity_demand_per_capita_with_access",
      "renewable_share",
      "clean_cooking_access",
      "energy_poverty",
      "energy_poverty_multidimensional",
      "energy_poverty_rural",
      "energy_poverty_urban",
      "carbon_intensity",
      "fossil_share",
      "population",
      "electricity_access",
      "co2_emissions",
      "greenhouse_gas_emissions",
    ]);

    return rows.map((row) => {
      const filtered: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row)) {
        if (yearlyAllowlist.has(k)) filtered[k] = v;
      }
      return filtered;
    });
  };

  const buildColumnUnits = (
    rows: Record<string, unknown>[],
    mode: "historical" | "realtime",
    historicalView: "yearly" | "hourly",
  ): Record<string, string> => {
    const units: Record<string, string> = {};
    for (const row of rows) {
      for (const key of Object.keys(row)) {
        const unit = getUnitLabel(key, mode, historicalView);
        if (unit) {
          units[key] = unit;
        }
      }
    }
    return units;
  };

  const buildCsv = (rows: Record<string, unknown>[]): string => {
    if (!rows.length) return "";
    const headers = Array.from(
      new Set(rows.flatMap((row) => Object.keys(row))),
    );
    const headerLine = headers.map((h) => escapeCsvCell(h)).join(",");
    const lines = rows.map((row) =>
      headers.map((h) => escapeCsvCell(row[h])).join(","),
    );
    return [headerLine, ...lines].join("\n");
  };

  const triggerFileDownload = (
    content: BlobPart,
    filename: string,
    mimeType: string,
  ) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const parseContentDispositionFilename = (
    disposition: string | null,
    fallback: string,
  ) => {
    if (!disposition) return fallback;
    const match = disposition.match(/filename="?([^";]+)"?/i);
    return match?.[1] ?? fallback;
  };

  const formatHourlyMonthLabel = (date: string) => {
    const [year, month] = date.slice(0, 7).split("-");
    const monthName = new Date(Number(year), Number(month) - 1, 1).toLocaleString(
      "en-US",
      { month: "long" },
    );
    return `${monthName} ${year}`;
  };

  const buildHourlyDownloadParams = (scope: HourlyDownloadScope) => {
    const params = new URLSearchParams({
      country: selectedCountry,
    });
    let scopeLabel = "";

    if (scope === "day") {
      params.set("date", selectedDate);
      scopeLabel = selectedDate;
    } else if (scope === "month") {
      const month = selectedDate.slice(0, 7);
      params.set("month", month);
      scopeLabel = month;
    } else {
      const year = selectedDate.slice(0, 4);
      params.set("year", year);
      scopeLabel = year;
    }

    return { params, scopeLabel };
  };

  const downloadHourlyData = async (
    format: "json" | "csv",
    scope: HourlyDownloadScope,
  ) => {
    if (!selectedCountry || !selectedDate) return;

    const { params, scopeLabel } = buildHourlyDownloadParams(scope);
    params.set("format", format);

    const response = await fetch(
      `${getApiBaseUrl()}/api/historical/hourly-electricity-demand?${params.toString()}`,
    );

    if (!response.ok) {
      console.error("Hourly download failed:", await response.text());
      return;
    }

    const countrySlug = selectedCountry.replace(/\s+/g, "_");
    const fallbackFilename = `hourly_demand_${countrySlug}_${scopeLabel.replace(/-/g, "_")}.${format}`;

    if (format === "csv") {
      const blob = await response.blob();
      triggerFileDownload(
        blob,
        parseContentDispositionFilename(
          response.headers.get("Content-Disposition"),
          fallbackFilename,
        ),
        "text/csv;charset=utf-8;",
      );
      return;
    }

    const json = await response.json();
    const currentData = json.data;
    if (!currentData) return;

    const rawRows = toCsvRows(currentData);
    const csvRows = filterDownloadRows(rawRows, "historical", "hourly");
    const columnUnits = buildColumnUnits(csvRows, "historical", "hourly");

    const payload = {
      exported_at: new Date().toISOString(),
      data_mode: "historical" as const,
      view_mode: "hourly" as const,
      download_scope: scope,
      country: selectedCountry,
      selected_date: selectedDate,
      column_units: columnUnits,
      data: csvRows,
      metadata: json.metadata ?? null,
    };

    triggerFileDownload(
      JSON.stringify(payload, null, 2),
      fallbackFilename,
      "application/json",
    );
  };

  const handleDownloadClick = () => {
    if (!hasDownloadData) return;
    if (dataMode === "historical" && viewMode === "hourly") {
      setHourlyDownloadScope("day");
    }
    setShowDownloadPopup(true);
  };

  const handleFormatSelect = (format: "json" | "csv") => {
    if (!isAuthenticated) {
      setPendingDownloadFormat(format);
      setPendingHourlyDownloadScope(
        dataMode === "historical" && viewMode === "hourly"
          ? hourlyDownloadScope
          : null,
      );
      setShowDownloadPopup(false);
      setShowSignInRequired(true);
      return;
    }
    void handleDownloadData(format);
  };

  const handleDownloadData = async (
    format: "json" | "csv",
    scopeOverride?: HourlyDownloadScope,
  ) => {
    if (dataMode === "historical" && viewMode === "hourly") {
      await downloadHourlyData(format, scopeOverride ?? hourlyDownloadScope);
      setShowDownloadPopup(false);
      return;
    }

    const currentData = getCurrentDownloadData();
    if (!currentData) return;
    const rawRows = toCsvRows(currentData);
    const modeForUnits = dataMode;
    const viewForUnits =
      dataMode === "historical" ? viewMode : ("yearly" as const);
    const csvRows = filterDownloadRows(rawRows, modeForUnits, viewForUnits);
    const csvRowsWithUnits = withUnitHeaders(
      csvRows,
      modeForUnits,
      viewForUnits,
    );
    const columnUnits = buildColumnUnits(csvRows, modeForUnits, viewForUnits);

    const payload = {
      exported_at: new Date().toISOString(),
      data_mode: dataMode,
      view_mode: dataMode === "historical" ? viewMode : "realtime",
      country: selectedCountry,
      selected_year: selectedYear,
      selected_date: selectedDate || null,
      column_units: columnUnits,
      data: csvRows,
    };

    const modeLabel = dataMode === "realtime" ? "realtime" : viewMode;
    const timestamp = new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[T:]/g, "-");
    const fileBase = `${selectedCountry.replace(/\s+/g, "_")}_${modeLabel}_${timestamp}`;

    const content =
      format === "json"
        ? JSON.stringify(payload, null, 2)
        : buildCsv(csvRowsWithUnits);
    const mimeType =
      format === "json" ? "application/json" : "text/csv;charset=utf-8;";
    const extension = format === "json" ? "json" : "csv";
    triggerFileDownload(content, `${fileBase}.${extension}`, mimeType);
    setShowDownloadPopup(false);
  };

  useEffect(() => {
    const state = location.state as ReturnLocationState | null;
    if (!state?.downloadFormat) return;

    navigate(`${location.pathname}${location.search}`, { replace: true, state: {} });
    pendingDownloadAfterAuthRef.current = {
      format: state.downloadFormat,
      hourlyScope: state.hourlyDownloadScope,
    };
    if (state.hourlyDownloadScope) {
      setHourlyDownloadScope(state.hourlyDownloadScope);
    }
    setShowDownloadPopup(false);
  }, [location.pathname, location.search, location.state, navigate]);

  useEffect(() => {
    const pending = pendingDownloadAfterAuthRef.current;
    if (!pending || !isAuthenticated || !hasDownloadData) {
      return;
    }
    pendingDownloadAfterAuthRef.current = null;
    void handleDownloadData(pending.format, pending.hourlyScope);
  }, [isAuthenticated, hasDownloadData]);

  return (
    <div className="p-6 bg-white-1 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[2rem] font-inter font-semibold text-black-1 mb-4">
          Visualization
        </h1>

        {/* Filters Section */}
        <div className="bg-grey-1 rounded-lg p-4 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Data Mode Toggle (Historical/Realtime) */}
            <FilterField
              label="Data Mode"
              placeholder="Select Mode"
              options={["Historical", "Realtime"]}
              selectedValue={
                dataMode === "historical" ? "Historical" : "Realtime"
              }
              onValueChange={(value) => {
                if (value === "Historical") {
                  setDataMode("historical");
                  setViewMode("yearly");
                } else if (value === "Realtime") {
                  setDataMode("realtime");
                }
              }}
            />

            {/* View Mode Toggle (Yearly/Hourly) - Only for Historical */}
            {dataMode === "historical" && (
              <FilterField
                label="View"
                placeholder="Select View"
                options={["Yearly", "Hourly"]}
                selectedValue={viewMode === "yearly" ? "Yearly" : "Hourly"}
                onValueChange={(value) => {
                  setViewMode(value === "Yearly" ? "yearly" : "hourly");
                }}
              />
            )}

            {/* Country Selector */}
            <FilterField
              label="Country"
              placeholder="Select Country"
              options={availableCountries}
              selectedValue={selectedCountry}
              onValueChange={(value) => {
                if (value) setSelectedCountry(value);
              }}
            />

            {/* Year Filter (Yearly mode - Historical) */}
            {dataMode === "historical" && viewMode === "yearly" && (
              <FilterField
                label="Year"
                placeholder="Select Year"
                options={availableYears
                  .map((y: number) => y.toString())
                  .reverse()}
                selectedValue={selectedYear ? selectedYear.toString() : null}
                onValueChange={(value) => {
                  setSelectedYear(value ? Number(value) : null);
                }}
              />
            )}

            {/* Date Filter for hourly mode - Allow any date from available years */}
            {dataMode === "historical" && viewMode === "hourly" && (
              <div className="w-full">
                <label className="text-[0.875rem] font-inter text-grey-2 mb-2 block">
                  Date
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  min={
                    hourlyYears.length > 0
                      ? `${Math.min(...hourlyYears)}-01-01`
                      : availableYears.length > 0
                        ? `${Math.min(...availableYears)}-01-01`
                        : undefined
                  }
                  max={
                    hourlyYears.length > 0
                      ? `${Math.max(...hourlyYears)}-12-31`
                      : availableYears.length > 0
                        ? `${Math.max(...availableYears)}-12-31`
                        : undefined
                  }
                  className="w-full bg-white-1 border border-grey-1 rounded-lg px-4 py-3 text-[0.875rem] font-inter text-black-1 hover:border-grey-2 transition-colors"
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={handleDownloadClick}
              disabled={!hasDownloadData}
              className="px-4 py-2 rounded-lg border cursor-pointer border-grey-2 text-[0.875rem] font-inter text-black-1 bg-white-1 hover:bg-grey-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Download Data
            </button>
          </div>
        </div>
      </div>

      <SignInRequiredModal
        isOpen={showSignInRequired}
        onClose={() => {
          setShowSignInRequired(false);
          setPendingDownloadFormat(null);
          setPendingHourlyDownloadScope(null);
        }}
        returnPath={`${location.pathname}${location.search}`}
        pendingDownloadFormat={pendingDownloadFormat}
        pendingHourlyDownloadScope={pendingHourlyDownloadScope}
      />

      {showDownloadPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white-1 rounded-lg border border-grey-1 p-5 w-[90%] max-w-sm">
            <h3 className="text-[1rem] font-inter font-semibold text-black-1 mb-4">
              {dataMode === "historical" && viewMode === "hourly"
                ? "Download hourly data"
                : "Download format"}
            </h3>
            {dataMode === "historical" && viewMode === "hourly" && selectedDate && (
              <div className="mb-4">
                <p className="text-[0.875rem] font-inter text-grey-2 mb-2">
                  Range
                </p>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setHourlyDownloadScope("day")}
                    className={`w-full px-4 py-2 cursor-pointer rounded-lg border text-[0.875rem] font-inter text-black-1 transition-colors ${
                      hourlyDownloadScope === "day"
                        ? "border-blue-1 bg-blue-1/5"
                        : "border-grey-2 bg-white-1 hover:bg-grey-1"
                    }`}
                  >
                    Selected day ({selectedDate})
                  </button>
                  <button
                    type="button"
                    onClick={() => setHourlyDownloadScope("month")}
                    className={`w-full px-4 py-2 cursor-pointer rounded-lg border text-[0.875rem] font-inter text-black-1 transition-colors ${
                      hourlyDownloadScope === "month"
                        ? "border-blue-1 bg-blue-1/5"
                        : "border-grey-2 bg-white-1 hover:bg-grey-1"
                    }`}
                  >
                    Selected month ({formatHourlyMonthLabel(selectedDate)})
                  </button>
                  <button
                    type="button"
                    onClick={() => setHourlyDownloadScope("year")}
                    className={`w-full px-4 py-2 cursor-pointer rounded-lg border text-[0.875rem] font-inter text-black-1 transition-colors ${
                      hourlyDownloadScope === "year"
                        ? "border-blue-1 bg-blue-1/5"
                        : "border-grey-2 bg-white-1 hover:bg-grey-1"
                    }`}
                  >
                    Selected year ({selectedDate.slice(0, 4)})
                  </button>
                </div>
              </div>
            )}
            <p className="text-[0.875rem] font-inter text-grey-2 mb-2">Format</p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => handleFormatSelect("csv")}
                className="w-full px-4 py-2 cursor-pointer rounded-lg border border-grey-2 text-[0.875rem] font-inter text-black-1 bg-white-1 hover:bg-grey-1 transition-colors"
              >
                Download CSV
              </button>
              <button
                type="button"
                onClick={() => handleFormatSelect("json")}
                className="w-full px-4 py-2 cursor-pointer rounded-lg border border-grey-2 text-[0.875rem] font-inter text-black-1 bg-white-1 hover:bg-grey-1 transition-colors"
              >
                Download JSON
              </button>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setShowDownloadPopup(false)}
                className="px-3 py-2 cursor-pointer rounded-lg text-[0.875rem] font-inter text-grey-2 hover:text-black-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {dataMode === "realtime" ? (
        <div className="flex items-center justify-center">
          <div className="text-center w-full max-w-2xl">
            <h2 className="text-[1.5rem] font-inter font-semibold text-black-1 mb-4">
              Realtime Energy Data
            </h2>
            {realtimeLoading ? (
              <p className="text-grey-2 text-[1rem] font-inter">
                Loading realtime data...
              </p>
            ) : realtimeData?.data?.data || realtimeData?.data ? (
              (() => {
                const data = realtimeData.data.data || realtimeData.data;
                const estimateUnitMap: Record<string, string> = {
                  electricity_access: "%",
                  renewable_share: "%",
                  energy_poverty: "%",
                  electricity_demand: "TWh",
                  electricity_generation: "TWh",
                  electricity_demand_per_capita: "MWh/person",
                  electricity_demand_per_capita_current: "MWh/person",
                  population: "people",
                };

                const livePopulationPeople =
                  typeof liveRealtimeCounterValues.population === "number"
                    ? liveRealtimeCounterValues.population
                    : typeof data?.live_counters?.population?.value === "number"
                      ? data.live_counters.population.value
                      : typeof data?.estimates?.population === "number"
                        ? data.estimates.population
                        : null;

                const liveDemandMWh =
                  typeof liveRealtimeCounterValues.electricity_demand ===
                  "number"
                    ? liveRealtimeCounterValues.electricity_demand
                    : typeof data?.live_counters?.electricity_demand?.value ===
                        "number"
                      ? data.live_counters.electricity_demand.value
                      : typeof data?.estimates?.electricity_demand === "number"
                        ? data.estimates.electricity_demand * 1e6
                        : null;

                const liveGenerationMWh =
                  typeof liveRealtimeCounterValues.electricity_generation ===
                  "number"
                    ? liveRealtimeCounterValues.electricity_generation
                    : typeof data?.live_counters?.electricity_generation
                          ?.value === "number"
                      ? data.live_counters.electricity_generation.value
                      : typeof data?.estimates?.electricity_generation ===
                          "number"
                        ? data.estimates.electricity_generation * 1e6
                        : null;

                const liveDemandPerCapitaKWh =
                  typeof livePopulationPeople === "number" &&
                  livePopulationPeople > 0 &&
                  typeof liveDemandMWh === "number"
                    ? (liveDemandMWh * 1000) / livePopulationPeople
                    : null;

                // Check if it's the new aggregation format
                if (data.live_counters || data.estimates) {
                  return (
                    <div className="bg-white-1 border border-grey-1 rounded-lg p-6 text-left">
                      <div className="mb-4">
                        <h3 className="text-[1rem] font-inter font-semibold text-black-1 mb-2">
                          {data.country || selectedCountry} - Live Estimates
                        </h3>
                        <p className="text-[0.875rem] font-inter text-grey-2">
                          Last updated:{" "}
                          {formatTimestamp24(data.timestamp)}
                        </p>
                        {data.latest_data_year && (
                          <p className="text-[0.75rem] font-inter text-grey-2 mt-1">
                            Latest data year: {data.latest_data_year} (
                            {data.data_age_years || 0} years ago)
                          </p>
                        )}
                      </div>

                      {/* Live Counters */}
                      {data.live_counters &&
                        Object.keys(data.live_counters).length > 0 && (
                          <div className="mb-6">
                            <h4 className="text-[0.875rem] font-inter font-semibold text-black-1 mb-3">
                              Live Counters
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {Object.entries(data.live_counters).map(
                                ([key, counter]: [string, any]) => (
                                  <div
                                    key={key}
                                    className="bg-grey-1 rounded p-4"
                                  >
                                    <div className="text-[0.75rem] font-inter text-grey-2 mb-1 capitalize">
                                      {key.replace(/_/g, " ")}
                                    </div>
                                    <div className="text-[1.5rem] font-inter font-bold text-black-1">
                                      {typeof (typeof liveRealtimeCounterValues[
                                        key
                                      ] === "number"
                                        ? liveRealtimeCounterValues[key]
                                        : counter.value) === "number" ? (
                                        <AnimatedNumber
                                          value={
                                            typeof liveRealtimeCounterValues[
                                              key
                                            ] === "number"
                                              ? liveRealtimeCounterValues[key]
                                              : counter.value
                                          }
                                          decimals={0}
                                          unit={counter.unit}
                                          duration={2500}
                                          animateOnce={TICKING_LIVE_COUNTER_KEYS.includes(
                                            key as (typeof TICKING_LIVE_COUNTER_KEYS)[number],
                                          )}
                                        />
                                      ) : (
                                        <>
                                          {counter.value}
                                          <span className="text-[0.875rem] font-normal text-grey-2 ml-2">
                                            {counter.unit}
                                          </span>
                                        </>
                                      )}
                                    </div>
                                    {counter.description && (
                                      <div className="text-[0.625rem] font-inter text-grey-2 mt-1">
                                        {counter.description}
                                      </div>
                                    )}
                                  </div>
                                ),
                              )}
                            </div>
                          </div>
                        )}

                      {/* Current Estimates */}
                      {data.estimates &&
                        Object.keys(data.estimates).length > 0 && (
                          <div className="mb-6">
                            <h4 className="text-[0.875rem] font-inter font-semibold text-black-1 mb-3">
                              Current Estimates (
                              {data.current_year || new Date().getFullYear()})
                            </h4>
                            <div className="space-y-2">
                              {Object.entries(data.estimates).map(
                                ([key, value]: [string, any]) => {
                                  if (
                                    key ===
                                    "electricity_demand_per_capita_current"
                                  ) {
                                    return null;
                                  }

                                  const isPerCapitaMetric =
                                    key === "electricity_demand_per_capita" ||
                                    key ===
                                      "electricity_demand_per_capita_current";
                                  const displayValue =
                                    key === "population" &&
                                    typeof livePopulationPeople === "number"
                                      ? livePopulationPeople
                                      : key === "electricity_demand" &&
                                          typeof liveDemandMWh === "number"
                                        ? liveDemandMWh / 1e6
                                        : key === "electricity_generation" &&
                                            typeof liveGenerationMWh ===
                                              "number"
                                          ? liveGenerationMWh / 1e6
                                          : (key ===
                                                "electricity_demand_per_capita" ||
                                                key ===
                                                  "electricity_demand_per_capita_current") &&
                                              typeof liveDemandPerCapitaKWh ===
                                                "number"
                                            ? liveDemandPerCapitaKWh
                                            : value;

                                  return (
                                    displayValue !== null &&
                                    displayValue !== undefined && (
                                      <div
                                        key={key}
                                        className="flex justify-between items-center py-2 border-b border-grey-1"
                                      >
                                        <span className="text-[0.875rem] font-inter text-black-1 capitalize">
                                          {key.replace(/_/g, " ")}
                                        </span>
                                        <span className="text-[0.875rem] font-inter font-semibold text-black-1">
                                          {typeof displayValue === "number" ? (
                                            <>
                                              {isPerCapitaMetric ? (
                                                Math.round(
                                                  displayValue,
                                                ).toLocaleString()
                                              ) : (
                                                <AnimatedNumber
                                                  value={displayValue}
                                                  decimals={0}
                                                  duration={2000}
                                                  animateOnce={TICKING_LIVE_COUNTER_KEYS.includes(
                                                    key as (typeof TICKING_LIVE_COUNTER_KEYS)[number],
                                                  )}
                                                />
                                              )}
                                              {estimateUnitMap[key]
                                                ? ` ${estimateUnitMap[key]}`
                                                : ""}
                                            </>
                                          ) : (
                                            displayValue
                                          )}
                                        </span>
                                      </div>
                                    )
                                  );
                                },
                              )}
                            </div>
                          </div>
                        )}

                      {/* Methodology */}
                      {data.methodology && (
                        <div className="mt-6 pt-4 border-t border-grey-1">
                          <h4 className="text-[0.875rem] font-inter font-semibold text-black-1 mb-2">
                            Methodology
                          </h4>
                          <p className="text-[0.75rem] font-inter text-grey-2 mb-2">
                            {data.methodology.description}
                          </p>
                          <div className="text-[0.75rem] font-inter text-grey-2">
                            <p className="font-semibold mb-1">Data Sources:</p>
                            <ul className="list-disc list-inside ml-2 space-y-1">
                              {data.methodology.data_sources?.map(
                                (source: string, idx: number) => (
                                  <li key={idx}>{source}</li>
                                ),
                              )}
                            </ul>
                          </div>
                          {data.methodology.note && (
                            <p className="text-[0.625rem] font-inter text-grey-2 italic mt-2">
                              {data.methodology.note}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                }

                // Fallback to old format for backward compatibility
                return (
                  <div className="bg-white-1 border border-grey-1 rounded-lg p-6 text-left">
                    <div className="mb-4">
                      <h3 className="text-[1rem] font-inter font-semibold text-black-1 mb-2">
                        {data.country || selectedCountry} - Realtime Data
                      </h3>
                      <p className="text-[0.875rem] font-inter text-grey-2">
                        Last updated:{" "}
                        {formatTimestamp24(data.timestamp)}
                      </p>
                    </div>
                    <div className="space-y-4">
                      {data.sources && Object.keys(data.sources).length > 0 ? (
                        Object.entries(data.sources).map(
                          ([source, sourceData]: [string, any]) => (
                            <div
                              key={source}
                              className="border-t border-grey-1 pt-4"
                            >
                              <h4 className="text-[0.875rem] font-inter font-semibold text-black-1 mb-2 capitalize">
                                {source.replace("_", " ")}
                              </h4>
                              {sourceData?.error ? (
                                <p className="text-[0.75rem] font-inter text-red-500">
                                  Error: {sourceData.error}
                                </p>
                              ) : (
                                <div className="space-y-2">
                                  {sourceData?.data && (
                                    <pre className="text-[0.75rem] font-inter text-grey-2 bg-grey-1 p-3 rounded overflow-auto">
                                      {JSON.stringify(sourceData.data, null, 2)}
                                    </pre>
                                  )}
                                  {sourceData?.note && (
                                    <p className="text-[0.75rem] font-inter text-grey-2 italic">
                                      {sourceData.note}
                                    </p>
                                  )}
                                  {!sourceData?.data && !sourceData?.note && (
                                    <pre className="text-[0.75rem] font-inter text-grey-2 bg-grey-1 p-3 rounded overflow-auto">
                                      {JSON.stringify(sourceData, null, 2)}
                                    </pre>
                                  )}
                                </div>
                              )}
                            </div>
                          ),
                        )
                      ) : (
                        <p className="text-[0.875rem] font-inter text-grey-2">
                          No data available.
                        </p>
                      )}
                    </div>
                  </div>
                );
              })()
            ) : realtimeData?.error ? (
              <div className="bg-white-1 border border-red-200 rounded-lg p-6 text-left">
                <h3 className="text-[1rem] font-inter font-semibold text-red-500 mb-2">
                  Error Loading Realtime Data
                </h3>
                <p className="text-[0.875rem] font-inter text-grey-2">
                  {realtimeData.error.data?.error ||
                    realtimeData.error.data?.message ||
                    "Unknown error occurred"}
                </p>
              </div>
            ) : (
              <div className="bg-white-1 border border-grey-1 rounded-lg p-6 text-left">
                <h3 className="text-[1rem] font-inter font-semibold text-black-1 mb-2">
                  Realtime Data Status
                </h3>
                <p className="text-[0.875rem] font-inter text-grey-2 mb-4">
                  Realtime estimates are calculated using statistical
                  aggregation from historical data.
                </p>
                <div className="space-y-2 text-[0.75rem] font-inter text-grey-2">
                  <p>
                    <strong>Current Status:</strong>
                  </p>
                  <ul className="list-disc list-inside ml-4 space-y-1">
                    <li>
                      Backend endpoint: <code>/api/realtime/realtime-data</code>
                    </li>
                    <li>Country: {selectedCountry}</li>
                    <li>Response received: {realtimeData ? "Yes" : "No"}</li>
                  </ul>
                </div>
                <div className="mt-4 pt-4 border-t border-grey-1">
                  <p className="text-[0.75rem] font-inter text-grey-2">
                    <strong>Methodology:</strong>
                  </p>
                  <ul className="text-[0.75rem] font-inter text-grey-2 list-disc list-inside mt-2 space-y-1">
                    <li>Configure API keys in environment variables</li>
                    <li>Implement Worldometer web scraping</li>
                    <li>Test API connections</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-20">
          <span className="text-grey-2 text-[1rem] font-inter">
            Loading data...
          </span>
        </div>
      ) : countryDetailsError && viewMode === "hourly" ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <p className="text-red-500 text-[1rem] font-inter mb-2">
              Error loading country data
            </p>
            <p className="text-grey-2 text-[0.875rem] font-inter">
              {(countryDetailsError as any)?.data?.error ||
                (countryDetailsError as any)?.message ||
                "Unknown error"}
            </p>
            <p className="text-grey-2 text-[0.75rem] font-inter mt-2">
              Make sure you have selected a country and year.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Key Metrics */}
          <div className="mb-6">
            <h2 className="text-[1.25rem] font-inter font-semibold text-black-1 mb-4">
              {viewMode === "yearly"
                ? "Energy Yearly Energy Trends"
                : "Energy Overview"}
            </h2>
            {viewMode === "yearly" && (
              <div className="flex flex-wrap gap-4">
                <MetricCard
                  title="Total Generation"
                  value={metrics.totalGeneration}
                  unit=" TWh"
                />
                <MetricCard
                  title="Total Demand"
                  value={metrics.totalDemand}
                  unit=" TWh"
                />
                <MetricCard
                  title="Total Consumption"
                  value={metrics.totalConsumption}
                  unit=" TWh"
                />
                <MetricCard
                  title="Renewable Share"
                  value={metrics.renewableShare}
                  unit="%"
                />
                <MetricCard
                  title="Energy Poverty"
                  value={metrics.energyPoverty}
                  unit="%"
                />
              </div>
            )}
          </div>

          {/* Charts Section - Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {viewMode === "yearly" ? (
              <YearlyCharts data={yearlyData?.data} />
            ) : (
              <>
                {countryDetailsError && (
                  <div className="col-span-2 bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                    <p className="text-red-600 text-[0.875rem] font-inter font-semibold mb-2">
                      Error loading country data:
                    </p>
                    <p className="text-red-500 text-[0.75rem] font-inter">
                      {(countryDetailsError as any)?.data?.error ||
                        (countryDetailsError as any)?.message ||
                        "Unknown error"}
                    </p>
                  </div>
                )}
                <HourlyCharts data={hourlyData} />
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};

// Yearly Charts Component (from Map drawer)
const YearlyCharts = ({ data }: { data: any }) => {
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

  // Observe container sizes
  useEffect(() => {
    if (!data) return;

    const updateDimensions = () => {
      const newDimensions: Record<string, { width: number; height: number }> =
        {};

      Object.keys(containerRefs).forEach((key) => {
        const container =
          containerRefs[key as keyof typeof containerRefs].current;
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
  }, [data]);

  // Render charts
  useEffect(() => {
    if (!data?.time_series || Object.keys(chartDimensions).length === 0) return;

    const margin = { top: 30, right: 30, bottom: 60, left: 70 };
    const timeSeries = data.time_series;

    // Create or select tooltip div
    let tooltip = d3.select("body").select<HTMLDivElement>(".chart-tooltip");
    if (tooltip.empty()) {
      tooltip = d3
        .select("body")
        .append("div")
        .attr("class", "chart-tooltip")
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

      if (left + width + edgeBuffer > viewportRight) {
        left = left - width - 28;
      }
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
      rows: any[],
      renderHtml: (d: any) => string,
    ) => {
      const sortedRows = [...rows].sort((a, b) => a.year - b.year);
      const bisect = d3.bisector<any, number>((r) => r.year).left;

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
      rows: any[],
      renderHtml: (d: any) => string,
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

    // Electricity Demand & Generation Chart (from drawer)
    if (chartRefs.electricityAccess.current && timeSeries.length > 0) {
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

      const yearExtent = d3.extent(timeSeries, (d: any) => d.year) as [
        number | undefined,
        number | undefined,
      ];
      const x = d3
        .scaleLinear()
        .domain(
          yearExtent[0] !== undefined && yearExtent[1] !== undefined
            ? ([yearExtent[0], yearExtent[1]] as [number, number])
            : [0, 1],
        )
        .range([0, chartWidth]);

      const y = d3
        .scaleLinear()
        .domain([
          0,
          d3.max(timeSeries, (d: any) =>
            Math.max(d.electricity_demand || 0, d.electricity_generation || 0),
          ) || 0,
        ] as [number, number])
        .range([chartHeight, 0]);

      // Demand line
      const demandLine = d3
        .line<(typeof timeSeries)[0]>()
        .x((d: any) => x(d.year))
        .y((d: any) => y(d.electricity_demand || 0))
        .curve(d3.curveMonotoneX);

      // Generation line
      const generationLine = d3
        .line<(typeof timeSeries)[0]>()
        .x((d: any) => x(d.year))
        .y((d: any) => y(d.electricity_generation || 0))
        .curve(d3.curveMonotoneX);

      // Add animated paths
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
        timeSeries,
        (d: any) =>
          `Year: ${d.year}<br/>Demand: ${(d.electricity_demand || 0).toFixed(2)} TWh<br/>Generation: ${(d.electricity_generation || 0).toFixed(2)} TWh`,
      );

      // Add hover circles for demand line
      g.selectAll(".demand-circle")
        .data(
          timeSeries.filter(
            (d: any) =>
              d.electricity_demand !== null &&
              d.electricity_demand !== undefined,
          ),
        )
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
          timeSeries.filter(
            (d: any) =>
              d.electricity_generation !== null &&
              d.electricity_generation !== undefined,
          ),
        )
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
    if (chartRefs.co2Emission.current && timeSeries.length > 0) {
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

      const yearExtent = d3.extent(timeSeries, (d: any) => d.year) as [
        number | undefined,
        number | undefined,
      ];
      const x = d3
        .scaleLinear()
        .domain(
          yearExtent[0] !== undefined && yearExtent[1] !== undefined
            ? ([yearExtent[0], yearExtent[1]] as [number, number])
            : [0, 1],
        )
        .range([0, chartWidth]);

      const y = d3
        .scaleLinear()
        .domain([
          0,
          d3.max(timeSeries, (d: any) => d.carbon_intensity || 0) || 0,
        ] as [number, number])
        .range([chartHeight, 0]);

      const line = d3
        .line<(typeof timeSeries)[0]>()
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
        timeSeries,
        (d: any) =>
          `Year: ${d.year}<br/>CO₂ Intensity: ${(d.carbon_intensity || 0).toFixed(2)} gCO₂/kWh`,
      );

      // Add hover circles
      g.selectAll(".co2-circle")
        .data(
          timeSeries.filter(
            (d: any) =>
              d.carbon_intensity !== null && d.carbon_intensity !== undefined,
          ),
        )
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
    if (chartRefs.population.current && timeSeries.length > 0) {
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

      const yearExtent = d3.extent(timeSeries, (d: any) => d.year) as [
        number | undefined,
        number | undefined,
      ];
      const x = d3
        .scaleLinear()
        .domain(
          yearExtent[0] !== undefined && yearExtent[1] !== undefined
            ? ([yearExtent[0], yearExtent[1]] as [number, number])
            : [0, 1],
        )
        .range([0, chartWidth]);

      const y = d3
        .scaleLinear()
        .domain([
          0,
          d3.max(timeSeries, (d: any) => (d.population || 0) / 1000000) || 0,
        ] as [number, number])
        .range([chartHeight, 0]);

      const area = d3
        .area<(typeof timeSeries)[0]>()
        .x((d: any) => x(d.year))
        .y0(chartHeight)
        .y1((d: any) => y((d.population || 0) / 1000000))
        .curve(d3.curveMonotoneX);

      g.append("path")
        .datum(timeSeries)
        .attr("fill", "#9333EA")
        .attr("fill-opacity", 0)
        .attr("d", area)
        .transition()
        .duration(1500)
        .ease(d3.easeCubicInOut)
        .attr("fill-opacity", 0.6);

      // Calculate year ticks
      const years = timeSeries.map((d: any) => d.year);
      const { tickValues } = calculateYearTicks(years);

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
        timeSeries,
        (d: any) => {
          const popMillions = (d.population || 0) / 1000000;
          return `Year: ${d.year}<br/>Population: ${popMillions.toFixed(2)}M`;
        },
      );

      // Add hover circles for area chart
      g.selectAll(".population-circle")
        .data(
          timeSeries.filter(
            (d: any) => d.population !== null && d.population !== undefined,
          ),
        )
        .enter()
        .append("circle")
        .attr("class", "population-circle")
        .attr("cx", (d: any) => x(d.year))
        .attr("cy", (d: any) => y((d.population || 0) / 1000000))
        .attr("r", 4)
        .attr("fill", "#9333EA")
        .attr("opacity", 0)
        .style("cursor", "pointer")
        .on("mouseover", function (event, d: any) {
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
    if (chartRefs.cleanCooking.current && timeSeries.length > 0) {
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
      const allYears = timeSeries.map((d: any) => d.year);
      const { tickValues } = calculateYearTicks(allYears);

      // Filter time series to only show years in tickValues (max 16)
      const filteredTimeSeries = timeSeries.filter((d: any) =>
        tickValues.includes(d.year),
      );
      const uniqueYears = tickValues;

      const x = d3
        .scaleBand()
        .domain(uniqueYears.map((yr: any) => yr.toString()))
        .range([0, chartWidth])
        .padding(0.2);

      const y = d3.scaleLinear().domain([0, 100]).range([chartHeight, 0]);

      filteredTimeSeries.forEach((d: any, i: number) => {
        const clean = d.clean_cooking_access || 0;
        const traditional = 100 - clean;

        g.append("rect")
          .attr("x", x(d.year.toString()) || 0)
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
          .attr("x", x(d.year.toString()) || 0)
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
          d3
            .axisBottom(x)
            .tickValues(uniqueYears.map((y: any) => y.toString())),
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
        (d: any) => {
          const clean = d.clean_cooking_access || 0;
          const traditional = 100 - clean;
          return `Year: ${d.year}<br/>Clean: ${clean.toFixed(1)}%<br/>Traditional: ${traditional.toFixed(1)}%`;
        },
      );
    }

    // Energy Poverty Chart (Bar Chart)
    if (chartRefs.energyPoverty.current && timeSeries.length > 0) {
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

      // Filter to most recent 16 years and calculate tick values
      const allYears = timeSeries.map((d: any) => d.year);
      const { tickValues } = calculateYearTicks(allYears);

      // Filter time series to only show years in tickValues (max 16)
      const filteredTimeSeries = timeSeries.filter((d: any) =>
        tickValues.includes(d.year),
      );
      const uniqueYears = tickValues;

      const x = d3
        .scaleBand()
        .domain(uniqueYears.map((yr: any) => yr.toString()))
        .range([0, chartWidth])
        .padding(0.2);

      const y = d3.scaleLinear().domain([0, 100]).range([chartHeight, 0]);

      filteredTimeSeries.forEach((d: any, i: number) => {
        g.append("rect")
          .attr("x", x(d.year.toString()) || 0)
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
          d3
            .axisBottom(x)
            .tickValues(uniqueYears.map((y: any) => y.toString())),
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
        (d: any) =>
          `Year: ${d.year}<br/>Energy Poverty: ${(d.energy_poverty || 0).toFixed(1)}%`,
      );
    }

    // Electricity Per Capita Chart
    if (chartRefs.electricityPerCapita.current && timeSeries.length > 0) {
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

      const yearExtent = d3.extent(timeSeries, (d: any) => d.year) as [
        number | undefined,
        number | undefined,
      ];
      const x = d3
        .scaleLinear()
        .domain(
          yearExtent[0] !== undefined && yearExtent[1] !== undefined
            ? ([yearExtent[0], yearExtent[1]] as [number, number])
            : [0, 1],
        )
        .range([0, chartWidth]);

      const y = d3
        .scaleLinear()
        .domain([
          0,
          d3.max(timeSeries, (d: any) =>
            Math.max(
              d.electricity_demand_per_capita || 0,
              d.electricity_demand_per_capita_with_access || 0,
            ),
          ) || 0,
        ] as [number, number])
        .range([chartHeight, 0]);

      const perCapitaLine = d3
        .line<(typeof timeSeries)[0]>()
        .x((d: any) => x(d.year))
        .y((d: any) => y(d.electricity_demand_per_capita || 0))
        .curve(d3.curveMonotoneX);

      const withAccessLine = d3
        .line<(typeof timeSeries)[0]>()
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
        timeSeries,
        (d: any) =>
          `Year: ${d.year}<br/>Rural: ${(d.energy_poverty_rural || 0).toFixed(1)}%<br/>Urban: ${(d.energy_poverty_urban || 0).toFixed(1)}%`,
      );

      // Add hover circles for per capita line
      g.selectAll(".per-capita-circle")
        .data(
          timeSeries.filter(
            (d: any) =>
              d.electricity_demand_per_capita !== null &&
              d.electricity_demand_per_capita !== undefined,
          ),
        )
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
          timeSeries.filter(
            (d: any) =>
              d.electricity_demand_per_capita_with_access !== null &&
              d.electricity_demand_per_capita_with_access !== undefined,
          ),
        )
        .enter()
        .append("circle")
        .attr("class", "with-access-circle")
        .attr("cx", (d: any) => x(d.year))
        .attr("cy", (d: any) =>
          y(d.electricity_demand_per_capita_with_access || 0),
        )
        .attr("r", 4)
        .attr("fill", "#1E3A8A")
        .attr("opacity", 0)
        .style("cursor", "pointer")
        .on("mouseover", function (event, d: any) {
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
    if (chartRefs.energyPovertyComparison.current && timeSeries.length > 0) {
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

      const yearExtent = d3.extent(timeSeries, (d: any) => d.year) as [
        number | undefined,
        number | undefined,
      ];
      const x = d3
        .scaleLinear()
        .domain(
          yearExtent[0] !== undefined && yearExtent[1] !== undefined
            ? ([yearExtent[0], yearExtent[1]] as [number, number])
            : [0, 1],
        )
        .range([0, chartWidth]);

      // Calculate max value from both series
      const maxValue =
        d3.max(timeSeries, (d: any) =>
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
        .line<(typeof timeSeries)[0]>()
        .x((d: any) => x(d.year))
        .y((d: any) => y(d.energy_poverty || 0))
        .defined(
          (d: any) =>
            d.energy_poverty !== null && d.energy_poverty !== undefined,
        )
        .curve(d3.curveMonotoneX);

      const multidimensionalLine = d3
        .line<(typeof timeSeries)[0]>()
        .x((d: any) => x(d.year))
        .y((d: any) => y(d.energy_poverty_multidimensional || 0))
        .defined(
          (d: any) =>
            d.energy_poverty_multidimensional !== null &&
            d.energy_poverty_multidimensional !== undefined,
        )
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
          timeSeries.filter(
            (d: any) =>
              d.energy_poverty !== null && d.energy_poverty !== undefined,
          ),
        )
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
          timeSeries.filter(
            (d: any) =>
              d.energy_poverty_multidimensional !== null &&
              d.energy_poverty_multidimensional !== undefined,
          ),
        )
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
    if (chartRefs.energyPovertyRuralUrban.current && timeSeries.length > 0) {
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

      const yearExtent = d3.extent(timeSeries, (d: any) => d.year) as [
        number | undefined,
        number | undefined,
      ];
      const x = d3
        .scaleLinear()
        .domain(
          yearExtent[0] !== undefined && yearExtent[1] !== undefined
            ? ([yearExtent[0], yearExtent[1]] as [number, number])
            : [0, 1],
        )
        .range([0, chartWidth]);

      // Calculate max value from both series
      const maxValue =
        d3.max(timeSeries, (d: any) =>
          Math.max(d.energy_poverty_rural || 0, d.energy_poverty_urban || 0),
        ) || 100;

      const y = d3
        .scaleLinear()
        .domain([0, Math.max(100, maxValue)])
        .range([chartHeight, 0]);

      const ruralLine = d3
        .line<(typeof timeSeries)[0]>()
        .x((d: any) => x(d.year))
        .y((d: any) => y(d.energy_poverty_rural || 0))
        .defined(
          (d: any) =>
            d.energy_poverty_rural !== null &&
            d.energy_poverty_rural !== undefined,
        )
        .curve(d3.curveMonotoneX);

      const urbanLine = d3
        .line<(typeof timeSeries)[0]>()
        .x((d: any) => x(d.year))
        .y((d: any) => y(d.energy_poverty_urban || 0))
        .defined(
          (d: any) =>
            d.energy_poverty_urban !== null &&
            d.energy_poverty_urban !== undefined,
        )
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
          timeSeries.filter(
            (d: any) =>
              d.energy_poverty_rural !== null &&
              d.energy_poverty_rural !== undefined,
          ),
        )
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
          timeSeries.filter(
            (d: any) =>
              d.energy_poverty_urban !== null &&
              d.energy_poverty_urban !== undefined,
          ),
        )
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
  }, [data, chartDimensions]);

  if (!data?.time_series || data.time_series.length === 0) {
    return (
      <div className="col-span-2">
        <p className="text-grey-2">No yearly data available</p>
      </div>
    );
  }

  return (
    <>
      <ChartCard title="Electricity Demand & Generation (TWh)">
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
      </ChartCard>

      <ChartCard title="CO2 Emission per Capita (gCO₂/kWh)">
        <div ref={containerRefs.co2Emission} className="w-full">
          <svg ref={chartRefs.co2Emission} className="w-full h-auto"></svg>
        </div>
      </ChartCard>

      <ChartCard title="Population (Millions)">
        <div ref={containerRefs.population} className="w-full">
          <svg ref={chartRefs.population} className="w-full h-auto"></svg>
        </div>
      </ChartCard>

      <ChartCard title="Clean Cooking Access (%)">
        <div ref={containerRefs.cleanCooking} className="w-full">
          <svg ref={chartRefs.cleanCooking} className="w-full h-auto"></svg>
        </div>
        <div className="flex gap-4 mt-2 text-[0.75rem] font-inter">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500"></div>
            <span className="text-grey-2">Clean</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3"
              style={{ backgroundColor: "#F97316" }}
            ></div>
            <span className="text-grey-2">Traditional</span>
          </div>
        </div>
      </ChartCard>

      <ChartCard title="Energy Poverty Index (%)">
        <div ref={containerRefs.energyPoverty} className="w-full">
          <svg ref={chartRefs.energyPoverty} className="w-full h-auto"></svg>
        </div>
      </ChartCard>

      <ChartCard title="Electricity Per Capita (MWh/year)">
        <div ref={containerRefs.electricityPerCapita} className="w-full">
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
            <span className="text-grey-2">Per capita (with Access)</span>
          </div>
        </div>
      </ChartCard>

      <ChartCard title="Energy Poverty Comparison (%)">
        <div ref={containerRefs.energyPovertyComparison} className="w-full">
          <svg
            ref={chartRefs.energyPovertyComparison}
            className="w-full h-auto"
          ></svg>
        </div>
        <div className="flex gap-4 mt-2 text-[0.75rem] font-inter">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3"
              style={{ backgroundColor: "#DC2626" }}
            ></div>
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
      </ChartCard>

      <ChartCard title="Energy Poverty: Rural vs Urban (%)">
        <div ref={containerRefs.energyPovertyRuralUrban} className="w-full">
          <svg
            ref={chartRefs.energyPovertyRuralUrban}
            className="w-full h-auto"
          ></svg>
        </div>
        <div className="flex gap-4 mt-2 text-[0.75rem] font-inter">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3"
              style={{ backgroundColor: "#F97316" }}
            ></div>
            <span className="text-grey-2">Rural</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500"></div>
            <span className="text-grey-2">Urban</span>
          </div>
        </div>
      </ChartCard>
    </>
  );
};

// Hourly Charts Component
const HourlyCharts = ({ data }: { data: any }) => {
  const chartRefs = {
    hourlyDemand: useRef<SVGSVGElement>(null),
    perCapitaDemand: useRef<SVGSVGElement>(null),
  };

  const containerRefs = {
    hourlyDemand: useRef<HTMLDivElement>(null),
    perCapitaDemand: useRef<HTMLDivElement>(null),
  };

  const [chartDimensions, setChartDimensions] = useState<
    Record<string, { width: number; height: number }>
  >({});

  // Observe container sizes
  useEffect(() => {
    if (!data) return;

    const updateDimensions = () => {
      const newDimensions: Record<string, { width: number; height: number }> =
        {};

      Object.keys(containerRefs).forEach((key) => {
        const container =
          containerRefs[key as keyof typeof containerRefs].current;
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
  }, [data]);

  // Render charts
  useEffect(() => {
    const hourlyRecords = data?.data?.data || data?.data || [];

    if (
      !Array.isArray(hourlyRecords) ||
      hourlyRecords.length === 0 ||
      Object.keys(chartDimensions).length === 0
    ) {
      console.log("HourlyCharts render effect: No data or dimensions", {
        hasData: !!data,
        recordsLength: Array.isArray(hourlyRecords) ? hourlyRecords.length : 0,
        dimensionsKeys: Object.keys(chartDimensions).length,
        dataStructure: data ? Object.keys(data) : null,
        dataDataStructure: data?.data
          ? Array.isArray(data.data)
            ? "array"
            : Object.keys(data.data)
          : null,
      });
      return;
    }

    const margin = { top: 30, right: 30, bottom: 60, left: 70 };

    // Create or select tooltip div
    let tooltip = d3.select("body").select<HTMLDivElement>(".chart-tooltip");
    if (tooltip.empty()) {
      tooltip = d3
        .select("body")
        .append("div")
        .attr("class", "chart-tooltip")
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

      if (left + width + edgeBuffer > viewportRight) {
        left = left - width - 28;
      }
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

    // Parse datetime and prepare data
    const parsedData = hourlyRecords.map((record: any) => ({
      datetime: new Date(record.datetime),
      demand: record.electricity_demand_MWh || 0,
      perCapita:
        record.electricity_demand_per_capita_kWh ??
        (record.electricity_demand_per_capita_MWh != null
          ? record.electricity_demand_per_capita_MWh * 1000
          : 0),
      perCapitaWithAccess:
        record.electricity_demand_per_capita_with_access_kWh ??
        (record.electricity_demand_per_capita_with_access_MWh != null
          ? record.electricity_demand_per_capita_with_access_MWh * 1000
          : 0),
    }));

    // Electricity Demand Chart
    if (chartRefs.hourlyDemand.current && parsedData.length > 0) {
      const dims = chartDimensions.hourlyDemand || { width: 500, height: 300 };
      const chartWidth = dims.width - margin.left - margin.right;
      const chartHeight = dims.height - margin.top - margin.bottom;

      const svg = d3.select(chartRefs.hourlyDemand.current);
      svg.selectAll("*").remove();
      svg
        .attr("width", dims.width)
        .attr("height", dims.height)
        .attr("viewBox", `0 0 ${dims.width} ${dims.height}`)
        .attr("preserveAspectRatio", "xMidYMid meet");

      const g = svg
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

      const dateExtent = d3.extent(
        parsedData,
        (d: (typeof parsedData)[0]) => d.datetime,
      ) as [Date | undefined, Date | undefined];
      const x = d3
        .scaleTime()
        .domain(
          dateExtent[0] && dateExtent[1]
            ? ([dateExtent[0], dateExtent[1]] as [Date, Date])
            : [new Date(), new Date()],
        )
        .range([0, chartWidth]);

      const y = d3
        .scaleLinear()
        .domain([
          0,
          d3.max(parsedData, (d: (typeof parsedData)[0]) => d.demand) || 0,
        ] as [number, number])
        .range([chartHeight, 0]);

      // Area chart for demand
      const area = d3
        .area<(typeof parsedData)[0]>()
        .x((d) => x(d.datetime))
        .y0(chartHeight)
        .y1((d) => y(d.demand))
        .curve(d3.curveMonotoneX);

      // Line chart for demand
      const demandLine = d3
        .line<(typeof parsedData)[0]>()
        .x((d) => x(d.datetime))
        .y((d) => y(d.demand))
        .curve(d3.curveMonotoneX);

      // Add area chart
      g.append("path")
        .datum(parsedData)
        .attr("fill", "#1E3A8A")
        .attr("fill-opacity", 0.3)
        .attr("d", area);

      // Add line chart
      g.append("path")
        .datum(parsedData)
        .attr("fill", "none")
        .attr("stroke", "#1E3A8A")
        .attr("stroke-width", 2)
        .attr("d", demandLine);

      // X-axis with time format
      const timeFormat = d3.timeFormat("%H:%M");
      g.append("g")
        .attr("transform", `translate(0,${chartHeight})`)
        .call(
          d3.axisBottom(x).tickFormat((d) => {
            if (d instanceof Date) {
              return timeFormat(d);
            }
            return "";
          }),
        );

      g.append("g").call(d3.axisLeft(y));

      g.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 0 - margin.left)
        .attr("x", 0 - chartHeight / 2)
        .attr("dy", "1em")
        .style("text-anchor", "middle")
        .style("font-size", "12px")
        .style("fill", "#666")
        .text("Demand (MWh)");

      // Tooltip interactions
      const bisect = d3.bisector<(typeof parsedData)[0], Date>(
        (d) => d.datetime,
      ).left;
      const fmt = d3.timeFormat("%Y-%m-%d %H:%M");
      g.append("rect")
        .attr("class", "overlay")
        .attr("width", chartWidth)
        .attr("height", chartHeight)
        .attr("fill", "transparent")
        .on("mousemove", function (event) {
          const [mx] = d3.pointer(event, this as any);
          const xDate = x.invert(mx);
          const i = Math.max(
            0,
            Math.min(parsedData.length - 1, bisect(parsedData, xDate)),
          );
          const d0 = parsedData[Math.max(0, i - 1)];
          const d1 = parsedData[Math.min(parsedData.length - 1, i)];
          const d =
            xDate.getTime() - d0.datetime.getTime() <
            d1.datetime.getTime() - xDate.getTime()
              ? d0
              : d1;
          tooltip
            .html(
              `Time: ${fmt(d.datetime)}<br/>Demand: ${Number(d.demand ?? 0).toFixed(2)} MWh`,
            )
            .style("left", event.pageX + 12 + "px")
            .style("top", event.pageY - 28 + "px")
            .style("opacity", 1);
        })
        .on("mouseleave", function () {
          tooltip.transition().duration(150).style("opacity", 0);
        });
    }

    // Electricity Per Capita Chart
    if (chartRefs.perCapitaDemand.current && parsedData.length > 0) {
      const dims = chartDimensions.perCapitaDemand || {
        width: 500,
        height: 300,
      };
      const chartWidth = dims.width - margin.left - margin.right;
      const chartHeight = dims.height - margin.top - margin.bottom;

      const svg = d3.select(chartRefs.perCapitaDemand.current);
      svg.selectAll("*").remove();
      svg
        .attr("width", dims.width)
        .attr("height", dims.height)
        .attr("viewBox", `0 0 ${dims.width} ${dims.height}`)
        .attr("preserveAspectRatio", "xMidYMid meet");

      const g = svg
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

      const dateExtent2 = d3.extent(
        parsedData,
        (d: (typeof parsedData)[0]) => d.datetime,
      ) as [Date | undefined, Date | undefined];
      const x = d3
        .scaleTime()
        .domain(
          dateExtent2[0] && dateExtent2[1]
            ? ([dateExtent2[0], dateExtent2[1]] as [Date, Date])
            : [new Date(), new Date()],
        )
        .range([0, chartWidth]);

      const y = d3
        .scaleLinear()
        .domain([
          0,
          d3.max(parsedData, (d: (typeof parsedData)[0]) =>
            Math.max(d.perCapita, d.perCapitaWithAccess),
          ) || 0,
        ] as [number, number])
        .range([chartHeight, 0]);

      const perCapitaLine = d3
        .line<(typeof parsedData)[0]>()
        .x((d) => x(d.datetime))
        .y((d) => y(d.perCapita))
        .curve(d3.curveMonotoneX);

      const withAccessLine = d3
        .line<(typeof parsedData)[0]>()
        .x((d) => x(d.datetime))
        .y((d) => y(d.perCapitaWithAccess))
        .curve(d3.curveMonotoneX);

      g.append("path")
        .datum(parsedData)
        .attr("fill", "none")
        .attr("stroke", "#9333EA")
        .attr("stroke-width", 2)
        .attr("d", perCapitaLine);

      g.append("path")
        .datum(parsedData)
        .attr("fill", "none")
        .attr("stroke", "#1E3A8A")
        .attr("stroke-width", 2)
        .attr("d", withAccessLine);

      // Add legend
      const legend = g
        .append("g")
        .attr("transform", `translate(${chartWidth - 150}, 20)`);

      legend
        .append("line")
        .attr("x1", 0)
        .attr("x2", 20)
        .attr("y1", 0)
        .attr("y2", 0)
        .attr("stroke", "#9333EA")
        .attr("stroke-width", 2);

      legend
        .append("text")
        .attr("x", 25)
        .attr("y", 4)
        .style("font-size", "11px")
        .style("fill", "#666")
        .text("Per Capita");

      legend
        .append("line")
        .attr("x1", 0)
        .attr("x2", 20)
        .attr("y1", 15)
        .attr("y2", 15)
        .attr("stroke", "#1E3A8A")
        .attr("stroke-width", 2);

      legend
        .append("text")
        .attr("x", 25)
        .attr("y", 19)
        .style("font-size", "11px")
        .style("fill", "#666")
        .text("With Access");

      // X-axis with time format
      const timeFormat2 = d3.timeFormat("%H:%M");
      g.append("g")
        .attr("transform", `translate(0,${chartHeight})`)
        .call(
          d3.axisBottom(x).tickFormat((d) => {
            if (d instanceof Date) {
              return timeFormat2(d);
            }
            return "";
          }),
        );

      g.append("g").call(d3.axisLeft(y));

      g.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 0 - margin.left)
        .attr("x", 0 - chartHeight / 2)
        .attr("dy", "1em")
        .style("text-anchor", "middle")
        .style("font-size", "12px")
        .style("fill", "#666")
        .text("Per capita (kWh/person)");

      // Tooltip interactions for two series
      const bisect = d3.bisector<(typeof parsedData)[0], Date>(
        (d) => d.datetime,
      ).left;
      const fmt = d3.timeFormat("%Y-%m-%d %H:%M");
      g.append("rect")
        .attr("class", "overlay")
        .attr("width", chartWidth)
        .attr("height", chartHeight)
        .attr("fill", "transparent")
        .on("mousemove", function (event) {
          const [mx] = d3.pointer(event, this as any);
          const xDate = x.invert(mx);
          const i = Math.max(
            0,
            Math.min(parsedData.length - 1, bisect(parsedData, xDate)),
          );
          const d0 = parsedData[Math.max(0, i - 1)];
          const d1 = parsedData[Math.min(parsedData.length - 1, i)];
          const d =
            xDate.getTime() - d0.datetime.getTime() <
            d1.datetime.getTime() - xDate.getTime()
              ? d0
              : d1;
          tooltip
            .html(
              `Time: ${fmt(d.datetime)}<br/>Per capita: ${Number(d.perCapita ?? 0).toFixed(3)} kWh/person<br/>With access: ${Number(d.perCapitaWithAccess ?? 0).toFixed(3)} kWh/person`,
            )
            .style("left", event.pageX + 12 + "px")
            .style("top", event.pageY - 36 + "px")
            .style("opacity", 1);
        })
        .on("mouseleave", function () {
          tooltip.transition().duration(150).style("opacity", 0);
        });
    }
    return () => {
      if (tooltipObserver) tooltipObserver.disconnect();
      d3.select("body").select(".chart-tooltip").remove();
    };
  }, [data, chartDimensions]);

  // Backend returns: { success: true, data: [...], metadata: {...} }
  // RTK Query wraps it: { data: { success: true, data: [...], metadata: {...} } }
  // So data.data.data is the array, or data.data if it's already unwrapped
  const hourlyRecords = data?.data?.data || data?.data || [];

  if (!Array.isArray(hourlyRecords) || hourlyRecords.length === 0) {
    return (
      <div className="w-full col-span-2">
        <p className="text-grey-2 text-center py-8">
          No hourly data available. Please select a country and date.
        </p>
      </div>
    );
  }

  return (
    <>
      <ChartCard title="Electricity Demand">
        <div ref={containerRefs.hourlyDemand} className="w-full">
          <svg ref={chartRefs.hourlyDemand} className="w-full h-auto"></svg>
        </div>
      </ChartCard>

      <ChartCard title="Electricity Demand Per Capita (kWh/person)">
        <div ref={containerRefs.perCapitaDemand} className="w-full">
          <svg ref={chartRefs.perCapitaDemand} className="w-full h-auto"></svg>
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
            <span className="text-grey-2">Per capita (with Access)</span>
          </div>
        </div>
      </ChartCard>
    </>
  );
};
