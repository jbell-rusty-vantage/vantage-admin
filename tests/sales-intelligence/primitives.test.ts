import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  DelayedSkeleton,
  Region,
  RegionBoundary,
  RegionError,
  RegionProgress,
  SkeletonBlock,
  SkeletonLines,
  TimeText,
  regionErrorCode,
} from "../../components/sales-intelligence/primitives";

// UI1-PRIM: every primitive renders with renderToStaticMarkup (no DOM, ADMIN-REBUILD trap 7).
const render = (type: unknown, props: Record<string, unknown> = {}, ...children: unknown[]) =>
  renderToStaticMarkup(createElement(type as never, props as never, ...(children as never[])));
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const AS_OF = "2026-09-20T19:10:00.000Z";
const noop = () => {};

test("skeleton helpers render .si-skeleton; DelayedSkeleton renders nothing on the server", () => {
  const lines = render(SkeletonLines, { lines: 3, widths: ["40%", 120] });
  assert.equal((lines.match(/class="si-skeleton /g) ?? []).length, 3);
  assert.match(lines, /width:40%/);
  assert.match(lines, /width:120px/);
  assert.match(render(SkeletonBlock, { height: 80 }), /si-skeleton si-skelblock[^>]*height:80px/);
  assert.equal(render(DelayedSkeleton, {}, createElement(SkeletonLines, { lines: 2 })), "");
});

test("RegionBoundary: reports a caught error once and resets itself when the request (resetKey) changes", () => {
  const caught: unknown[] = [];
  const boundary = new RegionBoundary({ name: "numbers", resetKey: "cursor=x", onError: (error) => caught.push(error), children: null });
  const states: unknown[] = [];
  boundary.setState = ((next: unknown) => { states.push(next); }) as never;
  const error = Object.assign(new Error("INVALID_INPUT"), { code: "INVALID_INPUT" });
  boundary.componentDidCatch(error, { componentStack: "" });
  assert.deepEqual(caught, [error]);
  boundary.state = { error, failed: true };
  // The same request re-rendering keeps the error on screen; a new request (for example page one) clears it.
  boundary.componentDidUpdate({ name: "numbers", resetKey: "cursor=x", children: null });
  assert.equal(states.length, 0);
  const pageOne = new RegionBoundary({ name: "numbers", resetKey: "", children: null });
  pageOne.state = { error, failed: true };
  pageOne.setState = ((next: unknown) => { states.push(next); }) as never;
  pageOne.componentDidUpdate({ name: "numbers", resetKey: "cursor=x", children: null });
  assert.deepEqual(states, [{ error: null, failed: false }]);
});

test("Region: renders children inside the boundary; the error fallback shows copy, code and Try again", () => {
  assert.match(render(Region, { name: "list", skeleton: "…" }, createElement("p", null, "ready")), /data-region="list"[^]*<p>ready<\/p>/);
  const coded = Object.assign(new Error("FEATURE_DISABLED"), { code: "FEATURE_DISABLED", status: 404 });
  const html = render(RegionError, { error: coded, onRetry: noop });
  assert.match(html, /role="alert"/);
  assert.match(text(html), /Couldn't load this\. Error code: FEATURE_DISABLED Try again/);
  assert.equal(regionErrorCode(new Error("boom")), "boom");
  assert.equal(regionErrorCode({ code: "E1", message: "m" }), "E1");
  assert.equal(regionErrorCode(null), "UNKNOWN");
  assert.equal(render(RegionProgress, { active: false }), "");
  assert.match(render(RegionProgress, { active: true }), /class="si-regionprogress" role="progressbar" aria-label="Refreshing"/);
});

test("TimeText: title and aria-label carry the exact ET time; countdown amber; null wording", () => {
  const rel = render(TimeText, { t: "2026-09-20T17:10:00.000Z", asOf: AS_OF, mode: "relative" });
  assert.match(rel, /<time dateTime="2026-09-20T17:10:00.000Z" title="Sep 20, 2026, 1:10 PM ET" aria-label="Sep 20, 2026, 1:10 PM ET"/);
  assert.equal(text(rel), "2h ago");
  const exact = render(TimeText, { t: "2025-09-20T19:10:00.000Z", asOf: AS_OF, mode: "exact" });
  assert.equal(text(exact), "Sep 20, 2025, 3:10 PM ET");
  const due = render(TimeText, { t: "2026-09-20T18:30:00.000Z", asOf: AS_OF, mode: "countdown" });
  assert.match(due, /si-text--amber/);
  assert.equal(text(due), "overdue 40m");
  assert.match(due, /aria-label="Sep 20, 2026, 2:30 PM ET, overdue 40m"/);
  const soon = render(TimeText, { t: "2026-09-20T21:10:00.000Z", asOf: AS_OF, mode: "countdown", prefix: "Due" });
  assert.doesNotMatch(soon, /amber/);
  assert.equal(text(soon), "Due in 2h");
  assert.match(soon, /aria-label="Due Sep 20, 2026, 5:10 PM ET, in 2h"/);
  // The server's state wins over the wording when given.
  assert.doesNotMatch(render(TimeText, { t: "2026-09-20T18:30:00.000Z", asOf: AS_OF, mode: "countdown", overdue: false }), /amber/);
  assert.equal(text(render(TimeText, { t: null, asOf: AS_OF, mode: "relative", nullText: "No call observed" })), "No call observed");
  assert.equal(text(render(TimeText, { t: "2026-09-20T17:10:00.000Z", asOf: null, mode: "relative" })), "Sep 20, 2026, 1:10 PM ET");
});
