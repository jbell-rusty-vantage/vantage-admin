import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DataTable } from "../components/data-table/table-shell";
import { buildColumns } from "../components/operational/operational-columns";
import { operationalConfigs } from "../components/operational/operational-configs";
import { OPERATIONAL_COPY } from "../components/operational/operational-copy";
import {
  rowActionCluster,
  rowIdentity,
  rowStatusChips,
} from "../components/operational/operational-row";
import type { AdminRecord } from "../lib/api/admin";

const PREPENDED_ACTION_KEYS = ["__book", "__mark_bad", "__cancel", "__delete", "__related"] as const;

const productionCtx = { isProduction: true, readOnly: false, canDelete: true };
const readOnlyCtx = { isProduction: true, readOnly: true, canDelete: false };
const historicalCtx = { isProduction: false, readOnly: true, canDelete: false };

function lead(overrides: AdminRecord = {}): AdminRecord {
  return { _id: "507f1f77bcf86cd799439011", name: "Ada Lovelace", phone_number: "555-0100", ...overrides };
}

function booking(overrides: AdminRecord = {}): AdminRecord {
  return {
    _id: "507f1f77bcf86cd799439012",
    customer: { full_name: "Charles Babbage", phone_number: "555-0101" },
    ...overrides,
  };
}

test("rowIdentity uses name over phone for Form and Call Leads", () => {
  assert.deepEqual(rowIdentity("form-leads", lead()), {
    primary: "Ada Lovelace",
    secondary: "555-0100",
  });
  assert.deepEqual(rowIdentity("call-leads", lead({ name: "Call Name" })), {
    primary: "Call Name",
    secondary: "555-0100",
  });
  assert.deepEqual(rowIdentity("duplicate-form-leads", lead()), {
    primary: "Ada Lovelace",
    secondary: "555-0100",
  });
});

test("rowIdentity uses customer name over phone for Bookings and Cancellations", () => {
  assert.deepEqual(rowIdentity("bookings", booking()), {
    primary: "Charles Babbage",
    secondary: "555-0101",
  });
  assert.deepEqual(
    rowIdentity("cancellations", {
      customer_name: "Fallback Name",
      customer_phone: "555-0199",
    }),
    { primary: "Fallback Name", secondary: "555-0199" },
  );
});

test("rowIdentity uses full name over phone for Customers and name over role for Agents", () => {
  assert.deepEqual(
    rowIdentity("customers", { full_name: "Customer One", phone_number: "555-0200" }),
    { primary: "Customer One", secondary: "555-0200" },
  );
  assert.deepEqual(rowIdentity("agents", { name: "Pat Agent", role: "closer" }), {
    primary: "Pat Agent",
    secondary: "closer",
  });
});

test("rowStatusChips shows Form Lead chips only when set, with Owner labels", () => {
  assert.deepEqual(rowStatusChips("form-leads", lead()), []);
  assert.deepEqual(
    rowStatusChips("form-leads", lead({
      booked: true,
      cancelled: true,
      bad_lead: "disconnected_number",
      sms_message_sent: true,
    })).map((chip) => chip.label),
    [
      OPERATIONAL_COPY.row.booked,
      OPERATIONAL_COPY.row.cancelled,
      "D/C number",
      OPERATIONAL_COPY.row.leadMessageSent,
    ],
  );
  assert.equal(OPERATIONAL_COPY.row.booked, "Booked");
  assert.equal(OPERATIONAL_COPY.row.cancelled, "Cancelled");
  assert.equal(OPERATIONAL_COPY.row.badLead, "Bad Lead");
  assert.equal(OPERATIONAL_COPY.row.badLeadAction, "Bad");
  assert.equal(OPERATIONAL_COPY.row.leadMessageSent, "Lead Message sent");
  assert.doesNotMatch(OPERATIONAL_COPY.row.leadMessageSent, /text message|SMS/i);
  assert.doesNotMatch(OPERATIONAL_COPY.row.badLead, /Bad Call/);
});

test("rowStatusChips for Call Lead is Booked and Cancelled only", () => {
  const chips = rowStatusChips(
    "call-leads",
    lead({ booked: true, cancelled: true, bad_lead: "disconnected_number", sms_message_sent: true }),
  );
  assert.deepEqual(chips.map((chip) => chip.key), ["booked", "cancelled"]);
});

test("rowStatusChips for Booking is Cancelled only; Cancellation has none", () => {
  assert.deepEqual(
    rowStatusChips("bookings", booking({ cancelled: true })).map((chip) => chip.key),
    ["cancelled"],
  );
  assert.deepEqual(rowStatusChips("cancellations", { reason: "price" }), []);
  assert.deepEqual(rowStatusChips("customers", { full_name: "A" }), []);
  assert.deepEqual(rowStatusChips("agents", { name: "A", role: "closer" }), []);
});

test("Form Lead booked row hides Book in the cluster", () => {
  const open = rowActionCluster("form-leads", lead(), productionCtx);
  assert.equal(open.book, true);
  assert.equal(open.badLead, true);

  const booked = rowActionCluster("form-leads", lead({ booked: true }), productionCtx);
  assert.equal(booked.book, false);
  assert.equal(booked.badLead, true);
});

test("Referral Booking hides Cancel", () => {
  const ordinary = rowActionCluster("bookings", booking(), productionCtx);
  assert.equal(ordinary.cancel, true);
  assert.equal(ordinary.delete, true);

  const referral = rowActionCluster(
    "bookings",
    booking({ is_referral_booking: true }),
    productionCtx,
  );
  assert.equal(referral.cancel, false);
  assert.equal(referral.delete, true);
});

test("Call Lead cluster has no Bad Lead control", () => {
  const cluster = rowActionCluster("call-leads", lead(), productionCtx);
  assert.equal(cluster.book, true);
  assert.equal(cluster.badLead, false);
  assert.equal(cluster.cancel, false);
});

test("duplicates and historical rows expose related links only", () => {
  const bookedDup = rowActionCluster(
    "duplicate-form-leads",
    lead({ booked: { _id: "booking1" } }),
    readOnlyCtx,
  );
  assert.equal(bookedDup.book, false);
  assert.equal(bookedDup.badLead, false);
  assert.equal(bookedDup.cancel, false);
  assert.equal(bookedDup.delete, false);
  assert.equal(bookedDup.related.length, 1);

  const historical = rowActionCluster("form-leads", lead(), historicalCtx);
  assert.equal(historical.book, false);
  assert.equal(historical.badLead, false);
});

test("selected id sets aria-selected on that row only", () => {
  const markup = renderToStaticMarkup(
    createElement(DataTable<{ id: string; label: string }>, {
      items: [
        { id: "row-a", label: "A" },
        { id: "row-b", label: "B" },
      ],
      getRowKey: (item) => item.id,
      isRowSelected: (item) => item.id === "row-b",
      columns: [
        { key: "label", header: "Label", cell: (item) => item.label },
      ],
    }),
  );
  assert.match(markup, /aria-selected="true"/);
  assert.equal((markup.match(/aria-selected="true"/g) ?? []).length, 1);
  assert.match(markup, /<tr[^>]*aria-selected="true"[^>]*>[\s\S]*?>B</);
  assert.match(markup, /<tr[^>]*aria-selected="false"[^>]*>[\s\S]*?>A</);
});

function columnKeys(resource: keyof typeof operationalConfigs, canDelete = true) {
  return buildColumns(
    operationalConfigs[resource],
    {
      page: 1,
      limit: 25,
      sort: operationalConfigs[resource].defaultSort,
      direction: "desc",
      database_scope: "production",
    },
    () => undefined,
    resource,
    true,
    { canDelete, onRequestDelete: () => undefined },
  ).map((column) => column.key);
}

test("buildColumns prepends a sheet-check selection column only when asked", () => {
  const keys = columnKeys("form-leads");
  assert.equal(keys[0], "timestamp");

  const selected = buildColumns(
    operationalConfigs["form-leads"],
    {
      page: 1,
      limit: 25,
      sort: operationalConfigs["form-leads"].defaultSort,
      direction: "desc",
      database_scope: "production",
    },
    () => undefined,
    "form-leads",
    true,
    {
      canDelete: true,
      onRequestDelete: () => undefined,
      selection: {
        selectedIds: new Set(),
        allLoadedSelected: false,
        onToggle: () => undefined,
        onToggleAllLoaded: () => undefined,
      },
    },
  ).map((column) => column.key);
  assert.equal(selected[0], "__select");
});

test("buildColumns does not prepend action columns", () => {
  const formKeys = columnKeys("form-leads");
  const callKeys = columnKeys("call-leads");
  const bookingKeys = columnKeys("bookings");
  const cancelKeys = columnKeys("cancellations");

  for (const keys of [formKeys, callKeys, bookingKeys, cancelKeys]) {
    for (const actionKey of PREPENDED_ACTION_KEYS) {
      assert.equal(keys.includes(actionKey), false, actionKey);
    }
  }

  assert.deepEqual(formKeys.slice(0, 6), ["timestamp", "name", "ref", "job", "source", "__status"]);
  assert.equal(formKeys.includes("phone"), false);
  assert.equal(formKeys.includes("booked"), false);
  assert.equal(formKeys.at(-1), "__actions");
  assert.equal(operationalConfigs["form-leads"].columns.find((column) => column.key === "source")?.label, "Source Company");

  assert.deepEqual(callKeys.slice(0, 5), ["timestamp", "name", "job", "source", "__status"]);
  assert.equal(callKeys.includes("phone"), false);
  assert.equal(callKeys.includes("booked"), false);
  assert.equal(callKeys.at(-1), "__actions");
  assert.equal(operationalConfigs["call-leads"].columns.find((column) => column.key === "source")?.label, "Source Company");

  assert.equal(bookingKeys.includes("phone"), false);
  assert.equal(bookingKeys.includes("cancelled"), false);
  assert.equal(bookingKeys.includes("stored_lead"), true);
  assert.equal(bookingKeys.at(-1), "__actions");

  assert.equal(cancelKeys.includes("reason"), true);
  assert.equal(cancelKeys.includes("__status"), false);
  assert.equal(cancelKeys.at(-1), "__actions");

  const customerKeys = columnKeys("customers", false);
  assert.equal(customerKeys.includes("phone"), false);
  assert.equal(customerKeys.includes("__actions"), false);

  const agentKeys = columnKeys("agents", false);
  assert.equal(agentKeys.includes("role"), false);
  assert.equal(agentKeys.includes("name"), true);
  assert.equal(agentKeys.includes("active"), true);
});

test("floating bottom action bar is gone so Book and Cancel are not a third surface", () => {
  const page = readFileSync(
    path.join(process.cwd(), "components/operational/operational-resource-page.tsx"),
    "utf8",
  );
  assert.match(page, /isRowSelected/);
  assert.doesNotMatch(page, /showSelectedActionBar|Start booking|Start cancellation/);
  assert.doesNotMatch(page, /fixed bottom-4 left-1\/2/);
});

test("buildColumns source no longer unshifts leading action keys", () => {
  const source = readFileSync(
    path.join(process.cwd(), "components/operational/operational-columns.tsx"),
    "utf8",
  );
  assert.match(source, /JobTimelineDeepLink/);
  assert.match(source, /GranotContactChip/);
  assert.match(source, /StoredLeadChip/);
  assert.match(source, /sticky: "right"/);
  assert.match(source, /border-l-2 border-steel-200/);
  assert.match(source, /w-px whitespace-nowrap/);
  assert.match(source, /justify-center/);
  assert.doesNotMatch(source, /right-16/);
  assert.doesNotMatch(source, /\{copy\.delete\}/);
  assert.doesNotMatch(source, /key: "__book"/);
  assert.doesNotMatch(source, /key: "__mark_bad"/);
  assert.doesNotMatch(source, /key: "__cancel"/);
  assert.doesNotMatch(source, /key: "__delete"/);
  assert.doesNotMatch(source, /key: "__related"/);
  assert.match(source, /key: "__select"/);
  assert.doesNotMatch(source, /columns\.unshift\(\{\s*key: "__(book|mark_bad|cancel|delete|related)/);
});
