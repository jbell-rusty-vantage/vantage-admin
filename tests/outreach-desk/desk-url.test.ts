import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalDeskQuery,
  defaultDeskView,
  deskNavViews,
  deskRouteDecision,
  deskViewHref,
  deskViewsFor,
} from "../../components/outreach-desk/data/desk-url";
import { visibleDashboardNav } from "../../components/layout/dashboard-nav";

const ID = "65f0000000000000000000cd";
const AGENT = "65f0000000000000000000ab";
const params = (query: string) => Object.fromEntries([...new URLSearchParams(query).keys()].map((key) => [key, new URLSearchParams(query).getAll(key)]));

test("frames per role (IMPL-02): Owner all six, Manager four, Rep three; defaults team / my", () => {
  assert.deepEqual(deskViewsFor("owner"), ["team", "my", "activity", "settings", "numbers", "accounts"]);
  assert.deepEqual(deskViewsFor("manager"), ["team", "my", "activity", "settings"]);
  assert.deepEqual(deskViewsFor("rep"), ["my", "activity", "settings"]);
  assert.equal(defaultDeskView("owner"), "team");
  assert.equal(defaultDeskView("manager"), "team");
  assert.equal(defaultDeskView("rep"), "my");
});

test("the sidebar lists the role's frames narrowed to the server's permitted_views (S4)", () => {
  assert.deepEqual(deskNavViews("rep", null), ["my", "activity", "settings"]);
  assert.deepEqual(deskNavViews("rep", ["my", "activity"]), ["my", "activity"]);
  assert.deepEqual(deskNavViews("manager", ["team", "my", "activity", "settings"]), ["team", "my", "activity", "settings"]);
  assert.deepEqual(deskNavViews("manager", ["settings"]), ["settings"]);
  assert.deepEqual(deskNavViews("owner", ["settings", "numbers", "accounts"]), ["settings", "numbers", "accounts"]);
  // A view the server lists but the role's URL rule lacks never appears.
  assert.deepEqual(deskNavViews("rep", ["my", "team"]), ["my"]);
});

test("the route writes `view` first and redirects any non-canonical or foreign link", () => {
  assert.deepEqual(deskRouteDecision({}, "owner"), { kind: "redirect", href: "/outreach-desk?view=team" });
  assert.deepEqual(deskRouteDecision({}, "rep"), { kind: "redirect", href: "/outreach-desk?view=my" });
  assert.deepEqual(deskRouteDecision(params("view=team"), "manager"), { kind: "render", view: "team" });
  // A Rep never gets a team, Numbers or Accounts frame, nor another rep's queue.
  assert.deepEqual(deskRouteDecision(params("view=team"), "rep"), { kind: "redirect", href: "/outreach-desk?view=my" });
  assert.deepEqual(deskRouteDecision(params("view=numbers"), "rep"), { kind: "redirect", href: "/outreach-desk?view=my" });
  assert.deepEqual(deskRouteDecision(params(`view=my&agent=${AGENT}`), "rep"), { kind: "redirect", href: "/outreach-desk?view=my" });
  // A Manager has no Numbers or Accounts.
  assert.deepEqual(deskRouteDecision(params("view=accounts"), "manager"), { kind: "redirect", href: "/outreach-desk?view=team" });
  // Owner/Manager may inspect a rep's My view.
  assert.deepEqual(deskRouteDecision(params(`view=my&agent=${AGENT}`), "manager"), { kind: "render", view: "my" });
  // Unknown keys and invalid values are dropped; a selected lead is kept on its frame.
  assert.deepEqual(deskRouteDecision(params(`view=my&lead=${ID}&outreach=x&database_scope=production`), "rep"), { kind: "redirect", href: `/outreach-desk?view=my&lead=${ID}` });
  assert.deepEqual(deskRouteDecision(params("view=my&lead=not-an-id"), "rep"), { kind: "redirect", href: "/outreach-desk?view=my" });
});

test("Numbers and Accounts keep their own Sales Intelligence state under view=numbers / view=accounts", () => {
  assert.equal(canonicalDeskQuery(new URLSearchParams(`view=numbers&number=${ID}&lead=${ID}`), "owner").toString(), `view=numbers&number=${ID}`);
  assert.equal(canonicalDeskQuery(new URLSearchParams("view=accounts&directory_cursor=d1&q=x"), "owner").toString(), "view=accounts&directory_cursor=d1");
  assert.deepEqual(deskRouteDecision(params(`view=numbers&number=${ID}`), "owner"), { kind: "render", view: "numbers" });
});

test("queue filters are kept per frame; an individual rep wins over Unassigned", () => {
  assert.equal(
    canonicalDeskQuery(new URLSearchParams(`view=team&agent=${AGENT}&unassigned=true&workflow=quoted&state=all_active&sort=lead_received&direction=asc&q=smith`), "owner").toString(),
    `view=team&agent=${AGENT}&q=smith&workflow=quoted&state=all_active&sort=lead_received&direction=asc`,
  );
  assert.equal(canonicalDeskQuery(new URLSearchParams("view=team&unassigned=true&workflow=bogus"), "manager").toString(), "view=team&unassigned=true");
  assert.equal(canonicalDeskQuery(new URLSearchParams("view=settings&workflow=new&section=goals"), "owner").toString(), "view=settings&section=goals");
  assert.equal(deskViewHref("my", { agent: AGENT, lead: ID }), `/outreach-desk?view=my&agent=${AGENT}&lead=${ID}`);
});

test("the Admin nav: a Manager sees only Daily Operations and the Outreach Desk", () => {
  assert.deepEqual(visibleDashboardNav("manager").map((item) => item.href), ["/daily", "/outreach-desk"]);
  assert.equal(visibleDashboardNav("admin").some((item) => item.href === "/outreach-desk"), false);
  assert.equal(visibleDashboardNav("owner").some((item) => item.href === "/outreach-desk" && item.label === "Outreach Desk"), true);
});
