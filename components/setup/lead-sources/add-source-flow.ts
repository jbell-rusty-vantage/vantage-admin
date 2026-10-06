/**
 * Add a lead source: the wizard's state, the atomic setup command it builds, the follow-up commands that make a
 * "Both" or Local / Long distance source one flow, and the cost changes screen 5 writes. Pure and dependency-injected
 * (no React, no fetch) so `tests/setup-lead-sources-flow.test.ts` covers the orchestration:
 *
 *  1. `createLeadSourceSetup` (atomic, inactive): the company, ONE feed and, when it lands in a single feed, the Granot name.
 *  2. `createSourceGranularity` for the second form feed (long distance) and for the call feed ("Both").
 *  3. `createGranotNameFromOwnerIntent` for a Granot name that lands in Local + Long distance (needs both feeds), and for
 *     the call feed's own Granot name.
 * Progress is returned so a failure part-way can resume without repeating a step.
 */
import type {
  LeadSourceSetupCommand,
  LeadSourceSetupResult,
  OwnerGranotNameCommand,
} from "@/lib/api/leadSources";
import type { SourceGranularityCreateInput, SourceGranularityItem } from "@/lib/api/registrySources";
import { parseCplAmountInput } from "@/lib/api/registryCpl";

export const SETUP_DEFAULT_REASON = "Owner created this draft lead source from the guided setup";

export type GranotArrivalChoice = "watch_only" | "existing_only" | "create_if_missing";

export type SetupWizardState = {
  name: string;
  owner_label: string;
  aliasesText: string;
  /** The first feed's kind. With `alsoCalls` the source gets a web form feed AND a call feed. */
  channel: "form" | "call";
  /** Web forms: Local and long distance as two feeds. */
  splitMoveTypes: boolean;
  /** "Both": a web form feed plus a call feed. */
  alsoCalls: boolean;
  feed_display_name: string;
  crm_label: string;
  long_feed_display_name: string;
  long_crm_label: string;
  call_feed_display_name: string;
  call_crm_label: string;
  includeGranot: boolean | null;
  granotName: string;
  when_lead_arrives: GranotArrivalChoice;
  /** A split form source: the Granot name lands in both feeds by move type, or only in the local feed. */
  landing: "both" | "local_only";
  callGranotName: string;
  textConfigured: boolean;
  reason: string;
};

export const EMPTY_STATE: SetupWizardState = {
  name: "",
  owner_label: "",
  aliasesText: "",
  channel: "form",
  splitMoveTypes: false,
  alsoCalls: false,
  feed_display_name: "",
  crm_label: "",
  long_feed_display_name: "",
  long_crm_label: "",
  call_feed_display_name: "",
  call_crm_label: "",
  includeGranot: null,
  granotName: "",
  when_lead_arrives: "existing_only",
  landing: "both",
  callGranotName: "",
  textConfigured: false,
  reason: SETUP_DEFAULT_REASON,
};

export function defaultFeedName(channel: "form" | "call"): string {
  return channel === "call" ? "Inbound calls" : "Web forms";
}

export type ArrivalChoice = "form" | "call" | "both";

export function arrivalChoiceOf(state: Pick<SetupWizardState, "channel" | "alsoCalls">): ArrivalChoice {
  if (state.channel === "call") return "call";
  return state.alsoCalls ? "both" : "form";
}

export function withArrivalChoice(state: SetupWizardState, choice: ArrivalChoice): SetupWizardState {
  const channel = choice === "call" ? "call" : "form";
  return {
    ...state,
    channel,
    alsoCalls: choice === "both",
    splitMoveTypes: channel === "call" ? false : state.splitMoveTypes,
    feed_display_name: channel !== state.channel ? defaultFeedName(channel) : state.feed_display_name,
  };
}

const splitSuffix = { local: "local", long_distance: "long distance" } as const;

/** The names a split source's two form feeds default to. */
export function splitFeedDefaults(base: string): { local: string; long: string } {
  const root = base.trim() || defaultFeedName("form");
  return { local: `${root} · ${splitSuffix.local}`, long: `${root} · ${splitSuffix.long_distance}` };
}

export function splitCrmDefaults(name: string): { local: string; long: string } {
  const root = name.trim();
  return { local: root ? `${root} Locals` : "", long: root ? `${root} Long Distance` : "" };
}

function aliasesOf(state: Pick<SetupWizardState, "aliasesText">): string[] {
  return state.aliasesText
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

/** Whether the atomic setup carries the Granot name (it lands in one feed) or a follow-up command does. */
export function granotInAtomic(state: SetupWizardState): boolean {
  if (state.includeGranot !== true) return false;
  if (state.channel === "form" && state.splitMoveTypes && state.landing === "both") return false;
  return true;
}

export function buildSetupCommand(state: SetupWizardState): LeadSourceSetupCommand {
  const aliases = aliasesOf(state);
  const firstName = state.feed_display_name.trim() || defaultFeedName(state.channel);
  return {
    name: state.name.trim(),
    owner_label: state.owner_label.trim() || state.name.trim() || undefined,
    aliases: aliases.length ? aliases : undefined,
    channel: state.channel,
    feed_display_name: firstName,
    crm_label: state.crm_label.trim(),
    move_type: state.channel === "form" && state.splitMoveTypes ? "local" : undefined,
    granot: granotInAtomic(state)
      ? { name_received_from_granot: state.granotName.trim(), when_lead_arrives: state.when_lead_arrives }
      : null,
    reason: state.reason.trim(),
  };
}

export type CommitProgress = {
  result?: LeadSourceSetupResult;
  longFeed?: SourceGranularityItem;
  callFeed?: SourceGranularityItem;
  splitGranotDone?: boolean;
  callGranotDone?: boolean;
};

export type CommitDeps = {
  createSetup(command: LeadSourceSetupCommand): Promise<LeadSourceSetupResult>;
  createFeed(body: SourceGranularityCreateInput): Promise<SourceGranularityItem>;
  createGranot(body: OwnerGranotNameCommand): Promise<unknown>;
};

export class CommitError extends Error {
  readonly progress: CommitProgress;
  readonly cause: unknown;
  constructor(message: string, progress: CommitProgress, cause: unknown) {
    super(message);
    this.name = "CommitError";
    this.progress = progress;
    this.cause = cause;
  }
}

/**
 * Runs the atomic setup and then every follow-up the choices ask for, in order. Resumable: pass the progress a
 * `CommitError` carried and the finished steps are skipped. A failure throws `CommitError` with what was saved.
 */
export async function commitSetup(
  state: SetupWizardState,
  deps: CommitDeps,
  from: CommitProgress = {},
): Promise<CommitProgress> {
  const progress: CommitProgress = { ...from };
  const reason = state.reason.trim();
  try {
    if (!progress.result) progress.result = await deps.createSetup(buildSetupCommand(state));
    const { lead_source: leadSource, feed } = progress.result;

    if (state.channel === "form" && state.splitMoveTypes && !progress.longFeed) {
      progress.longFeed = await deps.createFeed({
        source_company: leadSource.id,
        granularity_key: `${leadSource.company_slug}_long_distance`,
        channel: "form",
        owner_label: state.long_feed_display_name.trim() || splitFeedDefaults(state.feed_display_name).long,
        crm_label: state.long_crm_label.trim() || splitCrmDefaults(state.name).long,
        local: "long_distance",
        created_from: "admin",
        reason,
      });
    }

    if (state.alsoCalls && !progress.callFeed) {
      progress.callFeed = await deps.createFeed({
        source_company: leadSource.id,
        granularity_key: `${leadSource.company_slug}_calls`,
        channel: "call",
        owner_label: state.call_feed_display_name.trim() || defaultFeedName("call"),
        crm_label: state.call_crm_label.trim() || `${state.name.trim()} Inbounds`,
        created_from: "admin",
        reason,
      });
    }

    if (state.includeGranot === true && !granotInAtomic(state) && !progress.splitGranotDone) {
      if (!progress.longFeed) throw new Error("The long-distance feed is missing.");
      await deps.createGranot({
        name_received_from_granot: state.granotName.trim(),
        handling: "our_lead_source",
        lead_source_id: leadSource.id,
        destination: { kind: "form_by_move_type", local_feed_id: feed.id, long_distance_feed_id: progress.longFeed.id },
        when_lead_arrives: state.when_lead_arrives,
        reason,
      });
      progress.splitGranotDone = true;
    }

    if (state.alsoCalls && state.callGranotName.trim() && !progress.callGranotDone) {
      if (!progress.callFeed) throw new Error("The call feed is missing.");
      await deps.createGranot({
        name_received_from_granot: state.callGranotName.trim(),
        handling: "our_lead_source",
        lead_source_id: leadSource.id,
        destination: { kind: "one_feed", feed_id: progress.callFeed.id },
        when_lead_arrives: "existing_only",
        reason,
      });
      progress.callGranotDone = true;
    }
    return progress;
  } catch (caught) {
    throw new CommitError(caught instanceof Error ? caught.message : "The setup stopped part-way.", progress, caught);
  }
}

export type CreatedFeed = {
  id: string;
  name: string;
  channel: "form" | "call";
  move_type?: "local" | "long_distance";
};

/** Every feed the commit created, in the order the Owner sees them (form feeds, then the call feed). */
export function createdFeeds(progress: CommitProgress): CreatedFeed[] {
  if (!progress.result) return [];
  const feeds: CreatedFeed[] = [
    {
      id: progress.result.feed.id,
      name: progress.result.feed.display_name,
      channel: progress.result.feed.channel,
      move_type: progress.result.feed.move_type,
    },
  ];
  if (progress.longFeed) {
    feeds.push({ id: progress.longFeed.id, name: progress.longFeed.owner_label, channel: "form", move_type: "long_distance" });
  }
  if (progress.callFeed) feeds.push({ id: progress.callFeed.id, name: progress.callFeed.owner_label, channel: "call" });
  return feeds;
}

/** Screen 5: one amount per feed. Blank or invalid amounts are skipped (a missing cost stays Missing, never $0). */
export function costChangesFrom(
  amounts: Readonly<Record<string, string>>,
  feeds: readonly Pick<SourceGranularityItem, "id" | "schedule_revision">[],
): { changes: Array<{ source_granularity_id: string; amount: number }>; expected_revisions: Record<string, number> } {
  const changes: Array<{ source_granularity_id: string; amount: number }> = [];
  const expected_revisions: Record<string, number> = {};
  for (const feed of feeds) {
    const amount = parseCplAmountInput(amounts[feed.id] ?? "");
    if (amount === null) continue;
    changes.push({ source_granularity_id: feed.id, amount });
    expected_revisions[feed.id] = feed.schedule_revision;
  }
  return { changes, expected_revisions };
}
