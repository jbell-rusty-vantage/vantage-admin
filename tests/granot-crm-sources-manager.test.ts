import assert from "node:assert/strict";
import test from "node:test";
import { renderGranotLeadSmsPreview } from "../lib/operations-registry/smsPreview";

test("SMS preview uses Vantage Movers, empty first name, and appended opt-out", () => {
  assert.equal(
    renderGranotLeadSmsPreview({
      template: "Hi {first_name}, this is Vantage Movers. We got your request.",
    }),
    "Hi there, this is Vantage Movers. We got your request. Reply STOP to opt out.",
  );
  assert.equal(
    renderGranotLeadSmsPreview({
      template: "Hi {first_name} from {company}.",
      first_name: "Maria",
    }),
    "Hi Maria from Vantage Movers. Reply STOP to opt out.",
  );
});
