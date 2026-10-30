import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { QueueRow } from "../../components/outreach-desk/views/my-view";
import { AttentionRow } from "../../components/outreach-desk/views/team-view";
import { LeadPanel } from "../../components/outreach-desk/views/lead-panel";
import { outreachKeys } from "../../lib/query/salesOutreach";
import { SYNTHETIC_AS_OF, syntheticDetail, syntheticQueueRows } from "./fixtures/synthetic";

test("rep and owner/team rows retain Copy job # alongside Open in Granot", () => {
  const row = { ...syntheticQueueRows()[0]!, job_pending: false, job_no: "P5550001" };
  for (const candidate of [row, { ...row, job_pending: true, job_no: null }]) {
    const common = { row: candidate, asOf: SYNTHETIC_AS_OF, relativeNow: SYNTHETIC_AS_OF, selected: false, onSelect() {} };
    for (const element of [createElement(QueueRow, { ...common, onMove() {} }), createElement(AttentionRow, common)]) {
      const html = renderToStaticMarkup(element);
      assert.match(html, /Copy job #/);
      if (candidate.job_pending) assert.doesNotMatch(html, /Open in Granot/);
      else {
        assert.match(html, /Open in Granot/);
        assert.match(html, /Attempting auth fix\./);
        assert.match(html, /disabled="" aria-disabled="true" title="Attempting auth fix\."/);
      }
    }
  }
});

test("the side panel retains Copy job # and the paused Granot control for every Desk role", () => {
  for (const role of ["rep", "owner", "manager"] as const) {
    for (const available of [true, false]) {
      const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const detail = syntheticDetail({ subjectId: syntheticQueueRows()[0]!.subject_id, role })!;
      client.setQueryData(outreachKeys.detail(detail.subject.subject_id), { ...detail, granot_link_available: available });
      const html = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(LeadPanel, { subjectId: detail.subject.subject_id, commands: [], reps: null, onRevoked() {} })));
      assert.match(html, /Copy job #/);
      assert.match(html, /Open in Granot/);
      assert.match(html, /Attempting auth fix\./);
      assert.match(html, /disabled="" aria-disabled="true" title="Attempting auth fix\."/);
      client.clear();
    }
  }
});

test("paused controls cannot invoke lookups or open a browser tab", () => {
  const source = readFileSync('components/outreach-desk/views/granot-link-button.tsx', 'utf8');
  assert.doesNotMatch(source, /window\.open|salesOutreachCommand|fetch\(|onClick|onKeyDown/);
});
