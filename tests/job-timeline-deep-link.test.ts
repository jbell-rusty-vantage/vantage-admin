import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JobTimelineDeepLink } from "../components/job-number-timeline/job-timeline-deep-link";
import { buildJobTimelineHref } from "../lib/api/jobNumberTimeline";

test("JobTimelineDeepLink is URL-only and omits empty Job Numbers", () => {
  const present = renderToStaticMarkup(
    createElement(JobTimelineDeepLink, { job: " 5562924 " }),
  );
  assert.match(present, /href="\/job-timeline\?job=5562924"/);
  assert.match(present, />5562924</);
  assert.equal(buildJobTimelineHref({ job: "5562924" }), "/job-timeline?job=5562924");

  const missing = renderToStaticMarkup(createElement(JobTimelineDeepLink, { job: "  " }));
  assert.equal(missing, "-");
  assert.doesNotMatch(missing, /job-timeline/);
});

test("operational list/detail Job cells use the owner timeline href", () => {
  const columns = readFileSync(
    path.join(process.cwd(), "components/operational/operational-columns.tsx"),
    "utf8",
  );
  const configs = readFileSync(
    path.join(process.cwd(), "components/operational/operational-configs.ts"),
    "utf8",
  );
  assert.match(columns, /JobTimelineDeepLink/);
  assert.match(columns, /column\.path === "job_no"/);
  assert.match(configs, /path: "job_no"/);
  assert.equal((configs.match(/path: "job_no"/g) ?? []).length >= 4, true);
});
