"use client";
import Link from "next/link";
import { useId, useMemo, useState } from "react";
import type { TeamOverview, TeamRow, WorkloadCount } from "@/lib/api/salesIntelligenceOverview";
import { copy } from "../sales-intelligence-copy";
import { workloadHref } from "./links";

const t = copy.oi.overview;
type SortKey = "name" | "assigned" | "records_with_overdue" | "due_today" | "no_next_step" | "followups";
const cols: [SortKey, string][] = [["name", t.rep], ["assigned", t.assigned], ["records_with_overdue", t.withOverdue], ["due_today", t.dueToday], ["no_next_step", t.noNext], ["followups", t.followups]];
const count = (metric: WorkloadCount | undefined, label: string) => metric ? <Link href={workloadHref(metric)} aria-label={`${label}: ${metric.count}`}>{metric.count.toLocaleString("en-US")}</Link> : <span>{t.unavailable}</span>;
const followupLine = (row: TeamRow) => row.followups.actions.count === 0 ? <span aria-label={t.noFollowups}>—</span> : <><Link href={workloadHref(row.followups.records)}>{t.actionsOnRecords(row.followups.actions.count, row.followups.records.count)}</Link>{row.followups_overdue.actions.count > 0 && <span className="si-oi-workload__overdue"> · <Link href={workloadHref(row.followups_overdue.records)}>{t.overdueActions(row.followups_overdue.actions.count)}</Link></span>}</>;
const repHref = (id: string) => `/sales-intelligence?view=rep&agent=${encodeURIComponent(id)}`;

export function TeamWorkload({ data, rep = false }: { data: TeamOverview; rep?: boolean }) {
  const headingId = useId();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("name");
  const [descending, setDescending] = useState(false);
  const [page, setPage] = useState(1);
  const filtered = useMemo(() => data.rows.filter((row) => row.agent.name.toLowerCase().includes(search.toLowerCase().trim())).sort((a, b) => {
    const diff = sort === "name" ? a.agent.name.localeCompare(b.agent.name) : (sort === "followups" ? a.followups.actions.count - b.followups.actions.count : a[sort].count - b[sort].count);
    return (descending ? -1 : 1) * diff;
  }), [data.rows, descending, search, sort]);
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / 25)));
  const rows = filtered.slice((currentPage - 1) * 25, currentPage * 25);
  const showUnassigned = !rep && !!data.unassigned && !search.trim() && currentPage * 25 >= filtered.length;
  const changeSort = (key: SortKey) => { setDescending(key === sort ? !descending : false); setSort(key); setPage(1); };
  return <section className="si-oi-workload si-ovblock" aria-labelledby={headingId}>
    <div className="si-oi-heading"><h2 id={headingId} className="si-heading si-heading--2">{rep ? t.myWorkload : t.workload} <small>{t.workloadNow}</small></h2>
      {!rep && <label>{t.searchRep}<input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></label>}</div>
    {data.status !== "ready" ? <p role="status">{t.unavailable} · {t.noTeam}</p> : <>
      <table className="si-oi-workload__table"><thead><tr>{cols.map(([key, label]) => <th key={key} scope="col" aria-sort={sort === key ? descending ? "descending" : "ascending" : "none"}><button type="button" onClick={() => changeSort(key)} aria-label={`Sort by ${label}`}>{label}{sort === key ? descending ? " ↓" : " ↑" : ""}</button></th>)}</tr></thead><tbody>
        {rows.map((row) => <tr key={row.agent.id}><th scope="row">{rep ? row.agent.name : <Link href={repHref(row.agent.id)}>{row.agent.name}</Link>}{!row.agent.active && <small> · {t.inactiveWork}</small>}{row.assigned.count === 0 && <small className="si-oi-workload__zero">{t.noAssigned}</small>}</th><td>{count(row.assigned, t.assigned)}</td><td>{count(row.records_with_overdue, t.withOverdue)}</td><td>{count(row.due_today, t.dueToday)}</td><td>{count(row.no_next_step, t.noNext)}</td><td>{followupLine(row)}</td></tr>)}
        {showUnassigned && data.unassigned && <tr className="si-oi-workload__unassigned"><th scope="row">{t.unassignedRow}</th><td>{count(data.unassigned.assigned, t.assigned)}</td><td>{count(data.unassigned.records_with_overdue, t.withOverdue)}</td><td>{count(data.unassigned.due_today, t.dueToday)}</td><td>{count(data.unassigned.no_next_step, t.noNext)}</td><td>{t.unavailable}</td></tr>}
      </tbody></table>
      <div className="si-oi-workload__cards">{rows.map((row) => <article key={row.agent.id} className="si-oi-workload__card"><h3>{rep ? row.agent.name : <Link href={repHref(row.agent.id)}>{row.agent.name}</Link>}{!row.agent.active && <small> · {t.inactiveWork}</small>}</h3>{row.assigned.count === 0 && <p>{t.noAssigned}</p>}<dl>{[[t.assigned, row.assigned], [t.withOverdue, row.records_with_overdue], [t.dueToday, row.due_today], [t.noNext, row.no_next_step]].map(([label, metric]) => <div key={String(label)}><dt>{String(label)}</dt><dd>{count(metric as WorkloadCount, String(label))}</dd></div>)}</dl><details><summary>{t.followups}</summary><p>{followupLine(row)}</p></details></article>)}{showUnassigned && data.unassigned && <article className="si-oi-workload__card"><h3>{t.unassignedRow}</h3><dl>{[[t.assigned, data.unassigned.assigned], [t.withOverdue, data.unassigned.records_with_overdue], [t.dueToday, data.unassigned.due_today], [t.noNext, data.unassigned.no_next_step]].map(([label, metric]) => <div key={String(label)}><dt>{String(label)}</dt><dd>{count(metric as WorkloadCount, String(label))}</dd></div>)}</dl></article>}</div>
      <footer className="si-oi-workload__footer"><span>{t.showing(rows.length, filtered.length)}</span>{currentPage > 1 && <button type="button" onClick={() => setPage(currentPage - 1)}>Previous</button>}{currentPage * 25 < filtered.length && <button type="button" onClick={() => setPage(currentPage + 1)}>Next</button>}</footer>
    </>}
  </section>;
}
