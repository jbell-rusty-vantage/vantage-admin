import { copy } from "./sales-intelligence-copy";
import { assessmentCopy } from "./evidence-chain-copy";

export const SI_VIEW_KEYS = ["attention", "numbers", "reps", "coverage", "guide"] as const;
export type SiViewKey = (typeof SI_VIEW_KEYS)[number];

// `assessment` opens the same analysis reading surface on its Assessment section (Move assessment §8.1/§8.3).
export const SI_PANEL_KEYS = ["activity", "summary", "analysis", "assessment", "matches", "work"] as const;
export type SiPanelKey = (typeof SI_PANEL_KEYS)[number];

// UI1-COVER: the rewritten Guide's sections, in page order (UI-1 §6, COPY-UI1 §12).
export const GUIDE_TOPIC_KEYS = [
  "views",
  "bands",
  "presets",
  "card",
  "live",
  "numbers",
  "messaging",
  "coverage",
  "statuses",
  "review",
  "call",
  "provenance",
  "attachments",
  "analysis",
  "summary",
] as const;
export type GuideSection = (typeof GUIDE_TOPIC_KEYS)[number];
/** Topics the old Guide had that the new one folds into a section; kept so old links and legacy tooltips still land. */
export const GUIDE_TOPIC_ALIASES = { workspace: "views" } as const satisfies Record<string, GuideSection>;
export type GuideTopic = GuideSection | keyof typeof GUIDE_TOPIC_ALIASES;

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
  label: copy.ui1.guide.topics[key],
}));

export function parseSiView(value: string | null): SiViewKey {
  return SI_VIEW_KEYS.includes(value as SiViewKey) ? (value as SiViewKey) : "attention";
}

export function parseSiPanel(value: string | null): SiPanelKey {
  return SI_PANEL_KEYS.includes(value as SiPanelKey) ? (value as SiPanelKey) : "activity";
}

/** The section `?topic=` opens: a section key, a retired topic's section, else the first section. */
export function parseGuideTopic(value: string | null): GuideSection {
  if (GUIDE_TOPIC_KEYS.includes(value as GuideSection)) return value as GuideSection;
  if (value && Object.hasOwn(GUIDE_TOPIC_ALIASES, value)) return GUIDE_TOPIC_ALIASES[value as keyof typeof GUIDE_TOPIC_ALIASES];
  return "views";
}

export function guideHref(topic: GuideTopic) {
  return `/sales-intelligence?view=guide&topic=${parseGuideTopic(topic)}`;
}
