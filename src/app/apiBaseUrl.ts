/** Same-origin when VITE_API_URL="" (production Docker/Railway build); localhost when unset (local dev).
 *  Do not set VITE_API_URL to :8080 on Railway — Gunicorn listens on $PORT inside the container,
 *  but the browser reaches the app at https://repsa.org (port 443). Same-origin "" is correct. */
export function getApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_URL;
  if (configured !== undefined) {
    return configured;
  }
  return "http://127.0.0.1:5000";
}
