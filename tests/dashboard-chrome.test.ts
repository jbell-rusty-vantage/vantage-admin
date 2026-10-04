import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  buildSearchHref,
  filterPaletteDestinations,
  isCommandPaletteHotkey,
} from "../components/layout/command-palette";
import { visibleDashboardNav } from "../components/layout/dashboard-nav";
import { initialsFromEmail, UserMenu } from "../components/layout/user-menu";

const destinations = [
  { label: "Overview", href: "/" },
  { label: "Form Leads", href: "/form-leads" },
  { label: "Call Leads", href: "/call-leads" },
];

test("buildSearchHref trims the query and carries no database scope", () => {
  assert.equal(buildSearchHref("  P5562014  "), "/search?q=P5562014");
});

test("buildSearchHref returns an empty string for empty or whitespace queries", () => {
  assert.equal(buildSearchHref(""), "");
  assert.equal(buildSearchHref("   "), "");
});

test("filterPaletteDestinations matches label or href case-insensitively", () => {
  const matches = filterPaletteDestinations(destinations, "form");
  assert.deepEqual(matches, [{ label: "Form Leads", href: "/form-leads" }]);
  assert.deepEqual(filterPaletteDestinations(destinations, "FORM-LEADS"), [
    { label: "Form Leads", href: "/form-leads" },
  ]);
});

test("filterPaletteDestinations returns all destinations for an empty query", () => {
  assert.deepEqual(filterPaletteDestinations(destinations, ""), destinations);
  assert.deepEqual(filterPaletteDestinations(destinations, "   "), destinations);
});

test("admin palette destinations omit owner-only hrefs", () => {
  const destinations = visibleDashboardNav("admin").map(({ label, href }) => ({ label, href }));
  const hrefs = destinations.map((destination) => destination.href);

  for (const href of [
    "/daily",
    "/sales-intelligence",
    "/intakes",
    "/manual",
    "/job-timeline",
    "/extension",
  ]) {
    assert.equal(hrefs.includes(href), false, href);
  }

  assert.equal(
    filterPaletteDestinations(destinations, "").some((destination) => destination.href === "/daily"),
    false,
  );
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
