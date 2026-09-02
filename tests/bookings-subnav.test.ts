import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { isBookingsTabActive } from "../components/bookings/bookings-subnav";

test("All Bookings is active only on the exact bookings list", () => {
  assert.equal(isBookingsTabActive("/bookings", "/bookings"), true);
  assert.equal(isBookingsTabActive("/bookings/reconciliation", "/bookings"), false);
  assert.equal(isBookingsTabActive("/bookings/new", "/bookings"), false);
});

test("child bookings tabs do not stay highlighted together", () => {
  assert.equal(isBookingsTabActive("/bookings/reconciliation", "/bookings/reconciliation"), true);
  assert.equal(isBookingsTabActive("/bookings/reconciliation", "/bookings/new"), false);
  assert.equal(isBookingsTabActive("/bookings/new", "/bookings/new"), true);
  assert.equal(isBookingsTabActive("/bookings/new", "/bookings/reconciliation"), false);
  assert.equal(isBookingsTabActive("/bookings", "/bookings/reconciliation"), false);
  assert.equal(isBookingsTabActive("/bookings", "/bookings/new"), false);
});

test("dashboard chrome scrolls the page body, not the navbar", () => {
  const shell = readFileSync(
    path.join(process.cwd(), "components/layout/dashboard-shell.tsx"),
    "utf8",
  );
  const table = readFileSync(
    path.join(process.cwd(), "components/data-table/table-shell.tsx"),
    "utf8",
  );
  const filters = readFileSync(
    path.join(process.cwd(), "components/operational/operational-filter-panel.tsx"),
    "utf8",
  );

  assert.match(shell, /h-svh overflow-hidden/);
  assert.match(shell, /DASHBOARD_MAIN_ID/);
  assert.match(shell, /min-h-0 flex-1 overflow-y-auto/);
  assert.doesNotMatch(shell, /sticky top-0 z-10/);
  assert.match(table, /isolate overflow-hidden/);
  assert.match(table, /Scroll row left/);
  assert.match(table, /Scroll row right/);
  assert.match(table, /right-full/);
  assert.doesNotMatch(table, /Scroll table left/);
  assert.doesNotMatch(table, /right-16/);
  assert.match(filters, /sticky top-0/);
  assert.doesNotMatch(filters, /sticky top-24/);
});
