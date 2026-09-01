import type { DatabaseScope } from "@/lib/api/types";

export type PaletteDestination = {
  label: string;
  href: string;
};

/** Empty or whitespace-only query returns `""`. */
export function buildSearchHref(query: string, scope: DatabaseScope): string {
  const trimmed = query.trim();
  if (!trimmed) {
    return "";
  }

  const params = new URLSearchParams({
    q: trimmed,
    database_scope: scope,
  });
  return `/search?${params.toString()}`;
}

/** Empty query returns every destination. */
export function filterPaletteDestinations(
  destinations: Array<PaletteDestination>,
  query: string,
): Array<PaletteDestination> {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return destinations;
  }

  return destinations.filter(
    (destination) =>
      destination.label.toLowerCase().includes(trimmed) || destination.href.toLowerCase().includes(trimmed),
  );
}

export function isCommandPaletteHotkey(event: {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
}): boolean {
  return (event.key === "k" || event.key === "K") && (event.metaKey || event.ctrlKey);
}
