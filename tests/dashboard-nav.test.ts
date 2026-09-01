import assert from "node:assert/strict";
import test from "node:test";
import {
  dashboardNavSections,
  isActivePath,
  pageTitleForPath,
  visibleDashboardNav,
  visibleDashboardNavSections,
} from "../components/layout/dashboard-nav";

function hrefs(items: { href: string }[]): string[] {
  return items.map((item) => item.href);
}

test("owner flat nav keeps Overview, Live Events, Lead Conversations, then Intakes and Form Leads", () => {
  const owner = visibleDashboardNav("owner");

  assert.equal(owner[0]?.label, "Overview");
  assert.equal(owner[0]?.href, "/");
  assert.equal(owner[1]?.label, "Live Events");
  assert.equal(owner[1]?.href, "/live-events");
  assert.equal(owner[1]?.ownerOnly, true);
  assert.equal(owner[2]?.label, "Lead Conversations");
  assert.equal(owner[2]?.href, "/conversations");
  assert.equal(owner[2]?.ownerOnly, true);
  assert.equal(owner[3]?.label, "Intakes");
  assert.equal(owner[3]?.href, "/intakes");
  assert.equal(owner[3]?.ownerOnly, true);
  assert.equal(owner[4]?.label, "Form Leads");
  assert.equal(owner[4]?.href, "/form-leads");
  assert.equal(
    owner.some((item) => "isNew" in item && item.isNew),
    false,
  );

  const formIndex = owner.findIndex((item) => item.href === "/form-leads");
  const duplicateFormIndex = owner.findIndex((item) => item.href === "/duplicate-form-leads");
  const callIndex = owner.findIndex((item) => item.href === "/call-leads");
  const duplicateCallIndex = owner.findIndex((item) => item.href === "/duplicate-call-leads");
  assert.ok(formIndex > 2);
  assert.equal(duplicateFormIndex, formIndex + 1);
  assert.equal(owner[duplicateFormIndex]?.label, "Duplicate Form Leads");
  assert.equal(duplicateCallIndex, callIndex + 1);
  assert.equal(owner[duplicateCallIndex]?.label, "Duplicate Call Leads");
});

test("admin flat nav omits owner-only destinations", () => {
  const admin = visibleDashboardNav("admin");
  const adminHrefs = hrefs(admin);

  for (const href of [
    "/live-events",
    "/conversations",
    "/intakes",
    "/job-timeline",
    "/audit-log",
    "/settings",
  ]) {
    assert.equal(adminHrefs.includes(href), false, href);
  }

  assert.deepEqual(adminHrefs.slice(0, 3), ["/", "/form-leads", "/duplicate-form-leads"]);
});

test("owner sections keep the five groups and admin Today and System shrink", () => {
  assert.deepEqual(
    dashboardNavSections.map((section) => section.id),
    ["today", "records", "people", "insight", "system"],
  );

  const owner = visibleDashboardNavSections("owner");
  assert.deepEqual(
    owner.map((section) => section.id),
    ["today", "records", "people", "insight", "system"],
  );
  assert.deepEqual(hrefs(owner.find((section) => section.id === "today")!.items), [
    "/",
    "/live-events",
    "/conversations",
    "/intakes",
  ]);
  assert.deepEqual(hrefs(owner.find((section) => section.id === "records")!.items), [
    "/form-leads",
    "/call-leads",
    "/bookings",
    "/cancellations",
    "/job-timeline",
    "/customers",
  ]);
  assert.deepEqual(hrefs(owner.find((section) => section.id === "people")!.items), [
    "/agents",
    "/testimonials",
  ]);
  assert.deepEqual(hrefs(owner.find((section) => section.id === "insight")!.items), [
    "/analytics",
    "/reports/agent-sales",
    "/reporting",
    "/exports",
  ]);
  assert.deepEqual(hrefs(owner.find((section) => section.id === "system")!.items), [
    "/observational",
    "/operations-registry",
    "/ingestion",
    "/audit-log",
    "/settings",
  ]);

  const admin = visibleDashboardNavSections("admin");
  assert.deepEqual(
    admin.map((section) => section.id),
    ["today", "records", "people", "insight", "system"],
  );
  assert.deepEqual(hrefs(admin.find((section) => section.id === "today")!.items), ["/"]);
  assert.deepEqual(hrefs(admin.find((section) => section.id === "records")!.items), [
    "/form-leads",
    "/call-leads",
    "/bookings",
    "/cancellations",
    "/customers",
  ]);
  assert.deepEqual(hrefs(admin.find((section) => section.id === "insight")!.items), [
    "/analytics",
    "/reports/agent-sales",
    "/reporting",
    "/exports",
  ]);
  assert.deepEqual(hrefs(admin.find((section) => section.id === "system")!.items), [
    "/observational",
    "/operations-registry",
    "/ingestion",
  ]);
});

test("Job Timeline sidebar label is title case", () => {
  const jobTimeline = visibleDashboardNav("owner").find((item) => item.href === "/job-timeline");
  assert.equal(jobTimeline?.label, "Job Timeline");
  assert.equal(jobTimeline?.ownerOnly, true);
  assert.equal(
    visibleDashboardNav("owner").some((item) => item.label === "Job timeline"),
    false,
  );
});

test("Audit Log uses a distinct icon from nested duplicate destinations", () => {
  const owner = visibleDashboardNavSections("owner");
  const formLeads = owner.flatMap((section) => section.items).find((item) => item.href === "/form-leads");
  const auditLog = owner.flatMap((section) => section.items).find((item) => item.href === "/audit-log");
  const duplicateIcon = formLeads?.children?.[0]?.icon;

  assert.equal(formLeads?.children?.[0]?.href, "/duplicate-form-leads");
  assert.ok(auditLog?.icon);
  assert.ok(duplicateIcon);
  assert.notEqual(auditLog.icon, duplicateIcon);
});

test("pageTitleForPath uses nav labels, then longer special prefixes", () => {
  assert.equal(pageTitleForPath("/"), "Overview");
  assert.equal(pageTitleForPath("/form-leads"), "Form Leads");
  assert.equal(pageTitleForPath("/duplicate-form-leads"), "Duplicate Form Leads");
  assert.equal(pageTitleForPath("/bookings"), "Bookings");
  assert.equal(pageTitleForPath("/bookings/reconciliation"), "Booking Reconciliation");
  assert.equal(pageTitleForPath("/bookings/new"), "Precise Booking Form");
  assert.equal(pageTitleForPath("/job-timeline"), "Job Timeline");
  assert.equal(pageTitleForPath("/search"), "Search");
  assert.equal(pageTitleForPath("/ingestion/granot/lifecycle"), "Ingestion");
  assert.equal(pageTitleForPath("/live-events"), "Live Events");
  assert.equal(pageTitleForPath("/cancellations/new"), "New Cancellation");
});

test("isActivePath treats Overview as exact and prefixes other destinations", () => {
  assert.equal(isActivePath("/", "/"), true);
  assert.equal(isActivePath("/form-leads", "/"), false);
  assert.equal(isActivePath("/form-leads", "/form-leads"), true);
  assert.equal(isActivePath("/bookings/reconciliation", "/bookings"), true);
  assert.equal(isActivePath("/duplicate-form-leads", "/form-leads"), false);
});
