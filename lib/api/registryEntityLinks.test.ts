import assert from "node:assert/strict";
import test from "node:test";
import {
  humanizeRegistryKey,
  ownerWords,
  registryEntityHref,
  remediationTarget,
} from "./registryEntityLinks";

test("registryEntityHref covers company, feed, lead costs, inbound numbers, Granot names", () => {
  // Setup move: every href now points into /setup/* (doc 19 "Routes") instead of /operations-registry?tab=.
  // An Agent opens the person card: ?person=<id> on /setup/people.
  assert.deepEqual(registryEntityHref("agent", "a1"), {
    href: "/setup/people?person=a1",
    label: "Open agent",
  });
  // Merchants have no per-record key in Setup, so the link opens the Money section.
  assert.deepEqual(registryEntityHref("merchant", "m1"), {
    href: "/setup/money",
    label: "Open merchant",
  });
  // A lead source opens as ?source=<id> on the Lead sources tree.
  assert.deepEqual(registryEntityHref("source_company", "c1"), {
    href: "/setup/lead-sources?source=c1",
    label: "Open lead source",
  });
  // A feed opens as ?feed=<id> on the Lead sources tree.
  assert.deepEqual(registryEntityHref("source_granularity", "g1"), {
    href: "/setup/lead-sources?feed=g1",
    label: "Open feed",
  });
  // Lead cost schedules have no per-record key; the grid is the default view of /setup/lead-costs.
  assert.deepEqual(registryEntityHref("cpl_schedule", "p1"), {
    href: "/setup/lead-costs",
    label: "Open lead cost schedule",
  });
  // Corrections are the "fix" view of Lead costs.
  assert.deepEqual(registryEntityHref("cpl_correction_job", "j1"), {
    href: "/setup/lead-costs?view=fix",
    label: "Open correction job",
  });
  // Inbound numbers are the "numbers" view of Lead sources with ?number=<id>.
  assert.deepEqual(registryEntityHref("ringcentral_route", "r1"), {
    href: "/setup/lead-sources?view=numbers&number=r1",
    label: "Open inbound number",
  });
  assert.deepEqual(registryEntityHref("ringcentral_assignment", "r1"), {
    href: "/setup/lead-sources?view=numbers&number=r1",
    label: "Open inbound number",
  });
  // Granot names are the "granot" view of Lead sources with ?granot=<id>.
  assert.deepEqual(registryEntityHref("granot_crm_source", "s1"), {
    href: "/setup/lead-sources?view=granot&granot=s1",
    label: "Open Granot name",
  });
  assert.deepEqual(registryEntityHref("granot_automation_source", "a1"), {
    href: "/setup/lead-sources?view=granot&granot=a1",
    label: "Open Granot name",
  });
});

test("registryEntityHref encodes ids and handles overview-only entity types", () => {
  // The id is encoded by the Setup link builder (URLSearchParams writes a space as "+").
  assert.equal(
    registryEntityHref("source_company", "a/b c")?.href,
    "/setup/lead-sources?source=a%2Fb+c",
  );
  // The Registry overview is no longer a page; its signing status and health findings live on Connections & health.
  assert.equal(registryEntityHref("registry_cache", null)?.href, "/setup/connections");
  assert.equal(registryEntityHref("registry_migration", "x")?.href, "/setup/connections");
  assert.equal(registryEntityHref("unknown", "x"), null);
  assert.equal(registryEntityHref(undefined, "x"), null);
  // Without an id the link opens the section, and says "all" in its label.
  assert.deepEqual(registryEntityHref("source_company", null), {
    href: "/setup/lead-sources",
    label: "Open lead sources",
  });
});

test("remediationTarget maps typed actions without inferring from summary text", () => {
  // Inbound number remediation lands on the numbers view with the number open.
  assert.equal(
    remediationTarget("validate_ringcentral_route", "ringcentral_route", "r1").href,
    "/setup/lead-sources?view=numbers&number=r1",
  );
  assert.equal(remediationTarget("validate_ringcentral_route", "ringcentral_route", "r1").ownerActionable, true);
  // Corrections are the "fix" view of Lead costs.
  assert.equal(
    remediationTarget("preview_cpl_correction", "cpl_schedule", "p1").href,
    "/setup/lead-costs?view=fix",
  );
  // A lead source opens as ?source=<id>.
  assert.equal(
    remediationTarget("set_source_default", "source_company", "c1").href,
    "/setup/lead-sources?source=c1",
  );
  // Without an entity the remediation falls back to the section itself.
  assert.equal(remediationTarget("edit_cpl_schedule").href, "/setup/lead-costs");
  assert.equal(remediationTarget("edit_ringcentral_route").href, "/setup/lead-sources?view=numbers");
  assert.equal(remediationTarget("review_source_lifecycle").href, "/setup/lead-sources");
  // Migration evidence is the Change history section.
  assert.equal(remediationTarget("review_migration_manifests").href, "/setup/changes");
  // Cache and compatibility evidence sit on Connections & health (the Registry card).
  assert.equal(remediationTarget("refresh_registry_cache").href, "/setup/connections");
  assert.equal(remediationTarget("review_compatibility_reads").href, "/setup/connections");
  assert.equal(remediationTarget("configure_env").ownerActionable, false);
  assert.match(remediationTarget("configure_env").reviewGuidance ?? "", /VANTAGE_ADMIN_PROXY_SIGNING_SECRET/);
  assert.equal(remediationTarget("refresh_registry_cache").ownerActionable, false);
});

test("no Setup link still points at the retired Operations Registry page", () => {
  const types = [
    "agent",
    "merchant",
    "source_company",
    "source_granularity",
    "cpl_schedule",
    "cpl_correction_job",
    "ringcentral_route",
    "granot_crm_source",
    "registry",
  ];
  for (const type of types) {
    assert.doesNotMatch(registryEntityHref(type, "x")?.href ?? "", /operations-registry/);
  }
  for (const action of ["edit_cpl_schedule", "validate_ringcentral_route", "set_source_default", "review_migration_manifests", "refresh_registry_cache"]) {
    assert.doesNotMatch(remediationTarget(action, "source_company", "x").href ?? "", /operations-registry/);
  }
});

test("humanizeRegistryKey stays stable", () => {
  assert.equal(humanizeRegistryKey("lead_source"), "Lead Source");
});

test("ownerWords says engineering names in the glossary words", () => {
  assert.equal(ownerWords("owner_label"), "name");
  assert.equal(ownerWords("validation status"), "check result");
  assert.equal(ownerWords("default_form_granularity"), "default_form_feed");
  assert.equal(ownerWords("link_only"), "link only");
  // Evidence keys shown on a finding use it through humanizeRegistryKey.
  assert.equal(humanizeRegistryKey("validation_status"), "Check Result");
  assert.equal(humanizeRegistryKey("source_granularity"), "Source Feed");
});
