import test from "node:test";
import assert from "node:assert/strict";
import { apiFiltersFromUrlState } from "../../components/operational/operational-url-state";
import { officialRecordHref, salesIntelligenceReturnHref, currentSalesIntelligenceHref } from "../../components/sales-intelligence/lib/official-record";
import type { TableQueryParams } from "./types";

test("official-record hrefs stay operational with panel=summary", () => {
  const href = officialRecordHref("FormLead", "lead-1", "/sales-intelligence?view=attention&outreach=abc");
  assert.match(href, /^\/form-leads\?record=lead-1/);
  assert.doesNotMatch(href, /database_scope/);
  assert.match(href, /panel=summary/);
  assert.equal(href.includes("/observational"), false);
  assert.match(href, /si_return=/);
  const booking = officialRecordHref("BookedLead", "book-1");
  assert.match(booking, /^\/bookings\?record=book-1/);
  assert.match(booking, /panel=summary/);
});

test("sales intelligence return only accepts this workspace", () => {
  assert.equal(salesIntelligenceReturnHref("si_return=%2Fform-leads"), null);
  assert.equal(salesIntelligenceReturnHref("si_return=%2Fsales-intelligence%3Fview%3Dattention"), "/sales-intelligence?view=attention");
  assert.equal(currentSalesIntelligenceHref(new URLSearchParams("number=n1")), "/sales-intelligence?number=n1");
  assert.equal(currentSalesIntelligenceHref(new URLSearchParams()), "/sales-intelligence");
});

test("apiFiltersFromUrlState drops si_return; a valid return still parses", () => {
  const filters = {
    database_scope: "production",
    page: 1,
    limit: 50,
    q: "smith",
    record: "lead-1",
    panel: "summary",
    si_return: "/sales-intelligence?view=attention",
  } as TableQueryParams;
  const apiFilters = apiFiltersFromUrlState(filters);
  assert.equal("si_return" in apiFilters, false);
  assert.equal("record" in apiFilters, false);
  assert.equal("panel" in apiFilters, false);
  assert.equal(apiFilters.q, "smith");
  assert.equal(
    salesIntelligenceReturnHref(new URLSearchParams({ si_return: String(filters.si_return) })),
    "/sales-intelligence?view=attention",
  );
});
