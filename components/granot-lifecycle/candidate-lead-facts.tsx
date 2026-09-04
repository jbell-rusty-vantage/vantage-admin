import { StatusBadge } from "@/components/data-table/status-badge";
import { IntakeKnownContactsCards } from "@/components/intakes/intake-known-contacts";
import type { GranotLifecycleCandidateItem } from "@/lib/api/granotLifecycle";
import { cn } from "@/lib/utils";

const MATCH_METHOD_LABELS: Record<string, string> = {
  call_job_no_exact: "The job number on this phone lead matches exactly",
  form_job_no_exact: "The job number on this web lead matches exactly",
  form_ref_no_exact: "The reference on this web lead matches exactly",
  form_mongo_id_compatibility: "An older Vantage identifier on this web lead matches",
  source_scoped_contact: "The name, phone, or email matches inside this lead source",
  candidate_browse_match: "Found by searching this lead source",
};

export function candidateLeadName(item: GranotLifecycleCandidateItem): string {
  const name = item.contact?.name?.trim();
  if (name) return name;
  return item.customer_label || "No name on this lead";
}

export function candidateMatchLabel(matchMethod: string): string {
  return MATCH_METHOD_LABELS[matchMethod] ?? matchMethod.replaceAll("_", " ");
}

export function candidateLeadTypeLabel(model: GranotLifecycleCandidateItem["lead_ref"]["model"]): string {
  return model === "CallLead" ? "Came in by phone" : "Came in by web form";
}

export function CandidateConfidenceBadges({
  item,
  showSuggested = true,
}: {
  item: GranotLifecycleCandidateItem;
  showSuggested?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      <StatusBadge tone={item.confidence === "high" ? "success" : "warning"}>
        {item.confidence === "high" ? "Strong match" : "Possible match"}
      </StatusBadge>
      {showSuggested && item.suggested ? <StatusBadge>Best match</StatusBadge> : null}
      <StatusBadge tone={item.in_source_scope ? "success" : "warning"}>
        {item.in_source_scope ? "Same lead source as this job" : "Different lead source"}
      </StatusBadge>
    </div>
  );
}

function Fact({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={cn("mt-0.5 break-words text-sm", mono && "font-mono text-xs")}>
        {value?.trim() ? value : "—"}
      </dd>
    </div>
  );
}

export function CandidateLeadFacts({
  item,
  className,
  includeSource = true,
}: {
  item: GranotLifecycleCandidateItem;
  className?: string;
  includeSource?: boolean;
}) {
  return (
    <div className="space-y-3">
      <IntakeKnownContactsCards item={item} compact />
      <dl className={cn("grid gap-x-4 gap-y-3 sm:grid-cols-2", className)}>
        <Fact label="Job number" value={item.job_no} />
        <Fact label="Reference" value={item.reference} />
        <Fact label="How they came in" value={candidateLeadTypeLabel(item.lead_ref.model)} />
        <Fact label="Why it matched" value={candidateMatchLabel(item.match_method)} />
        <Fact label="Lead ID for support" value={item.lead_ref.id} mono />
        {includeSource ? (
          <>
            <Fact
              label="Lead source"
              value={item.source?.source_company_label ?? item.source?.lead_source_company}
            />
            <Fact
              label="Where in that source"
              value={item.source?.source_granularity_label ?? item.source?.source_granularity_id}
            />
          </>
        ) : null}
      </dl>
    </div>
  );
}
