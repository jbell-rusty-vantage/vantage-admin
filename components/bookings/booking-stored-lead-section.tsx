"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { StatusBadge } from "@/components/data-table/status-badge";
import { Button } from "@/components/ui/button";
import { DetailSection } from "@/components/record-detail/detail-section";
import {
  FormSubmittedGranotCards,
  GranotContactStatusChip,
  readGranotContactSnapshot,
} from "@/components/operational/form-lead-contacts";
import { useDashboardRole } from "@/components/layout/dashboard-role-context";
import { fetchAdminDetail, type AdminRecord } from "@/lib/api/admin";
import { queryKeys } from "@/lib/query/keys";
import { BOOKINGS_CONNECT_COPY } from "./bookings-copy";
import {
  bookingLeadRef,
  canConnectBookingToLead,
  isReferralBookingRecord,
  storedLeadChip,
} from "./booking-stored-lead";
import { ConnectLeadPanel } from "./connect-lead-panel";

export function BookingStoredLeadSection({
  record,
  startOpen = false,
  readOnly = false,
}: {
  record: AdminRecord;
  startOpen?: boolean;
  readOnly?: boolean;
}) {
  const role = useDashboardRole();
  const attached = bookingLeadRef(record);
  const allowConnect = role === "owner" && !readOnly && canConnectBookingToLead(record);
  const [open, setOpen] = useState(startOpen && allowConnect);
  const leadQuery = useQuery({
    queryKey: queryKeys.details.resource(
      attached?.model === "CallLead" ? "call-leads" : "form-leads",
      attached?.id ?? "",
    ),
    queryFn: () => fetchAdminDetail<AdminRecord>(
      attached?.model === "CallLead" ? "call-leads" : "form-leads",
      attached!.id,
      "production",
    ),
    enabled: Boolean(attached),
  });

  return (
    <DetailSection title={BOOKINGS_CONNECT_COPY.storedLead}>
      <div className="space-y-3">
        {attached ? (
          leadQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading stored lead…</p>
          ) : leadQuery.data ? (
            <AttachedLeadCards lead={leadQuery.data} />
          ) : (
            <p className="text-sm text-muted-foreground">This booking has a stored lead.</p>
          )
        ) : isReferralBookingRecord(record) ? (
          <StatusBadge tone="muted">{BOOKINGS_CONNECT_COPY.referral}</StatusBadge>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{BOOKINGS_CONNECT_COPY.emptyState}</p>
            <StatusBadge tone="warning">{BOOKINGS_CONNECT_COPY.noStoredLead}</StatusBadge>
            {allowConnect ? (
              <Button type="button" variant={open ? "outline" : "default"} onClick={() => setOpen((value) => !value)}>
                {BOOKINGS_CONNECT_COPY.connectALead}
              </Button>
            ) : null}
          </>
        )}
        {open && allowConnect ? (
          <ConnectLeadPanel record={record} />
        ) : null}
      </div>
    </DetailSection>
  );
}

function AttachedLeadCards({ lead }: { lead: AdminRecord }) {
  const granot = readGranotContactSnapshot(lead);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold text-navy">
          {String(lead.name ?? [lead.first_name, lead.last_name].filter(Boolean).join(" ") ?? "Stored lead")}
        </p>
        <GranotContactStatusChip snapshot={granot} omitEmpty />
      </div>
      <p className="text-sm text-muted-foreground">{BOOKINGS_CONNECT_COPY.contactCycle.line}</p>
      {granot?.differs_from_ingested === true ? (
        <p className="text-sm text-muted-foreground">{BOOKINGS_CONNECT_COPY.contactCycle.changed}</p>
      ) : null}
      <FormSubmittedGranotCards
        formSubmitted={{
          name: lead.name,
          first_name: lead.first_name,
          last_name: lead.last_name,
          phone_number: lead.phone_number,
          email: lead.email,
        }}
        granot={granot}
      />
    </div>
  );
}

export function StoredLeadChip({ record }: { record: AdminRecord }) {
  const chip = storedLeadChip(record);
  if (!chip) return <span className="text-muted-foreground">—</span>;
  return <StatusBadge tone={chip.tone}>{chip.label}</StatusBadge>;
}
