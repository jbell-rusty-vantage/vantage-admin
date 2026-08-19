"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedbackMessage } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createGranotReferralBooking,
  GranotLifecycleApiError,
  type CreateReferralBookingBody,
  type GranotLifecycleCaseDetail,
} from "@/lib/api/granotLifecycle";
import { useCatalogOptions } from "@/lib/api/use-catalog-options";
import { invalidateGranotLifecycleCommandViews } from "@/lib/query/granotLifecycle";

type AllocationDraft = { agentId: string; binderAmount: string };
const MONEY = /^\d+(?:\.\d{1,2})?$/;
const parseMoney = (value: string) => MONEY.test(value) ? Number(value) : undefined;

export function ReferralBookingForm({ detail }: { detail: GranotLifecycleCaseDetail }) {
  const queryClient = useQueryClient();
  const catalog = useCatalogOptions();
  const [bookDate, setBookDate] = useState("");
  const [deposit, setDeposit] = useState("");
  const [totalBinder, setTotalBinder] = useState("");
  const [merchantId, setMerchantId] = useState("");
  const [allocations, setAllocations] = useState<AllocationDraft[]>([{ agentId: "", binderAmount: "" }]);
  const [reviewing, setReviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string>();
  const lastAttempt = useRef<{ canonical: string; key: string } | undefined>(undefined);
  const errorSummary = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (errors.length) errorSummary.current?.focus();
  }, [errors]);

  const buildBody = (): CreateReferralBookingBody | undefined => {
    const nextErrors: string[] = [];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(bookDate)) nextErrors.push("Enter a valid Book Date.");
    const depositAmount = parseMoney(deposit);
    const totalBinderAmount = parseMoney(totalBinder);
    if (depositAmount === undefined) nextErrors.push("Deposit must be a nonnegative amount with no more than two decimals.");
    if (totalBinderAmount === undefined) nextErrors.push("Binder total must be a nonnegative amount with no more than two decimals.");
    if (!merchantId) nextErrors.push("Select an active Merchant.");
    const parsedAllocations = allocations.map((row, index) => {
      const amount = parseMoney(row.binderAmount);
      if (!row.agentId) nextErrors.push(`Select an active Agent for allocation ${index + 1}.`);
      if (amount === undefined) nextErrors.push(`Allocation ${index + 1} needs an exact nonnegative amount.`);
      return { agent_id: row.agentId, binder_amount: amount ?? 0 };
    });
    const selectedIds = allocations.map((row) => row.agentId).filter(Boolean);
    if (new Set(selectedIds).size !== selectedIds.length) nextErrors.push("Each Agent may be allocated only once.");
    const cents = (value: number) => Math.round(value * 100);
    if (totalBinderAmount !== undefined &&
        parsedAllocations.reduce((sum, row) => sum + cents(row.binder_amount), 0) !== cents(totalBinderAmount)) {
      nextErrors.push("Agent allocation amounts must equal the Binder total exactly.");
    }
    setErrors(nextErrors);
    if (nextErrors.length || depositAmount === undefined || totalBinderAmount === undefined) return undefined;
    return {
      expected_case_revision: detail.case_revision,
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
      const result = await createGranotReferralBooking(detail.case_id, body, attempt.key);
      if (!result.booking_ref) throw new Error("Referral command response omitted the Booking reference.");
      lastAttempt.current = undefined;
      setReviewing(false);
      setNotice(result.outcome === "referral_booking_created"
        ? "Referral Booking created successfully."
        : "The current official Referral Booking already satisfied this case.");
      await invalidateGranotLifecycleCommandViews(queryClient, {
        caseId: detail.case_id,
        jobNo: detail.normalized_job_no,
        bookingId: result.booking_ref.id,
      });
    } catch (error) {
      if (error instanceof GranotLifecycleApiError && error.status === 409) {
        setErrors([`The case, link, or Booking changed (${error.code ?? "conflict"}). Current facts were refreshed; your official entries were preserved. Review and submit again.`]);
        await invalidateGranotLifecycleCommandViews(queryClient, {
          caseId: detail.case_id,
          jobNo: detail.normalized_job_no,
        });
      } else {
        setErrors([error instanceof Error ? error.message : "Unable to create Referral Booking."]);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Referral Booking</CardTitle>
        <CardDescription>Owner command. Job and contact come from immutable accepted evidence; every official field below starts blank.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {notice ? <FeedbackMessage>{notice}</FeedbackMessage> : null}
        {errors.length ? <div ref={errorSummary} role="alert" tabIndex={-1} className="rounded-md border border-destructive p-3"><strong>Correct the following:</strong><ul className="mt-2 list-disc pl-5">{errors.map((error) => <li key={error}>{error}</li>)}</ul></div> : null}
        <FeedbackMessage tone="warning">No Lead will be searched, selected, created, or attached. Granot evidence does not default official values.</FeedbackMessage>
        <fieldset className="grid gap-4 md:grid-cols-3" disabled={reviewing || submitting}>
          <legend className="mb-3 font-semibold">Blank official Booking details</legend>
          <div><Label htmlFor="referral-book-date">Book Date</Label><Input id="referral-book-date" type="date" value={bookDate} onChange={(event) => setBookDate(event.target.value)} /></div>
          <div><Label htmlFor="referral-deposit">Deposit Amount</Label><Input id="referral-deposit" inputMode="decimal" value={deposit} onChange={(event) => setDeposit(event.target.value)} /></div>
          <div><Label htmlFor="referral-binder-total">Total Binder Amount</Label><Input id="referral-binder-total" inputMode="decimal" value={totalBinder} onChange={(event) => setTotalBinder(event.target.value)} /></div>
          <div><Label htmlFor="referral-merchant">Active Merchant</Label><select id="referral-merchant" className="h-10 w-full rounded-md border px-3" value={merchantId} onChange={(event) => setMerchantId(event.target.value)}><option value="">Select Merchant</option>{catalog.merchants.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
        </fieldset>
        <fieldset className="space-y-3" disabled={reviewing || submitting}>
          <legend className="font-semibold">Agent allocations</legend>
          {allocations.map((row, index) => <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]" key={index}><div><Label htmlFor={`referral-agent-${index}`}>Active Agent {index + 1}</Label><select id={`referral-agent-${index}`} className="h-10 w-full rounded-md border px-3" value={row.agentId} onChange={(event) => setAllocations((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, agentId: event.target.value } : item))}><option value="">Select Agent</option>{catalog.agents.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div><div><Label htmlFor={`referral-binder-${index}`}>Binder Amount {index + 1}</Label><Input id={`referral-binder-${index}`} inputMode="decimal" value={row.binderAmount} onChange={(event) => setAllocations((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, binderAmount: event.target.value } : item))} /></div>{allocations.length > 1 ? <Button type="button" variant="outline" className="self-end" onClick={() => setAllocations((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove</Button> : null}</div>)}
          {allocations.length < 20 ? <Button type="button" variant="outline" onClick={() => setAllocations((current) => [...current, { agentId: "", binderAmount: "" }])}>Add Agent</Button> : null}
        </fieldset>
        {reviewing ? <section aria-labelledby="referral-booking-review" className="rounded-md border p-4"><h3 id="referral-booking-review" className="font-semibold">Review official Referral Booking</h3><p className="mt-2 text-sm">Job: {detail.job_no}</p><p className="text-sm">Book Date: {bookDate} · Deposit: {deposit} · Binder: {totalBinder}</p><p className="text-sm">Case revision: {detail.case_revision}</p></section> : null}
        <div className="flex gap-2">{reviewing ? <Button type="button" variant="outline" onClick={() => setReviewing(false)} disabled={submitting}>Back to edit</Button> : null}<Button type="button" disabled={submitting || catalog.isLoading} onClick={() => reviewing ? void submit() : setReviewing(Boolean(buildBody()))}>{reviewing ? (submitting ? "Creating…" : "Create Booking") : "Review Booking"}</Button></div>
      </CardContent>
    </Card>
  );
}
