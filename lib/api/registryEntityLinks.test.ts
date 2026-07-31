import assert from "node:assert/strict";
import test from "node:test";
import {
  adminAuditRequestHref,
  humanizeRegistryKey,
  registryEntityHref,
  remediationTarget,
} from "./registryEntityLinks";

test("registryEntityHref covers company, granularity, CPL, correction, route, agent, merchant", () => {
  assert.deepEqual(registryEntityHref("agent", "a1"), {
    href: "/operations-registry?tab=agents&entity=a1",
    label: "Open agent",
  });
  assert.deepEqual(registryEntityHref("merchant", "m1"), {
    href: "/operations-registry?tab=merchants&entity=m1",
    label: "Open merchant",
  });
  assert.deepEqual(registryEntityHref("source_company", "c1"), {
    href: "/operations-registry?tab=sources&entity=c1",
    label: "Open source company",
  });
  assert.deepEqual(registryEntityHref("source_granularity", "g1"), {
    href: "/operations-registry?tab=sources&granularity=g1",
    label: "Open granularity",
  });
  assert.deepEqual(registryEntityHref("cpl_schedule", "p1"), {
    href: "/operations-registry?tab=cpl&cpl_mode=advanced&entity=p1",
    label: "Open CPL schedule",
  });
  assert.deepEqual(registryEntityHref("cpl_correction_job", "j1"), {
    href: "/operations-registry?tab=cpl&cpl_mode=corrections&entity=j1",
    label: "Open correction job",
  });
  assert.deepEqual(registryEntityHref("ringcentral_route", "r1"), {
    href: "/operations-registry?tab=ringcentral&entity=r1",
    label: "Open RingCentral route",
  });
  assert.deepEqual(registryEntityHref("ringcentral_assignment", "r1"), {
    href: "/operations-registry?tab=ringcentral&entity=r1",
    label: "Open RingCentral route",
  });
});

test("registryEntityHref encodes ids and handles overview-only entity types", () => {
  assert.equal(
    registryEntityHref("source_company", "a/b c")?.href,
    "/operations-registry?tab=sources&entity=a%2Fb%20c",
  );
  assert.equal(registryEntityHref("registry_cache", null)?.href, "/operations-registry");
  assert.equal(registryEntityHref("registry_migration", "x")?.href, "/operations-registry");
  assert.equal(registryEntityHref("unknown", "x"), null);
  assert.equal(registryEntityHref(undefined, "x"), null);
});

test("remediationTarget maps typed actions without inferring from summary text", () => {
  assert.equal(
    remediationTarget("validate_ringcentral_route", "ringcentral_route", "r1").href,
    "/operations-registry?tab=ringcentral&entity=r1",
  );
  assert.equal(remediationTarget("validate_ringcentral_route", "ringcentral_route", "r1").ownerActionable, true);
  assert.equal(
    remediationTarget("preview_cpl_correction", "cpl_schedule", "p1").href,
    "/operations-registry?tab=cpl&cpl_mode=corrections",
  );
  assert.equal(
    remediationTarget("set_source_default", "source_company", "c1").href,
    "/operations-registry?tab=sources&entity=c1",
  );
  assert.equal(remediationTarget("configure_env").ownerActionable, false);
  assert.match(remediationTarget("configure_env").reviewGuidance ?? "", /VANTAGE_ADMIN_PROXY_SIGNING_SECRET/);
  assert.equal(remediationTarget("refresh_registry_cache").ownerActionable, false);
  assert.equal(remediationTarget(undefined).reviewGuidance?.includes("typed remediation"), true);
});

test("adminAuditRequestHref builds Owner audit correlation link", () => {
  assert.equal(adminAuditRequestHref("req-1"), "/audit-log?request_id=req-1");
  assert.equal(adminAuditRequestHref("a/b"), "/audit-log?request_id=a%2Fb");
  assert.equal(adminAuditRequestHref(null), null);
});

test("humanizeRegistryKey formats codes", () => {
  assert.equal(humanizeRegistryKey("registry.cpl_missing_rate_leads"), "Registry Cpl Missing Rate Leads");
  assert.equal(humanizeRegistryKey(null), "-");
});
