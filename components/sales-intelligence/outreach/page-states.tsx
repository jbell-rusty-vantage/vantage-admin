/**
 * UI1-SHELL: the Outreach route's page states (final spec §11.9, UI-0 §2.4).
 * - Loading: `OutreachRouteSkeleton` — the page frame (header bar, record header skeleton, tab bar) and the
 *   Analysis tab's six section titles over skeleton lines. No spinner. It has no hooks, so the coordinator's
 *   `loading.tsx` (a server component) renders it directly.
 * - Not found: a 404 on `GET /outreach/:id` is a page state, `This Outreach doesn't exist or was removed.`, with the
 *   back link. It is not a region error.
 * - Any other failure stays in its region (`Couldn't load this.` + the code + `Try again`).
 */
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { copy } from "../sales-intelligence-copy";
import { SkeletonBlock, SkeletonLines } from "../primitives";
import { RecordHeaderSkeleton } from "./record-header";

const h = copy.ui1.outreach;

/** The six analysis section titles and their anchors, in the fixed order (final spec §11). */
export const ANALYSIS_SECTIONS = [
  { id: "situation", title: h.sections.situation },
  { id: "scores", title: h.sections.scores },
  { id: "move-details", title: h.sections.moveDetails },
  { id: "findings", title: h.sections.findings },
  { id: "conversations", title: h.sections.conversations },
  { id: "full-output", title: h.sections.fullOutput },
] as const;

/** A 404 from the detail read (`SalesIntelligenceError.status`, duck-typed). */
export function isNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { status, code } = error as { status?: unknown; code?: unknown };
  return status === 404 || code === "NOT_FOUND" || code === "OUTREACH_NOT_FOUND";
}

/** The six section titles, each over skeleton lines, with their anchors (the Analysis tab's shape while it loads). */
export function AnalysisSectionsSkeleton({ note }: { note?: string }) {
  return (
    <div className="si-outreach__analysis" data-analysis-placeholder>
      {note && <p className="si-text--sm si-text--subtle">{note}</p>}
      {ANALYSIS_SECTIONS.map((section) => (
        <section key={section.id} id={section.id} className="si-outreach__section" aria-labelledby={`${section.id}-title`}>
          <h2 id={`${section.id}-title`} className="si-heading si-heading--2">{section.title}</h2>
          <SkeletonLines lines={3} widths={["72%", "64%", "48%"]} />
        </section>
      ))}
    </div>
  );
}

/** Route-level loading (UI-0 §2.4): the frame, the header skeleton, the tab bar, then the six section titles. */
export function OutreachRouteSkeleton() {
  return (
    <div className="si-root si-outreach" data-route-skeleton>
      <div className="si-outreach__bar">
        <span className="si-outreach__back si-text--subtle">
          <ArrowLeft size={16} aria-hidden />
          {h.back}
        </span>
        <SkeletonBlock height={28} width={180} />
      </div>
      <div role="status" aria-busy="true">
        <span className="si-sr">{copy.ui1.prim.loading}</span>
        <RecordHeaderSkeleton />
      </div>
      <nav className="si-tabs si-routetabs" aria-label={h.tabsLabel}>
        {(["analysis", "timeline", "work"] as const).map((tab) => (
          <span key={tab} className={tab === "analysis" ? "si-tab si-routetab is-active" : "si-tab si-routetab"}>{h.tabs[tab]}</span>
        ))}
      </nav>
      <div className="si-outreach__body">
        <AnalysisSectionsSkeleton />
      </div>
    </div>
  );
}

/** A 404 on the detail read: a page state with the back link, not a region error. */
export function OutreachNotFound({ back }: { back: string }) {
  return (
    <div className="si-outreach__notfound" role="status" data-page-state="not-found">
      <p className="si-heading si-heading--2">{h.notFound}</p>
      <Link className="si-btn si-btn--secondary si-btn--md si-hit" href={back}>
        <ArrowLeft size={16} aria-hidden />
        {h.back}
      </Link>
    </div>
  );
}
