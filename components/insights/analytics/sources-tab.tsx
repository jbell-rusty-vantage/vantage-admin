"use client";
/**
 * Sources (doc 09 tab 2): the buying decision. One ranked table of source companies (feeds nest under each), a
 * head-to-head compare of up to four, the "where to buy more" scatter, and the collapsed "More breakdowns" (local vs
 * long distance, pickup states, lanes, text to booked) that replaced the old Geography and Text to booked tabs.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { GitCompareArrows, Hourglass } from "lucide-react";
import type { InsightsAnalyticsReport, InsightsRow } from "@/lib/api/insights";
import { compareColor, isComparable, selectedEntities, toggleCompareKey, topCompareKeys, type CompareMetricSpec } from "@/lib/insights/compare";
import { formatValue } from "@/lib/insights/format";
import { metricOf } from "@/lib/insights/table";
import { COMPARE_MAX, type SourcesBasis } from "@/lib/insights/url";
import { Notice, Segmented } from "@/components/ui/crm";
import { CompareTray } from "./compare-tray";
import { RankedTable, type RankedColumn } from "./ranked-table";
import { SourceScatter } from "./source-scatter";
import { TextToBooked } from "./text-to-booked";

const COST_PER_LEAD: RankedColumn = {
  key: "cpl",
  label: "Cost/lead",
  title: "The feed's lead cost from Setup › Lead sources (a range when feeds differ). Hover for the period's average.",
  render: (row) => {
    const label = typeof row.notes?.rate_label === "string" ? row.notes.rate_label : null;
    const metric = metricOf(row, "cpl");
    return <span title={`Average this period: ${formatValue(metric)} per lead`}>{label ?? formatValue(metric)}</span>;
  },
  csv: { value: (row) => (typeof row.notes?.rate_label === "string" ? row.notes.rate_label : (metricOf(row, "cpl")?.value ?? null)) },
};

const COHORT_COLUMNS: readonly RankedColumn[] = [
  { key: "leads", label: "Leads", bar: true, delta: true, title: "Leads that arrived in the period (duplicates left out)" },
  { key: "spend", label: "Spend", bar: true, title: "Lead spend at each feed's lead cost" },
  COST_PER_LEAD,
  { key: "booked", label: "Booked", title: "Of those leads, how many are booked as of now" },
  { key: "booking_rate", label: "Rate", delta: true, title: "Booked ÷ leads" },
  { key: "cost_per_booking", label: "Cost/booking", title: "Spend ÷ booked" },
  { key: "binder", label: "Binder", bar: true, title: "Binder of the bookings from those leads" },
  { key: "return_on_spend", label: "Return", title: "Binder ÷ spend: above 1.00× the leads paid for themselves" },
  { key: "cancel_rate", label: "Cancel", title: "Share of those bookings now cancelled" },
];

const ACTIVITY_COLUMNS: readonly RankedColumn[] = [
  { key: "leads", label: "Leads", bar: true, delta: true, title: "Leads that arrived in the period (duplicates left out)" },
  { key: "spend", label: "Spend", bar: true, title: "Lead spend at each feed's lead cost" },
  COST_PER_LEAD,
  { key: "activity_bookings", label: "Bookings", delta: true, title: "Bookings whose book date is in the period, whenever the lead arrived" },
  { key: "activity_binder", label: "Binder", bar: true, delta: true, title: "Binder of those bookings" },
];

const BREAKDOWN_COLUMNS: readonly RankedColumn[] = [
  { key: "leads", label: "Leads", bar: true, delta: true },
  { key: "spend", label: "Spend", bar: true },
  { key: "booked", label: "Booked" },
  { key: "booking_rate", label: "Rate", delta: true },
  { key: "cost_per_booking", label: "Cost/booking" },
  { key: "binder", label: "Binder", bar: true },
  { key: "return_on_spend", label: "Return" },
];

const COMPARE_METRICS: readonly CompareMetricSpec[] = [
  { key: "leads", label: "Leads" },
  { key: "spend", label: "Lead spend" },
  { key: "cpl", label: "Cost per lead" },
  { key: "booked", label: "Booked" },
  { key: "booking_rate", label: "Booking rate" },
  { key: "cost_per_booking", label: "Cost per booking" },
  { key: "binder", label: "Binder" },
  { key: "return_on_spend", label: "Return on spend" },
  { key: "cancel_rate", label: "Cancellation rate" },
];

const subscribeHash = (onChange: () => void) => {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
};

function unpricedNote(row: InsightsRow) {
  const unpriced = typeof row.notes?.unpriced === "number" ? row.notes.unpriced : 0;
  return unpriced > 0 ? <span style={{ color: "var(--crm-amber-ink)" }}>{unpriced} unpriced</span> : null;
}

function MoreBreakdowns({ report }: { report: InsightsAnalyticsReport }) {
  const hash = useSyncExternalStore(subscribeHash, () => window.location.hash, () => "");
  const [userOpen, setUserOpen] = useState<boolean | null>(null);
  const open = userOpen ?? hash === "#more";
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (hash === "#more") ref.current?.scrollIntoView({ block: "start" });
  }, [hash]);
  const hasComparison = Boolean(report.comparison);
  const period = report.period;
  return (
    <details id="more" ref={ref} className="ia-details" open={open} onToggle={(event) => setUserOpen(event.currentTarget.open)}>
      <summary>More breakdowns</summary>
      {open ? (
        <div className="ia-details__body">
          <RankedTable title="Local or long distance" subtitle="Leads that arrived in the period, by move type." rows={report.sources?.local_vs_long_distance ?? []} columns={BREAKDOWN_COLUMNS} labelHeader="Move type" hasComparison={hasComparison} csvName="local-vs-long-distance" period={period} />
          <RankedTable title="Pickup states" subtitle="Where the period's leads move from." rows={report.sources?.pickup_states ?? []} columns={BREAKDOWN_COLUMNS} labelHeader="State" hasComparison={hasComparison} csvName="pickup-states" period={period} />
          <RankedTable title="Lanes" subtitle="Pickup state → delivery state." rows={report.sources?.lanes ?? []} columns={BREAKDOWN_COLUMNS} labelHeader="Lane" hasComparison={hasComparison} csvName="lanes" period={period} />
          <TextToBooked period={period} />
        </div>
      ) : null}
    </details>
  );
}

export function SourcesTab({ report, basis, cmp, onBasis, onCompare }: { report: InsightsAnalyticsReport; basis: SourcesBasis; cmp: readonly string[]; onBasis: (basis: SourcesBasis) => void; onCompare: (keys: string[]) => void }) {
  const companies = report.sources?.companies ?? [];
  const hasComparison = Boolean(report.comparison);
  const comparable = companies.filter(isComparable);
  const selected = selectedEntities(comparable, cmp);
  const selectedKeys = selected.map((row) => row.key);
  const colorFor = (key: string) => (selectedKeys.includes(key) ? compareColor(selectedKeys.indexOf(key)) : null);
  const toggle = (key: string) => {
    const result = toggleCompareKey(selectedKeys, key);
    if (!result.refused) onCompare(result.keys);
  };
  const activity = basis === "activity";
  return (
    <>
      {report.sources?.cohort_maturing && !activity ? (
        <Notice icon={Hourglass} tone="amber" title="Conversion is still maturing">
          Many of this period&apos;s leads have not had time to book yet, so booked, rate, cost per booking and return will keep rising. Compare against a period of the same age, or switch to activity.
        </Notice>
      ) : null}
      <CompareTray
        entities={selected}
        colorFor={(key) => colorFor(key) ?? compareColor(0)}
        metrics={COMPARE_METRICS}
        seriesOptions={[
          { field: "value", label: "Leads", kind: "count" },
          { field: "secondary", label: "Booked", kind: "count" },
        ]}
        bucket={report.series?.bucket ?? report.period.bucket}
        hasComparison={hasComparison}
        partialLast={report.period.includes_today}
        noun="sources"
        onRemove={(key) => onCompare(selectedKeys.filter((existing) => existing !== key))}
        onClear={() => onCompare([])}
      />
      <RankedTable
        testId="sources-table"
        title="Source companies"
        subtitle={
          activity
            ? "Bookings and binder made in the period, whenever the lead arrived. Rate, cost per booking and return need the leads-that-arrived basis."
            : "Leads that arrived in the period and what they have booked so far. Expand a source for its feeds; tick up to four to compare."
        }
        tools={
          <>
            <Segmented<SourcesBasis>
              size="sm"
              label="Basis"
              value={basis}
              onChange={onBasis}
              options={[
                { value: "cohort", label: "Leads that arrived in the period" },
                { value: "activity", label: "Activity in the period" },
              ]}
            />
            <button type="button" className="crm-button crm-button--sm" onClick={() => onCompare(topCompareKeys(comparable, 3))} disabled={comparable.length < 2}>
              <GitCompareArrows aria-hidden="true" width={14} height={14} />
              Compare top 3
            </button>
          </>
        }
        rows={companies}
        columns={activity ? ACTIVITY_COLUMNS : COHORT_COLUMNS}
        labelHeader="Source"
        hasComparison={hasComparison}
        csvName={activity ? "sources-activity" : "sources"}
        period={report.period}
        rowNote={unpricedNote}
        selection={{ keys: selectedKeys, onToggle: toggle, colorFor, canSelect: isComparable, max: COMPARE_MAX }}
        emptyText="No leads or bookings from any source in this period."
        foot={
          <>
            <span>Referrals and bookings with no lead sit at the bottom: they have no lead cost.</span>
            {selectedKeys.length >= COMPARE_MAX ? <span className="ia-note--amber">Up to {COMPARE_MAX} sources at a time: untick one to pick another.</span> : null}
          </>
        }
      />
      <SourceScatter companies={companies} colorFor={colorFor} />
      <MoreBreakdowns report={report} />
    </>
  );
}
