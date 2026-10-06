import assert from "node:assert/strict";
import test from "node:test";
import { AUTOMATIONS_HREF, GRANOT_UPDATES_HREF, granotCheckHref, granotUpdatesRedirectRows } from "./granot-updates-redirects";

/** Walks the `has` rows of a redirect the way Next does (query regexes, `:id` from the named group). */
function followRedirect(href: string): string | null {
  const url = new URL(href, "http://admin.test");
  for (const row of granotUpdatesRedirectRows()) {
    if (row.source !== url.pathname) continue;
    let destination = row.destination;
    let matched = true;
    for (const match of row.has ?? []) {
      const value = url.searchParams.get(match.key);
      if (value === null) {
        matched = false;
        break;
      }
      if (match.value) {
        const found = new RegExp(`^${match.value}$`).exec(value);
        if (!found) {
          matched = false;
          break;
        }
        if (found.groups?.id !== undefined) destination = destination.replace(":id", found.groups.id);
      }
    }
    if (matched) return destination;
  }
  return null;
}

test("the old HTTP Automation page and its run deep link redirect into Automations → Granot updates", () => {
  assert.equal(AUTOMATIONS_HREF, "/automations");
  assert.equal(GRANOT_UPDATES_HREF, "/automations/granot-updates");
  assert.equal(followRedirect("/ingestion/granot"), "/automations/granot-updates");
  assert.equal(followRedirect("/ingestion/granot?run=aaaaaaaaaaaaaaaaaaaaaaa1"), "/automations/granot-updates/aaaaaaaaaaaaaaaaaaaaaaa1");
  assert.equal(granotCheckHref("group 1"), "/automations/granot-updates/group%201");
  // The technical case pages keep their routes.
  assert.equal(followRedirect("/ingestion/granot/lifecycle/cases/case-1"), null);
  assert.equal(followRedirect("/ingestion"), null);
  for (const row of granotUpdatesRedirectRows()) assert.equal(row.permanent, true);
});
