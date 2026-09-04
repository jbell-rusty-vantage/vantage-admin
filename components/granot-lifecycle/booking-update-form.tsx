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
import { parseOfficialBookingDetails } from "@/lib/booking/officialBookingDetails";
import { useCatalogOptions } from "@/lib/api/use-catalog-options";
import { invalidateGranotLifecycleCommandViews } from "@/lib/query/granotLifecycle";
import { OfficialBinderAgentsFields } from "./official-binder-agents-fields";

export function BookingUpdateForm({ detail, release = false }: { detail: GranotLifecycleCaseDetail; release?: boolean }) {
  const booking = detail.official_current.booking;
  const queryClient = useQueryClient();
  const catalog = useCatalogOptions();
  const [bookDate, setBookDate] = useState(() => booking?.book_date.slice(0, 10) ?? "");
  const [deposit, setDeposit] = useState(() => booking ? String(booking.deposit_amount) : "");
  const [totalBinder, setTotalBinder] = useState(() => booking ? String(booking.total_binder_amount) : "");
  const [merchantId, setMerchantId] = useState(() => booking?.merchant_id ?? "");
  const [primaryAgentId, setPrimaryAgentId] = useState(() => booking?.agent_allocations[0]?.agent_id ?? "");
  const [secondaryAgentId, setSecondaryAgentId] = useState(() => booking?.agent_allocations[1]?.agent_id ?? "");
  const [reviewing, setReviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string>();
  const errorRef = useRef<HTMLDivElement>(null);
  const lastAttempt = useRef<{ canonical: string; key: string } | undefined>(undefined);
  const agents = catalog.agents.filter((item) => item.active);

  useEffect(() => { if (errors.length) errorRef.current?.focus(); }, [errors]);

  if (!booking) return <FeedbackMessage tone="error">The deterministic live Booking is unavailable. Update is blocked.</FeedbackMessage>;

  const buildBody = (): UpdateGranotBookingBody | undefined => {
    const parsed = parseOfficialBookingDetails({
      bookDate,
      deposit,
      binder: totalBinder,
      merchantId,
      primaryAgentId,
      secondaryAgentId,
    });
    setErrors(parsed.errors);
    if (parsed.errors.length || !parsed.details) return undefined;
    return {
      expected_case_revision: detail.case_revision,
      expected_booking_revision: booking.domain_revision,
      official_booking_details: parsed.details,
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
          <OfficialBinderAgentsFields
            idPrefix="granot-update"
            binder={totalBinder}
            onBinderChange={setTotalBinder}
            primaryAgentId={primaryAgentId}
            secondaryAgentId={secondaryAgentId}
            onPrimaryAgentChange={setPrimaryAgentId}
            onSecondaryAgentChange={setSecondaryAgentId}
            agents={agents}
            afterBinder={
              <div><Label htmlFor="granot-update-deposit">Deposit Amount</Label><Input id="granot-update-deposit" inputMode="decimal" value={deposit} onChange={(event) => setDeposit(event.target.value)} /></div>
            }
          />
          <div><Label htmlFor="granot-update-merchant">Active Merchant</Label><select id="granot-update-merchant" className="h-10 w-full rounded-md border px-3" value={merchantId} onChange={(event) => setMerchantId(event.target.value)}><option value="">Select Merchant</option>{catalog.merchants.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
        </fieldset>
        {reviewing ? <section aria-labelledby="granot-update-review" className="rounded-md border p-4"><h3 id="granot-update-review" className="font-semibold">Review complete Booking replacement</h3><p className="mt-2 text-sm">Book Date: {bookDate} · Deposit: {deposit} · Binder: {totalBinder}</p><p className="text-sm">Case revision: {detail.case_revision} · Booking revision: {booking.domain_revision}</p></section> : null}
        <div className="flex gap-2">{reviewing ? <Button type="button" variant="outline" onClick={() => setReviewing(false)} disabled={submitting}>Back to edit</Button> : null}<Button type="button" disabled={submitting || catalog.isLoading} onClick={() => reviewing ? void submit() : setReviewing(Boolean(buildBody()))}>{reviewing ? (submitting ? "Updating…" : "Update Booking") : "Review Booking Update"}</Button></div>
      </CardContent>
    </Card>
  );
}
