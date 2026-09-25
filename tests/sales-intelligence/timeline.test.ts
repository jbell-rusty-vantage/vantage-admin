import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { timelineV2Schema, type TimelinePage, type TimelineEvent } from "../../lib/api/salesIntelligence";
import { siKeys } from "../../components/sales-intelligence/data/query-keys";
import {
  EventRow, Timeline, TimelineFilters, TimelinePreview, TimelinePreviewList, TimelineSkeleton, TimelineView, groupByDay, kindsForGroups, observedNote, previewItems, toggleGroup,
} from "../../components/sales-intelligence/timeline";
import { formatExactFull } from "../../components/sales-intelligence/lib/time";

// UI1-TL: the timeline rendered from the contract fixtures (UI1-A26–A28, the day grouping, the truncated note, the
// preview). No DOM (ADMIN-REBUILD trap 7).

const WORKSPACE_CONTRACTS = "sales-intelligence-ui-ux-workspace/contracts";
function contractsDir(): string {
  const repo = path.resolve(__dirname, "../..");
  const tried = [process.env.SI_CONTRACTS_DIR, path.resolve(repo, "..", WORKSPACE_CONTRACTS)].filter((v): v is string => !!v);
  try {
    const gitdir = /^gitdir:\s*(.+)$/m.exec(fs.readFileSync(path.join(repo, ".git"), "utf8"))?.[1]?.trim();
    if (gitdir) tried.push(path.resolve(gitdir, "..", "..", "..", "..", WORKSPACE_CONTRACTS));
  } catch { /* a normal checkout */ }
  const dir = tried.find((candidate) => fs.existsSync(path.join(candidate, "S1")));
  assert.ok(dir, `contracts not found; tried ${tried.join(", ")}`);
  return dir;
}
const CONTRACTS = contractsDir();

function load(rel: string): TimelinePage {
  const raw = JSON.parse(fs.readFileSync(path.join(CONTRACTS, rel), "utf8"));
  return timelineV2Schema.parse("status" in raw && "body" in raw ? raw.body : raw);
}
const decode = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const text = (html: string) => decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ");

function view(page: TimelinePage, props: Partial<Parameters<typeof TimelineView>[0]> = {}): string {
  return renderToStaticMarkup(createElement(TimelineView, { scope: (page.data.scope as "outreach" | "number") ?? "outreach", items: page.data.items, asOf: page.as_of, truncatedSources: page.data.coverage.truncated_sources, hasMore: !!page.data.cursor, ...props }));
}
function row(page: TimelinePage, pick: (item: TimelineEvent) => boolean): { item: TimelineEvent; html: string } {
  const item = page.data.items.find(pick);
  assert.ok(item, "no matching item");
  return { item, html: renderToStaticMarkup(createElement(EventRow, { item, asOf: page.as_of })) };
}
/** The `<li>` of one event inside a whole-timeline render. */
function rowIn(html: string, id: string): string {
  const at = html.indexOf(`data-event-id="${id}"`);
  assert.ok(at >= 0, `row ${id}`);
  const end = html.indexOf("</li>", at);
  return html.slice(html.lastIndexOf("<li", at), end);
}

const capture = load("S5c/number-timeline__t3-capture-states-kinds-call.json");
const live = load("S5c/outreach-timeline__t3-live-call.json");
const repChange = load("S6/outreach-timeline__t3-granot-rep-change.json");
const bandCall = load("S9/outreach-timeline__t3-band-call.json");
const multiLead = load("S4/number-timeline__s-multi-lead-a.json");
const superseded = load("AC/outreach-timeline__ac-default-superseded.json");
const pending = load("S4/number-timeline__s-assessment-pending.json");
const granotOpen = load("S4/outreach-timeline__s-granot-open.json");

test("A26: `Recorded {t}` only when recorded_late; `Recovered {date}` replaces it for a recovered call", () => {
  const late = row(capture, (i) => i.call?.observed_reason === "late_capture");
  assert.equal(late.item.recorded_late, true);
  assert.deepEqual(observedNote(late.item), { kind: "recorded", at: late.item.observed_at });
  const lateText = text(late.html);
  assert.ok(lateText.includes("Recorded Sep 21, 11:38 AM ET"), lateText);
  assert.ok(late.html.includes(`title="${formatExactFull(late.item.observed_at)}" aria-label="Recorded ${formatExactFull(late.item.observed_at)}"`));
  assert.ok(!lateText.includes("Recovered"));

  const recovered = row(capture, (i) => i.call?.observed_reason === "recovered");
  assert.equal(recovered.item.recorded_late, true, "the recovered call is also late; Recovered wins");
  const recText = text(recovered.html);
  assert.ok(recText.includes("Recovered Sep 20"), recText);
  assert.ok(!recText.includes("Recorded"), "Recorded is replaced");
  assert.ok(recovered.html.includes('aria-label="Recovered Sep 20, 2026, 2:38 PM ET"'));

  for (const item of capture.data.items.filter((i) => !i.recorded_late && i.call?.observed_reason !== "recovered")) {
    const html = renderToStaticMarkup(createElement(EventRow, { item, asOf: capture.as_of }));
    assert.ok(!/Recorded|Recovered/.test(text(html)), item.id);
  }
  // A non-call late row (number_attached) reads Recorded too.
  const attached = row(live, (i) => i.kind === "number_attached");
  assert.ok(attached.item.recorded_late && text(attached.html).includes("Recorded Sep 24"));
});

test("A27: a Granot Priority change shows happened_at (Granot's capture time), not the applied time", () => {
  const { item, html } = row(granotOpen, (i) => i.kind === "granot_priority_changed" && i.title === "Granot Priority 1 (Quoted)");
  assert.notEqual(item.happened_at, item.observed_at);
  assert.ok(html.includes(`<time dateTime="${item.happened_at}"`), "the row time is happened_at");
  assert.ok(text(html).includes("Sep 20, 3:45 PM ET"));
  assert.ok(!text(html).includes("4:00 PM"), "the applied time isn't shown (not recorded_late)");
  assert.ok(text(html).includes("Marcus B."), "the actor");
});

test("A28: an in-progress call shows `In progress` (live style) and no result or duration", () => {
  const { item, html } = row(live, (i) => i.call?.in_progress === true);
  assert.equal(item.call?.result, null);
  assert.equal(item.call?.duration_seconds, null);
  assert.ok(html.includes("si-chip--live") && text(html).includes("In progress"));
  assert.ok(!html.includes("lucide-radio"), "In progress carries no radio icon (UI-0 §7.2)");
  assert.ok(html.includes("lucide-phone-outgoing"));
  assert.ok(!/\d+ s\b|\d+ min/.test(text(html)), "no duration");
  // Every other call has no In progress chip.
  for (const other of live.data.items.filter((i) => i.kind === "call" && !i.call?.in_progress)) {
    assert.ok(!text(renderToStaticMarkup(createElement(EventRow, { item: other, asOf: live.as_of }))).includes("In progress"));
  }
});

test("A28: routine band_changed sits under Processing details; a call-caused one is a visible row with its detail", () => {
  const html = view(bandCall);
  const routine = bandCall.data.items.find((i) => i.kind === "band_changed" && i.routine)!;
  const visible = bandCall.data.items.find((i) => i.kind === "band_changed" && !i.routine)!;
  const processing = html.indexOf("si-timeline__processing");
  assert.ok(processing > 0 && html.indexOf(`data-event-id="${routine.id}"`) > processing, "routine row inside the disclosure");
  assert.ok(text(html).includes("Processing details (1)"));
  assert.match(html, /aria-expanded="false"[^>]*>[^]*?Processing details \(1\)/, "closed by default");
  assert.ok(/<div id="[^"]+" class="si-disclosure__panel" hidden="">/.test(html));
  const visibleRow = text(rowIn(html, visible.id));
  assert.ok(visibleRow.includes("Moved from band 2 to band 5"), "server title");
  assert.ok(visibleRow.includes("Moved from Band 2 · No call yet after form submission to Band 5 · Being worked, but no next step · Because of a call"), visibleRow);
  const routineRow = text(rowIn(html, routine.id));
  assert.ok(routineRow.includes("(estimated start) · Because of the starting estimate"), routineRow);
  // S6: the baseline band row is routine, the receiver agent changes are not.
  const s6 = view(repChange);
  // granot_observed (Sep 23) and the baseline band row (Sep 18) are routine on two different days: one disclosure each.
  assert.equal((text(s6).match(/Processing details \(1\)/g) ?? []).length, 2);
  for (const change of repChange.data.items.filter((i) => i.kind === "receiver_agent_changed")) {
    const r = text(rowIn(s6, change.id));
    assert.ok(r.includes(change.title!) && rowIn(s6, change.id).includes("lucide-user-round-cog"));
  }
});

test("day grouping follows ET days against as_of (Today / Yesterday / weekday), newest first", () => {
  const days = groupByDay(live.data.items, live.as_of);
  assert.deepEqual(days.map((d) => d.header), ["Today", "Tue Sep 22"]);
  // 01:45 UTC on Sep 23 is 9:45 PM ET on Sep 22: Yesterday against an as_of of Sep 23 5:47 PM ET.
  const p = groupByDay(pending.data.items, pending.as_of);
  assert.deepEqual(p.map((d) => d.header), ["Yesterday"]);
  const html = view(pending);
  assert.ok(html.includes('class="si-timeline__dayhead">Yesterday</h3>'));
  // Every row sits under a day; the rows keep the server's order.
  const order = [...view(live).matchAll(/data-event-id="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(order, live.data.items.map((i) => i.id));
});

test("Job {n} · prefix only where the server sets job_no (multi-Lead Number)", () => {
  const html = view(multiLead);
  for (const item of multiLead.data.items) {
    const r = text(rowIn(html, item.id));
    if (item.job_no) assert.ok(r.includes(`Job ${item.job_no} · ${item.title}`), r);
    else assert.ok(!r.includes("Job 559"), `${item.kind} has no prefix`);
  }
  assert.ok(multiLead.data.items.some((i) => i.job_no) && multiLead.data.items.some((i) => !i.job_no));
});

test("a superseded default and the actions render from the server", () => {
  const { html } = row(superseded, (i) => i.kind === "followup_superseded");
  assert.ok(text(html).includes("Follow-up replaced by a later one") && html.includes("lucide-replace"));
  assert.ok(text(html).includes("Sales Intelligence"), "actor kind word when the name is null");
  const booked = load("S4/number-timeline__s-closed-booked.json");
  const b = row(booked, (i) => i.kind === "booking_recorded");
  assert.ok(decode(b.html).includes(`href="${b.item.action!.href}"`) && text(b.html).includes("Open Booking"));
  const purged = load("S4/number-timeline__s-audio-purged.json");
  const c = row(purged, (i) => i.kind === "conversation_analyzed");
  assert.ok(decode(c.html).includes(`href="${c.item.action!.href}"`) && text(c.html).includes("Open conversation"));
  // Server chips as neutral chips with their icons.
  const rec = row(pending, (i) => i.chips.includes("Recording"));
  assert.ok(rec.html.includes("lucide-mic") && rec.html.includes("lucide-user-round") && rec.html.includes("si-badge--neutral"));
});

test("the truncated note, the empty sentence, Load older activity and its failure", () => {
  assert.ok(!view(pending).includes("Some older activity"));
  const truncated = view(pending, { truncatedSources: ["granot_changes"] });
  assert.ok(text(truncated).includes("Some older activity isn't shown here."));
  assert.ok(truncated.indexOf("si-timeline__note") > truncated.indexOf("si-timeline__days"), "under the list");
  const empty = view({ ...pending, data: { ...pending.data, items: [] } });
  assert.ok(text(empty).includes("No activity observed in available history."));
  const more = view(pending, { hasMore: true, onLoadMore: () => {} });
  assert.ok(text(more).includes("Load older activity"));
  assert.ok(text(view(pending, { hasMore: true, loadingMore: true, onLoadMore: () => {} })).includes("Loading older activity…"));
  assert.ok(text(view(pending, { loadMoreFailed: true })).includes("Couldn't load more. What's shown is still current."));
  assert.ok(view(pending, { refreshing: true }).includes('class="si-regionprogress"'));
});

test("filters: chips toggle groups and map to the registered kinds", () => {
  const html = renderToStaticMarkup(createElement(TimelineFilters, { selected: ["calls"], onChange: () => {} }));
  for (const label of ["Calls", "Lead updates", "Work", "Messages", "Analysis"]) assert.ok(html.includes(`>${label}</button>`), label);
  assert.ok(html.includes('aria-pressed="true" data-group="calls"'));
  assert.equal((html.match(/aria-pressed="false"/g) ?? []).length, 4);
  assert.deepEqual(toggleGroup(["calls"], "work"), ["calls", "work"]);
  assert.deepEqual(toggleGroup(["work", "calls"], "calls"), ["work"]);
  assert.ok(kindsForGroups(["work"]).includes("band_changed") && kindsForGroups(["work"]).includes("followup_superseded"));
  assert.ok(kindsForGroups(["messages"]).includes("lead_message_sent") && kindsForGroups(["messages"]).includes("nudge_sent"));
});

test("the dialog preview: the five newest non-routine events and Open full timeline", () => {
  const items = superseded.data.items;
  const shown = previewItems(items);
  assert.equal(shown.length, 5);
  assert.deepEqual(shown.map((i) => i.id), items.filter((i) => !i.routine).slice(0, 5).map((i) => i.id));
  const html = renderToStaticMarkup(createElement(TimelinePreviewList, { outreachId: "abc123", items, asOf: superseded.as_of }));
  assert.equal((html.match(/data-event-id=/g) ?? []).length, 5);
  assert.ok(html.includes('href="/sales-intelligence/outreach/abc123?tab=timeline"') && text(html).includes("Open full timeline"));
  const routineOnly = previewItems(repChange.data.items.filter((i) => i.routine));
  assert.equal(routineOnly.length, 0);
});

test("the skeleton has a day header and rows with icon circles", () => {
  const html = renderToStaticMarkup(createElement(TimelineSkeleton));
  assert.ok(html.includes("si-timeline__dayhead"));
  assert.equal((html.match(/si-timeline__icon si-skeleton/g) ?? []).length, 5);
});

test("Timeline and TimelinePreview read through useTimeline (cache primed from a fixture)", () => {
  const id = superseded.data.outreach_id!;
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  client.setQueryData(siKeys.timeline("outreach", id, []), { pages: [superseded], pageParams: [null] });
  const wrap = (node: ReactNode) => renderToStaticMarkup(createElement(QueryClientProvider, { client }, node));
  const full = wrap(createElement(Timeline, { scope: "outreach", id }));
  assert.ok(full.includes('data-region="timeline-outreach"'));
  assert.equal((full.match(/data-event-id=/g) ?? []).length, superseded.data.items.length);
  assert.ok(full.includes('data-group="calls"'), "filters rendered");
  const preview = wrap(createElement(TimelinePreview, { outreachId: id }));
  assert.equal((preview.match(/data-event-id=/g) ?? []).length, 5);
});

test("gallery: one row per registry kind (pending ones marked), the generic fallback and every sample", async () => {
  const { Gallery } = await import("../../app/(dashboard)/sales-intelligence/dev/gallery/gallery");
  const { EVENT_KINDS } = await import("../../components/sales-intelligence/timeline");
  const html = renderToStaticMarkup(createElement(Gallery));
  assert.ok(!html.includes('data-placeholder="UI1-TL"'));
  const section = html.slice(html.indexOf('<section id="timeline"'), html.indexOf('<section id="analysis"'));
  for (const [kind, e] of Object.entries(EVENT_KINDS)) {
    const at = section.indexOf(`data-tl-kind="${kind}"`);
    assert.ok(at >= 0, `registry row ${kind}`);
    const chunk = text(section.slice(at, section.indexOf("</li></ol></li>", at)));
    if (e.pending) assert.ok(chunk.includes(`Pending ${e.pending}`), `${kind} marked pending`);
    assert.ok(section.slice(at, at + 4000).includes(`data-kind="${kind}"`), `${kind} renders through EventRow`);
  }
  assert.ok(section.includes('data-kind="made_up_kind" data-known="0"'));
  for (const id of ["registry", "variants", "day", "filters", "truncated", "empty", "preview", "skeleton", "phone"]) assert.ok(section.includes(`data-tl-sample="${id}"`), id);
  const t = text(section);
  for (const phrase of ["Recorded Sep 21", "Recovered Sep 20", "In progress", "Job 5590002 · ", "Processing details (1)", "Some older activity isn't shown here.", "No activity observed in available history.", "Open full timeline", "Load older activity"]) assert.ok(t.includes(phrase), phrase);
});
