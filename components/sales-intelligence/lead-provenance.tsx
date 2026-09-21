"use client";

import { Link2, Link2Off, ShieldCheck, Sparkles, Split } from "lucide-react";
import type { Outreach } from "@/lib/api/salesIntelligence";
import { Badge, type Tone } from "./atoms/badge";
import { Button } from "./atoms/button";
import { TooltipCard } from "./atoms/tooltip-card";
import { copy } from "./sales-intelligence-copy";
import { formatDateTime, label } from "./lib/format";
import { leadAttachmentOf, leadNameOf, provenanceStateOf, type ProvenanceState } from "./lib/owner-now";

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
