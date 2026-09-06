import type { FilterConfig } from "@/components/operational/operational-configs";

export const FILTER_GROUP_IDS = ["find", "status", "attribution", "record"] as const;
export type FilterGroupId = (typeof FILTER_GROUP_IDS)[number];

export const FIND_URL_KEYS = ["q", "from", "to", "sort", "direction", "date_field"] as const;

const STATUS_FILTER_KEYS = ["booked", "cancelled", "leadless", "past_move_date", "no_sync"] as const;
const ATTRIBUTION_FILTER_KEYS = [
  "source_granularity_key",
  "source",
  "source_company",
  "receiver_agent",
  "agent",
  "merchant",
] as const;
const RECORD_FILTER_KEYS = [
  "name",
  "phone",
  "phone_number",
  "email",
  "ref_no",
  "job_no",
  "move_size",
  "local",
  "reason",
  "cancelled_by",
  "customer_name",
  "customer_phone",
  "active",
  "role",
] as const;

const FILTER_CONFIG_GROUP_BY_KEY: Record<string, Exclude<FilterGroupId, "find">> = {
  ...Object.fromEntries(STATUS_FILTER_KEYS.map((key) => [key, "status"])),
  ...Object.fromEntries(ATTRIBUTION_FILTER_KEYS.map((key) => [key, "attribution"])),
  ...Object.fromEntries(RECORD_FILTER_KEYS.map((key) => [key, "record"])),
};

export function filterGroupForKey(key: string): Exclude<FilterGroupId, "find"> {
  const group = FILTER_CONFIG_GROUP_BY_KEY[key];
  if (!group) {
    throw new Error(`Unknown operational filter key has no group: ${key}`);
  }
  return group;
}

export function filtersInGroup(filters: readonly FilterConfig[], group: FilterGroupId): FilterConfig[] {
  if (group === "find") {
    return [];
  }
  return filters.filter((filter) => filterGroupForKey(filter.key) === group);
}

export function visibleFilterGroups(filters: readonly FilterConfig[]): FilterGroupId[] {
  const present = new Set(filters.map((filter) => filterGroupForKey(filter.key)));
  const groups: FilterGroupId[] = ["find"];
  if (present.has("status")) {
    groups.push("status");
  }
  if (present.has("attribution")) {
    groups.push("attribution");
  }
  if (present.has("record")) {
    groups.push("record");
  }
  return groups;
}

function hasUrlValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== "";
}

export function filterGroupHasActiveValue(
  group: FilterGroupId,
  filters: readonly FilterConfig[],
  url: Record<string, unknown>,
): boolean {
  if (group === "find") {
    return hasUrlValue(url.q) || hasUrlValue(url.from) || hasUrlValue(url.to);
  }
  return filtersInGroup(filters, group).some((filter) => hasUrlValue(url[filter.key]));
}

export function filterGroupStartsOpen(group: FilterGroupId, hasActiveMember: boolean): boolean {
  return group === "find" || group === "status" || hasActiveMember;
}
