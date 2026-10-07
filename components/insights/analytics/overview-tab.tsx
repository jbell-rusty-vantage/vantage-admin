"use client";
/**
 * Overview (doc 09 tab 1): the scoreboard. Eight scorecards, a quieter row of four, the trend, what moved, the
 * leaders and data-quality chips.
 */
import { CircleCheck, TriangleAlert } from "lucide-react";
import type { InsightsAnalyticsReport, InsightsMover } from "@/lib/api/insights";
import { formatCount, formatMetricValue, formatShare } from "@/lib/insights/format";
import { definitionFor, PRIMARY_SCORECARDS, SECONDARY_SCORECARDS } from "@/lib/insights/scorecards";
import { scorecardSparkline } from "@/lib/insights/series";
import { leaderboard, type LeaderEntry } from "@/lib/insights/table";
import { CrmCard, EvidenceChip, Notice, cx } from "@/components/ui/crm";
import { RankCell } from "./delta-chip";
import { Scorecard } from "./scorecard";
import { TrendChart } from "./trend-chart";

function DataQuality({ report }: { report: InsightsAnalyticsReport }) {
  const quality = report.data_quality;
  const chips: Array<{ key: string; text: string; title: string }> = [];
  if (quality?.unpriced_leads > 0) chips.push({ key: "unpriced", text: `${formatCount(quality.unpriced_leads)} leads with no lead cost`, title: "Their feed has no lead cost for that day in Setup › Lead sources, so they count as $0." });
  if (quality?.unmapped_leads > 0) chips.push({ key: "unmapped", text: `${formatCount(quality.unmapped_leads)} leads with no feed`, title: "No source feed matched these leads, so no lead cost applies." });
  if (typeof quality?.receiver_attribution === "number" && quality.receiver_attribution < 0.9) {
    chips.push({ key: "receiver", text: `${formatShare(quality.receiver_attribution)} of leads have a receiver`, title: "Below 90 %: per-agent lead numbers on the Team tab are incomplete." });
  }
  if (quality?.unattributed_bookings > 0) chips.push({ key: "unattributed", text: `${formatCount(quality.unattributed_bookings)} bookings with no known source`, title: "These bookings could not be traced to a source." });
  return (
    <div className="ia-chips" aria-label="Data quality" role="group">
      {chips.length === 0 ? (
        <EvidenceChip state="ok" title="Every lead is priced and mapped, and receivers are recorded for most leads.">
          Data complete
        </EvidenceChip>
      ) : (
        chips.map((chip) => (
          <EvidenceChip key={chip.key} state="warn" title={chip.title}>
            {chip.text}
          </EvidenceChip>
        ))
      )}
    </div>
  );
}

function MoverList({ movers, direction }: { movers: readonly InsightsMover[]; direction: "gain" | "drop" }) {
  const list = movers.filter((mover) => mover.direction === direction);
  if (list.length === 0) return <p className="ia-empty">{direction === "gain" ? "No notable gains." : "No notable drops."}</p>;
  return (
    <ul className="ia-movers">
      {list.map((mover) => (
        <li key={`${mover.dimension}:${mover.key}:${mover.metric}`} className={cx("ia-mover", `ia-mover--${mover.tone}`)}>
          <span className="ia-mover__glyph" aria-hidden="true">
            •
          </span>
          <span>{mover.sentence}</span>
        </li>
      ))}
    </ul>
  );
}

function Leaders({ title, subtitle, entries, kind, hasComparison, emptyText }: { title: string; subtitle: string; entries: LeaderEntry[]; kind: "count" | "money"; hasComparison: boolean; emptyText: string }) {
  const max = entries.reduce((top, entry) => Math.max(top, entry.value), 0);
  return (
    <CrmCard className="ia-card" title={title} subtitle={subtitle}>
      <div className="ia-card__body">
        {entries.length === 0 ? (
          <p className="ia-empty">{emptyText}</p>
        ) : (
          <ol className="ia-leaders">
            {entries.map((entry) => (
              <li key={entry.row.key} className="ia-leader">
                <RankCell row={{ rank: entry.rank, rank_change: entry.rankChange, is_new: entry.rankChange === null }} hasComparison={hasComparison} />
                <span className="ia-leader__name" title={entry.row.label}>
                  {entry.row.label}
                </span>
                <span className="ia-leader__value">{formatMetricValue(entry.value, kind)}</span>
                <span className="ia-leader__bar ia-bar" aria-hidden="true">
                  <span className="ia-bar__fill" style={{ width: `${max > 0 ? ((entry.value / max) * 100).toFixed(1) : 0}%` }} />
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </CrmCard>
  );
}

export function OverviewTab({ report }: { report: InsightsAnalyticsReport }) {
  const hasComparison = Boolean(report.comparison);
  const scorecards = report.scorecards ?? ({} as InsightsAnalyticsReport["scorecards"]);
  const nothing = (scorecards.leads?.value ?? 0) === 0 && (scorecards.bookings?.value ?? 0) === 0;
  return (
    <>
      <DataQuality report={report} />
      {nothing ? (
        <Notice icon={TriangleAlert} tone="amber" title="No leads or bookings in this period">
          Pick a longer period, or clear the source filter.
        </Notice>
      ) : null}
      <div className="ia-scoregrid" data-testid="primary-scorecards">
        {PRIMARY_SCORECARDS.map((spec) => (
          <Scorecard key={spec.key} label={spec.label} metric={scorecards[spec.key]} definition={definitionFor(spec, report.definitions)} sparkline={scorecardSparkline(report.series, spec.key)} testId={`scorecard-${spec.key}`} />
        ))}
      </div>
      <div className="ia-scoregrid ia-scoregrid--quiet">
        {SECONDARY_SCORECARDS.map((spec) => (
          <Scorecard key={spec.key} quiet label={spec.label} metric={scorecards[spec.key]} definition={definitionFor(spec, report.definitions)} />
        ))}
      </div>
      <TrendChart report={report} metrics={["leads", "bookings", "spend", "binder"]} title="How the period moved" />
      <div className="ia-grid-2">
        <CrmCard className="ia-card" title="What moved" subtitle={hasComparison ? "The biggest gains and drops across sources and reps against the comparison." : "Pick a comparison to see what moved."}>
          <div className="ia-card__body" style={{ display: "grid", gap: 14 }}>
            {hasComparison ? (
              <>
                <div>
                  <h3 className="ia-mix__title" style={{ marginBottom: 8 }}>
                    <CircleCheck aria-hidden="true" width={14} height={14} style={{ display: "inline", verticalAlign: "-2px", marginRight: 6, color: "var(--crm-green)" }} />
                    Gains
                  </h3>
                  <MoverList movers={report.movers ?? []} direction="gain" />
                </div>
                <div>
                  <h3 className="ia-mix__title" style={{ marginBottom: 8 }}>
                    <TriangleAlert aria-hidden="true" width={14} height={14} style={{ display: "inline", verticalAlign: "-2px", marginRight: 6, color: "var(--crm-red)" }} />
                    Drops
                  </h3>
                  <MoverList movers={report.movers ?? []} direction="drop" />
                </div>
              </>
            ) : (
              <p className="ia-empty">No comparison is selected.</p>
            )}
          </div>
        </CrmCard>
        <div style={{ display: "grid", gap: "var(--crm-gap)", minWidth: 0 }}>
          <Leaders
            title="Top sources by bookings"
            subtitle="Bookings from leads that arrived in the period."
            entries={leaderboard(report.sources?.companies ?? [], "booked", 5, hasComparison)}
            kind="count"
            hasComparison={hasComparison}
            emptyText="No source has a booking from this period's leads yet."
          />
          <Leaders
            title="Top reps by binder"
            subtitle="Binder of bookings made in the period, split bookings credited by share."
            entries={leaderboard(report.team?.sales_agents ?? [], "binder", 5, hasComparison)}
            kind="money"
            hasComparison={hasComparison}
            emptyText="No bookings by a rep in this period."
          />
        </div>
      </div>
    </>
  );
}

