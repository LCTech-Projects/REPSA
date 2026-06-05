
export function getApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_URL;
  if (configured !== undefined) {
    return configured;
  }
  return "http://127.0.0.1:5000";
}
