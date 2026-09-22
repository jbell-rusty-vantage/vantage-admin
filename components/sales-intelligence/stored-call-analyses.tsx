"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { readSalesIntelligence } from "@/lib/api/salesIntelligence";
import { analysisRunsSchema, analysisSchema } from "@/lib/api/salesIntelligenceAnalysis";
import { salesIntelligenceKeys } from "@/lib/query/salesIntelligence";
import { Button } from "./atoms/button";
import { formatDateTime, label } from "./lib/format";

/** Conversation output remains useful while the separate Number synthesis is pending. */
export function StoredCallAnalyses({ numberId, onOpenRun }: { numberId: string; onOpenRun: (id: string) => void }) {
  const [cursor, setCursor] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const list = useQuery({
    queryKey: [...salesIntelligenceKeys.all, "analysis-runs", numberId, "completed-calls", cursor],
    queryFn: ({ signal }) => readSalesIntelligence(`analysis-runs?contact_number_id=${numberId}&status=completed&conversation_only=true&limit=10${cursor ? `&cursor=${cursor}` : ""}`, analysisRunsSchema, signal),
    retry: false,
  });
  const runId = selected ?? list.data?.data.items[0]?.id;
  const detail = useQuery({
    queryKey: [...salesIntelligenceKeys.all, "analysis-run", runId, null],
    enabled: Boolean(runId),
    queryFn: ({ signal }) => readSalesIntelligence(`analysis-runs/${runId}`, analysisSchema, signal),
    retry: false,
  });
  const run = detail.data?.data;
  const page = (next: string | null) => { setSelected(null); setCursor(next); };
  return <section className="si-local-stack" aria-label="Call summaries and assertions">
    <h3>Call summaries and assertions</h3>
    <p className="si-text--subtle">These are stored analyses of individual calls. They remain available while the separate Running Summary is pending. Assertions are model interpretations; open the analysis to see evidence, review decisions and what was applied.</p>
    {list.isPending && <p role="status">Loading completed call analyses…</p>}
    {list.error && <p role="alert">Could not load call analyses. <Button variant="link" onClick={() => void list.refetch()}>Retry</Button></p>}
    {list.data && !list.data.data.items.length && <p>No retained completed call analyses on this page.</p>}
    <div className="si-local-filters" role="group" aria-label="Completed call analyses">
      {list.data?.data.items.map(item => <Button key={item.id} aria-pressed={item.id === runId} onClick={() => setSelected(item.id)}>
        {formatDateTime(item.completed_at ?? item.created_at)} · {label(item.mode)}
      </Button>)}
    </div>
    {runId && detail.isPending && <p role="status">Loading summary and assertions…</p>}
    {detail.error && <p role="alert">Could not load this analysis. <Button variant="link" onClick={() => void detail.refetch()}>Retry</Button></p>}
    {run?.output && <>
      <h4>Call summary</h4>
      <p>{run.output.summary.overview}</p>
      <h4>Model assertions ({run.findings.length})</h4>
      {!run.findings.length && <p>This analysis has no retained assertions.</p>}
      <ul className="si-local-stack">{run.findings.map(finding => <li key={finding.id}>
        <p>{finding.assertion.claim}</p>
        <span className="si-text--subtle">{label(finding.assertion.kind)} · {label(finding.review_state)}</span>
      </li>)}</ul>
      <Button variant="link" onClick={() => onOpenRun(run.id)}>Open full summary, assertions and evidence</Button>
    </>}
    {run && !run.output && <p>The content of this analysis is no longer available.</p>}
    <div className="si-local-filters">
      {cursor && <Button onClick={() => page(null)}>Newest call analyses</Button>}
      {list.data?.data.next_cursor && <Button onClick={() => page(list.data!.data.next_cursor)}>Older call analyses</Button>}
    </div>
  </section>;
}
