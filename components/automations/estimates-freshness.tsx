"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchEstimatesFreshness, type EstimatesFreshness } from "@/lib/api/granotAutomation";
import { formatAbsolute } from "@/components/ui/crm/format";

export function EstimatesFreshnessView({ data, failed }: { data?: EstimatesFreshness; failed: boolean }) {
  const slot = data?.latest_slot;
  const delayed = data?.warnings.some((warning) => ["no_complete_scheduled_coverage", "partial_scan", "failed_windows", "late_slot"].includes(warning));
  return (
    <section className="crm-card crm-stack" style={{ padding: "var(--crm-space-5, 20px)" }} aria-label="Scheduled Granot updates" data-testid="estimates-freshness">
      <h2 className="crm-strong">Scheduled Granot updates</h2>
      <p className="crm-small crm-text-muted">8 a.m., 1 p.m. and 6 p.m. New York. The last 90 days, plus older dates observed in Granot.</p>
      {failed ? <p role="status">Scheduled update status could not load.</p> : !data ? <p role="status">Checking scheduled updates…</p> : (
        <>
          <p>Last complete collection: {data.last_complete_coverage_at ? formatAbsolute(data.last_complete_coverage_at) : "No complete scheduled collection recorded yet"}.</p>
          {slot ? <p>{slot.collected_windows} of {slot.expected_windows} date ranges collected · {slot.completed_windows} finished processing.</p> : <p>No scheduled refresh recorded yet.</p>}
          {delayed ? <p role="status">{slot?.failed_windows ? "Some date ranges failed. " : ""}The scheduled refresh is incomplete or delayed. Leads outside the collected ranges may still show older information.</p> : null}
          {data.warnings.includes("synchronization_pending") ? <p role="status">Collected updates are still processing.</p> : null}
          {data.warnings.includes("held_rows") ? <p role="status">Some Leads could not be matched or need review. Their existing information is preserved.</p> : null}
          <p className="crm-small crm-text-muted">A complete collection can contain held or unmatched Leads. Older dates not yet observed in Granot need separate reconciliation.</p>
        </>
      )}
    </section>
  );
}

export function EstimatesFreshnessCard() {
  const query = useQuery({ queryKey: ["granot-estimates-freshness"], queryFn: fetchEstimatesFreshness, refetchInterval: 60_000, refetchIntervalInBackground: false, retry: false });
  return <EstimatesFreshnessView data={query.data} failed={query.isError} />;
}
