"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedbackMessage } from "@/components/ui/feedback";
import { Label } from "@/components/ui/label";
import {
  GranotLifecycleApiError,
  resolveGranotBookingNoAction,
  type BookingNoActionBody,
  type BookingNoActionReasonCode,
  type GranotLifecycleCaseDetail,
} from "@/lib/api/granotLifecycle";
import { invalidateGranotLifecycleCommandViews } from "@/lib/query/granotLifecycle";

const REASONS: Array<{ value: BookingNoActionReasonCode; label: string }> = [
  { value: "already_handled_elsewhere", label: "Already handled elsewhere" },
  { value: "granot_action_not_authoritative", label: "Granot action is not authoritative" },
  { value: "wrong_customer_or_job", label: "Wrong customer or Job" },
  { value: "duplicate_granot_action", label: "Duplicate Granot action" },
  { value: "booking_still_valid", label: "Booking is still valid" },
  { value: "granot_change_only", label: "Granot-only change" },
  { value: "insufficient_information", label: "Insufficient information" },
  { value: "legacy_data", label: "Legacy data" },
  { value: "other", label: "Other" },
];

export function NoActionForm({ detail }: { detail: GranotLifecycleCaseDetail }) {
  const queryClient = useQueryClient();
  const [reasonCode, setReasonCode] = useState<BookingNoActionReasonCode | "">("");
  const [reasonText, setReasonText] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string>();
  const errorRef = useRef<HTMLDivElement>(null);
  const lastAttempt = useRef<{ canonical: string; key: string } | undefined>(undefined);
  useEffect(() => { if (errors.length) errorRef.current?.focus(); }, [errors]);

  const buildBody = (): BookingNoActionBody | undefined => {
    const text = reasonText.trim();
    const nextErrors = text.length > 1000 ? ["Reason text must be at most 1000 characters."] : [];
    setErrors(nextErrors);
    if (nextErrors.length) return undefined;
    return {
      expected_case_revision: detail.case_revision,
      ...(reasonCode ? { reason_code: reasonCode } : {}),
      ...(text ? { reason_text: text } : {}),
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
      await resolveGranotBookingNoAction(detail.case_id, body, attempt.key);
      lastAttempt.current = undefined;
      setReviewing(false);
      setNotice("Case resolved with No Action. No official aggregate was changed.");
      const booking = detail.official_current.booking;
      await invalidateGranotLifecycleCommandViews(queryClient, {
        caseId: detail.case_id,
        jobNo: detail.normalized_job_no,
        bookingId: booking?.id,
        lead: booking?.lead_ref?.model === "FormLead" || booking?.lead_ref?.model === "CallLead"
          ? { model: booking.lead_ref.model, id: booking.lead_ref.id }
          : undefined,
      });
    } catch (error) {
      if (error instanceof GranotLifecycleApiError && error.status === 409) {
        setErrors([`The case revision changed (${error.code ?? "conflict"}). Current facts were refreshed; your unsent reason fields were preserved. Review and submit explicitly again.`]);
        await invalidateGranotLifecycleCommandViews(queryClient, {
          caseId: detail.case_id,
          jobNo: detail.normalized_job_no,
          bookingId: detail.official_current.booking?.id,
        });
      } else {
        setErrors([error instanceof Error ? error.message : "Unable to resolve this case."]);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle>No Action</CardTitle><CardDescription>Resolve this standard Booking case without changing a Lead, Booking, Cancellation, or Sheet Sync work.</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        {notice ? <FeedbackMessage>{notice}</FeedbackMessage> : null}
        {errors.length ? <div ref={errorRef} role="alert" tabIndex={-1} className="rounded-md border border-destructive p-3"><strong>Review the following:</strong><ul className="mt-2 list-disc pl-5">{errors.map((error) => <li key={error}>{error}</li>)}</ul></div> : null}
        <fieldset className="space-y-3" disabled={reviewing || submitting}>
          <legend className="font-semibold">Optional resolution metadata</legend>
          <div><Label htmlFor="granot-no-action-reason">Reason</Label><select id="granot-no-action-reason" className="h-10 w-full rounded-md border px-3" value={reasonCode} onChange={(event) => setReasonCode(event.target.value as BookingNoActionReasonCode | "")}><option value="">No reason code</option>{REASONS.map((reason) => <option key={reason.value} value={reason.value}>{reason.label}</option>)}</select></div>
          <div><Label htmlFor="granot-no-action-text">Reason text</Label><textarea id="granot-no-action-text" className="min-h-24 w-full rounded-md border p-2" value={reasonText} onChange={(event) => setReasonText(event.target.value)} maxLength={1000} /></div>
        </fieldset>
        {reviewing ? <section aria-labelledby="granot-no-action-review" className="rounded-md border p-4"><h3 id="granot-no-action-review" className="font-semibold">Review No Action resolution</h3><p className="mt-2 text-sm">Reason: {REASONS.find((reason) => reason.value === reasonCode)?.label ?? "None"}</p><p className="text-sm">Case revision: {detail.case_revision}</p></section> : null}
        <div className="flex gap-2">{reviewing ? <Button type="button" variant="outline" onClick={() => setReviewing(false)} disabled={submitting}>Back to edit</Button> : null}<Button type="button" disabled={submitting} onClick={() => reviewing ? void submit() : setReviewing(Boolean(buildBody()))}>{reviewing ? (submitting ? "Resolving…" : "Resolve — No Action") : "Review No Action"}</Button></div>
      </CardContent>
    </Card>
  );
}
