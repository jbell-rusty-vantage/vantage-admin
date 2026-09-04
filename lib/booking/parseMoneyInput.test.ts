import assert from "node:assert/strict";
import test from "node:test";
import { normalizeMoneyInput, parseMoneyInput } from "./parseMoneyInput";

test("parseMoneyInput strips $ signs, commas, and spaces", () => {
  assert.equal(parseMoneyInput("$100"), 100);
  assert.equal(parseMoneyInput("$1,234.56"), 1234.56);
  assert.equal(parseMoneyInput("  $ 50.25  "), 50.25);
  assert.equal(parseMoneyInput("0"), 0);
  assert.equal(parseMoneyInput("100.5"), 100.5);
});

test("parseMoneyInput rejects invalid money strings", () => {
  assert.equal(parseMoneyInput(""), undefined);
  assert.equal(parseMoneyInput("$"), undefined);
  assert.equal(parseMoneyInput("abc"), undefined);
  assert.equal(parseMoneyInput("-10"), undefined);
  assert.equal(parseMoneyInput("10.999"), undefined);
  assert.equal(parseMoneyInput("$10.999"), undefined);
});

test("normalizeMoneyInput only strips currency decoration", () => {
  assert.equal(normalizeMoneyInput("$1,000.00"), "1000.00");
  assert.equal(normalizeMoneyInput("  $ 12 "), "12");
});
