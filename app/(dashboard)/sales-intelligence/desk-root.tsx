"use client";
/**
 * UI1-DESK (coordinator): the client root the route page mounts. It exists so the Overview slot and the
 * side dialog's timeline preview (a render function) are wired on the client side of the RSC boundary.
 * UI2-SHELL: the viewer context wraps the page, so every UI-1 component can hide an Owner control for a rep.
 */
import { Desk } from "@/components/sales-intelligence/desk";
import { Overview } from "@/components/sales-intelligence/overview";
import { ViewerProvider } from "@/components/sales-intelligence/rep/viewer";
import type { Viewer } from "@/components/sales-intelligence/rep/viewer-session";
import { TimelinePreview } from "@/components/sales-intelligence/timeline";
import "@/components/sales-intelligence/styles/sales-intelligence.css";

export function DeskRoot({ userId, viewer }: { userId: string | null; viewer: Viewer }) {
  return (
    <ViewerProvider viewer={viewer}>
      <div className="si-root si-route" data-viewer={viewer.role}>
        <Desk userId={userId} overview={<Overview userId={userId} />} renderTimelinePreview={(outreachId) => <TimelinePreview outreachId={outreachId} />} />
      </div>
    </ViewerProvider>
  );
}
