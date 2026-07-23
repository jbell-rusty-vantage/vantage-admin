import { z } from "zod";

export const EMPLOYEE_BOOKING_HONEYPOT_FIELD = "company_fax";
export const EMPLOYEE_BOOKING_NONCE_FIELD = "submission_nonce";

export const employeeBookingPublicOptionSchema = z.object({
  company_id: z.string().trim().min(1),
  company_label: z.string().trim().min(1),
  granularity_id: z.string().trim().min(1),
  granularity_key: z.string().trim().min(1),
  granularity_label: z.string().trim().min(1),
  crm_label: z.string().trim().min(1),
  channel: z.enum(["form", "call"]),
});

export const employeeBookingCatalogOptionSchema = z.object({
  value: z.string().trim().min(1),
  label: z.string().trim().min(1),
});

export const employeeBookingOptionsResponseSchema = z.object({
  submission_nonce: z.string().trim().min(1),
  lead_sources: z.array(employeeBookingPublicOptionSchema),
  agents: z.array(employeeBookingCatalogOptionSchema),
  merchants: z.array(employeeBookingCatalogOptionSchema),
});

const moneySchema = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z.coerce.number().finite().min(0),
);

export type EmployeeBookingRequestIssue = {
  field: string;
  message: string;
};

export class EmployeeBookingRequestError extends Error {
  readonly issues: EmployeeBookingRequestIssue[];

  constructor(message: string, issues: EmployeeBookingRequestIssue[] = []) {
    super(message);
    this.name = "EmployeeBookingRequestError";
    this.issues = issues;
  }
}

export const employeeBookingSubmitBodySchema = z
  .object({
    submission_id: z.string().uuid(),
    submission_nonce: z.string().trim().min(1),
    lead_source_company_id: z.string().trim().min(1),
    source_granularity_key: z.string().trim().min(1),
    agent: z.string().trim().min(1),
    split_agent: z.string().trim().optional().or(z.literal("")),
    lead_name: z.string().trim().min(1),
    binder_amount: moneySchema,
    deposit_amount: moneySchema,
    merchant: z.string().trim().min(1),
    phone_number: z.string().trim().min(1),
    email: z.string().trim().email().optional().or(z.literal("")),
    lid: z.string().trim().optional().or(z.literal("")),
    job_no: z.string().trim().min(1),
    company_fax: z.string().trim().max(0).optional().or(z.literal("")),
  })
  .strict()
  .transform((value) => ({
    ...value,
    split_agent: value.split_agent || undefined,
    email: value.email || undefined,
    lid: value.lid || undefined,
    company_fax: value.company_fax || "",
  }));

export const employeeBookingSubmitResponseSchema = z.object({
  outcome: z.enum(["booked_and_linked", "booked_pending_lead", "duplicate_submission"]),
  booking_id: z.string().trim().min(1),
  confirmation_code: z.string().trim().min(1),
  lead_connection: z.enum(["connected", "pending"]),
  submission_nonce: z.string().trim().min(1).optional(),
});

export type EmployeeBookingLeadSourceOption = z.infer<typeof employeeBookingPublicOptionSchema>;
export type EmployeeBookingCatalogOption = z.infer<typeof employeeBookingCatalogOptionSchema>;
export type EmployeeBookingOptionsResponse = z.infer<typeof employeeBookingOptionsResponseSchema>;
export type EmployeeBookingSubmitBody = z.input<typeof employeeBookingSubmitBodySchema>;
export type EmployeeBookingParsedSubmitBody = z.infer<typeof employeeBookingSubmitBodySchema>;
export type EmployeeBookingSubmitResponse = z.infer<typeof employeeBookingSubmitResponseSchema>;

export function employeeBookingSuccessSecondaryText(
  response: Pick<EmployeeBookingSubmitResponse, "outcome" | "lead_connection">,
): string {
  if (response.outcome === "duplicate_submission") {
    return "This submission was already received.";
  }
  return response.lead_connection === "connected"
    ? "Lead connected."
    : "Lead connection is pending owner review.";
}

async function requestJson<T>(
  url: string,
  init: RequestInit | undefined,
  schema: z.ZodType<T>,
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : `Request failed (${response.status}).`;
    const issues =
      payload && typeof payload === "object" && "issues" in payload && Array.isArray(payload.issues)
        ? payload.issues.filter(
            (issue): issue is EmployeeBookingRequestIssue =>
              typeof issue === "object" &&
              issue !== null &&
              "field" in issue &&
              typeof issue.field === "string" &&
              "message" in issue &&
              typeof issue.message === "string",
          )
        : [];
    throw new EmployeeBookingRequestError(message, issues);
  }

  return schema.parse(payload);
}

export function fetchEmployeeBookingOptions(): Promise<EmployeeBookingOptionsResponse> {
  return requestJson("/api/employee-booking/options", undefined, employeeBookingOptionsResponseSchema);
}

export function submitEmployeeBooking(
  body: EmployeeBookingSubmitBody,
): Promise<EmployeeBookingSubmitResponse> {
  return requestJson(
    "/api/employee-booking/submit",
    {
      method: "POST",
      body: JSON.stringify(body),
    },
    employeeBookingSubmitResponseSchema,
  );
}
