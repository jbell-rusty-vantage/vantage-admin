"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { canConnectBookingToLead } from "@/components/bookings/booking-stored-lead";
import { ConnectLeadPanel } from "@/components/bookings/connect-lead-panel";
import { FilterField } from "@/components/filters/filter-field";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { fetchAdminDetail, fetchAdminList, getRecordId, type AdminRecord } from "@/lib/api/admin";
import { queryKeys } from "@/lib/query/keys";
import { MANUAL_COPY } from "./manual-copy";
import {
  bookingRecordHref,
  isBookingObjectId,
  leadlessBookingListFilters,
} from "./manual-create-lead";

function bookingLabel(record: AdminRecord): string {
  const job = typeof record.job_no === "string" && record.job_no.trim() ? record.job_no : "No job number";
  const name =
    typeof record.customer_name === "string" && record.customer_name.trim()
      ? record.customer_name
      : "No customer name";
  return `${job} · ${name}`;
}

export function ConnectBookingSection() {
  const [draftQuery, setDraftQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const listFilters = leadlessBookingListFilters(appliedQuery);

  const list = useQuery({
    queryKey: queryKeys.lists.resource("booked-leads", listFilters),
    queryFn: () => fetchAdminList<AdminRecord>("booked-leads", listFilters),
  });

  const detailLookup = useQuery({
    queryKey: queryKeys.details.resource("booked-leads", appliedQuery.trim(), "production"),
    queryFn: () => fetchAdminDetail<AdminRecord>("booked-leads", appliedQuery.trim(), "production"),
    enabled: isBookingObjectId(appliedQuery),
  });

  const selectedDetail = useQuery({
    queryKey: queryKeys.details.resource("booked-leads", selectedId ?? "", "production"),
    queryFn: () => fetchAdminDetail<AdminRecord>("booked-leads", selectedId!, "production"),
    enabled: Boolean(selectedId),
  });

  const listed = (list.data?.items ?? []).filter((record) => canConnectBookingToLead(record));
  const lookedUp =
    detailLookup.data && canConnectBookingToLead(detailLookup.data) ? detailLookup.data : undefined;
  const candidates = lookedUp
    ? [lookedUp, ...listed.filter((record) => getRecordId(record) !== getRecordId(lookedUp))]
    : listed;
  const selected = selectedDetail.data;
  const canConnect = selected ? canConnectBookingToLead(selected) : false;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold">{MANUAL_COPY.connectTitle}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{MANUAL_COPY.connectHint}</p>
      </div>
      {notice ? <FeedbackMessage tone="success">{notice}</FeedbackMessage> : null}
      {selectedId && selected ? (
        <div className="space-y-4">
          <p className="text-sm">
            <span className="font-medium text-navy">{bookingLabel(selected)}</span>
            {" · "}
            <Link className="underline" href={bookingRecordHref(selectedId)}>
              {MANUAL_COPY.viewBooking}
            </Link>
          </p>
          <Button type="button" variant="outline" onClick={() => setSelectedId(undefined)}>
            {MANUAL_COPY.changeBooking}
          </Button>
          {selectedDetail.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading booking…</p>
          ) : canConnect ? (
            <ConnectLeadPanel
              record={selected}
              onConnected={(ownerNotice) => {
                setNotice(ownerNotice);
                setSelectedId(undefined);
              }}
            />
          ) : (
            <FeedbackMessage tone="warning">
              This booking already has a stored lead, is a referral, or is cancelled.
            </FeedbackMessage>
          )}
        </div>
      ) : (
        <>
          <form
            className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              setNotice(undefined);
              setAppliedQuery(draftQuery.trim());
            }}
          >
            <FilterField label={MANUAL_COPY.searchBookings}>
              <Input
                value={draftQuery}
                onChange={(event) => setDraftQuery(event.target.value)}
                placeholder={MANUAL_COPY.searchBookingsPlaceholder}
              />
            </FilterField>
            <Button className="self-end" type="submit">
              {MANUAL_COPY.searchBookingsAction}
            </Button>
          </form>
          {list.isFetching || detailLookup.isFetching ? (
            <p role="status" className="text-sm text-muted-foreground">
              Finding bookings…
            </p>
          ) : null}
          {list.isError ? (
            <FeedbackMessage tone="error">
              {list.error instanceof Error ? list.error.message : "Unable to find bookings."}
            </FeedbackMessage>
          ) : null}
          {detailLookup.isError && isBookingObjectId(appliedQuery) ? (
            <FeedbackMessage tone="error">
              {detailLookup.error instanceof Error ? detailLookup.error.message : "Unable to open that booking."}
            </FeedbackMessage>
          ) : null}
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {MANUAL_COPY.recentLeadless}
            </p>
            {candidates.length === 0 && !list.isFetching ? (
              <p className="text-sm text-muted-foreground">{MANUAL_COPY.noLeadless}</p>
            ) : (
              <ul className="space-y-2" aria-label={MANUAL_COPY.recentLeadless}>
                {candidates.map((record) => {
                  const id = getRecordId(record);
                  return (
                    <li key={id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
                      <p className="text-sm text-navy">{bookingLabel(record)}</p>
                      <Button type="button" variant="outline" onClick={() => setSelectedId(id)}>
                        {MANUAL_COPY.chooseBooking}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}
