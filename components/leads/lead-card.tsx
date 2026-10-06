"use client";

import Link from "next/link";
import type { KeyboardEvent, MouseEvent } from "react";
import { FileText, Phone } from "lucide-react";
import { formatSourceDisplay } from "@/components/operational/operational-columns";
import { stringValue } from "@/components/operational/operational-helpers";
import { formatAbsolute, formatPhone, formatRelative, formatShortDate } from "@/components/ui/crm/format";
import {
  CopyJobButton,
  CrmSelect,
  EvidenceChip,
  IconBadge,
  OverflowMenu,
  Person,
  Pill,
} from "@/components/ui/crm/primitives";
import { getRecordId, type SheetContainsItem } from "@/lib/api/admin";
import { buildJobTimelineHref } from "@/lib/api/jobNumberTimeline";
import type { LeadItem } from "@/lib/api/leads";
import {
  bookHref,
  canBook,
  estimateText,
  granotDiffers,
  isDuplicate,
  leadName,
  leadStatus,
  leadTone,
  priorityLabel,
  receiverAgentId,
  routeText,
  sourceCompanyText,
  verdictChip,
} from "./lead-card-model";
import { LEADS_COPY } from "./leads-copy";

export type LeadCardProps = {
  item: LeadItem;
  active?: boolean;
  granularityLabelByKey?: ReadonlyMap<string, string>;
  companyLabelBySlug?: ReadonlyMap<string, string>;
  /** Select mode: the icon circle becomes a checkbox and a click toggles the selection. */
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string, checked: boolean) => void;
  verdict?: SheetContainsItem | null;
  /** Owner only: the roster to assign from. Absent hides Assign. */
  roster?: readonly { value: string; label: string }[];
  onAssign?: (item: LeadItem, agentId: string) => void;
  onOpen?: (item: LeadItem) => void;
  onToggleHidden?: (item: LeadItem) => void;
  onMarkBad?: (item: LeadItem) => void;
  now?: Date;
};

const stop = (event: MouseEvent | KeyboardEvent) => event.stopPropagation();

export function LeadCard({
  item,
  active = false,
  granularityLabelByKey,
  companyLabelBySlug,
  selectMode = false,
  selected = false,
  onToggleSelect,
  verdict,
  roster,
  onAssign,
  onOpen,
  onToggleHidden,
  onMarkBad,
  now,
}: LeadCardProps) {
  const id = getRecordId(item);
  const kind = item.__kind;
  const status = leadStatus(item);
  const priority = priorityLabel(item.granot_priority);
  const name = leadName(item);
  const phone = formatPhone(item.phone_number);
  const email = stringValue(item.email);
  const company = sourceCompanyText(item, companyLabelBySlug);
  const feed = formatSourceDisplay(item, item.source_company, granularityLabelByKey);
  const source = company && feed && feed !== "-" && feed !== company ? `${company} › ${feed}` : feed !== "-" ? feed : (company ?? "");
  const agentName = stringValue(item.receiver_agent_name_snapshot);
  const agentId = receiverAgentId(item);
  const job = stringValue(item.job_no);
  const route = routeText(item);
  const estimate = estimateText(item);
  const sizeOrLocal = kind === "form" ? stringValue(item.move_size) : stringValue(item.local)?.replace("_", " ");
  const duplicate = isDuplicate(item);
  const chip = verdict ? verdictChip(verdict) : null;
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
    ...(kind === "form" && !duplicate && onMarkBad ? [{ key: "bad", label: LEADS_COPY.cardActions.markBad, onClick: () => onMarkBad(item) }] : []),
    ...(onToggleHidden
      ? [{ key: "hide", label: item.no_sync === true ? LEADS_COPY.cardActions.unhide : LEADS_COPY.cardActions.hide, onClick: () => onToggleHidden(item) }]
      : []),
    ...(timeline ? [{ key: "timeline", label: LEADS_COPY.cardActions.timeline, href: timeline }] : []),
    { key: "open", label: LEADS_COPY.cardActions.open, onClick: () => onOpen?.(item) },
  ];

  return (
    <article
      className="crm-card crm-record crm-card--clickable"
      data-testid="lead-card"
      data-lead-id={id}
      data-kind={kind}
      data-selected={active ? "true" : undefined}
      style={active ? { borderColor: "var(--crm-blue)", background: "var(--crm-blue-50)" } : undefined}
      tabIndex={0}
      onClick={open}
      onKeyDown={onKeyDown}
    >
      {selectMode ? (
        <label className="crm-record__check" onClick={stop}>
          <input
            type="checkbox"
            checked={selected}
            onChange={(event) => onToggleSelect?.(id, event.target.checked)}
            aria-label={`Select ${name}`}
          />
        </label>
      ) : (
        <IconBadge icon={kind === "form" ? FileText : Phone} tone={leadTone(item)} />
      )}
      <div className="crm-record__body">
        <div className="crm-record__line crm-record__line--top">
          <span className="crm-record__name">{name}</span>
          <Pill variant={status.variant} title={status.title}>
            {status.label}
          </Pill>
          {priority ? <Pill variant="purple">{priority}</Pill> : null}
          {source ? <span className="crm-record__source">{source}</span> : null}
        </div>
        <div className="crm-record__line">
          {phone ? <span>{phone}</span> : null}
          {email ? <span className="crm-record__sep">{phone ? "· " : ""}{email}</span> : null}
          <span className="crm-record__right">
            <span title={formatAbsolute(item.timestamp)}>{formatRelative(item.timestamp, now)}</span>
            <Person name={agentName} fallback={LEADS_COPY.card.unassigned} />
          </span>
        </div>
        <div className="crm-record__line crm-record__line--money">
          {job ? (
            <>
              <span>Job {job}</span>
              <CopyJobButton jobNo={job} />
            </>
          ) : null}
          {route ? <span>{route}</span> : null}
          {item.move_date ? <span>{formatShortDate(item.move_date, now)}</span> : null}
          {sizeOrLocal ? <span>{sizeOrLocal}</span> : null}
          {estimate ? <span>est {estimate}</span> : <span style={{ color: "var(--crm-faint)" }}>{LEADS_COPY.card.noEstimate}</span>}
        </div>
        <div className="crm-record__line crm-record__line--evidence">
          {item.sms_message_sent === true ? <EvidenceChip state="ok">{LEADS_COPY.card.leadMessageSent}</EvidenceChip> : null}
          {chip ? (
            <EvidenceChip state={chip.state} title={chip.title}>
              {chip.text}
            </EvidenceChip>
          ) : null}
          {granotDiffers(item) ? <EvidenceChip state="warn">{LEADS_COPY.card.granotDiffers}</EvidenceChip> : null}
          {item.no_sync === true ? <EvidenceChip state="none">{LEADS_COPY.card.hidden}</EvidenceChip> : null}
          {duplicate ? <EvidenceChip state="none">{LEADS_COPY.card.duplicate}</EvidenceChip> : null}
        </div>
        <div className="crm-record__actions" onClick={stop} onKeyDown={stop}>
          {canBook(item) ? (
            <Link href={bookHref(kind, item)} className="crm-button crm-button--primary crm-button--sm">
              {LEADS_COPY.cardActions.book}
            </Link>
          ) : null}
          {roster && onAssign && !duplicate ? (
            <CrmSelect
              label={`${LEADS_COPY.cardActions.assign} ${name}`}
              value={agentId ?? ""}
              options={[{ value: "", label: agentId ? LEADS_COPY.cardActions.assign : LEADS_COPY.cardActions.assignPlaceholder }, ...roster]}
              onChange={(next) => {
                if (next && next !== agentId) onAssign(item, next);
              }}
            />
          ) : null}
          <OverflowMenu label={LEADS_COPY.cardActions.more} items={menu} />
        </div>
      </div>
    </article>
  );
}
