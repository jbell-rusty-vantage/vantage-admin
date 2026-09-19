"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  destinationChannels,
  previewNudge,
  readSalesIntelligence,
  repsSchema,
  sendNudge,
  SalesIntelligenceError,
  type NudgePreview,
  type Outreach,
} from "@/lib/api/salesIntelligence";
import { salesIntelligenceKeys } from "@/lib/query/salesIntelligence";
import { copy } from "./sales-intelligence-copy";
import { label } from "./lib/format";
import { Button } from "./atoms/button";

export function MessageRepDialog({ record, accountId, onClose }: { record: Outreach; accountId: string | null; onClose: () => void }) {
  const titleId = useId(), ref = useRef<HTMLDialogElement>(null), client = useQueryClient();
  const [userId, setUserId] = useState("");
  const [channel, setChannel] = useState("pager");
  const [purpose, setPurpose] = useState<"review_context" | "call_suggestion">("review_context");
  const [body, setBody] = useState("");
  const [preview, setPreview] = useState<NudgePreview | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [resultNote, setResultNote] = useState("");
  const key = useRef<string>(crypto.randomUUID());
  const directory = useQuery({
    queryKey: [...salesIntelligenceKeys.all, "nudge-destinations", accountId],
    enabled: Boolean(accountId),
    queryFn: ({ signal }) => readSalesIntelligence(`reps?${new URLSearchParams({ rc_account_id: accountId!, limit: "100" })}`, repsSchema, signal),
    retry: false,
  });
  useEffect(() => {
    const dialog = ref.current, opener = document.activeElement, parent = opener?.closest("dialog");
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (opener instanceof HTMLElement && opener.isConnected && !opener.matches(":disabled")) opener.focus();
      else parent?.querySelector<HTMLElement>("button:not(:disabled),a[href]")?.focus();
    };
  }, []);
  const users = directory.data?.data.directory.users ?? [];
  const selected = users.find(user => user.extension_id === userId);
  const reviewed = directory.data?.data.items.find(item => item.rc_extension_id === userId && item.status === "reviewed" && !item.effective_to);
  const hinted = selected ? destinationChannels(selected, reviewed?.rc_team_messaging_person_id) : [];
  const channels = preview?.allowed_channels.length ? preview.allowed_channels : hinted;
  function commandBody() {
    if (!accountId || !selected) throw new Error(copy.messageRep.needUser);
    const nudge: Record<string, unknown> = {
      outreach_record_id: record.id,
      rc_account_id: accountId,
      rc_extension_id: selected.extension_id,
      channel,
      template_key: purpose,
      template_version: 1,
      purpose,
      allow_pager_fallback: false,
    };
    if (body.trim()) nudge.body = body.trim();
    const payload: Record<string, unknown> = { expected_revision: record.revision, nudge };
    if (reviewed) {
      nudge.rep_identity_link_id = reviewed.id;
      payload.expected_rep_revision = reviewed.revision;
    }
    return payload;
  }
  async function run(kind: "preview" | "send") {
    if (pending) return;
    setPending(true); setError(""); setResultNote("");
    try {
      if (kind === "preview") {
        const next = await previewNudge(commandBody(), key.current);
        setPreview(next);
        if (!body.trim()) setBody(next.body);
        if (!next.allowed_channels.includes(channel) && next.allowed_channels[0]) setChannel(next.allowed_channels[0]);
      } else {
        const sent = await sendNudge(commandBody(), key.current);
        setUncertain(false);
        setResultNote(sent.nudge.delivery_note);
        if (sent.nudge.status === "pending" || sent.nudge.status === "unknown_delivery") setUncertain(true);
        else if (sent.nudge.status === "sent" || sent.nudge.status === "fallback_sent") {
          await client.invalidateQueries({ queryKey: salesIntelligenceKeys.all });
        }
      }
    } catch (cause) {
      if (cause instanceof SalesIntelligenceError) {
        const unknown = cause.status >= 500;
        setUncertain(unknown);
        if (!unknown) key.current = crypto.randomUUID();
        setError(cause.code === "REVISION_CONFLICT"
          ? copy.messageRep.revisionConflict
          : `${copy.messageRep.rejected} ${label(cause.code)}${cause.requestId ? ` (request ${cause.requestId})` : ""}.`);
      } else setError(cause instanceof Error ? cause.message : copy.messageRep.checkEntries);
    } finally { setPending(false); }
  }
  return <dialog ref={ref} className="si-root si-local-command" aria-labelledby={titleId} onCancel={event => { event.stopPropagation(); if (pending) event.preventDefault(); else onClose(); }}>
    <form className="si-local-stack" onSubmit={event => { event.preventDefault(); void run(preview && !uncertain ? "send" : "preview"); }}>
      <h2 id={titleId}>{copy.messageRep.title}</h2>
      <p>{copy.messageRep.intro}</p>
      {!accountId && <p role="status">{copy.messageRep.needAccount}</p>}
      {directory.error && <p role="alert">{copy.errors.repsFailed} <Button type="button" onClick={() => void directory.refetch()}>{copy.actions.retry}</Button></p>}
      {error && <p role="alert">{error}</p>}
      {resultNote && <p role="status">{resultNote}</p>}
      <fieldset disabled={pending || !accountId} className="si-local-stack">
        <label>{copy.messageRep.user}<select className="si-select" required value={userId} onChange={event => { setUserId(event.target.value); setPreview(null); key.current = crypto.randomUUID(); }}>
          <option value="">{copy.messageRep.chooseUser}</option>
          {users.map(user => <option key={user.extension_id} value={user.extension_id}>
            {user.extension_name ?? user.extension_id}{user.status === "unmatched" || user.status === "not_proposed" ? ` · ${copy.messageRep.unmatched}` : ""}
          </option>)}
        </select></label>
        {selected && <p>{copy.messageRep.channelsHint}: {channels.length ? channels.map(label).join(", ") : copy.messageRep.noChannel}. {reviewed ? copy.messageRep.reviewedName.replace("{name}", reviewed.agent_name) : copy.messageRep.directoryName}</p>}
        <label>{copy.messageRep.channel}<select className="si-select" value={channel} onChange={event => { setChannel(event.target.value); setPreview(null); }}>
          {(channels.length ? channels : ["pager", "sms_to_rep", "team_messaging"]).map(value => <option key={value} value={value}>{label(value)}</option>)}
        </select></label>
        <label>{copy.messageRep.purpose}<select className="si-select" value={purpose} onChange={event => { setPurpose(event.target.value as "review_context" | "call_suggestion"); setPreview(null); }}>
          <option value="review_context">{copy.messageRep.reviewContext}</option>
          <option value="call_suggestion">{copy.messageRep.callSuggestion}</option>
        </select></label>
        <label>{copy.messageRep.body}<textarea className="si-textarea" maxLength={1000} value={body} onChange={event => setBody(event.target.value)} /></label>
      </fieldset>
      {preview && <p>{copy.messageRep.previewNote}</p>}
      <div className="si-local-filters">
        <Button variant="primary" type="submit" disabled={pending || !accountId || !userId}>
          {pending ? copy.actions.saving : uncertain ? copy.actions.retrySame : preview ? copy.messageRep.send : copy.messageRep.preview}
        </Button>
        <Button type="button" disabled={pending} onClick={onClose}>{copy.actions.cancel}</Button>
      </div>
    </form>
  </dialog>;
}
