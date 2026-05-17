interface CountrySummary {
  country: string;
  year: number;
  electricity_access: number | null;
  renewable_share: number | null;
  energy_poverty: number | null;
}

interface CountryModalProps {
  countryName: string;
  countryFlag: string;
  summary?: CountrySummary | null;
  loading?: boolean;
}

export const CountryModal = ({
  countryName,
  countryFlag,
  summary,
  loading,
}: CountryModalProps) => {
  const formatPercentage = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return "N/A";
    return `${value.toFixed(1)}%`;
  };

  const getEnergyPovertyColor = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return "bg-grey-2";
    if (value >= 50) return "bg-red-500";
    if (value >= 30) return "bg-orange-500";
    if (value >= 15) return "bg-yellow-500";
    return "bg-green-500";
  };

  return (
    <div className="bg-white-1 rounded-[12px] p-[20px] shadow-lg backdrop-blur-sm bg-opacity-95 min-w-[280px]">
      <div className="flex items-center justify-between gap-[10px] mb-[16px]">
        <div className="flex items-center gap-[10px]">
          <div className="w-8 h-5 rounded overflow-hidden bg-white-1">
            <img
              src={countryFlag}
              alt={`${countryName} flag`}
              className="w-full h-full object-cover"
            />
          </div>
          <h3 className="text-black-1 text-[1.125rem] font-inter font-semibold">
            {countryName}
          </h3>
        </div>
        {summary && (
          <span className="text-grey-2 text-[0.875rem] font-inter">
            {summary.year}
          </span>
        )}
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-4">
          <span className="text-grey-2 text-[0.875rem] font-inter">
            Loading...
          </span>
        </div>
      ) : summary ? (
        <div className="flex flex-col gap-y-[12px]">
          <div className="flex items-center justify-between">
            <span className="text-grey-2 text-[0.875rem] font-inter">
              Electricity Access
            </span>
            <span className="text-black-1 text-[0.875rem] font-inter font-semibold">
              {formatPercentage(summary.electricity_access)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-grey-2 text-[0.875rem] font-inter">
              Renewable Share
            </span>
            <span className="text-black-1 text-[0.875rem] font-inter font-semibold">
              {formatPercentage(summary.renewable_share)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-grey-2 text-[0.875rem] font-inter">
              Energy Poverty
            </span>
            <span
              className={`${getEnergyPovertyColor(summary.energy_poverty)} text-white-1 text-[0.875rem] font-inter font-semibold px-[12px] py-[4px] rounded-[6px]`}
            >
              {formatPercentage(summary.energy_poverty)}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center py-4">
          <span className="text-grey-2 text-[0.875rem] font-inter">
            No data available
          </span>
        </div>
      )}
    </div>
  );
};
