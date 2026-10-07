/** Every Owner-visible string on Today (`/`). Glossary words: Lead, Booking, Cancellation, Intake, Source Company, Outreach Desk. */
export const OVERVIEW_INTAKE_PREVIEW_LIMIT = 3;

export const todayCopy = {
  title: "Today",
  tabsLabel: "Today sections",
  tabs: {
    pulse: "Pulse",
    operations: "Operations",
    team: "Team",
    money: "Money",
  },
  live: "Live",
  resynced: (age: string) => `resynced ${age}`,
  clockUnknown: "New York",
  redirecting: "Opening Leads…",

  waiting: {
    title: "Waiting for you",
    bookings: {
      title: (n: number) => (n === 1 ? "1 booking to finish" : `${n} bookings to finish`),
      none: "No Intakes are waiting.",
      action: "Finish →",
      href: "/intakes",
      more: (n: number) => `+${n} more`,
      loadError: "The open Intakes could not load.",
      jobPending: "Job number pending",
    },
    unassigned: {
      title: (n: number) => (n === 1 ? "1 unassigned lead" : `${n} unassigned leads`),
      pendingTitle: "Unassigned leads",
      pending: "Pending",
      none: "Every Lead has a receiver agent.",
      action: "Assign →",
      href: "/outreach-desk?view=team&unassigned=true",
      unavailable: "The Outreach Desk count could not load.",
    },
    // Doc 17: the fourth slot, shown only while a Granot check waits for approval.
    granotUpdates: {
      title: (n: number) => (n === 1 ? "1 Granot update ready" : `${n} Granot updates ready`),
      sub: (window: string, expires: string | null) => (expires ? `${window} · expires in ${expires}` : window),
      more: (n: number) => (n === 1 ? "+1 more check waiting" : `+${n} more checks waiting`),
      action: "Review →",
    },
    exceptions: {
      title: (n: number) => (n === 1 ? "1 exception" : `${n} exceptions`),
      none: "No exceptions today.",
      action: "Open →",
      href: "/?tab=operations&lane=exception",
      kinds: {
        zip_missing: "zip missing",
        crm_failed: "CRM failed",
        dead_letter: "dead letter",
        adoption_conflict: "adoption conflict",
      },
    },
  },

  tiles: {
    leads: "Leads",
    bookings: "Bookings",
    cancellations: "Cancels",
    texts: "Texts",
    spend: "Spend today",
    leadCaption: (form: number, call: number) => `form ${form} · call ${call}`,
    textsCaption: (held: number) => `${held} held`,
    spendValue: "—",
    spendCaption: "Open the Money tab",
    spendCaptionLive: (leads: number) => `${leads} leads priced today`,
    vsYesterday: "Versus yesterday at this hour",
  },

  highlights: {
    title: "Highlights",
    subtitle: "What needs you, and goals reached",
    empty: "Nothing yet today.",
    loadError: "The latest facts could not load.",
    seeAll: "See everything → Operations",
    seeAllHref: "/?tab=operations",
    open: "Open",
  },

  milestones: {
    goalReached: (time: string) => `Goal reached ${time}`,
  },

  reps: {
    title: "Reps today",
    subtitle: "Daily call goals, read-only.",
    columns: { rep: "Rep", calls: "Calls / goal", progress: "Progress", overdue: "Overdue" },
    empty: "No reps on the roster today.",
    unavailable: "Goal tracking is unavailable right now.",
    unknownRep: "Unknown rep",
    noneOverdue: "None",
    open: "Open the desk →",
    openHref: "/outreach-desk?view=team",
    loadError: "Rep goals could not load.",
  },

  companies: {
    title: "By source company (today)",
    columns: { company: "Source Company", form: "Form", call: "Call", total: "Total", yesterday: "Yesterday", spend: "Spend" },
    empty: "No Leads yet today.",
    spendCell: "—",
    note: "Spend is today's live lead cost; a dash means no priced lead yet.",
  },

  snapshotLoadError: "Today's numbers could not load.",

  team: {
    unavailableTitle: "The Outreach Desk isn't available yet",
    openSettings: "Open Settings",
    settingsHref: "/outreach-desk?view=settings",
    cards: {
      repsAtGoal: "Reps at goal",
      overdue: "Overdue leads",
      quotedGaps: "Quoted leads with gaps",
      outbound: "Outbound calls",
    },
    goalsOff: "Goal tracking is switched off in Settings.",
    unavailable: "Unavailable",
    noGoals: "No rep has a goal today",
    partial: (n: number) => (n === 1 ? "1 rep still pending" : `${n} reps still pending`),
    ofGoal: (pct: string) => `${pct} of goal`,
    ofReps: (pct: string) => `${pct} of reps`,
    goals: {
      title: "Daily call goals",
      columns: { rep: "Rep", calls: "Calls / goal", progress: "Progress", remaining: "Remaining", overdue: "Overdue", action: "Queue" },
      viewQueue: "View queue",
      empty: "No reps on the roster today.",
      overdueCount: (n: number) => `${n} overdue`,
      none: "None",
    },
    attention: {
      title: "Leads needing attention",
      columns: { job: "Job #", owner: "Owner", priority: "Priority", issue: "Issue", last: "Last interaction" },
      empty: "No Leads need attention.",
      unavailable: "Lead cadence isn't running yet, so there's no attention list.",
      seeAll: "See all in the desk",
      seeAllHref: "/outreach-desk?view=team",
      jobPending: "Job number pending",
    },
    readOnly: "Read-only summary. Assignment, callbacks and overrides stay in the Outreach Desk.",
    loadError: "Team goals and Lead counts could not load.",
  },

  money: {
    ranges: { today: "Today", yesterday: "Yesterday", this_week: "This week", this_month: "This month" },
    rangeLabel: "Money range",
    fallbackRanges: { last_7_days: "Last 7 days", all_time: "All time" },
    fallbackRangeLabel: "Fallback range",
    waitingTitle: "Money is waiting on the server",
    waitingBody:
      "Lead spend per day and rep cost per lead need the Money endpoint and rep compensation in Setup → Money. Until then, this tab shows the 7-day and all-time lead cost from the Overview report.",
    cards: { leadSpend: "Lead spend", costPerLead: "Cost / lead", costPerBooked: "Cost / booked lead", repCostPerLead: "Rep cost / lead" },
    bySource: {
      title: "By source company",
      columns: { company: "Source Company", leads: "Leads", dup: "Dup", rate: "Rate", spend: "Spend", booked: "Booked", perBooked: "$ / booked", unpriced: "Unpriced" },
      unpricedHint: "Missing is not zero. Set the rate in Setup → Lead costs.",
      unpricedHref: "/setup/lead-costs",
      rateMissing: "missing",
      empty: "No Leads in this range.",
      total: "Total",
    },
    fallbackColumns: { company: "Source Company", leads: "Leads", spend: "Spend", unpriced: "Unpriced" },
    byRep: {
      title: "By rep",
      columns: { rep: "Rep", received: "Leads received", calls: "Calls", booked: "Booked", cost: "Rep cost", perLead: "Cost / lead", perBooked: "Cost / booked" },
      needsCompensation: "Needs rep compensation (server work)",
      compensationMissing: "no rate",
      empty: "No reps in this range.",
    },
    overviewError: "The Overview report could not load.",
    loadError: "The Money read failed.",
    generatedAt: (time: string) => `As of ${time}`,
    pending: "—",
  },
} as const;
