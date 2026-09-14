"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback";
import {
  GranotLifecycleApiError,
  resolveGranotBookingNoAction,
  type GranotLifecycleCaseListItem,
} from "@/lib/api/granotLifecycle";
import { invalidateGranotLifecycleCommandViews } from "@/lib/query/granotLifecycle";
import { cn } from "@/lib/utils";
import {
  INTAKE_LIST_NO_ACTION,
  intakeCardPrimaryLabel,
  intakeListNoActionConflictCopy,
  intakePublicCancelHref,
  intakeShowsListNoAction,
  intakeShowsPublicCancel,
} from "./intake-copy";

export function IntakeCardActions({
  item,
  href,
  bookingCommandsEnabled = true,
  compact = false,
  onClosed,
}: {
  item: GranotLifecycleCaseListItem;
  href: string;
  bookingCommandsEnabled?: boolean;
  compact?: boolean;
  onClosed?: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const lastAttempt = useRef<{ revision: number; key: string } | undefined>(undefined);

  if (item.state !== "open") return null;

  const primaryLabel = intakeCardPrimaryLabel(item);
  const showNoAction = intakeShowsListNoAction(item, bookingCommandsEnabled);
  const cancelHref = intakeShowsPublicCancel(item) && item.deterministic_booking.id
    ? intakePublicCancelHref(item.deterministic_booking.id)
    : undefined;

  async function closeWithNoAction() {
    if (!window.confirm(INTAKE_LIST_NO_ACTION.confirm)) return;
    const revision = item.case_revision;
    const attempt = lastAttempt.current?.revision === revision
      ? lastAttempt.current
      : { revision, key: crypto.randomUUID() };
    lastAttempt.current = attempt;
    setSubmitting(true);
    setError(undefined);
    try {
      await resolveGranotBookingNoAction(
        item.case_id,
        {
          expected_case_revision: revision,
          reason_code: INTAKE_LIST_NO_ACTION.reason_code,
        },
        attempt.key,
      );
      lastAttempt.current = undefined;
      onClosed?.(INTAKE_LIST_NO_ACTION.success);
      await invalidateGranotLifecycleCommandViews(queryClient, {
        caseId: item.case_id,
        jobNo: item.normalized_job_no,
        bookingId: item.deterministic_booking.id,
      });
    } catch (caught) {
      const code = caught instanceof GranotLifecycleApiError ? caught.code : undefined;
      setError(intakeListNoActionConflictCopy(code));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={cn("space-y-1", compact && "text-right")}>
      <div className={cn("flex flex-wrap gap-2", compact && "justify-end")}>
        {showNoAction ? (
          <Button
            type="button"
            className={compact ? "h-8 px-3" : undefined}
            disabled={submitting}
            onClick={() => { void closeWithNoAction(); }}
          >
            {submitting ? "Closing…" : "No Action"}
          </Button>
        ) : null}
        <Link
          className={cn(
            "inline-flex items-center rounded-md px-3 text-sm font-semibold",
            compact ? "h-8" : "h-9",
            showNoAction
              ? "border border-input bg-background text-navy hover:bg-steel-100"
              : "bg-primary text-white hover:bg-navy",
          )}
          href={href}
        >
          {primaryLabel}
        </Link>
      </div>
      {cancelHref ? (
        <p>
          <Link className="text-xs font-medium text-muted-foreground hover:underline" href={cancelHref}>
            Cancel this booking
          </Link>
        </p>
      ) : null}
      {error ? <FeedbackMessage tone="error">{error}</FeedbackMessage> : null}
    </div>
  );
}
