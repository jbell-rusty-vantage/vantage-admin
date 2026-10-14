import type { SalesOutreachPoolDto, SalesOutreachPoolSummaryDto } from "@/lib/api/salesOutreach";
import { absoluteTime, countText, relativeDay } from "../lib/format";

export function poolStateText(pool: SalesOutreachPoolDto): string {
  switch (pool.state) {
    case "completed": return "Shared call completed";
    case "coverage_pending": return "Call coverage pending";
    case "blocked": return "Contact restricted";
    case "waived": return "No shared call required today";
    case "scheduled": return "Shared call scheduled";
    case "due": return "1 shared call due";
  }
}

export function PoolStatus({ pool, asOf }: { pool: SalesOutreachPoolDto; asOf: string }) {
  return (
    <div data-testid="pool-status">
      <span className={pool.state === "completed" ? "od-text-green" : pool.state === "due" || pool.state === "coverage_pending" ? "od-text-amber" : "od-text-muted"}>{poolStateText(pool)}</span>
      {pool.state === "completed" ? (
        <span className="od-cell__sub" title={absoluteTime(pool.completed_at)}>
          {pool.completed_by_agent_name ?? "Verified caller"}{pool.completed_at ? ` · ${relativeDay(pool.completed_at, asOf)}` : ""}
        </span>
      ) : pool.due_at ? <span className="od-cell__sub" title={absoluteTime(pool.due_at)}>Due {relativeDay(pool.due_at, asOf)}</span> : null}
    </div>
  );
}

export function PoolWorkload({ summary, assigned }: { summary?: SalesOutreachPoolSummaryDto; assigned: boolean }) {
  if (!summary) return null;
  return (
    <section className="od-card od-pool-workload" aria-label="Pool workload" data-testid="pool-workload">
      <div>
        <h2 className="od-card__title">Shared Pool today</h2>
        <p>{countText(summary.team_due)} due · {countText(summary.team_completed)} completed for the team</p>
      </div>
      {assigned ? (
        <div>
          <p><strong>Assigned Pool Leads:</strong> {countText(summary.assigned_due)} due · {countText(summary.assigned_completed)} fulfilled</p>
          <p><strong>Actual Pool outbound calls:</strong> {countText(summary.actual_outbound)}</p>
        </div>
      ) : null}
      <p className="od-text-muted">Any eligible Rep can fulfill the shared call. Outbound goal credit belongs to the actual caller.</p>
    </section>
  );
}
