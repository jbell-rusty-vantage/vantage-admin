import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GALLERY_SECTIONS, Gallery } from "../../app/(dashboard)/sales-intelligence/dev/gallery/gallery";
import { galleryEnabled } from "../../app/(dashboard)/sales-intelligence/dev/gallery/gate";
import { ICON_SUBSTITUTES, checkIcons } from "../../app/(dashboard)/sales-intelligence/dev/gallery/icon-check";
import { CHIP_SAMPLES } from "../../app/(dashboard)/sales-intelligence/dev/gallery/sections/chips";
import { TIME_SAMPLES, expectedAttrs } from "../../app/(dashboard)/sales-intelligence/dev/gallery/sections/time";
import { AA_RATIO, CONTRAST_PAIRS, TOKEN_GROUPS, contrastFor } from "../../app/(dashboard)/sales-intelligence/dev/gallery/sections/tokens";

// UI1-GALLERY: the gallery renders to static markup (no DOM, ADMIN-REBUILD trap 7).
const html = renderToStaticMarkup(createElement(Gallery));
const framedHtml = renderToStaticMarkup(createElement(Gallery, { initialFramed: true }));
const css = readFileSync(path.join(process.cwd(), "components/sales-intelligence/styles/sales-intelligence.css"), "utf8");
const decode = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"');

test("every section anchor is present, in order, and the sub-nav links to each", () => {
  let last = -1;
  for (const { id } of GALLERY_SECTIONS) {
    const at = html.indexOf(`<section id="${id}"`);
    assert.ok(at > last, `section #${id} missing or out of order`);
    last = at;
    assert.ok(html.includes(`href="#${id}"`), `sub-nav link to #${id}`);
  }
  const ids = ["tokens", "badges", "pills", "chips", "icons", "time", "loading", "live", "navigation", "card", "metrics", "presets", "rail", "timeline", "analysis", "chat", "overview", "closed", "coverage"];
  assert.deepEqual(GALLERY_SECTIONS.map((s) => s.id), ids);
  for (const stage of ["UI1-DESK", "UI1-OVERVIEW", "UI1-CLOSED", "UI1-COVER"]) {
    assert.ok(html.includes(`Lands with ${stage}`), `placeholder for ${stage}`);
  }
});

test("every band badge and chip tone reaches WCAG AA 4.5:1, and the table prints each ratio", () => {
  const ratios: string[] = [];
  for (const pair of CONTRAST_PAIRS) {
    const ratio = contrastFor(pair);
    ratios.push(`${pair.id}:${ratio.toFixed(2)}`);
    assert.ok(ratio >= AA_RATIO, `${pair.id} ${ratio.toFixed(2)} < ${AA_RATIO}`);
    assert.ok(html.includes(`data-contrast="${pair.id}" data-ratio="${ratio.toFixed(2)}" data-pass="1"`), `row ${pair.id}`);
  }
  for (let n = 1; n <= 7; n += 1) assert.ok(CONTRAST_PAIRS.some((p) => p.id === `band-${n}`), `band ${n} measured`);
  assert.ok(!html.includes('data-pass="0"'));
  console.log(`contrast ${ratios.join(" ")}`);
});

test("the token list equals every --si-* colour in the stylesheet", () => {
  const fromCss = new Map<string, string>();
  for (const match of css.matchAll(/(--si-[a-z0-9-]+):\s*(#[0-9a-f]{3,8})\b/gi)) fromCss.set(match[1], match[2].toLowerCase());
  const listed = new Map(TOKEN_GROUPS.flatMap((g) => g.tokens.map((t) => [t.name, t.hex.toLowerCase()] as const)));
  assert.deepEqual([...listed.keys()].sort(), [...fromCss.keys()].sort());
  for (const [name, hex] of listed) assert.equal(fromCss.get(name), hex, name);
  for (const name of listed.keys()) assert.ok(html.includes(`data-token="${name}"`), `swatch ${name}`);
});

test("no icon in the UI-0 §7.3 map is missing (or each missing one has a substitute that exists)", () => {
  const rows = checkIcons();
  assert.ok(rows.length >= 47);
  for (const row of rows) {
    if (row.Icon) continue;
    assert.ok(ICON_SUBSTITUTES[row.name], `${row.name} (${row.exportName}) missing with no substitute`);
    assert.ok(row.SubstituteIcon, `substitute ${ICON_SUBSTITUTES[row.name]} for ${row.name} does not exist`);
  }
  const missing = rows.filter((r) => !r.Icon).length;
  assert.ok(html.includes(`data-icons-missing="${missing}"`));
  assert.equal(missing, 0);
  assert.equal((html.match(/data-present="1"/g) ?? []).length, rows.length);
});

test("chips: every UI-0 §7.2 chip renders with its tone and copy key", () => {
  for (const sample of CHIP_SAMPLES) {
    const at = html.indexOf(`data-chip="${sample.id}"`);
    assert.ok(at >= 0, sample.id);
    const tail = decode(html.slice(at, at + 1600));
    assert.ok(tail.includes(sample.label), `${sample.id} label`);
    assert.ok(tail.includes(sample.copyKey), `${sample.id} copy key`);
    assert.ok(tail.includes(sample.tone === "live" ? "si-chip--live" : `si-badge--${sample.tone}`), `${sample.id} tone`);
  }
  const text = decode(html);
  for (const label of ["On the call · Alex · 12m", "Owner calling", "Details disagree", "Don't call", "Don't call until Oct 1", "Suppressed", "Disposition review", "Newer call since assessment", "Rep replied"]) {
    assert.ok(text.includes(label), label);
  }
  // In progress: live style with no radio icon.
  const inProgress = html.slice(html.indexOf('data-chip="in-progress"'), html.indexOf('data-chip="recording"'));
  assert.ok(!inProgress.includes("lucide-radio"));
});

test("time text: the printed title / aria-label match the rendered <time>, and overdue is amber from the server state", () => {
  const text = decode(html);
  for (const sample of TIME_SAMPLES) {
    const { title, label } = expectedAttrs(sample);
    assert.ok(text.includes(`title="${title}" aria-label="${label}"`), `${sample.id} attributes`);
    assert.ok(text.includes(`data-attr="aria-label">${label}<`), `${sample.id} printed label`);
  }
  assert.match(text, /aria-label="Due [^"]+, overdue [^"]+" class="si-time si-text--amber"/);
  assert.ok(text.includes('class="si-time is-null">No call yet<'));
});

test("loading, errors, live indicator and navigation samples render", () => {
  const text = decode(html);
  assert.ok(html.includes("si-cardshell is-skeleton"));
  assert.ok(text.includes("Couldn't load this.") && text.includes("SI_UPSTREAM_TIMEOUT") && text.includes("Try again"));
  assert.ok(html.includes('class="si-regionprogress"'));
  for (const id of ["live", "connecting", "reconnecting", "offline"]) assert.ok(html.includes(`data-live="${id}"`), id);
  assert.ok(text.includes("Reconnecting…") && text.includes("Offline"));
  for (const id of ["attention", "broken"]) {
    const at = html.indexOf(`data-live="health-${id}"`);
    const chunk = html.slice(at, at + 4000);
    assert.ok(chunk.includes("is-unhealthy"), `${id} amber indicator`);
    assert.ok(chunk.includes("si-gallery__tip"), `${id} inline tooltip`);
  }
  assert.ok(html.includes("si-disclosure") && html.includes("si-subnav") && html.includes("si-routetabs"));
});

test("the 390 px frame toggle wraps every section body", () => {
  assert.ok(html.includes('aria-pressed="false"'));
  assert.ok(framedHtml.includes('aria-pressed="true"'));
  const framed = (framedHtml.match(/si-gallery__body si-gallery__frame" data-frame="390"/g) ?? []).length;
  assert.equal(framed, GALLERY_SECTIONS.length);
});

test("preset bar and rail sections: every preset state, No Lead, both rails with chips, the 390 px sheet trigger", () => {
  const text = decode(html);
  assert.ok(!html.includes('data-placeholder="UI1-PRESET"') && !html.includes('data-placeholder="UI1-RAIL"'));
  for (const id of ["all", "new", "quoted", "other", "custom", "has-lead", "no-lead", "flag-off", "skeleton", "phone"]) assert.ok(html.includes(`data-preset-sample="${id}"`), `preset ${id}`);
  for (const preset of ["all", "new", "quoted", "other", "custom", "no_lead"]) assert.ok(html.includes(`data-preset="${preset}"`), `bar state ${preset}`);
  assert.ok(text.includes("A record with no Lead has no Granot Priority, so the presets don't apply."));
  for (const id of ["outreach", "closed", "closed-window", "skeleton", "phone"]) assert.ok(html.includes(`data-rail-sample="${id}"`), `rail ${id}`);
  for (const label of ["Band 1 · Promised callbacks overdue", "Needs review", "Rep: Dana Reyes", "Transaction intent at least 50", "Lead received last 7d", "Move date within 30d", "Booked in Granot", "Unassigned", "Closed Sep 1 – Sep 20", "Closed last 30d"]) {
    assert.ok(text.includes(label), label);
  }
  assert.match(text, /lucide-sliders-horizontal[^]*?Filters \(9\)/);
});

test("gate: production hides the gallery unless SI_GALLERY=1", () => {
  assert.equal(galleryEnabled({ NODE_ENV: "development" }), true);
  assert.equal(galleryEnabled({ NODE_ENV: "test" }), true);
  assert.equal(galleryEnabled({ NODE_ENV: "production" }), false);
  assert.equal(galleryEnabled({ NODE_ENV: "production", SI_GALLERY: "0" }), false);
  assert.equal(galleryEnabled({ NODE_ENV: "production", SI_GALLERY: "1" }), true);
});

test("the gallery imports nothing from _legacy or the quarantined files", () => {
  const dir = path.join(process.cwd(), "app/(dashboard)/sales-intelligence/dev/gallery");
  const files = ["page.tsx", "loading.tsx", "gallery.tsx", "gate.ts", "fixtures.ts", "icon-check.ts", ...["section", "tokens", "badges", "chips", "icons", "time", "loading-errors", "live", "navigation", "preset-bar", "rail", "timeline"].map((f) => `sections/${f}.tsx`)];
  const quarantined = /from ["'][^"']*(_legacy|\/(workspace|attention|filters|number-browser|number-timeline|detail-panel|now-strip|analysis-panel|assessment-section|evidence-chain|stored-call-analyses|list-skeletons|message-rep-dialog|running-summary-panel))["']/;
  for (const file of files) assert.doesNotMatch(readFileSync(path.join(dir, file), "utf8"), quarantined, file);
});
