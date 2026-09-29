"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { outreachRouteHref, type OutreachTab } from "./deep-links";

/** Runs only in the browser; route tests and skeletons can render without a mounted App Router. */
export default function LegacyRedirect({ id, tab, active, siReturn }: { id: string; tab?: string | null; active: OutreachTab; siReturn: string | null }) {
  const router = useRouter();
  useEffect(() => {
    const hash = window.location.hash;
    const oldParams = new URLSearchParams(window.location.search);
    const sid = oldParams.get("sid");
    let target: OutreachTab | null = null;
    let anchor = hash;
    // A finding's relation link (`?tab=work#review-item-{id}`) keeps its row anchor; the rail opens for it.
    if (tab === "work") { target = "case"; anchor = hash.startsWith("#review-item-") ? hash : "#work"; }
    else if (hash === "#move-details" && active !== "case") target = "case";
    else if ((hash === "#conversations" || hash.startsWith("#conv-") || hash.startsWith("#si-conversation-") || !!sid) && active !== "conversations") target = "conversations";
    if (target) {
      const href = outreachRouteHref(id, { tab: target, siReturn });
      const next = new URL(href, window.location.origin);
      for (const key of ["sid", "conversation_id", "conv"]) { const value = oldParams.get(key); if (value) next.searchParams.set(key, value); }
      router.replace(next.pathname + next.search + anchor, { scroll: false });
      // App Router's replace can update the URL after already-mounted lazy regions run their effects.
      // Signal the settled anchor so Work opens on mobile and transcript targets can land.
      let attempts = 0;
      const timer = window.setInterval(() => {
        attempts += 1;
        if (window.location.pathname === next.pathname && window.location.search === next.search && window.location.hash === anchor) {
          window.dispatchEvent(new Event("hashchange"));
          window.clearInterval(timer);
        } else if (attempts >= 80) window.clearInterval(timer);
      }, 50);
    }
  }, [active, id, router, siReturn, tab]);
  return null;
}
