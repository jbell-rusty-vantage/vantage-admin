"use client";
/**
 * UI1-OVERVIEW (UI-1 §4, addendum §6, UX3, UX16): the Overview, mounted in the Desk's `overview` slot.
 *
 * Header: `Updated {as_of}` (exact ET), the period picker, the shared preset bar (the same URL selection as the
 * lists) and `Calls aren't filtered by Priority.` Then four blocks, each its own Region (Suspense + error boundary +
 * skeleton) reading `useOverview(params)`: one query key, so the four share one request and one cache entry, and
 * each shows its own fallback on error. The read re-polls every 60 s and on the `attention` / `outreach` topics
 * (UI1-DATA). A URL change runs in a transition, so the old numbers stay on screen under the 2 px progress bar.
 *
 * `FEATURE_DISABLED` (the route with `OVERVIEW` off, `S9/flag-off/overview__feature-off.json`) is not an error
 * here: each block renders its empty shape, `—` in every number and `No rep activity in this period.`
 */
import { useQueryClient } from "@tanstack/react-query";
import { Component, useMemo, type ReactNode } from "react";
import type { Overview as OverviewData } from "@/lib/api/salesIntelligence";
import { useReportAsOf } from "../data/live";
import { siKeys } from "../data/query-keys";
import type { OverviewParams } from "../data/requests";
import { overviewParamsFromDesk } from "../data/url-state";
import { useDeskUrlState } from "../data/use-url-state";
import { useOverview } from "../data/use-overview";
import { PresetBar, usePresetSelection, type PresetValue } from "../desk/preset-bar";
import { copy } from "../sales-intelligence-copy";
import { cx } from "../lib/format";
import { Region, RegionProgress, SkeletonLines, TimeText, regionErrorCode } from "../primitives";
import { DeskHealthBlock, DeskHealthBlockSkeleton } from "./desk-health-block";
import { DASH } from "./format";
import { overviewLinks, type OverviewLinks } from "./links";
import { NowBlock, NowBlockSkeleton } from "./now-block";
import { PeriodPicker, PeriodPickerSkeleton, type PeriodPatch } from "./period-picker";
import { RepsBlock, RepsBlockSkeleton } from "./reps-block";
import { RepMediansBlock, RepMediansBlockSkeleton } from "./rep-medians-block";
import { useIsRep } from "../rep/viewer";
import { SpendBlock, SpendBlockSkeleton } from "./spend-block";

const t = copy.ui1.overview;

/** The route answers `FEATURE_DISABLED` when `OVERVIEW` is off. */
export const isFeatureOff = (error: unknown): boolean => regionErrorCode(error) === "FEATURE_DISABLED";

/**
 * The links behind the numbers. Priority is the one the server applied (`filters.priority`), so a tile links to
 * the list it counted; the Lead toggle and a one-rep scope (`scope.agent_id`) are carried as well.
 */
export function linksFor(data: OverviewData, attachment: PresetValue["attachment"], rep = false): OverviewLinks {
  return overviewLinks({ priority: data.filters.priority ?? [], attachment, agentId: data.scope?.agent_id ?? null, rep });
}

/**
 * UI2-OVERVIEW (UI-2 §6, A08): block titles for the viewer. A rep gets `Your records now`, `Your desk health`,
 * `You and the team` (You | Team median, in place of Reps) and `Your Lead spend`; the scope is the server's
 * (`data.scope.agent_id`) and no link carries it.
 */
const blockTitles = (rep: boolean) => ({
  health: rep ? copy.ui2.overview.healthTitle : t.desk.title,
  spend: rep ? copy.ui2.overview.spendTitle : t.spend.title,
});

/** Renders `fallback` for a feature-off read; any other error goes up to the Region's boundary. */
class FeatureOffBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { error: unknown }> {
  state: { error: unknown } = { error: null };
  static getDerivedStateFromError(error: unknown) {
    return { error };
  }
  render() {
    if (this.state.error != null) {
      if (isFeatureOff(this.state.error)) return this.props.fallback;
      throw this.state.error;
    }
    return this.props.children;
  }
}

type Render = (data: OverviewData | null, links: OverviewLinks | null) => ReactNode;

function Connected({ params, attachment, render, reportAsOf }: { params: OverviewParams; attachment: PresetValue["attachment"]; render: Render; reportAsOf?: boolean }) {
  const { overview, isFetching } = useOverview(params);
  const rep = useIsRep();
  const links = useMemo(() => linksFor(overview, attachment, rep), [overview, attachment, rep]);
  return (
    <>
      <RegionProgress active={isFetching} />
      {reportAsOf && <ReportAsOf asOf={overview.as_of} />}
      {render(overview, links)}
    </>
  );
}

function ReportAsOf({ asOf }: { asOf: string }) {
  useReportAsOf(asOf);
  return null;
}

function OverviewRegion({ name, params, attachment, skeleton, render, reportAsOf }: { name: string; params: OverviewParams; attachment: PresetValue["attachment"]; skeleton: ReactNode; render: Render; reportAsOf?: boolean }) {
  const client = useQueryClient();
  return (
    <Region name={name} skeleton={skeleton} onRetry={() => client.resetQueries({ queryKey: siKeys.overview(params) })}>
      <FeatureOffBoundary fallback={render(null, null)}>
        <Connected params={params} attachment={attachment} render={render} reportAsOf={reportAsOf} />
      </FeatureOffBoundary>
    </Region>
  );
}

export type OverviewPeriodState = { period: string | null; from: string | null; to: string | null };

/** `Updated {as_of}` and the period picker. `data: null` → `Updated —` and the default label. */
export function OverviewHeaderBody({ data, period, onPeriod }: { data: OverviewData | null; period: OverviewPeriodState; onPeriod: (patch: PeriodPatch) => void }) {
  return (
    <div className="si-ovhead__row">
      <p className="si-ovhead__updated" data-overview="updated">
        {data ? <TimeText t={data.as_of} asOf={data.as_of} mode="exact" prefix={t.updated} /> : <span>{t.updated} {DASH}</span>}
      </p>
      <PeriodPicker
        key={`${period.period ?? ""}|${period.from ?? ""}|${period.to ?? ""}`}
        value={period.period}
        from={period.from}
        to={period.to}
        periods={data?.periods ?? null}
        onChange={onPeriod}
      />
    </div>
  );
}

function OverviewHeaderSkeleton() {
  return (
    <div className="si-ovhead__row is-skeleton" aria-hidden>
      <SkeletonLines lines={1} widths={[200]} />
      <PeriodPickerSkeleton />
    </div>
  );
}

/** The preset bar and the Priority note, shared by the connected page and the static view. */
function PresetRow({ preset, onPreset }: { preset: PresetValue; onPreset: (next: PresetValue) => void }) {
  // Operator (UI-2 gate, 2026-09-25): `GET /overview` can't filter by Lead, so the Lead toggle is hidden here and the page
  // says so; the Overview reads every record, and a preset click keeps the lists' own Lead choice untouched.
  const shown: PresetValue = { ...preset, attachment: null };
  return (
    <div className="si-ovhead__preset">
      <PresetBar counts={null} view="overview" value={shown} onChange={(next) => onPreset({ ...next, attachment: preset.attachment })} hideLead />
      <p className="si-ovhead__note" data-overview="note">{t.period.note}</p>
      <p className="si-ovhead__note" data-overview="lead-note">{copy.ui2.overview.leadFilterNote}</p>
    </div>
  );
}

/**
 * The whole Overview from one response, without queries (the gallery, the tests, and the shape the connected page
 * renders block by block). `data: null` is the feature-off / empty rendering.
 */
export function OverviewView({ data, period, preset, onPeriod, onPreset, className }: {
  data: OverviewData | null;
  period: OverviewPeriodState;
  preset: PresetValue;
  onPeriod: (patch: PeriodPatch) => void;
  onPreset: (next: PresetValue) => void;
  className?: string;
}) {
  const rep = useIsRep();
  const links = data ? linksFor(data, preset.attachment, rep) : null;
  const titles = blockTitles(rep);
  return (
    <div className={cx("si-overview", className)} data-overview-status={data ? data.status : "off"} data-viewer={rep ? "rep" : undefined}>
      <header className="si-ovhead">
        <OverviewHeaderBody data={data} period={period} onPeriod={onPeriod} />
        <PresetRow preset={preset} onPreset={onPreset} />
      </header>
      <div className="si-overview__blocks">
        <NowBlock data={data} links={links} rep={rep} />
        <DeskHealthBlock data={data} links={links} title={titles.health} />
        {rep ? <RepMediansBlock data={data} /> : <RepsBlock data={data} links={links} />}
        <SpendBlock data={data} title={titles.spend} />
      </div>
    </div>
  );
}

/**
 * The connected Overview. `userId` goes to `usePresetSelection` so the preset is remembered per user; pass it from
 * one component per page only (UI1-PRESET note).
 */
export function Overview({ userId, className }: { userId?: string | null; className?: string }) {
  const { state, update, isPending } = useDeskUrlState();
  const preset = usePresetSelection({ userId });
  const params = useMemo(() => overviewParamsFromDesk(state), [state]);
  const period: OverviewPeriodState = { period: state.period, from: state.from, to: state.to };
  const onPeriod = (patch: PeriodPatch) => update(patch);
  // The Overview's links don't carry the Lead toggle either (its numbers ignore it; see PresetRow).
  const attachment = null;
  const rep = useIsRep();
  const titles = blockTitles(rep);

  return (
    <div className={cx("si-overview", className)} data-viewer={rep ? "rep" : undefined}>
      <RegionProgress active={isPending || preset.isPending} />
      <header className="si-ovhead">
        <OverviewRegion
          name="overview-header"
          params={params}
          attachment={attachment}
          skeleton={<OverviewHeaderSkeleton />}
          reportAsOf
          render={(data) => <OverviewHeaderBody data={data} period={period} onPeriod={onPeriod} />}
        />
        <PresetRow preset={preset.value} onPreset={preset.setValue} />
      </header>
      <div className="si-overview__blocks">
        <OverviewRegion name="overview-now" params={params} attachment={attachment} skeleton={<NowBlockSkeleton />} render={(data, links) => <NowBlock data={data} links={links} rep={rep} />} />
        <OverviewRegion name="overview-desk" params={params} attachment={attachment} skeleton={<DeskHealthBlockSkeleton />} render={(data, links) => <DeskHealthBlock data={data} links={links} title={titles.health} />} />
        {rep ? (
          <OverviewRegion name="overview-you" params={params} attachment={attachment} skeleton={<RepMediansBlockSkeleton />} render={(data) => <RepMediansBlock data={data} />} />
        ) : (
          <OverviewRegion name="overview-reps" params={params} attachment={attachment} skeleton={<RepsBlockSkeleton />} render={(data, links) => <RepsBlock data={data} links={links} />} />
        )}
        <OverviewRegion name="overview-spend" params={params} attachment={attachment} skeleton={<SpendBlockSkeleton />} render={(data) => <SpendBlock data={data} title={titles.spend} />} />
      </div>
    </div>
  );
}

/** The whole page's first-load shape (for the Desk's slot or a route `loading.tsx`). */
export function OverviewSkeleton() {
  return (
    <div className="si-overview is-skeleton" aria-hidden>
      <header className="si-ovhead">
        <OverviewHeaderSkeleton />
        <PresetBar.Skeleton />
      </header>
      <div className="si-overview__blocks">
        <NowBlockSkeleton />
        <DeskHealthBlockSkeleton />
        <RepsBlockSkeleton />
        <SpendBlockSkeleton />
      </div>
    </div>
  );
}
Overview.Skeleton = OverviewSkeleton;
