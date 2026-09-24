import mongoose from "mongoose";
import { connectAdminMongo } from "@/lib/db/adminMongo";
import { AdminUser, type AdminRole, type AdminUserDocument } from "@/server/models";
import { isDashboardRole, type DashboardRole } from "@/server/models/adminRoles";
import { verifyPassword } from "./password";
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  type VerifiedAccessToken,
} from "./tokens";

/** A dashboard (Owner/Admin) user. Every pre-S8 caller gets this type, so a rep never reaches them. */
export type PublicAdminUser = {
  id: string;
  email: string;
  role: DashboardRole;
};

/** Any signed-in AdminUser, including a rep (S8-USERS). */
export type SessionUser = {
  id: string;
  email: string;
  role: AdminRole;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export async function authenticateAdmin(
  email: string,
  password: string,
): Promise<{ admin: SessionUser; tokens: AuthTokens } | null> {
  await connectAdminMongo();

  const normalizedEmail = normalizeEmail(email);
  const admin = await AdminUser.findOne({ email: normalizedEmail, active: true });
  if (!admin) {
    return null;
  }

  const passwordMatches = await verifyPassword(password, admin.password_hash);
  if (!passwordMatches) {
    return null;
  }

  admin.last_login_at = new Date();
  await admin.save();

  return {
    admin: toPublicAdmin(admin),
    tokens: issueTokens(admin),
  };
}

export async function refreshAdminSession(
  refreshToken: string,
): Promise<{ admin: SessionUser; tokens: AuthTokens } | null> {
  let payload: ReturnType<typeof verifyRefreshToken>;

  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    return null;
  }

  if (!mongoose.Types.ObjectId.isValid(payload.sub)) {
    return null;
  }

  await connectAdminMongo();
  const admin = await AdminUser.findOne({ _id: payload.sub, active: true });
  if (!admin || admin.token_version !== payload.token_version) {
    return null;
  }

  return {
    admin: toPublicAdmin(admin),
    tokens: issueTokens(admin),
  };
}

/**
 * Dashboard (Owner/Admin) user for an access token. A rep resolves to null here
 * (deny-by-default until S8-REP), so no existing page or API treats a rep as an
 * Admin. Use `getSessionUserFromAccessToken` where a rep must be recognised.
 */
export async function getAdminFromAccessToken(
  accessToken: string,
): Promise<PublicAdminUser | null> {
  const user = await getSessionUserFromAccessToken(accessToken);
  if (!user || !isDashboardRole(user.role)) {
    return null;
  }
  return { ...user, role: user.role };
}

export async function getSessionUserFromAccessToken(
  accessToken: string,
): Promise<SessionUser | null> {
  let payload: VerifiedAccessToken;

  try {
    payload = verifyAccessToken(accessToken);
  } catch {
    return null;
  }

  if (!mongoose.Types.ObjectId.isValid(payload.sub)) {
    return null;
  }

  await connectAdminMongo();
  const admin = await AdminUser.findOne({ _id: payload.sub, active: true });
  if (!admin) {
    return null;
  }
  // A password set, deactivation or role change increments token_version and
  // ends access tokens issued before it (tokens without the claim predate S8).
  if (payload.token_version !== undefined && payload.token_version !== admin.token_version) {
    return null;
  }

  return toPublicAdmin(admin);
}

export async function resolveAdminIdFromRefreshToken(
  refreshToken: string,
): Promise<Pick<PublicAdminUser, "id" | "email"> | null> {
  let payload: ReturnType<typeof verifyRefreshToken>;

  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    return null;
  }

  if (!mongoose.Types.ObjectId.isValid(payload.sub)) {
    return null;
  }

  await connectAdminMongo();
  const admin = await AdminUser.findById(payload.sub);
  if (!admin) {
    return null;
  }

  return { id: admin._id.toString(), email: admin.email };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function issueTokens(admin: AdminUserDocument): AuthTokens {
  const payload = {
    sub: admin._id.toString(),
    email: admin.email,
    role: admin.role,
    token_version: admin.token_version,
  };

  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken({
      sub: admin._id.toString(),
      token_version: admin.token_version,
    }),
  };
}

function toPublicAdmin(admin: AdminUserDocument): SessionUser {
  return {
    id: admin._id.toString(),
    email: admin.email,
    role: admin.role,
  };
}
