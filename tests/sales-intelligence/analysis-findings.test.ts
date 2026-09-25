import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { currentFindingsSchema, type CurrentFindings } from "../../lib/api/salesIntelligenceAnalysis";
import { evidenceReadSchema, runPresentationReadSchema } from "../../lib/api/salesIntelligenceAssessment";
import {
  CATEGORY_ORDER, ChangesSinceLast, FindingBlock, Findings, FindingsSkeleton, InstructionAssessments, groupFindings, workResultText,
} from "../../components/sales-intelligence/outreach/analysis/findings";
import {
  EvidenceInline, EvidenceInlineSkeleton, EvidenceList, evidenceShape, resolveEvidenceRefs, type EvidenceView,
} from "../../components/sales-intelligence/outreach/analysis/evidence-inline";
import { copy } from "../../components/sales-intelligence/sales-intelligence-copy";
import { formatExact, formatExactFull } from "../../components/sales-intelligence/lib/time";

// UI1-FIND: Findings and inline evidence rendered from the S3 contract fixtures (final spec §11.5–11.6, UI1-A24–A25).
// No DOM (ADMIN-REBUILD trap 7).

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
const raw = (rel: string) => JSON.parse(fs.readFileSync(path.join(CONTRACTS, rel), "utf8"));
const findingsOf = (rel: string) => currentFindingsSchema.parse(raw(rel));
const decode = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const text = (html: string) => decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ");
const a = copy.ui1.analysis;

function renderFindings(read: { as_of: string; data: CurrentFindings }, props: Partial<Parameters<typeof Findings>[0]> = {}) {
  return renderToStaticMarkup(createElement(Findings, { findings: read.data.items, reason: read.data.reason, truncated: read.data.truncated, asOf: read.as_of, ...props }));
}
/** The `<article>` of one finding. */
function block(html: string, id: string): string {
  const at = html.indexOf(`data-finding="${id}"`);
  assert.ok(at >= 0, `finding ${id}`);
  const end = html.indexOf("</article>", at);
  return html.slice(at, end);
}

const S_FINDINGS = findingsOf("S3/outreach-findings__s-findings.json");
const S_SUPERSEDED = findingsOf("S3/outreach-findings__s-findings-include-superseded.json");

test("categories render in the fixed order with a count on each header (A24)", () => {
  const html = renderFindings(S_FINDINGS);
  const groups = groupFindings(S_FINDINGS.data.items);
  assert.deepEqual(groups.map((g) => g.category), ["commitments", "money", "objections", "restrictions", "move_facts", "call_type"]);
  let last = -1;
  for (const group of groups) {
    const at = html.indexOf(`data-category="${group.category}"`);
    assert.ok(at > last, `${group.category} in order`);
    last = at;
    assert.ok(decode(html).includes(`${group.label} (${group.items.length})`), `${group.label} count`);
  }
  // Order holds whatever order the server sends.
  const shuffled = [...S_FINDINGS.data.items].reverse();
  assert.deepEqual(groupFindings(shuffled).map((g) => g.category), groups.map((g) => g.category));
  assert.equal(CATEGORY_ORDER.length, 8);
});

test("each finding shows the server words: source, action status, value line, work result from the enum (A24)", () => {
  const html = renderFindings(S_FINDINGS);
  for (const finding of S_FINDINGS.data.items) {
    const t = text(block(html, finding.id));
    assert.ok(t.includes(finding.claim), finding.id);
    assert.ok(t.includes(finding.source_word));
    if (finding.action_status_word) assert.ok(t.includes(`${finding.source_word} · ${finding.action_status_word}`), `${finding.id} action word`);
    if (finding.value_line) assert.ok(t.includes(finding.value_line), `${finding.id} value line`);
    assert.ok(t.includes(`Work result: ${workResultText(finding)}`), `${finding.id} work result`);
    if (finding.call_at) assert.ok(block(html, finding.id).includes(`title="${formatExactFull(finding.call_at)}"`), "exact call time on title");
  }
  const t = text(html);
  assert.ok(t.includes("Work result: Applied → follow-up due Sep 24, 8:45 PM ET"));
  assert.ok(t.includes("Work result: Applied → follow-up completed"));
  assert.ok(t.includes("Work result: Blocked: Owner instruction active"));
  assert.ok(t.includes("Work result: Needs review"));
  assert.ok(t.includes("Work result: Not applicable"));
  assert.ok(t.includes("Work result: Retracted by you"));
  assert.ok(!/Applied → supersede/.test(t));
  assert.ok(!html.includes("si-badge--amber"), "no amber in Findings");
});

test("Uncertain chip only where clarity is uncertain", () => {
  const html = renderFindings(S_FINDINGS);
  const uncertain = S_FINDINGS.data.items.filter((f) => f.clarity === "uncertain");
  assert.equal(uncertain.length, 1);
  assert.equal((text(html).match(/\bUncertain\b/g) ?? []).length, 1);
  assert.ok(text(block(html, uncertain[0]!.id)).includes(a.findings.uncertain));
});

test("review actions: Confirm / Correct in view, Retract under More, none on a retracted finding; Look again only when passed", () => {
  const html = renderFindings(S_FINDINGS, { onAction: () => {} });
  const open = S_FINDINGS.data.items.find((f) => f.review_state === "unreviewed")!;
  const b = block(html, open.id);
  assert.ok(b.includes('data-action="confirm_finding"') && b.includes('data-action="correct_finding"'));
  const more = b.indexOf("si-finding__more");
  assert.ok(more > 0 && b.indexOf('data-action="retract_finding"') > more, "Retract sits under More");
  assert.ok(!b.includes('data-action="look_again"'));
  const retracted = S_FINDINGS.data.items.find((f) => f.review_state === "retracted")!;
  assert.ok(!block(html, retracted.id).includes("data-action="));
  const owner = renderFindings(S_FINDINGS, { onAction: () => {}, showLookAgain: true });
  assert.ok(block(owner, open.id).includes('data-action="look_again"'));
  assert.ok(text(block(owner, open.id)).includes(a.findings.lookAgain));
  assert.ok(block(owner, retracted.id).includes('data-action="look_again"'), "Look again is not a review action");
});

test("a replaced finding reads `Replaced by a later finding` and links to it", () => {
  const replaced = S_SUPERSEDED.data.items.find((f) => f.work_result === "superseded")!;
  assert.ok(replaced);
  const html = renderFindings(S_SUPERSEDED);
  const b = block(html, replaced.id);
  assert.ok(text(b).includes("Work result: Replaced by a later finding"));
  // The later finding (b65) belongs to a Number run, so it isn't listed here: no dead link.
  assert.ok(!html.includes(`id="si-finding-${replaced.superseded_by}"`));
  assert.ok(!b.includes("href="));
  // With the later finding on the page, the result links to it.
  const later = { ...S_SUPERSEDED.data.items[0]!, id: replaced.superseded_by! };
  const linked = renderFindings({ ...S_SUPERSEDED, data: { ...S_SUPERSEDED.data, items: [...S_SUPERSEDED.data.items, later] } });
  assert.ok(block(linked, replaced.id).includes(`href="#si-finding-${replaced.superseded_by}"`));
  assert.ok(text(block(linked, replaced.id)).includes(a.findings.openLater));
});

test("empty lists: the reason sentence, else `This analysis recorded no findings.`; truncated note", () => {
  const noNumber = findingsOf("S3/outreach-findings__s-lead-only.json");
  assert.equal(noNumber.data.reason, "no_number");
  assert.ok(text(renderFindings(noNumber)).includes(a.findings.reason.no_number));
  const empty = findingsOf("S3/outreach-findings__s-assessment-pending.json");
  const t = text(renderFindings(empty));
  assert.ok(t.includes("This analysis recorded no findings."));
  assert.ok(!t.includes(a.findings.truncated));
  const pending = text(renderFindings({ ...empty, data: { ...empty.data, reason: "retention_pending", truncated: true } }));
  assert.ok(pending.includes(a.findings.reason.retention_pending));
  assert.ok(pending.includes(a.findings.truncated));
});

test("View evidence toggles an inline block: transcript quote, speaker, segment time, Open in transcript; record label and as of (A25)", () => {
  const finding = S_FINDINGS.data.items[0]!;
  const closed = renderToStaticMarkup(createElement(FindingBlock, { finding, asOf: S_FINDINGS.as_of }));
  assert.ok(text(closed).includes(`View evidence (${finding.evidence.length})`));
  assert.ok(closed.includes('aria-expanded="false"') && closed.includes("hidden"));
  const html = renderToStaticMarkup(createElement(FindingBlock, { finding, asOf: S_FINDINGS.as_of, evidenceOpen: true }));
  const t = text(html);
  const quote = finding.evidence.find((e) => e.kind === "transcript_quote")!;
  assert.ok(t.includes(quote.quote!));
  assert.ok(t.includes(`— ${quote.speaker_label} · ${formatExact(quote.at!, S_FINDINGS.as_of)}`));
  assert.ok(html.includes(`aria-label="${formatExactFull(quote.at!)}"`));
  assert.ok(html.includes(`data-conversation="${quote.conversation_id}" data-sids="${quote.segment_ids!.join(",")}"`));
  assert.ok(t.includes("Open in transcript"));
  const record = finding.evidence.find((e) => e.kind === "analysis_record")!;
  assert.ok(t.includes(`${record.record_label} · ${record.text}`));
  assert.ok(t.includes(`as of ${formatExact(record.as_of!, S_FINDINGS.as_of)}`));
});

test("evidence shapes from assessment evidence: summary, said on the call, Lead on file, legacy summary", () => {
  const conflict = evidenceReadSchema.parse(raw("S3/assessment-evidence__s-conflict-move.json"));
  const asOf = conflict.as_of ?? S_FINDINGS.as_of;
  const pick = (items: EvidenceView[], kind: string, label?: string) => items.find((i) => i.kind === kind && (!label || i.source_label === label))!;
  const items = conflict.data.items as EvidenceView[];
  const summary = pick(items, "summary_section", "Overview");
  const said = pick(items, "move_evidence");
  assert.equal(evidenceShape(summary), "summary");
  assert.equal(evidenceShape(said), "said");
  const t = text(renderToStaticMarkup(createElement(EvidenceList, { items: [summary, said], asOf })));
  assert.ok(t.includes(`From the call summary, Sep 16 · Overview ${summary.text}`), t);
  assert.ok(t.includes(`Said on the call, Sep 20 : ${said.text} — Customer`), t);
  const lead = evidenceReadSchema.parse(raw("S3/assessment-evidence__s-lead-only.json")).data.items[0] as EvidenceView;
  assert.equal(evidenceShape(lead), "record");
  assert.ok(text(renderToStaticMarkup(createElement(EvidenceList, { items: [lead], asOf }))).includes(`Lead on file · ${lead.text}`));
  const legacy = evidenceReadSchema.parse(raw("S3/assessment-evidence__s-legacy.json")).data.items as EvidenceView[];
  const legacySummary = legacy.find((i) => i.kind === "legacy_summary_section")!;
  assert.equal(evidenceShape(legacySummary), "summary");
  assert.ok(text(renderToStaticMarkup(createElement(EvidenceList, { items: [legacySummary], asOf }))).includes(legacySummary.text!));
  const presented = runPresentationReadSchema.parse(raw("S3/run-presentation__s-findings-run3.json")).data.evidence.items as EvidenceView[];
  const plain = presented.find((i) => i.kind === "summary_section")!;
  assert.ok(!text(renderToStaticMarkup(createElement(EvidenceList, { items: [plain], asOf }))).includes("From the call summary · From the call summary"));
});

test("purged, unavailable and missing evidence: the retention sentence, `No evidence cited`, the should-cite defect", () => {
  const retained = S_FINDINGS.data.items[0]!.evidence[0]! as EvidenceView;
  const purgedAt = "2026-09-21T14:00:00.000Z";
  const purged = { ...retained, availability: "purged", purged_at: purgedAt };
  const html = renderToStaticMarkup(createElement(EvidenceList, { items: [purged], asOf: S_FINDINGS.as_of }));
  assert.ok(text(html).includes(`Original removed under retention on ${formatExact(purgedAt, S_FINDINGS.as_of)}; the citation is kept.`));
  assert.ok(html.includes(`title="${formatExactFull(purgedAt)}"`));
  assert.ok(!html.includes("si-evidence__open"), "no transcript jump for purged evidence");
  const gone = text(renderToStaticMarkup(createElement(EvidenceList, { items: [{ ...retained, availability: "unavailable" }], asOf: S_FINDINGS.as_of })));
  assert.ok(gone.includes(a.evidence.unavailable));
  assert.equal(text(renderToStaticMarkup(createElement(EvidenceInline, { items: [], asOf: S_FINDINGS.as_of }))).trim(), "No evidence cited");
  assert.equal(text(renderToStaticMarkup(createElement(EvidenceInline, { items: [], asOf: S_FINDINGS.as_of, shouldCite: true }))).trim(), "This score should cite evidence and does not.");
});

test("Changes since the last analysis: relation words, the new claim, notes, evidence resolved by id, review link, the Unchanged disclosure", () => {
  const pres = runPresentationReadSchema.parse(raw("S3/run-presentation__s-findings-run3.json"));
  const relations = pres.data.summary_findings.prior_finding_relations;
  const evidence = pres.data.evidence.items as EvidenceView[];
  const html = renderToStaticMarkup(createElement(ChangesSinceLast, { relations, evidence, asOf: pres.as_of!, reviewHref: (id: string) => `?tab=work#review-item-${id}` }));
  const t = text(html);
  assert.ok(t.includes(`Changes since the last analysis (${relations.length})`));
  for (const word of ["Replaced", "Done", "Contradicted on a later call"]) assert.ok(t.includes(` · ${word} · `), word);
  const unchanged = relations.filter((r) => r.group === "unchanged");
  assert.ok(t.includes(`Unchanged or unclear (${unchanged.length})`));
  const disclosure = html.indexOf("Unchanged or unclear");
  for (const r of unchanged) assert.ok(html.indexOf(`data-prior="${r.prior_finding_id}"`) > disclosure, "unchanged rows sit in the disclosure");
  const contradicted = relations.find((r) => r.relation === "contradicted")!;
  assert.ok(html.includes(`href="?tab=work#review-item-${contradicted.review_item_id}"`));
  assert.equal((html.match(/data-review-item=/g) ?? []).length, relations.filter((r) => r.review_item_id).length);
  const replaced = relations.find((r) => r.relation === "superseded")!;
  assert.ok(t.includes(replaced.by_claim!) && t.includes(replaced.note!));
  const resolved = resolveEvidenceRefs(replaced.evidence, evidence);
  assert.equal(resolved[0]!.text, evidence.find((e) => e.id === replaced.evidence[0]!.id)!.text, "the ref resolves to the served item");
  const orphan = resolveEvidenceRefs([{ id: "nope", kind: "transcript_quote", locator: { source: "analysis_transcript", conversation_id: "c1", segment_ids: [4] } }], evidence)[0]!;
  assert.equal(orphan.conversation_id, "c1");
  assert.deepEqual(orphan.segment_ids, [4]);
  const assessments = text(renderToStaticMarkup(createElement(InstructionAssessments, { items: pres.data.summary_findings.owner_instruction_assessments })));
  assert.ok(assessments.includes("Your changes and what the model made of them"));
  for (const word of ["Agrees", "Disagrees", "Cannot tell"]) assert.ok(assessments.includes(` · ${word} · `), word);
});

test("skeletons render shaped placeholders", () => {
  assert.ok(renderToStaticMarkup(createElement(FindingsSkeleton)).includes("si-skeleton"));
  assert.ok(renderToStaticMarkup(createElement(EvidenceInlineSkeleton)).includes("si-skeleton"));
});

test("gallery: the analysis-findings entry renders every sample group from the fixtures", async () => {
  const { AnalysisFindingsSection } = await import("../../app/(dashboard)/sales-intelligence/dev/gallery/sections/analysis-findings");
  const html = renderToStaticMarkup(createElement(AnalysisFindingsSection));
  assert.ok(html.includes('<section id="analysis-findings"'));
  for (const id of ["findings", "findings-empty", "evidence", "conversations", "audio", "live", "transcript", "skeletons", "phone"]) assert.ok(html.includes(`data-af-sample="${id}"`), id);
  const t = text(html);
  for (const phrase of ["Replaced by a later finding", "Retracted by you", "Blocked: Owner instruction active", "Uncertain", "Changes since the last analysis (5)", "Unchanged or unclear (2)",
    "Your changes and what the model made of them", a.findings.reason.no_number, a.findings.reason.retention_pending, "This analysis recorded no findings.", a.findings.truncated,
    "Original removed under retention on", a.evidence.unavailable, "No evidence cited", "This score should cite evidence and does not.", "From the call summary, ", "Said on the call, ", "Lead on file · ",
    "Recording: available", "Recording: not recorded", "Recording: audio removed under retention; transcript kept", "Audio removed under retention; the transcript is kept.",
    "Couldn't load the audio. The transcript is still available.", "Other calls (2)", "In progress", "Details may still change", "2 earlier segments are not shown."]) {
    assert.ok(t.includes(phrase), phrase);
  }
  assert.ok((html.match(/is-highlighted/g) ?? []).length >= 2, "highlighted transcript segments");
});
