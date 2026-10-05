"use client";
/**
 * Activity (ADM-6; SPECIFICATION §4 "Activity"): read-only contact history and cadence transitions. The list is the
 * scoped queue (`All active`, most recently contacted first — the server's sort); the right side shows the selected
 * lead's own evidence (metadata only, never bodies), assignment changes, follow-up plans and daily requirement
 * windows from `GET /outreach/:id`. A Rep sees only its current assignments; coordinators may filter by rep.
 */
import { useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Users } from "lucide-react";
import type { SalesOutreachCapabilitiesDto, SalesOutreachDetailDto } from "@/lib/api/salesOutreach";
import { isSalesOutreachApiError } from "@/lib/api/salesOutreach";
import { clearSubject } from "@/lib/query/salesOutreach";
import { useDetail, useQueue, useTeam } from "../data/use-desk-reads";
import { useDeskUrl } from "../data/use-desk-url";
import type { DeskViewer } from "../shell/desk-shell";
import { absoluteTime, ownerText, priorityPill, relativeDay, shortDateLabel } from "../lib/format";
import { deskCopy } from "../outreach-desk-copy";
import { DeskHeader, DeskSelect, Pill, SearchBox, SkeletonLine } from "../primitives";

const c = deskCopy.activity;
const l = deskCopy.lead;
const t = deskCopy.text;

function History({ detail }: { detail: SalesOutreachDetailDto }) {
  const events = [...detail.history.contact_events].sort((a, b) => Date.parse(b.event_at) - Date.parse(a.event_at));
  return (
    <div className="od-history">
      <header>
        <h2 className="od-lead__job">{detail.subject.job_no ?? l.jobPending}</h2>
        <p className="od-lead__phone">{[detail.subject.phone, detail.subject.name].filter(Boolean).join(" · ")}</p>
      </header>
      <section>
        <h3 className="od-lead__section">{c.detailTitle}</h3>
        {events.length === 0 ? (
          <p className="od-lead__muted">{l.noActivity}</p>
        ) : (
          <ol className="od-timeline">
            {events.map((event) => (
              <li key={event.event_id} className="od-timeline__item">
                <span className="od-timeline__dot" aria-hidden="true" />
                <span title={absoluteTime(event.event_at)}>{relativeDay(event.event_at, detail.as_of)}</span>
                <span aria-hidden="true"> · </span>
                <span>{l.events[event.kind] ?? l.events.other}</span>
                {event.actor_agent_name ? <span className="od-lead__muted"> · {event.actor_agent_name}</span> : null}
                {l.verification[event.verification] ? <span className="od-text-amber"> · {l.verification[event.verification]}</span> : null}
              </li>
            ))}
          </ol>
        )}
        {detail.history.contact_events_truncated ? <p className="od-lead__muted">…</p> : null}
      </section>
      {detail.history.assignment_changes.length ? (
        <section>
          <h3 className="od-lead__section">{c.assignmentChanges}</h3>
          <ul className="od-plainlist">
            {detail.history.assignment_changes.map((change) => (
              <li key={`${change.applied_at}-${change.to_agent_id}`} title={absoluteTime(change.applied_at)}>
                {relativeDay(change.applied_at, detail.as_of)}: {change.to_agent_id ? (change.to_agent_id === detail.assignment.assigned_agent_id ? (detail.assignment.assigned_agent_name ?? t.unknownRep) : t.unknownRep) : t.unassigned}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {detail.plan.history.length || detail.plan.active ? (
        <section>
          <h3 className="od-lead__section">{c.planHistory}</h3>
          <ul className="od-plainlist">
            {[...(detail.plan.active ? [detail.plan.active] : []), ...detail.plan.history].map((plan) => (
              <li key={plan.plan_id}>
                {plan.kind === "quoted_date" ? l.quotedDate : l.callback}: {plan.selected_date ? shortDateLabel(plan.selected_date) : absoluteTime(plan.appointment_at)} · {deskCopy.planStatus[plan.status] ?? plan.status}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {detail.history.window_history.length ? (
        <section>
          <h3 className="od-lead__section">{c.windowHistory}</h3>
          <table className="od-table od-table--compact">
            <thead>
              <tr>
                <th scope="col">{deskCopy.windows.date}</th>
                <th scope="col">{deskCopy.windows.calls}</th>
                <th scope="col">{deskCopy.windows.sms}</th>
              </tr>
            </thead>
            <tbody>
              {[...detail.history.window_history].reverse().map((window) => (
                <tr key={window.business_date}>
                  <td>
                    {shortDateLabel(window.business_date)}
                    {window.schedule_day !== null ? <span className="od-cell__sub">{l.dayN(window.schedule_day)}</span> : null}
                  </td>
                  <td>{deskCopy.windows.cell(window.call.completed, window.call.required, window.call.missed)}</td>
                  <td>{deskCopy.windows.cell(window.sms.completed, window.sms.required, window.sms.missed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {detail.history.missed_labels_hidden ? <p className="od-lead__muted">{c.missedHidden}</p> : null}
        </section>
      ) : null}
    </div>
  );
}

function HistoryPanel({ subjectId, onRevoked }: { subjectId: string; onRevoked: () => void }) {
  const queryClient = useQueryClient();
  const query = useDetail(subjectId);
  const revoked = isSalesOutreachApiError(query.error) && query.error.revokesAccess;
  useEffect(() => {
    if (!revoked) return;
    clearSubject(queryClient, subjectId);
    onRevoked();
  }, [revoked, queryClient, subjectId, onRevoked]);
  return (
    <aside className="od-card od-lead" aria-label={c.detailTitle}>
      {query.data ? <History detail={query.data} /> : revoked ? <p className="od-lead__muted">{l.revoked}</p> : <SkeletonLine width="70%" height={20} />}
    </aside>
  );
}

export function ActivityView({ viewer, capabilities }: { viewer: DeskViewer; capabilities: SalesOutreachCapabilitiesDto }) {
  const url = useDeskUrl(viewer.role);
  const coordinator = viewer.role !== "rep";
  const agent = coordinator ? url.get("agent") : null;
  const unassigned = coordinator && url.get("unassigned") === "true";
  const q = url.get("q");
  const lead = url.get("lead");
  const team = useTeam(null, coordinator);
  const reps = useMemo(() => (team.data?.daily_call_goals ?? []).map((row) => ({ value: row.agent_id, label: row.agent_name ?? t.unknownRep })), [team.data]);
  const cadenceOn = capabilities.controls.cadence_shadow_enabled || capabilities.controls.cadence_enforcement_enabled;
  const queue = useQueue({ agent_id: agent, unassigned, search: q, state: "all_active", sort: "last_interaction", direction: "desc" }, cadenceOn);
  const asOf = queue.first?.as_of ?? capabilities.as_of;
  return (
    <div className="od-scroll">
      <div className="od-page">
        <DeskHeader title={c.title} subtitle={c.subtitle} />
        <div className="od-toolbar">
          {coordinator ? (
            <DeskSelect
              icon={Users}
              label={deskCopy.team.allReps}
              value={unassigned ? "unassigned" : (agent ?? "")}
              options={[{ value: "", label: deskCopy.team.allReps }, ...reps, { value: "unassigned", label: deskCopy.team.unassigned }]}
              onChange={(value) => url.update(value === "unassigned" ? { unassigned: "true", agent: null, lead: null } : { agent: value || null, unassigned: null, lead: null })}
            />
          ) : null}
          <div className="od-toolbar__spacer" />
          <SearchBox value={q} placeholder={deskCopy.my.search} onSearch={(value) => url.update({ q: value })} />
        </div>
        <div className="od-workspace">
          <div className="od-workspace__main">
            <section className="od-card" aria-labelledby="od-activity-title">
              <div className="od-card__head">
                <h2 id="od-activity-title" className="od-card__title">
                  {c.listTitle}
                </h2>
              </div>
              {!cadenceOn ? (
                <p className="od-empty">{deskCopy.my.queueUnavailable}</p>
              ) : (
                <div className="od-table-wrap">
                  <table className="od-table">
                    <thead>
                      <tr>
                        <th scope="col">{deskCopy.team.attention.columns.job}</th>
                        {coordinator ? <th scope="col">{deskCopy.team.attention.columns.owner}</th> : null}
                        <th scope="col">{deskCopy.team.attention.columns.priority}</th>
                        <th scope="col">{deskCopy.team.attention.columns.last}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {queue.query.isPending ? (
                        <tr>
                          <td colSpan={4}>
                            <SkeletonLine />
                          </td>
                        </tr>
                      ) : queue.rows.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="od-empty">
                            {c.empty}
                          </td>
                        </tr>
                      ) : (
                        queue.rows.map((row) => {
                          const pill = priorityPill(row);
                          return (
                            <tr
                              key={row.subject_id}
                              data-selectable="true"
                              tabIndex={0}
                              aria-selected={row.subject_id === lead}
                              onClick={() => url.update({ lead: row.subject_id })}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  url.update({ lead: row.subject_id });
                                }
                              }}
                            >
                              <td>
                                <span className="od-strong od-job">{row.job_no ?? l.jobPending}</span>
                                {row.phone ? <span className="od-cell__sub">{row.phone}</span> : null}
                              </td>
                              {coordinator ? <td>{ownerText(row)}</td> : null}
                              <td>
                                <Pill variant={pill.variant}>{pill.text}</Pill>
                              </td>
                              <td title={absoluteTime(row.last_interaction_at)}>{relativeDay(row.last_interaction_at, asOf)}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}
              {queue.query.hasNextPage ? (
                <div className="od-queue__more">
                  <button type="button" className="od-button od-button--quiet" onClick={() => void queue.query.fetchNextPage()} disabled={queue.query.isFetchingNextPage}>
                    {deskCopy.my.loadMore}
                  </button>
                </div>
              ) : null}
            </section>
          </div>
          <div className="od-workspace__side">
            {lead ? <HistoryPanel subjectId={lead} onRevoked={() => url.update({ lead: null }, { replace: true })} /> : (
              <aside className="od-card od-lead od-lead--empty">
                <p className="od-lead__muted">{deskCopy.my.selectHint}</p>
              </aside>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
