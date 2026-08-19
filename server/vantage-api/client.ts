import "server-only";

import { getServerEnv } from "@/lib/env/server";
import { parseVantageApiResponse, type VantageApiResponse } from "./response";
import { buildVantageApiUrl } from "./url";

export type { VantageApiResponse };

export type VantageApiMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export type VantageApiRequestOptions = {
  method?: VantageApiMethod;
  body?: unknown;
  headers?: HeadersInit;
};

export async function requestVantageApi<T = unknown>(
  path: string,
  options: VantageApiRequestOptions = {},
): Promise<VantageApiResponse<T>> {
  const { VANTAGE_API_SECRET, VANTAGE_API_PROTECTION_BYPASS } = getServerEnv();
  const method = options.method ?? "GET";
  const url = buildVantageApiUrl(path);
  const headers = new Headers(options.headers);

  headers.set("x-api-secret", VANTAGE_API_SECRET);
  if (VANTAGE_API_PROTECTION_BYPASS) {
    headers.set("x-vercel-protection-bypass", VANTAGE_API_PROTECTION_BYPASS);
  }
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
