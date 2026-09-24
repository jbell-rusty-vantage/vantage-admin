/** Mongoose-free role list so the request-boundary proxy can check roles without loading models. */
export const ADMIN_ROLES = ["owner", "admin", "rep"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === "string" && (ADMIN_ROLES as readonly string[]).includes(value);
}

/** Roles the dashboard shell and every pre-S8 caller understand. A rep is not one of them. */
export const DASHBOARD_ROLES = ["owner", "admin"] as const;
export type DashboardRole = (typeof DASHBOARD_ROLES)[number];

export function isDashboardRole(value: unknown): value is DashboardRole {
  return value === "owner" || value === "admin";
}
