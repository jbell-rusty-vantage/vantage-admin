"use client";
import { Fragment, useRef, useState } from "react";
import type { SalesOutreachPerformanceRow } from "@/lib/api/salesOutreach";
import { usePerformance } from "../data/use-desk-reads";
import { absoluteTime, nyDate } from "../lib/format";
import { performanceCount as count, performanceDateLabel as dateLabel, performanceRate as rate, performanceState as state, performanceWeekStart, shiftPerformanceDate } from "../lib/performance";
import { ReadFailure } from "../primitives";

type Channel = "calls" | "texts";
export function PerformanceDay({ day, channel }: { day: SalesOutreachPerformanceRow["days"][number]; channel: Channel }) {
  if (day.future) return <>Upcoming</>;
  const value = day[channel];
  return <>
    {channel === "calls" ? `${count(day.calls.actual)} calls · ${day.calls.goal === null ? "Goal pending" : `${day.calls.goal} goal`}` : `${count(day.texts.sent)} sent · ${day.texts.on_time_required}/${day.texts.applicable_required} required on time`}
    <span className="od-cell__sub">{state(value.state)}{value.coverage !== "complete" ? ` · Pending data: capture ${value.coverage === "partial" ? "catching up" : "not reported yet"}` : ""}{channel === "texts" && day.texts.pending > 0 ? ` · ${day.texts.pending} pending requirements` : ""}</span>
  </>;
}

export function RepPerformance({ asOf }: { asOf: string }) {
  const today = nyDate(asOf);
  const currentWeek = performanceWeekStart(today);
  // null follows New York rollover; a selected historical date remains selected through refresh.
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const weekStart = selectedWeek ?? currentWeek;
  const [channel, setChannel] = useState<Channel>("calls");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const callsTab = useRef<HTMLButtonElement>(null);
  const textsTab = useRef<HTMLButtonElement>(null);
  const query = usePerformance(weekStart);
  const data = query.data;
  const current = weekStart === currentWeek;
  const rows = [...(data?.rows ?? [])].sort((a, b) => (a[channel].rank ?? Infinity) - (b[channel].rank ?? Infinity) || a.agent_id.localeCompare(b.agent_id));
  const toggle = (id: string) => setExpanded(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const selectTab = (next: Channel) => { setChannel(next); (next === "calls" ? callsTab : textsTab).current?.focus(); };
  const columns = current ? 6 : 5;
  return <section className="od-card od-performance" aria-labelledby="od-performance-title" data-testid="rep-performance">
    <div className="od-card__head">
      <div><h2 className="od-card__title" id="od-performance-title">Rep performance</h2><p className="od-card__subtitle">{dateLabel(weekStart)} – {dateLabel(shiftPerformanceDate(weekStart, 6))} · New York</p></div>
      <nav className="od-card__tools" aria-label="Performance week">
        <button className="od-button" type="button" onClick={() => setSelectedWeek(shiftPerformanceDate(weekStart, -7))}>Previous</button>
        <button className="od-button" type="button" disabled={current} onClick={() => setSelectedWeek(shiftPerformanceDate(weekStart, 7))}>Next</button>
        <button className="od-button" type="button" disabled={current} onClick={() => setSelectedWeek(null)}>This week</button>
      </nav>
    </div>
    <div className="od-performance__toolbar">
      <div className="od-segmented" role="tablist" aria-label="Performance channel" onKeyDown={event => { if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) { event.preventDefault(); selectTab(event.key === "Home" ? "calls" : event.key === "End" ? "texts" : channel === "calls" ? "texts" : "calls"); } }}>
        {(["calls", "texts"] as const).map(value => <button ref={value === "calls" ? callsTab : textsTab} type="button" key={value} id={`od-performance-tab-${value}`} role="tab" aria-selected={channel === value} aria-controls="od-performance-panel" tabIndex={channel === value ? 0 : -1} className="od-segmented__item" onClick={() => setChannel(value)}>{value === "calls" ? "Calls" : "Texts"}</button>)}
      </div>
      <span className="od-text-muted" aria-live="polite">{data ? `${data.provisional[channel] ? "Provisional · " : ""}${data.channel_freshness[channel] ? `Capture through ${absoluteTime(data.channel_freshness[channel])}` : "Capture not reported yet"}` : "Loading performance…"}</span>
    </div>
    {query.error ? <ReadFailure what="Rep performance could not be loaded." error={query.error} staleAsOf={data?.as_of ?? null} onRetry={() => void query.refetch()} testId="performance-read-error" /> : null}
    <div id="od-performance-panel" role="tabpanel" aria-labelledby={`od-performance-tab-${channel}`} tabIndex={0} className="od-table-wrap">
      <table className="od-table"><thead><tr><th scope="col">Rank</th><th scope="col">Rep</th><th scope="col">{channel === "calls" ? "Days at goal" : "Required on time"}</th><th scope="col">{channel === "calls" ? "Calls this week" : "Texts this week"}</th>{current ? <th scope="col">Today</th> : null}<th scope="col">Daily detail</th></tr></thead>
        <tbody>{!data ? <tr><td colSpan={columns}>{query.error ? "Performance unavailable" : "Loading performance…"}</td></tr> : !rows.length ? <tr><td colSpan={columns}>No Rep performance available for this week.</td></tr> : rows.map(row => {
          const metric = row[channel];
          const pending = channel === "calls" ? row.calls.pending_days : row.texts.pending_requirements;
          const day = row.days.find(item => item.business_date === today);
          const detailId = `od-performance-${row.agent_id}`;
          return <Fragment key={row.agent_id}><tr>
            <td>{metric.rank === null ? "Not ranked" : metric.rank}</td><th scope="row">{row.name ?? "Unknown Rep"}{row.historical_membership_state !== "active" ? <span className="od-cell__sub">{row.historical_membership_state === "historical" ? "Historical Rep" : "Membership pending"}</span> : null}</th>
            <td>{channel === "calls" ? `${row.calls.met_days}/${row.calls.eligible_days} days` : `${row.texts.on_time_required}/${row.texts.resolved_due_required} required`} · {rate(metric.completion_rate)}{pending > 0 || metric.provisional ? <span className="od-cell__sub">{pending > 0 ? `${pending} pending ${channel === "calls" ? (pending === 1 ? "day" : "days") : (pending === 1 ? "requirement" : "requirements")}` : "Pending data"} · Provisional</span> : null}</td>
            <td>{count(metric.weekly_volume)}</td>{current ? <td>{day ? <PerformanceDay day={day} channel={channel} /> : "Pending data"}</td> : null}
            <td><button type="button" className="od-button" aria-expanded={expanded.has(row.agent_id)} aria-controls={detailId} aria-label={`${expanded.has(row.agent_id) ? "Hide" : "Show"} daily performance for ${row.name ?? "Unknown Rep"}`} onClick={() => toggle(row.agent_id)}>{expanded.has(row.agent_id) ? "Hide days" : "Show days"}</button></td>
          </tr><tr hidden={!expanded.has(row.agent_id)} id={detailId}><td colSpan={columns}><table className="od-table od-performance__days" aria-label={`${row.name ?? "Unknown Rep"} daily ${channel}`}><thead><tr><th scope="col">Day</th><th scope="col">Volume, requirement and status</th></tr></thead><tbody>{row.days.map(item => <tr key={item.business_date}><th scope="row">{new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(new Date(`${item.business_date}T12:00:00Z`))} {dateLabel(item.business_date)}</th><td><PerformanceDay day={item} channel={channel} /></td></tr>)}</tbody></table></td></tr></Fragment>;
        })}</tbody>
      </table>
    </div>
    <p className="od-card__foot">{channel === "calls" ? "Completion uses resolved closed goal days; extra calls do not replace a missed day." : "Completion uses resolved required texts from closed dates; extra texts do not replace a missed requirement."} Today stays outside completion until the workday closes. Equal rates rank by weekly volume, including today. Pending data is excluded from completion.</p>
    {data ? <p className="od-card__foot">Reliable history: {channel === "calls" ? `calls ${data.earliest_reliable_dates.calls ? `from ${dateLabel(data.earliest_reliable_dates.calls)}` : "not established"}` : `text volume ${data.earliest_reliable_dates.text_volume ? `from ${dateLabel(data.earliest_reliable_dates.text_volume)}` : "not established"}; requirements ${data.earliest_reliable_dates.text_requirements ? `from ${dateLabel(data.earliest_reliable_dates.text_requirements)}` : "not established"}`}.{channel === "texts" && data.unassigned.required_text_counts > 0 ? ` ${data.unassigned.required_text_counts} unassigned requirements are outside Rep rankings.` : ""}</p> : null}
  </section>;
}
