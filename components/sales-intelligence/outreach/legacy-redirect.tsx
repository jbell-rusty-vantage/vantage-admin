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
    if (tab === "work") { target = "case"; anchor = "#work"; }
    else if (hash === "#move-details" && active !== "case") target = "case";
    else if ((hash === "#conversations" || hash.startsWith("#conv-") || !!sid) && active !== "conversations") target = "conversations";
    if (target) {
      const href = outreachRouteHref(id, { tab: target, siReturn });
      const next = new URL(href, window.location.origin);
      for (const key of ["sid", "conversation_id", "conv"]) { const value = oldParams.get(key); if (value) next.searchParams.set(key, value); }
      router.replace(next.pathname + next.search + anchor, { scroll: false });
    }
  }, [active, id, router, siReturn, tab]);
  return null;
}
