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
import { parseOfficialBookingDetails } from "@/lib/booking/officialBookingDetails";
import { invalidateGranotLifecycleCommandViews } from "@/lib/query/granotLifecycle";
import { INTAKE_LEAD_OPTIONAL } from "@/components/intakes/intake-copy";
import { OfficialBinderAgentsFields } from "./official-binder-agents-fields";
import { candidateLeadName } from "./candidate-lead-facts";

/**
 * The act where the Owner writes the official numbers. Who the booking is for
 * was settled above this card, so this one only asks for what Granot never
 * sends: binder, agents, deposit, and merchant.
 */
export function BookingCommandForm({
  detail,
  matchedLead,
}: {
  detail: GranotLifecycleCaseDetail;
  matchedLead?: GranotLifecycleCandidateItem;
}) {
  const queryClient = useQueryClient();
  const catalog = useCatalogOptions();
  const [bookDate, setBookDate] = useState("");
  const [deposit, setDeposit] = useState("");
  const [totalBinder, setTotalBinder] = useState("");
  const [merchantId, setMerchantId] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [primaryAgentId, setPrimaryAgentId] = useState("");
  const [secondaryAgentId, setSecondaryAgentId] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string>();
  const lastAttempt = useRef<{ canonical: string; key: string } | undefined>(undefined);
  const errorSummary = useRef<HTMLDivElement>(null);
  const agents = catalog.agents.filter((item) => item.active);
  const merchants = catalog.merchants.filter((item) => item.active);
  const chosenMerchant = merchants.find((item) => item.id === merchantId);
  const chosenAgents = [primaryAgentId, secondaryAgentId]
    .map((id) => agents.find((item) => item.id === id)?.name)
    .filter(Boolean);

  useEffect(() => {
    if (errors.length) errorSummary.current?.focus();
  }, [errors]);

  const buildBody = (): ConfirmGranotBookingBody | undefined => {
    const parsed = parseOfficialBookingDetails({
      bookDate,
      deposit,
      binder: totalBinder,
      merchantId,
      primaryAgentId,
      secondaryAgentId,
    });
    const nextErrors = [...parsed.errors];
    if (matchedLead?.requires_override_reason && (overrideReason.trim().length < 10 || overrideReason.trim().length > 500)) {
      nextErrors.push("Write 10 to 500 characters explaining why this customer belongs on this job.");
    }
    setErrors(nextErrors);
    if (nextErrors.length || !parsed.details) return undefined;
    return {
      expected_case_revision: detail.case_revision,
      ...(matchedLead
        ? { selected_lead: { lead_model: matchedLead.lead_ref.model, lead_id: matchedLead.lead_ref.id } }
        : {}),
      ...(matchedLead?.requires_override_reason ? { out_of_scope_override_reason: overrideReason.trim() } : {}),
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
      const result = await confirmGranotBooking(detail.case_id, body, attempt.key);
      if (!result.booking_ref) throw new Error("Booking command response omitted the created Booking reference.");
      lastAttempt.current = undefined;
      setReviewing(false);
      setNotice(
        result.outcome === "booking_created"
          ? result.owner_notice
            ?? (result.is_leadless_booking ? INTAKE_LEAD_OPTIONAL.leadlessCreated : INTAKE_LEAD_OPTIONAL.attachedCreated)
          : "The current official Booking already satisfied this case.",
      );
      await invalidateGranotLifecycleCommandViews(queryClient, {
        caseId: detail.case_id,
        jobNo: detail.normalized_job_no,
        ...(body.selected_lead
          ? { lead: { model: body.selected_lead.lead_model, id: body.selected_lead.lead_id } }
          : {}),
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
          ...(body.selected_lead
            ? { lead: { model: body.selected_lead.lead_model, id: body.selected_lead.lead_id } }
            : {}),
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
        <CardTitle>Finish the booking</CardTitle>
        <CardDescription>
          One binder amount, up to two agents, deposit, and merchant — the same catalog as a normal
          booking. Two agents split the binder evenly. Nothing here is filled in from Granot.
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

        {matchedLead ? (
          <p className="text-sm text-muted-foreground">
            {matchedLead.confidence === "high"
              ? INTAKE_LEAD_OPTIONAL.willAttachHigh
              : INTAKE_LEAD_OPTIONAL.filingUnder}{" "}
            <span className="font-semibold text-navy">{candidateLeadName(matchedLead)}</span>.
          </p>
        ) : (
          <FeedbackMessage tone="warning">
            {INTAKE_LEAD_OPTIONAL.noStrongMatch}
          </FeedbackMessage>
        )}

        {matchedLead?.requires_override_reason ? (
          <div className="space-y-1">
            <Label htmlFor="granot-override-reason">
              Why this customer belongs on this job
            </Label>
            <p className="text-sm text-muted-foreground">
              This customer came in through a different lead source than the job did. Write down what
              makes them the same person.
            </p>
            <textarea
              id="granot-override-reason"
              className="min-h-24 w-full rounded-md border p-2"
              value={overrideReason}
              onChange={(event) => setOverrideReason(event.target.value)}
              maxLength={500}
            />
          </div>
        ) : null}

        <fieldset className="grid gap-3 sm:grid-cols-2 md:grid-cols-3" disabled={reviewing || submitting}>
          <legend className="sr-only">Official booking details</legend>
          <FilterField label="Book Date">
            <Input id="granot-book-date" type="date" value={bookDate} onChange={(event) => setBookDate(event.target.value)} />
          </FilterField>
          <OfficialBinderAgentsFields
            idPrefix="granot"
            binder={totalBinder}
            onBinderChange={setTotalBinder}
            primaryAgentId={primaryAgentId}
            secondaryAgentId={secondaryAgentId}
            onPrimaryAgentChange={setPrimaryAgentId}
            onSecondaryAgentChange={setSecondaryAgentId}
            agents={agents}
            afterBinder={
              <FilterField label="Deposit Amount">
                <Input id="granot-deposit" inputMode="decimal" value={deposit} onChange={(event) => setDeposit(event.target.value)} />
              </FilterField>
            }
          />
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

        {reviewing ? (
          <section aria-labelledby="granot-booking-review" className="rounded-lg border bg-muted/40 p-4">
            <h3 id="granot-booking-review" className="font-semibold">Check this before you file it</h3>
            <p className="mt-2 text-sm">
              {matchedLead
                ? `Customer: ${candidateLeadName(matchedLead)}${matchedLead.job_no ? ` · job ${matchedLead.job_no}` : ""}${matchedLead.reference ? ` · reference ${matchedLead.reference}` : ""} · Lead ID ${matchedLead.lead_ref.id}`
                : INTAKE_LEAD_OPTIONAL.reviewNoLead}
            </p>
            {matchedLead ? (
              <p className="text-sm">
                {matchedLead.contact?.phone_number ?? "no phone"} · {matchedLead.contact?.email ?? "no email"}
              </p>
            ) : null}
            <p className="mt-2 text-sm">Book Date: {bookDate} · Deposit: {deposit} · Binder: {totalBinder}</p>
            <p className="text-sm">Merchant: {chosenMerchant?.name ?? merchantId}</p>
            <p className="text-sm">Agents: {chosenAgents.join(", ") || "—"}</p>
          </section>
        ) : (
          <section className="rounded-lg border bg-muted/40 p-4 text-sm">
            This creates the official Vantage booking for job {detail.job_no}. Granot&apos;s estimate and
            payment numbers are not copied into it.
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
