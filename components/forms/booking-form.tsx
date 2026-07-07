"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { FilterField } from "@/components/filters/filter-field";
import { SelectFilter } from "@/components/filters/select-filter";
import { createBookingFromSource, createLeadlessBooking, createReferralBooking } from "@/lib/api/admin";
import {
  fetchLeadSourceCompanies,
  toLeadSourceCompanyOptions,
} from "@/lib/api/sourceCompanies";
import { useCatalogOptions } from "@/lib/api/use-catalog-options";
import {
  isReferralSourceCompany,
  LOCAL_TYPE_OPTIONS,
  REFERRAL_SOURCE_COMPANY,
  SOURCE_COMPANY_OPTIONS,
} from "@/lib/constants/domain";
import { floridaCalendarDateInputValue } from "@/lib/floridaTime";
import { queryKeys } from "@/lib/query/keys";

type LeadType = "FormLead" | "CallLead" | "Referral" | "Leadless";
type BookingMode = "source" | "referral" | "leadless";
type FormMessage = {
  tone: "success" | "error" | "info";
  text: string;
};

function today() {
  return floridaCalendarDateInputValue();
}

function asNumber(value: FormDataEntryValue | null): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getString(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function isReferralMode(leadType: LeadType, sourceCompany: string): boolean {
  return leadType === "Referral" || isReferralSourceCompany(sourceCompany);
}

function getBookingMode(leadType: LeadType, sourceCompany: string): BookingMode {
  if (leadType === "Leadless") {
    return "leadless";
  }
  if (isReferralMode(leadType, sourceCompany)) {
    return "referral";
  }
  return "source";
}

async function submitBooking(payload: Record<string, unknown>, mode: BookingMode) {
  if (mode === "referral") {
    return createReferralBooking(payload);
  }
  if (mode === "leadless") {
    return createLeadlessBooking(payload);
  }
  return createBookingFromSource(payload);
}

export function BookingForm() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [leadType, setLeadType] = useState<LeadType>(
    searchParams.get("lead_type") === "CallLead" ? "CallLead" : "FormLead",
  );
  const [sourceCompany, setSourceCompany] = useState("");
  const [message, setMessage] = useState<FormMessage | null>(null);
  const catalog = useCatalogOptions();
  const bookingMode = getBookingMode(leadType, sourceCompany);
  const referralMode = bookingMode === "referral";
  const leadlessMode = bookingMode === "leadless";
  const sourceCompaniesQuery = useQuery({
    queryKey: queryKeys.sourceCompanies.list(false),
    queryFn: () => fetchLeadSourceCompanies(),
    staleTime: 5 * 60 * 1000,
  });
  const sourceCompanyOptions = useMemo(
    () =>
      withReferralSourceOption(
        toLeadSourceCompanyOptions(sourceCompaniesQuery.data),
        SOURCE_COMPANY_OPTIONS,
      ),
    [sourceCompaniesQuery.data],
  );
  const mutation = useMutation({
    mutationFn: ({ payload, bookingMode: mode }: { payload: Record<string, unknown>; bookingMode: BookingMode }) =>
      submitBooking(payload, mode),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.lists.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.details.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.search.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.auditLog.all }),
      ]);
      setMessage({
        tone: "success",
        text:
          variables.bookingMode === "referral"
            ? "Referral booking created. The backend will sync it to the Master Booked Sheet."
            : variables.bookingMode === "leadless"
              ? "Leadless booking created. The backend will sync it to the Master Booked Sheet."
              : "Booking created. The backend handled booking rules and sheet sync side effects.",
      });
    },
    onError: (error) =>
      setMessage({
        tone: "error",
        text: error instanceof Error ? `Booking failed: ${error.message}` : "Booking failed. No booking was created.",
      }),
  });
  const initial = useMemo(
    () => ({
      form_lead_id: searchParams.get("lead_id") ?? "",
      call_phone_number: searchParams.get("call_phone_number") ?? "",
    }),
    [searchParams],
  );

  function handleLeadTypeChange(value: string) {
    const nextLeadType =
      value === "CallLead"
        ? "CallLead"
        : value === "Referral"
          ? "Referral"
          : value === "Leadless"
            ? "Leadless"
            : "FormLead";
    setLeadType(nextLeadType);
    if (nextLeadType === "Referral") {
      setSourceCompany(REFERRAL_SOURCE_COMPANY);
    } else if (isReferralSourceCompany(sourceCompany)) {
      setSourceCompany("");
    }
    setMessage(null);
  }

  function handleSourceCompanyChange(value: string) {
    setSourceCompany(value);
    if (isReferralSourceCompany(value)) {
      setLeadType("Referral");
    } else if (leadType === "Referral") {
      setLeadType("FormLead");
    }
    setMessage(null);
  }

  return (
    <form
      className="space-y-5"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const bookDate = getString(formData, "book_date");
        const agent = getString(formData, "agent");
        const merchant = getString(formData, "merchant");
        const binderAmount = getString(formData, "binder_amount");
        const depositAmount = getString(formData, "deposit_amount");
        const binder = asNumber(binderAmount);
        const deposit = asNumber(depositAmount);
        const customerName = getString(formData, "customer_name");
        const customerPhone = getString(formData, "customer_phone");
        const formLeadId = getString(formData, "form_lead_id");
        const callPhoneNumber = getString(formData, "call_phone_number");
        const sourceCompanyOverride = getString(formData, "source_company");
        const submissionMode = getBookingMode(leadType, sourceCompanyOverride);
        const isReferralSubmission = submissionMode === "referral";
        const isLeadlessSubmission = submissionMode === "leadless";
        const jobNo = isReferralSubmission || isLeadlessSubmission
          ? getString(formData, "job_no")
          : getString(formData, leadType === "FormLead" ? "job_no" : "call_job_no");
        const missingFields = [
          !bookDate ? "book date" : null,
          !agent ? "primary agent" : null,
          !merchant ? "merchant" : null,
          !binderAmount ? "binder amount" : null,
          !depositAmount ? "deposit amount" : null,
          !jobNo ? "job number" : null,
          isReferralSubmission && !customerName ? "customer name" : null,
          isLeadlessSubmission && !sourceCompanyOverride ? "source company" : null,
          submissionMode === "source" && leadType === "FormLead" && !formLeadId ? "form lead Mongo ID" : null,
          submissionMode === "source" && leadType === "CallLead" && !callPhoneNumber ? "call lead phone number" : null,
        ].filter(Boolean);

        if (missingFields.length > 0) {
          setMessage({
            tone: "error",
            text: `Please enter the required ${missingFields.join(", ")} before creating the booking.`,
          });
          return;
        }

        if (!Number.isFinite(Number(binderAmount)) || !Number.isFinite(Number(depositAmount))) {
          setMessage({
            tone: "error",
            text: "Binder and deposit amounts must be valid numbers.",
          });
          return;
        }

        if (binder < 0 || deposit < 0) {
          setMessage({
            tone: "error",
            text: "Binder and deposit amounts cannot be negative.",
          });
          return;
        }

        const splitAgent = getString(formData, "split_agent");
        const sharedBookingFields = {
          book_date: bookDate,
          agent,
          split_agent: splitAgent || undefined,
          deposit_amount: deposit,
          merchant,
        };

        let payload: Record<string, unknown>;
        if (isReferralSubmission) {
          const local = getString(formData, "local");
          payload = {
            ...sharedBookingFields,
            job_no: jobNo,
            customer_name: customerName,
            customer_phone: customerPhone || undefined,
            total_binder_amount: binder,
            local: local || undefined,
          };
        } else if (isLeadlessSubmission) {
          const local = getString(formData, "local");
          payload = {
            ...sharedBookingFields,
            job_no: jobNo,
            source_company: sourceCompanyOverride,
            customer_name: customerName || undefined,
            customer_phone: customerPhone || undefined,
            total_binder_amount: binder,
            local: local || undefined,
          };
        } else {
          const base = {
            lead_type: leadType,
            ...sharedBookingFields,
            binder_amount: binder,
            source_company: sourceCompanyOverride || undefined,
            customer_name: customerName || undefined,
            customer_phone: customerPhone || undefined,
          };
          payload =
            leadType === "FormLead"
              ? {
                  ...base,
                  form_lead_id: formLeadId,
                  job_no: jobNo,
                }
              : {
                  ...base,
                  call_job_no: jobNo,
                  call_phone_number: callPhoneNumber,
                };
        }

        setMessage(null);
        mutation.mutate({ payload, bookingMode: submissionMode });
      }}
    >
      {message ? <FeedbackMessage tone={message.tone}>{message.text}</FeedbackMessage> : null}

      <section className="rounded-lg border bg-background p-4">
        <h2 className="text-sm font-semibold">1. Lead Source</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Book from a form lead, call lead, referral, or leadless booking. Leadless bookings do not require a Mongo
          lead id and are created as standalone booked rows.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <FilterField label="Lead type">
            <SelectFilter
              value={leadType}
              options={[
                { value: "FormLead", label: "Form Lead" },
                { value: "CallLead", label: "Call Lead" },
                { value: "Referral", label: "Referral" },
                { value: "Leadless", label: "Leadless" },
              ]}
              onChange={handleLeadTypeChange}
            />
          </FilterField>
          <FilterField label="Source company">
            <select
              name="source_company"
              value={sourceCompany}
              required={leadlessMode}
              onChange={(event) => handleSourceCompanyChange(event.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">{leadlessMode ? "Choose source company" : "No override"}</option>
              {sourceCompanyOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FilterField>
          {referralMode || leadlessMode ? (
            <FilterField label="Job number">
              <Input name="job_no" required />
            </FilterField>
          ) : leadType === "FormLead" ? (
            <>
              <FilterField label="Form lead Mongo ID">
                <Input name="form_lead_id" defaultValue={initial.form_lead_id} required />
              </FilterField>
              <FilterField label="Job number">
                <Input name="job_no" required />
              </FilterField>
            </>
          ) : (
            <>
              <FilterField label="Call job number">
                <Input name="call_job_no" required />
              </FilterField>
              <FilterField label="Call phone number">
                <Input name="call_phone_number" defaultValue={initial.call_phone_number} required />
              </FilterField>
            </>
          )}
        </div>
      </section>

      <section className="rounded-lg border bg-background p-4">
        <h2 className="text-sm font-semibold">2. Booking Details</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <FilterField label="Book date">
            <Input name="book_date" type="date" defaultValue={today()} required />
          </FilterField>
          <FilterField label="Primary agent">
            <select name="agent" required className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" defaultValue="">
              <option value="">Choose agent</option>
              {catalog.agentOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Split agent">
            <select name="split_agent" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="">No split</option>
              {catalog.agentOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Binder amount">
            <Input name="binder_amount" type="number" step="0.01" min="0" required />
          </FilterField>
          <FilterField label="Deposit amount">
            <Input name="deposit_amount" type="number" step="0.01" min="0" required />
          </FilterField>
          <FilterField label="Merchant">
            <select name="merchant" required className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="">Choose merchant</option>
              {catalog.merchantOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FilterField>
          {catalog.isLoading ? (
            <p className="text-sm text-muted-foreground sm:col-span-2">
              Loading active agents and merchants...
            </p>
          ) : null}
          {referralMode || leadlessMode ? (
            <FilterField label="Local type">
              <select name="local" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">Leave blank</option>
                {LOCAL_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FilterField>
          ) : null}
        </div>
      </section>

      <section className="rounded-lg border bg-background p-4">
        <h2 className="text-sm font-semibold">3. Customer</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {referralMode
            ? "Customer name is required for referral bookings. Phone is optional and used for customer upsert when provided."
            : leadlessMode
              ? "Optional customer contact for the standalone booking. When a customer name is provided, the backend upserts and links the customer record."
            : "Optional customer contact overrides. When a customer name is provided, the backend upserts and links the customer record."}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <FilterField label="Customer name">
            <Input name="customer_name" required={referralMode} />
          </FilterField>
          <FilterField label="Customer phone">
            <Input name="customer_phone" type="tel" />
          </FilterField>
        </div>
      </section>

      <section className="rounded-lg border bg-muted/40 p-4 text-sm">
        Review before submitting: the booking will be created through `vantage-main-server`, preserving existing
        validation and Google Sheets sync. Referral and leadless bookings write to the Master Booked Sheet without a
        linked lead.
      </section>

      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending
          ? referralMode
            ? "Creating referral booking..."
            : leadlessMode
              ? "Creating leadless booking..."
              : "Creating booking..."
          : referralMode
            ? "Create referral booking"
            : leadlessMode
              ? "Create leadless booking"
              : "Create booking"}
      </Button>
    </form>
  );
}

function withReferralSourceOption<TOption extends { value: string; label: string }>(
  preferred: TOption[],
  fallback: readonly TOption[],
): readonly TOption[] {
  const options = preferred.length > 0 ? [...preferred] : [...fallback];
  const referralOption = SOURCE_COMPANY_OPTIONS.find((option) =>
    isReferralSourceCompany(option.value),
  );
  if (referralOption && !options.some((option) => isReferralSourceCompany(option.value))) {
    options.push(referralOption as TOption);
  }
  return options;
}
