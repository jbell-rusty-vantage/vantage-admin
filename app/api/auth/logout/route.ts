import { NextResponse } from "next/server";
import { clearAuthCookies } from "@/server/auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  clearAuthCookies(response.cookies);
  return response;
}
