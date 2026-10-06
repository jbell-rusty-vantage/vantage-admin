"use client";
/**
 * Today > Pulse (owner only): what needs me, and is today normal? `PulseView` is pure over its props (the container
 * `PulseTab` owns the queries), so it renders the same in tests as in the browser.
 *
 * A null count is pending, never 0. A failed read is said in words (`ReadFailure`), never an endless skeleton.
 */
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Ban, Banknote, CalendarPlus, ClipboardCheck, MessageSquareText, Star, TriangleAlert, UserPlus, UserX, Workflow } from "lucide-react";
import { useGranotRuns } from "@/components/automations/granot-updates/use-granot-updates";
import { dailyOperationsFloridaHour, dailyOperationsKindLabel } from "@/components/daily/daily-copy";
import { HourlyRhythm } from "@/components/daily/hourly-rhythm";
import {
  milestoneHeadline,
  milestoneLinks,
  milestoneProgressText,
  milestoneRankLine,
  milestoneRepsLine,
  readMilestone,
  repGoalReachedAtById,
} from "@/components/daily/milestone";
import { useNowMs } from "@/components/daily/use-now";
import { intakeCaseHref } from "@/components/intakes/intake-copy";
import { useTeam } from "@/components/outreach-desk/data/use-desk-reads";
import { cadenceMetricText, repGoalText, unassignedCaption } from "@/components/outreach-desk/lib/format";
import {
  CrmCard,
  IconBadge,
  Person,
  Pill,
  ReadFailure,
  SkeletonLine,
  SummaryCard,
  Track,
  TrendChip,
  formatAge,
  formatTime,
  type PillVariant,
} from "@/components/ui/crm";
import {
  fetchDailyOperationsEvents,
  fetchDailyOperationsSnapshot,
  normalizeDailyOperationsSnapshot,
  sourceCompanyLabel,
  withLiveDailyOperationsClock,
  type DailyOperationsSnapshot,
} from "@/lib/api/dailyOperations";
import { dailyOperationsCardFacts, dailyOperationsEventLinks, dailyOperationsEventTitle } from "@/lib/api/dailyOperationsBoard";
import type { DailyOperationsEventItem } from "@/lib/api/dailyOperationsLive";
import { fetchGranotLifecycleCases, type GranotLifecycleCaseListItem } from "@/lib/api/granotLifecycle";
import { expiresInWords, waitingChecks, windowWords, type GranotCheck } from "@/lib/automations/granot-updates-model";
import { granotCheckHref } from "@/lib/automations/granot-updates-redirects";
import type { SalesOutreachDailyCallGoalRow, SalesOutreachTeamDto } from "@/lib/api/salesOutreach";
import { queryKeys } from "@/lib/query/keys";
import {
  exceptionKindsInWords,
  exceptionsTotal,
  highlightEvents,
  isCelebration,
  openIntakePreviewFilters,
  tileTrend,
} from "./pulse-math";
import { todayCopy } from "./today-copy";
import type { TodayRole } from "./today-url";

const w = todayCopy.waiting;
const SNAPSHOT_RESYNC_MS = 5 * 60_000;
const EVENTS_REFRESH_MS = 60_000;

export type PulseIntakes = {
  items: GranotLifecycleCaseListItem[];
  hasMore: boolean;
  loading?: boolean;
  error?: unknown;
};

export type PulseViewProps = {
  role: TodayRole;
  snapshot: DailyOperationsSnapshot | null;
  snapshotError?: unknown;
  events: DailyOperationsEventItem[] | null;
  eventsError?: unknown;
  team: SalesOutreachTeamDto | null | undefined;
  teamError?: unknown;
  intakes: PulseIntakes;
  /** Granot checks waiting for approval (doc 17), newest first; `null` or empty hides the slot. */
  granotWaiting?: GranotCheck[] | null;
  nowMs: number | undefined;
};

function WaitingColumn({
  icon: Icon,
  title,
  sub,
  children,
  action,
  href,
  testId,
}: {
  icon: typeof ClipboardCheck;
  title: string;
  sub?: string | null;
  children?: React.ReactNode;
  action: string;
  href: string;
  testId: string;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-2" data-testid={testId} aria-label={title}>
      <div className="flex items-center gap-3">
        <IconBadge icon={Icon} tone="amber" />
        <div className="min-w-0">
          <h3 className="m-0 text-[15px] font-bold text-navy">{title}</h3>
          {sub ? <p className="crm-text-muted crm-small m-0">{sub}</p> : null}
        </div>
      </div>
      {children}
      <Link href={href} className="crm-link crm-strong">
        {action}
      </Link>
    </section>
  );
}

function WaitingForYou({ snapshot, snapshotError, team, teamError, intakes, granotWaiting, nowMs }: Pick<PulseViewProps, "snapshot" | "snapshotError" | "team" | "teamError" | "intakes" | "granotWaiting" | "nowMs">) {
  const open = snapshot?.metrics.intakes.still_open ?? null;
  const bookingRows = intakes.items.filter((item) => item.kind === "booking").slice(0, 3);
  const unassignedCount = team?.unassigned.count ?? null;
  const unassignedSub = team ? unassignedCaption(team.unassigned) : null;
  const exceptions = snapshot ? exceptionsTotal(snapshot) : null;
  const kinds = snapshot ? exceptionKindsInWords(snapshot) : "";
  const granotCheck = granotWaiting?.[0] ?? null;
  const granotMore = (granotWaiting?.length ?? 0) - 1;

  return (
    <CrmCard title={w.title} testId="pulse-waiting">
      <div className={granotCheck ? "grid gap-5 p-4 md:grid-cols-2 xl:grid-cols-4" : "grid gap-5 p-4 md:grid-cols-3"}>
        <WaitingColumn
          testId="waiting-bookings"
          icon={ClipboardCheck}
          title={open === null ? (snapshotError ? todayCopy.snapshotLoadError : "…") : w.bookings.title(open)}
          action={w.bookings.action}
          href={w.bookings.href}
        >
          {intakes.error ? (
            <p className="crm-text-muted crm-small m-0">{w.bookings.loadError}</p>
          ) : intakes.loading ? (
            <SkeletonLine />
          ) : bookingRows.length === 0 ? (
            <p className="crm-text-muted crm-small m-0">{w.bookings.none}</p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {bookingRows.map((item) => (
                <li key={`${item.kind}:${item.case_id}`} className="crm-small">
                  <Link className="crm-link crm-strong" href={intakeCaseHref(item.case_id, { tab: "booking", state: "open" })}>
                    {item.job_no || w.bookings.jobPending}
                  </Link>{" "}
                  <span>{item.customer_label || "—"}</span>
                  {nowMs !== undefined ? <span className="crm-text-muted"> · {formatAge(item.last_evidence_at, nowMs)}</span> : null}
                </li>
              ))}
              {open !== null && open > bookingRows.length ? <li className="crm-text-muted crm-small">{w.bookings.more(open - bookingRows.length)}</li> : null}
            </ul>
          )}
        </WaitingColumn>

        <WaitingColumn
          testId="waiting-unassigned"
          icon={UserX}
          title={unassignedCount === null ? w.unassigned.pendingTitle : w.unassigned.title(unassignedCount)}
          sub={unassignedCount === null ? (team ? w.unassigned.pending : teamError ? w.unassigned.unavailable : null) : unassignedSub}
          action={w.unassigned.action}
          href={w.unassigned.href}
        >
          {unassignedCount === 0 ? <p className="crm-text-muted crm-small m-0">{w.unassigned.none}</p> : null}
        </WaitingColumn>

        <WaitingColumn
          testId="waiting-exceptions"
          icon={TriangleAlert}
          title={exceptions === null ? (snapshotError ? todayCopy.snapshotLoadError : "…") : w.exceptions.title(exceptions)}
          sub={exceptions === null ? null : exceptions === 0 ? w.exceptions.none : kinds}
          action={w.exceptions.action}
          href={w.exceptions.href}
        />

        {granotCheck ? (
          <WaitingColumn
            testId="waiting-granot"
            icon={Workflow}
            title={w.granotUpdates.title(granotCheck.buckets.ready)}
            sub={w.granotUpdates.sub(windowWords(granotCheck.from, granotCheck.to), nowMs === undefined ? null : expiresInWords(granotCheck.expires_at, nowMs))}
            action={w.granotUpdates.action}
            href={granotCheckHref(granotCheck.id)}
          >
            {granotMore > 0 ? <p className="crm-text-muted crm-small m-0">{w.granotUpdates.more(granotMore)}</p> : null}
          </WaitingColumn>
        ) : null}
      </div>
    </CrmCard>
  );
}

function Tiles({ snapshot }: { snapshot: DailyOperationsSnapshot | null }) {
  const m = snapshot?.metrics;
  const t = todayCopy.tiles;
  const trendOf = (pace: Parameters<typeof tileTrend>[0]) => {
    const trend = tileTrend(pace);
    return trend ? (
      <TrendChip tone={trend.tone} title={trend.title}>
        {trend.label}
      </TrendChip>
    ) : null;
  };
  const value = (n: number | undefined) => (n === undefined ? "…" : String(n));
  return (
    <div className="crm-summary-row" data-testid="pulse-tiles">
      <SummaryCard
        testId="tile-leads"
        icon={UserPlus}
        tone="blue"
        title={t.leads}
        value={value(m?.leads.today)}
        trend={m ? trendOf(m.leads) : null}
        caption={m ? t.leadCaption(m.leads.form, m.leads.call) : null}
        href="/?tab=operations&lane=lead"
      />
      <SummaryCard
        testId="tile-bookings"
        icon={CalendarPlus}
        tone="green"
        title={t.bookings}
        value={value(m?.bookings.today)}
        trend={m ? trendOf(m.bookings) : null}
        href="/?tab=operations&lane=booking"
      />
      <SummaryCard
        testId="tile-cancellations"
        icon={Ban}
        tone="red"
        title={t.cancellations}
        value={value(m?.cancellations.today)}
        trend={m ? trendOf(m.cancellations) : null}
        href="/?tab=operations&lane=cancellation"
      />
      <SummaryCard
        testId="tile-texts"
        icon={MessageSquareText}
        tone="purple"
        title={t.texts}
        value={value(m?.texts.today)}
        caption={m ? t.textsCaption(m.texts.held_now) : null}
        href="/?tab=operations&lane=text"
      />
      <SummaryCard testId="tile-spend" icon={Banknote} tone="purple" title={t.spend} value={t.spendValue} caption={t.spendCaption} href="/?tab=money" />
    </div>
  );
}

function pillVariant(event: DailyOperationsEventItem): PillVariant {
  if (isCelebration(event)) return "gold";
  switch (event.lane) {
    case "lead":
      return "blue";
    case "booking":
      return "green";
    case "cancellation":
      return "red";
    case "exception":
      return "amber";
    case "granot":
      return "purple";
    default:
      return "neutral";
  }
}

function Highlights({
  events,
  eventsError,
  nowMs,
}: {
  events: DailyOperationsEventItem[] | null;
  eventsError?: unknown;
  nowMs?: number;
}) {
  const h = todayCopy.highlights;
  const rows = events ? highlightEvents(events, undefined, nowMs) : null;
  return (
    <CrmCard title={h.title} testId="pulse-highlights" foot={<Link href={h.seeAllHref}>{h.seeAll}</Link>}>
      {eventsError && !rows ? (
        <ReadFailure what={h.loadError} error={eventsError} inset />
      ) : rows === null ? (
        <div className="crm-stack" style={{ padding: 16 }}>
          <SkeletonLine />
          <SkeletonLine width="80%" />
          <SkeletonLine width="60%" />
        </div>
      ) : rows.length === 0 ? (
        <p className="crm-empty">{h.empty}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {rows.map((event) => {
            const milestone = readMilestone(event);
            const facts = milestone
              ? [milestoneProgressText(milestone), milestoneRankLine(milestone) ?? milestoneRepsLine(milestone)].filter(Boolean).join(" · ")
              : dailyOperationsCardFacts(event).join(" · ");
            const link = milestone ? milestoneLinks(milestone)[0] : dailyOperationsEventLinks(event)[0];
            return (
              <li key={event.event_id} data-kind={event.kind} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--crm-divider)] px-4 py-2 first:border-t-0">
                <time dateTime={event.occurred_at} className="crm-text-muted crm-small tabular-nums">
                  {formatTime(milestone ? milestone.reachedAt : event.occurred_at)}
                </time>
                <Pill variant={pillVariant(event)} icon={milestone ? Star : undefined}>
                  {dailyOperationsKindLabel(event.kind)}
                </Pill>
                <span className="min-w-0 flex-1 crm-small">
                  <span className="crm-strong">{milestone ? milestoneHeadline(milestone) : dailyOperationsEventTitle(event)}</span>
                  {facts ? <span className="crm-text-muted"> · {facts}</span> : null}
                </span>
                {link ? (
                  <Link href={link.href} className="crm-link crm-small">
                    {link.label}
                  </Link>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </CrmCard>
  );
}

function RepRow({ row, goalReachedAt }: { row: SalesOutreachDailyCallGoalRow; goalReachedAt?: string }) {
  const hasGoal = row.goal_state === "goal";
  const overdue = cadenceMetricText(row.overdue_leads);
  const r = todayCopy.reps;
  return (
    <tr data-agent={row.agent_id}>
      <th scope="row">
        <Person name={row.agent_name} fallback={r.unknownRep} />
        {goalReachedAt ? (
          <div>
            <Pill variant="gold" icon={Star}>
              {todayCopy.milestones.goalReached(formatTime(goalReachedAt))}
            </Pill>
          </div>
        ) : null}
      </th>
      <td className="crm-nowrap">{repGoalText(row)}</td>
      <td style={{ minWidth: 120 }}>
        {hasGoal ? <Track progress={row.progress} done={row.goal_reached === true} label={`${row.agent_name ?? r.unknownRep}`} /> : <span className="crm-text-muted">{row.goal_label}</span>}
      </td>
      <td>
        {overdue.available ? (
          <span className={row.overdue_leads.value ? "crm-text-red crm-strong" : "crm-text-muted"}>{row.overdue_leads.value ? row.overdue_leads.value : r.noneOverdue}</span>
        ) : (
          <span className="crm-text-muted" title={overdue.reason ?? undefined}>
            —
          </span>
        )}
      </td>
    </tr>
  );
}

function RepsToday({
  team,
  teamError,
  goalReachedAt,
}: {
  team: SalesOutreachTeamDto | null | undefined;
  teamError?: unknown;
  goalReachedAt: ReadonlyMap<string, string>;
}) {
  const r = todayCopy.reps;
  const rows = team?.daily_call_goals ?? null;
  const goalsOff = team ? !team.goal_metrics_enabled || rows === null : false;
  return (
    <CrmCard title={r.title} subtitle={r.subtitle} testId="pulse-reps" foot={<Link href={r.openHref}>{r.open}</Link>}>
      {teamError && !team ? (
        <ReadFailure what={r.loadError} error={teamError} inset />
      ) : goalsOff ? (
        <p className="crm-empty">{r.unavailable}</p>
      ) : (
        <div className="crm-table-wrap">
          <table className="crm-table">
            <thead>
              <tr>
                <th scope="col">{r.columns.rep}</th>
                <th scope="col">{r.columns.calls}</th>
                <th scope="col">{r.columns.progress}</th>
                <th scope="col">{r.columns.overdue}</th>
              </tr>
            </thead>
            <tbody>
              {rows === null ? (
                [0, 1].map((index) => (
                  <tr key={index}>
                    <td colSpan={4}>
                      <SkeletonLine />
                    </td>
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="crm-text-muted">
                    {r.empty}
                  </td>
                </tr>
              ) : (
                rows.map((row) => <RepRow key={row.agent_id} row={row} goalReachedAt={goalReachedAt.get(row.agent_id)} />)
              )}
            </tbody>
          </table>
        </div>
      )}
    </CrmCard>
  );
}

function CompaniesToday({ snapshot }: { snapshot: DailyOperationsSnapshot | null }) {
  const k = todayCopy.companies;
  const rows = snapshot ? snapshot.companies.filter((row) => row.total > 0 || (row.yesterday_total ?? 0) > 0).sort((a, b) => b.total - a.total) : null;
  return (
    <CrmCard title={k.title} testId="pulse-companies" foot={k.note}>
      {rows === null ? (
        <div className="crm-stack" style={{ padding: 16 }}>
          <SkeletonLine />
          <SkeletonLine width="70%" />
        </div>
      ) : rows.length === 0 ? (
        <p className="crm-empty">{k.empty}</p>
      ) : (
        <div className="crm-table-wrap">
          <table className="crm-table">
            <thead>
              <tr>
                <th scope="col">{k.columns.company}</th>
                <th scope="col">{k.columns.form}</th>
                <th scope="col">{k.columns.call}</th>
                <th scope="col">{k.columns.total}</th>
                <th scope="col">{k.columns.yesterday}</th>
                <th scope="col">{k.columns.spend}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.source_company}>
                  <th scope="row">{sourceCompanyLabel(row.source_company)}</th>
                  <td>{row.form}</td>
                  <td>{row.call}</td>
                  <td className="crm-strong">{row.total}</td>
                  <td className="crm-text-muted">{row.yesterday_total ?? "—"}</td>
                  <td className="crm-text-muted">{k.spendCell}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </CrmCard>
  );
}

export function PulseView(props: PulseViewProps) {
  const { role, snapshot, snapshotError, events, eventsError, team, teamError, intakes, granotWaiting, nowMs } = props;
  if (role !== "owner") return null;
  const nowHour = nowMs === undefined ? undefined : dailyOperationsFloridaHour(new Date(nowMs));
  return (
    <div className="crm-stack" data-testid="today-pulse">
      {snapshotError && !snapshot ? <ReadFailure what={todayCopy.snapshotLoadError} error={snapshotError} /> : null}
      <WaitingForYou snapshot={snapshot} snapshotError={snapshotError} team={team} teamError={teamError} intakes={intakes} granotWaiting={granotWaiting} nowMs={nowMs} />
      <Tiles snapshot={snapshot} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <HourlyRhythm snapshot={snapshot} nowHour={nowHour} />
        <Highlights events={events} eventsError={eventsError} nowMs={nowMs} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <RepsToday team={team} teamError={teamError} goalReachedAt={repGoalReachedAtById(events ?? [])} />
        <CompaniesToday snapshot={snapshot} />
      </div>
    </div>
  );
}

/**
 * The Daily Operations snapshot, shared by key with the sidebar badges and the Today header chip.
 * Five-minute resync, paused while the tab is hidden; the live clock re-derives the like-hour baselines.
 */
export function useSnapshotQuery() {
  return useQuery({
    queryKey: queryKeys.dailyOperations.snapshot(),
    queryFn: fetchDailyOperationsSnapshot,
    staleTime: SNAPSHOT_RESYNC_MS,
    refetchInterval: SNAPSHOT_RESYNC_MS,
    refetchIntervalInBackground: false,
  });
}

/**
 * The newest facts across lanes, shared by key with the Team tab (its "Goal reached" marks). Forty, not twenty: the
 * Highlights keep only tier A and the milestones, so a Granot flood must not push them out of the page.
 * Once the server adds the `outreach` lane, a `lane: "outreach"` read here is the exact source for the milestones.
 */
export function usePulseEvents() {
  return useQuery({
    queryKey: queryKeys.dailyOperations.events("pulse"),
    queryFn: () => fetchDailyOperationsEvents({ limit: 40 }),
    staleTime: EVENTS_REFRESH_MS,
    refetchInterval: EVENTS_REFRESH_MS,
    refetchIntervalInBackground: false,
  });
}

/** The queries behind the Pulse. */
export function PulseTab() {
  const nowMs = useNowMs();
  const snapshotQuery = useSnapshotQuery();
  const eventsQuery = usePulseEvents();
  const team = useTeam(null, true);
  const intakeFilters = openIntakePreviewFilters("booking");
  const intakeQuery = useQuery({
    queryKey: queryKeys.granotLifecycle.cases(intakeFilters),
    queryFn: () => fetchGranotLifecycleCases(intakeFilters),
  });

  // The Granot updates runs page (doc 17), shared by key with the Automations badge and pages; nothing new is polled.
  const granotRuns = useGranotRuns(true);

  const snapshot = snapshotQuery.data ? withLiveDailyOperationsClock(normalizeDailyOperationsSnapshot(snapshotQuery.data), nowMs) : null;

  return (
    <PulseView
      role="owner"
      nowMs={nowMs}
      granotWaiting={granotRuns.data ? waitingChecks(granotRuns.data) : null}
      snapshot={snapshot}
      snapshotError={snapshotQuery.error}
      events={eventsQuery.data?.items ?? null}
      eventsError={eventsQuery.error}
      team={team.data}
      teamError={team.error}
      intakes={{
        items: intakeQuery.data?.items ?? [],
        hasMore: Boolean(intakeQuery.data?.next_cursor),
        loading: intakeQuery.isLoading,
        error: intakeQuery.error,
      }}
    />
  );
}
