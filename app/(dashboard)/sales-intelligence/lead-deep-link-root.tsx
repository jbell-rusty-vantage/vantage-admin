"use client";
import type { LeadDeepLinkTarget } from "@/components/sales-intelligence/desk";
import { LeadDeepLink } from "@/components/sales-intelligence/outreach";
import "@/components/sales-intelligence/styles/sales-intelligence.css";

/** FIX-UI1 (M1): `GET outreach/by-lead/{model}/{id}`, then `router.replace` to the route's tab, run and anchor. */
export function LeadDeepLinkRoot({ target }: { target: LeadDeepLinkTarget }) {
  return (
    <div className="si-root">
      <LeadDeepLink target={target} />
    </div>
  );
}
