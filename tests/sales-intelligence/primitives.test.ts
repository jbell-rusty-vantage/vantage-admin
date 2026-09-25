import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  BAND_COLORS,
  BandBadge,
  CardShell,
  Chip,
  DelayedSkeleton,
  Disclosure,
  LiveIndicator,
  LiveIndicatorDetails,
  Region,
  RegionError,
  RegionProgress,
  RouteTabs,
  SkeletonBlock,
  SkeletonLines,
  StatePill,
  SubNav,
  TimeText,
  contrastRatio,
  liveIndicatorText,
  regionErrorCode,
  type BandNumber,
} from "../../components/sales-intelligence/primitives";
import { BANDS } from "../../components/sales-intelligence/sales-intelligence-copy";

// UI1-PRIM: every primitive renders with renderToStaticMarkup (no DOM, ADMIN-REBUILD trap 7).
const render = (type: unknown, props: Record<string, unknown> = {}, ...children: unknown[]) =>
  renderToStaticMarkup(createElement(type as never, props as never, ...(children as never[])));
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const AS_OF = "2026-09-20T19:10:00.000Z";
const noop = () => {};
const css = readFileSync(path.join(process.cwd(), "components/sales-intelligence/styles/sales-intelligence.css"), "utf8");

test("band tokens in the CSS match BAND_COLORS and every fg/bg pair reaches WCAG AA 4.5:1", () => {
  const ratios: string[] = [];
  for (const n of [1, 2, 3, 4, 5, 6, 7] as BandNumber[]) {
    const bg = new RegExp(`--si-band-${n}-bg:\\s*(#[0-9a-f]{6})`, "i").exec(css)?.[1];
    const fg = new RegExp(`--si-band-${n}-fg:\\s*(#[0-9a-f]{6})`, "i").exec(css)?.[1];
    assert.equal(bg?.toLowerCase(), BAND_COLORS[n].bg, `band ${n} bg token`);
    assert.equal(fg?.toLowerCase(), BAND_COLORS[n].fg, `band ${n} fg token`);
    const ratio = contrastRatio(BAND_COLORS[n].fg, BAND_COLORS[n].bg);
    ratios.push(`${n}:${ratio.toFixed(2)}`);
    assert.ok(ratio >= 4.5, `band ${n} ratio ${ratio.toFixed(2)}`);
  }
  assert.equal(contrastRatio("#000000", "#ffffff").toFixed(1), "21.0");
  assert.equal(contrastRatio("#ffffff", "#ffffff"), 1);
  for (const token of ["--si-live", "--si-bubble-owner", "--si-bubble-rep", "--si-progress"]) assert.match(css, new RegExp(`${token}:\\s*#`));
  console.log(`band contrast ratios ${ratios.join(" ")}`);
});

test("BandBadge: tag, header with count, needs review, and the null band", () => {
  const tag = render(BandBadge, { band: 1, variant: "tag" });
  assert.match(tag, /si-bandbadge--1/);
  assert.match(text(tag), new RegExp(`^1 Band 1 · ${BANDS[1]}$`));
  const header = render(BandBadge, { band: 4, variant: "header", count: 1234 });
  assert.match(header, /<h3 class="si-bandhead__name">/);
  assert.match(header, new RegExp(BANDS[4]));
  assert.match(header, /aria-label="1,234 records"/);
  const review = render(BandBadge, { band: null, variant: "needs_review" });
  assert.match(review, /si-bandbadge--review/);
  assert.match(review, /lucide-circle-question-mark|lucide-circle-help/);
  assert.match(text(review), /Needs review/);
  const none = render(BandBadge, { band: null });
  assert.match(none, /si-bandbadge--none/);
  assert.match(text(none), /— Not in Attention/);
});

test("StatePill: known states carry label and icon; an unknown state prints the raw word", () => {
  const cases: [string, string][] = [
    ["unworked", "Unworked"],
    ["open", "Open"],
    ["waiting_on_customer", "Waiting on customer"],
    ["identity_review", "Identity review"],
    ["closed", "Closed"],
  ];
  for (const [state, label] of cases) {
    const html = render(StatePill, { state });
    assert.match(html, /si-badge--neutral/);
    assert.match(html, /<svg/);
    assert.equal(text(html), label);
  }
  const unknown = render(StatePill, { state: "on_hold_forever" });
  assert.match(unknown, /si-badge--neutral/);
  assert.equal(text(unknown), "on hold forever");
  assert.doesNotMatch(unknown, /<svg/);
});

test("Chip: tones map to badge classes; live is neutral with a pulse dot and radio, never amber", () => {
  for (const tone of ["neutral", "amber", "red", "green", "blue"]) assert.match(render(Chip, { tone }, "x"), new RegExp(`si-badge--${tone}`));
  const live = render(Chip, { tone: "live", title: "On the call" }, "On the call");
  assert.match(live, /si-chip--live/);
  assert.match(live, /si-livedot is-pulse/);
  assert.match(live, /lucide-radio/);
  assert.doesNotMatch(live, /amber/);
  assert.match(live, /title="On the call"/);
});

test("CardShell: seven slots always rendered, null wording for empty slots, open button, live class, skeleton", () => {
  const html = render(CardShell, {
    lines: ["Jane Doe", null, "Line 3", "", undefined, "Line 6", false],
    nullText: [undefined, "No call observed", undefined, "No next step set"],
    actions: createElement("a", { href: "#x" }, "Open analysis"),
    live: true,
    onOpen: noop,
    openLabel: "Open Jane Doe",
  });
  assert.equal((html.match(/class="si-cardshell__line /g) ?? []).length, 7);
  assert.match(html, /si-cardshell is-live is-openable/);
  assert.match(text(html), /Jane Doe No call observed Line 3 No next step set/);
  assert.equal((html.match(/is-empty/g) ?? []).length, 4);
  assert.match(html, /<button type="button" class="si-cardshell__hit" aria-label="Open Jane Doe">/);
  assert.match(html, /si-cardshell__actions/);
  const skeleton = render(CardShell.Skeleton);
  assert.equal((skeleton.match(/si-skeleton si-skeleton--line/g) ?? []).length, 7);
  assert.match(skeleton, /aria-hidden="true"/);
});

test("skeleton helpers render .si-skeleton; DelayedSkeleton renders nothing on the server", () => {
  const lines = render(SkeletonLines, { lines: 3, widths: ["40%", 120] });
  assert.equal((lines.match(/class="si-skeleton /g) ?? []).length, 3);
  assert.match(lines, /width:40%/);
  assert.match(lines, /width:120px/);
  assert.match(render(SkeletonBlock, { height: 80 }), /si-skeleton si-skelblock[^>]*height:80px/);
  assert.equal(render(DelayedSkeleton, {}, createElement(SkeletonLines, { lines: 2 })), "");
});

test("Region: renders children inside the boundary; the error fallback shows copy, code and Try again", () => {
  assert.match(render(Region, { name: "list", skeleton: "…" }, createElement("p", null, "ready")), /data-region="list"[^]*<p>ready<\/p>/);
  const coded = Object.assign(new Error("SI_SNAPSHOT_MISSING"), { code: "SI_SNAPSHOT_MISSING", status: 503 });
  const html = render(RegionError, { error: coded, onRetry: noop });
  assert.match(html, /role="alert"/);
  assert.match(text(html), /Couldn't load this\. Error code: SI_SNAPSHOT_MISSING Try again/);
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
  const base = { updatedAt: "2026-09-20T19:09:00.000Z", asOf: AS_OF, coverageHref: "/sales-intelligence/coverage", onRefresh: noop };
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

test("LiveIndicatorDetails: history coverage, status sentence, red word only for broken, Coverage link", () => {
  const broken = render(LiveIndicatorDetails, { health: { status: "broken", knownCompleteThrough: "2026-09-20T12:00:00.000Z" }, asOf: AS_OF, coverageHref: "/sales-intelligence/coverage" });
  assert.match(text(broken), /History known through Sep 20, 8:00 AM ET/);
  assert.match(broken, /title="Sep 20, 2026, 8:00 AM ET"/);
  assert.match(broken, /si-text--danger">Broken</);
  assert.match(broken, /href="\/sales-intelligence\/coverage"/);
  const attention = render(LiveIndicatorDetails, { health: { status: "attention", knownCompleteThrough: null }, asOf: AS_OF, coverageHref: "/c" });
  assert.match(attention, /si-text--amber">Needs attention</);
  assert.doesNotMatch(attention, /danger/);
  assert.match(text(attention), /History coverage not known yet/);
  assert.match(text(render(LiveIndicatorDetails, { health: null, asOf: AS_OF, coverageHref: "/c" })), /Capture status not known yet\./);
});

test("Disclosure: 44 px summary button with aria-expanded; server render uses defaultOpen", () => {
  const closed = render(Disclosure, { id: "analysis-evidence", title: "Evidence", remember: "local" }, "Body");
  assert.match(closed, /<button type="button" class="si-disclosure__summary" aria-expanded="false"/);
  assert.match(closed, /hidden=""/);
  const open = render(Disclosure, { id: "x", title: "Evidence", defaultOpen: true }, "Body");
  assert.match(open, /aria-expanded="true"/);
  assert.match(open, /si-disclosure is-open/);
  assert.doesNotMatch(open, /hidden=""/);
});

test("SubNav and RouteTabs: anchors, aria-current, counts", () => {
  const sub = render(SubNav, { items: [{ id: "summary", label: "Summary" }, { id: "evidence", label: "Evidence" }], activeId: "evidence" });
  assert.match(sub, /<nav class="si-subnav" aria-label="On this page">/);
  assert.match(sub, /href="#evidence" class="si-subnav__link is-active" aria-current="location"/);
  assert.match(sub, /href="#summary" class="si-subnav__link"/);
  const tabs = render(RouteTabs, {
    items: [
      { key: "attention", label: "Needs Attention", href: "/sales-intelligence/outreach?view=attention", count: 1204 },
      { key: "all", label: "All Outreach", href: "/sales-intelligence/outreach?view=all" },
    ],
    active: "attention",
  });
  assert.match(tabs, /<nav class="si-tabs si-routetabs" aria-label="Sections">/);
  assert.match(tabs, /class="si-tab si-routetab is-active" aria-current="page"/);
  assert.match(tabs, /si-tab__count">1,204</);
  assert.doesNotMatch(tabs, /role="tab/);
});
