"use client";

import type { ApiResponse } from "./types";

export type ExtensionRole = "owner" | "sales" | "customer_service" | "employee";
export type CreateExtensionRole = Exclude<ExtensionRole, "employee">;

export type AdminExtensionUser = {
  id: string;
  email: string;
  role: ExtensionRole;
  active: boolean;
  created_at: string;
  last_login_at: string | null;
};

export type CreateExtensionUserInput = {
  email: string;
  password: string;
  role: CreateExtensionRole;
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
