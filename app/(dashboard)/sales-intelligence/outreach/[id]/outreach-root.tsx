"use client";
import { OutreachPage } from "@/components/sales-intelligence/outreach";
import { ViewerProvider } from "@/components/sales-intelligence/rep/viewer";
import type { Viewer } from "@/components/sales-intelligence/rep/viewer-session";
import "@/components/sales-intelligence/styles/sales-intelligence.css";

/** UI2-SHELL: the viewer context wraps the record page (the rep's version hides Owner controls; UI2-SCOPE). */
export function OutreachRoot({ id, tab, run, siReturn, viewer }: { id: string; tab?: string; run?: string; siReturn?: string; viewer: Viewer }) {
  return (
    <ViewerProvider viewer={viewer}>
      <div className="si-root si-route" data-viewer={viewer.role}>
        <OutreachPage id={id} tab={tab} run={run} siReturn={siReturn} />
      </div>
    </ViewerProvider>
  );
}
