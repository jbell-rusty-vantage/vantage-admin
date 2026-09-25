"use client";
/**
 * UI1-TOP: the Analysis tab frame (final spec §11, §11.9; UI-1 §5.2; UI-0 UX15, UX27, §7.4). Six sections in a fixed
 * order behind a sticky sub-nav (`Situation · Scores · Move details · Findings · Conversations · Full output`), the
 * next-step strip between Scores and Move details, and the `Advanced` disclosure last. Each section is its own
 * Region (Suspense + error boundary, a shaped skeleton after 150 ms, `Try again` resets only its reads). A rep sees
 * every readable section; Full output and Advanced are the Owner's (`role`).
 *
 * UI1-ANALYSIS-WIRE: Findings and Conversations are UI1-FIND / UI1-CONV's sections, mounted here by default
 * (`renderFindings` / `renderConversations` still override them). Every `View evidence` in the kit is FIND's toggle
 * (`cite.tsx` → `EvidenceToggle`). `idPrefix` keeps ids unique when a page renders the kit twice, and a deep link's
 * hash (`#scores`, `#full-output`, `#findings`, `#conversations`) is landed once the tab has rendered.
 */
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useRef, useState, type ReactNode } from "react";
import { outputChoices } from "@/lib/api/salesIntelligenceAssessment";
import { salesIntelligenceKeys } from "@/lib/query/salesIntelligence";
import { siKeys } from "../../data/query-keys";
import { useAssessment } from "../../data/use-assessment";
import { useOutreach } from "../../data/use-outreach";
import { useRunPresentation } from "../../data/use-run";
import { outreachHref } from "../../card";
import { FullOutputSection } from "../../full-output";
import { copy } from "../../sales-intelligence-copy";
import { Disclosure, Region, SkeletonLines, SubNav } from "../../primitives";
import { useLandOnHash } from "../land-on-hash";
import { AdvancedSection, AdvancedSkeleton } from "./advanced";
import { ConversationsSection, ConversationsSkeleton } from "./conversations";
import { FindingsSection, FindingsSkeleton } from "./findings";
import { KitIdProvider, useKitId } from "./kit-id";
import { MoveDetailsSection, MoveDetailsSkeleton } from "./move-details";
import { NextStepSection, NextStepSkeleton } from "./next-step";
import { ScoresSection, ScoresSkeleton } from "./scores";
import { SituationSection, SituationSkeleton } from "./situation";

const f = copy.ui1.analysis.frame;

export type AnalysisRole = "owner" | "rep";
/** What a slotted section needs, read from the Outreach detail. */
export type AnalysisSlotContext = { outreachId: string; runId: string | null; numberId: string | null; asOf: string; role: AnalysisRole };
export type AnalysisSlot = (context: AnalysisSlotContext) => ReactNode;

/** Section anchors. `#scores` and `#full-output` are the targets of the old deep-link redirects (ADMIN-REBUILD trap 5). */
export const ANALYSIS_SECTIONS = [
  { id: "situation", label: f.sections.situation, ownerOnly: false },
  { id: "scores", label: f.sections.scores, ownerOnly: false },
  { id: "move-details", label: f.sections.move, ownerOnly: false },
  { id: "findings", label: f.sections.findings, ownerOnly: false },
  { id: "conversations", label: f.sections.conversations, ownerOnly: false },
  { id: "full-output", label: f.sections.fullOutput, ownerOnly: true },
] as const;
type SectionId = (typeof ANALYSIS_SECTIONS)[number]["id"];

const sectionsFor = (role: AnalysisRole) => ANALYSIS_SECTIONS.filter((section) => role === "owner" || !section.ownerOnly);
const titleOf = (id: SectionId) => ANALYSIS_SECTIONS.find((section) => section.id === id)!.label;

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  const kid = useKitId();
  return (
    <section id={kid(id)} className="si-analysis__section" aria-labelledby={kid(`${id}-title`)} data-section={id}>
      <h2 id={kid(`${id}-title`)} className="si-heading si-heading--2">{title}</h2>
      {children}
    </section>
  );
}

function SlotBody({ outreachId, role, render }: { outreachId: string; role: AnalysisRole; render: AnalysisSlot }) {
  const { outreach, asOf } = useOutreach(outreachId);
  return <>{render({ outreachId, runId: outreach.newest_run_id ?? null, numberId: outreach.primary_number?.id ?? null, asOf, role })}</>;
}

/** The Work tab's review item a finding relation points at (`review-items.tsx` renders `id="review-item-{id}"`). */
export const reviewItemHref = (outreachId: string, reviewItemId: string) => `${outreachHref(outreachId)}?tab=work#review-item-${encodeURIComponent(reviewItemId)}`;

/** The default Findings slot: FIND's section; the Owner gets `Look again` (UX27) and the review-item links. */
export const defaultFindings: AnalysisSlot = ({ outreachId, runId, role }) => (
  <FindingsSection outreachId={outreachId} newestRunId={runId} showLookAgain={role === "owner"} reviewHref={role === "owner" ? (id) => reviewItemHref(outreachId, id) : undefined} />
);
function ConversationsSlot({ numberId }: { numberId: string | null }) {
  const client = useQueryClient();
  const retry = () => {
    if (numberId) void client.resetQueries({ queryKey: siKeys.conversations(numberId) });
  };
  return <ConversationsSection numberId={numberId} onRetry={retry} />;
}
/** The default Conversations slot: CONV's section on the record's Number (`null` → the no-Number sentence). */
export const defaultConversations: AnalysisSlot = ({ numberId }) => <ConversationsSlot numberId={numberId} />;

/** Full output (§11.8, kept): assessment versions, then the run's outputs; `run` (an old deep link) picks that run. */
function FullOutputRun({ runId, versions }: { runId: string; versions: Parameters<typeof outputChoices>[0]["versions"] }) {
  const { presentation } = useRunPresentation(runId);
  return <FullOutputPicker choices={outputChoices({ versions, runId, runRefs: presentation.full_output })} preferRun={runId} />;
}
function FullOutputPicker({ choices, preferRun }: { choices: ReturnType<typeof outputChoices>; preferRun: string | null }) {
  const preferred = preferRun ? choices.find((choice) => choice.key.startsWith(`run:${preferRun}:`) && choice.kind === "findings") ?? choices.find((choice) => choice.key.startsWith(`run:${preferRun}:`)) : null;
  const [selected, setSelected] = useState<string | null>(preferred?.key ?? null);
  return <FullOutputSection choices={choices} selectedKey={selected} onSelect={setSelected} />;
}
function FullOutputBody({ outreachId, run }: { outreachId: string; run: string | null }) {
  const { outreach } = useOutreach(outreachId);
  const { assessment } = useAssessment(outreachId);
  const runId = run ?? outreach.newest_run_id ?? null;
  if (!runId) return <FullOutputPicker choices={outputChoices({ versions: assessment.versions })} preferRun={null} />;
  return <FullOutputRun runId={runId} versions={assessment.versions} />;
}

export type AnalysisTabProps = {
  outreachId: string;
  role: AnalysisRole;
  /** Accepted for the shell's signature and not read: each section formats against its own read's `as_of` (UI-0 §2.1). */
  asOf?: string | null;
  /** An older run picked by an old deep link (`analysis_run=`): Full output opens on it. */
  run?: string | null;
  /** Situation repeats the card's lines 1–4 and 6–7 (§11.1). A page whose header already shows them may pass `false`. */
  cardLines?: boolean;
  /** Prefix for every element id in the kit (a second copy on one page, e.g. the gallery's 390 px frame). */
  idPrefix?: string;
  /** Overrides for the Findings / Conversations bodies (default: FIND's and CONV's sections). */
  renderFindings?: AnalysisSlot;
  renderConversations?: AnalysisSlot;
};

/** The Analysis tab. Mount it in the Outreach page's `analysis` slot: `<AnalysisTab outreachId={id} role="owner" run={run} />`. */
export function AnalysisTab({ idPrefix = "", ...props }: AnalysisTabProps) {
  return (
    <KitIdProvider value={idPrefix}>
      <AnalysisTabBody {...props} />
    </KitIdProvider>
  );
}

function AnalysisTabBody({ outreachId, role, run = null, cardLines = true, renderFindings = defaultFindings, renderConversations = defaultConversations }: Omit<AnalysisTabProps, "idPrefix">) {
  const kid = useKitId();
  const root = useRef<HTMLDivElement>(null);
  useLandOnHash(root);
  const client = useQueryClient();
  const owner = role === "owner";
  const reset = (...keys: QueryKey[]) => () => {
    for (const queryKey of keys) void client.resetQueries({ queryKey });
  };
  const all = salesIntelligenceKeys.all;
  const outreachKey = siKeys.outreach(outreachId);
  const assessmentKey = siKeys.assessment(outreachId);
  const runKeys = [[...all, "analysis-presentation"], [...all, "analysis-run"]] as QueryKey[];
  const slot = (id: "findings" | "conversations", render: AnalysisSlot, skeleton: ReactNode, keys: QueryKey[]) => (
    <Section id={id} title={titleOf(id)}>
      <Region name={`analysis-${id}`} skeleton={skeleton} onRetry={reset(outreachKey, ...keys)}>
        <SlotBody outreachId={outreachId} role={role} render={render} />
      </Region>
    </Section>
  );
  return (
    <div ref={root} className="si-analysis" data-role={role}>
      <SubNav items={sectionsFor(role).map(({ id, label }) => ({ id: kid(id), label }))} label={f.subNavLabel} className="si-analysis__subnav" />
      <Section id="situation" title={titleOf("situation")}>
        <Region name="analysis-situation" skeleton={<SituationSkeleton />} onRetry={reset(outreachKey, ...runKeys)}>
          <SituationSection outreachId={outreachId} cardLines={cardLines} />
        </Region>
      </Section>
      <Section id="scores" title={titleOf("scores")}>
        <Region name="analysis-scores" skeleton={<ScoresSkeleton />} onRetry={reset(assessmentKey, outreachKey)}>
          <ScoresSection outreachId={outreachId} />
        </Region>
      </Section>
      <section id={kid("next-step")} className="si-analysis__section si-analysis__section--strip" aria-label={f.nextStep} data-section="next-step">
        <Region name="analysis-next-step" skeleton={<NextStepSkeleton />} onRetry={reset(outreachKey, assessmentKey, ...runKeys)}>
          <NextStepSection outreachId={outreachId} owner={owner} />
        </Region>
      </section>
      <Section id="move-details" title={titleOf("move-details")}>
        <Region name="analysis-move" skeleton={<MoveDetailsSkeleton />} onRetry={reset(assessmentKey)}>
          <MoveDetailsSection outreachId={outreachId} />
        </Region>
      </Section>
      {slot("findings", renderFindings, <FindingsSkeleton />, [[...all, "findings"], ...runKeys])}
      {slot("conversations", renderConversations, <ConversationsSkeleton />, [[...all, "conversations"], [...all, "transcript"]])}
      {owner && (
        <Section id="full-output" title={titleOf("full-output")}>
          <Region name="analysis-full-output" skeleton={<SkeletonLines lines={4} />} onRetry={reset(outreachKey, assessmentKey, ...runKeys)}>
            <FullOutputBody outreachId={outreachId} run={run} />
          </Region>
        </Section>
      )}
      {owner && (
        <section id={kid("advanced")} className="si-analysis__section si-analysis__section--advanced" aria-label={copy.ui1.analysis.advanced.title} data-section="advanced">
          <Disclosure id="analysis-advanced" title={copy.ui1.analysis.advanced.title}>
            <Region name="analysis-advanced" skeleton={<AdvancedSkeleton />} onRetry={reset(outreachKey, ...runKeys)}>
              <AdvancedSection outreachId={outreachId} />
            </Region>
          </Disclosure>
        </section>
      )}
    </div>
  );
}

/** Route-level loading for the tab (§11.9): the sub-nav and the six section titles over shaped skeletons. No reads. */
export function AnalysisTabSkeleton({ role = "owner" }: { role?: AnalysisRole }) {
  const skeletons: Record<SectionId, ReactNode> = {
    situation: <SituationSkeleton />,
    scores: <ScoresSkeleton />,
    "move-details": <MoveDetailsSkeleton />,
    findings: <FindingsSkeleton />,
    conversations: <ConversationsSkeleton />,
    "full-output": <SkeletonLines lines={4} />,
  };
  return (
    <div className="si-analysis" data-role={role} role="status" aria-busy="true">
      <span className="si-sr">{copy.ui1.prim.loading}</span>
      <SubNav items={sectionsFor(role).map(({ id, label }) => ({ id, label }))} label={f.subNavLabel} className="si-analysis__subnav" />
      {sectionsFor(role).map(({ id, label }) => (
        <Section key={id} id={id} title={label}>
          {skeletons[id]}
          {id === "scores" && <NextStepSkeleton />}
        </Section>
      ))}
    </div>
  );
}
AnalysisTab.Skeleton = AnalysisTabSkeleton;
