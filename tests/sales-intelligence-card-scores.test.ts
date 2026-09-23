import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AttentionFlatList, AttentionRow } from "../components/sales-intelligence/attention";
import { attentionSchema, type AttentionRow as Row } from "../lib/api/salesIntelligence";

// Move assessment §8.1/§8.2: the card score row and the flat score-sorted list, rendered.
const coverage = { known_through: null, gaps: [], ai_paused: false };
const keys = { next_action_due: null, lead_received: null, last_human_contact: null, last_lead_progress: null };
function row(id: string, band: number | null, sortKeys: Record<string, unknown>, extra: Record<string, unknown> = {}): Record<string, unknown> {
  const derived = { overdue: false, attention_band: band, reasons: band ? ["going_cold"] : [], review_badges: [], call_blockers: [], age_wall_ms: 0, age_staffed_ms: 0 };
  return { subject_key: `lead:FormLead:${id}`, subject: { kind: "lead", model: "FormLead", id }, derived, allowed_actions: [], sort_keys: { ...keys, ...sortKeys },
    outreach: { id, revision: 1, subject: { kind: "lead", model: "FormLead", id }, state: "open", reason: null, allowed_actions: [], assignment: { agent: null, origin: null },
      followups: [], derived, last_meaningful_contact_at: null, primary_number: { id: `n${id}`, e164: `+1555010${id.slice(-4)}` } }, ...extra };
}
const rows = (items: Record<string, unknown>[]): Row[] => attentionSchema.parse({ as_of: "2026-09-22T12:00:00.000Z", coverage,
  data: { items, snapshot_id: "s", cursor: null, total_items: items.length, reason_counts: {}, status: "ready", sort: "transaction_intent", direction: "desc", view: "all_outreach" } }).data.items;
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

test("an Outreach card shows both scores, full labels and View assessment without nesting buttons", () => {
  const [item] = rows([row("a".repeat(20) + "0001", 7, { transaction_intent: 75, move_likelihood: 100, assessment_status: "ready", assessment_stale: true })]);
  const html = renderToStaticMarkup(createElement(AttentionRow, { row: item!, selected: false, onOpen: () => {}, onOpenAssessment: () => {} }));
  const plain = text(html);
  assert.match(plain, /Transaction intent 75 \/ 100/);
  assert.match(plain, /Move likelihood 100 \/ 100/);
  assert.match(plain, /Stale/);
  assert.match(plain, /View assessment/);
  assert.equal(html.includes("%"), false);
  assert.equal(/<button[^>]*>(?:(?!<\/button>).)*<button/.test(html), false, "no button inside a button");
});

test("zero, Unknown, Pending, Not applicable and Not assessed render as different words", () => {
  const items = rows([
    row("b".repeat(20) + "0001", 1, { transaction_intent: 0, move_likelihood: 0, assessment_status: "ready" }),
    row("b".repeat(20) + "0002", 2, { transaction_intent: null, move_likelihood: null, assessment_status: "ready" }),
    row("b".repeat(20) + "0003", 3, { transaction_intent: null, move_likelihood: null, assessment_status: "pending" }),
    row("b".repeat(20) + "0004", 4, { transaction_intent: null, move_likelihood: null, assessment_status: "not_applicable" }),
    row("b".repeat(20) + "0005", null, {}, { in_attention: false }),
  ]);
  const html = renderToStaticMarkup(createElement(AttentionFlatList, { items, selected: () => false, onOpen: () => {}, onOpenAssessment: () => {}, sortedBy: "transaction_intent" }));
  const plain = text(html);
  for (const word of ["0 / 100", "Unknown", "Pending", "Not applicable", "Not assessed"]) assert.match(plain, new RegExp(`Transaction intent: ${word.replace("/", "\/")}`));
  // The no-band row in all_outreach says so rather than posing as a review row.
  assert.match(plain, /Not in Attention/);
  assert.equal(html.includes("%"), false);
});

test("score order renders exactly as served: Band 7 at 100 above Band 1 at 25, each with its band tag", () => {
  const items = rows([
    row("c".repeat(20) + "0007", 7, { transaction_intent: 100, move_likelihood: 50, assessment_status: "ready" }),
    row("c".repeat(20) + "0001", 1, { transaction_intent: 25, move_likelihood: 90, assessment_status: "ready" }),
  ]);
  const plain = text(renderToStaticMarkup(createElement(AttentionFlatList, { items, selected: () => false, onOpen: () => {}, onOpenAssessment: () => {}, sortedBy: "transaction_intent" })));
  const seven = plain.indexOf("Band 7");
  const one = plain.indexOf("Band 1");
  assert.ok(seven >= 0 && one > seven, plain);
  assert.ok(plain.indexOf("Transaction intent: 100 / 100") < plain.indexOf("Transaction intent: 25 / 100"));
});
