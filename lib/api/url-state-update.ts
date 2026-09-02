export type UrlStateUpdate = Record<string, string | number | boolean | null | undefined>;

export function applyUrlStateUpdate(
  currentQuery: string,
  next: UrlStateUpdate,
  options: { resetPage?: boolean } = {},
): URLSearchParams {
  const params = new URLSearchParams(currentQuery);

  if (options.resetPage) {
    params.set("page", "1");
  }

  for (const [key, value] of Object.entries(next)) {
    if (value === undefined || value === null || value === "") {
      params.delete(key);
    } else {
      params.set(key, String(value));
    }
  }

  return params;
}
