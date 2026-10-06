"use client";
/** Small cells the review and results tables share (doc 17): job number, lead link, what changes. */
import { CopyJobButton } from "@/components/ui/crm/primitives";
import type { GranotAction, GranotOperation, GranotRun } from "@/lib/api/granotAutomation";
import { changesWords, jobNoOf, whatChanges } from "@/lib/automations/granot-updates-model";
import { GRANOT_UPDATES_COPY } from "./granot-updates-copy";

export type LeadKind = "form" | "call";
export type OpenLead = (leadId: string, kind: LeadKind) => void;
export type ActionRef = { run: GranotRun; action: GranotAction };

const REVIEW = GRANOT_UPDATES_COPY.review;

export function kindOf(operation: GranotOperation | string | undefined): LeadKind {
  return operation === "call_leads" ? "call" : "form";
}

export function JobCell({ action }: { action: GranotAction }) {
  const job = jobNoOf(action);
  return (
    <span className="gu-check-job">
      <strong className="crm-strong">{job ?? REVIEW.unknownJob}</strong>
      {job ? <CopyJobButton jobNo={job} /> : null}
    </span>
  );
}

export function LeadCell({ action, kind, onOpenLead }: { action: GranotAction; kind: LeadKind; onOpenLead: OpenLead }) {
  const leadId = action.lead_id;
  if (!leadId) return <span className="crm-text-muted">{REVIEW.noLead}</span>;
  const label = action.display?.lead_label ?? (kind === "call" ? REVIEW.callLead : REVIEW.formLead);
  return (
    <button type="button" className="crm-link gu-check-link" title={REVIEW.openLead} onClick={() => onOpenLead(leadId, kind)}>
      {label}
    </button>
  );
}

/** One span per field change ("Quoted no → yes"), separated by " · "; "—" when nothing is known. */
export function ChangesCell({ action }: { action: GranotAction }) {
  const changes = whatChanges(action);
  if (changes.length === 0) return <span className="crm-text-muted">{REVIEW.unknownChange}</span>;
  return (
    <span className="gu-check-changes">
      {changes.map((change, index) => (
        <span key={change.field}>
          {index > 0 ? " · " : ""}
          <span>{changesWords([change])}</span>
        </span>
      ))}
    </span>
  );
}
