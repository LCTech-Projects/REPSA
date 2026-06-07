import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { HiArrowDownTray } from "react-icons/hi2";
import { getApiBaseUrl } from "../../app/apiBaseUrl";
import { useGetAvailableCountriesQuery } from "../../app/appSlices/apiSlice";
import { getCountryFlag } from "../../components/utils/Flags";
import { DownloadDataListSkeleton } from "../../components/skeletons";
import { ContentPage, prose } from "./ContentPage";

type CountryDownload = {
  country: string;
  latestYear: number;
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

const fetchLatestHourlyYear = async (
  country: string,
): Promise<number | null> => {
  const response = await fetch(
    `${getApiBaseUrl()}/api/historical/available-years/${encodeURIComponent(country)}`,
  );
  if (!response.ok) return null;

  const json = await response.json();
  const years: number[] = json.data?.years ?? json.data?.data ?? [];
  return years.length > 0 ? years[years.length - 1] : null;
};

const DownloadData = () => {
  const { data: countriesData, isLoading: isCountriesLoading } =
    useGetAvailableCountriesQuery();
  const availableCountries: string[] = countriesData?.data ?? [];

  const [countryDownloads, setCountryDownloads] = useState<CountryDownload[]>(
    [],
  );
  const [isYearsLoading, setIsYearsLoading] = useState(false);
  const [yearsError, setYearsError] = useState<string | null>(null);
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);

  useEffect(() => {
    if (!availableCountries.length) {
      setCountryDownloads([]);
      return;
    }

    let cancelled = false;
    setIsYearsLoading(true);
    setYearsError(null);

    const loadYears = async () => {
      try {
        const entries = await Promise.all(
          availableCountries.map(async (country) => {
            const latestYear = await fetchLatestHourlyYear(country);
            if (!latestYear) return null;
            return { country, latestYear };
          }),
        );

        if (cancelled) return;

        setCountryDownloads(
          entries
            .filter((entry): entry is CountryDownload => entry !== null)
            .sort((a, b) => a.country.localeCompare(b.country)),
        );
      } catch {
        if (!cancelled) {
          setYearsError("Could not load available years. Please try again.");
        }
      } finally {
        if (!cancelled) setIsYearsLoading(false);
      }
    };

    loadYears();
    return () => {
      cancelled = true;
    };
  }, [availableCountries]);

  const downloadHourlyYear = async ({ country, latestYear }: CountryDownload) => {
    const key = `${country}-${latestYear}`;
    setDownloadingKey(key);

    try {
      const params = new URLSearchParams({
        country,
        year: String(latestYear),
        format: "csv",
      });

      const response = await fetch(
        `${getApiBaseUrl()}/api/historical/hourly-electricity-demand?${params.toString()}`,
      );

      if (!response.ok) {
        console.error("Hourly download failed:", await response.text());
        return;
      }

      const countrySlug = country.replace(/\s+/g, "_");
      const fallbackFilename = `hourly_demand_${countrySlug}_${latestYear}.csv`;
      const blob = await response.blob();

      triggerFileDownload(
        blob,
        parseContentDispositionFilename(
          response.headers.get("Content-Disposition"),
          fallbackFilename,
        ),
        "text/csv;charset=utf-8;",
      );
    } finally {
      setDownloadingKey(null);
    }
  };

  const isLoading = isCountriesLoading || isYearsLoading;
  const displayYear =
    countryDownloads.length > 0 ? countryDownloads[0].latestYear : null;

  return (
    <ContentPage title="Download Data">
      <p className={prose}>
        Download hourly electricity demand for the latest available year for
        each country below. Files are exported as CSV.
      </p>

      {displayYear && (
        <p className={`${prose} text-black-1`}>
          Latest hourly year shown:{" "}
          <span className="font-medium">{displayYear}</span>
        </p>
      )}

      {isLoading && <DownloadDataListSkeleton />}

      {yearsError && (
        <p className={`${prose} text-red-600`} role="alert">
          {yearsError}
        </p>
      )}

      {!isLoading && !yearsError && countryDownloads.length === 0 && (
        <p className={prose}>No hourly downloads are available right now.</p>
      )}

      {!isLoading && countryDownloads.length > 0 && (
        <ul className="mt-6 divide-y divide-grey-1 border border-grey-1 rounded-xl overflow-hidden bg-white-1">
          {countryDownloads.map((entry) => {
            const key = `${entry.country}-${entry.latestYear}`;
            const isDownloading = downloadingKey === key;

            return (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => downloadHourlyYear(entry)}
                  disabled={isDownloading}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-grey-1/60 transition-colors disabled:opacity-60 disabled:cursor-wait"
                >
                  <img
                    src={getCountryFlag(entry.country)}
                    alt=""
                    className="size-8 shrink-0 rounded object-cover"
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block font-medium text-black-1 truncate">
                      {entry.country}
                    </span>
                    <span className="block text-[0.875rem] text-grey-2">
                      Hourly data, {entry.latestYear}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5 text-[0.875rem] font-medium text-blue-1">
                    <HiArrowDownTray className="size-4" aria-hidden />
                    {isDownloading ? "Downloading…" : "Download CSV"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <p className={`${prose} mt-10`}>
        Need yearly trends, realtime estimates, or hourly data for other years
        and scopes?{" "}
        <Link to="/in/visualization" className="text-blue-1 hover:underline">
          Click here to explore more
        </Link>
      </p>
    </ContentPage>
  );
};

export default DownloadData;
