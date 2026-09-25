"use client";
/**
 * UI1-DATA: `GET /outreach/:id/findings` (final §11.5–11.6). Current findings across the record's runs, with
 * their inline evidence. `includeSuperseded` adds the replaced ones (the `Show replaced findings` disclosure).
 * `reason` explains an empty list; `truncated` says the list was capped.
 */
import { useSuspenseQuery } from "@tanstack/react-query";
import { readOutreachFindings } from "@/lib/api/salesIntelligenceAnalysis";
import { siKeys } from "./query-keys";

export function useFindings(outreachId: string, { includeSuperseded = false }: { includeSuperseded?: boolean } = {}) {
  const query = useSuspenseQuery({
    queryKey: siKeys.findings(outreachId, includeSuperseded),
    queryFn: ({ signal }) => readOutreachFindings(outreachId, { includeSuperseded }, signal),
    retry: false,
  });
  return { ...query, findings: query.data.data.items, reason: query.data.data.reason, truncated: query.data.data.truncated, asOf: query.data.as_of };
}
