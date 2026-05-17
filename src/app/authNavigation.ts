export type DownloadFormat = "csv" | "json";

export type SignInLocationState = {
  from?: string;
  pendingDownloadFormat?: DownloadFormat;
};

export type ReturnLocationState = {
  downloadFormat?: DownloadFormat;
};
