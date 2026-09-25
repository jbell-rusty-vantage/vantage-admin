import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { attentionSchema, type PriorityCounts } from "../../lib/api/salesIntelligence";
import {
  PresetBar, countField, countFor, leadChange, presetChange, priorityLabel, priorityOptions, priorityToggle, type PresetValue, type PresetView,
} from "../../components/sales-intelligence/desk/preset-bar";
import { presetOf, presetPriority } from "../../components/sales-intelligence/data/preset-storage";
import { attentionParamsFromDesk, deskUrlUpdate, parseDeskUrl } from "../../components/sales-intelligence/data/url-state";
import { attentionQuery } from "../../components/sales-intelligence/data/requests";

// UI1-PRESET: the preset bar from the S5c / S7 `priority_counts` (UI1-A12). No DOM (ADMIN-REBUILD trap 7).

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
function load(rel: string) {
  return attentionSchema.parse(JSON.parse(fs.readFileSync(path.join(CONTRACTS, rel), "utf8")));
}
const decode = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
function render(counts: PriorityCounts | undefined, view: PresetView, value: PresetValue) {
  return decode(renderToStaticMarkup(createElement(PresetBar, { counts, view, value, onChange: () => {} })));
}
/** The option row for `key`, with its label and count. */
function option(html: string, key: string): string {
  const at = html.indexOf(`data-priority-option="${key}"`);
  assert.ok(at >= 0, `option ${key}`);
  return html.slice(at, html.indexOf("</label>", at));
}
const ALL: PresetValue = { priority: [], attachment: null };

test("presets: New = 0 + not_set, Quoted = 1, Other = 3 4 7 8 9, All = none; anything else is Custom", () => {
  assert.deepEqual(presetPriority("new"), ["0", "not_set"]);
  assert.deepEqual(presetPriority("quoted"), ["1"]);
  assert.deepEqual(presetPriority("other"), ["3", "4", "7", "8", "9"]);
  assert.deepEqual(presetPriority("all"), []);
  assert.equal(presetOf(["not_set", "0"]), "new");
  assert.equal(presetOf(["0"]), "custom");
  assert.equal(presetOf(["1", "5"]), "custom");
});

test("pressing New sends priority=0&priority=not_set (repeated, never priority[])", () => {
  const next = presetChange("new", ALL);
  assert.deepEqual(next, { priority: ["0", "not_set"], attachment: null });
  const url = deskUrlUpdate("view=attention", next);
  assert.equal(url.toString(), "view=attention&priority=0&priority=not_set");
  const query = attentionQuery(attentionParamsFromDesk(parseDeskUrl(url), "attention")).toString();
  assert.match(query, /priority=0&priority=not_set/);
  assert.doesNotMatch(query, /priority%5B%5D|priority\[\]/);
  assert.deepEqual(presetChange("other", { priority: ["1"], attachment: "lead" }), { priority: ["3", "4", "7", "8", "9"], attachment: "lead" });
  // Editing the multi-select after a preset turns it Custom.
  const edited = priorityToggle("not_set", next);
  assert.deepEqual(edited, { priority: ["0"], attachment: null });
  assert.equal(presetOf(edited.priority), "custom");
  assert.deepEqual(priorityToggle("not_set", edited), next);
});

test("the pressed segment follows the selection, and a custom selection shows Custom", () => {
  const counts = load("S5c/attention__all-outreach.json").data.priority_counts;
  const newHtml = render(counts, "all_outreach", { priority: ["not_set", "0"], attachment: null });
  assert.match(newHtml, /aria-pressed="true" data-preset-btn="new"/);
  assert.equal((newHtml.match(/aria-pressed="true"/g) ?? []).length, 2, "New + the Lead toggle's All");
  assert.ok(!newHtml.includes('data-preset-btn="custom"'));
  assert.ok(newHtml.includes("Granot Priority · 2 selected"));

  const custom = render(counts, "all_outreach", { priority: ["1", "7"], attachment: null });
  assert.ok(custom.includes('data-preset="custom"'));
  assert.match(custom, /class="si-seg__btn si-seg__custom is-active" data-preset-btn="custom">Custom</);
  for (const name of ["all", "new", "quoted", "other"]) assert.match(custom, new RegExp(`aria-pressed="false" data-preset-btn="${name}"`));

  const all = render(counts, "all_outreach", ALL);
  assert.match(all, /aria-pressed="true" data-preset-btn="all"/);
  assert.ok(all.includes("Granot Priority · All"));
});

test("S5c all-outreach: every key but no_lead is listed in order with its active count and COPY-UI1 §5 label", () => {
  const page = load("S5c/attention__all-outreach.json");
  const counts = page.data.priority_counts;
  assert.ok(counts);
  const html = render(counts, "all_outreach", ALL);
  const listed = [...html.matchAll(/data-priority-option="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(listed, ["0", "1", "3", "7", "8", "not_set"]);
  const expected: Record<string, [string, number]> = { "0": ["0 Fresh", 1], "1": ["1 Quoted", 7], "3": ["3 Rep discretion", 1], "7": ["7 CRM bad/unusable", 1], "8": ["8 CRM dead", 0], not_set: ["Not set", 41] };
  for (const [key, [label, count]] of Object.entries(expected)) {
    const row = option(html, key);
    assert.ok(row.includes(`>${label}<`), `${key} label`);
    assert.equal(counts[key].active, count);
    assert.ok(row.includes(`class="si-prioritymenu__count" aria-label="${count === 1 ? "1 record" : `${count} records`}">${count}<`), `${key} count`);
  }
  // No Lead's count sits on the Lead toggle.
  assert.match(html, /data-lead-btn="none">No Lead<span class="si-seg__count" aria-label="2 records">2</);
});

test("S7: the count column follows the view (attention / active / closed; Overview reads active)", () => {
  const cases: [string, PresetView][] = [
    ["S7/attention__attention-preset-new.json", "attention"],
    ["S7/attention__all-outreach-preset-new.json", "all_outreach"],
    ["S7/attention__closed-preset-new.json", "closed"],
    ["S7/attention__all-outreach.json", "overview"],
  ];
  for (const [rel, view] of cases) {
    const page = load(rel);
    const counts = page.data.priority_counts!;
    if (view !== "overview") assert.equal(page.data.view, view, rel);
    const field = countField(view);
    const html = render(counts, view, { priority: ["0", "not_set"], attachment: null });
    for (const key of priorityOptions(counts)) {
      const n = counts[key][field];
      assert.equal(countFor(counts, key, view), n);
      assert.ok(option(html, key).includes(`>${n}<`), `${rel} ${key} ${field}=${n}`);
    }
    assert.match(html, new RegExp(`data-lead-btn="none">No Lead<span class="si-seg__count" aria-label="[^"]+">${counts.no_lead[field]}<`), `${rel} no_lead`);
  }
  // Where the columns differ, the view picks the right one: key 1 is attention 8 / active 7 / closed 1.
  const counts = load("S7/attention__default.json").data.priority_counts!;
  assert.deepEqual([countFor(counts, "1", "attention"), countFor(counts, "1", "all_outreach"), countFor(counts, "1", "closed"), countFor(counts, "1", "overview")], [8, 7, 1, 7]);
  // Unknown codes print `{n} Unknown meaning`; 5 is Booked in Granot.
  const html = render(counts, "attention", ALL);
  assert.ok(option(html, "4").includes(">4 Unknown meaning<"));
  assert.ok(option(html, "9").includes(">9 Unknown meaning<"));
  assert.ok(option(html, "5").includes(">5 Booked in Granot<"));
  assert.equal(priorityLabel("no_lead"), "No Lead");
});

test("a selected key the counts don't have is still listed, so it can be unchecked", () => {
  const counts = load("S5c/attention__all-outreach.json").data.priority_counts;
  const html = render(counts, "all_outreach", { priority: ["3", "4", "7", "8", "9"], attachment: null });
  assert.match(html, /aria-pressed="true" data-preset-btn="other"/);
  const row = option(html, "9");
  assert.ok(row.includes('checked=""') && row.includes(">9 Unknown meaning<") && !row.includes("si-prioritymenu__count"));
});

test("No Lead disables the presets and the multi-select and says why; choosing it clears Priority", () => {
  const counts = load("S7/attention__all-outreach-no-lead.json").data.priority_counts;
  const html = render(counts, "all_outreach", { priority: [], attachment: "none" });
  const note = "A record with no Lead has no Granot Priority, so the presets don't apply.";
  assert.ok(html.includes(`class="si-presetbar__note">${note}<`));
  for (const name of ["all", "new", "quoted", "other"]) {
    const at = html.indexOf(`data-preset-btn="${name}"`);
    const tag = html.slice(html.lastIndexOf("<button", at), html.indexOf(">", at));
    assert.ok(tag.includes('disabled=""') && tag.includes(`title="${note}"`) && tag.includes("aria-describedby"), `${name} disabled`);
    assert.ok(tag.includes('aria-pressed="false"'));
  }
  assert.match(html, /class="si-prioritymenu__trigger" aria-expanded="false" aria-controls="[^"]+" disabled=""/);
  assert.match(html, /aria-pressed="true" data-lead-btn="none">No Lead<span class="si-seg__count" aria-label="3 records">3</);
  assert.ok(html.includes('data-preset="no_lead"'));

  const quoted: PresetValue = { priority: ["1"], attachment: null };
  assert.deepEqual(leadChange("none", quoted), { priority: [], attachment: "none" });
  assert.deepEqual(leadChange("lead", quoted), { priority: ["1"], attachment: "lead" });
  assert.deepEqual(leadChange(null, { priority: ["1"], attachment: "lead" }), quoted);
  assert.equal(deskUrlUpdate("view=all_outreach", { priority: [], attachment: "none" }).toString(), "view=all_outreach&attachment=none");
});

test("no priority_counts (flag off): options still render, without counts; skeleton has segments and two pills", () => {
  const html = render(undefined, "attention", { priority: ["1"], attachment: null });
  assert.ok(option(html, "1").includes(">1 Quoted<"));
  assert.ok(!html.includes("si-prioritymenu__count"));
  assert.ok(!html.includes("si-seg__count"));
  const skeleton = renderToStaticMarkup(createElement(PresetBar.Skeleton));
  assert.equal((skeleton.match(/si-presetbar__skseg/g) ?? []).length, 1);
  assert.equal((skeleton.match(/si-presetbar__skpill/g) ?? []).length, 2);
});

test("44 px targets: segments, the trigger and the options use the hit token", () => {
  const css = fs.readFileSync(path.join(process.cwd(), "components/sales-intelligence/styles/sales-intelligence.css"), "utf8");
  const block = css.slice(css.indexOf("/* UI-1: PRESET"), css.indexOf("/* UI-1: RAIL"));
  for (const sel of [".si-seg__btn {", ".si-prioritymenu__trigger {", ".si-prioritymenu__option {"]) {
    const rule = block.slice(block.indexOf(sel), block.indexOf("}", block.indexOf(sel)));
    assert.ok(rule.includes("min-height: var(--si-hit)"), sel);
  }
});
