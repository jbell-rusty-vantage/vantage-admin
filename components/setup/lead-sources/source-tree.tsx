/**
 * The tree (doc 19 "The tree"): one source card per Source Company, its feeds as rows, each feed's leaf lines under it.
 * Presentational and prop-driven so `tests/setup-lead-sources*.test.ts` render it to static markup from fixtures; the
 * section container owns every read and hands in the joined data. Edits are links into the URL contract, so a sheet is
 * always one URL.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronDown, ChevronRight, Mail, Phone, Plus } from "lucide-react";
import { EvidenceChip, Pill } from "@/components/ui/crm/primitives";
import type { LeadSourceDetail, LeadSourceFeedProjection, LeadSourceListItem } from "@/lib/api/leadSources";
import type { GranotCrmSourceItem } from "@/lib/api/registryGranotCrmSources";
import type { RingCentralRoute } from "@/lib/api/registryRingCentral";
import type { SourceGranularityItem } from "@/lib/api/registrySources";
import { rewriteRegistryHref } from "@/lib/setup/setup-links";
import { CHANNEL_WORDS, LS_COPY } from "./lead-sources-copy";
import {
  granotLeaf,
  isChannelDefault,
  moveTypeWord,
  numberLeaf,
  quietLineParts,
  sourceReadiness,
  type ChannelDefaults,
  type CostLeafModel,
} from "./lead-sources-model";
import type { LeadSourcesUrl } from "./lead-sources-url";
import {
  CostLine,
  EmptyGranotLine,
  EmptyNumberLine,
  GranotLine,
  LiveChip,
  NumberLine,
  QuietLine,
  EditLink,
} from "./leaf-lines";

export type HrefFor = (patch: Partial<LeadSourcesUrl>) => string;

/** The joined read data every feed row needs. */
export type TreeData = {
  granotById: ReadonlyMap<string, GranotCrmSourceItem>;
  routeById: ReadonlyMap<string, RingCentralRoute>;
  feedRecordById: ReadonlyMap<string, SourceGranularityItem>;
  defaults: ChannelDefaults;
  /** The periods read per feed, once loaded; a missing entry is "still loading". */
  costByFeed: ReadonlyMap<string, CostLeafModel>;
  now: number;
};

export function FeedRowView({
  sourceId,
  feed,
  tree,
  hasDetail,
  readOnly,
  hrefFor,
}: {
  sourceId: string;
  feed: LeadSourceFeedProjection;
  tree: TreeData;
  /** Whether the per-source detail read has loaded (the leaves come from it). */
  hasDetail: boolean;
  readOnly: boolean;
  hrefFor: HrefFor;
}) {
  const ChannelIcon = feed.channel === "call" ? Phone : Mail;
  const move = moveTypeWord(feed.move_type);
  const isDefault = isChannelDefault(tree.defaults, sourceId, feed);
  const granots = feed.granot_names?.items ?? [];
  const numbers = feed.inbound_numbers?.items ?? [];
  const costLoaded = tree.costByFeed.get(feed.id);
  // A cost that is not ready is known from the list read; only a ready amount needs the periods read.
  const cost: CostLeafModel | null =
    feed.readiness.lead_cost !== "ready" ? { state: feed.readiness.lead_cost } : (costLoaded ?? null);
  const costHref = hrefFor({ edit: "cost", source: sourceId, feed: feed.id });

  return (
    <div className="ls-feed" data-feed={feed.id} data-channel={feed.channel}>
      <div className="ls-feed__head">
        <ChannelIcon className="ls-feed__icon" aria-label={CHANNEL_WORDS[feed.channel]} role="img" width={16} height={16} />
        <span className="ls-feed__name">{feed.display_name}</span>
        <span className="su-quiet">
          {CHANNEL_WORDS[feed.channel]}
          {move ? ` · ${move}` : ""}
        </span>
        {isDefault ? (
          <Pill variant="blue" title={LS_COPY.defaultPillTitle(feed.channel)}>
            {LS_COPY.defaultPill}
          </Pill>
        ) : null}
        <LiveChip live={feed.readiness.live} />
        <span className="su-line__right">
          <EditLink
            href={hrefFor({ edit: "feed", source: sourceId, feed: feed.id })}
            label={`${readOnly ? "Open" : "Edit"} feed ${feed.display_name}`}
            readOnly={readOnly}
          />
        </span>
      </div>

      {!hasDetail ? (
        <div className="su-line" aria-busy="true">
          <span className="su-quiet">…</span>
        </div>
      ) : (
        <>
          {granots.length === 0 ? (
            <EmptyGranotLine
              addHref={hrefFor({ view: "granot", edit: "granot", granot: "new", source: sourceId, feed: feed.id })}
              readOnly={readOnly}
            />
          ) : (
            granots.map((item) => (
              <GranotLine
                key={`${feed.id}-${item.id}`}
                leaf={granotLeaf(item, tree.granotById, feed.id)}
                editHref={hrefFor({ edit: "granot", granot: item.id, source: sourceId, feed: feed.id })}
                readOnly={readOnly}
              />
            ))
          )}
          {feed.channel === "call"
            ? numbers.length === 0
              ? (
                <EmptyNumberLine
                  addHref={hrefFor({ view: "numbers", edit: "number", number: "new", source: sourceId, feed: feed.id })}
                  readOnly={readOnly}
                />
              )
              : numbers.map((item) => (
                  <NumberLine
                    key={`${feed.id}-${item.id}`}
                    leaf={numberLeaf(item, tree.routeById.get(item.id), tree.now)}
                    editHref={hrefFor({ edit: "number", number: item.id, source: sourceId, feed: feed.id })}
                    readOnly={readOnly}
                  />
                ))
            : null}
          <CostLine cost={cost} setHref={costHref} readOnly={readOnly} />
          <QuietLine parts={quietLineParts(feed, tree.feedRecordById.get(feed.id))} />
        </>
      )}
    </div>
  );
}

export function SourceCardView({
  source,
  detail,
  tree,
  open,
  onToggle,
  readOnly,
  hrefFor,
  children,
}: {
  source: LeadSourceListItem;
  /** The per-source detail read, once loaded: leaves, findings and the readiness plan come from it. */
  detail?: LeadSourceDetail;
  tree: TreeData;
  open: boolean;
  onToggle: () => void;
  readOnly: boolean;
  hrefFor: HrefFor;
  /** The "Turn it on" block, rendered inside the open card. */
  children?: ReactNode;
}) {
  const feeds = detail?.feeds.items ?? source.feeds.items;
  const readiness = sourceReadiness(feeds);
  const findings = detail?.findings ?? [];
  const Chevron = open ? ChevronDown : ChevronRight;
  const name = source.owner_label || source.name;

  return (
    <section className="crm-card ls-source" data-source={source.id} aria-label={name}>
      <div className="ls-source__head">
        <button type="button" className="ls-source__toggle" aria-expanded={open} onClick={onToggle}>
          <Chevron aria-hidden="true" width={18} height={18} />
          <span className="ls-source__name">{name}</span>
          <span className="sr-only">{open ? LS_COPY.collapse : LS_COPY.expand}</span>
        </button>
        <Pill variant={source.active ? "green" : "gray"}>{source.active ? LS_COPY.on : LS_COPY.off}</Pill>
        <span className="su-quiet">{feeds.length === 0 ? LS_COPY.noFeeds : LS_COPY.feeds(feeds.length)}</span>
        <Pill variant={readiness.tone === "green" ? "green" : readiness.tone === "amber" ? "amber" : "gray"}>{readiness.word}</Pill>
        <span className="su-line__right">
          <EditLink href={hrefFor({ edit: "source", source: source.id })} label={`${readOnly ? "Open" : "Edit"} ${name}`} readOnly={readOnly} />
          {readOnly ? null : (
            <Link href={hrefFor({ edit: "feed", source: source.id, feed: "new" })} scroll={false} className="crm-link">
              <Plus aria-hidden="true" width={14} height={14} /> {LS_COPY.addFeed}
            </Link>
          )}
        </span>
      </div>

      {findings.length > 0 ? (
        <ul className="ls-findings" aria-label="What needs attention">
          {findings.map((finding, index) => (
            <li key={`${finding.code}-${index}`}>
              <EvidenceChip state={finding.severity === "blocking" ? "bad" : "warn"}>{finding.owner_message}</EvidenceChip>{" "}
              <Link href={rewriteRegistryHref(finding.deep_link)} scroll={false} className="crm-link">
                {finding.owner_action}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      {open ? (
        <div className="ls-source__body">
          {feeds.length === 0 ? <p className="su-quiet ls-pad">{LS_COPY.noFeeds}</p> : null}
          {feeds.map((feed) => (
            <FeedRowView key={feed.id} sourceId={source.id} feed={feed} tree={tree} hasDetail={Boolean(detail)} readOnly={readOnly} hrefFor={hrefFor} />
          ))}
          {children}
        </div>
      ) : null}
    </section>
  );
}
