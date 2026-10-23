import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TeamCallGoals } from "../components/daily/team-call-goals";
import { LeadSpendPanel } from "../components/daily/lead-spend-panel";
import { queryKeys } from "../lib/query/keys";

test("cleared core access hides already-cached goals and spend instead of rendering revoked records", () => {
  const queryClient = new QueryClient();
  queryClient.setQueryData(["daily-operations", "goal-summary"], {
    goal_metrics_enabled: true,
    goals: { outbound_calls: { actual: 42, goal: 100, progress: 0.42 }, reps_at_goal: { count: 0, of: 1 } },
    daily_call_goals: [],
  });
  queryClient.setQueryData([...queryKeys.insights.dailyLeadSpend(), "daily-operations-summary"], { spend: { today: 999 }, leads: { today: 10 } });
  // No authorized core view remains after a 401/403. Hooks still see their old query cache.
  for (const component of [TeamCallGoals, LeadSpendPanel]) {
    const markup = renderToStaticMarkup(createElement(QueryClientProvider, { client: queryClient }, createElement(component)));
    assert.equal(markup, "");
  }
  queryClient.clear();
});
