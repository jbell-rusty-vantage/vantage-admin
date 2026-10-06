import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  buildSearchHref,
  filterPaletteDestinations,
  isCommandPaletteHotkey,
  paletteRecordHref,
  paletteRecordsFromSearch,
} from "../components/layout/command-palette";
import { visibleDashboardNav } from "../components/layout/dashboard-nav";
import { initialsFromEmail, UserMenu } from "../components/layout/user-menu";

const destinations = [
  { label: "Today", href: "/" },
  { label: "Leads", href: "/leads" },
  { label: "Bookings", href: "/bookings" },
];

test("buildSearchHref sends the text to the Leads workspace and carries no database scope", () => {
  assert.equal(buildSearchHref("  P5562014  "), "/leads?q=P5562014");
});

test("⌘K hits open the record in place: leads in the Leads panel, bookings and cancellations in Bookings", () => {
  assert.equal(paletteRecordHref("form_lead", "l1"), "/leads?lead=l1&lk=form");
  assert.equal(paletteRecordHref("call-leads", "l2"), "/leads?lead=l2&lk=call");
  assert.equal(paletteRecordHref("booked_lead", "b1"), "/bookings?record=b1");
  assert.equal(paletteRecordHref("cancelled-leads", "c1"), "/bookings/cancellations?record=c1");
  const rows = paletteRecordsFromSearch({
    groups: [
      { record_type: "cancelled_lead", items: [{ id: "c1", primary_label: "Maria Lopez", badges: ["Oct 9"] }] },
      { record_type: "booked_lead", items: [{ id: "b1", primary_label: "Steve Dority" }] },
      { record_type: "call_lead", items: [{ id: "l2", primary_label: "Kifornee Welch", secondary_label: "(562) 276-8403" }] },
      { record_type: "form_lead", items: [{ id: "l1", primary_label: "Scarlette Stafford" }] },
    ],
  });
  assert.deepEqual(
    rows.map((row) => [row.kind, row.id, row.pill]),
    [
      ["lead", "l2", "Call"],
      ["lead", "l1", "Form"],
      ["booking", "b1", undefined],
      ["cancellation", "c1", "Cancelled"],
    ],
  );
  assert.equal(rows[0]?.secondary, "(562) 276-8403");
  assert.deepEqual(paletteRecordsFromSearch(undefined), []);
});

test("buildSearchHref returns an empty string for empty or whitespace queries", () => {
  assert.equal(buildSearchHref(""), "");
  assert.equal(buildSearchHref("   "), "");
});

test("filterPaletteDestinations matches label or href case-insensitively", () => {
  const matches = filterPaletteDestinations(destinations, "lead");
  assert.deepEqual(matches, [{ label: "Leads", href: "/leads" }]);
  assert.deepEqual(filterPaletteDestinations(destinations, "/LEADS"), [{ label: "Leads", href: "/leads" }]);
});

test("filterPaletteDestinations returns all destinations for an empty query", () => {
  assert.deepEqual(filterPaletteDestinations(destinations, ""), destinations);
  assert.deepEqual(filterPaletteDestinations(destinations, "   "), destinations);
});

test("admin palette destinations omit Today and the Outreach Desk", () => {
  const destinations = visibleDashboardNav("admin").map(({ label, href }) => ({ label, href }));
  const hrefs = destinations.map((destination) => destination.href);

  for (const href of ["/", "/outreach-desk", "/daily", "/sales-intelligence", "/intakes", "/manual", "/job-timeline", "/extension"]) {
    assert.equal(hrefs.includes(href), false, href);
  }
  assert.deepEqual(hrefs, ["/leads", "/bookings", "/insights", "/setup"]);
});

test("palette destinations never offer a retired destination", () => {
  for (const role of ["owner", "admin"] as const) {
    const hrefs = visibleDashboardNav(role).map(({ href }) => href);
    for (const href of [
      "/customers",
      "/agents",
      "/observational",
      "/exports",
      "/audit-log",
      "/reports/agent-sales",
      "/conversations",
      "/live-events",
      "/granot-lifecycle/receipts",
    ]) {
      assert.equal(hrefs.includes(href), false, `${role} ${href}`);
    }
  }
});

test("isCommandPaletteHotkey is true for meta/ctrl + k and false for k alone", () => {
  assert.equal(isCommandPaletteHotkey({ key: "k", metaKey: true, ctrlKey: false }), true);
  assert.equal(isCommandPaletteHotkey({ key: "K", metaKey: false, ctrlKey: true }), true);
  assert.equal(isCommandPaletteHotkey({ key: "k", metaKey: false, ctrlKey: false }), false);
});

test("initialsFromEmail returns one or two uppercase letters", () => {
  assert.equal(initialsFromEmail("ada@vantage.com"), "A");
  assert.equal(initialsFromEmail("ada.lovelace@vantage.com"), "AL");
});

test("UserMenu renders a closed account button with the email", () => {
  const markup = renderToStaticMarkup(createElement(UserMenu, { email: "ada@vantage.com", role: "admin" }));
  assert.match(markup, /ada@vantage.com/);
  assert.match(markup, /aria-label="Account menu"/);
  assert.match(markup, />A</);
});
