import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  formatSourceHierarchyLabel,
  hasSourceGranularities,
  shouldUseSourceCompanyHierarchy,
  sourceCompanyChartLabel,
  sourceCompanyChartRows,
  sourceCompanyParentKey,
  sourceCompanyRowLabel,
  sourceGranularityRowLabel,
  SourceCompanyHierarchyTable,
} from "../components/data-table/source-company-hierarchy-table";

test("source hierarchy prefers registry labels over keys", () => {
  assert.equal(
    sourceCompanyRowLabel({
      source_company: "tbm_prime_leads",
      source_company_label: "TBM Prime Leads",
    }),
    "TBM Prime Leads",
  );
  assert.equal(
    sourceGranularityRowLabel({
      source_granularity_key: "tbm_prime_leads_call",
      source_granularity_label: "TBM Prime Inbounds",
    }),
    "TBM Prime Inbounds",
  );
});

test("source hierarchy supports any number of children and flat rows", () => {
  assert.equal(
    hasSourceGranularities({
      source_company: "best_relocation_leads",
      granularities: [
        { source_granularity_key: "best_relocation_form_local" },
        { source_granularity_key: "best_relocation_form_long_distance" },
        { source_granularity_key: "best_relocation_call" },
      ],
    }),
    true,
  );
  assert.equal(hasSourceGranularities({ source_company: "historical_source" }), false);
  assert.equal(hasSourceGranularities({ source_company: "historical_source", granularities: [] }), false);
});

test("source hierarchy humanizes missing registry labels", () => {
  assert.equal(formatSourceHierarchyLabel("main_site_form"), "Main Site Form");
  assert.equal(sourceCompanyRowLabel({ source_company: "main_site" }), "Main Site");
  assert.equal(
    sourceGranularityRowLabel({ source_granularity_key: "unknown" }),
    "Unknown",
  );
});

test("historical source reports use hierarchy rows with stable unique keys", () => {
  const rows = [
    {
      source_company: "main_site",
      source_company_label: "Vantage Movers",
      granularities: [],
    },
    {
      source_company: "tbm_prime_leads",
      source_company_label: "TBM Prime Leads",
      granularities: [],
    },
  ];

  assert.equal(
    shouldUseSourceCompanyHierarchy("source-company-performance", rows),
    true,
  );
  assert.equal(
    shouldUseSourceCompanyHierarchy("agent-performance", rows),
    false,
  );
  const keys = rows.map(sourceCompanyParentKey);
  assert.equal(new Set(keys).size, rows.length);
  assert.equal(
    sourceCompanyParentKey(rows[0], 0),
    sourceCompanyParentKey(rows[0], 1),
  );
  assert.equal(
    sourceCompanyParentKey(rows[1], 1),
    sourceCompanyParentKey(rows[1], 0),
  );

  const markup = renderToStaticMarkup(
    createElement(SourceCompanyHierarchyTable, {
      rows,
      columns: [],
    }),
  );
  assert.equal((markup.match(/Vantage Movers/g) ?? []).length, 1);
  assert.equal((markup.match(/TBM Prime Leads/g) ?? []).length, 1);
  assert.doesNotMatch(markup, /Source Company Label/);
});

test("source hierarchy uses native table disclosure semantics", () => {
  const rows = [
    {
      source_company: "main_site",
      source_company_label: "Vantage Movers",
      granularities: [
        {
          source_granularity_key: "main_site_form",
          source_granularity_label: "Main Site Forms",
        },
        {
          source_granularity_key: "main_site_call",
          source_granularity_label: "Main Site Calls",
        },
      ],
    },
  ];
  const expandedMarkup = renderToStaticMarkup(
    createElement(SourceCompanyHierarchyTable, {
      rows,
      columns: [],
      defaultExpanded: true,
    }),
  );
  const collapsedMarkup = renderToStaticMarkup(
    createElement(SourceCompanyHierarchyTable, {
      rows,
      columns: [],
      defaultExpanded: false,
    }),
  );

  assert.doesNotMatch(expandedMarkup, /treegrid|aria-level/);
  assert.match(
    expandedMarkup,
    /<button[^>]*type="button"[^>]*aria-label="Collapse Vantage Movers"[^>]*aria-expanded="true"/,
  );
  assert.match(
    collapsedMarkup,
    /<button[^>]*aria-label="Expand Vantage Movers"[^>]*aria-expanded="false"/,
  );
  const controls = expandedMarkup.match(/aria-controls="([^"]+)"/)?.[1];
  assert.ok(controls);
  for (const id of controls.split(" ")) {
    assert.match(expandedMarkup, new RegExp(`id="${escapeRegex(id)}"`));
    assert.match(collapsedMarkup, new RegExp(`id="${escapeRegex(id)}"`));
  }
  assert.match(collapsedMarkup, /<tr[^>]*hidden=""/);
});

test("source chart labels prefer canonical company labels and stay parent-only", () => {
  const rows = sourceCompanyChartRows([
    {
      source_company: "tbm_prime_leads",
      source_company_label: "TBM Prime Leads",
      granularities: [
        {
          source_granularity_key: "tbm_prime_leads_form",
          source_granularity_label: "TBM Prime Forms",
        },
      ],
    },
  ]);

  assert.equal(rows.length, 1);
  assert.equal("granularities" in rows[0], false);
  assert.equal(sourceCompanyChartLabel(rows[0]), "TBM Prime Leads");
  assert.equal(
    sourceCompanyChartLabel({ source_company: "tbm_prime_leads" }),
    "tbm_prime_leads",
  );
});

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
