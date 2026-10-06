/** Strings the check page needs that the shared Granot updates copy does not carry (no em-dashes, Owner language). */
export const CHECK_COPY = {
  title: (window: string, names: number) => `Granot updates · ${window} · ${names === 1 ? "1 Granot name" : `${names} Granot names`}`,
  subtitle: (leadTypes: string, created: string) => `${leadTypes} leads · created ${created}`,
  backLabel: (back: string) => `← ${back}`,
  reviewTabsLabel: "Review sections",
  resultsTabsLabel: "Result sections",
  leadTypeLabel: "Lead type",
  progressLabel: "Reading progress",
  applyLabel: "Applying updates",
  closeAudit: "Close",
  unknown: "—",
  sourcesNone: "—",
  loadingDetail: "Loading the updates…",
  checkWindowKey: (from: string | null, to: string | null) => `${from ?? "start"}-to-${to ?? "now"}`,
  approveLabel: "Apply the selected updates",
  ready: "ready",
} as const;
