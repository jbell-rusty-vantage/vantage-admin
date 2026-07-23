import { getServerEnv } from "@/lib/env/server";
import { parseVantageApiResponse, type VantageApiResponse } from "./response";

export type { VantageApiResponse };

export type EmployeeBookingApiMethod = "GET" | "POST";

export type EmployeeBookingApiRequestOptions = {
  method?: EmployeeBookingApiMethod;
  body?: unknown;
  headers?: HeadersInit;
};

function stripLeadingSlash(path: string): string {
  return path.replace(/^\/+/, "");
}

export function resolveEmployeeBookingApiBaseUrl(): URL {
  const { EMPLOYEE_BOOKING_API_BASE_URL, VANTAGE_API_BASE_URL } = getServerEnv();
  return new URL(`${(EMPLOYEE_BOOKING_API_BASE_URL ?? VANTAGE_API_BASE_URL).replace(/\/+$/, "")}/`);
}

export function buildEmployeeBookingApiUrl(path: string): URL {
  const baseUrl = resolveEmployeeBookingApiBaseUrl();
  const url = new URL(stripLeadingSlash(path), baseUrl);

  if (url.origin !== baseUrl.origin) {
    throw new Error("Employee booking API path must stay within the configured host.");
  }

  return url;
}

export async function requestEmployeeBookingApi<T = unknown>(
  path: string,
  options: EmployeeBookingApiRequestOptions = {},
): Promise<VantageApiResponse<T>> {
  const { VANTAGE_API_SECRET } = getServerEnv();
  const method = options.method ?? "GET";
  const url = buildEmployeeBookingApiUrl(path);
  const headers = new Headers(options.headers);

  headers.set("x-api-secret", VANTAGE_API_SECRET);
  headers.delete("cookie");
  headers.delete("authorization");

  const init: RequestInit = {
    method,
    headers,
    cache: "no-store",
  };

  if (options.body !== undefined && method !== "GET") {
    headers.set("content-type", headers.get("content-type") ?? "application/json");
    init.body =
      typeof options.body === "string" || options.body instanceof FormData
        ? options.body
        : JSON.stringify(options.body);
  }

  const response = await fetch(url, init);
  return parseVantageApiResponse<T>(response, path);
}
