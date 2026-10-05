"use client";
/**
 * The selected-number panel of All Numbers (CONTRACT §4.2–4.4, styled like the desk's lead panel): the number and its
 * caller name, whether someone is waiting on us, a few facts, the Lead (a link into the desk when it is a desk lead),
 * other Leads with the same phone, Link to a lead (search picker) and Unlink, the Owner's earlier Unlinks, and the call
 * list. Link and Unlink send the number's `revision`; a 409 reloads the number and says so.
 */
import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { ArrowRight, CircleCheck, Link2, Pin, PhoneIncoming, PhoneMissed, PhoneOutgoing, Search, X } from "lucide-react";
import type { LeadRef, NumberDetail } from "@/lib/api/allNumbers";
import { isSalesOutreachApiError } from "@/lib/api/salesOutreach";
import { isRevisionConflict, useLeadSearch, useLinkLeadCommand, useNumberDetail } from "../data/use-numbers";
import { deskViewHref } from "../data/desk-url";
import { absoluteTime, relativeDay } from "../lib/format";
import { callDuration, callResultPill, leadName, leadStatePill, waitingText } from "../lib/numbers-format";
import { deskCopy } from "../outreach-desk-copy";
import { Pill, SkeletonLine } from "../primitives";

const c = deskCopy.numberPanel;
const n = deskCopy.numbers;

type Notice = { tone: "green" | "red"; text: string } | null;

function LeadSummary({ lead, asOf }: { lead: LeadRef; asOf: string }) {
  const state = leadStatePill(lead.state);
  return (
    <>
      <p className="od-leadcard__name">
        {leadName(lead)}
        {state ? <Pill variant={state.variant}>{state.text}</Pill> : null}
      </p>
      <p className="od-leadcard__meta">
        {[lead.job_no ? n.job(lead.job_no) : n.noJob, lead.rep_name ? c.rep(lead.rep_name) : c.noRep].join(" · ")}
      </p>
      <p className="od-leadcard__meta" title={absoluteTime(lead.received_at)}>
        {c.received(relativeDay(lead.received_at, asOf))}
      </p>
    </>
  );
}

function LeadPicker({
  currentId,
  pending,
  onPick,
  onCancel,
}: {
  currentId: string | null;
  pending: boolean;
  onPick: (lead: LeadRef) => void;
  onCancel: () => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState("");
  const [term, setTerm] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setTerm(draft.trim()), 250);
    return () => clearTimeout(timer);
  }, [draft]);
  const search = useLeadSearch(term);
  const items = term.length >= 2 ? (search.data?.data.items ?? []) : [];
  const asOf = search.data?.as_of ?? new Date(0).toISOString();
  return (
    <div className="od-picker" data-testid="lead-picker">
      <label htmlFor={id} className="od-lead__label">
        {c.picker.label}
      </label>
      <div className="od-search od-search--block">
        <Search aria-hidden="true" width={16} height={16} />
        <input id={id} type="search" value={draft} autoFocus maxLength={100} placeholder={c.picker.label} onChange={(event) => setDraft(event.target.value)} />
      </div>
      {term.length < 2 ? (
        <p className="od-lead__muted">{c.picker.hint}</p>
      ) : search.isPending ? (
        <p className="od-lead__muted">{c.picker.searching}</p>
      ) : search.isError ? (
        <p className="od-lead__error">{deskCopy.errors.failed(null)}</p>
      ) : items.length === 0 ? (
        <p className="od-lead__muted">{c.picker.empty}</p>
      ) : (
        <ul className="od-minilist" aria-label={c.picker.label}>
          {items.map((lead) => (
            <li key={`${lead.model}:${lead.id}`} className="od-minilist__item">
              <div className="od-minilist__text">
                <span className="od-strong">{leadName(lead)}</span>
                <span className="od-cell__sub">
                  {[lead.job_no ? n.job(lead.job_no) : n.noJob, lead.phone, relativeDay(lead.received_at, asOf)].filter(Boolean).join(" · ")}
                </span>
              </div>
              {lead.id === currentId ? (
                <span className="od-text-muted od-small">{c.picker.current}</span>
              ) : (
                <button type="button" className="od-button" disabled={pending} onClick={() => onPick(lead)} aria-label={`${c.picker.choose}: ${leadName(lead)}`}>
                  {c.picker.choose}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="od-linkbutton od-picker__cancel" onClick={onCancel}>
        {c.picker.cancel}
      </button>
    </div>
  );
}

function PanelBody({ detail, asOf, numberId }: { detail: NumberDetail; asOf: string; numberId: string }) {
  const command = useLinkLeadCommand(numberId);
  const [picking, setPicking] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const number = detail.number;
  const lead = number.lead;
  const waiting = waitingText(number.waiting_since, asOf);
  const hasCalls = detail.calls.length > 0;

  const send = (body: { lead: LeadRef | null; unlink?: LeadRef }, done: string) => {
    setNotice(null);
    command.mutate(
      {
        revision: number.revision,
        lead: body.lead ? { model: body.lead.model, id: body.lead.id } : null,
        ...(body.unlink ? { unlink: { model: body.unlink.model, id: body.unlink.id } } : {}),
      },
      {
        onSuccess: () => {
          setPicking(false);
          setNotice({ tone: "green", text: done });
        },
        onError: (error) =>
          setNotice({
            tone: "red",
            text: isRevisionConflict(error) ? c.conflict : deskCopy.errors.failed(isSalesOutreachApiError(error) ? error.message : null),
          }),
      },
    );
  };
  const pin = (target: LeadRef) => send({ lead: target }, c.linked(leadName(target)));
  const unlink = (target: LeadRef) => send({ lead: null, unlink: target }, c.unlinked(leadName(target)));

  return (
    <div className="od-lead__body">
      <div className="od-panelhead">
        <h2 className="od-lead__job">{number.display}</h2>
        {number.caller_name ? <p className="od-lead__name">{number.caller_name}</p> : null}
        {number.source === "form_lead" ? <p className="od-lead__meta">{n.formLead}</p> : null}
      </div>

      {waiting ? (
        <div className="od-lead__next od-lead__next--red" data-testid="number-waiting">
          <PhoneMissed aria-hidden="true" />
          <div>
            <p className="od-lead__next-title">{c.waitingFor(waiting.text)}</p>
            <p className="od-lead__muted">{c.waitingSub(relativeDay(number.waiting_since, asOf))}</p>
          </div>
        </div>
      ) : hasCalls ? (
        <div className="od-lead__next od-lead__next--green">
          <CircleCheck aria-hidden="true" />
          <p className="od-lead__next-title">{c.handled}</p>
        </div>
      ) : null}

      <dl className="od-facts">
        <div>
          <dt>{c.facts.firstSeen}</dt>
          <dd title={absoluteTime(number.first_seen_at)}>{relativeDay(number.first_seen_at, asOf)}</dd>
        </div>
        <div>
          <dt>{c.facts.lastActivity}</dt>
          <dd title={absoluteTime(number.last_activity_at)}>{relativeDay(number.last_activity_at, asOf)}</dd>
        </div>
        <div>
          <dt>{c.facts.calls}</dt>
          <dd>{n.callsInOut(number.calls.inbound, number.calls.outbound)}</dd>
        </div>
        <div>
          <dt>{c.facts.missed}</dt>
          <dd className={number.calls.missed ? "od-text-red" : undefined}>{number.calls.missed}</dd>
        </div>
      </dl>

      <section aria-labelledby={`${numberId}-lead`} data-testid="number-lead">
        <h3 id={`${numberId}-lead`} className="od-lead__section">
          {c.leadTitle}
        </h3>
        {lead ? (
          <div className="od-leadcard">
            <LeadSummary lead={lead} asOf={asOf} />
            <p className="od-tag">
              {number.lead_link === "owner" ? <Pin aria-hidden="true" /> : <Link2 aria-hidden="true" />}
              {number.lead_link === "owner" ? c.linkedByYou : c.matchedByPhone}
            </p>
            <div className="od-leadcard__actions">
              {lead.desk_subject_id ? (
                <Link className="od-button od-button--primary" href={deskViewHref("team", { lead: lead.desk_subject_id })}>
                  {c.openInDesk}
                  <ArrowRight aria-hidden="true" />
                </Link>
              ) : null}
              <button type="button" className="od-button od-button--quiet" disabled={command.isPending} onClick={() => unlink(lead)} title={c.unlinkHint}>
                {c.unlink}
              </button>
            </div>
            <p className="od-lead__foot">{c.creditNote}</p>
          </div>
        ) : (
          <div className="od-leadcard od-leadcard--unknown">
            <Pill variant="neutral">{c.unknownTitle}</Pill>
            <p className="od-lead__muted">{c.unknownBody}</p>
          </div>
        )}
        {picking ? (
          <LeadPicker currentId={lead?.id ?? null} pending={command.isPending} onPick={pin} onCancel={() => setPicking(false)} />
        ) : (
          <button type="button" className="od-button od-button--block od-mt" onClick={() => setPicking(true)}>
            <Link2 aria-hidden="true" />
            {lead ? c.linkOther : c.link}
          </button>
        )}
        {notice ? (
          <p className={notice.tone === "red" ? "od-lead__error" : "od-lead__ok"} role={notice.tone === "red" ? "alert" : "status"}>
            {notice.text}
          </p>
        ) : null}
      </section>

      {detail.other_leads.length ? (
        <section aria-labelledby={`${numberId}-others`}>
          <h3 id={`${numberId}-others`} className="od-lead__section">
            {c.otherLeads}
          </h3>
          <ul className="od-minilist">
            {detail.other_leads.map((other) => (
              <li key={`${other.model}:${other.id}`} className="od-minilist__item">
                <div className="od-minilist__text">
                  <span className="od-strong">{leadName(other)}</span>
                  <span className="od-cell__sub">{[other.job_no ? n.job(other.job_no) : n.noJob, relativeDay(other.received_at, asOf), n.leadStates[other.state]].join(" · ")}</span>
                </div>
                <button type="button" className="od-button od-button--quiet" disabled={command.isPending} onClick={() => pin(other)}>
                  {c.useThis}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {detail.excluded_leads.length ? (
        <section aria-labelledby={`${numberId}-excluded`}>
          <h3 id={`${numberId}-excluded`} className="od-lead__section">
            {c.excludedTitle}
          </h3>
          <ul className="od-minilist">
            {detail.excluded_leads.map((other) => (
              <li key={`${other.model}:${other.id}`} className="od-minilist__item">
                <div className="od-minilist__text">
                  <span className="od-strong od-text-muted">{leadName(other)}</span>
                  <span className="od-cell__sub">{other.job_no ? n.job(other.job_no) : n.noJob}</span>
                </div>
                <button type="button" className="od-button od-button--quiet" disabled={command.isPending} onClick={() => pin(other)}>
                  {c.linkAgain}
                </button>
              </li>
            ))}
          </ul>
          <p className="od-lead__foot">{c.unlinkHint}</p>
        </section>
      ) : null}

      <section aria-labelledby={`${numberId}-calls`}>
        <h3 id={`${numberId}-calls`} className="od-lead__section">
          {c.callsTitle}
        </h3>
        {detail.calls.length === 0 ? (
          <p className="od-lead__muted">{c.noCalls}</p>
        ) : (
          <ol className="od-calls" data-testid="number-calls">
            {detail.calls.map((call) => {
              const pill = callResultPill(call.direction, call.result);
              const Icon = call.direction === "outbound" ? PhoneOutgoing : PhoneIncoming;
              const duration = callDuration(call.duration_seconds);
              const extra = [
                duration,
                call.agent_name,
                call.our_number ? (call.direction === "inbound" ? c.on(call.our_number) : c.from(call.our_number)) : null,
                call.recordings ? c.recordings(call.recordings) : null,
              ].filter(Boolean);
              return (
                <li key={call.id} className="od-calls__item">
                  <Icon aria-label={n.directions[call.direction]} className={`od-dir od-dir--${call.direction}`} />
                  <div className="od-calls__text">
                    <span className="od-calls__line">
                      <span title={absoluteTime(call.at)}>{relativeDay(call.at, asOf)}</span>
                      <Pill variant={pill.variant}>{pill.text}</Pill>
                    </span>
                    {extra.length ? <span className="od-cell__sub">{extra.join(" · ")}</span> : null}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        {detail.more_calls ? <p className="od-lead__foot">{c.moreCalls}</p> : null}
      </section>
    </div>
  );
}

export function NumberPanel({ numberId, onClose }: { numberId: string; onClose: () => void }) {
  const query = useNumberDetail(numberId);
  const error = query.error;
  const gone = isSalesOutreachApiError(error) && error.status === 404;
  const data = query.data;
  return (
    <aside className="od-card od-lead od-numpanel" aria-label={c.region} aria-busy={query.isFetching} data-testid="number-panel">
      <button type="button" className="od-lead__close od-button od-button--quiet" onClick={onClose} aria-label={c.close}>
        <X aria-hidden="true" />
      </button>
      {gone ? (
        <p className="od-lead__muted" role="status">
          {c.notFound}
        </p>
      ) : !data ? (
        error ? (
          <div className="od-lead__body">
            <p className="od-lead__error" role="alert">
              {c.error}
            </p>
            <button type="button" className="od-button" onClick={() => void query.refetch()}>
              {n.retry}
            </button>
          </div>
        ) : (
          <div className="od-lead__loading" aria-label={c.loading}>
            <SkeletonLine width="60%" height={22} />
            <SkeletonLine width="40%" />
            <SkeletonLine height={38} />
            <SkeletonLine height={90} />
          </div>
        )
      ) : (
        <PanelBody key={numberId} detail={data.data} asOf={data.as_of} numberId={numberId} />
      )}
    </aside>
  );
}
