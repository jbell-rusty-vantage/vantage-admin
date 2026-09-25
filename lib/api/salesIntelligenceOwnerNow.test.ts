import test from "node:test";
import assert from "node:assert/strict";
import type { Outreach } from "./salesIntelligence";
import {
  callProgressOf,
  callStateOf,
  leadAttachmentOf,
  leadNameOf,
  provenanceStateOf,
  splitCommands,
  callBlockerText,
  callBlockerSentence,
} from "../../components/sales-intelligence/lib/owner-now";
import { copy } from "../../components/sales-intelligence/sales-intelligence-copy";
import { commandLabels } from "../../components/sales-intelligence/lib/commands";

const availability = (action: string, enabled = true, blocker_codes: string[] = []) =>
  ({ action, enabled, blocker_codes, target_id: "o1", expected_revision: 1 });

const base = {
  id: "o1",
  revision: 3,
  subject: { kind: "number_review", contact_number_id: "n1" },
  state: "open",
  reason: null,
  allowed_actions: [],
  assignment: { agent: null, origin: null },
  followups: [],
  derived: { overdue: false, attention_band: 4, reasons: [], call_blockers: [], age_wall_ms: 0, age_staffed_ms: 0 },
  last_meaningful_contact_at: null,
};
/** The fixtures carry optional server fields the shipped consumer schema does not model yet. */
const record = (extra: Record<string, unknown> = {}) => ({ ...base, ...extra }) as unknown as Outreach;

test("call state falls back to the stored progress and never invents one", () => {
  assert.equal(callStateOf(record()), "not_started");
  assert.equal(callProgressOf(record()), null);
  assert.equal(callStateOf(record({ call_progress: { state: "nonsense", started_at: "2026-09-21T14:00:00.000Z" } })), "not_started");
  assert.equal(callStateOf(record({ call_progress: { state: "in_progress" } })), "not_started");
  const live = record({ call_progress: { state: "in_progress", started_at: "2026-09-21T14:00:00.000Z", started_by: "Owner", ended_at: null, ended_by: null, note: null } });
  assert.equal(callStateOf(live), "in_progress");
  assert.equal(callProgressOf(live)?.started_by, "Owner");
  assert.equal(callStateOf(record({ ...base, derived: { ...base.derived, call_state: "ended" } })), "ended");
});

test("the server's derived provenance wins, and the fallback never overstates the evidence", () => {
  assert.equal(provenanceStateOf(record()), "needs_a_lead");
  assert.equal(provenanceStateOf(record({ derived: { ...base.derived, provenance_state: "attached_automatically" } })), "attached_automatically");
  const automatic = record({ lead_attachment: { state: "attached", certainty: "likely", decided_by: "automatic", confidence: 0.9 } });
  assert.equal(provenanceStateOf(automatic), "attached_automatically");
  assert.equal(leadAttachmentOf(automatic)?.confidence, 0.9);
  assert.equal(provenanceStateOf(record({ lead_attachment: { state: "attached", certainty: "owner_confirmed", decided_by: "owner" } })), "attached_by_you");
  assert.equal(provenanceStateOf(record({ lead_attachment: { state: "attached", certainty: "exact", decided_by: "evidence" } })), "attached_from_evidence");
  assert.equal(provenanceStateOf(record({ lead_attachment: { state: "ambiguous", certainty: "unsure" } })), "ambiguous");
  // A candidate edge has attached nothing; an unknown decider is evidence, not the Owner.
  assert.equal(provenanceStateOf(record({ lead_attachment: { state: "candidate", certainty: "likely" } })), "needs_a_lead");
  assert.equal(provenanceStateOf(record({ subject: { kind: "lead", model: "FormLead", id: "l1" } })), "attached_from_evidence");
  assert.equal(
    provenanceStateOf(record({ related_record_links: [{ model: "CallLead", id: "l1", href: "/x", certainty: "likely" }] })),
    "attached_from_evidence",
  );
});

test("every provenance state and call state has Owner sentences", () => {
  for (const state of ["attached_by_you", "attached_automatically", "attached_from_evidence", "needs_a_lead", "ambiguous"] as const) {
    assert.ok(copy.provenance.state[state].length);
    assert.ok(copy.provenance.soWhat[state].length);
  }
  assert.equal(copy.provenance.confidence(0.9), "Confidence 90%");
  assert.equal(copy.call.inProgress, "On the call");
  assert.equal(commandLabels.start_call, "Start the call");
  assert.equal(commandLabels.end_call, "End the call");
  assert.equal(callBlockerText(["call_already_in_progress"], copy.call.blockers), "A call is already in progress.");
  assert.equal(callBlockerText(["not_a_code"], copy.call.blockers), "");
});

test("a blocked call says why from the record, because ILLEGAL_TRANSITION covers two reasons", () => {
  const why = (action: string, r: Outreach, codes: string[] = ["ILLEGAL_TRANSITION"]) =>
    callBlockerSentence(action, r, codes, copy.call.blockers, copy.call.blockerCodes);
  const live = record({ call_progress: { state: "in_progress", started_at: "2026-09-21T14:00:00.000Z", started_by: "Owner", ended_at: null, ended_by: null, note: null } });
  assert.equal(why("start_call", live), "A call is already in progress.");
  assert.equal(why("end_call", live, []), "");
  assert.equal(why("end_call", record()), "No call is in progress.");
  assert.equal(why("start_call", record({ state: "closed" })), "This Outreach is closed.");
  assert.equal(why("end_call", record({ state: "closed" })), "This Outreach is closed.");
  assert.equal(
    why("start_call", record({ derived: { ...base.derived, call_blockers: ["restriction"] } }), ["CONTACT_RESTRICTED"]),
    "Calling this number is paused.",
  );
  // An unrecognised command with a server code still reads as a sentence, never as an enum.
  assert.equal(why("mark_worked", record(), ["FEATURE_DISABLED"]), "This is switched off in this deployment.");
  assert.equal(why("mark_worked", record(), ["SOMETHING_NEW"]), "");
});

test("the deck gives the call one primary button and hides the long tail", () => {
  const deck = splitCommands(
    [availability("close"), availability("mark_worked"), availability("assign"), availability("start_call"), availability("reopen")],
    commandLabels,
  );
  assert.equal(deck.call?.action, "start_call");
  assert.deepEqual(deck.secondary.map((item) => item.action), ["mark_worked", "assign"]);
  assert.deepEqual(deck.more.map((item) => item.action), ["close", "reopen"]);
  // While a call is running, ending it is the primary move.
  const live = splitCommands([availability("start_call", false, ["call_already_in_progress"]), availability("end_call")], commandLabels);
  assert.equal(live.call?.action, "end_call");
  // A server that offers both but blocks End must not make the dead button primary.
  const idle = splitCommands([availability("start_call"), availability("end_call", false, ["no_call_in_progress"])], commandLabels);
  assert.equal(idle.call?.action, "start_call");
  // Neither usable still shows Start, disabled, carrying its reason.
  const closed = splitCommands([availability("end_call", false, ["no_call_in_progress"]), availability("start_call", false, ["record_closed"])], commandLabels);
  assert.equal(closed.call?.action, "start_call");
  assert.equal(closed.call?.enabled, false);
  // UX-C4: the record header lifts all three everyday commands; the default stays two (the legacy strip, the detail page).
  const everyday = [availability("start_call"), availability("assign", false, ["x"]), availability("create_followup"), availability("mark_worked"), availability("close")];
  assert.deepEqual(splitCommands(everyday, commandLabels).secondary.map((item) => item.action), ["mark_worked", "create_followup"]);
  const header = splitCommands(everyday, commandLabels, 3);
  assert.deepEqual(header.secondary.map((item) => item.action), ["mark_worked", "create_followup", "assign"]);
  assert.deepEqual(header.more.map((item) => item.action), ["close"]);
  // Commands with no Owner label are never rendered blind.
  assert.deepEqual(splitCommands([availability("unlabelled_command")], commandLabels).more, []);
});

test("the Lead line reads from the attachment mirror before the record display", () => {
  assert.equal(leadNameOf(record()), null);
  assert.equal(leadNameOf(record({ lead_display: { name: "A Customer", job_no: "5564716", source_company: null } })), "A Customer · Job 5564716");
  assert.equal(
    leadNameOf(record({
      lead_display: { name: "Stale Name", job_no: null, source_company: null },
      lead_attachment: { state: "attached", certainty: "exact", lead_display: { name: "Attached Name", job_no: "1" } },
    })),
    "Attached Name · Job 1",
  );
});
