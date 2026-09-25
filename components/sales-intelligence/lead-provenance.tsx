"use client";

import { BadgeCheck, Link2, Link2Off, ShieldCheck, Sparkles, Split } from "lucide-react";
import Link from "next/link";
import type { Outreach } from "@/lib/api/salesIntelligence";
import { Badge, type Tone } from "./atoms/badge";
import { Button } from "./atoms/button";
import { TooltipCard } from "./atoms/tooltip-card";
import { copy } from "./sales-intelligence-copy";
import { formatDateTime, label } from "./lib/format";
import { legacyNumberHref, legacyNumbersHref } from "./lib/legacy-links";
import { leadAttachmentOf, leadNameOf, provenanceStateOf, serverProvenanceState, type ProvenanceState } from "./lib/owner-now";
import { useIsRep } from "./rep/viewer";

const icon = {
  attached_by_you: ShieldCheck,
  attached_automatically: Sparkles,
  attached_from_evidence: Link2,
  needs_a_lead: Link2Off,
  ambiguous: Split,
} as const;

const tone: Record<ProvenanceState, Tone> = {
  attached_by_you: "green",
  attached_automatically: "blue",
  attached_from_evidence: "navy",
  needs_a_lead: "neutral",
  ambiguous: "amber",
};

export function ProvenanceBadge({ record }: { record?: Outreach | null }) {
  const state = provenanceStateOf(record);
  const Icon = icon[state];
  return (
    <TooltipCard
      title={copy.provenance.state[state]}
      guideTopic="provenance"
      label={
        <Badge tone={tone[state]} className="si-badge--wrap" icon={<Icon size={12} aria-hidden />}>
          {copy.provenance.state[state]}
        </Badge>
      }
    >
      {copy.provenance.soWhat[state]}
    </TooltipCard>
  );
}

/**
 * One block that answers "why is this Lead on this Number", and gives the Owner
 * the single next move — attach one, or look at the match that was made for him.
 */
export function LeadProvenance({
  record,
  onOpenMatches,
}: {
  record?: Outreach | null;
  onOpenMatches?: () => void;
}) {
  const state = provenanceStateOf(record);
  const attachment = leadAttachmentOf(record);
  const who = leadNameOf(record);
  const needsLead = state === "needs_a_lead";
  const certainty = attachment?.certainty_label ?? (attachment?.certainty ? label(attachment.certainty) : null);
  const decided = attachment?.decided_at ?? null;
  return (
    <section className="si-provenance" aria-label={copy.provenance.heading}>
      <span className="si-ownership__label">{copy.provenance.heading}</span>
      <div className="si-chiprow">
        <ProvenanceBadge record={record} />
        {certainty && <Badge tone="neutral">{certainty}</Badge>}
        {state === "attached_automatically" && attachment?.confidence != null && (
          <Badge tone="blue">{copy.provenance.confidence(attachment.confidence)}</Badge>
        )}
      </div>
      <p className={needsLead ? "si-provenance__who si-text--subtle" : "si-provenance__who"}>
        {who ?? copy.lead.noLead}
      </p>
      <p className="si-text--sm si-text--subtle">{copy.provenance.soWhat[state]}</p>
      {/* An automatic attach records no decided_at — that field marks the Owner's own decision —
          so freshness is what the Owner gets instead of a date nobody set. */}
      {decided
        ? <p className="si-text--sm si-text--subtle">{copy.provenance.decidedAt(formatDateTime(decided))}</p>
        : attachment?.observed_at
          ? <p className="si-text--sm si-text--subtle">{copy.provenance.observedAt(formatDateTime(attachment.observed_at))}</p>
          : null}
      {onOpenMatches && (
        <Button variant={needsLead || state === "ambiguous" ? "primary" : "ghost"} size="sm" onClick={onOpenMatches}>
          {needsLead ? copy.provenance.attach : copy.provenance.review}
        </Button>
      )}
      {needsLead && <p className="si-field__hint">{copy.provenance.attachSoWhat}</p>}
    </section>
  );
}

/**
 * UI1-SHELL (UI-1 §5.1, UX21, UX26): the record header's Lead provenance block. It reads
 * `derived.provenance_state` exactly as sent (`serverProvenanceState`), never a browser fallback:
 * - `is_the_lead` (S11-PROV) → `This is the Lead` + `This work is the {Form|Call} Lead for Job {n}.`, and
 *   `No Contact Number is on file.` when `primary_number` is null. Nothing here says `No Lead attached` for a Lead.
 * - `needs_a_lead` → `No Lead attached` + `Attach a Lead`; `ambiguous` → `Review`. Both link out to the legacy
 *   Numbers view until UI-3 (`lib/legacy-links.ts`).
 * - `attached_*` keep today's wording (the state, its certainty, what it means, when it was decided).
 * - No value → `How this Lead was attached is not recorded yet.`
 */
/** UI-0 §2.1 colour law on the new header: green is Booked only and amber is not a provenance colour. */
const recordTone: Record<ProvenanceState, Tone> = { ...tone, attached_by_you: "navy", ambiguous: "neutral" };

export function RecordProvenance({ record, asOfText }: { record: Outreach; asOfText?: (iso: string) => string }) {
  const p = copy.ui1.outreach.provenance;
  // UI2-SCOPE (UI-2 §3): a rep keeps the provenance line but not `Attach a Lead` / `Review` (the Numbers view is Owner-only).
  const rep = useIsRep();
  const state = serverProvenanceState(record);
  const when = asOfText ?? formatDateTime;
  const numberHref = record.primary_number?.id ? legacyNumberHref(record.primary_number.id) : legacyNumbersHref();
  if (state === "is_the_lead") {
    const kind = record.subject.kind === "lead" ? p.leadKind[record.subject.model] ?? label(record.subject.model) : label(record.subject.kind);
    const job = record.lead_display?.job_no;
    return (
      <section className="si-provenance" aria-label={copy.provenance.heading} data-provenance="is_the_lead">
        <span className="si-ownership__label">{copy.provenance.heading}</span>
        <Badge tone="navy" className="si-badge--wrap" icon={<BadgeCheck size={12} aria-hidden />}>{p.isTheLead}</Badge>
        <p className="si-provenance__who">{job ? p.isTheLeadDetail(kind, job) : p.isTheLeadNoJob(kind)}</p>
        {!record.primary_number && <p className="si-text--sm si-text--subtle">{p.noNumber}</p>}
      </section>
    );
  }
  if (!state) {
    return (
      <section className="si-provenance" aria-label={copy.provenance.heading} data-provenance="unknown">
        <span className="si-ownership__label">{copy.provenance.heading}</span>
        <p className="si-text--sm si-text--subtle">{copy.provenance.unknown}</p>
      </section>
    );
  }
  const attachment = leadAttachmentOf(record);
  const certainty = attachment?.certainty_label ?? (attachment?.certainty ? label(attachment.certainty) : null);
  const who = leadNameOf(record);
  const Icon = icon[state];
  const linkOut = !rep && (state === "needs_a_lead" || state === "ambiguous");
  return (
    <section className="si-provenance" aria-label={copy.provenance.heading} data-provenance={state}>
      <span className="si-ownership__label">{copy.provenance.heading}</span>
      <div className="si-chiprow">
        <Badge tone={recordTone[state]} className="si-badge--wrap" icon={<Icon size={12} aria-hidden />}>
          {state === "needs_a_lead" ? p.needsLead : copy.provenance.state[state]}
        </Badge>
        {certainty && <Badge tone="neutral">{certainty}</Badge>}
        {state === "attached_automatically" && attachment?.confidence != null && (
          <Badge tone="blue">{copy.provenance.confidence(attachment.confidence)}</Badge>
        )}
      </div>
      {who && state !== "needs_a_lead" && <p className="si-provenance__who">{who}</p>}
      <p className="si-text--sm si-text--subtle">{copy.provenance.soWhat[state]}</p>
      {attachment?.decided_at
        ? <p className="si-text--sm si-text--subtle">{copy.provenance.decidedAt(when(attachment.decided_at))}</p>
        : attachment?.observed_at
          ? <p className="si-text--sm si-text--subtle">{copy.provenance.observedAt(when(attachment.observed_at))}</p>
          : null}
      {linkOut && (
        <span className="si-provenance__linkout">
          <Link className="si-btn si-btn--secondary si-btn--sm si-hit" href={numberHref} data-action={state === "needs_a_lead" ? "attach-lead" : "review-lead"}>
            {state === "needs_a_lead" ? p.attachLead : p.ambiguous}
          </Link>
          <span className="si-text--sm si-text--subtle">{copy.ui1.card.previousVersion}</span>
        </span>
      )}
    </section>
  );
}
