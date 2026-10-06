"use client";
/**
 * Record a cancellation (doc 03 "Record a cancellation (one sheet)"): one screen, three numbered blocks, one button.
 * Entry points: `?booked_lead=<id>` from a booking card, or the booking picker when the page opens without one.
 * It sends the same body to the same endpoint as the retired form (`createCancellation`). Nothing is pre-filled except
 * the date and, when the signed-in user matches a roster name, Recorded by.
 */
import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CircleAlert } from "lucide-react";
import { bookDateText, bookingName, bookingSourceText, canRecordCancellation, isCancelledBooking, moneyText } from "@/components/bookings/booking-card-model";
import { invalidateOperationalMutations, stringValue } from "@/components/operational/operational-helpers";
import { relatedRecordId } from "@/components/operational/related-record-nav";
import { Avatar, Chip, CrmCard, CrmSelect, IconBadge, Notice, PageHeader, ReadFailure, SkeletonLine } from "@/components/ui/crm/primitives";
import { createCancellation, fetchAdminDetail, type AdminRecord } from "@/lib/api/admin";
import { useFacetOptions } from "@/lib/api/facets";
import { CANCELLATION_REASON_OPTIONS } from "@/lib/constants/domain";
import { floridaCalendarDateInputValue } from "@/lib/floridaTime";
import { queryKeys } from "@/lib/query/keys";
import { BookingPicker } from "./booking-picker";
import { bookingPanelHref } from "./cancellation-card-model";
import { RECORD_CANCELLATION_COPY as COPY, reasonLabel } from "./cancellations-copy";
import { buildCancellationPayload, defaultRecordedBy, reviewLine } from "./record-cancellation-model";

type Done = { cancellationId: string | null; bookingId: string; name: string };

function BlockHeading({ number, children }: { number: number; children: string }) {
  return (
    <h3 style={{ display: "flex", alignItems: "center", gap: 10, margin: 0, fontSize: 16, fontWeight: 800 }}>
      <span
        aria-hidden="true"
        style={{ display: "inline-flex", width: 26, height: 26, alignItems: "center", justifyContent: "center", borderRadius: 999, background: "var(--crm-blue-100)", color: "var(--crm-blue-ink)", fontSize: 13 }}
      >
        {number}
      </span>
      {children}
    </h3>
  );
}

function CancelSheet({
  bookingId,
  adminEmail,
  onChangeBooking,
  onDone,
}: {
  bookingId: string;
  adminEmail: string | null;
  onChangeBooking: () => void;
  onDone: (done: Done) => void;
}) {
  const queryClient = useQueryClient();
  const facets = useFacetOptions();
  const booking = useQuery({
    queryKey: queryKeys.details.resource("booked-leads", bookingId),
    queryFn: () => fetchAdminDetail<AdminRecord>("booked-leads", bookingId),
  });

  const [cancelDate, setCancelDate] = useState(() => floridaCalendarDateInputValue());
  const [refund, setRefund] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [byOverride, setByOverride] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rosterNames = facets.agentOptions.map((option) => option.value);
  const by = byOverride ?? defaultRecordedBy(adminEmail, rosterNames);
  const byOptions = [
    { value: "", label: COPY.recordedByBlank },
    ...facets.agentOptions.map((option) => ({ value: option.value, label: option.label })),
    ...(by && !rosterNames.includes(by) ? [{ value: by, label: by }] : []),
  ];

  const mutation = useMutation({
    mutationFn: createCancellation,
    onSuccess: async (response, payload) => {
      await invalidateOperationalMutations(queryClient);
      const created = response && typeof response === "object" ? (response as AdminRecord) : {};
      onDone({
        cancellationId: relatedRecordId(created._id ?? created.id),
        bookingId: relatedRecordId(created.booked_lead) ?? String(payload.booked_lead ?? bookingId),
        name: booking.data ? bookingName(booking.data) : "",
      });
    },
    onError: (failure) => setError(failure instanceof Error ? failure.message : COPY.failed),
  });

  if (booking.isLoading) {
    return (
      <CrmCard>
        <div style={{ display: "grid", gap: 10 }} aria-busy="true">
          <SkeletonLine width="50%" height={16} />
          <SkeletonLine width="80%" />
          <SkeletonLine width="60%" />
        </div>
      </CrmCard>
    );
  }
  if (booking.isError || !booking.data) {
    return (
      <>
        <ReadFailure what={COPY.bookingFailed} error={booking.error} onRetry={() => void booking.refetch()} />
        <button type="button" className="crm-button crm-button--quiet" onClick={onChangeBooking}>
          {COPY.changeBooking}
        </button>
      </>
    );
  }

  const record = booking.data;
  const name = bookingName(record);
  const job = stringValue(record.job_no);
  const agent = stringValue(record.agent);
  const source = bookingSourceText(record) ?? stringValue(record.merchant);
  const blocked = isCancelledBooking(record) ? COPY.alreadyCancelled : !canRecordCancellation(record) ? COPY.referralBlocked : null;
  const deposit = moneyText(record.deposit_amount);

  const submit = () => {
    const built = buildCancellationPayload({ bookingId, cancelDate, refund, reason, by, notes });
    if (!built.ok) {
      setError(built.error);
      return;
    }
    setError(null);
    mutation.mutate(built.payload);
  };

  return (
    <CrmCard
      title={`${job ? `Job ${job} · ` : ""}${name}`}
      tools={
        <button type="button" className="crm-button crm-button--quiet crm-button--sm" onClick={onChangeBooking}>
          {COPY.changeBooking}
        </button>
      }
      testId="record-cancellation-sheet"
    >
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px 12px", marginBottom: 18 }} data-testid="cancellation-booking-facts">
        <IconBadge icon={Check} tone="green" size="sm" />
        <span>
          Booked {bookDateText(record)} · {moneyText(record.total_binder_amount)} binder · {deposit} deposit
          {source ? ` · ${source}` : ""}
        </span>
        {agent ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Avatar name={agent} size="sm" />
            {agent}
          </span>
        ) : null}
      </div>

      {blocked ? (
        <Notice icon={CircleAlert} title={blocked} tone="amber" />
      ) : (
        <form
          style={{ display: "grid", gap: 24 }}
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <section style={{ display: "grid", gap: 12 }}>
            <BlockHeading number={1}>{COPY.block1}</BlockHeading>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 14 }}>
              <label style={{ display: "grid", gap: 4 }}>
                <span className="crm-subtitle" style={{ margin: 0 }}>{COPY.cancelDate}</span>
                <input type="date" className="crm-input" value={cancelDate} onChange={(event) => setCancelDate(event.target.value)} />
              </label>
              <label style={{ display: "grid", gap: 4 }}>
                <span className="crm-subtitle" style={{ margin: 0 }}>{COPY.refund}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  className="crm-input"
                  value={refund}
                  onChange={(event) => setRefund(event.target.value)}
                  aria-describedby="cancellation-refund-hint"
                  required
                />
              </label>
              <span className="crm-subtitle" style={{ margin: 0 }}>{COPY.depositReference(deposit)}</span>
            </div>
            <span id="cancellation-refund-hint" className="crm-subtitle" style={{ margin: 0 }}>{COPY.refundHint}</span>
          </section>

          <section style={{ display: "grid", gap: 12 }}>
            <BlockHeading number={2}>{COPY.block2}</BlockHeading>
            <div className="crm-chips" role="group" aria-label={COPY.reasonLabel}>
              {CANCELLATION_REASON_OPTIONS.map((option) => (
                <Chip key={option.value} active={reason === option.value} onClick={() => setReason(option.value)}>
                  {reasonLabel(option.value) ?? option.value}
                </Chip>
              ))}
            </div>
            <label style={{ display: "grid", gap: 4 }}>
              <span className="crm-subtitle" style={{ margin: 0 }}>{COPY.notes}</span>
              <textarea className="crm-input" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
            </label>
            <div style={{ display: "grid", gap: 4, justifyItems: "start" }}>
              <span className="crm-subtitle" style={{ margin: 0 }}>{COPY.recordedBy}</span>
              <CrmSelect label={COPY.recordedBy} value={by} options={byOptions} active={Boolean(by)} onChange={(next) => setByOverride(next)} />
            </div>
          </section>

          <section style={{ display: "grid", gap: 12 }}>
            <BlockHeading number={3}>{COPY.block3}</BlockHeading>
            <p style={{ margin: 0, fontWeight: 700 }} data-testid="cancellation-review-line">{reviewLine({ refund, reason })}</p>
            <p className="crm-subtitle" style={{ margin: 0 }}>{COPY.sheetNote}</p>
            {error ? <ReadFailure what={COPY.failed} error={error} /> : null}
            <div>
              <button type="submit" className="crm-button crm-button--primary" disabled={mutation.isPending}>
                {mutation.isPending ? COPY.submitting : COPY.submit}
              </button>
            </div>
          </section>
        </form>
      )}
    </CrmCard>
  );
}

export function RecordCancellationSheet({ adminEmail = null }: { adminEmail?: string | null }) {
  const searchParams = useSearchParams();
  const fromUrl = searchParams.get("booked_lead")?.trim() || null;
  // undefined: follow the URL. A string or null: the Owner chose (or cleared) the booking on this screen.
  const [picked, setPicked] = useState<string | null | undefined>(undefined);
  const [done, setDone] = useState<Done | null>(null);
  const bookingId = picked === undefined ? fromUrl : picked;

  return (
    <div className="crm-page" style={{ padding: 0, maxWidth: 896 }}>
      <PageHeader title={COPY.title} subtitle={COPY.subtitle} />

      {done ? (
        <Notice icon={Check} title={COPY.doneTitle} tone="green" testId="cancellation-recorded">
          <div className="crm-toolbar">
            <Link href={done.cancellationId ? `/bookings/cancellations?record=${encodeURIComponent(done.cancellationId)}` : "/bookings/cancellations"} className="crm-button crm-button--quiet crm-button--sm">
              {COPY.doneCancellation}
            </Link>
            <Link href={bookingPanelHref(done.bookingId)} className="crm-button crm-button--quiet crm-button--sm">
              {COPY.doneBooking}
            </Link>
            <button type="button" className="crm-button crm-button--quiet crm-button--sm" onClick={() => setDone(null)}>
              {COPY.another}
            </button>
          </div>
        </Notice>
      ) : null}

      {bookingId ? (
        <CancelSheet
          key={bookingId}
          bookingId={bookingId}
          adminEmail={adminEmail}
          onChangeBooking={() => setPicked(null)}
          onDone={(next) => {
            setDone(next);
            setPicked(null);
          }}
        />
      ) : (
        <CrmCard title={COPY.chooseBooking} subtitle={COPY.chooseHint}>
          <BookingPicker
            onChoose={(id) => {
              setDone(null);
              setPicked(id);
            }}
          />
        </CrmCard>
      )}
    </div>
  );
}
