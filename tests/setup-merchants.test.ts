import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MerchantCards, merchantAliases, merchantUpdateBody } from "../components/setup/merchants/merchants-section";
import { MERCHANTS_COPY as MONEY_COPY } from "../components/setup/merchants/merchants-copy";
import type { RegistryCatalogItem } from "../lib/api/registryAgents";
import { findOwnerMarkupLeaks } from "../lib/operations-registry/ownerLanguageDeck";

const merchant = (id: string, name: string, extra: Partial<RegistryCatalogItem> = {}): RegistryCatalogItem => ({
  id,
  name,
  normalized_name: name.toLowerCase(),
  active: true,
  created_from: "test",
  ...extra,
});

const items = [merchant("m1", "Square", { name_aliases: ["Sq", "Square", "square"] }), merchant("m2", "Old Bank", { active: false })];

test("the Merchants card list shows the name, the aliases from renames and Active / Inactive, with no Owner-language leak", () => {
  const out = renderToStaticMarkup(createElement(MerchantCards, { items, readOnly: false, onEdit: () => {} }));
  assert.deepEqual(findOwnerMarkupLeaks(out), []);
  assert.ok(out.includes("Square") && out.includes(MONEY_COPY.alsoKnownAs("Sq")));
  assert.ok(out.includes(MONEY_COPY.active) && out.includes(MONEY_COPY.inactive));
  assert.equal(out.split('data-testid="merchant-card"').length - 1, 2);
  assert.equal(out.split(">Edit<").length - 1, 2);
});

test("a read-only role sees the cards without Edit; an empty list says so", () => {
  const out = renderToStaticMarkup(createElement(MerchantCards, { items, readOnly: true, onEdit: () => {} }));
  assert.ok(!out.includes(">Edit<"));
  assert.ok(renderToStaticMarkup(createElement(MerchantCards, { items: [], readOnly: false, onEdit: () => {} })).includes(MONEY_COPY.empty));
});

test("aliases drop the current name; a rename sends the new name and the reason only", () => {
  assert.deepEqual(merchantAliases(items[0]!), ["Sq"]);
  assert.equal(merchantUpdateBody(items[0]!, { name: "Square", reason: "x" }), null);
  assert.deepEqual(merchantUpdateBody(items[0]!, { name: " Square Inc ", reason: " typo " }), { name: "Square Inc", reason: "typo" });
  assert.deepEqual(merchantUpdateBody(items[0]!, { name: "Square Inc", reason: "" }), { name: "Square Inc" });
  assert.equal(merchantUpdateBody(items[0]!, { name: "  ", reason: "" }), null);
});

test("Money copy passes the Owner language check and keeps the rep compensation line", () => {
  for (const text of [MONEY_COPY.repPay, MONEY_COPY.nameHint, MONEY_COPY.previewTotal(3), MONEY_COPY.depositsRecorded(1), MONEY_COPY.depositsRecorded(2)]) assert.deepEqual(findOwnerMarkupLeaks(text), []);
  assert.match(MONEY_COPY.repPay, /Today → Money/);
  assert.equal(MONEY_COPY.depositsRecorded(1), "1 deposit recorded");
  assert.ok(!/—/.test(JSON.stringify(Object.values(MONEY_COPY).filter((value) => typeof value === "string"))));
});
