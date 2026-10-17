"use client";

import Link from "next/link";
import { CheckCircle2, Phone } from "lucide-react";
import { AnimatedNumber } from "@/components/daily/animated-number";
import { useTeam } from "@/components/outreach-desk/data/use-desk-reads";
import { useDeskLive } from "@/components/outreach-desk/data/use-desk-live";
import { fillPercent, percentText } from "@/components/outreach-desk/lib/format";
import { useChangeFlash } from "@/components/outreach-desk/live-motion";
import { CrmCard } from "@/components/ui/crm";
import type { SalesOutreachDailyCallGoalRow } from "@/lib/api/salesOutreach";

/** Furthest along first; reps without a goal today sit at the end. Presentation only, the server's numbers are untouched. */
export function orderGoalRows(rows: readonly SalesOutreachDailyCallGoalRow[]): SalesOutreachDailyCallGoalRow[] {
  const rank = (row: SalesOutreachDailyCallGoalRow) => (row.goal_state === "goal" ? (row.progress ?? -1) : -2);
  return [...rows].sort((a, b) => rank(b) - rank(a) || (b.actual_confirmed ?? 0) - (a.actual_confirmed ?? 0));
}

function Bar({ progress, done }: { progress: number | null; done: boolean }) {
  return (
    <span className="relative block h-2 overflow-hidden rounded-full" style={{ background: "var(--crm-track)" }} aria-hidden="true">
      <span
        className="daily-bar absolute inset-y-0 left-0 rounded-full"
        style={{ width: `${fillPercent(progress)}%`, background: done ? "var(--crm-green-bar)" : "var(--crm-blue)" }}
      />
    </span>
  );
}

function RepGoal({ row }: { row: SalesOutreachDailyCallGoalRow }) {
  const done = row.goal_reached === true;
  const flash = useChangeFlash(`${row.actual_confirmed}|${row.goal_reached}`);
  const name = row.agent_name ?? "Unknown rep";
  return (
    <li className={flash ? "daily-tile-flash rounded-lg" : "rounded-lg"} data-agent={row.agent_id}>
      <Link href={`/outreach-desk?view=my&agent=${encodeURIComponent(row.agent_id)}`} className="block rounded-lg px-2 py-1.5 hover:bg-[var(--crm-blue-50)]">
        <span className="flex items-baseline justify-between gap-2 text-sm">
          <span className="flex min-w-0 items-center gap-1 truncate font-semibold text-navy">
            {done ? <CheckCircle2 aria-label="Goal reached" width={14} height={14} color="var(--crm-green)" className="shrink-0" /> : null}
            {name}
          </span>
          <span className="shrink-0 tabular-nums text-[var(--crm-muted)]">
            {row.goal_state === "goal" ? (
              <>
                <AnimatedNumber value={row.actual_confirmed} fallback="…" className="font-bold text-[var(--crm-text)]" /> / {row.goal ?? "—"}
              </>
            ) : (
              (row.goal_label ?? "No goal today")
            )}
          </span>
        </span>
        {row.goal_state === "goal" ? <Bar progress={row.progress} done={done} /> : null}
      </Link>
    </li>
  );
}

/**
 * The Outreach Desk's call goals on Daily Operations: the team total first, then each rep's bar. Live over the desk's
 * own stream (a call that moves a count invalidates `GET /team`); a read the viewer cannot make hides the card.
 */
export function TeamCallGoals() {
  useDeskLive(true);
  const team = useTeam(null, true);
  const data = team.data;
  const goals = data?.goals ?? null;
  const rows = data?.daily_call_goals ?? null;
  const teamFlash = useChangeFlash(goals?.outbound_calls.actual);
  if (!data || !data.goal_metrics_enabled || !goals || !rows) {
    return null;
  }
  const outbound = goals.outbound_calls;
  const pct = percentText(outbound.progress);
  return (
    <CrmCard
      title="Call goals today"
      subtitle={`${goals.reps_at_goal.count} of ${goals.reps_at_goal.of} reps at goal`}
      tools={
        <Link href="/outreach-desk?view=team" className="crm-button crm-button--sm">
          Open the desk
        </Link>
      }
      testId="daily-call-goals"
    >
      <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className={teamFlash ? "daily-tile-flash flex flex-col gap-2 rounded-xl" : "flex flex-col gap-2 rounded-xl"}>
          <p className="m-0 flex items-center gap-2 text-3xl font-extrabold leading-none text-[var(--crm-text)]">
            <Phone aria-hidden="true" width={22} height={22} color="var(--crm-blue)" />
            <AnimatedNumber value={outbound.actual} fallback="…" />
            <span className="text-lg font-bold text-[var(--crm-muted)]">/ {outbound.goal}</span>
          </p>
          <Bar progress={outbound.progress} done={outbound.goal > 0 && (outbound.actual ?? 0) >= outbound.goal} />
          <p className="crm-text-muted crm-small m-0">
            {goals.count_scope_label ?? "Outbound calls"}
            {pct ? ` · ${pct} of goal` : ""}
          </p>
        </div>
        {rows.length === 0 ? (
          <p className="crm-text-muted crm-small m-0">No reps on today&apos;s roster.</p>
        ) : (
          <ul className="m-0 grid list-none gap-x-4 gap-y-1 p-0 sm:grid-cols-2" aria-label="Rep call goals">
            {orderGoalRows(rows).map((row) => (
              <RepGoal key={row.agent_id} row={row} />
            ))}
          </ul>
        )}
      </div>
    </CrmCard>
  );
}
