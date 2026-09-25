"use client";
/**
 * UI1-OVERVIEW (UI-1 §4.2 block 2, addendum §6.2): Desk health over the activity period. Speed to lead, callbacks
 * kept on time, missed calls returned, and the Flow in/out bar with the Band moves disclosure and the footnote.
 * Shares print as counts (`1 of 10 kept`), never `%`. Null metrics print `—`. `data: null` (feature off) prints `—`.
 */
import Link from "next/link";
import { useId, type ReactNode } from "react";
import type { Overview } from "@/lib/api/salesIntelligence";
import { copy } from "../sales-intelligence-copy";
import { formatDuration } from "../lib/time";
import { cx } from "../lib/format";
import { Disclosure, SkeletonBlock, SkeletonLines } from "../primitives";
import { BAND_NUMBERS, DASH, bandValue, count, minutes, signed } from "./format";
import type { OverviewLinks } from "./links";

const t = copy.ui1.overview.desk;
type Desk = Overview["desk"];
type Flow = Desk["flow"];

/** Flow out, in UI-1 §4.2 order. */
export const FLOW_OUT = ["moved_to_quoted", "booked_in_granot", "booked", "crm_bad_dead", "owner_closed"] as const;

/** The speed-to-lead line; `—` when the server's median is null. */
export function speedLine(s: Desk["speed_to_lead"] | null): string {
  if (!s || s.median_staffed_minutes == null) return DASH;
  return t.speedLine(minutes(s.median_staffed_minutes), minutes(s.p90_staffed_minutes), count(s.leads), count(s.worked));
}
/** The kept line as counts; `—` with no callbacks due (`kept_share: null`). */
export function keptLine(c: Desk["callbacks_kept"] | null): string {
  if (!c || c.kept_share == null) return DASH;
  return t.keptLine(count(c.kept), count(c.due), count(c.not_kept), count(c.pending));
}
/** The returned line as counts; `—` with no episodes (`on_time_share: null`). */
export function returnedLine(m: Desk["missed_calls_returned"] | null): string {
  if (!m || m.on_time_share == null) return DASH;
  return t.returnedLine(count(m.returned_on_time), count(m.episodes), count(m.returned_late), count(m.still_open));
}
/** One Band moves row; the median is `—` when null. */
export function bandMovesRow(flow: Flow, band: number): string {
  const median = flow.time_in_band[String(band)]?.median_ms;
  return t.bandMovesRow(band, count(bandValue(flow.bands.into_band, band)), count(bandValue(flow.bands.out_of_band, band)), median == null ? DASH : formatDuration(median));
}

function Metric({ title, children, data }: { title: string; children: ReactNode; data: string }) {
  return (
    <div className="si-ovmetric" data-desk={data}>
      <h3 className="si-ovmetric__title">{title}</h3>
      {children}
    </div>
  );
}

function FlowBar({ flow, links, period }: { flow: Flow; links: OverviewLinks | null; period: Overview["periods"]["activity"] | null }) {
  const outTotal = FLOW_OUT.reduce((sum, key) => sum + flow[key], 0);
  const scale = Math.max(flow.new_outreach, outTotal, 1);
  const width = (n: number) => `${(n / scale) * 100}%`;
  return (
    <div className="si-ovflow">
      <div className="si-ovflow__row" data-flow="in">
        <span className="si-ovflow__label">
          {links && period
            ? <Link href={links.flowIn(period)} className="si-ovlink" data-flow-link="in">{t.flowIn(count(flow.new_outreach))}</Link>
            : t.flowIn(count(flow.new_outreach))}
        </span>
        <div className="si-ovflow__track" aria-hidden>
          {flow.new_outreach > 0 && <span className="si-ovflow__seg si-ovflow__seg--in" style={{ width: width(flow.new_outreach) }} />}
        </div>
      </div>
      <div className="si-ovflow__row" data-flow="out">
        <span className="si-ovflow__label">{t.flowOutLabel}</span>
        <div className="si-ovflow__track" aria-hidden>
          {FLOW_OUT.map((key, i) => flow[key] > 0 && (
            <span key={key} className={cx("si-ovflow__seg", `si-ovflow__seg--out${i + 1}`)} style={{ width: width(flow[key]) }} title={t.flowSegment(t.flowOut[key], count(flow[key]))} />
          ))}
        </div>
      </div>
      <ul className="si-ovflow__legend">
        {FLOW_OUT.map((key, i) => {
          const href = links && period ? links.closed(key, period) : null;
          const text = t.flowSegment(t.flowOut[key], count(flow[key]));
          return (
            <li key={key} data-flow-out={key}>
              <span className={cx("si-ovflow__swatch", `si-ovflow__seg--out${i + 1}`)} aria-hidden />
              {href ? <Link href={href} className="si-ovlink">{text}</Link> : <span>{text}</span>}
            </li>
          );
        })}
      </ul>
      <p className="si-ovflow__net" data-flow="net">{t.net(signed(flow.net_active_change))}</p>
    </div>
  );
}

/** UI2-OVERVIEW: `title` names the rep's block (`Your desk health`); the numbers are the rep's scope as served. */
export function DeskHealthBlock({ data, links, title = t.title }: { data: Overview | null; links: OverviewLinks | null; title?: string }) {
  const headingId = useId();
  const desk = data?.desk ?? null;
  const speed = desk?.speed_to_lead ?? null;
  const kept = desk?.callbacks_kept ?? null;
  const missed = desk?.missed_calls_returned ?? null;
  const flow = desk?.flow ?? null;
  const keptTip = kept && kept.kept_share != null ? t.keptTip(count(kept.kept_contact_unknown), count(kept.kept_unreached)) : null;
  return (
    <section className="si-ovblock si-ovdesk" aria-labelledby={headingId}>
      <h2 id={headingId} className="si-heading si-heading--2">{title}</h2>
      <div className="si-ovdesk__grid">
        <Metric title={t.speedToLead} data="speed_to_lead">
          <p className="si-ovmetric__line">{speedLine(speed)}</p>
          {speed && (
            <p className="si-ovmetric__sub">
              {t.stillWaiting(count(speed.still_waiting))} · {t.missedTarget(count(speed.missed_target), count(speed.target_staffed_minutes))}
            </p>
          )}
        </Metric>
        <Metric title={t.callbacksKept} data="callbacks_kept">
          <p className="si-ovmetric__line" title={keptTip ?? undefined}>{keptLine(kept)}</p>
          {keptTip && <p className="si-ovmetric__sub">{keptTip}</p>}
          {kept && (
            <p className="si-ovmetric__sub" data-desk="overdue_now">
              {links && kept.overdue_now > 0
                ? <Link href={links.overdueNow()} className="si-ovlink si-text--amber">{t.overdueNow(count(kept.overdue_now))}</Link>
                : <span>{t.overdueNow(count(kept.overdue_now))}</span>}
            </p>
          )}
        </Metric>
        <Metric title={t.missedReturned} data="missed_calls_returned">
          <p className="si-ovmetric__line">{returnedLine(missed)}</p>
          {missed && missed.on_time_share != null && (
            <p className="si-ovmetric__sub">{t.returnMedian(minutes(missed.median_staffed_minutes_to_return))}</p>
          )}
        </Metric>
      </div>
      <Metric title={t.flow} data="flow">
        {flow ? <FlowBar flow={flow} links={links} period={data?.periods.activity ?? null} /> : <p className="si-ovmetric__line">{DASH}</p>}
      </Metric>
      {flow && (
        <>
          <Disclosure id="overview-band-moves" title={t.bandMoves} className="si-ovbandmoves">
            <ul className="si-ovbandmoves__list">
              {BAND_NUMBERS.map((band) => {
                const unknown = flow.time_in_band[String(band)]?.unknown ?? 0;
                return (
                  <li key={band} data-band-moves={band}>
                    {bandMovesRow(flow, band)}
                    {unknown > 0 && <span className="si-ovbandmoves__unknown"> · {t.unknownStart(count(unknown))}</span>}
                  </li>
                );
              })}
            </ul>
          </Disclosure>
          <p className="si-ovfootnote">{t.flowFootnote(count(flow.bands.excluded_baseline_or_policy), count(flow.bands.capture_repair))}</p>
        </>
      )}
    </section>
  );
}

export function DeskHealthBlockSkeleton() {
  return (
    <section className="si-ovblock si-ovdesk is-skeleton" aria-hidden>
      <SkeletonLines lines={1} widths={[120]} />
      <div className="si-ovdesk__grid">
        {[0, 1, 2].map((i) => (
          <div key={i} className="si-ovmetric"><SkeletonLines lines={3} widths={["50%", "90%", "70%"]} /></div>
        ))}
      </div>
      <SkeletonBlock height={14} />
      <SkeletonBlock height={14} width="70%" />
      <SkeletonLines lines={1} widths={["60%"]} />
    </section>
  );
}
DeskHealthBlock.Skeleton = DeskHealthBlockSkeleton;
