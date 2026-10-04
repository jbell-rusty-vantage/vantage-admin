import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * UI-1: every worker appends a block to the feature stylesheet and the merges resolve by concatenation, so an
 * unclosed block can slip through every render test (they never parse CSS) and still break the whole admin at
 * runtime (Turbopack refuses the stylesheet). This keeps the braces balanced and every UI-1 block closed.
 */
const file = resolve(process.cwd(), "components/sales-intelligence/styles/sales-intelligence.css");

test("sales-intelligence.css has balanced braces and no UI-1 block starts inside an open block", () => {
  const css = readFileSync(file, "utf8");
  let depth = 0;
  const problems: string[] = [];
  css.split(/\r?\n/).forEach((line, index) => {
    if (/^\/\* UI-1: /.test(line) && depth !== 0) problems.push(`line ${index + 1}: "${line.slice(0, 40)}" starts at depth ${depth}`);
    for (const ch of line) { if (ch === "{") depth++; else if (ch === "}") depth--; if (depth < 0) problems.push(`line ${index + 1}: stray }`); }
  });
  if (depth !== 0) problems.push(`file ends at depth ${depth}`);
  assert.deepEqual(problems, []);
});

/** The rules that make the Number dialog's panel shell work (moved from the deleted _legacy/styles/assessment.css). */
test("the Number dialog keeps its panel shell: one scroll region, a sticky header, an ellipsis title", () => {
  // Top-level rules only (selector → every body with exactly that selector); comments stripped.
  const css = readFileSync(file, "utf8").replace(/\/\*[^]*?\*\//g, "").replace(/\s+/g, " ");
  const bodies = new Map<string, string[]>();
  for (const block of css.split("}")) {
    const at = block.indexOf("{");
    if (at === -1 || block.includes("{", at + 1)) continue;
    const selector = block.slice(0, at).trim();
    bodies.set(selector, [...(bodies.get(selector) ?? []), block.slice(at + 1).trim()]);
  }
  const rule = (selector: string) => {
    const found = bodies.get(selector);
    assert.ok(found, `${selector} has a rule`);
    return found.join(" ");
  };
  assert.match(rule(".si-local-dialog"), /--si-dialog-head: 52px/);
  assert.match(rule(".si-local-dialog[open]"), /overflow-y: auto;[^]*overscroll-behavior: contain/);
  assert.match(rule(".si-local-dialog > *"), /flex: none/);
  assert.match(rule(".si-local-dialog .si-panel__body"), /flex: none; overflow: visible/);
  assert.match(rule(".si-local-dialog .si-panel__header"), /position: sticky; top: 0;[^]*height: var\(--si-dialog-head\)/);
  assert.match(rule(".si-local-dialog .si-panel__dtitle"), /text-overflow: ellipsis; white-space: nowrap;[^]*font-family: var\(--si-font-heading\); font-size: 15px; font-weight: 700; color: var\(--si-navy\)/);
  assert.match(rule(".si-local-dialog .si-panel__headeractions"), /margin-left: auto/);
  assert.match(rule(".si-local-dialog .si-tl__day"), /top: var\(--si-dialog-head\)/);
});
