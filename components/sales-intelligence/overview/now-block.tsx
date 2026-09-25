"use client";
/**
 * UI1-OVERVIEW (UI-1 §4.2 block 1, addendum §6.1): Now. Seven band tiles (badge, name, count), then Needs review,
 * Unassigned, Live calls and the capture health line. `now` is the published Attention index at `as_of` with the
 * same Priority / rep filters as Needs Attention (C8), so each tile's count is the count its link opens (A16).
 * `data: null` (feature off) prints `—` in every tile, with no links.
 */
import Link from "next/link";
import { CircleAlert, CircleCheck, CircleX, Radio } from "lucide-react";
import { useId, type ReactNode } from "react";
import type { Overview } from "@/lib/api/salesIntelligence";
import { BANDS, copy } from "../sales-intelligence-copy";
import { cx } from "../lib/format";
import { BandBadge, SkeletonBlock, SkeletonLines } from "../primitives";
import { BAND_NUMBERS, bandValue, count } from "./format";
import type { OverviewLinks } from "./links";

const t = copy.ui1.overview.now;

function Tile({ href, label, value, children, className, data }: { href: string | null; label: string; value: number | null; children: ReactNode; className?: string; data?: Record<string, string> }) {
  const body = (
    <>
      <span className="si-ovtile__name">{children}</span>
      <span className="si-ovtile__count">{count(value)}</span>
    </>
  );
  if (!href || value == null) return <div className={cx("si-ovtile", className)} {...data}>{body}</div>;
  return (
    <Link href={href} className={cx("si-ovtile is-link", className)} aria-label={t.tileLabel(label, count(value))} {...data}>
      {body}
    </Link>
  );
}

function CaptureLine({ status, href }: { status: string | null; href: string | null }) {
  const known = status === "ok" || status === "attention" || status === "broken";
  const text = known ? t.capture[status] : t.captureUnknown;
  const Icon = status === "ok" ? CircleCheck : status === "broken" ? CircleX : CircleAlert;
  return (
    <p className={cx("si-ovcapture", known && `is-${status}`, status === "broken" && "si-text--danger")} data-capture={status ?? "unknown"}>
      <Icon size={16} aria-hidden />
      <span>{text}</span>
      {href && <Link href={href} className="si-ovlink">{t.captureLink}</Link>}
    </p>
  );
}

/**
 * UI2-OVERVIEW (UI-2 §6): `rep` is the rep's Now: `Your records now`, the rep's bands and Needs review, no Unassigned
 * tile (a rep's scope has no unassigned records to open) and the capture line without its Coverage link (Owner-only).
 */
export function NowBlock({ data, links, rep = false }: { data: Overview | null; links: OverviewLinks | null; rep?: boolean }) {
  const now = data?.now ?? null;
  const go = (make: () => string) => (links && now ? make() : null);
  const headingId = useId();
  return (
    <section className="si-ovblock si-ovnow" aria-labelledby={headingId}>
      <h2 id={headingId} className="si-heading si-heading--2">{rep ? copy.ui2.overview.nowTitle : t.title}</h2>
      <ul className="si-ovnow__bands">
        {BAND_NUMBERS.map((band) => (
          <li key={band}>
            <Tile href={go(() => links!.band(band))} label={copy.ui1.prim.bandTag(band, BANDS[band])} value={bandValue(now?.bands, band)} data={{ "data-band": String(band) }}>
              <BandBadge band={band} />
            </Tile>
          </li>
        ))}
      </ul>
      <ul className="si-ovnow__others">
        <li>
          <Tile href={go(() => links!.needsReview())} label={t.needsReview} value={now?.needs_review ?? null} data={{ "data-now": "needs_review" }}>
            <BandBadge band={null} variant="needs_review" />
          </Tile>
        </li>
        {!rep && (
          <li>
            <Tile href={go(() => links!.unassigned())} label={t.unassigned} value={now?.unassigned ?? null} data={{ "data-now": "unassigned" }}>
              {t.unassigned}
            </Tile>
          </li>
        )}
        <li>
          <Tile href={go(() => links!.liveCalls())} label={t.liveCalls} value={now?.live_calls ?? null} data={{ "data-now": "live_calls" }}>
            <Radio size={14} aria-hidden className="si-ovtile__live" />
            {t.liveCalls}
          </Tile>
        </li>
      </ul>
      <CaptureLine status={now?.capture_health?.status ?? null} href={links && now && !rep ? links.coverage() : null} />
    </section>
  );
}

export function NowBlockSkeleton() {
  return (
    <section className="si-ovblock si-ovnow is-skeleton" aria-hidden>
      <SkeletonLines lines={1} widths={[80]} />
      <ul className="si-ovnow__bands">
        {BAND_NUMBERS.map((band) => (
          <li key={band}><SkeletonBlock height={64} /></li>
        ))}
      </ul>
      <ul className="si-ovnow__others">
        {[0, 1, 2].map((i) => (
          <li key={i}><SkeletonBlock height={52} /></li>
        ))}
      </ul>
      <SkeletonLines lines={1} widths={[180]} />
    </section>
  );
}
NowBlock.Skeleton = NowBlockSkeleton;
