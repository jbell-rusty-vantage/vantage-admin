"use client";
/**
 * Reviews (doc 09 tab 5): the Owner's reputation. Average rating, new reviews and the response rate against the
 * comparison; the star spread all time vs this period; monthly volume and rating as two small charts on one time
 * line (never one chart with two scales); the newest three; and when BBB was last read (amber after 14 days).
 */
import { useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CircleCheck, TriangleAlert } from "lucide-react";
import { fetchInsightsReviews, insightsSearchParams, type InsightsQuery } from "@/lib/api/insights";
import { formatCount, formatDayKey } from "@/lib/insights/format";
import { monthlyRows, reviewsFreshness, starGlyphs, starRows, type MonthlyRow } from "@/lib/insights/reviews";
import { queryKeys } from "@/lib/query/keys";
import { CrmCard, Pill, ReadFailure, SkeletonLine } from "@/components/ui/crm";
import { AXIS_TICK, CHART, ChartLegend, EmptyChart, TooltipBox } from "./chart-parts";
import { Scorecard, ScorecardSkeleton } from "./scorecard";

type TooltipProps = { active?: boolean; payload?: ReadonlyArray<{ payload?: MonthlyRow }> };

const subscribeNothing = () => () => {};

function MonthlyTooltip({ active, payload }: TooltipProps) {
  const row = active ? payload?.[0]?.payload : undefined;
  if (!row) return null;
  return (
    <TooltipBox
      title={row.label}
      rows={[
        { key: "count", label: "New reviews", value: formatCount(row.count) },
        { key: "avg", label: "Average rating", value: row.average === null ? "—" : `★ ${row.average.toFixed(1)}` },
      ]}
    />
  );
}

export function ReviewsTab({ query }: { query: InsightsQuery }) {
  const filters = Object.fromEntries(insightsSearchParams({ ...query, sources: [] }));
  const reviews = useQuery({ queryKey: queryKeys.insights.reviews(filters), queryFn: () => fetchInsightsReviews(query) });
  // A stable "now" read once per mount (client only), for "N days ago"; the server already decides `stale`.
  const nowMs = useSyncExternalStore(subscribeNothing, () => Math.floor(Date.now() / 3_600_000) * 3_600_000, () => null);

  if (reviews.isPending) {
    return (
      <>
        <div className="ia-scoregrid ia-scoregrid--three">
          <ScorecardSkeleton />
          <ScorecardSkeleton />
          <ScorecardSkeleton />
        </div>
        <div className="crm-card" style={{ padding: 16, display: "grid", gap: 10 }} aria-hidden="true">
          <SkeletonLine width="30%" height={14} />
          <SkeletonLine width="100%" />
          <SkeletonLine width="90%" />
          <SkeletonLine width="70%" />
        </div>
      </>
    );
  }
  if (reviews.isError) return <ReadFailure what="Reviews could not be read." error={reviews.error} onRetry={() => void reviews.refetch()} />;

  const report = reviews.data;
  const stars = starRows(report.stars);
  const monthly = monthlyRows(report.monthly);
  const freshness = reviewsFreshness(report.last_ingested_at, report.stale, nowMs ?? Number.NaN);
  const maxShare = stars.reduce((top, row) => Math.max(top, row.allTimeShare, row.periodShare), 0);
  const periodTotal = stars.reduce((sum, row) => sum + row.period, 0);
  return (
    <>
      <p className="ia-freshness" data-stale={freshness.stale ? "true" : undefined} role="status">
        {freshness.stale ? <TriangleAlert aria-hidden="true" width={15} height={15} /> : <CircleCheck aria-hidden="true" width={15} height={15} />}
        {freshness.label}
        {freshness.stale ? <Pill variant="amber">more than 14 days ago</Pill> : null}
        {freshness.stale ? <span className="ia-note">New BBB reviews will not show until the next refresh.</span> : null}
      </p>
      <div className="ia-scoregrid ia-scoregrid--three">
        <Scorecard label="Average rating" metric={report.average_rating} prefix={typeof report.average_rating?.value === "number" ? "★" : undefined} format={{ ratio: "plain" }} definition={`Average stars of the reviews posted in the period. All time: ${report.all_time.average_rating === null ? "—" : `★ ${report.all_time.average_rating.toFixed(1)}`} over ${formatCount(report.all_time.count)} reviews.`} />
        <Scorecard label="New reviews" metric={report.new_reviews} definition="Reviews posted in the period." />
        <Scorecard label="Responded" metric={report.response_rate} format={{ rateDigits: 0 }} definition={`Share of the period's reviews with a public response. All time: ${report.all_time.response_rate === null ? "—" : `${Math.round(report.all_time.response_rate * 100)}%`}.`} />
      </div>
      <div className="ia-grid-2">
        <CrmCard className="ia-card" title="Stars" subtitle={`All time (${formatCount(report.all_time.count)} reviews) against this period (${formatCount(periodTotal)}). Bars are shares of each.`}>
          <div className="ia-card__body">
            <ChartLegend
              items={[
                { key: "all", label: "All time", color: "#b7c2d3", dot: true },
                { key: "period", label: "This period", color: CHART.current, dot: true },
              ]}
            />
            <ul className="ia-hbars" aria-label="Stars, all time and this period">
              {stars.map((row) => (
                <li key={row.stars} className="ia-hbar">
                  <span className="ia-hbar__label">
                    {row.stars} <span className="ia-stars" aria-hidden="true">★</span>
                    <span className="sr-only"> stars</span>
                  </span>
                  <span className="ia-hbar__tracks" aria-hidden="true">
                    <span className="ia-hbar__track">
                      <span className="ia-hbar__fill ia-hbar__fill--then" style={{ width: `${maxShare ? (row.allTimeShare / maxShare) * 100 : 0}%` }} />
                    </span>
                    <span className="ia-hbar__track">
                      <span className="ia-hbar__fill" style={{ width: `${maxShare ? (row.periodShare / maxShare) * 100 : 0}%` }} />
                    </span>
                  </span>
                  <span className="ia-hbar__value">
                    {formatCount(row.allTime)} · {formatCount(row.period)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </CrmCard>
        <CrmCard className="ia-card" title="Reviews by month" subtitle="How many came in, and their average rating, on the same months.">
          <div className="ia-card__body">
            {monthly.length === 0 ? (
              <EmptyChart>No reviews recorded yet.</EmptyChart>
            ) : (
              <>
                <p className="ia-note" style={{ fontWeight: 700 }}>New reviews</p>
                <div className="ia-chart" style={{ height: 150 }} role="img" aria-label={`New reviews per month, ${monthly[0]?.label} to ${monthly[monthly.length - 1]?.label}`}>
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <BarChart data={monthly} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} syncId="reviews-monthly">
                      <CartesianGrid stroke={CHART.grid} vertical={false} />
                      <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: CHART.axis }} minTickGap={16} hide />
                      <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
                      <Tooltip content={MonthlyTooltip} cursor={{ fill: "rgba(47,111,230,0.06)" }} />
                      <Bar dataKey="count" name="New reviews" fill={CHART.current} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="ia-note" style={{ fontWeight: 700, marginTop: 8 }}>Average rating (1–5 ★)</p>
                <div className="ia-chart" style={{ height: 120 }} role="img" aria-label="Average rating per month">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <LineChart data={monthly} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} syncId="reviews-monthly">
                      <CartesianGrid stroke={CHART.grid} vertical={false} />
                      <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: CHART.axis }} minTickGap={16} />
                      <YAxis domain={[1, 5]} ticks={[1, 3, 5]} tick={AXIS_TICK} tickLine={false} axisLine={false} width={32} />
                      <Tooltip content={MonthlyTooltip} cursor={{ stroke: CHART.axis }} />
                      <Line type="monotone" dataKey="average" name="Average rating" stroke="#e0a400" strokeWidth={2} dot={{ r: 3, fill: "#e0a400", stroke: "#fff", strokeWidth: 1.5 }} connectNulls isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </div>
        </CrmCard>
      </div>
      <CrmCard className="ia-card" title="Newest reviews">
        <div className="ia-card__body">
          {report.newest.length === 0 ? (
            <p className="ia-empty">No reviews recorded yet.</p>
          ) : (
            <div className="ia-reviews">
              {report.newest.slice(0, 3).map((review) => (
                <article key={review.id} className="crm-card ia-review" style={{ boxShadow: "none" }}>
                  <div className="ia-review__head">
                    <span className="ia-stars" aria-label={`${review.rating} stars`}>
                      {starGlyphs(review.rating)}
                    </span>
                    {review.responded ? (
                      <Pill variant="green">Responded</Pill>
                    ) : (
                      <Pill variant="gray">No response</Pill>
                    )}
                  </div>
                  <span className="ia-review__name">{review.reviewer_name || "Anonymous"}</span>
                  <span className="ia-note">
                    {formatDayKey(review.review_date, true)} · {review.source}
                  </span>
                  <p className="ia-review__text">{review.excerpt}</p>
                </article>
              ))}
            </div>
          )}
        </div>
      </CrmCard>
    </>
  );
}
