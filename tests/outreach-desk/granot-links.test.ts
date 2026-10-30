import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { QueueRow } from "../../components/outreach-desk/views/my-view";
import { AttentionRow } from "../../components/outreach-desk/views/team-view";
import { LeadPanel } from "../../components/outreach-desk/views/lead-panel";
import { GranotLinkButton } from "../../components/outreach-desk/views/granot-link-button";
import { GranotSessionContext, GranotSessionPilot } from "../../components/outreach-desk/views/granot-session-pilot";
import { GRANOT_SESSION_PILOT_AGENT, GRANOT_TEST_MESSAGE, granotSessionSearch, isGranotSessionPilot, readGranotSessionContext } from "../../components/outreach-desk/lib/granot-session-pilot";
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

test("no shared-account lookup or persistent browser storage is used by the pilot", () => {
  const source = readFileSync('components/outreach-desk/views/granot-link-button.tsx', 'utf8');
  const session = readFileSync('components/outreach-desk/views/granot-session-pilot.tsx', 'utf8');
  assert.doesNotMatch(source + session, /window\.open|salesOutreachCommand|fetch\(|localStorage|sessionStorage|console\./);
});

const context = "11111111-2222-3333-4444-555555555555";
test("session parsing accepts only the Granot job/menu forms, without extra parameters", () => {
  for (const query of [`mpcharge~chargeswc~${context}`, `mv~mainmenuwc~${context}~LOGIN`]) {
    assert.equal(readGranotSessionContext(`https://eagle.hellomoving.com/wc.dll?${query}`), context);
  }
  for (const url of [
    `http://eagle.hellomoving.com/wc.dll?mpcharge~chargeswc~${context}`,
    `https://eagle.hellomoving.com.evil.invalid/wc.dll?mpcharge~chargeswc~${context}`,
    `https://name:password@eagle.hellomoving.com/wc.dll?mpcharge~chargeswc~${context}`,
    `https://eagle.hellomoving.com/wc.dll?mpcharge~chargeswc~${context}&other=x`,
    `https://eagle.hellomoving.com/wc.dll?mpcharge~chargeswc~${context}#extra`,
    `https://eagle.hellomoving.com/wc.dll?mpcharge~updagentwc~${context}`,
    "https://eagle.hellomoving.com/vantage/admin.htm", "not a URL",
  ]) assert.equal(readGranotSessionContext(url), null);
});

test("the pilot belongs only to Josh's signed-in Rep identity", () => {
  assert.equal(isGranotSessionPilot({ role: "rep", agentId: GRANOT_SESSION_PILOT_AGENT }), true);
  for (const viewer of [{ role: "owner", agentId: GRANOT_SESSION_PILOT_AGENT }, { role: "manager", agentId: GRANOT_SESSION_PILOT_AGENT }, { role: "rep", agentId: "another-agent" }]) {
    assert.equal(isGranotSessionPilot(viewer), false);
    const html = renderToStaticMarkup(createElement(GranotSessionPilot, { viewer, children: createElement(GranotLinkButton, { subjectId: "subject", jobNo: "P5550001" }) }));
    assert.doesNotMatch(html, /Granot account test|Use my Granot session|<form/);
    assert.match(html, /Attempting auth fix\./);
  }
  const html = renderToStaticMarkup(createElement(GranotSessionPilot, { viewer: { role: "rep", agentId: GRANOT_SESSION_PILOT_AGENT }, children: createElement("span", null, "desk") }));
  assert.match(html, /Use my Granot session/);
  assert.ok(html.includes(GRANOT_TEST_MESSAGE));
});

test("Josh's row and side panel submit the displayed job through his supplied session", () => {
  const row = { ...syntheticQueueRows()[0]!, job_pending: false, job_no: "P5550001" };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const detail = syntheticDetail({ subjectId: row.subject_id, role: "rep" })!;
  client.setQueryData(outreachKeys.detail(row.subject_id), { ...detail, subject: { ...detail.subject, job_no: row.job_no } });
  const elements = [createElement(QueueRow, { row, asOf: SYNTHETIC_AS_OF, relativeNow: SYNTHETIC_AS_OF, selected: false, onSelect() {}, onMove() {} }), createElement(QueryClientProvider, { client }, createElement(LeadPanel, { subjectId: row.subject_id, commands: [], reps: null, onRevoked() {} }))];
  for (const element of elements) {
    const html = renderToStaticMarkup(createElement(GranotSessionContext, { value: { context } }, element));
    assert.match(html, /Copy job #/);
    assert.match(html, new RegExp(`action="https://eagle\\.hellomoving\\.com/wc\\.dll\\?mv~searchret~${context}~QSEARCH"`));
    assert.match(html, /method="post"/);
    assert.match(html, /target="_blank"/);
    assert.match(html, /rel="noopener noreferrer"/);
    assert.match(html, /name="VALUE" value="5550001"/);
    assert.match(html, /name="B5" value="Search"/);
    assert.doesNotMatch(html, /Attempting auth fix|disabled=""/);
  }
  client.clear();
  assert.equal(granotSessionSearch(context, "P-not-a-job"), null);
  assert.equal(granotSessionSearch("unsafe", "5550001"), null);
});
