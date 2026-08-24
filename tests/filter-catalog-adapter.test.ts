import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import type { FilterCatalogGranularity } from "../lib/api/admin";
import {
  selectedSourceGranularityKey,
  sourceCompanyOptionsForLeadType,
  sourceGranularitySelectOptions,
} from "../lib/api/facets";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function granularity(
  overrides: Partial<FilterCatalogGranularity> & Pick<FilterCatalogGranularity, "granularity_key" | "owner_label">,
): FilterCatalogGranularity {
  return {
    id: overrides.id ?? overrides.granularity_key,
    source_company_id: "company-1",
    company_slug: "top10_leads",
    company_owner_label: "Top 10 Forms",
    channel: "form",
    active: true,
    origin: "registry",
    ...overrides,
  };
}

const catalogRows: FilterCatalogGranularity[] = [
  granularity({ granularity_key: "top10_leads_form", owner_label: "Top10 Forms", channel: "form" }),
  granularity({
    granularity_key: "top10_leads_call",
    owner_label: "Top10 Inbounds",
    channel: "call",
    company_owner_label: "Top 10 Forms",
  }),
  granularity({
    id: "inactive-form",
    granularity_key: "legacy_form",
    owner_label: "Legacy Forms",
    channel: "form",
    active: false,
  }),
];

test("Source Company options are catalog granularities labeled with owner_label", () => {
  assert.deepEqual(sourceGranularitySelectOptions(catalogRows, "form"), [
    { value: "top10_leads_form", label: "Top10 Forms" },
    { value: "legacy_form", label: "Legacy Forms (inactive)" },
  ]);
  assert.deepEqual(sourceGranularitySelectOptions(catalogRows, "call"), [
    { value: "top10_leads_call", label: "Top10 Inbounds" },
  ]);
  assert.equal(sourceGranularitySelectOptions(undefined).length, 0);
});

test("Lead type narrowing keeps a selected key while the catalog is loading", () => {
  assert.equal(
    selectedSourceGranularityKey("top10_leads_form", undefined, "form"),
    "top10_leads_form",
  );
  assert.equal(
    selectedSourceGranularityKey("TOP10_LEADS_FORM", catalogRows, "form"),
    "TOP10_LEADS_FORM",
  );
  assert.equal(selectedSourceGranularityKey("top10_leads_form", catalogRows, "call"), undefined);
});

test("Analytics Source Company options narrow by Lead type", () => {
  assert.deepEqual(
    sourceCompanyOptionsForLeadType(catalogRows, "form").map((option) => option.value),
    ["top10_leads_form", "legacy_form"],
  );
  assert.deepEqual(
    sourceCompanyOptionsForLeadType(catalogRows, "call").map((option) => option.value),
    ["top10_leads_call"],
  );
  assert.equal(sourceCompanyOptionsForLeadType(catalogRows).length, 3);
});

test("listed lead and analytics surfaces do not import hardcoded source maps", () => {
  const listed = [
    "app/(dashboard)/form-leads/page.tsx",
    "app/(dashboard)/call-leads/page.tsx",
    "app/(dashboard)/duplicate-form-leads/page.tsx",
    "app/(dashboard)/duplicate-call-leads/page.tsx",
    "components/analytics/analytics-dashboard.tsx",
    "lib/api/facets.ts",
  ];
  for (const file of listed) {
    const source = readFileSync(join(root, file), "utf8");
    assert.doesNotMatch(
      source,
      /SOURCE_COMPANY_OPTIONS|FORM_LEAD_SOURCE_LABEL_OPTIONS|CALL_LEAD_SOURCE_LABEL_OPTIONS|fetchLeadSourceCompanies/,
      file,
    );
  }
});

test("lead browse and edit submit source_granularity_key as the one Source Company control", () => {
  const operational = readFileSync(join(root, "components/operational/operational-resource-page.tsx"), "utf8");
  const analytics = readFileSync(join(root, "components/analytics/analytics-dashboard.tsx"), "utf8");

  assert.match(operational, /key: "source_granularity_key",\s*label: "Source Company"/);
  assert.doesNotMatch(operational, /hasOption\(field, "tbm_leads"\)/);
  assert.doesNotMatch(operational, /FORM_LEAD_SOURCE_LABEL_OPTIONS|CALL_LEAD_SOURCE_LABEL_OPTIONS/);
  assert.match(operational, /payload\[field\.key\] = raw/);
  assert.match(operational, /name=\{field\.key\}/);
  assert.match(
    operational,
    /source_granularity_key: value,\s*source_company: null/,
  );

  assert.match(analytics, /label="Source Company"/);
  assert.doesNotMatch(analytics, /label="Source granularity"/);
  assert.doesNotMatch(analytics, /label="Source company"/);
  assert.equal((analytics.match(/label="Source Company"/g) ?? []).length, 1);
});
