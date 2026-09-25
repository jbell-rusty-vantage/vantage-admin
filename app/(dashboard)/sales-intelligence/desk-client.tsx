"use client";
/**
 * UI1-DESK (coordinator): the desk reads through `useSuspenseQuery`, which would run during the server render and
 * `fetch` the browser-relative proxy URL there. The desk is therefore mounted client-only; the route skeleton shows meanwhile.
 */
import dynamic from "next/dynamic";
import { DeskRouteSkeleton } from "@/components/sales-intelligence/desk";

const DeskRoot = dynamic(() => import("./desk-root").then((m) => m.DeskRoot), { ssr: false, loading: () => <DeskRouteSkeleton /> });

export function DeskClient({ userId }: { userId: string | null }) {
  return <DeskRoot userId={userId} />;
}
