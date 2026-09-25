"use client";
/**
 * UI1-OVERVIEW (UI-1 §4.2 block 3, addendum §6.1–6.2, E16–E19): Reps. A sortable table, one row per `reps[]`, then
 * the `Unmapped rep` row (calls only; lists `unmapped.extensions[]`, links to RingCentral Accounts) and the
 * `Unassigned` row (records now and spend). A row expands to `by_source[]`. Rates print as whole percentages with
 * the counts beside them in the expansion and in the cell's title; `cost_per_booking` null prints `—`. At narrow
 * widths (390 px) the table gives way to one stacked card per row with the same numbers (CSS container query).
 */
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight, TriangleAlert } from "lucide-react";
import { Fragment, useId, useMemo, useState, type ReactNode } from "react";
import type { Overview, OverviewRep } from "@/lib/api/salesIntelligence";
import { copy } from "../sales-intelligence-copy";
import { cx } from "../lib/format";
import { SkeletonBlock, SkeletonLines } from "../primitives";
import { BAND_NUMBERS, DASH, bandValue, count, minutes, money, percent } from "./format";
import type { OverviewLinks } from "./links";
import { sourceLine } from "./spend-block";

const t = copy.ui1.overview.reps;

export const REP_COLUMNS = ["rep", "open", "overdue", "attempts", "conversations", "talk", "attemptRate", "bookingRate", "spend", "costPerBooking"] as const;
export type RepColumn = (typeof REP_COLUMNS)[number];
export type RepSort = { column: RepColumn; direction: "asc" | "desc" } | null;

/** The value a column sorts by (null sorts last either way). */
export function repSortValue(rep: OverviewRep, column: RepColumn): number | string | null {
  switch (column) {
    case "rep": return rep.agent.name ?? "";
    case "open": return rep.open_assignments.open;
    case "overdue": return rep.open_assignments.overdue;
    case "attempts": return rep.interactions.outbound_attempts;
    case "conversations": return rep.interactions.human_conversations;
    case "talk": return rep.interactions.talk_minutes;
    case "attemptRate": return rep.interactions.attempt_conversation_rate;
    case "bookingRate": return rep.outcomes.booking_rate;
    case "spend": return rep.spend.spend;
    case "costPerBooking": return rep.cost_per_booking;
  }
}

export function sortReps(reps: readonly OverviewRep[], sort: RepSort): OverviewRep[] {
  if (!sort) return [...reps];
  const sign = sort.direction === "asc" ? 1 : -1;
  return [...reps].sort((a, b) => {
    const x = repSortValue(a, sort.column);
    const y = repSortValue(b, sort.column);
    if (x == null || y == null) return x == null && y == null ? 0 : x == null ? 1 : -1;
    const order = typeof x === "string" || typeof y === "string" ? String(x).localeCompare(String(y)) : x - y;
    return order * sign;
  });
}

/** Clicking a header: a new column starts descending (ascending for the name), the same column flips. */
export function nextSort(current: RepSort, column: RepColumn): RepSort {
  if (current?.column === column) return { column, direction: current.direction === "asc" ? "desc" : "asc" };
  return { column, direction: column === "rep" ? "asc" : "desc" };
}

/**
 * The counts behind a rate, `{a} of {b}`. Booking rate: the cohort's `bookings` of `leads`. Attempt → conversation:
 * the server sends the rate and the attempts, not the conversations reached by an attempt, so the numerator is the
 * rate times the attempts, rounded (gap noted in UI1-OVERVIEW.md).
 */
export const attemptRateTip = (i: OverviewRep["interactions"]): string | null =>
  i.attempt_conversation_rate == null ? null : t.rateTip(count(Math.round(i.attempt_conversation_rate * i.outbound_attempts)), count(i.outbound_attempts));
export const bookingRateTip = (o: OverviewRep["outcomes"]): string | null => (o.booking_rate == null ? null : t.rateTip(count(o.bookings), count(o.leads)));
export const openBandsLine = (bands: Record<string, number>): string => BAND_NUMBERS.map((band) => t.openBand(band, count(bandValue(bands, band)))).join(" · ");

function Unpriced({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span className="si-ovunpriced" data-unpriced={n}>
      <TriangleAlert size={14} aria-hidden />
      {t.unpriced(count(n))}
    </span>
  );
}

function Rate({ value, tip }: { value: number | null; tip: string | null }) {
  return <span title={tip ?? undefined} aria-label={tip ? `${percent(value)}, ${tip}` : undefined} data-rate={value == null ? "null" : "value"}>{percent(value)}</span>;
}

type Cells = Record<RepColumn, ReactNode>;
type Row = { key: string; kind: "rep" | "unmapped" | "unassigned"; name: string; href: string | null; note?: ReactNode; cells: Omit<Cells, "rep">; detail: ReactNode };

function sourceList(sources: Overview["spend"]["by_source"]) {
  if (!sources.length) return null;
  return (
    <div className="si-ovreps__sources">
      <span className="si-ovreps__detailtitle">{t.bySource}</span>
      <ul>
        {sources.map((s) => <li key={s.source} data-source={s.source}>{sourceLine(s)}</li>)}
      </ul>
    </div>
  );
}

function repRow(rep: OverviewRep, links: OverviewLinks | null): Row {
  const i = rep.interactions;
  const attemptTip = attemptRateTip(i);
  const bookingTip = bookingRateTip(rep.outcomes);
  const bands = openBandsLine(rep.open_assignments.bands);
  return {
    key: rep.agent.id,
    kind: "rep",
    name: rep.agent.name ?? rep.agent.id,
    href: links ? links.rep(rep.agent.id) : null,
    note: i.recovered_calls > 0 ? <span className="si-ovreps__note" data-recovered={i.recovered_calls}>{t.recovered(count(i.recovered_calls))}</span> : null,
    cells: {
      // FIX-UI1 (m5): Open → All Outreach for the rep; Overdue → the same in Band 1.
      open: links
        ? <Link href={links.rep(rep.agent.id)} className="si-ovlink" title={bands} data-rep-cell="open">{count(rep.open_assignments.open)}</Link>
        : <span title={bands}>{count(rep.open_assignments.open)}</span>,
      overdue: links && rep.open_assignments.overdue > 0
        ? <Link href={links.repOverdue(rep.agent.id)} className="si-ovlink si-text--amber" data-overdue={rep.open_assignments.overdue} data-rep-cell="overdue">{count(rep.open_assignments.overdue)}</Link>
        : <span className={cx(rep.open_assignments.overdue > 0 && "si-text--amber")} data-overdue={rep.open_assignments.overdue}>{count(rep.open_assignments.overdue)}</span>,
      attempts: count(i.outbound_attempts),
      conversations: count(i.human_conversations),
      talk: t.talkMinutes(minutes(i.talk_minutes)),
      attemptRate: <Rate value={i.attempt_conversation_rate} tip={attemptTip} />,
      bookingRate: <Rate value={rep.outcomes.booking_rate} tip={bookingTip} />,
      spend: <>{money(rep.spend.spend)}<Unpriced n={rep.spend.unpriced_leads} /></>,
      costPerBooking: <span data-cpb={rep.cost_per_booking == null ? "null" : "value"}>{money(rep.cost_per_booking)}</span>,
    },
    detail: (
      <>
        <p className="si-ovreps__detailline"><span className="si-ovreps__detailtitle">{t.openBands}</span> {bands}</p>
        <p className="si-ovreps__detailline">
          {t.columns.attemptRate}: {attemptTip ?? DASH} · {t.columns.bookingRate}: {bookingTip ?? DASH}
        </p>
        {sourceList(rep.by_source)}
      </>
    ),
  };
}

function unmappedRow(unmapped: NonNullable<Overview["unmapped"]>, links: OverviewLinks | null): Row {
  const i = unmapped.interactions;
  return {
    key: "unmapped",
    kind: "unmapped",
    name: t.unmapped,
    href: links ? links.accounts() : null,
    note: i.recovered_calls > 0 ? <span className="si-ovreps__note" data-recovered={i.recovered_calls}>{t.recovered(count(i.recovered_calls))}</span> : null,
    cells: {
      open: DASH, overdue: DASH,
      attempts: count(i.outbound_attempts),
      conversations: count(i.human_conversations),
      talk: t.talkMinutes(minutes(i.talk_minutes)),
      attemptRate: <Rate value={i.attempt_conversation_rate} tip={i.attempt_conversation_rate == null ? null : t.rateTip(count(Math.round(i.attempt_conversation_rate * i.outbound_attempts)), count(i.outbound_attempts))} />,
      bookingRate: DASH, spend: DASH, costPerBooking: DASH,
    },
    detail: (
      <>
        <p className="si-ovreps__detailline">{t.unmappedNote}</p>
        <p className="si-ovreps__detailline" data-extensions={unmapped.extensions.length}>
          <span className="si-ovreps__detailtitle">{t.extensions}</span> {unmapped.extensions.length ? unmapped.extensions.join(" · ") : DASH}
        </p>
      </>
    ),
  };
}

function unassignedRow(unassigned: NonNullable<Overview["unassigned"]>, links: OverviewLinks | null): Row {
  return {
    key: "unassigned",
    kind: "unassigned",
    name: t.unassigned,
    href: links ? links.unassigned() : null,
    cells: {
      open: count(unassigned.records_now), overdue: DASH, attempts: DASH, conversations: DASH, talk: DASH, attemptRate: DASH, bookingRate: DASH,
      spend: <>{money(unassigned.spend.spend)}<Unpriced n={unassigned.spend.unpriced_leads} /></>,
      costPerBooking: DASH,
    },
    detail: sourceList(unassigned.by_source) ?? <p className="si-ovreps__detailline">{DASH}</p>,
  };
}

function RowName({ row, open, onToggle, detailId }: { row: Row; open: boolean; onToggle: () => void; detailId: string }) {
  return (
    <div className="si-ovreps__name">
      <button type="button" className="si-ovreps__expand" aria-expanded={open} aria-controls={detailId} aria-label={t.expand(row.name)} onClick={onToggle}>
        <ChevronRight size={16} aria-hidden className={cx("si-ovreps__chevron", open && "is-open")} />
      </button>
      <span className="si-ovreps__namecol">
        {row.href ? <Link href={row.href} className="si-ovlink" data-rep-link={row.key}>{row.name}</Link> : <span>{row.name}</span>}
        {row.note}
      </span>
    </div>
  );
}

const SORT_ICON = { asc: ArrowUp, desc: ArrowDown } as const;

export function RepsBlock({ data, links }: { data: Overview | null; links: OverviewLinks | null }) {
  const headingId = useId();
  const baseId = useId();
  const [sort, setSort] = useState<RepSort>(null);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const reps = useMemo(() => sortReps(data?.reps ?? [], sort), [data?.reps, sort]);
  const rows: Row[] = [
    ...reps.map((rep) => repRow(rep, links)),
    ...(data?.unmapped ? [unmappedRow(data.unmapped, links)] : []),
    ...(data?.unassigned ? [unassignedRow(data.unassigned, links)] : []),
  ];
  const toggle = (key: string) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const empty = !reps.length;

  return (
    <section className="si-ovblock si-ovreps" aria-labelledby={headingId}>
      <h2 id={headingId} className="si-heading si-heading--2">{t.title}</h2>
      {empty && <p className="si-ovempty" data-empty="reps">{t.empty}</p>}
      {rows.length > 0 && (
        <>
          <div className="si-ovreps__tablewrap">
            <table className="si-ovreps__table">
              <thead>
                <tr>
                  {REP_COLUMNS.map((column) => {
                    const active = sort?.column === column;
                    const Icon = active ? SORT_ICON[sort!.direction] : ArrowUpDown;
                    return (
                      <th key={column} scope="col" aria-sort={active ? (sort!.direction === "asc" ? "ascending" : "descending") : "none"} data-col={column}>
                        <button type="button" className="si-ovreps__sort" aria-label={t.sortBy(t.columns[column])} onClick={() => setSort((s) => nextSort(s, column))}>
                          {t.columns[column]}
                          <Icon size={14} aria-hidden />
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const open = expanded.has(row.key);
                  const detailId = `${baseId}-${row.key}`;
                  return (
                    <Fragment key={row.key}>
                      <tr data-row={row.kind} data-agent={row.kind === "rep" ? row.key : undefined}>
                        <th scope="row"><RowName row={row} open={open} onToggle={() => toggle(row.key)} detailId={detailId} /></th>
                        {REP_COLUMNS.slice(1).map((column) => (
                          <td key={column} data-col={column}>{row.cells[column as Exclude<RepColumn, "rep">]}</td>
                        ))}
                      </tr>
                      <tr id={detailId} className="si-ovreps__detail" hidden={!open}>
                        <td colSpan={REP_COLUMNS.length}>{row.detail}</td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <ul className="si-ovreps__cards">
            {rows.map((row) => {
              const open = expanded.has(row.key);
              const detailId = `${baseId}-card-${row.key}`;
              return (
                <li key={row.key} className="si-ovreps__card" data-card={row.kind}>
                  <RowName row={row} open={open} onToggle={() => toggle(row.key)} detailId={detailId} />
                  <dl className="si-ovreps__facts">
                    {REP_COLUMNS.slice(1).map((column) => (
                      <div key={column} className="si-ovreps__fact" data-col={column}>
                        <dt>{t.columns[column]}</dt>
                        <dd>{row.cells[column as Exclude<RepColumn, "rep">]}</dd>
                      </div>
                    ))}
                  </dl>
                  <div id={detailId} className="si-ovreps__carddetail" hidden={!open}>{row.detail}</div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

export function RepsBlockSkeleton() {
  return (
    <section className="si-ovblock si-ovreps is-skeleton" aria-hidden>
      <SkeletonLines lines={1} widths={[70]} />
      <SkeletonBlock height={36} />
      {[0, 1, 2, 3].map((i) => <SkeletonBlock key={i} height={44} />)}
    </section>
  );
}
RepsBlock.Skeleton = RepsBlockSkeleton;
