import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { canonicalSiHref, siRouteDecision } from "../../components/sales-intelligence/desk/route-decision";
import { PageHeaderView, isShortPhone, searchAction } from "../../components/sales-intelligence/desk/page-header";
import { viewHref, viewTabs } from "../../components/sales-intelligence/desk/view-tabs";
import {
  canonicalSiQuery,
  clearNumberFilters,
  numbersQuery,
  parseSiUrl,
  serializeSiUrl,
  siUrlUpdate,
} from "../../components/sales-intelligence/data/url-state";

const ID = "65f0000000000000000000cd";
const q = (value: string) => new URLSearchParams(value);

test("the interim page has two views: Numbers (default, no `view`) and RingCentral Accounts", () => {
  assert.equal(parseSiUrl(q("")).view, "numbers");
  assert.equal(parseSiUrl(q("view=reps")).view, "reps");
  for (const old of ["attention", "all_outreach", "closed", "overview", "rep", "coverage", "guide", "numbers", "nonsense"]) {
    assert.equal(parseSiUrl(q(`view=${old}`)).view, "numbers", old);
  }
  assert.deepEqual(viewTabs("").map((tab) => [tab.key, tab.label, tab.href]), [
    ["numbers", "Numbers", "/sales-intelligence"],
    ["reps", "RingCentral Accounts", "/sales-intelligence?view=reps"],
  ]);
  // A view change keeps nothing of the other view and closes the open Number.
  assert.equal(viewHref(`q=smith&number=${ID}`, "reps"), "/sales-intelligence?view=reps");
  assert.equal(viewHref("view=reps&directory_cursor=d1", "numbers"), "/sales-intelligence");
});

test("old Outreach, Attention, Closed, Overview, lead and legacy links normalize to Numbers", () => {
  const cases: [string, string][] = [
    ["view=attention", "/sales-intelligence"],
    ["view=all_outreach&priority=0&priority=not_set&sort=lead_received&direction=desc", "/sales-intelligence"],
    ["view=closed&outcome=booked&closed_from=2026-09-01", "/sales-intelligence"],
    ["view=overview&period=today", "/sales-intelligence"],
    ["view=attention&lead=6ab065812d126e8df7d70862&lead_model=CallLead", "/sales-intelligence"],
    ["outreach=6ab06ebd7bf77e198e58f3fa&panel=analysis&analysis_run=x", "/sales-intelligence"],
    ["view=all_outreach&q=smith", "/sales-intelligence?q=smith"],
    [`view=numbers&number=${ID}`, `/sales-intelligence?number=${ID}`],
    [`view=numbers&number=${ID}&database_scope=production`, `/sales-intelligence?number=${ID}`],
    ["view=reps&rep_cursor=x&directory_cursor=d1", "/sales-intelligence?view=reps&directory_cursor=d1"],
    ["view=guide&topic=numbers", "/sales-intelligence"],
    // An old desk page-2 link carries its All Outreach / Closed keyset cursor in `cursor`; GET /numbers would reject it.
    ["view=all_outreach&cursor=x", "/sales-intelligence"],
    ["view=closed&cursor=x&before=w", "/sales-intelligence"],
    ["view=all_outreach&sort=lead_received&cursor=x&q=smith", "/sales-intelligence?q=smith"],
    // A readable date that is not a Z instant is normalized to the instant the server accepts.
    ["active_from=2026-09-01", "/sales-intelligence?active_from=2026-09-01T00%3A00%3A00.000Z"],
    ["active_to=2026-09-01T00:00:00-04:00", "/sales-intelligence?active_to=2026-09-01T04%3A00%3A00.000Z"],
    ["active_from=not-a-date", "/sales-intelligence"],
  ];
  for (const [incoming, href] of cases) {
    const params = Object.fromEntries([...q(incoming).keys()].map((key) => [key, q(incoming).getAll(key)]));
    assert.equal(canonicalSiHref(params), href, incoming);
    assert.deepEqual(siRouteDecision(params), { kind: "redirect", href }, incoming);
  }
  // A canonical query renders as it is (no redirect loop), and canonicalization is idempotent.
  for (const ok of ["", "q=smith", `number=${ID}`, "view=reps", "classification=customer&classification=company&attachment=linked&sort=interactions&direction=desc"]) {
    const params = Object.fromEntries([...q(ok).keys()].map((key) => [key, q(ok).getAll(key)]));
    assert.deepEqual(siRouteDecision(params), { kind: "render" }, ok);
    assert.equal(canonicalSiQuery(canonicalSiQuery(q(ok))).toString(), canonicalSiQuery(q(ok)).toString());
  }
  // A Numbers cursor (written with no `view`) is kept.
  assert.equal(parseSiUrl(q("cursor=c2&before=c1")).cursor, "c2");
  // Old OutreachRecord ids are never mapped: an invalid `number` is dropped, not guessed.
  assert.equal(parseSiUrl(q("number=not-an-id")).number, null);
});

test("Numbers URL state round-trips; defaults are omitted; a request change restarts paging", () => {
  const state = parseSiUrl(q(`q=555&classification=customer&classification=bogus&attachment=unlinked&hygiene=true&has_recording=true&include_form_only=true&active_from=2026-09-01T04:00:00.000Z&sort=first_observed&direction=asc&cursor=c2&before=c1&number=${ID}`));
  assert.deepEqual(state.classification, ["customer"]);
  assert.equal(state.attachment, "unlinked");
  assert.equal(state.sort, "first_observed");
  assert.deepEqual(state.before, ["c1"]);
  assert.equal(serializeSiUrl(state).toString(), `q=555&classification=customer&attachment=unlinked&hygiene=true&has_recording=true&include_form_only=true&active_from=2026-09-01T04%3A00%3A00.000Z&sort=first_observed&direction=asc&cursor=c2&before=c1&number=${ID}`);
  assert.equal(serializeSiUrl(parseSiUrl(q("sort=last_activity&direction=desc"))).toString(), "");
  // `before` without a cursor is meaningless and dropped.
  assert.deepEqual(parseSiUrl(q("before=c1")).before, []);
  const paged = "q=555&cursor=c2&before=c1";
  assert.equal(siUrlUpdate(paged, { classification: ["company"] }).toString(), "q=555&classification=company");
  assert.equal(siUrlUpdate(paged, { sort: "interactions", direction: "desc" }).toString(), "q=555&sort=interactions&direction=desc");
  assert.equal(siUrlUpdate(paged, { number: ID }).toString(), `q=555&cursor=c2&before=c1&number=${ID}`);
  assert.equal(siUrlUpdate(paged, { cursor: "c3", before: ["c1", "c2"] }).toString(), "q=555&cursor=c3&before=c1&before=c2");
  // Clearing filters keeps the search and the sort.
  assert.equal(siUrlUpdate("q=555&classification=customer&hygiene=true&sort=interactions&direction=asc", clearNumberFilters()).toString(), "q=555&sort=interactions&direction=asc");
});

test("the Numbers request sends only the server's strict query keys", () => {
  const state = parseSiUrl(q(`q=smith&classification=customer&attachment=linked&has_recording=true&cursor=c1&before=c0&number=${ID}`));
  const query = numbersQuery(state, 50);
  assert.equal(query.toString(), "limit=50&q=smith&classification=customer&attachment=linked&has_recording=true&sort=last_activity&direction=desc&cursor=c1");
  const allowed = new Set(["scope", "q", "classification", "attachment", "active_from", "active_to", "hygiene", "has_recording", "has_calls", "include_form_only", "cursor", "limit", "sort", "direction"]);
  for (const key of query.keys()) assert.ok(allowed.has(key), key);
  assert.equal(query.has("has_outreach"), false);
});

test("search: 1–3 digits shows the phone hint and doesn't submit; blank clears", () => {
  assert.equal(isShortPhone("555"), true);
  assert.equal(isShortPhone("5551"), false);
  assert.equal(isShortPhone("smith"), false);
  assert.deepEqual(searchAction("  "), { kind: "clear" });
  assert.deepEqual(searchAction("55"), { kind: "hint" });
  assert.deepEqual(searchAction(" Smith "), { kind: "search", q: "Smith" });
  const html = renderToStaticMarkup(createElement(PageHeaderView, { value: "55", onChange: () => {}, onSubmit: () => {} }));
  assert.match(html, /<h1 class="si-desk__title">Sales Intelligence<\/h1>/);
  assert.match(html, /Enter at least 4 digits to search by phone/);
  assert.match(html, /aria-label="Search Numbers"/);
});
