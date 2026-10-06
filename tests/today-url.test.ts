import assert from "node:assert/strict";
import test from "node:test";
import { isMoneyEndpointMissing, MoneyRequestError, moneySpendUrl, MONEY_SPEND_PATH } from "../lib/api/money";
import { parseTodayTab, TODAY_TABS, todayTabHref, todayTabsFor } from "../components/today/today-url";

test("parseTodayTab: unknown or missing values are Pulse for the owner", () => {
  assert.equal(parseTodayTab(null, "owner"), "pulse");
  assert.equal(parseTodayTab(undefined, "owner"), "pulse");
  assert.equal(parseTodayTab("nonsense", "owner"), "pulse");
  assert.equal(parseTodayTab("pulse", "owner"), "pulse");
  assert.equal(parseTodayTab("operations", "owner"), "operations");
  assert.equal(parseTodayTab("team", "owner"), "team");
  assert.equal(parseTodayTab("money", "owner"), "money");
});

test("parseTodayTab: a manager only ever gets Operations", () => {
  for (const value of [null, "pulse", "team", "money", "operations", "x"]) {
    assert.equal(parseTodayTab(value, "manager"), "operations");
  }
});

test("todayTabsFor: owner four tabs, manager Operations, admin none", () => {
  assert.deepEqual(todayTabsFor("owner").map((tab) => tab.value), ["pulse", "operations", "team", "money"]);
  assert.deepEqual(todayTabsFor("manager").map((tab) => tab.value), ["operations"]);
  assert.deepEqual(todayTabsFor("admin"), []);
  assert.deepEqual(todayTabsFor(null), []);
});

test("TODAY_TABS carry labels and icons; hrefs keep Pulse as the bare root", () => {
  assert.deepEqual(TODAY_TABS.map((tab) => tab.label), ["Pulse", "Operations", "Team", "Money"]);
  assert.ok(TODAY_TABS.every((tab) => Boolean(tab.icon)));
  assert.equal(todayTabHref("pulse"), "/");
  assert.equal(todayTabHref("operations"), "/?tab=operations");
  assert.equal(todayTabHref("money"), "/?tab=money");
});

test("Money client: path, url and the missing-endpoint check", () => {
  assert.equal(MONEY_SPEND_PATH, "api/v1/admin/money/spend");
  assert.equal(moneySpendUrl("this_week"), "/api/proxy/api/v1/admin/money/spend?range=this_week");
  assert.equal(isMoneyEndpointMissing(new MoneyRequestError("Request failed (404).", 404)), true);
  assert.equal(isMoneyEndpointMissing(new MoneyRequestError("boom", 500)), false);
  assert.equal(isMoneyEndpointMissing(new Error("Request failed (404 Not Found).")), true);
  assert.equal(isMoneyEndpointMissing(new Error("Request failed (500).")), false);
  assert.equal(isMoneyEndpointMissing(null), false);
});
