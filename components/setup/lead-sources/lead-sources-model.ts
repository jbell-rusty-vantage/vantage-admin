/**
 * Pure view models for Setup → Lead sources: what each leaf line says (Granot name, inbound number, lead cost), the
 * per-channel default, the readiness word of a card and the flat Granot name / inbound number lists. No React, so the
 * node tests cover every rule without a browser. The aggregate list read carries only counts per feed; the leaf detail
 * comes from the per-source detail read, the Granot names read and the inbound routes read (see the report).
 */
import type {
  FeedReadiness,
  GranotLandingItem,
  InboundNumberItem,
  LeadSourceFeedProjection,
} from "@/lib/api/leadSources";
import type { CplSchedulePeriod } from "@/lib/api/registryCpl";
import type { GranotCrmSourceItem } from "@/lib/api/registryGranotCrmSources";
import type { RingCentralRoute } from "@/lib/api/registryRingCentral";
import type { SourceCompanyItem, SourceGranularityItem } from "@/lib/api/registrySources";
import {
  deriveInboundNumberStatus,
  formatInboundRelative,
  formatUsPhone,
  isOwnerDisplayName,
  resolveInboundAssignmentLabels,
} from "@/lib/operations-registry/inboundNumberStatus";
import { ARRIVAL_WORDS, LS_COPY, type GranotArrivalValue, type LeadSourceChannel } from "./lead-sources-copy";

// ── Channel defaults ────────────────────────────────────────────────────────────────────────────────

export type ChannelDefaults = Record<string, { form?: string; call?: string }>;

/** The company's default feed per channel (`default_form_granularity` / `default_call_granularity`, read from the source companies read). */
export function channelDefaultsOf(companies: readonly SourceCompanyItem[]): ChannelDefaults {
  const out: ChannelDefaults = {};
  for (const company of companies) {
    out[company.id] = {
      form: company.default_form_granularity || undefined,
      call: company.default_call_granularity || undefined,
    };
  }
  return out;
}

export function isChannelDefault(
  defaults: ChannelDefaults,
  companyId: string,
  feed: { id: string; channel: LeadSourceChannel },
): boolean {
  const entry = defaults[companyId];
  if (!entry) return false;
  return (feed.channel === "call" ? entry.call : entry.form) === feed.id;
}

export function moveTypeWord(moveType?: "local" | "long_distance"): string | null {
  if (moveType === "local") return LS_COPY.local;
  if (moveType === "long_distance") return LS_COPY.longDistance;
  return null;
}

// ── Source readiness word ───────────────────────────────────────────────────────────────────────────

export type ReadinessWord = { word: string; tone: "green" | "amber" | "gray" };

/** "all live · N not live · lead cost missing" for a card header, from the list read's per-feed readiness. */
export function sourceReadiness(feeds: readonly Pick<LeadSourceFeedProjection, "readiness">[]): ReadinessWord {
  if (feeds.length === 0) return { word: LS_COPY.readyNoFeeds, tone: "gray" };
  const notLive = feeds.filter((feed) => !feed.readiness.live).length;
  const costMissing = feeds.some((feed) => feed.readiness.lead_cost !== "ready");
  if (notLive === 0) return { word: LS_COPY.readyAllLive, tone: "green" };
  const parts = [LS_COPY.readyNotLive(notLive)];
  if (costMissing) parts.push(LS_COPY.readyCostMissing);
  return { word: parts.join(" · "), tone: "amber" };
}

// ── Leaf lines ──────────────────────────────────────────────────────────────────────────────────────

export type GranotLeafModel = {
  id: string;
  name: string;
  arrival: GranotArrivalValue;
  arrivalWord: string;
  live: boolean;
  textOn: boolean;
  warnings: string[];
  /** For a name that lands in Local + Long distance: the rule that picks the feed. */
  selectionRule: string | null;
};

/** The warnings a Granot name carries on one feed: wrong channel / wrong move type, when the Granot names read exposes it. */
export function routeWarnings(granot: GranotCrmSourceItem | undefined, feedId?: string): string[] {
  if (!granot) return [];
  const out = new Set<string>();
  for (const route of granot.lifecycle_routes) {
    if (feedId && route.source_granularity_id !== feedId) continue;
    if (route.source_granularity_status === "wrong_channel") out.add(LS_COPY.wrongChannel);
    if (route.source_granularity_status === "wrong_move_type") out.add(LS_COPY.wrongMoveType);
  }
  return [...out];
}

export function granotLeaf(
  item: GranotLandingItem,
  granotById: ReadonlyMap<string, GranotCrmSourceItem>,
  feedId: string,
): GranotLeafModel {
  return {
    id: item.id,
    name: item.name_received_from_granot,
    arrival: item.when_lead_arrives,
    arrivalWord: ARRIVAL_WORDS[item.when_lead_arrives],
    live: item.live,
    textOn: item.text_state === "on",
    warnings: routeWarnings(granotById.get(item.id), feedId),
    selectionRule: item.route.shape === "form_by_move_type" ? item.route.selection_rule : null,
  };
}

export type NumberVerification = "verified" | "not_checked" | "invalid";
export type NumberFiling = "filing" | "stopped" | "not_filing";

export type NumberLeafModel = {
  id: string;
  phone: string;
  nickname: string;
  /** Null when the routes read has not loaded or does not know this number. */
  verification: NumberVerification | null;
  verificationWord: string | null;
  filing: NumberFiling | null;
  filingWord: string | null;
  lastSeen: string | null;
};

export function verificationOf(route: Pick<RingCentralRoute, "validation_status">): NumberVerification {
  if (route.validation_status === "valid") return "verified";
  if (route.validation_status === "invalid") return "invalid";
  return "not_checked";
}

const VERIFICATION_WORD: Record<NumberVerification, string> = {
  verified: LS_COPY.verified,
  not_checked: LS_COPY.notChecked,
  invalid: LS_COPY.invalid,
};

const FILING_WORD: Record<NumberFiling, string> = {
  filing: LS_COPY.filing,
  stopped: LS_COPY.stopped,
  not_filing: LS_COPY.notFiling,
};

export function filingOf(route: RingCentralRoute, now = Date.now()): NumberFiling {
  const kind = deriveInboundNumberStatus(route, now).kind;
  if (kind === "filing_calls") return "filing";
  if (kind === "stopped_filing_calls") return "stopped";
  return "not_filing";
}

export function numberLeaf(
  item: Pick<InboundNumberItem, "id" | "phone_number" | "nickname">,
  route: RingCentralRoute | undefined,
  now = Date.now(),
): NumberLeafModel {
  const verification = route ? verificationOf(route) : null;
  const filing = route ? filingOf(route, now) : null;
  const seen = route?.last_seen_in_call_log_at;
  return {
    id: item.id,
    phone: formatUsPhone(item.phone_number),
    nickname: item.nickname,
    verification,
    verificationWord: verification ? VERIFICATION_WORD[verification] : null,
    filing,
    filingWord: filing ? FILING_WORD[filing] : null,
    lastSeen: seen ? formatInboundRelative(seen, now) : null,
  };
}

export type CostLeafModel = {
  state: "ready" | "missing" | "invalid";
  amount_cents?: number;
  /** `YYYY-MM-DD`, the day the current amount took effect. */
  since?: string;
};

/** The period in force on a Florida calendar day (`YYYY-MM-DD`); undefined when none covers it. */
export function currentPeriod(
  periods: readonly CplSchedulePeriod[] | undefined,
  today: string,
): CplSchedulePeriod | undefined {
  if (!periods) return undefined;
  return [...periods]
    .sort((a, b) => b.effective_from_date.localeCompare(a.effective_from_date))
    .find(
      (period) =>
        period.effective_from_date <= today &&
        (!period.effective_until_date_exclusive || today < period.effective_until_date_exclusive),
    );
}

export function costLeaf(
  leadCost: FeedReadiness["lead_cost"],
  periods: readonly CplSchedulePeriod[] | undefined,
  today: string,
): CostLeafModel {
  if (leadCost !== "ready") return { state: leadCost };
  const period = currentPeriod(periods, today);
  if (!period) return { state: "ready" };
  return { state: "ready", amount_cents: period.amount_cents, since: period.effective_from_date };
}

// ── Quiet line ──────────────────────────────────────────────────────────────────────────────────────

/** The fourth, quiet line under a feed: sheet tab, accepted spellings, what Vantage sends to Granot. */
export function quietLineParts(
  feed: LeadSourceFeedProjection,
  record?: Pick<SourceGranularityItem, "sheet_tab_name">,
): string[] {
  const parts: string[] = [];
  if (record?.sheet_tab_name?.trim()) parts.push(LS_COPY.sheetTab(record.sheet_tab_name.trim()));
  if (feed.channel === "form" && feed.accepted_labels && !feed.accepted_labels.empty) {
    parts.push(LS_COPY.sheetNames(feed.accepted_labels.items.map((item) => item.label).join(", ")));
  }
  if (feed.crm_label) parts.push(LS_COPY.sendsToGranot(feed.crm_label));
  return parts;
}

// ── Flat lists ──────────────────────────────────────────────────────────────────────────────────────

export function sourceName(company?: Pick<SourceCompanyItem, "owner_label" | "name">): string {
  if (!company) return "";
  if (isOwnerDisplayName(company.owner_label)) return company.owner_label.trim();
  if (isOwnerDisplayName(company.name)) return company.name.trim();
  return "";
}

/** A Granot name that must land somewhere (our lead source) and has no feed to land in. */
export function landsNowhere(granot: GranotCrmSourceItem): boolean {
  if (granot.lifecycle_disposition !== "source_scoped_lead") return false;
  return (
    granot.lifecycle_routes.length === 0 ||
    granot.lifecycle_routes.every((route) => route.source_granularity_status === "missing")
  );
}

export type GranotRow = {
  id: string;
  name: string;
  arrival: GranotArrivalValue;
  arrivalWord: string;
  live: boolean;
  textOn: boolean;
  landsNowhere: boolean;
  lands: Array<{ source: string; feed: string; moveType: string | null }>;
  warnings: string[];
  sourceId: string | null;
};

function arrivalOf(granot: GranotCrmSourceItem): GranotArrivalValue {
  if (granot.lead_created_policy === "create_if_missing") return "create_if_missing";
  if (granot.lead_created_policy === "link_only") return "existing_only";
  return "watch_only";
}

/** Every Granot name, "lands nowhere" first, then by name. */
export function granotRows(
  granots: readonly GranotCrmSourceItem[],
  companies: readonly SourceCompanyItem[],
  feeds: readonly SourceGranularityItem[],
): GranotRow[] {
  const companyById = new Map(companies.map((company) => [company.id, company]));
  const feedById = new Map(feeds.map((feed) => [feed.id, feed]));
  const rows = granots.map((granot): GranotRow => {
    const arrival = arrivalOf(granot);
    const lands = granot.lifecycle_routes.flatMap((route) => {
      const feed = feedById.get(route.source_granularity_id);
      if (!feed) return [];
      const company = companyById.get(feed.source_company);
      return [{ source: sourceName(company), feed: feed.owner_label, moveType: moveTypeWord(feed.local) }];
    });
    const firstFeed = feedById.get(granot.lifecycle_routes[0]?.source_granularity_id ?? "");
    return {
      id: granot.id,
      name: granot.granot_label,
      arrival,
      arrivalWord: ARRIVAL_WORDS[arrival],
      live: granot.lifecycle_enabled,
      textOn: arrival === "create_if_missing" && granot.outbound_sms?.enabled === true,
      landsNowhere: landsNowhere(granot),
      lands,
      warnings: routeWarnings(granot),
      sourceId: firstFeed?.source_company ?? granot.lead_source_company ?? null,
    };
  });
  return rows.sort((a, b) => Number(b.landsNowhere) - Number(a.landsNowhere) || a.name.localeCompare(b.name));
}

export type NumberRow = NumberLeafModel & {
  routeId: string;
  active: boolean;
  source: string | null;
  feed: string | null;
  feedId: string | null;
  sourceId: string | null;
};

/** Every inbound number, "not filing" first (stopped, then checked-but-off, then the rest), filing last. */
export function numberRows(
  routes: readonly RingCentralRoute[],
  companies: readonly SourceCompanyItem[],
  feeds: readonly SourceGranularityItem[],
  now = Date.now(),
): NumberRow[] {
  const rank = (row: NumberRow): number => {
    if (row.filing === "stopped") return 0;
    if (row.filing === "not_filing" && row.verification === "verified") return 1;
    if (row.filing === "not_filing") return 2;
    return 3;
  };
  const rows = routes.map((route): NumberRow => {
    const labels = resolveInboundAssignmentLabels(route.current_assignment, { companies, feeds });
    const feedId = route.current_assignment?.source_granularity_id ?? null;
    const feed = feeds.find((item) => item.id === feedId);
    const leaf = numberLeaf({ id: route.id, phone_number: route.phone_number, nickname: route.display_label }, route, now);
    return {
      ...leaf,
      routeId: route.id,
      active: route.active,
      source: labels.lead_source_name ?? null,
      feed: labels.feed_display_name ?? null,
      feedId,
      sourceId: feed?.source_company ?? route.current_assignment?.source_company_id ?? null,
    };
  });
  return rows.sort((a, b) => rank(a) - rank(b) || a.phone.localeCompare(b.phone));
}

/** Owner words for a server dependency preview, one "N things" line each. */
export function dependencyLines(dependencies: Record<string, number>, words: (key: string) => string): string[] {
  return Object.entries(dependencies)
    .filter(([, count]) => count > 0)
    .map(([key, count]) => `${count} ${words(key)}`);
}
