/**
 * Display helpers for the Sales Outreach Desk. Pure (no React, no clock reads): every relative time is interpolated
 * from the server's `as_of`, never from the browser clock, and nothing here decides cadence, overdue, rank or
 * authorization. A `null` count is "pending", never 0 (S1 rendering rules).
 */
import { isSalesOutreachApiError, SALES_OUTREACH_READ_SHAPE_MISMATCH } from "@/lib/api/salesOutreach";
import type {
  SalesOutreachCadenceMetric,
  SalesOutreachCadenceSummaryDto,
  SalesOutreachCaptureFreshness,
  SalesOutreachChannelDto,
  SalesOutreachDueTodayMetric,
  SalesOutreachFreshness,
  SalesOutreachOtherOutboundBreakdown,
  SalesOutreachQueueRowDto,
  SalesOutreachRepDayDto,
} from "@/lib/api/salesOutreach";
import { deskCopy } from "../outreach-desk-copy";
import { reportUnknownDeskCode } from "./unknown-codes";

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

/** A cadence metric (overdue leads, quoted with gaps, calls/SMS due): the value, or why it is unavailable. */
export function cadenceMetricText(metric: SalesOutreachCadenceMetric | SalesOutreachDueTodayMetric): { text: string; available: boolean; reason: string | null } {
  if (metric.value !== null) return { text: String(metric.value), available: true, reason: null };
  const reason = metric.unknown_reason;
  return { text: t.unavailable, available: false, reason: reason ? (deskCopy.unknownReasons[reason] ?? t.unavailable) : null };
}

/**
 * Why a desk read failed, in words: a body the mirror can't read, a 503 (unavailable, not empty), a lost scope, or
 * anything else (network, 5xx). Views show this in place of a skeleton that would never resolve.
 */
export function readFailureText(error: unknown): string {
  const r = deskCopy.readErrors;
  if (isSalesOutreachApiError(error)) {
    if (error.code === SALES_OUTREACH_READ_SHAPE_MISMATCH) return r.shape;
    if (error.unavailable) return r.unavailable;
    if (error.status === 403) return r.forbidden;
  }
  return r.failed;
}

// ---------------------------------------------------------------------------------------------- freshness

export type FreshnessChip = { key: "granot" | "calls" | "sms"; source: string; label: string; tone: "green" | "amber" | "gray"; title: string };

/**
 * A capture source's `reason` in words (A3-fresh: `confirmation_stale`, `coverage_behind`, `webhook_silent`, …), or
 * null when there is none. A code the copy map does not know (a RingCentral error code such as `RateLimited`) reads
 * as the generic fallback and is reported; the code itself never reaches the screen.
 */
export function freshnessReasonText(reason: string | null | undefined): string | null {
  if (reason === null || reason === undefined || reason === "") return null;
  const reasons = deskCopy.freshness.reasons;
  if (Object.hasOwn(reasons, reason)) return reasons[reason]!;
  reportUnknownDeskCode({ kind: "freshness_reason", code: null, value: reason });
  return deskCopy.freshness.reasonFallback;
}

function captureChip(key: "calls" | "sms", source: string, value: SalesOutreachCaptureFreshness): FreshnessChip {
  const age = ageWords(value.age_seconds);
  const known = value.known_complete_through ? absoluteTime(value.known_complete_through) : null;
  // A fresh source carries no reason (the server nulls it); any other state says why in the tooltip.
  const why = (base: string) => {
    const reason = value.state === "fresh" ? null : freshnessReasonText(value.reason);
    return reason ? deskCopy.freshness.withReason(base, reason) : base;
  };
  switch (value.state) {
    case "fresh":
      return { key, source, label: t.synced, tone: "green", title: age ? deskCopy.freshness.updated(source, age) : source };
    case "delayed":
      return { key, source, label: t.delayed, tone: "amber", title: why(known ? deskCopy.freshness.completeThrough(source, known) : deskCopy.freshness.delayed(source)) };
    case "not_connected":
      return { key, source, label: t.notConnected, tone: "gray", title: why(deskCopy.freshness.notConnected(source)) };
    default:
      return { key, source, label: t.unknown, tone: "gray", title: why(deskCopy.freshness.unknown(source)) };
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

/**
 * The tooltip on a rep's call count when the server says the 0 is real (`actual_basis: "no_activity_recorded"`:
 * capture coverage is complete and the rep has no calls). A pending count (null) never gets it.
 */
export function repZeroActivityTitle(rep: Pick<SalesOutreachRepDayDto, "actual_basis" | "actual_confirmed">): string | undefined {
  return rep.actual_basis === "no_activity_recorded" && rep.actual_confirmed === 0 ? deskCopy.team.goals.noActivityTitle : undefined;
}

/** One count under a named scope: "97 outbound", "12 to enrolled Leads"; a pending count reads "Pending" in place of the number. */
export function scopeCountText(scope: string, value: number | null | undefined): string {
  const g = deskCopy.team.goals;
  const words = Object.hasOwn(g.scopeCount, scope) ? g.scopeCount[scope]! : g.scopeCountFallback;
  return words(countText(value));
}

function scopeCountsTitle(headlineScope: string): string {
  const g = deskCopy.team.goals;
  return Object.hasOwn(g.scopeCountsTitle, headlineScope) ? g.scopeCountsTitle[headlineScope]! : g.scopeCountsTitleFallback;
}

/**
 * The secondary count (lifecycle repair C1b) on its own: "12 to enrolled Leads", with a tooltip naming which count is
 * the goal's. Null when the server sends no other scope (a row written before both counts were stored, a mixed day,
 * an older server). A null count inside it is pending ("Pending to enrolled Leads"), never 0.
 */
export function alternateCountText(
  headlineScope: string | null | undefined,
  alternate: { count_scope: string; actual: number | null } | null | undefined,
): { text: string; title: string } | null {
  if (!alternate) return null;
  return { text: scopeCountText(alternate.count_scope, alternate.actual), title: scopeCountsTitle(headlineScope ?? "") };
}

/**
 * Both counts of a rep-day, headline first: "97 outbound · 12 to enrolled Leads". The headline is `actual_confirmed`
 * under the configured `count_scope` (the one the goal uses); the other is `alternate_scope`. Null without one.
 */
export function goalScopeCounts(
  rep: Pick<SalesOutreachRepDayDto, "count_scope" | "actual_confirmed" | "alternate_scope">,
): { text: string; title: string } | null {
  const alternate = alternateCountText(rep.count_scope, rep.alternate_scope ? { count_scope: rep.alternate_scope.count_scope, actual: rep.alternate_scope.actual_confirmed } : null);
  if (!alternate) return null;
  return { text: `${scopeCountText(rep.count_scope, rep.actual_confirmed)} · ${alternate.text}`, title: alternate.title };
}

/**
 * A rep-day's call capture coverage in words: `partial` (behind the clock, the counts can still grow) and `unknown`
 * (capture hasn't reported the day) read differently; `complete` says nothing.
 */
export function goalCoverageNote(coverage: Pick<SalesOutreachRepDayDto["coverage"], "state" | "known_complete_through">): { text: string; title: string } | null {
  const copy = deskCopy.team.goals.coverageStates;
  if (coverage.state === "complete") return null;
  if (coverage.state === "partial") return { text: copy.partial, title: copy.partialTitle(coverage.known_complete_through ? absoluteTime(coverage.known_complete_through) : null) };
  return { text: copy.unknown, title: copy.unknownTitle };
}

/**
 * "Other outbound" by reason, largest first (ties in the server's bucket order), zero buckets left out:
 * `[{reason, count, words}]`. A bucket this desk has no words for reads "another reason" and is reported.
 */
export function otherOutboundParts(breakdown: SalesOutreachOtherOutboundBreakdown | null | undefined): { reason: string; count: number; words: string }[] {
  if (!breakdown) return [];
  const g = deskCopy.team.goals;
  const parts: { reason: string; count: number; words: string }[] = [];
  for (const [reason, value] of Object.entries(breakdown)) {
    if (typeof value !== "number" || value <= 0) continue;
    let words = Object.hasOwn(g.otherReasons, reason) && reason !== "eligible" ? g.otherReasons[reason] : undefined;
    if (!words) {
      reportUnknownDeskCode({ kind: "association_reason", code: null, value: reason });
      words = g.otherReasonFallback;
    }
    parts.push({ reason, count: value, words });
  }
  // Stable: equal counts keep the server's key order.
  return parts.sort((a, b) => b.count - a.count);
}

/**
 * The tooltip on an "Other outbound: N" figure: one line per reason ("Other outbound by reason" / "51 lead not on the
 * desk" / …), or why there is none yet (a row written before reasons were stored).
 */
export function otherOutboundTitle(other: { count: number | null; breakdown?: SalesOutreachOtherOutboundBreakdown | null }, headlineScope: string | null | undefined): string {
  const g = deskCopy.team.goals;
  const footnote = otherFootnoteForScope(headlineScope);
  if (!other.breakdown) return other.count ? `${footnote}\n${g.otherBreakdownPending}` : footnote;
  const lines = otherOutboundParts(other.breakdown).map((part) => g.otherBreakdownPart(part.count, part.words));
  return lines.length ? `${g.otherBreakdownTitle}:\n${lines.join("\n")}\n\n${footnote}` : footnote;
}

/** What "Other outbound" means under the day's headline scope (whether it is part of the goal count). */
export function otherFootnoteForScope(headlineScope: string | null | undefined): string {
  const g = deskCopy.team.goals;
  return headlineScope && Object.hasOwn(g.otherFootnoteByScope, headlineScope) ? g.otherFootnoteByScope[headlineScope]! : g.otherFootnote;
}

/**
 * The Daily call goals footnote's Other outbound part: what it means under the headline scope, then the team breakdown
 * in words ("Other outbound by reason: 64 lead not on the desk, 38 before the desk started on the lead, …."). Empty when
 * the team has no Other outbound calls.
 */
export function otherOutboundFootnote(
  headlineScope: string | null | undefined,
  total: number | null,
  breakdown: SalesOutreachOtherOutboundBreakdown | null | undefined,
): string | null {
  if (!total) return null;
  const g = deskCopy.team.goals;
  const parts = otherOutboundParts(breakdown).map((part) => g.otherBreakdownPart(part.count, part.words));
  return parts.length ? `${otherFootnoteForScope(headlineScope)} ${g.otherBreakdownFoot(parts.join(", "))}` : otherFootnoteForScope(headlineScope);
}

/** The progress cell: "Goal reached" (green), "64%" or "Pending". */
export function repProgressLabel(rep: Pick<SalesOutreachRepDayDto, "progress" | "goal_reached" | "goal_state">): { text: string; tone: Tone } {
  if (rep.goal_state !== "goal") return { text: "", tone: "muted" };
  if (rep.goal_reached) return { text: t.goalReached, tone: "green" };
  const pct = percentText(rep.progress);
  return pct ? { text: pct, tone: "muted" } : { text: t.pending, tone: "muted" };
}

// ---------------------------------------------------------------------------------------------- channels

/**
 * A passed deadline RingCentral capture can't prove yet (server `verification.state: "unverified"`, lifecycle repair
 * A2). The server keeps such a channel `due`; an `overdue` that arrives unverified is treated the same way, so an
 * unverified channel never reads red or overdue.
 */
export function isUnverified(channel: Pick<SalesOutreachChannelDto, "status" | "verification">): boolean {
  return channel.verification?.state === "unverified" && (channel.status === "due" || channel.status === "overdue");
}

/** Overdue as the server proved it: status `overdue` and not unverified (servers before A2 send no verification). */
export function isVerifiedOverdue(channel: Pick<SalesOutreachChannelDto, "status" | "verification">): boolean {
  return channel.status === "overdue" && !isUnverified(channel);
}

/** A "known through" instant in words, from `as_of`: "11:43 AM" on the same New York day, otherwise "Oct 5, 7:58 PM". */
export function knownThroughTime(instant: string | null | undefined, asOf: string): string | null {
  if (!instant) return null;
  const time = timeFormatter.format(new Date(instant));
  return nyDate(instant) === nyDate(asOf) ? time : `${monthDayFormatter.format(new Date(instant))}, ${time}`;
}

/**
 * The note for an unverified channel: "Due — not yet verified (activity known through 11:43 AM)" plus its tooltip;
 * null for any other channel. Never a countdown and never "overdue".
 */
export function verificationNote(channel: SalesOutreachChannelDto, asOf: string): { text: string; title: string } | null {
  if (!isUnverified(channel)) return null;
  const known = knownThroughTime(channel.verification?.verified_through, asOf);
  return { text: t.notYetVerifiedFull(known), title: t.notYetVerifiedTitle(known) };
}

/** One channel's status for a row: the label, its tone (always text, never color alone) and an optional tooltip. */
export function channelStatus(channel: SalesOutreachChannelDto, asOf: string, kind: "call" | "sms"): { text: string; tone: Tone; title?: string } {
  if (isUnverified(channel)) return { text: t.notYetVerified, tone: "amber", title: t.notYetVerifiedTitle(knownThroughTime(channel.verification?.verified_through, asOf)) };
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
      // Evidence uncertainty (records still arriving), not a review.
      return { text: t.pending, tone: "muted", title: t.pendingTitle };
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

/**
 * "2 days overdue" under the calls cell, from the oldest unmet deadline and `as_of` (display interpolation only).
 * Null unless the server proved the channel overdue: an unverified deadline has no overdue duration.
 */
export function overdueByText(channel: SalesOutreachChannelDto, asOf: string): string | null {
  if (!isVerifiedOverdue(channel)) return null;
  const since = channel.oldest_actionable_due_at ?? channel.due_at;
  if (!since) return null;
  return t.overdueBy(durationWords(Date.parse(asOf) - Date.parse(since)));
}

// ---------------------------------------------------------------------------------------------- rows

/**
 * Lead age ("Day 3"): the server's New schedule day when the row carries one; otherwise (Quoted and other
 * workflows) the calendar age in New York days, Day 1 being the day the Lead arrived.
 */
export function leadAgeText(row: Pick<SalesOutreachQueueRowDto, "received_at" | "schedule_day">, asOf: string): string {
  if (row.schedule_day !== null) return t.day(row.schedule_day);
  if (!row.received_at) return t.unknown;
  return t.day(Math.max(1, daysBetween(nyDate(row.received_at), nyDate(asOf)) + 1));
}

/** The read-only New lead schedule as lines ("Days 1–3: 2 calls required, 1 optional"); empty when nothing is configured. */
export function cadenceSummaryLines(summary: SalesOutreachCadenceSummaryDto | null): string[] {
  const s = deskCopy.lead.schedule;
  const fresh = summary?.new;
  if (!fresh) return [];
  const lines: string[] = [];
  if (fresh.days_1_3_calls) lines.push(s.firstDays(fresh.days_1_3_calls.required, fresh.days_1_3_calls.optional));
  for (const slot of fresh.call_slots ?? []) lines.push(s.slot(slot.from_day, slot.to_day, slot.calls_per_day));
  if (fresh.sms_sequence) lines.push(s.sms(fresh.sms_sequence.initial_days, fresh.sms_sequence.repeat_from_day, fresh.sms_sequence.repeat_every_days));
  return lines;
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
 * A review reason in words ("Needs review: no phone number to call"). A reason the copy map does not know reads as
 * plain "Needs review" — the code itself never reaches the screen — and is reported (logged once in development).
 */
export function reviewReasonText(reason: unknown): string {
  const lead = deskCopy.lead;
  if (reason === null || reason === undefined || reason === "") return lead.needsReview(null);
  const text = typeof reason === "string" && Object.hasOwn(lead.reviewReasons, reason) ? lead.reviewReasons[reason] : undefined;
  if (text) return lead.needsReview(text);
  reportUnknownDeskCode({ kind: "review_reason", code: null, value: reason });
  return lead.needsReview(null);
}

const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** An intake refusal reason in lower-case words, or undefined when it has no copy. */
function refusalReasonText(reason: string): string | undefined {
  const a = deskCopy.settingsExtra.admissions;
  const reviewReasons = deskCopy.lead.reviewReasons;
  if (Object.hasOwn(a.reasons, reason)) return a.reasons[reason];
  const review = reason.startsWith("review:") ? reason.slice("review:".length) : null;
  if (review !== null && Object.hasOwn(reviewReasons, review)) return a.reviewReason(reviewReasons[review]!);
  return undefined;
}

/**
 * The part after `expansion:` (server `expansionAdmissionOf`): a gate code (`admission_disabled`, `migration_paused`,
 * `policy_unavailable`) or `<partition>:<reason>` from the enrollment classifier — `older:outside_backfill_scope`,
 * `closed:<closure>` (including `closed:closed_priority`), `excluded:<reason>`, `review:<reason>`.
 */
function expansionRefusalText(reason: string): string | undefined {
  const expansion = deskCopy.settingsExtra.admissions.expansionReasons;
  if (Object.hasOwn(expansion, reason)) return expansion[reason];
  const direct = refusalReasonText(reason);
  if (direct !== undefined) return direct;
  const closed = reason.startsWith("closed:") ? reason.slice("closed:".length) : null;
  return closed === null ? undefined : refusalReasonText(closed);
}

/**
 * Why an intake refusal happened, in words ("Already booked") — `GET /enrollment/admissions` `not_admitted` keys and
 * `recent_refusals[].reason` (olr B8; free text on the server). `review:<reason>` reads the review-reason copy.
 * Automatic-admission refusals (olr B6, `expansion:<reason>` / `expansion:<partition>:<reason>`) read
 * "Automatic admission — <reason>", composed from the same copy. An unknown reason reads "Another reason" and is
 * reported (logged once in development); the code never shows.
 */
export function admissionReasonText(reason: unknown): string {
  const a = deskCopy.settingsExtra.admissions;
  let text: string | undefined;
  if (typeof reason === "string") {
    if (reason.startsWith("expansion:")) {
      const inner = expansionRefusalText(reason.slice("expansion:".length));
      text = inner === undefined ? undefined : a.expansion(inner);
    } else text = refusalReasonText(reason);
  }
  if (text) return sentence(text);
  reportUnknownDeskCode({ kind: "admission_reason", code: null, value: reason });
  return sentence(a.otherReason);
}

/**
 * A candidate's reason in the enrollment lists (ADM-4): review reasons read "Needs review: <reason>"; a ready lead's
 * reason (`received_window`, `upcoming_move`, `selected`) reads in words. Older leads need none (the hint says why).
 * Unknown reasons read the safe fallback and are reported.
 */
export function enrollmentReasonText(partition: string, reason: unknown): string | null {
  if (partition === "review") return reviewReasonText(reason);
  if (partition !== "in_scope") return null;
  const ready = deskCopy.settingsExtra.readyReasons;
  if (typeof reason === "string" && Object.hasOwn(ready, reason)) return ready[reason]!;
  reportUnknownDeskCode({ kind: "enrollment_reason", code: partition, value: reason });
  return null;
}

/**
 * How a subject joined the desk (the lead panel's enrollment line), from `subject.enrollment`. The cohort id itself
 * never shows: `admission:` (olr B6 automatic admission), the Settings one-click cohorts `owner-enroll-` /
 * `owner-older-`, kind `intake` (the new-lead gate) and `pilot`; anything else reads "Enrolled on <day>".
 */
export function enrollmentSourceText(enrollment: { cohort_id: string; kind: string; enrolled_at: string }): string {
  const e = deskCopy.lead.enrollment;
  const day = shortDateLabel(nyDate(enrollment.enrolled_at));
  if (enrollment.cohort_id.startsWith("admission:")) return e.admission(day);
  if (/^owner-(enroll|older)-/.test(enrollment.cohort_id)) return e.owner(day);
  if (enrollment.kind === "intake") return e.intake(day);
  if (enrollment.kind === "pilot") return e.pilot(day);
  return e.other(day);
}

/**
 * The attention table's concise issue: from the server's statuses and flags only (no browser cadence). The overdue
 * duration is interpolated from `as_of`.
 */
export function rowIssue(row: SalesOutreachQueueRowDto, asOf: string): { text: string; tone: Tone; icon: "alert" | "clock" | "info"; title?: string } {
  const f = row.status_flags;
  const callOver = isVerifiedOverdue(row.call);
  const smsOver = isVerifiedOverdue(row.sms);
  const callUnverified = isUnverified(row.call);
  const smsUnverified = isUnverified(row.sms);
  if (callOver && smsOver) return { text: t.callAndSmsOverdue, tone: "red", icon: "alert" };
  if (callOver) {
    const since = row.call.oldest_actionable_due_at ?? row.call.due_at;
    return { text: since ? t.callOverdueBy(durationWords(Date.parse(asOf) - Date.parse(since))) : t.callOverdue, tone: "red", icon: "alert" };
  }
  if (smsOver) return { text: t.smsOverdue, tone: "red", icon: "alert" };
  if (rowOverdue(row)) return { text: t.overdueWork, tone: "red", icon: "alert" };
  if (f.blocked) return { text: t.contactBlocked, tone: "muted", icon: "info" };
  if (row.subject_status === "review") return { text: t.needsReview, tone: "amber", icon: "info" };
  if (callUnverified || smsUnverified) {
    const note = verificationNote(callUnverified ? row.call : row.sms, asOf);
    const text = callUnverified && smsUnverified ? t.callAndSmsNotYetVerified : callUnverified ? t.callNotYetVerified : t.smsNotYetVerified;
    return { text, tone: "amber", icon: "clock", title: note?.title };
  }
  // `pending` is evidence uncertainty (call or SMS records still arriving), not a review.
  if (f.pending) return { text: t.recordsPending, tone: "muted", icon: "info", title: t.pendingTitle };
  if (row.call.status === "due" && row.sms.status === "due") return { text: t.callAndSmsDue, tone: "amber", icon: "clock" };
  if (row.call.status === "due") return { text: t.callDueToday, tone: "amber", icon: "clock" };
  if (row.sms.status === "due") return { text: t.smsDueToday, tone: "amber", icon: "clock" };
  if (f.job_pending) return { text: t.jobPending, tone: "muted", icon: "info" };
  if (f.move_date_passed) return { text: t.moveDatePassed, tone: "muted", icon: "info" };
  return { text: t.noIssue, tone: "muted", icon: "info" };
}

/**
 * Whether a row reads overdue (the red lead age, "Contact overdue"): a channel the server proved overdue, or the
 * row's `overdue` flag when no channel is waiting on verification (the server keeps the flag false while it can't
 * verify; an unverified channel never turns the row red).
 */
export function rowOverdue(row: Pick<SalesOutreachQueueRowDto, "call" | "sms" | "status_flags">): boolean {
  if (isVerifiedOverdue(row.call) || isVerifiedOverdue(row.sms)) return true;
  return row.status_flags.overdue && !isUnverified(row.call) && !isUnverified(row.sms);
}

/**
 * The Overdue card's unassigned link: "3 unassigned", or "3 unassigned · 1 overdue" when the server's
 * `unassigned.overdue` is known and above 0 (an unavailable value is left out, never shown as 0). Null with none.
 */
export function unassignedCaption(unassigned: { count: number | null; overdue: SalesOutreachCadenceMetric }): string | null {
  if (unassigned.count === null || unassigned.count <= 0) return null;
  const overdue = unassigned.overdue.value;
  const cards = deskCopy.team.cards;
  return overdue !== null && overdue > 0 ? cards.unassignedOverdue(String(unassigned.count), overdue) : cards.unassigned(String(unassigned.count));
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
