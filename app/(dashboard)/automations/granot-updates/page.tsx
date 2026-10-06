import { Suspense } from "react";
import { GranotUpdatesStartPage } from "@/components/automations/granot-updates/start-page";

/** Automations → Granot updates (doc 17 ①): start a check, see the one waiting for approval, history. */
export default function GranotUpdatesPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading Granot updates…</p>}>
      <GranotUpdatesStartPage />
    </Suspense>
  );
}
