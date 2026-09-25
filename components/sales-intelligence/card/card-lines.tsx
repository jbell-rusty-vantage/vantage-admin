"use client";
/**
 * UI1-CARD: the seven card lines (final spec §5.1–5.7, UI-1 §2.1–2.3). Each line reads server fields only and
 * prints the specific null wording from SERVER-STATE-FOR-UI §1. Every time goes through `TimeText` / `lib/time.ts`
 * against the response's `as_of`.
 */
import { Bot, CircleHelp, PhoneIncoming, PhoneOff, TriangleAlert } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { scoreLabel, type AttentionRow } from "@/lib/api/salesIntelligence";
import { TooltipCard } from "../atoms/tooltip-card";
import { Button } from "../atoms/button";
import { BandBadge, Chip, StatePill, TimeText, type BandNumber, type ChipTone } from "../primitives";
import { copy } from "../sales-intelligence-copy";
import { cx } from "../lib/format";
import { TIME_WORDS, formatCountdown, formatDate, formatDayCount, formatDuration, formatExact } from "../lib/time";
import { elapsedMs, reasonSegment } from "./reason-phrase";

export type CardRow = AttentionRow;
export type CardOutreach = NonNullable<AttentionRow["outreach"]>;

const c = copy.ui1.card;
const ch = copy.ui1.chip;
const SEP = " · ";

/** `+14045551028` → `(404) 555-1028`; any other shape prints as sent. */
export function formatE164(e164: string | null | undefined): string {
  if (!e164) return "";
  const us = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
  return us ? `(${us[1]}) ${us[2]}-${us[3]}` : e164;
}

/** A Number-only subject: the Outreach is about a Contact Number, not a Lead. */
export const isNumberOnly = (o: CardOutreach) => o.subject.kind !== "lead";

/**
 * A focusable span whose tooltip opens on hover and on focus (no hover-only information). The tooltip lines are
 * also in the text as screen-reader-only content, so a linear read of the card hears them too.
 */
export function CardTip({ title, label, lines, className }: { title: string; label: ReactNode; lines: string[]; className?: string }) {
  if (!lines.length) return <span className={className}>{label}</span>;
  return (
    <TooltipCard
      title={title}
      className={cx("si-card__tip", className)}
      label={
        <>
          {label}
          <span className="si-sr" data-tip-lines>
            {` (${title}: ${lines.join("; ")})`}
          </span>
        </>
      }
    >
      <ul className="si-card__tiplist">
        {lines.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
    </TooltipCard>
  );
}

// ── Line 1 ────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * `{name} · {phone} · Job {job_no} · {source_company}` (UX-C2: the formatted primary number, left out when there is
 * none); Number-only `{phone} · No Lead attached`; `Unknown name`. The card, the preview dialog and the record header
 * all read this line.
 */
export function identityText(o: CardOutreach): string {
  const number = formatE164(o.primary_number?.e164);
  if (isNumberOnly(o) || (!o.lead_display && o.primary_number)) return number ? `${number}${SEP}${c.noLead}` : c.noLead;
  const d = o.lead_display;
  return [d?.name || c.unknownName, number || null, d?.job_no ? c.job(d.job_no) : null, d?.source_company || null].filter(Boolean).join(SEP);
}

export type CardChip = { id: string; tone: ChipTone; label: string; icon?: ReactNode; tip?: string };

const blockerLabel = (value: string): string => {
  const known = (ch.blocker as Record<string, unknown>)[value];
  return typeof known === "string" ? known : copy.ui1.reason.fallback(value);
};

/**
 * Line 1 chips, left to right (UI-1 §2.1): live chip (`live_call`, else `Owner calling`), call blockers, `Needs review`,
 * `Details disagree`, `Newer call since assessment`. Each is a server boolean or enum; nothing is derived here.
 */
export function lineOneChips(row: CardRow, asOf: string): CardChip[] {
  const o = row.outreach;
  const chips: CardChip[] = [];
  if (o?.live_call) {
    const ms = elapsedMs(o.live_call.started_at, asOf);
    chips.push({ id: "live", tone: "live", label: ch.liveCall(o.live_call.rep.text, formatDuration(ms)) });
  } else if (o?.call_progress?.state === "in_progress") {
    chips.push({ id: "owner-calling", tone: "live", label: ch.ownerCalling });
  }
  for (const value of row.derived.call_blockers) {
    if (ch.blockerNoChip.includes(value)) continue;
    chips.push({
      id: `blocker-${value}`,
      tone: "amber",
      icon: <PhoneOff size={12} aria-hidden />,
      label: blockerLabel(value),
      tip: value === "restriction" ? ch.blocker.restrictionTip : undefined,
    });
  }
  if (row.filter_keys?.needs_review) chips.push({ id: "needs-review", tone: "neutral", icon: <CircleHelp size={12} aria-hidden />, label: ch.needsReview });
  if (o?.facts?.details_disagree) chips.push({ id: "details-disagree", tone: "amber", icon: <TriangleAlert size={12} aria-hidden />, label: ch.detailsDisagree });
  if (o?.facts?.newer_call_since_assessment) {
    const through = o.move_assessment?.latest_conversation_at;
    chips.push({
      id: "newer-call",
      tone: "amber",
      icon: <PhoneIncoming size={12} aria-hidden />,
      label: ch.newerCall,
      tip: ch.newerCallTip(through ? formatExact(through, asOf) : TIME_WORDS.unknown),
    });
  }
  return chips;
}

export function ChipView({ chip }: { chip: CardChip }) {
  const body = (
    <Chip tone={chip.tone} icon={chip.icon}>
      {chip.label}
    </Chip>
  );
  return (
    <span className="si-card__chip" data-chip={chip.id}>
      {chip.tip ? <CardTip title={chip.label} label={body} lines={[chip.tip]} /> : body}
    </span>
  );
}

const isBand = (n: unknown): n is BandNumber => typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 7;

export function LineOne({ row, asOf, layout, identity }: { row: CardRow; asOf: string; layout: "grouped" | "flat"; identity: ReactNode }) {
  const o = row.outreach;
  const band = row.derived.attention_band;
  return (
    <span className="si-card__l1">
      <span className="si-card__l1main">
        <span className="si-card__identity">{identity}</span>
        {lineOneChips(row, asOf).map((chip) => (
          <ChipView key={chip.id} chip={chip} />
        ))}
      </span>
      <span className="si-card__l1side">
        {o && <StatePill state={o.state} />}
        {layout === "flat" && <BandBadge band={isBand(band) ? band : null} />}
      </span>
    </span>
  );
}

// ── Line 2 ────────────────────────────────────────────────────────────────────────────────────────────────

const place = (city: string | null, state: string | null, unknown: string) => [city, state].filter(Boolean).join(", ") || unknown;

/** `Boston, MA → Austin, TX · Move Oct 15 (in 12d)`; null (line omitted) when `facts.route` is null. */
export function routeText(o: CardOutreach, asOf: string): string | null {
  const route = o.facts?.route;
  if (!route) return null;
  const path = `${place(route.pickup_city, route.pickup_state, c.pickupUnknown)} → ${place(route.delivery_city, route.delivery_state, c.deliveryUnknown)}`;
  let move: string;
  if (!route.move_date) move = c.moveDateMissing;
  else if (o.facts?.move_date_passed) move = c.movePassed(formatDate(route.move_date, asOf));
  else move = c.move(formatDate(route.move_date, asOf), formatDayCount(route.move_date, asOf).text);
  return `${path}${SEP}${move}`;
}

// ── Line 3 ────────────────────────────────────────────────────────────────────────────────────────────────

export function LineThree({ o, asOf }: { o: CardOutreach; asOf: string }) {
  const received = isNumberOnly(o) ? (
    <span className="si-time is-null">{c.notALead}</span>
  ) : o.trigger_at ? (
    <TimeText t={o.trigger_at} asOf={asOf} mode="relative" prefix={c.received} />
  ) : (
    <span className="si-time is-null">{c.receivedUnknown}</span>
  );
  return (
    <>
      {received}
      {SEP}
      {o.last_meaningful_contact_at ? (
        <TimeText t={o.last_meaningful_contact_at} asOf={asOf} mode="relative" prefix={c.lastConversation} />
      ) : (
        <span className="si-time is-null">{c.noConversation}</span>
      )}
      {SEP}
      {o.facts?.last_call_at ? (
        <TimeText t={o.facts.last_call_at} asOf={asOf} mode="relative" prefix={c.lastCall} />
      ) : (
        <span className="si-time is-null">{c.noCall}</span>
      )}
    </>
  );
}

// ── Line 4 ────────────────────────────────────────────────────────────────────────────────────────────────

/** `6 calls · 2 conversations · 2 recordings analyzed · 1 recording not yet analyzed`; `No Number on file`. */
export function countsText(o: CardOutreach): string {
  const f = o.facts;
  if (!f || f.calls_total == null) return c.noNumber;
  const parts = [c.calls(f.calls_total)];
  if (f.conversations_total != null) parts.push(c.conversations(f.conversations_total));
  if (f.recordings_analyzed != null) parts.push(c.recordingsAnalyzed(f.recordings_analyzed));
  // Arithmetic on two server counts (brief): never a state.
  if (f.recordings_available != null && f.recordings_analyzed != null && f.recordings_available > f.recordings_analyzed) {
    parts.push(c.recordingsPending(f.recordings_available - f.recordings_analyzed));
  }
  return parts.join(SEP);
}

// ── Line 5 ────────────────────────────────────────────────────────────────────────────────────────────────

/** `Transaction intent 75 / 100 · Strong`; an unavailable score prints only its word. Never `%`. */
export function scoreText(o: CardOutreach, which: "ti" | "ml"): string {
  const a = o.move_assessment;
  const name = which === "ti" ? c.transactionIntent : c.moveLikelihood;
  if (!a) return `${name} ${scoreLabel(null, null)}`;
  const score = which === "ti" ? a.transaction_intent : a.move_likelihood;
  const level = which === "ti" ? a.transaction_intent_level_label : a.move_likelihood_level_label;
  const label = scoreLabel(a.status, score, a.applicability);
  return label.endsWith("/ 100") && level ? `${name} ${label}${SEP}${level}` : `${name} ${label}`;
}

export function scoreTipLines(o: CardOutreach): string[] {
  const stale = o.move_assessment?.stale_reason;
  return [c.scoresTip, ...(stale ? [c.staleReason[stale] ?? copy.ui1.reason.fallback(stale)] : [])];
}

export function LineFive({ o }: { o: CardOutreach }) {
  return (
    <CardTip
      title={c.scoresTipTitle}
      lines={scoreTipLines(o)}
      label={
        <span className="si-card__scores">
          <span data-score="ti">{scoreText(o, "ti")}</span>
          <span data-score="ml">{scoreText(o, "ml")}</span>
        </span>
      }
    />
  );
}

// ── Line 6 ────────────────────────────────────────────────────────────────────────────────────────────────

/** Case 1's due clause: `Due Sep 23, 10:00 AM ET (in 2h)` / `Due … · overdue 40m` (amber from the server state). */
function DueClause({ o, asOf }: { o: CardOutreach; asOf: string }) {
  const action = o.next_action!;
  if (!action.due_at) return <>{SEP}{c.dueNeeded}</>;
  const reference = action.attention_due_at ?? action.due_at;
  const overdue = o.facts?.next_action_state === "overdue";
  let tail: ReactNode = null;
  if (overdue) {
    const ms = elapsedMs(reference, asOf);
    if (Number.isFinite(ms)) tail = <span className="si-text--amber">{`${SEP}${TIME_WORDS.overdue(formatDuration(ms))}`}</span>;
  } else {
    const countdown = formatCountdown(reference, asOf);
    if (countdown.kind !== "unknown") tail = ` (${countdown.text})`;
  }
  return (
    <>
      {SEP}
      <TimeText t={action.due_at} asOf={asOf} mode="exact" prefix={c.due} />
      {tail}
    </>
  );
}

export function LineSix({ o, asOf, onApply }: { o: CardOutreach; asOf: string; onApply?: () => void }) {
  const action = o.next_action;
  if (action) {
    return (
      <span className="si-card__next">
        <span>
          {c.next(action.description)}
          {action.promise_chain?.attempt != null && `${SEP}${ch.retry(action.promise_chain.attempt)}`}
          <DueClause o={o} asOf={asOf} />
        </span>
        {action.default_kind === "quote_followup" && (
          <ChipView chip={{ id: "default", tone: "neutral", icon: <Bot size={12} aria-hidden />, label: ch.default, tip: ch.defaultTip }} />
        )}
      </span>
    );
  }
  const suggestion = o.suggested_next_step;
  if (suggestion) {
    return (
      <span className="si-card__next">
        <span>{c.suggested(suggestion.description)}</span>
        {suggestion.apply?.enabled && onApply && (
          <Button variant="link" size="sm" className="si-card__apply si-hit" aria-label={c.applyLabel(suggestion.description)} onClick={onApply}>
            {c.apply}
          </Button>
        )}
      </span>
    );
  }
  return <span className="si-time is-null">{c.noNextStep}</span>;
}

// ── Line 7 ────────────────────────────────────────────────────────────────────────────────────────────────

/** `Promised by {name}` › `Assigned to {name} (from Granot)` › `Unassigned`. */
export function whoText(o: CardOutreach): string {
  const promised = o.next_action?.promised_by;
  if (promised?.name) return c.promisedBy(promised.name);
  const agent = o.assignment.agent;
  if (!agent) return c.unassigned;
  const origin = o.assignment.origin ? c.origin[o.assignment.origin] : undefined;
  return origin ? `${c.assignedTo(agent.name)} ${origin}` : c.assignedTo(agent.name);
}

/** `Band {n} for 2h` / `Band {n} for about 3d`; null without `band_since` or a band. */
export function bandForText(row: CardRow, o: CardOutreach, asOf: string): string | null {
  const since = o.band_since;
  const band = row.derived.attention_band;
  if (!since || band == null) return null;
  const ms = elapsedMs(since.at, asOf);
  if (!Number.isFinite(ms)) return null;
  const duration = formatDuration(ms);
  return since.estimated ? c.bandForAbout(band, duration) : c.bandFor(band, duration);
}

/** Addendum §2.2: an uncertain Priority 5 keeps `Booked in Granot · No Vantage Booking yet` on an active card. */
export function uncertainFiveText(o: CardOutreach): string | null {
  const lp = o.lead_progress;
  return lp && lp.provenance === "uncertain" && lp.granot_priority === "5" && o.state !== "closed" ? c.leadProgressUncertain5 : null;
}

export function LineSeven({ row, o, asOf, sortLine }: { row: CardRow; o: CardOutreach; asOf: string; sortLine?: ReactNode }) {
  const why = reasonSegment({ outreach: o, derived: row.derived }, asOf);
  const parts: ReactNode[] = [<span key="who" data-seg="who">{whoText(o)}</span>];
  if (why) {
    parts.push(
      <CardTip key="why" title={copy.ui1.reason.allTitle} lines={why.tooltipLines} label={<span data-seg="why">{why.text}</span>} />,
    );
  }
  const band = bandForText(row, o, asOf);
  if (band) parts.push(<span key="band" data-seg="band">{band}</span>);
  const five = uncertainFiveText(o);
  if (five) parts.push(<span key="lp" data-seg="lead-progress">{five}</span>);
  return (
    <>
      <span className="si-card__l7">
        {parts.map((part, i) => (
          <Fragment key={i}>
            {i > 0 && SEP}
            {part}
          </Fragment>
        ))}
      </span>
      {sortLine}
    </>
  );
}

/** Final spec §5.8: `{Sort label}: {value}`, the null label when the row has no value for the sort. */
export function SortLine({ sortLine }: { sortLine: { label: string; value: string | null; nullLabel: string } }) {
  return (
    <span className={cx("si-card__sortline", sortLine.value == null && "is-null")} data-sortline>
      {c.sortLine(sortLine.label, sortLine.value ?? sortLine.nullLabel)}
    </span>
  );
}
