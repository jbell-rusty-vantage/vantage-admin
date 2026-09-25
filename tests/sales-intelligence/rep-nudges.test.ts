import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { outreachReadSchema, timelineV2Schema, type OutreachRead } from "../../lib/api/salesIntelligence";
import { siKeys } from "../../components/sales-intelligence/data/query-keys";
import { WorkTab } from "../../components/sales-intelligence/outreach";
import { OwnerMessagesView, ownerMessageItems } from "../../components/sales-intelligence/rep/owner-messages";
import { ViewerProvider, viewerFromSession, OWNER_VIEWER, type Viewer } from "../../components/sales-intelligence/rep/viewer";
import { copy } from "../../components/sales-intelligence/sales-intelligence-copy";
import { formatExactFull } from "../../components/sales-intelligence/lib/time";
import { Timeline } from "../../components/sales-intelligence/timeline";
import { findContractsDir, fixtureTest, ifFixtures } from "./contracts-dir";

// UI2-NUDGES (UI-2 §5; UI2-A10): the rep's read-only `Messages from the Owner` on the Work tab, from the detail read's
// `nudges.items[]` (CF12, S12-REPNUDGE). No DOM.

const CONTRACTS = findContractsDir() ?? "";
const read = (rel: string) => JSON.parse(fs.readFileSync(path.join(CONTRACTS, rel), "utf8"));
const decode = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const text = (html: string) => decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ");
const n = copy.ui2.nudges;

const DANA = viewerFromSession({ role: "rep", agent_id: "6ab5ab0d72ee2eb383d940a7" });
const MARCUS = viewerFromSession({ role: "rep", agent_id: "6ab5ab0d72ee2eb383d940a8" });
const dana = ifFixtures(() => outreachReadSchema.parse(read("S12/rep-outreach-nudges__t3-promise-across-b.json")));
const marcus = ifFixtures(() => outreachReadSchema.parse(read("S12/rep-marcus-outreach-nudges__t3-promise-across-b.json")));
const owner = ifFixtures(() => outreachReadSchema.parse(read("S12/owner-outreach-nudges__t3-promise-across-b.json")));

function renderWork(viewer: Viewer, detail: OutreachRead) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(siKeys.outreach(detail.data.outreach.id), detail);
  const el = createElement(QueryClientProvider, { client }, createElement(ViewerProvider, { viewer } as Parameters<typeof ViewerProvider>[0], createElement(WorkTab, { id: detail.data.outreach.id, returnTo: "/x" }) as ReactElement));
  return decode(renderToStaticMarkup(el));
}
const block = (html: string) => {
  const at = html.indexOf("data-owner-messages=");
  return at < 0 ? "" : html.slice(html.lastIndexOf("<section", at), html.indexOf("</section>", at) + 10);
};

fixtureTest("A10: Dana's Work tab shows her message under `Messages from the Owner` with `Also sent to your RingCentral`", () => {
  const nudge = dana.data.nudges!.items[0]!;
  assert.equal(dana.data.nudges!.items.length, 1);
  const html = renderWork(DANA, dana);
  const b = block(html);
  assert.ok(b, "the block renders");
  assert.ok(html.includes('data-region="work-owner-messages"'));
  const t = text(b);
  assert.ok(t.includes(n.title) && t.includes(n.alsoSent));
  assert.ok(t.includes(nudge.body_as_sent));
  // The Owner is the other party: a left-side bubble with the `Owner` author, and the exact time on the bubble.
  assert.match(b, /class="si-bubble si-bubble--rep" data-side="rep"><span class="si-sr">Owner: <\/span>/);
  const exact = formatExactFull(nudge.sent_at!);
  assert.ok(b.includes(`title="${exact}"`) && b.includes(`aria-label="${exact}"`), "exact time on title + aria-label");
  assert.ok(b.includes('class="si-daydivider"'), "day divider");
});

fixtureTest("A10: another rep's message never shows in Dana's render (and Dana's never in Marcus's)", () => {
  const marcusBody = marcus.data.nudges!.items[0]!.body_as_sent;
  const danaBody = dana.data.nudges!.items[0]!.body_as_sent;
  assert.ok(!renderWork(DANA, dana).includes(marcusBody));
  const m = renderWork(MARCUS, marcus);
  assert.ok(text(block(m)).includes(marcusBody));
  assert.ok(!m.includes(danaBody));
  // The Owner's read carries all three; the rep's read carries only the rep's (the server filters; nothing is filtered here).
  assert.equal(owner.data.nudges!.items.length, 3);
});

fixtureTest("A10: no composer, no delivery indicator, no Retry / Check status in the rep's block", () => {
  const b = block(renderWork(DANA, dana));
  for (const absent of ["<textarea", "si-composer", "si-delivery", "Retry", "Check status", copy.ui1.chat.you, "si-bubble--owner"]) {
    assert.ok(!b.includes(absent), absent);
  }
  assert.ok(!/<button/.test(b), "no control at all");
});

fixtureTest("A10: the block is absent with no items", () => {
  const empty: OutreachRead = { ...dana, data: { ...dana.data, nudges: { items: [], next_cursor: null } } };
  const html = renderWork(DANA, empty);
  assert.ok(!html.includes("data-owner-messages="));
  assert.ok(!text(html).includes(n.title));
  assert.equal(renderToStaticMarkup(createElement(OwnerMessagesView, { nudges: [], asOf: dana.as_of })), "");
});

fixtureTest("A10: several messages across two days: oldest first, one divider per ET day", () => {
  const base = owner.data.nudges!.items[0]!;
  const items = [
    { ...base, id: "a", body_as_sent: "Second day", sent_at: "2026-09-25T14:00:00.000Z" },
    { ...base, id: "b", body_as_sent: "First day", sent_at: "2026-09-24T14:00:00.000Z" },
    { ...base, id: "c", body_as_sent: "Second day later", sent_at: "2026-09-25T18:00:00.000Z" },
  ];
  assert.deepEqual(ownerMessageItems(items).map((i) => [i.side, i.author]), [["rep", n.from], ["rep", n.from], ["rep", n.from]]);
  const html = decode(renderToStaticMarkup(createElement(OwnerMessagesView, { nudges: items, asOf: "2026-09-25T20:00:00.000Z" })));
  assert.equal((html.match(/class="si-daydivider"/g) ?? []).length, 2);
  const t = text(html);
  assert.ok(t.indexOf("First day") < t.indexOf("Second day") && t.indexOf("Second day") < t.indexOf("Second day later"));
});

fixtureTest("the Owner's Work tab is unchanged: the Message rep region, no rep block", () => {
  const html = renderWork(OWNER_VIEWER, owner);
  assert.ok(html.includes('data-region="work-messages"'));
  assert.ok(!html.includes("data-owner-messages=") && !html.includes('data-region="work-owner-messages"'));
});

fixtureTest("A10: the rep timeline fixture renders exactly one nudge event (Dana's), the Owner's three", () => {
  const renderTimeline = (rel: string, viewer: Viewer) => {
    const page = timelineV2Schema.parse(read(rel));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    client.setQueryData(siKeys.timeline("outreach", "6ab5ab1972ee2eb383d948b1", []), { pages: [page], pageParams: [null] });
    const el = createElement(QueryClientProvider, { client }, createElement(ViewerProvider, { viewer } as Parameters<typeof ViewerProvider>[0], createElement(Timeline, { scope: "outreach", id: "6ab5ab1972ee2eb383d948b1" }) as ReactElement));
    return renderToStaticMarkup(el);
  };
  const count = (html: string) => (html.match(/data-kind="nudge_sent"/g) ?? []).length;
  assert.equal(count(renderTimeline("S12/rep-outreach-timeline-nudges__t3-promise-across-b.json", DANA)), 1);
  assert.equal(count(renderTimeline("S12/rep-marcus-outreach-timeline-nudges__t3-promise-across-b.json", MARCUS)), 1);
  assert.equal(count(renderTimeline("S12/owner-outreach-timeline-nudges__t3-promise-across-b.json", OWNER_VIEWER)), 3);
});
