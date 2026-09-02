"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback";
import { OPERATIONAL_COPY } from "@/components/operational/operational-copy";
import { invalidateOperationalMutations } from "@/components/operational/operational-helpers";
import {
  getRecordId,
  updateFormLeadBadLead,
  type AdminRecord,
} from "@/lib/api/admin";
import {
  FORM_LEAD_BAD_LEAD_LABELS,
  FORM_LEAD_BAD_LEAD_REASON_OPTIONS,
  type FormLeadBadLeadReason,
} from "@/lib/constants/domain";

function isFormLeadBadLeadReason(value: unknown): value is FormLeadBadLeadReason {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(FORM_LEAD_BAD_LEAD_LABELS, value)
  );
}

export function formatBadLead(value: unknown): string {
  return isFormLeadBadLeadReason(value) ? FORM_LEAD_BAD_LEAD_LABELS[value] : "";
}

function canMarkFormLeadBad(record: AdminRecord): boolean {
  return !record.duplicate && !record.booked && !record.cancelled;
}

export function MarkBadLeadControl({
  record,
  compact = false,
  onSaved,
}: {
  record: AdminRecord;
  compact?: boolean;
  onSaved?: () => void;
}) {
  const queryClient = useQueryClient();
  const currentBadLead = isFormLeadBadLeadReason(record.bad_lead) ? record.bad_lead : "";
  const [selectedReason, setSelectedReason] = useState(currentBadLead);
  const [message, setMessage] = useState<string | null>(null);
  const [compactOpen, setCompactOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [popoverPosition, setPopoverPosition] = useState({ left: 0, top: 0 });
  const eligible = canMarkFormLeadBad(record);
  const mutation = useMutation({
    mutationFn: (badLead: string | null) =>
      updateFormLeadBadLead<AdminRecord>(getRecordId(record), badLead),
    onSuccess: async () => {
      await invalidateOperationalMutations(queryClient);
      setMessage("Bad Lead status updated.");
      onSaved?.();
    },
    onError: (error) =>
      setMessage(error instanceof Error ? error.message : "Bad Lead update failed."),
  });

  const canSubmit = selectedReason !== currentBadLead;
  const isMarkedBad = Boolean(currentBadLead);
  const updatePopoverPosition = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) {
      return;
    }

    const margin = 12;
    const gap = 8;
    const width = 288;
    const anchorRect = anchor.getBoundingClientRect();
    const popoverHeight = popoverRef.current?.offsetHeight ?? 260;
    const left = Math.min(
      Math.max(anchorRect.left, margin),
      Math.max(margin, window.innerWidth - width - margin),
    );
    const belowTop = anchorRect.bottom + gap;
    const top =
      belowTop + popoverHeight + margin > window.innerHeight && anchorRect.top > popoverHeight + margin
        ? anchorRect.top - popoverHeight - gap
        : belowTop;

    setPopoverPosition({ left, top: Math.max(margin, top) });
  }, []);

  useLayoutEffect(() => {
    if (!compactOpen) {
      return;
    }

    updatePopoverPosition();
  }, [compactOpen, updatePopoverPosition, selectedReason, message]);

  useEffect(() => {
    if (!compactOpen) {
      return;
    }

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (anchorRef.current?.contains(target) || popoverRef.current?.contains(target)) {
        return;
      }
      setCompactOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setCompactOpen(false);
      }
    }

    window.addEventListener("resize", updatePopoverPosition);
    window.addEventListener("scroll", updatePopoverPosition, true);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("resize", updatePopoverPosition);
      window.removeEventListener("scroll", updatePopoverPosition, true);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [compactOpen, updatePopoverPosition]);

  if (!eligible) {
    return compact ? null : (
      <FeedbackMessage tone="warning">
        Bad Lead can only be changed for non-booked, non-cancelled form leads.
      </FeedbackMessage>
    );
  }

  if (compact) {
    const compactPopover =
      compactOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={popoverRef}
              className="fixed z-50 w-72 rounded-lg border bg-background p-3 shadow-xl"
              style={{ left: popoverPosition.left, top: popoverPosition.top }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-navy">Bad Lead Reason</p>
                  <p className="text-xs text-muted-foreground">Applies to this form lead only.</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-7 w-7 px-0"
                  onClick={() => setCompactOpen(false)}
                  aria-label="Close bad lead menu"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
              <select
                value={selectedReason}
                onChange={(event) => setSelectedReason(event.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">{isMarkedBad ? "Clear Bad Lead" : "Choose reason"}</option>
                {FORM_LEAD_BAD_LEAD_REASON_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {message ? (
                <p className="mt-2 text-xs text-muted-foreground">{message}</p>
              ) : null}
              <div className="mt-3 flex justify-end gap-2">
                <Button type="button" variant="outline" className="h-8 px-3 text-xs" onClick={() => setCompactOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant={selectedReason ? "destructive" : "outline"}
                  disabled={mutation.isPending || !canSubmit}
                  className="h-8 px-3 text-xs"
                  onClick={() => {
                    mutation.mutate(selectedReason || null, {
                      onSuccess: () => setCompactOpen(false),
                    });
                  }}
                >
                  {mutation.isPending ? "Saving..." : selectedReason ? "Mark Bad" : isMarkedBad ? "Clear Bad" : "Save"}
                </Button>
              </div>
            </div>,
            document.body,
          )
        : null;

    return (
      <div ref={anchorRef} className="inline-flex" onClick={(event) => event.stopPropagation()}>
        <Button
          type="button"
          variant={isMarkedBad ? "destructive" : "outline"}
          className="h-7 gap-1 px-2 text-[11px] font-semibold normal-case tracking-normal"
          onClick={() => setCompactOpen((current) => !current)}
          aria-expanded={compactOpen}
          aria-label={isMarkedBad ? formatBadLead(currentBadLead) || "Bad Lead" : "Bad Lead"}
        >
          <span className="max-w-24 truncate">{isMarkedBad ? formatBadLead(currentBadLead) : OPERATIONAL_COPY.row.badLeadAction}</span>
          <ChevronDown className="h-3 w-3" aria-hidden="true" />
        </Button>
        {compactPopover}
      </div>
    );
  }

  return (
    <div className={compact ? "flex min-w-[230px] items-center gap-2" : "space-y-3"}>
      {message && !compact ? (
        <FeedbackMessage tone={mutation.isError ? "error" : "success"}>{message}</FeedbackMessage>
      ) : null}
      <div className={compact ? "flex items-center gap-2" : "flex flex-wrap items-end gap-2"}>
        <label className={compact ? "flex items-center" : "grid gap-1 text-sm font-medium"}>
          <span className={compact ? "sr-only" : undefined}>
            {!compact ? "Bad Lead Reason" : "Bad Lead"}
          </span>
          <select
            value={selectedReason}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => setSelectedReason(event.target.value)}
            className={
              compact
                ? "h-8 w-36 rounded-md border border-input bg-background px-2 text-xs"
                : "flex h-10 min-w-60 rounded-md border border-input bg-background px-3 py-2 text-sm"
            }
          >
            <option value="">{isMarkedBad ? "Clear Bad Lead" : "Choose reason"}</option>
            {FORM_LEAD_BAD_LEAD_REASON_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <Button
          type="button"
          variant={selectedReason ? "destructive" : "outline"}
          disabled={mutation.isPending || !canSubmit}
          onClick={(event) => {
            event.stopPropagation();
            mutation.mutate(selectedReason || null);
          }}
          className={compact ? "h-8 px-3 text-xs" : undefined}
        >
          {mutation.isPending ? "Saving..." : selectedReason ? "Mark Bad" : isMarkedBad ? "Clear Bad" : "Mark Bad"}
        </Button>
      </div>
      {compact && isMarkedBad ? (
        <span className="text-xs text-muted-foreground">{formatBadLead(currentBadLead)}</span>
      ) : null}
    </div>
  );
}
