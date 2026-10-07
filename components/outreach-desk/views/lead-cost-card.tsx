"use client";
/**
 * "Lead cost by rep" (Owner only): what each rep's allocated leads cost, priced at each feed's live lead cost
 * (Setup › Lead sources). Allocation = the lead's receiver agent. Duplicates are free. Managers and Reps never get
 * this card; the caller renders it for the Owner only, and a 403 renders nothing.
 */
import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, CircleAlert, Wallet } from "lucide-react";
import { fetchInsightsAllocation, type InsightsAllocationRep, type InsightsPeriodPreset } from "@/lib/api/insights";
import {
  ALLOCATION_PERIODS,
  DEFAULT_ALLOCATION_PERIOD,
  allocationChange,
  allocationHeader,
  allocationMoney,
  allocationShare,
  assignCompanyColors,
  bookedText,
  isUnassignedRep,
  maxRepSpend,
  repBarSegments,
  repFeedLines,
  sortAllocationReps,
} from "@/lib/insights/allocation";
import { queryKeys } from "@/lib/query/keys";
import { ReadFailure, Segmented, SkeletonLine } from "../primitives";

const COLUMNS = 9;
const REFRESH_MS = 60_000;

function isForbidden(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { status?: unknown }).status === 403;
}

function RepRow({
  rep,
  maxSpend,
  colors,
  hasComparison,
  open,
  onToggle,
}: {
  rep: InsightsAllocationRep;
  maxSpend: number;
  colors: Record<string, string>;
  hasComparison: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const unassigned = isUnassignedRep(rep);
  const muted = unassigned || rep.active === false;
  const segments = repBarSegments(rep, colors, maxSpend);
  const change = allocationChange(rep, hasComparison);
  const booked = bookedText(rep);
  const feeds = repFeedLines(rep);
  const rowKey = rep.agent_id ?? "unassigned";
  const panelId = `od-lc-feeds-${rowKey}`;
  const Chevron = open ? ChevronDown : ChevronRight;
  return (
    <Fragment>
      <tr className={muted ? "od-lc-row od-lc-row--muted" : "od-lc-row"} data-testid={`lead-cost-row-${rowKey}`}>
        <th scope="row">
          <button type="button" className="od-lc-toggle" aria-expanded={open} aria-controls={panelId} onClick={onToggle}>
            <Chevron aria-hidden="true" width={15} height={15} />
            <span className="od-strong">{rep.agent_name}</span>
            {unassigned ? <span className="od-cell__aside">no rep yet</span> : rep.active === false ? <span className="od-cell__aside">inactive</span> : null}
          </button>
        </th>
        <td>{rep.leads}</td>
        <td className="od-strong">{allocationMoney(rep.spend)}</td>
        <td>{allocationShare(rep.share_of_spend)}</td>
        <td className="od-lc-barcell">
          <div className="od-lc-bar" role="img" aria-label={segments.length ? segments.map((s) => s.title).join("; ") : "No lead cost in this period"}>
            {segments.map((segment) => (
              <span key={segment.key} className="od-lc-bar__seg" style={{ width: `${segment.widthPercent}%`, background: segment.color }} title={segment.title} />
            ))}
          </div>
        </td>
        <td>{rep.average_cpl === null ? "—" : allocationMoney(Math.round(rep.average_cpl))}</td>
        <td>{booked.booked}</td>
        <td>{booked.perBooked}</td>
        <td>
          <span className="od-nowrap" title={change.title}>
            {change.text}
          </span>
        </td>
      </tr>
      {open ? (
        <tr className="od-lc-detail" id={panelId} data-testid={`lead-cost-feeds-${rowKey}`}>
          <td colSpan={COLUMNS}>
            {feeds.length === 0 ? (
              <p className="od-empty">No leads allocated in this period.</p>
            ) : (
              <table className="od-lc-feeds">
                <thead>
                  <tr>
                    <th scope="col">Source › feed</th>
                    <th scope="col">Lead cost</th>
                    <th scope="col">Leads</th>
                    <th scope="col">Spend</th>
                  </tr>
                </thead>
                <tbody>
                  {feeds.map((feed) => (
                    <tr key={feed.key}>
                      <th scope="row">{feed.label}</th>
                      <td>{feed.rate}</td>
                      <td>{feed.leads}</td>
                      <td>{feed.spendText}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </td>
        </tr>
      ) : null}
    </Fragment>
  );
}

export function LeadCostCard() {
  const [period, setPeriod] = useState<InsightsPeriodPreset>(DEFAULT_ALLOCATION_PERIOD);
  const [openRows, setOpenRows] = useState<ReadonlySet<string>>(new Set());
  const query = useQuery({
    queryKey: queryKeys.insights.allocation({ period }),
    queryFn: () => fetchInsightsAllocation({ period, compare: "previous" }),
    refetchInterval: REFRESH_MS,
    staleTime: 30_000,
    retry: (count, error) => !isForbidden(error) && count < 2,
  });
  const report = query.data;

  const colors = useMemo(() => assignCompanyColors(report?.companies ?? []), [report]);
  const reps = useMemo(() => sortAllocationReps(report?.reps ?? []), [report]);
  const maxSpend = maxRepSpend(reps);

  // Not the Owner (or the server refuses): the card does not exist for this person.
  if (query.error && isForbidden(query.error)) return null;

  const header = report ? allocationHeader(report) : null;
  const hasComparison = Boolean(report?.comparison);
  const toggle = (key: string) =>
    setOpenRows((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <section className="od-card od-lc" aria-labelledby="od-lc-title" data-testid="lead-cost-by-rep">
      <div className="od-card__head">
        <div>
          <h2 id="od-lc-title" className="od-card__title">
            Lead cost by rep
          </h2>
          <p className="od-card__subtitle">
            {report ? `${report.period.label}${report.period.includes_today ? " · still counting today" : ""}. ` : ""}
            Each lead is priced at its feed&apos;s current lead cost and counted for the rep it is assigned to.
          </p>
        </div>
        <Segmented<InsightsPeriodPreset>
          label="Period"
          value={period}
          options={ALLOCATION_PERIODS}
          onChange={(value) => {
            setPeriod(value);
            setOpenRows(new Set());
          }}
        />
      </div>

      {query.error && !report ? (
        <ReadFailure what="Lead cost by rep couldn't load." error={query.error} onRetry={() => void query.refetch()} inset testId="lead-cost-read-error" />
      ) : !report || !header ? (
        <div className="od-lc-loading" data-testid="lead-cost-loading" aria-busy="true">
          <SkeletonLine width="60%" height={22} />
          {[0, 1, 2, 3].map((index) => (
            <SkeletonLine key={index} />
          ))}
        </div>
      ) : (
        <>
          <div className="od-lc-stats">
            <span className="od-lc-stat" data-testid="lead-cost-total">
              <span className="od-lc-stat__label">Allocated spend</span>
              <strong>{header.total}</strong>
            </span>
            <span className="od-lc-stat" data-testid="lead-cost-unassigned">
              <span className="od-lc-stat__label">No rep yet</span>
              <strong>{header.unassigned}</strong>
              {header.unassignedShare ? <span className="od-text-muted">{header.unassignedShare} of spend</span> : null}
            </span>
            <span className="od-lc-stat" data-testid="lead-cost-leads">
              <span className="od-lc-stat__label">Leads</span>
              <strong>{header.leads}</strong>
            </span>
          </div>
          {header.unpricedNote ? (
            <p className="od-lc-note od-text-amber" role="status" data-testid="lead-cost-unpriced">
              <CircleAlert aria-hidden="true" width={15} height={15} />
              {header.unpricedNote}
            </p>
          ) : null}
          {query.error ? <ReadFailure what="Lead cost by rep" error={query.error} staleAsOf={report.generated_at} onRetry={() => void query.refetch()} testId="lead-cost-stale" /> : null}

          {reps.length === 0 || report.totals.leads === 0 ? (
            <p className="od-empty" data-testid="lead-cost-empty">
              <Wallet aria-hidden="true" width={15} height={15} /> No leads were assigned in this period yet.
            </p>
          ) : (
            <>
              <ul className="od-lc-legend" aria-label="Source companies" data-testid="lead-cost-legend">
                {report.companies.map((company) => (
                  <li key={company.key}>
                    <span className="od-lc-swatch" style={{ background: colors[company.key] }} aria-hidden="true" />
                    {company.label}
                  </li>
                ))}
              </ul>
              <div className="od-table-wrap">
                <table className="od-table od-lc-table">
                  <thead>
                    <tr>
                      <th scope="col">Rep</th>
                      <th scope="col">Leads</th>
                      <th scope="col">Spend</th>
                      <th scope="col">Share</th>
                      <th scope="col">Spend by source</th>
                      <th scope="col">Avg lead cost</th>
                      <th scope="col">Booked</th>
                      <th scope="col">Cost / booked</th>
                      <th scope="col">vs previous</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reps.map((rep) => {
                      const key = rep.agent_id ?? "unassigned";
                      return <RepRow key={key} rep={rep} maxSpend={maxSpend} colors={colors} hasComparison={hasComparison} open={openRows.has(key)} onToggle={() => toggle(key)} />;
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <p className="od-card__foot">
            Duplicates are free. Booked counts leads booked as of now. The comparison is the previous period of the same length.
          </p>
        </>
      )}
    </section>
  );
}
