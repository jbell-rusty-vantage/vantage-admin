/**
 * Systems tab mock (doc 11b, A4): the locations list and the capacity cards with 11b's seed numbers, so `/systems`
 * renders in the BFF mock mode (`OUTREACH_DESK_MOCK`, never on Vercel production) and in e2e without a server.
 * Owner only, like the server. The locations edit keeps state per process so the form can be clicked through;
 * links must be `https://` and the key set is fixed, as on the server.
 */
import type { SystemsCapacity, SystemsLocation, SystemsLocations } from "./systems";

const vercel = (project: string) => `https://vercel.com/vantage-4d3db9ef/${project}`;
const STORE = "https://chromewebstore.google.com/detail/granot-sync/mnfinkiglgagkfokimdnpkhlgemjnhfd";
const row = (key: string, fields: Partial<SystemsLocation> & Pick<SystemsLocation, "label" | "url">): SystemsLocation => ({
  key,
  note: null,
  paths: [],
  code_url: null,
  code_note: null,
  host_url: null,
  logs_url: null,
  action: "open",
  editable: true,
  ...fields,
});

/** 11b "The list", seed values verified 2026-10-06. */
export function systemsLocationsFixture(): SystemsLocations {
  return {
    revision: 1,
    updated_at: "2026-10-07T13:00:00.000Z",
    updated_by: null,
    locations: [
      row("extension", {
        label: "Granot Sync extension",
        url: STORE,
        action: "install",
        code_url: "https://github.com/Overton77/vantage-movers-browser-extensions",
        code_note: "personal account",
        host_url: STORE,
      }),
      row("main_site", {
        label: "Main site",
        url: "https://www.vantagehomemovers.com",
        code_url: "https://github.com/jbell-rusty-vantage/vantage-movers-clients/tree/main/apps/main-site",
        host_url: vercel("vantage-movers-clients-main-site"),
      }),
      row("partner_pages", {
        label: "Partner landing pages",
        url: "https://vantagemoves.com",
        paths: ["/top10", "/tbm", "/tbm-primes", "/getmovers"],
        code_url: "https://github.com/jbell-rusty-vantage/vantage-movers-clients/tree/main/apps/clients",
        host_url: vercel("vantage-movers-clients"),
      }),
      row("wordpress", { label: "Old partner site", url: "https://vantagequotes.com", note: "WordPress. Partner paths moved to vantagemoves.com" }),
      row("dashboard", {
        label: "Dashboard",
        url: "https://vantage-admin-rho.vercel.app",
        code_url: "https://github.com/jbell-rusty-vantage/vantage-admin",
        host_url: vercel("vantage-admin"),
      }),
      row("server", {
        label: "Server (API)",
        url: "https://vantage-movers-main-server.vercel.app",
        code_url: "https://github.com/jbell-rusty-vantage/vantage-movers-server",
        host_url: vercel("vantage-movers-main-server"),
        logs_url: `${vercel("vantage-movers-main-server")}/logs`,
      }),
      row("mcp", {
        label: "MCP server",
        url: "https://vantage-movers-mcp.vercel.app/api/mcp",
        action: "copy",
        note: "Copy only. It asks for a key in a browser.",
        code_url: "https://github.com/jbell-rusty-vantage/vantage-movers-mcp",
        host_url: vercel("vantage-movers-mcp"),
      }),
      row("master_leads", {
        label: "Master Leads",
        url: "https://docs.google.com/spreadsheets/d/14wywiXJVjQZ-3mlZkJLDm1D7FDuI30oao0iKQV2eMPI",
        note: "Google Sheets",
        editable: false,
      }),
      row("master_booked", {
        label: "Master Booked",
        url: "https://docs.google.com/spreadsheets/d/1dpE1ZdEgO9cWejysQ9OJ4PFas2iuYMGNOg3pdGzHRHs",
        note: "Google Sheets",
        editable: false,
      }),
    ],
  };
}

/** 11b "The page" and the seed tables: day one, 3 of 7 days measured. `now` sets the sync line's last write. */
export function systemsCapacityFixture(now: Date = new Date("2026-10-07T13:14:00.000Z")): SystemsCapacity {
  const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();
  const estimate = (label: string, days: number | null, rate: number, date: string | null = null) => ({
    rate_per_day: rate,
    days_left: days,
    date,
    label,
    basis: "estimate" as const,
    points: 3,
  });
  return {
    generated_at: now.toISOString(),
    refreshed: false,
    database: {
      status: { colour: "green", reason: "65.1% of the disk is used, and 90% is more than 90 days away." },
      read_at: now.toISOString(),
      error: null,
      used_bytes: 9_018_167_296,
      total_bytes: 13_853_786_112,
      used_pct: 65.1,
      breakdown: { business_bytes: 547_000_000, oplog_bytes: 5_985_000_000, oplog_reclaimable_bytes: 4_947_000_000, system_bytes: 2_486_167_296 },
      growth_per_day_bytes: 4_000_000,
      growth_source: "disk",
      until_90: estimate("about 2 years 7 months (≈ May 2029)", 943, 4_000_000, "2029-05-08"),
      until_full: estimate("about 3 years 7 months (≈ May 2030)", 1_308, 4_000_000, "2030-05-07"),
      caveat:
        "Atlas tier and storage auto-scaling are not known yet. If auto-scaling is on, reaching 90% grows the disk and the bill instead of failing.",
    },
    sheets: [
      {
        workbook: "master_leads",
        label: "Master Leads",
        status: { colour: "red", reason: "3 Sheet Sync jobs have been stuck since Jul 29. Their rows may be missing from the sheet." },
        read_at: now.toISOString(),
        error: null,
        biggest_tab: { name: "Forms", filled_rows: 6_724, limit: 40_000, warning: 30_000, pct: 16.8, growth_per_month: 1_300 },
        cells: { used: 363_022, cap: 10_000_000, pct: 3.6, growth_per_month: 45_000 },
        until_new_workbook: { ...estimate("about 2 years 1 month (≈ Nov 2028)", 778, 42.7, "2028-11-23"), trigger: "rows" },
        until_cell_cap: estimate("more than 15 years", null, 1_478),
        sync: { last_write_at: minutesAgo(2), pending: 1, failed: 0, stuck: { count: 3, oldest_at: "2026-07-29T18:45:43.139Z" } },
      },
      {
        workbook: "master_booked",
        label: "Master Booked",
        status: { colour: "green", reason: "Well under 30,000 rows and 3 million cells, and the sync queue is clean." },
        read_at: now.toISOString(),
        error: null,
        biggest_tab: { name: "Booked Deals", filled_rows: 883, limit: 40_000, warning: 30_000, pct: 2.2, growth_per_month: 185 },
        cells: { used: 72_312, cap: 10_000_000, pct: 0.7, growth_per_month: 4_440 },
        until_new_workbook: { ...estimate("more than 15 years", null, 6.1), trigger: "rows" },
        until_cell_cap: estimate("more than 15 years", null, 146),
        sync: { last_write_at: minutesAgo(2), pending: 0, failed: 0, stuck: { count: 0, oldest_at: null } },
        last_cancellation_at: "2026-08-20T04:48:56.596Z",
      },
    ],
  };
}

const STATE_KEY = Symbol.for("vantage-admin.systems-mock-state");
type GlobalWithState = typeof globalThis & { [STATE_KEY]?: SystemsLocations };

function mockLocations(): SystemsLocations {
  const holder = globalThis as GlobalWithState;
  holder[STATE_KEY] ??= systemsLocationsFixture();
  return holder[STATE_KEY];
}

export function resetSystemsMockState(): void {
  (globalThis as GlobalWithState)[STATE_KEY] = systemsLocationsFixture();
}

const LINK_FIELDS = ["url", "code_url", "host_url", "logs_url"] as const;
const EDIT_FIELDS = new Set(["label", "url", "note", "paths", "code_url", "code_note", "host_url", "logs_url"]);
const refuse = (status: number, error: string) => ({ status, body: { ok: false, error } });

function applyPatch(body: unknown): { status: number; body: unknown } {
  const current = mockLocations();
  const patch = (body && typeof body === "object" ? body : {}) as { revision?: unknown; locations?: Record<string, Record<string, unknown>> };
  if (patch.revision !== current.revision) return refuse(409, "Someone else saved the locations first. Reload and try again.");
  const next = structuredClone(current);
  for (const [key, fields] of Object.entries(patch.locations ?? {})) {
    const target = next.locations.find((location) => location.key === key && location.editable);
    if (!target) return refuse(400, "Only the listed locations can be changed.");
    for (const [field, value] of Object.entries(fields ?? {})) {
      if (!EDIT_FIELDS.has(field)) return refuse(400, "Only the listed locations can be changed.");
      if ((LINK_FIELDS as readonly string[]).includes(field) && value !== null && value !== "" && !/^https:\/\/[^\s/]+/.test(String(value))) {
        return refuse(400, `${key} › ${field}: Links must start with https://`);
      }
      if (field === "label" && !String(value ?? "").trim()) return refuse(400, `${key} › label: Each row needs a label.`);
      (target as Record<string, unknown>)[field] = value === "" ? null : value;
    }
  }
  next.revision += 1;
  next.updated_at = new Date().toISOString();
  next.updated_by = "owner (mock)";
  (globalThis as GlobalWithState)[STATE_KEY] = next;
  return { status: 200, body: { ok: true, data: next } };
}

const LOCATIONS = /^\/?api\/v1\/admin\/systems\/locations$/;
const CAPACITY = /^\/?api\/v1\/admin\/systems\/capacity$/;

/** The mock answer for a Systems call, or null when the path is not a Systems route. */
export function mockSystemsResponse(input: { role: string; method: string; path: string; query?: string; body?: unknown }) {
  const isLocations = LOCATIONS.test(input.path);
  if (!isLocations && !CAPACITY.test(input.path)) return null;
  if (input.role !== "owner") return refuse(403, "Systems is for the Owner only.");
  if (isLocations && input.method === "GET") return { status: 200, body: { ok: true, data: mockLocations() } };
  if (isLocations && input.method === "PATCH") return applyPatch(input.body);
  if (!isLocations && input.method === "GET") {
    const refreshed = new URLSearchParams(input.query ?? "").get("refresh") === "1";
    return { status: 200, body: { ok: true, data: { ...systemsCapacityFixture(new Date()), refreshed } } };
  }
  return refuse(405, "Not supported.");
}
