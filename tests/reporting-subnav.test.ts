import assert from "node:assert/strict";
import test from "node:test";
import { reportingTabForPath } from "../components/reporting/reporting-subnav";
import { REPORTING_COPY } from "../components/reporting/reporting-copy";

test("reporting tabs isolate reports, create, and sheets", () => {
  assert.equal(reportingTabForPath("/reporting"), "reports");
  assert.equal(reportingTabForPath("/reporting/6aa2fb591a467731b85b4dbe"), "reports");
  assert.equal(reportingTabForPath("/reporting/runs/run-1"), "reports");
  assert.equal(reportingTabForPath("/reporting/new"), "create");
  assert.equal(reportingTabForPath("/reporting/6aa2fb591a467731b85b4dbe/edit"), "create");
  assert.equal(reportingTabForPath("/reporting/destinations"), "sheets");
  assert.equal(reportingTabForPath("/reporting/destinations/dest-1"), "sheets");
});

test("reporting copy uses sheet-creating language", () => {
  assert.equal(REPORTING_COPY.tabCreate, "Create New Report");
  assert.equal(REPORTING_COPY.saveReport, "Save Report Before Sheet Creation");
  assert.equal(REPORTING_COPY.createSheet, "Create or Edit Sheet");
  assert.match(REPORTING_COPY.listHint, /Save a report/);
  assert.equal(REPORTING_COPY.exampleSheetsTitle, "Example sheets");
  assert.match(REPORTING_COPY.exampleSheetsHint, /Mock rows only/);
});
