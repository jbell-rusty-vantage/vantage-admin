"use client";
/** The one confirmation dialog (doc 17): what will change, which plan, then Apply. Never shows the full checksum. */
import { useEffect } from "react";
import { formatTime } from "@/components/ui/crm/format";
import type { GranotAction, GranotRun } from "@/lib/api/granotAutomation";
import { approvalSummary, planShortId } from "@/lib/automations/granot-updates-model";
import { CHECK_COPY } from "./check-copy";
import { GRANOT_UPDATES_COPY } from "./granot-updates-copy";

const DIALOG = GRANOT_UPDATES_COPY.review.dialog;

export function ApproveDialog({
  selected,
  pending,
  onCancel,
  onConfirm,
}: {
  selected: Array<{ run: GranotRun; action: GranotAction }>;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const updates = selected.length;
  const leads = new Set(selected.map(({ action }) => action.lead_id).filter(Boolean)).size || updates;
  const planRun = selected[0]?.run;
  return (
    <>
      <button type="button" className="crm-scrim" aria-label={DIALOG.cancel} onClick={onCancel} />
      <div className="crm-card gu-check-dialog" role="dialog" aria-modal="true" aria-label={CHECK_COPY.approveLabel}>
        <h2 className="crm-card__title">{DIALOG.title(updates, leads)}</h2>
        <p>{approvalSummary(selected.map(({ run, action }) => ({ operation: run.operation, action })))}</p>
        {planRun ? <p className="crm-small crm-text-muted">{DIALOG.plan(planShortId(planRun.plan_checksum), formatTime(planRun.updated_at ?? planRun.created_at))}</p> : null}
        <div className="su-actions">
          <button type="button" className="crm-button" onClick={onCancel} disabled={pending}>
            {DIALOG.cancel}
          </button>
          <button type="button" className="crm-button crm-button--primary" onClick={onConfirm} disabled={pending || updates === 0}>
            {pending ? DIALOG.applying : DIALOG.confirm(updates)}
          </button>
        </div>
      </div>
    </>
  );
}
