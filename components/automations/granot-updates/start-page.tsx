"use client";
/**
 * The Granot updates start page (doc 17, "The start page"): what is waiting for the Owner, the new-check card (step
 * ① Choose) and History. Reads and polling come only from the shared hooks; starting a check is the one write.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BellRing } from "lucide-react";
import { useNowMs } from "@/components/daily/use-now";
import { Notice, PageHeader } from "@/components/ui/crm/primitives";
import type { GranotRun } from "@/lib/api/granotAutomation";
import { expiresInWords, waitingChecks, windowWords, type CheckChoices, type HistoryFilter } from "@/lib/automations/granot-updates-model";
import { granotCheckHref } from "@/lib/automations/granot-updates-redirects";
import { queryKeys } from "@/lib/query/keys";
import { GRANOT_UPDATES_COPY } from "./granot-updates-copy";
import { HistoryCard } from "./start-history";
import { NewCheckCard } from "./start-new-check";
import { GRANOT_RUNS_LIMIT, startGranotCheck, useGranotNames, useGranotRuns, useGranotSources, useTodayKey } from "./use-granot-updates";

const COPY = GRANOT_UPDATES_COPY;

function HowItWorks() {
  const blocks = [COPY.howItWorks.whatItDoes, COPY.howItWorks.whatItNeverDoes, COPY.howItWorks.whenToRun, COPY.howItWorks.whatToSkip];
  return (
    <div className="gu-start-help">
      {blocks.map((block) => (
        <div key={block.title}>
          <p className="crm-strong">{block.title}</p>
          <p className="crm-small">{block.body}</p>
        </div>
      ))}
    </div>
  );
}

/** The Waiting for you notice: the newest check that needs approval, with a Review link; hidden when none waits. */
export function WaitingNotice({ runs, todayKey, nowMs }: { runs: readonly GranotRun[] | undefined; todayKey: string; nowMs: number | undefined }) {
  const waiting = waitingChecks(runs ?? []);
  const check = waiting[0];
  if (!check) return null;
  const expires = nowMs === undefined ? null : expiresInWords(check.expires_at, nowMs);
  const parts = [windowWords(check.from, check.to, todayKey), COPY.waiting.ready(check.buckets.ready)];
  if (expires) parts.push(COPY.waiting.expires(expires));
  return (
    <Notice icon={BellRing} tone="amber" title={COPY.waiting.title} testId="granot-waiting">
      <p className="gu-start-waiting">
        <span>{parts.join(" · ")}</span>
        <Link className="crm-button crm-button--primary crm-button--sm" href={granotCheckHref(check.id)}>
          {COPY.waiting.review}
        </Link>
      </p>
      {waiting.length > 1 ? <p className="crm-small crm-text-muted">{COPY.waiting.more(waiting.length - 1)}</p> : null}
    </Notice>
  );
}

export function GranotUpdatesStartPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const runs = useGranotRuns();
  const sources = useGranotSources();
  const names = useGranotNames();
  const todayKey = useTodayKey();
  const nowMs = useNowMs();
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const [page, setPage] = useState(1);

  const start = useMutation({
    mutationFn: (choices: CheckChoices) => startGranotCheck(choices, sources.data ?? []),
    onSuccess: async (group) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.granotAutomation.runsPage(GRANOT_RUNS_LIMIT) });
      const id = group.run_group_id || group.runs[0]?.run_id;
      if (id) router.push(granotCheckHref(id));
    },
  });

  return (
    <div className="crm-page" data-testid="granot-updates-start">
      <div className="crm-stack">
        <PageHeader title={COPY.title} subtitle={COPY.purpose} help={<HowItWorks />} />
        <WaitingNotice runs={runs.data} todayKey={todayKey} nowMs={nowMs} />
        <NewCheckCard
          sources={sources}
          names={names}
          runs={runs.data}
          todayKey={todayKey}
          nowMs={nowMs}
          submitting={start.isPending}
          error={start.error}
          onStart={(choices) => start.mutate(choices)}
        />
        <HistoryCard
          runs={runs.data}
          filter={filter}
          onFilter={(next) => {
            setFilter(next);
            setPage(1);
          }}
          page={page}
          onLoadMore={() => setPage((current) => current + 1)}
          todayKey={todayKey}
          loading={runs.isLoading}
          error={runs.error}
        />
      </div>
    </div>
  );
}
