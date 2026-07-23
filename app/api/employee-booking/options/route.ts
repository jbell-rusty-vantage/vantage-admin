import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { employeeBookingOptionsResponseSchema } from "@/lib/api/employeeBooking";
import { getServerEnv } from "@/lib/env/server";
import {
  issueEmployeeBookingNonce,
  setEmployeeBookingNonceCookie,
} from "@/server/employee-booking/public";
import { requestEmployeeBookingApi } from "@/server/vantage-api/employee-booking";

const catalogListSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      _id: z.string(),
      name: z.string(),
      active: z.boolean(),
    }),
  ),
});

const sourceCompaniesSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      _id: z.string(),
      owner_label: z.string(),
      active: z.boolean(),
      granularities: z.array(
        z.object({
          id: z.string(),
          _id: z.string(),
          granularity_key: z.string(),
          owner_label: z.string(),
          crm_label: z.string(),
          channel: z.enum(["form", "call"]),
          active: z.boolean(),
        }),
      ),
    }),
  ),
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
    const [sourceCompaniesResponse, agentsResponse, merchantsResponse] = await Promise.all([
      requestEmployeeBookingApi("api/v1/admin/source-companies"),
      requestEmployeeBookingApi("api/v1/admin/catalog/agents"),
      requestEmployeeBookingApi("api/v1/admin/catalog/merchants"),
    ]);

    if (
      sourceCompaniesResponse.kind !== "json" ||
      agentsResponse.kind !== "json" ||
      merchantsResponse.kind !== "json"
    ) {
      throw new Error("Unexpected employee booking options response.");
    }

    const sourceCompanies = sourceCompaniesSchema.parse(sourceCompaniesResponse.data);
    const agents = catalogListSchema.parse(agentsResponse.data);
    const merchants = catalogListSchema.parse(merchantsResponse.data);
    const nonce = issueEmployeeBookingNonce();

    const payload = employeeBookingOptionsResponseSchema.parse({
      submission_nonce: nonce,
      lead_sources: sourceCompanies.items
        .filter((company) => company.active)
        .flatMap((company) =>
          company.granularities
            .filter((granularity) => granularity.active)
            .map((granularity) => ({
              company_id: company.id,
              company_label: company.owner_label,
              granularity_id: granularity.id,
              granularity_key: granularity.granularity_key,
              granularity_label: granularity.owner_label,
              crm_label: granularity.crm_label,
              channel: granularity.channel,
            })),
        )
        .sort((left, right) =>
          `${left.company_label} ${left.granularity_label}`.localeCompare(
            `${right.company_label} ${right.granularity_label}`,
          ),
        ),
      agents: agents.items
        .filter((item) => item.active)
        .map((item) => ({ value: item.name, label: item.name }))
        .sort((left, right) => left.label.localeCompare(right.label)),
      merchants: merchants.items
        .filter((item) => item.active)
        .map((item) => ({ value: item.name, label: item.name }))
        .sort((left, right) => left.label.localeCompare(right.label)),
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
