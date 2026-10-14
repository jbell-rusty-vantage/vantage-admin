import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueueRow } from "../../components/outreach-desk/views/my-view";
import { AttentionRow } from "../../components/outreach-desk/views/team-view";
import { syntheticQueueRows } from "./fixtures/synthetic";

const snapshot = "2026-10-14T03:59:00Z"; // Oct 13, 11:59 PM New York
const afterMidnight = "2026-10-14T04:01:00Z";
function row() {
  const source = syntheticQueueRows("desk")[0]!;
  return {
    ...source,
    move_date: "2026-10-14",
    schedule_day: null,
    received_at: "2026-10-13T22:00:00Z",
    last_interaction_at: "2026-10-14T03:58:00Z",
    call: { ...source.call, status: "overdue" as const, oldest_actionable_due_at: "2026-10-14T03:29:00Z", due_at: "2026-10-14T03:29:00Z" },
    sms: { ...source.sms, status: "scheduled" as const, due_at: "2026-10-14T14:00:00Z" },
  };
}

test("My row's ticking move/interaction labels cross midnight without advancing snapshot age or SMS cadence", () => {
  const props = { row: row(), asOf: snapshot, selected: false, onSelect: () => {}, onMove: () => {} };
  const before = renderToStaticMarkup(createElement(QueueRow, { ...props, relativeNow: snapshot }));
  const after = renderToStaticMarkup(createElement(QueueRow, { ...props, relativeNow: afterMidnight }));
  assert.ok(before.includes("in 1 day"));
  assert.ok(after.includes(">Today</td>"));
  assert.ok(before.includes("1 min ago"));
  assert.ok(after.includes("3 min ago"));
  for (const html of [before, after]) {
    assert.ok(html.includes(">Day 1</td>"));
    assert.ok(html.includes("Due tomorrow"));
    assert.ok(html.includes("30 minutes overdue"));
    assert.ok(!html.includes("32 minutes overdue"));
  }
});

test("Team attention row advances interaction/move labels but holds server-proved overdue duration", () => {
  const props = { row: row(), asOf: snapshot, selected: false, onSelect: () => {} };
  const before = renderToStaticMarkup(createElement(AttentionRow, { ...props, relativeNow: snapshot }));
  const after = renderToStaticMarkup(createElement(AttentionRow, { ...props, relativeNow: afterMidnight }));
  assert.ok(before.includes("in 1 day"));
  assert.ok(after.includes(">Today</td>"));
  assert.ok(after.includes("3 min ago"));
  for (const html of [before, after]) {
    assert.ok(html.includes("30 minutes"));
    assert.ok(!html.includes("32 minutes"));
  }
});
