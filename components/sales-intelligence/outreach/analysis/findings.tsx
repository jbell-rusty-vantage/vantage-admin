"use client";
/**
 * UI1-FIND: Findings (final spec §11.5). The current findings of this subject's Number (`GET /outreach/:id/findings`),
 * grouped by category in the fixed order, a count on each header, newest call first within a category (server order).
 * Every word is the server's (`category_label`, `source_word`, `action_status_word`, `value_line`,
 * `work_result_detail`); `Work result` comes from the server enum and is never derived from effects. Review actions come
 * from `allowed_actions`. After the categories: `Changes since the last analysis ({n})` from the newest run's
 * `prior_finding_relations`, and `Your changes and what the model made of them`.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useState, useTransition, type ReactNode } from "react";
import type { CurrentFinding } from "@/lib/api/salesIntelligenceAnalysis";
import type { SummaryFindingsSection } from "@/lib/api/salesIntelligenceAssessment";
import type { AnalysisAction } from "../../analysis-command";
import { Button } from "../../atoms/button";
import { useFindings } from "../../data/use-findings";
import { useRunPresentation } from "../../data/use-run";
import { siKeys } from "../../data/query-keys";
import { Chip, Disclosure, Region, RegionProgress, SkeletonLines } from "../../primitives";
import { copy } from "../../sales-intelligence-copy";
import { cx } from "../../lib/format";
import { formatExact, formatExactFull } from "../../lib/time";
import { RunCommand } from "./advanced";
import { EvidenceInline, resolveEvidenceRefs, type EvidenceView } from "./evidence-inline";
import { useKitId } from "./kit-id";

const f = copy.ui1.analysis.findings;

/** Final spec §11.5 category order (the server's `category` keys). Unknown categories follow in the order they arrive. */
export const CATEGORY_ORDER = ["commitments", "booking_payment", "money", "objections", "restrictions", "move_facts", "call_type", "coaching"] as const;

export type FindingAction = "confirm_finding" | "correct_finding" | "retract_finding" | "look_again";
export type PriorRelation = SummaryFindingsSection["prior_finding_relations"][number];
export type InstructionAssessment = SummaryFindingsSection["owner_instruction_assessments"][number];

export type FindingGroup = { category: string; label: string; items: CurrentFinding[] };

/** Groups in the fixed order; a category's findings keep the server's order (newest call first). */
export function groupFindings(findings: readonly CurrentFinding[]): FindingGroup[] {
  const groups = new Map<string, FindingGroup>();
  for (const finding of findings) {
    const group = groups.get(finding.category) ?? { category: finding.category, label: finding.category_label, items: [] };
    group.items.push(finding);
    groups.set(finding.category, group);
  }
  const rank = (category: string) => {
    const at = (CATEGORY_ORDER as readonly string[]).indexOf(category);
    return at < 0 ? CATEGORY_ORDER.length : at;
  };
  return [...groups.values()].sort((a, b) => rank(a.category) - rank(b.category));
}

/** `Applied → {detail}`, `Blocked: {reason}`, `Needs review`, …; an unknown enum value prints as sent. */
export function workResultText(finding: Pick<CurrentFinding, "work_result" | "work_result_detail">): string {
  const { work_result: result, work_result_detail: detail } = finding;
  if (result === "applied" && detail) return f.appliedDetail(detail);
  if (result === "blocked" && detail) return f.blockedDetail(detail);
  return f.result[result] ?? result;
}

export const findingAnchor = (id: string) => `si-finding-${id}`;

function CallTime({ t, asOf }: { t: string; asOf: string }) {
  const exact = formatExactFull(t);
  return (
    <time dateTime={t} title={exact} aria-label={exact} className="si-time">
      {formatExact(t, asOf)}
    </time>
  );
}

const REVIEW_ACTIONS = ["confirm_finding", "correct_finding", "retract_finding"] as const;
const actionWord: Record<(typeof REVIEW_ACTIONS)[number], string> = { confirm_finding: f.confirm, correct_finding: f.correct, retract_finding: f.retract };

function ReviewActions({ finding, onAction, showLookAgain }: { finding: CurrentFinding; onAction?: (finding: CurrentFinding, action: FindingAction) => void; showLookAgain: boolean }) {
  const reviewable = finding.review_state === "unreviewed";
  const allowed = reviewable ? finding.allowed_actions.filter((a) => (REVIEW_ACTIONS as readonly string[]).includes(a.action)) : [];
  const main = allowed.filter((a) => a.action !== "retract_finding");
  const retract = allowed.find((a) => a.action === "retract_finding");
  if (main.length === 0 && !retract && !showLookAgain) return null;
  const button = (action: FindingAction, label: string, enabled = true, blockers: readonly string[] = []) => (
    <Button key={action} variant="secondary" size="sm" className="si-hit" disabled={!enabled || !onAction} title={blockers.length ? blockers.join(", ") : undefined} data-action={action} onClick={() => onAction?.(finding, action)}>
      {label}
    </Button>
  );
  return (
    <div className="si-finding__actions">
      {main.map((a) => button(a.action as FindingAction, actionWord[a.action as keyof typeof actionWord], a.enabled, a.blocker_codes))}
      {(retract || showLookAgain) && (
        <Disclosure id={`si-finding-more-${finding.id}`} title={<span aria-label={f.moreFor(finding.claim)}>{f.more}</span>} className="si-finding__more">
          <div className="si-finding__moreactions">
            {retract && button("retract_finding", f.retract, retract.enabled, retract.blocker_codes)}
            {showLookAgain && button("look_again", f.lookAgain)}
          </div>
        </Disclosure>
      )}
    </div>
  );
}

export type FindingBlockProps = {
  finding: CurrentFinding;
  asOf: string;
  onAction?: (finding: CurrentFinding, action: FindingAction) => void;
  showLookAgain?: boolean;
  evidenceOpen?: boolean;
  /** Whether a finding id is rendered on this page (a link to a finding that isn't listed would go nowhere). */
  onPage?: (findingId: string) => boolean;
};

export function FindingBlock({ finding, asOf, onAction, showLookAgain = false, evidenceOpen = false, onPage = () => false }: FindingBlockProps) {
  const kid = useKitId();
  const later = finding.work_result === "superseded" ? finding.superseded_by ?? finding.work_result_detail : null;
  const replacedBy = later && onPage(later) ? later : null;
  return (
    <article id={kid(findingAnchor(finding.id))} className={cx("si-finding", finding.review_state === "retracted" && "is-retracted", finding.superseded_by && "is-replaced")} data-finding={finding.id} data-kind={finding.kind} data-work-result={finding.work_result}>
      <p className="si-finding__head">
        <span className="si-finding__claim">{finding.claim}</span>
        <span className="si-finding__source">
          {" · "}
          {finding.source_word}
          {finding.action_status_word ? ` · ${finding.action_status_word}` : null}
          {finding.call_at ? (
            <>
              {" · "}
              <CallTime t={finding.call_at} asOf={asOf} />
            </>
          ) : null}
        </span>
        {finding.clarity === "uncertain" && <Chip className="si-finding__chip">{f.uncertain}</Chip>}
      </p>
      {finding.value_line && <p className="si-finding__value">{finding.value_line}</p>}
      <p className="si-finding__result" data-result={finding.work_result}>
        {f.workResult(workResultText(finding))}
        {replacedBy ? (
          <>
            {" · "}
            <a className="si-finding__link" href={`#${kid(findingAnchor(replacedBy))}`}>
              {f.openLater}
            </a>
          </>
        ) : null}
      </p>
      <EvidenceInline items={finding.evidence as EvidenceView[]} asOf={asOf} defaultOpen={evidenceOpen} context={finding.claim} />
      <ReviewActions finding={finding} onAction={onAction} showLookAgain={showLookAgain} />
    </article>
  );
}

function RelationRow({ relation, evidence, asOf, reviewHref, onPage }: { relation: PriorRelation; evidence: readonly EvidenceView[]; asOf: string; reviewHref?: (id: string) => string; onPage: (id: string) => boolean }) {
  const kid = useKitId();
  const items = resolveEvidenceRefs(relation.evidence, evidence);
  return (
    <li className="si-change" data-relation={relation.relation} data-prior={relation.prior_finding_id}>
      <p className="si-change__line">
        <span className="si-change__prior">{relation.prior_claim}</span>
        {" · "}
        <span className="si-change__word">{relation.relation_word}</span>
        {relation.by_claim ? (
          <>
            {" · "}
            {relation.by_finding_id && onPage(relation.by_finding_id) ? (
              <a className="si-finding__link" href={`#${kid(findingAnchor(relation.by_finding_id))}`}>
                {relation.by_claim}
              </a>
            ) : (
              relation.by_claim
            )}
          </>
        ) : null}
        {relation.note ? <span className="si-change__note">{` · ${relation.note}`}</span> : null}
      </p>
      {relation.review_item_id && reviewHref ? (
        <a className="si-finding__link si-hit" href={reviewHref(relation.review_item_id)} data-review-item={relation.review_item_id}>
          {f.changes.openReview}
        </a>
      ) : null}
      <EvidenceInline items={items} asOf={asOf} context={relation.prior_claim} />
    </li>
  );
}

/** `Changes since the last analysis ({n})`: changed rows in view, `still_true` / `cannot_determine` in a disclosure. */
export function ChangesSinceLast({ relations, evidence = [], asOf, reviewHref, onPage = () => false }: { relations: readonly PriorRelation[]; evidence?: readonly EvidenceView[]; asOf: string; reviewHref?: (id: string) => string; onPage?: (id: string) => boolean }) {
  const kid = useKitId();
  if (relations.length === 0) return null;
  const titleId = kid("si-changes-title");
  const changed = relations.filter((r) => r.group !== "unchanged");
  const unchanged = relations.filter((r) => r.group === "unchanged");
  const row = (relation: PriorRelation) => <RelationRow key={relation.prior_finding_id} relation={relation} evidence={evidence} asOf={asOf} reviewHref={reviewHref} onPage={onPage} />;
  return (
    <section className="si-changes" aria-labelledby={titleId}>
      <h4 id={titleId} className="si-heading si-heading--4">{f.changes.title(relations.length)}</h4>
      {changed.length > 0 && <ul className="si-changes__list">{changed.map(row)}</ul>}
      {unchanged.length > 0 && (
        <Disclosure id="si-changes-unchanged" title={f.changes.unchanged(unchanged.length)}>
          <ul className="si-changes__list">{unchanged.map(row)}</ul>
        </Disclosure>
      )}
    </section>
  );
}

export function InstructionAssessments({ items }: { items: readonly InstructionAssessment[] }) {
  if (items.length === 0) return null;
  return (
    <Disclosure id="si-findings-instructions" title={f.instructions} className="si-findings__instructions">
      <ul className="si-changes__list">
        {items.map((item) => (
          <li key={`${item.instruction_id}:${item.instruction_revision}`} className="si-change" data-assessment={item.assessment}>
            <p className="si-change__line">
              <span className="si-change__prior">{item.instruction_text}</span>
              {" · "}
              <span className="si-change__word">{item.assessment_word}</span>
              {" · "}
              <span className="si-change__note">{item.reason}</span>
            </p>
          </li>
        ))}
      </ul>
    </Disclosure>
  );
}

export type FindingsProps = {
  findings: readonly CurrentFinding[];
  reason: string | null;
  truncated: boolean;
  asOf: string;
  /** The newest run's presentation lists (omitted when there is no run). */
  relations?: readonly PriorRelation[];
  relationEvidence?: readonly EvidenceView[];
  instructionAssessments?: readonly InstructionAssessment[];
  onAction?: (finding: CurrentFinding, action: FindingAction) => void;
  /** `Look again` under each finding's `More` (UX27: the frame passes it for the Owner). */
  showLookAgain?: boolean;
  /** Where a relation's review item opens. Omitted → no link. */
  reviewHref?: (reviewItemId: string) => string;
  /** The `include_superseded` toggle; omitted → no toggle. */
  replaced?: { shown: boolean; onToggle: () => void; pending?: boolean };
  /** Gallery / tests: finding ids whose evidence starts open. */
  openEvidence?: readonly string[];
};

/** Presentational Findings (UX15: props in, no role read). */
export function Findings({ findings, reason, truncated, asOf, relations = [], relationEvidence = [], instructionAssessments = [], onAction, showLookAgain = false, reviewHref, replaced, openEvidence = [] }: FindingsProps) {
  const kid = useKitId();
  const groups = groupFindings(findings);
  const ids = new Set(findings.map((finding) => finding.id));
  const onPage = (id: string) => ids.has(id);
  return (
    <div className="si-findings">
      {replaced && <RegionProgress active={!!replaced.pending} />}
      {groups.length === 0 ? (
        <p className="si-findings__empty" data-reason={reason ?? "none"}>{(reason && f.reason[reason]) || f.none}</p>
      ) : (
        groups.map((group) => (
          <section key={group.category} className="si-findings__group" data-category={group.category} aria-labelledby={kid(`si-findings-${group.category}`)}>
            <h4 id={kid(`si-findings-${group.category}`)} className="si-heading si-heading--4 si-findings__head">{f.category(group.label, group.items.length)}</h4>
            {group.items.map((finding) => (
              <FindingBlock key={finding.id} finding={finding} asOf={asOf} onAction={onAction} showLookAgain={showLookAgain} evidenceOpen={openEvidence.includes(finding.id)} onPage={onPage} />
            ))}
          </section>
        ))
      )}
      {truncated && <p className="si-findings__note" data-truncated="1">{f.truncated}</p>}
      {replaced && (
        <Button variant="link" size="sm" className="si-hit si-findings__toggle" aria-pressed={replaced.shown} disabled={replaced.pending} onClick={replaced.onToggle}>
          {replaced.shown ? f.hideReplaced : f.showReplaced}
        </Button>
      )}
      <ChangesSinceLast relations={relations} evidence={relationEvidence} asOf={asOf} reviewHref={reviewHref} onPage={onPage} />
      <InstructionAssessments items={instructionAssessments} />
    </div>
  );
}

/* ── Section wrapper: reads, the review commands, the replaced toggle. ── */

type Command = { finding: CurrentFinding; action: FindingAction };

const commandAction = (action: FindingAction): AnalysisAction => (action === "look_again" ? "current_context" : action);

function FindingsLoaded({ outreachId, includeSuperseded, children }: { outreachId: string; includeSuperseded: boolean; children: (read: ReturnType<typeof useFindings>) => ReactNode }) {
  return <>{children(useFindings(outreachId, { includeSuperseded }))}</>;
}

function WithPresentation({ runId, children }: { runId: string; children: (presentation: ReturnType<typeof useRunPresentation>["presentation"]) => ReactNode }) {
  return <>{children(useRunPresentation(runId).presentation)}</>;
}

/**
 * The section wrapper the analysis frame mounts. `newestRunId` is `outreach.newest_run_id` (null → no changes block).
 * `showLookAgain` is the frame's Owner switch (UX27).
 */
export function FindingsSection({ outreachId, newestRunId, showLookAgain = false, reviewHref }: { outreachId: string; newestRunId: string | null; showLookAgain?: boolean; reviewHref?: (reviewItemId: string) => string }) {
  const client = useQueryClient();
  const [includeSuperseded, setIncludeSuperseded] = useState(false);
  const [pending, startTransition] = useTransition();
  const [command, setCommand] = useState<Command | null>(null);
  const retry = () => {
    void client.resetQueries({ queryKey: siKeys.findings(outreachId, includeSuperseded) });
    if (newestRunId) void client.resetQueries({ queryKey: siKeys.analysisPresentation(newestRunId) });
  };
  const render = (read: ReturnType<typeof useFindings>, presentation?: ReturnType<typeof useRunPresentation>["presentation"]) => (
    <Findings
      findings={read.findings}
      reason={read.reason}
      truncated={read.truncated}
      asOf={read.asOf}
      relations={presentation?.summary_findings.prior_finding_relations}
      relationEvidence={presentation?.evidence.items as EvidenceView[] | undefined}
      instructionAssessments={presentation?.summary_findings.owner_instruction_assessments}
      onAction={(finding, action) => setCommand({ finding, action })}
      showLookAgain={showLookAgain}
      reviewHref={reviewHref}
      replaced={{ shown: includeSuperseded, pending, onToggle: () => startTransition(() => setIncludeSuperseded((on) => !on)) }}
    />
  );
  return (
    <>
      <Region name="findings" skeleton={<FindingsSkeleton />} onRetry={retry}>
        <FindingsLoaded outreachId={outreachId} includeSuperseded={includeSuperseded}>
          {(read) => (newestRunId ? <WithPresentation runId={newestRunId}>{(presentation) => render(read, presentation)}</WithPresentation> : render(read))}
        </FindingsLoaded>
      </Region>
      {command && <RunCommand runId={command.finding.run_id} action={commandAction(command.action)} findingId={command.finding.id} onClose={() => setCommand(null)} />}
    </>
  );
}

export function FindingSkeleton() {
  return (
    <div className="si-finding is-skeleton" aria-hidden>
      <SkeletonLines lines={3} widths={["80%", "45%", "35%"]} />
    </div>
  );
}

export function FindingsSkeleton() {
  return (
    <div className="si-findings is-skeleton">
      <SkeletonLines lines={1} widths={["30%"]} />
      <FindingSkeleton />
      <FindingSkeleton />
      <SkeletonLines lines={1} widths={["22%"]} />
      <FindingSkeleton />
    </div>
  );
}
