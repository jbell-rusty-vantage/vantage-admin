"use client";
/**
 * UI1-CARD: the seven card lines (final spec §5.1–5.7, UI-1 §2.1–2.3). Each line reads server fields only and
 * prints the specific null wording from SERVER-STATE-FOR-UI §1. Every time goes through `TimeText` / `lib/time.ts`
 * against the response's `as_of`.
 */
import { ArrowRight, Bot, Calendar, CircleHelp, Package, PhoneIncoming, PhoneOff, Receipt, TriangleAlert } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { scoreLabel, type AttentionRow } from "@/lib/api/salesIntelligence";
import { TooltipCard } from "../atoms/tooltip-card";
import { Button } from "../atoms/button";
import { BandBadge, Chip, StatePill, TimeText, type BandNumber, type ChipTone } from "../primitives";
import { BANDS } from "../sales-intelligence-copy";
import { copy } from "../sales-intelligence-copy";
import { cx } from "../lib/format";
import { OWNER_VIEWER, type Viewer } from "../rep/viewer-session";
import { useViewer } from "../rep/viewer";
import { TIME_WORDS, formatCountdown, formatDate, formatDayCount, formatDuration, formatExact, formatExactFull } from "../lib/time";
import { timePhrase } from "../primitives/time-text";
import { RepAvatar } from "./rep-avatar";
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
 * UI2-SCOPE (UI-2 §3): for a rep (`rep: true`) the `Don't call` chip has no "open the record for the end date" tip: the
 * end date is on the Number read, which is Owner-only, so the record doesn't show it to a rep either.
 */
export function lineOneChips(row: CardRow, asOf: string, { rep = false }: { rep?: boolean } = {}): CardChip[] {
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
      tip: value === "restriction" && !rep ? ch.blocker.restrictionTip : undefined,
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
  const rep = useViewer().role === "rep";
  return (
    <span className="si-card__l1">
      <span className="si-card__l1main">
        <span className="si-card__identity">{identity}</span>
        {lineOneChips(row, asOf, { rep }).map((chip) => (
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
        <span className={cx("si-card__nextpill", o.facts?.next_action_state === "overdue" && "is-overdue")}>{copy.oi.card.next}</span>
        <span>
          {action.description}
          {action.promise_chain?.attempt != null && `${SEP}${ch.retry(action.promise_chain.attempt)}`}
          <DueClause o={o} asOf={asOf} />
          {action.assignment && (!action.assignment.agent || action.assignment.agent.id !== o.assignment.agent?.id) && `${SEP}${action.assignment.agent?.name ?? copy.oi.card.unassignedFollowup}`}
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

/**
 * `Promised by {name}` › `Assigned to {name} (from Granot)` › `Unassigned`.
 * UI2-SCOPE (UI-2 §3, A05; COPY-UI2 §2 precedence): for a rep viewer, `Yours` when the rep is the assigned agent (even if
 * they also promised) › `Promised by you` › `Assigned to {name}` › `Unassigned`. Two server ids compared to the session's
 * Agent id; no state is derived. The Owner's text is unchanged.
 */
export function whoText(o: CardOutreach, viewer: Viewer = OWNER_VIEWER): string {
  if (viewer.role === "rep") {
    const agent = o.assignment.agent;
    if (agent && viewer.agentId && agent.id === viewer.agentId) return copy.ui2.scope.yours;
    if (viewer.agentId && o.next_action?.promised_by?.id === viewer.agentId) return copy.ui2.scope.promisedByYou;
    return agent ? c.assignedTo(agent.name) : c.unassigned;
  }
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
  const viewer = useViewer();
  const why = reasonSegment({ outreach: o, derived: row.derived }, asOf);
  const parts: ReactNode[] = [<span key="who" data-seg="who">{whoText(o, viewer)}</span>];
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

// ── Outreach card layout (OUTREACH-CARD-LAYOUT-SPECIFICATION §3): rows A, C, E and G ─────────────────────────

/**
 * Row A (D2, D4): the band tag on every card, in both layouts, then the line-1 chips; the state pill and the rep avatar
 * on the right. A card with no band prints the null `BandBadge` (`Not in Attention`); the row never hides.
 */
export function CardBandRow({ row, asOf }: { row: CardRow; asOf: string }) {
  const o = row.outreach;
  const band = row.derived.attention_band;
  const rep = useViewer().role === "rep";
  return (
    <span className="si-card__l1 si-card__bandrow">
      <span className="si-card__l1main">
        {isBand(band) ? <span className="si-card__bandname"><span>{BANDS[band]}</span><span className="si-card__bandnumber"> · Band {band}</span></span> : <BandBadge band={null} />}
        {lineOneChips(row, asOf, { rep }).map((chip) => (
          <ChipView key={chip.id} chip={chip} />
        ))}
      </span>
      {o && (
        <span className="si-card__l1side">
          <StatePill state={o.state} />
          <RepAvatar o={o} />
        </span>
      )}
    </span>
  );
}

/** Row E: `Boston, MA → Austin, TX · Oct 15`. The countdown is tile 6 now; null (row omitted) without a route. */
export function routeShortText(o: CardOutreach, asOf: string): string | null {
  const route = o.facts?.route;
  if (!route) return null;
  const path = `${place(route.pickup_city, route.pickup_state, c.pickupUnknown)} → ${place(route.delivery_city, route.delivery_state, c.deliveryUnknown)}`;
  return route.move_date ? `${path}${SEP}${formatDate(route.move_date, asOf)}` : path;
}

/** The move sits beside identity. Legacy snapshots supply only route facts until S1 is available. */
export function MoveLine({ o, asOf }: { o: CardOutreach; asOf?: string }) {
  const move = o.facts?.move;
  const route = o.facts?.route;
  const date = move === undefined ? route?.move_date : move?.date;
  const start = place(move === undefined ? route?.pickup_city ?? null : move?.pickup?.city ?? null, move === undefined ? route?.pickup_state ?? null : move?.pickup?.state ?? null, "?");
  const end = place(move === undefined ? route?.delivery_city ?? null : move?.delivery?.city ?? null, move === undefined ? route?.delivery_state ?? null : move?.delivery?.state ?? null, "?");
  const calendar = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T12:00:00Z`) : null;
  const fullDate = calendar && Number.isFinite(calendar.getTime())
    ? new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(calendar)
    : null;
  const spokenDate = calendar && Number.isFinite(calendar.getTime())
    ? new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(calendar)
    : copy.oi.card.moveDateUnknown;
  const routeKnown = move === undefined ? !!route && !!(route.pickup_city || route.pickup_state || route.delivery_city || route.delivery_state) : !!(move?.pickup || move?.delivery);
  const routeWord = routeKnown ? `${start} to ${end}` : copy.oi.card.routeUnknown;
  const parts = [move?.size, move?.volume_ft3 != null ? `${move.volume_ft3} ft³` : null].filter(Boolean);
  const estimate = move?.estimate;
  const dateNote = move?.date_source === "granot" && move.granot_observed_at ? `From Granot report, ${formatExactFull(move.granot_observed_at)}` : undefined;
  const estimateNote = estimate ? `Granot estimate, seen ${asOf ? timePhrase(estimate.observed_at, asOf, "relative").text : formatExactFull(estimate.observed_at)} (${formatExactFull(estimate.observed_at)})` : undefined;
  return (
    <span className="si-card__move" role="group" aria-label={`Move ${spokenDate}${o.facts?.move_date_passed ? ", passed" : ""}, ${routeWord}${parts.length ? `, ${parts.join(", ")}` : ""}${estimate ? `, estimate ${estimate.display}` : ""}`}>
      <CardTip title="Move date" lines={dateNote ? [dateNote] : []} label={<span aria-hidden={!dateNote} className={o.facts?.move_date_passed ? "si-text--amber" : undefined}><Calendar size={14} aria-hidden /> {fullDate ?? copy.oi.card.moveDateUnknown}{date && o.facts?.move_date_passed ? " (passed)" : ""}</span>} />
      <span aria-hidden> · </span>
      <span aria-hidden>{routeKnown ? <>{start} <ArrowRight size={14} aria-hidden /> {end}</> : copy.oi.card.routeUnknown}</span>
      {parts.map((part) => <Fragment key={part}><span aria-hidden> · </span><span aria-hidden><Package size={14} aria-hidden /> {part}</span></Fragment>)}
      {estimate && <><span aria-hidden> · </span><CardTip title="Granot estimate" lines={estimateNote ? [estimateNote] : []} label={<span><Receipt size={14} aria-hidden /> Est. {estimate.display}</span>} /></>}
    </span>
  );
}

export type CardTile = { id: string; label: string; value: string; exact?: string; dateTime?: string; nullTip?: string; tone?: "null" | "amber" };

function timeTile(id: string, label: string, t: string | null | undefined, asOf: string, nullValue: string): CardTile {
  if (!t) return { id, label, value: nullValue, tone: "null" };
  return { id, label, value: timePhrase(t, asOf, "relative").text, exact: formatExactFull(t), dateTime: t };
}

/**
 * Row C (D1, D5): six tiles in a fixed order. Values are server fields worded against `as_of`; the only colour is the
 * amber for the server's `move_date_passed`. Nothing here sets a threshold.
 */
export function metricTiles(o: CardOutreach, asOf: string): CardTile[] {
  const t = c.tile;
  const f = o.facts;
  const received: CardTile = isNumberOnly(o)
    ? { id: "received", label: c.notALead, value: t.dash, tone: "null" }
    : timeTile("received", t.received, o.trigger_at, asOf, t.dash);
  const calls = f?.calls_total ?? null;
  const conversations = f?.conversations_total ?? null;
  const moveDate = f?.move === undefined ? f?.route?.move_date : f.move?.date;
  let move: CardTile;
  if (!moveDate) move = { id: "move", label: t.move, value: t.noDate, tone: "null" };
  else if (f?.move_date_passed) move = { id: "move", label: t.move, value: t.passed, exact: formatDate(moveDate, asOf), tone: "amber" };
  else move = { id: "move", label: t.move, value: formatDayCount(moveDate, asOf).text, exact: formatDate(moveDate, asOf) };
  return [
    received,
    timeTile("last-conversation", t.lastConversation, o.last_meaningful_contact_at, asOf, t.none),
    timeTile("last-call", t.lastCall, f?.last_call_at, asOf, t.none),
    calls == null
      ? { id: "calls", label: t.calls(null), value: t.dash, tone: "null", nullTip: c.noNumber }
      : { id: "calls", label: t.calls(calls), value: calls.toLocaleString("en-US") },
    conversations == null
      ? { id: "conversations", label: t.conversations(null), value: t.dash, tone: "null" }
      : { id: "conversations", label: t.conversations(conversations), value: conversations.toLocaleString("en-US") },
    move,
  ];
}

/**
 * One tile: the label comes first in the DOM (a screen reader hears `Received 3h ago`); CSS puts the value on top.
 * A tile with an exact time is focusable and shows it on hover and focus (`title`), and says it to a screen reader.
 */
export function TileView({ tile }: { tile: CardTile }) {
  const tip = tile.exact ?? tile.nullTip;
  return (
    <li className={cx("si-tile", tile.tone && `is-${tile.tone}`)} data-tile={tile.id} title={tip} tabIndex={tip ? 0 : undefined}>
      <span className="si-tile__label">{tile.label}</span>{" "}
      {tile.dateTime ? (
        <time className="si-tile__value" dateTime={tile.dateTime}>
          {tile.value}
        </time>
      ) : (
        <span className="si-tile__value">{tile.value}</span>
      )}
      {tip && <span className="si-sr">{`, ${tip}`}</span>}
    </li>
  );
}

/** Row C. A click on a tile opens the card like the rest of the body (the tiles take pointer events for their `title`). */
export function MetricTiles({ tiles, className }: { tiles: CardTile[]; className?: string }) {
  return (
    <ul className={cx("si-tiles", className)} aria-label={c.tile.listLabel}>
      {tiles.map((tile) => (
        <TileView key={tile.id} tile={tile} />
      ))}
    </ul>
  );
}

/** Row G's recordings text: `2 recordings analyzed · 1 recording not yet analyzed`; null without the counts. */
export function recordingsText(o: CardOutreach): string | null {
  const f = o.facts;
  if (!f || f.recordings_analyzed == null) return null;
  const parts = [c.recordingsAnalyzed(f.recordings_analyzed)];
  if (f.recordings_available != null && f.recordings_available > f.recordings_analyzed) parts.push(c.recordingsPending(f.recordings_available - f.recordings_analyzed));
  return parts.join(SEP);
}

/**
 * Row G's first segment: `Promised by {name}` only when the promiser isn't the assigned rep (the avatar already names
 * them). A rep reads its own promise as `Promised by you`. Server ids compared; nothing derived.
 */
export function promiserText(o: CardOutreach, viewer: Viewer = OWNER_VIEWER): string | null {
  const promised = o.next_action?.promised_by;
  if (!promised?.name) return null;
  const agent = o.assignment.agent;
  if (agent && promised.id && promised.id === agent.id) return null;
  if (viewer.role === "rep" && viewer.agentId && promised.id === viewer.agentId) return copy.ui2.scope.promisedByYou;
  return c.promisedBy(promised.name);
}

/** Row G: promiser › reason › `Band n for …` › uncertain Priority 5 › recordings, then the sort line. */
export function CardSecondary({ row, o, asOf, sortLine }: { row: CardRow; o: CardOutreach; asOf: string; sortLine?: ReactNode }) {
  const viewer = useViewer();
  const parts: ReactNode[] = [];
  const who = promiserText(o, viewer);
  if (who) parts.push(<span key="who" data-seg="who">{who}</span>);
  const why = reasonSegment({ outreach: o, derived: row.derived }, asOf);
  if (why) parts.push(<CardTip key="why" title={copy.ui1.reason.allTitle} lines={why.tooltipLines} label={<span data-seg="why">{why.text}</span>} />);
  const band = bandForText(row, o, asOf);
  if (band) parts.push(<span key="band" data-seg="band">{band}</span>);
  const five = uncertainFiveText(o);
  if (five) parts.push(<span key="lp" data-seg="lead-progress">{five}</span>);
  const recordings = recordingsText(o);
  if (recordings) parts.push(<span key="rec" data-seg="recordings">{recordings}</span>);
  if (!parts.length && !sortLine) return null;
  return (
    <>
      {parts.length > 0 && (
        <span className="si-card__l7">
          {parts.map((part, i) => (
            <Fragment key={i}>
              {i > 0 && SEP}
              {part}
            </Fragment>
          ))}
        </span>
      )}
      {sortLine}
    </>
  );
}
