"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FilterField } from "@/components/filters/filter-field";
import { createCancellation } from "@/lib/api/admin";
import { CANCELLATION_REASON_OPTIONS } from "@/lib/constants/domain";
import { floridaCalendarDateInputValue } from "@/lib/floridaTime";
import { parseMoneyInput } from "@/lib/booking/parseMoneyInput";
import { queryKeys } from "@/lib/query/keys";

function today() {
  return floridaCalendarDateInputValue();
}

export function CancellationForm() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: createCancellation,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.lists.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.details.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.search.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.auditLog.all }),
      ]);
      setMessage("Cancellation created. The backend resolved the linked booking/lead and handled sheet sync.");
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : "Cancellation failed."),
  });

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const refundAmount = parseMoneyInput(String(formData.get("refund_amount") ?? ""));
        if (refundAmount === undefined) {
          setMessage("Refund amount must be a valid number. A leading $ is allowed.");
          return;
        }
        const payload = {
          booked_lead: String(formData.get("booked_lead") ?? "").trim() || undefined,
          lead_id: String(formData.get("lead_id") ?? "").trim() || undefined,
          cancel_date: String(formData.get("cancel_date") ?? "").trim() || undefined,
          refund_amount: refundAmount,
          reason: String(formData.get("reason") ?? "").trim() || undefined,
          cancelled_by: String(formData.get("cancelled_by") ?? "").trim() || undefined,
          notes: String(formData.get("notes") ?? "").trim() || undefined,
        };
        setMessage(null);
        mutation.mutate(payload);
      }}
    >
      {message ? <FeedbackMessage tone={mutation.isError ? "error" : "success"}>{message}</FeedbackMessage> : null}
      <section className="rounded-lg border bg-background p-4">
        <h2 className="text-sm font-semibold">1. Booking Or Lead To Cancel</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Prefer booking ID when starting from a booking. Use lead ID when cancelling from a booked form or call lead.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <FilterField label="Booking Mongo ID">
            <Input name="booked_lead" defaultValue={searchParams.get("booked_lead") ?? ""} />
          </FilterField>
          <FilterField label="Lead Mongo ID">
            <Input name="lead_id" defaultValue={searchParams.get("lead_id") ?? ""} />
          </FilterField>
        </div>
      </section>

      <section className="rounded-lg border bg-background p-4">
        <h2 className="text-sm font-semibold">2. Cancellation Details</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <FilterField label="Cancellation date">
            <Input name="cancel_date" type="date" defaultValue={today()} />
          </FilterField>
          <FilterField label="Refund amount">
            <Input name="refund_amount" inputMode="decimal" required />
          </FilterField>
          <FilterField label="Reason">
            <select name="reason" required className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="">Choose reason</option>
              {CANCELLATION_REASON_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Cancelled by">
            <Input name="cancelled_by" placeholder="Owner" />
          </FilterField>
          <FilterField label="Notes" className="sm:col-span-2">
            <Textarea name="notes" />
          </FilterField>
        </div>
      </section>

      <section className="rounded-lg border bg-muted/40 p-4 text-sm">
        Review before submitting: the cancellation will be created through `vantage-main-server`. The backend rejects missing identifiers and already-cancelled conflicts.
      </section>

      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? "Creating cancellation..." : "Create cancellation"}
      </Button>
    </form>
  );
}
