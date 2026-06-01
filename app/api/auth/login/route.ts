import { NextResponse } from "next/server";
import { z } from "zod";
import {
  authenticateAdmin,
  getRequestMetadata,
  normalizeEmail,
  setAuthCookies,
} from "@/server/auth";
import { writeAuditLog } from "@/server/audit";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const INVALID_LOGIN_RESPONSE = {
  ok: false,
  error: "Invalid email or password.",
};

export async function POST(request: Request) {
  const metadata = await getRequestMetadata();
  let parsedBody: z.infer<typeof loginSchema> | null = null;

  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      await writeAuditLog({
        ...metadata,
        action: "login_failure",
        request_payload: { email: typeof body?.email === "string" ? body.email : undefined },
        response_status: 401,
        ok: false,
        error_message: "Invalid login attempt.",
      });
      return NextResponse.json(INVALID_LOGIN_RESPONSE, { status: 401 });
    }

    parsedBody = parsed.data;
    const result = await authenticateAdmin(parsedBody.email, parsedBody.password);
    if (!result) {
      await writeAuditLog({
        ...metadata,
        admin_email: normalizeEmail(parsedBody.email),
        action: "login_failure",
        request_payload: { email: parsedBody.email },
        response_status: 401,
        ok: false,
        error_message: "Invalid login attempt.",
      });
      return NextResponse.json(INVALID_LOGIN_RESPONSE, { status: 401 });
    }

    const response = NextResponse.json({ ok: true, data: { admin: result.admin } });
    setAuthCookies(response.cookies, result.tokens.accessToken, result.tokens.refreshToken);

    await writeAuditLog({
      ...metadata,
      admin_user_id: result.admin.id,
      admin_email: result.admin.email,
      action: "login_success",
      request_payload: { email: result.admin.email },
      response_status: 200,
      ok: true,
    });

    return response;
  } catch (error) {
    await writeAuditLog({
      ...metadata,
      admin_email: parsedBody ? normalizeEmail(parsedBody.email) : undefined,
      action: "login_failure",
      response_status: 500,
      ok: false,
      error_message: error instanceof Error ? error.message : "Login failed.",
    });
    return NextResponse.json({ ok: false, error: "Unable to sign in." }, { status: 500 });
  }
}
