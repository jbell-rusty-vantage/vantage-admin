import { copy } from "./sales-intelligence-copy";
import { evidenceChainCopy as chain } from "./evidence-chain-copy";
import { formatDateTime } from "./lib/format";
import { TooltipCard } from "./atoms/tooltip-card";

export function runningSummaryText(analysis: { text: string; computed_at: string; run_id?: string } | null | undefined) {
  return analysis?.text ?? null;
}

export function RunningSummaryPanel({
  analysis,
  onOpenRun,
}: {
  analysis: { text: string; computed_at: string; run_id?: string } | null | undefined;
  onOpenRun: (runId: string) => void;
}) {
  const text = runningSummaryText(analysis);
  const when = analysis ? formatDateTime(analysis.computed_at) : null;
  return (
    <section className="si-local-stack" aria-label={copy.panel.runningSummary}>
      <TooltipCard title={copy.panel.runningSummary} guideTopic="summary" label={<h3>{copy.panel.runningSummary}</h3>}>
        {copy.panel.runningSummaryTip}
      </TooltipCard>
      {text && when ? (
        <>
          <p>{text}</p>
          {analysis?.run_id ? (
            <p>
              {chain.summaryLink.fromRun(when)}{" "}
              <button type="button" className="si-btn si-btn--link" onClick={() => onOpenRun(analysis.run_id!)}>
                {copy.panel.runningSummaryOpenRun}
              </button>
            </p>
          ) : (
            <>
              <p className="si-text--subtle">{copy.panel.runningSummarySource(when)}</p>
              <p className="si-text--subtle">{chain.summaryLink.noRun}</p>
            </>
          )}
        </>
      ) : (
        <>
          <p>{copy.panel.runningSummaryEmpty}</p>
          <p className="si-text--subtle">{copy.panel.runningSummaryWhy}</p>
        </>
      )}
    </section>
  );
}
