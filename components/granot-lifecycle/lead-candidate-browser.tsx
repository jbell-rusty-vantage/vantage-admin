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
import { cn } from "@/lib/utils";
import {
  CandidateConfidenceBadges,
  CandidateLeadFacts,
  candidateLeadName,
  candidateLeadTypeLabel,
} from "./candidate-lead-facts";

export function isSameCandidate(
  left: GranotLifecycleCandidateItem | undefined,
  right: GranotLifecycleCandidateItem | undefined,
): boolean {
  return Boolean(
    left && right &&
    left.lead_ref.model === right.lead_ref.model &&
    left.lead_ref.id === right.lead_ref.id,
  );
}

/**
 * Server order already ranks identity matches first; this only breaks ties the
 * same way the server does so a reordered page cannot change the pre-selection.
 */
export function pickBestCandidate(
  items: readonly GranotLifecycleCandidateItem[] | undefined,
): GranotLifecycleCandidateItem | undefined {
  const rank = (item: GranotLifecycleCandidateItem) =>
    item.suggested ? 0 : item.confidence === "high" ? 1 : item.in_source_scope ? 2 : 3;
  return (items ?? []).reduce<GranotLifecycleCandidateItem | undefined>(
    (best, item) => (!best || rank(item) < rank(best) ? item : best),
    undefined,
  );
}

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
      {rows.map((item) => {
        const isSelected = isSameCandidate(selected, item);
        const body = (
          <>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-navy">{candidateLeadName(item)}</p>
                <p className="text-xs text-muted-foreground">
                  {candidateLeadTypeLabel(item.lead_ref.model)}
                  {item.job_no ? ` · job ${item.job_no}` : ""}
                  {item.reference ? ` · ref ${item.reference}` : ""}
                </p>
              </div>
              {isSelected ? <StatusBadge tone="success">In the booking form</StatusBadge> : null}
            </div>
            <CandidateConfidenceBadges item={item} />
            <CandidateLeadFacts item={item} className="sm:grid-cols-2" />
            {(item.reason_codes ?? []).length > 0 ? (
              <p className="text-xs text-muted-foreground">
                Reasons: {item.reason_codes.join(", ")}
              </p>
            ) : null}
            {item.requires_override_reason ? (
              <FeedbackMessage tone="warning">
                {onSelect
                  ? "This lead is outside the reviewed source scope. Choosing it requires a written reason."
                  : "This all-scope result is outside Source Scope and would require an override reason in a later command workflow."}
              </FeedbackMessage>
            ) : null}
          </>
        );
        const shell = cn(
          "space-y-3 rounded-md border p-3",
          isSelected && "border-trust-blue bg-trust-blue/5 ring-1 ring-trust-blue",
        );
        return (
          <li key={`${item.lead_ref.model}:${item.lead_ref.id}`}>
            {onSelect ? (
              <label className={cn(shell, "block cursor-pointer")}>
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <input
                    type="radio"
                    name="selected-granot-lead"
                    checked={isSelected}
                    onChange={() => onSelect(item)}
                  />
                  {isSelected ? "Using this lead" : "Use this lead instead"}
                </span>
                {body}
              </label>
            ) : (
              <div className={shell}>{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function LeadCandidateBrowser({
  caseId,
  selected,
  onSelect,
  heading,
  description,
  layout = "wide",
}: {
  caseId: string;
  selected?: GranotLifecycleCandidateItem;
  onSelect?: (item: GranotLifecycleCandidateItem) => void;
  heading?: string;
  description?: string;
  layout?: "wide" | "narrow";
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
        <h2 id="candidate-browser-heading" className="text-base font-semibold text-navy">
          {heading ?? "Eligible Lead candidates"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {description ?? (onSelect
            ? "Search only if the pre-selected lead is wrong. Choosing a row replaces the lead in the booking form."
            : "Read-only server-ranked results. Browsing never selects, attaches, or changes a Lead.")}
        </p>
      </div>
      <form
        className={cn(
          "grid gap-3",
          layout === "narrow"
            ? "grid-cols-1"
            : "md:grid-cols-[minmax(0,1fr)_180px_180px_auto]",
        )}
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
          <Label htmlFor="candidate-query">Search by name, phone, email, job, or reference</Label>
          <Input
            id="candidate-query"
            maxLength={100}
            value={draftQuery}
            onChange={(event) => setDraftQuery(event.target.value)}
            placeholder="Name, phone, email, job, or ref"
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
        <Button className={layout === "narrow" ? undefined : "self-end"} type="submit">Search</Button>
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
