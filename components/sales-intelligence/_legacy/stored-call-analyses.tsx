"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { readSalesIntelligence, SalesIntelligenceError } from "@/lib/api/salesIntelligence";
import { analysisRunsSchema, analysisSchema, type Analysis } from "@/lib/api/salesIntelligenceAnalysis";
import { readRunPresentation, type SummaryFindingsSection } from "@/lib/api/salesIntelligenceAssessment";
import { salesIntelligenceKeys } from "@/lib/query/salesIntelligence";
import { Button } from "../atoms/button";
import { formatDateTime, label } from "../lib/format";
import { assessmentCopy } from "../evidence-chain-copy";

/**
 * Server words for the stored output version. Every retained run renders through the same
 * shared section (legacy `sales_intelligence_analyze_v1/v2` envelopes, structured
 * `csi-analysis-steps-v1` runs); the version only labels where it came from.
 */
export function storedOutputVersionText(source: { kind: string; prompt_version: string | null; version: string | null }) {
  const kind = source.kind === "structured_run" ? "Structured analysis" : source.kind === "summary_artifact" ? "Stored call summary" : "Earlier analysis format";
  const parts = [kind, source.prompt_version ? `prompt ${source.prompt_version}` : null, source.version ? `schema ${source.version}` : null].filter(Boolean);
  return parts.join(" · ");
}

/** Pure view over the shared Summary & findings section; the fallback renders the raw run when the presentation read is unavailable. */
export function StoredCallAnalysisView({ section, fallback, runId, onOpenRun }: {
  section: SummaryFindingsSection | null; fallback: Analysis | null; runId: string; onOpenRun: (id: string) => void;
}) {
  if (section && section.availability === "ready") {
    const summary = section.summary.sections.filter(part => part.text.trim());
    return <>
      <h4>Call summary</h4>
      {/* Per-call output, never the Number-level Running Summary above. */}
      <p className="si-text--subtle">{assessmentCopy.scope[section.scope === "number" ? "number" : "conversation"]} · {section.source.generated_at ? formatDateTime(section.source.generated_at) : "time not recorded"} · {storedOutputVersionText(section.source)}</p>
      {!summary.length && !section.summary.narrative && <p>This analysis kept no summary text.</p>}
      <dl className="si-storedcall__sections">
        {summary.map(part => <div key={part.key}><dt>{part.label}</dt><dd>{part.text}</dd></div>)}
      </dl>
      {section.summary.narrative && <p className="si-storedcall__narrative">{section.summary.narrative}</p>}
      {section.said_on_call.length > 0 && <p className="si-text--subtle">{section.said_on_call.length === 1 ? "1 fact was extracted from the call itself." : `${section.said_on_call.length} facts were extracted from the call itself.`}</p>}
      <h4>Model assertions ({section.findings.length})</h4>
      {!section.findings.length && <p>This analysis has no retained assertions.</p>}
      <ul className="si-local-stack">{section.findings.map(finding => <li key={finding.id}>
        <p>{finding.claim}</p>
        <span className="si-text--subtle">{label(finding.kind)} · {label(finding.review_state)}{finding.action_status ? ` · ${label(finding.action_status)}` : ""}</span>
      </li>)}</ul>
      {section.suggested_next_step && <p className="si-text--subtle">Suggested next step (not scheduled): {section.suggested_next_step.description}</p>}
      <Button variant="link" onClick={() => onOpenRun(runId)}>Open full summary, assertions and evidence</Button>
    </>;
  }
  if (section && section.availability !== "ready") return <p>{section.availability === "purged" ? "The content of this analysis is no longer available." : `This analysis cannot be shown (${label(section.availability)}).`}</p>;
  if (fallback?.output) {
    const sections = ["overview", "customer_wanted", "money_and_dates", "outcome", "commitments", "discrepancies"] as const;
    return <>
      <h4>Call summary</h4>
      <p className="si-text--subtle">{assessmentCopy.scope[fallback.conversation_id ? "conversation" : "number"]} · {formatDateTime(fallback.completed_at ?? fallback.created_at)} · {storedOutputVersionText({ kind: "legacy_run", prompt_version: fallback.prompt_version ?? null, version: null })}</p>
      <dl className="si-storedcall__sections">
        {sections.flatMap(key => { const value = fallback.output!.summary[key]; return typeof value === "string" && value.trim() ? [<div key={key}><dt>{label(key)}</dt><dd>{value}</dd></div>] : []; })}
      </dl>
      <h4>Model assertions ({fallback.findings.length})</h4>
      {!fallback.findings.length && <p>This analysis has no retained assertions.</p>}
      <ul className="si-local-stack">{fallback.findings.map(finding => <li key={finding.id}>
        <p>{finding.assertion.claim}</p>
        <span className="si-text--subtle">{label(finding.assertion.kind)} · {label(finding.review_state)}</span>
      </li>)}</ul>
      <Button variant="link" onClick={() => onOpenRun(runId)}>Open full summary, assertions and evidence</Button>
    </>;
  }
  if (fallback && !fallback.output) return <p>The content of this analysis is no longer available.</p>;
  return null;
}

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
  // The shared presentation adapter normalizes every stored output version on the server.
  const presentation = useQuery({
    queryKey: [...salesIntelligenceKeys.all, "analysis-presentation", runId],
    enabled: Boolean(runId),
    queryFn: ({ signal }) => readRunPresentation(runId!, signal),
    retry: false,
  });
  // An older server without the presentation route still shows the run through the raw read.
  const presentationMissing = presentation.error instanceof SalesIntelligenceError && [404, 400].includes(presentation.error.status);
  const detail = useQuery({
    queryKey: [...salesIntelligenceKeys.all, "analysis-run", runId, null],
    enabled: Boolean(runId) && presentationMissing,
    queryFn: ({ signal }) => readSalesIntelligence(`analysis-runs/${runId}`, analysisSchema, signal),
    retry: false,
  });
  const page = (next: string | null) => { setSelected(null); setCursor(next); };
  const loading = Boolean(runId) && (presentation.isPending || (presentationMissing && detail.isPending));
  const failed = (presentation.error && !presentationMissing) ? presentation : detail.error ? detail : null;
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
    {loading && <p role="status">Loading summary and assertions…</p>}
    {failed && <p role="alert">Could not load this analysis. <Button variant="link" onClick={() => void failed.refetch()}>Retry</Button></p>}
    {runId && !loading && !failed && <StoredCallAnalysisView key={runId} runId={runId}
      section={presentation.data?.data.summary_findings ?? null} fallback={detail.data?.data ?? null} onOpenRun={onOpenRun} />}
    <div className="si-local-filters">
      {cursor && <Button onClick={() => page(null)}>Newest call analyses</Button>}
      {list.data?.data.next_cursor && <Button onClick={() => page(list.data!.data.next_cursor)}>Older call analyses</Button>}
    </div>
  </section>;
}
