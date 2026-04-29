function normalizeBaseUrl(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "/api";
  }
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

export function getApiBaseUrl() {
  const envValue = import.meta.env.VITE_API_BASE_URL;
  const localValue = window.localStorage.getItem("dt.apiBaseUrl");
  return normalizeBaseUrl(localValue || envValue || "/api");
}

export function setApiBaseUrl(baseUrl) {
  window.localStorage.setItem("dt.apiBaseUrl", normalizeBaseUrl(baseUrl));
}

function buildUrl(path, query) {
  const url = new URL(`${getApiBaseUrl()}${path}`, window.location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") {
        continue;
      }
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

export class ApiError extends Error {
  constructor(message, options) {
    super(message);
    this.name = "ApiError";
    this.status = options?.status ?? 0;
    this.payload = options?.payload ?? null;
  }
}

export async function apiGet(path, query) {
  const response = await fetch(buildUrl(path, query), {
    method: "GET",
    headers: {
      accept: "application/json",
    },
  });

  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const message =
      typeof payload === "object" && payload && "message" in payload
        ? String(payload.message)
        : `Request failed (${response.status})`;
    throw new ApiError(message, { status: response.status, payload });
  }

  return payload;
}

