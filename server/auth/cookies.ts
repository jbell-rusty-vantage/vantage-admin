import { type ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";
import { type ResponseCookies } from "next/dist/compiled/@edge-runtime/cookies";
import { getServerEnv } from "@/lib/env/server";

export const ACCESS_TOKEN_COOKIE = "vantage_admin_access";
export const REFRESH_TOKEN_COOKIE = "vantage_admin_refresh";

type CookieStore = Pick<ReadonlyRequestCookies, "get">;
type MutableCookieStore = Pick<ResponseCookies, "set" | "delete">;

export function getAccessTokenCookie(cookieStore: CookieStore): string | null {
  return cookieStore.get(ACCESS_TOKEN_COOKIE)?.value ?? null;
}

export function getRefreshTokenCookie(cookieStore: CookieStore): string | null {
  return cookieStore.get(REFRESH_TOKEN_COOKIE)?.value ?? null;
}

export function setAuthCookies(
  cookieStore: MutableCookieStore,
  accessToken: string,
  refreshToken: string,
) {
  const env = getServerEnv();
  const secure = process.env.NODE_ENV === "production";

  cookieStore.set(ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: env.ADMIN_ACCESS_TOKEN_TTL_SECONDS,
  });

  cookieStore.set(REFRESH_TOKEN_COOKIE, refreshToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: env.ADMIN_REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60,
  });
}

export function clearAuthCookies(cookieStore: MutableCookieStore) {
  cookieStore.delete(ACCESS_TOKEN_COOKIE);
  cookieStore.delete(REFRESH_TOKEN_COOKIE);
}
