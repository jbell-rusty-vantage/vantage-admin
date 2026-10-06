import assert from "node:assert/strict";
import test from "node:test";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DashboardRoleProvider } from "../components/layout/dashboard-role-context";
import { CompatibilityObservationStatement } from "../components/operations-registry/compatibility-observation-statement";
import { RegistryHealthFindings } from "../components/operations-registry/registry-health-findings";
import { CONNECTIONS_COPY } from "../components/setup/connections/connections-copy";
import { googleSheetUrl, granotFindings, masterSheetLinks, summarizeRoutes } from "../components/setup/connections/connections-model";
import { MasterSheetLines, RouteSummaryView } from "../components/setup/connections/partner-cards";
import { RegistryCard, remainingCompatibilityReads } from "../components/setup/connections/registry-card";
import type { RegistryHealth, RegistryHealthFinding, RegistryOverview } from "../lib/api/operationsRegistry";
import type { RingCentralRoute } from "../lib/api/registryRingCentral";
import type { SourceCompanyItem } from "../lib/api/registrySources";
import { findOwnerMarkupLeaks } from "../lib/operations-registry/ownerLanguageDeck";

/*
 * Setup → Connections & health (doc 19): the inbound number summary, the Master Sheet links, the Granot findings
 * filter, and the quiet Registry card (signing status, the old static list observation, the restyled findings list
 * with its typed links into the Setup routes).
 */

const html = (element: ReactElement, role: "owner" | "admin" = "owner") =>
  renderToStaticMarkup(createElement(QueryClientProvider, { client: new QueryClient() }, DashboardRoleProvider({ role, children: element })))
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"');

const route = (id: string, extra: Partial<RingCentralRoute> = {}): RingCentralRoute => ({
  id,
  provider: "ringcentral",
  phone_number: "+19545550142",
  phone_locked: false,
  display_label: "Inbound",
  active: true,
  ever_activated: true,
  observed_target_names: [],
  validation_status: "valid",
  created_from: "admin",
  ...extra,
});

const company = (id: string, name: string, extra: Partial<SourceCompanyItem> = {}): SourceCompanyItem => ({
  id,
  _id: id,
  company_slug: name.toLowerCase().replace(/\s+/g, "-"),
  name,
  owner_label: name,
  aliases: [],
  active: true,
  sheet_config: { has_bad_tabs: false, projection_mode: "derived_import" },
  created_from: "test",
  ...extra,
});

const finding = (code: string, extra: Partial<RegistryHealthFinding> = {}): RegistryHealthFinding => ({
  code,
  severity: "warn",
  summary: "Something needs a look",
  first_observed_at: "2026-10-01T12:00:00.000Z",
  last_observed_at: "2026-10-05T12:00:00.000Z",
  actionable: true,
  ...extra,
});

test("the inbound number summary counts verified, not checked, invalid, filing and stopped, and skips archived numbers", () => {
  const summary = summarizeRoutes([
    route("r1"),
    route("r2", { validation_status: "unvalidated", active: false }),
    route("r3", { validation_status: "invalid", active: false }),
    route("r4", { validation_status: "valid", active: false }),
    route("r5", { archived_at: "2026-09-01T00:00:00.000Z", active: false }),
  ]);
  assert.deepEqual(summary, { total: 4, verified: 2, notChecked: 1, invalid: 1, filing: 1, stopped: 3 });
  assert.deepEqual(summarizeRoutes([]), { total: 0, verified: 0, notChecked: 0, invalid: 0, filing: 0, stopped: 0 });
});

test("Master Sheet links come from each active lead source's spreadsheet id, and a missing one says so", () => {
  const links = masterSheetLinks([
    company("c1", "Best Relocation", { sheet_config: { spreadsheet_id: "1AbC_def-9", has_bad_tabs: false, projection_mode: "derived_import" } }),
    company("c2", "No Sheet Co"),
    company("c3", "Retired Co", { active: false, sheet_config: { spreadsheet_id: "zzz", has_bad_tabs: false, projection_mode: "derived_import" } }),
  ]);
  assert.deepEqual(links, [
    { key: "c1", name: "Best Relocation", href: "https://docs.google.com/spreadsheets/d/1AbC_def-9" },
    { key: "c2", name: "No Sheet Co", href: null },
  ]);
  assert.equal(googleSheetUrl("a b"), "https://docs.google.com/spreadsheets/d/a%20b");

  const markup = html(createElement(MasterSheetLines, { links }));
  assert.match(markup, /href="https:\/\/docs.google.com\/spreadsheets\/d\/1AbC_def-9"/);
  assert.match(markup, /rel="noopener noreferrer"/);
  assert.match(markup, /No Master Sheet/);
  assert.deepEqual(findOwnerMarkupLeaks(markup), []);
});

test("the RingCentral numbers block names the checks and links to the numbers view", () => {
  const markup = html(createElement(RouteSummaryView, { summary: { total: 7, verified: 5, notChecked: 1, invalid: 1, filing: 6, stopped: 1 } }));
  assert.match(markup, /7 numbers/);
  assert.match(markup, /5 verified/);
  assert.match(markup, /1 not checked/);
  assert.match(markup, /1 invalid/);
  assert.match(markup, /6 filing calls/);
  assert.match(markup, /1 stopped/);
  assert.match(markup, /href="\/setup\/lead-sources\?view=numbers"/);
  assert.deepEqual(findOwnerMarkupLeaks(markup), []);
});

test("Granot findings are the ones about Granot names", () => {
  const list = [
    finding("a", { entity_type: "granot_crm_source", entity_id: "g1" }),
    finding("b", { entity_type: "granot_automation_source", entity_id: "g2" }),
    finding("c", { entity_type: "ringcentral_route" }),
    finding("d"),
  ];
  assert.deepEqual(granotFindings(list).map((entry) => entry.code), ["a", "b"]);
});

test("health findings keep their typed links, now into the Setup routes, and never print ids as link text", () => {
  const objectId = "64b0f0f0f0f0f0f0f0f0f0f0";
  const list = [
    finding("ringcentral.route_invalid", {
      severity: "error",
      summary: "An inbound number failed its check",
      entity_type: "ringcentral_route",
      entity_id: objectId,
      remediation: { summary: "Check the number against RingCentral.", action: "validate_ringcentral_route" },
      evidence: { validation_status: "invalid", call_lead_count: 3 },
    }),
    finding("granot.name_unfiled", { entity_type: "granot_crm_source", entity_id: objectId, remediation: { summary: "File it under a feed.", action: "review_source_lifecycle" } }),
    finding("registry.signing", { severity: "info", actionable: false, remediation: { summary: "Set the secret.", action: "configure_env" } }),
  ];
  const owner = html(createElement(RegistryHealthFindings, { findings: list }));
  assert.match(owner, /href="\/setup\/lead-sources\?view=numbers&number=64b0f0f0f0f0f0f0f0f0f0f0"/);
  assert.match(owner, /Open inbound number/);
  assert.match(owner, /Check this number against RingCentral/);
  assert.match(owner, /href="\/setup\/lead-sources\?view=granot&granot=64b0f0f0f0f0f0f0f0f0f0f0"/);
  assert.doesNotMatch(owner, /operations-registry/);
  // Errors sort first.
  assert.ok(owner.indexOf("An inbound number failed its check") < owner.indexOf("Something needs a look"));
  // The id is only ever inside an href or the collapsed Advanced block.
  assert.deepEqual(findOwnerMarkupLeaks(owner), []);

  const admin = html(createElement(RegistryHealthFindings, { findings: list }), "admin");
  assert.doesNotMatch(admin, /Check this number against RingCentral/);
  assert.match(admin, /Remediation requires the owner role/);
  assert.deepEqual(findOwnerMarkupLeaks(admin), []);

  const none = html(createElement(RegistryHealthFindings, { findings: [] }));
  assert.match(none, /No health findings/);
});

test("the old static list observation counts reads and says zero proves nothing", () => {
  const one = html(createElement(CompatibilityObservationStatement, { remainingReads: 1 }));
  assert.match(one, /1 compatibility read used/);
  const many = html(createElement(CompatibilityObservationStatement, { remainingReads: 2 }));
  assert.match(many, /2 compatibility reads used/);
  assert.match(many, /zero does not prove the list is unused/);
  assert.doesNotMatch(many, /—/);
  assert.deepEqual(findOwnerMarkupLeaks(many), []);
});

test("the Registry card shows the signing status, the observation and the full findings list", () => {
  const overview: RegistryOverview = {
    generated_at: "2026-10-06T14:00:00.000Z",
    counts: {
      agents_total: 4,
      agents_active: 4,
      merchants_total: 1,
      merchants_active: 1,
      source_companies_total: 5,
      source_companies_active: 5,
      source_granularities_total: 9,
      source_granularities_active: 8,
      ringcentral_routes_total: 7,
      ringcentral_routes_active: 6,
      registry_changes_total: 120,
    },
    signing: { secret_configured: true, preview_unsigned_allowed: false, signature_max_age_ms: 300000 },
  };
  const health: RegistryHealth = {
    generated_at: "2026-10-06T14:01:00.000Z",
    findings: [
      finding("registry.compatibility_reads_remaining", { severity: "info", actionable: false, evidence: { read_count: 2 } }),
      finding("ringcentral.route_invalid", { severity: "error", entity_type: "ringcentral_route", entity_id: "r1" }),
    ],
  };
  assert.equal(remainingCompatibilityReads(health), 2);
  assert.equal(remainingCompatibilityReads({ ...health, findings: [] }), 0);

  const markup = html(createElement(RegistryCard, { overview, health, error: null, fetching: false, onRefresh() {} }));
  assert.match(markup, /Signing status/);
  assert.match(markup, /Proxy signing secret configured/);
  assert.match(markup, /300000 ms/);
  assert.match(markup, /1 error · 0 warning · 2 total/);
  assert.match(markup, /2 compatibility reads used/);
  assert.match(markup, /href="\/setup\/changes"/);
  assert.match(markup, /href="\/setup\/lead-sources\?view=numbers&number=r1"/);
  assert.deepEqual(findOwnerMarkupLeaks(markup), []);

  const failed = html(createElement(RegistryCard, { overview: undefined, health: undefined, error: new Error("down"), fetching: false, onRefresh() {} }));
  assert.match(failed, /did not load/);
  const loading = html(createElement(RegistryCard, { overview: undefined, health: undefined, error: null, fetching: true, onRefresh() {} }));
  assert.match(loading, /Loading/);
});

test("Connections copy uses glossary words and no em-dashes", () => {
  const copy = CONNECTIONS_COPY;
  const strings = [
    copy.granot.subtitle,
    copy.ringcentral.subtitle,
    copy.ringcentral.verified(2),
    copy.ringcentral.notChecked(1),
    copy.ringcentral.captureUnavailable,
    copy.sheets.hint,
    copy.sheets.open("Best Relocation"),
    copy.bestRelocation.subtitle,
    copy.registry.subtitle,
    copy.registry.generated("a", "b"),
  ].join(" ");
  assert.deepEqual(findOwnerMarkupLeaks(strings), []);
  assert.doesNotMatch(strings, /—/);
});
