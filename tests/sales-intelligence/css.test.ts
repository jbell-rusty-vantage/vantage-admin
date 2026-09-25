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
