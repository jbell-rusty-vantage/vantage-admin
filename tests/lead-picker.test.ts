import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LeadPicker } from "../components/records/lead-picker";
import {
  choiceProblem,
  LEAD_PICKER_COPY,
  LEAD_PICKER_DEFAULT_SCOPE,
  leadNeedsReason,
  leadPickerEndpoint,
  leadPickerQuery,
  leadPickerShowsScope,
} from "../components/records/lead-picker-copy";

test("the picker opens on this job's source, and every source is a toggle", () => {
  assert.equal(LEAD_PICKER_DEFAULT_SCOPE, "source");
  assert.equal(LEAD_PICKER_COPY.scopeSource, "This job's source");
  assert.equal(LEAD_PICKER_COPY.scopeAll, "Every source");
});

test("the reason box is needed only for an out-of-scope lead, and then needs 10 to 500 characters", () => {
  assert.equal(leadNeedsReason({ requires_override_reason: false }), false);
  assert.equal(leadNeedsReason({ requires_override_reason: true }), true);
  assert.equal(choiceProblem({ requires_override_reason: false }, ""), undefined);
  assert.ok(choiceProblem({ requires_override_reason: true }, ""));
  assert.ok(choiceProblem({ requires_override_reason: true }, "short"));
  assert.equal(choiceProblem({ requires_override_reason: true }, "same person, same phone"), undefined);
  assert.ok(choiceProblem({ requires_override_reason: true }, "x".repeat(501)));
});

test("each entry point reads its own existing endpoint", () => {
  assert.equal(leadPickerEndpoint({ caseId: "case-1" }), "case-candidates");
  assert.equal(leadPickerEndpoint({ caseId: "case-1", bookingId: "b1" }), "case-candidates");
  assert.equal(leadPickerEndpoint({ bookingId: "b1" }), "connect-candidates");
  assert.equal(leadPickerEndpoint({}), "none");
  assert.equal(leadPickerShowsScope("case-candidates"), true);
  assert.equal(leadPickerShowsScope("connect-candidates"), false);
  assert.equal(leadPickerShowsScope("none"), false);
});

test("the search text goes through the Leads classifier", () => {
  assert.equal(leadPickerQuery(""), undefined);
  assert.equal(leadPickerQuery(null), undefined);
  assert.equal(leadPickerQuery("P5563723"), "5563723");
  assert.equal(leadPickerQuery("(281) 900-1836"), "2819001836");
  assert.equal(leadPickerQuery("Steve Dority"), "Steve Dority");
  assert.equal(leadPickerQuery("s@example.com"), "s@example.com");
});

test("the picker renders its search box and scope chips for a case, no scope chips for a booking", () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrap = (props: Parameters<typeof LeadPicker>[0]) =>
    renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(LeadPicker, props)));
  const lead = wrap({ caseId: "case-1", onChoose: () => undefined });
  assert.match(lead, /Job number, phone, email or name/);
  assert.match(lead, /This job&#x27;s source/);
  assert.match(lead, /Every source/);
  const connect = wrap({ bookingId: "b1", onChoose: () => undefined });
  assert.equal(connect.includes("Every source"), false);
});
