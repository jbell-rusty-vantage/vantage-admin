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

function today() {
  return new Date().toISOString().slice(0, 10);
}

function asNumber(value: FormDataEntryValue | null): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function BookingForm() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [leadType, setLeadType] = useState<LeadType>(
    searchParams.get("lead_type") === "CallLead" ? "CallLead" : "FormLead",
  );
  const [message, setMessage] = useState<string | null>(null);
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
      setMessage("Booking created. The backend handled booking rules and sheet sync side effects.");
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : "Booking failed."),
  });
  const initial = useMemo(
    () => ({
      form_lead_id: searchParams.get("lead_id") ?? "",
      job_no: searchParams.get("job_hint") ?? "",
      call_job_no: searchParams.get("call_job_no") ?? "",
      call_phone_number: searchParams.get("call_phone_number") ?? "",
    }),
    [searchParams],
  );

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const binder = asNumber(formData.get("binder_amount"));
        const splitAgent = String(formData.get("split_agent") ?? "").trim();
        const base = {
          lead_type: leadType,
          book_date: String(formData.get("book_date") ?? ""),
          agent: String(formData.get("agent") ?? ""),
          split_agent: splitAgent || undefined,
          binder_amount: binder,
          deposit_amount: asNumber(formData.get("deposit_amount")),
          merchant: String(formData.get("merchant") ?? ""),
          source_company: String(formData.get("source_company") ?? "") || undefined,
        };
        const payload =
          leadType === "FormLead"
            ? {
                ...base,
                form_lead_id: String(formData.get("form_lead_id") ?? "").trim(),
                job_no: String(formData.get("job_no") ?? "").trim(),
              }
            : {
                ...base,
                call_job_no: String(formData.get("call_job_no") ?? "").trim() || undefined,
                call_phone_number: String(formData.get("call_phone_number") ?? "").trim() || undefined,
              };

        setMessage(null);
        mutation.mutate(payload);
      }}
    >
      {message ? <FeedbackMessage tone={mutation.isError ? "error" : "success"}>{message}</FeedbackMessage> : null}

      <section className="rounded-lg border bg-background p-4">
        <h2 className="text-sm font-semibold">1. Lead Source</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Start from a selected lead or fill this in globally. Form leads use Mongo ID plus job number; call leads use job number or phone.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <FilterField label="Lead type">
            <SelectFilter
              value={leadType}
              options={[
                { value: "FormLead", label: "Form Lead" },
                { value: "CallLead", label: "Call Lead" },
              ]}
              onChange={(value) => setLeadType(value === "CallLead" ? "CallLead" : "FormLead")}
            />
          </FilterField>
          {leadType === "FormLead" ? (
            <>
              <FilterField label="Form lead Mongo ID">
                <Input name="form_lead_id" defaultValue={initial.form_lead_id} required />
              </FilterField>
              <FilterField label="Job number">
                <Input name="job_no" defaultValue={initial.job_no} required />
              </FilterField>
            </>
          ) : (
            <>
              <FilterField label="Call job number">
                <Input name="call_job_no" defaultValue={initial.call_job_no} />
              </FilterField>
              <FilterField label="Call phone number">
                <Input name="call_phone_number" defaultValue={initial.call_phone_number} />
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
