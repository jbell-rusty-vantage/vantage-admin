"use client";

import Link from "next/link";
import type { KeyboardEvent, MouseEvent } from "react";
import { X } from "lucide-react";
import { verdictChip } from "@/components/leads/lead-card-model";
import { stringValue } from "@/components/operational/operational-helpers";
import { leadHref } from "@/components/operational/record-href";
import { Avatar, CopyJobButton, EvidenceChip, IconBadge, MoneyTile, Pill } from "@/components/ui/crm/primitives";
import { moneyText } from "@/components/bookings/booking-card-model";
import { getRecordId, type AdminRecord, type SheetContainsItem } from "@/lib/api/admin";
import {
  bookingIdOf,
  bookingPanelHref,
  cancellationJob,
  cancellationLead,
  cancellationName,
  cancellationSourceText,
  datesText,
  masterCancelledChip,
  notesFirstLine,
  populatedBooking,
  refundText,
} from "./cancellation-card-model";
import { CANCELLATIONS_COPY, reasonLabel } from "./cancellations-copy";

export type CancellationCardProps = {
  item: AdminRecord;
  active?: boolean;
  /** Select mode: the icon circle becomes a checkbox and a click toggles the selection. */
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string, checked: boolean) => void;
  verdict?: SheetContainsItem | null;
  /** A click without a populated booking falls back to this (the cancellations panel), so nothing is a dead end. */
  onOpenFallback?: (item: AdminRecord) => void;
  /** A click with a booking navigates to the booking's Cancellation tab. */
  onOpenBooking?: (href: string) => void;
  now?: Date;
};

const stop = (event: MouseEvent | KeyboardEvent) => event.stopPropagation();

export function CancellationCard({ item, active = false, selectMode = false, selected = false, onToggleSelect, verdict, onOpenFallback, onOpenBooking, now }: CancellationCardProps) {
  const copy = CANCELLATIONS_COPY.card;
  const id = getRecordId(item);
  const name = cancellationName(item);
  const reason = reasonLabel(item.reason);
  const source = cancellationSourceText(item);
  const job = cancellationJob(item);
  const dates = datesText(item, now);
  const agent = stringValue(item.agent);
  const booking = populatedBooking(item);
  const bookingId = bookingIdOf(item);
  const merchant = stringValue(item.merchant);
  const by = stringValue(item.cancelled_by);
  const notes = notesFirstLine(item);
  const sheet = masterCancelledChip(item);
  const chip = verdict ? verdictChip(verdict) : null;
  const lead = cancellationLead(item);

  const open = () => {
    if (selectMode) {
      onToggleSelect?.(id, !selected);
      return;
    }
    if (bookingId && booking) onOpenBooking?.(bookingPanelHref(bookingId));
    else onOpenFallback?.(item);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      open();
    }
  };

  return (
    <article
      className="crm-card crm-record crm-card--clickable"
      data-testid="cancellation-card"
      data-cancellation-id={id}
      data-selected={active ? "true" : undefined}
      style={active ? { borderColor: "var(--crm-blue)", background: "var(--crm-blue-50)" } : undefined}
      tabIndex={0}
      onClick={open}
      onKeyDown={onKeyDown}
    >
      {selectMode ? (
        <label className="crm-record__check" onClick={stop}>
          <input type="checkbox" checked={selected} onChange={(event) => onToggleSelect?.(id, event.target.checked)} aria-label={copy.selectLabel(name)} />
        </label>
      ) : (
        <IconBadge icon={X} tone="red" />
      )}
      <div className="crm-record__body">
        <div className="crm-record__line crm-record__line--top">
          <span className="crm-record__name">{name}</span>
          <Pill variant="red">{reason ?? copy.reasonMissing}</Pill>
          {source ? <span className="crm-record__source">{source}</span> : null}
        </div>
        <div className="crm-record__line">
          {job ? (
            <>
              <span>
                {copy.job} {job}
              </span>
              <CopyJobButton jobNo={job} />
            </>
          ) : null}
          {dates ? <span>{dates}</span> : null}
          {agent ? (
            <span className="crm-record__right">
              <Avatar name={agent} size="sm" />
              {agent}
            </span>
          ) : null}
        </div>
        <div className="crm-record__line crm-record__line--money">
          <MoneyTile label={copy.refund} value={refundText(item)} />
          <MoneyTile label={copy.deposit} value={booking ? moneyText(booking.deposit_amount) : "—"} />
          <MoneyTile label={copy.binder} value={booking ? moneyText(booking.total_binder_amount) : "—"} />
          {merchant || by ? (
            <span style={{ color: "var(--crm-muted)", marginLeft: "auto" }}>
              {[merchant, by ? `${copy.recordedBy} ${by}` : null].filter(Boolean).join(" · ")}
            </span>
          ) : null}
        </div>
        {notes ? (
          <div className="crm-record__line crm-record__line--money" title={notes.full}>
            <span style={{ fontStyle: "italic", color: "var(--crm-muted)" }}>“{notes.first}”</span>
          </div>
        ) : null}
        <div className="crm-record__line crm-record__line--evidence" onClick={stop} onKeyDown={stop}>
          {sheet ? <EvidenceChip state={sheet.state}>{sheet.text}</EvidenceChip> : null}
          {chip ? (
            <EvidenceChip state={chip.state} title={chip.title}>
              {chip.text}
            </EvidenceChip>
          ) : null}
          {bookingId ? (
            <Link href={bookingPanelHref(bookingId)} className="crm-button crm-button--quiet crm-button--sm">
              {copy.booking} ›
            </Link>
          ) : null}
          {lead ? (
            <Link href={leadHref(lead.kind, lead.id)} className="crm-button crm-button--quiet crm-button--sm">
              {copy.lead} ›
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}
