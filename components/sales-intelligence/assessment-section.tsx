"use client";
/**
 * Move assessment section (specification §6, §8.1, §8.3). Reads only the Owner
 * presentation DTO: both scores, their reasons, freshness and coverage, three
 * separately labelled move views, inventory and conflicts. Nothing here starts
 * a model call, edits a Lead or derives a score.
 */
import { useId, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { SalesIntelligenceError } from "@/lib/api/salesIntelligence";
import {
  applicabilityText, availabilityText, confidenceText, coverageText, freshnessText, groupObservations, historicalScoreText, inputModeText,
  itemStatusText, levelText, moveViewRows, observationStatusText, observationText, originalViewLabel, quantityText, readAssessment,
  readOutreachAssessment, scoreText, sourceCoverageText, versionOption, type AssessmentSection as Section, type EvidenceRef, type MoveView,
  type Score,
} from "@/lib/api/salesIntelligenceAssessment";
import { salesIntelligenceKeys } from "@/lib/query/salesIntelligence";
import { Badge, type Tone } from "./atoms/badge";
import { Button } from "./atoms/button";
import { EmptyState } from "./chrome";
import { assessmentCopy as copy } from "./evidence-chain-copy";
import { copy as siCopy } from "./sales-intelligence-copy";
import { formatDateTime } from "./lib/format";

/** A citation the Owner followed. `key` identifies the button, so Back can return focus to it. */
export type CiteTarget =
  | { source: "assessment"; artifactId: string; ids: string[]; label: string; key: string }
  | { source: "run"; runId: string; ids: string[]; label: string; key: string };

export const assessmentQueryKey = (outreachId: string | null) => [...salesIntelligenceKeys.all, "assessment", outreachId] as const;
export function useOutreachAssessment(outreachId: string | null) {
  return useQuery({ queryKey: assessmentQueryKey(outreachId), enabled: !!outreachId, retry: false,
    queryFn: ({ signal }) => readOutreachAssessment(outreachId!, signal) });
}
export function useAssessmentArtifact(artifactId: string | null) {
  return useQuery({ queryKey: [...salesIntelligenceKeys.all, "assessment-artifact", artifactId], enabled: !!artifactId, retry: false,
    queryFn: ({ signal }) => readAssessment(artifactId!, signal) });
}
const SCORED = new Set(["ready", "insufficient_evidence"]);
const availabilityTone = (value: string): Tone =>
  value === "ready" ? "green" : value === "pending" ? "blue" : value === "not_assessed" || value === "not_applicable" ? "neutral" : "amber";
const time = (value: string | null) => (value ? formatDateTime(value) : copy.notRecorded);

/** Label/value rows on a per-row grid: each row is its own grid, so a wrapper can never land in the wrong column. */
export function FieldRows({ rows, className }: { rows: { label: string; value: ReactNode }[]; className?: string }) {
  if (!rows.length) return null;
  return <dl className={className ? `si-fields ${className}` : "si-fields"}>{rows.map((row) => (
    <div key={row.label} className="si-fields__row"><dt>{row.label}</dt><dd>{row.value}</dd></div>
  ))}</dl>;
}

export function CiteButton({ refs, label, citeKey, onCite, artifactId }: {
  refs: readonly EvidenceRef[]; label: string; citeKey: string; artifactId: string | null; onCite: (target: CiteTarget) => void;
}) {
  if (!refs.length || !artifactId) return <span className="si-text--subtle si-cite--none">{copy.noEvidence}</span>;
  return <Button size="sm" variant="link" className="si-cite" data-cite={citeKey} aria-label={`${copy.viewEvidence(refs.length)}: ${label}`}
    onClick={() => onCite({ source: "assessment", artifactId, ids: refs.map((ref) => ref.id), label, key: citeKey })}>
    {copy.viewEvidence(refs.length)}
  </Button>;
}

function ScoreCard({ name, score, artifactId, onCite }: { name: "transaction_intent" | "move_likelihood"; score: Score; artifactId: string | null; onCite: (target: CiteTarget) => void }) {
  const id = useId();
  const historical = historicalScoreText(score);
  return <article className="si-score" aria-labelledby={id}>
    <h5 id={id} className="si-score__name">{copy.score[name]}</h5>
    <p className="si-score__value">{scoreText(score)}</p>
    {historical && <p className="si-text--subtle">{historical}</p>}
    <p className="si-score__help">{copy.scoreHelp[name]}</p>
    <FieldRows rows={[
      { label: copy.rows.level, value: levelText(score.level) },
      { label: copy.rows.confidence, value: confidenceText(score.confidence) },
      { label: copy.rows.freshness, value: score.stale ? <Badge tone="amber" className="si-badge--wrap">{freshnessText(score)}</Badge> : freshnessText(score) },
      { label: copy.rows.applicability, value: applicabilityText(score.applicability) },
    ]} />
    {score.rationale && <div className="si-score__why"><h6>{copy.rationale}</h6><p>{score.rationale}</p></div>}
    {score.conditions.length > 0 && <div className="si-score__why"><h6>{copy.conditions}</h6><ul>{score.conditions.map((condition, index) => <li key={index}>{condition}</li>)}</ul></div>}
    <CiteButton refs={score.evidence} label={copy.score[name]} citeKey={`score:${name}`} artifactId={artifactId} onCite={onCite} />
  </article>;
}

function ViewCard({ title, hint, view, footer }: { title: string; hint: string; view: MoveView | null; footer?: ReactNode }) {
  const id = useId();
  return <article className="si-view" aria-labelledby={id}>
    <h5 id={id} className="si-view__title">{title}</h5>
    <p className="si-view__hint">{hint}</p>
    {view ? <FieldRows rows={moveViewRows(view)} /> : <p className="si-text--subtle">{copy.views.none}</p>}
    {footer}
  </article>;
}

function MoveViews({ section, onCite }: { section: Section; onCite: (target: CiteTarget) => void }) {
  const original = section.views.original_ingestion, current = section.views.canonical_current;
  const groups = groupObservations(section.views.customer_stated);
  return <section className="si-assess__block" aria-label={copy.views.title}>
    <h4>{copy.views.title}</h4>
    <p className="si-text--subtle">{copy.views.intro}</p>
    <div className="si-views">
      <ViewCard title={originalViewLabel(original)} hint={copy.views.originalHint} view={original}
        footer={original?.captured_at ? <p className="si-view__meta">{copy.views.capturedAt(formatDateTime(original.captured_at))}</p> : null} />
      <ViewCard title={copy.views.current} hint={copy.views.currentHint} view={current}
        footer={current?.provenance?.changed_at ? <p className="si-view__meta">{copy.views.changedAt(formatDateTime(current.provenance.changed_at))}</p> : null} />
      <article className="si-view" aria-label={copy.views.customer}>
        <h5 className="si-view__title">{copy.views.customer}</h5>
        <p className="si-view__hint">{copy.views.customerHint}</p>
        {!groups.length && <p className="si-text--subtle">{copy.views.customerNone}</p>}
        {groups.map((group) => <div key={group.field} className="si-said">
          <h6 className="si-said__field">{group.label}</h6>
          <ul className="si-said__list">{group.items.map((item, index) => <li key={index} className="si-said__item">
            <span className="si-said__text">{observationText(item)}</span>
            <span className="si-said__meta">
              <Badge tone={item.status === "stated" ? "neutral" : "amber"} className="si-badge--wrap">{observationStatusText(item.status)}</Badge>
              <CiteButton refs={item.evidence} label={`${copy.views.customer}: ${group.label}`} citeKey={`said:${group.field}:${index}`} artifactId={section.artifact_id} onCite={onCite} />
            </span>
          </li>)}</ul>
        </div>)}
      </article>
    </div>
  </section>;
}

function Inventory({ section, onCite }: { section: Section; onCite: (target: CiteTarget) => void }) {
  const inventory = section.inventory, columns = copy.inventory.columns;
  return <section className="si-assess__block" aria-label={copy.inventory.title}>
    <h4>{copy.inventory.title}</h4>
    <FieldRows rows={[
      { label: copy.rows.inventoryCoverage, value: coverageText(inventory.coverage) },
      { label: copy.rows.sourceCoverage, value: sourceCoverageText(inventory.source_coverage) },
    ]} />
    <p className="si-text--subtle">{copy.inventory.coverageNote}</p>
    {inventory.limitations.length > 0 && <div className="si-score__why"><h6>{copy.inventory.limitations}</h6>
      <ul>{inventory.limitations.map((limit, index) => <li key={index}>{limit}</li>)}</ul></div>}
    {!inventory.items.length ? <p>{copy.inventory.none}</p> : (
      <div className="si-inv" role="region" aria-label={copy.inventory.title} tabIndex={0}>
        <table className="si-inv__table">
          <thead><tr><th scope="col">{columns.item}</th><th scope="col">{columns.quantity}</th><th scope="col">{columns.room}</th>
            <th scope="col">{columns.dimensions}</th><th scope="col">{columns.handling}</th><th scope="col">{columns.status}</th><th scope="col">{columns.evidence}</th></tr></thead>
          <tbody>{inventory.items.map((item, index) => <tr key={index}>
            <th scope="row" data-label={columns.item}>{item.label}</th>
            <td data-label={columns.quantity}>{quantityText(item.quantity)}</td>
            <td data-label={columns.room}>{item.room ?? copy.scoreWord.unknown}</td>
            <td data-label={columns.dimensions}>{item.dimensions ? `${item.dimensions.text}${item.dimensions.unit ? ` ${item.dimensions.unit}` : ""}` : "—"}</td>
            <td data-label={columns.handling}>{item.handling ?? "—"}</td>
            <td data-label={columns.status}>{itemStatusText(item.status)}</td>
            <td data-label={columns.evidence}><CiteButton refs={item.evidence} label={`${copy.inventory.title}: ${item.label}`} citeKey={`item:${index}`} artifactId={section.artifact_id} onCite={onCite} /></td>
          </tr>)}</tbody>
        </table>
      </div>
    )}
  </section>;
}

function Conflicts({ section, onCite }: { section: Section; onCite: (target: CiteTarget) => void }) {
  return <section className="si-assess__block" aria-label={copy.conflicts.title}>
    <h4>{copy.conflicts.title}</h4>
    {!section.conflicts.length ? <p className="si-text--subtle">{copy.conflicts.none}</p> : (
      <ul className="si-conflicts">{section.conflicts.map((conflict, index) => <li key={index} className="si-conflict">
        <strong>{conflict.affects.replaceAll("_", " ")}</strong>
        <p>{conflict.explanation}</p>
        <CiteButton refs={conflict.evidence} label={`${copy.conflicts.title}: ${conflict.affects}`} citeKey={`conflict:${index}`} artifactId={section.artifact_id} onCite={onCite} />
      </li>)}</ul>
    )}
  </section>;
}

/** The body of one assessment version. Content renders only for scored availability; every other state says what it is. */
export function AssessmentBody({ section, onCite }: { section: Section; onCite: (target: CiteTarget) => void }) {
  const explain = copy.availabilityExplain[section.availability as keyof typeof copy.availabilityExplain];
  const scored = SCORED.has(section.availability);
  return <>
    {section.availability !== "ready" && explain && <p role="status" className={scored ? "si-local-notice" : "si-assess__state"}>{explain}</p>}
    {section.shadow && <p className="si-local-notice">{copy.shadowNote}</p>}
    <div className="si-scores">
      <ScoreCard name="transaction_intent" score={section.transaction_intent} artifactId={section.artifact_id} onCite={onCite} />
      <ScoreCard name="move_likelihood" score={section.move_likelihood} artifactId={section.artifact_id} onCite={onCite} />
    </div>
    <p className="si-text--subtle">{copy.scoreNote}</p>
    <details className="si-chain__disclose">
      <summary>{copy.provenance}</summary>
      <div className="si-chain__panel">
        <FieldRows rows={[
          { label: copy.rows.generated, value: time(section.generated_at) },
          { label: copy.rows.contextAsOf, value: time(section.context_as_of) },
          { label: copy.rows.latestConversation, value: time(section.latest_conversation_at) },
          { label: copy.rows.inputMode, value: inputModeText(section.input_mode) },
          { label: copy.rows.conversations, value: section.coverage ? copy.coverage.selected(section.coverage.conversations_selected, section.coverage.conversations_available) : copy.notRecorded },
          { label: copy.rows.findings, value: section.coverage ? String(section.coverage.findings_selected) : copy.notRecorded },
          { label: copy.rows.sourceCoverage, value: sourceCoverageText(section.inventory.source_coverage) },
          { label: copy.rows.schema, value: section.schema_version ?? copy.notRecorded },
          { label: copy.rows.rubric, value: section.rubric_version ?? copy.notRecorded },
          { label: copy.rows.model, value: section.model_version ?? copy.notRecorded },
        ]} />
      </div>
    </details>
    {scored && <>
      <MoveViews section={section} onCite={onCite} />
      <Inventory section={section} onCite={onCite} />
      <Conflicts section={section} onCite={onCite} />
    </>}
  </>;
}

export function AssessmentSection({ outreachId, artifactId, onArtifact, onCite, onFullOutput }: {
  outreachId: string | null;
  /** The version the Owner picked; null means the subject's current assessment. */
  artifactId: string | null;
  onArtifact: (artifactId: string | null) => void;
  onCite: (target: CiteTarget) => void;
  onFullOutput: (artifactId: string) => void;
}) {
  const headingId = useId(), pickerId = useId();
  const subject = useOutreachAssessment(outreachId);
  const currentId = subject.data?.data.current?.artifact_id ?? null;
  const wanted = artifactId && artifactId !== currentId ? artifactId : null;
  const picked = useAssessmentArtifact(wanted);
  if (!outreachId) return <EmptyState title={copy.sections.assessment}>{copy.noSubject}</EmptyState>;
  const head = (badge?: ReactNode, actions?: ReactNode) => <header className="si-assess__head">
    <h4 id={headingId}>{copy.sections.assessment}</h4>{badge}{actions}
  </header>;
  if (subject.isPending) return <section className="si-assess" aria-labelledby={headingId}>{head()}<p role="status">{copy.loading}</p></section>;
  if (subject.error) {
    const missing = subject.error instanceof SalesIntelligenceError && subject.error.status === 404;
    return <section className="si-assess" aria-labelledby={headingId}>{head()}
      {missing ? <p>{copy.notFound}</p> : <p role="alert">{copy.failed} <Button variant="link" onClick={() => void subject.refetch()}>{siCopy.actions.retry}</Button></p>}
    </section>;
  }
  const data = subject.data!.data;
  const section = wanted ? picked.data?.data ?? null : data.current;
  // The subject's availability wins for the current view (closure makes it Not applicable even over a ready artifact);
  // a picked earlier version shows its own status once loaded, and no badge while it loads.
  const availability = wanted ? section?.availability ?? null : data.availability;
  const shownId = section?.artifact_id ?? null;
  return <section className="si-assess" aria-labelledby={headingId}>
    {head(availability ? <Badge tone={availabilityTone(availability)}>{availabilityText(availability)}</Badge> : null,
      shownId ? <Button variant="primary" className="si-assess__output" onClick={() => onFullOutput(shownId)}>{copy.viewFullOutput}</Button> : null)}
    {data.subject.applicability !== "active" && <p className="si-local-notice">{applicabilityText(data.subject.applicability)}</p>}
    {data.versions.length > 0 && <div className="si-assess__versions">
      <label htmlFor={pickerId} className="si-assess__label">{copy.versions.label}</label>
      <select id={pickerId} className="si-select si-assess__select" value={shownId ?? currentId ?? ""}
        onChange={(event) => onArtifact(event.target.value === currentId ? null : event.target.value)}>
        {data.versions.map((version) => { const option = versionOption(version, time); return <option key={option.id} value={option.id}>{option.label}</option>; })}
      </select>
      <p className="si-text--subtle">{copy.versions.intro}</p>
    </div>}
    {wanted && picked.isPending && <p role="status">{copy.loading}</p>}
    {wanted && picked.error && <p role="alert">{copy.failed} <Button variant="link" onClick={() => void picked.refetch()}>{siCopy.actions.retry}</Button></p>}
    {section ? <AssessmentBody key={shownId ?? "none"} section={section} onCite={onCite} />
      : !wanted && <p role="status" className="si-assess__state">{copy.availabilityExplain[data.availability as keyof typeof copy.availabilityExplain] ?? availabilityText(data.availability)}</p>}
  </section>;
}
