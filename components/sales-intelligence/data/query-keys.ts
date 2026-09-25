/**
 * UI1-DATA: one key builder per UI-1 read. Every key is `[...salesIntelligenceKeys.all, <segment>, …]` and its
 * segment is reached by at least one live topic in `lib/query/salesIntelligence.ts` (ADMIN-REBUILD trap 1;
 * `tests/sales-intelligence/live-topics.test.ts` enforces it). Existing segment names are reused so the
 * legacy page and the new desk share invalidation.
 */
import { salesIntelligenceKeys } from "@/lib/query/salesIntelligence";
import { attentionQuery, closedHistoryQuery, overviewQuery, timelineQuery, type AttentionParams, type ClosedHistoryParams, type OverviewParams, type TimelineScope } from "./requests";

const all = salesIntelligenceKeys.all;

export const siKeys = {
  /** Desk list (Needs Attention, All Outreach, Closed): one infinite query per request string; the cursor is the page param. */
  attention: (params: AttentionParams) => [...all, "attention", attentionQuery({ ...params, limit: params.limit }).toString()] as const,
  overview: (params: OverviewParams) => [...all, "overview", overviewQuery(params).toString()] as const,
  closedHistory: (params: ClosedHistoryParams) => [...all, "closed-history", closedHistoryQuery(params).toString()] as const,
  outreach: (id: string) => [...all, "outreach", id] as const,
  outreachByLead: (model: string, id: string) => [...all, "outreach-by-lead", model, id] as const,
  timeline: (scope: TimelineScope, id: string, kinds: readonly string[] = []) => [...all, "timeline", scope, id, timelineQuery(kinds).toString()] as const,
  /** Same shape as `assessmentQueryKey` in use-assessment.ts (kept for `_legacy/`). */
  assessment: (outreachId: string) => [...all, "assessment", outreachId] as const,
  assessmentArtifact: (artifactId: string) => [...all, "assessment-artifact", artifactId] as const,
  assessmentEvidence: (artifactId: string) => [...all, "assessment-evidence", artifactId] as const,
  assessmentOutput: (artifactId: string) => [...all, "assessment-output", artifactId] as const,
  findings: (outreachId: string, includeSuperseded = false) => [...all, "findings", outreachId, includeSuperseded ? "include_superseded" : "current"] as const,
  analysisRun: (runId: string) => [...all, "analysis-run", runId, null] as const,
  analysisPresentation: (runId: string) => [...all, "analysis-presentation", runId] as const,
  analysisEvidence: (runId: string, cursor: string | null = null) => [...all, "analysis-evidence", runId, cursor] as const,
  analysisOutput: (runId: string, outputId: string) => [...all, "analysis-output", runId, outputId] as const,
  conversations: (numberId: string) => [...all, "conversations", numberId] as const,
  transcript: (conversationId: string, offset = 0) => [...all, "transcript", conversationId, offset] as const,
  nudges: (outreachId: string) => [...all, "nudges", outreachId] as const,
  nudgeDestinations: (accountId: string | null = null) => [...all, "nudge-destinations", accountId ?? "all"] as const,
  reps: (query = "") => [...all, "reps", query] as const,
  coverage: () => [...all, "coverage"] as const,
} as const;

export type SiKeyBuilder = keyof typeof siKeys;
