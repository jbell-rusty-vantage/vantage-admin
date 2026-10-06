"use client";
/**
 * Today > Money (owner only). The Money endpoint (`GET api/v1/admin/money/spend`) is server work that has not shipped:
 * while it 404s or fails, the tab says so in words and falls back to the Overview report's 7-day and all-time lead
 * cost. Missing is not zero: unpriced Leads carry a warning that links to Lead costs in the Operations Registry.
 */
import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Banknote, CircleDollarSign, Percent, TriangleAlert, UserRound } from "lucide-react";
import {
  CrmCard,
  Notice,
  ReadFailure,
  Segmented,
  SkeletonLine,
  SummaryCard,
  formatCount,
  formatMoney,
  formatTime,
} from "@/components/ui/crm";
import { fetchOverviewReport, type OverviewReportResponse } from "@/lib/api/admin";
import {
  fetchMoneySpend,
  isMoneyEndpointMissing,
  MONEY_SPEND_RANGES,
  type MoneySpendRange,
  type MoneySpendResponse,
} from "@/lib/api/money";
import { queryKeys } from "@/lib/query/keys";
import { fallbackTable, rateText, repCostCells, sourceTotals, type FallbackRange } from "./money-math";
import { todayCopy } from "./today-copy";

const c = todayCopy.money;

const RANGE_OPTIONS = MONEY_SPEND_RANGES.map((value) => ({ value, label: c.ranges[value] }));
const FALLBACK_OPTIONS: readonly { value: FallbackRange; label: string }[] = [
  { value: "last_7_days", label: c.fallbackRanges.last_7_days },
  { value: "all_time", label: c.fallbackRanges.all_time },
];

const money = (value: number | null | undefined, cents = false) => (value === null || value === undefined ? c.pending : formatMoney(value, { cents }));

function UnpricedCell({ count }: { count: number }) {
  if (count <= 0) return <span className="crm-text-muted">0</span>;
  return (
    <Link href={c.bySource.unpricedHref} className="crm-text-amber crm-strong" title={c.bySource.unpricedHint}>
      <TriangleAlert aria-hidden="true" width={13} height={13} style={{ display: "inline", verticalAlign: "-2px" }} /> {count}
    </Link>
  );
}

function SourceTable({ data }: { data: MoneySpendResponse }) {
  const rows = data.by_source_company;
  const totals = sourceTotals(rows);
  return (
    <CrmCard title={c.bySource.title} testId="today-money-by-source" foot={totals.unpriced > 0 ? c.bySource.unpricedHint : undefined}>
      <div className="crm-table-wrap">
        <table className="crm-table">
          <thead>
            <tr>
              <th scope="col">{c.bySource.columns.company}</th>
              <th scope="col">{c.bySource.columns.leads}</th>
              <th scope="col">{c.bySource.columns.dup}</th>
              <th scope="col">{c.bySource.columns.rate}</th>
              <th scope="col">{c.bySource.columns.spend}</th>
              <th scope="col">{c.bySource.columns.booked}</th>
              <th scope="col">{c.bySource.columns.perBooked}</th>
              <th scope="col">{c.bySource.columns.unpriced}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="crm-text-muted">
                  {c.bySource.empty}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.source_company}>
                  <th scope="row">{row.source_company_label}</th>
                  <td>{formatCount(row.leads)}</td>
                  <td>{formatCount(row.duplicates)}</td>
                  <td className={row.rate_label ? undefined : "crm-text-amber"}>{rateText(row, c.bySource.rateMissing)}</td>
                  <td>{row.unpriced > 0 && row.spend === 0 ? c.pending : money(row.spend)}</td>
                  <td>{formatCount(row.booked)}</td>
                  <td>{money(row.cost_per_booked)}</td>
                  <td>
                    <UnpricedCell count={row.unpriced} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {rows.length > 0 ? (
            <tfoot>
              <tr>
                <th scope="row">{c.bySource.total}</th>
                <td>{formatCount(totals.leads)}</td>
                <td>{formatCount(totals.duplicates)}</td>
                <td />
                <td>{money(totals.spend)}</td>
                <td>{formatCount(totals.booked)}</td>
                <td>{money(totals.costPerBooked)}</td>
                <td>
                  <UnpricedCell count={totals.unpriced} />
                </td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </CrmCard>
  );
}

function RepTable({ data }: { data: MoneySpendResponse }) {
  return (
    <CrmCard title={c.byRep.title} testId="today-money-by-rep">
      <div className="crm-table-wrap">
        <table className="crm-table">
          <thead>
            <tr>
              <th scope="col">{c.byRep.columns.rep}</th>
              <th scope="col">{c.byRep.columns.received}</th>
              <th scope="col">{c.byRep.columns.calls}</th>
              <th scope="col">{c.byRep.columns.booked}</th>
              <th scope="col">{c.byRep.columns.cost}</th>
              <th scope="col">{c.byRep.columns.perLead}</th>
              <th scope="col">{c.byRep.columns.perBooked}</th>
            </tr>
          </thead>
          <tbody>
            {data.by_rep.length === 0 ? (
              <tr>
                <td colSpan={7} className="crm-text-muted">
                  {c.byRep.empty}
                </td>
              </tr>
            ) : (
              data.by_rep.map((row) => {
                const cells = repCostCells(row);
                return (
                  <tr key={row.agent_id}>
                    <th scope="row">{row.agent_name}</th>
                    <td>{formatCount(row.leads_received)}</td>
                    <td>{formatCount(row.calls)}</td>
                    <td>{formatCount(row.booked)}</td>
                    <td className={cells.missing ? "crm-text-amber" : undefined}>{cells.missing ? c.byRep.compensationMissing : money(cells.cost)}</td>
                    <td>{money(cells.perLead)}</td>
                    <td>{money(cells.perBooked)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </CrmCard>
  );
}

/** The live Money view, once the endpoint answers. */
export function MoneyLive({ data }: { data: MoneySpendResponse }) {
  const t = data.totals;
  return (
    <div className="crm-stack" data-testid="today-money-live">
      <div className="crm-summary-row">
        <SummaryCard icon={Banknote} tone="blue" title={c.cards.leadSpend} value={money(t.lead_spend)} caption={t.unpriced > 0 ? `${t.unpriced} unpriced` : undefined} />
        <SummaryCard icon={CircleDollarSign} tone="green" title={c.cards.costPerLead} value={money(t.cost_per_lead)} />
        <SummaryCard icon={Percent} tone="amber" title={c.cards.costPerBooked} value={money(t.cost_per_booked_lead)} />
        <SummaryCard icon={UserRound} tone="purple" title={c.cards.repCostPerLead} value={money(t.rep_cost_per_lead)} />
      </div>
      <SourceTable data={data} />
      <RepTable data={data} />
    </div>
  );
}

/** The waiting notice plus the Overview report's lead cost. Pure over its props so it renders in tests. */
export function MoneyFallback({
  overview,
  loading,
  error,
  range,
  onRange,
  waiting = true,
}: {
  overview: OverviewReportResponse | undefined;
  loading: boolean;
  error?: unknown;
  range: FallbackRange;
  onRange: (range: FallbackRange) => void;
  waiting?: boolean;
}) {
  const table = fallbackTable(overview, range);
  return (
    <div className="crm-stack" data-testid="today-money-fallback">
      {waiting ? (
        <Notice icon={Banknote} tone="amber" title={c.waitingTitle} testId="today-money-waiting">
          <p>{c.waitingBody}</p>
        </Notice>
      ) : null}
      <CrmCard
        title={c.bySource.title}
        tools={<Segmented<FallbackRange> label={c.fallbackRangeLabel} value={range} onChange={onRange} options={FALLBACK_OPTIONS} />}
        testId="today-money-fallback-table"
      >
        {error ? (
          <ReadFailure what={c.overviewError} error={error} inset />
        ) : loading ? (
          <div className="crm-stack" style={{ padding: 16 }}>
            <SkeletonLine />
            <SkeletonLine width="70%" />
          </div>
        ) : table === null ? (
          <p className="crm-empty">{c.bySource.empty}</p>
        ) : (
          <div className="crm-table-wrap">
            <table className="crm-table">
              <thead>
                <tr>
                  <th scope="col">{c.fallbackColumns.company}</th>
                  <th scope="col">{c.fallbackColumns.leads}</th>
                  <th scope="col">{c.fallbackColumns.spend}</th>
                  <th scope="col">{c.fallbackColumns.unpriced}</th>
                </tr>
              </thead>
              <tbody>
                {table.rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="crm-text-muted">
                      {c.bySource.empty}
                    </td>
                  </tr>
                ) : (
                  table.rows.map((row) => (
                    <tr key={row.key}>
                      <th scope="row">{row.label}</th>
                      <td>{formatCount(row.leads)}</td>
                      <td>{money(row.spend)}</td>
                      <td>
                        <UnpricedCell count={row.unpriced} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">{c.bySource.total}</th>
                  <td>{formatCount(table.total.leads)}</td>
                  <td>{money(table.total.spend)}</td>
                  <td>
                    <UnpricedCell count={table.total.unpriced} />
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </CrmCard>
      <CrmCard title={c.byRep.title} testId="today-money-by-rep-pending">
        <p className="crm-empty">{c.byRep.needsCompensation}</p>
      </CrmCard>
    </div>
  );
}

export function MoneyTab() {
  const [range, setRange] = useState<MoneySpendRange>("today");
  const [fallbackRange, setFallbackRange] = useState<FallbackRange>("last_7_days");
  const spend = useQuery({
    queryKey: [...queryKeys.dashboard.all, "money-spend", range] as const,
    queryFn: () => fetchMoneySpend(range),
    retry: (count, error) => !isMoneyEndpointMissing(error) && count < 1,
    staleTime: 60_000,
    refetchInterval: range === "today" ? 60_000 : false,
    refetchIntervalInBackground: false,
  });
  const waiting = spend.isError;
  const overview = useQuery({
    queryKey: queryKeys.dashboard.overview(),
    queryFn: fetchOverviewReport,
    enabled: waiting,
  });

  return (
    <div className="crm-stack" data-testid="today-money">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented<MoneySpendRange> label={c.rangeLabel} value={range} onChange={setRange} options={RANGE_OPTIONS} />
        {spend.data ? <span className="crm-text-muted crm-small">{c.generatedAt(formatTime(spend.data.generated_at))}</span> : null}
      </div>
      {spend.data ? (
        <MoneyLive data={spend.data} />
      ) : waiting ? (
        <MoneyFallback
          overview={overview.data}
          loading={overview.isLoading}
          error={overview.error}
          range={fallbackRange}
          onRange={setFallbackRange}
        />
      ) : (
        <CrmCard testId="today-money-loading">
          <div className="crm-stack" style={{ padding: 16 }}>
            <SkeletonLine />
            <SkeletonLine width="60%" />
          </div>
        </CrmCard>
      )}
    </div>
  );
}
