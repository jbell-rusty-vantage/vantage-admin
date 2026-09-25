"use client";
/**
 * UI1-SHELL (ADMIN-REBUILD trap 5): an old analysis deep link that names only a Lead (`?lead=&lead_model=&panel=…`)
 * has no Outreach id for the server redirect. It resolves here, in the browser: `GET /outreach/by-lead/{model}/{id}`
 * (`useOutreachByLead`), then `router.replace` to the route with the matching tab, run and anchor. A 404 is the
 * route's not-found page state; any other failure is a region error with `Try again`.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Component, Suspense, useEffect, type ReactNode } from "react";
import { siKeys } from "../data/query-keys";
import { useOutreachByLead } from "../data/use-outreach";
import { RegionBoundary, SkeletonLines } from "../primitives";
import { copy } from "../sales-intelligence-copy";
import { backHref, outreachRouteHref, type DeepLinkTarget } from "./deep-links";
import { OutreachNotFound, isNotFoundError } from "./page-states";

type LeadTarget = Extract<DeepLinkTarget, { kind: "resolve-lead" }>;

/** The route a resolved Lead link goes to. */
export function leadTargetHref(target: LeadTarget, outreachId: string): string {
  return outreachRouteHref(outreachId, { tab: target.tab, run: target.run, anchor: target.anchor, siReturn: target.siReturn });
}

function Resolve({ target }: { target: LeadTarget }) {
  const router = useRouter();
  const { outreach } = useOutreachByLead(target.model, target.leadId);
  const href = leadTargetHref(target, outreach.id);
  useEffect(() => { router.replace(href); }, [router, href]);
  return <p className="si-text--sm si-text--subtle" role="status">{copy.ui1.outreach.resolvingLead}</p>;
}

export function LeadDeepLink({ target }: { target: LeadTarget }) {
  const client = useQueryClient();
  return (
    <div className="si-root si-outreach">
      <RegionBoundary name="lead-deep-link" onRetry={() => void client.resetQueries({ queryKey: siKeys.outreachByLead(target.model, target.leadId) })}>
        <Suspense fallback={<SkeletonLines lines={2} widths={["40%", "60%"]} />}>
          <ResolveOrMissing target={target} />
        </Suspense>
      </RegionBoundary>
    </div>
  );
}

/** Catches only the 404 (the page state); every other error goes on to the region boundary above. */
function ResolveOrMissing({ target }: { target: LeadTarget }) {
  return <NotFoundGate back={backHref(target.siReturn)}><Resolve target={target} /></NotFoundGate>;
}

class NotFoundGate extends Component<{ back: string; children: ReactNode }, { missing: boolean; error: unknown }> {
  state = { missing: false, error: null as unknown };
  static getDerivedStateFromError(error: unknown) {
    return { missing: isNotFoundError(error), error };
  }
  render() {
    if (this.state.missing) return <OutreachNotFound back={this.props.back} />;
    if (this.state.error) throw this.state.error;
    return this.props.children;
  }
}
