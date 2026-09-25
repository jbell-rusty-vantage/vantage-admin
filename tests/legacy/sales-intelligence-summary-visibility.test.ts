import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RunningSummaryPanel } from "../../components/sales-intelligence/_legacy/running-summary-panel";
import { salesIntelligenceKeys } from "../../lib/query/salesIntelligence";

test("completed call output is visible while the separate Number summary is missing", () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  const numberId = "number-with-completed-call";
  const run = { id: "completed-call", status: "completed", mode: "backfill", conversation_id: "conversation", created_at: "2026-09-21T12:00:00Z", completed_at: "2026-09-21T12:01:00Z" };
  client.setQueryData([...salesIntelligenceKeys.all, "analysis-runs", numberId, "completed-calls", null], { data: { items: [run], next_cursor: "older-page" } });
  // The tab reads the shared Summary & findings section first (every stored output version is normalized
  // on the server); the raw-run read is only the fallback for a server without that route.
  client.setQueryData([...salesIntelligenceKeys.all, "analysis-presentation", run.id], { data: { run_id: run.id,
    summary_findings: { availability: "ready", scope: "conversation",
      source: { kind: "legacy_run", id: run.id, version: "csi-envelope-v1", generated_at: run.completed_at, model_version: "openai/gpt-5-mini", prompt_version: "sales_intelligence_analyze_v1" },
      summary: { sections: [{ key: "overview", label: "Overview", text: "Customer requested a Friday callback." }], narrative: null }, said_on_call: [],
      findings: [{ id: "finding", kind: "promised_callback", claim: "The rep promised to call Friday.", basis: "said_on_call", actor: "rep", action_status: "promised", clarity: "clear", review_state: "unreviewed", evidence: [], effects: [] }],
      suggested_next_step: null, applied_actions: [] },
    evidence: { availability: "ready", items: [] }, full_output: [] } });
  const html = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(RunningSummaryPanel, { numberId, analysis: null, onOpenRun: () => {} })));
  assert.match(html, /No completed Running Summary yet/);
  assert.match(html, /Customer requested a Friday callback/);
  assert.match(html, /The rep promised to call Friday/);
  assert.match(html, /Open full summary, assertions and evidence/);
  assert.match(html, /Earlier analysis format/);
  assert.match(html, /Older call analyses/);
  assert.doesNotMatch(html, /No completed analysis available/);
  client.clear();
});

test("Number synthesis and completed call output are both visible", () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData([...salesIntelligenceKeys.all, "analysis-runs", "number", "completed-calls", null], { data: { items: [], next_cursor: null } });
  const html = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(RunningSummaryPanel, {
    numberId: "number", analysis: { text: "Summary across three calls.", computed_at: "2026-09-21T12:00:00Z", run_id: "synthesis" }, onOpenRun: () => {},
  })));
  assert.match(html, /Summary across three calls/);
  assert.match(html, /Call summaries and assertions/);
  assert.match(html, /No retained completed call analyses on this page/);
  client.clear();
});
