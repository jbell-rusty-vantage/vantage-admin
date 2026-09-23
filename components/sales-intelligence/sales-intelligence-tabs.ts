import { copy } from "./sales-intelligence-copy";
import { assessmentCopy } from "./evidence-chain-copy";

export const SI_VIEW_KEYS = ["attention", "numbers", "reps", "coverage", "guide"] as const;
export type SiViewKey = (typeof SI_VIEW_KEYS)[number];

// `assessment` opens the same analysis reading surface on its Assessment section (Move assessment §8.1/§8.3).
export const SI_PANEL_KEYS = ["activity", "summary", "analysis", "assessment", "matches", "work"] as const;
export type SiPanelKey = (typeof SI_PANEL_KEYS)[number];

export const GUIDE_TOPIC_KEYS = [
  "workspace",
  "views",
  "bands",
  "statuses",
  "review",
  "numbers",
  "attachments",
  "coverage",
  "analysis",
  "summary",
  "call",
  "provenance",
  "messaging",
] as const;
export type GuideTopic = (typeof GUIDE_TOPIC_KEYS)[number];

export const SI_VIEW_TABS = SI_VIEW_KEYS.map((key) => ({
  key,
  label: copy.page.views[key],
}));

const PANEL_LABELS: Record<SiPanelKey, string> = { ...copy.panel.tabs, assessment: assessmentCopy.tab };
export const SI_PANEL_TABS = SI_PANEL_KEYS.map((key) => ({
  key,
  label: PANEL_LABELS[key],
}));

export const GUIDE_TOPICS = GUIDE_TOPIC_KEYS.map((key) => ({
  key,
  label: copy.guide.topics[key],
}));

export function parseSiView(value: string | null): SiViewKey {
  return SI_VIEW_KEYS.includes(value as SiViewKey) ? (value as SiViewKey) : "attention";
}

export function parseSiPanel(value: string | null): SiPanelKey {
  return SI_PANEL_KEYS.includes(value as SiPanelKey) ? (value as SiPanelKey) : "activity";
}

export function parseGuideTopic(value: string | null): GuideTopic {
  return GUIDE_TOPIC_KEYS.includes(value as GuideTopic) ? (value as GuideTopic) : "workspace";
}

export function guideHref(topic: GuideTopic) {
  return `/sales-intelligence?view=guide&topic=${topic}`;
}
