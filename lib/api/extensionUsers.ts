"use client";

import { EXTENSION_COPY } from "@/components/extension/extension-copy";
import type { ApiResponse } from "./types";

export type CurrentExtensionRole = "owner" | "sales" | "customer_service";

export const CURRENT_EXTENSION_ROLES: readonly CurrentExtensionRole[] = [
  "owner",
  "sales",
  "customer_service",
];

export type AdminExtensionUser = {
  id: string;
  email: string;
  roles: CurrentExtensionRole[];
  active: boolean;
  created_at: string;
  last_login_at: string | null;
};

export type CreateExtensionUserInput = {
  email: string;
  password: string;
  roles: CurrentExtensionRole[];
};

export type UpdateExtensionUserInput = {
  email?: string;
  password?: string;
  roles?: CurrentExtensionRole[];
};

const ROLE_LABELS: Record<CurrentExtensionRole, string> = {
  owner: EXTENSION_COPY.roleOwner,
  sales: EXTENSION_COPY.roleSales,
  customer_service: EXTENSION_COPY.roleCustomerService,
};

function proxyUrl(path: string): string {
  const normalized = path.startsWith("/") ? path.slice(1) : path;
  return `/api/proxy/${normalized}`;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  let payload: ApiResponse<T> | undefined;
  try {
    payload = (await response.json()) as ApiResponse<T>;
  } catch {
    payload = undefined;
  }

  if (!response.ok || !payload || !payload.ok) {
    const rawMessage = payload && !payload.ok ? payload.error : response.statusText;
    throw new Error(rawMessage?.trim() || `Request failed (${response.status}).`);
  }

  return payload.data;
}

export function rolesSetsEqual(
  left: readonly CurrentExtensionRole[],
  right: readonly CurrentExtensionRole[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }
  const leftSet = new Set(left);
  return right.every((role) => leftSet.has(role));
}

export function formatExtensionRoleLabels(
  roles: readonly CurrentExtensionRole[] | null | undefined,
): string {
  const held = roles ?? [];
  return CURRENT_EXTENSION_ROLES.filter((role) => held.includes(role))
    .map((role) => ROLE_LABELS[role])
    .join(", ");
}

export function fetchExtensionUsers(): Promise<AdminExtensionUser[]> {
  return requestJson(proxyUrl("api/v1/admin/extension-users"));
}

export function createExtensionUser(
  input: CreateExtensionUserInput,
): Promise<AdminExtensionUser> {
  return requestJson(proxyUrl("api/v1/admin/extension-users"), {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateExtensionUser(
  id: string,
  input: UpdateExtensionUserInput,
): Promise<AdminExtensionUser> {
  const body: UpdateExtensionUserInput = {};
  if (input.email !== undefined) {
    body.email = input.email;
  }
  if (input.password !== undefined && input.password !== "") {
    body.password = input.password;
  }
  if (input.roles !== undefined) {
    body.roles = input.roles;
  }
  return requestJson(proxyUrl(`api/v1/admin/extension-users/${encodeURIComponent(id)}`), {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteExtensionUser(id: string): Promise<{ id: string }> {
  return requestJson(proxyUrl(`api/v1/admin/extension-users/${encodeURIComponent(id)}`), {
    method: "DELETE",
  });
}
