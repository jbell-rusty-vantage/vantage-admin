"use client";
import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { readActivityOverview, readTeamOverview, type TeamRow } from "@/lib/api/salesIntelligenceOverview";
import { activityOverviewKey, teamOverviewKey } from "../data/use-team-overview";
import { copy } from "../sales-intelligence-copy";
import { formatTimeOnly } from "../lib/time";
import type { DeskUrlState } from "../data/url-state";
import { repCanonicalHref, repViewHref } from "./drills";

const t = copy.oi.repView;
type Relationship = "assigned" | "followup" | "involved";
const number = (n: number) => n.toLocaleString("en-US");

export function RepViewHeader({ row, selected, activeWork, snapshotId, latestSnapshotId, activity, overviewHref = "/sales-intelligence" }: {
  row: TeamRow; selected: Relationship; activeWork: readonly string[]; snapshotId: string | null; latestSnapshotId: string | null;
  activity: { human_conversations: number | null; outbound_attempts: number | null; last_conversation_at?: string | null } | null;
  overviewHref?: string;
}) {
  const id = row.agent.id;
  const base = selected === "followup" ? row.followups.records : selected === "involved" ? row.involved : row.assigned;
  const tabs = [
    { key: "assigned" as const, label: t.assigned, count: row.assigned.count, metric: row.assigned },
    { key: "followup" as const, label: t.followups, count: row.followups.records.count, value: copy.oi.overview.actionsOnRecords(row.followups.actions.count, row.followups.records.count), metric: row.followups.records },
    { key: "involved" as const, label: t.involved, count: row.involved.count, metric: row.involved },
  ];
  const quick = [
    { key: "overdue_followup", label: selected === "followup" ? t.myOverdue : t.withOverdue, metric: selected === "followup" ? row.followups_overdue.records : row.records_with_overdue,
      value: selected === "followup" ? copy.oi.overview.actionsOnRecords(row.followups_overdue.actions.count, row.followups_overdue.records.count) : undefined },
    { key: "due_today", label: t.dueToday, metric: row.due_today },
    { key: "no_next_step", label: t.noNextStep, metric: row.no_next_step },
  ];
  const selectedQuick = quick.find((item) => activeWork.includes(item.key));
  const latestMetric = selectedQuick?.metric ?? base;
  const latestRelationship: Relationship = selectedQuick ? selected === "followup" && selectedQuick.key === "overdue_followup" ? "followup" : "assigned" : selected;
  return <header className="si-repview__header">
    <Link href={overviewHref} className="si-repview__back">← {t.back}</Link>
    <h1>{row.agent.name} {!row.agent.active && <small>· {t.inactive}</small>}</h1>
    <p>{t.ownerViewing(row.agent.name)}</p>
    <nav className="si-repview__segments" aria-label="Rep relationship">{tabs.map((tab) => <Link key={tab.key} href={repViewHref(tab.metric, id, tab.key)} aria-current={selected === tab.key ? "page" : undefined}>{tab.label} <strong>{"value" in tab && tab.value ? tab.value : number(tab.count)}</strong></Link>)}</nav>
    <div className="si-repview__quick" aria-label="Quick filters">{quick.map((item) => {
      const relation = selected === "followup" && item.key === "overdue_followup" ? "followup" : "assigned";
      const active = activeWork.includes(item.key) && selected === relation;
      return <Link key={item.key} href={active ? repViewHref(base, id, selected) : repViewHref(item.metric, id, relation)} aria-current={active ? "true" : undefined}>{item.label} {"value" in item && item.value ? item.value : number(item.metric.count)}</Link>;
    })}</div>
    <p className="si-repview__activity">{t.today}: {activity?.human_conversations == null ? t.notCaptured : number(activity.human_conversations)} {t.conversations} · {activity?.outbound_attempts == null ? t.notCaptured : number(activity.outbound_attempts)} {t.attempts} · {t.lastConversation} {activity?.last_conversation_at ? formatTimeOnly(activity.last_conversation_at) : t.notCaptured}</p>
    {snapshotId && latestSnapshotId && snapshotId !== latestSnapshotId && <p role="status" className="si-desk__notice">{t.updatedSince} <Link href={repViewHref(latestMetric, id, latestRelationship)}>{t.latest}</Link></p>}
  </header>;
}

export function RepView({ state, query, children }: { state: DeskUrlState; query: string; children: (row: TeamRow | null) => ReactNode }) {
  const router = useRouter();
  const id = state.agent;
  const selected: Relationship = state.relationship ?? "assigned";
  const team = useQuery({ queryKey: teamOverviewKey(state.priority), queryFn: ({ signal }) => readTeamOverview(state.priority, signal), retry: false, enabled: !!id, refetchInterval: 60_000 });
  const activity = useQuery({ queryKey: activityOverviewKey("today"), queryFn: ({ signal }) => readActivityOverview("today", null, null, signal), retry: false, enabled: !!id, refetchInterval: 60_000 });
  const row = team.data?.data.rows.find((item) => item.agent.id === id);
  const baseMetric = row && (selected === "followup" ? row.followups.records : selected === "involved" ? row.involved : row.assigned);
  const canonicalHref = baseMetric ? repCanonicalHref(state, query, baseMetric) : null;
  useEffect(() => { if (canonicalHref) router.replace(canonicalHref, { scroll: false }); }, [canonicalHref, router]);
  if (!id || !/^[a-f\d]{24}$/i.test(id)) return <p role="status" className="si-desk__notice">{t.unavailable} <Link href="/sales-intelligence">{t.back}</Link></p>;
  if (team.isSuccess && team.data.data.status !== "ready") return <section className="si-repview__header"><p role="status">{team.data.data.status === "pending_projection" ? copy.oi.overview.preparing : copy.oi.overview.notAvailable}</p><button type="button" onClick={() => void team.refetch()}>Retry workload</button><Link href="/sales-intelligence">{t.back}</Link></section>;
  if (team.isSuccess && !row) return <p role="status" className="si-desk__notice">{t.unavailable} <Link href="/sales-intelligence">{t.back}</Link></p>;
  const activityRow = activity.data?.data.by_rep.find((item) => item.agent_id === id) ?? null;
  const overviewParams = new URLSearchParams();
  for (const value of state.priority) overviewParams.append("priority", value);
  const overviewHref = overviewParams.size ? `/sales-intelligence?${overviewParams.toString()}` : "/sales-intelligence";
  return <div className="si-repview">
    {team.isError && row && <p role="status" className="si-desk__notice">Could not refresh workload. Showing the previous snapshot. <button type="button" onClick={() => void team.refetch()}>Retry workload</button></p>}
    {row ? <><RepViewHeader row={row} selected={selected} activeWork={state.work} snapshotId={state.snapshot_id} latestSnapshotId={team.data?.data.snapshot_id ?? null} activity={activityRow} overviewHref={overviewHref} />{activity.isError && <p role="status" className="si-desk__notice">{t.notCaptured} <button type="button" onClick={() => void activity.refetch()}>Retry activity</button></p>}</> : <header className="si-repview__header"><Link href={overviewHref}>← {t.back}</Link><p role="status">{team.isError ? t.notCaptured : "Loading rep workload…"}</p>{team.isError && <button type="button" onClick={() => void team.refetch()}>Retry workload</button>}</header>}
    {canonicalHref ? <p role="status" className="si-desk__notice">Loading counted Outreach for this rep…</p> : row ? children(row) : null}
  </div>;
}
