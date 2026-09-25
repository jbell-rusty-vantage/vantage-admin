"use client";

import type { AttentionRow as Row } from "@/lib/api/salesIntelligence";
import { Badge } from "../atoms/badge";
import { Button } from "../atoms/button";
import { ReviewBadge } from "../chrome";
import { OwnershipSplit } from "../ownership";
import { CallStateBadge } from "../call-state";
import { ProvenanceBadge } from "../lead-provenance";
import { copy } from "../sales-intelligence-copy";
import { bandLabel, contactTypeLabel, cx, formatDateTime, formatSuppliedAge, label } from "../lib/format";
import { callStateOf, provenanceStateOf } from "../lib/owner-now";
import { LeadProgressLine } from "../lead-progress";
import { OUTREACH_SORT_OPTIONS, cardScores, sortKeyText, sortOption, type CardScores } from "../lib/sort";

function identity(row: Row) {
  const record = row.outreach;
  if (record?.primary_number?.e164) return record.primary_number.e164;
  if (row.subject.kind === "number_review") return copy.needsReview.title;
  return row.subject.model === "FormLead" ? "Form Lead" : "Call Lead";
}

function lastOutcome(record: NonNullable<Row["outreach"]>) {
  const call = record.latest_number_call;
  if (!call) return copy.time.notObserved;
  const result = call.provider_result ? label(call.provider_result) : null;
  return [label(call.direction), result, contactTypeLabel(call.contact_type)].filter(Boolean).join(" · ");
}

/**
 * Under a time or score sort the list is flat, so each card carries the band it would have been grouped
 * under. In `all_outreach` a row can sit outside Attention entirely; that is said, not shown as review.
 */
function BandTag({ row }: { row: Row }) {
  const band = row.derived.attention_band;
  // Server marker only: `in_attention: false` is outside Attention; any other band-less row is a review row.
  const text = band != null ? copy.sort.band(band, bandLabel(band)) : row.in_attention === false ? copy.sort.noBand : copy.needsReview.title;
  return (
    <Badge tone={band != null && band <= 2 ? "amber" : "neutral"} className="si-badge--wrap">
      {text}
    </Badge>
  );
}

/**
 * Move assessment §8.1: both scores, full labels, always visible, in one consistent place on
 * every Outreach card. Numbers are `N / 100`; Unknown / Pending / Not applicable / Not assessed
 * are server facts and read as words, never as zero.
 */
function ScoreRow({ scores, subject, onOpenAssessment }: { scores: CardScores; subject: string; onOpenAssessment?: () => void }) {
  return (
    <div className="si-row__scores">
      <span className="si-cardscores" role="group" aria-label={copy.scores.rowLabel}>
        {scores.scores.map((item, index) => (
          <span key={item.key} className="si-cardscores__item">
            {index > 0 && <span className="si-cardscores__sep" aria-hidden>·</span>}
            <span className="si-cardscores__label">{item.label}</span>{" "}
            <strong className={cx("si-cardscores__value", !item.numeric && "is-word")}>{item.value}</strong>
          </span>
        ))}
        {scores.stale && <Badge tone="amber" className="si-cardscores__flag" title={copy.scores.staleTip}>{copy.scores.stale}</Badge>}
        {scores.limited && <Badge className="si-cardscores__flag" title={copy.scores.limitedTip}>{copy.scores.limited}</Badge>}
      </span>
      {onOpenAssessment && (
        <Button variant="secondary" size="sm" className="si-cardscores__open" onClick={onOpenAssessment} aria-label={`${copy.scores.open} · ${subject}`}>
          {copy.scores.open}
        </Button>
      )}
    </div>
  );
}

export function AttentionRow({
  row,
  selected,
  onOpen,
  onOpenAssessment,
  showBand = false,
  sortedBy,
}: {
  row: Row;
  selected: boolean;
  onOpen: () => void;
  /** Opens this same subject on the assessment panel; absent for review-only rows (no Outreach to assess). */
  onOpenAssessment?: () => void;
  showBand?: boolean;
  sortedBy?: string;
}) {
  const sortOptionShown = sortedBy ? sortOption(OUTREACH_SORT_OPTIONS, sortedBy) : undefined;
  const sortValue = sortedBy && row.sort_keys ? (row.sort_keys as Record<string, unknown>)[sortedBy] : undefined;
  const record = row.outreach;
  const scores = record ? cardScores(row) : null;
  const sortedScore = sortOptionShown?.kind === "score" ? scores?.scores.find((item) => item.key === sortOptionShown.value) : undefined;
  const primary = row.derived.reasons[0];
  const secondary = row.derived.reasons.slice(1);
  const action = record?.followups.find((item) => item.status === "open");
  const onTheCall = callStateOf(record) === "in_progress";
  const provenance = provenanceStateOf(record);
  const tellsSomething = provenance === "attached_automatically" || provenance === "ambiguous" || provenance === "needs_a_lead";
  return (
    <li
      className={cx("si-row", selected && "is-selected", row.derived.overdue && "is-overdue", onTheCall && "is-live")}
      aria-current={selected || undefined}
      data-subject-key={row.subject_key}
    >
      <button type="button" className="si-row__hit" onClick={onOpen} aria-label={`${copy.actions.open} ${identity(row)}`} />
      <div className="si-row__identity">
        <strong className="si-phone">{identity(row)}</strong>
        {record?.lead_display && (
          <span className="si-row__name">
            {record.lead_display.name ?? copy.fields.unknown}
            {record.lead_display.job_no ? ` · Job ${record.lead_display.job_no}` : ""}
          </span>
        )}
        {record && <span className="si-text--subtle si-text--sm">{label(record.state)}</span>}
        {showBand && <BandTag row={row} />}
        {sortOptionShown && sortOptionShown.kind === "time" && (typeof sortValue === "string" || sortValue === null) && (
          <span className="si-text--sm si-text--subtle">{sortOptionShown.label}: {sortKeyText(sortOptionShown, sortValue, formatDateTime, copy.fields.unknown)}</span>
        )}
        {sortOptionShown && sortOptionShown.kind === "score" && (
          <span className="si-text--sm si-row__sortline">{sortOptionShown.label}: {sortedScore?.value ?? copy.scores.notAssessed}</span>
        )}
        <LeadProgressLine record={record} />
      </div>
      <div className="si-row__reason">
        <span className={cx("si-row__reasontext", row.derived.overdue && "is-danger")}>
          {primary ? label(primary) : copy.needsReview.title}
        </span>
        {!!row.derived.age_wall_ms && (
          <span className="si-age">{formatSuppliedAge(row.derived.age_wall_ms, row.derived.age_staffed_ms)}</span>
        )}
        {action && (
          <span className={cx("si-text--sm", !action.due_at && "si-text--amber")}>
            {label(action.kind)} · {action.due_at ? copy.time.due(formatDateTime(action.due_at)) : copy.time.dueDateNeeded}
          </span>
        )}
      </div>
      <div className="si-row__last">
        <span className="si-ownership__label">{copy.fields.lastActivity}</span>
        <span>{record ? lastOutcome(record) : copy.time.notObserved}</span>
        <span className="si-text--subtle si-text--sm">
          {copy.fields.lastMeaningfulContact} {formatDateTime(record?.last_meaningful_contact_at)}
        </span>
      </div>
      <div className="si-row__owner">
        <OwnershipSplit
          promisedBy={action?.origin === "rep_promise" ? action.promised_by : undefined}
          assignedTo={action?.assignment.agent}
          overallOwner={record?.assignment.agent ?? null}
        />
      </div>
      <div className="si-row__secondary">
        <span className="si-chiprow">
          {onTheCall && <CallStateBadge record={record} />}
          {record && tellsSomething && <ProvenanceBadge record={record} />}
          {secondary.map((reason) => (
            <span key={reason} className="si-text--sm si-text--muted">{label(reason)}</span>
          ))}
          {row.derived.review_badges?.map((reason) => <ReviewBadge key={reason} value={reason} />)}
          {row.derived.call_blockers.map((reason) => <Badge key={reason} className="si-badge--wrap">{label(reason)}</Badge>)}
        </span>
      </div>
      <div className="si-row__actions">
        <Button variant="ghost" size="sm" onClick={onOpen} aria-label={`${copy.actions.open} ${identity(row)}`}>
          {copy.actions.open}
        </Button>
      </div>
      {scores && <ScoreRow scores={scores} subject={identity(row)} onOpenAssessment={onOpenAssessment} />}
    </li>
  );
}

const assessmentOpener = (row: Row, open?: (row: Row) => void) => (open && row.outreach ? () => open(row) : undefined);

export function AttentionBands({
  items,
  selected,
  onOpen,
  onOpenAssessment,
}: {
  items: Row[];
  selected: (row: Row) => boolean;
  onOpen: (row: Row) => void;
  onOpenAssessment?: (row: Row) => void;
}) {
  const reviewOnly: Row[] = [];
  const groups = new Map<number, Row[]>();
  for (const row of items) {
    const band = row.derived.attention_band;
    if (band == null) reviewOnly.push(row);
    else groups.set(band, [...(groups.get(band) ?? []), row]);
  }
  const bands = [...groups.keys()].sort((a, b) => a - b);
  return (
    <div className="si-stack">
      {bands.map((band) => {
        const rows = groups.get(band) ?? [];
        return (
          <section key={band} className={cx("si-band", band <= 2 && "si-band--urgent")} aria-labelledby={`si-band-${band}`}>
            <h3 id={`si-band-${band}`} className="si-band__header">
              <span className="si-band__num" aria-hidden>{band}</span>
              <span>{bandLabel(band)}</span>
              <span className="si-band__count">{rows.length}</span>
            </h3>
            <ul className="si-rows">
              {rows.map((row) => (
                <AttentionRow key={row.subject_key} row={row} selected={selected(row)} onOpen={() => onOpen(row)} onOpenAssessment={assessmentOpener(row, onOpenAssessment)} />
              ))}
            </ul>
          </section>
        );
      })}
      {!!reviewOnly.length && (
        <section className="si-band" aria-labelledby="si-band-review">
          <h3 id="si-band-review" className="si-band__header">
            <span>{copy.needsReview.title}</span>
            <span className="si-band__count">{reviewOnly.length}</span>
          </h3>
          <ul className="si-rows">
            {reviewOnly.map((row) => (
              <AttentionRow key={row.subject_key} row={row} selected={selected(row)} onOpen={() => onOpen(row)} onOpenAssessment={assessmentOpener(row, onOpenAssessment)} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/**
 * LP-07 (§14.1) / Move assessment §8.2: under a time or score sort the server has already ordered the whole snapshot
 * across bands. Render exactly that order; grouping by band here would undo it.
 */
export function AttentionFlatList({
  items,
  selected,
  onOpen,
  onOpenAssessment,
  sortedBy,
}: {
  items: Row[];
  sortedBy?: string;
  selected: (row: Row) => boolean;
  onOpen: (row: Row) => void;
  onOpenAssessment?: (row: Row) => void;
}) {
  return (
    <ul className="si-rows si-rows--flat">
      {items.map((row) => (
        <AttentionRow key={row.subject_key} row={row} selected={selected(row)} onOpen={() => onOpen(row)} onOpenAssessment={assessmentOpener(row, onOpenAssessment)} showBand sortedBy={sortedBy} />
      ))}
    </ul>
  );
}
