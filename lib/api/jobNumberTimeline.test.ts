import assert from "node:assert/strict";
import test from "node:test";
import {
  buildJobTimelineHref,
  fetchJobNumberTimeline,
  fetchRecentOfficialBookingExamples,
  isEnhancedJobTimelinePage,
  JOB_TIMELINE_HREF,
  parseTimelineView,
} from "./jobNumberTimeline";
import { v1Page, v2Page } from "../../tests/job-timeline-fixtures";

type FetchCall = { input: string | URL | Request; init?: RequestInit };

function mockFetch(data: unknown, status = 200) {
  const calls: FetchCall[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ input, init });
    return new Response(JSON.stringify(data), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  return calls;
}

test("typed Job Number search uses the owner DTO route, not the forensic lifecycle job path", async () => {
  const calls = mockFetch({
    ok: true,
    data: { status: "not_found", normalized_job_no: "5562924" },
  });
  const result = await fetchJobNumberTimeline({
    job_no: "P5562924",
    source_granularity_id: "aaaaaaaaaaaaaaaaaaaaaaaa",
  });
  const url = new URL(String(calls[0]?.input), "https://admin.test");
  assert.equal(url.pathname, "/api/proxy/api/v1/admin/job-number-timeline");
  assert.equal(url.searchParams.get("job_no"), "P5562924");
  assert.equal(url.searchParams.get("source_granularity_id"), "aaaaaaaaaaaaaaaaaaaaaaaa");
  assert.equal(result.status, "not_found");
});

test("job timeline href keeps the typed Job Number in the URL", () => {
  assert.equal(buildJobTimelineHref({}), JOB_TIMELINE_HREF);
  assert.equal(buildJobTimelineHref({ job: " 5562924 " }), "/job-timeline?job=5562924");
  assert.equal(
    buildJobTimelineHref({ job: "5562924", view: "attention" }),
    "/job-timeline?job=5562924&view=attention",
  );
  assert.equal(
    buildJobTimelineHref({ job: "5562924", view: "lifecycle" }),
    "/job-timeline?job=5562924",
  );
});

test("recent official booking examples use the owner timeline route, not a catalog", async () => {
  const calls = mockFetch({
    ok: true,
    data: {
      bookings: [
        { job_no: "P9003", booked_at: "2026-08-20T14:00:00.000Z" },
        { job_no: "P9002", booked_at: "2026-08-19T14:00:00.000Z" },
        { job_no: "P9001", booked_at: "2026-08-18T14:00:00.000Z" },
      ],
    },
  });
  const bookings = await fetchRecentOfficialBookingExamples();
  const url = new URL(String(calls[0]?.input), "https://admin.test");
  assert.equal(
    url.pathname,
    "/api/proxy/api/v1/admin/job-number-timeline/recent-official-bookings",
  );
  assert.deepEqual(bookings.map((row) => row.job_no), ["P9003", "P9002", "P9001"]);
});

test("v1 page is not treated as the enhanced schema", () => {
  assert.equal(isEnhancedJobTimelinePage(v1Page), false);
  assert.equal(isEnhancedJobTimelinePage(v2Page), true);
  assert.equal(parseTimelineView("system"), "system");
  assert.equal(parseTimelineView("nope"), "lifecycle");
});
