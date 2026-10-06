/**
 * Pure helpers for Setup → Change history: the URL filters (Entity · Who · When) turned into the server's filters,
 * Owner-word labels for entities, actions and diff fields, and diff values that never print a raw id.
 */
import { exclusiveEndDate } from "@/lib/operations-registry/exclusiveEndDate";
import type { RegistryChangeItem } from "@/lib/api/operationsRegistry";
import { humanizeRegistryKey, ownerWords } from "@/lib/api/registryEntityLinks";
import { formatSnapshotValue } from "@/lib/api/registrySnapshotDiff";
import { CHANGE_ACTION_LABELS, CHANGE_ENTITY_LABELS, CHANGES_COPY } from "./changes-copy";

export const CHANGES_PAGE_SIZE = 25;

export type ChangesUrlFilters = {
  entity: string;
  who: string;
  from: string;
  to: string;
  page: number;
  limit: number;
};

/** Reads `?entity=&who=&from=&to=&page=&limit=` (any of them may be missing). */
export function parseChangesFilters(params: { get(name: string): string | null }): ChangesUrlFilters {
  const number = (name: string, fallback: number) => {
    const value = Number(params.get(name));
    return Number.isInteger(value) && value >= 1 ? value : fallback;
  };
  return {
    entity: params.get("entity") ?? "",
    who: params.get("who") ?? "",
    from: params.get("from") ?? "",
    to: params.get("to") ?? "",
    page: number("page", 1),
    limit: number("limit", CHANGES_PAGE_SIZE),
  };
}

/**
 * The server's filters. The server's end date is inclusive of an instant, so a calendar day picked as "To" is advanced
 * by one day to include that whole day.
 */
export function changesApiFilters(filters: ChangesUrlFilters): Record<string, string | number> {
  const out: Record<string, string | number> = { page: filters.page, limit: filters.limit };
  if (filters.entity) out.entity_type = filters.entity;
  if (filters.who) out.actor_id = filters.who;
  if (filters.from) out.from = filters.from;
  if (filters.to) out.to = exclusiveEndDate(filters.to) ?? filters.to;
  return out;
}

export function entityLabel(entityType: string): string {
  return CHANGE_ENTITY_LABELS[entityType] ?? humanizeRegistryKey(entityType).replace(/granularity/gi, "feed");
}

export function actionLabel(action: string): string {
  return CHANGE_ACTION_LABELS[action] ?? humanizeRegistryKey(action);
}

export type ActorOption = { value: string; label: string };

/** The people seen in a set of changes, one option each, most recent first; the selected one is always kept. */
export function actorOptions(items: readonly RegistryChangeItem[], selected: string): ActorOption[] {
  const seen = new Map<string, string>();
  for (const item of items) {
    if (item.actor_id && !seen.has(item.actor_id)) seen.set(item.actor_id, `${item.actor_label} (${item.actor_role})`);
  }
  if (selected && !seen.has(selected)) seen.set(selected, CHANGES_COPY.filters.selectedPerson);
  return [...seen.entries()].map(([value, label]) => ({ value, label })).sort((left, right) => left.label.localeCompare(right.label));
}

/** A diff path in words: "default_form_granularity" reads "Default form feed"; nested paths keep their dots as arrows. */
export function fieldLabel(path: string): string {
  const words = ownerWords(path)
    .split(".")
    .map((part) => part.replace(/_/g, " ").trim())
    .filter(Boolean)
    .join(" › ");
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : path;
}

const OBJECT_ID = new RegExp("[a-f0-9]{24}", "gi");

/** A diff value for the Owner: ids read "A linked record", an absent side reads "None", engineering codes are said in words. */
export function ownerSnapshotValue(value: unknown): string {
  if (value === undefined) return CHANGES_COPY.drawer.none;
  return ownerWords(formatSnapshotValue(value)).replace(OBJECT_ID, CHANGES_COPY.drawer.linkedRecord);
}
