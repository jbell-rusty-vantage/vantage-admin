"use client";
/**
 * UI1-TOP: `View evidence ({n})` for the analysis kit (final spec §11.6). The button toggles an inline block under the
 * cited item. What the block shows is UI1-FIND's `evidence-inline.tsx`: the frame passes it in as `renderEvidence`
 * (a context, so every section reaches it without prop drilling). Until then a small fallback lists the cited items'
 * server labels and text, read from the same evidence routes.
 */
import { createContext, useContext, useId, useState, type ReactNode } from "react";
import type { EvidenceItem, EvidenceRef } from "@/lib/api/salesIntelligenceAssessment";
import { evidenceAvailabilityText, evidenceKindText } from "@/lib/api/salesIntelligenceAssessment";
import { useAssessmentEvidence } from "../../data/use-assessment";
import { useRunPresentation } from "../../data/use-run";
import { Button } from "../../atoms/button";
import { assessmentCopy } from "../../evidence-chain-copy";
import { copy } from "../../sales-intelligence-copy";
import { Region, SkeletonLines } from "../../primitives";

/** What a citation points at: an assessment version's evidence, or a run presentation's evidence. `ids` are the refs' ids. */
export type EvidenceTarget =
  | { source: "assessment"; artifactId: string; ids: string[]; label: string }
  | { source: "run"; runId: string; ids: string[]; label: string };
export type EvidenceRenderer = (target: EvidenceTarget) => ReactNode;

const EvidenceRendererContext = createContext<EvidenceRenderer | null>(null);
export const EvidenceRendererProvider = EvidenceRendererContext.Provider;

export const refIds = (refs: readonly Pick<EvidenceRef, "id">[]) => [...new Set(refs.map((ref) => ref.id))];

/**
 * `View evidence ({n})`, or `No evidence cited` when nothing is cited or the owner of the evidence is unknown
 * (`target: null`, for example the Lead-only table). `missing` prints the RD11 sentence instead of the plain empty.
 */
export function ViewEvidence({ target, missingText }: { target: EvidenceTarget | null; missingText?: string }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const render = useContext(EvidenceRendererContext);
  if (!target || !target.ids.length) return <span className="si-text--subtle si-text--sm si-cite--none">{missingText ?? assessmentCopy.noEvidence}</span>;
  const label = assessmentCopy.viewEvidence(target.ids.length);
  return (
    <span className="si-cite">
      <Button variant="link" size="sm" className="si-link si-hit si-cite__btn" aria-expanded={open} aria-controls={panelId} aria-label={`${open ? copy.ui1.analysis.frame.hideEvidence : label}: ${target.label}`} onClick={() => setOpen((v) => !v)}>
        {open ? copy.ui1.analysis.frame.hideEvidence : label}
      </Button>
      <span id={panelId} className="si-cite__panel" hidden={!open}>
        {open && (render ? render(target) : <Region name="analysis-evidence" skeleton={<SkeletonLines lines={2} />}><FallbackEvidence target={target} /></Region>)}
      </span>
    </span>
  );
}

function EvidenceList({ items, ids }: { items: readonly EvidenceItem[]; ids: string[] }) {
  const wanted = new Set(ids);
  const cited = items.filter((item) => wanted.has(item.id));
  if (!cited.length) return <span className="si-text--subtle si-text--sm">{assessmentCopy.noEvidence}</span>;
  return (
    <ul className="si-cite__list">
      {cited.map((item) => (
        <li key={item.id} className="si-cite__item" data-evidence={item.id}>
          <strong>{item.source_label ?? item.record_label ?? evidenceKindText(item.kind)}</strong>
          {item.speaker_label && <span className="si-text--subtle"> · {item.speaker_label}</span>}
          <span className="si-cite__text">
            {item.quote ?? item.text ?? (item.availability !== "retained" && item.availability !== "ready" ? evidenceAvailabilityText(item.availability) : copy.ui1.analysis.frame.evidenceNoText)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function AssessmentEvidence({ artifactId, ids }: { artifactId: string; ids: string[] }) {
  const { evidence } = useAssessmentEvidence(artifactId);
  return <EvidenceList items={evidence.items} ids={ids} />;
}
function RunEvidence({ runId, ids }: { runId: string; ids: string[] }) {
  const { presentation } = useRunPresentation(runId);
  return <EvidenceList items={presentation.evidence.items} ids={ids} />;
}
function FallbackEvidence({ target }: { target: EvidenceTarget }) {
  return target.source === "assessment" ? <AssessmentEvidence artifactId={target.artifactId} ids={target.ids} /> : <RunEvidence runId={target.runId} ids={target.ids} />;
}
