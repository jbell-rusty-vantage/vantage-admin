import { COMPATIBILITY_OBSERVATION_WINDOW_STARTED_AT } from "@/lib/operations-registry/ownerLanguageDeck";

export function CompatibilityObservationStatement({
  remainingReads,
}: {
  remainingReads: number;
}) {
  const started = new Date(`${COMPATIBILITY_OBSERVATION_WINDOW_STARTED_AT}T00:00:00`);
  const startedLabel = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(started);
  return (
    <aside className="rounded-lg border bg-background p-4" aria-label="Old static list observation window">
      <h4 className="text-sm font-semibold text-navy">Old static list — observation window</h4>
      <p className="mt-2 text-sm text-muted-foreground">
        Observation window started {startedLabel}. {remainingReads} compatibility{" "}
        {remainingReads === 1 ? "read" : "reads"} used the old static list in this check. Removal of
        that list is blocked until this count holds at zero.
      </p>
    </aside>
  );
}
