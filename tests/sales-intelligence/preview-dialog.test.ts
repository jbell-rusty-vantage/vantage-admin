import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { attentionSchema, outreachReadSchema, type AttentionRow } from "../../lib/api/salesIntelligence";
import { PreviewBody, PreviewDialog } from "../../components/sales-intelligence/preview-dialog";
import { siKeys } from "../../components/sales-intelligence/data/query-keys";
import { findContractsDir, fixtureTest } from "./contracts-dir";

// UI1-CARD: the side dialog (final spec §4, UI-1 §2.4), rendered from the detail fixtures. No DOM.

const CONTRACTS = findContractsDir() ?? "";
const read = (rel: string) => JSON.parse(fs.readFileSync(path.join(CONTRACTS, rel), "utf8"));
const decode = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
const text = (html: string) => decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ");

/** The list row for the detail fixture's record (the S1 all-outreach page), or a row built from the detail read. */
function listRowFor(detail: ReturnType<typeof outreachReadSchema.parse>): AttentionRow {
  const page = attentionSchema.parse(read("S1/attention__all-outreach.json"));
  const found = page.data.items.find((row) => row.outreach?.id === detail.data.outreach.id);
  return found ?? { subject_key: "fixture", subject: detail.data.outreach.subject, outreach: detail.data.outreach, derived: detail.data.outreach.derived, filter_keys: undefined } as unknown as AttentionRow;
}

fixtureTest("the dialog body shows the header block, both score cards, the next step, the timeline slot and Open full record", () => {
  const detail = outreachReadSchema.parse(read("S1/outreach__s-followup-due.json"));
  const o = detail.data.outreach;
  const row = { ...listRowFor(detail), outreach: o, derived: o.derived };
  const html = renderToStaticMarkup(createElement(PreviewBody, { row, asOf: detail.as_of, timelinePreview: createElement("ol", { "data-timeline-preview": "1" }) }));
  const t = text(html);
  assert.ok(t.includes("Unworked") || t.includes("Open"), "state pill");
  assert.ok(html.includes("si-bandtag"), "band tag in the header block");
  assert.ok(/Assigned to|Promised by|Unassigned/.test(t), "line 7");
  assert.equal((html.match(/data-score-card=/g) ?? []).length, 2);
  assert.ok(t.includes("Transaction intent") && t.includes("Move likelihood"));
  assert.ok(!html.includes("%"));
  assert.ok(t.includes(`Next: ${o.next_action!.description}`), "next step");
  assert.ok(html.includes('data-timeline-preview="1"'), "timeline preview slot");
  assert.ok(html.includes(`href="/sales-intelligence/outreach/${o.id}"`) && t.includes("Open full record"));
});

fixtureTest("without a timeline preview the slot shows a skeleton placeholder; scores read words, never zero", () => {
  const detail = outreachReadSchema.parse(read("S1/outreach__s-number-only.json"));
  const o = detail.data.outreach;
  const row = { ...listRowFor(detail), outreach: o, derived: o.derived };
  const html = renderToStaticMarkup(createElement(PreviewBody, { row, asOf: detail.as_of }));
  assert.ok(html.includes("si-skeleton si-skeleton--line"), "timeline placeholder");
  assert.ok(/si-preview__scorevalue is-word">(Not assessed|Unknown|Pending|Not applicable|Unavailable)</.test(html));
});

fixtureTest("PreviewDialog reads the record live through useOutreach and labels itself", () => {
  const detail = outreachReadSchema.parse(read("S1/outreach__s-suggestion-open.json"));
  const o = detail.data.outreach;
  const row = listRowFor(detail);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(siKeys.outreach(o.id), detail);
  const html = renderToStaticMarkup(
    createElement(QueryClientProvider, { client }, createElement(PreviewDialog, { row, onClose: () => {}, onApplySuggestion: () => {} })),
  );
  assert.ok(/<aside[^>]*class="si-preview"[^>]*role="dialog"[^>]*aria-modal="false"/.test(html));
  assert.ok(/aria-label="Close"/.test(html));
  const t = text(html);
  assert.ok(t.includes("Open full record"));
  if (o.suggested_next_step && !o.next_action) {
    assert.ok(t.includes(`Suggested: ${o.suggested_next_step.description}`));
    if (o.suggested_next_step.apply?.enabled) assert.ok(/>Apply<\/button>/.test(html));
  }
  // Live chip on the header when the detail read has one.
  const live = attentionSchema.parse(read("S5c/attention__all-outreach.json")).data.items.find((r) => r.outreach?.live_call);
  assert.ok(live);
  const liveHtml = renderToStaticMarkup(createElement(PreviewBody, { row: live!, asOf: "2026-09-24T18:39:02.909Z" }));
  assert.ok(text(liveHtml).includes("On the call · "));
});

fixtureTest("a Number-review row (no Outreach) opens no dialog", () => {
  const page = attentionSchema.parse(read("S1/attention__all-outreach.json"));
  const review = page.data.items.find((row) => row.outreach === null)!;
  const client = new QueryClient();
  const html = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(PreviewDialog, { row: review, onClose: () => {} })));
  assert.equal(html, "");
});

test("PreviewDialog.Skeleton is shaped like the dialog", () => {
  const html = renderToStaticMarkup(createElement(PreviewDialog.Skeleton));
  assert.ok(html.includes("si-preview__scores") && (html.match(/si-skeleton/g) ?? []).length >= 8);
});
