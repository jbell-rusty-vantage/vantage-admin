import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  duplicateReadOnlyBannerCopy,
  OPERATIONAL_COPY,
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
