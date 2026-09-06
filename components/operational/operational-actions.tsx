"use client";

import Link from "next/link";
import { AlertTriangle, ArrowUpRight, PlusCircle, XCircle } from "lucide-react";
import { DetailSection } from "@/components/record-detail/detail-section";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback";
import { HideFromMasterLeadsControl } from "@/components/operational/hide-from-master-leads-control";
import { MarkBadLeadControl } from "@/components/operational/mark-bad-lead-control";
import type { DeleteDialogCopy, DeleteTarget } from "@/components/operational/operational-configs";
import {
  getValue,
  hasAttachedCancellation,
  isReferralBooking,
  relatedNavLinksFor,
} from "@/components/operational/operational-helpers";
import { getRecordId, type AdminRecord, type UiResource } from "@/lib/api/admin";
import type { RelatedNavLink } from "@/components/operational/related-record-nav";

function recordContextLabel(record: AdminRecord): string {
  const parts: string[] = [];
  const jobNo = getValue(record, "job_no");
  const customer =
    getValue(record, "customer.full_name") ??
    getValue(record, "customer_name") ??
    getValue(record, "name");
  if (jobNo) {
    parts.push(`Job ${String(jobNo)}`);
  }
  if (customer) {
    parts.push(String(customer));
  }
  return parts.join(" - ");
}

function buildDeleteDialogCopy(target: DeleteTarget): DeleteDialogCopy {
  const context = recordContextLabel(target.record);
  if (target.resource === "cancellations") {
    return {
      title: context ? `Delete cancellation for ${context}?` : "Delete this cancellation?",
      description:
        "This will permanently delete this cancellation and remove its row from Master Booked > Cancelled Deals.",
      bullets: [
        "The booking, lead, and customer will not be deleted.",
        "Master Leads and the booked row will be updated so the cancellation flag is cleared.",
        "This cannot be undone from the dashboard.",
      ],
      confirmLabel: "Delete cancellation",
    };
  }

  if (hasAttachedCancellation(target.record)) {
    return {
      title: context ? `Delete booking and cancellation for ${context}?` : "Delete this booking and cancellation?",
      description:
        "This booking has an attached cancellation. This will permanently delete the booking and the attached cancellation.",
      bullets: [
        "The booking row will be removed from Master Booked > Booked Deals.",
        "The cancellation row will be removed from Master Booked > Cancelled Deals.",
        "The lead and customer will not be deleted.",
        "Master Leads will be updated so booking and cancellation columns are cleared.",
        "This cannot be undone from the dashboard.",
      ],
      confirmLabel: "Delete booking and cancellation",
    };
  }

  return {
    title: context ? `Delete booking for ${context}?` : "Delete this booking?",
    description:
      "This will permanently delete this booking and remove its row from Master Booked > Booked Deals.",
    bullets: [
      "The lead and customer will not be deleted.",
      "Master Leads will be updated so the booking columns are cleared.",
      "This cannot be undone from the dashboard.",
    ],
    confirmLabel: "Delete booking",
  };
}

export function getBookingQuery(resource: UiResource, record: AdminRecord) {
  const params = new URLSearchParams();
  const id = getRecordId(record);
  if (resource === "form-leads") {
    params.set("lead_type", "FormLead");
    params.set("lead_id", id);
  }
  if (resource === "call-leads") {
    params.set("lead_type", "CallLead");
    const phone = getValue(record, "phone_number");
    if (phone) params.set("call_phone_number", String(phone));
  }
  return params.toString();
}

export function getCancellationQuery(resource: UiResource, record: AdminRecord) {
  const params = new URLSearchParams();
  const id = getRecordId(record);
  if (resource === "bookings") {
    params.set("booked_lead", id);
  } else {
    params.set("lead_id", id);
  }
  return params.toString();
}

export function RelatedNavLinkButton({
  link,
  compact = false,
}: {
  link: RelatedNavLink;
  compact?: boolean;
}) {
  return (
    <Link
      href={link.href}
      onClick={(event) => event.stopPropagation()}
      className={
        compact
          ? "inline-flex h-7 items-center justify-center gap-1 rounded-md border border-input bg-background px-2 text-[11px] font-semibold hover:bg-muted"
          : "inline-flex h-10 items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
      }
    >
      <ArrowUpRight className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} aria-hidden="true" />
      {compact ? (link.label === "View booking" ? "Booking" : link.label === "View lead" ? "Lead" : link.label) : link.label}
    </Link>
  );
}

export function RelatedRecordsActions({
  uiResource,
  record,
  embedded = false,
}: {
  uiResource: UiResource;
  record: AdminRecord;
  embedded?: boolean;
}) {
  const links = relatedNavLinksFor(uiResource, record);
  if (links.length === 0) {
    return null;
  }
  const buttons = (
    <div className="flex flex-wrap gap-2">
      {links.map((link) => (
        <RelatedNavLinkButton key={link.href} link={link} />
      ))}
    </div>
  );
  if (embedded) {
    return buttons;
  }
  const description =
    uiResource === "bookings"
      ? "Open the lead that created this booking."
      : uiResource === "cancellations"
        ? "Open the booking this cancellation belongs to."
        : "Open the booking created from this lead.";
  return (
    <DetailSection title="Related Records" description={description}>
      {buttons}
    </DetailSection>
  );
}

export function WorkflowActions({
  uiResource,
  record,
  readOnly,
  onSaved,
  embedded = false,
}: {
  uiResource: UiResource;
  record: AdminRecord;
  readOnly?: boolean;
  onSaved?: () => void;
  embedded?: boolean;
}) {
  if (readOnly) {
    return null;
  }
  const canBook = uiResource === "form-leads" || uiResource === "call-leads";
  const canCancel =
    (uiResource === "bookings" && !isReferralBooking(record)) ||
    uiResource === "form-leads" ||
    uiResource === "call-leads";
  if (!canBook && !canCancel) {
    return null;
  }
  const body = (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {canBook ? (
          <Link
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-navy hover:text-white"
            href={`/bookings/new?${getBookingQuery(uiResource, record)}`}
          >
            <PlusCircle className="h-4 w-4" aria-hidden="true" />
            Book this lead
          </Link>
        ) : null}
        {canCancel ? (
          <Link
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
            href={`/cancellations/new?${getCancellationQuery(uiResource, record)}`}
          >
            <XCircle className="h-4 w-4" aria-hidden="true" />
            {uiResource === "bookings" ? "Cancel this booking" : "Start cancellation"}
          </Link>
        ) : null}
      </div>
      {uiResource === "form-leads" ? (
        <div className="rounded-md border bg-muted/30 p-3">
          <MarkBadLeadControl record={record} onSaved={onSaved} />
        </div>
      ) : null}
      {uiResource === "form-leads" || uiResource === "call-leads" ? (
        <div className="rounded-md border bg-muted/30 p-3">
          <HideFromMasterLeadsControl resource={uiResource} record={record} onSaved={onSaved} />
        </div>
      ) : null}
    </div>
  );
  if (embedded) {
    return body;
  }
  const description =
    uiResource === "bookings"
      ? "Start a cancellation with the booking identifiers prefilled."
      : uiResource === "form-leads"
        ? "Book this lead (Mongo ID prefilled) or start a cancellation."
        : "Book this lead (job number and phone prefilled) or start a cancellation.";
  return (
    <DetailSection title="Workflow Actions" description={description}>
      {body}
    </DetailSection>
  );
}

export function DeleteConfirmationDialog({
  target,
  pending,
  error,
  onCancel,
  onConfirm,
}: {
  target: DeleteTarget | null;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!target) {
    return null;
  }

  const copy = buildDeleteDialogCopy(target);
  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cancel deletion"
        className="absolute inset-0 bg-background/75 backdrop-blur-sm"
        onClick={pending ? undefined : onCancel}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
        className="relative w-full max-w-lg rounded-xl border border-destructive/30 bg-background p-5 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-destructive/10 p-2 text-destructive">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="delete-dialog-title" className="text-lg font-semibold text-navy">
              {copy.title}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">{copy.description}</p>
          </div>
        </div>

        <ul className="mt-4 space-y-2 rounded-lg border bg-muted/30 p-3 text-sm">
          {copy.bullets.map((bullet) => (
            <li key={bullet} className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" aria-hidden="true" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>

        {error ? <FeedbackMessage tone="error" className="mt-4">{error}</FeedbackMessage> : null}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onCancel} disabled={pending}>
            Keep record
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={pending}>
            {pending ? "Deleting..." : copy.confirmLabel}
          </Button>
        </div>
      </section>
    </div>
  );
}
