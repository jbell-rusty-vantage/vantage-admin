"use client";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/data-table/status-badge";
import type { GranotLifecycleCandidateItem } from "@/lib/api/granotLifecycle";
import {
  CandidateConfidenceBadges,
  CandidateLeadFacts,
  candidateLeadName,
} from "./candidate-lead-facts";

export function SelectedLeadCard({
  selected,
  loading,
  autoSelected,
  onChangeLead,
  changeLabel,
}: {
  selected?: GranotLifecycleCandidateItem;
  loading?: boolean;
  autoSelected?: boolean;
  onChangeLead?: () => void;
  changeLabel?: string;
}) {
  if (!selected) {
    return (
      <div className="rounded-lg border border-dashed p-4">
        <p className="font-semibold text-navy">No lead is attached to this booking yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {loading
            ? "Looking for the matching lead…"
            : "Nothing matched automatically. Open the lead search and choose the customer this job belongs to."}
        </p>
        {onChangeLead ? (
          <Button type="button" variant="outline" className="mt-3" onClick={onChangeLead}>
            {changeLabel ?? "Open lead search"}
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-lg border-2 border-trust-blue bg-trust-blue/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-trust-blue">
            This booking will be created for
          </p>
          <p className="mt-1 truncate text-xl font-semibold text-navy">
            {candidateLeadName(selected)}
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <CandidateConfidenceBadges item={selected} showSuggested={false} />
          <StatusBadge tone="muted">
            {autoSelected ? "Pre-selected best match" : "You chose this lead"}
          </StatusBadge>
        </div>
      </div>

      <CandidateLeadFacts item={selected} className="mt-4" />

      {onChangeLead ? (
        <Button type="button" variant="outline" className="mt-4" onClick={onChangeLead}>
          {changeLabel ?? "This is the wrong lead — search for another"}
        </Button>
      ) : null}
    </div>
  );
}
