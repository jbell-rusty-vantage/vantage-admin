import assert from "node:assert/strict";
import test from "node:test";
import { parseOfficialBookingDetails } from "./officialBookingDetails";
import { splitBinderEvenly } from "./splitBinderEvenly";

test("official booking details send one Binder and up to two Agent IDs", () => {
  const one = parseOfficialBookingDetails({
    bookDate: "2026-08-20",
    deposit: "100.25",
    binder: "100.01",
    merchantId: "m".repeat(24),
    primaryAgentId: "a".repeat(24),
    secondaryAgentId: "",
  });
  assert.deepEqual(one.details, {
    book_date: "2026-08-20",
    deposit_amount: 100.25,
    total_binder_amount: 100.01,
    merchant_id: "m".repeat(24),
    primary_agent_id: "a".repeat(24),
  });
  const two = parseOfficialBookingDetails({
    bookDate: "2026-08-20",
    deposit: "0",
    binder: "100.01",
    merchantId: "m".repeat(24),
    primaryAgentId: "a".repeat(24),
    secondaryAgentId: "b".repeat(24),
  });
  assert.equal(two.details?.secondary_agent_id, "b".repeat(24));
  assert.deepEqual(splitBinderEvenly(100.01, 2), [50.01, 50]);
});

test("official booking details accept $ and comma-formatted money", () => {
  const parsed = parseOfficialBookingDetails({
    bookDate: "2026-08-20",
    deposit: "$1,000.25",
    binder: " $50 ",
    merchantId: "m".repeat(24),
    primaryAgentId: "a".repeat(24),
    secondaryAgentId: "",
  });
  assert.equal(parsed.errors.length, 0);
  assert.equal(parsed.details?.deposit_amount, 1000.25);
  assert.equal(parsed.details?.total_binder_amount, 50);
});

test("official booking details reject a matching secondary Agent or per-agent amounts", () => {
  const same = parseOfficialBookingDetails({
    bookDate: "2026-08-20",
    deposit: "10",
    binder: "10",
    merchantId: "m".repeat(24),
    primaryAgentId: "a".repeat(24),
    secondaryAgentId: "a".repeat(24),
  });
  assert.match(same.errors.join(" "), /different/);
  assert.equal(same.details, undefined);
});
