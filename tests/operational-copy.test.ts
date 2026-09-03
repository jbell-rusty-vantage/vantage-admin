import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  duplicateReadOnlyBannerCopy,
  OPERATIONAL_COPY,
  sheetContainsIdleHint,
} from "../components/operational/operational-copy";

test("duplicate read-only banner copy is resource-aware", () => {
  assert.match(OPERATIONAL_COPY.duplicateReadOnlyBanner.formLeads, /Duplicate Form Leads/);
  assert.match(OPERATIONAL_COPY.duplicateReadOnlyBanner.callLeads, /Duplicate Call Leads/);
  assert.doesNotMatch(
    OPERATIONAL_COPY.duplicateReadOnlyBanner.callLeads,
    /Duplicate form leads|Duplicate Form Leads/,
  );
  assert.equal(
    duplicateReadOnlyBannerCopy("duplicate-form-leads"),
    OPERATIONAL_COPY.duplicateReadOnlyBanner.formLeads,
  );
  assert.equal(
    duplicateReadOnlyBannerCopy("duplicate-call-leads"),
    OPERATIONAL_COPY.duplicateReadOnlyBanner.callLeads,
  );

  const page = readFileSync(
    path.join(process.cwd(), "components/operational/operational-resource-page.tsx"),
    "utf8",
  );
  assert.match(page, /duplicateReadOnlyBannerCopy/);
  assert.doesNotMatch(page, /Duplicate form leads are read-only/);
  assert.doesNotMatch(page, /"Duplicate Form Leads are read-only/);
});

test("sheet contains idle hint tells the owner to select a record first", () => {
  assert.match(sheetContainsIdleHint("form-leads"), /checkboxes to select a lead/);
  assert.match(sheetContainsIdleHint("duplicate-form-leads"), /checkboxes to select a lead/);
  assert.match(sheetContainsIdleHint("call-leads"), /checkboxes to select a lead/);
  assert.match(sheetContainsIdleHint("duplicate-call-leads"), /checkboxes to select a lead/);
  assert.match(sheetContainsIdleHint("bookings"), /checkboxes to select a booking/);
  assert.match(sheetContainsIdleHint("cancellations"), /checkboxes to select a cancellation/);
  assert.match(OPERATIONAL_COPY.sheetContains.hintReady, /in the Google Sheet/);
  assert.match(OPERATIONAL_COPY.sheetContains.action, /Check Google Sheet contains/);

  const page = readFileSync(
    path.join(process.cwd(), "components/operational/operational-resource-page.tsx"),
    "utf8",
  );
  assert.match(page, /sheetContainsIdleHint/);
  assert.match(page, /selectedCount === 0/);
});
