import mongoose from "mongoose";
import { connectAdminMongo } from "@/lib/db/adminMongo";
import { AdminAuditLog } from "@/server/models";
import type { RequestMetadata } from "@/server/auth";

const REDACTED_KEYS = new Set([
  "password",
  "password_hash",
  "token",
  "accessToken",
  "refreshToken",
  "authorization",
  "cookie",
]);

export type AuditAction =
  | "login_success"
  | "login_failure"
  | "logout"
  | "token_refresh"
  | "token_refresh_failure";

export type AuditLogInput = RequestMetadata & {
  admin_user_id?: string;
  admin_email?: string;
  action: AuditAction | string;
  entity_type?: string;
  entity_id?: string;
  database_scope?: string;
  request_payload?: unknown;
  response_status?: number;
  ok: boolean;
  error_message?: string;
  request_id?: string;
};

export async function writeAuditLog(input: AuditLogInput): Promise<void> {
  await connectAdminMongo();

  await AdminAuditLog.create({
    timestamp: new Date(),
    admin_user_id:
      input.admin_user_id && mongoose.Types.ObjectId.isValid(input.admin_user_id)
        ? input.admin_user_id
        : undefined,
    admin_email: input.admin_email?.trim().toLowerCase(),
    action: input.action,
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    database_scope: input.database_scope,
    request_payload: redactPayload(input.request_payload),
    response_status: input.response_status,
    ok: input.ok,
    error_message: input.error_message,
    request_id: input.request_id,
    ip_address: input.ip_address,
    user_agent: input.user_agent,
  });
}

export function redactPayload(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactPayload(item));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => [
      key,
      REDACTED_KEYS.has(key) ? "[redacted]" : redactPayload(nestedValue),
    ]),
  );
}
