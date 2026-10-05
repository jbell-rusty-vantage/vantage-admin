"use client";
/**
 * Message (an Account row action): the existing RingCentral message flow (`/nudges/preview`, then `/nudges`) in the desk
 * look. The Owner writes a short note, previews exactly what will be sent and on which channels the server allows it,
 * then sends. It never names a customer and never goes to a phone number. Sending is an explicit second click.
 */
import { useId, useState } from "react";
import { Send, X } from "lucide-react";
import { NUDGE_CHANNELS, type Account, type NudgeChannel, type NudgePreview, type NudgeSendResult } from "@/lib/api/allNumbers";
import { isSalesOutreachApiError } from "@/lib/api/salesOutreach";
import { isRevisionConflict, useNudgePreview, useNudgeSend } from "../data/use-numbers";
import { deskCopy } from "../outreach-desk-copy";

const c = deskCopy.message;

function errorText(error: unknown): string {
  if (isRevisionConflict(error)) return deskCopy.accounts.conflict;
  return deskCopy.errors.failed(isSalesOutreachApiError(error) ? error.message : null);
}

export function MessagePanel({ account, onClose }: { account: Account; onClose: () => void }) {
  const channelId = useId();
  const bodyId = useId();
  const name = account.name ?? deskCopy.accounts.unnamed;
  // The server names the channels this User can get (`message_channels`); an older server falls back to Team Messaging,
  // its default channel. Never guess pager: it is off unless the server enables it.
  const offered = account.message_channels?.length ? account.message_channels : null;
  const [channel, setChannel] = useState<NudgeChannel>(offered?.[0] ?? "team_messaging");
  const [body, setBody] = useState("");
  const [preview, setPreview] = useState<NudgePreview | null>(null);
  const [sent, setSent] = useState<NudgeSendResult | null>(null);
  const previewCommand = useNudgePreview();
  const sendCommand = useNudgeSend();
  const allowed = preview
    ? NUDGE_CHANNELS.filter((value) => preview.allowed_channels.includes(value))
    : NUDGE_CHANNELS.filter((value) => (offered ?? NUDGE_CHANNELS).includes(value));
  const canMessage = account.can_message && Boolean(account.rc_account_id);
  const busy = previewCommand.isPending || sendCommand.isPending;

  const runPreview = () => {
    setSent(null);
    previewCommand.mutate({ account, channel, body }, { onSuccess: (result) => setPreview(result.data) });
  };
  const runSend = () => sendCommand.mutate({ account, channel, body }, { onSuccess: (result) => setSent(result.data) });

  return (
    <aside className="od-card od-lead" aria-label={c.region} data-testid="message-panel">
      <button type="button" className="od-lead__close od-button od-button--quiet" onClick={onClose} aria-label={c.close}>
        <X aria-hidden="true" />
      </button>
      <div className="od-lead__body">
        <div className="od-panelhead">
          <h2 className="od-lead__job od-lead__job--sm">{c.title(name)}</h2>
          <p className="od-lead__muted">{c.intro}</p>
        </div>
        {!canMessage ? (
          <p className="od-lead__muted" role="status">
            {c.noAccount}
          </p>
        ) : (
          <form
            className="od-message"
            onSubmit={(event) => {
              event.preventDefault();
              if (preview) runSend();
              else runPreview();
            }}
          >
            <div className="od-lead__control">
              <label htmlFor={channelId} className="od-lead__label">
                {c.channel}
              </label>
              <select
                id={channelId}
                className="od-select od-select--plain"
                value={channel}
                disabled={busy || Boolean(sent)}
                onChange={(event) => {
                  setChannel(event.target.value as NudgeChannel);
                  setPreview(null);
                }}
              >
                {allowed.map((value) => (
                  <option key={value} value={value}>
                    {c.channels[value]}
                  </option>
                ))}
              </select>
            </div>
            <div className="od-lead__control">
              <label htmlFor={bodyId} className="od-lead__label">
                {c.body}
              </label>
              <textarea
                id={bodyId}
                className="od-input od-textarea"
                maxLength={1000}
                value={body}
                placeholder={c.placeholder}
                disabled={busy || Boolean(preview) || Boolean(sent)}
                onChange={(event) => setBody(event.target.value)}
              />
            </div>
            {preview && !sent ? (
              <div className="od-preview" data-testid="message-preview">
                <p className="od-lead__label">{c.previewTitle}</p>
                <p className="od-preview__body">{preview.body}</p>
              </div>
            ) : null}
            {previewCommand.error ? (
              <p className="od-lead__error" role="alert">
                {errorText(previewCommand.error)}
              </p>
            ) : null}
            {sendCommand.error ? (
              <p className="od-lead__error" role="alert">
                {errorText(sendCommand.error)}
              </p>
            ) : null}
            {sent ? (
              <p className={sent.nudge.status === "failed" ? "od-lead__error" : "od-lead__ok"} role="status">
                {c.statuses[sent.nudge.status] ?? c.statuses.pending}
              </p>
            ) : (
              <div className="od-lead__row">
                {preview ? (
                  <>
                    <button key="send" type="submit" className="od-button od-button--primary" disabled={busy}>
                      <Send aria-hidden="true" />
                      {sendCommand.isPending ? c.sending : c.send}
                    </button>
                    <button type="button" className="od-button od-button--quiet" disabled={busy} onClick={() => setPreview(null)}>
                      {c.edit}
                    </button>
                  </>
                ) : (
                  <button key="preview" type="submit" className="od-button" disabled={busy || !body.trim()}>
                    {previewCommand.isPending ? c.previewing : c.preview}
                  </button>
                )}
              </div>
            )}
          </form>
        )}
      </div>
    </aside>
  );
}
