"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedbackMessage } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  confirmGranotCancellation,
  GranotLifecycleApiError,
  type ConfirmGranotCancellationBody,
  type GranotLifecycleCaseDetail,
} from "@/lib/api/granotLifecycle";
import { invalidateGranotLifecycleCommandViews } from "@/lib/query/granotLifecycle";

const MONEY = /^\d+(?:\.\d{1,2})?$/;

export function CancellationCommandForm({ detail }: { detail: GranotLifecycleCaseDetail }) {
  const booking = detail.official_current.booking;
  const queryClient = useQueryClient();
  const [cancelDate, setCancelDate] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [cancelledBy, setCancelledBy] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string>();
  const errorRef = useRef<HTMLDivElement>(null);
  const lastAttempt = useRef<{ canonical: string; key: string } | undefined>(undefined);

  useEffect(() => { if (errors.length) errorRef.current?.focus(); }, [errors]);
  if (!booking) return <FeedbackMessage tone="error">The deterministic live Booking is unavailable. Cancellation is blocked.</FeedbackMessage>;

  const buildBody = (): ConfirmGranotCancellationBody | undefined => {
    const nextErrors: string[] = [];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cancelDate)) nextErrors.push("Enter a valid Cancel Date.");
    if (!MONEY.test(refundAmount)) nextErrors.push("Refund Amount must be nonnegative with no more than two decimals.");
    if (reason.trim().length > 500) nextErrors.push("Reason must be at most 500 characters.");
    if (notes.trim().length > 2000) nextErrors.push("Notes must be at most 2000 characters.");
    if (cancelledBy.trim().length > 200) nextErrors.push("Cancelled By must be at most 200 characters.");
    setErrors(nextErrors);
    if (nextErrors.length) return undefined;
    return {
      expected_case_revision: detail.case_revision,
      expected_booking_revision: booking.domain_revision,
      official_cancellation_details: {
        cancel_date: cancelDate,
        refund_amount: Number(refundAmount),
        ...(reason.trim() ? { reason: reason.trim() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(cancelledBy.trim() ? { cancelled_by: cancelledBy.trim() } : {}),
      },
    };
  };

  const invalidate = () => invalidateGranotLifecycleCommandViews(queryClient, {
    caseId: detail.case_id,
    jobNo: detail.normalized_job_no,
    bookingId: booking.id,
    lead: booking.lead_ref?.model === "FormLead" || booking.lead_ref?.model === "CallLead"
      ? { model: booking.lead_ref.model, id: booking.lead_ref.id }
      : undefined,
  });

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
      const result = await confirmGranotCancellation(detail.case_id, body, attempt.key);
      lastAttempt.current = undefined;
      setReviewing(false);
      setNotice(result.outcome === "cancellation_created"
        ? "Cancellation created successfully."
        : "The Booking already has the verified official Cancellation for this Release case.");
      await invalidate();
    } catch (error) {
      if (error instanceof GranotLifecycleApiError && error.status === 409) {
        setErrors([`The case, Booking revision, or identity changed (${error.code ?? "conflict"}). Current facts were refreshed; every unsent cancellation value was preserved. Review and submit explicitly again.`]);
        await invalidate();
      } else {
        setErrors([error instanceof Error ? error.message : "Unable to create Cancellation."]);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle>Create Cancellation</CardTitle><CardDescription>Enter complete official Vantage cancellation values. Granot evidence is context only and never pre-fills this form.</CardDescription></CardHeader>
      <CardContent className="space-y-5">
        {notice ? <FeedbackMessage>{notice}</FeedbackMessage> : null}
        {errors.length ? <div ref={errorRef} role="alert" tabIndex={-1} className="rounded-md border border-destructive p-3"><strong>Correct or review the following:</strong><ul className="mt-2 list-disc pl-5">{errors.map((error) => <li key={error}>{error}</li>)}</ul></div> : null}
        <fieldset className="grid gap-4 md:grid-cols-2" disabled={reviewing || submitting}>
          <legend className="mb-3 font-semibold">Complete official Cancellation</legend>
          <div><Label htmlFor="granot-cancel-date">Cancel Date</Label><Input id="granot-cancel-date" type="date" value={cancelDate} onChange={(event) => setCancelDate(event.target.value)} /></div>
          <div><Label htmlFor="granot-refund-amount">Refund Amount</Label><Input id="granot-refund-amount" inputMode="decimal" value={refundAmount} onChange={(event) => setRefundAmount(event.target.value)} /></div>
          <div><Label htmlFor="granot-cancel-reason">Reason</Label><Input id="granot-cancel-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} /></div>
          <div><Label htmlFor="granot-cancelled-by">Cancelled By</Label><Input id="granot-cancelled-by" value={cancelledBy} onChange={(event) => setCancelledBy(event.target.value)} maxLength={200} /></div>
          <div className="md:col-span-2"><Label htmlFor="granot-cancel-notes">Notes</Label><textarea id="granot-cancel-notes" className="min-h-24 w-full rounded-md border p-2" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={2000} /></div>
        </fieldset>
        {reviewing ? <section aria-labelledby="granot-cancellation-review" className="rounded-md border p-4"><h3 id="granot-cancellation-review" className="font-semibold">Review official Cancellation</h3><p className="mt-2 text-sm">Cancel Date: {cancelDate} · Refund: {refundAmount}</p><p className="text-sm">Case revision: {detail.case_revision} · Booking revision: {booking.domain_revision}</p></section> : null}
        <div className="flex gap-2">{reviewing ? <Button type="button" variant="outline" onClick={() => setReviewing(false)} disabled={submitting}>Back to edit</Button> : null}<Button type="button" disabled={submitting} onClick={() => reviewing ? void submit() : setReviewing(Boolean(buildBody()))}>{reviewing ? (submitting ? "Creating…" : "Create Cancellation") : "Review Cancellation"}</Button></div>
      </CardContent>
    </Card>
  );
}
