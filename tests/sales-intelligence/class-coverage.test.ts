import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Every `si-*` class the Sales Intelligence markup uses must have a rule in a Sales Intelligence stylesheet. The
 * slimming deleted whole legacy stylesheets (`_legacy/styles/*.css`) and pruned `sales-intelligence.css`
 * automatically; markup that kept a class whose only rule lived in a deleted file (the Number dialog's
 * `si-panel__dtitle` and its sticky header) lost its styling silently, because no render test parses CSS.
 *
 * The scan reads the string literals inside each `className=` expression. A class assembled at runtime
 * (`si-badge--${tone}`) is skipped. MARKERS are hook classes that never had a rule (none at adda9e1, before the
 * slimming); a new unstyled class must be added there on purpose.
 */
const ROOTS = ["components/sales-intelligence", "app/(dashboard)/sales-intelligence"].map((dir) => resolve(process.cwd(), dir));
const MARKERS = new Set([
  "si-tipportal",
  "si-tip__body",
  "si-routetabs",
  "si-filters__set",
  "si-liveind__word",
  "si-regionerror__code",
]);

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

/** The source text of each `className=` value: a quoted string, or a balanced `{…}` expression. */
function classNameExpressions(source: string): string[] {
  const out: string[] = [];
  const marker = "className=";
  for (let at = source.indexOf(marker); at !== -1; at = source.indexOf(marker, at + marker.length)) {
    let i = at + marker.length;
    const open = source[i];
    if (open === '"' || open === "'") {
      const end = source.indexOf(open, i + 1);
      if (end !== -1) out.push(source.slice(i, end + 1));
      continue;
    }
    if (open !== "{") continue;
    let depth = 0;
    const start = i;
    for (; i < source.length; i++) {
      if (source[i] === "{") depth++;
      else if (source[i] === "}" && --depth === 0) break;
    }
    out.push(source.slice(start, i + 1));
  }
  return out;
}

/** The literal `si-*` class names in one `className` expression (runtime-assembled names are skipped). */
function siClasses(expression: string): string[] {
  const names: string[] = [];
  for (const literal of expression.matchAll(/(["'`])((?:(?!\1)[^\\]|\\.)*)\1/g)) {
    for (const token of literal[2].matchAll(/(?<![\w$-])(si-[a-z0-9_-]*[a-z0-9])(?![\w$-])/g)) names.push(token[1]);
  }
  return names;
}

test("the className scanner reads literals in strings and expressions and skips runtime-built names", () => {
  const source = `<a className="si-a si-b" /><b className={cx("si-c", on && "si-d is-on", \`si-e--\${tone}\`)} /><i className={\`si-f \${x}\`} />`;
  assert.deepEqual(classNameExpressions(source).flatMap(siClasses), ["si-a", "si-b", "si-c", "si-d", "si-f"]);
});

test("every si-* class used by the Sales Intelligence markup has a stylesheet rule", () => {
  const all = ROOTS.flatMap(files);
  const css = all.filter((path) => path.endsWith(".css")).map((path) => readFileSync(path, "utf8")).join("\n");
  const defined = new Set([...css.matchAll(/\.(si-[A-Za-z0-9_-]+)/g)].map((match) => match[1]));
  const missing = new Map<string, Set<string>>();
  for (const path of all.filter((file) => /\.tsx?$/.test(file))) {
    for (const name of classNameExpressions(readFileSync(path, "utf8")).flatMap(siClasses)) {
      if (defined.has(name) || MARKERS.has(name)) continue;
      if (!missing.has(name)) missing.set(name, new Set());
      missing.get(name)!.add(path.slice(process.cwd().length + 1));
    }
  }
  assert.deepEqual(Object.fromEntries([...missing].map(([name, where]) => [name, [...where]])), {});
  // The markers really are unstyled hooks; once one gets a rule it leaves the list.
  assert.deepEqual([...MARKERS].filter((name) => defined.has(name)), []);
});
