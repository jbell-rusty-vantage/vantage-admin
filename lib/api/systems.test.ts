import assert from "node:assert/strict";
import test from "node:test";
import { parseSystemsCapacity, parseSystemsLocations } from "./systems";
import { mockSystemsResponse, resetSystemsMockState, systemsCapacityFixture, systemsLocationsFixture } from "./systemsMock";

test("locations parse into full rows; a missing field becomes a safe default", () => {
  const parsed = parseSystemsLocations({
    revision: 4,
    updated_at: "2026-10-07T13:00:00.000Z",
    updated_by: "owner@example.com",
    locations: [
      { key: "extension", label: "Granot Sync extension", url: "https://chromewebstore.google.com/x", action: "install", code_note: "personal account", editable: true },
      { key: "odd", label: "Odd", url: "https://x.example.com", action: "teleport", paths: ["/a", 3] },
    ],
  });
  assert.equal(parsed.revision, 4);
  assert.equal(parsed.updated_by, "owner@example.com");
  assert.deepEqual(parsed.locations[0], {
    key: "extension",
    label: "Granot Sync extension",
    url: "https://chromewebstore.google.com/x",
    note: null,
    paths: [],
    code_url: null,
    code_note: "personal account",
    host_url: null,
    logs_url: null,
    action: "install",
    editable: true,
  });
  assert.equal(parsed.locations[1]!.action, "open");
  assert.deepEqual(parsed.locations[1]!.paths, ["/a"]);
  assert.equal(parsed.locations[1]!.editable, false);
  assert.deepEqual(parseSystemsLocations(null), { revision: 1, updated_at: null, updated_by: null, locations: [] });
});

test("capacity parses the three cards, keeping the estimate basis and a clean Master Leads sync", () => {
  const parsed = parseSystemsCapacity(JSON.parse(JSON.stringify(systemsCapacityFixture())));
  assert.equal(parsed.database.status.colour, "green");
  assert.equal(parsed.database.until_90!.basis, "estimate");
  assert.equal(parsed.database.until_90!.points, 3);
  assert.equal(parsed.sheets.length, 2);
  const [leads, booked] = parsed.sheets;
  assert.equal(leads!.status.colour, "green");
  assert.equal(leads!.sync!.stuck.count, 0);
  assert.equal(leads!.until_new_workbook!.trigger, "rows");
  assert.equal("last_cancellation_at" in leads!, false);
  assert.equal(booked!.last_cancellation_at, "2026-08-20T04:48:56.596Z");
});

test("a stuck sync line still parses as red", () => {
  const body = JSON.parse(JSON.stringify(systemsCapacityFixture())) as { sheets: Array<{ status: { colour: string }; sync: { stuck: { count: number } } }> };
  body.sheets[0]!.status.colour = "red";
  body.sheets[0]!.sync.stuck.count = 3;
  const parsed = parseSystemsCapacity(body);
  assert.equal(parsed.sheets[0]!.status.colour, "red");
  assert.equal(parsed.sheets[0]!.sync!.stuck.count, 3);
});

test("an unreadable card parses as unknown with nulls, never a crash", () => {
  const parsed = parseSystemsCapacity({
    database: { status: { colour: "purple", reason: "x" }, error: "down" },
    sheets: [{ workbook: "master_leads", status: { colour: "unknown", reason: "The sheet could not be read just now." }, sync: null }],
    generated_at: "2026-10-07T13:00:00.000Z",
  });
  assert.equal(parsed.database.status.colour, "unknown");
  assert.equal(parsed.database.used_bytes, null);
  assert.equal(parsed.database.until_full, null);
  assert.equal(parsed.sheets[0]!.biggest_tab, null);
  assert.equal(parsed.sheets[0]!.sync, null);
  assert.equal(parsed.sheets[0]!.label, "Master Leads");
});

test("the mock answers the Owner only, keeps edits and refuses http links and unknown keys", () => {
  resetSystemsMockState();
  const path = "api/v1/admin/systems/locations";
  assert.equal(mockSystemsResponse({ role: "admin", method: "GET", path })!.status, 403);
  assert.equal(mockSystemsResponse({ role: "owner", method: "GET", path: "api/v1/admin/other" }), null);
  const http = mockSystemsResponse({ role: "owner", method: "PATCH", path, body: { revision: 1, locations: { partner_pages: { url: "http://x.com" } } } });
  assert.equal(http!.status, 400);
  assert.equal((http!.body as { error: string }).error, "partner_pages › url: Links must start with https://");
  assert.equal(mockSystemsResponse({ role: "owner", method: "PATCH", path, body: { revision: 1, locations: { master_leads: { label: "x" } } } })!.status, 400);
  const saved = mockSystemsResponse({ role: "owner", method: "PATCH", path, body: { revision: 1, locations: { partner_pages: { url: "https://partners.example.com" } } } });
  assert.equal(saved!.status, 200);
  const after = parseSystemsLocations((mockSystemsResponse({ role: "owner", method: "GET", path })!.body as { data: unknown }).data);
  assert.equal(after.revision, 2);
  assert.equal(after.locations.find((row) => row.key === "partner_pages")!.url, "https://partners.example.com");
  assert.equal(mockSystemsResponse({ role: "owner", method: "PATCH", path, body: { revision: 1, locations: {} } })!.status, 409);
  const capacity = mockSystemsResponse({ role: "owner", method: "GET", path: "api/v1/admin/systems/capacity", query: "refresh=1" });
  assert.equal((capacity!.body as { data: { refreshed: boolean } }).data.refreshed, true);
  resetSystemsMockState();
  assert.equal(systemsLocationsFixture().locations.length, 9);
});
