import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CapacityCard } from "../components/systems/capacity-card";
import { locationsPatchFrom } from "../components/systems/locations-list";
import { SYSTEMS_COPY } from "../components/systems/systems-copy";
import {
  checkedTime,
  colourView,
  databaseCardView,
  displayLink,
  formatBytes,
  pathLink,
  sheetCardView,
  sinceWords,
  syncParts,
} from "../components/systems/systems-model";
import { CapacitySection } from "../components/systems/systems-page";
import { parseSystemsCapacity } from "../lib/api/systems";
import { systemsCapacityFixture, systemsLocationsFixture } from "../lib/api/systemsMock";
import { findOwnerMarkupLeaks } from "../lib/operations-registry/ownerLanguageDeck";

const NOW = new Date("2026-10-07T13:14:00.000Z");
const capacity = parseSystemsCapacity(JSON.parse(JSON.stringify(systemsCapacityFixture(NOW))));

function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (typeof value === "function") {
    const fn = value as (...args: unknown[]) => unknown;
    out.push(String(fn("A", "B", "C", "D")));
  } else if (value && typeof value === "object") for (const item of Object.values(value)) strings(item, out);
  return out;
}

test("every Systems string passes the Owner language deck and uses no em-dash", () => {
  for (const line of strings(SYSTEMS_COPY)) {
    assert.deepEqual(findOwnerMarkupLeaks(line), [], line);
    assert.equal(line.includes("—"), false, line);
  }
});

test("each colour pairs with a word and an icon", () => {
  assert.deepEqual(
    (["green", "amber", "red", "unknown"] as const).map((colour) => [colourView(colour).label, colourView(colour).pill]),
    [
      ["Healthy", "green"],
      ["Needs a look", "amber"],
      ["Needs attention", "red"],
      ["Not measured", "gray"],
    ],
  );
  for (const colour of ["green", "amber", "red", "unknown"] as const) assert.ok(colourView(colour).icon);
});

test("the database card: disk bar, breakdown, both time-until lines and the estimate label", () => {
  const view = databaseCardView(capacity.database);
  assert.equal(view.status.label, "Healthy");
  assert.deepEqual(view.meters.map((meter) => [meter.label, meter.value, meter.pct]), [["Disk", "9.0 of 13.9 GB used", 65.1]]);
  assert.equal(view.detail, "Business data 0.55 GB · Replication log 6.0 GB (≈ 4.9 GB reclaimable) · System ≈ 2.5 GB");
  assert.deepEqual(
    view.runways.map((line) => [line.label, line.value, line.note, line.estimate]),
    [
      ["Time until 90% full", "about 2 years 7 months (≈ May 2029)", "growing ≈ 4 MB/day", "estimate · 3 of 7 days measured"],
      ["Time until full", "about 3 years 7 months (≈ May 2030)", null, "estimate · 3 of 7 days measured"],
    ],
  );
  assert.match(view.muted ?? "", /auto-scaling/);
});

test("Master Leads: Forms against 40,000, cells against 10M, the new-workbook line and 3 stuck jobs in red", () => {
  const view = sheetCardView(capacity.sheets[0]!, NOW);
  assert.equal(view.status.colour, "red");
  assert.equal(view.status.label, "Needs attention");
  assert.deepEqual(
    view.meters.map((meter) => [meter.label, meter.value, meter.growth]),
    [
      ["Biggest tab", "Forms 6,724 of 40,000 rows", "+1,300 rows / month"],
      ["Workbook", "363,022 of 10,000,000 cells", "+45,000 cells / month"],
    ],
  );
  assert.deepEqual(
    view.runways.map((line) => [line.label, line.value, line.note]),
    [
      ["Time until a new workbook is needed", "about 2 years 1 month (≈ Nov 2028)", "Forms hits 40,000 rows"],
      ["Time until Google's cell cap", "more than 15 years", null],
    ],
  );
  assert.deepEqual(view.sync, [
    { text: "last write 2 min ago", state: "ok" },
    { text: "1 pending", state: "none" },
    { text: "0 failed", state: "none" },
    { text: "3 stuck since Jul 29", state: "bad" },
  ]);
});

test("Master Booked: healthy, more than 15 years, and the last cancellation row", () => {
  const view = sheetCardView(capacity.sheets[1]!, NOW);
  assert.equal(view.status.colour, "green");
  assert.equal(view.runways[0]!.value, "more than 15 years");
  assert.equal(view.runways[0]!.note, null, "no trigger words when it is beyond the cap");
  assert.deepEqual(view.foot, ["Last cancellation row: Aug 20"]);
});

test("the capacity section renders three cards with colour words and no leaks", () => {
  const markup = renderToStaticMarkup(createElement(CapacitySection, { capacity, now: NOW }));
  assert.match(markup, /data-testid="systems-capacity-database"[^>]*data-colour="green"/);
  assert.match(markup, /data-testid="systems-capacity-master-leads"[^>]*data-colour="red"/);
  assert.match(markup, /data-testid="systems-capacity-master-booked"[^>]*data-colour="green"/);
  assert.match(markup, /Needs attention/);
  assert.match(markup, /3 Sheet Sync jobs have been stuck since Jul 29/);
  assert.equal((markup.match(/estimate · 3 of 7 days measured/g) ?? []).length, 6);
  assert.deepEqual(findOwnerMarkupLeaks(markup), []);
});

test("an unknown card says so in words, without bars or runway lines", () => {
  const unknown = parseSystemsCapacity({
    database: { status: { colour: "unknown", reason: "The database could not be measured just now. Try Refresh in a minute." }, error: "boom", caveat: "c" },
    sheets: [],
    generated_at: NOW.toISOString(),
  });
  const view = databaseCardView(unknown.database);
  assert.equal(view.meters.length, 0);
  assert.equal(view.runways.length, 0);
  const markup = renderToStaticMarkup(createElement(CapacityCard, { view }));
  assert.match(markup, /Not measured/);
  assert.match(markup, /could not be measured/);
});

test("a measured runway carries no estimate label", () => {
  const measured = { ...capacity.database, until_full: { ...capacity.database.until_full!, basis: "measured" as const, points: 9 } };
  assert.equal(databaseCardView(measured).runways[1]!.estimate, null);
});

test("the sync line without a write yet, and with failures", () => {
  assert.deepEqual(syncParts({ last_write_at: null, pending: 0, failed: 2, stuck: { count: 0, oldest_at: null } }, NOW), [
    { text: "no write yet", state: "warn" },
    { text: "0 pending", state: "none" },
    { text: "2 failed", state: "bad" },
  ]);
  assert.equal(syncParts(null, NOW), null);
});

test("formatting helpers", () => {
  assert.equal(sinceWords("2026-10-07T13:13:40.000Z", NOW), "just now");
  assert.equal(sinceWords("2026-10-07T12:14:00.000Z", NOW), "8:14 AM");
  assert.equal(formatBytes(13_853_786_112), "13.9 GB");
  assert.equal(formatBytes(547_000_000), "0.55 GB");
  assert.equal(formatBytes(4_000_000), "4 MB");
  assert.equal(formatBytes(null), "—");
  assert.equal(checkedTime("2026-10-07T13:14:00.000Z"), "9:14 AM");
  assert.equal(checkedTime("nope"), null);
  assert.equal(displayLink("https://vantagemoves.com/"), "vantagemoves.com");
  assert.equal(pathLink("https://vantagemoves.com/", "/top10"), "https://vantagemoves.com/top10");
});

test("the edit form sends only what changed", () => {
  const data = systemsLocationsFixture();
  const draft = Object.fromEntries(
    data.locations
      .filter((location) => location.editable)
      .map((location) => [
        location.key,
        {
          label: location.label,
          url: location.url,
          note: location.note ?? "",
          paths: location.paths.join("\n"),
          code_url: location.code_url ?? "",
          code_note: location.code_note ?? "",
          host_url: location.host_url ?? "",
          logs_url: location.logs_url ?? "",
        },
      ]),
  );
  assert.deepEqual(locationsPatchFrom(data, draft), {});
  draft.partner_pages!.url = " https://partners.example.com ";
  draft.partner_pages!.paths = "/top10\n/tbm\n\n/new";
  draft.wordpress!.note = "";
  assert.deepEqual(locationsPatchFrom(data, draft), {
    partner_pages: { url: "https://partners.example.com", paths: ["/top10", "/tbm", "/new"] },
    wordpress: { note: "" },
  });
});
