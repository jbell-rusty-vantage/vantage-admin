/**
 * UI1-DESK (final spec §5.7, UI-1 §1.2 item 4): the stale-list banner when the list response says `data.stale`.
 * `{t}` is the response's `as_of`, the time of the last successful list.
 */
import { TimeText } from "../primitives";
import { copy } from "../sales-intelligence-copy";

export function StaleBanner({ asOf }: { asOf: string }) {
  const s = copy.ui1.desk.stale;
  return (
    <p className="si-desk__stale" role="status" data-stale>
      {s.lead} <TimeText t={asOf} asOf={asOf} mode="exact" />. {s.tail}
    </p>
  );
}
