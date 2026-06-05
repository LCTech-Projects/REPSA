export type DownloadFormat = "csv" | "json";
export type HourlyDownloadScope = "day" | "month" | "year";

export type SignInLocationState = {
  from?: string;
  pendingDownloadFormat?: DownloadFormat;
  pendingHourlyDownloadScope?: HourlyDownloadScope;
};

export type ReturnLocationState = {
  downloadFormat?: DownloadFormat;
  hourlyDownloadScope?: HourlyDownloadScope;
};
