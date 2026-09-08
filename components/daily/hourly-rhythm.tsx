"use client";

import { useState } from "react";
import { AnimatedNumber } from "@/components/daily/animated-number";
import { DAILY_COPY, dailyOperationsFloridaHour } from "@/components/daily/daily-copy";
import { Card, CardContent } from "@/components/ui/card";
import {
  percentChange,
  type DailyOperationsHourlyBucket,
  type DailyOperationsSnapshot,
} from "@/lib/api/dailyOperations";
import { cn } from "@/lib/utils";

export type RhythmSeries = keyof typeof DAILY_COPY.rhythmSeries;

const SERIES: readonly RhythmSeries[] = ["leads", "bookings", "cancellations", "webhooks", "messages"] as const;

function bucketValue(rows: readonly DailyOperationsHourlyBucket[] | undefined, hour: number, field: RhythmSeries): number {
  return rows?.find((row) => row.hour === hour)?.[field] ?? 0;
}

function sumThrough(rows: readonly DailyOperationsHourlyBucket[] | undefined, hour: number, field: RhythmSeries): number {
  let total = 0;
  for (let h = 0; h <= hour; h += 1) {
    total += bucketValue(rows, h, field);
  }
  return total;
}

function hourLabel(hour: number): string {
  if (hour === 0) {
    return "12a";
  }
  if (hour < 12) {
    return `${hour}a`;
  }
  if (hour === 12) {
    return "12p";
  }
  return `${hour - 12}p`;
}

/**
 * Overview chart: facts per Florida hour for one series, today drawn solid
 * against yesterday and the day before as ghost bars. A `now` marker sits on
 * the current hour so the Owner reads "where the day is" at a glance. The
 * header states today-so-far against both prior days at this hour in plain
 * numbers and percent. Bars are drawn full height and scaled from the
 * baseline so a live fact grows its hour; the header counts roll.
 */
export function HourlyRhythm({
  snapshot,
  defaultSeries = "leads",
  nowHour: liveNowHour,
}: {
  snapshot: DailyOperationsSnapshot | null | undefined;
  defaultSeries?: RhythmSeries;
  /** Browser-clock Florida hour; falls back to the snapshot stamp on the server render. */
  nowHour?: number;
}) {
  const [series, setSeries] = useState<RhythmSeries>(defaultSeries);
  const today = snapshot?.hourly.today ?? [];
  const yesterday = snapshot?.hourly.yesterday ?? [];
  const dayBefore = snapshot?.hourly.day_before;
  const hasYesterday = snapshot?.metrics.leads.yesterday != null;
  const hasDayBefore = snapshot?.metrics.leads.day_before != null && dayBefore != null;
  const nowHour = liveNowHour ?? (snapshot ? dailyOperationsFloridaHour(snapshot.generated_at) : 23);

  const todaySoFar = sumThrough(today, nowHour, series);
  const yesterdaySoFar = hasYesterday ? sumThrough(yesterday, nowHour, series) : null;
  const dayBeforeSoFar = hasDayBefore ? sumThrough(dayBefore, nowHour, series) : null;
  const vsYesterday = percentChange(todaySoFar, yesterdaySoFar);
  const vsDayBefore = percentChange(todaySoFar, dayBeforeSoFar);

  const max = Math.max(
    1,
    ...Array.from({ length: 24 }, (_, hour) =>
      Math.max(
        bucketValue(today, hour, series),
        hasYesterday ? bucketValue(yesterday, hour, series) : 0,
        hasDayBefore ? bucketValue(dayBefore, hour, series) : 0,
      ),
    ),
  );

  const width = 480;
  const height = 96;
  const slot = width / 24;
  const ghostWidth = slot * 0.72;
  const todayWidth = slot * 0.44;

  return (
    <Card className="h-full" data-rhythm-series={series}>
      <CardContent className="flex h-full flex-col gap-2 p-3.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {DAILY_COPY.rhythm}
            </p>
            <p className="text-[11px] text-steel">{DAILY_COPY.rhythmSubtitle}</p>
          </div>
          <div className="flex flex-wrap gap-1" role="tablist" aria-label={DAILY_COPY.rhythm}>
            {SERIES.map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={series === key}
                onClick={() => setSeries(key)}
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors",
                  series === key
                    ? "bg-navy text-white"
                    : "bg-steel-100 text-muted-foreground hover:bg-steel-200",
                )}
              >
                {DAILY_COPY.rhythmSeries[key]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs tabular-nums">
          <span className="text-2xl font-semibold leading-none text-navy">
            <AnimatedNumber value={todaySoFar} />
          </span>
          <span className="text-muted-foreground">
            {DAILY_COPY.rhythmToday} {DAILY_COPY.byNow}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block size-2 rounded-sm bg-steel-300" aria-hidden="true" />
            <span className="text-muted-foreground">{DAILY_COPY.rhythmYesterday}</span>
            <span className="font-medium text-navy">
              <AnimatedNumber value={yesterdaySoFar} />
            </span>
            <span
              className={cn(
                "rounded-full px-1.5 font-semibold",
                vsYesterday.tone === "ahead" && "bg-emerald-50 text-emerald-700",
                vsYesterday.tone === "behind" && "bg-red-50 text-red-700/80",
                (vsYesterday.tone === "even" || vsYesterday.tone === "missing") && "bg-steel-100 text-muted-foreground",
              )}
            >
              {vsYesterday.label}
            </span>
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block size-2 rounded-sm bg-steel-200" aria-hidden="true" />
            <span className="text-muted-foreground">{DAILY_COPY.rhythmDayBefore}</span>
            <span className="font-medium text-navy">
              <AnimatedNumber value={dayBeforeSoFar} />
            </span>
            <span
              className={cn(
                "rounded-full px-1.5 font-semibold",
                vsDayBefore.tone === "ahead" && "bg-emerald-50 text-emerald-700",
                vsDayBefore.tone === "behind" && "bg-red-50 text-red-700/80",
                (vsDayBefore.tone === "even" || vsDayBefore.tone === "missing") && "bg-steel-100 text-muted-foreground",
              )}
            >
              {vsDayBefore.label}
            </span>
          </span>
        </div>

        <div className="mt-auto flex min-h-28 flex-1 flex-col">
          <div className="grid grid-cols-24 text-[9px] font-semibold uppercase leading-none text-trust-blue" aria-hidden="true">
            {Array.from({ length: 24 }, (_, hour) => (
              <span key={hour} className="text-center">
                {hour === nowHour ? DAILY_COPY.rhythmNow : ""}
              </span>
            ))}
          </div>
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="block min-h-20 w-full flex-1"
            role="img"
            aria-label={`${DAILY_COPY.rhythm}: ${DAILY_COPY.rhythmSeries[series]}`}
            preserveAspectRatio="none"
          >
            {Array.from({ length: 24 }, (_, hour) => {
              const x = hour * slot;
              const t = bucketValue(today, hour, series);
              const y = hasYesterday ? bucketValue(yesterday, hour, series) : 0;
              const d = hasDayBefore ? bucketValue(dayBefore, hour, series) : 0;
              // Full-height rects scaled from the baseline; 0 collapses to nothing.
              const ratio = (value: number) => (value === 0 ? 0 : Math.max(2 / height, ((value / max) * (height - 4)) / height));
              const isNow = hour === nowHour;
              const future = hour > nowHour;
              return (
                <g key={hour}>
                  {isNow ? (
                    <rect
                      x={x}
                      y={0}
                      width={slot}
                      height={height}
                      className="daily-now-pulse fill-trust-blue/15"
                      data-now-column
                    />
                  ) : null}
                  <rect
                    x={x + (slot - ghostWidth) / 2}
                    y={0}
                    width={ghostWidth}
                    height={height}
                    style={{ transform: `scaleY(${ratio(d)})` }}
                    className="daily-svg-bar fill-steel-200"
                    data-series="day_before"
                    data-value={d}
                  />
                  <rect
                    x={x + (slot - ghostWidth) / 2}
                    y={0}
                    width={ghostWidth}
                    height={height}
                    style={{ transform: `scaleY(${ratio(y)})` }}
                    className="daily-svg-bar fill-steel-300/80"
                    data-series="yesterday"
                    data-value={y}
                  />
                  <rect
                    x={x + (slot - todayWidth) / 2}
                    y={0}
                    width={todayWidth}
                    height={height}
                    style={{ transform: `scaleY(${ratio(t)})` }}
                    className={cn("daily-svg-bar", future ? "fill-trust-blue/30" : "fill-trust-blue")}
                    data-series="today"
                    data-value={t}
                  />
                </g>
              );
            })}
            <line x1={0} x2={width} y1={height - 0.5} y2={height - 0.5} className="stroke-steel-200" strokeWidth={1} />
          </svg>
          <div className="grid grid-cols-24 pt-1 text-[9px] tabular-nums leading-none text-muted-foreground" aria-hidden="true">
            {Array.from({ length: 24 }, (_, hour) => (
              <span key={hour} className="text-center">
                {hour % 3 === 0 ? hourLabel(hour) : ""}
              </span>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
