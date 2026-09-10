export function publicProxyErrorMessage(status: number, message: string): string {
  const trimmed = message.trim();
  if (status < 500 || status === 503) {
    return trimmed || "Vantage API request failed.";
  }
  if (
    /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|socket hang up|Unexpected Vantage API proxy/i.test(
      trimmed,
    )
  ) {
    return "Vantage API request failed.";
  }
  return trimmed || "Vantage API request failed.";
}
