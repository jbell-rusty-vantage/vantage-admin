import { Suspense } from "react";
import { LeadsWorkspace } from "@/components/leads/leads-workspace";

/** Leads (doc 03): every lead from every source, newest first. Kind and duplicates are filter chips, not pages. */
export default function LeadsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading leads…</p>}>
      <LeadsWorkspace />
    </Suspense>
  );
}
