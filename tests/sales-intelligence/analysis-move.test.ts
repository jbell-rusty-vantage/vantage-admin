import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { outreachAssessmentReadSchema } from "../../lib/api/salesIntelligenceAssessment";
import { MoveDetails, markerText } from "../../components/sales-intelligence/outreach/analysis";

// UI1-MOVE: Move details from the contract fixtures (final spec §11.4, §11.9; UI1-A23). No DOM (ADMIN-REBUILD trap 7).

const WORKSPACE_CONTRACTS = "sales-intelligence-ui-ux-workspace/contracts";
function contractsDir(): string {
  const repo = path.resolve(__dirname, "../..");
  const tried = [process.env.SI_CONTRACTS_DIR, path.resolve(repo, "..", WORKSPACE_CONTRACTS)].filter((v): v is string => !!v);
  try {
    const gitdir = /^gitdir:\s*(.+)$/m.exec(fs.readFileSync(path.join(repo, ".git"), "utf8"))?.[1]?.trim();
    if (gitdir) tried.push(path.resolve(gitdir, "..", "..", "..", "..", WORKSPACE_CONTRACTS));
  } catch { /* a normal checkout */ }
  const dir = tried.find((candidate) => fs.existsSync(path.join(candidate, "S1")));
  assert.ok(dir, `contracts not found; tried ${tried.join(", ")}`);
  return dir;
}
const CONTRACTS = contractsDir();
const assessment = (name: string) =>
  outreachAssessmentReadSchema.parse(JSON.parse(fs.readFileSync(path.join(CONTRACTS, "S3", `outreach-assessment__${name}.json`), "utf8"))).data;

const decode = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const text = (html: string) => decode(html.replace(/<[^>]+>/g, "")).replace(/ /g, " ");
const render = (name: string) => renderToStaticMarkup(createElement(MoveDetails, { assessment: assessment(name) }));
/** The markup of one table row (`data-row="{key}"`) up to its closing tag. */
const row = (html: string, key: string) => {
  const at = html.indexOf(`data-row="${key}"`);
  assert.ok(at >= 0, `row ${key}`);
  return html.slice(at, html.indexOf("</tr>", at));
};
const ORDER = ["pickup", "delivery", "move_date", "size", "services", "access", "money", "inventory"];

test("the table: three columns, the origin word in the Original header, rows in the fixed order", () => {
  const html = render("s-conflict-move");
  const head = text(html.slice(html.indexOf("<thead>"), html.indexOf("</thead>")));
  assert.ok(head.includes("Customer said") && head.includes("Lead on file") && head.includes("Original submissionOriginal form submission"), head);
  const at = ORDER.map((key) => html.indexOf(`data-row="${key}"`));
  assert.ok(at.every((v, i) => v > 0 && (i === 0 || v > at[i - 1])), `row order ${at}`);
  assert.ok(text(row(html, "inventory")).includes("Inventory summary5 items · coverage partial"));
});

test("cells: short lists, markers, `Not mentioned` / `Not on file`, money with its basis", () => {
  const html = render("s-conflict-move");
  assert.ok(text(row(html, "pickup")).includes("4521 Palmetto Grove Boulevard, Apartment 12B, Tampa, FL 33606Tampa, FL 33601Tampa, FL 33606"));
  assert.ok(text(row(html, "delivery")).includes("Raleigh, NC (changed)"));
  assert.ok(text(row(html, "size")).includes("SizeNot mentioned2 Bedroom2 Bedroom"));
  const services = row(html, "services");
  assert.equal((services.match(/<li>/g) ?? []).length, 2, "several values → a list");
  assert.ok(text(services).includes("Storage (declined)"));
  assert.equal((text(services).match(/Not on file/g) ?? []).length, 2, "customer-only rows: Lead and Original print Not on file");
  assert.ok(text(row(html, "money")).includes("$3,800 competitor quote") && text(row(html, "money")).includes("$3,000–$3,500 budget"));
  assert.ok(text(row(html, "access")).includes("Pickup · Stairs: Third floor walk-up"));
  assert.equal(markerText("flexible"), "(flexible)");
  assert.equal(markerText(null), null);
});

test("a conflict: amber marks on the disagreeing cells and `Details disagree: {explanation}` with View evidence under the row (A23)", () => {
  const html = render("s-conflict-move");
  const delivery = row(html, "delivery");
  assert.ok(delivery.includes("has-conflict"));
  assert.ok(/<td[^>]*data-cell="customer"[^>]*class="is-disagree"/.test(delivery), "the customer cell is marked");
  assert.ok(!/data-cell="lead_on_file"[^>]*class="is-disagree"/.test(delivery), "only the cells the server names");
  assert.ok(delivery.includes('aria-label="Details disagree"'));
  const at = html.indexOf('data-conflict="delivery"');
  const line = text(html.slice(at, html.indexOf("</tr>", at)));
  assert.ok(line.includes("Details disagree: Delivery city changed from Charlotte to Raleigh between calls."), line);
  assert.ok(line.includes("View evidence (2)"));
  assert.ok(html.includes('data-conflict="move_date"'));
  assert.ok(!html.includes('data-conflict="pickup"'), "no conflict → no line");
  // Amber only for Details disagree (UI-0 §2.1).
  const amber = [...html.matchAll(/si-text--amber/g)].length;
  assert.equal(amber, 2 * 3, "one mark per disagreeing cell plus the icon and word on each line (2 conflicts)");
});

test("inventory: the `Inventory ({n})` disclosure with the existing columns, Limitations and the coverage sentence", () => {
  const html = render("s-conflict-move");
  const t = text(html);
  assert.ok(t.includes("Inventory (5)"));
  for (const col of ["Item", "Quantity", "Room", "Dimensions", "Handling", "Status", "Evidence"]) assert.ok(t.includes(col), col);
  assert.ok(t.includes("Upright piano") && t.includes("58 in wide") && t.includes("Piano dolly; three movers"));
  assert.ok(t.includes("Six dining chairs6"));
  assert.ok(t.includes("LimitationsGarage contents not discussed"));
  assert.ok(t.includes("From 2 of 2 conversations"));
  assert.ok(t.includes("Conflicts (0)No conflicts were recorded."));
});

test("score conflicts: `Conflicts ({n})` lists conflicts that affect a score; an inventory-row conflict still marks the row", () => {
  const html = render("s-conflict-other");
  const t = text(html);
  assert.ok(t.includes("Conflicts (1)"));
  assert.ok(t.includes("Transaction intent: The customer said they are ready to book, then said they are waiting on a competitor."));
  assert.ok(html.includes('data-conflict="inventory"'));
  assert.ok(t.includes("Details disagree: The piano was included on one call and excluded on the other."));
  assert.ok(text(row(html, "pickup")).includes("PickupNot mentionedRaleigh, NC 33601Not on file"), "no original view → Not on file");
  assert.ok(!t.includes("Original form submission"), "null origin → plain header");
});

test("no assessment: the sentence and the Lead-only table with the Lead on file column filled (§11.9)", () => {
  const html = render("s-assessment-pending");
  const t = text(html);
  assert.ok(html.includes('data-move="lead-only"'));
  assert.ok(t.includes("No move details were stated in the retained conversations."));
  assert.ok(text(row(html, "pickup")).includes("PickupNot mentionedAustin, TX 33601Not on file"));
  assert.ok(!t.includes("View evidence"), "the Lead-only table cites nothing");
  assert.ok(!t.includes("Inventory ("));
  const none = render("s-number-only");
  assert.ok(text(none).includes("No move details were stated in the retained conversations."));
  assert.ok(!none.includes("<table"), "no Lead → no table");
});

test("an assessment with no inventory prints `No inventory items were mentioned.`", () => {
  const t = text(render("s-lead-only"));
  assert.ok(t.includes("No inventory items were mentioned."));
  assert.ok(t.includes("From 0 of 0 conversations"));
});
