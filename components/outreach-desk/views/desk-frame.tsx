"use client";
/**
 * The desk frames the "Lead outreach" shell renders for Team overview, My work, Activity and Settings. A1 ships the
 * shell; the frames' reads and tables (ADM-4/5/6) land with lane A2 on the same route.
 */
import type { DeskViewer } from "../shell/desk-shell";
import type { DeskView } from "../data/desk-url";
import { deskCopy } from "../outreach-desk-copy";

export function DeskFrame({ view }: { viewer: DeskViewer; view: DeskView }) {
  return (
    <div className="od-scroll">
      <div className="od-page">
        <header className="od-header">
          <div className="od-header__titles">
            <h1 className="od-title">{deskCopy.titles[view]}</h1>
          </div>
        </header>
      </div>
    </div>
  );
}
