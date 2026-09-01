import { StatusBadge } from "@/components/data-table/status-badge";
import type { FeedReadiness } from "@/lib/api/leadSources";

export function ReadinessBadge({ readiness }: { readiness: FeedReadiness }) {
  if (readiness.live) {
    return <StatusBadge tone="success">Live</StatusBadge>;
  }
  return <StatusBadge tone="muted">Not live</StatusBadge>;
}

export function LeadCostLine({ value }: { value: FeedReadiness["lead_cost"] }) {
  return <span>Lead cost: {value}</span>;
}
