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
import { useState } from "react";
import { numberSchema, readSalesIntelligence, type NumberRead, type Outreach } from "@/lib/api/salesIntelligence";
import { salesIntelligenceKeys } from "@/lib/query/salesIntelligence";
import { BANDS, copy } from "../sales-intelligence-copy";
import {
  ChipView, elapsedMs, identityText, lineOneChips,
  type CardChip, type CardRow,
} from "../card";
import { CommandDialog } from "../command-dialog";
import { useReportAsOf } from "../data/live";
import { siKeys } from "../data/query-keys";
import { useOutreach } from "../data/use-outreach";
import { MetricTiles, metricTiles } from "../card";
import { RepAvatar } from "../card/rep-avatar";
import { Button } from "../atoms/button";
import { Region, RegionProgress, SkeletonBlock, SkeletonLines, StatePill, type BandNumber } from "../primitives";
import { cx } from "../lib/format";
import { formatDuration, formatExact } from "../lib/time";
import { useIsRep } from "../rep/viewer";

const h = copy.ui1.outreach;

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
export function headerChips(row: CardRow, asOf: string, restriction: CallRestriction, known: boolean, { rep = false }: { rep?: boolean } = {}): CardChip[] {
  const ch = copy.ui1.chip.blocker;
  // UI2-SCOPE (UI-2 §3, TEAM-UI2 §10.4): a rep's chip comes from `derived.call_blockers` alone and reads `Don't call`
  // with no date (the end date is on the Owner-only Number read), and there is no `Needs review` chip.
  if (rep) {
    return lineOneChips(row, asOf, { rep })
      .filter((chip) => chip.id !== "needs-review")
      .map((chip) => (chip.id === "blocker-restriction" ? { ...chip, label: copy.ui2.scope.dontCallNoDate, tip: undefined } : chip));
  }
  return lineOneChips(row, asOf).map((chip) => {
    if (chip.id !== "blocker-restriction") return chip;
    if (!known) return { ...chip, tip: undefined };
    const label = restriction?.until ? ch.restrictionUntil(formatExact(restriction.until, asOf)) : ch.restrictionNoEnd;
    return { ...chip, label, tip: undefined };
  });
}

// ── Band line and line 7 ────────────────────────────────────────────────────────────────────────────────────

/** `{name} · Band {n} · for {duration}` (`about` when the start is estimated); `Not in Attention` for a null band. */
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

/**
 * The pure header (tests and the gallery render it from fixtures). UI2-SCOPE (UI-2 §3, E10): under a rep viewer it keeps
 * the call blocker chip (no date), the provenance line, the receiver agent and line 7, and drops every Owner control:
 * record commands, `Message rep`, Lead progress controls, `Attach a Lead` / `Review`, and the official-record links.
 */
export function RecordHeaderView({ outreach: o, asOf, restriction = null, restrictionKnown = false, onCommand, refreshing }: RecordHeaderViewProps) {
  const rep = useIsRep();
  const row = headerRow(o);
  const live = !!o.live_call || o.call_progress?.state === "in_progress";
  const assign = o.allowed_actions.find((action) => action.action === "assign");
  return (
    <header className={cx("si-now si-recordheader", live && "is-live", rep && "is-rep")} data-outreach={o.id} data-viewer={rep ? "rep" : undefined}>
      <RegionProgress active={!!refreshing} />
      <div className="si-now__identity">
        <div className="si-recordheader__l1" data-line="1">
          <p className="si-recordheader__band" data-band-line>{bandLine(o, asOf)}</p>
          <span className="si-chiprow">
            {headerChips(row, asOf, restriction, restrictionKnown, { rep }).map((chip) => <ChipView key={chip.id} chip={chip} />)}
          </span>
          <StatePill state={o.state} />
        </div>
        <div className="si-recordheader__hero"><h1 className="si-heading si-heading--1 si-recordheader__title">{o.lead_display?.name || identityText(o)}</h1><span className="si-recordheader__rep"><RepAvatar o={o} />{!rep && onCommand && assign && <Button variant="secondary" size="sm" disabled={!assign.enabled} onClick={() => onCommand("assign")}>{h.commands.assign}</Button>}</span></div>
        <p className="si-recordheader__line" data-line="2">{[o.primary_number?.e164, o.lead_display?.job_no ? `Job ${o.lead_display.job_no}` : null, o.lead_display?.source_company].filter(Boolean).join(" · ")}</p>
        {showReceiverAgent(o) && <p className="si-recordheader__line">{h.receiverAgent(o.receiver_agent!.agent!.name)}</p>}
        <MetricTiles tiles={metricTiles(o, asOf)} className="si-recordheader__tiles" />
      </div>
    </header>
  );
}

/**
 * UI2-SCOPE (A04): a rep's live header reads the detail only. No Number read (`GET /numbers/:id`), no nudge destinations
 * (`GET /reps`), no command dialog and no Message rep panel: those reads are Owner-only and would answer 403.
 */
function RepRecordHeaderLive({ id, returnTo }: { id: string; returnTo: string }) {
  const { outreach, asOf, isRefetching } = useOutreach(id);
  useReportAsOf(asOf);
  return <RecordHeaderView outreach={outreach} asOf={asOf} returnTo={returnTo} refreshing={isRefetching} />;
}

/** The viewer picks the live header at the smallest mount point, so an Owner-only hook never runs for a rep. */
function RecordHeaderLive({ id, returnTo }: { id: string; returnTo: string }) {
  return useIsRep() ? <RepRecordHeaderLive id={id} returnTo={returnTo} /> : <OwnerRecordHeaderLive id={id} returnTo={returnTo} />;
}

/** The live header: the detail read, the restriction read, the command dialog and the Message rep panel. */
function OwnerRecordHeaderLive({ id, returnTo }: { id: string; returnTo: string }) {
  const { outreach, asOf, isRefetching } = useOutreach(id);
  useReportAsOf(asOf);
  const { restriction, known } = useCallRestriction(outreach);
  const [command, setCommand] = useState<string | null>(null);
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
      />
      {command && <CommandDialog key={`${command}:${outreach.id}`} command={command} record={outreach} onClose={() => setCommand(null)} />}
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
