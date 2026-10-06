/**
 * Every Owner-visible string of the Automations hub (`/automations`): the tab that hosts the operations the Owner
 * starts and approves. Granot updates (doc 17) is the first; later ones (more Granot reads and extractions) get a
 * card each. Words: "automation" is the plain word for one of these; never "ingestion", "run", "plan" or "checksum".
 */
export const AUTOMATIONS_COPY = {
  title: "Automations",
  purpose: "Things Vantage can do for you on request. Each one reads Granot and prepares changes; nothing changes until you approve.",
  help: {
    label: "What this page is for",
    body: "Each card is one automation. Open it to choose what to check, see what it found, and approve the changes you want. Today will tell you when one is waiting for you.",
  },
  waiting: {
    title: "Waiting for you",
    line: (window: string, ready: number, expires: string | null) =>
      `${window} · ${ready === 1 ? "1 update ready" : `${ready} updates ready`}${expires ? ` · expires in ${expires}` : ""}`,
    review: "Review",
  },
  granotUpdates: {
    title: "Granot updates",
    purpose: "Bring job details from Granot into your leads: quoted, cubic feet, missing cities and zips, the rep, booked calls.",
    open: "Open",
    lastCheck: (when: string, applied: number) => `Last check ${when} · applied ${applied}`,
    lastCheckWaiting: (when: string) => `Last check ${when} · waiting for your approval`,
    lastCheckRunning: (when: string) => `Last check ${when} · still reading Granot`,
    noCheck: "No check yet",
    loadFailed: "The checks could not load.",
    loading: "Loading",
  },
  comingSoon: "More automations will appear here as they are built.",
} as const;
