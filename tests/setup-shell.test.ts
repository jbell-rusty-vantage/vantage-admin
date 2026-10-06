import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SETUP_COPY } from "../components/setup/setup-copy";
import {
  canOpenSetupSection,
  SETUP_SECTIONS,
  setupBadgeFor,
  setupSectionForPath,
  setupSectionsFor,
} from "../components/setup/setup-sections";
import { SetupNotAllowed, SetupSectionHead } from "../components/setup/setup-shell";
import { findOwnerMarkupLeaks } from "../lib/operations-registry/ownerLanguageDeck";
import { REGISTRY_TAB_TO_SETUP, rewriteRegistryHref, SETUP_ROUTES, setupHrefForRegistryTab } from "../lib/setup/setup-links";
import { setupRedirectRows } from "../lib/setup/setup-redirects";

/*
 * Setup shell (doc 19 "Routes"): the eight sections, their roles, the active-section lookup, the old-link rewrite and
 * the permanent redirect table, which must agree with the rewrite for every old `?tab=` value.
 */

test("Setup has the eight sections of doc 19 in order, each on its own route", () => {
  assert.deepEqual(
    SETUP_SECTIONS.map((section) => section.key),
    ["lead-sources", "lead-costs", "people", "money", "carriers", "connections", "website", "changes"],
  );
  assert.deepEqual(
    SETUP_SECTIONS.map((section) => section.href),
    ["/setup/lead-sources", "/setup/lead-costs", "/setup/people", "/setup/money", "/setup/carriers", "/setup/connections", "/setup/website", "/setup/changes"],
  );
  assert.deepEqual(
    SETUP_SECTIONS.map((section) => section.label),
    ["Lead sources", "Lead costs", "People & access", "Money", "Carriers", "Connections & health", "Website", "Change history"],
  );
});

test("Admin and Manager do not see Connections or Website; the Owner sees all eight", () => {
  assert.deepEqual(
    setupSectionsFor("admin").map((section) => section.key),
    ["lead-sources", "lead-costs", "people", "money", "carriers", "changes"],
  );
  assert.equal(setupSectionsFor("owner").length, 8);
  assert.equal(setupSectionsFor(null).length, 6);
  assert.equal(canOpenSetupSection("admin", "connections"), false);
  assert.equal(canOpenSetupSection("admin", "website"), false);
  assert.equal(canOpenSetupSection("admin", "people"), true);
  assert.equal(canOpenSetupSection("owner", "website"), true);
});

test("the active section follows the pathname; /setup itself is Lead sources", () => {
  assert.equal(setupSectionForPath("/setup")?.key, "lead-sources");
  assert.equal(setupSectionForPath("/setup/lead-sources?source=x&feed=y")?.key, "lead-sources");
  assert.equal(setupSectionForPath("/setup/people")?.key, "people");
  assert.equal(setupSectionForPath("/setup/changes/anything")?.key, "changes");
  assert.equal(setupSectionForPath("/leads"), null);
});

test("badges are counts, never zero, only on Lead sources and People", () => {
  const leadSources = SETUP_SECTIONS[0]!;
  const people = SETUP_SECTIONS[2]!;
  const money = SETUP_SECTIONS[3]!;
  assert.equal(setupBadgeFor(leadSources, { needsYou: 3 }), 3);
  assert.equal(setupBadgeFor(leadSources, { needsYou: 0 }), null);
  assert.equal(setupBadgeFor(people, { notMatched: 2 }), 2);
  assert.equal(setupBadgeFor(money, { needsYou: 9, notMatched: 9 }), null);
});

test("every old Registry tab and page maps to its Setup route with the deep link translated", () => {
  assert.equal(setupHrefForRegistryTab("lead-sources"), "/setup/lead-sources");
  assert.equal(setupHrefForRegistryTab("lead-sources", { entity: "c1" }), "/setup/lead-sources?source=c1");
  assert.equal(setupHrefForRegistryTab("sources", { feed: "f1" }), "/setup/lead-sources?feed=f1");
  assert.equal(setupHrefForRegistryTab("granot-names", { entity: "g1" }), "/setup/lead-sources?view=granot&granot=g1");
  assert.equal(setupHrefForRegistryTab("granot-sources"), "/setup/lead-sources?view=granot");
  assert.equal(setupHrefForRegistryTab("inbound-numbers", { entity: "r1" }), "/setup/lead-sources?view=numbers&number=r1");
  assert.equal(setupHrefForRegistryTab("ringcentral"), "/setup/lead-sources?view=numbers");
  assert.equal(setupHrefForRegistryTab("lead-costs"), "/setup/lead-costs");
  assert.equal(setupHrefForRegistryTab("cpl", { cpl_mode: "advanced", entity: "s1" }), "/setup/lead-costs");
  assert.equal(setupHrefForRegistryTab("lead-costs", { cpl_mode: "corrections" }), "/setup/lead-costs?view=fix");
  assert.equal(setupHrefForRegistryTab("legacy-cpl"), "/setup/lead-costs?view=old");
  assert.equal(setupHrefForRegistryTab("agents", { entity: "a1" }), "/setup/people?person=a1");
  assert.equal(setupHrefForRegistryTab("users"), "/setup/people");
  assert.equal(setupHrefForRegistryTab("merchants"), "/setup/money");
  assert.equal(setupHrefForRegistryTab("moving-carriers"), "/setup/carriers");
  assert.equal(setupHrefForRegistryTab("changes"), "/setup/changes");
  assert.equal(setupHrefForRegistryTab("overview"), "/setup/connections");
  assert.equal(setupHrefForRegistryTab(null), "/setup/lead-sources");
  assert.equal(setupHrefForRegistryTab("something-else"), "/setup/lead-sources");

  assert.equal(rewriteRegistryHref("/operations-registry"), "/setup/lead-sources");
  assert.equal(rewriteRegistryHref("/operations-registry?tab=lead-sources&feed=f1"), "/setup/lead-sources?feed=f1");
  assert.equal(rewriteRegistryHref("/operations-registry?tab=inbound-numbers&entity=r1"), "/setup/lead-sources?view=numbers&number=r1");
  assert.equal(rewriteRegistryHref("/operations-registry?tab=lead-costs&cpl_mode=corrections&entity=j1"), "/setup/lead-costs?view=fix");
  assert.equal(rewriteRegistryHref("/extension"), "/setup/people");
  assert.equal(rewriteRegistryHref("/testimonials"), "/setup/website");
  assert.equal(rewriteRegistryHref("/settings"), "/setup/carriers");
  assert.equal(rewriteRegistryHref("/setup/people?person=a1"), "/setup/people?person=a1");
  assert.equal(rewriteRegistryHref("/leads?kind=form"), "/leads?kind=form");
  assert.equal(rewriteRegistryHref("https://granot.example/x"), "https://granot.example/x");
});

/** Walks the `has` rows of a redirect the way Next does (query regexes, `:id` from the named group). */
function followRedirect(rows: ReturnType<typeof setupRedirectRows>, href: string): string | null {
  const [path, query = ""] = href.split("?", 2);
  const search = new URLSearchParams(query);
  for (const row of rows) {
    if (row.source !== path) continue;
    let destination = row.destination;
    let matched = true;
    for (const condition of row.has ?? []) {
      const value = search.get(condition.key);
      if (value === null) {
        matched = false;
        break;
      }
      if (condition.value === undefined) continue;
      const match = new RegExp(`^${condition.value}$`).exec(value);
      if (!match) {
        matched = false;
        break;
      }
      if (match.groups?.id !== undefined) destination = destination.replace(":id", match.groups.id);
    }
    if (matched) return destination;
  }
  return null;
}

test("the next.config redirect table agrees with the running page's rewrite for every old link", () => {
  const rows = setupRedirectRows();
  assert.ok(rows.every((row) => row.permanent === true));
  const cases = [
    "/operations-registry",
    "/operations-registry?tab=unknown",
    ...Object.keys(REGISTRY_TAB_TO_SETUP).map((tab) => `/operations-registry?tab=${tab}`),
    "/operations-registry?tab=lead-sources&entity=c1",
    "/operations-registry?tab=sources&feed=f1",
    "/operations-registry?tab=granot-names&entity=g1",
    "/operations-registry?tab=granot-sources&entity=g2",
    "/operations-registry?tab=inbound-numbers&entity=r1",
    "/operations-registry?tab=ringcentral&entity=r2",
    "/operations-registry?tab=lead-costs&cpl_mode=corrections",
    "/operations-registry?tab=lead-costs&cpl_mode=advanced",
    "/operations-registry?tab=cpl&cpl_mode=corrections",
    "/operations-registry?tab=legacy-cpl",
    "/operations-registry?tab=agents&entity=a1",
    "/settings",
    "/extension",
    "/testimonials",
  ];
  for (const href of cases) {
    assert.equal(followRedirect(rows, href), rewriteRegistryHref(href), href);
  }
  assert.equal(followRedirect(rows, "/leads"), null);
  for (const route of Object.values(SETUP_ROUTES)) {
    assert.equal(followRedirect(rows, route), null, route);
  }
});

test("the shell's Owner copy passes the language deck and the Not allowed card names the owner", () => {
  const texts = [SETUP_COPY.title, SETUP_COPY.subtitle, SETUP_COPY.help, SETUP_COPY.readOnlyBody, SETUP_COPY.notAllowedBody, ...Object.values(SETUP_COPY.sections).flatMap((s) => [s.label, s.purpose])];
  assert.deepEqual(findOwnerMarkupLeaks(texts.join(" ")), []);
  const notAllowed = renderToStaticMarkup(createElement(SetupNotAllowed));
  assert.match(notAllowed, /Not allowed/);
  assert.match(notAllowed, /for the owner/);
  const head = renderToStaticMarkup(createElement(SetupSectionHead, { section: "people" }));
  assert.match(head, /People &amp; access/);
  assert.match(head, /Who works here/);
  assert.deepEqual(findOwnerMarkupLeaks(head), []);
});
