import assert from "node:assert/strict";
import test from "node:test";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CarriersCard, type CarriersCardProps } from "../components/setup/carriers/carriers-card";
import { CARRIERS_COPY } from "../components/setup/carriers/carriers-copy";
import {
  carrierCreatePayload,
  carrierFormChanged,
  carrierFormFrom,
  carrierFormValid,
  carrierUpdatePayload,
  filterCarriers,
} from "../components/setup/carriers/carrier-form";
import { CarrierImportSheet, PreviewBlock, ResultBlock } from "../components/setup/carriers/carrier-import-sheet";
import { CarrierSheet } from "../components/setup/carriers/carrier-sheet";
import type { CarrierImportResult, MovingCarrier } from "../lib/api/carriers";
import { findOwnerMarkupLeaks } from "../lib/operations-registry/ownerLanguageDeck";
import { previewCarrierImport } from "../lib/setup/carriers-preview";

/*
 * Setup → Carriers (doc 19 "Carriers"): the list, the create / edit form rules moved from carrier-manager.tsx, and the
 * import sheet's wording, default mode and preview / result blocks.
 */

const html = (element: ReactElement) =>
  renderToStaticMarkup(createElement(QueryClientProvider, { client: new QueryClient() }, element))
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"');

const carrier = (id: string, name: string, dot: string, mc: string, extra: Partial<MovingCarrier> = {}): MovingCarrier => ({
  id,
  _id: id,
  name,
  normalized_name: name.toLowerCase(),
  dot_number: dot,
  mc_number: mc,
  active: true,
  created_from: "csv_import",
  ...extra,
});

const carriers: MovingCarrier[] = [
  carrier("64b000000000000000000001", "Arrow Moving", "3365195", "100", { granot_carrier_code: "ARROW" }),
  carrier("64b000000000000000000002", "Bold Movers", "3139358", "200"),
  carrier("64b000000000000000000003", "Old Van Lines", "999", "300", { active: false }),
];

const cardProps = (extra: Partial<CarriersCardProps> = {}): CarriersCardProps => ({
  carriers,
  error: null,
  q: null,
  includeInactive: false,
  readOnly: false,
  togglePending: false,
  rowError: null,
  onRetry() {},
  onSearch() {},
  onIncludeInactive() {},
  onOpen() {},
  onToggleActive() {},
  ...extra,
});

test("the form keeps the old rules: name, DOT and MC required; the Granot code upper-cased; an empty code clears on edit", () => {
  assert.equal(carrierFormValid(carrierFormFrom(null)), false);
  assert.equal(carrierFormValid({ ...carrierFormFrom(null), name: "A", dot_number: "1", mc_number: "2" }), true);
  assert.equal(carrierFormValid({ ...carrierFormFrom(null), name: "  ", dot_number: "1", mc_number: "2" }), false);

  const created = carrierCreatePayload({ name: " New Co ", dot_number: " 11 ", mc_number: "22", granot_carrier_code: " ab c ", active: false });
  assert.deepEqual(created, { name: "New Co", dot_number: "11", mc_number: "22", granot_carrier_code: "ABC", active: false });
  // No code typed: the field is left out of the create body, as the old form did.
  assert.equal("granot_carrier_code" in carrierCreatePayload({ name: "A", dot_number: "1", mc_number: "2", granot_carrier_code: "", active: true }), false);

  const original = carriers[0]!;
  const same = carrierFormFrom(original);
  assert.equal(carrierFormChanged(same, original), false);
  assert.equal(carrierFormChanged({ ...same, granot_carrier_code: "arrow" }, original), false);
  assert.equal(carrierFormChanged({ ...same, active: false }, original), true);
  // An empty code is sent as "" so the server clears the stored one.
  assert.equal(carrierUpdatePayload({ ...same, granot_carrier_code: "" }).granot_carrier_code, "");
});

test("the list hides inactive carriers by default and searches name, DOT, MC and Granot code", () => {
  assert.deepEqual(
    filterCarriers(carriers, { query: null, includeInactive: false }).map((entry) => entry.name),
    ["Arrow Moving", "Bold Movers"],
  );
  assert.equal(filterCarriers(carriers, { query: null, includeInactive: true }).length, 3);
  assert.deepEqual(filterCarriers(carriers, { query: "3139", includeInactive: false }).map((entry) => entry.name), ["Bold Movers"]);
  assert.deepEqual(filterCarriers(carriers, { query: "arrow", includeInactive: false }).map((entry) => entry.name), ["Arrow Moving"]);
  assert.deepEqual(filterCarriers(carriers, { query: "300", includeInactive: true }).map((entry) => entry.name), ["Old Van Lines"]);
});

test("the carriers card shows the table, the Include inactive chip and Owner actions, and no id", () => {
  const markup = html(createElement(CarriersCard, cardProps()));
  assert.match(markup, /Arrow Moving/);
  assert.match(markup, /Include inactive/);
  assert.match(markup, /aria-pressed="false"/);
  assert.match(markup, /Deactivate/);
  assert.match(markup, /2 of 3 carriers/);
  assert.doesNotMatch(markup, /Old Van Lines/);
  assert.deepEqual(findOwnerMarkupLeaks(markup), []);

  const withInactive = html(createElement(CarriersCard, cardProps({ includeInactive: true })));
  assert.match(withInactive, /Old Van Lines/);
  assert.match(withInactive, /Reactivate/);
  assert.deepEqual(findOwnerMarkupLeaks(withInactive), []);

  const readOnly = html(createElement(CarriersCard, cardProps({ readOnly: true })));
  assert.doesNotMatch(readOnly, /Deactivate/);
  assert.match(readOnly, /View/);
});

test("the carriers card has loading, failure, empty and no-match states", () => {
  assert.match(html(createElement(CarriersCard, cardProps({ carriers: undefined }))), /Loading moving carriers/);
  assert.match(html(createElement(CarriersCard, cardProps({ carriers: undefined, error: new Error("boom") }))), /did not load/);
  assert.match(html(createElement(CarriersCard, cardProps({ carriers: [] }))), /No carriers yet/);
  assert.match(html(createElement(CarriersCard, cardProps({ q: "zzz" }))), /No carrier matches that search/);
});

test("the create and edit sheets render their fields, and a read-only role cannot save", () => {
  const create = html(createElement(CarrierSheet, { carrier: null, readOnly: false, onClose() {} }));
  assert.match(create, /Add a carrier/);
  assert.match(create, /Granot Carrier Code/);
  assert.match(create, /Add carrier<\/button>/);
  assert.deepEqual(findOwnerMarkupLeaks(create), []);

  const edit = html(createElement(CarrierSheet, { carrier: carriers[0]!, readOnly: false, onClose() {} }));
  assert.match(edit, /Edit carrier/);
  assert.match(edit, /value="Arrow Moving"/);
  assert.match(edit, /Save changes/);
  assert.deepEqual(findOwnerMarkupLeaks(edit), []);

  const view = html(createElement(CarrierSheet, { carrier: carriers[0]!, readOnly: true, onClose() {} }));
  assert.doesNotMatch(view, /Save changes/);
  assert.match(view, /disabled=""/);
});

test("the import sheet opens with Patch selected and the doc 19 wording; Replace is second", () => {
  const markup = html(createElement(CarrierImportSheet, { carriers, onClose() {} }));
  assert.match(markup, /Add and update from the file/);
  assert.match(markup, /Keep every carrier not in it\./);
  assert.match(markup, /Replace the active list/);
  assert.match(markup, /Carriers missing from the file are deactivated\./);
  assert.ok(markup.indexOf("Add and update from the file") < markup.indexOf("Replace the active list"), "Patch comes first");
  // Patch is the checked radio; Replace is not.
  assert.match(markup, /<input type="radio" name="carrier-import-mode" checked=""[^>]*\/><span class="su-choice__text"><strong>Add and update/);
  assert.doesNotMatch(markup, /checked=""[^>]*\/><span class="su-choice__text"><strong>Replace/);
  // The honest line, and no import without a file.
  assert.match(markup, /The server does the final check/);
  assert.match(markup, /<button[^>]*disabled=""[^>]*>Import<\/button>/);
  assert.deepEqual(findOwnerMarkupLeaks(markup), []);
});

test("the preview block names every count, lists problems and, in Replace, the carriers it would deactivate", () => {
  const csv = ["Carrier Name,DOT,MC", "Brand New,1,2", "Bold Movers LLC,3139358,200", "Arrow Moving,3365195,100", "No Dot,,5"].join("\n");
  const patch = html(createElement(PreviewBlock, { preview: previewCarrierImport(csv, carriers, "patch"), mode: "patch" }));
  assert.match(patch, /1 new/);
  assert.match(patch, /1 updated/);
  assert.match(patch, /1 unchanged/);
  assert.match(patch, /1 row with problems/);
  assert.match(patch, /Row 5: Carrier Name, DOT and MC are all required/);
  assert.doesNotMatch(patch, /would be deactivated/);
  assert.deepEqual(findOwnerMarkupLeaks(patch), []);

  const replace = html(createElement(PreviewBlock, { preview: previewCarrierImport(csv, carriers, "replace"), mode: "replace" }));
  // Old Van Lines is already inactive, so it is not counted; no active carrier is missing from this file.
  assert.match(replace, /0 would be deactivated/);
  const fewer = html(createElement(PreviewBlock, { preview: previewCarrierImport("Carrier Name,DOT,MC\nArrow Moving,3365195,100", carriers, "replace"), mode: "replace" }));
  assert.match(fewer, /1 would be deactivated/);
  assert.match(fewer, /Bold Movers/);
  assert.deepEqual(findOwnerMarkupLeaks(fewer), []);

  const empty = html(createElement(PreviewBlock, { preview: previewCarrierImport("", carriers, "patch"), mode: "patch" }));
  assert.match(empty, /no rows/);
});

test("the server result replaces the preview with the four counts and every row error", () => {
  const result: CarrierImportResult = {
    mode: "replace",
    total_rows: 5,
    valid_rows: 3,
    created: 1,
    updated: 1,
    deactivated: 2,
    skipped: 2,
    errors: [
      { row: 4, message: "Granot Carrier Code already in use" },
      { row: 6, message: "Carrier Name, DOT, and MC are required" },
    ],
    items: [],
  };
  const markup = html(createElement(ResultBlock, { result, onAnother() {}, onClose() {} }));
  assert.match(markup, /1 created/);
  assert.match(markup, /1 updated/);
  assert.match(markup, /2 deactivated/);
  assert.match(markup, /2 skipped/);
  assert.match(markup, /Row 4: Granot Carrier Code already in use/);
  assert.match(markup, /Row 6: Carrier Name, DOT, and MC are required/);
  assert.match(markup, /Replace the active list/);
  assert.deepEqual(findOwnerMarkupLeaks(markup), []);
});

test("the Replace confirmation names the count", () => {
  assert.equal(CARRIERS_COPY.import.confirmTitle(3), "This deactivates 3 carriers.");
  assert.equal(CARRIERS_COPY.import.confirmTitle(1), "This deactivates 1 carrier.");
  assert.equal(CARRIERS_COPY.import.confirmAction(3), "Deactivate 3 and import");
  const strings = [
    CARRIERS_COPY.import.confirmBody,
    CARRIERS_COPY.import.confirmTitle(3),
    CARRIERS_COPY.import.honest,
    CARRIERS_COPY.import.missingColumns(["MC"]),
    CARRIERS_COPY.sheet.identityHint,
    CARRIERS_COPY.listSubtitle,
    CARRIERS_COPY.readOnlyNote,
  ].join(" ");
  assert.deepEqual(findOwnerMarkupLeaks(strings), []);
  assert.doesNotMatch(strings, /—/);
});
