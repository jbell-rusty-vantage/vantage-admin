"use client";

import type { ApiFailure, ApiResponse } from "./types";

export type RegistryRemediation = NonNullable<ApiFailure["remediation"]>;

export class RegistryApiError extends Error {
  readonly status: number;
  readonly issues?: unknown;
  readonly requestId?: string;
  readonly registryCode?: string;
  readonly remediation?: RegistryRemediation;

  constructor(input: {
    message: string;
    status: number;
    issues?: unknown;
    requestId?: string;
    registryCode?: string;
    remediation?: RegistryApiError["remediation"];
  }) {
    super(input.message);
    this.name = "RegistryApiError";
    this.status = input.status;
    this.issues = input.issues;
    this.requestId = input.requestId;
    this.registryCode = input.registryCode;
    this.remediation = input.remediation;
  }
}

export function proxyUrl(path: string): string {
  const normalized = path.startsWith("/") ? path.slice(1) : path;
  return `/api/proxy/${normalized}`;
}

export async function registryRequestJson<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(proxyUrl(path), {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  let payload: ApiResponse<T>;
  try {
    payload = (await response.json()) as ApiResponse<T>;
  } catch {
    throw new RegistryApiError({
      message: response.statusText || "Registry request failed.",
      status: response.status,
    });
  }

  if (!response.ok || !payload.ok) {
    const failure = payload.ok
      ? undefined
      : (payload as Extract<ApiResponse<T>, { ok: false }>);
    throw new RegistryApiError({
      message: failure?.error ?? response.statusText ?? "Registry request failed.",
      status: response.status,
      issues: failure?.issues,
      requestId: failure?.request_id,
      registryCode: failure?.registry_code,
      remediation: failure?.remediation,
    });
  }

  return payload.data;
}

export function formatRegistryError(error: unknown): string {
  if (error instanceof RegistryApiError) {
    const parts = [error.message];
    if (error.registryCode) {
      parts.push(`(${error.registryCode})`);
    }
    if (error.remediation?.summary) {
      parts.push(error.remediation.summary);
    }
    if (error.requestId) {
      parts.push(`[request ${error.requestId}]`);
    }
    return parts.join(" ");
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Unexpected registry error.";
}
