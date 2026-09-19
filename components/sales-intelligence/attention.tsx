"use client";

import type { AttentionRow as Row } from "@/lib/api/salesIntelligence";
import { Badge } from "./atoms/badge";
import { Button } from "./atoms/button";
import { ReviewBadge } from "./chrome";
import { OwnershipSplit } from "./ownership";
import { copy } from "./sales-intelligence-copy";
import { bandLabel, contactTypeLabel, cx, formatDateTime, formatSuppliedAge, label } from "./lib/format";

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

export function AttentionRow({ row, selected, onOpen }: { row: Row; selected: boolean; onOpen: () => void }) {
  const record = row.outreach;
  const primary = row.derived.reasons[0];
  const secondary = row.derived.reasons.slice(1);
  const action = record?.followups.find((item) => item.status === "open");
  return (
    <li className={cx("si-row", selected && "is-selected", row.derived.overdue && "is-overdue")} aria-current={selected || undefined}>
      <button type="button" className="si-row__hit" onClick={onOpen} aria-label={`${copy.actions.open} ${identity(row)}`} />
      <div className="si-row__identity">
        <strong className="si-phone">{identity(row)}</strong>
        {record?.lead_display && (
          <span className="si-row__name">
            {record.lead_display.name ?? copy.fields.unknown}
            {record.lead_display.job_no ? ` · Job ${record.lead_display.job_no}` : ""}
          </span>
        )}
        <span className="si-text--subtle si-text--sm">{record ? label(record.state) : copy.needsReview.title}</span>
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
          {secondary.map((reason) => (
            <span key={reason} className="si-text--sm si-text--muted">{label(reason)}</span>
          ))}
          {row.derived.review_badges?.map((reason) => <ReviewBadge key={reason} value={reason} />)}
          {row.derived.call_blockers.map((reason) => <Badge key={reason}>{label(reason)}</Badge>)}
        </span>
      </div>
      <div className="si-row__actions">
        <Button variant="ghost" size="sm" onClick={onOpen} aria-label={`${copy.actions.open} ${identity(row)}`}>
          {copy.actions.open}
        </Button>
      </div>
    </li>
  );
}

export function AttentionBands({
  items,
  selected,
  onOpen,
}: {
  items: Row[];
  selected: (row: Row) => boolean;
  onOpen: (row: Row) => void;
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
                <AttentionRow key={row.subject_key} row={row} selected={selected(row)} onOpen={() => onOpen(row)} />
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
              <AttentionRow key={row.subject_key} row={row} selected={selected(row)} onOpen={() => onOpen(row)} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
