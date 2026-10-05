/** Mongoose-free role list so the request-boundary proxy can check roles without loading models. */
export const ADMIN_ROLES = ["owner", "admin", "manager", "rep"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === "string" && (ADMIN_ROLES as readonly string[]).includes(value);
}

/** Roles the dashboard shell and every pre-S8 caller understand. A rep and a manager are not among them. */
export const DASHBOARD_ROLES = ["owner", "admin"] as const;
export type DashboardRole = (typeof DASHBOARD_ROLES)[number];

export function isDashboardRole(value: unknown): value is DashboardRole {
  return value === "owner" || value === "admin";
}

/**
 * Sales Outreach Desk (IMPL-03, P09b): the roles that may open `/outreach-desk`. Generic `admin` is not one of them
 * (P09c): a Manager or Owner must be bound explicitly.
 */
export const OUTREACH_DESK_ROLES = ["owner", "manager", "rep"] as const;
export type OutreachDeskRole = (typeof OUTREACH_DESK_ROLES)[number];

export function isOutreachDeskRole(value: unknown): value is OutreachDeskRole {
  return value === "owner" || value === "manager" || value === "rep";
}
