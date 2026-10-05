"use client";
/**
 * Numbers and RingCentral Accounts (Owner only), now two frames of the Outreach Desk (`/outreach-desk?view=numbers`
 * and `?view=accounts`, IMPL-02), moved unchanged. The desk sidebar picks the frame, so there is no view bar here;
 * the header keeps the frame's title, the Numbers search and the live indicator. Every read is a retained Numbers /
 * attachment / coverage / Accounts read; no Outreach, Attention, Closed, Overview or analysis read is mounted. Search,
 * filters, sort, page and the open Number all live in the URL (`data/url-state.ts`).
 */
import { Reps } from "../reps";
import { NumbersView } from "../numbers";
import { useSiUrlState } from "../data/use-url-state";
import { copy } from "../sales-intelligence-copy";
import { PageHeader } from "./page-header";
import "../styles/sales-intelligence.css";

export function Desk() {
  const { state, update, isPending } = useSiUrlState();
  const onSearch = (q: string | null) => update(state.view === "numbers" || q === null ? { q } : { view: "numbers", q });
  return (
    <div className="si-root si-desk">
      <header className="si-desk__header">
        <PageHeader q={state.q} onSearch={onSearch} title={copy.page.views[state.view]} />
      </header>
      <div className="si-desk__content">
        {state.view === "reps"
          ? <Reps directoryCursor={state.directory_cursor} onDirectoryCursor={(cursor) => update({ directory_cursor: cursor })} />
          : <NumbersView state={state} update={update} pending={isPending} />}
      </div>
    </div>
  );
}
