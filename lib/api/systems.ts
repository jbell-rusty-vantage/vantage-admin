"use client";
/**
 * Systems tab (doc 11b) reads and the Owner's locations edit. Server routes: `/api/v1/admin/systems/{locations,capacity}`
 * (Owner only; the proxy signs the actor). Responses are parsed into plain, fully-populated objects here so the
 * components never guess at a missing field. Server Service doc: `vantage-main-server/docs/knowledge/services/systems-capacity.md`.
 */
import { registryRequestJson } from "./registryRequest";

export type LocationAction = "install" | "open" | "copy";

export type SystemsLocation = {
  key: string;
  label: string;
  url: string;
  note: string | null;
  paths: string[];
  code_url: string | null;
  code_note: string | null;
  host_url: string | null;
  logs_url: string | null;
  action: LocationAction;
  editable: boolean;
};

export type SystemsLocations = {
  revision: number;
  updated_at: string | null;
  updated_by: string | null;
  locations: SystemsLocation[];
};

export type EditableLocationFields = Pick<
  SystemsLocation,
  "label" | "url" | "note" | "paths" | "code_url" | "code_note" | "host_url" | "logs_url"
>;

export type SystemsLocationsPatch = {
  revision: number;
  locations: Record<string, Partial<EditableLocationFields>>;
  reason?: string;
};

export type CapacityColour = "green" | "amber" | "red" | "unknown";

export type Runway = {
  rate_per_day: number;
  days_left: number | null;
  date: string | null;
  label: string;
  basis: "measured" | "estimate";
  points: number;
};

export type SyncLine = {
  last_write_at: string | null;
  pending: number;
  failed: number;
  stuck: { count: number; oldest_at: string | null };
};

export type DatabaseCapacity = {
  status: { colour: CapacityColour; reason: string };
  read_at: string | null;
  error: string | null;
  used_bytes: number | null;
  total_bytes: number | null;
  used_pct: number | null;
  breakdown: { business_bytes: number; oplog_bytes: number; oplog_reclaimable_bytes: number; system_bytes: number } | null;
  growth_per_day_bytes: number | null;
  growth_source: "disk" | "data" | null;
  until_90: Runway | null;
  until_full: Runway | null;
  caveat: string;
};

export type SheetCapacity = {
  workbook: "master_leads" | "master_booked";
  label: string;
  status: { colour: CapacityColour; reason: string };
  read_at: string | null;
  error: string | null;
  biggest_tab: { name: string; filled_rows: number; limit: number; warning: number; pct: number; growth_per_month: number } | null;
  cells: { used: number; cap: number; pct: number; growth_per_month: number } | null;
  until_new_workbook: (Runway & { trigger: "rows" | "cells" }) | null;
  until_cell_cap: Runway | null;
  sync: SyncLine | null;
  last_cancellation_at?: string | null;
};

export type SystemsCapacity = {
  database: DatabaseCapacity;
  sheets: SheetCapacity[];
  generated_at: string;
  refreshed: boolean;
};

type Raw = Record<string, unknown>;
const record = (value: unknown): Raw => (value && typeof value === "object" && !Array.isArray(value) ? (value as Raw) : {});
const text = (value: unknown): string => (typeof value === "string" ? value : "");
const maybeText = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value : null);
const num = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);
const count = (value: unknown): number => num(value) ?? 0;
const COLOURS: readonly CapacityColour[] = ["green", "amber", "red", "unknown"];
const ACTIONS: readonly LocationAction[] = ["install", "open", "copy"];

export function parseSystemsLocations(value: unknown): SystemsLocations {
  const raw = record(value);
  const rows = Array.isArray(raw.locations) ? raw.locations : [];
  return {
    revision: num(raw.revision) ?? 1,
    updated_at: maybeText(raw.updated_at),
    updated_by: maybeText(raw.updated_by),
    locations: rows.map((row) => {
      const r = record(row);
      const action = ACTIONS.includes(r.action as LocationAction) ? (r.action as LocationAction) : "open";
      return {
        key: text(r.key),
        label: text(r.label),
        url: text(r.url),
        note: maybeText(r.note),
        paths: Array.isArray(r.paths) ? r.paths.filter((path): path is string => typeof path === "string") : [],
        code_url: maybeText(r.code_url),
        code_note: maybeText(r.code_note),
        host_url: maybeText(r.host_url),
        logs_url: maybeText(r.logs_url),
        action,
        editable: r.editable === true,
      };
    }),
  };
}

function parseRunway(value: unknown): Runway | null {
  if (!value || typeof value !== "object") return null;
  const r = record(value);
  return {
    rate_per_day: count(r.rate_per_day),
    days_left: num(r.days_left),
    date: maybeText(r.date),
    label: text(r.label) || "not known",
    basis: r.basis === "measured" ? "measured" : "estimate",
    points: count(r.points),
  };
}

function parseStatus(value: unknown): { colour: CapacityColour; reason: string } {
  const r = record(value);
  return { colour: COLOURS.includes(r.colour as CapacityColour) ? (r.colour as CapacityColour) : "unknown", reason: text(r.reason) };
}

function parseSync(value: unknown): SyncLine | null {
  if (!value || typeof value !== "object") return null;
  const r = record(value);
  const stuck = record(r.stuck);
  return {
    last_write_at: maybeText(r.last_write_at),
    pending: count(r.pending),
    failed: count(r.failed),
    stuck: { count: count(stuck.count), oldest_at: maybeText(stuck.oldest_at) },
  };
}

function parseSheet(value: unknown): SheetCapacity {
  const r = record(value);
  const tab = r.biggest_tab ? record(r.biggest_tab) : null;
  const cells = r.cells ? record(r.cells) : null;
  const untilNew = parseRunway(r.until_new_workbook);
  const workbook = r.workbook === "master_booked" ? "master_booked" : "master_leads";
  return {
    workbook,
    label: text(r.label) || (workbook === "master_booked" ? "Master Booked" : "Master Leads"),
    status: parseStatus(r.status),
    read_at: maybeText(r.read_at),
    error: maybeText(r.error),
    biggest_tab: tab
      ? {
          name: text(tab.name),
          filled_rows: count(tab.filled_rows),
          limit: num(tab.limit) ?? 40_000,
          warning: num(tab.warning) ?? 30_000,
          pct: count(tab.pct),
          growth_per_month: count(tab.growth_per_month),
        }
      : null,
    cells: cells
      ? { used: count(cells.used), cap: num(cells.cap) ?? 10_000_000, pct: count(cells.pct), growth_per_month: count(cells.growth_per_month) }
      : null,
    until_new_workbook: untilNew ? { ...untilNew, trigger: record(r.until_new_workbook).trigger === "cells" ? "cells" : "rows" } : null,
    until_cell_cap: parseRunway(r.until_cell_cap),
    sync: parseSync(r.sync),
    ...(workbook === "master_booked" ? { last_cancellation_at: maybeText(r.last_cancellation_at) } : {}),
  };
}

export function parseSystemsCapacity(value: unknown): SystemsCapacity {
  const raw = record(value);
  const db = record(raw.database);
  const breakdown = db.breakdown ? record(db.breakdown) : null;
  return {
    database: {
      status: parseStatus(db.status),
      read_at: maybeText(db.read_at),
      error: maybeText(db.error),
      used_bytes: num(db.used_bytes),
      total_bytes: num(db.total_bytes),
      used_pct: num(db.used_pct),
      breakdown: breakdown
        ? {
            business_bytes: count(breakdown.business_bytes),
            oplog_bytes: count(breakdown.oplog_bytes),
            oplog_reclaimable_bytes: count(breakdown.oplog_reclaimable_bytes),
            system_bytes: count(breakdown.system_bytes),
          }
        : null,
      growth_per_day_bytes: num(db.growth_per_day_bytes),
      growth_source: db.growth_source === "data" ? "data" : db.growth_source === "disk" ? "disk" : null,
      until_90: parseRunway(db.until_90),
      until_full: parseRunway(db.until_full),
      caveat: text(db.caveat),
    },
    sheets: (Array.isArray(raw.sheets) ? raw.sheets : []).map(parseSheet),
    generated_at: text(raw.generated_at),
    refreshed: raw.refreshed === true,
  };
}

const LOCATIONS_PATH = "api/v1/admin/systems/locations";
const CAPACITY_PATH = "api/v1/admin/systems/capacity";

export async function fetchSystemsLocations(): Promise<SystemsLocations> {
  return parseSystemsLocations(await registryRequestJson<unknown>(LOCATIONS_PATH));
}

export async function patchSystemsLocations(patch: SystemsLocationsPatch): Promise<SystemsLocations> {
  return parseSystemsLocations(
    await registryRequestJson<unknown>(LOCATIONS_PATH, { method: "PATCH", body: JSON.stringify(patch) }),
  );
}

export async function fetchSystemsCapacity(options: { refresh?: boolean } = {}): Promise<SystemsCapacity> {
  return parseSystemsCapacity(await registryRequestJson<unknown>(options.refresh ? `${CAPACITY_PATH}?refresh=1` : CAPACITY_PATH));
}
