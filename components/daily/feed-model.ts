import { DAILY_COPY, dailyOperationsKindLabel, formatDailyOperationsClock } from "@/components/daily/daily-copy";
import { isMilestoneEvent, isMilestonePinned } from "@/components/daily/milestone";
import { sourceCompanyLabel } from "@/lib/api/dailyOperations";
import {
  dailyOperationsEventLinks,
  dailyOperationsEventTitle,
  eventCard,
  eventLinks,
  filterDailyOperationsEventsByCompany,
  presentationTier,
  type DailyOperationsCardLink,
  type DailyOperationsTier,
  type DailyOperationsTierOverrides,
} from "@/lib/api/dailyOperationsBoard";
import { compareDailyOperationsEventsNewestFirst, type DailyOperationsEventItem } from "@/lib/api/dailyOperationsLive";

/**
 * The live feed as data (doc 16): which facts show, as what, in what order. Pure, so the pairing, the burst folding
 * and the tier filters are tested without a browser. The components only draw what this returns.
 */

/** `needs` = tier A, `everything` = A and B, otherwise one lane. */
export type FeedFilter = "needs" | "everything" | (string & {});

export const FEED_FOLD_MIN = 3;
export const FEED_FOLD_WINDOW_MS = 3 * 60_000;
/** A Granot lead lands after its Form Lead; this long after counts as "immediately followed". */
export const FEED_LEAD_PAIR_WINDOW_MS = 15 * 60_000;
export const FEED_ITEM_LIMIT = 60;

export type FeedSpotlight = {
  type: "spotlight";
  key: string;
  event: DailyOperationsEventItem;
  /** Facts folded into this card (the Intake that opened for a Booked job). */
  absorbed: DailyOperationsEventItem[];
};

export type FeedMilestone = {
  type: "milestone";
  key: string;
  event: DailyOperationsEventItem;
  pinned: boolean;
};

export type FeedRowItem = {
  type: "row";
  key: string;
  event: DailyOperationsEventItem;
  tier: Exclude<DailyOperationsTier, "A">;
  /** "→ linked to lead", "→ in Granot": the paired fact said as a suffix instead of a second row. */
  suffix: string | null;
  absorbed: DailyOperationsEventItem[];
};

export type FeedFold = {
  type: "fold";
  key: string;
  kind: string;
  /** Newest first. */
  rows: FeedRowItem[];
};

export type FeedItem = FeedSpotlight | FeedMilestone | FeedRowItem | FeedFold;

const GRANOT_OUTCOME_SUFFIX: Record<string, string> = {
  "granot.linked": DAILY_COPY.feed.linkedToLead,
  "granot.minted": DAILY_COPY.feed.mintedLead,
  "granot.observed": DAILY_COPY.feed.observedOnly,
};

export function eventJobNo(event: DailyOperationsEventItem): string | null {
  const job = (event.job_no || eventCard(event).job_no || "").toString().trim();
  return job || null;
}

function at(event: DailyOperationsEventItem): number {
  const value = Date.parse(event.occurred_at);
  return Number.isFinite(value) ? value : 0;
}

type Pairing = {
  /** absorbed event id -> the event that carries it */
  hostOf: Map<string, string>;
  suffixOf: Map<string, string>;
  absorbedByHost: Map<string, DailyOperationsEventItem[]>;
};

/**
 * One card per job moment. Pairs, in order:
 * - `granot.booked` + the `intake.opened` of the same job number: one Spotlight;
 * - `form_lead.created` + the `granot.lead_created` that follows it for the same job (or the same Lead): one row
 *   with a "→ in Granot" suffix;
 * - a Granot receipt row + its linked / minted / observed outcome: the outcome is said as a suffix.
 * Outcomes are never absorbed (they are tier C and stay visible under Show system detail); only suffixed.
 */
export function pairFeedEvents(events: readonly DailyOperationsEventItem[]): Pairing {
  const hostOf = new Map<string, string>();
  const suffixOf = new Map<string, string>();
  const absorbedByHost = new Map<string, DailyOperationsEventItem[]>();
  const absorb = (host: DailyOperationsEventItem, guest: DailyOperationsEventItem) => {
    hostOf.set(guest.event_id, host.event_id);
    const list = absorbedByHost.get(host.event_id) ?? [];
    list.push(guest);
    absorbedByHost.set(host.event_id, list);
  };

  const intakes = events.filter((event) => event.kind === "intake.opened");
  for (const booked of events.filter((event) => event.kind === "granot.booked")) {
    const job = eventJobNo(booked);
    if (!job) {
      continue;
    }
    const intake = intakes.find((candidate) => !hostOf.has(candidate.event_id) && eventJobNo(candidate) === job);
    if (intake) {
      absorb(booked, intake);
    }
  }

  const granotLeads = events.filter((event) => event.kind === "granot.lead_created");
  for (const form of events.filter((event) => event.kind === "form_lead.created")) {
    const job = eventJobNo(form);
    const leadId = eventLinks(form).lead_id;
    const guest = granotLeads.find((candidate) => {
      if (hostOf.has(candidate.event_id)) {
        return false;
      }
      const delta = at(candidate) - at(form);
      if (delta < 0 || delta > FEED_LEAD_PAIR_WINDOW_MS) {
        return false;
      }
      const sameJob = job !== null && eventJobNo(candidate) === job;
      const sameLead = Boolean(leadId) && eventLinks(candidate).lead_id === leadId;
      return sameJob || sameLead;
    });
    if (guest) {
      absorb(form, guest);
      suffixOf.set(form.event_id, DAILY_COPY.feed.inGranot);
    }
  }

  const receiptHosts = new Map<string, DailyOperationsEventItem>();
  for (const event of events) {
    if (event.kind.startsWith("granot.") && !(event.kind in GRANOT_OUTCOME_SUFFIX)) {
      receiptHosts.set(eventLinks(event).receipt_id ?? event.event_id, event);
    }
  }
  for (const event of events) {
    const suffix = GRANOT_OUTCOME_SUFFIX[event.kind];
    if (!suffix || !event.parent_receipt_id) {
      continue;
    }
    const host = receiptHosts.get(event.parent_receipt_id);
    if (host && !suffixOf.has(host.event_id)) {
      suffixOf.set(host.event_id, suffix);
    }
  }

  return { hostOf, suffixOf, absorbedByHost };
}

function passesFilter(
  event: DailyOperationsEventItem,
  tier: DailyOperationsTier,
  filter: FeedFilter,
  showSystem: boolean,
): boolean {
  if (filter === "needs") {
    return tier === "A";
  }
  if (tier === "C" && !showSystem) {
    return false;
  }
  return filter === "everything" || event.lane === filter;
}

export function buildFeed(input: {
  events: readonly DailyOperationsEventItem[];
  company?: string | null;
  quietPriorities?: boolean;
  overrides?: DailyOperationsTierOverrides | null;
  showSystem?: boolean;
  filter?: FeedFilter;
  /** The browser clock. Without it nothing is pinned (no hydration mismatch). */
  nowMs?: number;
}): FeedItem[] {
  const filter = input.filter ?? "everything";
  const showSystem = Boolean(input.showSystem);
  const sorted = [...filterDailyOperationsEventsByCompany([...input.events], input.company)].sort(
    compareDailyOperationsEventsNewestFirst,
  );
  const pairing = pairFeedEvents(sorted);
  const tierOf = (event: DailyOperationsEventItem) =>
    presentationTier(event.kind, { overrides: input.overrides, quietPriorities: input.quietPriorities });

  const visible = new Set<string>();
  for (const event of sorted) {
    if (passesFilter(event, tierOf(event), filter, showSystem)) {
      visible.add(event.event_id);
    }
  }

  const rows: FeedRowItem[] = [];
  const others: Array<FeedSpotlight | FeedMilestone> = [];
  for (const event of sorted) {
    if (!visible.has(event.event_id)) {
      continue;
    }
    const host = pairing.hostOf.get(event.event_id);
    // A fact folds into its partner only when the partner shows too; otherwise it stands alone.
    if (host && visible.has(host)) {
      continue;
    }
    const tier = tierOf(event);
    const absorbed = pairing.absorbedByHost.get(event.event_id) ?? [];
    if (isMilestoneEvent(event)) {
      others.push({ type: "milestone", key: event.event_id, event, pinned: isMilestonePinned(event, input.nowMs) });
    } else if (tier === "A") {
      others.push({ type: "spotlight", key: event.event_id, event, absorbed });
    } else {
      rows.push({
        type: "row",
        key: event.event_id,
        event,
        tier,
        suffix: pairing.suffixOf.get(event.event_id) ?? null,
        absorbed,
      });
    }
  }

  const folded = foldBursts(rows);
  const items: FeedItem[] = [...others, ...folded];
  items.sort((left, right) => {
    const pin = Number(isPinned(right)) - Number(isPinned(left));
    if (pin !== 0) {
      return pin;
    }
    return itemTime(right) - itemTime(left);
  });
  return items;
}

function isPinned(item: FeedItem): boolean {
  return item.type === "milestone" && item.pinned;
}

function itemTime(item: FeedItem): number {
  return item.type === "fold" ? at(item.rows[0]!.event) : at(item.event);
}

/**
 * Three or more tier-B rows of one kind within three minutes become one row. Grouping walks oldest to newest from a
 * window start, so a fold keeps its key (its oldest fact) while newer facts of the burst join it, and its expanded
 * state in the list survives.
 */
export function foldBursts(rows: readonly FeedRowItem[]): Array<FeedRowItem | FeedFold> {
  const foldable = new Map<string, FeedRowItem[]>();
  for (const row of rows) {
    if (row.tier !== "B") {
      continue;
    }
    const list = foldable.get(row.event.kind) ?? [];
    list.push(row);
    foldable.set(row.event.kind, list);
  }
  const folds: FeedFold[] = [];
  const consumed = new Set<string>();
  for (const [kind, list] of foldable) {
    const oldestFirst = [...list].reverse();
    let index = 0;
    while (index < oldestFirst.length) {
      const start = oldestFirst[index]!;
      const cluster = [start];
      let next = index + 1;
      while (next < oldestFirst.length && at(oldestFirst[next]!.event) - at(start.event) <= FEED_FOLD_WINDOW_MS) {
        cluster.push(oldestFirst[next]!);
        next += 1;
      }
      if (cluster.length >= FEED_FOLD_MIN) {
        for (const row of cluster) {
          consumed.add(row.key);
        }
        folds.push({ type: "fold", key: `fold:${start.event.event_id}`, kind, rows: [...cluster].reverse() });
        index = next;
      } else {
        index += 1;
      }
    }
  }
  return [...rows.filter((row) => !consumed.has(row.key)), ...folds];
}

/** Every event id the item stands for (the drawer opens all of them). */
export function feedItemEventIds(item: FeedItem): string[] {
  if (item.type === "fold") {
    return item.rows.flatMap((row) => feedItemEventIds(row));
  }
  if (item.type === "milestone") {
    return [item.event.event_id];
  }
  return [item.event.event_id, ...item.absorbed.map((event) => event.event_id)];
}

export function feedEventIds(items: readonly FeedItem[]): Set<string> {
  const ids = new Set<string>();
  for (const item of items) {
    for (const id of feedItemEventIds(item)) {
      ids.add(id);
    }
  }
  return ids;
}

/* ------------------------------------------------------------------ text */

export function whoOf(event: DailyOperationsEventItem): string | null {
  return eventCard(event).customer_name?.trim() || null;
}

/** "NJ → FL" from the stored pickup and delivery states; null when either is unknown. */
export function routeStates(event: DailyOperationsEventItem): string | null {
  const move = eventCard(event).move;
  const from = move?.pickup_state?.trim();
  const to = move?.delivery_state?.trim();
  if (!from || !to || from === "not_found" || to === "not_found") {
    return null;
  }
  return `${from} → ${to}`;
}

export function isBookedMoment(event: Pick<DailyOperationsEventItem, "kind">): boolean {
  return event.kind === "granot.booked" || event.kind === "booking.created";
}

/** Spotlight title: what happened, then who. The Booked + Intake pair reads "Booked in Granot · Steve D.". */
export function spotlightTitle(item: FeedSpotlight): string {
  const who = whoOf(item.event);
  const what =
    item.event.kind === "granot.booked" && item.absorbed.length > 0
      ? DAILY_COPY.feed.bookedInGranot
      : dailyOperationsEventTitle(item.event);
  return who ? `${what} · ${who}` : what;
}

/** Spotlight meta: Source Company and job number. (The card payload carries no money figure yet.) */
export function spotlightMeta(item: FeedSpotlight): string {
  const parts: string[] = [];
  if (item.event.source_company) {
    parts.push(sourceCompanyLabel(item.event.source_company));
  }
  const job = eventJobNo(item.event) ?? item.absorbed.map(eventJobNo).find(Boolean) ?? null;
  if (job) {
    parts.push(`${DAILY_COPY.feed.job} ${job}`);
  }
  return parts.join(" · ");
}

const HIDDEN_LINK_LABELS = new Set<string>([DAILY_COPY.openList]);

/**
 * At most two links: the action (Finish booking, the exception's desk) then the record (Lead, Booking). The
 * existing `dailyOperationsEventLinks` is the source; this only chooses and relabels.
 */
export function spotlightLinks(item: FeedSpotlight): DailyOperationsCardLink[] {
  const all = [item.event, ...item.absorbed].flatMap((event) => dailyOperationsEventLinks(event));
  const usable = all.filter((link) => !HIDDEN_LINK_LABELS.has(link.label));
  const find = (label: string) => usable.find((link) => link.label === label);
  const picked: DailyOperationsCardLink[] = [];
  const push = (link: DailyOperationsCardLink | undefined, label?: string) => {
    if (link && picked.length < 2 && !picked.some((existing) => existing.href === link.href)) {
      picked.push(label ? { ...link, label } : link);
    }
  };

  const intake = find(DAILY_COPY.openIntake);
  if (item.event.kind === "granot.booked" || item.event.kind === "booking.employee_pending") {
    push(intake, DAILY_COPY.feed.finishBooking);
  }
  if (item.event.kind.startsWith("exception.")) {
    push(find(DAILY_COPY.openGranotLifecycleHealth));
    if (picked.length === 0) {
      push({ label: DAILY_COPY.feed.openException, href: "/?tab=operations&view=lanes&lane=exception" });
    }
  }
  push(find(DAILY_COPY.openBooking));
  push(find(DAILY_COPY.openCancellation));
  push(find(DAILY_COPY.openLead));
  push(find(DAILY_COPY.openLeadMessage));
  push(find(DAILY_COPY.openJobTimeline));
  push(intake);
  if (item.event.kind.startsWith("exception.") && picked.length < 2) {
    push({ label: DAILY_COPY.feed.openException, href: "/?tab=operations&view=lanes&lane=exception" });
  }
  return picked;
}

/** The one-line summary of a row: who, what, source, route. Pieces that are unknown are left out. */
export function rowSegments(event: DailyOperationsEventItem): string[] {
  const who = whoOf(event);
  const job = eventJobNo(event);
  const segments: string[] = [];
  if (who) {
    segments.push(who);
  } else if (job) {
    segments.push(`${DAILY_COPY.feed.job} ${job}`);
  }
  segments.push(dailyOperationsEventTitle(event));
  if (event.source_company) {
    segments.push(sourceCompanyLabel(event.source_company));
  }
  const route = routeStates(event);
  if (route) {
    segments.push(route);
  }
  return segments;
}

export function foldLabel(kind: string, count: number): string {
  const word = DAILY_COPY.feed.foldLabel[kind];
  return word ? `${count} ${word}` : DAILY_COPY.feed.foldFallback(count, dailyOperationsKindLabel(kind));
}

/** "2:31–2:34" for a fold (Florida clock); one stamp when the whole burst is inside a minute. */
export function foldSpan(fold: FeedFold): string {
  const newest = formatDailyOperationsClock(fold.rows[0]!.event.occurred_at);
  const oldest = formatDailyOperationsClock(fold.rows[fold.rows.length - 1]!.event.occurred_at);
  return DAILY_COPY.feed.foldedSpan(oldest, newest);
}
