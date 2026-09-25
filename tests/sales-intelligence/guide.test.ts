import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GuideView } from "../../components/sales-intelligence/guide-view";
import { BANDS, copy } from "../../components/sales-intelligence/sales-intelligence-copy";
import { GUIDE_TOPICS, GUIDE_TOPIC_KEYS, guideHref, parseGuideTopic } from "../../components/sales-intelligence/sales-intelligence-tabs";

// UI1-COVER: the rewritten Guide (UI-1 §6, COPY-UI1 §12). Static markup, no DOM.

const decode = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
const html = decode(renderToStaticMarkup(createElement(GuideView, { topic: null })));
const g = copy.ui1.guide;

test("the Guide renders every section heading, in order, each with its anchor and a nav link", () => {
  let last = -1;
  for (const key of GUIDE_TOPIC_KEYS) {
    const at = html.indexOf(`<section id="${key}"><h2>${g.topics[key]}</h2>`);
    assert.ok(at > last, `section ${key}`);
    last = at;
    assert.ok(html.includes(`href="/sales-intelligence?view=guide&topic=${key}"`), `nav ${key}`);
  }
  assert.equal(GUIDE_TOPICS.length, GUIDE_TOPIC_KEYS.length);
  assert.ok(html.includes(`aria-label="${g.navLabel}"`));
});

test("the COPY-UI1 §12 content: the four views, the seven bands, presets and Lead toggle, seven card lines, live vs Owner calling, Numbers, messaging", () => {
  for (const name of ["Overview", "All Outreach", "Closed"]) assert.ok(html.includes(`<strong>${name}.</strong>`), name);
  assert.ok(!html.includes("<strong>Needs Attention.</strong>"), "UX-C1: no Needs Attention view in the Guide");
  for (const band of [1, 2, 3, 4, 5, 6, 7] as const) assert.ok(html.includes(`${band} · ${BANDS[band]}.</strong> ${copy.bandSoWhat[band]}`), `band ${band}`);
  for (const preset of ["All", "New", "Quoted", "Other", "Custom"]) assert.ok(html.includes(`<strong>${preset}.</strong>`), preset);
  assert.ok(html.includes(g.leadToggle));
  const card = html.slice(html.indexOf('<section id="card">'), html.indexOf('<section id="live">'));
  assert.equal((card.match(/<li>/g) ?? []).length, 7);
  assert.ok(html.includes("<strong>Owner calling.</strong>") && html.includes("<strong>On the call · {rep} · {time}.</strong>"));
  assert.ok(html.includes('Numbers still opens the previous version of this desk. Use "Open Number" on any card or the Numbers view there.'));
  assert.ok(html.includes("Messages go to the rep's RingCentral and never to the customer. There's no preview: what you type is what's sent."));
  assert.ok(html.includes(copy.ui1.coverage.pendingExplain) && html.includes(copy.ui1.coverage.webhook.subscriptionMissing));
});

test("topics: the current one is marked; retired topics and unknown values land on a section", () => {
  const onBands = renderToStaticMarkup(createElement(GuideView, { topic: "bands" }));
  assert.match(onBands, /class="si-filterchip" aria-current="location">Bands</);
  assert.equal(parseGuideTopic("workspace"), "views");
  assert.equal(parseGuideTopic("summary"), "summary");
  assert.equal(parseGuideTopic("nonsense"), "views");
  assert.equal(parseGuideTopic(null), "views");
  assert.equal(parseGuideTopic("coverage"), "coverage");
  assert.equal(guideHref("workspace"), "/sales-intelligence?view=guide&topic=views");
  // Every topic a kept tooltip links to is still a section.
  for (const key of ["provenance", "coverage", "statuses", "bands", "call", "review", "numbers", "attachments", "summary"] as const) assert.equal(parseGuideTopic(key), key);
});
