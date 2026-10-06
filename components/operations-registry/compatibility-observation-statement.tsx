/**
 * The "old static list" observation, restyled on the CRM card. It sits in the Registry card of Setup → Connections &
 * health. Words kept: zero never proves the old list is unused.
 */
export function CompatibilityObservationStatement({
  remainingReads,
}: {
  remainingReads: number;
}) {
  return (
    <aside className="crm-card cn-compat" aria-label="Old static list observation">
      <h4 className="cn-compat__title">Old static list · observation</h4>
      <p className="cn-compat__body">
        {remainingReads} compatibility {remainingReads === 1 ? "read" : "reads"} used the old static
        list on the server instance that answered this check, since it last started. Other server
        instances are not counted here, so zero does not prove the list is unused. The full count
        is in the server logs.
      </p>
    </aside>
  );
}
