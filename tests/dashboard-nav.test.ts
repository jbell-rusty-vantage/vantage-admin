import assert from "node:assert/strict";
import test from "node:test";
import {
  activeNavKey,
  dashboardHomeFor,
  dashboardNavItems,
  isActivePath,
  pageTitleForPath,
  visibleDashboardNav,
} from "../components/layout/dashboard-nav";
import { Server } from "lucide-react";
import { sidebarBadgeCounts } from "../components/layout/use-sidebar-badges";
import { insightsTabForPath } from "../components/insights/insights-tabs";
import { setupSectionsFor } from "../components/setup/setup-sections";

function hrefs(items: { href: string }[]): string[] {
  return items.map((item) => item.href);
}

// Doc 17 (2026-10-06): Automations joined the sidebar as the Owner's tab for Granot updates and later Granot reads.
// Doc 11b (2026-10-07): Systems joined between Automations and Insights, Owner only.
test("the sidebar has eight destinations in the Owner's order: Today, Leads, Bookings, Outreach Desk, Automations, Systems, Insights, Setup", () => {
  assert.deepEqual(
    dashboardNavItems.map((item) => item.key),
    ["today", "leads", "bookings", "outreach-desk", "automations", "systems", "insights", "setup"],
  );
  assert.deepEqual(hrefs(visibleDashboardNav("owner")), ["/", "/leads", "/bookings", "/outreach-desk", "/automations", "/systems", "/insights", "/setup"]);
  assert.deepEqual(
    visibleDashboardNav("owner").map((item) => item.label),
    ["Today", "Leads", "Bookings", "Outreach Desk", "Automations", "Systems", "Insights", "Setup"],
  );
  const systems = dashboardNavItems.find((item) => item.key === "systems")!;
  assert.equal(systems.ownerOnly, true);
  assert.equal(systems.icon, Server);
});

test("Admin sees Leads, Bookings, Insights and Setup; a Manager sees Today and the Outreach Desk", () => {
  assert.deepEqual(hrefs(visibleDashboardNav("admin")), ["/leads", "/bookings", "/insights", "/setup"]);
  assert.deepEqual(hrefs(visibleDashboardNav("manager")), ["/", "/outreach-desk"]);
  assert.equal(dashboardHomeFor("owner"), "/");
  assert.equal(dashboardHomeFor("manager"), "/");
  assert.equal(dashboardHomeFor("admin"), "/leads");
});

test("badges sit on Today, Leads, Bookings and Automations and are counts, never zero", () => {
  assert.deepEqual(
    visibleDashboardNav("owner").map((item) => item.badge ?? null),
    ["today", "leads", "bookings", null, "automations", null, null, null],
  );
  // Automations counts the Granot checks waiting for approval (doc 17); Leads stays empty.
  assert.deepEqual(sidebarBadgeCounts({ stillOpen: 3, unassigned: 5, granotWaiting: 1 }), { today: 8, bookings: 3, leads: null, automations: 1 });
  assert.deepEqual(sidebarBadgeCounts({ stillOpen: 0, unassigned: null }), { today: null, bookings: null, leads: null, automations: null });
  assert.deepEqual(sidebarBadgeCounts({ stillOpen: 0, unassigned: null, granotWaiting: 0 }), { today: null, bookings: null, leads: null, automations: null });
});

test("regrouped old destinations keep their new sidebar item active", () => {
  assert.equal(activeNavKey("/"), "today");
  assert.equal(activeNavKey("/daily"), "today");
  assert.equal(activeNavKey("/leads"), "leads");
  assert.equal(activeNavKey("/leads/timeline"), "leads");
  assert.equal(activeNavKey("/job-timeline"), "leads");
  assert.equal(activeNavKey("/bookings/cancellations"), "bookings");
  assert.equal(activeNavKey("/intakes"), "bookings");
  assert.equal(activeNavKey("/cancellations/new"), "bookings");
  assert.equal(activeNavKey("/outreach-desk"), "outreach-desk");
  assert.equal(activeNavKey("/automations"), "automations");
  assert.equal(activeNavKey("/automations/granot-updates/group-1"), "automations");
  assert.equal(activeNavKey("/systems"), "systems");
  assert.equal(pageTitleForPath("/systems"), "Systems");
  assert.equal(activeNavKey("/insights/sheets"), "insights");
  assert.equal(activeNavKey("/reporting/abc/edit"), "insights");
  assert.equal(activeNavKey("/analytics"), "insights");
  assert.equal(activeNavKey("/setup"), "setup");
  assert.equal(activeNavKey("/operations-registry"), "setup");
  assert.equal(activeNavKey("/granot-lifecycle/health"), "setup");
  assert.equal(activeNavKey("/ingestion/granot"), "setup");
  assert.equal(activeNavKey("/extension"), "setup");
  assert.equal(activeNavKey("/testimonials"), "setup");
  assert.equal(activeNavKey("/login"), null);
});

test("retired destinations are not in the sidebar for any role", () => {
  for (const role of ["owner", "admin", "manager"] as const) {
    const navHrefs = hrefs(visibleDashboardNav(role));
    for (const href of [
      "/form-leads",
      "/duplicate-form-leads",
      "/call-leads",
      "/duplicate-call-leads",
      "/cancellations",
      "/daily",
      "/manual",
      "/search",
      "/job-timeline",
      "/intakes",
      "/analytics",
      "/reporting",
      "/operations-registry",
      "/extension",
      "/testimonials",
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
      assert.equal(navHrefs.includes(href), false, `${role} ${href}`);
    }
  }
});

test("pageTitleForPath uses nav labels, then longer special prefixes", () => {
  assert.equal(pageTitleForPath("/"), "Today");
  assert.equal(pageTitleForPath("/leads"), "Leads");
  assert.equal(pageTitleForPath("/leads/timeline"), "Job Timeline");
  assert.equal(pageTitleForPath("/bookings"), "Bookings");
  assert.equal(pageTitleForPath("/bookings/cancellations"), "Bookings");
  assert.equal(pageTitleForPath("/bookings/reconciliation"), "Booking Reconciliation");
  assert.equal(pageTitleForPath("/bookings/new"), "Precise Booking Form");
  assert.equal(pageTitleForPath("/intakes"), "Bookings to finish");
  assert.equal(pageTitleForPath("/cancellations/new"), "Record a cancellation");
  assert.equal(pageTitleForPath("/automations"), "Automations");
  assert.equal(pageTitleForPath("/automations/granot-updates"), "Granot updates");
  assert.equal(pageTitleForPath("/automations/granot-updates/group-1"), "Granot updates");
  assert.equal(pageTitleForPath("/insights"), "Insights");
  assert.equal(pageTitleForPath("/insights/sheets"), "Insights");
  assert.equal(pageTitleForPath("/reporting/new"), "Create New Report");
  assert.equal(pageTitleForPath("/setup"), "Setup");
  assert.equal(pageTitleForPath("/operations-registry"), "Setup");
  assert.equal(pageTitleForPath("/granot-lifecycle/health"), "Connections & health");
  assert.equal(pageTitleForPath("/ingestion/granot/lifecycle"), "Connections & health");
  assert.equal(pageTitleForPath("/extension"), "People & access");
  assert.equal(pageTitleForPath("/testimonials"), "Website");
});

test("isActivePath treats Today as exact and prefixes other destinations", () => {
  assert.equal(isActivePath("/", "/"), true);
  assert.equal(isActivePath("/leads", "/"), false);
  assert.equal(isActivePath("/leads", "/leads"), true);
  assert.equal(isActivePath("/bookings/reconciliation", "/bookings"), true);
  assert.equal(isActivePath("/leadsx", "/leads"), false);
});

test("Insights tabs: Sheets covers the reporting sub-pages", () => {
  assert.equal(insightsTabForPath("/insights"), "analytics");
  assert.equal(insightsTabForPath("/insights/sheets"), "sheets");
  assert.equal(insightsTabForPath("/reporting/destinations/x"), "sheets");
});

test("Setup sections: Admin does not see Connections or Website (doc 19: sections are routes, People is one card)", () => {
  const owner = setupSectionsFor("owner");
  const admin = setupSectionsFor("admin");
  assert.deepEqual(
    owner.map((section) => section.key),
    ["lead-sources", "lead-costs", "people", "merchants", "carriers", "connections", "sheet-ingestion", "website", "changes"],
  );
  assert.deepEqual(
    admin.map((section) => section.key),
    ["lead-sources", "lead-costs", "people", "merchants", "carriers", "sheet-ingestion", "changes"],
  );
  assert.equal(owner.find((section) => section.key === "people")!.href, "/setup/people");
});
