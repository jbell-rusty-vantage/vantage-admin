"use client";
/**
 * The interim Sales Intelligence page (Owner only): the header (title, Numbers search, live indicator) and two views,
 * Numbers (default) and RingCentral Accounts. Every read is a retained Numbers / attachment / coverage / Accounts read;
 * no Outreach, Attention, Closed, Overview or analysis read is mounted. View, search, filters, sort, page and the open
 * Number all live in the URL (`data/url-state.ts`).
 */
import { DelayedSkeleton, SkeletonBlock, SkeletonLines } from "../primitives";
import { Reps } from "../reps";
import { NumbersView } from "../numbers";
import { copy } from "../sales-intelligence-copy";
import { SI_VIEWS } from "../data/url-state";
import { useSiUrlState } from "../data/use-url-state";
import { PageHeader } from "./page-header";
import { ViewTabs } from "./view-tabs";
import "../styles/sales-intelligence.css";

export function Desk() {
  const { state, update, isPending, query } = useSiUrlState();
  const onSearch = (q: string | null) => update(state.view === "numbers" || q === null ? { q } : { view: "numbers", q });
  return (
    <div className="si-root si-desk">
      <header className="si-desk__header">
        <PageHeader q={state.q} onSearch={onSearch} />
        <ViewTabs active={state.view} query={query} />
      </header>
      <div className="si-desk__content">
        {state.view === "reps"
          ? <Reps directoryCursor={state.directory_cursor} onDirectoryCursor={(cursor) => update({ directory_cursor: cursor })} />
          : <NumbersView state={state} update={update} pending={isPending} />}
      </div>
    </div>
  );
}

/** The route skeleton: the page frame (title, view bar) with skeleton regions; shown after 150 ms. */
export function DeskRouteSkeleton() {
  return (
    <div className="si-root si-desk is-skeleton">
      <header className="si-desk__header">
        <div className="si-desk__titlebar">
          <h1 className="si-desk__title">{copy.page.title}</h1>
        </div>
        <nav className="si-tabs si-routetabs si-desk__views" aria-label={copy.page.viewsLabel}>
          {SI_VIEWS.map((view) => <span key={view} className="si-tab si-routetab">{copy.page.views[view]}</span>)}
        </nav>
      </header>
      <div className="si-desk__content">
        <DelayedSkeleton>
          <div className="si-desk__body">
            <SkeletonBlock height={36} width={240} />
            <SkeletonLines lines={8} />
          </div>
        </DelayedSkeleton>
      </div>
    </div>
  );
}
