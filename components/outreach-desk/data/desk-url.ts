/**
 * The Outreach Desk URL (IMPL-02), pure. `/outreach-desk?view=` picks the frame:
 * - `team` (Owner/Manager default), `my` (Rep default; Owner/Manager may add `agent=<id>` to inspect a rep),
 *   `activity`, `settings`;
 * - Owner only: `numbers` (All Numbers: `show=waiting` for "Waiting on us", `q`, and `number=<id>` for the open
 *   Number) and `accounts` (RingCentral Accounts, no keys).
 * `lead=<subject_id>` is the selected Lead. Every other key belongs to one view's filters and is kept only for that
 * view (`VIEW_KEYS`), so a link from another view or an old Sales Intelligence link never leaks state.
 *
 * The role here only shapes the URL (which frames exist for whom, the default frame). It is never authorization:
 * the server's capabilities and its 403s are the authority, and the edge guard and layout check the session.
 */
import type { OutreachDeskRole } from "@/server/models/adminRoles";

export const DESK_PATH = "/outreach-desk";
export const DESK_VIEWS = ["team", "my", "activity", "settings", "numbers", "accounts"] as const;
export type DeskView = (typeof DESK_VIEWS)[number];

const VIEWS_BY_ROLE: Record<OutreachDeskRole, readonly DeskView[]> = {
  owner: ["team", "my", "activity", "settings", "numbers", "accounts"],
  manager: ["team", "my", "activity", "settings"],
  rep: ["my", "activity", "settings"],
};

export function deskViewsFor(role: OutreachDeskRole): readonly DeskView[] {
  return VIEWS_BY_ROLE[role];
}

/**
 * The frames the sidebar lists: the role's frames, narrowed to the server's `permitted_views` once capabilities
 * have answered (null while they load or fail, when the role's frames stand).
 */
export function deskNavViews(role: OutreachDeskRole, permitted: readonly string[] | null): readonly DeskView[] {
  if (!permitted) return VIEWS_BY_ROLE[role];
  return VIEWS_BY_ROLE[role].filter((view) => permitted.includes(view));
}

export function defaultDeskView(role: OutreachDeskRole): DeskView {
  return role === "rep" ? "my" : "team";
}

const OBJECT_ID = /^[a-f\d]{24}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const WORKFLOWS = ["all", "new", "quoted", "discretion", "none"] as const;
const STATES = ["needs_contact", "all_active"] as const;
const SORTS = ["urgency", "lead_received", "last_interaction"] as const;
const DIRECTIONS = ["asc", "desc"] as const;
const MOVE_UNKNOWN = ["include", "exclude", "only"] as const;
/** Move-date presets (SPECIFICATION §7); the dates are resolved from the server's business date at request time. */
export const MOVE_PRESETS = ["upcoming", "today", "next7", "past", "unknown"] as const;
export type MovePreset = (typeof MOVE_PRESETS)[number];

/** One query key the desk owns: its name and how a raw value is accepted (null drops it). */
type KeySpec = { key: string; read: (value: string, role: OutreachDeskRole) => string | null };

const oneOf = (values: readonly string[]) => (value: string) => (values.includes(value) ? value : null);
const text = (max: number) => (value: string) => {
  const trimmed = value.trim();
  return trimmed && trimmed.length <= max ? trimmed : null;
};
const objectId = (value: string) => (OBJECT_ID.test(value.toLowerCase()) ? value.toLowerCase() : null);
const day = (value: string) => (DAY.test(value) ? value : null);
const coordinatorOnly = (read: KeySpec["read"]): KeySpec["read"] => (value, role) => (role === "rep" ? null : read(value, role));

/** The queue filters a view carries (CONTRACTS "GET /queue"; the server re-validates every one). */
const QUEUE_KEYS: KeySpec[] = [
  { key: "q", read: text(100) },
  { key: "priority", read: (value) => (value === "unknown" || /^\d{1,3}$/.test(value) ? value : null) },
  { key: "workflow", read: oneOf(WORKFLOWS) },
  { key: "state", read: oneOf(STATES) },
  { key: "sort", read: oneOf(SORTS) },
  { key: "direction", read: oneOf(DIRECTIONS) },
  { key: "move", read: oneOf(MOVE_PRESETS) },
  { key: "move_from", read: day },
  { key: "move_to", read: day },
  { key: "move_unknown", read: oneOf(MOVE_UNKNOWN) },
];

const VIEW_KEYS: Record<DeskView, KeySpec[]> = {
  team: [
    { key: "day", read: day },
    { key: "agent", read: objectId },
    { key: "unassigned", read: (value) => (value === "true" ? value : null) },
    ...QUEUE_KEYS,
    { key: "lead", read: objectId },
  ],
  my: [{ key: "agent", read: coordinatorOnly(objectId) }, { key: "day", read: day }, ...QUEUE_KEYS, { key: "lead", read: objectId }],
  activity: [
    { key: "agent", read: coordinatorOnly(objectId) },
    { key: "unassigned", read: coordinatorOnly((value) => (value === "true" ? value : null)) },
    { key: "q", read: text(100) },
    { key: "lead", read: objectId },
  ],
  settings: [{ key: "section", read: text(40) }],
  numbers: [
    { key: "show", read: oneOf(["waiting"]) },
    { key: "q", read: text(100) },
    { key: "number", read: objectId },
  ],
  accounts: [],
};

export function parseDeskView(params: URLSearchParams, role: OutreachDeskRole): DeskView {
  const requested = params.get("view");
  const views = deskViewsFor(role);
  return (views as readonly string[]).includes(requested ?? "") ? (requested as DeskView) : defaultDeskView(role);
}

/**
 * The canonical query for any incoming query and role (idempotent). `view` is always written, first, so the frame is
 * explicit in every link. Mutually exclusive filters (an individual rep and Unassigned) keep the individual rep.
 */
export function canonicalDeskQuery(params: URLSearchParams, role: OutreachDeskRole): URLSearchParams {
  const view = parseDeskView(params, role);
  const out = new URLSearchParams({ view });
  for (const spec of VIEW_KEYS[view]) {
    const raw = params.get(spec.key);
    if (raw === null) continue;
    const value = spec.read(raw, role);
    if (value !== null) out.set(spec.key, value);
  }
  if (out.has("agent") && out.has("unassigned")) out.delete("unassigned");
  return out;
}

export function canonicalDeskHref(params: URLSearchParams, role: OutreachDeskRole): string {
  return `${DESK_PATH}?${canonicalDeskQuery(params, role).toString()}`;
}

function toParams(searchParams: Record<string, string | string[] | undefined>): URLSearchParams {
  const incoming = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) incoming.append(key, item);
  }
  return incoming;
}

export type DeskRouteDecision = { kind: "render"; view: DeskView } | { kind: "redirect"; href: string };

/** The page's decision: render the canonical URL as is, or redirect to it (a non-canonical or foreign link). */
export function deskRouteDecision(
  searchParams: Record<string, string | string[] | undefined>,
  role: OutreachDeskRole,
): DeskRouteDecision {
  const incoming = toParams(searchParams);
  const canonical = canonicalDeskQuery(incoming, role);
  if (canonical.toString() === incoming.toString()) return { kind: "render", view: parseDeskView(canonical, role) };
  return { kind: "redirect", href: `${DESK_PATH}?${canonical.toString()}` };
}

/** A link to another frame: only `view` (plus an optional inspected rep and selected Lead) carries over. */
export function deskViewHref(view: DeskView, keep?: { agent?: string | null; lead?: string | null }): string {
  const params = new URLSearchParams({ view });
  if (keep?.agent) params.set("agent", keep.agent);
  if (keep?.lead) params.set("lead", keep.lead);
  return `${DESK_PATH}?${params.toString()}`;
}

/**
 * Where an old `/sales-intelligence` (or `/sales-intelligence/legacy`) link goes (IMPL-02, permanent): Accounts
 * (`view=reps` or `view=accounts`) opens `?view=accounts`; a link that names a Number (`number=`) or a search (`q=`)
 * opens All Numbers with them; anything else (the bare page, an old Outreach, Attention, Closed, Overview, Coverage or
 * Guide link, old Numbers filters) opens the desk's default view for the viewer. Old OutreachRecord ids are never mapped.
 */
export function legacySalesIntelligenceHref(searchParams: Record<string, string | string[] | undefined>): string {
  const incoming = toParams(searchParams);
  const view = incoming.get("view");
  if (view === "reps" || view === "accounts") return deskViewHref("accounts");
  const out = new URLSearchParams({ view: "numbers" });
  for (const spec of VIEW_KEYS.numbers) {
    if (spec.key === "show") continue;
    const raw = incoming.get(spec.key);
    const value = raw === null ? null : spec.read(raw, "owner");
    if (value !== null) out.set(spec.key, value);
  }
  return [...out.keys()].length > 1 ? `${DESK_PATH}?${out.toString()}` : DESK_PATH;
}
