import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { connectAdminMongo } from "@/lib/db/adminMongo";
import { getAccessTokenCookie, getAdminFromAccessToken } from "@/server/auth";
import { AdminAuditLog } from "@/server/models/AdminAuditLog";

async function requireAdmin() {
  const cookieStore = await cookies();
  const accessToken = getAccessTokenCookie(cookieStore);
  return accessToken ? getAdminFromAccessToken(accessToken) : null;
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const page = Math.max(Number(params.get("page") ?? 1), 1);
  const limit = Math.min(Math.max(Number(params.get("limit") ?? 50), 1), 100);
  const query: Record<string, unknown> = {};

  for (const key of ["action", "entity_type", "admin_email", "database_scope", "request_id"]) {
    const value = params.get(key);
    if (value) {
      query[key] = key === "admin_email" ? value.toLowerCase() : value;
    }
  }

  const ok = params.get("ok");
  if (ok === "true" || ok === "false") {
    query.ok = ok === "true";
  }

  const from = params.get("from");
  const to = params.get("to");
  if (from || to) {
    query.timestamp = {
      ...(from ? { $gte: new Date(from) } : {}),
      ...(to ? { $lte: new Date(to) } : {}),
    };
  }

  await connectAdminMongo();
  const [items, total] = await Promise.all([
    AdminAuditLog.find(query)
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    AdminAuditLog.countDocuments(query),
  ]);

  return NextResponse.json({
    ok: true,
    data: {
      items: items.map((item) => ({ ...item, _id: String(item._id) })),
      page,
      limit,
      total,
      has_next_page: page * limit < total,
    },
  });
}
