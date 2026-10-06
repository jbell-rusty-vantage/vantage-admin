"use client";
/**
 * Automations (`/automations`, Owner only): the hub that lists the operations the Owner starts and approves. One card
 * per automation; Granot updates (doc 17) is the first. The Waiting notice and the health line read the same runs
 * page as Today, the sidebar badge and the Granot updates pages, so nothing new is polled.
 */
import Link from "next/link";
import { BellRing, Workflow } from "lucide-react";
import { useNowMs } from "@/components/daily/use-now";
import { formatAbsolute, formatRelative } from "@/components/ui/crm/format";
import { IconBadge, Notice, PageHeader, SkeletonLine } from "@/components/ui/crm/primitives";
import type { GranotRun } from "@/lib/api/granotAutomation";
import { expiresInWords, lastCheckSummary, waitingChecks, windowWords } from "@/lib/automations/granot-updates-model";
import { GRANOT_UPDATES_HREF, granotCheckHref } from "@/lib/automations/granot-updates-redirects";
import { AUTOMATIONS_COPY as copy } from "./automations-copy";
import { useGranotRuns } from "./granot-updates/use-granot-updates";

/** Pure over its props so a static-markup test can render it. */
export function AutomationsHubView({ runs, failed, nowMs }: { runs: readonly GranotRun[] | null; failed: boolean; nowMs: number | undefined }) {
  const waiting = runs ? waitingChecks(runs) : [];
  const newest = waiting[0] ?? null;
  const last = runs ? lastCheckSummary(runs) : null;
  const when = last ? formatRelative(last.check.created_at) : "";
  const g = copy.granotUpdates;
  const health = failed
    ? g.loadFailed
    : runs === null
      ? null
      : last === null
        ? g.noCheck
        : last.check.status === "awaiting"
          ? g.lastCheckWaiting(when)
          : last.check.status === "checking" || last.check.status === "applying"
            ? g.lastCheckRunning(when)
            : g.lastCheck(when, last.applied);

  return (
    <div className="crm-page crm-stack" style={{ padding: 0 }} data-testid="automations-hub">
      <PageHeader title={copy.title} subtitle={copy.purpose} help={<p>{copy.help.body}</p>} />

      {newest ? (
        <Notice icon={BellRing} tone="amber" title={copy.waiting.title} testId="automations-waiting">
          <div className="au-waiting">
            <span>{copy.waiting.line(windowWords(newest.from, newest.to), newest.buckets.ready, nowMs === undefined ? null : expiresInWords(newest.expires_at, nowMs))}</span>
            <Link href={granotCheckHref(newest.id)} className="crm-button crm-button--primary crm-button--sm">
              {copy.waiting.review}
            </Link>
          </div>
        </Notice>
      ) : null}

      <div className="au-grid">
        <Link href={GRANOT_UPDATES_HREF} className="crm-card au-card" data-testid="automation-granot-updates">
          <IconBadge icon={Workflow} tone="blue" />
          <div className="au-card__body">
            <h2 className="au-card__title">{g.title}</h2>
            <p className="au-card__purpose">{g.purpose}</p>
            <p className="au-card__health" title={last?.check.created_at ? formatAbsolute(last.check.created_at) : undefined}>
              {health === null ? <SkeletonLine width={160} /> : health}
            </p>
          </div>
          <span className="au-card__open crm-link crm-strong">{g.open} ›</span>
        </Link>
      </div>
      <p className="crm-text-muted crm-small">{copy.comingSoon}</p>
    </div>
  );
}

export function AutomationsHub() {
  const runs = useGranotRuns(true);
  const nowMs = useNowMs();
  return <AutomationsHubView runs={runs.data ?? null} failed={runs.isError} nowMs={nowMs} />;
}
