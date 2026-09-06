import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MANUAL_COPY } from "../components/manual/manual-copy";
import { operationalConfigs } from "../components/operational/operational-configs";
import { OPERATIONAL_COPY } from "../components/operational/operational-copy";
import { filterGroupForKey } from "../components/operational/operational-filter-groups";
import { SheetContainsPanel } from "../components/operational/sheet-contains-panel";
import type { SheetContainsItem, SheetContainsResult } from "../lib/api/admin";

function readRepo(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function quotedLiterals(source: string): string[] {
  return [...source.matchAll(/["'`](?:\\.|[^\\"'`])*["'`]/g)].map((match) => match[0]);
}

function leadContainsItem(overrides: Partial<SheetContainsItem> = {}): SheetContainsItem {
  return {
    id: "507f1f77bcf86cd799439011",
    entity_model: "CallLead",
    label: "Lead",
    verdict: "not_expected",
    expected_tabs: [],
    missing_expected_tabs: [],
    found: [],
    sheet_sync_hint: [],
    ...overrides,
  };
}

function renderContains(item: SheetContainsItem): string {
  const result: SheetContainsResult = {
    entity_model: item.entity_model,
    checked_at: "2026-09-06T00:00:00.000Z",
    items: [item],
  };
  return renderToStaticMarkup(
    createElement(SheetContainsPanel, {
      open: true,
      result,
      isChecking: false,
      onClose: () => undefined,
    }),
  );
}

function hiddenColumn(resource: "form-leads" | "call-leads") {
  return operationalConfigs[resource].columns.find((column) => column.key === "no_sync");
}

function hiddenFilter(resource: "form-leads" | "call-leads") {
  return operationalConfigs[resource].filters.find((filter) => filter.key === "no_sync");
}

test("filterGroupForKey places Hidden from Master Leads in Status", () => {
  assert.equal(filterGroupForKey("no_sync"), "status");
});

test("both lead desks have Hidden from Master Leads filter after cancelled and boolean column", () => {
  const label = OPERATIONAL_COPY.hideFromMasterLeads.hiddenLabel;
  assert.equal(label, "Hidden from Master Leads");

  for (const resource of ["form-leads", "call-leads"] as const) {
    const keys = operationalConfigs[resource].filters.map((filter) => filter.key);
    assert.equal(keys[keys.indexOf("cancelled") + 1], "no_sync");

    const filter = hiddenFilter(resource);
    assert.ok(filter);
    assert.equal(filter?.label, label);
    assert.equal(filter?.type, "select");
    assert.deepEqual(
      filter?.options?.map((option) => option.label),
      ["Yes", "No"],
    );

    const column = hiddenColumn(resource);
    assert.ok(column);
    assert.equal(column?.label, label);
    assert.equal(column?.path, "no_sync");
    assert.equal(column?.format, "boolean");
  }
});

test("contains panel shows the No-Sync sentence and keeps unmatched copy", () => {
  const hidden = renderContains(leadContainsItem({ reason: "no_sync" }));
  assert.match(hidden, /Not expected/);
  assert.match(hidden, new RegExp(OPERATIONAL_COPY.sheetContains.hiddenFromMasterLeads));
  assert.doesNotMatch(hidden, new RegExp(OPERATIONAL_COPY.sheetContains.unmatchedCall));

  const unmatched = renderContains(leadContainsItem({ reason: "created_on_unmatched" }));
  assert.match(unmatched, new RegExp(OPERATIONAL_COPY.sheetContains.unmatchedCall));
  assert.doesNotMatch(unmatched, new RegExp(OPERATIONAL_COPY.sheetContains.hiddenFromMasterLeads));
});

test("Owner-visible desk and Manual copy do not print no_sync or Hide from Sheets", () => {
  assert.equal(MANUAL_COPY.hideFromMasterLeads, "Hide from Master Leads");
  assert.doesNotMatch(MANUAL_COPY.hideFromMasterLeads, /no_sync/);
  assert.doesNotMatch(OPERATIONAL_COPY.hideFromMasterLeads.hiddenLabel, /no_sync/);
  assert.doesNotMatch(OPERATIONAL_COPY.sheetContains.hiddenFromMasterLeads, /no_sync/);
  assert.doesNotMatch(OPERATIONAL_COPY.sheetContains.unmatchedCall, /Hide from Sheets/);

  for (const relativePath of [
    "components/manual/create-lead-form.tsx",
    "components/manual/manual-copy.ts",
    "components/operational/sheet-contains-panel.tsx",
    "components/operational/operational-copy.ts",
  ]) {
    const literals = quotedLiterals(readRepo(relativePath));
    for (const literal of literals) {
      assert.doesNotMatch(literal, /no_sync/);
      assert.doesNotMatch(literal, /Hide from Sheets/);
    }
  }
});
