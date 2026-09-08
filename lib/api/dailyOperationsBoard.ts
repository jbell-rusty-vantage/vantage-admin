import {
  DAILY_COPY,
  dailyOperationsFilteredEmpty,
  dailyOperationsHeldTextTitle,
  dailyOperationsPhoneLast4,
  dailyOperationsTextPurposeLabel,
  dailyOperationsZipChip,
  formatDailyOperationsClock,
} from "@/components/daily/daily-copy";
import { GRANOT_LIFECYCLE_HEALTH_HREF } from "@/components/granot-lifecycle/granot-lifecycle-copy";
import {
  DAILY_OPERATIONS_DEFAULT_PANELS,
  sourceCompanyLabel,
  type DailyOperationsCard,
  type DailyOperationsLane,
  type DailyOperationsLinks,
  type DailyOperationsPanelLane,
  type DailyOperationsSnapshot,
} from "@/lib/api/dailyOperations";
import {
  compareDailyOperationsEventsNewestFirst,
  type DailyOperationsEventItem,
} from "@/lib/api/dailyOperationsLive";
import { LIVE_EVENTS_HREF } from "@/lib/api/granotLiveReceipts";
import { buildJobTimelineHref } from "@/lib/api/jobNumberTimeline";

export const DAILY_OPERATIONS_PANEL_DEFAULT_LIMIT = 8;
export const DAILY_OPERATIONS_PANEL_FOCUSED_LIMIT = 40;
export const DAILY_OPERATIONS_ARRIVALS_LIMIT = 20;
export const DAILY_OPERATIONS_ARRIVAL_HIGHLIGHT_MS = 1500;
export const DAILY_QUIET_PRIORITIES_KIND = "granot.priority_updated";
export const OBSERVATIONAL_HREF = "/observational";

const GRANOT_OUTCOME_KINDS = new Set([
  "granot.minted",
  "granot.linked",
  "granot.observed",
]);

export type DailyOperationsCardLink = {
  href: string;
  label: string;
};

export function isDailyOperationsPanelLane(value: string | null | undefined): value is DailyOperationsPanelLane {
  return (
    value === "lead" ||
    value === "text" ||
    value === "granot" ||
    value === "intake" ||
    value === "booking" ||
    value === "cancellation" ||
    value === "exception" ||
    value === "sheet_sync"
  );
}

export function visibleDailyOperationsPanels(input: {
  lane: string | null;
  sheetSyncOptIn: boolean;
}): DailyOperationsPanelLane[] {
  const focused = isDailyOperationsPanelLane(input.lane) ? input.lane : null;
  const panels: DailyOperationsPanelLane[] = [...DAILY_OPERATIONS_DEFAULT_PANELS];
  if (input.sheetSyncOptIn || focused === "sheet_sync") {
    panels.push("sheet_sync");
  }
  return panels;
}

export function fanOutDailyOperationsEvents(
  events: DailyOperationsEventItem[],
): Record<DailyOperationsPanelLane, DailyOperationsEventItem[]> {
  const next: Record<DailyOperationsPanelLane, DailyOperationsEventItem[]> = {
    lead: [],
    text: [],
    granot: [],
    intake: [],
    booking: [],
    cancellation: [],
    exception: [],
    sheet_sync: [],
  };
  for (const event of events) {
    if (isDailyOperationsPanelLane(event.lane)) {
      next[event.lane].push(event);
    }
  }
  return next;
}

export function filterDailyOperationsEventsByCompany(
  events: DailyOperationsEventItem[],
  company: string | null | undefined,
): DailyOperationsEventItem[] {
  if (!company) {
    return events;
  }
  return events.filter((event) => event.source_company === company);
}

export function applyQuietPriorities(
  events: DailyOperationsEventItem[],
  quiet: boolean,
): DailyOperationsEventItem[] {
  if (!quiet) {
    return events;
  }
  return events.filter((event) => event.kind !== DAILY_QUIET_PRIORITIES_KIND);
}

export function pairGranotEvents(events: DailyOperationsEventItem[]): DailyOperationsEventItem[] {
  const outcomesByParent = new Map<string, DailyOperationsEventItem[]>();
  const standalone: DailyOperationsEventItem[] = [];
  const receipts: DailyOperationsEventItem[] = [];

  for (const event of events) {
    if (GRANOT_OUTCOME_KINDS.has(event.kind) && event.parent_receipt_id) {
      const list = outcomesByParent.get(event.parent_receipt_id) ?? [];
      list.push(event);
      outcomesByParent.set(event.parent_receipt_id, list);
      continue;
    }
    if (event.links.receipt_id || event.kind.startsWith("granot.")) {
      receipts.push(event);
      continue;
    }
    standalone.push(event);
  }

  const grouped: DailyOperationsEventItem[] = [];
  const usedParents = new Set<string>();
  const receiptSorted = [...receipts].sort(compareDailyOperationsEventsNewestFirst);
  for (const receipt of receiptSorted) {
    grouped.push(receipt);
    const parentId = receipt.links.receipt_id ?? receipt.event_id;
    // Two receipt-shaped facts can share one receipt id (the receipt itself and
    // a pending match on it); the outcomes hang under the first, once.
    if (usedParents.has(parentId)) {
      continue;
    }
    const outcomes = (outcomesByParent.get(parentId) ?? []).sort(compareDailyOperationsEventsNewestFirst);
    if (outcomes.length > 0) {
      usedParents.add(parentId);
      grouped.push(...outcomes);
    }
  }

  for (const [parentId, outcomes] of outcomesByParent) {
    if (usedParents.has(parentId)) {
      continue;
    }
    grouped.push(...outcomes.sort(compareDailyOperationsEventsNewestFirst));
  }

  return [...grouped, ...standalone.sort(compareDailyOperationsEventsNewestFirst)];
}

export function eventsForDailyOperationsArrivals(input: {
  events: DailyOperationsEventItem[];
  company?: string | null;
  quietPriorities?: boolean;
  lane?: string | null;
  /** `null` returns every in-memory fact (the full-stream overlay). */
  limit?: number | null;
}): DailyOperationsEventItem[] {
  const companyFiltered = filterDailyOperationsEventsByCompany(input.events, input.company);
  const quietFiltered = applyQuietPriorities(companyFiltered, Boolean(input.quietPriorities));
  const sorted = [...quietFiltered].sort(compareDailyOperationsEventsNewestFirst);
  if (input.limit === null) {
    return sorted;
  }
  return sorted.slice(0, input.limit ?? DAILY_OPERATIONS_ARRIVALS_LIMIT);
}

/**
 * `Load earlier` pages backwards from the oldest fact **this lane** already
 * holds, so switching lanes never reuses a cursor another lane moved. `null`
 * lane pages every lane at once (full-stream overlay). No facts yet → `null`
 * (nothing to page from; the hydration fetch owns the first page).
 */
export function earlierDailyOperationsCursor(
  events: readonly DailyOperationsEventItem[],
  lane: DailyOperationsPanelLane | null,
): string | null {
  let oldest: DailyOperationsEventItem | null = null;
  for (const event of events) {
    if (lane && event.lane !== lane) {
      continue;
    }
    if (!oldest || compareDailyOperationsEventsNewestFirst(event, oldest) > 0) {
      oldest = event;
    }
  }
  return oldest ? `${oldest.occurred_at}:${oldest.event_id}` : null;
}

/**
 * The panel strip: `?lane=` absent shows every panel; a panel lane shows that
 * panel alone (Owner-chosen tab). Sheet Sync joins the strip only when opted
 * in or when it is the chosen lane.
 */
export function panelsForDailyOperationsView(input: {
  lane: string | null;
  sheetSyncOptIn: boolean;
}): { tabs: DailyOperationsPanelLane[]; visible: DailyOperationsPanelLane[]; solo: DailyOperationsPanelLane | null } {
  const tabs = visibleDailyOperationsPanels(input);
  const solo = isDailyOperationsPanelLane(input.lane) && tabs.includes(input.lane) ? input.lane : null;
  return { tabs, visible: solo ? [solo] : tabs, solo };
}

export function newlyArrivedDailyOperationsEventIds(
  previousIds: readonly string[],
  nextIds: readonly string[],
): string[] {
  const previous = new Set(previousIds);
  return nextIds.filter((id) => !previous.has(id));
}

/**
 * Seed after the events query has been applied (including an empty
 * New York day). Until `hydrated`, ignore the list. The first hydrated
 * pass copies raw board ids into `seen` and does not highlight — so a
 * busy snapshot does not flash. After that, only never-seen ids arrive.
 * An empty hydrated seed is required so the first live fact on an empty
 * day still highlights. Company / Quiet / `?lane=` are not the source.
 */
export function seedOrArriveDailyOperationsEventIds(
  seen: ReadonlySet<string>,
  nextRawIds: readonly string[],
  options: { hydrated: boolean; seeded: boolean },
): { arrived: string[]; seen: Set<string>; seeded: boolean } {
  const nextSeen = new Set(seen);
  if (!options.hydrated) {
    return { arrived: [], seen: nextSeen, seeded: false };
  }
  if (!options.seeded) {
    for (const id of nextRawIds) {
      nextSeen.add(id);
    }
    return { arrived: [], seen: nextSeen, seeded: true };
  }
  const arrived = newlyArrivedDailyOperationsEventIds([...seen], nextRawIds);
  for (const id of arrived) {
    nextSeen.add(id);
  }
  return { arrived, seen: nextSeen, seeded: true };
}

export function scheduleArrivalHighlightClear(
  ids: readonly string[],
  onClear: (expiredIds: readonly string[]) => void,
  delayMs = DAILY_OPERATIONS_ARRIVAL_HIGHLIGHT_MS,
): ReturnType<typeof setTimeout> {
  return setTimeout(() => {
    onClear(ids);
  }, delayMs);
}

export function schedulePerIdArrivalHighlightClear(
  timers: Map<string, ReturnType<typeof setTimeout>>,
  ids: readonly string[],
  onClear: (expiredIds: readonly string[]) => void,
  delayMs = DAILY_OPERATIONS_ARRIVAL_HIGHLIGHT_MS,
): void {
  for (const id of ids) {
    const previous = timers.get(id);
    if (previous !== undefined) {
      clearTimeout(previous);
    }
    timers.set(
      id,
      scheduleArrivalHighlightClear(
        [id],
        (expired) => {
          for (const expiredId of expired) {
            timers.delete(expiredId);
          }
          onClear(expired);
        },
        delayMs,
      ),
    );
  }
}

export function clearAllArrivalHighlightTimers(
  timers: Map<string, ReturnType<typeof setTimeout>>,
): void {
  for (const timer of timers.values()) {
    clearTimeout(timer);
  }
  timers.clear();
}

export function eventsForDailyOperationsPanel(input: {
  events: DailyOperationsEventItem[];
  lane: DailyOperationsPanelLane;
  company?: string | null;
  quietPriorities?: boolean;
}): DailyOperationsEventItem[] {
  const byLane = fanOutDailyOperationsEvents(input.events)[input.lane];
  const companyFiltered = filterDailyOperationsEventsByCompany(byLane, input.company);
  const quietFiltered = applyQuietPriorities(companyFiltered, Boolean(input.quietPriorities));
  const ordered =
    input.lane === "granot" ? pairGranotEvents(quietFiltered) : [...quietFiltered].sort(compareDailyOperationsEventsNewestFirst);
  return ordered;
}

export function sliceDailyOperationsPanelEvents(
  events: DailyOperationsEventItem[],
  focused: boolean,
  visibleLimit?: number,
): DailyOperationsEventItem[] {
  const limit =
    visibleLimit ?? (focused ? DAILY_OPERATIONS_PANEL_FOCUSED_LIMIT : DAILY_OPERATIONS_PANEL_DEFAULT_LIMIT);
  return events.slice(0, limit);
}

export function dailyOperationsEventTitle(event: DailyOperationsEventItem): string {
  if (event.kind === "text.deferred") {
    return dailyOperationsHeldTextTitle(eventCard(event).text?.send_at);
  }
  const catalog = DAILY_COPY.kindTitles[event.kind as keyof typeof DAILY_COPY.kindTitles];
  return catalog ?? event.title;
}

export function eventCard(event: DailyOperationsEventItem): DailyOperationsCard {
  return event.card ?? {};
}

export function eventLinks(event: DailyOperationsEventItem): DailyOperationsLinks {
  return event.links ?? {};
}

export function zipMissChips(event: DailyOperationsEventItem): string[] {
  const card = eventCard(event);
  const miss = card.zip_miss;
  if (!miss) {
    return [];
  }
  const chips: string[] = [];
  if (miss.pickup && card.move?.pickup_zip) {
    chips.push(dailyOperationsZipChip(card.move.pickup_zip));
  }
  if (miss.delivery && card.move?.delivery_zip) {
    chips.push(dailyOperationsZipChip(card.move.delivery_zip));
  }
  if (chips.length === 0 && (miss.pickup || miss.delivery)) {
    chips.push(dailyOperationsZipChip(card.move?.pickup_zip || card.move?.delivery_zip || "—"));
  }
  return chips;
}

export function leadDeskBase(input: {
  leadModel?: DailyOperationsLinks["lead_model"] | null;
  leadKind?: "form" | "call" | null;
  duplicate?: boolean;
}): string {
  const form = input.leadModel === "FormLead" || input.leadKind === "form" || !input.leadModel && input.leadKind !== "call";
  return input.duplicate
    ? form
      ? "/duplicate-form-leads"
      : "/duplicate-call-leads"
    : form
      ? "/form-leads"
      : "/call-leads";
}

export function leadDeskHref(input: {
  leadId: string;
  leadModel?: DailyOperationsLinks["lead_model"] | null;
  leadKind?: "form" | "call" | null;
  duplicate?: boolean;
  panel?: "message";
}): string {
  const base = leadDeskBase(input);
  const params = new URLSearchParams({ record: input.leadId });
  if (input.panel) {
    params.set("panel", input.panel);
  }
  return `${base}?${params.toString()}`;
}

export function resolveDailyOperationsOpenHref(open: string | null | undefined): string | null {
  if (!open) {
    return null;
  }
  const separator = open.indexOf(":");
  if (separator <= 0) {
    return null;
  }
  const kind = open.slice(0, separator);
  const id = open.slice(separator + 1).trim();
  if (!id) {
    return null;
  }
  if (kind === "lead") {
    return `/form-leads?record=${encodeURIComponent(id)}`;
  }
  if (kind === "booking") {
    return `/bookings?record=${encodeURIComponent(id)}`;
  }
  if (kind === "cancellation") {
    return `/cancellations?record=${encodeURIComponent(id)}`;
  }
  if (kind === "intake") {
    return `/intakes?case=${encodeURIComponent(id)}`;
  }
  return null;
}

export function dailyOperationsEventLinks(event: DailyOperationsEventItem): DailyOperationsCardLink[] {
  const links = eventLinks(event);
  const card = eventCard(event);
  const out: DailyOperationsCardLink[] = [];
  const seen = new Set<string>();
  const add = (href: string | null | undefined, label: string) => {
    if (!href || seen.has(`${label}:${href}`)) {
      return;
    }
    seen.add(`${label}:${href}`);
    out.push({ href, label });
  };

  const duplicate = event.kind.includes("duplicate");
  if (links.lead_id) {
    add(
      leadDeskHref({
        leadId: links.lead_id,
        leadModel: links.lead_model,
        leadKind: event.lead_kind,
        duplicate,
      }),
      DAILY_COPY.openLead,
    );
    add(
      leadDeskBase({
        leadModel: links.lead_model,
        leadKind: event.lead_kind,
        duplicate,
      }),
      DAILY_COPY.openList,
    );
  }

  if (event.kind.startsWith("text.") && links.lead_id) {
    add(
      leadDeskHref({
        leadId: links.lead_id,
        leadModel: links.lead_model,
        leadKind: event.lead_kind,
        panel: "message",
      }),
      DAILY_COPY.openLeadMessage,
    );
  }

  if (links.receipt_id || event.kind.startsWith("granot.")) {
    add(LIVE_EVENTS_HREF, DAILY_COPY.openInLiveEvents);
  }

  if (links.intake_case_id) {
    add(`/intakes?case=${encodeURIComponent(links.intake_case_id)}`, DAILY_COPY.openIntake);
  }

  const job = event.job_no || card.job_no;
  if (job) {
    add(buildJobTimelineHref({ job }), DAILY_COPY.openJobTimeline);
  }

  if (links.booking_id) {
    add(`/bookings?record=${encodeURIComponent(links.booking_id)}`, DAILY_COPY.openBooking);
  }
  if (links.cancellation_id) {
    add(`/cancellations?record=${encodeURIComponent(links.cancellation_id)}`, DAILY_COPY.openCancellation);
  }

  if (event.kind === "exception.dead_letter") {
    add(OBSERVATIONAL_HREF, DAILY_COPY.openObservational);
    add(GRANOT_LIFECYCLE_HEALTH_HREF, DAILY_COPY.openGranotLifecycleHealth);
  }

  return out;
}

export function dailyOperationsPanelEmptyCopy(input: {
  lane: DailyOperationsPanelLane;
  company?: string | null;
}): string {
  if (input.company) {
    return dailyOperationsFilteredEmpty(
      DAILY_COPY.panelsLabels[input.lane],
      sourceCompanyLabel(input.company),
    );
  }
  if (input.lane === "exception") {
    return DAILY_COPY.exceptionsEmpty;
  }
  return DAILY_COPY.panelsEmpty;
}

/**
 * Panels whose count says the day has more facts than the board holds for
 * that lane — enough more that the panel cannot even fill its default card
 * slots. The first events page is newest-N across every lane, so a Granot
 * flood can push most (or every) Lead, Text, or Booking of the day out of it;
 * a panel reading "16" over two cards looks broken. Those panels fetch their
 * own newest page once. `exception` is excluded: its count is rebuilt from
 * lead ZIP state, not from facts of that lane.
 */
export function lanesNeedingBackfill(input: {
  snapshot: DailyOperationsSnapshot | null | undefined;
  events: readonly DailyOperationsEventItem[];
  panels: readonly DailyOperationsPanelLane[];
  attempted: ReadonlySet<string>;
}): DailyOperationsPanelLane[] {
  if (!input.snapshot) {
    return [];
  }
  const held = new Map<string, number>();
  for (const event of input.events) {
    held.set(event.lane, (held.get(event.lane) ?? 0) + 1);
  }
  return input.panels.filter((lane) => {
    if (lane === "exception" || input.attempted.has(lane)) {
      return false;
    }
    const count = dailyOperationsPanelCount(input.snapshot, lane);
    const wanted = Math.min(count, DAILY_OPERATIONS_PANEL_DEFAULT_LIMIT);
    return wanted > 0 && (held.get(lane) ?? 0) < wanted;
  });
}

export function dailyOperationsPanelCount(
  snapshot: DailyOperationsSnapshot | null | undefined,
  lane: DailyOperationsPanelLane,
): number {
  if (!snapshot) {
    return 0;
  }
  const metrics = snapshot.metrics;
  if (lane === "lead") return metrics.leads.today;
  if (lane === "text") return metrics.texts.today;
  if (lane === "granot") {
    return (
      metrics.webhooks.lead_created.today +
      metrics.webhooks.priority_updated.today +
      metrics.webhooks.booking_status_changed.today
    );
  }
  if (lane === "intake") return metrics.intakes.opened_today;
  if (lane === "booking") return metrics.bookings.today;
  if (lane === "cancellation") return metrics.cancellations.today;
  if (lane === "exception") {
    return (
      metrics.exceptions.zip_missing +
      metrics.exceptions.crm_failed +
      metrics.exceptions.dead_letter +
      metrics.exceptions.adoption_conflict
    );
  }
  if (lane === "sheet_sync") {
    return metrics.sheet_sync.completed + metrics.sheet_sync.failed;
  }
  return 0;
}

export function readPreferenceFlag(storage: Pick<Storage, "getItem"> | null | undefined, key: string): boolean {
  if (!storage) {
    return false;
  }
  try {
    return storage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function writePreferenceFlag(
  storage: Pick<Storage, "setItem" | "removeItem"> | null | undefined,
  key: string,
  on: boolean,
): void {
  if (!storage) {
    return;
  }
  try {
    if (on) {
      storage.setItem(key, "1");
    } else {
      storage.removeItem(key);
    }
  } catch {
    // Ignore quota / private-mode failures.
  }
}

export function dailyOperationsCardFacts(event: DailyOperationsEventItem): string[] {
  const card = eventCard(event);
  const facts: string[] = [];
  const name = card.customer_name?.trim();
  const last4 = dailyOperationsPhoneLast4(card.phone_last4);
  if (name) {
    facts.push(last4 ? `${name} · ${last4}` : name);
  } else if (last4) {
    facts.push(last4);
  }
  if (event.source_company) {
    facts.push(sourceCompanyLabel(event.source_company));
  }
  if (event.ingestion_origin) {
    facts.push(
      event.ingestion_origin in DAILY_COPY.originsLabels
        ? DAILY_COPY.originsLabels[event.ingestion_origin as keyof typeof DAILY_COPY.originsLabels]
        : event.ingestion_origin.replace(/_/g, " "),
    );
  }
  if (event.lead_kind === "form") {
    facts.push(DAILY_COPY.form);
  } else if (event.lead_kind === "call") {
    facts.push(DAILY_COPY.call);
  }
  return facts;
}

export function dailyOperationsUsefulChips(event: DailyOperationsEventItem): string[] {
  const card = eventCard(event);
  const chips = [...zipMissChips(event)];
  if (card.move?.move_type) {
    chips.push(card.move.move_type === "local" ? "local" : "long distance");
  }
  if (card.text?.skip_reason) {
    chips.push(card.text.skip_reason);
  }
  if (card.text?.purpose) {
    chips.push(card.text.purpose);
  }
  if (card.granot?.route_event_class) {
    chips.push(card.granot.route_event_class);
  }
  if (card.granot?.booking_action) {
    chips.push(card.granot.booking_action);
  }
  if (card.booking_kind) {
    chips.push(card.booking_kind);
  }
  if (card.exception?.detail) {
    chips.push(card.exception.detail);
  }
  const job = event.job_no || card.job_no;
  if (job) {
    chips.push(job);
  }
  return chips;
}

export type DailyOperationsCardDetail = {
  label: string;
  value: string;
  /** `alert` draws the amber / destructive treatment (zip miss, failed, dead letter). */
  tone?: "alert" | "muted";
};

/**
 * Chips that flag attention on the card: zip miss, held, skipped, failed,
 * duplicate. Everything else the payload stores is a labelled detail
 * (`dailyOperationsCardDetails`) so nothing hides behind a click.
 */
export function dailyOperationsAttentionChips(event: DailyOperationsEventItem): DailyOperationsCardDetail[] {
  const card = eventCard(event);
  const chips: DailyOperationsCardDetail[] = zipMissChips(event).map((value) => ({
    label: DAILY_COPY.factLabels.route,
    value,
    tone: "alert",
  }));
  if (card.text?.deferred || event.kind === "text.deferred") {
    chips.push({ label: DAILY_COPY.factLabels.textStatus, value: DAILY_COPY.heldChip, tone: "alert" });
  }
  if (event.kind === "text.skipped") {
    chips.push({ label: DAILY_COPY.factLabels.textStatus, value: DAILY_COPY.skipped, tone: "muted" });
  }
  if (event.kind === "text.failed" || event.kind === "sheet_sync.failed") {
    chips.push({ label: DAILY_COPY.factLabels.textStatus, value: DAILY_COPY.failed, tone: "alert" });
  }
  if (event.kind.includes("duplicate")) {
    chips.push({ label: DAILY_COPY.factLabels.leadKind, value: "duplicate", tone: "muted" });
  }
  return chips;
}

function formatZipState(zip: string | null | undefined, state: string | null | undefined): string | null {
  const z = zip?.trim();
  const s = state?.trim();
  if (!z && !s) {
    return null;
  }
  if (z && s && s !== "not_found") {
    return `${z} · ${s}`;
  }
  if (z && (!s || s === "not_found")) {
    return s === "not_found" ? `${z} · ${DAILY_COPY.zipStateNotFound}` : z;
  }
  return s ?? null;
}

/**
 * Every populated stored field on the small card payload, labelled. Order is
 * the order the Owner reads: where, what kind of move, which job, then the
 * lane-specific facts, then the record type. Never raw JSON.
 */
export function dailyOperationsCardDetails(event: DailyOperationsEventItem): DailyOperationsCardDetail[] {
  const card = eventCard(event);
  const links = eventLinks(event);
  const details: DailyOperationsCardDetail[] = [];
  const push = (label: string, value: string | null | undefined, tone?: DailyOperationsCardDetail["tone"]) => {
    const text = value?.toString().trim();
    if (!text) {
      return;
    }
    details.push(tone ? { label, value: text, tone } : { label, value: text });
  };

  const from = formatZipState(card.move?.pickup_zip, card.move?.pickup_state);
  const to = formatZipState(card.move?.delivery_zip, card.move?.delivery_state);
  if (from && to) {
    push(DAILY_COPY.factLabels.route, `${from} → ${to}`);
  } else {
    push(DAILY_COPY.factLabels.from, from);
    push(DAILY_COPY.factLabels.to, to);
  }
  if (card.move?.move_type) {
    push(
      DAILY_COPY.factLabels.moveType,
      card.move.move_type === "local" ? DAILY_COPY.factLabels.local : DAILY_COPY.factLabels.longDistance,
    );
  }
  push(DAILY_COPY.factLabels.job, event.job_no || card.job_no);

  if (card.text) {
    push(
      DAILY_COPY.factLabels.textPurpose,
      card.text.purpose ? dailyOperationsTextPurposeLabel(card.text.purpose) : null,
    );
    push(DAILY_COPY.factLabels.textStatus, card.text.status);
    push(
      DAILY_COPY.factLabels.textSendAt,
      card.text.send_at ? formatDailyOperationsClock(card.text.send_at) : null,
    );
    push(DAILY_COPY.factLabels.textSkipReason, card.text.skip_reason, "muted");
  }

  if (card.granot) {
    const klass = card.granot.route_event_class;
    push(
      DAILY_COPY.factLabels.granotClass,
      klass
        ? (DAILY_COPY.granotClasses[klass as keyof typeof DAILY_COPY.granotClasses] ?? klass.replace(/_/g, " "))
        : null,
    );
    push(
      DAILY_COPY.factLabels.granotAction,
      card.granot.booking_action
        ? DAILY_COPY.granotClasses[card.granot.booking_action]
        : null,
    );
    push(DAILY_COPY.factLabels.granotDecision, card.granot.decision?.replace(/_/g, " "));
  }

  push(DAILY_COPY.factLabels.bookingKind, card.booking_kind?.replace(/_/g, " "));

  if (card.exception) {
    push(DAILY_COPY.factLabels.exceptionCode, card.exception.code?.replace(/_/g, " "), "alert");
    push(DAILY_COPY.factLabels.exceptionDetail, card.exception.detail, "alert");
  }

  if (card.sheet_sync) {
    push(DAILY_COPY.factLabels.sheetSyncResource, card.sheet_sync.resource?.replace(/_/g, " "));
    push(DAILY_COPY.factLabels.sheetSyncOperation, card.sheet_sync.operation?.replace(/_/g, " "), "muted");
    push(
      DAILY_COPY.factLabels.sheetSyncAttempts,
      card.sheet_sync.attempts != null ? String(card.sheet_sync.attempts) : null,
      "muted",
    );
    push(DAILY_COPY.factLabels.sheetSyncError, card.sheet_sync.error, "alert");
  }

  if (links.receipt_id && event.kind.startsWith("granot.") && !event.parent_receipt_id) {
    push(DAILY_COPY.factLabels.receipt, shortId(links.receipt_id), "muted");
  }
  push(DAILY_COPY.factLabels.entity, entityLabel(event.entity_type), "muted");

  const serverTitle = event.title?.trim();
  const catalogTitle = dailyOperationsEventTitle(event);
  if (serverTitle && serverTitle !== catalogTitle && serverTitle !== event.kind) {
    details.unshift({ label: DAILY_COPY.factLabels.kind, value: serverTitle });
  }

  return details;
}

function shortId(value: string): string {
  return value.length > 10 ? `…${value.slice(-6)}` : value;
}

function entityLabel(entityType: string | null | undefined): string | null {
  if (!entityType) {
    return null;
  }
  return entityType
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ");
}

/** Cards visible for a panel before the Owner asks for the rest. */
export function panelVisibleLimit(input: { focused: boolean; showAll: boolean; total: number }): number {
  if (input.showAll) {
    return input.total;
  }
  return input.focused ? DAILY_OPERATIONS_PANEL_FOCUSED_LIMIT : DAILY_OPERATIONS_PANEL_DEFAULT_LIMIT;
}

/** Facts that landed in the last `windowMs` — the stream pulse in the Arrivals header. */
export function countRecentDailyOperationsEvents(
  events: readonly DailyOperationsEventItem[],
  nowMs: number,
  windowMs: number,
): number {
  const floor = nowMs - windowMs;
  let count = 0;
  for (const event of events) {
    const at = Date.parse(event.occurred_at);
    if (Number.isFinite(at) && at >= floor && at <= nowMs + 60_000) {
      count += 1;
    }
  }
  return count;
}

export function newestDailyOperationsEventAt(events: readonly DailyOperationsEventItem[]): string | null {
  let newest: string | null = null;
  for (const event of events) {
    if (!newest || event.occurred_at > newest) {
      newest = event.occurred_at;
    }
  }
  return newest;
}

export function dailyOperationsHasConfirmControl(markup: string): boolean {
  return /confirm granot booking/i.test(markup) || />\s*Confirm\s*</i.test(markup);
}

export function focusLaneFromSearch(lane: string | null): DailyOperationsLane | null {
  if (lane === "all" || !lane) {
    return null;
  }
  return isDailyOperationsPanelLane(lane) ? lane : null;
}
