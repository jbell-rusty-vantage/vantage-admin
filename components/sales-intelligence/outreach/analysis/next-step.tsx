"use client";
/**
 * UI1-TOP: Recorded and suggested next step (final spec §11.3, RD6/RD8). Three columns between Scores and Move
 * details, stacked at 390 px:
 *   1. `Next step (recorded)`: `outreach.next_action`, or `No next step set`.
 *   2. `Suggested next step (not applied)`: the newest run's `suggested_next_step` with `Apply`, or
 *      `Applied {exact} → follow-up due {exact}` from the server's `applied_at` / `followup_due_at`; else `No suggestion`.
 *   3. `From the calls`: the Move assessment's `engagement` block (work status, promised callbacks, next steps, and
 *      the `Not applied ({n})` disclosure of skipped effects). Every label is a server word.
 */
import { useState, type ReactNode } from "react";
import type { OutreachRead } from "@/lib/api/salesIntelligence";
import type { Engagement, SummaryFindingsSection } from "@/lib/api/salesIntelligenceAssessment";
import { useAssessment } from "../../data/use-assessment";
import { useOutreach } from "../../data/use-outreach";
import { useRunPresentation } from "../../data/use-run";
import { Button } from "../../atoms/button";
import { evidenceChainCopy } from "../../evidence-chain-copy";
import { copy } from "../../sales-intelligence-copy";
import { Disclosure, Region, RegionProgress, SkeletonLines, TimeText } from "../../primitives";
import { ViewEvidence, refIds } from "./cite";
import { RunCommand } from "./advanced";

type Outreach = OutreachRead["data"]["outreach"];
export type SuggestedStep = NonNullable<SummaryFindingsSection["suggested_next_step"]>;

const t = copy.ui1.analysis.nextStep;
const SEP = " · ";

function Column({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className="si-nextstep__col" data-col={id} aria-label={title}>
      <h3 className="si-heading si-heading--4">{title}</h3>
      {children}
    </section>
  );
}

export function RecordedStep({ outreach, asOf }: { outreach: Outreach; asOf: string }) {
  const action = outreach.next_action;
  if (!action) return <p className="si-time is-null" data-empty="recorded">{t.noRecorded}</p>;
  const overdue = outreach.facts?.next_action_state === "overdue";
  return (
    <div className="si-nextstep__body">
      <p className="si-nextstep__desc">{action.description}</p>
      <p className="si-text--sm">
        {action.due_at ? (
          <>
            <TimeText t={action.due_at} asOf={asOf} mode="exact" prefix={t.due} />
            {" ("}
            <TimeText t={action.attention_due_at ?? action.due_at} asOf={asOf} mode="countdown" overdue={overdue} />
            {")"}
          </>
        ) : (
          <span className="si-time is-null">{copy.ui1.card.dueNeeded}</span>
        )}
      </p>
    </div>
  );
}

export function SuggestedStepView({ suggestion, asOf, onApply }: { suggestion: SuggestedStep | null; asOf: string; onApply?: () => void }) {
  if (!suggestion) return <p className="si-time is-null" data-empty="suggested">{t.noSuggestion}</p>;
  return (
    <div className="si-nextstep__body">
      <p className="si-nextstep__desc">
        {suggestion.action_label && <strong>{suggestion.action_label}{SEP}</strong>}
        {suggestion.description}
      </p>
      {suggestion.date_text && <p className="si-text--sm">{suggestion.date_text}</p>}
      {suggestion.rationale && <p className="si-text--sm si-nextstep__why">{evidenceChainCopy.run.nextStepWhy(suggestion.rationale)}</p>}
      {suggestion.applied_at ? (
        <p className="si-text--sm" data-applied="1">
          <TimeText t={suggestion.applied_at} asOf={asOf} mode="exact" prefix={t.applied} />
          {suggestion.followup_due_at && (
            <>
              {" "}
              <TimeText t={suggestion.followup_due_at} asOf={asOf} mode="exact" prefix={t.appliedDue} />
            </>
          )}
        </p>
      ) : (
        onApply && (
          <Button variant="secondary" size="sm" className="si-hit" aria-label={t.applyLabel(suggestion.description)} onClick={onApply}>
            {t.apply}
          </Button>
        )
      )}
    </div>
  );
}

const lineText = (...parts: (string | null | undefined)[]) => parts.filter((part): part is string => !!part).join(SEP);

export function FromTheCalls({ engagement, artifactId }: { engagement: Engagement | null; artifactId: string | null }) {
  if (!engagement) return <p className="si-time is-null" data-empty="engagement">{t.notAssessed}</p>;
  const target = (refs: Engagement["evidence"], label: string) => (artifactId ? { source: "assessment" as const, artifactId, ids: refIds(refs), label } : null);
  const skipped = engagement.effects?.skipped ?? [];
  return (
    <div className="si-nextstep__body" data-work-status={engagement.work_status}>
      <p className="si-nextstep__desc">{engagement.work_status_label}</p>
      {engagement.rationale && <p className="si-text--sm">{engagement.rationale}</p>}
      <ViewEvidence target={target(engagement.evidence, engagement.work_status_label)} />
      {engagement.effects?.blocked_label && <p className="si-text--sm">{engagement.effects.blocked_label}</p>}
      {engagement.promised_callbacks.length > 0 && (
        <div className="si-nextstep__group" data-group="callbacks">
          <h4 className="si-heading si-heading--4">{t.callbacks(engagement.promised_callbacks.length)}</h4>
          <ul className="si-nextstep__list">
            {engagement.promised_callbacks.map((cb, i) => {
              const text = lineText(cb.by_label, cb.raw_text, cb.date_label ?? cb.time_text, cb.status_label);
              return (
                <li key={i}>
                  <span>{text}</span>
                  {cb.followup_created && <span className="si-nextstep__created">{` ${t.followupCreated}`}</span>}
                  <ViewEvidence target={target(cb.evidence, cb.raw_text)} />
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {engagement.next_steps.length > 0 && (
        <div className="si-nextstep__group" data-group="next-steps">
          <h4 className="si-heading si-heading--4">{t.nextSteps(engagement.next_steps.length)}</h4>
          <ul className="si-nextstep__list">
            {engagement.next_steps.map((step, i) => {
              const text = lineText(step.action_label, step.description, step.date_label ?? step.date_text, step.status_label);
              return (
                <li key={i}>
                  <span>{text}</span>
                  {step.followup_created && <span className="si-nextstep__created">{` ${t.followupCreated}`}</span>}
                  <ViewEvidence target={target(step.evidence, step.description)} />
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {skipped.length > 0 && (
        <Disclosure id="analysis-engagement-skipped" title={t.notApplied(skipped.length)} className="si-nextstep__skipped">
          <ul className="si-nextstep__list">
            {skipped.map((row) => (
              <li key={`${row.source}:${row.index}`} data-reason={row.reason}>{lineText(row.text, row.reason_label)}</li>
            ))}
          </ul>
        </Disclosure>
      )}
    </div>
  );
}

/** Presentational three-column strip (UX15). `suggestion` is null when there is no suggestion or no run; `onApply` only for the Owner. */
export function NextStep({ outreach, asOf, suggestion, engagement, artifactId, onApply }: {
  outreach: Outreach;
  asOf: string;
  suggestion: SuggestedStep | null;
  engagement: Engagement | null;
  artifactId: string | null;
  onApply?: () => void;
}) {
  return (
    <div className="si-nextstep">
      <Column id="recorded" title={t.recorded}><RecordedStep outreach={outreach} asOf={asOf} /></Column>
      <Column id="suggested" title={t.suggested}><SuggestedStepView suggestion={suggestion} asOf={asOf} onApply={onApply} /></Column>
      <Column id="from-calls" title={t.fromCalls}><FromTheCalls engagement={engagement} artifactId={artifactId} /></Column>
    </div>
  );
}

export function NextStepSkeleton() {
  return (
    <div className="si-nextstep" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className="si-nextstep__col">
          <SkeletonLines lines={4} widths={["50%", "90%", "70%", "40%"]} />
        </div>
      ))}
    </div>
  );
}
NextStep.Skeleton = NextStepSkeleton;

function WithSuggestion({ runId, render }: { runId: string; render: (suggestion: SuggestedStep | null) => ReactNode }) {
  const { presentation } = useRunPresentation(runId);
  return <>{render(presentation.summary_findings.suggested_next_step)}</>;
}

/** Reads the detail, the assessment and (when a run exists) the newest run's presentation. `Apply` is the Owner's. */
export function NextStepSection({ outreachId, owner }: { outreachId: string; owner: boolean }) {
  const { outreach, asOf, isFetching } = useOutreach(outreachId);
  const { assessment } = useAssessment(outreachId);
  const [applying, setApplying] = useState(false);
  const runId = outreach.newest_run_id ?? null;
  const current = assessment.current;
  const view = (suggestion: SuggestedStep | null) => (
    <NextStep outreach={outreach} asOf={asOf} suggestion={suggestion} engagement={current?.engagement ?? null} artifactId={current?.artifact_id ?? null}
      onApply={owner && runId ? () => setApplying(true) : undefined} />
  );
  return (
    <>
      <RegionProgress active={isFetching} />
      {runId ? (
        <Region name="analysis-next-step-run" skeleton={<NextStepSkeleton />}>
          <WithSuggestion runId={runId} render={view} />
        </Region>
      ) : (
        view(null)
      )}
      {applying && runId && <RunCommand runId={runId} action="apply_suggestion" onClose={() => setApplying(false)} />}
    </>
  );
}
