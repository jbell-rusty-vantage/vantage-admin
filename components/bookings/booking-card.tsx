"use client";

import Link from "next/link";
import type { KeyboardEvent, MouseEvent } from "react";
import { Check, X } from "lucide-react";
import { verdictChip } from "@/components/leads/lead-card-model";
import { stringValue } from "@/components/operational/operational-helpers";
import { leadHref } from "@/components/operational/record-href";
import { Avatar, CopyJobButton, EvidenceChip, IconBadge, MoneyTile, OverflowMenu, Pill } from "@/components/ui/crm/primitives";
import { getRecordId, type AdminRecord, type SheetContainsItem } from "@/lib/api/admin";
import { buildJobTimelineHref } from "@/lib/api/jobNumberTimeline";
import {
  agentShares,
  binderPill,
  bookingEvidence,
  bookDateText,
  bookingName,
  bookingRefund,
  bookingSourceText,
  bookingStatus,
  bookingTone,
  canRecordCancellation,
  caseFileRouteText,
  isCancelledBooking,
  isSplit,
  moneyText,
  recordCancellationHref,
  storedLead,
} from "./booking-card-model";
import { BOOKINGS_COPY } from "./bookings-copy";

export type BookingCardProps = {
  item: AdminRecord;
  active?: boolean;
  /** Select mode: the icon circle becomes a checkbox and a click toggles the selection. */
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string, checked: boolean) => void;
  verdict?: SheetContainsItem | null;
  /** Opens the booking panel; `panel` picks the tab (Cancellation from View cancellation, Production from Edit). */
  onOpen?: (item: AdminRecord, panel?: string) => void;
  now?: Date;
};

const stop = (event: MouseEvent | KeyboardEvent) => event.stopPropagation();

export function BookingCard({ item, active = false, selectMode = false, selected = false, onToggleSelect, verdict, onOpen, now }: BookingCardProps) {
  const copy = BOOKINGS_COPY;
  const id = getRecordId(item);
  const cancelled = isCancelledBooking(item);
  const name = bookingName(item);
  const status = bookingStatus(item, now);
  const binder = binderPill(item);
  const source = bookingSourceText(item);
  const job = stringValue(item.job_no);
  const route = caseFileRouteText(item, now);
  const shares = agentShares(item);
  const refund = bookingRefund(item);
  const evidence = bookingEvidence(item);
  const chip = verdict ? verdictChip(verdict) : null;
  const lead = storedLead(item);
  const timeline = job ? buildJobTimelineHref({ job }) : null;

  const open = () => {
    if (selectMode) onToggleSelect?.(id, !selected);
    else onOpen?.(item);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      open();
    }
  };

  const menu = [
    ...(lead ? [{ key: "lead", label: copy.actions.openLead, href: leadHref(lead.kind, lead.id) }] : []),
    ...(timeline ? [{ key: "timeline", label: copy.actions.timeline, href: timeline }] : []),
    ...(job ? [{ key: "copy", label: copy.actions.copyJob, onClick: () => void navigator.clipboard?.writeText(job) }] : []),
    { key: "edit", label: copy.actions.edit, onClick: () => onOpen?.(item, "production") },
  ];

  return (
    <article
      className="crm-card crm-record crm-card--clickable"
      data-testid="booking-card"
      data-booking-id={id}
      data-cancelled={cancelled ? "true" : undefined}
      data-selected={active ? "true" : undefined}
      style={active ? { borderColor: "var(--crm-blue)", background: "var(--crm-blue-50)" } : undefined}
      tabIndex={0}
      onClick={open}
      onKeyDown={onKeyDown}
    >
      {selectMode ? (
        <label className="crm-record__check" onClick={stop}>
          <input type="checkbox" checked={selected} onChange={(event) => onToggleSelect?.(id, event.target.checked)} aria-label={copy.card.selectLabel(name)} />
        </label>
      ) : (
        <IconBadge icon={cancelled ? X : Check} tone={bookingTone(item)} />
      )}
      <div className="crm-record__body">
        <div className="crm-record__line crm-record__line--top">
          <span className="crm-record__name">{name}</span>
          <Pill variant={status.variant}>{status.label}</Pill>
          {binder ? <Pill variant="purple">{binder}</Pill> : null}
          {source ? <span className="crm-record__source">{source}</span> : null}
        </div>
        <div className="crm-record__line">
          {job ? (
            <>
              <span>
                {copy.card.job} {job}
              </span>
              <CopyJobButton jobNo={job} />
            </>
          ) : null}
          {route ? <span>{route}</span> : <span style={{ color: "var(--crm-faint)" }}>{copy.card.routeMissing}</span>}
          <span className="crm-record__right">
            <span>
              {copy.card.booked} {bookDateText(item, now)}
            </span>
          </span>
        </div>
        <div className="crm-record__line crm-record__line--money">
          <MoneyTile label={copy.card.binder} value={moneyText(item.total_binder_amount)} />
          <MoneyTile label={copy.card.deposit} value={moneyText(item.deposit_amount)} />
          {cancelled ? (
            <MoneyTile label={copy.card.refund} value={refund === null ? "—" : moneyText(refund)} />
          ) : (
            <MoneyTile label={copy.card.merchant} value={stringValue(item.merchant) ?? "—"} />
          )}
          {shares.length > 0 ? (
            <span style={{ display: "inline-flex", flexDirection: "column", gap: 4, marginLeft: "auto" }}>
              {shares.map((share) => (
                <span key={share.name} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <Avatar name={share.name} size="sm" />
                  <span>{share.name}</span>
                  {share.binder !== null ? <strong>{moneyText(share.binder)}</strong> : null}
                  {isSplit(shares) ? <span style={{ color: "var(--crm-muted)", fontSize: 12 }}>{copy.card.split}</span> : null}
                </span>
              ))}
            </span>
          ) : null}
        </div>
        <div className="crm-record__line crm-record__line--evidence">
          {evidence.map((entry) => (
            <EvidenceChip key={entry.key} state={entry.state} title={entry.title}>
              {entry.text}
            </EvidenceChip>
          ))}
          {chip ? (
            <EvidenceChip state={chip.state} title={chip.title}>
              {chip.text}
            </EvidenceChip>
          ) : null}
          {cancelled ? (
            <button
              type="button"
              className="crm-button crm-button--quiet crm-button--sm"
              style={{ marginLeft: "auto" }}
              onClick={(event) => {
                stop(event);
                onOpen?.(item, "cancellation");
              }}
            >
              {copy.card.viewCancellation} ›
            </button>
          ) : null}
        </div>
        <div className="crm-record__actions" onClick={stop} onKeyDown={stop}>
          {canRecordCancellation(item) ? (
            <Link href={recordCancellationHref(id)} className="crm-button crm-button--primary crm-button--sm">
              {copy.actions.recordCancellation}
            </Link>
          ) : null}
          <OverflowMenu label={copy.actions.more} items={menu} />
        </div>
      </div>
    </article>
  );
}
