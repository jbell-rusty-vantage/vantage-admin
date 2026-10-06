"use client";
/** Step 2 (doc 17): honest progress while Granot reads, and the failed state with Try again. */
import { RefreshCw } from "lucide-react";
import { CrmCard, EvidenceChip, Track } from "@/components/ui/crm/primitives";
import { formatTime } from "@/components/ui/crm/format";
import type { GranotRun } from "@/lib/api/granotAutomation";
import { collectorFailureSentence, operationWords, type GranotCheck } from "@/lib/automations/granot-updates-model";
import { CHECK_COPY } from "./check-copy";
import { GRANOT_UPDATES_COPY } from "./granot-updates-copy";

const COPY = GRANOT_UPDATES_COPY.progress;
const EARLY_PHASES = new Set(["", "queued", "login", "signing_in", "sign_in"]);

function signedIn(runs: readonly GranotRun[]): boolean {
  return runs.some((run) => (run.collection_summaries?.length ?? 0) > 0 || (run.checkpoint?.phase !== undefined && !EARLY_PHASES.has(run.checkpoint.phase)));
}

function planned(run: GranotRun): boolean {
  return run.checkpoint?.phase === "planned" || run.status === "awaiting_approval";
}

function lineWords(run: GranotRun): string {
  if (planned(run)) return COPY.planned;
  const last = run.collection_summaries?.[run.collection_summaries.length - 1];
  if (run.status === "queued") return COPY.waiting;
  return last ? COPY.readingName(last.source_label) : COPY.queued;
}

export function CheckProgress({
  runs,
  check,
  failed = false,
  onTryAgain,
  retrying = false,
}: {
  runs: GranotRun[];
  check: GranotCheck;
  failed?: boolean;
  onTryAgain?: () => void;
  retrying?: boolean;
}) {
  if (failed) {
    const failedRuns = runs.filter((run) => run.status === "failed");
    return (
      <CrmCard title={COPY.failedTitle}>
        <div className="gu-check-stack">
          {(failedRuns.length ? failedRuns : runs).map((run) => (
            <p key={run.run_id} className="crm-text-red">
              {`${operationWords(run.operation)}: ${collectorFailureSentence(run.failure?.code)}`}
            </p>
          ))}
          <div className="su-actions">
            <button type="button" className="crm-button crm-button--primary" onClick={onTryAgain} disabled={!onTryAgain || retrying}>
              <RefreshCw aria-hidden="true" width={16} height={16} />
              {COPY.tryAgain}
            </button>
            <span className="crm-small crm-text-muted">{COPY.tryAgainHint}</span>
          </div>
        </div>
      </CrmCard>
    );
  }

  const total = check.source_labels.length;
  const done = runs.reduce((sum, run) => sum + (run.collection_summaries?.length ?? 0), 0);
  const isSignedIn = signedIn(runs);
  const matched = runs.length > 0 && runs.every(planned);
  const progress = total > 0 ? Math.min(1, done / total) : null;
  return (
    <CrmCard title={COPY.title(formatTime(check.created_at))}>
      <div className="gu-check-stack">
        <div className="gu-check-steps">
          <EvidenceChip state={isSignedIn ? "ok" : "none"}>{isSignedIn ? COPY.signedIn : COPY.signingIn}</EvidenceChip>
          <span className="gu-check-step">
            <span>{total > 0 ? `${COPY.reading} ${COPY.readingOf(done, total)}` : COPY.reading}</span>
            <Track progress={progress} done={total > 0 && done >= total} label={CHECK_COPY.progressLabel} />
          </span>
          <EvidenceChip state={matched ? "ok" : "none"}>{COPY.matching}</EvidenceChip>
        </div>
        <div className="gu-check-stack">
          {runs.map((run) => (
            <p key={run.run_id} className="crm-small">
              {COPY.leadTypeLine(operationWords(run.operation), lineWords(run))}
            </p>
          ))}
        </div>
        <p className="crm-small crm-text-muted">{COPY.leave}</p>
      </div>
    </CrmCard>
  );
}
