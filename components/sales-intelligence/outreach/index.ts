/** UI1-SHELL: the Outreach route's exports (the coordinator mounts `OutreachPage` and `OutreachRouteSkeleton`). */
export { OutreachPage, OutreachPageFrame, AnalysisPlaceholder, outreachTabs, type OutreachPageProps } from "./outreach-page";
export { OutreachRouteSkeleton, OutreachNotFound, AnalysisSectionsSkeleton, ANALYSIS_SECTIONS, isNotFoundError } from "./page-states";
export {
  RecordHeader, RecordHeaderView, RecordHeaderSkeleton, activeCallRestriction, bandLine, headerChips, headerRow, numberIdOf, receiverTip,
  showReceiverAgent, subjectKeyOf, useCallRestriction, type CallRestriction, type RecordHeaderViewProps,
} from "./record-header";
export { RecordCommands, groupCommands, disabledReason, HEADER_COMMAND_LABELS, type CommandGroups } from "./commands";
export { WorkTab, WorkTabSkeleton, CorrectionsView, instructionText } from "./work-tab";
export { LeadDeepLink, leadTargetHref } from "./lead-deep-link";
export {
  ANALYSIS_ANCHORS, DEFAULT_OUTREACH_TAB, OUTREACH_TABS, backHref, deepLinkTarget, outreachRouteHref, parseOutreachTab, validReturn,
  type AnalysisAnchor, type DeepLinkTarget, type OutreachTab,
} from "./deep-links";
