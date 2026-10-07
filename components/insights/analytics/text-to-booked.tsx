"use client";
/**
 * Text to booked (doc 09 "More breakdowns"; was its own Analytics tab): of the leads whose confirmation text went
 * out, how many booked, by message origin. Reads the older analytics report for the page's dates.
 */
import { useQuery } from "@tanstack/react-query";
import type { InsightsPeriod } from "@/lib/api/insights";
import { fetchAnalyticsReport } from "@/lib/api/admin";
import { formatCount, formatMetricValue } from "@/lib/insights/format";
import { textToBookedSummary } from "@/lib/insights/text-to-booked";
import { queryKeys } from "@/lib/query/keys";
import { CrmCard, ReadFailure, SkeletonLine } from "@/components/ui/crm";
import { CHART, ChartLegend } from "./chart-parts";

const REPORT = "sms-successfully-sent-then-booked" as const;

export function TextToBooked({ period }: { period: Pick<InsightsPeriod, "start" | "end_exclusive"> }) {
  // The older report filters `$gte from` / `$lte to` on UTC instants, so the exclusive end keeps the last day in.
  const filters = { from: period.start, to: period.end_exclusive };
  const query = useQuery({ queryKey: queryKeys.analytics.report(REPORT, filters), queryFn: () => fetchAnalyticsReport(REPORT, filters) });
  const summary = textToBookedSummary(query.data?.data);
  const max = summary.origins.reduce((top, row) => Math.max(top, row.texted), 0);
  return (
    <CrmCard
      className="ia-card"
      title="Text to booked"
      subtitle="Leads whose confirmation text was accepted, sent or delivered, and how many of them booked. Failed and skipped texts are left out."
      foot="Counted by UTC day, so totals can differ by a few evening leads from the rest of this page."
    >
      <div className="ia-card__body">
        {query.isPending ? (
          <div style={{ display: "grid", gap: 8 }} aria-hidden="true">
            <SkeletonLine width="40%" height={20} />
            <SkeletonLine width="100%" />
            <SkeletonLine width="80%" />
          </div>
        ) : query.isError ? (
          <ReadFailure inset what="Text to booked could not be read." error={query.error} onRetry={() => void query.refetch()} />
        ) : !summary.overall || summary.overall.texted === 0 ? (
          <p className="ia-empty">No leads were texted in this period.</p>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            <p className="ia-score__value" style={{ fontSize: 22 }}>
              {formatMetricValue(summary.overall.rate, "rate")}
              <span className="ia-note" style={{ fontSize: 13, fontWeight: 600 }}>
                {formatCount(summary.overall.booked)} booked of {formatCount(summary.overall.texted)} texted leads
              </span>
            </p>
            {summary.origins.length ? (
              <>
                <ChartLegend
                  items={[
                    { key: "texted", label: "Texted", color: "#b7c2d3", dot: true },
                    { key: "booked", label: "Booked", color: CHART.current, dot: true },
                  ]}
                />
                <ul className="ia-hbars" aria-label="By message origin">
                  {summary.origins.map((row) => (
                    <li key={row.key} className="ia-hbar">
                      <span className="ia-hbar__label" title={row.label}>
                        {row.label}
                      </span>
                      <span className="ia-hbar__tracks" aria-hidden="true">
                        <span className="ia-hbar__track">
                          <span className="ia-hbar__fill ia-hbar__fill--then" style={{ width: `${max ? (row.texted / max) * 100 : 0}%` }} />
                        </span>
                        <span className="ia-hbar__track">
                          <span className="ia-hbar__fill" style={{ width: `${max ? (row.booked / max) * 100 : 0}%` }} />
                        </span>
                      </span>
                      <span className="ia-hbar__value">
                        {formatMetricValue(row.rate, "rate")}
                        <small>
                          {formatCount(row.booked)} of {formatCount(row.texted)}
                        </small>
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        )}
      </div>
    </CrmCard>
  );
}
