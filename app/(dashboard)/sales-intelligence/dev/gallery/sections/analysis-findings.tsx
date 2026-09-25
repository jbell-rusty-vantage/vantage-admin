"use client";

import { z } from "zod";
import { conversationCardSchema, otherCallSchema, transcriptSchema } from "@/lib/api/salesIntelligence";
import { currentFindingSchema } from "@/lib/api/salesIntelligenceAnalysis";
import { evidenceItemSchema, summaryFindingsSectionSchema } from "@/lib/api/salesIntelligenceAssessment";
import { Findings, FindingsSkeleton } from "@/components/sales-intelligence/outreach/analysis/findings";
import { EvidenceInline, EvidenceInlineSkeleton, EvidenceList, type EvidenceView } from "@/components/sales-intelligence/outreach/analysis/evidence-inline";
import { Conversations, ConversationsSkeleton, OtherCalls } from "@/components/sales-intelligence/outreach/analysis/conversations";
import { TranscriptSkeleton, TranscriptView } from "@/components/sales-intelligence/outreach/analysis/transcript";
import { AudioPlayer } from "@/components/sales-intelligence/outreach/analysis/audio-player";
import { copy } from "@/components/sales-intelligence/sales-intelligence-copy";
import { AF_FIXTURES as F } from "./analysis-findings-fixtures";
import { GallerySection, Sample, Subhead } from "./section";

// UI1-FIND + UI1-CONV gallery samples (final spec §11.5–11.7). Sample labels are dev-only gallery text (not Owner-facing
// copy). Every sample is parsed from the S3 / S4 / S6 fixtures with the admin schemas; synthetic variants say so.

const findings = z.array(currentFindingSchema).parse(F.findings.items);
const findingsAsOf = F.findings.asOf!;
const relations = summaryFindingsSectionSchema.shape.prior_finding_relations.parse(F.presentation.relations);
const instructions = summaryFindingsSectionSchema.shape.owner_instruction_assessments.parse(F.presentation.instructions);
const presentedEvidence = z.array(evidenceItemSchema).parse(F.presentation.evidence) as EvidenceView[];
const assessmentEvidence = z.array(evidenceItemSchema).parse(F.assessmentEvidence.items) as EvidenceView[];
const cards = z.array(conversationCardSchema).parse(F.conversations.items);
const others = z.array(otherCallSchema).parse(F.conversations.other);
const purgedCards = z.array(conversationCardSchema).parse(F.audioPurged.items);
const liveOthers = z.array(otherCallSchema).parse(F.liveOther.other);
const s6Card = conversationCardSchema.parse(F.s6Card.item);
const transcript = transcriptSchema.shape.data.parse(F.transcript.data);
const partial = transcriptSchema.shape.data.parse(F.transcriptPartial.data);

/** Segments 3 and 6 of the second call: what `Open in transcript` on the `Rep promised to call Friday.` evidence highlights. */
const HIGHLIGHT = ["3", "6"];
const transcriptFor = (conversationId: string) =>
  conversationId === transcript.conversation_id ? (
    <TranscriptView conversationId={conversationId} segments={transcript.segments} available={transcript.available} missingRanges={transcript.completeness.missing_ranges} hasMore={false} highlight={HIGHLIGHT} />
  ) : (
    <TranscriptView conversationId={conversationId} segments={partial.segments} available={partial.available} missingRanges={partial.completeness.missing_ranges} hasMore={partial.next_offset != null} />
  );

const transcriptQuote = findings.flatMap((f) => f.evidence).find((e) => e.kind === "transcript_quote")! as EvidenceView;
const recordCitation = findings.flatMap((f) => f.evidence).find((e) => e.kind === "analysis_record")! as EvidenceView;
/** Synthetic: no fixture shows a purged or unavailable citation (SERVER-STATE "Evidence (inline)": `purged_at` null only). */
const purgedCitation: EvidenceView = { ...transcriptQuote, id: "synthetic-purged", availability: "purged", purged_at: "2026-09-21T14:00:00.000Z" };
const unavailableCitation: EvidenceView = { ...recordCitation, id: "synthetic-unavailable", availability: "unavailable" };

const reviewHref = (id: string) => `?tab=work#review-item-${id}`;
const noop = () => {};

export function AnalysisFindingsSection() {
  const g = copy.ui1.gallery;
  return (
    <GallerySection id="analysis-findings" title={g.sections["analysis-findings"]}>
      <p className="si-gallery__note">
        Findings, inline evidence and Conversations from the S3 / S4 / S6 fixtures. Buttons don&apos;t open dialogs here. The kit takes its data as props, so UI-2 reuses it unchanged.
      </p>

      <Subhead>Findings by category (every work result, Uncertain, value lines, replaced, retracted)</Subhead>
      <div data-af-sample="findings">
        <Sample label="Findings · include_superseded · Owner (Look again) · first finding's evidence open · Changes since the last analysis · Your changes" copyKey={`${F.findings.source} + ${F.presentation.source} · copy.ui1.analysis.findings`} wide>
          <Findings
            findings={findings}
            reason={null}
            truncated={false}
            asOf={findingsAsOf}
            relations={relations}
            relationEvidence={presentedEvidence}
            instructionAssessments={instructions}
            onAction={noop}
            showLookAgain
            reviewHref={reviewHref}
            replaced={{ shown: true, onToggle: noop }}
            openEvidence={[findings[0]!.id]}
          />
        </Sample>
      </div>

      <Subhead>Empty findings (`findings.reason`) and the truncated note</Subhead>
      <div data-af-sample="findings-empty">
        <Sample label="reason: no_number" copyKey="S3/outreach-findings__s-lead-only.json · copy.ui1.analysis.findings.reason.no_number">
          <Findings findings={[]} reason="no_number" truncated={false} asOf={findingsAsOf} />
        </Sample>
        <Sample label="reason: retention_pending (synthetic)" copyKey="copy.ui1.analysis.findings.reason.retention_pending">
          <Findings findings={[]} reason="retention_pending" truncated={false} asOf={findingsAsOf} />
        </Sample>
        <Sample label="No findings" copyKey="S3/outreach-findings__s-assessment-pending.json · copy.ui1.analysis.findings.none">
          <Findings findings={[]} reason={null} truncated={false} asOf={findingsAsOf} />
        </Sample>
        <Sample label="truncated: true (synthetic)" copyKey="copy.ui1.analysis.findings.truncated">
          <Findings findings={findings.slice(0, 1)} reason={null} truncated asOf={findingsAsOf} />
        </Sample>
      </div>

      <Subhead>Inline evidence: transcript, summary, said on the call, records, purged, unavailable, missing</Subhead>
      <div data-af-sample="evidence">
        <Sample label="Transcript quote + record citation" copyKey={`${F.findings.source} · copy.ui1.analysis.evidence`} wide>
          <EvidenceList items={[transcriptQuote, recordCitation]} asOf={findingsAsOf} />
        </Sample>
        <Sample label="Summary section · Said on the call · Lead on file · legacy summary" copyKey={F.assessmentEvidence.source} wide>
          <EvidenceList items={assessmentEvidence} asOf={findingsAsOf} />
        </Sample>
        <Sample label="Purged and unavailable (synthetic)" copyKey="copy.ui1.analysis.evidence.purged / unavailable" wide>
          <EvidenceList items={[purgedCitation, unavailableCitation]} asOf={findingsAsOf} />
        </Sample>
        <Sample label="View evidence (closed)" copyKey="copy.ui1.analysis.evidence.view">
          <EvidenceInline items={[transcriptQuote, recordCitation]} asOf={findingsAsOf} />
        </Sample>
        <Sample label="No citations" copyKey="copy.ui1.analysis.evidence.none">
          <EvidenceInline items={[]} asOf={findingsAsOf} />
        </Sample>
        <Sample label="No citations on a score above unknown" copyKey="copy.ui1.analysis.evidence.shouldCite">
          <EvidenceInline items={[]} asOf={findingsAsOf} shouldCite />
        </Sample>
      </div>

      <Subhead>Conversations (recording available / not recorded; transcript open with segments 3 and 6 highlighted)</Subhead>
      <div data-af-sample="conversations">
        <Sample label="Three cards, newest first · Other calls" copyKey={`${F.conversations.source} + ${F.transcript.source} · copy.ui1.analysis.conversations`} wide>
          <Conversations items={cards} otherCalls={others} asOf={F.conversations.asOf!} renderTranscript={transcriptFor} openTranscripts={[transcript.conversation_id]} />
        </Sample>
      </div>

      <Subhead>Audio removed under retention, player errors</Subhead>
      <div data-af-sample="audio">
        <Sample label="audio_removed card + available card" copyKey={`${F.audioPurged.source} · copy.ui1.analysis.conversations.recording`} wide>
          <Conversations items={purgedCards} otherCalls={[]} asOf={F.audioPurged.asOf!} renderTranscript={transcriptFor} />
        </Sample>
        <Sample label="Media route 404" copyKey="S4/conversation-media-purged__s-audio-purged.json · copy.ui1.analysis.conversations.audioRemoved">
          <AudioPlayer conversationId={purgedCards[0]!.conversation_id} label="gallery" initialState="removed" />
        </Sample>
        <Sample label="Media route 500 (no blob store locally)" copyKey="S4/conversation-media-retained__s-audio-purged.json · copy.ui1.analysis.conversations.audioFailed">
          <AudioPlayer conversationId={purgedCards[0]!.conversation_id} label="gallery" initialState="failed" />
        </Sample>
      </div>

      <Subhead>In progress and provisional</Subhead>
      <div data-af-sample="live">
        <Sample label="Other calls: an in-progress call (no result, no duration)" copyKey={`${F.liveOther.source} · copy.ui1.analysis.conversations.inProgress`} wide>
          <OtherCalls calls={liveOthers} />
        </Sample>
        <Sample label="A card in progress (synthetic from the S6 card)" copyKey={`${F.s6Card.source} · in_progress: true`} wide>
          <Conversations items={[{ ...s6Card, in_progress: true, duration_seconds: null, conversation_id: `${s6Card.conversation_id}-live` }]} otherCalls={[]} asOf={F.s6Card.asOf!} />
        </Sample>
        <Sample label="A provisional card (synthetic: no fixture carries provisional)" copyKey="call_log_state: provisional · copy.ui1.analysis.conversations.provisional" wide>
          <Conversations items={[{ ...s6Card, call_log_state: "provisional", conversation_id: `${s6Card.conversation_id}-prov` }]} otherCalls={[]} asOf={F.s6Card.asOf!} />
        </Sample>
      </div>

      <Subhead>Transcript with missing ranges and Load more</Subhead>
      <div data-af-sample="transcript">
        <Sample label="offset 2, limit 3: segments_before:2 · segments_after:5" copyKey={`${F.transcriptPartial.source} · copy.ui1.analysis.transcript.missing`} wide>
          <TranscriptView conversationId={partial.conversation_id} segments={partial.segments} available missingRanges={partial.completeness.missing_ranges} hasMore={partial.next_offset != null} onLoadMore={noop} />
        </Sample>
      </div>

      <Subhead>Skeletons</Subhead>
      <div data-af-sample="skeletons">
        <Sample label="FindingsSkeleton" copyKey="FindingsSkeleton" wide>
          <FindingsSkeleton />
        </Sample>
        <Sample label="EvidenceInlineSkeleton" copyKey="EvidenceInlineSkeleton">
          <EvidenceInlineSkeleton />
        </Sample>
        <Sample label="ConversationsSkeleton" copyKey="ConversationsSkeleton" wide>
          <ConversationsSkeleton />
        </Sample>
        <Sample label="TranscriptSkeleton" copyKey="TranscriptSkeleton" wide>
          <TranscriptSkeleton />
        </Sample>
      </div>

      <Subhead>390 px</Subhead>
      <div className="si-gallery__frame" data-frame="390" data-af-sample="phone">
        <Findings findings={findings.slice(0, 3)} reason={null} truncated={false} asOf={findingsAsOf} onAction={noop} showLookAgain />
        <Conversations items={cards.slice(1, 2)} otherCalls={others} asOf={F.conversations.asOf!} renderTranscript={transcriptFor} openTranscripts={[transcript.conversation_id]} />
      </div>
    </GallerySection>
  );
}
