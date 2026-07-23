import { createHmac, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

export const EMPLOYEE_BOOKING_NONCE_COOKIE = "employee-booking-submission-nonce";
const NONCE_MAX_AGE_SECONDS = 30 * 60;

export function issueEmployeeBookingNonce(): string {
  return randomBytes(24).toString("base64url");
}

export function setEmployeeBookingNonceCookie(
  response: NextResponse,
  nonce: string,
  requestUrl: string,
) {
  const secure = new URL(requestUrl).protocol === "https:";
  response.cookies.set(EMPLOYEE_BOOKING_NONCE_COOKIE, nonce, {
    httpOnly: true,
    sameSite: "strict",
    secure,
    path: "/api/employee-booking",
    maxAge: NONCE_MAX_AGE_SECONDS,
  });
}

export function isAllowedEmployeeBookingOrigin(requestUrl: string, originHeader: string | null): boolean {
  if (!originHeader) {
    return false;
  }

  try {
    const expectedOrigin = new URL(requestUrl).origin;
    const suppliedOrigin = new URL(originHeader).origin;
    return expectedOrigin === suppliedOrigin;
  } catch {
    return false;
  }
}

export function byteLength(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

export function readForwardedIp(headers: Headers): string {
  const forwarded = (
    headers.get("x-vercel-forwarded-for") ??
    headers.get("x-forwarded-for") ??
    headers.get("x-real-ip")
  )
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return forwarded?.[0] ?? "unknown";
}

export function hashEmployeeBookingClientKey(input: {
  ipAddress: string;
  secret: string;
}): string {
  return createHmac("sha256", input.secret)
    .update(input.ipAddress)
    .digest("hex");
}
