/**
 * UI1-TL: the timeline event registry (UI-0 §2.6, UX13). One entry per server `kind`: its icon (UI-0 §7.3), its filter
 * group, an optional detail line and action, and whether the kind is routine by default. The title and description are
 * always the server's. A kind with no entry renders through `GENERIC_KIND`: the `Dot` icon, the server's group, no
 * detail, and it never throws.
 *
 * `source` records why an entry exists (TL-AUDIT §5): `fixture` (the 23 kinds the contracts show), `server` (the 11 kinds
 * `TIMELINE_KIND_ORDER` can emit that no fixture shows), `s11-tl` (the proposed A1–A6 kinds, `pending` until S11-TL is
 * captured) and `later` (UI-0 §7.3 kinds a later spec adds). Pending kinds are never sent in `kinds[]`: the server
 * answers 400 to a kind it doesn't know (S4 CONTRACT "Query").
 *
 * `routineDefault` documents the server's rule; the row always follows the item's own `routine` boolean (UI-0 §2.1).
 */
import {
  AlarmClockOff, Archive, ArrowUpDown, BadgeCheck, Ban, BookCheck, CalendarCheck, CalendarClock, CalendarPlus, CalendarX, CircleAlert,
  CircleCheck, CircleDollarSign, CirclePause, CircleX, ClipboardCheck, CopyPlus, Dot, Eye, FilePenLine, FileX, Flag, Gauge, Hourglass,
  Inbox, Link, MessageSquareCheck, MessageSquareReply, MessageSquareText, Mic, Pencil, Phone, PhoneCall, PhoneIncoming, PhoneMissed, PhoneOff,
  PhoneOutgoing, ReceiptText, RefreshCw, Replace, RotateCcw, ScanSearch, Send, ShieldCheck, Sparkles, StickyNote, UserCheck, UserPen,
  UserRoundCog, type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import type { TimelineEvent } from "@/lib/api/salesIntelligence";
import { BANDS, copy } from "../sales-intelligence-copy";

export const TIMELINE_GROUPS = ["calls", "lead_updates", "work", "messages", "analysis"] as const;
export type TimelineGroup = (typeof TIMELINE_GROUPS)[number];
export type KindSource = "fixture" | "server" | "s11-tl" | "later";

export type KindEntry = {
  icon: LucideIcon;
  group: TimelineGroup;
  routineDefault: boolean;
  source: KindSource;
  /** Set on a kind no server emits yet: `S11-TL` or the later spec. Never sent in `kinds[]`. */
  pending?: string;
  detail?: (item: TimelineEvent) => ReactNode;
  action?: (item: TimelineEvent) => TimelineActionLink | null;
};

export type TimelineActionLink = { kind: string; label: string; href: string };

const t = copy.ui1.timeline;

// ── Safe readers over the server's `detail` (a JSON record whose shape varies by kind). Nothing here throws. ──
function field(item: TimelineEvent, key: string): unknown {
  const detail = item.detail as Record<string, unknown> | null | undefined;
  return detail && typeof detail === "object" ? detail[key] : undefined;
}
const text = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value.trim() : null);
const bandNo = (value: unknown): number | null => (typeof value === "number" && value >= 1 && value <= 7 ? value : null);

/** The server's own action (`Open conversation` → the Analysis tab's conversation card; `Open Booking` → the official record). */
export function serverAction(item: TimelineEvent): TimelineActionLink | null {
  const action = item.action;
  if (!action || typeof action.href !== "string" || !action.href) return null;
  const label = t.action[action.kind];
  return label ? { kind: action.kind, label, href: action.href } : null;
}

function bandName(n: number): string {
  return t.band.name(n, BANDS[n as keyof typeof BANDS]);
}

/** `band_changed`: `Moved from Band 2 · … to Band 5 · …`, `(estimated start)` when estimated, and the cause. */
function bandDetail(item: TimelineEvent): ReactNode {
  const from = bandNo(field(item, "from_band"));
  const to = bandNo(field(item, "to_band"));
  const move = from && to ? t.band.moved(bandName(from), bandName(to)) : to ? t.band.entered(bandName(to)) : from ? t.band.left(bandName(from)) : t.band.leftUnknown;
  const estimated = field(item, "estimated") === true ? ` ${t.estimated}` : "";
  const cause = field(item, "cause");
  const causeKind = cause && typeof cause === "object" ? text((cause as Record<string, unknown>).kind) : null;
  const causeWord = causeKind ? t.band.causes[causeKind] : null;
  return `${move}${estimated}${causeWord ? ` · ${t.band.cause(causeWord)}` : ""}`;
}

/** `Reason: …` (and `Note: …`) from an audit row, only when the server's title and description don't already say it. */
function reasonDetail(item: TimelineEvent): ReactNode {
  const said = `${item.title ?? ""} ${item.description}`.toLowerCase();
  const parts: string[] = [];
  const reason = text(field(item, "reason"));
  if (reason && !said.includes(reason.toLowerCase())) parts.push(t.reason(reason));
  const note = text(field(item, "note"));
  if (note && !said.includes(note.toLowerCase())) parts.push(t.note(note));
  return parts.length ? parts.join(" · ") : null;
}

/** `call`: `Details may still change` while the Call Log row is provisional (G2). */
function callDetail(item: TimelineEvent): ReactNode {
  return item.call?.call_log_state === "provisional" ? t.provisional : null;
}

/** `call` icon: missed / no answer, else by direction, else the plain phone (UI-0 §7.3). */
export function callIcon(item: TimelineEvent): LucideIcon {
  const result = (item.call?.result ?? "").toLowerCase();
  if (result === "missed" || result === "no answer") return PhoneMissed;
  const direction = (item.call?.direction ?? "").toLowerCase();
  if (direction === "inbound") return PhoneIncoming;
  if (direction === "outbound") return PhoneOutgoing;
  return Phone;
}

const entry = (icon: LucideIcon, group: TimelineGroup, source: KindSource, more: Partial<KindEntry> = {}): KindEntry => ({ icon, group, source, routineDefault: false, ...more });
const S11 = "S11-TL";

export const EVENT_KINDS: Readonly<Record<string, KindEntry>> = {
  // The 23 kinds the contract fixtures show (TL-AUDIT §5a).
  call: entry(Phone, "calls", "fixture", { detail: callDetail, action: serverAction }),
  lead_received: entry(Inbox, "lead_updates", "fixture"),
  call_qualified: entry(BadgeCheck, "lead_updates", "fixture"),
  conversation_analyzed: entry(Sparkles, "analysis", "fixture", { action: serverAction }),
  assessment_published: entry(Gauge, "analysis", "fixture"),
  granot_priority_changed: entry(Flag, "lead_updates", "fixture"),
  quoted_changed: entry(ReceiptText, "lead_updates", "fixture"),
  granot_observed: entry(Eye, "lead_updates", "fixture", { routineDefault: true }),
  receiver_agent_changed: entry(UserRoundCog, "lead_updates", "fixture"),
  number_attached: entry(Link, "lead_updates", "fixture"),
  followup_created: entry(CalendarPlus, "work", "fixture"),
  followup_completed: entry(CalendarCheck, "work", "fixture"),
  followup_snoozed: entry(AlarmClockOff, "work", "fixture", { detail: reasonDetail }),
  followup_superseded: entry(Replace, "work", "fixture"),
  assigned: entry(UserCheck, "work", "fixture", { detail: reasonDetail }),
  owner_note: entry(StickyNote, "work", "fixture"),
  owner_correction: entry(Pencil, "work", "fixture"),
  review_opened: entry(CircleAlert, "work", "fixture", { detail: reasonDetail }),
  closed: entry(Archive, "work", "fixture", { detail: reasonDetail }),
  booking_recorded: entry(CircleDollarSign, "lead_updates", "fixture", { action: serverAction }),
  cancellation_recorded: entry(CircleX, "lead_updates", "fixture", { action: serverAction }),
  lead_message_sent: entry(MessageSquareText, "messages", "fixture"),
  // Routine unless the cause is a call or the Owner; the item's `routine` decides.
  band_changed: entry(ArrowUpDown, "work", "fixture", { routineDefault: true, detail: bandDetail }),

  // Emitted by the server (`TIMELINE_KIND_ORDER`), shown by no fixture (TL-AUDIT §5b).
  conversation_recorded: entry(Mic, "calls", "server", { routineDefault: true }),
  followup_cancelled: entry(CalendarX, "work", "server", { detail: reasonDetail }),
  reopened: entry(RotateCcw, "work", "server", { detail: reasonDetail }),
  waiting_set: entry(CirclePause, "work", "server", { detail: reasonDetail }),
  review_resolved: entry(CircleCheck, "work", "server", { detail: reasonDetail }),
  restriction_set: entry(Ban, "work", "server", { detail: reasonDetail }),
  restriction_resolved: entry(ShieldCheck, "work", "server", { detail: reasonDetail }),
  // A6 replaces this kind's reader in S11-TL; the kind name stays.
  nudge_sent: entry(Send, "messages", "server"),
  call_started: entry(PhoneCall, "work", "server"),
  call_ended: entry(PhoneOff, "work", "server"),
  analysis_submitted: entry(Hourglass, "analysis", "server", { routineDefault: true }),

  // Proposed by the audit for S11-TL (TL-AUDIT §4 A1–A5), pending until S11-TL is captured.
  duplicate_lead_received: entry(CopyPlus, "lead_updates", "s11-tl", { pending: S11 }),
  lead_details_changed: entry(UserPen, "lead_updates", "s11-tl", { pending: S11 }),
  booking_changed: entry(FilePenLine, "lead_updates", "s11-tl", { pending: S11, action: serverAction }),
  cancellation_changed: entry(FileX, "lead_updates", "s11-tl", { pending: S11, action: serverAction }),
  granot_booking_action: entry(BookCheck, "lead_updates", "s11-tl", { pending: S11 }),
  auto_assigned: entry(UserCheck, "work", "s11-tl", { pending: S11 }),
  followup_rescheduled: entry(CalendarClock, "work", "s11-tl", { pending: S11 }),
  analysis_published: entry(ScanSearch, "analysis", "s11-tl", { pending: S11 }),
  reanalysis_requested: entry(RefreshCw, "analysis", "s11-tl", { pending: S11 }),
  analysis_reviewed: entry(ClipboardCheck, "analysis", "s11-tl", { pending: S11 }),

  // S12-REPACT (CF12): a rep moved its own follow-up; the server writes the rep's name and note into the title and description.
  followup_redated: entry(CalendarClock, "work", "fixture", { detail: reasonDetail }),

  // UI-0 §7.3 kinds a later spec adds (no reader yet).
  rep_replied: entry(MessageSquareReply, "messages", "later", { pending: "UI-4" }),
  thread_resolved: entry(MessageSquareCheck, "messages", "later", { pending: "UI-4" }),
};

/** Anything the registry doesn't know: the generic dot, the server's group, no detail. */
export const GENERIC_KIND: KindEntry = { icon: Dot, group: "work", routineDefault: false, source: "server" };

const isGroup = (value: unknown): value is TimelineGroup => typeof value === "string" && (TIMELINE_GROUPS as readonly string[]).includes(value);

export function kindEntry(kind: string): KindEntry {
  return Object.prototype.hasOwnProperty.call(EVENT_KINDS, kind) ? EVENT_KINDS[kind]! : GENERIC_KIND;
}
export const hasKindEntry = (kind: string) => Object.prototype.hasOwnProperty.call(EVENT_KINDS, kind);

export function eventIcon(item: TimelineEvent): LucideIcon {
  return item.kind === "call" ? callIcon(item) : kindEntry(item.kind).icon;
}

/** The server's group when it sends one (v2), else the registry's. */
export function eventGroup(item: TimelineEvent): TimelineGroup {
  return isGroup(item.group) ? item.group : kindEntry(item.kind).group;
}

/** The detail line; a renderer that meets an unexpected shape renders nothing rather than breaking the list. */
export function eventDetail(item: TimelineEvent): ReactNode {
  const render = kindEntry(item.kind).detail;
  if (!render) return null;
  try {
    return render(item);
  } catch {
    return null;
  }
}

export function eventAction(item: TimelineEvent): TimelineActionLink | null {
  const render = kindEntry(item.kind).action ?? serverAction;
  try {
    return render(item);
  } catch {
    return null;
  }
}

/** `kinds[]` for the chosen filter groups: every registered, non-pending kind in them. Empty selection → no filter. */
export function kindsForGroups(groups: readonly string[]): string[] {
  if (!groups.length) return [];
  return Object.entries(EVENT_KINDS)
    .filter(([, e]) => !e.pending && groups.includes(e.group))
    .map(([kind]) => kind)
    .sort();
}
