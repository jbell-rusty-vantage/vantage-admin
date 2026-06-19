import assert from "node:assert/strict";
import test from "node:test";
import {
  filtersToQueryString,
  getDatePresetRange,
  parseTableQueryParams,
  serializeFilters,
  withLegacyPagination,
} from "./filters";

test("serializeFilters omits empty values and serializes arrays", () => {
  const params = serializeFilters({
    q: "smith",
    empty: "",
    missing: undefined,
    booked: true,
    source_company: ["main_site", "top10_leads"],
  });

  assert.equal(params.get("q"), "smith");
  assert.equal(params.get("booked"), "true");
  assert.deepEqual(params.getAll("source_company"), ["main_site", "top10_leads"]);
  assert.equal(params.has("empty"), false);
  assert.equal(params.has("missing"), false);
});

test("filtersToQueryString returns an empty string when no filters are present", () => {
  assert.equal(filtersToQueryString({ q: "", booked: undefined }), "");
  assert.equal(filtersToQueryString({ q: "lead" }), "?q=lead");
});

test("parseTableQueryParams applies defaults and parses scope", () => {
  const parsed = parseTableQueryParams(
    new URLSearchParams("page=2&limit=100&database_scope=historical&direction=desc&q=abc"),
  );

  assert.equal(parsed.page, 2);
  assert.equal(parsed.limit, 100);
  assert.equal(parsed.database_scope, "historical");
  assert.equal(parsed.direction, "desc");
  assert.equal(parsed.q, "abc");
});

test("withLegacyPagination converts page to skip", () => {
  assert.deepEqual(withLegacyPagination({ page: 3, limit: 25, q: "lead" }), {
    limit: 25,
    q: "lead",
    skip: 50,
  });
});

test("getDatePresetRange calculates stable Florida calendar date ranges", () => {
  const now = new Date("2026-05-31T12:00:00.000Z");

  assert.deepEqual(getDatePresetRange("last_7_days", now), {
    from: "2026-05-25",
    to: "2026-05-31",
  });
  assert.deepEqual(getDatePresetRange("previous_month", now), {
    from: "2026-04-01",
    to: "2026-04-30",
  });
});
