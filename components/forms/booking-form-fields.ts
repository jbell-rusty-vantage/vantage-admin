export type PreciseBookingLeadType = "FormLead" | "CallLead" | "Referral" | "Leadless";
export type PreciseBookingMode = "source" | "referral" | "leadless";

export function getPreciseBookingFormMissingFields(input: {
  bookDate: string;
  agent: string;
  merchant: string;
  binderAmount: string;
  depositAmount: string;
  jobNo: string;
  customerName: string;
  sourceCompany: string;
  formLeadId: string;
  mode: PreciseBookingMode;
  leadType: PreciseBookingLeadType;
}): string[] {
  return [
    !input.bookDate ? "book date" : null,
    !input.agent ? "primary agent" : null,
    !input.merchant ? "merchant" : null,
    !input.binderAmount ? "binder amount" : null,
    !input.depositAmount ? "deposit amount" : null,
    !input.jobNo ? "job number" : null,
    input.mode === "referral" && !input.customerName ? "customer name" : null,
    input.mode === "leadless" && !input.sourceCompany ? "source company" : null,
    input.mode === "source" && input.leadType === "FormLead" && !input.formLeadId
      ? "form lead Mongo ID"
      : null,
  ].filter((field): field is string => Boolean(field));
}

export function readOwnerCreateReconciliationCaseId(data: unknown): string | undefined {
  if (!data || typeof data !== "object") {
    return undefined;
  }
  const id = (data as { reconciliation_case_id?: unknown }).reconciliation_case_id;
  return typeof id === "string" && id.trim() ? id.trim() : undefined;
}
