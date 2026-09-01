import assert from "node:assert/strict";
import test from "node:test";
import {
  adminAuditRequestHref,
  humanizeRegistryKey,
  registryEntityHref,
  remediationTarget,
} from "./registryEntityLinks";

test("registryEntityHref covers company, feed, lead costs, inbound numbers, Granot names", () => {
  assert.deepEqual(registryEntityHref("agent", "a1"), {
    href: "/operations-registry?tab=agents&entity=a1",
    label: "Open agent",
  });
  assert.deepEqual(registryEntityHref("merchant", "m1"), {
    href: "/operations-registry?tab=merchants&entity=m1",
    label: "Open merchant",
  });
  assert.deepEqual(registryEntityHref("source_company", "c1"), {
    href: "/operations-registry?tab=lead-sources&entity=c1",
    label: "Open lead source",
  });
  assert.deepEqual(registryEntityHref("source_granularity", "g1"), {
    href: "/operations-registry?tab=lead-sources&feed=g1",
    label: "Open feed",
  });
  assert.deepEqual(registryEntityHref("cpl_schedule", "p1"), {
    href: "/operations-registry?tab=lead-costs&cpl_mode=advanced&entity=p1",
    label: "Open lead cost schedule",
  });
  assert.deepEqual(registryEntityHref("cpl_correction_job", "j1"), {
    href: "/operations-registry?tab=lead-costs&cpl_mode=corrections&entity=j1",
    label: "Open correction job",
  });
  assert.deepEqual(registryEntityHref("ringcentral_route", "r1"), {
    href: "/operations-registry?tab=inbound-numbers&entity=r1",
    label: "Open inbound number",
  });
  assert.deepEqual(registryEntityHref("ringcentral_assignment", "r1"), {
    href: "/operations-registry?tab=inbound-numbers&entity=r1",
    label: "Open inbound number",
  });
  assert.deepEqual(registryEntityHref("granot_crm_source", "s1"), {
    href: "/operations-registry?tab=granot-names&entity=s1",
    label: "Open Granot name",
  });
  assert.deepEqual(registryEntityHref("granot_automation_source", "a1"), {
    href: "/operations-registry?tab=granot-names&entity=a1",
    label: "Open Granot name",
  });
});

test("registryEntityHref encodes ids and handles overview-only entity types", () => {
  assert.equal(
    registryEntityHref("source_company", "a/b c")?.href,
    "/operations-registry?tab=lead-sources&entity=a%2Fb%20c",
  );
  assert.equal(registryEntityHref("registry_cache", null)?.href, "/operations-registry");
  assert.equal(registryEntityHref("registry_migration", "x")?.href, "/operations-registry");
  assert.equal(registryEntityHref("unknown", "x"), null);
  assert.equal(registryEntityHref(undefined, "x"), null);
});

test("remediationTarget maps typed actions without inferring from summary text", () => {
  assert.equal(
    remediationTarget("validate_ringcentral_route", "ringcentral_route", "r1").href,
    "/operations-registry?tab=inbound-numbers&entity=r1",
  );
  assert.equal(remediationTarget("validate_ringcentral_route", "ringcentral_route", "r1").ownerActionable, true);
  assert.equal(
    remediationTarget("preview_cpl_correction", "cpl_schedule", "p1").href,
    "/operations-registry?tab=lead-costs&cpl_mode=corrections",
  );
  assert.equal(
    remediationTarget("set_source_default", "source_company", "c1").href,
    "/operations-registry?tab=lead-sources&entity=c1",
  );
  assert.equal(remediationTarget("configure_env").ownerActionable, false);
  assert.match(remediationTarget("configure_env").reviewGuidance ?? "", /VANTAGE_ADMIN_PROXY_SIGNING_SECRET/);
  assert.equal(remediationTarget("refresh_registry_cache").ownerActionable, false);
});

test("adminAuditRequestHref and humanizeRegistryKey stay stable", () => {
  assert.equal(adminAuditRequestHref("req-1"), "/audit-log?request_id=req-1");
  assert.equal(humanizeRegistryKey("lead_source"), "Lead Source");
});
