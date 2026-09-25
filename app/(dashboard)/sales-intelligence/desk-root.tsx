"use client";
/**
 * UI1-DESK (coordinator): the client root the route page mounts. It exists so the Overview slot and the
 * side dialog's timeline preview (a render function) are wired on the client side of the RSC boundary.
 */
import { Desk } from "@/components/sales-intelligence/desk";
import { Overview } from "@/components/sales-intelligence/overview";
import { TimelinePreview } from "@/components/sales-intelligence/timeline";
import "@/components/sales-intelligence/styles/sales-intelligence.css";

export function DeskRoot({ userId }: { userId: string | null }) {
  return (
    <div className="si-root">
      <Desk userId={userId} overview={<Overview userId={userId} />} renderTimelinePreview={(outreachId) => <TimelinePreview outreachId={outreachId} />} />
    </div>
  );
}
