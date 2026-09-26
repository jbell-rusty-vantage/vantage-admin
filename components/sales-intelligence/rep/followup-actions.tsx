"use client";
/**
 * UI2-FOLLOWUP (UI-2 §4, E9; A06, A07): the rep's own follow-up actions, on the Work tab's follow-up list and nowhere else.
 *
 * - **Which follow-ups.** "Own" is the rep being the follow-up's responsible agent (`assignment.agent.id`, CF8 capture
 *   notes); the server refuses everything else. The detail read lists the Owner's `allowed_actions[]` on every follow-up,
 *   so an action shows only on an open, own follow-up whose `allowed_actions[]` has it enabled: `Complete`
 *   (`complete_followup`), `Snooze` (`snooze_followup`), `Change date` (`patch_followup`, `due_at` only).
 * - **Read-only reasons.** Another rep's follow-up → `{name} owns this follow-up.` (the responsible agent, else the rep
 *   who promised it); one the rep only promised → `promisedOnly`; no responsible agent and no promise → `Set by the Owner.`
 * - **The sheet.** Full screen at ≤ 480 px, a centred dialog above (`Sheet variant="full"`). The note is focused on open
 *   and `Send` stays disabled until it has a visible character. Snooze and Change date take an Eastern date and time
 *   whose `min` is the read's `as_of` and whose `max` is `as_of` + 60 days (never the browser clock). Complete asks what
 *   happened (the server requires a `disposition`).
 * - **Requests** are the `contracts/S8/rep-command__*-own.json` bodies, sent with an `Idempotency-Key` through
 *   `sendSalesIntelligence` (the Owner commands' helper). A retry after an unknown outcome reuses the same key.
 * - **Errors:** `INVALID_INPUT` on a dated command → `Pick a date within 60 days.`; `FORBIDDEN` → `You can't change this
 *   follow-up. Ask the Owner.`; `REVISION_CONFLICT` → `errors.stale`; anything else → `errors.generic`.
 * - **After success** the sheet closes, `Saved. The Owner sees your change.` shows, and the record's detail, timeline,
 *   list and Overview reads are invalidated (the live stream refreshes them too).
 */
import { useQueryClient } from "@tanstack/react-query";
import { useId, useRef, useState } from "react";
import { SalesIntelligenceError, sendSalesIntelligence, type CommandIntent, type Followup, type Outreach } from "@/lib/api/salesIntelligence";
import { salesIntelligenceKeys } from "@/lib/query/salesIntelligence";
import { FollowupCard } from "../followup-card";
import { easternInput, easternInstant } from "../lib/commands";
import { Sheet } from "../primitives";
import { copy } from "../sales-intelligence-copy";
import { useViewer } from "./viewer";
import type { Viewer } from "./viewer-session";

const k = copy.ui2.followup;

export const REP_FOLLOWUP_ACTIONS = ["complete_followup", "snooze_followup", "patch_followup"] as const;
export type RepFollowupAction = (typeof REP_FOLLOWUP_ACTIONS)[number];
/** Snooze and Change date carry a date; Complete doesn't. */
export const isDated = (action: RepFollowupAction) => action !== "complete_followup";
/** V-T3 m1: a rep's re-date or snooze lands at most 60 days after now; the picker counts from the read's `as_of`. */
export const REP_DATE_CAP_DAYS = 60;
const DAY_MS = 86_400_000;
export const COMPLETE_OUTCOMES = ["spoke_with_customer", "completed", "no_answer", "left_voicemail", "customer_called", "connected_contact_unknown"] as const;

export type RepFollowupAccess = { actions: RepFollowupAction[]; readOnly: string | null };

/**
 * What the rep may do on one follow-up. Open follow-ups only; a closed one (completed, cancelled, replaced) has neither
 * actions nor a sentence. The comparisons are server ids against the session's Agent id.
 */
export function repFollowupAccess(f: Pick<Followup, "status" | "assignment" | "promised_by" | "allowed_actions">, viewer: Viewer): RepFollowupAccess {
  if (f.status !== "open") return { actions: [], readOnly: null };
  const responsible = f.assignment.agent;
  const me = viewer.agentId;
  if (me && responsible?.id === me) {
    const actions = REP_FOLLOWUP_ACTIONS.filter((action) => f.allowed_actions.some((a) => a.action === action && a.enabled));
    return { actions, readOnly: null };
  }
  if (responsible) return { actions: [], readOnly: k.readOnly.otherRep(responsible.name) };
  if (me && f.promised_by?.id === me) return { actions: [], readOnly: k.readOnly.promisedOnly };
  if (f.promised_by?.name) return { actions: [], readOnly: k.readOnly.promisedByOther(f.promised_by.name) };
  return { actions: [], readOnly: k.readOnly.owner };
}

/** The picker's bounds as Eastern `datetime-local` values: `min` = `as_of`, `max` = `as_of` + 60 days. */
export function repDateBounds(asOf: string): { min: string; max: string; maxIso: string } {
  const start = Date.parse(asOf);
  const maxIso = new Date(start + REP_DATE_CAP_DAYS * DAY_MS).toISOString();
  return { min: easternInput(asOf).slice(0, 16), max: easternInput(maxIso).slice(0, 16), maxIso };
}

/** True when the note has a visible character (a blank or whitespace note can't be sent; the server's 400 is generic). */
export const noteReady = (note: string) => note.trim().length > 0;

/** The request for one action (the `rep-command__*-own.json` bodies). `dueIso` is the picked instant for a dated action. */
export function repFollowupIntent({ action, followup, note, dueIso, disposition, key }: {
  action: RepFollowupAction;
  followup: Pick<Followup, "id" | "revision">;
  note: string;
  dueIso?: string | null;
  disposition?: string;
  key: string;
}): CommandIntent {
  const text = note.trim();
  if (!text) throw new Error(k.noteHint);
  const base = { command: action, expected_revision: followup.revision };
  const path = `followups/${encodeURIComponent(followup.id)}`;
  if (action === "complete_followup") {
    return { path: `${path}/complete`, method: "POST", body: { ...base, disposition: disposition ?? "completed", note: text }, key };
  }
  if (!dueIso) throw new Error(k.dateRequired);
  if (action === "snooze_followup") return { path: `${path}/snooze`, method: "POST", body: { ...base, until: dueIso, reason: text }, key };
  return { path, method: "PATCH", body: { ...base, changes: { due_at: dueIso }, reason: text }, key };
}

/** The sentence for a refused or failed action. */
export function repFollowupErrorText(error: unknown, action: RepFollowupAction): string {
  const code = error instanceof SalesIntelligenceError ? error.code : error && typeof error === "object" ? (error as { code?: unknown }).code : null;
  const status = error instanceof SalesIntelligenceError ? error.status : null;
  if (code === "INVALID_INPUT" && isDated(action)) return k.errors.tooFar;
  if (code === "FORBIDDEN") return k.errors.forbidden;
  if (code === "REVISION_CONFLICT" || status === 409) return k.errors.stale;
  return k.errors.generic;
}

/** An unknown outcome (5xx or no answer): keep the idempotency key so a retry recovers the saved result. */
const keepKey = (error: unknown) => !(error instanceof SalesIntelligenceError) || error.status >= 500;

/** Every read the change shows up in: the record, its timeline, the lists and the Overview. */
export function invalidateAfterRepAction(client: ReturnType<typeof useQueryClient>, outreachId: string) {
  const all = salesIntelligenceKeys.all;
  return Promise.all([
    client.invalidateQueries({ queryKey: [...all, "outreach", outreachId] }),
    client.invalidateQueries({ queryKey: [...all, "timeline", "outreach", outreachId] }),
    client.invalidateQueries({ queryKey: [...all, "attention"] }),
    client.invalidateQueries({ queryKey: [...all, "overview"] }),
  ]);
}

/** Sends one intent (the gallery passes a stand-in that never reaches the API). */
export type RepSend = (intent: CommandIntent) => Promise<unknown>;

export type RepFollowupSheetProps = {
  action: RepFollowupAction;
  followup: Followup;
  outreachId: string;
  /** The detail read's `as_of`: the date bounds count from it. */
  asOf: string;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  /** Tests and the gallery: the sheet's starting note / date (never sent without the user). */
  initialNote?: string;
  initialDate?: string;
  /** Default `sendSalesIntelligence`. */
  send?: RepSend;
  /** The gallery's static sample (see `Sheet`). */
  inline?: boolean;
};

/** One action's sheet: the note (focused), the date or the outcome, and Send / Cancel. */
export function RepFollowupSheet({ action, followup, outreachId, asOf, open, onClose, onDone, initialNote = "", initialDate = "", send: post = sendSalesIntelligence, inline = false }: RepFollowupSheetProps) {
  const client = useQueryClient();
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const noteId = useId();
  const hintId = useId();
  const dateId = useId();
  const dateHintId = useId();
  const outcomeId = useId();
  const [note, setNote] = useState(initialNote);
  const [date, setDate] = useState(initialDate);
  const [disposition, setDisposition] = useState<string>(COMPLETE_OUTCOMES[0]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intent = useRef<CommandIntent | null>(null);
  const dated = isDated(action);
  const bounds = repDateBounds(asOf);
  const canSend = noteReady(note) && (!dated || !!date) && !pending;

  const edit = (apply: () => void) => {
    apply();
    intent.current = null;
    setError(null);
  };

  async function send() {
    if (!canSend) return;
    let dueIso: string | null = null;
    if (dated) {
      try {
        dueIso = easternInstant(date);
      } catch {
        setError(k.dateRequired);
        return;
      }
      if (!dueIso) return setError(k.dateRequired);
      // The picker's `max` already stops a later date; a typed one is caught here before any request.
      if (Date.parse(dueIso) > Date.parse(bounds.maxIso)) return setError(k.errors.tooFar);
    }
    setPending(true);
    setError(null);
    try {
      intent.current ??= repFollowupIntent({ action, followup, note, dueIso, disposition, key: crypto.randomUUID() });
      await post(intent.current);
      intent.current = null;
      await invalidateAfterRepAction(client, outreachId);
      onDone();
    } catch (cause) {
      if (!keepKey(cause)) intent.current = null;
      setError(repFollowupErrorText(cause, action));
    } finally {
      setPending(false);
    }
  }

  const footer = (
    <>
      <button type="button" className="si-btn si-btn--secondary si-btn--md si-hit" disabled={pending} onClick={onClose} data-action="cancel">
        {k.cancel}
      </button>
      <button type="submit" form={`${noteId}-form`} className="si-btn si-btn--primary si-btn--md si-hit" disabled={!canSend} aria-busy={pending || undefined} data-action="send">
        {pending ? k.sending : k.send}
      </button>
    </>
  );

  return (
    <Sheet open={open} onClose={onClose} title={k.titles[action]} footer={footer} variant="full" busy={pending} initialFocus={noteRef} className="si-repfollowup__sheet" closeLabel={k.close} inline={inline}>
      <form
        id={`${noteId}-form`}
        className="si-repfollowup__form"
        data-rep-action={action}
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <p className="si-repfollowup__context">{followup.description}</p>
        {dated && (
          <div className="si-field">
            <label htmlFor={dateId} className="si-field__label">{k.dateLabel[action]}</label>
            <input
              id={dateId}
              className="si-input si-repfollowup__date"
              type="datetime-local"
              step={60}
              min={bounds.min}
              max={bounds.max}
              value={date}
              required
              aria-describedby={dateHintId}
              onChange={(event) => edit(() => setDate(event.target.value))}
            />
            <span id={dateHintId} className="si-field__hint">{k.dateHint} {k.dateZone}</span>
          </div>
        )}
        {action === "complete_followup" && (
          <div className="si-field">
            <label htmlFor={outcomeId} className="si-field__label">{k.outcomeLabel}</label>
            <select id={outcomeId} className="si-input si-select si-repfollowup__outcome" value={disposition} onChange={(event) => edit(() => setDisposition(event.target.value))}>
              {COMPLETE_OUTCOMES.map((value) => <option key={value} value={value}>{k.outcomes[value]}</option>)}
            </select>
          </div>
        )}
        <div className="si-field">
          <label htmlFor={noteId} className="si-field__label">{k.noteLabel}</label>
          <textarea
            ref={noteRef}
            id={noteId}
            className="si-input si-textarea si-repfollowup__note"
            maxLength={500}
            rows={4}
            required
            autoFocus={!inline}
            placeholder={k.notePlaceholder}
            aria-describedby={hintId}
            value={note}
            onChange={(event) => edit(() => setNote(event.target.value))}
          />
          <span id={hintId} className="si-field__hint">{k.noteHint}</span>
        </div>
        {error && <p className="si-repfollowup__error" role="alert">{error}</p>}
      </form>
    </Sheet>
  );
}

/** The actions (or the read-only sentence) under one follow-up card. */
export function RepFollowupActions({ followup, outreachId, asOf, onDone, send }: { followup: Followup; outreachId: string; asOf: string; onDone: () => void; send?: RepSend }) {
  const viewer = useViewer();
  const { actions, readOnly } = repFollowupAccess(followup, viewer);
  const [active, setActive] = useState<RepFollowupAction | null>(null);
  if (!actions.length) {
    return readOnly ? <p className="si-repfollowup__readonly si-text--sm si-text--subtle" data-read-only={followup.id}>{readOnly}</p> : null;
  }
  return (
    <div className="si-repfollowup__actions" role="group" aria-label={k.actionsLabel(followup.description)} data-followup-actions={followup.id}>
      {actions.map((action) => (
        <button key={action} type="button" className="si-btn si-btn--secondary si-btn--md si-hit" data-rep-command={action} aria-haspopup="dialog" onClick={() => setActive(action)}>
          {k.actions[action]}
        </button>
      ))}
      {active && (
        <RepFollowupSheet
          key={`${active}:${followup.id}:${followup.revision}`}
          action={active}
          followup={followup}
          outreachId={outreachId}
          asOf={asOf}
          open
          send={send}
          onClose={() => setActive(null)}
          onDone={() => {
            setActive(null);
            onDone();
          }}
        />
      )}
    </div>
  );
}

/**
 * The rep's Work tab follow-ups: open ones first, each with its card and the rep's actions or read-only sentence, then
 * the finished ones under a disclosure. Replaces the Owner's `FollowupsSection` (whose commands are the Owner's).
 */
export function RepFollowups({ record, asOf, send }: { record: Outreach; asOf: string; send?: RepSend }) {
  const w = copy.ui1.outreach.work;
  const [saved, setSaved] = useState(false);
  const open = record.followups.filter((f) => f.status === "open");
  const done = record.followups.filter((f) => f.status !== "open");
  return (
    <section className="si-local-stack si-repfollowups" aria-label={w.followupsTitle} data-viewer="rep">
      <h3 className="si-heading si-heading--3">{w.followupsTitle}</h3>
      {saved && <p className="si-repfollowup__done" role="status">{k.done}</p>}
      {open.map((f) => (
        <div className="si-local-stack si-repfollowup" key={f.id} data-followup={f.id}>
          <FollowupCard followup={f} overallOwner={record.assignment.agent} asOf={asOf} />
          <RepFollowupActions followup={f} outreachId={record.id} asOf={asOf} onDone={() => setSaved(true)} send={send} />
        </div>
      ))}
      {!open.length && <p className="si-time is-null">{w.noFollowups}</p>}
      {!!done.length && (
        <details>
          <summary className="si-hit">{copy.panel.completedFollowups} ({done.length})</summary>
          <div className="si-local-stack">{done.map((f) => <FollowupCard key={f.id} followup={f} overallOwner={record.assignment.agent} asOf={asOf} />)}</div>
        </details>
      )}
      {record.followups_cursor && <p className="si-text--sm si-text--subtle">{w.moreFollowups}</p>}
    </section>
  );
}
