"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedbackMessage } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    <Card>
      <CardHeader>
        <CardTitle>Confirm Granot Booking</CardTitle>
        <CardDescription>Owner command. Official fields start blank and are never copied from Granot evidence.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {notice ? <FeedbackMessage>{notice}</FeedbackMessage> : null}
        {errors.length ? <div role="alert" tabIndex={-1} className="rounded-md border border-destructive p-3"><strong>Correct the following:</strong><ul className="mt-2 list-disc pl-5">{errors.map((error) => <li key={error}>{error}</li>)}</ul></div> : null}
        <LeadCandidateBrowser caseId={detail.case_id} selected={selected} onSelect={(item) => { setSelected(item); setReviewing(false); }} />
        {selected?.requires_override_reason ? <div className="space-y-1"><FeedbackMessage tone="warning">This Lead is outside the reviewed Source Scope. A reason is required.</FeedbackMessage><Label htmlFor="granot-override-reason">Out-of-scope override reason</Label><textarea id="granot-override-reason" className="min-h-24 w-full rounded-md border p-2" value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} maxLength={500} /></div> : null}
        <fieldset className="grid gap-4 md:grid-cols-3" disabled={reviewing || submitting}>
          <legend className="mb-3 font-semibold">Blank official Booking details</legend>
          <div><Label htmlFor="granot-book-date">Book Date</Label><Input id="granot-book-date" type="date" value={bookDate} onChange={(event) => setBookDate(event.target.value)} /></div>
          <div><Label htmlFor="granot-deposit">Deposit Amount</Label><Input id="granot-deposit" inputMode="decimal" value={deposit} onChange={(event) => setDeposit(event.target.value)} /></div>
          <div><Label htmlFor="granot-binder-total">Total Binder Amount</Label><Input id="granot-binder-total" inputMode="decimal" value={totalBinder} onChange={(event) => setTotalBinder(event.target.value)} /></div>
          <div><Label htmlFor="granot-merchant">Active Merchant</Label><select id="granot-merchant" className="h-10 w-full rounded-md border px-3" value={merchantId} onChange={(event) => setMerchantId(event.target.value)}><option value="">Select Merchant</option>{catalog.merchants.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
        </fieldset>
        <fieldset className="space-y-3" disabled={reviewing || submitting}><legend className="font-semibold">Agent allocations</legend>{allocations.map((row, index) => <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]" key={index}><div><Label htmlFor={`granot-agent-${index}`}>Active Agent {index + 1}</Label><select id={`granot-agent-${index}`} className="h-10 w-full rounded-md border px-3" value={row.agentId} onChange={(event) => setAllocations((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, agentId: event.target.value } : item))}><option value="">Select Agent</option>{catalog.agents.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div><div><Label htmlFor={`granot-binder-${index}`}>Binder Amount {index + 1}</Label><Input id={`granot-binder-${index}`} inputMode="decimal" value={row.binderAmount} onChange={(event) => setAllocations((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, binderAmount: event.target.value } : item))} /></div>{allocations.length > 1 ? <Button type="button" variant="outline" className="self-end" onClick={() => setAllocations((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove</Button> : null}</div>)}{allocations.length < 20 ? <Button type="button" variant="outline" onClick={() => setAllocations((current) => [...current, { agentId: "", binderAmount: "" }])}>Add Agent</Button> : null}</fieldset>
        {reviewing ? <section aria-labelledby="granot-booking-review" className="rounded-md border p-4"><h3 id="granot-booking-review" className="font-semibold">Review official Booking</h3><p className="mt-2 text-sm">Lead: {selected?.lead_ref.model} {selected?.lead_ref.id}</p><p className="text-sm">Book Date: {bookDate} · Deposit: {deposit} · Binder: {totalBinder}</p><p className="text-sm">Case revision: {detail.case_revision}</p></section> : null}
        <div className="flex gap-2">{reviewing ? <Button type="button" variant="outline" onClick={() => setReviewing(false)} disabled={submitting}>Back to edit</Button> : null}<Button type="button" disabled={submitting || catalog.isLoading} onClick={() => reviewing ? void submit() : setReviewing(Boolean(buildBody()))}>{reviewing ? (submitting ? "Creating…" : "Create Booking") : "Review Booking"}</Button></div>
      </CardContent>
    </Card>
  );
}
