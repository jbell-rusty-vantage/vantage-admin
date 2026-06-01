"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { FilterField } from "@/components/filters/filter-field";
import { SelectFilter } from "@/components/filters/select-filter";
import { createBookingFromSource } from "@/lib/api/admin";
import { AGENT_OPTIONS, MERCHANT_OPTIONS, SOURCE_COMPANY_OPTIONS } from "@/lib/constants/domain";
import { queryKeys } from "@/lib/query/keys";

type LeadType = "FormLead" | "CallLead";
type FormMessage = {
  tone: "success" | "error" | "info";
  text: string;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function asNumber(value: FormDataEntryValue | null): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getString(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

export function BookingForm() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [leadType, setLeadType] = useState<LeadType>(
    searchParams.get("lead_type") === "CallLead" ? "CallLead" : "FormLead",
  );
  const [message, setMessage] = useState<FormMessage | null>(null);
  const mutation = useMutation({
    mutationFn: createBookingFromSource,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.lists.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.details.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.search.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.auditLog.all }),
      ]);
      setMessage({
        tone: "success",
        text: "Booking created. The backend handled booking rules and sheet sync side effects.",
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
        const jobNo = getString(formData, leadType === "FormLead" ? "job_no" : "call_job_no");
        const formLeadId = getString(formData, "form_lead_id");
        const callPhoneNumber = getString(formData, "call_phone_number");
        const missingFields = [
          !bookDate ? "book date" : null,
          !agent ? "primary agent" : null,
          !merchant ? "merchant" : null,
          !binderAmount ? "binder amount" : null,
          !depositAmount ? "deposit amount" : null,
          !jobNo ? "job number" : null,
          leadType === "FormLead" && !formLeadId ? "form lead Mongo ID" : null,
          leadType === "CallLead" && !callPhoneNumber ? "call lead phone number" : null,
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
        const base = {
          lead_type: leadType,
          book_date: bookDate,
          agent,
          split_agent: splitAgent || undefined,
          binder_amount: binder,
          deposit_amount: deposit,
          merchant,
          source_company: getString(formData, "source_company") || undefined,
        };
        const payload =
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

        setMessage(null);
        mutation.mutate(payload);
      }}
    >
      {message ? <FeedbackMessage tone={message.tone}>{message.text}</FeedbackMessage> : null}

      <section className="rounded-lg border bg-background p-4">
        <h2 className="text-sm font-semibold">1. Lead Source</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Start from a selected lead or fill this in globally. Selected form leads prefill only the Mongo ID; selected call leads prefill only the phone number. Job number is always entered manually.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <FilterField label="Lead type">
            <SelectFilter
              value={leadType}
              options={[
                { value: "FormLead", label: "Form Lead" },
                { value: "CallLead", label: "Call Lead" },
              ]}
              onChange={(value) => {
                setLeadType(value === "CallLead" ? "CallLead" : "FormLead");
                setMessage(null);
              }}
            />
          </FilterField>
          {leadType === "FormLead" ? (
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
              {AGENT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Split agent">
            <select name="split_agent" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="">No split</option>
              {AGENT_OPTIONS.map((option) => (
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
              {MERCHANT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Source company override">
            <select name="source_company" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="">No override</option>
              {SOURCE_COMPANY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FilterField>
        </div>
      </section>

      <section className="rounded-lg border bg-muted/40 p-4 text-sm">
        Review before submitting: the booking will be created through `vantage-main-server`, preserving existing validation and Google Sheets sync.
        Split agent entries use the backend `split_agent` field; the server applies the source-driven booking rules.
      </section>

      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? "Creating booking..." : "Create booking"}
      </Button>
    </form>
  );
}
