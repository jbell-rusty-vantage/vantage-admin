/** The analysis kit (UI-0 UX15): the frame, and each section as a presentational component (props in) plus a `*Section` reader. */
export { AnalysisTab, AnalysisTabSkeleton, ANALYSIS_SECTIONS, type AnalysisRole, type AnalysisSlot, type AnalysisSlotContext, type AnalysisTabProps } from "./analysis-tab";
export { Situation, SituationBody, SituationSection, SituationSkeleton, DisputedRecords, leadCostText, summaryLabel, timelineEventHref, type Discrepancy } from "./situation";
export { Scores, ScoresSection, ScoresSkeleton, scoreValueText, confidenceLine, availabilitySentence } from "./scores";
export { NextStep, NextStepSection, NextStepSkeleton, RecordedStep, SuggestedStepView, FromTheCalls, type SuggestedStep } from "./next-step";
export { MoveDetails, MoveDetailsSection, MoveDetailsSkeleton, MoveTableView, markerText } from "./move-details";
export { Advanced, AdvancedSection, AdvancedSkeleton, RunCommand } from "./advanced";
export { ViewEvidence, EvidenceRendererProvider, refIds, type EvidenceTarget, type EvidenceRenderer } from "./cite";
export { FieldRows } from "./field-rows";
