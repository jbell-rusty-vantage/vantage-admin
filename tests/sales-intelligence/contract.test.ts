import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import {
  attentionSchema,
  closedHistorySchema,
  commandResultSchema,
  conversationsSchema,
  errorBodySchema,
  numberSchema,
  numberSearchSchema,
  outreachReadSchema,
  overviewSchema,
  ownerCoverageSchema,
  timelineSchema,
  timelineV2Schema,
  transcriptSchema,
} from "../../lib/api/salesIntelligence";
import { analysisSchema, currentFindingsSchema } from "../../lib/api/salesIntelligenceAnalysis";
import {
  assessmentReadSchema,
  evidenceReadSchema,
  outreachAssessmentReadSchema,
  runPresentationReadSchema,
} from "../../lib/api/salesIntelligenceAssessment";
import { findContractsDir, FIXTURES_UNAVAILABLE, fixtureTest, requireContracts } from "./contracts-dir";

/*
 * UI-0 §3 contract parse test (UI1-DATA). Every JSON fixture captured from the local API is parsed with the
 * admin's own zod schema for its route. A fixture name is `<route>__<label>.json`; the route prefix picks the
 * schema. Read fixtures are the whole response body (`{ ok, as_of, coverage, data }`); status fixtures are
 * `{ status, body }` and parse `body` as a refusal (`ok: false`) or as the route's success body.
 */
// The fixtures sit next to vantage-admin (or SI_CONTRACTS_DIR); without them every test here skips (see ./contracts-dir).
const CONTRACTS = findContractsDir() ?? "";
if (!CONTRACTS) console.log(`contract fixtures: skipped (${FIXTURES_UNAVAILABLE})`);
const FOLDERS = ["S1", "S2", "S3", "S4", "S5c", "S6", "S7", "S8", "S9", "AC"] as const;
const MIN_PARSED = 560;

// Admin-users routes (S8, UI-2's Users page): a small local schema, since the admin has none under lib/api.
const userSchema = z.object({ id: z.string(), email: z.string(), role: z.string(), agent_id: z.string().nullable(), active: z.boolean(),
  created_at: z.string(), updated_at: z.string(), last_login_at: z.string().nullable(), password_changed_at: z.string().nullable() });
const okBody = <T extends z.ZodType>(data: T) => z.object({ ok: z.literal(true), data });
const adminUsers: Record<string, z.ZodType> = {
  list: okBody(z.object({ users: z.array(userSchema) })),
  create: okBody(z.object({ user: userSchema })),
  update: okBody(z.object({ user: userSchema })),
  deactivate: okBody(z.object({ user: userSchema })),
  "set-password": okBody(z.object({ user: userSchema })),
  invite: okBody(z.object({ emailed: z.boolean(), delivery: z.string(), expires_at: z.string(), link: z.string() })),
  "accept-invite": okBody(z.object({ password_set: z.boolean() })),
};

type Entry = { schema: z.ZodType; also?: { name: string; schema: z.ZodType; when: (rel: string) => boolean }[] };
const read = (schema: z.ZodType, also?: Entry["also"]): Entry => ({ schema, also });
const flagOff = (rel: string) => rel.includes("/flag-off/");
// Status-only routes: the capture stored the refusal (or a stream's status), never a read body.
const STATUS_ONLY = new Set([
  "conversation-media-purged", "conversation-media-retained", "owner-outreach-missing", "outreach-timeline-band-changed",
  "rep-refused", "rep-owner-only", "rep-command-invalid", "rep-command-refused",
  "rep-conversation-media", "rep-conversation-media-no-recording", "rep-conversation-media-out-of-scope",
  "rep-conversation-transcript-out-of-scope", "rep-number-conversations-out-of-scope", "rep-outreach-assessment-out-of-scope",
  "rep-outreach-findings-out-of-scope", "rep-outreach-out-of-scope", "rep-outreach-timeline-out-of-scope",
]);
const REGISTRY: Record<string, Entry> = {
  attention: read(attentionSchema), "attention-closed": read(attentionSchema), "owner-attention": read(attentionSchema), "rep-attention": read(attentionSchema),
  outreach: read(outreachReadSchema), "owner-outreach": read(outreachReadSchema), "rep-outreach": read(outreachReadSchema), "rep-outreach-after-commands": read(outreachReadSchema),
  // Flag-off Number timelines are the v1 read: they must also still parse with the production (legacy) schema.
  "number-timeline": read(timelineV2Schema, [{ name: "timelineSchema (v1)", schema: timelineSchema, when: flagOff }]),
  "outreach-timeline": read(timelineV2Schema), "owner-outreach-timeline": read(timelineV2Schema),
  "owner-outreach-timeline-after-commands": read(timelineV2Schema), "rep-outreach-timeline": read(timelineV2Schema),
  "outreach-assessment": read(outreachAssessmentReadSchema), "rep-outreach-assessment": read(outreachAssessmentReadSchema),
  assessment: read(assessmentReadSchema), "assessment-evidence": read(evidenceReadSchema),
  "run-presentation": read(runPresentationReadSchema), "analysis-run": read(analysisSchema),
  "outreach-findings": read(currentFindingsSchema), "rep-outreach-findings": read(currentFindingsSchema),
  number: read(numberSchema), numbers: read(numberSearchSchema),
  "number-conversations": read(conversationsSchema), "rep-number-conversations": read(conversationsSchema),
  "conversation-transcript": read(transcriptSchema), "rep-conversation-transcript": read(transcriptSchema),
  coverage: read(ownerCoverageSchema),
  "closed-history": read(closedHistorySchema), "owner-closed-history": read(closedHistorySchema), "rep-closed-history": read(closedHistorySchema),
  overview: read(overviewSchema), "owner-overview": read(overviewSchema), "rep-overview": read(overviewSchema),
  "rep-command": read(commandResultSchema),
};

type Skip = { reason: string; match: (rel: string, name: string) => boolean };
const SKIPS: Skip[] = [
  { reason: "capture index (not a response)", match: (_rel, name) => name === "_capture-index.json" },
  { reason: "seed manifest (not a response)", match: (_rel, name) => name === "_seed-manifest.json" },
  { reason: "access matrix (route inventory)", match: (_rel, name) => name.startsWith("access-matrix.") },
  { reason: "admin proxy matrix (route inventory)", match: (_rel, name) => name === "admin-proxy-matrix.json" },
  { reason: "audit log (not a response)", match: (_rel, name) => name === "audit-log.json" },
  { reason: "Case File script output (no route)", match: (_rel, name) => name.startsWith("case-file__") },
  { reason: "reports folder", match: (rel) => rel.split("/").includes("reports") },
];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name.endsWith(".json")) out.push(full);
  }
  return out;
}
const issueText = (error: z.ZodError) => error.issues.slice(0, 5).map((issue) => `  at ${issue.path.join(".") || "(root)"}: ${issue.message}`).join("\n");
const isStatusFixture = (json: unknown): json is { status: number; body: { ok: boolean } } =>
  !!json && typeof json === "object" && typeof (json as { status?: unknown }).status === "number" && typeof (json as { body?: unknown }).body === "object";

type Result = { parsed: number; skipped: { rel: string; reason: string }[]; failures: string[]; perFolder: Map<string, number>; values: Map<string, unknown> };

function runContract(): Result {
  requireContracts();
  const result: Result = { parsed: 0, skipped: [], failures: [], perFolder: new Map(), values: new Map() };
  for (const folder of FOLDERS) {
    const root = path.join(CONTRACTS, folder);
    assert.ok(fs.existsSync(root), `Fixture folder missing: ${root}`);
    for (const file of walk(root)) {
      const rel = path.relative(CONTRACTS, file).split(path.sep).join("/");
      const name = path.basename(file);
      const skip = SKIPS.find((candidate) => candidate.match(rel, name));
      if (skip) { result.skipped.push({ rel, reason: skip.reason }); continue; }
      const route = name.includes("__") ? name.slice(0, name.indexOf("__")) : name.replace(/\.json$/, "");
      const json: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
      const users = rel.includes("/admin-users/");
      let schema: z.ZodType | undefined;
      let target: unknown = json;
      let label = route;
      if (isStatusFixture(json)) {
        target = json.body;
        if (json.body.ok === false) { schema = errorBodySchema; label = `${route} (refusal ${json.status})`; }
        else if (users) schema = adminUsers[route];
        else if (!STATUS_ONLY.has(route)) schema = REGISTRY[route]?.schema;
      } else if (!users && !STATUS_ONLY.has(route)) {
        schema = REGISTRY[route]?.schema;
      }
      if (!schema) { result.failures.push(`${rel}: no schema registered for route "${route}"${users ? " (admin-users)" : ""}`); continue; }
      const parsed = schema.safeParse(target);
      if (!parsed.success) { result.failures.push(`${rel} [${label}]\n${issueText(parsed.error)}`); continue; }
      for (const extra of REGISTRY[route]?.also ?? []) {
        if (!extra.when(rel) || isStatusFixture(json)) continue;
        const again = extra.schema.safeParse(json);
        if (!again.success) result.failures.push(`${rel} [${extra.name}]\n${issueText(again.error)}`);
      }
      result.values.set(rel, parsed.data);
      result.parsed += 1;
      result.perFolder.set(folder, (result.perFolder.get(folder) ?? 0) + 1);
    }
  }
  return result;
}

let cached: Result | undefined;
const contract = () => (cached ??= runContract());

fixtureTest("every fixture in S1…S9, AC and S5c parses with the admin schema for its route", () => {
  const { parsed, skipped, failures, perFolder } = contract();
  const lines = FOLDERS.map((folder) => `  ${folder}: ${perFolder.get(folder) ?? 0} parsed`);
  const skipLines = skipped.map((entry) => `  skipped: ${entry.rel} (${entry.reason})`);
  console.log(`contract fixtures: ${parsed} parsed, ${skipped.length} skipped\n${lines.join("\n")}\n${skipLines.join("\n")}`);
  assert.deepEqual(failures, [], `${failures.length} fixture(s) failed to parse:\n${failures.join("\n")}`);
  assert.ok(parsed >= MIN_PARSED, `Only ${parsed} fixtures parsed (expected at least ${MIN_PARSED}); a folder may have been skipped silently.`);
});

// The schemas strip unknown keys, so a field the UI reads must be modelled or it silently disappears.
// These spot checks prove the UI1-DATA additions survive parsing on the fixtures the data contract cites.
function value<T extends z.ZodType>(rel: string, schema: T): z.infer<T> {
  const found = contract().values.get(rel);
  assert.ok(found, `${rel} was not parsed`);
  // Parsed output parses again (the checks read the same typed value the hooks return).
  return schema.parse(found) as z.infer<T>;
}

fixtureTest("desk fields survive parsing (facts, live call, band since, metrics, priority counts, filter and sort keys)", () => {
  const all = value("S5c/attention__all-outreach.json", attentionSchema).data;
  assert.equal(typeof all.metrics?.leads_received_7d, "number");
  assert.equal(typeof all.priority_counts?.not_set?.active, "number");
  assert.ok(all.items.some((row) => row.outreach?.live_call?.rep.text));
  const row = all.items.find((item) => item.outreach);
  assert.ok(row?.outreach?.facts);
  assert.equal(typeof row.outreach.facts.move_date_passed, "boolean");
  assert.equal(typeof row.outreach.facts.next_action_state, "string");
  assert.equal(typeof row.outreach.trigger_at, "string");
  assert.ok(Array.isArray(row.filter_keys?.agents));
  assert.ok(row.sort_keys && "last_call" in row.sort_keys && "interactions" in row.sort_keys);
  assert.ok(value("S6/attention__all-outreach.json", attentionSchema).data.items.some((item) => item.outreach?.band_since?.at));
  const promise = value("AC/attention__all-outreach.json", attentionSchema).data.items.find((item) => item.outreach?.next_action?.promise_chain);
  assert.ok(promise, "an AC row keeps next_action.promise_chain");
  assert.equal(typeof promise.outreach?.next_action?.attention_due_at, "string");
});

fixtureTest("closed partition keeps outcome and the closed sort keys; Closed history keeps retention", () => {
  const closed = value("S6/attention-closed__closed-outcome-granot-booked.json", attentionSchema).data;
  assert.equal(closed.items[0]?.outcome?.reason, "granot_booked");
  assert.ok(closed.items[0]?.sort_keys && "time_to_close" in closed.items[0].sort_keys);
  const history = value("S7/closed-history__before-90d.json", closedHistorySchema).data;
  assert.equal(typeof history.retention.days, "number");
  assert.ok(history.items.every((item) => item.outcome));
});

fixtureTest("detail read keeps the Now strip, Situation and Work fields", () => {
  const detail = value("S1/outreach__s-audio-purged.json", outreachReadSchema).data;
  assert.ok(detail.outreach.latest_summary?.overview);
  assert.ok("newest_run_id" in detail.outreach && "official" in detail.outreach && "followups_cursor" in detail.outreach);
  assert.ok(Array.isArray(detail.owner_instructions) && Array.isArray(detail.nudges?.items));
  assert.ok(value("S6/outreach__t3-owner-kept.json", outreachReadSchema).data.outreach.receiver_agent?.agent.name);
  assert.equal(typeof value("S6/outreach__t3-spend-rate.json", outreachReadSchema).data.outreach.lead_cost?.amount, "number");
  assert.ok(value("S5c/outreach__t3-live-call.json", outreachReadSchema).data.outreach.live_call?.started_at);
});

fixtureTest("timeline v2, conversations, transcript, findings, presentation and assessment keep their UI fields", () => {
  const timeline = value("S5c/number-timeline__t3-live-call-kinds-call.json", timelineV2Schema).data;
  assert.ok(timeline.items.some((item) => item.call?.in_progress === true));
  assert.ok(timeline.items.every((item) => typeof item.title === "string" && typeof item.group === "string"));
  assert.ok(value("S5c/number-timeline__t3-capture-states-kinds-call.json", timelineV2Schema).data.items.some((item) => item.call?.observed_reason === "recovered"));
  assert.ok(Array.isArray(value("S4/outreach-timeline__s-timeline-300.json", timelineV2Schema).data.coverage.truncated_sources));
  const v1 = value("S4/flag-off/number-timeline__s-findings.json", timelineV2Schema).data;
  assert.ok(v1.items.every((item) => item.title === undefined && Array.isArray(item.chips)), "a v1 page parses with v2 defaults");
  assert.ok(value("S6/number-conversations__t3-live-call.json", conversationsSchema).data.other_calls.some((call) => call.in_progress === true));
  const transcript = value("S4/conversation-transcript__s-findings-c1-offset-2.json", transcriptSchema).data;
  assert.ok(transcript.completeness.missing_ranges.length > 0 && transcript.segments[0]?.sid !== undefined);
  const findings = value("S3/outreach-findings__s-audio-purged-include-superseded.json", currentFindingsSchema).data;
  assert.ok(findings.items.length > 0 && findings.items.every((item) => item.category_label && item.work_result));
  const presentation = value("S3/run-presentation__s-findings-run3.json", runPresentationReadSchema).data.summary_findings;
  assert.ok(presentation.story_discrepancies.length > 0 && presentation.prior_finding_relations.length > 0 && presentation.owner_instruction_assessments.length > 0);
  assert.ok(presentation.suggested_next_step && "applied_at" in presentation.suggested_next_step);
  const assessment = value("S3/outreach-assessment__s-conflict-move.json", outreachAssessmentReadSchema).data;
  assert.ok((assessment.current?.move_table?.rows.length ?? 0) > 0 && assessment.current?.engagement?.work_status_label);
  assert.ok((value("S3/outreach-assessment__s-assessment-pending.json", outreachAssessmentReadSchema).data.lead_move_table?.rows.length ?? 0) > 0);
});

fixtureTest("Overview and coverage capture health keep their blocks", () => {
  const overview = value("S9/overview__custom.json", overviewSchema).data;
  for (const key of ["now", "desk", "reps", "spend", "periods", "filters"]) assert.ok(key in overview, key);
  assert.equal(typeof value("S9/overview__owner-one-rep-scope.json", overviewSchema).data.team_medians?.reps, "number");
  const health = value("S5c/coverage__capture-health-broken__synthetic.json", ownerCoverageSchema).data.coverage.capture_health;
  assert.equal(health?.status, "broken");
  assert.ok(Array.isArray(health?.reasons) && typeof health?.webhook.receipts_1h === "number");
});
