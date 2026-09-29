"use client";
/**
 * UI1-DESK (UI-1 §3.1, final spec §6, UX5): five tiles from `data.metrics`, computed at publish, with
 * `As of {metrics.as_of}`. Needs Attention and All Outreach only; every tile opens All Outreach or Closed (UX-C1). Each tile is a button that applies its filter
 * through the URL state and scrolls to the list. `metrics` absent (a snapshot without it) → every tile `—` with
 * `Not available in this snapshot` (in the tile's title and as visible text, never hover-only).
 *
 * The windows (`last 7 days`) start at the list response's `as_of` minus seven days (`windowFrom`), never the
 * browser clock, so the rail recognises them as `last 7d`.
 */
import type { DeskMetrics } from "@/lib/api/salesIntelligence";
import type { WorkloadCount } from "@/lib/api/salesIntelligenceOverview";
import { readTeamOverview } from "@/lib/api/salesIntelligenceOverview";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import type { DeskUrlPatch } from "../data/url-state";
import { useAttentionList } from "../data/use-attention";
import { teamOverviewKey } from "../data/use-team-overview";
import { workloadHref } from "../overview/links";
import { useReportAsOf } from "../data/live";
import type { AttentionParams } from "../data/requests";
import { TimeText } from "../primitives";
import { RECEIVED_WINDOWS, CLOSED_WINDOWS, windowFrom } from "../rail";
import { copy } from "../sales-intelligence-copy";
import { cx } from "../lib/format";

const m = copy.ui1.desk.metrics;

export type MetricTileId = "leads7d" | "notCalled" | "overdue" | "awaiting" | "booked7d";
export type MetricTile = { id: MetricTileId; label: string; value: number | null; secondary: string | null; patch: DeskUrlPatch; href?: string };

/** The five tiles in order, with the filter each one applies (UI-1 §3.1 table). */
export function metricTiles(metrics: DeskMetrics | null | undefined, asOf: string | null, overdue?: WorkloadCount | null): MetricTile[] {
  const since = asOf ? windowFrom(asOf, RECEIVED_WINDOWS["7d"]) : null;
  const closedSince = asOf ? windowFrom(asOf, CLOSED_WINDOWS["7d"]) : null;
  const median = metrics?.booked_7d_median_days;
  return [
    { id: "leads7d", label: m.leads7d, value: metrics?.leads_received_7d ?? null, secondary: null,
      patch: { view: "all_outreach", received_from: since, received_to: null } },
    { id: "notCalled", label: m.notCalled, value: metrics?.not_called_yet ?? null, secondary: null, patch: { view: "all_outreach", band: ["2"] } },
    { id: "overdue", label: m.overdue, value: overdue?.count ?? null, secondary: null, patch: { view: "all_outreach", work: ["overdue_followup"], band: [] }, href: overdue ? workloadHref(overdue) : undefined },
    { id: "awaiting", label: m.awaiting, value: metrics?.awaiting_assessment ?? null, secondary: null, patch: { newer_call: true } },
    { id: "booked7d", label: m.booked7d, value: metrics?.booked_7d ?? null, secondary: median != null ? m.median(median) : null,
      patch: { view: "closed", priority: [], outcome: ["booked"], closed_from: closedSince, closed_to: null } },
  ];
}

export function MetricsStripView({ metrics, asOf, onApply, overdue }: { metrics: DeskMetrics | null; asOf: string | null; onApply?: (tile: MetricTile) => void; overdue?: WorkloadCount | null }) {
  const tiles = metricTiles(metrics, asOf, overdue);
  const unavailable = !metrics;
  return (
    <section className={cx("si-metrics", unavailable && "is-unavailable")} aria-label={m.label} data-metrics={unavailable ? "absent" : "present"}>
      <ul className="si-metrics__tiles">
        {tiles.map((tile) => {
          const value = tile.value == null ? m.none : tile.value.toLocaleString("en-US");
          const body = (
            <>
              <span className="si-metrics__label">{tile.label}</span>
              <span className="si-metrics__value">{value}</span>
              {tile.secondary && <span className="si-metrics__secondary">{tile.secondary}</span>}
            </>
          );
          return (
            <li key={tile.id} className="si-metrics__item">
              {tile.href && !unavailable ? (
                <Link className="si-metrics__tile" data-tile={tile.id} href={tile.href} aria-label={m.tileLabel(tile.label, value)}>{body}</Link>
              ) : unavailable || !onApply || (tile.id === "overdue" && !overdue) ? (
                <span className="si-metrics__tile is-static" data-tile={tile.id} title={unavailable || (tile.id === "overdue" && !overdue) ? m.unavailable : undefined}>{body}</span>
              ) : (
                <button type="button" className="si-metrics__tile" data-tile={tile.id} aria-label={m.tileLabel(tile.label, [value, tile.secondary].filter(Boolean).join(", "))} onClick={() => onApply(tile)}>
                  {body}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <p className="si-metrics__asof si-text--sm si-text--subtle">
        {unavailable ? m.unavailable : <TimeText t={metrics.as_of} asOf={asOf} mode="exact" prefix={m.asOf} />}
      </p>
    </section>
  );
}

/** Reads the list's first page (the same query as the list, so no extra request). */
export function MetricsStrip({ params, onApply }: { params: AttentionParams; onApply: (tile: MetricTile) => void }) {
  const list = useAttentionList(params);
  const priority = params.priority ?? [];
  const team = useQuery({ queryKey: teamOverviewKey(priority), queryFn: ({ signal }) => readTeamOverview(priority, signal), retry: false });
  const overdue = team.data?.data.status === "ready" ? team.data.data.attention?.records_with_overdue ?? null : null;
  useReportAsOf(list.asOf);
  return <MetricsStripView metrics={list.metrics} asOf={list.asOf} onApply={onApply} overdue={overdue} />;
}

function MetricsStripSkeleton() {
  return (
    <div className="si-metrics is-skeleton" aria-hidden>
      <ul className="si-metrics__tiles">
        {Array.from({ length: 5 }, (_, i) => (
          <li key={i} className="si-metrics__item">
            <span className="si-metrics__tile is-static">
              <span className="si-skeleton si-skeleton--line" style={{ width: "70%" }} />
              <span className="si-skeleton si-metrics__skvalue" />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

MetricsStrip.Skeleton = MetricsStripSkeleton;
MetricsStripView.Skeleton = MetricsStripSkeleton;
