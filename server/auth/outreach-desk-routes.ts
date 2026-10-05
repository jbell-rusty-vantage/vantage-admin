import type { VantageApiMethod } from "@/server/vantage-api/client";

/**
 * Sales Outreach Desk BFF allowlists (ADM-7): the exact method + path a Rep or a Manager may send through the proxy,
 * copied from the server's consolidated Admin DTO handoff (server `docs/sales-outreach-desk/workspace/evidence/S1.md`,
 * "Admin DTO handoff"). The Owner reaches everything; a generic Admin reaches none of it (P09c). The server still
 * scopes every call (a Rep's own assignment, a Manager's prospective-only day override), so these lists only narrow.
 *
 * Paths are judged after `normalizeProxyPath` (query dropped, dot segments resolved), so a pattern is anchored on the
 * bare pathname.
 */
export type DeskProxyRoute = { method: VantageApiMethod; pattern: RegExp };

export const OUTREACH_DESK_API = "/api/v1/admin/sales-outreach";
export const DAILY_OPERATIONS_API = "/api/v1/admin/daily-operations";
const ID = "[a-f\\d]{24}";

const desk = (method: VantageApiMethod, path: string): DeskProxyRoute => ({
  method,
  pattern: new RegExp(`^${OUTREACH_DESK_API}/${path}$`),
});

/** Live hints travel through `app/api/outreach-desk-live`, never the buffered generic proxy. */
export const OUTREACH_DESK_LIVE_API_PATH = `${OUTREACH_DESK_API}/live`;

export const REP_OUTREACH_ROUTES: readonly DeskProxyRoute[] = [
  desk("GET", "capabilities"),
  desk("GET", "rep-days"),
  desk("GET", "queue"),
  desk("GET", `outreach/${ID}`),
  desk("GET", "live"),
  desk("PATCH", `outreach/${ID}/quoted-followup`),
  desk("PATCH", `outreach/${ID}/callback`),
];

export const MANAGER_OUTREACH_ROUTES: readonly DeskProxyRoute[] = [
  ...REP_OUTREACH_ROUTES,
  desk("GET", "team"),
  desk("PATCH", `outreach/${ID}/assignment`),
  desk("PATCH", `goals/${ID}/day-override`),
];

/** P09b: a Manager opens Daily Operations (snapshot, events, live). `POST /rebuild` stays Owner-only. */
export const MANAGER_DAILY_OPERATIONS_ROUTES: readonly DeskProxyRoute[] = [
  { method: "GET", pattern: new RegExp(`^${DAILY_OPERATIONS_API}$`) },
  { method: "GET", pattern: new RegExp(`^${DAILY_OPERATIONS_API}/events$`) },
  { method: "GET", pattern: new RegExp(`^${DAILY_OPERATIONS_API}/live$`) },
];

export const isOutreachDeskApiPath = (path: string): boolean =>
  path === OUTREACH_DESK_API || path.startsWith(`${OUTREACH_DESK_API}/`);

export function matchesDeskRoute(routes: readonly DeskProxyRoute[], method: VantageApiMethod, path: string): boolean {
  return routes.some((route) => route.method === method && route.pattern.test(path));
}
