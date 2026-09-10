import { FLORIDA_TIME_ZONE } from "@/lib/floridaTime";

export const DAILY_OPERATIONS_HREF = "/daily";

export const DAILY_COPY = {
  title: "Daily Operations",
  timezone: FLORIDA_TIME_ZONE,
  live: "Live",
  paused: "Paused",
  reconnecting: "Reconnecting…",
  liveOff: "Live off",
  retry: "Retry",
  showingDataFrom: "showing data from",
  headline: "How the day is going",
  origins: "Ingestion Origin",
  companies: "Source Company",
  form: "Form",
  call: "Call",
  waitingForYou: "Waiting for you",
  opened: "opened",
  heldChip: "held",
  heldUntilMorning: "Held until 8:00 AM",
  even: "even",
  missingYesterday: "—",
  yesterdayFull: "Yesterday",
  yesterdayByNow: "Yesterday at this hour",
  arrivals: "Arrivals",
  arrivalsEmpty: "Nothing has arrived yet today.",
  arrivalsSubtitle: "Newest first · every lane",
  arrivalsToday: "today",
  arrivalsInMemory: "in view",
  lastFact: "last fact",
  noFactYet: "no fact yet",
  justNow: "Just now",
  ago: "ago",
  panels: "Panels",
  panelsSubtitle: "One stack per category · pick a tab to see one alone",
  panelTabs: "Panel view",
  allPanels: "All panels",
  onlyThis: "Only this",
  openAll: "Open all",
  fullStream: "Open full stream",
  allLanes: "All lanes",
  cards: "cards",
  layout: "Layout",
  layoutGrid: "Grid",
  layoutColumn: "Column",
  close: "Close",
  wholeDayLoaded: "Every fact for today is loaded",
  filtered: "Filtered",
  formShare: "form",
  callShare: "call",
  quietPriorities: "Quiet priorities",
  sheetSyncShow: "Show Sheet Sync",
  sheetSyncHide: "Hide Sheet Sync",
  colors: "Colours",
  colorsTitle: "Event type colours",
  colorsSubtitle: "Pick a colour for each event type. Saved on this browser.",
  colorsReset: "Reset colours",
  colorsClose: "Done",
  colorsCustom: "custom",
  loadEarlier: "Load earlier",
  vsYesterdayByNow: "vs yesterday at this hour",
  vsTwoDayAverage: "vs 2-day avg at this hour",
  dayBefore: "Day before",
  byNow: "by now",
  noBaseline: "no prior day yet",
  rhythm: "Hourly rhythm",
  rhythmSubtitle: "Facts per hour · today against the two prior days",
  rhythmNow: "now",
  rhythmToday: "Today",
  rhythmYesterday: "Yesterday",
  rhythmDayBefore: "Day before",
  rhythmSeries: {
    leads: "Leads",
    bookings: "Bookings",
    cancellations: "Cancellations",
    webhooks: "Granot receipts",
    messages: "Texts",
  },
  boardToolbar: "Board controls",
  factLabels: {
    customer: "Customer",
    phone: "Phone",
    company: "Source Company",
    origin: "Ingestion Origin",
    leadKind: "Lead",
    job: "Job Number",
    route: "Route",
    from: "From",
    to: "To",
    moveType: "Move",
    local: "local",
    longDistance: "long distance",
    textPurpose: "Purpose",
    textStatus: "Status",
    textSendAt: "Send at",
    textSkipReason: "Skipped because",
    granotClass: "Granot class",
    granotAction: "Booking action",
    granotDecision: "Decision",
    bookingKind: "Booking kind",
    exceptionCode: "Code",
    exceptionDetail: "Detail",
    sheetSyncResource: "Sheet rows",
    sheetSyncOperation: "Triggered by",
    sheetSyncAttempts: "Attempts",
    sheetSyncError: "Error",
    entity: "Record",
    kind: "Kind",
    receipt: "Receipt",
  },
  textPurposes: {
    quote_request_confirmation: "quote request confirmation",
    granot_create_confirmation: "Granot create confirmation",
  },
  sent: "sent",
  failed: "failed",
  completed: "completed",
  skipped: "skipped",
  heldUntilWindow: "8:00 AM",
  textHeldUntil: "Text held until",
  openLead: "Open lead",
  openList: "Open list",
  openInLiveEvents: "Open in Live Events",
  openIntake: "Open intake",
  openJobTimeline: "Open Job Timeline",
  openBooking: "Open Booking",
  openCancellation: "Open Cancellation",
  openLeadMessage: "Open Lead Message",
  openObservational: "Open Observational",
  openGranotLifecycleHealth: "Open Granot Lifecycle Health",
  zipStateNotFound: "state not found",
  phoneMask: "••",
  loading: "Loading Daily Operations…",
  loadFailed: "Could not load Daily Operations.",
  panelsEmpty: "Nothing in this category yet today.",
  exceptionsEmpty: "No exceptions so far today.",
  countWithoutCards: "This count is on the board; the cards are still loading.",
  tiles: {
    leads: "Leads",
    formCall: "Form / Call",
    duplicates: "Duplicates",
    bookings: "Bookings",
    cancellations: "Cancellations",
    texts: "Texts sent",
    granot: "Granot receipts",
    intakes: "Intakes",
  },
  originsLabels: {
    granot_lead_created: "Granot lead created",
    ringcentral: "RingCentral",
    best_relocation_sheet: "Best Relocation",
    vantage_admin: "Vantage Admin",
    wordpress_form: "WordPress form",
  },
  granotClasses: {
    lead_created: "lead created",
    priority_updated: "priority updated",
    booked: "Booked",
    release: "Release",
  },
  panelsLabels: {
    lead: "Leads",
    text: "Texts",
    granot: "Granot",
    intake: "Intakes",
    booking: "Bookings",
    cancellation: "Cancellations",
    exception: "Exceptions",
    sheet_sync: "Sheet Sync",
  },
  kindTitles: {
    "form_lead.created": "Form Lead created",
    "form_lead.duplicate": "Duplicate Form Lead",
    "call_lead.created": "Call Lead created",
    "call_lead.duplicate": "Duplicate Call Lead",
    "call_lead.unmatched": "Unmatched Call Lead",
    "granot.lead_created": "Granot lead created",
    "granot.priority_updated": "Granot priority updated",
    "granot.booked": "Granot Booked",
    "granot.release": "Granot Release",
    "granot.minted": "Created a Lead from Granot",
    "granot.linked": "Linked to existing Lead",
    "granot.observed": "Observing only",
    "granot.pending_match": "Waiting to match",
    "granot.unmatched": "No matching Lead",
    "intake.opened": "Intake opened",
    "intake.refreshed": "Intake refreshed",
    "text.deferred": "Text held until {time}",
    "text.sent": "Text sent",
    "text.skipped": "Text skipped",
    "text.failed": "Text failed",
    "booking.created": "Booking written",
    "booking.employee_pending": "Employee Booking — pending Lead",
    "cancellation.created": "Cancellation written",
    "sheet_sync.completed": "Sheet Sync completed",
    "sheet_sync.failed": "Sheet Sync failed",
    "exception.zip_missing": "ZIP did not produce a state",
    "exception.crm_failed": "CRM Posting failed",
    "exception.dead_letter": "Granot dead letter",
    "exception.adoption_conflict": "RingCentral adoption conflict",
  },
} as const;

export const DAILY_QUIET_PRIORITIES_STORAGE_KEY = "vantage-admin-daily-quiet-priorities";
export const DAILY_SHEET_SYNC_STORAGE_KEY = "vantage-admin-daily-sheet-sync";

/**
 * Short Owner label for a kind slug — used on the coloured kind badge and in
 * the Colours panel. Falls back to the catalog title, then the slug.
 */
export function dailyOperationsKindLabel(kind: string): string {
  const title = DAILY_COPY.kindTitles[kind as keyof typeof DAILY_COPY.kindTitles];
  if (title) {
    return title.replace(" {time}", "");
  }
  return kind.replace(/[._]/g, " ");
}

/**
 * Relative stamp for Arrivals: `Just now` under 10s, then seconds, minutes,
 * hours. Never negative (a server clock slightly ahead still reads Just now).
 */
export function formatDailyOperationsRelative(occurredAt: string | Date, nowMs: number): string {
  const then = occurredAt instanceof Date ? occurredAt.getTime() : Date.parse(occurredAt);
  if (!Number.isFinite(then)) {
    return DAILY_COPY.missingYesterday;
  }
  const seconds = Math.max(0, Math.floor((nowMs - then) / 1000));
  if (seconds < 10) {
    return DAILY_COPY.justNow;
  }
  if (seconds < 60) {
    return `${seconds}s ${DAILY_COPY.ago}`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ${DAILY_COPY.ago}`;
  }
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${DAILY_COPY.ago}`;
}

export function dailyOperationsTextPurposeLabel(purpose: string): string {
  const catalog = DAILY_COPY.textPurposes[purpose as keyof typeof DAILY_COPY.textPurposes];
  return catalog ?? purpose.replace(/_/g, " ");
}

export function dailyOperationsFilteredEmpty(category: string, companyLabel: string): string {
  return `No ${category} for ${companyLabel} today.`;
}

export function dailyOperationsTextsHeader(input: {
  sent: number;
  heldNow: number;
  failed: number;
}): string {
  return `${input.sent} ${DAILY_COPY.sent} · ${input.heldNow} ${DAILY_COPY.heldChip} until ${DAILY_COPY.heldUntilWindow} · ${input.failed} ${DAILY_COPY.failed}`;
}

export function dailyOperationsHeldTextTitle(sendAt: string | Date | null | undefined): string {
  if (!sendAt) {
    return DAILY_COPY.kindTitles["text.deferred"].replace(" {time}", "");
  }
  return `${DAILY_COPY.textHeldUntil} ${formatDailyOperationsClock(sendAt)}`;
}

export function dailyOperationsZipChip(zip: string): string {
  return `ZIP ${zip} · ${DAILY_COPY.zipStateNotFound}`;
}

export function dailyOperationsPhoneLast4(last4: string | null | undefined): string | null {
  const digits = last4?.replace(/\D/g, "") ?? "";
  if (digits.length < 4) {
    return null;
  }
  return `${DAILY_COPY.phoneMask}${digits.slice(-4)}`;
}

const easternDayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: FLORIDA_TIME_ZONE,
  weekday: "short",
  month: "short",
  day: "numeric",
});

const easternClockFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: FLORIDA_TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
});

export function formatDailyOperationsDay(value: string | Date): string {
  const date = value instanceof Date ? value : parseDayOrInstant(value);
  if (!date) {
    return DAILY_COPY.missingYesterday;
  }
  return `${easternDayFormatter.format(date)} · ${FLORIDA_TIME_ZONE}`;
}

const easternHourFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: FLORIDA_TIME_ZONE,
  hour: "numeric",
  hourCycle: "h23",
});

/** Florida hour (0–23) of an instant; 23 when the instant cannot be parsed. */
export function dailyOperationsFloridaHour(value: string | Date): number {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 23;
  }
  const parsed = Number.parseInt(easternHourFormatter.format(date), 10);
  return Number.isFinite(parsed) ? Math.min(23, Math.max(0, parsed)) : 23;
}

export function formatDailyOperationsClock(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return DAILY_COPY.missingYesterday;
  }
  return easternClockFormatter.format(date);
}

function parseDayOrInstant(value: string): Date | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1, 16));
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
