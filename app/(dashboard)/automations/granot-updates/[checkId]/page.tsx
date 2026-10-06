import { Suspense } from "react";
import { GranotCheckPage } from "@/components/automations/granot-updates/check-page";

/**
 * The check's own page (doc 17 ② ③ ④): progress → review & approve → results, one URL whose top changes with the
 * status. `checkId` is the run group id (a single-type check is a group of one); a run id from an old link also works.
 */
export default async function GranotCheckRoute({ params }: { params: Promise<{ checkId: string }> }) {
  const { checkId } = await params;
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading the check…</p>}>
      <GranotCheckPage checkId={decodeURIComponent(checkId)} />
    </Suspense>
  );
}
