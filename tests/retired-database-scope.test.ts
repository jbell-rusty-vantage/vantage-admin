import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function source(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test("the dashboard mounts the retired-scope cleanup instead of a scope provider or selector", () => {
  const layout = source("app/(dashboard)/layout.tsx");
  assert.match(layout, /<RetiredDatabaseScopeCleanup \/>/);
  assert.doesNotMatch(layout, /DatabaseScopeProvider/);

  const shell = source("components/layout/dashboard-shell.tsx");
  assert.match(shell, /<GlobalSearch \/>/);
  assert.doesNotMatch(shell, /ScopeAwareHeaderControls/);

  assert.equal(existsSync(path.join(root, "components/layout/database-scope-selector.tsx")), false);
  assert.equal(existsSync(path.join(root, "components/layout/scope-aware-header-controls.tsx")), false);
});

test("the cleanup forgets the persisted scope and replaces URLs that still carry it", () => {
  const cleanup = source("lib/state/database-scope.tsx");
  assert.match(cleanup, /localStorage\.removeItem\(RETIRED_STORAGE_KEY\)/);
  assert.match(cleanup, /"vantage\.database_scope"/);
  assert.match(cleanup, /withoutRetiredDatabaseScope/);
  assert.match(cleanup, /router\.replace\(/);
  assert.doesNotMatch(cleanup, /setItem|createContext/);
});
