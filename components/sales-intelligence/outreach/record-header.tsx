"use client";
/**
 * UI1-SHELL: the record header, the "Now" strip (UI-1 §5.1, UX26). Read live from `GET /outreach/:id` at the request
 * `as_of`. Today's now-strip layout: identity with its chips, the route, the three times and the counts (card lines
 * 1–4), the next step with its due or overdue state, line 7 (who, the receiver agent, why), the band line, then the
 * Lead progress controls, the Lead provenance block, the official-record links and the command group.
 *
 * Every state is a server field. The only comparisons are the spec's own: the receiver agent shows when it differs from
 * the assigned rep or the assignment origin is `owner` (E26), and `Don't call until {date}` takes the active call
 * restriction's `until` from the Number read (the detail read carries no restrictions).
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useState, type ReactNode } from "react";
import { numberSchema, readSalesIntelligence, type NumberRead, type Outreach } from "@/lib/api/salesIntelligence";
import { salesIntelligenceKeys } from "@/lib/query/salesIntelligence";
import { BANDS, copy } from "../sales-intelligence-copy";
import {
  CardTip, ChipView, LineSix, LineThree, countsText, elapsedMs, identityText, lineOneChips, reasonSegment, routeText, uncertainFiveText, whoText,
  type CardChip, type CardRow,
} from "../card";
import { MessageRepPanel, useMessageRepAvailability } from "../composer";
import { CommandDialog } from "../command-dialog";
import { useReportAsOf } from "../data/live";
import { siKeys } from "../data/query-keys";
import { useOutreach } from "../data/use-outreach";
import { LeadProgressSection } from "../lead-progress";
import { RecordProvenance } from "../lead-provenance";
import { RelatedRecordChips } from "../related-record-chips";
import { BandBadge, Region, RegionProgress, SkeletonBlock, SkeletonLines, StatePill, type BandNumber } from "../primitives";
import { cx } from "../lib/format";
import { formatDuration, formatExact } from "../lib/time";
import { RecordCommands } from "./commands";

const h = copy.ui1.outreach;
const SEP = " · ";

const isBand = (n: unknown): n is BandNumber => typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 7;

/** The Outreach subject's key (`lead:{model}:{id}` / `number:{id}`), the review-items filter. */
export function subjectKeyOf(o: Pick<Outreach, "subject">): string {
  return o.subject.kind === "lead" ? `lead:${o.subject.model}:${o.subject.id}` : `number:${o.subject.contact_number_id}`;
}

/** The detail read shaped as a card row, so the card's line renderers read it unchanged (no `filter_keys` on a detail). */
export function headerRow(o: Outreach): CardRow {
  return { subject_key: subjectKeyOf(o), subject: o.subject, outreach: o, derived: o.derived } as CardRow;
}

/** The record's Contact Number id: `primary_number`, or the Number a Number-review subject is about. */
export function numberIdOf(o: Outreach): string | null {
  return o.primary_number?.id ?? (o.subject.kind === "number_review" ? o.subject.contact_number_id : null);
}

// ── Call restriction (`Don't call until {date}`) ────────────────────────────────────────────────────────────

export type CallRestriction = { until: string | null } | null;

/**
 * The active call restriction on the record's Number: state `active` with `call` among its channels (server enums).
 * With several, one with no end wins; otherwise the latest `until` (both are server times; nothing is compared to a clock).
 */
export function activeCallRestriction(rows: NumberRead["data"]["restrictions"] | undefined): CallRestriction {
  const active = (rows ?? []).filter((r) => r.state === "active" && r.channels.includes("call"));
  if (!active.length) return null;
  if (active.some((r) => !r.until)) return { until: null };
  return { until: active.map((r) => r.until!).sort().at(-1)! };
}

/** The Number read (same key and schema as the legacy page, so they share a cache), only while `restriction` blocks calls. */
export function useCallRestriction(o: Outreach): { restriction: CallRestriction; known: boolean } {
  const numberId = numberIdOf(o);
  const blocked = o.derived.call_blockers.includes("restriction");
  const query = useQuery({
    queryKey: [...salesIntelligenceKeys.all, "number", numberId],
    queryFn: ({ signal }) => readSalesIntelligence(`numbers/${encodeURIComponent(numberId!)}`, numberSchema, signal),
    enabled: blocked && !!numberId,
    retry: false,
  });
  return { restriction: query.data ? activeCallRestriction(query.data.data.restrictions) : null, known: !!query.data };
}

/**
 * Line 1 chips for the header: the card's chips (live, blockers, Needs review, Details disagree, Newer call), with the
 * `restriction` chip reading `Don't call until {date}` (or `Don't call` with no end) once the restriction is known.
 * Until then it reads the card's `Don't call`.
 */
export function headerChips(row: CardRow, asOf: string, restriction: CallRestriction, known: boolean): CardChip[] {
  const ch = copy.ui1.chip.blocker;
  return lineOneChips(row, asOf).map((chip) => {
    if (chip.id !== "blocker-restriction") return chip;
    if (!known) return { ...chip, tip: undefined };
    const label = restriction?.until ? ch.restrictionUntil(formatExact(restriction.until, asOf)) : ch.restrictionNoEnd;
    return { ...chip, label, tip: undefined };
  });
}

// ── Band line and line 7 ────────────────────────────────────────────────────────────────────────────────────

/** `Band {n} · {name} · for {duration}` (`about` when the start is estimated); `Not in Attention` for a null band. */
export function bandLine(o: Outreach, asOf: string): string {
  const band = o.derived.attention_band;
  if (!isBand(band)) return copy.ui1.prim.notInAttention;
  const name = BANDS[band];
  const since = o.band_since;
  if (!since) return h.bandOnly(band, name);
  const ms = elapsedMs(since.at, asOf);
  if (!Number.isFinite(ms)) return h.bandOnly(band, name);
  return h.bandFor(band, name, formatDuration(ms, { about: since.estimated }));
}

/** E26: the receiver agent shows beside the assignment when it differs from the assigned rep or the Owner assigned. */
export function showReceiverAgent(o: Pick<Outreach, "receiver_agent" | "assignment">): boolean {
  const receiver = o.receiver_agent?.agent;
  if (!receiver) return false;
  return o.assignment.origin === "owner" || receiver.id !== o.assignment.agent?.id;
}

/** The receiver agent's tooltip: `Set {t} from {source}.` with the specific wording when either is missing. */
export function receiverTip(o: Pick<Outreach, "receiver_agent">, asOf: string): string | null {
  const r = o.receiver_agent;
  if (!r) return null;
  const source = r.source ? h.receiverSource[r.source] ?? r.source.replaceAll("_", " ") : null;
  const t = r.set_at ? formatExact(r.set_at, asOf) : null;
  if (t && source) return h.receiverTip(t, source);
  if (source) return h.receiverTipNoTime(source);
  if (t) return h.receiverTipNoSource(t);
  return null;
}

function HeaderLineSeven({ o, row, asOf }: { o: Outreach; row: CardRow; asOf: string }) {
  const parts: ReactNode[] = [<span key="who" data-seg="who">{whoText(o)}</span>];
  if (showReceiverAgent(o)) {
    const tip = receiverTip(o, asOf);
    const text = <span data-seg="receiver">{h.receiverAgent(o.receiver_agent!.agent!.name)}</span>;
    parts.push(tip ? <CardTip key="receiver" title={h.receiverTipTitle} lines={[tip]} label={text} /> : <Fragment key="receiver">{text}</Fragment>);
  }
  const why = reasonSegment({ outreach: o, derived: row.derived }, asOf);
  if (why) parts.push(<CardTip key="why" title={copy.ui1.reason.allTitle} lines={why.tooltipLines} label={<span data-seg="why">{why.text}</span>} />);
  const five = uncertainFiveText(o);
  if (five) parts.push(<span key="lp" data-seg="lead-progress">{five}</span>);
  return (
    <p className="si-recordheader__line si-card__l7" data-line="7">
      {parts.map((part, i) => <Fragment key={i}>{i > 0 && SEP}{part}</Fragment>)}
    </p>
  );
}

// ── The header ──────────────────────────────────────────────────────────────────────────────────────────────

export type RecordHeaderViewProps = {
  outreach: Outreach;
  asOf: string;
  /** The URL the official-record links return to (`si_return`): this route. */
  returnTo: string;
  restriction?: CallRestriction;
  restrictionKnown?: boolean;
  onCommand?: (command: string) => void;
  onMessageRep?: () => void;
  messageRepDisabledReason?: string | null;
  refreshing?: boolean;
};

/** The pure header (tests and the gallery render it from fixtures). */
export function RecordHeaderView({ outreach: o, asOf, returnTo, restriction = null, restrictionKnown = false, onCommand, onMessageRep, messageRepDisabledReason, refreshing }: RecordHeaderViewProps) {
  const row = headerRow(o);
  const band = o.derived.attention_band;
  const route = routeText(o, asOf);
  const live = !!o.live_call || o.call_progress?.state === "in_progress";
  return (
    <header className={cx("si-now si-recordheader", live && "is-live")} data-outreach={o.id}>
      <RegionProgress active={!!refreshing} />
      <div className="si-now__identity">
        <div className="si-recordheader__l1" data-line="1">
          <h1 className="si-heading si-heading--1 si-recordheader__title">{identityText(o)}</h1>
          <span className="si-chiprow">
            {headerChips(row, asOf, restriction, restrictionKnown).map((chip) => <ChipView key={chip.id} chip={chip} />)}
          </span>
          <span className="si-recordheader__side">
            <StatePill state={o.state} />
            <BandBadge band={isBand(band) ? band : null} />
          </span>
        </div>
        {route && <p className="si-recordheader__line" data-line="2">{route}</p>}
        <p className="si-recordheader__line" data-line="3"><LineThree o={o} asOf={asOf} /></p>
        <p className="si-recordheader__line si-text--subtle" data-line="4">{countsText(o)}</p>
      </div>

      <div className="si-now__headline">
        <p className="si-recordheader__line" data-line="6"><LineSix o={o} asOf={asOf} /></p>
        <HeaderLineSeven o={o} row={row} asOf={asOf} />
        <p className="si-recordheader__line si-recordheader__band" data-band-line>{bandLine(o, asOf)}</p>
        <LeadProgressSection record={o} onCommand={onCommand} />
      </div>

      <RecordProvenance record={o} asOfText={(t) => formatExact(t, asOf)} />

      <RelatedRecordChips outreach={o} numberId={numberIdOf(o)} returnTo={returnTo} />

      {onCommand && (
        <RecordCommands record={o} onCommand={onCommand} onMessageRep={onMessageRep} messageRepDisabledReason={messageRepDisabledReason} />
      )}
    </header>
  );
}

/** The live header: the detail read, the restriction read, the command dialog and the Message rep panel. */
function RecordHeaderLive({ id, returnTo }: { id: string; returnTo: string }) {
  const { outreach, asOf, isRefetching } = useOutreach(id);
  useReportAsOf(asOf);
  const { restriction, known } = useCallRestriction(outreach);
  const availability = useMessageRepAvailability(outreach);
  const [command, setCommand] = useState<string | null>(null);
  const [messaging, setMessaging] = useState(false);
  return (
    <>
      <RecordHeaderView
        outreach={outreach}
        asOf={asOf}
        returnTo={returnTo}
        restriction={restriction}
        restrictionKnown={known}
        refreshing={isRefetching}
        onCommand={setCommand}
        onMessageRep={() => setMessaging(true)}
        messageRepDisabledReason={availability.disabledReason}
      />
      {command && <CommandDialog key={`${command}:${outreach.id}`} command={command} record={outreach} onClose={() => setCommand(null)} />}
      {messaging && <MessageRepPanel key={outreach.id} outreach={outreach} asOf={asOf} mode="panel" onClose={() => setMessaging(false)} />}
    </>
  );
}

/** The header's shaped skeleton: the title, three lines, the headline column, the provenance box and the command row. */
export function RecordHeaderSkeleton() {
  return (
    <div className="si-now si-recordheader is-skeleton" aria-hidden>
      <div className="si-now__identity">
        <SkeletonLines lines={1} widths={["46%"]} className="si-recordheader__skeltitle" />
        <SkeletonLines lines={3} widths={["58%", "72%", "40%"]} />
      </div>
      <div className="si-now__headline">
        <SkeletonLines lines={3} widths={["64%", "70%", "36%"]} />
      </div>
      <SkeletonBlock height={96} />
      <div className="si-now__deck"><SkeletonBlock height={44} width="60%" /></div>
    </div>
  );
}

/** The record header in its own region (UI-0 §2.4): skeleton after 150 ms, `Couldn't load this.` + `Try again`. */
export function RecordHeader({ id, returnTo }: { id: string; returnTo: string }) {
  const client = useQueryClient();
  return (
    <Region name="record-header" skeleton={<RecordHeaderSkeleton />} onRetry={() => void client.resetQueries({ queryKey: siKeys.outreach(id) })}>
      <RecordHeaderLive id={id} returnTo={returnTo} />
    </Region>
  );
}

RecordHeader.Skeleton = RecordHeaderSkeleton;
