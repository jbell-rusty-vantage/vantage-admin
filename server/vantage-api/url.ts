import { getServerEnv } from "@/lib/env/server";

function stripLeadingSlash(path: string): string {
  return path.replace(/^\/+/, "");
}

export function buildVantageApiUrl(path: string): URL {
  const { VANTAGE_API_BASE_URL } = getServerEnv();
  const baseUrl = new URL(`${VANTAGE_API_BASE_URL.replace(/\/+$/, "")}/`);
  const url = new URL(stripLeadingSlash(path), baseUrl);

  if (url.origin !== baseUrl.origin) {
    throw new Error("Proxy path must stay within the configured Vantage API host.");
  }

  return url;
}
