import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry) ? [full] : [];
  });
}

test("retired dashboard destinations and their BFFs have no route", () => {
  for (const route of [
    "app/(dashboard)/customers",
    "app/(dashboard)/agents",
    "app/(dashboard)/exports",
    "app/(dashboard)/audit-log",
    "app/(dashboard)/conversations",
    "app/(dashboard)/live-events",
    "app/(dashboard)/observational",
    "app/(dashboard)/reports",
    "app/(dashboard)/ingestion/granot/live",
    "app/api/audit-log",
    "app/api/granot-live-receipts",
  ]) {
    assert.equal(existsSync(path.join(root, route)), false, route);
  }
});

test("no dashboard code writes or reads the Admin Audit Log", () => {
  assert.equal(existsSync(path.join(root, "server/audit")), false);
  assert.equal(existsSync(path.join(root, "server/models/AdminAuditLog.ts")), false);
  const offenders = ["app", "components", "lib", "server"]
    .flatMap((dir) => sourceFiles(path.join(root, dir)))
    .filter((file) => !file.endsWith(".test.ts"))
    .filter((file) => /writeAuditLog|AdminAuditLog|admin_audit_logs/.test(readFileSync(file, "utf8")))
    .map((file) => path.relative(root, file));
  assert.deepEqual(offenders, []);
});
