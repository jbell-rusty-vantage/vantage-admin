import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "./cookies";

export const DASHBOARD_PATH_PREFIXES = [
  "/",
  "/form-leads",
  "/call-leads",
  "/bookings",
  "/cancellations",
  "/customers",
  "/agents",
  "/analytics",
  "/audit-log",
  "/exports",
  "/settings",
] as const;

export function shouldProtectPath(pathname: string): boolean {
  if (pathname === "/login" || pathname.startsWith("/api/")) {
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
