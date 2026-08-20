"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedbackMessage } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FilterField } from "@/components/filters/filter-field";
import {
  confirmGranotBooking,
  GranotLifecycleApiError,
  type ConfirmGranotBookingBody,
  type GranotLifecycleCandidateItem,
  type GranotLifecycleCaseDetail,
} from "@/lib/api/granotLifecycle";
import { useCatalogOptions } from "@/lib/api/use-catalog-options";
import { invalidateGranotLifecycleCommandViews } from "@/lib/query/granotLifecycle";
import { LeadCandidateBrowser } from "./lead-candidate-browser";

type AllocationDraft = { agentId: string; binderAmount: string };
const MONEY = /^\d+(?:\.\d{1,2})?$/;

function money(value: string): number | undefined {
  return MONEY.test(value) ? Number(value) : undefined;
}

export function BookingCommandForm({ detail }: { detail: GranotLifecycleCaseDetail }) {
  const queryClient = useQueryClient();
  const catalog = useCatalogOptions();
  const [selected, setSelected] = useState<GranotLifecycleCandidateItem>();
  const [bookDate, setBookDate] = useState("");
  const [deposit, setDeposit] = useState("");
  const [totalBinder, setTotalBinder] = useState("");
  const [merchantId, setMerchantId] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [allocations, setAllocations] = useState<AllocationDraft[]>([{ agentId: "", binderAmount: "" }]);
  const [reviewing, setReviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string>();
  const lastAttempt = useRef<{ canonical: string; key: string } | undefined>(undefined);
  const errorSummary = useRef<HTMLDivElement>(null);
  const agents = catalog.agents.filter((item) => item.active);
  const merchants = catalog.merchants.filter((item) => item.active);
  const selectedMerchant = merchants.find((item) => item.id === merchantId);
  const selectedAgents = allocations
    .map((row) => agents.find((item) => item.id === row.agentId)?.name ?? row.agentId)
    .filter(Boolean);

  useEffect(() => {
    if (errors.length) errorSummary.current?.focus();
  }, [errors]);

  const buildBody = (): ConfirmGranotBookingBody | undefined => {
    const nextErrors: string[] = [];
    if (!selected) nextErrors.push("Select one eligible Lead.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(bookDate)) nextErrors.push("Enter a valid Book Date.");
    const depositAmount = money(deposit);
    const totalBinderAmount = money(totalBinder);
    if (depositAmount === undefined) nextErrors.push("Deposit must be a nonnegative amount with no more than two decimals.");
    if (totalBinderAmount === undefined) nextErrors.push("Binder total must be a nonnegative amount with no more than two decimals.");
    if (!merchantId) nextErrors.push("Select an active Merchant.");
    const parsedAllocations = allocations.map((row, index) => {
      const amount = money(row.binderAmount);
      if (!row.agentId) nextErrors.push(`Select an active Agent for allocation ${index + 1}.`);
      if (amount === undefined) nextErrors.push(`Allocation ${index + 1} needs an exact nonnegative amount.`);
      return { agent_id: row.agentId, binder_amount: amount ?? 0 };
    });
    if (new Set(allocations.map((row) => row.agentId).filter(Boolean)).size !== allocations.filter((row) => row.agentId).length) {
      nextErrors.push("Each Agent may be allocated only once.");
    }
    const cents = (value: number) => Math.round(value * 100);
    if (totalBinderAmount !== undefined && parsedAllocations.reduce((sum, row) => sum + cents(row.binder_amount), 0) !== cents(totalBinderAmount)) {
      nextErrors.push("Agent allocation amounts must equal the Binder total exactly.");
    }
    if (selected?.requires_override_reason && (overrideReason.trim().length < 10 || overrideReason.trim().length > 500)) {
      nextErrors.push("Explain the out-of-scope selection in 10–500 characters.");
    }
    setErrors(nextErrors);
    if (nextErrors.length || !selected || depositAmount === undefined || totalBinderAmount === undefined) return undefined;
    return {
      expected_case_revision: detail.case_revision,
      selected_lead: { lead_model: selected.lead_ref.model, lead_id: selected.lead_ref.id },
      ...(selected.requires_override_reason ? { out_of_scope_override_reason: overrideReason.trim() } : {}),
      official_booking_details: {
        book_date: bookDate,
        agent_allocations: parsedAllocations,
        total_binder_amount: totalBinderAmount,
        deposit_amount: depositAmount,
        merchant_id: merchantId,
      },
    };
  };

  const submit = async () => {
    const body = buildBody();
    if (!body) return;
    const canonical = JSON.stringify(body);
    const attempt = lastAttempt.current?.canonical === canonical
      ? lastAttempt.current
      : { canonical, key: crypto.randomUUID() };
    lastAttempt.current = attempt;
    setSubmitting(true);
    setNotice(undefined);
    try {
      const result = await confirmGranotBooking(detail.case_id, body, attempt.key);
      if (!result.booking_ref) throw new Error("Booking command response omitted the created Booking reference.");
      lastAttempt.current = undefined;
      setReviewing(false);
      setNotice(result.outcome === "booking_created" ? "Booking created successfully." : "The current official Booking already satisfied this case.");
      await invalidateGranotLifecycleCommandViews(queryClient, {
        caseId: detail.case_id,
        jobNo: detail.normalized_job_no,
        lead: { model: body.selected_lead.lead_model, id: body.selected_lead.lead_id },
        previousLead: detail.record_link?.lead_ref?.model === "FormLead" || detail.record_link?.lead_ref?.model === "CallLead"
          ? { model: detail.record_link.lead_ref.model, id: detail.record_link.lead_ref.id }
          : undefined,
        bookingId: result.booking_ref.id,
      });
    } catch (error) {
      if (error instanceof GranotLifecycleApiError && error.status === 409) {
        setErrors([`The case, Lead, or Booking identity changed (${error.code ?? "conflict"}). Current facts were refreshed; your entries were preserved. Review and submit again.`]);
        await invalidateGranotLifecycleCommandViews(queryClient, {
          caseId: detail.case_id,
          jobNo: detail.normalized_job_no,
          lead: { model: body.selected_lead.lead_model, id: body.selected_lead.lead_id },
        });
      } else {
        setErrors([error instanceof Error ? error.message : "Unable to create Booking."]);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card id="finish-booking">
      <CardHeader>
        <CardTitle>Confirm Granot Booking</CardTitle>
        <CardDescription>
          Official booking form. Choose the matching lead, then enter binder, deposit, agents, and
          merchant from the same Operations Registry catalog as a normal booking. Official fields
          start blank and are never copied from Granot evidence.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {notice ? <FeedbackMessage>{notice}</FeedbackMessage> : null}
        {errors.length ? (
          <div ref={errorSummary} role="alert" tabIndex={-1} className="rounded-md border border-destructive p-3">
            <strong>Correct the following:</strong>
            <ul className="mt-2 list-disc pl-5">{errors.map((error) => <li key={error}>{error}</li>)}</ul>
          </div>
        ) : null}

        <section className="rounded-lg border bg-background p-4">
          <h2 className="text-sm font-semibold">1. Choose the matching lead</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick the Vantage lead for this job. The server may suggest one; you still have to select it.
          </p>
          {detail.suggestion ? (
            <FeedbackMessage className="mt-3">
              Server suggestion: {detail.suggestion.lead_ref.model} {detail.suggestion.lead_ref.id}
              {" · "}{detail.suggestion.confidence} confidence via {detail.suggestion.match_method}.
              Select that row below if it is the right lead.
            </FeedbackMessage>
          ) : null}
          <div className="mt-4">
            <LeadCandidateBrowser
              caseId={detail.case_id}
              selected={selected}
              onSelect={(item) => { setSelected(item); setReviewing(false); }}
              heading="Eligible Lead candidates"
              description="Select the matching lead. This is not official until you review the booking details below."
            />
          </div>
          {selected?.requires_override_reason ? (
            <div className="mt-4 space-y-1">
              <FeedbackMessage tone="warning">This Lead is outside the reviewed Source Scope. A reason is required.</FeedbackMessage>
              <Label htmlFor="granot-override-reason">Out-of-scope override reason</Label>
              <textarea
                id="granot-override-reason"
                className="min-h-24 w-full rounded-md border p-2"
                value={overrideReason}
                onChange={(event) => setOverrideReason(event.target.value)}
                maxLength={500}
              />
            </div>
          ) : null}
        </section>

        <section className="rounded-lg border bg-background p-4">
          <h2 className="text-sm font-semibold">2. Official booking details</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Same catalog as the manual booking form: active agents and merchants from Operations Registry.
            Agent binder amounts must add up to the total binder exactly.
          </p>
          <fieldset className="mt-4 grid gap-3 sm:grid-cols-2" disabled={reviewing || submitting}>
            <legend className="sr-only">Blank official Booking details</legend>
            <FilterField label="Book Date">
              <Input id="granot-book-date" type="date" value={bookDate} onChange={(event) => setBookDate(event.target.value)} />
            </FilterField>
            <FilterField label="Deposit Amount">
              <Input id="granot-deposit" inputMode="decimal" value={deposit} onChange={(event) => setDeposit(event.target.value)} />
            </FilterField>
            <FilterField label="Total Binder Amount">
              <Input id="granot-binder-total" inputMode="decimal" value={totalBinder} onChange={(event) => setTotalBinder(event.target.value)} />
            </FilterField>
            <FilterField label="Active Merchant">
              <select
                id="granot-merchant"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={merchantId}
                onChange={(event) => setMerchantId(event.target.value)}
              >
                <option value="">Choose merchant</option>
                {merchants.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </FilterField>
            {catalog.isLoading ? (
              <p className="text-sm text-muted-foreground sm:col-span-2">
                Loading active agents and merchants...
              </p>
            ) : null}
          </fieldset>
          <fieldset className="mt-4 space-y-3" disabled={reviewing || submitting}>
            <legend className="text-sm font-semibold">Agent allocations</legend>
            {allocations.map((row, index) => (
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]" key={index}>
                <FilterField label={`Active Agent ${index + 1}`}>
                  <select
                    id={`granot-agent-${index}`}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={row.agentId}
                    onChange={(event) => setAllocations((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, agentId: event.target.value } : item))}
                  >
                    <option value="">Choose agent</option>
                    {agents.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                </FilterField>
                <FilterField label={`Binder Amount ${index + 1}`}>
                  <Input
                    id={`granot-binder-${index}`}
                    inputMode="decimal"
                    value={row.binderAmount}
                    onChange={(event) => setAllocations((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, binderAmount: event.target.value } : item))}
                  />
                </FilterField>
                {allocations.length > 1 ? (
                  <Button type="button" variant="outline" className="self-end" onClick={() => setAllocations((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                    Remove
                  </Button>
                ) : null}
              </div>
            ))}
            {allocations.length < 20 ? (
              <Button type="button" variant="outline" onClick={() => setAllocations((current) => [...current, { agentId: "", binderAmount: "" }])}>
                Add Agent
              </Button>
            ) : null}
          </fieldset>
        </section>

        {reviewing ? (
          <section aria-labelledby="granot-booking-review" className="rounded-lg border bg-muted/40 p-4">
            <h3 id="granot-booking-review" className="font-semibold">Review official Booking</h3>
            <p className="mt-2 text-sm">Lead: {selected?.lead_ref.model} {selected?.lead_ref.id}</p>
            <p className="text-sm">Book Date: {bookDate} · Deposit: {deposit} · Binder: {totalBinder}</p>
            <p className="text-sm">Merchant: {selectedMerchant?.name ?? merchantId}</p>
            <p className="text-sm">Agents: {selectedAgents.join(", ") || "—"}</p>
            <p className="text-sm">Case revision: {detail.case_revision}</p>
          </section>
        ) : (
          <section className="rounded-lg border bg-muted/40 p-4 text-sm">
            Review before submitting: this creates the official Vantage booking for job {detail.job_no}.
            Granot estimate and payment numbers are not copied into these fields.
          </section>
        )}

        <div className="flex gap-2">
          {reviewing ? (
            <Button type="button" variant="outline" onClick={() => setReviewing(false)} disabled={submitting}>
              Back to edit
            </Button>
          ) : null}
          <Button
            type="button"
            disabled={submitting || catalog.isLoading}
            onClick={() => reviewing ? void submit() : setReviewing(Boolean(buildBody()))}
          >
            {reviewing ? (submitting ? "Creating…" : "Create Booking") : "Review Booking"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
