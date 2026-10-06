"use client";
/**
 * One booking to finish (doc 06 / doc 03 "One card frame, three kinds"): the amber clock circle with the age, the job
 * number, the customer, the source, what Granot did and when, the move and money line, the two-customers warning,
 * **No action** (closes the case in place, without opening the sheet; 2026-10-06) and one Finish / Review button.
 * Pure over props: the page owns which card has its No action panel open.
 */
import type { KeyboardEvent, MouseEvent } from "react";
import { Clock } from "lucide-react";
import { formatAbsolute, formatAge } from "@/components/ui/crm/format";
import { CopyJobButton, EvidenceChip, IconBadge, OverflowMenu, Person } from "@/components/ui/crm/primitives";
import { finishModeOf, granotAgeLine, moveMoneyLine, possibleCustomerCount } from "@/lib/api/bookingsToFinish";
import type { GranotLifecycleCaseListItem } from "@/lib/api/granotLifecycle";
import { buildJobTimelineHref } from "@/lib/api/jobNumberTimeline";
import { granotUpdateCountLine } from "./intake-copy";
import { NoActionPanel } from "./no-action-panel";
import { TO_FINISH_COPY } from "./to-finish-copy";

const stop = (event: MouseEvent | KeyboardEvent) => event.stopPropagation();

export function ToFinishCard({
  item,
  active = false,
  onOpen,
  now,
  noActionOpen = false,
  commandsEnabled = false,
  onToggleNoAction,
  onNoActionDone,
  invalidate,
}: {
  item: GranotLifecycleCaseListItem;
  active?: boolean;
  onOpen?: (item: GranotLifecycleCaseListItem) => void;
  now?: Date;
  /** Whether this card's No action panel is open (the page keeps one open at a time). */
  noActionOpen?: boolean;
  /** The booking-commands flag; the panel says so when it is off. */
  commandsEnabled?: boolean;
  onToggleNoAction?: (item: GranotLifecycleCaseListItem) => void;
  onNoActionDone?: (item: GranotLifecycleCaseListItem, message: string) => void;
  invalidate?: (item: GranotLifecycleCaseListItem) => Promise<void>;
}) {
  const mode = finishModeOf(item.mode);
  const summary = item.case_file_summary;
  const moveLine = moveMoneyLine(summary, now);
  const twoCustomers = mode === "create" && possibleCustomerCount(item) >= 2;
  const source = item.source.label ?? item.source.id ?? "";
  const age = formatAge(item.last_evidence_at, now?.getTime());
  const timeline = item.job_no ? buildJobTimelineHref({ job: item.job_no }) : null;
  const rep = summary?.rep?.trim();

  const open = () => onOpen?.(item);
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
      data-testid="to-finish-card"
      data-case-id={item.case_id}
      data-mode={mode}
      data-selected={active ? "true" : undefined}
      style={active ? { borderColor: "var(--crm-blue)", background: "var(--crm-blue-50)" } : undefined}
      tabIndex={0}
      onClick={open}
      onKeyDown={onKeyDown}
    >
      <div className="tf-clock">
        <IconBadge icon={Clock} tone="amber" />
        <span className="tf-clock__age" title={formatAbsolute(item.last_evidence_at)}>
          {age}
        </span>
      </div>
      <div className="crm-record__body">
        <div className="crm-record__line crm-record__line--top">
          <span className="crm-record__name">{item.job_no}</span>
          <span>{item.customer_label || TO_FINISH_COPY.customerFallback}</span>
          {source ? <span className="crm-record__source">{source}</span> : null}
        </div>
        <div className="crm-record__line">
          <span title={formatAbsolute(item.last_evidence_at)}>{granotAgeLine(item, now?.getTime())}</span>
          <span className="crm-record__sep">· {TO_FINISH_COPY.updates(item.evidence_count)}</span>
          <span className="sr-only">{granotUpdateCountLine(item.evidence_count)}</span>
        </div>
        {moveLine ? (
          <div className="crm-record__line crm-record__line--money" data-testid="to-finish-move-line">
            {moveLine}
          </div>
        ) : null}
        <div className="crm-record__line crm-record__line--evidence">
          {twoCustomers ? <EvidenceChip state="warn">{TO_FINISH_COPY.twoCustomers}</EvidenceChip> : null}
          {mode === "review" ? <EvidenceChip state="none">{TO_FINISH_COPY.officialExists}</EvidenceChip> : null}
          {mode === "referral" ? <EvidenceChip state="none">{TO_FINISH_COPY.referral}</EvidenceChip> : null}
          {rep ? (
            <span className="crm-record__right">
              <span className="sr-only">{TO_FINISH_COPY.rep}</span>
              <Person name={rep} />
            </span>
          ) : null}
        </div>
        <div className="crm-record__actions" onClick={stop} onKeyDown={stop}>
          <OverflowMenu
            label={`More actions for job ${item.job_no}`}
            items={timeline ? [{ key: "timeline", label: TO_FINISH_COPY.openTimeline, href: timeline }] : []}
          />
          <CopyJobButton jobNo={item.job_no} />
          <button
            type="button"
            className="crm-button crm-button--quiet"
            style={{ minHeight: 44 }}
            aria-label={TO_FINISH_COPY.noActionFor(item.job_no)}
            aria-expanded={noActionOpen}
            onClick={() => onToggleNoAction?.(item)}
          >
            {TO_FINISH_COPY.noAction}
          </button>
          <button type="button" className="crm-button crm-button--primary" style={{ minHeight: 44 }} onClick={open}>
            {mode === "review" ? TO_FINISH_COPY.review : TO_FINISH_COPY.finish}
          </button>
        </div>
        {noActionOpen ? (
          <div onClick={stop} onKeyDown={stop}>
            <NoActionPanel
              caseId={item.case_id}
              caseRevision={item.case_revision}
              commandsEnabled={commandsEnabled}
              onFiled={(message) => onNoActionDone?.(item, message)}
              invalidate={() => invalidate?.(item) ?? Promise.resolve()}
              onCancel={() => onToggleNoAction?.(item)}
            />
          </div>
        ) : null}
      </div>
    </article>
  );
}
