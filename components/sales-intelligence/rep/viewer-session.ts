/**
 * UI2-SHELL: the viewer's shape and how a route file builds it from the session. No `"use client"`: the server route files
 * call `viewerFromSession` and pass the plain object to the client root.
 */
export type ViewerRole = "owner" | "rep";

export type Viewer = {
  role: ViewerRole;
  /** The rep's linked Agent id (the server forces the scope from the signed session; the UI only compares it for line 7). */
  agentId: string | null;
  /** The rep's Agent name when the route knows it (header line); null for the Owner. */
  agentName: string | null;
};

export const OWNER_VIEWER: Viewer = { role: "owner", agentId: null, agentName: null };

/** Builds the viewer from the session fields a route file has (role + the rep's linked Agent). */
export function viewerFromSession(session: { role: string; agent_id?: string | null }, agentName: string | null = null): Viewer {
  return session.role === "rep" ? { role: "rep", agentId: session.agent_id ?? null, agentName } : OWNER_VIEWER;
}
