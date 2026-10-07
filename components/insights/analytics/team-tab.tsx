"use client";
/**
 * Team (doc 09 tab 3): outcomes per person. Sales reps (bookings, split-credited binder and deposits, trend as small
 * multiples) with a head-to-head compare, and receiver agents (who took the leads, what they cost, how they booked).
 * Call activity, goals and follow-ups belong to the Outreach Desk.
 */
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, GitCompareArrows } from "lucide-react";
import type { InsightsAnalyticsReport, InsightsRow } from "@/lib/api/insights";
import { compareColor, isComparable, selectedEntities, toggleCompareKey, topCompareKeys, type CompareMetricSpec } from "@/lib/insights/compare";
import { formatCount, formatShare } from "@/lib/insights/format";
import { metricNumber } from "@/lib/insights/table";
import { COMPARE_MAX } from "@/lib/insights/url";
import { EvidenceChip } from "@/components/ui/crm";
import { CompareTray } from "./compare-tray";
import { RankedTable, type RankedColumn } from "./ranked-table";
import { Sparkline } from "./sparkline";

const REP_COLUMNS: readonly RankedColumn[] = [
  { key: "bookings", label: "Bookings", delta: true, title: "Bookings in the period; a split booking counts once for each rep" },
  { key: "split_bookings", label: "Split", title: "Of those, bookings shared with another rep" },
  { key: "binder", label: "Binder", bar: true, delta: true, title: "Binder, split bookings credited by share" },
  { key: "deposits", label: "Deposits", bar: true, title: "Deposits, split bookings credited by share" },
  { key: "average_binder", label: "Avg binder" },
  {
    key: "over_2k",
    label: "$2k+ / $4k+",
    title: "Bookings with a binder over $2,000 / over $4,000",
    render: (row) => `${formatCount(metricNumber(row, "over_2k"))} / ${formatCount(metricNumber(row, "over_4k"))}`,
    csv: { value: (row) => `${metricNumber(row, "over_2k") ?? ""} / ${metricNumber(row, "over_4k") ?? ""}` },
  },
  { key: "cancel_rate", label: "Cancel", title: "Share of the rep's bookings in the period now cancelled" },
  {
    key: "trend",
    label: "Binder trend",
    sortable: false,
    csv: false,
    render: (row) => <Sparkline data={(row.series ?? []).map((point) => ({ current: point.value }))} width={110} height={24} label={`${row.label}'s binder trend`} />,
  },
];

const RECEIVER_COLUMNS: readonly RankedColumn[] = [
  { key: "leads", label: "Leads received", bar: true, delta: true },
  { key: "booked", label: "Booked", title: "Of those leads, how many are booked as of now" },
  { key: "booking_rate", label: "Booking rate", delta: true },
  { key: "spend", label: "Spend", bar: true, title: "Lead cost of the leads this agent received" },
  { key: "cost_per_booking", label: "Cost per booked lead" },
];

const REP_COMPARE: readonly CompareMetricSpec[] = [
  { key: "bookings", label: "Bookings" },
  { key: "binder", label: "Binder" },
  { key: "deposits", label: "Deposits" },
  { key: "average_binder", label: "Average binder" },
  { key: "over_2k", label: "Over $2k" },
  { key: "over_4k", label: "Over $4k" },
  { key: "cancel_rate", label: "Cancellation rate" },
];

function activeNote(row: InsightsRow) {
  return row.notes?.active === false ? "inactive" : null;
}

export function TeamTab({ report, cmp, onCompare }: { report: InsightsAnalyticsReport; cmp: readonly string[]; onCompare: (keys: string[]) => void }) {
  const [showAllReceivers, setShowAllReceivers] = useState(false);
  const reps = report.team?.sales_agents ?? [];
  const receivers = report.team?.receiver_agents ?? [];
  const hasComparison = Boolean(report.comparison);
  const comparable = reps.filter(isComparable);
  const selected = selectedEntities(comparable, cmp);
  const selectedKeys = selected.map((row) => row.key);
  const colorFor = (key: string) => (selectedKeys.includes(key) ? compareColor(selectedKeys.indexOf(key)) : null);
  const attribution = report.data_quality?.receiver_attribution;
  const lowAttribution = typeof attribution === "number" && attribution < 0.9;
  const visibleReceivers = showAllReceivers ? receivers : receivers.filter((row) => (metricNumber(row, "leads") ?? 0) > 0 || (metricNumber(row, "booked") ?? 0) > 0);
  const hiddenReceivers = receivers.length - visibleReceivers.length;
  const splitNote = report.definitions?.split_credit ?? "A booking split between reps credits each rep its share of the binder and deposit.";
  return (
    <>
      <CompareTray
        entities={selected}
        colorFor={(key) => colorFor(key) ?? compareColor(0)}
        metrics={REP_COMPARE}
        seriesOptions={[
          { field: "value", label: "Binder", kind: "money" },
          { field: "secondary", label: "Bookings", kind: "count" },
        ]}
        bucket={report.series?.bucket ?? report.period.bucket}
        hasComparison={hasComparison}
        partialLast={report.period.includes_today}
        noun="reps"
        onRemove={(key) => onCompare(selectedKeys.filter((existing) => existing !== key))}
        onClear={() => onCompare([])}
      />
      <RankedTable
        testId="reps-table"
        title="Sales reps"
        subtitle="Bookings made in the period, by the rep who booked them. Tick up to four to compare."
        tools={
          <button type="button" className="crm-button crm-button--sm" onClick={() => onCompare(topCompareKeys(comparable, 3))} disabled={comparable.length < 2}>
            <GitCompareArrows aria-hidden="true" width={14} height={14} />
            Compare top 3
          </button>
        }
        rows={reps}
        columns={REP_COLUMNS}
        labelHeader="Rep"
        hasComparison={hasComparison}
        csvName="sales-reps"
        period={report.period}
        rowNote={activeNote}
        selection={{ keys: selectedKeys, onToggle: (key) => { const result = toggleCompareKey(selectedKeys, key); if (!result.refused) onCompare(result.keys); }, colorFor, canSelect: isComparable, max: COMPARE_MAX }}
        emptyText="No rep booked in this period."
        foot={
          <>
            <span>Split credit: {splitNote}</span>
            {selectedKeys.length >= COMPARE_MAX ? <span className="ia-note--amber">Up to {COMPARE_MAX} reps at a time: untick one to pick another.</span> : null}
          </>
        }
      />
      <RankedTable
        testId="receivers-table"
        title="Receiver agents"
        subtitle="Who took the period's leads, what those leads cost and how many booked."
        tools={
          lowAttribution ? (
            <EvidenceChip state="warn" title="Leads with no receiver recorded are counted under Unassigned, so per-agent numbers are incomplete.">
              {formatShare(attribution)} of leads have a receiver
            </EvidenceChip>
          ) : null
        }
        rows={visibleReceivers}
        columns={RECEIVER_COLUMNS}
        labelHeader="Agent"
        hasComparison={hasComparison}
        csvName="receiver-agents"
        period={report.period}
        rowNote={activeNote}
        emptyText="No leads were received in this period."
        foot={
          <>
            <Link className="crm-link" href="/outreach-desk">
              See call activity in the Outreach Desk
              <ArrowRight aria-hidden="true" width={14} height={14} />
            </Link>
            {hiddenReceivers > 0 || showAllReceivers ? (
              <button type="button" className="crm-button crm-button--quiet crm-button--sm" onClick={() => setShowAllReceivers((current) => !current)}>
                {showAllReceivers ? "Hide agents with no leads" : `Show ${hiddenReceivers} more with no leads`}
              </button>
            ) : null}
          </>
        }
      />
    </>
  );
}
