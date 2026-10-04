"use client";
/**
 * One Number (`GET /numbers/:id`) in a modal dialog: calls and Lead messages, Lead matches (attachments, the manual
 * attach search) and the stored details (provider names, classification, call rollups, restrictions, the recount
 * command). Deterministic metadata only: no summary, analysis, transcript or Outreach work exists here.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { NumberDetail as NumberDetailDto } from "@/lib/api/salesIntelligence";
import { copy } from "../sales-intelligence-copy";
import { Button } from "../atoms/button";
import { ClassificationBadge, EligibilityBadge, Tabs } from "../chrome";
import { formatDateTime, label } from "../lib/format";
import { Region, SkeletonLines } from "../primitives";
import { Attachments } from "../attachments";
import { EvidenceCommand } from "../evidence-command";
import { ManualAttachment } from "../manual-attachment";
import { Restrictions } from "../restrictions";
import { siKeys } from "../data/query-keys";
import { useNumberDetail } from "../data/use-numbers";
import { AttachedLeadPanel } from "./attached-lead";
import { NumberTimeline } from "./number-timeline";

const n = copy.numbers;
const f = n.facts;
export const NUMBER_TABS = ["activity", "matches", "details"] as const;
export type NumberTab = (typeof NUMBER_TABS)[number];

function Fact({ term, children }: { term: string; children: ReactNode }) {
  return (
    <>
      <dt className="si-text--sm si-text--subtle">{term}</dt>
      <dd>{children}</dd>
    </>
  );
}

export function NumberFacts({ number }: { number: NumberDetailDto }) {
  const r = number.rollups;
  const c = number.connections;
  return (
    <dl className="si-facts">
      <Fact term={f.providerNames}>{number.provider_names.join(", ") || f.noProviderName}</Fact>
      <Fact term={copy.fields.classification}><ClassificationBadge value={number.classification} /> <EligibilityBadge value={number.eligibility} /></Fact>
      <Fact term={f.createdVia}>{f.createdViaWord[number.created_via] ?? label(number.created_via)}</Fact>
      <Fact term={f.firstObserved}>{formatDateTime(number.first_observed_at)}</Fact>
      <Fact term={f.lastActivity}>{formatDateTime(number.last_activity_at)}</Fact>
      <Fact term={f.calls}>{copy.lead.calls(r.interactions_total)} · {copy.lead.inboundOutbound(r.inbound_total, r.outbound_total)}</Fact>
      <Fact term={f.conversations}>{r.human_conversations_total.toLocaleString("en-US")}</Fact>
      <Fact term={f.lastInbound}>{formatDateTime(r.last_inbound_at)}</Fact>
      <Fact term={f.lastOutbound}>{formatDateTime(r.last_outbound_at)}</Fact>
      <Fact term={f.lastConversation}>{formatDateTime(r.last_human_conversation_at)}</Fact>
      <Fact term={f.recordings}>{r.recordings_total.toLocaleString("en-US")}</Fact>
      <Fact term={f.connections}>
        {f.connectionsLine(c.attached, c.candidate, c.ambiguous, c.rejected)}
        {c.interactions_total_recount !== r.interactions_total && <span className="si-text--sm si-text--amber"> · {f.recount(r.interactions_total, c.interactions_total_recount)}</span>}
      </Fact>
    </dl>
  );
}

/** The recount command, straight from `allowed_actions` (`rebuild_number`). */
function Rebuild({ number }: { number: NumberDetailDto }) {
  const [open, setOpen] = useState(false);
  const action = number.allowed_actions.find((item) => item.action === "rebuild_number");
  if (!action) return null;
  return (
    <section className="si-local-stack">
      <p className="si-text--sm si-text--subtle">{n.rebuild.explain}</p>
      <div className="si-local-filters">
        <Button disabled={!action.enabled} onClick={() => setOpen(true)}>{n.rebuild.action}</Button>
        {!action.enabled && action.blocker_codes.length > 0 && <span className="si-text--sm si-text--subtle">{n.rebuild.blocked(action.blocker_codes.map(label).join(", "))}</span>}
      </div>
      {open && (
        <EvidenceCommand
          title={n.rebuild.title}
          revision={action.expected_revision}
          enabled={action.enabled}
          context={<p>{number.e164} · {n.rebuild.explain}</p>}
          onClose={() => setOpen(false)}
          build={(reason, revision) => ({ method: "POST", path: `numbers/${number.id}/rebuild`, body: { command: "rebuild_number", expected_revision: revision, reason } })}
        />
      )}
    </section>
  );
}

function NumberBody({ id, tab, onTab, returnTo }: { id: string; tab: NumberTab; onTab: (tab: NumberTab) => void; returnTo: string }) {
  const { data } = useNumberDetail(id);
  const number = data.data;
  return (
    <>
      <div className="si-panel__tabs">
        <Tabs idBase="si-number" label={n.detailTitle(number.e164)} value={tab} onChange={onTab} items={NUMBER_TABS.map((key) => ({ key, label: n.tabs[key] }))} />
      </div>
      <div className="si-panel__body" role="tabpanel" id={`si-number-panel-${tab}`} aria-labelledby={`si-number-tab-${tab}`}>
        <p className="si-chiprow">
          <strong className="si-phone">{number.e164}</strong>
          <span className="si-text--subtle">{number.provider_names.join(", ") || f.noProviderName}</span>
          <ClassificationBadge value={number.classification} />
          <EligibilityBadge value={number.eligibility} />
        </p>
        {tab === "activity" && <NumberTimeline numberId={number.id} />}
        {tab === "matches" && (
          <div className="si-local-stack">
            <AttachedLeadPanel value={number.attached_lead} returnTo={returnTo} />
            <Attachments numberId={number.id} returnTo={returnTo} />
            <ManualAttachment number={number} />
          </div>
        )}
        {tab === "details" && (
          <div className="si-local-stack">
            <NumberFacts number={number} />
            <Restrictions rows={number.restrictions} />
            <Rebuild number={number} />
          </div>
        )}
      </div>
    </>
  );
}

/** The modal around one Number. Escape (or Close) closes it; focus returns to the row that opened it. */
export function NumberDetail({ id, e164, returnTo, onClose }: { id: string; e164?: string; returnTo: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const client = useQueryClient();
  const [tab, setTab] = useState<NumberTab>("activity");
  useEffect(() => {
    const dialog = ref.current;
    const opener = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);
  const title = e164 ? n.detailTitle(e164) : n.detailTitleUnknown;
  return (
    <dialog ref={ref} className="si-root si-local-dialog" onCancel={onClose} aria-labelledby="si-number-title" data-number-id={id}>
      <header className="si-panel__header">
        <h2 id="si-number-title" className="si-panel__dtitle" title={title}>{title}</h2>
        <div className="si-panel__headeractions">
          <Button variant="ghost" onClick={onClose} aria-label={copy.actions.closePanel}>{copy.actions.closePanel}</Button>
        </div>
      </header>
      <Region name="number" skeleton={<SkeletonLines lines={6} />} onRetry={() => void client.resetQueries({ queryKey: siKeys.number(id) })}>
        <NumberBody id={id} tab={tab} onTab={setTab} returnTo={returnTo} />
      </Region>
    </dialog>
  );
}
