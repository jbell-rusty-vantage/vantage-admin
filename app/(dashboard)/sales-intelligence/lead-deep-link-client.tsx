"use client";
/**
 * FIX-UI1 (M1): an old Lead-only analysis link resolves through `useOutreachByLead` (a `useSuspenseQuery` on the
 * browser-relative proxy URL), so it's mounted client-only like the desk; the route skeleton shows meanwhile.
 */
import dynamic from "next/dynamic";
import { DeskRouteSkeleton, type LeadDeepLinkTarget } from "@/components/sales-intelligence/desk";

const LeadDeepLinkRoot = dynamic(() => import("./lead-deep-link-root").then((m) => m.LeadDeepLinkRoot), { ssr: false, loading: () => <DeskRouteSkeleton /> });

export function LeadDeepLinkClient({ target }: { target: LeadDeepLinkTarget }) {
  return <LeadDeepLinkRoot target={target} />;
}
