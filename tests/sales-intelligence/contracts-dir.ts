import fs from "node:fs";
import path from "node:path";
import test from "node:test";

/*
 * Where the contract fixtures live. They sit next to vantage-admin in the multi-repo folder
 * (`<repo>/../sales-intelligence-ui-ux-workspace/contracts`, ~45 MB, not in git). A git worktree (e.g. under
 * %TEMP%) has no such sibling, so the main checkout named in the worktree's `.git` file is tried next.
 * `SI_CONTRACTS_DIR`, when set, overrides both (it is the only candidate).
 *
 * A checkout without the workspace (the deploy runner) finds nothing: the fixture tests skip with
 * FIXTURES_UNAVAILABLE instead of failing at load.
 */
export const WORKSPACE_CONTRACTS = "sales-intelligence-ui-ux-workspace/contracts";
export const FIXTURES_UNAVAILABLE =
  "fixtures unavailable: sales-intelligence-ui-ux-workspace/contracts not found (run locally next to the workspace or set SI_CONTRACTS_DIR)";

/** The candidate folders, in order. */
export function contractCandidates(): string[] {
  if (process.env.SI_CONTRACTS_DIR) return [process.env.SI_CONTRACTS_DIR];
  const repo = path.resolve(__dirname, "../..");
  const tried = [path.resolve(repo, "..", WORKSPACE_CONTRACTS)];
  try {
    const gitdir = /^gitdir:\s*(.+)$/m.exec(fs.readFileSync(path.join(repo, ".git"), "utf8"))?.[1]?.trim();
    // `<main checkout>/.git/worktrees/<name>` → `<main checkout>/../sales-intelligence-ui-ux-workspace/contracts`
    if (gitdir) tried.push(path.resolve(gitdir, "..", "..", "..", "..", WORKSPACE_CONTRACTS));
  } catch { /* a normal checkout has a .git folder, not a file */ }
  return tried;
}

let found: string | null | undefined;
/** The fixture folder, or null. A candidate counts only when it holds `S1/` (a stray `contracts/` with just a manifest does not). */
export function findContractsDir(): string | null {
  if (found === undefined) found = contractCandidates().find((candidate) => fs.existsSync(path.join(candidate, "S1"))) ?? null;
  return found;
}

/** The fixture folder; throws when it is missing. */
export function requireContracts(): string {
  const dir = findContractsDir();
  if (!dir) throw new Error(`contracts not found; tried ${contractCandidates().join(", ")}`);
  return dir;
}

/** A test that reads fixtures: skipped with FIXTURES_UNAVAILABLE when there are none. */
export function fixtureTest(name: string, fn: () => void | Promise<void>): void {
  test(name, { skip: findContractsDir() ? false : FIXTURES_UNAVAILABLE }, fn);
}

/** A module-scope fixture read, deferred to `undefined` when there are no fixtures (only fixture tests use it). */
export function ifFixtures<T>(read: () => T): T {
  return findContractsDir() ? read() : (undefined as T);
}
