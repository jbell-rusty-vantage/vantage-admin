"use client";

import type { ReactNode } from "react";
import { AnimatedNumber } from "@/components/daily/animated-number";
import { DAILY_COPY, dailyOperationsFloridaHour } from "@/components/daily/daily-copy";
import { Card, CardContent } from "@/components/ui/card";
import {
  DAILY_OPERATIONS_TILE_LANES,
  dailyOperationsTrend,
  granotDayBeforeByNow,
  granotDayBeforeTotal,
  granotYesterdayByNow,
  granotYesterdayTotal,
  trendFromPace,
  type DailyOperationsHourlyBucket,
  type DailyOperationsLane,
  type DailyOperationsPercentChange,
  type DailyOperationsSnapshot,
  type DailyOperationsTileId,
  type DailyOperationsTrend,
} from "@/lib/api/dailyOperations";
import {
  granotTileToday,
  type DailyOperationsSessionDeltas,
} from "@/lib/api/dailyOperationsLive";
import { cn } from "@/lib/utils";

function formatCount(value: number | null | undefined): string {
  if (value == null) {
    return DAILY_COPY.missingYesterday;
  }
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
}

type SparkField = keyof Omit<DailyOperationsHourlyBucket, "hour">;

const TILE_SPARK_FIELD: Partial<Record<DailyOperationsTileId, SparkField>> = {
  leads: "leads",
  form_call: "leads",
  bookings: "bookings",
  cancellations: "cancellations",
  texts: "messages",
  granot: "webhooks",
};

function toneClass(tone: DailyOperationsPercentChange["tone"]): string {
  if (tone === "ahead") {
    return "bg-emerald-50 text-emerald-700";
  }
  if (tone === "behind") {
    return "bg-red-50 text-red-700/80";
  }
  return "bg-steel-100 text-muted-foreground";
}

function TrendChip({
  change,
  caption,
}: {
  change: DailyOperationsPercentChange;
  caption: string;
}) {
  return (
    <span
      title={caption}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
        toneClass(change.tone),
      )}
    >
      <span aria-hidden="true">
        {change.tone === "ahead" ? "▲" : change.tone === "behind" ? "▼" : "•"}
      </span>
      {change.label}
    </span>
  );
}

/**
 * Twenty-four bars — one per Florida hour — for today's facts on this tile.
 * Hours after `nowHour` stay empty so the shape reads left-to-right as the
 * day fills in. Each bar is drawn full height and scaled from the baseline
 * (`daily-svg-bar`), so a live fact grows its hour instead of redrawing it.
 * Inline SVG: no chart library, SSR-safe.
 */
export function HourlySparkline({
  today,
  field,
  nowHour,
  className,
}: {
  today: DailyOperationsHourlyBucket[];
  field: SparkField;
  nowHour: number;
  className?: string;
}) {
  const values = Array.from({ length: 24 }, (_, hour) => today.find((row) => row.hour === hour)?.[field] ?? 0);
  const max = Math.max(1, ...values);
  const width = 96;
  const height = 20;
  const gap = 1;
  const barWidth = (width - gap * 23) / 24;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label={DAILY_COPY.rhythm}
      className={cn("block overflow-visible", className)}
      data-sparkline={field}
    >
      {values.map((value, hour) => {
        const ratio = value === 0 ? 1 / height : Math.max(2 / height, value / max);
        const x = hour * (barWidth + gap);
        const future = hour > nowHour;
        return (
          <rect
            key={hour}
            x={x}
            y={0}
            width={barWidth}
            height={height}
            rx={0.5}
            style={{ transform: `scaleY(${ratio})` }}
            className={cn(
              "daily-svg-bar",
              future ? "fill-steel-200/50" : hour === nowHour ? "fill-trust-blue" : "fill-trust-blue/55",
            )}
            data-value={value}
          />
        );
      })}
    </svg>
  );
}

/**
 * Form against Call as one two-tone bar. The Form / Call tile is a split of
 * the Leads tile, so it does not repeat the Leads trend chip (that would read
 * as a second, identical signal); the share bar is the fact that is new here.
 */
function SplitShareBar({ form, call }: { form: number; call: number }) {
  const total = form + call;
  const formPct = total === 0 ? 0 : Math.round((form / total) * 100);
  return (
    <div className="mt-2 space-y-1" data-split-bar>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-steel-100">
        <div className="daily-bar h-full bg-trust-blue" style={{ width: `${formPct}%` }} />
        <div className="daily-bar h-full bg-sky-400" style={{ width: `${total === 0 ? 0 : 100 - formPct}%` }} />
      </div>
      <p className="flex justify-between text-[11px] tabular-nums text-muted-foreground">
        <span>
          <span className="inline-block size-2 rounded-sm bg-trust-blue align-middle" aria-hidden="true" />{" "}
          {total === 0 ? DAILY_COPY.missingYesterday : `${formPct}%`} {DAILY_COPY.formShare}
        </span>
        <span>
          {total === 0 ? DAILY_COPY.missingYesterday : `${100 - formPct}%`} {DAILY_COPY.callShare}{" "}
          <span className="inline-block size-2 rounded-sm bg-sky-400 align-middle" aria-hidden="true" />
        </span>
      </p>
    </div>
  );
}

function HeadlineTile({
  id,
  label,
  value,
  secondary,
  trend,
  sparkline,
  nowHour,
  sessionDelta,
  flashing,
  selected,
  loading,
  onSelect,
}: {
  id: DailyOperationsTileId;
  label: string;
  value: ReactNode;
  secondary?: ReactNode;
  trend: DailyOperationsTrend | null;
  sparkline?: { today: DailyOperationsHourlyBucket[]; field: SparkField };
  nowHour: number;
  sessionDelta: number;
  flashing: boolean;
  selected: boolean;
  loading?: boolean;
  onSelect: (lane: DailyOperationsLane) => void;
}) {
  const hasBaseline = trend != null && (trend.yesterdayByNow != null || trend.dayBeforeByNow != null);
  return (
    <button
      type="button"
      onClick={() => onSelect(DAILY_OPERATIONS_TILE_LANES[id])}
      aria-pressed={selected}
      data-tile={id}
      className="text-left"
    >
      <Card
        className={cn(
          "h-full transition-shadow hover:shadow-md",
          selected && "ring-2 ring-trust-blue/40",
          flashing && "daily-tile-flash",
        )}
      >
        <CardContent className="flex h-full flex-col p-3.5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            {sessionDelta > 0 ? (
              <span
                className={cn(
                  "rounded-full bg-emerald-50 px-1.5 text-xs font-semibold tabular-nums text-emerald-700",
                  flashing && "animate-pulse",
                )}
                title={`+${sessionDelta} ${DAILY_COPY.live.toLowerCase()}`}
              >
                +<AnimatedNumber value={sessionDelta} />
              </span>
            ) : null}
          </div>
          <div className="mt-1.5 flex items-end justify-between gap-2">
            <p className="font-semibold tabular-nums text-3xl leading-none">
              {loading ? DAILY_COPY.missingYesterday : value}
            </p>
            {sparkline ? (
              <HourlySparkline today={sparkline.today} field={sparkline.field} nowHour={nowHour} />
            ) : null}
          </div>
          {trend && hasBaseline ? (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <TrendChip
                change={trend.versusYesterday}
                caption={`${DAILY_COPY.vsYesterdayByNow}: ${formatCount(trend.yesterdayByNow)}`}
              />
              {trend.dayBeforeByNow != null ? (
                <TrendChip
                  change={trend.versusTwoDayAverage}
                  caption={`${DAILY_COPY.vsTwoDayAverage}: ${formatCount(trend.twoDayAverageByNow)}`}
                />
              ) : null}
              {trend.pace.tone !== "missing" && trend.pace.delta !== 0 ? (
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {trend.pace.delta! > 0 ? `+${trend.pace.delta}` : trend.pace.delta} {DAILY_COPY.byNow}
                </span>
              ) : null}
            </div>
          ) : null}
          {trend ? (
            <p className="mt-1.5 text-[11px] tabular-nums leading-snug text-muted-foreground">
              {hasBaseline ? (
                <>
                  <span className="text-steel">{DAILY_COPY.yesterdayFull}</span>{" "}
                  {formatCount(trend.yesterdayByNow)} {DAILY_COPY.byNow} · {formatCount(trend.yesterday)}
                  {trend.dayBeforeByNow != null || trend.dayBefore != null ? (
                    <>
                      <br />
                      <span className="text-steel">{DAILY_COPY.dayBefore}</span>{" "}
                      {formatCount(trend.dayBeforeByNow)} {DAILY_COPY.byNow} · {formatCount(trend.dayBefore)}
                    </>
                  ) : null}
                </>
              ) : (
                <>
                  {DAILY_COPY.missingYesterday} {DAILY_COPY.noBaseline}
                </>
              )}
            </p>
          ) : null}
          {secondary ? (
            typeof secondary === "string" ? (
              <p className="mt-1.5 text-xs leading-snug text-navy/80">{secondary}</p>
            ) : (
              secondary
            )
          ) : null}
        </CardContent>
      </Card>
    </button>
  );
}

function Count({ value }: { value: number | null | undefined }) {
  return <AnimatedNumber value={value ?? 0} format={formatCount} />;
}

export function HeadlineTiles({
  snapshot,
  sessionDeltas,
  flashedTiles,
  lane,
  loading,
  nowHour: liveNowHour,
  onSelectLane,
}: {
  snapshot?: DailyOperationsSnapshot | null;
  sessionDeltas: DailyOperationsSessionDeltas;
  flashedTiles: DailyOperationsTileId[];
  lane: string | null;
  loading?: boolean;
  /** Browser-clock Florida hour; falls back to the snapshot stamp on the server render. */
  nowHour?: number;
  onSelectLane: (lane: DailyOperationsLane) => void;
}) {
  const leads = snapshot?.metrics.leads;
  const texts = snapshot?.metrics.texts;
  const intakes = snapshot?.metrics.intakes;
  const webhooks = snapshot?.metrics.webhooks;
  const granotToday = granotTileToday(snapshot ?? null);
  const flashing = new Set(flashedTiles);
  const hourlyToday = snapshot?.hourly.today ?? [];
  const nowHour = liveNowHour ?? (snapshot ? dailyOperationsFloridaHour(snapshot.generated_at) : 23);
  const spark = (id: DailyOperationsTileId) => {
    const field = TILE_SPARK_FIELD[id];
    return field ? { today: hourlyToday, field } : undefined;
  };

  const granotTrend = snapshot
    ? dailyOperationsTrend({
        today: granotToday,
        yesterdayByNow: granotYesterdayByNow(snapshot),
        dayBeforeByNow: granotDayBeforeByNow(snapshot),
        yesterday: granotYesterdayTotal(snapshot),
        dayBefore: granotDayBeforeTotal(snapshot),
      })
    : null;

  return (
    <section className="space-y-2" aria-label={DAILY_COPY.headline}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <HeadlineTile
          id="leads"
          label={DAILY_COPY.tiles.leads}
          value={<Count value={leads?.today} />}
          trend={trendFromPace(leads)}
          sparkline={spark("leads")}
          nowHour={nowHour}
          sessionDelta={sessionDeltas.leads}
          flashing={flashing.has("leads")}
          selected={lane === "lead"}
          loading={loading}
          onSelect={onSelectLane}
        />
        <HeadlineTile
          id="form_call"
          label={DAILY_COPY.tiles.formCall}
          value={
            <>
              <Count value={leads?.form} /> / <Count value={leads?.call} />
            </>
          }
          secondary={leads ? <SplitShareBar form={leads.form} call={leads.call} /> : undefined}
          trend={null}
          sparkline={spark("form_call")}
          nowHour={nowHour}
          sessionDelta={sessionDeltas.form_call}
          flashing={flashing.has("form_call")}
          selected={lane === "lead"}
          loading={loading}
          onSelect={onSelectLane}
        />
        <HeadlineTile
          id="duplicates"
          label={DAILY_COPY.tiles.duplicates}
          value={<Count value={(leads?.duplicate_form ?? 0) + (leads?.duplicate_call ?? 0)} />}
          secondary={
            leads
              ? `${formatCount(leads.duplicate_form)} ${DAILY_COPY.form.toLowerCase()} · ${formatCount(leads.duplicate_call)} ${DAILY_COPY.call.toLowerCase()}`
              : undefined
          }
          trend={null}
          nowHour={nowHour}
          sessionDelta={sessionDeltas.duplicates}
          flashing={flashing.has("duplicates")}
          selected={lane === "lead"}
          loading={loading}
          onSelect={onSelectLane}
        />
        <HeadlineTile
          id="bookings"
          label={DAILY_COPY.tiles.bookings}
          value={<Count value={snapshot?.metrics.bookings.today} />}
          trend={trendFromPace(snapshot?.metrics.bookings)}
          sparkline={spark("bookings")}
          nowHour={nowHour}
          sessionDelta={sessionDeltas.bookings}
          flashing={flashing.has("bookings")}
          selected={lane === "booking"}
          loading={loading}
          onSelect={onSelectLane}
        />
        <HeadlineTile
          id="cancellations"
          label={DAILY_COPY.tiles.cancellations}
          value={<Count value={snapshot?.metrics.cancellations.today} />}
          trend={trendFromPace(snapshot?.metrics.cancellations)}
          sparkline={spark("cancellations")}
          nowHour={nowHour}
          sessionDelta={sessionDeltas.cancellations}
          flashing={flashing.has("cancellations")}
          selected={lane === "cancellation"}
          loading={loading}
          onSelect={onSelectLane}
        />
        <HeadlineTile
          id="texts"
          label={DAILY_COPY.tiles.texts}
          value={<Count value={texts?.today} />}
          secondary={
            texts
              ? `${texts.held_now} ${DAILY_COPY.heldChip}${
                  texts.deferred ? ` · ${texts.deferred} ${DAILY_COPY.heldUntilMorning}` : ""
                } · ${texts.skipped} ${DAILY_COPY.skipped} · ${texts.failed} ${DAILY_COPY.failed}`
              : undefined
          }
          trend={trendFromPace(texts)}
          sparkline={spark("texts")}
          nowHour={nowHour}
          sessionDelta={sessionDeltas.texts}
          flashing={flashing.has("texts")}
          selected={lane === "text"}
          loading={loading}
          onSelect={onSelectLane}
        />
        <HeadlineTile
          id="granot"
          label={DAILY_COPY.tiles.granot}
          value={<Count value={granotToday} />}
          secondary={
            webhooks
              ? `${webhooks.lead_created.today} ${DAILY_COPY.granotClasses.lead_created} · ${webhooks.priority_updated.today} ${DAILY_COPY.granotClasses.priority_updated} · ${webhooks.booked.today} / ${webhooks.release.today} ${DAILY_COPY.granotClasses.booked} / ${DAILY_COPY.granotClasses.release}`
              : undefined
          }
          trend={granotTrend}
          sparkline={spark("granot")}
          nowHour={nowHour}
          sessionDelta={sessionDeltas.granot}
          flashing={flashing.has("granot")}
          selected={lane === "granot"}
          loading={loading}
          onSelect={onSelectLane}
        />
        <HeadlineTile
          id="intakes"
          label={DAILY_COPY.tiles.intakes}
          value={<Count value={intakes?.opened_today} />}
          secondary={
            intakes
              ? `${intakes.opened_today} ${DAILY_COPY.opened} · ${intakes.still_open} ${DAILY_COPY.waitingForYou}`
              : undefined
          }
          trend={null}
          nowHour={nowHour}
          sessionDelta={sessionDeltas.intakes}
          flashing={flashing.has("intakes")}
          selected={lane === "intake"}
          loading={loading}
          onSelect={onSelectLane}
        />
      </div>
    </section>
  );
}
