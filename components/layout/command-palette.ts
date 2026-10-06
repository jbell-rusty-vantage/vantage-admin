import type { GlobalSearchRecordType, GlobalSearchResponse, GlobalSearchResultItem } from "@/lib/api/types";

export type PaletteDestination = {
  label: string;
  href: string;
};

/** The ⌘K box sends the typed text to the Leads workspace search. Empty or whitespace-only query returns `""`. */
export function buildSearchHref(query: string): string {
  const trimmed = query.trim();
  if (!trimmed) {
    return "";
  }

  const params = new URLSearchParams({ q: trimmed });
  return `/leads?${params.toString()}`;
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

export type PaletteRecordKind = "lead" | "booking" | "cancellation";

export type PaletteRecord = {
  kind: PaletteRecordKind;
  id: string;
  href: string;
  primary: string;
  secondary?: string;
  /** "Form" / "Call" for a lead, "Cancelled" for a cancelled booking. */
  pill?: string;
  badges: string[];
};

function recordKind(recordType: GlobalSearchRecordType): { kind: PaletteRecordKind; pill?: string } | null {
  switch (recordType) {
    case "form_lead":
    case "form-leads":
      return { kind: "lead", pill: "Form" };
    case "call_lead":
    case "call-leads":
      return { kind: "lead", pill: "Call" };
    case "booked_lead":
    case "booked-leads":
      return { kind: "booking" };
    case "cancelled_lead":
    case "cancelled-leads":
      return { kind: "cancellation", pill: "Cancelled" };
    default:
      return null;
  }
}

/** Where a search hit opens: a lead in the Leads workspace panel, a booking or cancellation in the Bookings panel. */
export function paletteRecordHref(recordType: GlobalSearchRecordType, id: string): string | null {
  const encoded = encodeURIComponent(id);
  switch (recordKind(recordType)?.kind) {
    case "lead":
      return `/leads?lead=${encoded}&lk=${recordType.startsWith("call") ? "call" : "form"}`;
    case "booking":
      return `/bookings?record=${encoded}`;
    case "cancellation":
      return `/bookings/cancellations?record=${encoded}`;
    default:
      return null;
  }
}

/** Flattens the server's search groups into palette rows: leads first, then bookings (a cancelled booking shows its pill). */
export function paletteRecordsFromSearch(response: GlobalSearchResponse | undefined, limit = 8): PaletteRecord[] {
  if (!response) return [];
  const rows: PaletteRecord[] = [];
  const order: PaletteRecordKind[] = ["lead", "booking", "cancellation"];
  for (const kind of order) {
    for (const group of response.groups) {
      const meta = recordKind(group.record_type);
      if (!meta || meta.kind !== kind) continue;
      for (const item of group.items as GlobalSearchResultItem[]) {
        const href = paletteRecordHref(group.record_type, item.id);
        if (!href) continue;
        rows.push({
          kind,
          id: item.id,
          href,
          primary: item.primary_label,
          secondary: item.secondary_label,
          pill: meta.pill,
          badges: item.badges ?? [],
        });
      }
    }
  }
  return rows.slice(0, limit);
}
