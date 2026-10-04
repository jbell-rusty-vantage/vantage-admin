import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  DelayedSkeleton,
  LiveIndicator,
  LiveIndicatorDetails,
  Region,
  RegionBoundary,
  RegionError,
  RegionProgress,
  RouteTabs,
  SkeletonBlock,
  SkeletonLines,
  TimeText,
  liveIndicatorText,
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

test("LiveIndicator: live / reconnecting / offline wording, neutral dot, amber when capture is unhealthy", () => {
  const base = { updatedAt: "2026-09-20T19:09:00.000Z", asOf: AS_OF, onRefresh: noop };
  const live = render(LiveIndicator, { ...base, status: "live", health: { status: "ok", knownCompleteThrough: AS_OF } });
  assert.match(text(live), /Live · Updated Sep 20, 3:09 PM ET/);
  assert.match(live, /si-livedot is-pulse/);
  assert.doesNotMatch(live, /green/);
  assert.doesNotMatch(live, /is-unhealthy/);
  assert.match(live, /<button type="button" class="si-iconbtn si-iconbtn--hit" aria-label="Refresh everything on this page"/);
  assert.match(live, /lucide-refresh-cw/);
  const reconnecting = render(LiveIndicator, { ...base, status: "reconnecting" });
  assert.match(text(reconnecting), /Reconnecting…/);
  assert.doesNotMatch(reconnecting, /is-pulse/);
  const offline = render(LiveIndicator, { ...base, status: "offline" });
  assert.match(text(offline), /Offline · Refresh/);
  for (const status of ["attention", "broken"] as const) {
    assert.match(render(LiveIndicator, { ...base, status: "live", health: { status, knownCompleteThrough: null } }), /si-liveind is-live is-unhealthy/);
  }
  assert.equal(liveIndicatorText("live", null, AS_OF), "Live");
  assert.equal(liveIndicatorText("connecting", null, null), "Connecting…");
});

test("LiveIndicatorDetails: history coverage, status sentence, red word only for broken, no Coverage link", () => {
  const broken = render(LiveIndicatorDetails, { health: { status: "broken", knownCompleteThrough: "2026-09-20T12:00:00.000Z" }, asOf: AS_OF });
  assert.match(text(broken), /History known through Sep 20, 8:00 AM ET/);
  assert.match(broken, /title="Sep 20, 2026, 8:00 AM ET"/);
  assert.match(broken, /si-text--danger">Broken</);
  assert.doesNotMatch(broken, /href=/);
  const attention = render(LiveIndicatorDetails, { health: { status: "attention", knownCompleteThrough: null }, asOf: AS_OF });
  assert.match(attention, /si-text--amber">Needs attention</);
  assert.doesNotMatch(attention, /danger/);
  assert.match(text(attention), /History coverage not known yet/);
  assert.match(text(render(LiveIndicatorDetails, { health: null, asOf: AS_OF })), /Capture status not known yet\./);
});

test("RouteTabs: anchors, aria-current, counts", () => {
  const tabs = render(RouteTabs, {
    items: [
      { key: "numbers", label: "Numbers", href: "/sales-intelligence", count: 1204 },
      { key: "reps", label: "RingCentral Accounts", href: "/sales-intelligence?view=reps" },
    ],
    active: "numbers",
  });
  assert.match(tabs, /<nav class="si-tabs si-routetabs" aria-label="Sections">/);
  assert.match(tabs, /class="si-tab si-routetab is-active" aria-current="page"/);
  assert.match(tabs, /si-tab__count">1,204</);
  assert.doesNotMatch(tabs, /role="tab/);
});
