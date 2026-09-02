import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DetailPanelTabStrip } from "../components/operational/detail-panel-tab-strip";
import { LeadMessageSection } from "../components/operational/lead-message-section";
import { OPERATIONAL_COPY } from "../components/operational/operational-copy";
import { apiFiltersFromUrlState } from "../components/operational/operational-url-state";
import {
  productionEditAllowedFor,
  resolveActivePanel,
  visibleDetailTabs,
  type VisibleDetailTabsContext,
} from "../components/operational/visible-detail-tabs";
import { adminExportUrl } from "../lib/api/admin";
import type { AdminRecord, UiResource } from "../lib/api/admin";
import type { TableQueryParams } from "../lib/api/types";

const root = process.cwd();

function ctx(overrides: Partial<VisibleDetailTabsContext> = {}): VisibleDetailTabsContext {
  return {
    readOnly: false,
    database_scope: "production",
    canDelete: false,
    productionEditAllowed: true,
    ...overrides,
  };
}

function record(overrides: AdminRecord = {}): AdminRecord {
  return { _id: "507f1f77bcf86cd799439011", ...overrides };
}

test("visibleDetailTabs matches the §6.2 matrix for each resource", () => {
  assert.deepEqual(
    visibleDetailTabs("form-leads", record(), ctx()),
    ["summary", "contact", "message", "actions", "production", "source"],
  );
  assert.deepEqual(
    visibleDetailTabs(
      "duplicate-form-leads",
      record(),
      ctx({ readOnly: true, productionEditAllowed: false }),
    ),
    ["summary", "contact", "message", "source"],
  );
  assert.deepEqual(
    visibleDetailTabs("call-leads", record(), ctx()),
    ["summary", "contact", "actions", "production", "source"],
  );
  assert.deepEqual(
    visibleDetailTabs(
      "duplicate-call-leads",
      record(),
      ctx({ readOnly: true, productionEditAllowed: false }),
    ),
    ["summary", "contact", "source"],
  );
  assert.deepEqual(
    visibleDetailTabs("bookings", record(), ctx()),
    ["summary", "contact", "actions", "production", "source"],
  );
  assert.deepEqual(
    visibleDetailTabs("cancellations", record(), ctx()),
    ["summary", "contact", "production", "source"],
  );
  assert.deepEqual(
    visibleDetailTabs("customers", record(), ctx()),
    ["summary", "contact", "production"],
  );
  assert.deepEqual(
    visibleDetailTabs("agents", record(), ctx({ productionEditAllowed: false })),
    ["summary"],
  );
});

test("visibleDetailTabs hides Actions and Production record for historical leads", () => {
  assert.deepEqual(
    visibleDetailTabs(
      "form-leads",
      record(),
      ctx({
        readOnly: true,
        database_scope: "historical",
        productionEditAllowed: false,
        canDelete: false,
      }),
    ),
    ["summary", "contact", "message", "source"],
  );
});

test("visibleDetailTabs hides Actions and Production record for duplicate form leads", () => {
  assert.deepEqual(
    visibleDetailTabs(
      "duplicate-form-leads",
      record(),
      ctx({ readOnly: true, productionEditAllowed: false }),
    ),
    ["summary", "contact", "message", "source"],
  );
});

test("visibleDetailTabs for a Referral Booking hides Cancel Actions unless a related lead exists", () => {
  const referral = record({ is_referral_booking: true });
  assert.deepEqual(
    visibleDetailTabs(
      "bookings",
      referral,
      ctx({ productionEditAllowed: false, canDelete: false }),
    ),
    ["summary", "contact", "source"],
  );
  assert.deepEqual(
    visibleDetailTabs(
      "bookings",
      record({ is_referral_booking: true, lead_ref: "507f1f77bcf86cd799439012", lead_model: "FormLead" }),
      ctx({ productionEditAllowed: false, canDelete: false }),
    ),
    ["summary", "contact", "actions", "source"],
  );
});

test("visibleDetailTabs shows Production record for owner-delete when the booking is not editable", () => {
  assert.deepEqual(
    visibleDetailTabs(
      "bookings",
      record({ is_referral_booking: true }),
      ctx({ productionEditAllowed: false, canDelete: true }),
    ),
    ["summary", "contact", "production", "source"],
  );
  assert.deepEqual(
    visibleDetailTabs(
      "cancellations",
      record(),
      ctx({ productionEditAllowed: false, canDelete: true }),
    ),
    ["summary", "contact", "production", "source"],
  );
});

test("productionEditAllowedFor is false for Referral, historical, and duplicate records", () => {
  assert.equal(
    productionEditAllowedFor("bookings", record({ is_referral_booking: true }), {
      database_scope: "production",
    }),
    false,
  );
  assert.equal(
    productionEditAllowedFor("form-leads", record(), {
      database_scope: "historical",
    }),
    false,
  );
  assert.equal(
    productionEditAllowedFor("duplicate-form-leads", record(), {
      database_scope: "production",
    }),
    false,
  );
  assert.equal(
    productionEditAllowedFor("form-leads", record(), {
      database_scope: "production",
    }),
    true,
  );
});

test("resolveActivePanel keeps a visible tab and falls back to Summary when hidden", () => {
  const formTabs = visibleDetailTabs("form-leads", record(), ctx());
  assert.equal(resolveActivePanel(formTabs, "message", { uiResource: "form-leads" }), "message");
  assert.equal(resolveActivePanel(formTabs, "unknown", { uiResource: "form-leads" }), "summary");

  const callTabs = visibleDetailTabs("call-leads", record(), ctx());
  assert.equal(resolveActivePanel(callTabs, "message", { uiResource: "call-leads" }), "summary");

  const bookingTabs = visibleDetailTabs("bookings", record(), ctx());
  assert.equal(resolveActivePanel(bookingTabs, "message", { uiResource: "bookings" }), "summary");
});

test("resolveActivePanel sends ?connect=1 on a Leadless Booking to Contact", () => {
  const bookingTabs = visibleDetailTabs(
    "bookings",
    record({ is_leadless_booking: true }),
    ctx(),
  );
  assert.equal(
    resolveActivePanel(bookingTabs, undefined, { connect: true, uiResource: "bookings" }),
    "contact",
  );
  assert.equal(
    resolveActivePanel(bookingTabs, "message", { connect: true, uiResource: "bookings" }),
    "contact",
  );
  assert.equal(
    resolveActivePanel(bookingTabs, "summary", { connect: true, uiResource: "bookings" }),
    "summary",
  );
});

test("?record= + ?panel=message on a Form Lead selects Lead Message", () => {
  const tabs = visibleDetailTabs("form-leads", record(), ctx());
  const active = resolveActivePanel(tabs, "message", { uiResource: "form-leads" });
  assert.equal(active, "message");
  const html = renderToStaticMarkup(
    createElement(DetailPanelTabStrip, {
      tabs,
      active,
      uiResource: "form-leads" satisfies UiResource,
      onSelect: () => undefined,
    }),
  );
  assert.match(html, /aria-selected="true"[^>]*>Lead Message/);
  assert.match(html, /aria-selected="false"[^>]*>Summary/);
  assert.match(html, /Lead Message/);
  assert.doesNotMatch(html, /text message|SMS Message|Provenance|Conversation/);
});

test("apiFiltersFromUrlState strips record, connect, and panel from list and export URLs", () => {
  const filters = {
    database_scope: "production",
    page: 1,
    limit: 50,
    q: "smith",
    record: "507f1f77bcf86cd799439011",
    connect: "1",
    panel: "message",
  } as TableQueryParams;
  const apiFilters = apiFiltersFromUrlState(filters);
  assert.equal("record" in apiFilters, false);
  assert.equal("connect" in apiFilters, false);
  assert.equal("panel" in apiFilters, false);
  assert.equal(apiFilters.q, "smith");
  const exportUrl = adminExportUrl("form-leads", apiFilters);
  assert.doesNotMatch(exportUrl, /[?&]panel=/);
  assert.doesNotMatch(exportUrl, /[?&]record=/);
  assert.doesNotMatch(exportUrl, /[?&]connect=/);
  assert.match(exportUrl, /q=smith/);
});

test("detail panel and Lead Message sources never dump record or sms_message JSON", () => {
  const panel = readFileSync(
    path.join(root, "components/operational/operational-detail-panel.tsx"),
    "utf8",
  );
  const leadMessage = readFileSync(
    path.join(root, "components/operational/lead-message-section.tsx"),
    "utf8",
  );
  assert.doesNotMatch(panel, /JSON\.stringify/);
  assert.doesNotMatch(leadMessage, /JSON\.stringify/);
  assert.doesNotMatch(panel, /Raw Identifiers/);
  assert.doesNotMatch(leadMessage, /Message data/);
  assert.doesNotMatch(leadMessage, /SMS Message/);
});

test("Form Lead with a Lead Message shows the body text and hides Message data", () => {
  const html = renderToStaticMarkup(
    createElement(LeadMessageSection, {
      record: {
        _id: "507f1f77bcf86cd799439011",
        sms_message_sent: true,
        sms_message: {
          status: "delivered",
          body: "Thanks for requesting a quote.",
        },
      },
    }),
  );
  assert.match(html, /Thanks for requesting a quote\./);
  assert.doesNotMatch(html, /Message data/);
  assert.doesNotMatch(html, /"status": "delivered"/);
  assert.match(html, /Lead Message sent/);
});

test("Form Lead without a Lead Message uses the empty-state sentence", () => {
  const html = renderToStaticMarkup(
    createElement(LeadMessageSection, {
      record: { _id: "507f1f77bcf86cd799439011", sms_message_sent: false },
    }),
  );
  assert.match(html, /No Lead Message is associated with this Form Lead\./);
  assert.match(html, /False/);
  assert.doesNotMatch(html, /Message data/);
});

test("closing the panel and list/export filters drop record, panel, and connect", () => {
  const page = readFileSync(
    path.join(root, "components/operational/operational-resource-page.tsx"),
    "utf8",
  );
  assert.match(page, /apiFiltersFromUrlState/);
  assert.match(page, /update\(\{ record: null, panel: null, connect: null \}/);
  assert.match(page, /requestedPanel=\{requestedPanelFromUrl\(filters\)\}/);
  assert.match(page, /startConnect=\{connectFromUrl\(filters\)\}/);
});

test("row open writes record and panel together so the tab default cannot drop record", () => {
  const page = readFileSync(
    path.join(root, "components/operational/operational-resource-page.tsx"),
    "utf8",
  );
  assert.match(
    page,
    /update\(\s*\{\s*record: id,\s*panel: requestedPanelFromUrl\(filters\) \?\? "summary"\s*\}/,
  );
});

test("tab fallback only writes panel when a requested tab is already in the URL", () => {
  const panel = readFileSync(
    path.join(root, "components/operational/operational-detail-panel.tsx"),
    "utf8",
  );
  assert.match(panel, /if \(!record \|\| !onPanelChange \|\| !requestedPanel\)/);
});

test("owner copy uses required labels and omits forbidden Owner strings", () => {
  assert.equal(OPERATIONAL_COPY.tabs.message, "Lead Message");
  assert.equal(OPERATIONAL_COPY.tabs.production, "Production record");
  assert.equal(OPERATIONAL_COPY.leadMessage.empty, "No Lead Message is associated with this Form Lead.");
  assert.equal(
    OPERATIONAL_COPY.production.saved,
    "Saved. The table and detail caches were refreshed.",
  );
  const blob = JSON.stringify(OPERATIONAL_COPY);
  for (const forbidden of [
    "Raw Identifiers",
    "sms_message",
    "lead_ref",
    "is_leadless_booking",
    "wordpress_form",
    "text message",
    "Bad Call",
    "SMS Message",
  ]) {
    assert.equal(blob.includes(forbidden), false, forbidden);
  }
});
