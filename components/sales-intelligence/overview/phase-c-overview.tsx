"use client";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { ActivityOverview, OutcomesOverview, TeamOverview } from "@/lib/api/salesIntelligenceOverview";
import { useActivityOverview, useOutcomesOverview, useTeamOverview, activityOverviewKey, outcomesOverviewKey, teamOverviewKey } from "../data/use-team-overview";
import { useOverview } from "../data/use-overview";
import { siKeys } from "../data/query-keys";
import { useReportAsOf } from "../data/live";
import { useLiveHealth } from "../data/live/use-live-health";
import Link from "next/link";
import { Region, RegionProgress, SkeletonBlock, SkeletonLines } from "../primitives";
import { useIsRep } from "../rep/viewer";
import { copy } from "../sales-intelligence-copy";
import { priorityLabel } from "../desk/preset-bar";
import { formatExactFull } from "../lib/time";
import { AttentionStrip } from "./attention-strip";
import { TeamWorkload } from "./team-workload";
import { ActivityBlock } from "./activity-block";
import { OutcomesBlock } from "./outcomes-block";
import { SpendBlock } from "./spend-block";
import type { PeriodChoice } from "./period-control";

const t = copy.oi.overview;
const PRIORITIES = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "not_set"];

function PriorityControl({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const [custom, setCustom] = useState("");
  const choices = [...new Set([...PRIORITIES, ...value])];
  return <details className="si-oi-priority"><summary>{t.priority}: {value.length ? value.map(priorityLabel).join(", ") : t.all}</summary><div><button type="button" onClick={() => onChange([])} aria-pressed={value.length === 0}>{t.all}</button>{choices.map((key) => <label key={key}><input type="checkbox" checked={value.includes(key)} onChange={() => onChange(value.includes(key) ? value.filter((item) => item !== key) : [...value, key])} />{priorityLabel(key)}</label>)}<form onSubmit={(event) => { event.preventDefault(); const code = custom.trim(); if (code && !value.includes(code)) onChange([...value, code]); setCustom(""); }}><label>{t.otherCode}<input value={custom} onChange={(event) => setCustom(event.target.value)} /></label><button type="submit" disabled={!custom.trim()}>{t.add}</button></form></div></details>;
}

export function CaptureWarning({ status, rep = false }: { status: string | null; rep?: boolean }) {
  if (rep || !status || status === "ok") return null;
  return <p className="si-oi-capture" role="alert">{t.captureProblem} <Link href="/sales-intelligence?view=coverage">{t.checkCoverage}</Link></p>;
}

export function PhaseCOverviewView({ team, activity, outcomes, rep = false, activityPeriod = { key: "today", from: null, through: null }, outcomesCohort = { key: "last_7_days", from: null, through: null } }: { team: TeamOverview; activity: ActivityOverview; outcomes: OutcomesOverview; rep?: boolean; activityPeriod?: PeriodChoice; outcomesCohort?: PeriodChoice }) {
  return <div className="si-overview si-oi-overview" data-viewer={rep ? "rep" : undefined}><header className="si-oi-overview__header"><h1 className="si-heading si-heading--1">{t.title}</h1><p>{t.updated} {formatExactFull(team.as_of)}</p></header><AttentionStrip data={team} rep={rep} /><TeamWorkload data={team} rep={rep} /><ActivityBlock data={activity} value={activityPeriod} onChange={() => {}} rep={rep} /><OutcomesBlock data={outcomes} value={outcomesCohort} onChange={() => {}} rep={rep} /></div>;
}

function TeamRead({ priority, children }: { priority: string[]; children: (data: TeamOverview) => React.ReactNode }) {
  const query = useTeamOverview(priority);
  useReportAsOf(query.data.as_of);
  return <><RegionProgress active={query.isFetching} />{children(query.data.data)}</>;
}
function ActivityRead({ choice, onChange, rep }: { choice: PeriodChoice; onChange: (next: PeriodChoice) => void; rep: boolean }) {
  const query = useActivityOverview(choice.key, choice.from, choice.through);
  useReportAsOf(query.data.as_of);
  return <><RegionProgress active={query.isFetching} /><ActivityBlock data={query.data.data} value={choice} onChange={onChange} rep={rep} /></>;
}
function OutcomesRead({ choice, onChange, rep }: { choice: PeriodChoice; onChange: (next: PeriodChoice) => void; rep: boolean }) {
  const query = useOutcomesOverview(choice.key, choice.from, choice.through);
  useReportAsOf(query.data.as_of);
  return <><RegionProgress active={query.isFetching} /><OutcomesBlock data={query.data.data} value={choice} onChange={onChange} rep={rep} /></>;
}
function CostDetail({ priority }: { priority: string[] }) {
  const [open, setOpen] = useState(false);
  const client = useQueryClient();
  return <details className="si-oi-cost si-ovblock" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}><summary className="si-heading si-heading--2">{t.costDetail}</summary>{open && <Region name="overview-cost" skeleton={<SkeletonLines lines={3} />} onRetry={() => void client.resetQueries({ queryKey: siKeys.overview({ priority }) })}><CostRead priority={priority} /></Region>}</details>;
}
function CostRead({ priority }: { priority: string[] }) {
  const query = useOverview({ priority });
  return <><RegionProgress active={query.isFetching} /><SpendBlock data={query.overview} title={t.costDetail} /></>;
}

export function Overview({ userId: _userId }: { userId?: string | null }) {
  void _userId; // The Overview uses independent server reads; caller compatibility is retained for the Desk slot.
  const rep = useIsRep();
  const health = useLiveHealth({ enabled: !rep });
  const client = useQueryClient();
  const [priority, setPriority] = useState<string[]>([]);
  const [activity, setActivity] = useState<PeriodChoice>({ key: "today", from: null, through: null });
  const [cohort, setCohort] = useState<PeriodChoice>({ key: "last_7_days", from: null, through: null });
  return <div className="si-overview si-oi-overview" data-viewer={rep ? "rep" : undefined}>
    <header className="si-oi-overview__header"><h1 className="si-heading si-heading--1">{t.title}</h1><Region name="overview-updated" skeleton={<SkeletonBlock height={18} width={190} />} onRetry={() => void client.resetQueries({ queryKey: teamOverviewKey(priority) })}><TeamRead priority={priority}>{(data) => <p>{t.updated} {data.as_of ? formatExactFull(data.as_of) : t.unavailable}</p>}</TeamRead></Region></header>
    {!rep && <PriorityControl value={priority} onChange={setPriority} />}
    <CaptureWarning status={health.status} rep={rep} />
    <Region name="overview-attention" skeleton={<SkeletonBlock height={115} />} onRetry={() => void client.resetQueries({ queryKey: teamOverviewKey(priority) })}><TeamRead priority={priority}>{(data) => <AttentionStrip data={data} rep={rep} />}</TeamRead></Region>
    <Region name="overview-team" skeleton={<SkeletonBlock height={240} />} onRetry={() => void client.resetQueries({ queryKey: teamOverviewKey(priority) })}><TeamRead priority={priority}>{(data) => <TeamWorkload data={data} rep={rep} />}</TeamRead></Region>
    <Region name="overview-activity" skeleton={<SkeletonBlock height={155} />} onRetry={() => void client.resetQueries({ queryKey: activityOverviewKey(activity.key, activity.from, activity.through) })}><ActivityRead choice={activity} onChange={setActivity} rep={rep} /></Region>
    <Region name="overview-outcomes" skeleton={<SkeletonBlock height={155} />} onRetry={() => void client.resetQueries({ queryKey: outcomesOverviewKey(cohort.key, cohort.from, cohort.through) })}><OutcomesRead choice={cohort} onChange={setCohort} rep={rep} /></Region>
    {!rep && <CostDetail priority={priority} />}
  </div>;
}
