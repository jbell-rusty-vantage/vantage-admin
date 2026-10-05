"use client";
/**
 * All Numbers (Owner; all-numbers/CONTRACT.md §1, §6): every outside number that called us or that we called, plus
 * Form Lead numbers. Two jobs: catch missed customers ("Waiting on us") and say who each number is (its Lead, or
 * Unknown). Header cards, an All / Waiting on us switch and a search, then the server-ordered keyset list; a row opens
 * the number's side panel. The segment (`show`), the search (`q`) and the open number (`number`) live in the URL.
 * Nothing here computes waiting or the Lead link: those are the server's.
 */
import { useEffect, useRef, type KeyboardEvent } from "react";
import { ArrowUpDown, Hash, Pin, PhoneIncoming, PhoneMissed, PhoneOutgoing, RefreshCw } from "lucide-react";
import type { NumberRow, NumberView } from "@/lib/api/allNumbers";
import { useNumbers } from "../data/use-numbers";
import { useDeskUrl } from "../data/use-desk-url";
import type { DeskViewer } from "../shell/desk-shell";
import { absoluteTime, relativeDay } from "../lib/format";
import { callResultPill, leadName, waitingText } from "../lib/numbers-format";
import { deskCopy } from "../outreach-desk-copy";
import { DeskHeader, Notice, Pill, SearchBox, Segmented, SkeletonLine, SummaryCard } from "../primitives";
import { NumberPanel } from "./number-panel";

const c = deskCopy.numbers;

function NumberRowView({
  row,
  asOf,
  selected,
  onSelect,
  onMove,
}: {
  row: NumberRow;
  asOf: string;
  selected: boolean;
  onSelect: (id: string) => void;
  onMove: (from: HTMLTableRowElement, step: 1 | -1) => void;
}) {
  const last = row.last_call;
  const pill = last ? callResultPill(last.direction, last.result) : null;
  const waiting = waitingText(row.waiting_since, asOf);
  const DirectionIcon = last?.direction === "outbound" ? PhoneOutgoing : PhoneIncoming;
  const onKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(row.id);
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      onMove(event.currentTarget, event.key === "ArrowDown" ? 1 : -1);
    }
  };
  return (
    <tr data-selectable="true" data-number={row.id} aria-selected={selected} tabIndex={0} onClick={() => onSelect(row.id)} onKeyDown={onKeyDown}>
      <td data-label={c.columns.number}>
        <span className="od-strong od-job od-nowrap">{row.display}</span>
        <span className="od-cell__sub">{row.caller_name ?? (row.source === "form_lead" ? c.formLead : " ")}</span>
      </td>
      <td data-label={c.columns.lead}>
        {row.lead ? (
          <>
            <span className="od-strong od-cellname">
              {leadName(row.lead)}
              {row.lead_link === "owner" ? (
                <span className="od-pin" title={c.pinned}>
                  <Pin aria-hidden="true" />
                  <span className="od-sr-only">{c.pinned}</span>
                </span>
              ) : null}
            </span>
            <span className="od-cell__sub">{row.lead.job_no ? c.job(row.lead.job_no) : c.noJob}</span>
          </>
        ) : (
          <Pill variant="neutral">{c.unknown}</Pill>
        )}
      </td>
      <td data-label={c.columns.last}>
        {last && pill ? (
          <>
            <span className="od-lastcall">
              <DirectionIcon aria-label={c.directions[last.direction]} className={`od-dir od-dir--${last.direction}`} />
              <span title={absoluteTime(last.at)}>{relativeDay(last.at, asOf)}</span>
              <Pill variant={pill.variant}>{pill.text}</Pill>
            </span>
            {last.agent_name ? <span className="od-cell__sub">{last.agent_name}</span> : null}
          </>
        ) : (
          <span className="od-text-muted">{c.noCalls}</span>
        )}
      </td>
      <td data-label={c.columns.calls}>
        <span className="od-nowrap">{c.callsInOut(row.calls.inbound, row.calls.outbound)}</span>
        {row.calls.missed ? <span className="od-cell__sub od-text-red">{c.missed(row.calls.missed)}</span> : null}
      </td>
      <td data-label={c.columns.waiting}>
        {waiting ? (
          <span className={`od-wait od-wait--${waiting.tone}`} title={absoluteTime(row.waiting_since)}>
            <PhoneMissed aria-hidden="true" />
            {waiting.text}
          </span>
        ) : (
          <span className="od-text-muted" aria-label={deskCopy.numberPanel.handled}>
            —
          </span>
        )}
      </td>
    </tr>
  );
}

export function NumbersView({ viewer }: { viewer: DeskViewer }) {
  const url = useDeskUrl(viewer.role);
  const show: NumberView = url.get("show") === "waiting" ? "waiting" : "all";
  const q = url.get("q");
  const selected = url.get("number");
  const list = useNumbers(show, q);
  const first = list.first;
  const asOf = first?.as_of ?? null;
  const counts = first?.data.counts ?? null;
  const tbody = useRef<HTMLTableSectionElement>(null);
  const loading = list.query.isPending;
  const failed = list.query.isError && !first;

  const moveFocus = (from: HTMLTableRowElement, step: 1 | -1) => {
    const rows = [...(tbody.current?.querySelectorAll<HTMLTableRowElement>("tr[data-number]") ?? [])];
    rows[rows.indexOf(from) + step]?.focus();
  };

  const { update } = url;
  useEffect(() => {
    if (!selected) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") update({ number: null });
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selected, update]);

  const total = show === "waiting" ? counts?.waiting : counts?.all;
  const emptyText = q ? c.emptySearch : show === "waiting" ? c.emptyWaiting : c.empty;

  return (
    <>
      <div className="od-scroll" data-testid="numbers-scroll">
        <div className="od-page">
          <DeskHeader title={deskCopy.titles.numbers} subtitle={c.subtitle} />
          <div className="od-summary-row od-summary-row--2">
            <SummaryCard
              testId="card-waiting"
              icon={PhoneMissed}
              tone={counts?.waiting ? "red" : "green"}
              title={c.cards.waiting}
              value={counts ? String(counts.waiting) : <SkeletonLine width={40} height={22} />}
              caption={
                counts ? (
                  counts.waiting && show !== "waiting" ? (
                    <button type="button" className="od-linkbutton" onClick={() => url.update({ show: "waiting" })}>
                      {c.cards.waitingCaption}
                    </button>
                  ) : (
                    <span>{counts.waiting ? c.cards.waitingCaption : c.cards.noneWaiting}</span>
                  )
                ) : null
              }
            />
            <SummaryCard
              testId="card-all-numbers"
              icon={Hash}
              tone="blue"
              title={c.cards.all}
              value={counts ? String(counts.all) : <SkeletonLine width={40} height={22} />}
              caption={counts ? c.cards.allCaption : null}
            />
          </div>
          <div className="od-toolbar" role="toolbar" aria-label={c.toolbar}>
            <Segmented<NumberView>
              label={c.segmentLabel}
              value={show}
              options={[
                { value: "all", label: c.segments.all },
                { value: "waiting", label: counts ? `${c.segments.waiting} · ${counts.waiting}` : c.segments.waiting },
              ]}
              onChange={(value) => url.update({ show: value === "waiting" ? "waiting" : null, number: null })}
            />
            <div className="od-toolbar__spacer" />
            <SearchBox value={q} placeholder={c.search} onSearch={(value) => url.update({ q: value, number: null })} />
          </div>

          {failed ? (
            <Notice icon={RefreshCw} title={c.error}>
              <button type="button" className="od-button" onClick={() => void list.query.refetch()}>
                {c.retry}
              </button>
            </Notice>
          ) : (
            <section className="od-card" aria-labelledby="od-numbers-title" data-testid="numbers-list">
              <div className="od-card__head">
                <div>
                  <h2 id="od-numbers-title" className="od-card__title">
                    {c.listTitle[show]}
                  </h2>
                  <p className="od-card__subtitle">{c.listSubtitle[show]}</p>
                </div>
                {total !== undefined && !q && list.rows.length ? <p className="od-card__subtitle">{c.showing(list.rows.length, total)}</p> : null}
              </div>
              <div className="od-table-wrap">
                <table className="od-table od-table--numbers od-table--cards" aria-busy={list.query.isFetching}>
                  <thead>
                    <tr>
                      <th scope="col">{c.columns.number}</th>
                      <th scope="col">{c.columns.lead}</th>
                      <th scope="col">{c.columns.last}</th>
                      <th scope="col">{c.columns.calls}</th>
                      <th scope="col">{c.columns.waiting}</th>
                    </tr>
                  </thead>
                  <tbody ref={tbody}>
                    {loading ? (
                      [0, 1, 2, 3, 4].map((index) => (
                        <tr key={index}>
                          <td colSpan={5}>
                            <SkeletonLine />
                          </td>
                        </tr>
                      ))
                    ) : list.rows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="od-empty">
                          {emptyText}
                        </td>
                      </tr>
                    ) : (
                      list.rows.map((row) => (
                        <NumberRowView
                          key={row.id}
                          row={row}
                          asOf={asOf ?? row.last_activity_at}
                          selected={row.id === selected}
                          onSelect={(id) => url.update({ number: id })}
                          onMove={moveFocus}
                        />
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {list.query.hasNextPage ? (
                <div className="od-queue__more">
                  <button type="button" className="od-button od-button--quiet" disabled={list.query.isFetchingNextPage} onClick={() => void list.query.fetchNextPage()}>
                    <ArrowUpDown aria-hidden="true" />
                    {c.loadMore}
                  </button>
                </div>
              ) : null}
            </section>
          )}
        </div>
      </div>
      {selected ? (
        <div className="od-drawer od-drawer--wide" role="dialog" aria-modal="false" aria-label={deskCopy.numberPanel.region}>
          <NumberPanel numberId={selected} onClose={() => url.update({ number: null })} />
        </div>
      ) : null}
    </>
  );
}
