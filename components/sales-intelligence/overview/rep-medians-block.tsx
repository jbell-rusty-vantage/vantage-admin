"use client";
/**
 * UI2-OVERVIEW (UI-2 §6, E23; A08): the rep's Overview replaces the Reps block with a two-column table, **You** next to
 * **Team median**, one row per metric of UI-1 §4.2 block 3 (the Reps columns, same labels and formatting). `You` is
 * `reps[0]` (the server returns only the rep's own row); `Team median` is `team_medians.{metric}`, `—` when null, with
 * `Team medians appear when enough reps have activity.` whenever one is null (the server needs ≥ 4 contributing reps,
 * V-T3 M9) and `Team of {n} reps` from `team_medians.reps`. No other rep's name or value appears (C11), and there are no
 * Unmapped / Unassigned rows and no links.
 */
import { useId } from "react";
import type { Overview, OverviewRep } from "@/lib/api/salesIntelligence";
import { copy } from "../sales-intelligence-copy";
import { SkeletonBlock, SkeletonLines } from "../primitives";
import { DASH, count, minutes, money, percent } from "./format";
import { REP_COLUMNS, type RepColumn } from "./reps-block";

const t = copy.ui1.overview.reps;
const o = copy.ui2.overview;

type Metric = Exclude<RepColumn, "rep">;
export const REP_METRICS = REP_COLUMNS.filter((column): column is Metric => column !== "rep");

/** The `team_medians` key behind each metric. */
export const MEDIAN_KEY: Record<Metric, string> = {
  open: "open",
  overdue: "overdue",
  attempts: "outbound_attempts",
  conversations: "human_conversations",
  talk: "talk_minutes",
  attemptRate: "attempt_conversation_rate",
  bookingRate: "booking_rate",
  spend: "spend",
  costPerBooking: "cost_per_booking",
};

/** The rep's own value for a metric (the Reps table's fields). */
export function repValue(rep: OverviewRep, metric: Metric): number | null {
  switch (metric) {
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

/** Formats a value the way the Reps table does (`—` for null). */
export function metricText(metric: Metric, value: number | null | undefined): string {
  switch (metric) {
    case "talk": return value == null ? DASH : t.talkMinutes(minutes(value));
    case "attemptRate":
    case "bookingRate": return percent(value);
    case "spend":
    case "costPerBooking": return money(value);
    default: return count(value);
  }
}

export type RepMedianRow = { metric: Metric; label: string; you: string; median: string; medianNull: boolean };

/** The table's rows and notes from one Overview read (pure; tests read it). */
export function repMedianRows(data: Overview | null): { rows: RepMedianRow[]; mediansNote: boolean; teamSize: number | null; noActivity: boolean } {
  const me = data?.reps?.[0] ?? null;
  const medians = data?.team_medians ?? null;
  const rows = REP_METRICS.map((metric) => {
    const median = medians?.[MEDIAN_KEY[metric]];
    return {
      metric,
      label: t.columns[metric],
      you: me ? metricText(metric, repValue(me, metric)) : DASH,
      median: metricText(metric, median ?? null),
      medianNull: median == null,
    };
  });
  const size = medians?.reps;
  return { rows, mediansNote: rows.some((row) => row.medianNull), teamSize: typeof size === "number" ? size : null, noActivity: !!data && !me };
}

export function RepMediansBlock({ data }: { data: Overview | null }) {
  const headingId = useId();
  const { rows, mediansNote, teamSize, noActivity } = repMedianRows(data);
  return (
    <section className="si-ovblock si-ovmedians" aria-labelledby={headingId} data-overview="you-and-team">
      <h2 id={headingId} className="si-heading si-heading--2">{o.title}</h2>
      {teamSize != null && <p className="si-ovmedians__team" data-team-size={teamSize}>{o.teamSize(teamSize)}</p>}
      {noActivity && <p className="si-ovempty" data-empty="you">{o.noActivity}</p>}
      <table className="si-ovmedians__table">
        <thead>
          <tr>
            <th scope="col">{o.metric}</th>
            <th scope="col">{o.you}</th>
            <th scope="col">{o.teamMedian}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.metric} data-metric={row.metric}>
              <th scope="row">{row.label}</th>
              <td data-col="you">{row.you}</td>
              <td data-col="median" data-null={row.medianNull ? "1" : undefined}>{row.median}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {mediansNote && <p className="si-ovmedians__note" data-medians-note>{o.mediansNote}</p>}
    </section>
  );
}

export function RepMediansBlockSkeleton() {
  return (
    <section className="si-ovblock si-ovmedians is-skeleton" aria-hidden>
      <SkeletonLines lines={1} widths={[140]} />
      {[0, 1, 2, 3, 4].map((i) => <SkeletonBlock key={i} height={36} />)}
    </section>
  );
}
RepMediansBlock.Skeleton = RepMediansBlockSkeleton;
