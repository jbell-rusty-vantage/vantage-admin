import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { operationalConfigs } from "../components/operational/operational-configs";
import { OPERATIONAL_COPY, filterGroupTitle } from "../components/operational/operational-copy";
import {
  filterGroupForKey,
  filterGroupHasActiveValue,
  filterGroupStartsOpen,
  filtersInGroup,
  visibleFilterGroups,
  type FilterGroupId,
} from "../components/operational/operational-filter-groups";
import { GroupedFilterFields } from "../components/operational/operational-filter-panel";
import type { TableQueryParams } from "../lib/api/types";

const root = process.cwd();

const OPERATIONAL_PAGE_FILES = [
  "components/operational/operational-resource-page.tsx",
  "components/operational/operational-filter-panel.tsx",
  "app/(dashboard)/form-leads/page.tsx",
  "app/(dashboard)/call-leads/page.tsx",
  "app/(dashboard)/bookings/page.tsx",
  "app/(dashboard)/cancellations/page.tsx",
  "app/(dashboard)/duplicate-form-leads/page.tsx",
  "app/(dashboard)/duplicate-call-leads/page.tsx",
];

function emptyFilters(): TableQueryParams {
  return { page: 1, limit: 25 };
}

test("every FilterConfig.key is in exactly one group; unknown keys fail", () => {
  const membership = new Map<string, FilterGroupId>();

  for (const [resource, config] of Object.entries(operationalConfigs)) {
    const seenOnResource = new Set<string>();
    for (const filter of config.filters) {
      const group = filterGroupForKey(filter.key);
      assert.notEqual(group, "find", `${resource}.${filter.key} must not be a Find FilterConfig key`);
      assert.equal(seenOnResource.has(filter.key), false, `${resource} lists ${filter.key} twice`);
      seenOnResource.add(filter.key);

      const previous = membership.get(filter.key);
      if (previous) {
        assert.equal(previous, group, `${filter.key} must stay in one group`);
      } else {
        membership.set(filter.key, group);
      }
    }
  }

  assert.throws(
    () => filterGroupForKey("bad_lead"),
    /Unknown operational filter key has no group: bad_lead/,
  );
  assert.throws(
    () => filterGroupForKey("sms_message_sent"),
    /Unknown operational filter key has no group/,
  );
});

test("visible groups omit empty Status, Attribution, and Record headers", () => {
  assert.deepEqual(visibleFilterGroups(operationalConfigs["form-leads"].filters), [
    "find",
    "status",
    "attribution",
    "record",
  ]);
  assert.deepEqual(visibleFilterGroups(operationalConfigs.bookings.filters), [
    "find",
    "status",
    "attribution",
    "record",
  ]);
  assert.deepEqual(visibleFilterGroups(operationalConfigs.cancellations.filters), [
    "find",
    "attribution",
    "record",
  ]);
});

test("operational configs cover only the official Lead, Booking and Cancellation lists", () => {
  assert.deepEqual(Object.keys(operationalConfigs).sort(), [
    "bookings",
    "call-leads",
    "cancellations",
    "duplicate-call-leads",
    "duplicate-form-leads",
    "form-leads",
  ]);
});

test("an active Attribution URL value forces Attribution open", () => {
  const formFilters = operationalConfigs["form-leads"].filters;
  assert.equal(filterGroupStartsOpen("find", false), true);
  assert.equal(filterGroupStartsOpen("status", false), true);
  assert.equal(filterGroupStartsOpen("attribution", false), false);
  assert.equal(filterGroupStartsOpen("record", false), false);

  assert.equal(
    filterGroupHasActiveValue("attribution", formFilters, { source_granularity_key: "main_site" }),
    true,
  );
  assert.equal(filterGroupStartsOpen("attribution", true), true);
  assert.equal(filterGroupHasActiveValue("attribution", formFilters, {}), false);
  assert.equal(
    filterGroupHasActiveValue("status", formFilters, { booked: "true" }),
    true,
  );
});

test("Reset rebuilds the URL with no query and chips call that reset", () => {
  const urlState = readFileSync(path.join(root, "lib/api/url-state.ts"), "utf8");
  const resetStart = urlState.indexOf("const reset = useCallback");
  const resetEnd = urlState.indexOf("return {", resetStart);
  assert.notEqual(resetStart, -1);
  assert.notEqual(resetEnd, -1);
  const reset = urlState.slice(resetStart, resetEnd);
  assert.match(reset, /router\.push\(pathname\)/);
  assert.doesNotMatch(reset, /database_scope/);
  assert.doesNotMatch(reset, /params\.set\(/);

  const panel = readFileSync(path.join(root, "components/operational/operational-filter-panel.tsx"), "utf8");
  assert.match(panel, /function ActiveFilterChips/);
  assert.match(panel, /onClick=\{reset\}/);

  const page = readFileSync(path.join(root, "components/operational/operational-resource-page.tsx"), "utf8");
  assert.match(page, /vantage-admin-operational-filters-collapsed/);
  assert.match(page, /setSelected\(null\);\s*resetUrl\(\)/);
});

test("operational pages do not import Observational FilterBar", () => {
  for (const relative of OPERATIONAL_PAGE_FILES) {
    const source = readFileSync(path.join(root, relative), "utf8");
    assert.doesNotMatch(source, /filters\/filter-bar/);
    assert.doesNotMatch(source, /FilterBar/);
  }
});

test("form-leads render Find and Status open; Attribution stays closed until a member is active", () => {
  const config = operationalConfigs["form-leads"];
  const unused = renderToStaticMarkup(
    createElement(GroupedFilterFields, {
      config,
      filters: emptyFilters(),
      update: () => undefined,
      setSort: () => undefined,
    }),
  );

  assert.match(unused, new RegExp(OPERATIONAL_COPY.filterGroups.find));
  assert.match(unused, new RegExp(OPERATIONAL_COPY.filterGroups.status));
  assert.match(unused, new RegExp(OPERATIONAL_COPY.filterGroups.attribution));
  assert.match(unused, new RegExp(OPERATIONAL_COPY.filterGroups.recordFields));
  assert.match(unused, /Name, phone, email, or ID/);
  assert.match(unused, />Booked</);
  assert.doesNotMatch(unused, /Receiver agent/);
  assert.doesNotMatch(unused, />Ref number</);

  const activeAttribution = renderToStaticMarkup(
    createElement(GroupedFilterFields, {
      config,
      filters: { ...emptyFilters(), source_granularity_key: "main_site" },
      update: () => undefined,
      setSort: () => undefined,
    }),
  );
  assert.match(activeAttribution, /Source Company/);
  assert.doesNotMatch(activeAttribution, />Ref number</);
});

test("cancellations omit an empty Status group", () => {
  const html = renderToStaticMarkup(
    createElement(GroupedFilterFields, {
      config: operationalConfigs.cancellations,
      filters: emptyFilters(),
      update: () => undefined,
      setSort: () => undefined,
    }),
  );
  assert.match(html, new RegExp(OPERATIONAL_COPY.filterGroups.find));
  assert.match(html, new RegExp(OPERATIONAL_COPY.filterGroups.attribution));
  assert.match(html, new RegExp(OPERATIONAL_COPY.filterGroups.recordFields));
  assert.doesNotMatch(html, /data-filter-group="status"/);
  assert.equal(filtersInGroup(operationalConfigs.cancellations.filters, "status").length, 0);
});

test("Hidden from Master Leads Status filter is grouped and does not throw", () => {
  assert.equal(filterGroupForKey("no_sync"), "status");
  assert.equal(filterGroupForKey("cancelled"), "status");

  const formKeys = operationalConfigs["form-leads"].filters.map((filter) => filter.key);
  const callKeys = operationalConfigs["call-leads"].filters.map((filter) => filter.key);
  assert.equal(formKeys[formKeys.indexOf("cancelled") + 1], "no_sync");
  assert.equal(callKeys[callKeys.indexOf("cancelled") + 1], "no_sync");
});

test("Owner group titles live in the copy module", () => {
  assert.equal(filterGroupTitle("find"), "Find");
  assert.equal(filterGroupTitle("status"), "Status");
  assert.equal(filterGroupTitle("attribution"), "Attribution");
  assert.equal(filterGroupTitle("record"), "Record fields");
});
