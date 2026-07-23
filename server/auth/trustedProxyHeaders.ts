import type { AdminRole } from "@/server/models";

export type TrustedAdminIdentity = {
  id: string;
  email: string;
  role: AdminRole;
};

export function setTrustedAdminHeaders(headers: Headers, admin: TrustedAdminIdentity) {
  headers.set("x-vantage-admin-user-id", admin.id);
  headers.set("x-vantage-admin-email", admin.email);
  headers.set("x-vantage-admin-role", admin.role);
}
