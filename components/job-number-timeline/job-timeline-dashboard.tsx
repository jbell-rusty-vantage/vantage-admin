"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import {
  buildJobTimelineHref,
  fetchJobNumberTimeline,
  type JobTimelineAssembleResult,
} from "@/lib/api/jobNumberTimeline";
import { queryKeys } from "@/lib/query/keys";
import { GranotNavigation } from "@/components/granot-lifecycle/granot-navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedbackMessage } from "@/components/ui/feedback";
import { NewFeatureBadge } from "@/components/ui/new-badge";
import { JobNumberSearch } from "./job-number-search";
import { JobTimelineHeader } from "./job-timeline-header";
import { OwnerTimeline } from "./owner-timeline";

function isSearchableJobNumber(value: string): boolean {
  return value.trim().length > 0;
}

export function JobTimelineDashboardView({
  result,
  searched,
  loading,
  error,
}: {
  result: JobTimelineAssembleResult | undefined;
  searched: boolean;
  loading: boolean;
  error?: string;
}) {
  if (!searched) {
    return (
      <FeedbackMessage tone="info">
        Type a Job Number and search. There is no list of every Job Number.
      </FeedbackMessage>
    );
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading Job timeline…</p>;
  }

  if (error) {
    return <FeedbackMessage tone="error">{error}</FeedbackMessage>;
  }

  if (!result) {
    return null;
  }

  if (result.status === "invalid_job_number") {
    return (
      <FeedbackMessage tone="warning">
        That Job Number cannot be searched. Enter a real Job Number.
      </FeedbackMessage>
    );
  }

  if (result.status === "not_found") {
    return (
      <FeedbackMessage tone="warning">
        No Job matches that number
      </FeedbackMessage>
    );
  }

  if (result.status === "filtered_out") {
    const scopes = result.scopes
      .map((scope) => scope.owner_label || scope.source_granularity_label || scope.source_granularity_id)
      .filter(Boolean);
    return (
      <FeedbackMessage tone="warning">
        This Job is outside the requested Source Granularity
        {scopes.length > 0 ? `: ${scopes.join(", ")}` : "."}
      </FeedbackMessage>
    );
  }

  return (
    <div className="space-y-5">
      <JobTimelineHeader page={result.page} />
      {result.page.events.length === 0 ? (
        <FeedbackMessage tone="info">This Job has no owner-facing events yet.</FeedbackMessage>
      ) : (
        <OwnerTimeline events={result.page.events} />
      )}
    </div>
  );
}

export function JobTimelineDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobFromUrl = searchParams.get("job") ?? "";
  const granularityFromUrl = searchParams.get("source_granularity_id") ?? "";
  const [draftJob, setDraftJob] = useState(jobFromUrl);
  const [draftGranularity, setDraftGranularity] = useState(granularityFromUrl);

  const searched = isSearchableJobNumber(jobFromUrl);
  const query = useQuery({
    queryKey: queryKeys.jobNumberTimeline.page(jobFromUrl.trim(), {
      source_granularity_id: granularityFromUrl.trim() || undefined,
    }),
    queryFn: () =>
      fetchJobNumberTimeline({
        job_no: jobFromUrl,
        source_granularity_id: granularityFromUrl || undefined,
      }),
    enabled: searched,
  });

  const error = useMemo(() => {
    if (!query.isError) return undefined;
    return query.error instanceof Error ? query.error.message : "Unable to load that Job Number.";
  }, [query.error, query.isError]);

  function submit() {
    if (!isSearchableJobNumber(draftJob)) return;
    router.replace(
      buildJobTimelineHref({
        job: draftJob,
        source_granularity_id: draftGranularity,
      }),
    );
  }

  return (
    <div className="space-y-6">
      <GranotNavigation />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-6 w-6 text-navy" aria-hidden="true" />
            Job timeline
            <NewFeatureBadge />
          </CardTitle>
          <CardDescription>
            Type a Job Number to read the owner-facing chain — including events before the Lead had a Job Number.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <JobNumberSearch
            value={draftJob}
            granularityId={draftGranularity}
            onValueChange={setDraftJob}
            onGranularityChange={setDraftGranularity}
            onSubmit={submit}
            disabled={query.isFetching}
          />
        </CardContent>
      </Card>
      <JobTimelineDashboardView
        result={query.data}
        searched={searched}
        loading={query.isFetching}
        error={error}
      />
    </div>
  );
}
