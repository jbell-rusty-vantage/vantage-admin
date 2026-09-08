"use client";

import { DAILY_COPY } from "@/components/daily/daily-copy";
import { Card, CardContent } from "@/components/ui/card";
import {
  DAILY_OPERATIONS_TILE_LANES,
  granotYesterdayByNow,
  paceVersusYesterdayByNow,
  type DailyOperationsLane,
  type DailyOperationsSnapshot,
  type DailyOperationsTileId,
} from "@/lib/api/dailyOperations";
import {
  granotTileToday,
  type DailyOperationsSessionDeltas,
} from "@/lib/api/dailyOperationsLive";
import { cn } from "@/lib/utils";

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function PaceChip({
  today,
  yesterdayByNow,
  yesterday,
}: {
  today: number;
  yesterdayByNow: number | null;
  yesterday: number | null;
}) {
  const pace = paceVersusYesterdayByNow(today, yesterdayByNow);
  const label =
    pace.tone === "missing"
      ? DAILY_COPY.missingYesterday
      : pace.delta === 0
        ? DAILY_COPY.even
        : pace.delta! > 0
          ? `+${pace.delta}`
          : `${pace.delta}`;
  const yesterdayTitle =
    yesterday == null
      ? DAILY_COPY.missingYesterday
      : `${DAILY_COPY.yesterdayFull} ${formatCount(yesterday)}`;
  return (
    <span
      title={`${DAILY_COPY.yesterdayByNow}: ${
        yesterdayByNow == null ? DAILY_COPY.missingYesterday : formatCount(yesterdayByNow)
      } · ${yesterdayTitle}`}
      className={cn(
        "inline-flex rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
        pace.tone === "ahead" && "bg-emerald-50 text-emerald-700",
        pace.tone === "behind" && "bg-red-50 text-red-700/80",
        (pace.tone === "even" || pace.tone === "missing") && "bg-steel-100 text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}

function HeadlineTile({
  id,
  label,
  value,
  secondary,
  today,
  yesterdayByNow,
  yesterday,
  sessionDelta,
  flashing,
  selected,
  loading,
  onSelect,
}: {
  id: DailyOperationsTileId;
  label: string;
  value: string;
  secondary?: string;
  today: number;
  yesterdayByNow: number | null;
  yesterday: number | null;
  sessionDelta: number;
  flashing: boolean;
  selected: boolean;
  loading?: boolean;
  onSelect: (lane: DailyOperationsLane) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(DAILY_OPERATIONS_TILE_LANES[id])}
      aria-pressed={selected}
      className="text-left"
    >
      <Card className={cn(selected && "ring-2 ring-trust-blue/40")}>
        <CardContent className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 font-semibold tabular-nums text-3xl">
            {loading ? DAILY_COPY.missingYesterday : value}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <PaceChip today={today} yesterdayByNow={yesterdayByNow} yesterday={yesterday} />
            {sessionDelta > 0 ? (
              <span
                className={cn(
                  "text-xs font-semibold tabular-nums text-emerald-700",
                  flashing && "animate-pulse",
                )}
              >
                +{sessionDelta}
              </span>
            ) : null}
          </div>
          {secondary ? (
            <p className="mt-1 text-xs text-muted-foreground">{secondary}</p>
          ) : null}
        </CardContent>
      </Card>
    </button>
  );
}

export function HeadlineTiles({
  snapshot,
  sessionDeltas,
  flashedTiles,
  lane,
  loading,
  onSelectLane,
}: {
  snapshot?: DailyOperationsSnapshot | null;
  sessionDeltas: DailyOperationsSessionDeltas;
  flashedTiles: DailyOperationsTileId[];
  lane: string | null;
  loading?: boolean;
  onSelectLane: (lane: DailyOperationsLane) => void;
}) {
  const leads = snapshot?.metrics.leads;
  const texts = snapshot?.metrics.texts;
  const intakes = snapshot?.metrics.intakes;
  const webhooks = snapshot?.metrics.webhooks;
  const granotToday = granotTileToday(snapshot ?? null);
  const flashing = new Set(flashedTiles);

  return (
    <section className="space-y-2">
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {DAILY_COPY.headline}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
        <HeadlineTile
          id="leads"
          label={DAILY_COPY.tiles.leads}
          value={formatCount(leads?.today ?? 0)}
          today={leads?.today ?? 0}
          yesterdayByNow={leads?.yesterday_by_now ?? null}
          yesterday={leads?.yesterday ?? null}
          sessionDelta={sessionDeltas.leads}
          flashing={flashing.has("leads")}
          selected={lane === "lead"}
          loading={loading}
          onSelect={onSelectLane}
        />
        <HeadlineTile
          id="form_call"
          label={DAILY_COPY.tiles.formCall}
          value={`${formatCount(leads?.form ?? 0)} / ${formatCount(leads?.call ?? 0)}`}
          today={(leads?.form ?? 0) + (leads?.call ?? 0)}
          yesterdayByNow={leads?.yesterday_by_now ?? null}
          yesterday={leads?.yesterday ?? null}
          sessionDelta={sessionDeltas.form_call}
          flashing={flashing.has("form_call")}
          selected={lane === "lead"}
          loading={loading}
          onSelect={onSelectLane}
        />
        <HeadlineTile
          id="duplicates"
          label={DAILY_COPY.tiles.duplicates}
          value={formatCount((leads?.duplicate_form ?? 0) + (leads?.duplicate_call ?? 0))}
          today={(leads?.duplicate_form ?? 0) + (leads?.duplicate_call ?? 0)}
          yesterdayByNow={null}
          yesterday={null}
          sessionDelta={sessionDeltas.duplicates}
          flashing={flashing.has("duplicates")}
          selected={lane === "lead"}
          loading={loading}
          onSelect={onSelectLane}
        />
        <HeadlineTile
          id="bookings"
          label={DAILY_COPY.tiles.bookings}
          value={formatCount(snapshot?.metrics.bookings.today ?? 0)}
          today={snapshot?.metrics.bookings.today ?? 0}
          yesterdayByNow={snapshot?.metrics.bookings.yesterday_by_now ?? null}
          yesterday={snapshot?.metrics.bookings.yesterday ?? null}
          sessionDelta={sessionDeltas.bookings}
          flashing={flashing.has("bookings")}
          selected={lane === "booking"}
          loading={loading}
          onSelect={onSelectLane}
        />
        <HeadlineTile
          id="cancellations"
          label={DAILY_COPY.tiles.cancellations}
          value={formatCount(snapshot?.metrics.cancellations.today ?? 0)}
          today={snapshot?.metrics.cancellations.today ?? 0}
          yesterdayByNow={snapshot?.metrics.cancellations.yesterday_by_now ?? null}
          yesterday={snapshot?.metrics.cancellations.yesterday ?? null}
          sessionDelta={sessionDeltas.cancellations}
          flashing={flashing.has("cancellations")}
          selected={lane === "cancellation"}
          loading={loading}
          onSelect={onSelectLane}
        />
        <HeadlineTile
          id="texts"
          label={DAILY_COPY.tiles.texts}
          value={formatCount(texts?.today ?? 0)}
          secondary={
            texts
              ? `${texts.held_now} ${DAILY_COPY.heldChip}${
                  texts.deferred ? ` · ${texts.deferred} ${DAILY_COPY.heldUntilMorning}` : ""
                }`
              : undefined
          }
          today={texts?.today ?? 0}
          yesterdayByNow={texts?.yesterday_by_now ?? null}
          yesterday={texts?.yesterday ?? null}
          sessionDelta={sessionDeltas.texts}
          flashing={flashing.has("texts")}
          selected={lane === "text"}
          loading={loading}
          onSelect={onSelectLane}
        />
        <HeadlineTile
          id="granot"
          label={DAILY_COPY.tiles.granot}
          value={formatCount(granotToday)}
          secondary={
            webhooks
              ? `${webhooks.lead_created.today} ${DAILY_COPY.granotClasses.lead_created} · ${webhooks.priority_updated.today} ${DAILY_COPY.granotClasses.priority_updated} · ${webhooks.booked.today} / ${webhooks.release.today} ${DAILY_COPY.granotClasses.booked} / ${DAILY_COPY.granotClasses.release}`
              : undefined
          }
          today={granotToday}
          yesterdayByNow={snapshot ? granotYesterdayByNow(snapshot) : null}
          yesterday={
            webhooks?.lead_created.yesterday == null
              ? null
              : (webhooks.lead_created.yesterday ?? 0) +
                (webhooks.priority_updated.yesterday ?? 0) +
                (webhooks.booking_status_changed.yesterday ?? 0)
          }
          sessionDelta={sessionDeltas.granot}
          flashing={flashing.has("granot")}
          selected={lane === "granot"}
          loading={loading}
          onSelect={onSelectLane}
        />
        <HeadlineTile
          id="intakes"
          label={DAILY_COPY.tiles.intakes}
          value={formatCount(intakes?.opened_today ?? 0)}
          secondary={
            intakes
              ? `${intakes.opened_today} ${DAILY_COPY.opened} · ${intakes.still_open} ${DAILY_COPY.waitingForYou}`
              : undefined
          }
          today={intakes?.opened_today ?? 0}
          yesterdayByNow={null}
          yesterday={null}
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
