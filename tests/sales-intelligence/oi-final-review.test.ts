import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ActivityBlock } from "../../components/sales-intelligence/overview/activity-block";
import { deskUrlUpdate } from "../../components/sales-intelligence/data/url-state";
import { conversationsHref } from "../../components/sales-intelligence/outreach/outreach-page";
import { EvidenceLine } from "../../components/sales-intelligence/outreach/analysis/evidence-inline";
import { TranscriptLinkContext } from "../../components/sales-intelligence/outreach/analysis/transcript";
import { ACTIVITY_C } from "../../app/(dashboard)/sales-intelligence/dev/gallery/sections/overview-fixtures-c";

const OUTREACH = "66f000000000000000000001";
const CONVERSATION = "66f0000000000000000000c1";

test("Activity reads Partial capture only when the server reports partial (it sends complete or partial)", () => {
  const render = (status: string) => renderToStaticMarkup(createElement(ActivityBlock, {
    data: { ...ACTIVITY_C, status, coverage: ACTIVITY_C.coverage.map((day) => ({ ...day, coverage: status })) },
    value: { key: "today", from: null, through: null }, onChange: () => undefined,
  }));
  assert.doesNotMatch(render("complete"), /Partial capture/);
  assert.match(render("partial"), /Partial capture/);
});

test("moving a count drill to Closed drops the families Closed cannot serve and keeps the rest", () => {
  const drill = "view=all_outreach&priority=1&work=overdue_followup&followup_agent_id=66f000000000000000000aa1&relationship=followup&agent=66f000000000000000000aa1&snapshot_id=outreach%3Aabc&move_date_mode=future";
  const next = deskUrlUpdate(drill, { view: "closed" });
  for (const key of ["work", "followup_agent_id", "relationship", "agent", "snapshot_id"]) assert.equal(next.has(key), false, key);
  assert.equal(next.get("view"), "closed");
  assert.equal(next.has("priority"), false, "the active desk's Priority doesn't follow into Closed (Owner, 2026-09-30)");
  assert.equal(next.get("move_date_mode"), "future");
  assert.equal(deskUrlUpdate(drill, { view: "overview" }).get("priority"), "1", "other views keep it");
  // Other view changes keep the pin: it still names the snapshot the count was taken from.
  assert.equal(deskUrlUpdate(drill, { view: "attention" }).get("snapshot_id"), "outreach:abc");
});

test("Open in transcript on the page's Analysis tab links to the Conversations tab with the cited turns", () => {
  const href = conversationsHref(OUTREACH, "/sales-intelligence?view=all_outreach", CONVERSATION, ["4", "5"]);
  const url = new URL(href, "https://local.example");
  assert.equal(url.pathname, `/sales-intelligence/outreach/${OUTREACH}`);
  assert.equal(url.searchParams.get("tab"), "conversations");
  assert.equal(url.searchParams.get("conversation_id"), CONVERSATION);
  assert.equal(url.searchParams.get("sid"), "4,5");
  assert.equal(url.searchParams.get("si_return"), "/sales-intelligence?view=all_outreach");

  const item = { id: "e1", kind: "quote", quote: "We move on the 2nd", conversation_id: CONVERSATION, segment_ids: [4, 5] };
  const linked = renderToStaticMarkup(createElement(TranscriptLinkContext.Provider, { value: (id: string, sids: readonly string[]) => conversationsHref(OUTREACH, null, id, sids) },
    createElement(EvidenceLine, { item, asOf: "2026-09-29T12:00:00Z" })));
  assert.match(linked, new RegExp(`<a[^>]+href="/sales-intelligence/outreach/${OUTREACH}\\?tab=conversations&amp;conversation_id=${CONVERSATION}&amp;sid=4%2C5"`));
  // Without the page's link (a surface that mounts Conversations itself) it stays an in-place button.
  const inPlace = renderToStaticMarkup(createElement(EvidenceLine, { item, asOf: "2026-09-29T12:00:00Z" }));
  assert.match(inPlace, /<button[^>]+class="si-evidence__open/);
});
