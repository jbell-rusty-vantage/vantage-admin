"use client";
/**
 * The booking picker of the Record a cancellation sheet: one search box (job number or name, the shared classifier)
 * over active bookings, each a compact row with one Choose. Kept small and self-contained; the shared Lead picker is
 * built separately for the finish sheet.
 */
import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { bookDateText, bookingName, bookingSourceText, canRecordCancellation, moneyText } from "@/components/bookings/booking-card-model";
import { stringValue } from "@/components/operational/operational-helpers";
import { ReadFailure, SearchBox, SkeletonLine } from "@/components/ui/crm/primitives";
import { fetchAdminList, getRecordId, type AdminRecord } from "@/lib/api/admin";
import { applySearch } from "@/lib/api/bookings";
import type { SerializableFilters } from "@/lib/api/filters";
import { queryKeys } from "@/lib/query/keys";
import { RECORD_CANCELLATION_COPY as COPY } from "./cancellations-copy";

export const BOOKING_PICKER_LIMIT = 10;

/** The active bookings that match the search, newest first. A search that looks like a job number sends `job_no`. */
export function bookingPickerFilters(q: string | null): SerializableFilters {
  const filters: SerializableFilters = { cancelled: false, limit: BOOKING_PICKER_LIMIT, page: 1, sort: "book_date", direction: "desc" };
  applySearch(filters, q);
  return filters;
}

export function BookingPicker({ onChoose }: { onChoose: (id: string) => void }) {
  const [q, setQ] = useState<string | null>(null);
  const filters = bookingPickerFilters(q);
  const query = useQuery({
    queryKey: queryKeys.lists.resource("cancellation-booking-picker", filters),
    queryFn: () => fetchAdminList<AdminRecord>("booked-leads", filters),
    placeholderData: keepPreviousData,
  });
  // Referral Bookings cannot be cancelled here; the server has no filter for them, so they drop out of the page.
  const rows = (query.data?.items ?? []).filter(canRecordCancellation);

  return (
    <div style={{ display: "grid", gap: 12 }} data-testid="booking-picker">
      <SearchBox value={q} onSearch={setQ} placeholder={COPY.searchPlaceholder} />
      {query.isError ? <ReadFailure what={COPY.searchFailed} error={query.error} onRetry={() => void query.refetch()} /> : null}
      {query.isLoading ? (
        <div style={{ display: "grid", gap: 8 }} aria-busy="true">
          <SkeletonLine width="60%" height={16} />
          <SkeletonLine width="80%" height={16} />
        </div>
      ) : null}
      {!query.isLoading && !query.isError && rows.length === 0 ? <p className="crm-subtitle">{COPY.noBookings}</p> : null}
      <ul style={{ display: "grid", gap: 8, margin: 0, padding: 0, listStyle: "none" }}>
        {rows.map((item) => {
          const job = stringValue(item.job_no);
          const agent = stringValue(item.agent);
          const source = bookingSourceText(item);
          return (
            <li
              key={getRecordId(item)}
              className="crm-card"
              style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px 14px", padding: "10px 14px", minHeight: 44 }}
            >
              <strong>{bookingName(item)}</strong>
              {job ? <span>Job {job}</span> : null}
              <span>Booked {bookDateText(item)}</span>
              <span>{moneyText(item.total_binder_amount)} binder</span>
              {source ? <span style={{ color: "var(--crm-muted)" }}>{source}</span> : null}
              {agent ? <span style={{ color: "var(--crm-muted)" }}>{agent}</span> : null}
              <button type="button" className="crm-button crm-button--primary crm-button--sm" style={{ marginLeft: "auto" }} onClick={() => onChoose(getRecordId(item))}>
                {COPY.choose}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
