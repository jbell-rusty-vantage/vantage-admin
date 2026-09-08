import type { DailyOperationsPanelLane } from "./dailyOperations";

/**
 * Colour per Daily Operations Event kind.
 *
 * Tones are static Tailwind class bundles so the compiler sees every class.
 * Each kind in the closed catalog has a default tone; each lane has a default
 * tone for panel headers. The Owner may override a kind's tone; overrides are
 * kept in `localStorage` under `DAILY_KIND_COLORS_STORAGE_KEY` and never on
 * the URL.
 */

export const DAILY_KIND_COLORS_STORAGE_KEY = "vantage-admin-daily-kind-colors";

export const DAILY_OPERATIONS_TONES = [
  "blue",
  "sky",
  "indigo",
  "violet",
  "teal",
  "emerald",
  "lime",
  "amber",
  "orange",
  "rose",
  "red",
  "slate",
] as const;

export type DailyOperationsTone = (typeof DAILY_OPERATIONS_TONES)[number];

export type DailyOperationsToneClasses = {
  /** Owner-facing name in the Colours panel. */
  label: string;
  /** Solid dot / left rail. */
  dot: string;
  /** Left rail border colour on a card. */
  rail: string;
  /** Top edge border colour on a panel. */
  edge: string;
  /** Kind badge on a card. */
  badge: string;
  /** Soft background for a panel header accent or a swatch. */
  soft: string;
  /** Text colour for a coloured label. */
  text: string;
  /** Ring for a selected swatch. */
  ring: string;
};

export const DAILY_OPERATIONS_TONE_CLASSES: Record<DailyOperationsTone, DailyOperationsToneClasses> = {
  blue: {
    label: "Trust blue",
    dot: "bg-trust-blue",
    rail: "border-l-trust-blue",
    edge: "border-t-trust-blue",
    badge: "bg-trust-blue/10 text-trust-blue",
    soft: "bg-trust-blue/10",
    text: "text-trust-blue",
    ring: "ring-trust-blue",
  },
  sky: {
    label: "Sky",
    dot: "bg-sky-500",
    rail: "border-l-sky-500",
    edge: "border-t-sky-500",
    badge: "bg-sky-500/10 text-sky-700",
    soft: "bg-sky-500/10",
    text: "text-sky-700",
    ring: "ring-sky-500",
  },
  indigo: {
    label: "Indigo",
    dot: "bg-indigo-500",
    rail: "border-l-indigo-500",
    edge: "border-t-indigo-500",
    badge: "bg-indigo-500/10 text-indigo-700",
    soft: "bg-indigo-500/10",
    text: "text-indigo-700",
    ring: "ring-indigo-500",
  },
  violet: {
    label: "Violet",
    dot: "bg-violet-500",
    rail: "border-l-violet-500",
    edge: "border-t-violet-500",
    badge: "bg-violet-500/10 text-violet-700",
    soft: "bg-violet-500/10",
    text: "text-violet-700",
    ring: "ring-violet-500",
  },
  teal: {
    label: "Teal",
    dot: "bg-teal-500",
    rail: "border-l-teal-500",
    edge: "border-t-teal-500",
    badge: "bg-teal-500/10 text-teal-700",
    soft: "bg-teal-500/10",
    text: "text-teal-700",
    ring: "ring-teal-500",
  },
  emerald: {
    label: "Emerald",
    dot: "bg-emerald-500",
    rail: "border-l-emerald-500",
    edge: "border-t-emerald-500",
    badge: "bg-emerald-500/10 text-emerald-700",
    soft: "bg-emerald-500/10",
    text: "text-emerald-700",
    ring: "ring-emerald-500",
  },
  lime: {
    label: "Lime",
    dot: "bg-lime-500",
    rail: "border-l-lime-500",
    edge: "border-t-lime-500",
    badge: "bg-lime-500/15 text-lime-800",
    soft: "bg-lime-500/15",
    text: "text-lime-800",
    ring: "ring-lime-500",
  },
  amber: {
    label: "Amber",
    dot: "bg-amber-500",
    rail: "border-l-amber-500",
    edge: "border-t-amber-500",
    badge: "bg-amber-500/10 text-amber-700",
    soft: "bg-amber-500/10",
    text: "text-amber-700",
    ring: "ring-amber-500",
  },
  orange: {
    label: "Orange",
    dot: "bg-orange-500",
    rail: "border-l-orange-500",
    edge: "border-t-orange-500",
    badge: "bg-orange-500/10 text-orange-700",
    soft: "bg-orange-500/10",
    text: "text-orange-700",
    ring: "ring-orange-500",
  },
  rose: {
    label: "Rose",
    dot: "bg-rose-500",
    rail: "border-l-rose-500",
    edge: "border-t-rose-500",
    badge: "bg-rose-500/10 text-rose-700",
    soft: "bg-rose-500/10",
    text: "text-rose-700",
    ring: "ring-rose-500",
  },
  red: {
    label: "Red",
    dot: "bg-red-600",
    rail: "border-l-red-600",
    edge: "border-t-red-600",
    badge: "bg-red-600/10 text-red-700",
    soft: "bg-red-600/10",
    text: "text-red-700",
    ring: "ring-red-600",
  },
  slate: {
    label: "Slate",
    dot: "bg-slate-400",
    rail: "border-l-slate-400",
    edge: "border-t-slate-400",
    badge: "bg-slate-500/10 text-slate-600",
    soft: "bg-slate-500/10",
    text: "text-slate-600",
    ring: "ring-slate-400",
  },
};

/** Closed catalog of Daily Operations Event kinds (mirrors server `kinds.ts`). */
export const DAILY_OPERATIONS_KINDS = [
  "form_lead.created",
  "form_lead.duplicate",
  "call_lead.created",
  "call_lead.duplicate",
  "call_lead.unmatched",
  "granot.lead_created",
  "granot.priority_updated",
  "granot.booked",
  "granot.release",
  "granot.minted",
  "granot.linked",
  "granot.observed",
  "granot.pending_match",
  "granot.unmatched",
  "intake.opened",
  "intake.refreshed",
  "text.deferred",
  "text.sent",
  "text.skipped",
  "text.failed",
  "booking.created",
  "booking.employee_pending",
  "cancellation.created",
  "sheet_sync.completed",
  "sheet_sync.failed",
  "exception.zip_missing",
  "exception.crm_failed",
  "exception.dead_letter",
  "exception.adoption_conflict",
] as const;

export type DailyOperationsKind = (typeof DAILY_OPERATIONS_KINDS)[number];

export const DAILY_OPERATIONS_KIND_LANES: Record<DailyOperationsKind, DailyOperationsPanelLane> = {
  "form_lead.created": "lead",
  "form_lead.duplicate": "lead",
  "call_lead.created": "lead",
  "call_lead.duplicate": "lead",
  "call_lead.unmatched": "lead",
  "granot.lead_created": "granot",
  "granot.priority_updated": "granot",
  "granot.booked": "granot",
  "granot.release": "granot",
  "granot.minted": "granot",
  "granot.linked": "granot",
  "granot.observed": "granot",
  "granot.pending_match": "granot",
  "granot.unmatched": "granot",
  "intake.opened": "intake",
  "intake.refreshed": "intake",
  "text.deferred": "text",
  "text.sent": "text",
  "text.skipped": "text",
  "text.failed": "text",
  "booking.created": "booking",
  "booking.employee_pending": "booking",
  "cancellation.created": "cancellation",
  "sheet_sync.completed": "sheet_sync",
  "sheet_sync.failed": "sheet_sync",
  "exception.zip_missing": "exception",
  "exception.crm_failed": "exception",
  "exception.dead_letter": "exception",
  "exception.adoption_conflict": "exception",
};

export const DAILY_OPERATIONS_LANE_TONES: Record<DailyOperationsPanelLane, DailyOperationsTone> = {
  lead: "blue",
  text: "violet",
  granot: "teal",
  intake: "amber",
  booking: "emerald",
  cancellation: "rose",
  exception: "red",
  sheet_sync: "slate",
};

/**
 * Default tone per kind. Lanes share a family; outcomes that need a second
 * look (duplicate, unmatched, held, skipped, failed, release, dead letter)
 * step away from the lane colour so they read at a glance.
 */
export const DAILY_OPERATIONS_KIND_TONES: Record<DailyOperationsKind, DailyOperationsTone> = {
  "form_lead.created": "blue",
  "form_lead.duplicate": "slate",
  "call_lead.created": "sky",
  "call_lead.duplicate": "slate",
  "call_lead.unmatched": "orange",
  "granot.lead_created": "teal",
  "granot.priority_updated": "slate",
  "granot.booked": "emerald",
  "granot.release": "orange",
  "granot.minted": "teal",
  "granot.linked": "indigo",
  "granot.observed": "slate",
  "granot.pending_match": "amber",
  "granot.unmatched": "orange",
  "intake.opened": "amber",
  "intake.refreshed": "amber",
  "text.deferred": "amber",
  "text.sent": "violet",
  "text.skipped": "slate",
  "text.failed": "red",
  "booking.created": "emerald",
  "booking.employee_pending": "lime",
  "cancellation.created": "rose",
  "sheet_sync.completed": "slate",
  "sheet_sync.failed": "red",
  "exception.zip_missing": "amber",
  "exception.crm_failed": "red",
  "exception.dead_letter": "red",
  "exception.adoption_conflict": "orange",
};

export type DailyOperationsKindToneOverrides = Partial<Record<string, DailyOperationsTone>>;

export function isDailyOperationsTone(value: unknown): value is DailyOperationsTone {
  return typeof value === "string" && (DAILY_OPERATIONS_TONES as readonly string[]).includes(value);
}

export function isDailyOperationsKind(value: unknown): value is DailyOperationsKind {
  return typeof value === "string" && (DAILY_OPERATIONS_KINDS as readonly string[]).includes(value);
}

export function laneToneFor(lane: string | null | undefined): DailyOperationsTone {
  if (lane && lane in DAILY_OPERATIONS_LANE_TONES) {
    return DAILY_OPERATIONS_LANE_TONES[lane as DailyOperationsPanelLane];
  }
  return "slate";
}

/** Resolved tone for a kind: Owner override → catalog default → lane default → slate. */
export function kindToneFor(
  kind: string,
  overrides: DailyOperationsKindToneOverrides | null | undefined,
  lane?: string | null,
): DailyOperationsTone {
  const override = overrides?.[kind];
  if (isDailyOperationsTone(override)) {
    return override;
  }
  if (isDailyOperationsKind(kind)) {
    return DAILY_OPERATIONS_KIND_TONES[kind];
  }
  return laneToneFor(lane ?? kind.split(".")[0]);
}

export function toneClasses(tone: DailyOperationsTone): DailyOperationsToneClasses {
  return DAILY_OPERATIONS_TONE_CLASSES[tone];
}

export function kindsForLane(lane: DailyOperationsPanelLane): DailyOperationsKind[] {
  return DAILY_OPERATIONS_KINDS.filter((kind) => DAILY_OPERATIONS_KIND_LANES[kind] === lane);
}

export function readKindToneOverrides(
  storage: Pick<Storage, "getItem"> | null | undefined,
): DailyOperationsKindToneOverrides {
  if (!storage) {
    return {};
  }
  try {
    const raw = storage.getItem(DAILY_KIND_COLORS_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as unknown;
    return sanitizeKindToneOverrides(parsed);
  } catch {
    return {};
  }
}

export function sanitizeKindToneOverrides(value: unknown): DailyOperationsKindToneOverrides {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const next: DailyOperationsKindToneOverrides = {};
  for (const [kind, tone] of Object.entries(value as Record<string, unknown>)) {
    if (isDailyOperationsKind(kind) && isDailyOperationsTone(tone) && DAILY_OPERATIONS_KIND_TONES[kind] !== tone) {
      next[kind] = tone;
    }
  }
  return next;
}

export function writeKindToneOverrides(
  storage: Pick<Storage, "setItem" | "removeItem"> | null | undefined,
  overrides: DailyOperationsKindToneOverrides,
): void {
  if (!storage) {
    return;
  }
  try {
    const clean = sanitizeKindToneOverrides(overrides);
    if (Object.keys(clean).length === 0) {
      storage.removeItem(DAILY_KIND_COLORS_STORAGE_KEY);
      return;
    }
    storage.setItem(DAILY_KIND_COLORS_STORAGE_KEY, JSON.stringify(clean));
  } catch {
    // Ignore quota / private-mode failures.
  }
}

/** Returns the next override map after the Owner picks a tone for a kind. */
export function withKindTone(
  overrides: DailyOperationsKindToneOverrides,
  kind: DailyOperationsKind,
  tone: DailyOperationsTone,
): DailyOperationsKindToneOverrides {
  const next: DailyOperationsKindToneOverrides = { ...overrides };
  if (DAILY_OPERATIONS_KIND_TONES[kind] === tone) {
    delete next[kind];
  } else {
    next[kind] = tone;
  }
  return next;
}
