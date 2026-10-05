/**
 * Display helpers for the Sales Outreach Desk. Pure (no React, no clock reads): every relative time is interpolated
 * from the server's `as_of`, never from the browser clock, and nothing here decides cadence, overdue, rank or
 * authorization. A `null` count is "pending", never 0 (S1 rendering rules).
 */
import type {
  SalesOutreachCadenceMetric,
  SalesOutreachCaptureFreshness,
  SalesOutreachChannelDto,
  SalesOutreachFreshness,
  SalesOutreachQueueRowDto,
  SalesOutreachRepDayDto,
} from "@/lib/api/salesOutreach";
import { deskCopy } from "../outreach-desk-copy";

const t = deskCopy.text;
export const DESK_TIMEZONE = "America/New_York";

export type Tone = "red" | "amber" | "green" | "blue" | "muted" | "ink";

const dayFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: DESK_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" });
const timeFormatter = new Intl.DateTimeFormat("en-US", { timeZone: DESK_TIMEZONE, hour: "numeric", minute: "2-digit" });
const monthDayFormatter = new Intl.DateTimeFormat("en-US", { timeZone: DESK_TIMEZONE, month: "short", day: "numeric" });
const absoluteFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: DESK_TIMEZONE,
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
});

/** The New York business date (`YYYY-MM-DD`) of an instant. */
export function nyDate(instant: string | Date): string {
  return dayFormatter.format(typeof instant === "string" ? new Date(instant) : instant);
}

/** Whole days from one `YYYY-MM-DD` to another (calendar days, DST-free). */
export function daysBetween(fromDay: string, toDay: string): number {
  const [fy, fm, fd] = fromDay.split("-").map(Number);
  const [ty, tm, td] = toDay.split("-").map(Number);
  return Math.round((Date.UTC(ty!, tm! - 1, td!) - Date.UTC(fy!, fm! - 1, fd!)) / 86_400_000);
}

/** "Thursday, Oct 1" for a business date (the page subtitle). */
export function businessDateLabel(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!, 12));
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long", month: "short", day: "numeric" }).format(date);
}

/** Short business date: "Oct 1". */
export function shortDateLabel(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" }).format(new Date(Date.UTC(y!, m! - 1, d!, 12)));
}

/** The full instant for a tooltip: "Thu, Oct 1, 2026, 9:10 AM EDT". */
export function absoluteTime(instant: string | null): string {
  return instant ? absoluteFormatter.format(new Date(instant)) : t.never;
}

/**
 * Row-style relative time from the server's `as_of`: "Today, 9:10 AM", "Yesterday", "3 days ago" (up to 6), then
 * "Sep 25". `null` is "Never".
 */
export function relativeDay(instant: string | null, asOf: string): string {
  if (!instant) return t.never;
  const days = daysBetween(nyDate(instant), nyDate(asOf));
  if (days <= 0) return `${t.today}, ${timeFormatter.format(new Date(instant))}`;
  if (days === 1) return t.yesterday;
  if (days < 7) return t.daysAgo(days);
  return monthDayFormatter.format(new Date(instant));
}

/** A duration in words: "45 min", "2 hours", "3 days". */
export function durationWords(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) return t.minutes(minutes);
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t.hours(hours);
  return t.days(Math.round(hours / 24));
}

/** Age of a capture source: "just now", "4 min ago", "2 h ago". */
export function ageWords(seconds: number | null): string | null {
  if (seconds === null) return null;
  if (seconds < 60) return t.justNow;
  if (seconds < 3600) return t.minAgo(Math.round(seconds / 60));
  if (seconds < 86_400) return t.hoursAgo(Math.round(seconds / 3600));
  return t.daysAgo(Math.round(seconds / 86_400));
}

/** A count that may be pending: the number, or "Pending" (never 0). */
export function countText(value: number | null | undefined): string {
  return value === null || value === undefined ? t.pending : String(value);
}

/** Capped progress as a whole percent ("64%"); null when unknown. */
export function percentText(progress: number | null): string | null {
  return progress === null ? null : `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%`;
}

/** The fill width of a pill track (always capped at 100%). */
export function fillPercent(progress: number | null): number {
  return progress === null ? 0 : Math.round(Math.min(1, Math.max(0, progress)) * 1000) / 10;
}

/** A cadence metric (overdue leads, quoted with gaps): the value, or why it is unavailable. */
export function cadenceMetricText(metric: SalesOutreachCadenceMetric): { text: string; available: boolean; reason: string | null } {
  if (metric.value !== null) return { text: String(metric.value), available: true, reason: null };
  const reason = metric.unknown_reason;
  return { text: t.unavailable, available: false, reason: reason ? (deskCopy.unknownReasons[reason] ?? t.unavailable) : null };
}

// ---------------------------------------------------------------------------------------------- freshness

export type FreshnessChip = { key: "granot" | "calls" | "sms"; source: string; label: string; tone: "green" | "amber" | "gray"; title: string };

function captureChip(key: "calls" | "sms", source: string, value: SalesOutreachCaptureFreshness): FreshnessChip {
  const age = ageWords(value.age_seconds);
  const known = value.known_complete_through ? absoluteTime(value.known_complete_through) : null;
  switch (value.state) {
    case "fresh":
      return { key, source, label: t.synced, tone: "green", title: age ? deskCopy.freshness.updated(source, age) : source };
    case "delayed":
      return { key, source, label: t.delayed, tone: "amber", title: known ? deskCopy.freshness.completeThrough(source, known) : deskCopy.freshness.delayed(source) };
    case "not_connected":
      return { key, source, label: t.notConnected, tone: "gray", title: deskCopy.freshness.notConnected(source) };
    default:
      return { key, source, label: t.unknown, tone: "gray", title: deskCopy.freshness.unknown(source) };
  }
}

/**
 * The header chips: Moving software (Granot observations), RingCentral calls and SMS, each from its own capture
 * coverage. A green dot means healthy capture, never merely an open live stream.
 */
export function freshnessChips(freshness: SalesOutreachFreshness): FreshnessChip[] {
  const granotAge = ageWords(freshness.granot.age_seconds);
  return [
    {
      key: "granot",
      source: deskCopy.freshness.sources.granot,
      label: freshness.granot.state === "observed" ? t.synced : t.unknown,
      tone: freshness.granot.state === "observed" ? "green" : "gray",
      title: granotAge ? deskCopy.freshness.observed(granotAge) : deskCopy.freshness.unknown(deskCopy.freshness.sources.granot),
    },
    captureChip("calls", deskCopy.freshness.sources.calls, freshness.calls),
    captureChip("sms", deskCopy.freshness.sources.sms, freshness.sms),
  ];
}

// ---------------------------------------------------------------------------------------------- goals

/** "64 / 100", "Pending / 100", or the goal label ("No goal today") for a zero-goal rep. */
export function repGoalText(rep: Pick<SalesOutreachRepDayDto, "actual_confirmed" | "goal" | "goal_label" | "goal_state">): string {
  if (rep.goal_state !== "goal") return rep.goal_label ?? deskCopy.goalStates[rep.goal_state];
  return `${countText(rep.actual_confirmed)} / ${rep.goal ?? "—"}`;
}

/** The progress cell: "Goal reached" (green), "64%" or "Pending". */
export function repProgressLabel(rep: Pick<SalesOutreachRepDayDto, "progress" | "goal_reached" | "goal_state">): { text: string; tone: Tone } {
  if (rep.goal_state !== "goal") return { text: "", tone: "muted" };
  if (rep.goal_reached) return { text: t.goalReached, tone: "green" };
  const pct = percentText(rep.progress);
  return pct ? { text: pct, tone: "muted" } : { text: t.pending, tone: "muted" };
}

// ---------------------------------------------------------------------------------------------- channels

/** One channel's status for a row: the label and its tone (always text, never color alone). */
export function channelStatus(channel: SalesOutreachChannelDto, asOf: string, kind: "call" | "sms"): { text: string; tone: Tone } {
  switch (channel.status) {
    case "overdue":
      return { text: t.overdue, tone: "red" };
    case "due":
      return { text: kind === "sms" ? t.smsDueToday : t.dueToday, tone: "amber" };
    case "scheduled": {
      if (!channel.due_at) return { text: t.scheduled, tone: "muted" };
      const days = daysBetween(nyDate(asOf), nyDate(channel.due_at));
      if (days <= 0) return { text: t.dueToday, tone: "muted" };
      if (days === 1) return { text: t.dueTomorrow, tone: "muted" };
      return { text: t.dueOn(shortDateLabel(nyDate(channel.due_at))), tone: "muted" };
    }
    case "completed":
      return { text: kind === "sms" ? t.sent : t.done, tone: "green" };
    case "blocked":
      return { text: t.blocked, tone: "muted" };
    case "pending":
      return { text: t.pending, tone: "muted" };
    case "not_required":
      return { text: t.notRequired, tone: "muted" };
  }
}

/** "0 / 3" calls today; pending counts read "Pending". */
export function callsTodayText(channel: SalesOutreachChannelDto): string {
  if (channel.status === "not_required") return "—";
  if (channel.required === null) return t.pending;
  return `${countText(channel.verified_completed)} / ${channel.required}`;
}

/** "2 days overdue" under the calls cell, from the oldest unmet deadline and `as_of` (display interpolation only). */
export function overdueByText(channel: SalesOutreachChannelDto, asOf: string): string | null {
  if (channel.status !== "overdue") return null;
  const since = channel.oldest_actionable_due_at ?? channel.due_at;
  if (!since) return null;
  return t.overdueBy(durationWords(Date.parse(asOf) - Date.parse(since)));
}

// ---------------------------------------------------------------------------------------------- rows

/** Calendar age in New York days, Day 1 being the day the Lead arrived ("Day 3"). */
export function leadAgeText(receivedAt: string | null, asOf: string): string {
  if (!receivedAt) return t.unknown;
  return t.day(Math.max(1, daysBetween(nyDate(receivedAt), nyDate(asOf)) + 1));
}

/** The priority pill for a row: New, Quoted, the raw code for other observed codes, or Unknown. */
export function priorityPill(row: Pick<SalesOutreachQueueRowDto, "workflow" | "priority_raw">): { text: string; variant: "new" | "quoted" | "neutral" } {
  if (row.workflow === "new") return { text: deskCopy.workflows.new, variant: "new" };
  if (row.workflow === "quoted") return { text: deskCopy.workflows.quoted, variant: "quoted" };
  if (row.workflow === "discretion") return { text: deskCopy.workflows.discretion(row.priority_raw), variant: "neutral" };
  if (row.priority_raw) return { text: deskCopy.workflows.code(row.priority_raw), variant: "neutral" };
  return { text: t.unknown, variant: "neutral" };
}

/**
 * The attention table's concise issue: from the server's statuses and flags only (no browser cadence). The overdue
 * duration is interpolated from `as_of`.
 */
export function rowIssue(row: SalesOutreachQueueRowDto, asOf: string): { text: string; tone: Tone; icon: "alert" | "clock" | "info" } {
  const f = row.status_flags;
  const callOver = row.call.status === "overdue";
  const smsOver = row.sms.status === "overdue";
  if (callOver && smsOver) return { text: t.callAndSmsOverdue, tone: "red", icon: "alert" };
  if (callOver) {
    const since = row.call.oldest_actionable_due_at ?? row.call.due_at;
    return { text: since ? t.callOverdueBy(durationWords(Date.parse(asOf) - Date.parse(since))) : t.callOverdue, tone: "red", icon: "alert" };
  }
  if (smsOver) return { text: t.smsOverdue, tone: "red", icon: "alert" };
  if (f.overdue) return { text: t.overdueWork, tone: "red", icon: "alert" };
  if (f.blocked) return { text: t.contactBlocked, tone: "muted", icon: "info" };
  if (f.pending || row.subject_status === "review") return { text: t.needsReview, tone: "amber", icon: "info" };
  if (row.call.status === "due" && row.sms.status === "due") return { text: t.callAndSmsDue, tone: "amber", icon: "clock" };
  if (row.call.status === "due") return { text: t.callDueToday, tone: "amber", icon: "clock" };
  if (row.sms.status === "due") return { text: t.smsDueToday, tone: "amber", icon: "clock" };
  if (f.job_pending) return { text: t.jobPending, tone: "muted", icon: "info" };
  if (f.move_date_passed) return { text: t.moveDatePassed, tone: "muted", icon: "info" };
  return { text: t.noIssue, tone: "muted", icon: "info" };
}

/** The assigned rep, or Unassigned. */
export function ownerText(row: Pick<SalesOutreachQueueRowDto, "assigned_agent_id" | "assigned_agent_name">): string {
  if (!row.assigned_agent_id) return t.unassigned;
  return row.assigned_agent_name ?? t.unknownRep;
}

/** Initials for an avatar from a person's name. */
export function nameInitials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "")).toUpperCase() || "?";
}

/** `YYYY-MM-DD` plus whole days (calendar arithmetic, DST-free). */
export function addDays(day: string, days: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + days, 12)).toISOString().slice(0, 10);
}

/**
 * A move-date preset as the queue's server filters, resolved from the server's business date (`today`). The server
 * applies them before paging and counts rows a range hides only because their move date is unknown.
 */
export function moveDateRange(
  preset: "upcoming" | "today" | "next7" | "past" | "unknown" | null,
  today: string,
): { move_date_from?: string; move_date_to?: string; move_date_unknown?: "include" | "exclude" | "only" } {
  switch (preset) {
    case "upcoming":
      return { move_date_from: today };
    case "today":
      return { move_date_from: today, move_date_to: today };
    case "next7":
      return { move_date_from: today, move_date_to: addDays(today, 6) };
    case "past":
      return { move_date_to: addDays(today, -1) };
    case "unknown":
      return { move_date_unknown: "only" };
    default:
      return {};
  }
}
