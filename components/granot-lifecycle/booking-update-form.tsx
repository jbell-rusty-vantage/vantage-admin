"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedbackMessage } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  GranotLifecycleApiError,
  updateGranotBooking,
  updateGranotReleaseBooking,
  type GranotLifecycleCaseDetail,
  type UpdateGranotBookingBody,
} from "@/lib/api/granotLifecycle";
import { useCatalogOptions } from "@/lib/api/use-catalog-options";
import { invalidateGranotLifecycleCommandViews } from "@/lib/query/granotLifecycle";

type AllocationDraft = { agentId: string; binderAmount: string };
const MONEY = /^\d+(?:\.\d{1,2})?$/;

function amount(value: string): number | undefined {
  return MONEY.test(value) ? Number(value) : undefined;
}

export function BookingUpdateForm({ detail, release = false }: { detail: GranotLifecycleCaseDetail; release?: boolean }) {
  const booking = detail.official_current.booking;
  const queryClient = useQueryClient();
  const catalog = useCatalogOptions();
  const [bookDate, setBookDate] = useState(() => booking?.book_date.slice(0, 10) ?? "");
  const [deposit, setDeposit] = useState(() => booking ? String(booking.deposit_amount) : "");
  const [totalBinder, setTotalBinder] = useState(() => booking ? String(booking.total_binder_amount) : "");
  const [merchantId, setMerchantId] = useState(() => booking?.merchant_id ?? "");
  const [allocations, setAllocations] = useState<AllocationDraft[]>(() =>
    booking?.agent_allocations.map((row) => ({ agentId: row.agent_id, binderAmount: String(row.binder_amount) })) ??
    [{ agentId: "", binderAmount: "" }],
  );
  const [reviewing, setReviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string>();
  const errorRef = useRef<HTMLDivElement>(null);
  const lastAttempt = useRef<{ canonical: string; key: string } | undefined>(undefined);

  useEffect(() => { if (errors.length) errorRef.current?.focus(); }, [errors]);

  if (!booking) return <FeedbackMessage tone="error">The deterministic live Booking is unavailable. Update is blocked.</FeedbackMessage>;

  const buildBody = (): UpdateGranotBookingBody | undefined => {
    const nextErrors: string[] = [];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(bookDate)) nextErrors.push("Enter a valid Book Date.");
    const depositAmount = amount(deposit);
    const binderTotal = amount(totalBinder);
    if (depositAmount === undefined) nextErrors.push("Deposit must be a nonnegative amount with no more than two decimals.");
    if (binderTotal === undefined) nextErrors.push("Binder total must be a nonnegative amount with no more than two decimals.");
    if (!merchantId) nextErrors.push("Select the active Merchant for this full replacement.");
    const parsed = allocations.map((row, index) => {
      const binder = amount(row.binderAmount);
      if (!row.agentId) nextErrors.push(`Select an active Agent for allocation ${index + 1}.`);
      if (binder === undefined) nextErrors.push(`Allocation ${index + 1} needs an exact nonnegative amount.`);
      return { agent_id: row.agentId, binder_amount: binder ?? 0 };
    });
    const ids = allocations.map((row) => row.agentId).filter(Boolean);
    if (new Set(ids).size !== ids.length) nextErrors.push("Each Agent may appear only once.");
    const cents = (value: number) => Math.round(value * 100);
    if (binderTotal !== undefined && parsed.reduce((sum, row) => sum + cents(row.binder_amount), 0) !== cents(binderTotal)) {
      nextErrors.push("Agent allocation amounts must equal the Binder total exactly.");
    }
    setErrors(nextErrors);
    if (nextErrors.length || depositAmount === undefined || binderTotal === undefined) return undefined;
    return {
      expected_case_revision: detail.case_revision,
      expected_booking_revision: booking.domain_revision,
      official_booking_details: {
        book_date: bookDate,
        agent_allocations: parsed,
        total_binder_amount: binderTotal,
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
      const result = await (release ? updateGranotReleaseBooking : updateGranotBooking)(detail.case_id, body, attempt.key);
      lastAttempt.current = undefined;
      setReviewing(false);
      setNotice(result.outcome === "booking_updated"
        ? "Booking updated successfully."
        : "The live official Booking already satisfied this case.");
      await invalidateGranotLifecycleCommandViews(queryClient, {
        caseId: detail.case_id,
        jobNo: detail.normalized_job_no,
        bookingId: booking.id,
        lead: booking.lead_ref?.model === "FormLead" || booking.lead_ref?.model === "CallLead"
          ? { model: booking.lead_ref.model, id: booking.lead_ref.id }
          : undefined,
      });
    } catch (error) {
      if (error instanceof GranotLifecycleApiError && error.status === 409) {
        setErrors([`The case, Booking revision, or identity changed (${error.code ?? "conflict"}). Current facts were refreshed; every unsent replacement value was preserved. Review and submit explicitly again.`]);
        await invalidateGranotLifecycleCommandViews(queryClient, {
          caseId: detail.case_id,
          jobNo: detail.normalized_job_no,
          bookingId: booking.id,
          lead: booking.lead_ref?.model === "FormLead" || booking.lead_ref?.model === "CallLead"
            ? { model: booking.lead_ref.model, id: booking.lead_ref.id }
            : undefined,
        });
      } else {
        setErrors([error instanceof Error ? error.message : "Unable to update Booking."]);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Update Existing Booking</CardTitle>
        <CardDescription>Full replacement initialized once from live official Vantage values—not Granot evidence.{release ? " This Release case remains authoritative only after explicit review." : ""}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {notice ? <FeedbackMessage>{notice}</FeedbackMessage> : null}
        {errors.length ? <div ref={errorRef} role="alert" tabIndex={-1} className="rounded-md border border-destructive p-3"><strong>Correct or review the following:</strong><ul className="mt-2 list-disc pl-5">{errors.map((error) => <li key={error}>{error}</li>)}</ul></div> : null}
        <fieldset className="grid gap-4 md:grid-cols-3" disabled={reviewing || submitting}>
          <legend className="mb-3 font-semibold">Complete official Booking replacement</legend>
          <div><Label htmlFor="granot-update-book-date">Book Date</Label><Input id="granot-update-book-date" type="date" value={bookDate} onChange={(event) => setBookDate(event.target.value)} /></div>
          <div><Label htmlFor="granot-update-deposit">Deposit Amount</Label><Input id="granot-update-deposit" inputMode="decimal" value={deposit} onChange={(event) => setDeposit(event.target.value)} /></div>
          <div><Label htmlFor="granot-update-binder-total">Total Binder Amount</Label><Input id="granot-update-binder-total" inputMode="decimal" value={totalBinder} onChange={(event) => setTotalBinder(event.target.value)} /></div>
          <div><Label htmlFor="granot-update-merchant">Active Merchant</Label><select id="granot-update-merchant" className="h-10 w-full rounded-md border px-3" value={merchantId} onChange={(event) => setMerchantId(event.target.value)}><option value="">Select Merchant</option>{catalog.merchants.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
        </fieldset>
        <fieldset className="space-y-3" disabled={reviewing || submitting}>
          <legend className="font-semibold">All Agent allocations</legend>
          {allocations.map((row, index) => <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]" key={index}><div><Label htmlFor={`granot-update-agent-${index}`}>Active Agent {index + 1}</Label><select id={`granot-update-agent-${index}`} className="h-10 w-full rounded-md border px-3" value={row.agentId} onChange={(event) => setAllocations((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, agentId: event.target.value } : item))}><option value="">Select Agent</option>{catalog.agents.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div><div><Label htmlFor={`granot-update-binder-${index}`}>Binder Amount {index + 1}</Label><Input id={`granot-update-binder-${index}`} inputMode="decimal" value={row.binderAmount} onChange={(event) => setAllocations((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, binderAmount: event.target.value } : item))} /></div>{allocations.length > 1 ? <Button type="button" variant="outline" className="self-end" onClick={() => setAllocations((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove</Button> : null}</div>)}
          {allocations.length < 20 ? <Button type="button" variant="outline" onClick={() => setAllocations((current) => [...current, { agentId: "", binderAmount: "" }])}>Add Agent</Button> : null}
        </fieldset>
        {reviewing ? <section aria-labelledby="granot-update-review" className="rounded-md border p-4"><h3 id="granot-update-review" className="font-semibold">Review complete Booking replacement</h3><p className="mt-2 text-sm">Book Date: {bookDate} · Deposit: {deposit} · Binder: {totalBinder}</p><p className="text-sm">Case revision: {detail.case_revision} · Booking revision: {booking.domain_revision}</p></section> : null}
        <div className="flex gap-2">{reviewing ? <Button type="button" variant="outline" onClick={() => setReviewing(false)} disabled={submitting}>Back to edit</Button> : null}<Button type="button" disabled={submitting || catalog.isLoading} onClick={() => reviewing ? void submit() : setReviewing(Boolean(buildBody()))}>{reviewing ? (submitting ? "Updating…" : "Update Booking") : "Review Booking Update"}</Button></div>
      </CardContent>
    </Card>
  );
}
