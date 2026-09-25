"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { copy } from "../sales-intelligence-copy";
import { TooltipCard } from "../atoms/tooltip-card";
import { cx } from "../lib/format";
import { formatExact, formatExactFull } from "../lib/time";

export type LiveStatus = "connecting" | "live" | "reconnecting" | "offline";
export type CaptureHealth = { status: "ok" | "attention" | "broken"; knownCompleteThrough: string | null };

const exactAgainst = (t: string, asOf: string | null) => (asOf ? formatExact(t, asOf) : formatExactFull(t));

/** The words on the indicator itself. `updatedAt` is the newest `as_of` on screen; it is formatted against `asOf`. */
export function liveIndicatorText(status: LiveStatus, updatedAt: string | null, asOf: string | null): string {
  const l = copy.ui1.prim.live;
  if (status === "live") return updatedAt ? `${l.live} · ${l.updated(exactAgainst(updatedAt, asOf))}` : l.live;
  if (status === "offline") return l.offline;
  return l[status];
}

/** The tooltip body (UX29): what "live" means, history coverage, the capture status sentence, a link to Coverage. */
/** UI2-SHELL: `coverageHref = null` (a rep) drops the Coverage link; Coverage is Owner-only. */
export function LiveIndicatorDetails({ health, asOf, coverageHref }: { health?: CaptureHealth | null; asOf: string | null; coverageHref: string | null }) {
  const l = copy.ui1.prim.live;
  const through = health?.knownCompleteThrough;
  return (
    <span className="si-liveind__details">
      <span className="si-liveind__line">{l.note}</span>
      <span className="si-liveind__line">
        {through ? (
          <time dateTime={through} title={formatExactFull(through)} aria-label={l.historyThrough(formatExactFull(through))}>
            {l.historyThrough(exactAgainst(through, asOf))}
          </time>
        ) : (
          l.historyUnknown
        )}
      </span>
      <span className="si-liveind__line">
        {health ? (
          <>
            {l.captureStatus}:{" "}
            <strong className={cx("si-liveind__word", health.status === "broken" && "si-text--danger", health.status === "attention" && "si-text--amber")}>
              {l.healthWord[health.status] ?? health.status}
            </strong>
            . {l.healthSentence[health.status] ?? ""}
          </>
        ) : (
          l.healthUnknown
        )}
      </span>
      {coverageHref && <Link className="si-link si-liveind__coverage" href={coverageHref}>{l.openCoverage}</Link>}
    </span>
  );
}

/**
 * UI-0 §2.5 header indicator: `Live · Updated {t}` with a neutral dot (never green), `Reconnecting…`,
 * `Offline · Refresh`. Amber while capture health is `attention` or `broken`. Never reads the clock:
 * `updatedAt` and `asOf` come from the responses on screen.
 */
export function LiveIndicator({
  status,
  updatedAt,
  asOf,
  health,
  coverageHref,
  onRefresh,
  className,
}: {
  status: LiveStatus;
  updatedAt: string | null;
  asOf: string | null;
  health?: CaptureHealth | null;
  coverageHref: string | null;
  onRefresh: () => void;
  className?: string;
}) {
  const l = copy.ui1.prim.live;
  const unhealthy = health?.status === "attention" || health?.status === "broken";
  const text = liveIndicatorText(status, updatedAt, asOf);
  return (
    <div className={cx("si-liveind", `is-${status}`, unhealthy && "is-unhealthy", className)} data-status={status}>
      <TooltipCard
        title={l.title}
        label={
          <span className="si-liveind__label" role="status">
            <span className={cx("si-livedot", status === "live" && "is-pulse")} aria-hidden />
            <span>{text}</span>
          </span>
        }
      >
        <LiveIndicatorDetails health={health} asOf={asOf} coverageHref={coverageHref} />
      </TooltipCard>
      {status === "offline" && (
        <>
          <span aria-hidden>·</span>
          <button type="button" className="si-link si-liveind__offline" onClick={onRefresh}>{l.refresh}</button>
        </>
      )}
      <button type="button" className="si-iconbtn si-iconbtn--hit" aria-label={l.refreshLabel} title={l.refresh} onClick={onRefresh}>
        <RefreshCw size={16} aria-hidden />
      </button>
    </div>
  );
}
