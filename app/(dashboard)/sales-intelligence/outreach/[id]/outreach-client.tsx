"use client";
/**
 * UI1-SHELL (coordinator): the Outreach route reads through `useSuspenseQuery`, so it's mounted client-only
 * (the proxy URL is browser-relative); the route skeleton shows meanwhile. Analysis and Timeline are the
 * page's own slots (UI1-TOP…CONV fill `analysis`; the timeline is mounted by the page itself).
 */
import dynamic from "next/dynamic";
import { OutreachRouteSkeleton } from "@/components/sales-intelligence/outreach";
import type { Viewer } from "@/components/sales-intelligence/rep/viewer-session";

const OutreachRoot = dynamic(() => import("./outreach-root").then((m) => m.OutreachRoot), { ssr: false, loading: () => <OutreachRouteSkeleton /> });

export function OutreachClient(props: { id: string; tab?: string; run?: string; siReturn?: string; viewer: Viewer }) {
  return <OutreachRoot {...props} />;
}
