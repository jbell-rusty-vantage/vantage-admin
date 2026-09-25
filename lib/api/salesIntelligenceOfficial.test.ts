import test from "node:test";
import assert from "node:assert/strict";
import { apiFiltersFromUrlState } from "../../components/operational/operational-url-state";
import { officialRecordHref, salesIntelligenceReturnHref, currentSalesIntelligenceHref } from "../../components/sales-intelligence/lib/official-record";
import { runningSummaryText } from "../../components/sales-intelligence/_legacy/running-summary-panel";
import { guideHref, parseGuideTopic, parseSiPanel, parseSiView } from "../../components/sales-intelligence/sales-intelligence-tabs";
import type { TableQueryParams } from "./types";

test("official-record hrefs stay operational with panel=summary", () => {
  const href = officialRecordHref("FormLead", "lead-1", "/sales-intelligence?view=attention&outreach=abc");
  assert.match(href, /^\/form-leads\?record=lead-1/);
  assert.match(href, /database_scope=production/);
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
  assert.equal(currentSalesIntelligenceHref(new URLSearchParams("view=numbers&number=n1")), "/sales-intelligence?view=numbers&number=n1");
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

test("Running Summary reads running_analysis text, not a run output", () => {
  assert.equal(runningSummaryText({ text: "Current number picture", computed_at: "2026-09-20T12:00:00.000Z", run_id: "run-1" }), "Current number picture");
  assert.equal(runningSummaryText(null), null);
  assert.equal(parseSiPanel("summary"), "summary");
  assert.equal(parseSiPanel("analysis"), "analysis");
  assert.equal(parseSiView("guide"), "guide");
  assert.equal(parseGuideTopic("summary"), "summary");
  assert.equal(guideHref("summary"), "/sales-intelligence?view=guide&topic=summary");
});
