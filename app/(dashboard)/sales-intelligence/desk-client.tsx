"use client";
/**
 * UI1-DESK (coordinator): the desk reads through `useSuspenseQuery`, which would run during the server render and
 * `fetch` the browser-relative proxy URL there. The desk is therefore mounted client-only; the route skeleton shows meanwhile.
 * UI2-SHELL: the viewer (Owner or rep) comes from the route's session read.
 */
import dynamic from "next/dynamic";
import { DeskRouteSkeleton } from "@/components/sales-intelligence/desk";
import type { Viewer } from "@/components/sales-intelligence/rep/viewer-session";

const DeskRoot = dynamic(() => import("./desk-root").then((m) => m.DeskRoot), { ssr: false, loading: () => <DeskRouteSkeleton /> });

export function DeskClient({ userId, viewer }: { userId: string | null; viewer: Viewer }) {
  return <DeskRoot userId={userId} viewer={viewer} />;
}
