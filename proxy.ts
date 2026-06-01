import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { applyAuthRouteGuard } from "@/server/auth/routeGuard";

export function proxy(request: NextRequest) {
  return applyAuthRouteGuard(request) ?? NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
