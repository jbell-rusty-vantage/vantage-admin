"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { FilterField } from "@/components/filters/filter-field";
import { createReferralBooking } from "@/lib/api/admin";
import { AGENT_OPTIONS, LOCAL_TYPE_OPTIONS, MERCHANT_OPTIONS } from "@/lib/constants/domain";
import { queryKeys } from "@/lib/query/keys";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function asNumber(value: FormDataEntryValue | null): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function ReferralBookingForm() {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: createReferralBooking,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.lists.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.details.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.search.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.auditLog.all }),
      ]);
      setMessage("Referral booking created. The backend will sync it to the Master Booked Sheet.");
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : "Referral booking failed."),
  });

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const splitAgent = String(formData.get("split_agent") ?? "").trim();
        const local = String(formData.get("local") ?? "").trim();
        setMessage(null);
        mutation.mutate({
          book_date: String(formData.get("book_date") ?? ""),
          job_no: String(formData.get("job_no") ?? "").trim(),
          customer_name: String(formData.get("customer_name") ?? "").trim(),
          agent: String(formData.get("agent") ?? ""),
          split_agent: splitAgent || undefined,
          total_binder_amount: asNumber(formData.get("total_binder_amount")),
          deposit_amount: asNumber(formData.get("deposit_amount")),
          merchant: String(formData.get("merchant") ?? ""),
          local: local || undefined,
        });
      }}
    >
      {message ? <FeedbackMessage tone={mutation.isError ? "error" : "success"}>{message}</FeedbackMessage> : null}

      <section className="rounded-lg border bg-background p-4">
        <h2 className="text-sm font-semibold">Referral Booking</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a leadless booking with source `referral`. This writes only to the Master Booked Sheet.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <FilterField label="Book date">
            <Input name="book_date" type="date" defaultValue={today()} required />
          </FilterField>
          <FilterField label="Job number">
            <Input name="job_no" required />
          </FilterField>
          <FilterField label="Customer name">
            <Input name="customer_name" required />
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
          <FilterField label="Total binder amount">
            <Input name="total_binder_amount" type="number" step="0.01" min="0" required />
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
        </div>
      </section>

      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? "Creating referral booking..." : "Create referral booking"}
      </Button>
    </form>
  );
}
