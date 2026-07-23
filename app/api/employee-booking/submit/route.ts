import { ZodError } from "zod";
import { NextRequest, NextResponse } from "next/server";
import {
  employeeBookingSubmitBodySchema,
  employeeBookingSubmitResponseSchema,
  type EmployeeBookingSubmitResponse,
} from "@/lib/api/employeeBooking";
import { getServerEnv } from "@/lib/env/server";
import {
  EMPLOYEE_BOOKING_NONCE_COOKIE,
  byteLength,
  hashEmployeeBookingClientKey,
  isAllowedEmployeeBookingOrigin,
  issueEmployeeBookingNonce,
  readForwardedIp,
  setEmployeeBookingNonceCookie,
} from "@/server/employee-booking/public";
import { VantageApiError } from "@/server/vantage-api/errors";
import { requestEmployeeBookingApi } from "@/server/vantage-api/employee-booking";

function featureDisabled() {
  return NextResponse.json({ error: "Not found." }, { status: 404 });
}

function reject(status: number, error: string, issues?: Array<{ field: string; message: string }>) {
  return NextResponse.json({ error, issues }, { status });
}

function sanitizeIssues(error: ZodError) {
  return error.issues.map((issue) => ({
    field: issue.path.join(".") || "request",
    message: issue.message,
  }));
}

function sanitizeBackendIssues(issues: unknown) {
  if (!Array.isArray(issues)) {
    return undefined;
  }
  return issues.flatMap((issue) => {
    if (typeof issue !== "object" || issue === null || !("message" in issue)) {
      return [];
    }
    const path =
      "path" in issue && Array.isArray(issue.path)
        ? issue.path.map(String).join(".")
        : "request";
    return [{ field: path || "request", message: String(issue.message) }];
  });
}

function backendErrorResponse(error: unknown) {
  if (error instanceof VantageApiError) {
    switch (error.status) {
      case 400:
        return reject(
          400,
          "Check the booking details and try again.",
          sanitizeBackendIssues(error.issues),
        );
      case 409:
        return reject(409, "That job number is already booked.");
      case 429:
        return reject(429, "Too many attempts. Please wait and try again.");
      case 503:
        return reject(503, "Booking service unavailable. Please try again shortly.");
      default:
        return reject(error.status >= 500 ? 503 : error.status, "Booking request failed.");
    }
  }

  return reject(503, "Booking service unavailable. Please try again shortly.");
}

export async function POST(request: NextRequest) {
  const {
    EMPLOYEE_BOOKING_PUBLIC_ENABLED,
    EMPLOYEE_BOOKING_PUBLIC_BODY_LIMIT_BYTES,
    VANTAGE_API_SECRET,
  } = getServerEnv();
  if (!EMPLOYEE_BOOKING_PUBLIC_ENABLED) {
    return featureDisabled();
  }

  if (!isAllowedEmployeeBookingOrigin(request.url, request.headers.get("origin"))) {
    return reject(403, "This booking form can only be submitted from this site.");
  }

  const cookieNonce = request.cookies.get(EMPLOYEE_BOOKING_NONCE_COOKIE)?.value;
  if (!cookieNonce) {
    return reject(403, "Refresh the form and try again.");
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > EMPLOYEE_BOOKING_PUBLIC_BODY_LIMIT_BYTES) {
    return reject(413, "Submission too large.");
  }

  try {
    const rawBody = await request.text();
    if (byteLength(rawBody) > EMPLOYEE_BOOKING_PUBLIC_BODY_LIMIT_BYTES) {
      return reject(413, "Submission too large.");
    }

    const parsedBody = rawBody.length > 0 ? JSON.parse(rawBody) : {};
    const submission = employeeBookingSubmitBodySchema.parse(parsedBody);

    if (submission.company_fax) {
      return reject(400, "Booking could not be submitted.");
    }

    if (submission.submission_nonce !== cookieNonce) {
      return reject(403, "Refresh the form and try again.");
    }

    if (submission.split_agent && submission.split_agent === submission.agent) {
      return reject(400, "Primary and secondary agents must be different.", [
        { field: "split_agent", message: "Primary and secondary agents must be different." },
      ]);
    }

    const forwardedHeaders = new Headers({
      accept: "application/json",
      "x-public-client-key-hash": hashEmployeeBookingClientKey({
        ipAddress: readForwardedIp(request.headers),
        secret: VANTAGE_API_SECRET,
      }),
    });

    const response = await requestEmployeeBookingApi<
      Omit<EmployeeBookingSubmitResponse, "submission_nonce">
    >("api/v1/employee-booking-submissions", {
      method: "POST",
      headers: forwardedHeaders,
      body: {
        submission_id: submission.submission_id,
        lead_source_company_id: submission.lead_source_company_id,
        source_granularity_key: submission.source_granularity_key,
        agent: submission.agent,
        split_agent: submission.split_agent,
        lead_name: submission.lead_name,
        binder_amount: submission.binder_amount,
        deposit_amount: submission.deposit_amount,
        merchant: submission.merchant,
        phone_number: submission.phone_number,
        email: submission.email,
        lid: submission.lid,
        job_no: submission.job_no,
      },
    });

    if (response.kind !== "json") {
      throw new Error("Unexpected employee booking submit response.");
    }

    const nextNonce = issueEmployeeBookingNonce();
    const payload = employeeBookingSubmitResponseSchema.parse({
      ...response.data,
      submission_nonce: nextNonce,
    });

    const submitResponse = NextResponse.json(payload, {
      status: response.status,
    });
    setEmployeeBookingNonceCookie(submitResponse, nextNonce, request.url);
    return submitResponse;
  } catch (error) {
    if (error instanceof SyntaxError) {
      return reject(400, "Invalid request body.");
    }
    if (error instanceof ZodError) {
      return reject(400, "Check the highlighted fields and try again.", sanitizeIssues(error));
    }
    return backendErrorResponse(error);
  }
}
