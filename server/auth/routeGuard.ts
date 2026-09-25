import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { canAccessDashboardPath } from "./authorization";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "./cookies";
import { verifyAccessToken } from "./tokens";

/** Public pages required for Twilio A2P campaign registration (no auth). */
export const PUBLIC_LEGAL_PATHS = ["/privacy-policy", "/terms-and-conditions"] as const;
export const PUBLIC_APP_PATHS = ["/employee-booking"] as const;

export const DASHBOARD_PATH_PREFIXES = [
  "/",
  "/form-leads",
  "/duplicate-form-leads",
  "/call-leads",
  "/duplicate-call-leads",
  "/bookings",
  "/cancellations",
  "/intakes",
  "/sales-intelligence",
  "/conversations",
  "/manual",
  "/extension",
  "/job-timeline",
  "/customers",
  "/agents",
  "/search",
  "/analytics",
  "/observational",
  "/operations-registry",
  "/audit-log",
  "/exports",
  "/settings",
  "/testimonials",
  "/reports",
  "/reporting",
  "/ingestion",
] as const;

/** Public set-password page for an invite link (page itself is Team 2's U8). */
export const ACCEPT_INVITE_PAGE = "/accept-invite";

/**
 * The files in `public/` (served at the site root) plus the App Router icon.
 * Exact paths, not an extension pattern: a dynamic page segment such as
 * `/customers/x.png` must not pass as an asset (V-T3 M11).
 * `routeGuard.test.ts` keeps this list equal to the `public/` folder.
 */
export const PUBLIC_ASSET_PATHS: ReadonlySet<string> = new Set([
  "/favicon.ico",
  "/file.svg",
  "/globe.svg",
  "/next.svg",
  "/vercel.svg",
  "/window.svg",
  "/vantage/vantagelogo.png",
]);

/** Next build output and the exact public assets: never gated by role. */
function isStaticAssetPath(pathname: string): boolean {
  return pathname.startsWith("/_next/") || PUBLIC_ASSET_PATHS.has(pathname);
}

/** Pages that never need a session: login, the API, public and legal pages, static assets. */
function isSessionFreePath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname.startsWith("/api/") ||
    isStaticAssetPath(pathname) ||
    [...PUBLIC_APP_PATHS, ...PUBLIC_LEGAL_PATHS, ACCEPT_INVITE_PAGE].some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    )
  );
}

export function shouldProtectPath(pathname: string): boolean {
  if (
    pathname === "/login" ||
    pathname.startsWith("/api/") ||
    PUBLIC_APP_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`)) ||
    PUBLIC_LEGAL_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
  ) {
    return false;
  }

  if (
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname.match(/\.(?:svg|png|jpg|jpeg|gif|webp|ico)$/)
  ) {
    return false;
  }

  return DASHBOARD_PATH_PREFIXES.some((prefix) =>
    prefix === "/" ? pathname === "/" : pathname.startsWith(prefix),
  );
}

export function hasAuthCookie(request: Pick<NextRequest, "cookies">): boolean {
  return (
    Boolean(request.cookies.get(ACCESS_TOKEN_COOKIE)?.value) ||
    Boolean(request.cookies.get(REFRESH_TOKEN_COOKIE)?.value)
  );
}

export function applyAuthRouteGuard(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;
  const authenticated = hasAuthCookie(request);

  if (!shouldProtectPath(pathname) || authenticated) {
    return null;
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

/**
 * S8-USERS: role gate at the request boundary for roles whose pages do not
 * gate themselves. Owner and Admin keep today's behaviour (layouts and the API
 * enforce it). A verified rep is denied every page outside its allowlist
 * (`canAccessDashboardPath`), whatever the path's extension; only the
 * session-free pages and the exact static assets pass (V-T3 M11).
 *
 * An access-token cookie that can't be verified (expired, bad signature,
 * malformed) is "no session": the page redirects to /login, as the dashboard
 * layout would, instead of falling through. No access-token cookie at all is
 * left to `applyAuthRouteGuard` and the layout, as before.
 */
export function applyRoleRouteGuard(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;
  // Every page that is not session-free, including dashboard pages missing
  // from DASHBOARD_PATH_PREFIXES (for example /daily or /granot-lifecycle).
  if (isSessionFreePath(pathname)) {
    return null;
  }
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!accessToken) {
    return null;
  }
  let role: string;
  try {
    role = verifyAccessToken(accessToken).role;
  } catch {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }
  if (role === "owner" || role === "admin") {
    return null;
  }
  if (role === "rep" && canAccessDashboardPath("rep", pathname)) {
    return null;
  }
  return new NextResponse("Forbidden.", { status: 403, headers: { "content-type": "text/plain" } });
}
