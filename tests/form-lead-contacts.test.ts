import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CallLeadContactsSection,
  FormLeadContactsSection,
  GranotContactChip,
} from "../components/operational/form-lead-contacts";
import type { AdminRecord } from "../lib/api/admin";

const formSubmitted = {
  name: "Form Name",
  first_name: "Form",
  last_name: "Name",
  phone_number: "555-0001",
  email: "form@example.com",
} as const;

function renderChip(record: AdminRecord) {
  return renderToStaticMarkup(createElement(GranotContactChip, { record }));
}

function renderContacts(record: AdminRecord) {
  return renderToStaticMarkup(createElement(FormLeadContactsSection, { record }));
}

function renderCallContacts(record: AdminRecord) {
  return renderToStaticMarkup(createElement(CallLeadContactsSection, { record }));
}

test("no snapshot shows an empty chip and Form submitted only", () => {
  const record: AdminRecord = { ...formSubmitted };
  const chip = renderChip(record);
  const contacts = renderContacts(record);

  assert.equal(chip, "—");
  assert.match(contacts, /Form submitted/);
  assert.match(contacts, /Form Name/);
  assert.match(contacts, /No Granot contact yet/);
  assert.doesNotMatch(contacts, />Granot</);
  assert.doesNotMatch(contacts, /Changed in Granot/);
  assert.doesNotMatch(contacts, /ingested_contact_snapshot/);
  assert.doesNotMatch(contacts, /granot_contact_snapshot/);
  assert.doesNotMatch(contacts, /differs_from_ingested/);
});

test("matching snapshot shows Granot chip and both cards", () => {
  const record: AdminRecord = {
    ...formSubmitted,
    granot_contact_snapshot: {
      name: "Granot Name",
      first_name: "Granot",
      last_name: "Name",
      phone_number: "555-9999",
      email: "granot@example.com",
      differs_from_ingested: false,
      captured_at: "2026-08-01T12:00:00.000Z",
    },
  };
  const chip = renderChip(record);
  const contacts = renderContacts(record);

  assert.match(chip, />Granot</);
  assert.doesNotMatch(chip, /Changed in Granot/);
  assert.match(contacts, /Form submitted/);
  assert.match(contacts, /Form Name/);
  assert.match(contacts, />Granot</);
  assert.match(contacts, /Granot Name/);
  assert.doesNotMatch(contacts, /Changed in Granot/);
  assert.doesNotMatch(contacts, /No Granot contact yet/);
});

test("differing snapshot shows Changed in Granot and keeps the Form submitted name", () => {
  const record: AdminRecord = {
    ...formSubmitted,
    granot_contact_snapshot: {
      name: "Granot Name",
      phone_number: "555-9999",
      differs_from_ingested: true,
    },
  };
  const chip = renderChip(record);
  const contacts = renderContacts(record);

  assert.match(chip, /Changed in Granot/);
  assert.match(chip, /title="Granot Name · 555-9999"/);
  assert.match(contacts, /Form submitted/);
  assert.match(contacts, /Form Name/);
  assert.match(contacts, /Changed in Granot/);
  assert.match(contacts, /Granot Name/);
  assert.doesNotMatch(contacts, /observation_id/);
  assert.doesNotMatch(contacts, /wordpress_form/);
  assert.doesNotMatch(contacts, /legacy_baseline/);
});

test("operational form lead edit fields omit snapshot keys", () => {
  const source = readFileSync(
    path.join(process.cwd(), "components/operational/operational-configs.ts"),
    "utf8",
  );
  const editBlock = source.slice(
    source.indexOf("const formLeadEditFields"),
    source.indexOf("const callLeadColumns"),
  );
  assert.match(source, /key: "granot_contact"/);
  assert.match(source, /label: "Granot contact"/);
  assert.doesNotMatch(editBlock, /ingested_contact_snapshot/);
  assert.doesNotMatch(editBlock, /granot_contact_snapshot/);
  assert.doesNotMatch(editBlock, /differs_from_ingested/);

  const callBlock = source.slice(
    source.indexOf("const callLeadColumns"),
    source.indexOf("const callLeadFilters"),
  );
  assert.match(callBlock, /key: "granot_contact"/);
  assert.match(callBlock, /path: "granot_contact_snapshot"/);
  assert.match(callBlock, /path: "name"/);
  assert.match(callBlock, /path: "phone_number"/);
});

test("Call contacts section titles the live card Called and shows Granot", () => {
  const record: AdminRecord = {
    name: "Called Name",
    phone_number: "555-0001",
    email: "called@example.com",
    granot_contact_snapshot: {
      name: "Granot Name",
      phone_number: "555-9999",
      differs_from_ingested: true,
    },
  };
  const contacts = renderCallContacts(record);
  const chip = renderChip(record);

  assert.match(contacts, /Called/);
  assert.match(contacts, /Called Name/);
  assert.match(contacts, /Changed in Granot/);
  assert.match(contacts, /Granot Name/);
  assert.doesNotMatch(contacts, /Form submitted/);
  assert.doesNotMatch(contacts, /granot_contact_snapshot/);
  assert.match(chip, /Changed in Granot/);
});

test("Call contacts section without a snapshot keeps Called and omits Granot", () => {
  const record: AdminRecord = {
    name: "Called Name",
    phone_number: "555-0001",
    email: "called@example.com",
  };
  const contacts = renderCallContacts(record);

  assert.match(contacts, /Called/);
  assert.match(contacts, /Called Name/);
  assert.match(contacts, /No Granot contact yet/);
  assert.doesNotMatch(contacts, /Form submitted/);
  assert.doesNotMatch(contacts, />Granot</);
});
