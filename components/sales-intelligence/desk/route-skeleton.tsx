"use client";
/**
 * The route loading skeletons, kept apart from `desk.tsx` (which imports the stylesheet, which node cannot load) so a
 * node test can render them. `loading.tsx` picks one by `skeletonRole()`: the Owner desk frame only for an Owner token.
 */
import { DelayedSkeleton, SkeletonBlock, SkeletonLines } from "../primitives";
import { copy } from "../sales-intelligence-copy";
import { SI_VIEWS } from "../data/url-state";

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

/** A frame-free route skeleton for anyone but the Owner (a Rep before the not-available page, an Admin before the redirect). */
export function NeutralRouteSkeleton() {
  return (
    <div className="si-root si-route is-skeleton">
      <DelayedSkeleton>
        <div className="si-desk__body">
          <SkeletonLines lines={4} />
        </div>
      </DelayedSkeleton>
    </div>
  );
}

/** The route loading fallback: the Owner desk frame only for an Owner token (`skeletonRole()`), else the neutral one. */
export function SiRouteSkeleton({ role }: { role: "owner" | "neutral" }) {
  return role === "owner" ? <DeskRouteSkeleton /> : <NeutralRouteSkeleton />;
}
