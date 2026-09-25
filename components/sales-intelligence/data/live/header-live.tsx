"use client";
/**
 * UI1-LIVE: the header's live indicator (UI-0 §2.5, UX18, UX29). Opens the stream (`useLive`, so mount one per
 * page), shows the newest `as_of` on screen, amber while capture health isn't `ok`, and `Refresh` refetches every
 * active Sales Intelligence read.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { salesIntelligenceKeys } from "@/lib/query/salesIntelligence";
import { LiveIndicator } from "../../primitives";
import { captureHealthProp, useLiveHealth } from "./use-live-health";
import { useLive } from "./use-live";
import { useNewestAsOf } from "./use-newest-as-of";

export const COVERAGE_HREF = "/sales-intelligence?view=coverage";

/** UI2-SHELL: a rep passes `healthEnabled={false}` and `coverageHref={null}` (both reads and the page are Owner-only). */
export function HeaderLive({ coverageHref = COVERAGE_HREF, healthEnabled = true, className }: { coverageHref?: string | null; healthEnabled?: boolean; className?: string }) {
  const { status } = useLive();
  const health = useLiveHealth({ enabled: healthEnabled });
  const newest = useNewestAsOf();
  const client = useQueryClient();
  const refresh = useCallback(() => void client.invalidateQueries({ queryKey: salesIntelligenceKeys.all }), [client]);
  return (
    <LiveIndicator
      status={status}
      updatedAt={newest}
      asOf={newest}
      health={captureHealthProp(health)}
      coverageHref={coverageHref}
      onRefresh={refresh}
      className={className}
    />
  );
}
