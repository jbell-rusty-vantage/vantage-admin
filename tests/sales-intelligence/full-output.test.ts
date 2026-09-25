import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ReadableOutput, outputLabel, type Json } from "../../components/sales-intelligence/full-output-readable";
import { findContractsDir, fixtureTest } from "./contracts-dir";

// UX-C3 (final spec §11.8): Readable reformats Full output but never drops a key or an array element.
// A committed synthetic shape file always runs; the real outputs captured from the local replica live in the workspace
// (`contracts/UX-C3/full-output__*.json`, not in git) and skip with the contracts-dir rule where it is absent.

const FIXTURES = path.join(__dirname, "fixtures", "full-output");
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/;
const ENUM = /^[a-z0-9]+(_[a-z0-9]+)+$/;
/** Keys whose value *is* the layout (a finding's lead sentence, a quote and its byline): the value shows, the key word doesn't. */
const LAYOUT_KEYS = new Set(["claim", "quote", "speaker", "call_at"]);

const decode = (s: string) => s.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const squash = (s: string) => s.replace(/\s+/g, " ").trim();
const count = (hay: string, needle: string) => (needle ? hay.split(needle).length - 1 : 0);

type Expect = { label: Map<string, number>; text: Map<string, number>; title: Map<string, number>; notStated: number; none: number };
function collect(value: Json, out: Expect, key?: string) {
  const add = (map: Map<string, number>, k: string) => map.set(k, (map.get(k) ?? 0) + 1);
  if (key !== undefined && !LAYOUT_KEYS.has(key)) add(out.label, outputLabel(key));
  if (value === null || value === "") { out.notStated++; return; }
  if (Array.isArray(value)) {
    if (!value.length) out.none++;
    for (const item of value) collect(item, out);
    return;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value);
    if (!entries.length) out.none++;
    for (const [k, v] of entries) collect(v, out, k);
    return;
  }
  if (typeof value === "boolean") { add(out.text, value ? "Yes" : "No"); return; }
  if (typeof value === "number") { add(out.text, String(value)); return; }
  if (ISO.test(value) || ENUM.test(value)) add(out.title, value);
  else add(out.text, squash(value));
}

const fixtures = fs.readdirSync(FIXTURES).filter((f) => f.endsWith(".json")).map((f) => path.join(FIXTURES, f));
const CAPTURED = ["assessment-model", "assessment-accepted", "findings-model", "findings-accepted", "summary-model"];
const render = (value: Json) => renderToStaticMarkup(createElement(ReadableOutput, { value }));

test("UX-C3: the Full output fixtures are present", () => {
  assert.ok(fixtures.some((f) => f.endsWith("synthetic-shapes.json")));
});

function assertComplete(full: string) {
    const file = path.basename(full);
    const value = JSON.parse(fs.readFileSync(full, "utf8")) as Json;
    const html = render(value);
    const text = squash(decode(html.replace(/<[^>]+>/g, " ")));
    const titles = [...html.matchAll(/title="([^"]*)"/g)].map((m) => decode(m[1]!));
    const want: Expect = { label: new Map(), text: new Map(), title: new Map(), notStated: 0, none: 0 };
    collect(value, want);
    for (const [label, n] of want.label) assert.ok(count(text, label) >= 1, `${file}: label "${label}" (${n}×)`);
    for (const [leaf, n] of want.text) {
      const found = count(text, leaf);
      if (leaf.length > 3) assert.ok(found >= n, `${file}: "${leaf.slice(0, 60)}" expected ${n}×, found ${found}`);
      else assert.ok(found >= 1, `${file}: "${leaf}"`);
    }
    for (const [raw, n] of want.title) assert.ok(titles.filter((t) => t === raw).length >= n, `${file}: raw value "${raw}" kept in a title (${n}×)`);
    assert.ok(count(text, "Not stated") >= want.notStated, `${file}: every null / empty string reads "Not stated"`);
    assert.ok(count(text, "None") >= want.none, `${file}: every empty list / object reads "None"`);
    assert.ok(!/\[object Object\]|>null<|>undefined</.test(html), `${file}: no raw null / object text`);
}

for (const file of fixtures) test(`UX-C3: Readable shows every key and every array element of ${path.basename(file)}`, () => assertComplete(file));
for (const name of CAPTURED) {
  fixtureTest(`UX-C3: Readable shows every key and every array element of the captured ${name} output`, () => {
    assertComplete(path.join(findContractsDir()!, "UX-C3", `full-output__${name}.json`));
  });
}

test("UX-C3: known shapes get a known layout; deep nesting sits in a searchable Show more", () => {
  const html = render(JSON.parse(fs.readFileSync(path.join(FIXTURES, "synthetic-shapes.json"), "utf8")) as Json);
  assert.match(html, /<h5 class="si-out__h">Summary<\/h5>/, "top-level keys are headings");
  assert.match(html, /Money and dates/, "the page's own labels");
  assert.match(html, /class="si-out__finding"><p class="si-out__claim">The customer asked for a binding estimate before Friday\.<\/p>/, "the finding's claim leads");
  assert.match(html, /<strong>Kind:<\/strong>[\s\S]*<strong>Actor:<\/strong>[\s\S]*<strong>Clarity:<\/strong>[\s\S]*<strong>Action status:<\/strong>/, "finding meta line");
  assert.match(html, /si-out__table--scores[\s\S]*<th scope="row">Transaction intent<\/th>[\s\S]*<th scope="row">Move likelihood<\/th>/, "scores table");
  assert.match(html, /<blockquote class="si-out__quote">Can you get me a binding number by Friday\?<\/blockquote><p class="si-out__quoteby"><span title="customer">customer<\/span> · <time/, "quote with speaker and time");
  assert.match(html, /<ul class="si-out__bullets"><li>Rep will send the estimate by email<\/li>/, "plain strings are bullets");
  assert.match(html, /<blockquote class="si-out__quote">We have a freight elevator\.<\/blockquote>/, "said_on_call reads as quotes");
  assert.match(html, /<table class="si-out__table"><thead><tr><th scope="col">Field<\/th><th scope="col">Value<\/th><th scope="col">Status<\/th>/, "rows with shared keys are a table");
  assert.match(html, /<time dateTime="2026-09-24T18:58:37.661Z" title="2026-09-24T18:58:37.661Z">[^<]*ET<\/time>|<time dateTime="2026-09-24T18:58:37.661Z" title="2026-09-24T18:58:37.661Z">/, "timestamps formatted, raw value in title");
  assert.match(html, /<details class="si-out__more"><summary>Show more<\/summary>[\s\S]*deepest value/, "deep nesting behind <details>, still in the DOM");
  assert.ok(!html.includes("<code>"), "no monospace keys");
});
