import assert from "node:assert/strict";
import test from "node:test";
import {
  columnLetter,
  formatSheetExampleCell,
  REPORTING_SHEET_EXAMPLE_ORDER,
  REPORTING_SHEET_EXAMPLES,
  reportingSheetExampleLabel,
} from "./sheet-examples";

test("sheet examples cover the three catalog datasets at schema 1", () => {
  assert.deepEqual(REPORTING_SHEET_EXAMPLE_ORDER, [
    "lead_outcome_detail",
    "lead_quality_exceptions",
    "source_performance",
  ]);
  for (const key of REPORTING_SHEET_EXAMPLE_ORDER) {
    const example = REPORTING_SHEET_EXAMPLES[key];
    assert.equal(example.key, key);
    assert.equal(example.schemaVersion, 1);
    assert.match(reportingSheetExampleLabel(example), /@ 1$/);
    assert.ok(example.columns.length > 0);
    assert.ok(example.rows.length >= 3);
    for (const row of example.rows) {
      for (const column of example.columns) {
        assert.ok(column.id in row, `${key} mock row is missing ${column.id}`);
      }
    }
  }
});

test("lead outcome example uses default catalog columns and omits lead_id", () => {
  const columns = REPORTING_SHEET_EXAMPLES.lead_outcome_detail.columns.map((column) => column.id);
  assert.equal(columns[0], "lead_type");
  assert.ok(!columns.includes("lead_id"));
  assert.ok(columns.includes("primary_job_number"));
  assert.ok(columns.includes("cancelled_or_refunded"));
});

test("quality exception example uses default catalog columns", () => {
  assert.deepEqual(
    REPORTING_SHEET_EXAMPLES.lead_quality_exceptions.columns.map((column) => column.id),
    [
      "exception_type",
      "date_basis",
      "exception_timestamp",
      "source_company",
      "source_granularity",
      "summary",
      "operational_status",
      "related_record_count",
    ],
  );
});

test("source performance example includes period, sources, and measures", () => {
  const columns = REPORTING_SHEET_EXAMPLES.source_performance.columns.map((column) => column.id);
  assert.deepEqual(columns.slice(0, 3), ["period", "source_company", "source_granularity"]);
  assert.ok(columns.includes("lead_to_booking_conversion"));
  assert.ok(columns.includes("resolved_cpl_spend"));
  assert.equal(
    REPORTING_SHEET_EXAMPLES.source_performance.columns.find((column) => column.id === "resolved_cpl_spend")
      ?.label,
    "Resolved CPL Spend",
  );
});

test("example cells stay obviously fictional", () => {
  const phones = REPORTING_SHEET_EXAMPLES.lead_outcome_detail.rows.map((row) => row.customer_phone);
  const emails = REPORTING_SHEET_EXAMPLES.lead_outcome_detail.rows.map((row) => row.customer_email);
  assert.ok(phones.every((phone) => phone == null || String(phone).startsWith("555-")));
  assert.ok(emails.every((email) => email == null || String(email).endsWith("@example.com")));
});

test("column letters and cell formatting match a spreadsheet", () => {
  assert.equal(columnLetter(0), "A");
  assert.equal(columnLetter(25), "Z");
  assert.equal(columnLetter(26), "AA");
  assert.equal(formatSheetExampleCell(true), "TRUE");
  assert.equal(formatSheetExampleCell(false), "FALSE");
  assert.equal(formatSheetExampleCell(null), "");
  assert.equal(formatSheetExampleCell(0.209), "0.209");
  assert.throws(() => columnLetter(-1), /non-negative/);
});
