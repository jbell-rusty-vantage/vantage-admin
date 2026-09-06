import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { OPERATIONAL_COPY } from "../components/operational/operational-copy";

const copy = OPERATIONAL_COPY.hideFromMasterLeads;

function readRepo(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function quotedLiterals(source: string): string[] {
  return [...source.matchAll(/["'`](?:\\.|[^\\"'`])*["'`]/g)].map((match) => match[0]);
}

test("OPERATIONAL_COPY has Hide / Show from Master Leads strings and Cancel", () => {
  assert.equal(copy.hideAction, "Hide from Master Leads");
  assert.equal(copy.showAction, "Show on Master Leads");
  assert.equal(copy.helper, "Booked Deals still updates if this lead is booked.");
  assert.equal(copy.confirmHideTitle, "Hide from Master Leads?");
  assert.equal(
    copy.confirmHideBody,
    "Hide this lead from the Forms and Calls tabs on Master Leads? The lead stays in the database. A Booking still writes Booked Deals.",
  );
  assert.equal(copy.confirmHideButton, "Hide from Master Leads");
  assert.equal(copy.confirmShowTitle, "Show on Master Leads?");
  assert.equal(
    copy.confirmShowBody,
    "Show this lead on the Forms and Calls tabs again? Sheet Sync will write it on the next drain.",
  );
  assert.equal(copy.confirmShowButton, "Show on Master Leads");
  assert.equal(copy.confirmCancel, "Cancel");
  assert.equal(
    copy.successHide,
    "Hidden from Master Leads. Sheet Sync will remove the Forms or Calls row.",
  );
  assert.equal(
    copy.successShow,
    "This lead will show on Master Leads again after Sheet Sync.",
  );
  assert.equal(copy.failure, "Could not update Master Leads visibility.");
  assert.equal(copy.hiddenLabel, "Hidden from Master Leads");
});

test("WorkflowActions renders HideFromMasterLeadsControl for form-leads and call-leads", () => {
  const actions = readRepo("components/operational/operational-actions.tsx");
  assert.match(actions, /HideFromMasterLeadsControl/);
  assert.match(actions, /uiResource === "form-leads"/);
  assert.match(actions, /uiResource === "call-leads"/);
  assert.match(
    actions,
    /uiResource === "form-leads" \|\| uiResource === "call-leads"/,
  );
  assert.match(actions, /<HideFromMasterLeadsControl resource=\{uiResource\} record=\{record\}/);
});

test("row Actions cluster does not render the hide control", () => {
  const columns = readRepo("components/operational/operational-columns.tsx");
  assert.doesNotMatch(columns, /HideFromMasterLeadsControl/);
  assert.doesNotMatch(columns, /hide-from-master-leads-control/);
  assert.match(columns, /MarkBadLeadControl record=\{record\} compact/);
});

test("production edit fields do not include the hide flag", () => {
  const configs = readRepo("components/operational/operational-configs.ts");
  const formBlock = configs.slice(
    configs.indexOf("const formLeadEditFields"),
    configs.indexOf("const callLeadColumns"),
  );
  const callBlock = configs.slice(
    configs.indexOf("const callLeadEditFields"),
    configs.indexOf("export const operationalConfigs"),
  );
  assert.doesNotMatch(formBlock, /no_sync/);
  assert.doesNotMatch(callBlock, /no_sync/);
});

test("Owner-visible copy and JSX do not print no_sync or Hide from Sheets", () => {
  for (const value of Object.values(copy)) {
    assert.doesNotMatch(value, /no_sync/);
    assert.doesNotMatch(value, /Hide from Sheets/);
    assert.doesNotMatch(value, /created_on_unmatched/);
  }

  for (const relativePath of [
    "components/operational/hide-from-master-leads-control.tsx",
    "components/operational/operational-actions.tsx",
    "components/operational/operational-copy.ts",
  ]) {
    const literals = quotedLiterals(readRepo(relativePath));
    for (const literal of literals) {
      assert.doesNotMatch(literal, /no_sync/);
      assert.doesNotMatch(literal, /Hide from Sheets/);
    }
  }
});

test("confirm is required before PATCH; Cancel does not mutate", () => {
  const control = readRepo("components/operational/hide-from-master-leads-control.tsx");
  const confirmStart = control.indexOf("function HideFromMasterLeadsConfirmDialog");
  assert.ok(confirmStart >= 0);
  assert.match(control, /role="dialog"/);
  assert.match(control, /confirmOpen/);
  assert.match(control, /setConfirmOpen\(true\)/);
  assert.match(control, /onCancel=\{\(\) => setConfirmOpen\(false\)\}/);
  assert.match(control, /onConfirm=\{\(\) => mutation\.mutate\(!hidden\)\}/);

  const dialog = control.slice(confirmStart);
  assert.doesNotMatch(dialog, /mutation\.mutate/);
  assert.doesNotMatch(dialog, /updateLeadNoSync/);
  assert.doesNotMatch(dialog, /updateProductionRecord/);
  assert.match(dialog, /onClick=\{onCancel\}/);
  assert.match(dialog, /onClick=\{onConfirm\}/);

  const actionClick = control.slice(
    control.indexOf("onClick={() => {"),
    control.indexOf("{confirmOpen ?"),
  );
  assert.doesNotMatch(actionClick, /mutation\.mutate/);
  assert.doesNotMatch(actionClick, /updateLeadNoSync/);
});

test("success and failure messages match Hide / Show copy", () => {
  const control = readRepo("components/operational/hide-from-master-leads-control.tsx");
  assert.match(control, /copy\.successHide/);
  assert.match(control, /copy\.successShow/);
  assert.match(control, /copy\.failure/);
  assert.match(control, /FeedbackMessage/);
  assert.doesNotMatch(control, /window\.confirm/);
  assert.doesNotMatch(control, /Check Google Sheet contains/);
});

test("API helper PATCHes the boolean through updateProductionRecord", () => {
  const admin = readRepo("lib/api/admin.ts");
  const start = admin.indexOf("export async function updateLeadNoSync");
  assert.ok(start >= 0);
  const next = admin.indexOf("\nexport ", start + 1);
  const helper = next === -1 ? admin.slice(start) : admin.slice(start, next);
  assert.match(helper, /updateProductionRecord/);
  assert.match(helper, /form-leads/);
  assert.match(helper, /call-leads/);
  assert.match(helper, /no_sync/);
});
