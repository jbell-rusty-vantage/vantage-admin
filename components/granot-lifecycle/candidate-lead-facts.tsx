import { StatusBadge } from "@/components/data-table/status-badge";
import type { GranotLifecycleCandidateItem } from "@/lib/api/granotLifecycle";
import { cn } from "@/lib/utils";

const MATCH_METHOD_LABELS: Record<string, string> = {
  call_job_no_exact: "Call lead job number matches exactly",
  form_job_no_exact: "Form lead job number matches exactly",
  form_ref_no_exact: "Form lead reference matches exactly",
  form_mongo_id_compatibility: "Form lead id compatibility match",
  source_scoped_contact: "Name, phone, or email match inside the source",
  candidate_browse_match: "Found by browsing this source",
};

export function candidateLeadName(item: GranotLifecycleCandidateItem): string {
  const name = item.contact?.name?.trim();
  if (name) return name;
  return item.masked_contact_label || "Name not on this lead";
}

export function candidateMatchLabel(matchMethod: string): string {
  return MATCH_METHOD_LABELS[matchMethod] ?? matchMethod.replaceAll("_", " ");
}

export function candidateLeadTypeLabel(model: GranotLifecycleCandidateItem["lead_ref"]["model"]): string {
  return model === "CallLead" ? "Call lead" : "Form lead";
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
        {item.confidence === "high" ? "High confidence" : "Medium confidence"}
      </StatusBadge>
      {showSuggested && item.suggested ? <StatusBadge>Best match</StatusBadge> : null}
      <StatusBadge tone={item.in_source_scope ? "success" : "warning"}>
        {item.in_source_scope ? "In Source Scope" : "Outside Source Scope"}
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
    <dl className={cn("grid gap-x-4 gap-y-3 sm:grid-cols-2", className)}>
      <Fact label="Name" value={item.contact?.name} />
      <Fact label="Phone" value={item.contact?.phone_number} />
      <Fact label="Email" value={item.contact?.email} />
      <Fact label="Job number" value={item.job_no} />
      <Fact label="Reference (ref no)" value={item.reference} />
      <Fact label="Lead type" value={candidateLeadTypeLabel(item.lead_ref.model)} />
      <Fact label="Lead ID" value={item.lead_ref.id} mono />
      <Fact label="Why it matched" value={candidateMatchLabel(item.match_method)} />
      {includeSource ? (
        <>
          <Fact
            label="Source company"
            value={item.source?.source_company_label ?? item.source?.lead_source_company}
          />
          <Fact
            label="Source granularity"
            value={item.source?.source_granularity_label ?? item.source?.source_granularity_id}
          />
        </>
      ) : null}
    </dl>
  );
}
