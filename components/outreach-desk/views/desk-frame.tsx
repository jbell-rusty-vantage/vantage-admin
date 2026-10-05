"use client";
/**
 * The desk frame for Team overview, My work, Activity and Settings. `GET /capabilities` (always answered for a desk
 * role, even with the desk off) decides what may load: with the desk unavailable, every frame shows why and the
 * Owner keeps Settings, so a disable stays reversible. One live stream serves the mounted frame.
 *
 * A 403 on capabilities is a scope loss (role changed, Rep link lost): every cached desk read is dropped.
 */
import Link from "next/link";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CircleOff, Link2Off, RefreshCw } from "lucide-react";
import { isSalesOutreachApiError } from "@/lib/api/salesOutreach";
import { clearOutreachDesk } from "@/lib/query/salesOutreach";
import { useDeskLive } from "../data/use-desk-live";
import { useCapabilities } from "../data/use-desk-reads";
import { deskViewHref, type DeskView } from "../data/desk-url";
import type { DeskViewer } from "../shell/desk-shell";
import { deskCopy } from "../outreach-desk-copy";
import { DeskHeader, Notice, SkeletonLine } from "../primitives";
import { ActivityView } from "./activity-view";
import { MyView } from "./my-view";
import { SettingsView } from "./settings-view";
import { TeamView } from "./team-view";

const u = deskCopy.unavailable;

function FrameSkeleton({ view }: { view: DeskView }) {
  return (
    <div className="od-scroll">
      <div className="od-page" aria-busy="true">
        <DeskHeader title={deskCopy.titles[view]} subtitle={null} />
        <div className="od-summary-row">
          {[0, 1, 2, 3].map((index) => (
            <section key={index} className="od-card od-summary">
              <SkeletonLine width={46} height={46} />
              <div className="od-summary__body">
                <SkeletonLine width="60%" />
                <SkeletonLine width="40%" height={22} />
              </div>
            </section>
          ))}
        </div>
        <SkeletonLine height={220} />
      </div>
    </div>
  );
}

export function DeskFrame({ viewer, view }: { viewer: DeskViewer; view: DeskView }) {
  const queryClient = useQueryClient();
  const capabilities = useCapabilities();
  const data = capabilities.data;
  const error = capabilities.error;
  const scopeLost = isSalesOutreachApiError(error) && error.status === 403;
  useEffect(() => {
    if (scopeLost) clearOutreachDesk(queryClient);
  }, [scopeLost, queryClient]);
  useDeskLive(Boolean(data?.desk_available));

  if (!data) {
    if (!error) return <FrameSkeleton view={view} />;
    const notLinked = isSalesOutreachApiError(error) && error.code === "REP_NOT_LINKED";
    return (
      <div className="od-scroll">
        <div className="od-page">
          <DeskHeader title={deskCopy.titles[view]} />
          <Notice icon={notLinked ? Link2Off : scopeLost ? CircleOff : RefreshCw} title={u.title} tone={scopeLost ? "red" : "gray"}>
            <p>{notLinked ? u.notLinked : scopeLost ? u.forbidden : u.error}</p>
            {!scopeLost ? (
              <button type="button" className="od-button" onClick={() => void capabilities.refetch()}>
                {u.retry}
              </button>
            ) : null}
          </Notice>
        </div>
      </div>
    );
  }

  if (!data.desk_available && view !== "settings") {
    const reason = data.unavailable_reason ? u[data.unavailable_reason] : null;
    return (
      <div className="od-scroll">
        <div className="od-page">
          <DeskHeader title={deskCopy.titles[view]} />
          <Notice icon={CircleOff} title={u.title}>
            <p>{reason}</p>
            {viewer.role === "owner" ? (
              <Link className="od-button" href={deskViewHref("settings")}>
                {u.ownerSettings}
              </Link>
            ) : null}
          </Notice>
        </div>
      </div>
    );
  }

  switch (view) {
    case "team":
      return <TeamView viewer={viewer} capabilities={data} />;
    case "my":
      return <MyView viewer={viewer} capabilities={data} />;
    case "activity":
      return <ActivityView viewer={viewer} capabilities={data} />;
    case "settings":
      return <SettingsView viewer={viewer} capabilities={data} />;
    default:
      return null;
  }
}
