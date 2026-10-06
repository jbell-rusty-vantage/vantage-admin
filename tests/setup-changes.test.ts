import assert from "node:assert/strict";
import test from "node:test";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChangeDiff, ChangeDrawer } from "../components/setup/changes/change-drawer";
import { CHANGES_COPY } from "../components/setup/changes/changes-copy";
import {
  actionLabel,
  actorOptions,
  changesApiFilters,
  entityLabel,
  fieldLabel,
  ownerSnapshotValue,
  parseChangesFilters,
} from "../components/setup/changes/changes-model";
import { ChangesTable } from "../components/setup/changes/changes-table";
import type { RegistryChangeItem } from "../lib/api/operationsRegistry";
import { REGISTRY_CHANGE_ACTIONS, REGISTRY_CHANGE_ENTITY_TYPES } from "../lib/api/registryEntityLinks";
import { findOwnerMarkupLeaks } from "../lib/operations-registry/ownerLanguageDeck";

/*
 * Setup → Change history (doc 19): Entity · Who · When filters in the URL, Owner-word labels, the before / after diff,
 * and links into the Setup routes. Ids never appear as link text.
 */

const html = (element: ReactElement) =>
  renderToStaticMarkup(element)
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">");

const OBJECT_ID = "64b0f0f0f0f0f0f0f0f0f0f0";

const change = (id: string, extra: Partial<RegistryChangeItem> = {}): RegistryChangeItem => ({
  id,
  entity_type: "source_granularity",
  entity_id: OBJECT_ID,
  action: "update",
  actor_type: "owner",
  actor_id: "actor-1",
  actor_label: "Jordan Owner",
  actor_role: "owner",
  request_id: "req-123",
  reason: "Moved the default feed",
  before: { owner_label: "Calls", active: false, default_form_granularity: "form-a", source_company: OBJECT_ID },
  after: { owner_label: "Inbound calls", active: true, default_form_granularity: "form-b", source_company: OBJECT_ID, lead_model: "link_only" },
  metadata: {},
  created_at: "2026-10-05T15:30:00.000Z",
  ...extra,
});

test("the filters are Entity, Who and When in the URL and map to the server's filters", () => {
  const params = new URLSearchParams("entity=source_company&who=actor-1&from=2026-10-01&to=2026-10-05&page=2&limit=50");
  const filters = parseChangesFilters(params);
  assert.deepEqual(filters, { entity: "source_company", who: "actor-1", from: "2026-10-01", to: "2026-10-05", page: 2, limit: 50 });
  // The picked end day is advanced one day so the whole calendar day is included (the server's end is an instant).
  assert.deepEqual(changesApiFilters(filters), {
    page: 2,
    limit: 50,
    entity_type: "source_company",
    actor_id: "actor-1",
    from: "2026-10-01",
    to: "2026-10-06",
  });
  assert.deepEqual(parseChangesFilters(new URLSearchParams("")), { entity: "", who: "", from: "", to: "", page: 1, limit: 25 });
  assert.deepEqual(changesApiFilters(parseChangesFilters(new URLSearchParams("page=zero"))), { page: 1, limit: 25 });
});

test("every entity and action has an Owner word, none of them an engineering name", () => {
  for (const type of REGISTRY_CHANGE_ENTITY_TYPES) {
    const label = entityLabel(type);
    assert.deepEqual(findOwnerMarkupLeaks(label), [], `${type} -> ${label}`);
    assert.notEqual(label, type);
  }
  for (const action of REGISTRY_CHANGE_ACTIONS) {
    assert.deepEqual(findOwnerMarkupLeaks(actionLabel(action)), [], action);
  }
  assert.equal(entityLabel("source_company"), "Lead source");
  assert.equal(entityLabel("source_granularity"), "Feed");
  assert.equal(entityLabel("ringcentral_route"), "Inbound number");
  // An unknown type falls back to words, with the engineering name replaced.
  assert.equal(entityLabel("some_granularity_thing"), "Some Feed Thing");
});

test("the Who list is the people seen in the changes, and the selected one is always kept", () => {
  const items = [change("c1"), change("c2", { actor_id: "actor-2", actor_label: "Sam Admin", actor_role: "admin" }), change("c3")];
  assert.deepEqual(actorOptions(items, ""), [
    { value: "actor-1", label: "Jordan Owner (owner)" },
    { value: "actor-2", label: "Sam Admin (admin)" },
  ]);
  assert.deepEqual(actorOptions([], "actor-9"), [{ value: "actor-9", label: "Selected person" }]);
});

test("diff fields read in words and values never print an id", () => {
  assert.equal(fieldLabel("default_form_granularity"), "Default form feed");
  assert.equal(fieldLabel("sheet_config.spreadsheet_id"), "Sheet config › spreadsheet id");
  assert.equal(ownerSnapshotValue(OBJECT_ID), "A linked record");
  assert.equal(ownerSnapshotValue(undefined), "None");
  assert.equal(ownerSnapshotValue(null), "null");
  assert.equal(ownerSnapshotValue("link_only"), "link only");
  assert.deepEqual(findOwnerMarkupLeaks(ownerSnapshotValue({ lead_model: "x", route_key: OBJECT_ID })), []);
});

test("the change table lists when, who, what and why, with a View control, and prints no id", () => {
  const items = [change("c1"), change("c2", { entity_type: "ringcentral_route", action: "validate", reason: null })];
  const markup = html(createElement(ChangesTable, { items, openId: "c1", onOpen() {} }));
  assert.match(markup, /Jordan Owner/);
  assert.match(markup, /Updated/);
  assert.match(markup, /Feed/);
  assert.match(markup, /Checked/);
  assert.match(markup, /Inbound number/);
  assert.match(markup, /Moved the default feed/);
  assert.match(markup, /No reason recorded/);
  assert.match(markup, /aria-expanded="true"[^>]*>Hide</);
  assert.match(markup, /aria-expanded="false"[^>]*>View</);
  assert.doesNotMatch(markup, new RegExp(OBJECT_ID));
  assert.deepEqual(findOwnerMarkupLeaks(markup), []);
});

test("the change drawer shows the diff, links into the Setup section and keeps ids behind Advanced", () => {
  const markup = html(createElement(ChangeDrawer, { item: change("c1"), onClose() {} }));
  assert.match(markup, /Updated · Feed/);
  assert.match(markup, /Jordan Owner \(owner\)/);
  assert.match(markup, /href="\/setup\/lead-sources\?feed=64b0f0f0f0f0f0f0f0f0f0f0"[^>]*>Open feed</);
  // owner_label is an avoided phrase, so the diff row reads "Name".
  assert.match(markup, />Name</);
  assert.match(markup, /Default form feed/);
  assert.match(markup, /Inbound calls/);
  assert.match(markup, /Added/);
  assert.match(markup, /Changed/);
  assert.match(markup, /Moved the default feed/);
  // The unchanged id-valued field is not a row; the one id that is shown (Advanced) is in a closed details element.
  assert.match(markup, /<details class="ch-advanced"><summary>Advanced<\/summary>/);
  assert.deepEqual(findOwnerMarkupLeaks(markup), []);
  const link = markup.match(/<a [^>]*>([^<]*)<\/a>/g) ?? [];
  for (const anchor of link) assert.doesNotMatch(anchor.replace(/href="[^"]*"/, ""), /[a-f0-9]{24}/);
});

test("a change that has no field differences says so, and a removed field reads Removed", () => {
  const none = html(createElement(ChangeDiff, { item: change("c1", { before: { a: 1 }, after: { a: 1 } }) }));
  assert.match(none, /No before and after differences were recorded/);
  const removed = html(createElement(ChangeDiff, { item: change("c1", { before: { note: "x" }, after: {} }) }));
  assert.match(removed, /Removed/);
  assert.match(removed, /None/);
});

test("Change history copy uses glossary words and no em-dashes", () => {
  const copy = CHANGES_COPY;
  const strings = [copy.listSubtitle, copy.empty, copy.drawer.note, copy.drawer.truncated, copy.total(3, 1), copy.drawer.byLine("now", "A", "owner")].join(" ");
  assert.deepEqual(findOwnerMarkupLeaks(strings), []);
  assert.doesNotMatch(strings, /—/);
});
