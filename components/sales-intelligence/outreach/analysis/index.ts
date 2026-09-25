/** The analysis kit (UI-0 UX15): the frame, and each section as a presentational component (props in) plus a `*Section` reader. */
export {
  AnalysisTab, AnalysisTabSkeleton, ANALYSIS_SECTIONS, defaultConversations, defaultFindings, reviewItemHref,
  type AnalysisRole, type AnalysisSlot, type AnalysisSlotContext, type AnalysisTabProps,
} from "./analysis-tab";
export { KitIdProvider, useKitId, useKitPrefix } from "./kit-id";
export { Situation, SituationBody, SituationSection, SituationSkeleton, DisputedRecords, leadCostText, summaryLabel, timelineEventHref, type Discrepancy } from "./situation";
export { Scores, ScoresSection, ScoresSkeleton, scoreValueText, confidenceLine, availabilitySentence } from "./scores";
export { NextStep, NextStepSection, NextStepSkeleton, RecordedStep, SuggestedStepView, FromTheCalls, type SuggestedStep } from "./next-step";
export { MoveDetails, MoveDetailsSection, MoveDetailsSkeleton, MoveTableView, markerText } from "./move-details";
export { Advanced, AdvancedSection, AdvancedSkeleton, RunCommand } from "./advanced";
export { ViewEvidence, refIds, type EvidenceTarget } from "./cite";
export { FieldRows } from "./field-rows";
export {
  Findings, FindingsSection, FindingsSkeleton, FindingBlock, FindingSkeleton, ChangesSinceLast, InstructionAssessments,
  groupFindings, workResultText, findingAnchor, CATEGORY_ORDER,
  type FindingAction, type FindingBlockProps, type FindingGroup, type FindingsProps, type InstructionAssessment, type PriorRelation,
} from "./findings";
export {
  EvidenceInline, EvidenceInlineSkeleton, EvidenceList, EvidenceLine, EvidenceToggle, evidenceShape, resolveEvidenceRefs,
  type EvidenceRefView, type EvidenceShape, type EvidenceToggleProps, type EvidenceView,
} from "./evidence-inline";
export {
  Conversations, ConversationsSection, ConversationsSkeleton, ConversationCardView, ConversationCardSkeleton, OtherCalls,
  durationText, repText, recordingText, type ConversationCardProps, type ConversationsProps,
} from "./conversations";
export {
  Transcript, TranscriptView, TranscriptSkeleton, scrollToSegments, clearTranscriptTarget, useTranscriptTarget, segmentAnchor, offsetText, missingRangeText,
  type TranscriptSegment, type TranscriptTarget, type TranscriptViewProps,
} from "./transcript";
export { AudioPlayer, AudioPlayerSkeleton, probeMediaStatus, audioStateForStatus, type AudioState } from "./audio-player";
