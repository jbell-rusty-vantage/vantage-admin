"use client";
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  destinationChannels,
  sendNudge,
  SalesIntelligenceError,
  type DirectoryUser,
  type NudgeRecord,
} from "@/lib/api/salesIntelligence";
import { salesIntelligenceKeys } from "@/lib/query/salesIntelligence";
import { Button } from "./atoms/button";
import { copy } from "./sales-intelligence-copy";
import { label } from "./lib/format";

function deliveryCopy(status: NudgeRecord["status"]) {
  if (status === "fallback_sent") return copy.messageRep.statusFallback;
  if (status === "sent") return copy.messageRep.statusSent;
  if (status === "failed") return copy.messageRep.statusFailed;
  if (status === "unknown_delivery") return copy.messageRep.statusUnknown;
  return copy.messageRep.statusPending;
}

export function MessageAccountPanel({
  user,
  reviewedRevision,
  reviewedLinkId,
  onClose,
}: {
  user: DirectoryUser;
  reviewedRevision?: number;
  reviewedLinkId?: string;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const key = useRef(crypto.randomUUID());
  const channels = destinationChannels(user, null).filter((channel) => channel !== "sms_to_rep");
  const [channel, setChannel] = useState(channels[0] ?? "pager");
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [delivery, setDelivery] = useState<NudgeRecord["status"] | null>(null);
  const [note, setNote] = useState("");
  const account = user.rc_account_id;
  const canSend = Boolean(account && body.trim() && channels.includes(channel));

  async function send() {
    if (pending || !canSend || !account) return;
    setPending(true);
    setError("");
    setNote("");
    try {
      const payload: Record<string, unknown> = {
        nudge: {
          rc_account_id: account,
          rc_extension_id: user.extension_id,
          channel,
          template_key: "review_context",
          template_version: 1,
          purpose: "review_context",
          allow_pager_fallback: false,
          body: body.trim(),
          ...(reviewedLinkId ? { rep_identity_link_id: reviewedLinkId } : {}),
        },
      };
      if (reviewedLinkId && reviewedRevision !== undefined) {
        payload.expected_rep_revision = reviewedRevision;
      }
      const sent = await sendNudge(payload, key.current);
      setDelivery(sent.nudge.status);
      setNote(sent.nudge.delivery_note);
      await client.invalidateQueries({ queryKey: salesIntelligenceKeys.all });
    } catch (cause) {
      if (cause instanceof SalesIntelligenceError) {
        if (cause.status < 500) key.current = crypto.randomUUID();
        setDelivery(cause.status >= 500 ? "unknown_delivery" : null);
        setError(`${copy.messageRep.rejected} ${label(cause.code)}${cause.requestId ? ` (request ${cause.requestId})` : ""}.`);
      } else {
        setError(cause instanceof Error ? cause.message : copy.messageRep.checkEntries);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="si-message-panel" aria-label={copy.messageRep.title}>
      <div className="si-message-panel__head">
        <h3>{copy.messageRep.title} {user.extension_name ?? user.extension_id}</h3>
        <Button type="button" variant="ghost" onClick={onClose}>{copy.actions.closePanel}</Button>
      </div>
      <p>{copy.messageRep.directoryOnly}</p>
      {error && <p role="alert">{error}</p>}
      {delivery && <p role="status">{deliveryCopy(delivery)}{note ? ` ${note}` : ""}</p>}
      {!channels.length && <p role="status">{copy.messageRep.noChannel}.</p>}
      <form className="si-message-panel__form" onSubmit={(event) => { event.preventDefault(); void send(); }}>
        <label>
          {copy.messageRep.channel}
          <select className="si-select" value={channel} disabled={pending || !channels.length} onChange={(event) => setChannel(event.target.value)}>
            {(channels.length ? channels : ["pager"]).map((value) => (
              <option key={value} value={value}>{label(value)}</option>
            ))}
          </select>
        </label>
        <label>
          {copy.messageRep.body}
          <textarea
            className="si-textarea"
            maxLength={1000}
            value={body}
            disabled={pending}
            onChange={(event) => setBody(event.target.value)}
            placeholder={copy.reps.messagePlaceholder}
          />
        </label>
        <div className="si-local-filters">
          <Button variant="primary" type="submit" disabled={pending || !canSend}>
            {pending ? copy.actions.saving : copy.messageRep.send}
          </Button>
          <Button type="button" disabled={pending} onClick={onClose}>{copy.actions.cancel}</Button>
        </div>
      </form>
    </section>
  );
}
