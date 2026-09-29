"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { readTeamOverview, type WorkloadCount } from "@/lib/api/salesIntelligenceOverview";
import { teamOverviewKey } from "../data/use-team-overview";
import { useViewer } from "./viewer";
import { copy } from "../sales-intelligence-copy";

const t = copy.oi.repView;
const href = (metric: WorkloadCount) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(metric.drill.params)) {
    if (key === "agent_id") continue; // The server forces the signed rep's outer scope.
    if (Array.isArray(value)) for (const item of value) params.append(key, item);
    else params.append(key, value);
  }
  return `/sales-intelligence?${params.toString()}`;
};

export function MyWorkloadView({ row }: { row: NonNullable<Awaited<ReturnType<typeof readTeamOverview>>["data"]["rows"][number]> }) {
  const actionsOnRecords = copy.oi.overview.actionsOnRecords;
  const items: [string, WorkloadCount, string][] = [
    [t.assigned, row.assigned, row.assigned.count.toLocaleString("en-US")],
    [t.followups, row.followups.records, actionsOnRecords(row.followups.actions.count, row.followups.records.count)],
    [t.myOverdue, row.followups_overdue.records, actionsOnRecords(row.followups_overdue.actions.count, row.followups_overdue.records.count)],
    [t.assignedOverdue, row.records_with_overdue, row.records_with_overdue.count.toLocaleString("en-US")],
    [t.dueToday, row.due_today, row.due_today.count.toLocaleString("en-US")],
    [t.noNextStep, row.no_next_step, row.no_next_step.count.toLocaleString("en-US")],
  ];
  return <section className="si-myworkload" aria-label={t.myWorkload}><h2>{t.myWorkload}</h2><div>{items.map(([label, metric, value]) => <Link key={label} href={href(metric)}><strong>{value}</strong><span>{label}</span></Link>)}</div></section>;
}

export function MyWorkload({ priority = [] }: { priority?: readonly string[] }) {
  const viewer = useViewer();
  const team = useQuery({ queryKey: teamOverviewKey(priority), queryFn: ({ signal }) => readTeamOverview(priority, signal), retry: false, enabled: viewer.role === "rep", refetchInterval: 60_000 });
  const row = team.data?.data.rows.find((item) => item.agent.id === viewer.agentId);
  if (team.isSuccess && team.data.data.status !== "ready") return <section className="si-myworkload" aria-label={t.myWorkload}><h2>{t.myWorkload}</h2><p role="status">{team.data.data.status === "pending_projection" ? copy.oi.overview.preparing : copy.oi.overview.notAvailable}</p><button type="button" onClick={() => void team.refetch()}>Retry workload</button></section>;
  if (!row) return <section className="si-myworkload" aria-label={t.myWorkload}><h2>{t.myWorkload}</h2><p>{team.isPending ? "Loading workload…" : t.notCaptured}</p>{team.isError && <button type="button" onClick={() => void team.refetch()}>Retry workload</button>}</section>;
  if (team.data?.data.status !== "ready") return <section className="si-myworkload" aria-label={t.myWorkload}><h2>{t.myWorkload}</h2><p>{t.notCaptured}</p></section>;
  return <>{team.isError && <p role="status" className="si-desk__notice">Could not refresh workload. Showing the previous snapshot. <button type="button" onClick={() => void team.refetch()}>Retry workload</button></p>}<MyWorkloadView row={row} /></>;
}
