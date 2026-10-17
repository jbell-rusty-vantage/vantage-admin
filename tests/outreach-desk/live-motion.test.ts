import assert from "node:assert/strict";
import { test } from "node:test";
import { orderGoalRows } from "@/components/daily/team-call-goals";
import { firstGoalToast } from "@/components/outreach-desk/live-motion";
import type { SalesOutreachDailyCallGoalRow } from "@/lib/api/salesOutreach";

function memoryStorage(): Pick<Storage, "getItem" | "setItem"> {
  const map = new Map<string, string>();
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => void map.set(key, value) };
}

test("firstGoalToast: once per rep and day in one browser; a missing store still shows", () => {
  const storage = memoryStorage();
  assert.equal(firstGoalToast("a:2026-10-16", storage), true);
  assert.equal(firstGoalToast("a:2026-10-16", storage), false, "a second tab or a reload stays quiet");
  assert.equal(firstGoalToast("a:2026-10-17", storage), true, "the next day toasts again");
  assert.equal(firstGoalToast("a:2026-10-16", null), true);
});

test("orderGoalRows: furthest along first, reps without a goal last, ties by calls", () => {
  const row = (agent_id: string, progress: number | null, actual: number | null, goal_state = "goal") =>
    ({ agent_id, progress, actual_confirmed: actual, goal_state }) as unknown as SalesOutreachDailyCallGoalRow;
  const ordered = orderGoalRows([row("none", null, 4, "no_goal_today"), row("half", 0.5, 30), row("done", 1, 64), row("pending", null, null), row("half2", 0.5, 31)]);
  assert.deepEqual(ordered.map((r) => r.agent_id), ["done", "half2", "half", "pending", "none"]);
});
