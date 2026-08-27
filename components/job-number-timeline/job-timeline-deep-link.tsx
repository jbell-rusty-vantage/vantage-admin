import Link from "next/link";
import type { ReactNode } from "react";
import { buildJobTimelineHref } from "@/lib/api/jobNumberTimeline";
import { cn } from "@/lib/utils";

/**
 * Owner deep link to the typed Job Number page. URL-only — no catalog.
 * Renders plain text when the Job Number is absent.
 */
export function JobTimelineDeepLink({
  job,
  children,
  className,
}: {
  job?: string | null;
  children?: ReactNode;
  className?: string;
}) {
  const trimmed = typeof job === "string" ? job.trim() : "";
  if (!trimmed) {
    return children ?? "-";
  }
  return (
    <Link
      href={buildJobTimelineHref({ job: trimmed })}
      className={cn("font-medium text-trust-blue hover:underline", className)}
    >
      {children ?? trimmed}
    </Link>
  );
}
