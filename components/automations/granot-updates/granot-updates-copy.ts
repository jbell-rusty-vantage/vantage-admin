/**
 * Every Owner-visible string of Granot updates (doc 17), under the Automations tab. The reader owns a moving company:
 * say what happens, then what to do. Words: "Granot updates", a "check", the button "Check Granot". Never "Granot
 * sync" (that is the browser extension), "ingestion", "durable plan", "run group" or "checksum" on screen; no
 * em-dashes (use "·"). Must pass `findOwnerMarkupLeaks` (`lib/operations-registry/ownerLanguageDeck.ts`).
 */
import { GRANOT_UPDATES_HREF } from "@/lib/automations/granot-updates-redirects";

export const GRANOT_UPDATES_COPY = {
  title: "Granot updates",
  purpose: "Bring job details from Granot into your leads. Nothing changes until you approve.",
  href: GRANOT_UPDATES_HREF,
  back: "All Granot updates",

  /** The How it works popover and the empty state before the first check (doc 17's four answers, verbatim). */
  howItWorks: {
    label: "How it works",
    whatItDoes: {
      title: "What it does",
      body: "It reads Granot's Booked Jobs and Follow Up Estimates reports for the chosen sources and dates, finds the matching Vantage lead, and proposes filling what Granot knows and Vantage does not.",
    },
    whatItNeverDoes: {
      title: "What it never does",
      body: "It never creates a lead. It never changes a lead you do not tick. It never overwrites a city, zip, state or rep that a lead already has. The one exception: when Granot's priority shows a quoted estimate (priority 1 or 5), it marks the lead Quoted and takes Granot's cubic feet, even over an older figure. The review shows the old value beside the new one. Approved changes go through the same checks as Granot webhooks.",
    },
    whenToRun: {
      title: "When to run it",
      body: "Every morning, with Since last check. After a Granot outage. Before month-end reports.",
    },
    whatToSkip: {
      title: "What to skip",
      body: "Untick Fallback matches unless you recognise the customer; open Needs a look rows in the lead panel before deciding.",
    },
  },

  /** Lead types (step ①), one line each saying what that type fills. */
  leadTypes: {
    label: "What to update",
    form: { title: "Form leads", fills: "fills quoted + cubic feet, missing cities and zips, the rep" },
    call: { title: "Call leads", fills: "fills job details, links booked calls, sets the rep" },
    none: "Pick at least one lead type.",
  },

  /** Granot names (step ①). "Granot name" is the Setup word for a Granot source label. */
  sources: {
    label: "Which Granot names",
    allReady: (n: number) => `All ready (${n})`,
    selected: (n: number, total: number) => `${n} of ${total} selected`,
    selectAll: "Select all ready",
    clear: "Clear",
    otherCompany: "Other",
    loading: "Reading the Granot names…",
    loadFailed: "The Granot names could not load.",
    none: "No Granot names are set up yet. Add one in Setup → Lead sources.",
    notReady: (n: number) => (n === 1 ? "1 not ready" : `${n} not ready`),
    notReadyReason: {
      missing_reference: "has no Granot name in Setup yet",
      source_disabled: "is switched off in Setup",
      source_ambiguous: "matches more than one Granot name in Setup",
      operation_not_permitted: "does not land on a feed for this lead type",
      unknown: "is not ready",
    },
    fixInSetup: "Fix in Setup ›",
    setupHref: (granotCrmSourceId?: string) => (granotCrmSourceId ? `/setup/lead-sources?view=granot&granot=${encodeURIComponent(granotCrmSourceId)}` : "/setup/lead-sources?view=granot"),
    addHref: "/setup/lead-sources?view=granot&granot=new",
    needOne: "Pick at least one Granot name for each lead type.",
  },

  /** Which jobs (step ①). */
  jobs: {
    label: "Which jobs",
    presets: {
      since: "Since last check",
      today: "Today",
      yesterday: "Yesterday",
      last7: "Last 7 days",
      custom: "Custom",
    },
    sinceNone: "No applied check yet",
    matchedBy: "matched by",
    opened: "Opened date",
    booked: "Booked date",
    timeZone: "New York time",
    from: "From",
    to: "Through",
    reversed: "The first day must not be after the last day.",
    large: "Large windows take longer and produce long reviews.",
  },

  /** The sentence over the button and the button itself. */
  sentence: (sources: number, factor: "opened" | "booked", window: string, leadTypes: string) =>
    `Check ${sources === 1 ? "1 Granot name" : `${sources} Granot names`} for jobs ${factor} ${window} and prepare updates for ${leadTypes} leads. Nothing changes until you approve.`,
  checkGranot: "Check Granot",
  checking: "Checking…",
  createFailed: "The check could not start.",
  newCheck: "New Granot check",
  stepOne: "Choose",

  /** The Waiting for you notice on the start page and the hub. */
  waiting: {
    title: "Waiting for you",
    ready: (n: number) => (n === 1 ? "1 update ready" : `${n} updates ready`),
    expires: (words: string) => `expires in ${words}`,
    review: "Review",
    more: (n: number) => (n === 1 ? "1 more check is waiting" : `${n} more checks are waiting`),
  },

  /** History on the start page. */
  history: {
    title: "History",
    filters: { all: "All", waiting: "Waiting", done: "Done", failed: "Failed" },
    columns: { when: "When", window: "Jobs", leadTypes: "Lead types", sources: "Granot names", outcome: "Outcome" },
    sources: (n: number) => (n === 1 ? "1 name" : `${n} names`),
    view: "View ›",
    loadMore: "Load more",
    empty: "No checks yet. Start one above.",
    emptyFiltered: "No checks match this filter.",
    loadFailed: "The history could not load.",
    pageSize: 25,
  },

  /** Statuses in words. */
  status: {
    checking: "Checking Granot",
    awaiting: "Waiting for approval",
    applying: "Applying",
    done: "Done",
    done_with_errors: "Done with errors",
    failed: "Failed",
    expired: "Expired",
  },

  /** ② Granot reads. */
  progress: {
    title: (startedAt: string) => `Checking Granot · started ${startedAt}`,
    signedIn: "Signed in",
    signingIn: "Signing in",
    reading: "Reading sources",
    readingOf: (done: number, total: number) => `${done} / ${total}`,
    matching: "Matching to leads",
    waitingTurn: "Waiting its turn",
    leadTypeLine: (leadType: string, words: string) => `${leadType}: ${words}`,
    readingName: (name: string) => `reading ${name}…`,
    waiting: "waiting",
    planned: "ready to review",
    leave: "You can leave this page. Today will show “Granot updates ready” when done.",
    failedTitle: "The check stopped",
    tryAgain: "Try again",
    tryAgainHint: "Starts a new check with the same choices.",
    queued: "Waiting for Granot",
  },

  /** ③ Review & approve. */
  review: {
    expires: (words: string) => `expires in ${words}`,
    expired: "This check expired before it was approved. Check again to prepare fresh updates.",
    cards: {
      ready: { title: "Ready", caption: (form: number, call: number) => `${form} form · ${call} call` },
      look: { title: "Needs a look", caption: "needs a decision" },
      missing: { title: "Not found", caption: "not in Vantage" },
      same: { title: "No change", caption: "already current" },
    },
    tabs: { ready: "Ready", look: "Needs a look", missing: "Not found", same: "No change", sources: "Sources" },
    leadTypeChip: { all: "Both lead types", form: "Form leads", call: "Call leads" },
    hideFallback: "Hide fallback matches",
    columns: { select: "Apply", job: "Job #", lead: "Lead", source: "Granot name", changes: "What changes", matchedBy: "Matched by", reason: "Why", result: "Result" },
    selectAll: "Select every ready update",
    selectOne: (job: string) => `Apply the update for job ${job}`,
    openLead: "Open lead ›",
    callLead: "(call)",
    formLead: "(form)",
    noLead: "No lead",
    unknownJob: "No job #",
    unknownChange: "—",
    fallbackWarning: "Matched by a fallback rule; untick unless you recognise the customer.",
    phoneWarning: "Matched by phone only; untick unless you recognise the customer.",
    cannotSelect: "Needs a decision first; open the lead before changing it by hand.",
    lookReason: {
      ambiguous_fallback: "More than one lead could be this job",
      ambiguous: "More than one lead could be this job",
      conflict: "The lead holds a different value",
      booking_missing: "The lead has no booking to link",
      invalid: "Granot's row could not be read",
      failed: "The check could not decide",
    },
    missingReason: "Not in Vantage. Granot's phone may have changed, or the lead is older than we keep.",
    sameCollapsed: (n: number) => (n === 1 ? "1 lead already matches Granot" : `${n} leads already match Granot`),
    sameShow: "Show them",
    sameHide: "Hide",
    emptyTab: "Nothing here.",
    sourcesColumns: { name: "Granot name", booked: "Booked jobs", followUp: "Follow-up estimates", rows: "Rows" },
    notObserved: "requested but not observed",
    sourcesEmpty: "No sources were read yet.",
    bar: {
      selected: (n: number) => (n === 1 ? "1 selected" : `${n} selected`),
      split: (form: number, call: number) => `${form} form · ${call} call`,
      apply: (n: number) => (n === 1 ? "Apply 1 update" : `Apply ${n} updates`),
      none: "Tick the updates to apply",
    },
    dialog: {
      title: (updates: number, leads: number) => `Apply ${updates === 1 ? "1 update" : `${updates} updates`} to ${leads === 1 ? "1 lead" : `${leads} leads`}?`,
      plan: (shortId: string, preparedAt: string) => `This is plan ${shortId} (prepared ${preparedAt}). If Granot data changed since then, you will be asked to check again.`,
      cancel: "Cancel",
      confirm: (n: number) => (n === 1 ? "Apply 1 update" : `Apply ${n} updates`),
      applying: "Applying…",
    },
    stale: "This plan changed or expired.",
    checkAgain: "Check again",
    approveFailed: "The updates could not be sent.",
    applyDisabled: "Applying updates is switched off on the server. Ask for it to be turned on, then check again.",
  },

  /** ④ Results. */
  results: {
    title: (window: string, appliedAt: string) => `Granot updates · ${window} · applied ${appliedAt}`,
    applying: (done: number, total: number) => `Applying ${done} / ${total}`,
    cards: { applied: "Applied", same: "Already current", failed: "Failed", pending: "Pending" },
    tabs: { applied: "Applied", same: "Already current", failed: "Failed", pending: "Pending", notSelected: "Not selected" },
    columns: { job: "Job #", lead: "Lead", changes: "What changed", result: "Result" },
    exportCsv: "Export CSV",
    csvName: (window: string) => `granot-updates-${window}.csv`,
    audit: "Audit details",
    auditTitle: "Audit details",
    auditRows: { receipt: "Receipt", observation: "Observation", decision: "Decision", plan: "Plan", action: "Action", applied: "Applied at", error: "Error code" },
    notSelectedHint: "Ready updates you left unticked. They were not applied.",
    empty: "Nothing here.",
    none: "No updates were applied.",
    resultAt: (words: string, time: string) => `${words} ${time}`,
  },

  /** The check page when the id is unknown or the reads fail. */
  notFound: "This check could not be found. It may be older than the history we keep.",
  loadFailed: "The check could not load.",
  loading: "Loading the check…",
  owner: { title: "Not allowed", body: "Granot updates are for the owner." },
} as const;

export type GranotUpdatesCopy = typeof GRANOT_UPDATES_COPY;
