"use client";
/**
 * Close a booking to finish with No action (doc 06). Shared by the card (opened in place, without the sheet) and the
 * finish sheet: the same reasons, the same `expected_case_revision` lock, the same idempotency key that survives a
 * retry of the same body, the same 409 copy. It changes no lead, booking or sheet.
 */
import { useRef, useState } from "react";
import { CrmSelect } from "@/components/ui/crm/primitives";
import {
  GranotLifecycleApiError,
  resolveGranotBookingNoAction,
  type BookingNoActionBody,
  type BookingNoActionReasonCode,
} from "@/lib/api/granotLifecycle";
import { intakeOwnerCommandConflictCopy } from "./intake-copy";
import { FINISH_SHEET_COPY as COPY, NO_ACTION_NOTE_MAX, NO_ACTION_REASONS } from "./to-finish-copy";

export function useAttempt() {
  const ref = useRef<{ canonical: string; key: string } | undefined>(undefined);
  return {
    /** The same body keeps its Idempotency-Key across a retry; a changed body gets a new one. */
    keyFor(canonical: string): string {
      if (ref.current?.canonical !== canonical) ref.current = { canonical, key: crypto.randomUUID() };
      return ref.current.key;
    },
    clear() {
      ref.current = undefined;
    },
  };
}

export function NoActionPanel({
  caseId,
  caseRevision,
  commandsEnabled,
  onFiled,
  invalidate,
  onCancel,
}: {
  caseId: string;
  caseRevision: number;
  commandsEnabled: boolean;
  onFiled: (message: string) => void;
  invalidate: () => Promise<void>;
  /** Shown as a Cancel button when the panel opened in place on a card. */
  onCancel?: () => void;
}) {
  const [reason, setReason] = useState<BookingNoActionReasonCode | "">("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attempt = useAttempt();
  const noteId = `tf-no-action-note-${caseId}`;

  const close = async () => {
    const text = note.trim();
    if (text.length > NO_ACTION_NOTE_MAX) {
      setError(`The note can be at most ${NO_ACTION_NOTE_MAX} characters.`);
      return;
    }
    const body: BookingNoActionBody = {
      expected_case_revision: caseRevision,
      ...(reason ? { reason_code: reason } : {}),
      ...(text ? { reason_text: text } : {}),
    };
    setBusy(true);
    setError(null);
    try {
      await resolveGranotBookingNoAction(caseId, body, attempt.keyFor(JSON.stringify(body)));
      attempt.clear();
      onFiled(COPY.noActionDone);
      await invalidate();
    } catch (caught) {
      if (caught instanceof GranotLifecycleApiError && caught.status === 409) {
        setError(intakeOwnerCommandConflictCopy(caught.code));
        await invalidate();
      } else {
        setError(caught instanceof Error ? caught.message : "Unable to close this booking.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tf-noaction" data-testid="finish-booking-no-action">
      <strong>{COPY.noActionTitle}</strong>
      <p className="crm-subtitle" style={{ margin: 0 }}>{COPY.noActionHint}</p>
      <CrmSelect<BookingNoActionReasonCode | "">
        label={COPY.noActionReason}
        value={reason}
        options={[{ value: "", label: COPY.noActionNone }, ...NO_ACTION_REASONS]}
        onChange={setReason}
      />
      <label htmlFor={noteId} className="tf-row__label">
        {COPY.noActionNote}
      </label>
      <textarea id={noteId} className="crm-input" rows={3} maxLength={NO_ACTION_NOTE_MAX} value={note} onChange={(event) => setNote(event.target.value)} />
      {error ? <p role="alert" className="tf-errors">{error}</p> : null}
      {!commandsEnabled ? <p className="crm-subtitle" role="status" style={{ margin: 0 }}>{COPY.noActionOff}</p> : null}
      <div className="crm-record__actions" style={{ justifyContent: "flex-start" }}>
        <button type="button" className="crm-button crm-button--primary crm-button--sm" style={{ minHeight: 44 }} disabled={busy || !commandsEnabled} onClick={() => void close()}>
          {busy ? COPY.noActionClosing : COPY.noActionConfirm}
        </button>
        {onCancel ? (
          <button type="button" className="crm-button crm-button--quiet crm-button--sm" style={{ minHeight: 44 }} disabled={busy} onClick={onCancel}>
            {COPY.noActionCancel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
