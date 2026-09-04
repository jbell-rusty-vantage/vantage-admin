"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { StatusBadge } from "@/components/data-table/status-badge";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback";
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
  const [notice, setNotice] = useState<string>();
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
            <AttachedLeadCards lead={leadQuery.data} model={attached.model} />
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
        {notice ? <FeedbackMessage tone="success">{notice}</FeedbackMessage> : null}
        {open && allowConnect && !attached ? (
          <ConnectLeadPanel
            record={record}
            onConnected={(ownerNotice) => {
              setOpen(false);
              setNotice(ownerNotice);
            }}
          />
        ) : null}
      </div>
    </DetailSection>
  );
}

function attachedLeadName(lead: AdminRecord): string {
  const combined = [lead.first_name, lead.last_name].filter(Boolean).join(" ");
  if (typeof lead.name === "string" && lead.name.trim()) return lead.name;
  if (combined) return combined;
  return "Stored lead";
}

function AttachedLeadCards({
  lead,
  model,
}: {
  lead: AdminRecord;
  model: "FormLead" | "CallLead";
}) {
  const granot = readGranotContactSnapshot(lead);
  const name = attachedLeadName(lead);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold text-navy">{name}</p>
        <GranotContactStatusChip snapshot={granot} omitEmpty />
      </div>
      {granot ? (
        <>
          <p className="text-sm text-muted-foreground">
            {model === "CallLead"
              ? BOOKINGS_CONNECT_COPY.contactCycle.callLine
              : BOOKINGS_CONNECT_COPY.contactCycle.line}
          </p>
          {granot.differs_from_ingested === true ? (
            <p className="text-sm text-muted-foreground">{BOOKINGS_CONNECT_COPY.contactCycle.changed}</p>
          ) : null}
        </>
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
        liveTitle={model === "CallLead" ? "Called" : "Form submitted"}
      />
    </div>
  );
}

export function StoredLeadChip({ record }: { record: AdminRecord }) {
  const chip = storedLeadChip(record);
  if (!chip) return <span className="text-muted-foreground">—</span>;
  return <StatusBadge tone={chip.tone}>{chip.label}</StatusBadge>;
}
