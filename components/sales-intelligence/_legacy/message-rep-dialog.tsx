"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  destinationChannels,
  listNudges,
  nudgeDeliveryKind,
  previewNudge,
  readSalesIntelligence,
  repsSchema,
  sendNudge,
  SalesIntelligenceError,
  type NudgePreview,
  type NudgeRecord,
  type Outreach,
} from "@/lib/api/salesIntelligence";
import { salesIntelligenceKeys } from "@/lib/query/salesIntelligence";
import { copy } from "../sales-intelligence-copy";
import { label } from "../lib/format";
import { Button } from "../atoms/button";

function deliveryCopy(status: NudgeRecord["status"]) {
  if (status === "fallback_sent") return copy.messageRep.statusFallback;
  if (status === "sent") return copy.messageRep.statusSent;
  if (status === "failed") return copy.messageRep.statusFailed;
  if (status === "unknown_delivery") return copy.messageRep.statusUnknown;
  return copy.messageRep.statusPending;
}

export function MessageRepDialog({
  record,
  accountId,
  extensionId,
  onClose,
}: {
  record?: Outreach | null;
  accountId: string | null;
  extensionId?: string | null;
  onClose: () => void;
}) {
  const titleId = useId(), ref = useRef<HTMLDialogElement>(null), client = useQueryClient();
  const [userId, setUserId] = useState(extensionId ?? "");
  const [channel, setChannel] = useState("pager");
  const [purpose, setPurpose] = useState<"review_context" | "call_suggestion">("review_context");
  const directoryOnly = !record;
  const [body, setBody] = useState("");
  const [preview, setPreview] = useState<NudgePreview | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [delivery, setDelivery] = useState<NudgeRecord["status"] | null>(null);
  const [resultNote, setResultNote] = useState("");
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [historyItems, setHistoryItems] = useState<NudgeRecord[]>([]);
  const key = useRef<string>(crypto.randomUUID());
  const directory = useQuery({
    queryKey: [...salesIntelligenceKeys.all, "nudge-destinations", accountId ?? "all"],
    queryFn: ({ signal }) => {
      const query = new URLSearchParams({ limit: "100" });
      if (accountId) query.set("rc_account_id", accountId);
      return readSalesIntelligence(`reps?${query}`, repsSchema, signal);
    },
    retry: false,
  });
  const history = useQuery({
    queryKey: [...salesIntelligenceKeys.all, "nudges", record?.id ?? `${accountId ?? ""}:${userId || extensionId || ""}`],
    enabled: Boolean(record?.id || userId || extensionId),
    queryFn: ({ signal }) => listNudges(record
      ? { outreach_record_id: record.id }
      : { rc_account_id: accountId ?? undefined, rc_extension_id: userId || extensionId || undefined }, signal),
    retry: false,
  });
  useEffect(() => {
    if (history.data) {
      setHistoryItems(history.data.data.items);
      setHistoryCursor(history.data.data.next_cursor);
    }
  }, [history.data]);
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
  const unknown = delivery === "unknown_delivery";
  function commandBody() {
    const account = accountId ?? selected?.rc_account_id ?? reviewed?.rc_account_id;
    if (!account || !selected) throw new Error(copy.messageRep.needUser);
    if (directoryOnly && !body.trim()) throw new Error(copy.messageRep.needUser);
    const nudge: Record<string, unknown> = {
      rc_account_id: account,
      rc_extension_id: selected.extension_id,
      channel,
      template_key: directoryOnly ? "review_context" : purpose,
      template_version: 1,
      purpose: directoryOnly ? "review_context" : purpose,
      allow_pager_fallback: false,
    };
    if (record) nudge.outreach_record_id = record.id;
    if (body.trim()) nudge.body = body.trim();
    const payload: Record<string, unknown> = { nudge };
    if (record) payload.expected_revision = record.revision;
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
        setDelivery(null);
        if (!body.trim()) setBody(next.body);
        if (!next.allowed_channels.includes(channel) && next.allowed_channels[0]) setChannel(next.allowed_channels[0]);
      } else {
        const sent = await sendNudge(commandBody(), key.current);
        setDelivery(sent.nudge.status);
        setResultNote(sent.nudge.delivery_note);
        await client.invalidateQueries({ queryKey: [...salesIntelligenceKeys.all, "nudges", record?.id ?? `${accountId ?? ""}:${userId}`] });
        if (nudgeDeliveryKind(sent.nudge.status) === "sent") {
          await client.invalidateQueries({ queryKey: salesIntelligenceKeys.all });
        }
      }
    } catch (cause) {
      if (cause instanceof SalesIntelligenceError) {
        const lost = cause.status >= 500;
        setDelivery(lost ? "unknown_delivery" : null);
        if (!lost) key.current = crypto.randomUUID();
        setError(cause.code === "REVISION_CONFLICT"
          ? copy.messageRep.revisionConflict
          : `${copy.messageRep.rejected} ${label(cause.code)}${cause.requestId ? ` (request ${cause.requestId})` : ""}.`);
      } else setError(cause instanceof Error ? cause.message : copy.messageRep.checkEntries);
    } finally { setPending(false); }
  }
  async function loadMore() {
    if (!historyCursor || pending) return;
    setPending(true);
    try {
      const page = await listNudges(record
        ? { outreach_record_id: record.id, cursor: historyCursor }
        : { rc_account_id: accountId ?? undefined, rc_extension_id: userId || extensionId || undefined, cursor: historyCursor });
      setHistoryItems(current => [...current, ...page.data.items]);
      setHistoryCursor(page.data.next_cursor);
    } catch (cause) {
      setError(cause instanceof SalesIntelligenceError ? `${copy.messageRep.historyFailed} ${label(cause.code)}.` : copy.messageRep.historyFailed);
    } finally { setPending(false); }
  }
  return <dialog ref={ref} className="si-root si-local-command" aria-labelledby={titleId} onCancel={event => { event.stopPropagation(); if (pending) event.preventDefault(); else onClose(); }}>
    <form className="si-local-stack" onSubmit={event => { event.preventDefault(); void run(preview && !unknown ? "send" : "preview"); }}>
      <h2 id={titleId}>{copy.messageRep.title}</h2>
      <p>{directoryOnly ? copy.messageRep.directoryOnly : copy.messageRep.intro}</p>
      {directory.error && <p role="alert">{copy.errors.repsFailed} <Button type="button" onClick={() => void directory.refetch()}>{copy.actions.retry}</Button></p>}
      {error && <p role="alert">{error}</p>}
      {delivery && <p role="status" data-delivery={nudgeDeliveryKind(delivery)}>{deliveryCopy(delivery)}{resultNote ? ` ${resultNote}` : ""}</p>}
      <fieldset disabled={pending} className="si-local-stack">
        <label>{copy.messageRep.user}<select className="si-select" required value={userId} onChange={event => { setUserId(event.target.value); setPreview(null); setDelivery(null); key.current = crypto.randomUUID(); }}>
          <option value="">{copy.messageRep.chooseUser}</option>
          {users.map(user => <option key={user.extension_id} value={user.extension_id}>
            {user.extension_name ?? user.extension_id}{user.status === "unmatched" || user.status === "not_proposed" ? ` · ${copy.messageRep.unmatched}` : ""}
          </option>)}
        </select></label>
        {selected && <p>{copy.messageRep.channelsHint}: {channels.length ? channels.map(label).join(", ") : copy.messageRep.noChannel}. {reviewed ? copy.messageRep.reviewedName.replace("{name}", reviewed.agent_name) : copy.messageRep.directoryName}</p>}
        <label>{copy.messageRep.channel}<select className="si-select" value={channel} onChange={event => { setChannel(event.target.value); setPreview(null); }}>
          {(channels.length ? channels : ["pager", "sms_to_rep", "team_messaging"]).map(value => <option key={value} value={value}>{label(value)}</option>)}
        </select></label>
        {!directoryOnly && <label>{copy.messageRep.purpose}<select className="si-select" value={purpose} onChange={event => { setPurpose(event.target.value as "review_context" | "call_suggestion"); setPreview(null); }}>
          <option value="review_context">{copy.messageRep.reviewContext}</option>
          <option value="call_suggestion">{copy.messageRep.callSuggestion}</option>
        </select></label>}
        <label>{copy.messageRep.body}<textarea className="si-textarea" maxLength={1000} value={body} onChange={event => setBody(event.target.value)} aria-describedby={`${titleId}-masked`} /></label>
        <p id={`${titleId}-masked`}>{copy.messageRep.bodyMasked}</p>
      </fieldset>
      {preview && <p>{copy.messageRep.previewNote}</p>}
      <section className="si-local-stack" aria-label={copy.messageRep.history}>
        <h3>{copy.messageRep.history}</h3>
        {history.isPending && <p role="status">{copy.actions.saving}</p>}
        {history.error && <p role="alert">{copy.messageRep.historyFailed} <Button type="button" onClick={() => void history.refetch()}>{copy.actions.retry}</Button></p>}
        {!history.isPending && !history.error && historyItems.length === 0 && <p>{copy.messageRep.historyEmpty}</p>}
        {historyItems.length > 0 && <ol className="si-local-stack">
          {historyItems.map(item => <li key={item.id} data-delivery={nudgeDeliveryKind(item.status)}>
            <p>{label(item.purpose)} · {label(item.channel)} · {label(item.status)}</p>
            <p>{deliveryCopy(item.status)}</p>
            <p>{item.body_as_sent}</p>
          </li>)}
        </ol>}
        {historyCursor && <Button type="button" disabled={pending} onClick={() => void loadMore()}>{copy.actions.loadMore}</Button>}
      </section>
      <div className="si-local-filters">
        <Button variant="primary" type="submit" disabled={pending || !userId || (directoryOnly && !body.trim())}>
          {pending ? copy.actions.saving : unknown ? copy.actions.retrySame : preview ? copy.messageRep.send : copy.messageRep.preview}
        </Button>
        <Button type="button" disabled={pending} onClick={onClose}>{copy.actions.cancel}</Button>
      </div>
    </form>
  </dialog>;
}
