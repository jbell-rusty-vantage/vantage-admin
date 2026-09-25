import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ownerCoverageSchema, type CaptureHealth as CaptureHealthDto } from "../../lib/api/salesIntelligence";
import { CaptureHealth, captureReasonText } from "../../components/sales-intelligence/capture-health";
import { CoverageView } from "../../components/sales-intelligence/coverage-view";
import { siKeys } from "../../components/sales-intelligence/data/query-keys";
import { formatExactFull } from "../../components/sales-intelligence/lib/time";
import { copy } from "../../components/sales-intelligence/sales-intelligence-copy";
import { CoverageSection, COVERAGE_ATTENTION, COVERAGE_BROKEN, COVERAGE_OK } from "../../app/(dashboard)/sales-intelligence/dev/gallery/sections/coverage";

// UI1-COVER (UI-1 §6, A31): the capture health block from the S5c coverage fixtures, and the kept Coverage view
// unchanged when the server sends no `capture_health`. Static markup, no DOM (ADMIN-REBUILD trap 7).

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
const read = (rel: string) => ownerCoverageSchema.parse(JSON.parse(fs.readFileSync(path.join(CONTRACTS, rel), "utf8")));
const decode = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
const c = copy.ui1.coverage;

const FIXTURES = [
  { file: "S5c/coverage__capture-health-ok__synthetic.json", status: "ok" },
  { file: "S5c/coverage__seed.json", status: "attention" },
  { file: "S5c/coverage__capture-health-broken__synthetic.json", status: "broken" },
  { file: "S5c/flag-off/coverage__seed.json", status: "attention" },
];

function renderHealth(health: CaptureHealthDto, asOf: string) {
  return decode(renderToStaticMarkup(createElement(CaptureHealth, { health, asOf })));
}

test("A31: every capture_health fixture renders its headline, each reason as a sentence, and the pending explanation", () => {
  for (const { file, status } of FIXTURES) {
    const read_ = read(file);
    const health = read_.data.coverage.capture_health;
    assert.ok(health, `${file} has capture_health`);
    assert.equal(health.status, status, file);
    const html = renderHealth(health, read_.data.as_of);
    assert.ok(html.includes(c.status[status]!), `${file} headline`);
    assert.ok(html.includes(`data-capture-status="${status}"`));
    for (const key of health.reasons) {
      assert.ok(c.reason[key], `${file}: reason ${key} has copy`);
      assert.ok(html.includes(`data-reason="${key}"`) && html.includes(captureReasonText(key, health)), `${file}: reason ${key}`);
    }
    if (health.reasons.includes("pending_finalization")) {
      const at = html.indexOf('data-reason="pending_finalization"');
      const item = html.slice(at, html.indexOf("</li>", at));
      assert.ok(item.includes(c.pendingExplain), `${file}: explanation follows pending_finalization`);
    }
    if (health.reasons.length === 0) assert.ok(!html.includes("si-caphealth__reasons"), `${file}: no reason list with ok`);
    // Red only for broken.
    assert.equal(html.includes("si-text--danger"), status === "broken", `${file}: red only when broken`);
    // Known-through, Call Log, webhook and call counts.
    assert.ok(html.includes(`aria-label="${c.knownThrough} ${formatExactFull(health.known_complete_through!)}"`), `${file}: known through with the exact ET time`);
    assert.ok(html.includes(c.syncMode(health.call_log.sync_mode)));
    assert.ok(html.includes(c.quarantine(health.call_log.quarantined_count)));
    assert.ok(html.includes(c.lastSweep(health.call_log.last_sweep!.recovered_calls)));
    assert.ok(html.includes(c.webhook.state[health.webhook.state]!));
    assert.ok(html.includes(c.webhook.subscription(health.webhook.subscription_id_suffix!)));
    assert.ok(html.includes(`aria-label="${c.webhook.lastReceipt} ${formatExactFull(health.webhook.last_receipt_at!)}"`));
    assert.ok(html.includes(c.webhook.receipts1h(health.webhook.receipts_1h)));
    assert.ok(html.includes(c.inProgress(health.in_progress_calls)));
    assert.ok(html.includes(c.pendingFinalization(health.pending_finalization)));
    assert.ok(!html.includes(c.webhook.subscriptionMissing), `${file}: no subscription_missing sentence`);
  }
});

test("reason wording: quarantine and pending_finalization carry the server's counts; an unknown key never renders blank", () => {
  const broken = read("S5c/coverage__capture-health-broken__synthetic.json").data.coverage.capture_health!;
  const html = renderHealth(broken, broken.as_of);
  assert.ok(html.includes("The RingCentral webhook isn't delivering."));
  assert.ok(html.includes("A Call Log record has been quarantined for more than 24 hours."));
  assert.ok(html.includes("1 call started more than 10 minutes ago hasn't ended."));
  assert.ok(html.includes("Call capture is broken. Calls may be missing until it's repaired."));
  assert.ok(html.includes("Webhook down") && html.includes("subscription …00c3d4") && html.includes("0 receipts in the last hour"));
  assert.ok(html.includes(`${c.quarantine(1)} (<time`) && html.includes(`aria-label="oldest ${formatExactFull("2026-09-23T17:39:44.697Z")}"`));
  const seed = read("S5c/coverage__seed.json").data.coverage.capture_health!;
  assert.equal(captureReasonText("quarantine", seed), "1 Call Log record is quarantined.");
  assert.equal(captureReasonText("quarantine", { ...seed, call_log: { ...seed.call_log, quarantined_count: 3 } }), "3 Call Log records are quarantined.");
  assert.equal(captureReasonText("pending_finalization", { ...seed, pending_finalization: 2 }), "2 calls started more than 10 minutes ago haven't ended.");
  assert.equal(captureReasonText("webhook_degraded", seed), "The RingCentral webhook has been silent for 30 staffed minutes while calls were logged.");
  assert.equal(captureReasonText("new_server_reason", seed), "New server reason.");
  const unknown = renderHealth({ ...seed, status: "paused", reasons: ["new_server_reason"] }, seed.as_of);
  assert.ok(unknown.includes("Call capture status: paused.") && unknown.includes("New server reason."));
});

test("null paths: never swept, history unknown, no receipt, no subscription, and the subscription_missing sentence", () => {
  const ok = COVERAGE_OK;
  const html = renderHealth({
    ...ok,
    known_complete_through: null,
    call_log: { ...ok.call_log, last_sweep: null, oldest_quarantined_at: null },
    webhook: { ...ok.webhook, subscription_id_suffix: null, last_receipt_at: null, last_renewal_error: "subscription_missing" },
  }, ok.as_of);
  assert.ok(html.includes(c.neverSwept));
  assert.ok(html.includes(`class="si-time is-null">${c.knownUnknown}<`));
  assert.ok(html.includes(`class="si-time is-null">${c.webhook.noReceipt}<`));
  assert.ok(!html.includes("subscription …"));
  assert.ok(!html.includes("(<time"), "no oldest quarantine time when none");
  assert.ok(html.includes(c.webhook.renewalError("subscription_missing")));
  assert.ok(html.includes(c.webhook.subscriptionMissing));
  const other = renderHealth({ ...ok, webhook: { ...ok.webhook, last_renewal_error: "http_500" } }, ok.as_of);
  assert.ok(other.includes("last renewal error: http_500") && !other.includes(c.webhook.subscriptionMissing));
});

function renderCoverage(body: ReturnType<typeof read>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(siKeys.coverage(), body);
  return renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(CoverageView)));
}

test("Coverage view: capture health sits at the top; without capture_health (a pre-S5c server) the rest renders unchanged", () => {
  const withHealth = read("S5c/flag-off/coverage__seed.json");
  const health = withHealth.data.coverage.capture_health!;
  const rest = { ...withHealth.data.coverage };
  delete rest.capture_health;
  const without = { ...withHealth, data: { ...withHealth.data, coverage: rest } };
  assert.ok(!("capture_health" in without.data.coverage));

  const htmlWith = renderCoverage(withHealth);
  const htmlWithout = renderCoverage(without);
  const block = renderToStaticMarkup(createElement(CaptureHealth, { health, asOf: withHealth.data.as_of }));
  assert.ok(htmlWith.includes(block), "the block renders inside Coverage from the shared coverage read");
  assert.ok(htmlWith.indexOf('data-region="capture-health"') < htmlWith.indexOf(copy.coverage.ownerLayer), "capture health comes first");
  assert.equal(htmlWith.replace(block, ""), htmlWithout, "the rest of Coverage is identical");
  assert.ok(htmlWithout.includes('data-region="capture-health"></div>'), "an empty region, nothing printed");
  for (const kept of [copy.coverage.ownerLayer, copy.coverage.history, copy.coverage.budget]) assert.ok(decode(htmlWithout).includes(kept), kept);
});

test("skeleton and gallery section: shaped skeleton, every status sample, nothing from _legacy", () => {
  const skeleton = renderToStaticMarkup(createElement(CaptureHealth.Skeleton));
  assert.ok(skeleton.includes("si-caphealth is-skeleton") && (skeleton.match(/si-skeleton--line/g) ?? []).length >= 8);
  const gallery = decode(renderToStaticMarkup(createElement(CoverageSection)));
  for (const id of ["ok", "attention", "broken", "subscription-missing", "skeleton"]) assert.ok(gallery.includes(`data-coverage-sample="${id}"`), id);
  assert.ok(gallery.includes(c.webhook.subscriptionMissing) && gallery.includes(c.neverSwept));
  assert.deepEqual([COVERAGE_OK.status, COVERAGE_ATTENTION.status, COVERAGE_BROKEN.status], ["ok", "attention", "broken"]);
  // The gallery copies match the fixtures they name.
  for (const [sample, file] of [[COVERAGE_ATTENTION, "S5c/coverage__seed.json"], [COVERAGE_BROKEN, "S5c/coverage__capture-health-broken__synthetic.json"], [COVERAGE_OK, "S5c/coverage__capture-health-ok__synthetic.json"]] as const) {
    const health = read(file).data.coverage.capture_health!;
    assert.deepEqual({ ...sample, call_log: { ...sample.call_log, last_sweep: null } }, { ...health, call_log: { ...health.call_log, last_sweep: null } }, file);
    assert.equal(sample.call_log.last_sweep?.recovered_calls, health.call_log.last_sweep?.recovered_calls, file);
  }
  const quarantined = /from ["'][^"']*_legacy/;
  for (const file of ["components/sales-intelligence/capture-health.tsx", "components/sales-intelligence/guide-view.tsx", "app/(dashboard)/sales-intelligence/dev/gallery/sections/coverage.tsx"]) {
    assert.doesNotMatch(fs.readFileSync(path.join(process.cwd(), file), "utf8"), quarantined, file);
  }
});
