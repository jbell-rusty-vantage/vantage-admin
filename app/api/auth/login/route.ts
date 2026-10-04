import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateAdmin, setAuthCookies } from "@/server/auth";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const INVALID_LOGIN_RESPONSE = {
  ok: false,
  error: "Invalid email or password.",
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(INVALID_LOGIN_RESPONSE, { status: 401 });
    }

    const result = await authenticateAdmin(parsed.data.email, parsed.data.password);
    if (!result) {
      return NextResponse.json(INVALID_LOGIN_RESPONSE, { status: 401 });
    }

    const response = NextResponse.json({ ok: true, data: { admin: result.admin } });
    setAuthCookies(response.cookies, result.tokens.accessToken, result.tokens.refreshToken);
    return response;
  } catch {
    return NextResponse.json({ ok: false, error: "Unable to sign in." }, { status: 500 });
  }
}
