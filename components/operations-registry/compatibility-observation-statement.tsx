export function CompatibilityObservationStatement({
  remainingReads,
}: {
  remainingReads: number;
}) {
  return (
    <aside className="rounded-lg border bg-background p-4" aria-label="Old static list observation">
      <h4 className="text-sm font-semibold text-navy">Old static list — observation</h4>
      <p className="mt-2 text-sm text-muted-foreground">
        {remainingReads} compatibility {remainingReads === 1 ? "read" : "reads"} used the old static
        list on the server instance that answered this check, since it last started. Other server
        instances are not counted here, so zero does not prove the list is unused. The full count
        is in the server logs.
      </p>
    </aside>
  );
}
