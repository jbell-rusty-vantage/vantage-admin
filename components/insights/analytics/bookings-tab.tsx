"use client";
/**
 * Bookings & cancellations (doc 09 tab 4): binder and deposits over the period, merchants, the booking mix, how long
 * leads take to book, and cancellations (count, refunds, rate, reasons, by source and rep, and when the cancelled
 * bookings were made).
 */
import { CircleCheck } from "lucide-react";
import type { InsightsAnalyticsReport } from "@/lib/api/insights";
import { medianSentence, mixGroups, rankedReasons, timeToBookShares } from "@/lib/insights/bookings";
import { formatCount, formatMoney, formatShare } from "@/lib/insights/format";
import { CrmCard, Notice } from "@/components/ui/crm";
import { CHART, ChartLegend } from "./chart-parts";
import { RankedTable, type RankedColumn } from "./ranked-table";
import { Scorecard } from "./scorecard";
import { TrendChart } from "./trend-chart";

/** Mix segments: neutral-to-strong blues so the parts read as one whole, each named in the legend beside it. */
const MIX_COLORS = ["#2f6fe6", "#86b6ef", "#c7dafa"];

const MERCHANT_COLUMNS: readonly RankedColumn[] = [
  { key: "bookings", label: "Bookings", delta: true },
  { key: "binder", label: "Binder", bar: true, delta: true },
  { key: "deposits", label: "Deposits", bar: true },
];

const CANCEL_COLUMNS: readonly RankedColumn[] = [{ key: "cancellations", label: "Cancellations", bar: true, delta: true }];

function BookingMix({ report }: { report: InsightsAnalyticsReport }) {
  const hasComparison = Boolean(report.comparison);
  const groups = mixGroups(report.bookings?.mix, hasComparison);
  return (
    <CrmCard className="ia-card" title="Booking mix" subtitle={hasComparison ? "Each bar is 100 % of the period's bookings; the thin bar under it is the comparison." : "Each bar is 100 % of the period's bookings."}>
      <div className="ia-card__body" style={{ display: "grid", gap: 18 }}>
        {groups.length === 0 ? (
          <p className="ia-empty">No bookings in this period.</p>
        ) : (
          groups.map((group) => (
            <div key={group.key} className="ia-mix">
              <h3 className="ia-mix__title">
                {group.title} <span className="ia-note">· {formatCount(group.total)} bookings</span>
              </h3>
              <div className="ia-stack" role="img" aria-label={`${group.title}: ${group.parts.map((part) => `${part.label} ${formatShare(part.share)}`).join(", ")}`}>
                {group.parts.map((part, index) =>
                  part.share > 0 ? <span key={part.key} className="ia-stack__part" style={{ width: `${part.share * 100}%`, background: MIX_COLORS[index % MIX_COLORS.length] }} title={`${part.label}: ${formatCount(part.count)} (${formatShare(part.share)})`} /> : null,
                )}
              </div>
              {hasComparison && group.comparisonTotal > 0 ? (
                <div className="ia-stack ia-stack--then" aria-hidden="true">
                  {group.parts.map((part, index) =>
                    (part.comparisonShare ?? 0) > 0 ? <span key={part.key} className="ia-stack__part" style={{ width: `${(part.comparisonShare ?? 0) * 100}%`, background: MIX_COLORS[index % MIX_COLORS.length] }} /> : null,
                  )}
                </div>
              ) : null}
              <ul className="ia-mix__legend">
                {group.parts.map((part, index) => (
                  <li key={part.key}>
                    <span className="ia-swatch" style={{ background: MIX_COLORS[index % MIX_COLORS.length], border: "1px solid #b7c2d3" }} aria-hidden="true" />
                    {part.label} <strong>{formatShare(part.share)}</strong>
                    <small>
                      {formatCount(part.count)}
                      {part.amount !== null ? ` · ${formatMoney(part.amount)}` : ""}
                      {part.comparisonShare !== null ? ` · was ${formatShare(part.comparisonShare)}` : ""}
                    </small>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </CrmCard>
  );
}

function TimeToBook({ report }: { report: InsightsAnalyticsReport }) {
  const hasComparison = Boolean(report.comparison);
  const ttb = report.bookings?.time_to_book;
  const buckets = timeToBookShares(ttb, hasComparison);
  const max = buckets.reduce((top, bucket) => Math.max(top, bucket.share, bucket.comparisonShare ?? 0), 0);
  return (
    <CrmCard className="ia-card" title="Time to book" subtitle={medianSentence(ttb, hasComparison)}>
      <div className="ia-card__body">
        {(ttb?.measured ?? 0) === 0 ? (
          <p className="ia-empty">No bookings with a lead to measure in this period.</p>
        ) : (
          <>
            <ChartLegend
              items={[
                { key: "now", label: `This period (${formatCount(ttb?.measured)} bookings)`, color: CHART.current, dot: true },
                ...(hasComparison ? [{ key: "then", label: "Comparison", color: "#b7c2d3", dot: true }] : []),
              ]}
            />
            <ul className="ia-hbars" aria-label="Days from lead to booking">
              {buckets.map((bucket) => (
                <li key={bucket.key} className="ia-hbar">
                  <span className="ia-hbar__label">{bucket.label}</span>
                  <span className="ia-hbar__tracks" aria-hidden="true">
                    <span className="ia-hbar__track">
                      <span className="ia-hbar__fill" style={{ width: `${max ? (bucket.share / max) * 100 : 0}%` }} />
                    </span>
                    {hasComparison ? (
                      <span className="ia-hbar__track">
                        <span className="ia-hbar__fill ia-hbar__fill--then" style={{ width: `${max ? ((bucket.comparisonShare ?? 0) / max) * 100 : 0}%` }} />
                      </span>
                    ) : null}
                  </span>
                  <span className="ia-hbar__value">
                    {formatShare(bucket.share)}
                    <small>
                      {formatCount(bucket.count)}
                      {bucket.comparisonShare !== null ? ` · was ${formatShare(bucket.comparisonShare)}` : ""}
                    </small>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </CrmCard>
  );
}

function Cancellations({ report }: { report: InsightsAnalyticsReport }) {
  const cancellations = report.bookings?.cancellations;
  const hasComparison = Boolean(report.comparison);
  const count = cancellations?.count?.value ?? 0;
  const before = cancellations?.count?.comparison_value ?? null;
  const reasons = rankedReasons(cancellations?.reasons);
  const timing = cancellations?.timing ?? { booked_in_period: 0, booked_earlier: 0 };
  return (
    <>
      <div className="ia-scoregrid ia-scoregrid--three">
        <Scorecard label="Cancellations" metric={cancellations?.count} definition="Bookings cancelled in the period." />
        <Scorecard label="Refunds" metric={cancellations?.refunds} definition="Money refunded on the period's cancellations." />
        <Scorecard label="Cancellation rate" metric={cancellations?.rate} definition={report.definitions?.cancellation_rate ?? "Bookings in the period that are now cancelled ÷ bookings in the period."} />
      </div>
      {count === 0 ? (
        <Notice icon={CircleCheck} tone="green" title="No cancellations are recorded in this period">
          {hasComparison && before ? `The comparison period had ${formatCount(before)}.` : "Nothing was cancelled, or no cancellation has been recorded yet."}
        </Notice>
      ) : (
        <>
          <div className="ia-grid-2">
            <CrmCard className="ia-card" title="Why they cancelled" subtitle="Reasons, most common first.">
              <div className="ia-card__body">
                {reasons.length === 0 ? (
                  <p className="ia-empty">No reasons were recorded.</p>
                ) : (
                  <ul className="ia-hbars">
                    {reasons.map((reason) => (
                      <li key={reason.key} className="ia-hbar">
                        <span className="ia-hbar__label" title={reason.label}>
                          {reason.label}
                        </span>
                        <span className="ia-hbar__tracks" aria-hidden="true">
                          <span className="ia-hbar__track">
                            <span className="ia-hbar__fill" style={{ width: `${reason.share * 100}%`, background: "var(--crm-red)" }} />
                          </span>
                        </span>
                        <span className="ia-hbar__value">
                          {formatCount(reason.count)}
                          {hasComparison ? <small>was {formatCount(reason.comparison_count)}</small> : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CrmCard>
            <CrmCard className="ia-card" title="When the cancelled bookings were made">
              <div className="ia-card__body">
                <ul className="ia-hbars">
                  {[
                    { key: "in", label: "Booked in the period", value: timing.booked_in_period },
                    { key: "earlier", label: "Booked earlier", value: timing.booked_earlier },
                  ].map((part) => {
                    const total = timing.booked_in_period + timing.booked_earlier;
                    return (
                      <li key={part.key} className="ia-hbar">
                        <span className="ia-hbar__label">{part.label}</span>
                        <span className="ia-hbar__tracks" aria-hidden="true">
                          <span className="ia-hbar__track">
                            <span className="ia-hbar__fill" style={{ width: `${total ? (part.value / total) * 100 : 0}%` }} />
                          </span>
                        </span>
                        <span className="ia-hbar__value">
                          {formatCount(part.value)}
                          <small>{formatShare(total ? part.value / total : null)}</small>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </CrmCard>
          </div>
          <div className="ia-grid-2">
            <RankedTable title="Cancellations by source" rows={cancellations?.by_source ?? []} columns={CANCEL_COLUMNS} labelHeader="Source" hasComparison={hasComparison} csvName="cancellations-by-source" period={report.period} emptyText="No cancellations traced to a source." />
            <RankedTable title="Cancellations by rep" rows={cancellations?.by_rep ?? []} columns={CANCEL_COLUMNS} labelHeader="Rep" hasComparison={hasComparison} csvName="cancellations-by-rep" period={report.period} emptyText="No cancellations traced to a rep." />
          </div>
        </>
      )}
    </>
  );
}

export function BookingsTab({ report }: { report: InsightsAnalyticsReport }) {
  return (
    <>
      <TrendChart report={report} metrics={["binder", "deposits", "bookings"]} title="Binder and deposits" subtitle="Money booked per bucket, this period against the comparison, day 1 to day 1." />
      <div className="ia-grid-2">
        <BookingMix report={report} />
        <TimeToBook report={report} />
      </div>
      <RankedTable title="Merchants" subtitle="Bookings made in the period, by merchant." rows={report.bookings?.merchants ?? []} columns={MERCHANT_COLUMNS} labelHeader="Merchant" hasComparison={Boolean(report.comparison)} csvName="merchants" period={report.period} emptyText="No bookings in this period." />
      <Cancellations report={report} />
    </>
  );
}
