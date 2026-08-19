"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FeedbackMessage } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/data-table/status-badge";
import {
  fetchGranotLifecycleCandidates,
  type GranotLeadModel,
  type GranotLifecycleCandidateItem,
} from "@/lib/api/granotLifecycle";
import { queryKeys } from "@/lib/query/keys";

export function LeadCandidateResults({
  items,
  selected,
  onSelect,
}: {
  items?: GranotLifecycleCandidateItem[];
  selected?: GranotLifecycleCandidateItem;
  onSelect?: (item: GranotLifecycleCandidateItem) => void;
}) {
  const rows = items ?? [];
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No eligible candidates match this search.</p>;
  }
  return (
    <ul className="space-y-3" aria-label="Eligible Lead candidates">
      {rows.map((item) => (
        <li key={`${item.lead_ref.model}:${item.lead_ref.id}`} className="rounded-md border p-3">
          {onSelect ? (
            <label className="mb-3 flex cursor-pointer items-center gap-2 font-medium">
              <input
                type="radio"
                name="selected-granot-lead"
                checked={selected?.lead_ref.model === item.lead_ref.model && selected.lead_ref.id === item.lead_ref.id}
                onChange={() => onSelect(item)}
              />
              Select this eligible Lead
            </label>
          ) : null}
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-semibold">{item.masked_contact_label || "Masked Lead"}</p>
              <p className="font-mono text-xs text-muted-foreground">
                {item.lead_ref.model} · {item.lead_ref.id}
              </p>
            </div>
            <div className="flex flex-wrap gap-1">
              <StatusBadge tone={item.confidence === "high" ? "success" : "warning"}>
                {item.confidence} confidence
              </StatusBadge>
              {item.suggested ? <StatusBadge>Server suggestion</StatusBadge> : null}
              <StatusBadge tone={item.in_source_scope ? "success" : "warning"}>
                {item.in_source_scope ? "In Source Scope" : "Outside Source Scope"}
              </StatusBadge>
            </div>
          </div>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div><dt className="text-xs text-muted-foreground">Match method</dt><dd>{item.match_method}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Job / reference</dt><dd>{item.job_no ?? item.reference ?? "—"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Source Company</dt><dd>{item.source?.source_company_label ?? item.source?.lead_source_company ?? "—"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Source Granularity</dt><dd>{item.source?.source_granularity_label ?? item.source?.source_granularity_id ?? "—"}</dd></div>
          </dl>
          {(item.reason_codes ?? []).length > 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">Reasons: {item.reason_codes.join(", ")}</p>
          ) : null}
          {item.requires_override_reason ? (
            <FeedbackMessage tone="warning" className="mt-3">
              This all-scope result is outside Source Scope and would require an override reason in a later command workflow.
            </FeedbackMessage>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function LeadCandidateBrowser({
  caseId,
  selected,
  onSelect,
}: {
  caseId: string;
  selected?: GranotLifecycleCandidateItem;
  onSelect?: (item: GranotLifecycleCandidateItem) => void;
}) {
  const [draftQuery, setDraftQuery] = useState("");
  const [draftScope, setDraftScope] = useState<"source" | "all">("source");
  const [draftLeadModel, setDraftLeadModel] = useState<GranotLeadModel | "">("");
  const [applied, setApplied] = useState<{
    q?: string;
    scope: "source" | "all";
    lead_model?: GranotLeadModel;
    cursor?: string;
  }>({ scope: "source" });

  const query = useQuery({
    queryKey: queryKeys.granotLifecycle.candidates(caseId, applied),
    queryFn: () => fetchGranotLifecycleCandidates(caseId, { ...applied, limit: 25 }),
  });

  return (
    <section aria-labelledby="candidate-browser-heading" className="space-y-4">
      <div>
        <h2 id="candidate-browser-heading" className="text-lg font-semibold text-navy">Eligible Lead candidates</h2>
        <p className="text-sm text-muted-foreground">
          Read-only server-ranked results. Browsing never selects, attaches, or changes a Lead.
        </p>
      </div>
      <form
        className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_180px_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          setApplied({
            q: draftQuery.trim() || undefined,
            scope: draftScope,
            lead_model: draftLeadModel || undefined,
          });
        }}
      >
        <div className="space-y-1">
          <Label htmlFor="candidate-query">Search eligible Leads</Label>
          <Input
            id="candidate-query"
            maxLength={100}
            value={draftQuery}
            onChange={(event) => setDraftQuery(event.target.value)}
            placeholder="Job, ref, or normalized owner-work contact"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="candidate-scope">Scope</Label>
          <select
            id="candidate-scope"
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={draftScope}
            onChange={(event) => setDraftScope(event.target.value as "source" | "all")}
          >
            <option value="source">Source Scope</option>
            <option value="all">All eligible Leads</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="candidate-lead-model">Lead type</Label>
          <select
            id="candidate-lead-model"
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={draftLeadModel}
            onChange={(event) => setDraftLeadModel(event.target.value as GranotLeadModel | "")}
          >
            <option value="">All Lead types</option>
            <option value="FormLead">Form Lead</option>
            <option value="CallLead">Call Lead</option>
          </select>
        </div>
        <Button className="self-end" type="submit">Search</Button>
      </form>

      {applied.scope === "all" ? (
        <FeedbackMessage tone="warning">
          All-scope browsing may show eligible Leads outside Source Scope. Those rows are clearly marked and remain read-only.
        </FeedbackMessage>
      ) : null}
      {query.isPending ? <p role="status" className="text-sm text-muted-foreground">Loading eligible candidates…</p> : null}
      {query.isError ? (
        <FeedbackMessage tone="error">
          {query.error instanceof Error ? query.error.message : "Unable to load candidates."}
        </FeedbackMessage>
      ) : null}
      {query.data ? <LeadCandidateResults items={query.data.items ?? []} selected={selected} onSelect={onSelect} /> : null}
      {query.data?.next_cursor ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => setApplied((current) => ({ ...current, cursor: query.data?.next_cursor ?? undefined }))}
        >
          Load next candidate page
        </Button>
      ) : null}
    </section>
  );
}
