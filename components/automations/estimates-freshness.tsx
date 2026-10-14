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
          {data.pool_lanes ? <div className="crm-stack" data-testid="pool-lane-freshness">
            <PoolLaneFreshness title="Pool refresh" schedule="8 a.m., 1 p.m. and 6 p.m. New York, after ALL. Last 90 days plus every remembered older Pool month." lane={data.pool_lanes.refresh} />
            <PoolLaneFreshness title="Pool historical discovery" schedule="6 a.m. New York daily. January 1, 2020 through today, resumed across date ranges." lane={data.pool_lanes.discovery} />
          </div> : null}
        </>
      )}
    </section>
  );
}

function PoolLaneFreshness({ title, schedule, lane }: { title: string; schedule: string; lane: NonNullable<EstimatesFreshness["pool_lanes"]>["refresh"] }) {
  const slot = lane.latest_slot;
  const incomplete = lane.warnings.some((warning) => ["no_complete_scheduled_coverage", "partial_scan", "failed_windows", "late_slot"].includes(warning));
  return <section className="crm-stack" aria-label={title}>
    <h3 className="crm-strong">{title}</h3>
    <p className="crm-small crm-text-muted">{schedule}</p>
    <p>Last complete scope: {lane.last_complete_coverage_at ? formatAbsolute(lane.last_complete_coverage_at) : "No complete collection recorded yet"}.</p>
    {slot ? <p>{slot.collected_windows} of {slot.expected_windows} date ranges collected · {slot.completed_windows} finished · {slot.failed_windows} failed.</p> : <p>No scheduled collection recorded yet.</p>}
    {lane.oldest_uncovered_range ? <p>Oldest uncovered range: {lane.oldest_uncovered_range.from} through {lane.oldest_uncovered_range.to}.</p> : null}
    {lane.held_rows !== undefined ? <p>{lane.held_rows} rows held for review.</p> : null}
    {lane.lag_ms != null ? <p>Collection lag: {Math.ceil(lane.lag_ms / 60_000)} minutes.</p> : null}
    {incomplete ? <p role="status">This Pool collection is incomplete or delayed. The last complete scope remains the freshness boundary.</p> : null}
    {lane.warnings.includes("synchronization_pending") ? <p role="status">Collected Pool updates are still processing.</p> : null}
    {lane.warnings.includes("held_rows") ? <p role="status">Some Pool rows are held for review. Existing Lead information is preserved.</p> : null}
    <p className="crm-small crm-text-muted">An absent Pool row does not prove a Lead left Pool.</p>
  </section>;
}

export function EstimatesFreshnessCard() {
  const query = useQuery({ queryKey: ["granot-estimates-freshness"], queryFn: fetchEstimatesFreshness, refetchInterval: 60_000, refetchIntervalInBackground: false, retry: false });
  return <EstimatesFreshnessView data={query.data} failed={query.isError} />;
}
