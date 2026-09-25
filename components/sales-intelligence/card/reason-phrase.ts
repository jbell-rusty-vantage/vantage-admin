/**
 * UI1-CARD: line 7's "why" segment (UI-1 §2.3, COPY-UI1 §2). Pure: no React, no browser clock.
 *
 * The primary reason is `derived.reasons[0]`, as the server ordered it. A reason with an amount prints it:
 * - the promised-callback reasons: `as_of − next_action.attention_due_at` (`{overdue}`);
 * - `followups_due`: `facts.next_action_state` (the server's state) picks `Follow-up overdue {overdue}` or
 *   `Follow-up due {countdown}`;
 * - `no_call_yet`: `{overdue}` from `next_action.attention_due_at` while the server says that action is overdue,
 *   else from `first_action_due_at` (the first call's due time); with neither, `Not called yet`;
 * - `new_not_yet_due`: the countdown to `first_action_due_at`.
 * The browser only measures the distance between a server time and `as_of`; it never decides a state.
 */
import type { AttentionRow } from "@/lib/api/salesIntelligence";
import { copy } from "../sales-intelligence-copy";
import { etDateKey, formatCountdown, formatDate, formatDuration } from "../lib/time";

type Outreach = NonNullable<AttentionRow["outreach"]>;
/** The two parts of a row the phrase reads. The side dialog passes the live detail record here. */
export type ReasonSource = { outreach: Outreach | null; derived: { reasons: string[] } };

const r = copy.ui1.reason;

/** Milliseconds from `from` to `to` (both server times). NaN when either is unparseable. */
export function elapsedMs(from: string | null | undefined, to: string | null | undefined): number {
  if (!from || !to) return Number.NaN;
  return Date.parse(to) - Date.parse(from);
}

/** `40m`, `2h 5m` since `t` at `asOf`; null when `t` is missing or unparseable. */
export function overdueAmount(t: string | null | undefined, asOf: string): string | null {
  const ms = elapsedMs(t, asOf);
  return Number.isFinite(ms) ? formatDuration(ms) : null;
}

/** `in 2h` to `t` at `asOf`; null when `t` is missing or unparseable. */
export function dueCountdown(t: string | null | undefined, asOf: string): string | null {
  if (!t) return null;
  const countdown = formatCountdown(t, asOf);
  return countdown.kind === "unknown" ? null : countdown.text;
}

function followupsDue(o: Outreach | null, asOf: string): string {
  const state = o?.facts?.next_action_state;
  const t = o?.next_action?.attention_due_at ?? null;
  if (state === "overdue") {
    const amount = overdueAmount(t, asOf);
    return amount ? r.followupOverdue(amount) : r.followupBare;
  }
  if (state === "due") {
    const countdown = dueCountdown(t, asOf);
    return countdown ? r.followupDue(countdown) : r.followupBare;
  }
  return r.followupBare;
}

function noCallYet(o: Outreach | null, asOf: string): string {
  const action = o?.next_action;
  const from = action?.attention_due_at && o?.facts?.next_action_state === "overdue" ? action.attention_due_at : (o?.first_action_due_at ?? null);
  return r.phrases.no_call_yet(overdueAmount(from, asOf) ?? undefined);
}

/** One reason key as its phrase, with its amount and any detail lines for the tooltip. Never blank. */
export function reasonPhrase(key: string, row: ReasonSource, asOf: string): { text: string; tooltipLines: string[] } {
  const o = row.outreach;
  const tooltipLines: string[] = [];
  let text: string;
  if (key === "followups_due") text = followupsDue(o, asOf);
  else if (key === "no_call_yet") text = noCallYet(o, asOf);
  else if (key === "new_not_yet_due") text = r.phrases.new_not_yet_due(dueCountdown(o?.first_action_due_at, asOf) ?? undefined);
  else if (key.startsWith("promised_by:") || key === "promised_callback_overdue") {
    const phrase = r.phrases[key] ?? r.phrases.promised_callback_overdue;
    text = phrase(overdueAmount(o?.next_action?.attention_due_at, asOf) ?? undefined);
  } else {
    const phrase = r.phrases[key];
    text = phrase ? phrase() : r.fallback(key);
  }
  if (key === "called_before_form" && o?.prior_contact_at) {
    tooltipLines.push(r.calledBeforeFormDetail(formatDate(etDateKey(o.prior_contact_at), asOf)));
  }
  return { text, tooltipLines };
}

/**
 * The whole segment: the primary reason's phrase, and a tooltip listing every reason (primary first) with its
 * detail lines. With no reason, the final spec's `Callback overdue {overdue}` / `Due in {due}` clause from
 * `facts.next_action_state`, and no tooltip. Null when there's nothing to say.
 */
export function reasonSegment(row: ReasonSource, asOf: string): { text: string; tooltipLines: string[] } | null {
  const reasons = row.derived.reasons;
  if (reasons.length) {
    const phrases = reasons.map((key) => reasonPhrase(key, row, asOf));
    return { text: phrases[0]!.text, tooltipLines: phrases.flatMap((p) => [p.text, ...p.tooltipLines]) };
  }
  const o = row.outreach;
  const t = o?.next_action?.attention_due_at ?? null;
  if (o?.facts?.next_action_state === "overdue") {
    const amount = overdueAmount(t, asOf);
    return amount ? { text: r.noReasonOverdue(amount), tooltipLines: [] } : null;
  }
  if (o?.facts?.next_action_state === "due") {
    const ms = elapsedMs(asOf, t);
    return Number.isFinite(ms) ? { text: r.noReasonDue(formatDuration(ms)), tooltipLines: [] } : null;
  }
  return null;
}
