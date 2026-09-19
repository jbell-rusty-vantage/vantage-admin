import test from "node:test";
import assert from "node:assert/strict";
import { bandLabel, classificationLabel, contactTypeLabel, eligibilityLabel, formatAge, formatSuppliedAge, label, leadMatchSummary, reviewCauseLabel } from "../../components/sales-intelligence/lib/format";
import { copy } from "../../components/sales-intelligence/sales-intelligence-copy";

test("owner labels use design sentences for server attention codes", () => {
  assert.equal(label("promised_callback_overdue"), "Promised callback is overdue");
  assert.equal(label("no_call_yet"), "No call yet after form submission");
  assert.equal(label("followups_due"), "Follow-up is due");
  assert.equal(label("missing_responsibility"), "Open work nobody owns");
  assert.equal(reviewCauseLabel("missing_responsibility"), "Rep identity or action responsibility missing");
  assert.equal(reviewCauseLabel("identity"), "Identity unclear");
  assert.equal(reviewCauseLabel("restriction"), "Contact restriction");
  assert.equal(label("restriction"), "Calling paused");
  assert.equal(bandLabel(2), "No call yet after form submission");
  assert.equal(label("identity_review"), "Needs identity");
  assert.equal(label("company"), "Our number");
  assert.equal(label("allowed"), "Can contact");
  assert.equal(label("human_conversation"), "Spoke with customer");
  assert.equal(classificationLabel("unknown"), "Unclassified");
  assert.equal(eligibilityLabel("unknown"), "Contact status unknown");
  assert.equal(contactTypeLabel("unknown"), "Connected—contact unknown");
  assert.equal(label("text"), "Text the customer");
});

test("supplied ages format wall and staffed durations without inventing clocks", () => {
  assert.equal(formatAge(45_000), "under 1m");
  assert.equal(formatAge(12 * 60_000), "12m");
  assert.equal(formatAge(3 * 60 * 60_000), "3h");
  assert.equal(formatSuppliedAge(3 * 60 * 60_000, 30 * 60_000), "3h ago (30m staffed)");
  assert.equal(copy.page.views.attention, "Needs attention");
  assert.equal(copy.page.views.coverage, "Coverage");
  assert.equal(copy.coverage.budgetExhausted, "Analysis paused—budget reached. Call history, follow-ups, and Owner actions still work.");
  assert.equal(copy.fields.leadMatch, "Lead match");
  assert.equal(copy.filters.numbersTitle, "Filter numbers");
  assert.equal(copy.lead.noLead, "No lead on file");
  assert.equal(leadMatchSummary(0, 0), "No lead on file");
  assert.equal(leadMatchSummary(0, 1), "1 candidate");
  assert.equal(leadMatchSummary(2, 1), "2 attached · 1 candidate");
});
