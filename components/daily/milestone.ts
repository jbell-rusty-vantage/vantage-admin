import { DAILY_COPY, formatDailyOperationsClock } from "@/components/daily/daily-copy";
import type { DailyOperationsEventItem } from "@/lib/api/dailyOperationsLive";

/**
 * Outreach Desk goal milestones (`outreach.rep_goal_met`, `outreach.team_goal_met`; doc 16). The server does not
 * emit them yet, so every field is read defensively: a payload with only a kind and a time still renders.
 */
export const MILESTONE_REP_KIND = "outreach.rep_goal_met";
export const MILESTONE_TEAM_KIND = "outreach.team_goal_met";
/** A milestone stays pinned at the top of the feed (and first in Pulse Highlights) this long, then settles in time order. */
export const MILESTONE_PIN_MS = 30 * 60_000;
export const MILESTONE_TOAST_MS = 8_000;

export type MilestoneFact = {
  scope: "rep" | "team";
  eventId: string;
  occurredAt: string;
  /** When the goal was crossed (the call's start); falls back to when the fact was recorded. */
  reachedAt: string;
  agentId: string | null;
  agentName: string | null;
  actual: number | null;
  goal: number | null;
  /** The server may send a number (2) or its own words ("2nd rep at goal today"). */
  rank: number | string | null;
  teamActual: number | null;
  teamGoal: number | null;
  repsAtGoal: number | null;
  repsOnRoster: number | null;
};

export function isMilestoneEvent(event: Pick<DailyOperationsEventItem, "kind">): boolean {
  return event.kind === MILESTONE_REP_KIND || event.kind === MILESTONE_TEAM_KIND;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function pickNumber(sources: readonly Record<string, unknown>[], ...keys: string[]): number | null {
  for (const source of sources) {
    for (const key of keys) {
      const value = source[key];
      const number = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
      if (typeof number === "number" && Number.isFinite(number)) {
        return number;
      }
    }
  }
  return null;
}

function pickString(sources: readonly Record<string, unknown>[], ...keys: string[]): string | null {
  for (const source of sources) {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
  }
  return null;
}

/** The milestone behind an Event, or `null` for any other kind. Fields come from `card`, then the Event itself. */
export function readMilestone(event: DailyOperationsEventItem): MilestoneFact | null {
  if (!isMilestoneEvent(event)) {
    return null;
  }
  const sources = [record(event.card), record(event), record(event.links)];
  const rank = pickNumber(sources, "rank") ?? pickString(sources, "rank", "rank_label");
  return {
    scope: event.kind === MILESTONE_TEAM_KIND ? "team" : "rep",
    eventId: event.event_id,
    occurredAt: event.occurred_at,
    reachedAt: pickString(sources, "reached_at") ?? event.occurred_at,
    agentId: pickString(sources, "agent_id"),
    agentName: pickString(sources, "agent_name", "name_snapshot", "agent_name_snapshot", "customer_name"),
    actual: pickNumber(sources, "actual", "actual_confirmed"),
    goal: pickNumber(sources, "goal"),
    rank,
    teamActual: pickNumber(sources, "team_actual"),
    teamGoal: pickNumber(sources, "team_goal"),
    repsAtGoal: pickNumber(sources, "reps_at_goal"),
    repsOnRoster: pickNumber(sources, "reps_on_roster"),
  };
}

/** 1 -> "1st", 2 -> "2nd", 11 -> "11th". */
export function ordinal(value: number): string {
  const n = Math.abs(Math.trunc(value));
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) {
    return `${n}th`;
  }
  const suffix = ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${suffix}`;
}

/** "2nd rep at goal today" for a rep milestone; the server's own words win; team milestones have no rank line. */
export function milestoneRankLine(fact: MilestoneFact): string | null {
  if (fact.scope !== "rep" || fact.rank === null) {
    return null;
  }
  if (typeof fact.rank === "string") {
    return fact.rank;
  }
  return fact.rank >= 1 ? DAILY_COPY.milestone.rank(ordinal(fact.rank)) : null;
}

export function milestoneName(fact: MilestoneFact): string {
  return fact.agentName ?? DAILY_COPY.milestone.unknownRep;
}

export function milestoneHeadline(fact: MilestoneFact): string {
  return fact.scope === "team" ? DAILY_COPY.milestone.teamGoal : DAILY_COPY.milestone.repGoal(milestoneName(fact));
}

const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** "100 / 100 calls" (rep) or "400 / 400 outbound calls" (team); null when the payload carried neither number. */
export function milestoneProgressText(fact: MilestoneFact): string | null {
  const actual = fact.scope === "team" ? fact.teamActual : fact.actual;
  const goal = fact.scope === "team" ? fact.teamGoal : fact.goal;
  if (actual === null || goal === null) {
    return null;
  }
  const format = fact.scope === "team" ? DAILY_COPY.milestone.outboundOfGoal : DAILY_COPY.milestone.callsOfGoal;
  return format(integer.format(actual), integer.format(goal));
}

/** The Track is full: the fact says the goal was met. A known pair of numbers that disagrees is clamped to 0 to 1. */
export function milestoneProgress(fact: MilestoneFact): number {
  const actual = fact.scope === "team" ? fact.teamActual : fact.actual;
  const goal = fact.scope === "team" ? fact.teamGoal : fact.goal;
  if (actual === null || goal === null || goal <= 0) {
    return 1;
  }
  return Math.min(1, Math.max(0, actual / goal));
}

/** "3 of 4 reps at goal" for a team milestone. */
export function milestoneRepsLine(fact: MilestoneFact): string | null {
  if (fact.scope !== "team" || fact.repsAtGoal === null) {
    return null;
  }
  return DAILY_COPY.milestone.repsAtGoal(fact.repsAtGoal, fact.repsOnRoster);
}

export type MilestoneLink = { label: string; href: string };

/** View queue -> the rep's queue in the Outreach Desk; Team -> the Desk's Team view. */
export function milestoneLinks(fact: MilestoneFact): MilestoneLink[] {
  const team: MilestoneLink = { label: DAILY_COPY.milestone.team, href: "/outreach-desk?view=team" };
  if (fact.scope === "team" || !fact.agentId) {
    return [team];
  }
  return [
    { label: DAILY_COPY.milestone.viewQueue, href: `/outreach-desk?view=my&agent=${encodeURIComponent(fact.agentId)}` },
    team,
  ];
}

export function milestoneReachedClock(fact: MilestoneFact): string {
  return formatDailyOperationsClock(fact.reachedAt);
}

/** A milestone inside its 30-minute pin window. Needs the browser clock; without it nothing is pinned. */
export function isMilestonePinned(
  event: Pick<DailyOperationsEventItem, "kind" | "occurred_at">,
  nowMs: number | undefined,
): boolean {
  if (nowMs === undefined || !isMilestoneEvent(event)) {
    return false;
  }
  const at = Date.parse(event.occurred_at);
  return Number.isFinite(at) && nowMs - at >= -60_000 && nowMs - at < MILESTONE_PIN_MS;
}

/** Rep id -> the instant that rep reached today's goal, for the "Goal reached 2:41 PM" marks (newest wins). */
export function repGoalReachedAtById(events: readonly DailyOperationsEventItem[]): Map<string, string> {
  const marks = new Map<string, string>();
  for (const event of events) {
    const fact = event.kind === MILESTONE_REP_KIND ? readMilestone(event) : null;
    if (!fact?.agentId) {
      continue;
    }
    const current = marks.get(fact.agentId);
    if (!current || fact.reachedAt > current) {
      marks.set(fact.agentId, fact.reachedAt);
    }
  }
  return marks;
}
