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
  IntakeContactCycleLine,
  IntakeKnownContactsChip,
} from "@/components/intakes/intake-known-contacts";
import { BOOKING_INTAKE_STORY } from "@/components/intakes/intake-copy";
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
 * Pre-fill only a unique High-Confidence Booking Lead. A persisted high
 * suggestion wins when it is on the page. Two or more highs with no suggestion
 * stay empty so submit omits `selected_lead` and the server stays Leadless.
 */
export function pickBestCandidate(
  items: readonly GranotLifecycleCandidateItem[] | undefined,
): GranotLifecycleCandidateItem | undefined {
  const highs = (items ?? []).filter((item) => item.confidence === "high");
  if (highs.length === 0) return undefined;
  const suggested = highs.find((item) => item.suggested);
  if (suggested) return suggested;
  if (highs.length === 1) return highs[0];
  return undefined;
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
    return <p className="text-sm text-muted-foreground">No customers match this search.</p>;
  }
  return (
    <ul className="space-y-3" aria-label="Customers you can attach">
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
                  {item.reference ? ` · reference ${item.reference}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <IntakeKnownContactsChip item={item} />
                {isSelected ? <StatusBadge tone="success">On this booking</StatusBadge> : null}
              </div>
            </div>
            <IntakeContactCycleLine item={item} />
            <CandidateConfidenceBadges item={item} />
            <CandidateLeadFacts item={item} className="sm:grid-cols-2" />
            {item.requires_override_reason ? (
              <FeedbackMessage tone="warning">
                {onSelect
                  ? "This customer came in through a different lead source than this job. Picking them means writing down why."
                  : "This customer came in through a different lead source than this job."}
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
                  {isSelected ? "This booking is for them" : "Use this customer instead"}
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
          {heading ?? BOOKING_INTAKE_STORY.findAnotherCustomer.title}
        </h2>
        <p className="text-sm text-muted-foreground">
          {description ?? BOOKING_INTAKE_STORY.findAnotherCustomer.hint}
        </p>
      </div>
      <form
        className={cn(
          "grid gap-3",
          layout === "narrow"
            ? "grid-cols-1"
            : "md:grid-cols-[minmax(0,1fr)_200px_180px_auto]",
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
          <Label htmlFor="candidate-query">{BOOKING_INTAKE_STORY.findAnotherCustomer.searchLabel}</Label>
          <Input
            id="candidate-query"
            maxLength={100}
            value={draftQuery}
            onChange={(event) => setDraftQuery(event.target.value)}
            placeholder={BOOKING_INTAKE_STORY.findAnotherCustomer.searchPlaceholder}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="candidate-scope">Where to look</Label>
          <select
            id="candidate-scope"
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={draftScope}
            onChange={(event) => setDraftScope(event.target.value as "source" | "all")}
          >
            <option value="source">This job&apos;s lead source</option>
            <option value="all">Every lead source</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="candidate-lead-model">How they came in</Label>
          <select
            id="candidate-lead-model"
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={draftLeadModel}
            onChange={(event) => setDraftLeadModel(event.target.value as GranotLeadModel | "")}
          >
            <option value="">Any way</option>
            <option value="FormLead">Web form</option>
            <option value="CallLead">Phone call</option>
          </select>
        </div>
        <Button className={layout === "narrow" ? undefined : "self-end"} type="submit">Search</Button>
      </form>

      {applied.scope === "all" ? (
        <FeedbackMessage tone="warning">
          You are looking outside this job&apos;s lead source. Anyone you pick from here needs a written
          reason before the booking can be filed.
        </FeedbackMessage>
      ) : null}
      {query.isPending ? <p role="status" className="text-sm text-muted-foreground">Searching customers…</p> : null}
      {query.isError ? (
        <FeedbackMessage tone="error">
          {query.error instanceof Error ? query.error.message : "Unable to search customers."}
        </FeedbackMessage>
      ) : null}
      {query.data ? <LeadCandidateResults items={query.data.items ?? []} selected={selected} onSelect={onSelect} /> : null}
      {query.data?.next_cursor ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => setApplied((current) => ({ ...current, cursor: query.data?.next_cursor ?? undefined }))}
        >
          Show more customers
        </Button>
      ) : null}
    </section>
  );
}
