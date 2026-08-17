import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchGranotCrmSource,
  fetchGranotCrmSources,
  setGranotCrmSourceActivation,
  updateGranotCrmSource,
} from "./registryGranotCrmSources";

test("Granot CRM source client uses the signed Registry proxy and never sends create_if_missing", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return new Response(
      JSON.stringify({
        ok: true,
        data: {
          items: [
            {
              id: "aaaaaaaaaaaaaaaaaaaaaaaa",
              granot_label: "Referral",
              enabled: true,
              lifecycle_enabled: true,
              lifecycle_disposition: "referral_booking",
              lead_created_policy: "observation_only",
              lifecycle_routes: [],
              lifecycle_policy_version: "granot-lifecycle-source-policy-v1",
              default_channel: "unknown",
              automation_sources: [],
            },
          ],
        },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;

  try {
    const items = await fetchGranotCrmSources();
    assert.equal(items[0]?.lead_created_policy, "observation_only");
    assert.ok(calls[0]?.url.includes("/api/proxy/api/v1/admin/granot-crm-sources"));
    await fetchGranotCrmSource("aaaaaaaaaaaaaaaaaaaaaaaa");
    await updateGranotCrmSource("aaaaaaaaaaaaaaaaaaaaaaaa", {
      granot_label: "Referral",
      lifecycle_enabled: true,
      lifecycle_disposition: "referral_booking",
      lead_created_policy: "observation_only",
      lifecycle_routes: [],
      reason: "Reviewed Referral policy after Owner inspection",
    });
    const updateBody = JSON.parse(String(calls.at(-1)?.init?.body));
    assert.equal(updateBody.lead_created_policy, "observation_only");
    assert.equal("create_if_missing" in updateBody, false);
    assert.equal("normalized_granot_label" in updateBody, false);
    await setGranotCrmSourceActivation("aaaaaaaaaaaaaaaaaaaaaaaa", {
      lifecycle_enabled: false,
      reason: "Disable reviewed source after Owner rollback review",
    });
    assert.ok(String(calls.at(-1)?.url).endsWith("/activation"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
