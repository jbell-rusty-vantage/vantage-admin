/**
 * "Things that need you" (doc 19): one pure function over the aggregate lead sources list read, so the Setup
 * sub-navigation badge and the strip at the top of Lead sources agree. Pure: no React.
 *
 * What the list read can answer by itself (the badge needs only this):
 *  - `cost_missing`: a feed whose `readiness.lead_cost` is not ready, when the source or the feed is on.
 *  - `source_off_live_feeds`: a source that is Off while one of its feeds is on.
 *  - `number_not_filing` (partly): an active call feed whose `inbound_number_count` is 0.
 *
 * What it cannot answer, and so takes from the other reads when the caller has them (second argument):
 *  - `granot_nowhere`: needs the Granot names read (a Granot name with no landing feed; the list only counts landings).
 *  - `number_not_filing` (the rest): needs the inbound routes read (a number checked but not filing, or stopped).
 * Automation references with no landing are not in any aggregate read; the Granot names read exposes them as
 * `automation_sources` and they are covered by `granot_nowhere` only when the name itself has no landing.
 */
import type { LeadSourceListItem } from "@/lib/api/leadSources";
import type { GranotCrmSourceItem } from "@/lib/api/registryGranotCrmSources";
import type { RingCentralRoute } from "@/lib/api/registryRingCentral";
import { formatUsPhone } from "@/lib/operations-registry/inboundNumberStatus";
import { NEEDS_YOU_COPY } from "./lead-sources-copy";
import { filingOf, landsNowhere } from "./lead-sources-model";
import { leadSourcesHref } from "./lead-sources-url";

export type NeedsYouKind = "cost_missing" | "granot_nowhere" | "number_not_filing" | "source_off_live_feeds";

export type NeedsYouItem = {
  key: string;
  kind: NeedsYouKind;
  text: string;
  /** The Setup URL that opens the right sheet. */
  href: string;
};

export type NeedsYouExtras = {
  granotNames?: readonly GranotCrmSourceItem[];
  routes?: readonly RingCentralRoute[];
  now?: number;
};

const KIND_ORDER: Record<NeedsYouKind, number> = {
  cost_missing: 0,
  granot_nowhere: 1,
  number_not_filing: 2,
  source_off_live_feeds: 3,
};

export function needsYou(items: readonly LeadSourceListItem[], extras: NeedsYouExtras = {}): NeedsYouItem[] {
  const out: NeedsYouItem[] = [];

  for (const source of items) {
    const name = source.owner_label || source.name;
    const feeds = source.feeds.items;

    // A dormant source (off, with no feed on) is not asking for anything.
    for (const feed of feeds) {
      if (feed.readiness.lead_cost !== "ready" && (source.active || feed.active)) {
        out.push({
          key: `cost:${feed.id}`,
          kind: "cost_missing",
          text:
            feed.readiness.lead_cost === "invalid"
              ? NEEDS_YOU_COPY.costInvalid(name, feed.display_name)
              : NEEDS_YOU_COPY.costMissing(name, feed.display_name),
          href: leadSourcesHref({ source: source.id, feed: feed.id, edit: "cost" }),
        });
      }
      if (feed.channel === "call" && feed.active && feed.inbound_number_count === 0) {
        out.push({
          key: `nonumber:${feed.id}`,
          kind: "number_not_filing",
          text: NEEDS_YOU_COPY.callFeedNoNumber(name, feed.display_name),
          href: leadSourcesHref({ view: "numbers", source: source.id, feed: feed.id, edit: "number", number: "new" }),
        });
      }
    }

    if (!source.active && feeds.some((feed) => feed.active)) {
      out.push({
        key: `off:${source.id}`,
        kind: "source_off_live_feeds",
        text: NEEDS_YOU_COPY.sourceOffLiveFeeds(name),
        href: leadSourcesHref({ source: source.id, edit: "source" }),
      });
    }
  }

  for (const granot of extras.granotNames ?? []) {
    if (!granot.enabled || !landsNowhere(granot)) continue;
    out.push({
      key: `granot:${granot.id}`,
      kind: "granot_nowhere",
      text: NEEDS_YOU_COPY.granotNowhere(granot.granot_label),
      href: leadSourcesHref({ view: "granot", edit: "granot", granot: granot.id }),
    });
  }

  const now = extras.now ?? Date.now();
  for (const route of extras.routes ?? []) {
    if (route.archived_at) continue;
    const filing = filingOf(route, now);
    const phone = formatUsPhone(route.phone_number);
    const href = leadSourcesHref({ view: "numbers", edit: "number", number: route.id });
    if (filing === "stopped") {
      out.push({ key: `number:${route.id}`, kind: "number_not_filing", text: NEEDS_YOU_COPY.numberStopped(phone), href });
    } else if (filing === "not_filing" && route.validation_status === "valid") {
      out.push({ key: `number:${route.id}`, kind: "number_not_filing", text: NEEDS_YOU_COPY.numberNotFiling(phone), href });
    }
  }

  // Stable order: the doc's kind order, then the order the reads gave.
  return out
    .map((item, index) => ({ item, index }))
    .sort((a, b) => KIND_ORDER[a.item.kind] - KIND_ORDER[b.item.kind] || a.index - b.index)
    .map(({ item }) => item);
}

/** The count the sub-navigation badge shows. */
export function needsYouCount(items: readonly LeadSourceListItem[], extras: NeedsYouExtras = {}): number {
  return needsYou(items, extras).length;
}
