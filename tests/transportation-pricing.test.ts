import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DashboardRoleProvider } from "../components/layout/dashboard-role-context";
import { TransportationPricingSection } from "../components/setup/transportation-pricing-section";
import { groupProblem } from "../components/setup/transportation-pricing-panels";
import { collisions, emptyConfiguration, newGroup, parseRate, pricingRequest, PricingError, saveConfiguration, type Configuration } from "../lib/transportation-pricing";
import { canOpenSetupSection, setupSectionsFor } from "../components/setup/setup-sections";
function markupFor(role: "owner" | "admin") {
  const props = { role, children: createElement(TransportationPricingSection) };
  return renderToStaticMarkup(createElement(DashboardRoleProvider, props));
}
test("pricing Setup entry and content are Owner-only", () => {
  assert.equal(canOpenSetupSection("admin", "transportation-pricing"), false);
  assert.equal(setupSectionsFor("admin").some(s => s.key === "transportation-pricing"), false);
  const owner = markupFor("owner");
  assert.match(owner, /Transportation pricing/); assert.match(owner, /Loading your rates/);
  const admin = markupFor("admin");
  assert.match(admin, /Not allowed/); assert.doesNotMatch(admin, /Loading your rates/);
});
test("editor identifies conflicting active state membership without treating inactive overlap as a conflict", () => {
  const configuration: Configuration = { currency: "USD", base_rates: {}, surcharge_groups: [{ group_id: null, name: "Pickup group", active: true, states: ["MT"], rates: {} }, { group_id: null, name: "Other group", active: false, states: ["MT"], rates: {} }] };
  assert.deepEqual(collisions(configuration), []);
  configuration.surcharge_groups[1].active = true;
  assert.deepEqual(collisions(configuration), ["MT: Pickup group / Other group"]);
});
test("a new surcharge group starts active with all seven rates empty", () => {
  const group = newGroup();
  assert.equal(group.active, true);
  assert.equal(Object.values(group.rates).length, 7);
  assert.ok(Object.values(group.rates).every(rate => rate === null));
});
test("typed rates become wire decimals; junk is rejected, empty stays empty, zero stays zero", () => {
  assert.equal(parseRate(""), null);
  assert.equal(parseRate("  "), null);
  assert.equal(parseRate("0"), "0");
  assert.equal(parseRate("$3.25"), "3.25");
  assert.equal(parseRate("03.5"), "3.5");
  assert.equal(parseRate("4."), "4");
  assert.equal(parseRate("1,000"), "1000");
  assert.equal(parseRate("1000.5"), undefined);
  assert.equal(parseRate("3.12345"), undefined);
  assert.equal(parseRate("abc"), undefined);
  assert.equal(parseRate("-1"), undefined);
});
test("a group explains why it can't be saved in one sentence", () => {
  const filled = { empty: 0, invalid: 0 };
  const other = { ...newGroup(), name: "Mountain", states: ["MT"] };
  assert.equal(groupProblem({ ...newGroup(), name: " " }, [], filled), "Give the group a name.");
  assert.match(groupProblem({ ...newGroup(), name: "mountain", states: ["CO"] }, [other], filled)!, /already called/);
  assert.equal(groupProblem({ ...newGroup(), name: "West" }, [], filled), "Pick at least one state.");
  assert.match(groupProblem({ ...newGroup(), name: "West", states: ["CA"] }, [], { empty: 2, invalid: 0 })!, /Fill all 7 rates \(2 empty\)/);
  assert.match(groupProblem({ ...newGroup(), name: "West", states: ["MT"] }, [other], filled)!, /MT is already in the active group/);
  assert.equal(groupProblem({ ...newGroup(), name: "West", states: ["MT"], active: false }, [other], filled), null);
});
test("Save runs draft → write → preview → publish with an automatic note and the warning acknowledgement", async () => {
  const original = globalThis.fetch;
  const calls: { path: string; method: string; body: Record<string, unknown> }[] = [];
  const draftId = "6a0000000000000000000001";
  try {
    globalThis.fetch = async (input, init) => {
      const path = String(input).replace("/api/operations-pricing/", "");
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      calls.push({ path, method: init?.method ?? "GET", body });
      const data = path === "drafts" ? { _id: draftId, draft_version: 1 }
        : path === `drafts/${draftId}` ? { _id: draftId, draft_version: 2 }
        : path.endsWith("/preview") ? { activation_version: 4, findings: [], warnings: [{ mileage_band: "MI_0_100", volume_boundary: "500", old_price: "2000", new_price: "1500" }], warning_hash: "c".repeat(64) }
        : { calculation_enabled: true };
      return Response.json({ ok: true, data });
    };
    const outcome = await saveConfiguration("6a00000000000000000000aa", emptyConfiguration(), "Updated base rates");
    assert.deepEqual(calls.map(c => `${c.method} ${c.path}`), ["POST drafts", `PUT drafts/${draftId}`, `POST drafts/${draftId}/preview`, `POST drafts/${draftId}/publish`]);
    assert.equal(calls[0].body.base_revision_id, "6a00000000000000000000aa");
    assert.equal(calls[1].body.expected_draft_version, 1);
    assert.deepEqual(calls[2].body, { expected_draft_version: 2, inputs: [] });
    assert.equal(calls[3].body.change_note, "Updated base rates");
    assert.equal(calls[3].body.expected_activation_version, 4);
    assert.equal(calls[3].body.acknowledged_warning_hash, "c".repeat(64));
    assert.equal(outcome.calculationEnabled, true);
    assert.equal(outcome.warnings.length, 1);
  } finally { globalThis.fetch = original; }
});

test("unverifiable mutation responses remain unknown outcomes for identical retry", async () => {
  const original = globalThis.fetch;
  try {
    for (const response of [new Response("not JSON", { status: 502 }), Response.json(null), Response.json({ unexpected: true })]) {
      globalThis.fetch = async () => response;
      await assert.rejects(pricingRequest("enabled", "POST", { operation_id: "same-command" }), (error: unknown) => error instanceof PricingError && error.status === 0 && error.code === "UNKNOWN_OUTCOME");
    }
    globalThis.fetch = async () => Response.json({ ok: false, error: { code: "STALE_VERSION", message: "Reload." } }, { status: 409 });
    await assert.rejects(pricingRequest("enabled", "POST", {}), (error: unknown) => error instanceof PricingError && error.status === 409 && error.code === "STALE_VERSION");
  } finally { globalThis.fetch = original; }
});
