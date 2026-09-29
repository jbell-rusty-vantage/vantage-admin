"use client";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { LeadProgressSection } from "../lead-progress";
import { RecordProvenance } from "../lead-provenance";
import { RelatedRecordChips } from "../related-record-chips";
import { Attachments } from "../attachments";
import { Region, SkeletonLines } from "../primitives";
import { useOutreach } from "../data/use-outreach";
import { siKeys } from "../data/query-keys";
import { useIsRep } from "../rep/viewer";
import { copy } from "../sales-intelligence-copy";
import { formatExact } from "../lib/time";
import { MoveDetailsSection, MoveDetailsSkeleton } from "./analysis/move-details";
import { numberIdOf } from "./record-header";
import { outreachRouteHref } from "./deep-links";
import { useLandOnHash } from "./land-on-hash";
import { legacyNumberHref } from "../lib/legacy-links";
import { useRef } from "react";

const p = copy.oi.page;

function CaseFileBody({ id, returnTo, siReturn }: { id: string; returnTo: string; siReturn: string | null }) {
  const { outreach, asOf } = useOutreach(id);
  const client = useQueryClient();
  const rep = useIsRep();
  const numberId = numberIdOf(outreach);
  const lead = outreach.subject.kind === "lead" ? { model: outreach.subject.model, id: outreach.subject.id } : undefined;
  const root = useRef<HTMLDivElement>(null);
  useLandOnHash(root);
  return <div ref={root} className="si-casefile">
    <section id="move-details" className="si-casefile__section" aria-labelledby="case-move-title"><h2 id="case-move-title" className="si-heading si-heading--2">{copy.ui1.analysis.frame.sections.move}</h2>
      <Region name="case-move" skeleton={<MoveDetailsSkeleton />} onRetry={() => void client.resetQueries({ queryKey: siKeys.assessment(id) })}><MoveDetailsSection outreachId={id} moveSummary={outreach.move_summary} /></Region>
    </section>
    <section className="si-casefile__section" aria-labelledby="case-lead-title"><h2 id="case-lead-title" className="si-heading si-heading--2">{p.leadAndGranot}</h2>
      <LeadProgressSection record={outreach} />
      <RecordProvenance record={outreach} asOfText={(time) => formatExact(time, asOf)} />
      {outreach.receiver_agent?.agent && <p>{copy.ui1.outreach.receiverAgent(outreach.receiver_agent.agent.name)}</p>}
      {!rep && <RelatedRecordChips outreach={outreach} numberId={numberId} returnTo={returnTo} />}
      {!rep && (lead || numberId) && <>
        <Attachments lead={lead} numberId={lead ? undefined : numberId ?? undefined} returnTo={returnTo} readOnly numberHref={legacyNumberHref} />
        <p className="si-text--sm si-text--subtle">{copy.ui1.outreach.work.attachmentsReadOnly}</p>
      </>}
    </section>
    <section className="si-casefile__section" aria-labelledby="case-summary-title"><h2 id="case-summary-title" className="si-heading si-heading--2">{p.latestSummary}</h2>
      <p className="si-text--sm si-text--subtle">{p.fromAnalysis}</p><p>{outreach.latest_summary?.overview ?? p.noSummary}</p>
      <Link href={outreachRouteHref(id, { tab: "analysis", siReturn })}>{p.openAnalysis}</Link>
    </section>
  </div>;
}

export function CaseFileTab({ id, returnTo, siReturn }: { id: string; returnTo: string; siReturn: string | null }) {
  const client = useQueryClient();
  return <Region name="case-file" skeleton={<CaseFileSkeleton />} onRetry={() => void client.resetQueries({ queryKey: siKeys.outreach(id) })}><CaseFileBody id={id} returnTo={returnTo} siReturn={siReturn} /></Region>;
}

export function CaseFileSkeleton() { return <div className="si-casefile" aria-hidden><SkeletonLines lines={7} /><SkeletonLines lines={4} /><SkeletonLines lines={3} /></div>; }
