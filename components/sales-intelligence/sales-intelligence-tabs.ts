import { copy } from "./sales-intelligence-copy";

export const SI_VIEW_KEYS = ["attention", "numbers", "reps", "coverage", "guide"] as const;
export type SiViewKey = (typeof SI_VIEW_KEYS)[number];

export const SI_PANEL_KEYS = ["activity", "summary", "analysis", "matches", "work"] as const;
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
  "messaging",
] as const;
export type GuideTopic = (typeof GUIDE_TOPIC_KEYS)[number];

export const SI_VIEW_TABS = SI_VIEW_KEYS.map((key) => ({
  key,
  label: copy.page.views[key],
}));

export const SI_PANEL_TABS = SI_PANEL_KEYS.map((key) => ({
  key,
  label: copy.panel.tabs[key],
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
