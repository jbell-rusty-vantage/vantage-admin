"use client";
/**
 * The Outreach card's sections (2026-09-29 card refresh, after the Owner's Claude Design reference): identity, the
 * Move / Estimate panel, the Next panel (the outcome on a closed card), the score bars and the activity footer. Every
 * value is a server field worded against the response's `as_of`, exactly as the old lines read them; only the layout
 * changed. `card-lines.tsx` keeps the older line helpers the record header, the situation page and Quick Look use.
 */
import { ArrowRight, Phone } from "lucide-react";
import { Fragment, type CSSProperties, type ReactNode } from "react";
import { scoreLabel } from "@/lib/api/salesIntelligence";
import Link from "next/link";
import { Button } from "../atoms/button";
import { legacyNumberHref } from "../lib/legacy-links";
import { cx } from "../lib/format";
import { TIME_WORDS, formatCountdown, formatDayCount, formatDuration, formatExactFull } from "../lib/time";
import { timePhrase } from "../primitives/time-text";
import { useIsRep } from "../rep/viewer";
import { copy } from "../sales-intelligence-copy";
import { CardTip, formatE164, identityText, isNumberOnly, scoreTipLines, type CardOutreach } from "./card-lines";
import { elapsedMs } from "./reason-phrase";

const c = copy.ui1.card;
const ch = copy.ui1.chip;

/** A muted `/` between inline facts (hidden from screen readers, which hear the facts as a list). */
function Facts({ items, className }: { items: ReactNode[]; className?: string }) {
  const shown = items.filter((item) => item !== null && item !== undefined && item !== false && item !== "");
  return (
    <span className={cx("si-card__facts", className)}>
      {shown.map((item, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="si-card__sep" aria-hidden> / </span>}
          {item}
        </Fragment>
      ))}
    </span>
  );
}

// ── Identity ──────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The name large, then phone / Job / source. Number-only identity links to the legacy Number (UI-1 §1.3) with the
 * `Previous version` note; for a rep (the Numbers view is Owner-only) it is plain text. The phone is a `tel:` link.
 */
export function CardIdentity({ o }: { o: CardOutreach }) {
  const rep = useIsRep();
  const phone = formatE164(o.primary_number?.e164);
  if (isNumberOnly(o)) {
    const text = identityText(o);
    return (
      <span className="si-card__who">
        {o.primary_number && !rep ? (
          <>
            <Link className="si-card__idlink si-card__name" href={legacyNumberHref(o.primary_number.id)}>{text}</Link>
            <span className="si-card__prev si-text--sm si-text--subtle">{c.previousVersion}</span>
          </>
        ) : <span className="si-card__name">{text}</span>}
      </span>
    );
  }
  const d = o.lead_display;
  return (
    <span className="si-card__who">
      <strong className="si-card__name">{d?.name || c.unknownName}</strong>
      <Facts className="si-card__meta" items={[
        phone && o.primary_number?.e164 ? <a key="tel" className="si-card__phone si-mono" href={`tel:${o.primary_number.e164}`}><Phone size={13} aria-hidden />{phone}</a> : null,
        d?.job_no ? <span key="job">Job <span className="si-mono">{d.job_no}</span></span> : null,
        d?.source_company ? <span key="src">{d.source_company}</span> : null,
      ]} />
    </span>
  );
}

// ── Move / Estimate ───────────────────────────────────────────────────────────────────────────────────────

const place = (city: string | null | undefined, state: string | null | undefined) => [city, state].filter(Boolean).join(", ");

/**
 * Left: the route, then date / size / volume and the countdown pill (amber on the server's `move_date_passed`).
 * Right: the Granot estimate and when it was seen. Legacy snapshots supply only route facts until S1 is available.
 */
export function MovePanel({ o, asOf }: { o: CardOutreach; asOf: string }) {
  const move = o.facts?.move;
  const route = o.facts?.route;
  const legacy = move === undefined;
  const date = legacy ? route?.move_date : move?.date;
  const start = place(legacy ? route?.pickup_city : move?.pickup?.city, legacy ? route?.pickup_state : move?.pickup?.state);
  const end = place(legacy ? route?.delivery_city : move?.delivery?.city, legacy ? route?.delivery_state : move?.delivery?.state);
  const routeKnown = !!(start || end);
  const calendar = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T12:00:00Z`) : null;
  const valid = !!calendar && Number.isFinite(calendar.getTime());
  const fullDate = valid ? new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(calendar!) : null;
  const passed = !!date && !!o.facts?.move_date_passed;
  const count = date ? formatDayCount(date, asOf) : null;
  const pill = !date ? null : passed ? "Move passed" : count && Number.isFinite(count.days) ? (count.days === 0 ? "Move today" : `Move ${count.text}`) : null;
  const dateNote = move?.date_source === "granot" && move.granot_observed_at ? `From Granot report, ${formatExactFull(move.granot_observed_at)}` : null;
  const estimate = move?.estimate;
  const seen = estimate ? `seen ${timePhrase(estimate.observed_at, asOf, "relative").text} (${formatExactFull(estimate.observed_at)})` : null;
  return (
    <span className="si-card__movepanel">
      <span className="si-card__movecol" role="group" aria-label="Move">
        <span className="si-card__eyebrow">Move</span>
        <span className="si-card__route">
          {routeKnown ? <>{start || c.pickupUnknown}<ArrowRight size={16} aria-label="to" className="si-card__routearrow" />{end || c.deliveryUnknown}</> : <span className="is-null">{copy.oi.card.routeUnknown}</span>}
        </span>
        <Facts className="si-card__movefacts" items={[
          <CardTip key="date" title="Move date" lines={dateNote ? [dateNote] : []}
            label={<span className={cx(!fullDate && "is-null", passed && "si-text--amber")}>{fullDate ?? copy.oi.card.moveDateUnknown}{passed ? " (passed)" : ""}</span>} />,
          move?.size ?? null,
          move?.volume_ft3 != null ? <span key="vol" className="si-mono">{`${move.volume_ft3} ft³`}</span> : null,
          pill ? <span key="pill" className={cx("si-card__pill", passed && "is-amber")}>{pill}</span> : null,
        ]} />
      </span>
      <span className="si-card__estcol" role="group" aria-label="Estimate">
        <span className="si-card__eyebrow">Estimate</span>
        {estimate ? (
          <>
            <span className="si-card__estimate si-mono">{estimate.display}</span>
            <span className="si-card__note">Granot estimate · {seen}</span>
          </>
        ) : (
          <>
            <span className="si-card__estimate is-null">—</span>
            <span className="si-card__note">No Granot estimate yet</span>
          </>
        )}
      </span>
    </span>
  );
}

// ── Next ──────────────────────────────────────────────────────────────────────────────────────────────────

/** `Due Sep 23, 10:00 AM ET · in 2h` / `… · overdue 40m`; `Due date needed` without a due time. */
function DueLine({ o, asOf }: { o: CardOutreach; asOf: string }) {
  const action = o.next_action!;
  if (!action.due_at) return <span className="si-card__due">{c.dueNeeded}</span>;
  const reference = action.attention_due_at ?? action.due_at;
  const overdue = o.facts?.next_action_state === "overdue";
  let tail: ReactNode = null;
  if (overdue) {
    const ms = elapsedMs(reference, asOf);
    if (Number.isFinite(ms)) tail = <span className="si-text--amber"> · {TIME_WORDS.overdue(formatDuration(ms))}</span>;
  } else {
    const countdown = formatCountdown(reference, asOf);
    if (countdown.kind !== "unknown") tail = ` · ${countdown.text}`;
  }
  return (
    <span className="si-card__due">
      {c.due} <time dateTime={action.due_at} title={formatExactFull(action.due_at)}><strong>{timePhrase(action.due_at, asOf, "exact").text}</strong></time>
      {tail}
    </span>
  );
}

export type NextTone = "action" | "overdue" | "suggested" | "none" | "closed" | "booked";

/**
 * The Next panel: the open next action (description, due, retry and a follow-up assignee other than the assigned rep,
 * the default note), else the suggested step with `Apply`, else `No next step set`. A closed card passes its outcome
 * line as `outcome`. The card's actions (`Message rep`) sit on the right.
 */
export function NextPanel({ o, asOf, onApply, selectedFollowup, outcome, outcomeLabel, booked = false, actions }: {
  o: CardOutreach; asOf: string; onApply?: () => void; selectedFollowup?: { id: string; name: string } | null;
  outcome?: ReactNode; outcomeLabel?: string; booked?: boolean; actions?: ReactNode;
}) {
  const action = o.next_action;
  const suggestion = o.suggested_next_step;
  const matchesSelected = !!selectedFollowup && action?.assignment?.agent?.id === selectedFollowup.id;
  const otherFollowup = selectedFollowup && !matchesSelected
    ? <span className="si-card__selected-followup" data-selected-followup="secondary">{copy.oi.repView.otherFollowup(selectedFollowup.name)}</span> : null;
  let tone: NextTone;
  let body: ReactNode;
  if (outcome) {
    tone = booked ? "booked" : "closed";
    body = (
      <>
        <span className="si-card__eyebrow">{outcomeLabel ?? "Closed"}</span>
        <span className="si-card__nexttext">{outcome}</span>
      </>
    );
  } else if (action) {
    const overdue = o.facts?.next_action_state === "overdue";
    tone = overdue ? "overdue" : "action";
    const assignee = action.assignment && (!action.assignment.agent || action.assignment.agent.id !== o.assignment.agent?.id)
      ? action.assignment.agent?.name ?? copy.oi.card.unassignedFollowup : null;
    const meta = [
      action.promise_chain?.attempt != null ? ch.retry(action.promise_chain.attempt) : null,
      assignee ? `Follow-up: ${assignee}` : null,
      action.default_kind === "quote_followup" ? `${ch.default} — ${ch.defaultTip}` : null,
    ].filter(Boolean) as string[];
    body = (
      <>
        <span className="si-card__eyebrow">{overdue ? `${copy.oi.card.next} · Overdue` : copy.oi.card.next}</span>
        <span className="si-card__nexttitle">{action.description}</span>
        <DueLine o={o} asOf={asOf} />
        {meta.length > 0 && <span className="si-card__note">{meta.join(" · ")}</span>}
        {otherFollowup}
      </>
    );
  } else if (suggestion) {
    tone = "suggested";
    body = (
      <>
        <span className="si-card__eyebrow">Suggested</span>
        <span className="si-card__nexttitle">{suggestion.description}</span>
        {suggestion.apply?.enabled && onApply && (
          <Button variant="link" size="sm" className="si-card__apply si-hit" aria-label={c.applyLabel(suggestion.description)} onClick={onApply}>{c.apply}</Button>
        )}
        {otherFollowup}
      </>
    );
  } else {
    tone = "none";
    body = (
      <>
        <span className="si-card__eyebrow">{copy.oi.card.next}</span>
        {otherFollowup ?? <span className="si-card__nexttext is-null">{c.noNextStep}</span>}
      </>
    );
  }
  return (
    <span className={cx("si-card__nextpanel", `is-${tone}`, matchesSelected && "is-selected-followup")} data-next={tone} data-selected-followup={matchesSelected ? "primary" : undefined}>
      <span className="si-card__nextbody">{body}</span>
      {actions && <span className="si-card__nextactions">{actions}</span>}
    </span>
  );
}

// ── Scores ────────────────────────────────────────────────────────────────────────────────────────────────

function ScoreBar({ o, which }: { o: CardOutreach; which: "ti" | "ml" }) {
  const a = o.move_assessment;
  const name = which === "ti" ? c.transactionIntent : c.moveLikelihood;
  const score = a ? (which === "ti" ? a.transaction_intent : a.move_likelihood) : null;
  const label = a ? scoreLabel(a.status, score, a.applicability) : scoreLabel(null, null);
  const numeric = label.endsWith("/ 100") && typeof score === "number";
  const level = a ? (which === "ti" ? a.transaction_intent_level_label : a.move_likelihood_level_label) : null;
  const width = numeric ? Math.max(0, Math.min(100, score)) : 0;
  return (
    <span className="si-card__score" data-score={which}>
      <span className="si-card__scorehead">
        <span className="si-card__scorename">{name}</span>{" "}
        {numeric
          ? <span className="si-card__scorevalue si-mono"><strong>{score}</strong><span className="si-text--subtle"> / 100</span></span>
          : <span className="si-card__scorevalue is-null">{label}</span>}
      </span>
      <span className="si-card__bar" aria-hidden><span className="si-card__barfill" style={{ "--si-score": width } as CSSProperties} /></span>
      {numeric && level && <span className="si-card__scorelevel">{level}</span>}
    </span>
  );
}

/** Two bars; the ordinal-scale note (and a stale reason) printed under them, never hover-only. */
export function ScoreBars({ o }: { o: CardOutreach }) {
  const lines = scoreTipLines(o);
  return (
    <span className="si-card__scoresblock">
      <span className="si-card__scoregrid">
        <ScoreBar o={o} which="ti" />
        <ScoreBar o={o} which="ml" />
      </span>
      <span className="si-card__note">{lines.join(" · ")}</span>
    </span>
  );
}

// ── Activity footer ───────────────────────────────────────────────────────────────────────────────────────

function Stat({ id, label, t, asOf, nullText }: { id: string; label: string; t: string | null | undefined; asOf: string; nullText: string }) {
  return (
    <span className={cx("si-card__stat", !t && "is-null")} data-stat={id}>
      <span className="si-card__statlabel">{label}</span>{" "}
      {t ? (
        <>
          <time className="si-card__statvalue" dateTime={t}>{timePhrase(t, asOf, "relative").text}</time>{" "}
          <span className="si-card__statexact">{formatExactFull(t)}</span>
        </>
      ) : <span className="si-card__statvalue">{nullText}</span>}
    </span>
  );
}

/** `6 calls / 2 conversations / 2 recordings analyzed / 1 recording not yet analyzed`; `No Number on file`. */
export function countParts(o: CardOutreach): string[] {
  const f = o.facts;
  if (!f || f.calls_total == null) return [c.noNumber];
  const parts = [c.calls(f.calls_total)];
  if (f.conversations_total != null) parts.push(c.conversations(f.conversations_total));
  if (f.recordings_analyzed != null) parts.push(c.recordingsAnalyzed(f.recordings_analyzed));
  // Arithmetic on two server counts (brief): never a state.
  if (f.recordings_available != null && f.recordings_analyzed != null && f.recordings_available > f.recordings_analyzed) {
    parts.push(c.recordingsPending(f.recordings_available - f.recordings_analyzed));
  }
  return parts;
}

/** Received · Last conversation · Last call (relative over the exact ET time), then the counts. */
export function ActivityFooter({ o, asOf }: { o: CardOutreach; asOf: string }) {
  return (
    <span className="si-card__activity">
      <span className="si-card__stats">
        {isNumberOnly(o)
          ? <span className="si-card__stat is-null" data-stat="received"><span className="si-card__statlabel">{c.received}</span> <span className="si-card__statvalue">{c.notALead}</span></span>
          : <Stat id="received" label={c.received} t={o.trigger_at} asOf={asOf} nullText={c.receivedUnknown} />}
        <Stat id="last-conversation" label={c.lastConversation} t={o.last_meaningful_contact_at} asOf={asOf} nullText={c.tile.none} />
        <Stat id="last-call" label={c.lastCall} t={o.facts?.last_call_at} asOf={asOf} nullText={c.tile.none} />
      </span>
      <Facts className="si-card__counts" items={countParts(o)} />
    </span>
  );
}
