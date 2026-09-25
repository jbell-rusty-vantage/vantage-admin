"use client";
/**
 * UI2-SHELL (UI-2 §1, TEAM-UI2 §4): who is looking at a Sales Intelligence page. The route files read the session role on the
 * server and pass it in; it's never read from the URL or client state. Owner is the default when no provider is mounted, so
 * every UI-1 surface (and its tests) renders the Owner's controls unchanged. UI-1 components hide an Owner control with
 * `useViewer().role === "rep"` (or `isRep`), and a rep's page never mounts a region whose read is Owner-only.
 */
import { createContext, useContext, type ReactNode } from "react";

import { OWNER_VIEWER, type Viewer } from "./viewer-session";

export { OWNER_VIEWER, viewerFromSession, type Viewer, type ViewerRole } from "./viewer-session";

const ViewerContext = createContext<Viewer>(OWNER_VIEWER);

export function ViewerProvider({ viewer, children }: { viewer: Viewer; children: ReactNode }) {
  return <ViewerContext.Provider value={viewer}>{children}</ViewerContext.Provider>;
}

export function useViewer(): Viewer {
  return useContext(ViewerContext);
}

export function useIsRep(): boolean {
  return useContext(ViewerContext).role === "rep";
}

