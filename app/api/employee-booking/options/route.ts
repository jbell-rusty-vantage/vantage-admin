import { NextRequest, NextResponse } from "next/server";
import {
  employeeBookingOptionsResponseSchema,
} from "@/lib/api/employeeBooking";
import { getServerEnv } from "@/lib/env/server";
import {
  issueEmployeeBookingNonce,
  setEmployeeBookingNonceCookie,
} from "@/server/employee-booking/public";
import { requestEmployeeBookingApi } from "@/server/vantage-api/employee-booking";

const employeeBookingRemoteOptionsSchema = employeeBookingOptionsResponseSchema.omit({
  submission_nonce: true,
});

function featureDisabled() {
  return NextResponse.json({ error: "Not found." }, { status: 404 });
}

export async function GET(_request: NextRequest) {
  const { EMPLOYEE_BOOKING_PUBLIC_ENABLED } = getServerEnv();
  if (!EMPLOYEE_BOOKING_PUBLIC_ENABLED) {
    return featureDisabled();
  }

  try {
    const optionsResponse = await requestEmployeeBookingApi(
      "api/v1/employee-booking-options",
    );

    if (optionsResponse.kind !== "json") {
      throw new Error("Unexpected employee booking options response.");
    }

    const remoteOptions = employeeBookingRemoteOptionsSchema.parse(optionsResponse.data);
    const nonce = issueEmployeeBookingNonce();
    const payload = employeeBookingOptionsResponseSchema.parse({
      submission_nonce: nonce,
      ...remoteOptions,
    });

    const response = NextResponse.json(payload, { status: 200 });
    setEmployeeBookingNonceCookie(response, nonce, _request.url);
    return response;
  } catch (error) {
    console.error("Failed to load employee booking options", error);
    return NextResponse.json(
      { error: "Unable to load booking options right now." },
      { status: 503 },
    );
  }
}
