import assert from "node:assert/strict";
import test from "node:test";
import {
  CALL_LEAD_SOURCE_LABEL_OPTIONS,
  FORM_LEAD_SOURCE_LABEL_OPTIONS,
  SOURCE_COMPANY_OPTIONS,
  SOURCE_LABEL_OPTIONS,
  getCallLeadSourceLabel,
  getFormLeadSourceLabel,
} from "./domain";

test("GetMovers appears in source company filter and selection options", () => {
  assert.deepEqual(
    SOURCE_COMPANY_OPTIONS.find((option) => option.value === "get_movers_leads"),
    { value: "get_movers_leads", label: "GetMovers Leads" },
  );
});

test("GetMovers form and call variants appear in lead source label options", () => {
  assert.deepEqual(
    FORM_LEAD_SOURCE_LABEL_OPTIONS.find((option) => option.value === "GetMovers Forms"),
    { value: "GetMovers Forms", label: "GetMovers Forms" },
  );
  assert.deepEqual(
    CALL_LEAD_SOURCE_LABEL_OPTIONS.find((option) => option.value === "GetMovers Inbounds"),
    { value: "GetMovers Inbounds", label: "GetMovers Inbounds" },
  );
  assert.ok(SOURCE_LABEL_OPTIONS.some((option) => option.value === "GetMovers Forms"));
  assert.ok(SOURCE_LABEL_OPTIONS.some((option) => option.value === "GetMovers Inbounds"));
});

test("GetMovers stored and legacy labels resolve to exact lead-type labels", () => {
  assert.equal(getFormLeadSourceLabel("get_movers_leads"), "GetMovers Forms");
  assert.equal(getCallLeadSourceLabel("get_movers_leads"), "GetMovers Inbounds");
  assert.equal(getFormLeadSourceLabel("Get Movers"), "GetMovers Forms");
  assert.equal(getCallLeadSourceLabel("Get Movers"), "GetMovers Inbounds");
});
