import jwt, { type JwtPayload } from "jsonwebtoken";
import { getServerEnv } from "@/lib/env/server";
import type { AdminRole } from "@/server/models";

export type AccessTokenPayload = {
  sub: string;
  email: string;
  role: AdminRole;
};

export type RefreshTokenPayload = {
  sub: string;
  token_version: number;
};

export type VerifiedAccessToken = AccessTokenPayload & JwtPayload;
export type VerifiedRefreshToken = RefreshTokenPayload & JwtPayload;

export function signAccessToken(payload: AccessTokenPayload): string {
  const env = getServerEnv();
  return jwt.sign(payload, env.ADMIN_ACCESS_TOKEN_SECRET, {
    expiresIn: env.ADMIN_ACCESS_TOKEN_TTL_SECONDS,
  });
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  const env = getServerEnv();
  return jwt.sign(payload, env.ADMIN_REFRESH_TOKEN_SECRET, {
    expiresIn: `${env.ADMIN_REFRESH_TOKEN_TTL_DAYS}d`,
  });
}

export function verifyAccessToken(token: string): VerifiedAccessToken {
  const env = getServerEnv();
  const payload = jwt.verify(token, env.ADMIN_ACCESS_TOKEN_SECRET);
  if (!isAccessTokenPayload(payload)) {
    throw new Error("Invalid access token payload");
  }
  return payload;
}

export function verifyRefreshToken(token: string): VerifiedRefreshToken {
  const env = getServerEnv();
  const payload = jwt.verify(token, env.ADMIN_REFRESH_TOKEN_SECRET);
  if (!isRefreshTokenPayload(payload)) {
    throw new Error("Invalid refresh token payload");
  }
  return payload;
}

function isAccessTokenPayload(payload: string | JwtPayload): payload is VerifiedAccessToken {
  return (
    typeof payload !== "string" &&
    typeof payload.sub === "string" &&
    typeof payload.email === "string" &&
    (payload.role === "owner" || payload.role === "admin")
  );
}

function isRefreshTokenPayload(
  payload: string | JwtPayload,
): payload is VerifiedRefreshToken {
  return (
    typeof payload !== "string" &&
    typeof payload.sub === "string" &&
    typeof payload.token_version === "number"
  );
}
