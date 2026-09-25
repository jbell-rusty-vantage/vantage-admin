"use client";
/**
 * UI1-TOP: the `Advanced` disclosure (UI-1 §5.2, UX27). Owner only; the frame leaves it out for a rep. It holds
 * `Re-analyze original evidence` (disabled, with its reason, when that evidence is gone) and `Re-analyze current
 * context` behind the sentence `This starts a paid analysis.`, the earlier reanalysis requests with their status, and
 * `Confirm analysis` when the newest run is editable. Every command goes through the kept `analysis-command.tsx`
 * (`POST analysis-runs/:id/reanalyze`, `…/confirm`, `…/apply-suggestion`); nothing here starts a model call by itself.
 */
import { useState } from "react";
import type { Analysis, AnalysisFinding } from "@/lib/api/salesIntelligenceAnalysis";
import { useOutreach } from "../../data/use-outreach";
import { useRun } from "../../data/use-run";
import { AnalysisCommand, type AnalysisAction } from "../../analysis-command";
import { Button } from "../../atoms/button";
import { copy } from "../../sales-intelligence-copy";
import { Region, RegionProgress, SkeletonLines, TimeText } from "../../primitives";
import { useKitId } from "./kit-id";

const t = copy.ui1.analysis.advanced;
const SEP = " · ";

const RERUN: readonly AnalysisAction[] = ["original_evidence", "current_context"];

function RunCommandBody({ runId, action, findingId, onClose }: { runId: string; action: AnalysisAction; findingId?: string; onClose: () => void }) {
  const { run } = useRun(runId);
  const target: AnalysisFinding | undefined = findingId ? run.findings.find((item) => item.id === findingId) : undefined;
  // A finding the run detail no longer lists has nothing to act on: no dialog.
  if (findingId && !target) return null;
  // A reanalysis is scoped to the finding (`focus`, UX27 `Look again`); a review command acts on it (`finding`).
  return RERUN.includes(action) ? <AnalysisCommand run={run} action={action} focus={target} onClose={onClose} /> : <AnalysisCommand run={run} action={action} finding={target} onClose={onClose} />;
}

/**
 * The one path to the kept command dialog for a run: reads the run detail first (`GET analysis-runs/:id`, Owner only),
 * then opens `AnalysisCommand`. Used by `Apply` (next step), the Findings review actions (`findingId` +
 * `confirm_finding` / `correct_finding` / `retract_finding`) and `Look again` (`findingId` + `current_context`).
 */
export function RunCommand({ runId, action, findingId, onClose }: { runId: string; action: AnalysisAction; findingId?: string; onClose: () => void }) {
  return (
    <Region name="analysis-command" skeleton={<SkeletonLines lines={1} />}>
      <RunCommandBody runId={runId} action={action} findingId={findingId} onClose={onClose} />
    </Region>
  );
}

const statusWord = (status: string) => t.requestStatus[status] ?? status;
const modeWord = (mode: string) => t.mode[mode] ?? mode;

/** Presentational Advanced body: the run detail in, `onCommand` out (the section opens the dialog). */
export function Advanced({ run, asOf, onCommand }: { run: Analysis | null; asOf: string; onCommand?: (action: AnalysisAction) => void }) {
  const kid = useKitId();
  if (!run) return <p className="si-text--subtle" data-empty="no-run">{copy.ui1.analysis.situation.none}</p>;
  const originalGone = !run.original_evidence_available;
  const goneId = kid(`si-adv-gone-${run.id}`);
  return (
    <div className="si-advanced" data-run={run.id}>
      <p className="si-advanced__paid">{t.paid}</p>
      <div className="si-advanced__actions">
        <span className="si-advanced__action">
          <Button variant="secondary" size="sm" className="si-hit" disabled={originalGone || !onCommand} aria-describedby={originalGone ? goneId : undefined}
            onClick={() => onCommand?.("original_evidence")}>
            {t.reanalyzeOriginal}
          </Button>
          {originalGone && <span id={goneId} className="si-text--sm si-text--subtle">{t.originalGone}</span>}
        </span>
        <span className="si-advanced__action">
          <Button variant="secondary" size="sm" className="si-hit" disabled={!onCommand} onClick={() => onCommand?.("current_context")}>
            {t.reanalyzeCurrent}
          </Button>
        </span>
      </div>
      <p className="si-text--sm si-text--subtle">{`${t.includeCorrections}: ${t.includeCorrectionsHint}`}</p>
      <div className="si-advanced__earlier">
        <h4 className="si-heading si-heading--4">{t.earlier}</h4>
        {run.reanalysis_requests.length ? (
          <ul className="si-advanced__list">
            {run.reanalysis_requests.map((request) => (
              <li key={request.id} data-request={request.status}>
                {modeWord(request.mode)}
                {SEP}
                <TimeText t={request.created_at} asOf={asOf} mode="exact" />
                {SEP}
                {statusWord(request.status)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="si-text--sm si-text--subtle">{t.earlierNone}</p>
        )}
      </div>
      {run.editable && (
        <Button variant="primary" size="sm" className="si-hit" disabled={!onCommand} onClick={() => onCommand?.("confirm_run")}>
          {t.confirm}
        </Button>
      )}
    </div>
  );
}

export function AdvancedSkeleton() {
  return <SkeletonLines lines={4} widths={["40%", "60%", "50%", "30%"]} />;
}
Advanced.Skeleton = AdvancedSkeleton;

function AdvancedForRun({ runId, asOf }: { runId: string; asOf: string }) {
  const { run, isFetching } = useRun(runId);
  const [action, setAction] = useState<AnalysisAction | null>(null);
  return (
    <>
      <RegionProgress active={isFetching} />
      <Advanced run={run} asOf={asOf} onCommand={setAction} />
      {action && <AnalysisCommand run={run} action={action} onClose={() => setAction(null)} />}
    </>
  );
}

/** Reads the detail for `newest_run_id`, then the run (`GET analysis-runs/:id`). Owner only: the frame never mounts it for a rep. */
export function AdvancedSection({ outreachId }: { outreachId: string }) {
  const { outreach, asOf } = useOutreach(outreachId);
  const runId = outreach.newest_run_id ?? null;
  if (!runId) return <Advanced run={null} asOf={asOf} />;
  return <AdvancedForRun runId={runId} asOf={asOf} />;
}
