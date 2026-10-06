/**
 * "Turn it on" for a lead source (doc 19, screen 6 and the open source's block), lifted out of the old
 * `lead-sources-manager.tsx` `runReadiness`. Two halves:
 *
 *  - `planReadiness(detail, options)`: pure planning. The ordered steps are lead cost · lead source on · feeds on ·
 *    Granot names live · customer text (only for "create the lead if missing" names) · number filing.
 *    Activating a feed makes it its channel's default (the server needs `replacement_default_id === feed.id`), so the
 *    feed the Owner chose as the channel default is activated LAST in its channel; when it is already on and another
 *    feed in the channel is about to be turned on, a `make_default` step re-asserts it afterwards.
 *  - `runReadinessPlan(plan, deps)`: a thin runner over the existing commands. Each step reports
 *    `{ step, status: "done" | "blocked" | "failed", reason }`; a step whose predecessor did not finish is
 *    `blocked` with what it waits on, and a step the Owner must do by hand (the customer text, which needs consent) is
 *    `blocked` with the instruction. Steps already satisfied report `done` without a call.
 */
import type { LeadSourceDetail } from "@/lib/api/leadSources";
import { setGranotCrmSourceActivation } from "@/lib/api/registryGranotCrmSources";
import { formatUsPhone } from "@/lib/operations-registry/inboundNumberStatus";
import { activateRingCentralRoute } from "@/lib/api/registryRingCentral";
import { formatRegistryError } from "@/lib/api/registryRequest";
import {
  setSourceCompanyActivation,
  setSourceGranularityActivation,
  updateSourceCompany,
} from "@/lib/api/registrySources";

export type ReadinessChannel = "form" | "call";

/** A draft or off number that can be turned on: its route id, the call feed it should file into, and its check state. */
export type ReadinessNumber = {
  route_id: string;
  feed_id: string;
  phone_number: string;
  /** RingCentral has validated it (a number cannot be turned on before). */
  validated: boolean;
  active: boolean;
};

export type ReadinessOptions = {
  /** Which feed is the default per channel; required to be meaningful only where a channel has two or more feeds. */
  defaultFeedIdByChannel?: Partial<Record<ReadinessChannel, string>>;
  numbers?: readonly ReadinessNumber[];
};

type StepBase = { key: string; label: string; satisfied: boolean };

export type ReadinessStep =
  | (StepBase & { kind: "lead_cost"; feed_id: string; feed_name: string })
  | (StepBase & { kind: "lead_source_on"; lead_source_id: string })
  | (StepBase & {
      kind: "feed_on";
      feed_id: string;
      feed_name: string;
      channel: ReadinessChannel;
      /** True for the feed chosen as its channel's default (activated last in the channel). */
      make_default: boolean;
    })
  | (StepBase & {
      kind: "make_default";
      lead_source_id: string;
      feed_id: string;
      feed_name: string;
      channel: ReadinessChannel;
    })
  | (StepBase & { kind: "granot_live"; granot_id: string; name: string; feed_ids: string[] })
  | (StepBase & { kind: "customer_text"; granot_id: string; name: string })
  | (StepBase & {
      kind: "number_filing";
      route_id: string;
      feed_id: string;
      phone_number: string;
      validated: boolean;
    });

export type ReadinessPlan = {
  steps: ReadinessStep[];
  /** Channels with two or more feeds, one of them still off, where the caller gave no valid default: ask the Owner. */
  channelsNeedingDefault: ReadinessChannel[];
  /** The default feed per channel the plan used. */
  defaults: Partial<Record<ReadinessChannel, string>>;
};

export const READINESS_REASONS = {
  leadSource: "Owner turned this lead source on from Turn it on",
  feed: "Owner turned this feed on from Turn it on",
  makeDefault: "Owner chose this feed as the default from Turn it on",
  granot: "Owner switched this Granot name into live processing from Turn it on",
  number: "Owner turned on filing for this number from Turn it on",
} as const;

export const READINESS_LABELS = {
  leadCost: (feed: string) => `Set the lead cost for ${feed}`,
  leadSourceOn: "Turn the lead source on",
  feedOn: (feed: string) => `Turn on ${feed}`,
  makeDefault: (feed: string) => `Make ${feed} the default`,
  granotLive: (name: string) => `Switch the Granot name "${name}" live`,
  customerText: (name: string) => `Turn on the customer text for "${name}"`,
  numberFiling: (phone: string) => `Start filing calls for ${phone}`,
  waitingOnLeadCost: (feed: string) => `the lead cost for ${feed}`,
  waitingOnLeadSource: "the lead source being on",
  waitingOnFeed: (feed: string) => `${feed} being on`,
  waitingOnGranot: (name: string) => `the Granot name "${name}" being live`,
  textNeedsYou: "Turn the customer text on yourself after you review the message and why we may text this customer.",
  numberNeedsCheck: "Check the number against RingCentral first.",
} as const;

const CHANNELS: readonly ReadinessChannel[] = ["form", "call"];

export function planReadiness(detail: LeadSourceDetail, options: ReadinessOptions = {}): ReadinessPlan {
  const feeds = detail.feeds.items;
  const steps: ReadinessStep[] = [];

  // 1. Lead cost, per feed (a feed cannot go live without a valid one; the runner never invents $0).
  for (const feed of feeds) {
    steps.push({
      kind: "lead_cost",
      key: `lead_cost:${feed.id}`,
      label: READINESS_LABELS.leadCost(feed.display_name),
      satisfied: feed.readiness.lead_cost === "ready",
      feed_id: feed.id,
      feed_name: feed.display_name,
    });
  }

  // 2. The lead source itself.
  steps.push({
    kind: "lead_source_on",
    key: `lead_source_on:${detail.id}`,
    label: READINESS_LABELS.leadSourceOn,
    satisfied: detail.active,
    lead_source_id: detail.id,
  });

  // 3. Feeds, default last per channel.
  const defaults: Partial<Record<ReadinessChannel, string>> = {};
  const channelsNeedingDefault: ReadinessChannel[] = [];
  for (const channel of CHANNELS) {
    const channelFeeds = feeds.filter((feed) => feed.channel === channel);
    if (channelFeeds.length === 0) continue;
    const requested = options.defaultFeedIdByChannel?.[channel];
    const chosen = channelFeeds.find((feed) => feed.id === requested);
    if (channelFeeds.length > 1 && !chosen && channelFeeds.some((feed) => !feed.active)) channelsNeedingDefault.push(channel);
    const defaultFeed = chosen ?? channelFeeds[0]!;
    defaults[channel] = defaultFeed.id;

    const ordered = [...channelFeeds.filter((feed) => feed.id !== defaultFeed.id), defaultFeed];
    for (const feed of ordered) {
      steps.push({
        kind: "feed_on",
        key: `feed_on:${feed.id}`,
        label: READINESS_LABELS.feedOn(feed.display_name),
        satisfied: feed.active,
        feed_id: feed.id,
        feed_name: feed.display_name,
        channel,
        make_default: feed.id === defaultFeed.id,
      });
    }
    // The chosen default is already on, but another feed in the channel is about to take the default: re-assert it.
    if (defaultFeed.active && channelFeeds.some((feed) => feed.id !== defaultFeed.id && !feed.active)) {
      steps.push({
        kind: "make_default",
        key: `make_default:${defaultFeed.id}`,
        label: READINESS_LABELS.makeDefault(defaultFeed.display_name),
        satisfied: false,
        lead_source_id: detail.id,
        feed_id: defaultFeed.id,
        feed_name: defaultFeed.display_name,
        channel,
      });
    }
  }

  // 4. Granot names (a split name appears under both of its feeds: one step), 5. customer text.
  const granots = new Map<string, { name: string; live: boolean; arrival: string; textOn: boolean; feedIds: string[] }>();
  for (const feed of feeds) {
    for (const item of feed.granot_names?.items ?? []) {
      const existing = granots.get(item.id);
      if (existing) {
        existing.feedIds.push(feed.id);
      } else {
        granots.set(item.id, {
          name: item.name_received_from_granot,
          live: item.live,
          arrival: item.when_lead_arrives,
          textOn: item.text_state === "on",
          feedIds: [feed.id],
        });
      }
    }
  }
  for (const [id, granot] of granots) {
    steps.push({
      kind: "granot_live",
      key: `granot_live:${id}`,
      label: READINESS_LABELS.granotLive(granot.name),
      satisfied: granot.live,
      granot_id: id,
      name: granot.name,
      feed_ids: granot.feedIds,
    });
  }
  for (const [id, granot] of granots) {
    if (granot.arrival !== "create_if_missing") continue;
    steps.push({
      kind: "customer_text",
      key: `customer_text:${id}`,
      label: READINESS_LABELS.customerText(granot.name),
      satisfied: granot.textOn,
      granot_id: id,
      name: granot.name,
    });
  }

  // 6. Numbers filing.
  for (const number of options.numbers ?? []) {
    const phone = formatUsPhone(number.phone_number);
    steps.push({
      kind: "number_filing",
      key: `number_filing:${number.route_id}`,
      label: READINESS_LABELS.numberFiling(phone),
      satisfied: number.active,
      route_id: number.route_id,
      feed_id: number.feed_id,
      phone_number: number.phone_number,
      validated: number.validated,
    });
  }

  return { steps, channelsNeedingDefault, defaults };
}

export type StepResult = {
  step: ReadinessStep;
  status: "done" | "blocked" | "failed";
  reason?: string;
};

/** The existing commands the runner calls; injected so tests need no network. */
export type ReadinessDeps = {
  activateLeadSource(id: string, reason: string): Promise<unknown>;
  activateFeed(id: string, reason: string): Promise<unknown>;
  makeDefault(leadSourceId: string, channel: ReadinessChannel, feedId: string, reason: string): Promise<unknown>;
  switchGranotLive(id: string, reason: string): Promise<unknown>;
  activateNumber(routeId: string, feedId: string, reason: string): Promise<unknown>;
  describeError(error: unknown): string;
};

export const defaultReadinessDeps: ReadinessDeps = {
  activateLeadSource: (id, reason) => setSourceCompanyActivation(id, { active: true, reason }),
  // Activating a feed makes it the channel default, so the command always names the feed itself.
  activateFeed: (id, reason) => setSourceGranularityActivation(id, { active: true, replacement_default_id: id, reason }),
  makeDefault: (leadSourceId, channel, feedId, reason) =>
    updateSourceCompany(
      leadSourceId,
      channel === "call" ? { default_call_granularity: feedId, reason } : { default_form_granularity: feedId, reason },
    ),
  switchGranotLive: (id, reason) => setGranotCrmSourceActivation(id, { lifecycle_enabled: true, reason }),
  activateNumber: (routeId, feedId, reason) => activateRingCentralRoute(routeId, { source_granularity_id: feedId, reason }),
  describeError: formatRegistryError,
};

/**
 * Runs the plan in order. `onResult` is called as each step settles so the screen can paint rows as they finish.
 * A step that depends on one that did not finish is blocked, not attempted.
 */
export async function runReadinessPlan(
  plan: ReadinessPlan,
  deps: ReadinessDeps = defaultReadinessDeps,
  onResult?: (result: StepResult, all: readonly StepResult[]) => void,
): Promise<StepResult[]> {
  const results: StepResult[] = [];
  const done = new Set<string>();
  const nameOfFeed = new Map<string, string>();
  for (const step of plan.steps) {
    if (step.kind === "feed_on" || step.kind === "lead_cost") nameOfFeed.set(step.feed_id, step.feed_name);
  }

  const settle = (step: ReadinessStep, status: StepResult["status"], reason?: string) => {
    const result: StepResult = { step, status, ...(reason ? { reason } : {}) };
    results.push(result);
    if (status === "done") done.add(step.key);
    onResult?.(result, results);
  };

  const waitingOn = (keys: string[], describe: (key: string) => string): string | null => {
    const missing = keys.find((key) => !done.has(key));
    return missing ? describe(missing) : null;
  };

  for (const step of plan.steps) {
    if (step.satisfied) {
      settle(step, "done");
      continue;
    }
    try {
      switch (step.kind) {
        case "lead_cost": {
          // Only the lead cost screen can set a price; the runner never fabricates one.
          settle(step, "blocked", `${step.label}. A feed cannot go live without a valid lead cost.`);
          break;
        }
        case "lead_source_on": {
          await deps.activateLeadSource(step.lead_source_id, READINESS_REASONS.leadSource);
          settle(step, "done");
          break;
        }
        case "feed_on": {
          const wait =
            waitingOn([`lead_cost:${step.feed_id}`], () => READINESS_LABELS.waitingOnLeadCost(step.feed_name)) ??
            waitingOn(
              plan.steps.filter((item) => item.kind === "lead_source_on").map((item) => item.key),
              () => READINESS_LABELS.waitingOnLeadSource,
            );
          if (wait) {
            settle(step, "blocked", `Waiting on ${wait}.`);
            break;
          }
          await deps.activateFeed(step.feed_id, READINESS_REASONS.feed);
          settle(step, "done");
          break;
        }
        case "make_default": {
          const wait = waitingOn(
            plan.steps.filter((item) => item.kind === "feed_on" && item.channel === step.channel).map((item) => item.key),
            (key) => READINESS_LABELS.waitingOnFeed(nameOfFeed.get(key.replace("feed_on:", "")) ?? "the feed"),
          );
          if (wait) {
            settle(step, "blocked", `Waiting on ${wait}.`);
            break;
          }
          await deps.makeDefault(step.lead_source_id, step.channel, step.feed_id, READINESS_REASONS.makeDefault);
          settle(step, "done");
          break;
        }
        case "granot_live": {
          const wait = waitingOn(
            step.feed_ids.map((id) => `feed_on:${id}`),
            (key) => READINESS_LABELS.waitingOnFeed(nameOfFeed.get(key.replace("feed_on:", "")) ?? "the feed"),
          );
          if (wait) {
            settle(step, "blocked", `Waiting on ${wait}.`);
            break;
          }
          await deps.switchGranotLive(step.granot_id, READINESS_REASONS.granot);
          settle(step, "done");
          break;
        }
        case "customer_text": {
          const wait = waitingOn([`granot_live:${step.granot_id}`], () => READINESS_LABELS.waitingOnGranot(step.name));
          settle(step, "blocked", wait ? `Waiting on ${wait}.` : READINESS_LABELS.textNeedsYou);
          break;
        }
        case "number_filing": {
          if (!step.validated) {
            settle(step, "blocked", READINESS_LABELS.numberNeedsCheck);
            break;
          }
          const wait = waitingOn([`feed_on:${step.feed_id}`], () =>
            READINESS_LABELS.waitingOnFeed(nameOfFeed.get(step.feed_id) ?? "the call feed"),
          );
          if (wait) {
            settle(step, "blocked", `Waiting on ${wait}.`);
            break;
          }
          await deps.activateNumber(step.route_id, step.feed_id, READINESS_REASONS.number);
          settle(step, "done");
          break;
        }
      }
    } catch (error) {
      settle(step, "failed", deps.describeError(error));
    }
  }
  return results;
}
