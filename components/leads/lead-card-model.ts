/** Pure display rules of a lead card (doc 03 "Lead card"). */
import { formatBadLead } from "@/components/operational/mark-bad-lead-control";
import { getValue, stringValue } from "@/components/operational/operational-helpers";
import { getBookingQuery } from "@/components/operational/operational-actions";
import { formatMoney } from "@/components/ui/crm/format";
import type { CrmTone, EvidenceState, PillVariant } from "@/components/ui/crm/primitives";
import type { AdminRecord, SheetContainsItem } from "@/lib/api/admin";
import type { LeadKind } from "@/lib/api/leads";
import { LEADS_COPY } from "./leads-copy";

function present(value: unknown): boolean {
  if (value === true) return true;
  if (value === false || value === null || value === undefined || value === "") return false;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

export function isBooked(item: AdminRecord): boolean {
  return present(item.booked);
}

export function isCancelled(item: AdminRecord): boolean {
  return present(item.cancelled);
}

export function isBadLead(item: AdminRecord): boolean {
  return formatBadLead(item.bad_lead) !== "";
}

export function isDuplicate(item: AdminRecord): boolean {
  return item.duplicate === true;
}

/** The receiver agent's id, whether the list returned an id or a populated object. */
export function receiverAgentId(item: AdminRecord): string | null {
  const value = item.receiver_agent;
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value && typeof value === "object") {
    const id = (value as { _id?: unknown; id?: unknown })._id ?? (value as { id?: unknown }).id;
    if (typeof id === "string" && id.trim()) return id.trim();
  }
  return null;
}

export function isUnassigned(item: AdminRecord): boolean {
  return receiverAgentId(item) === null;
}

/** Icon circle tone: gray duplicate, red cancelled or bad, green booked, amber unassigned, else blue. */
export function leadTone(item: AdminRecord): CrmTone {
  if (isDuplicate(item)) return "gray";
  if (isCancelled(item) || isBadLead(item)) return "red";
  if (isBooked(item)) return "green";
  if (isUnassigned(item)) return "amber";
  return "blue";
}

export function leadStatus(item: AdminRecord): { key: "open" | "booked" | "cancelled" | "bad"; label: string; variant: PillVariant; title?: string } {
  const copy = LEADS_COPY.card.status;
  if (isCancelled(item)) return { key: "cancelled", label: copy.cancelled, variant: "red" };
  if (isBadLead(item)) return { key: "bad", label: copy.bad, variant: "red", title: formatBadLead(item.bad_lead) };
  if (isBooked(item)) return { key: "booked", label: copy.booked, variant: "green" };
  return { key: "open", label: copy.open, variant: "blue" };
}

export function leadName(item: AdminRecord): string {
  const direct = stringValue(item.name);
  if (direct) return direct;
  const joined = [stringValue(item.first_name), stringValue(item.last_name)].filter(Boolean).join(" ");
  return joined || LEADS_COPY.card.unnamed;
}

/** "P5" for a Granot priority stored as 5, "5" or "P5". */
export function priorityLabel(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const raw = String(value).trim();
  if (!raw) return null;
  return /^p/i.test(raw) ? raw.toUpperCase() : `P${raw}`;
}

export function routeText(item: AdminRecord): string | null {
  const place = (city: unknown, state: unknown) => [stringValue(city), stringValue(state)].filter(Boolean).join(", ");
  const from = place(item.pickup_city, item.pickup_state);
  const to = place(item.delivery_city, item.delivery_state);
  if (from && to) return `${from} → ${to}`;
  return from || to || null;
}

/** The estimate as money, or null when the lead has none yet. */
export function estimateText(item: AdminRecord): string | null {
  const value = item.quoted;
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value.replace(/[$,]/g, "")) : NaN;
  return Number.isFinite(number) && number > 0 ? formatMoney(number) : null;
}

export function granotDiffers(item: AdminRecord): boolean {
  const snapshot = item.granot_contact_snapshot;
  return Boolean(snapshot && typeof snapshot === "object" && (snapshot as { differs_from_ingested?: unknown }).differs_from_ingested === true);
}

/** `/bookings/new?...` with the lead's identifiers filled in (the booking form reads these keys). */
export function bookHref(kind: LeadKind, item: AdminRecord): string {
  return `/bookings/new?${getBookingQuery(kind === "form" ? "form-leads" : "call-leads", item)}`;
}

/** Whether Book is offered: not booked, not a duplicate, not cancelled. */
export function canBook(item: AdminRecord): boolean {
  return !isBooked(item) && !isDuplicate(item) && !isCancelled(item);
}

/** The Verify in Master Sheet verdict as an evidence chip (the icon comes from the chip state). */
export function verdictChip(item: SheetContainsItem): { state: EvidenceState; text: string; title?: string } {
  const expected = item.expected_tabs.join(", ");
  const found = item.found[0];
  switch (item.verdict) {
    case "found":
      return {
        state: "ok",
        text: found ? `${found.tab_name} row ${found.row_number}` : "In sheet",
        title: found?.workbook,
      };
    case "missing":
      return { state: "bad", text: `Missing from ${item.missing_expected_tabs.join(", ") || expected || "the sheet"}` };
    case "wrong_tab":
      return { state: "warn", text: `In ${found?.tab_name ?? "another tab"}, expected ${expected || "another tab"}` };
    case "not_expected":
      return { state: "none", text: item.reason === "no_sync" ? "Not expected (hidden)" : "Not expected" };
    case "not_found":
      return { state: "bad", text: "Not found" };
  }
}

export function sourceCompanyText(
  item: AdminRecord,
  companyLabelBySlug?: ReadonlyMap<string, string>,
): string | null {
  const snapshot = stringValue(getValue(item, "source_company_label_snapshot"));
  const slug = stringValue(item.source_company);
  return snapshot ?? (slug ? companyLabelBySlug?.get(slug.toLowerCase()) ?? slug : null);
}
