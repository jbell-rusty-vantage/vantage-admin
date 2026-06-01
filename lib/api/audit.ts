"use client";

import { filtersToQueryString, type SerializableFilters } from "./filters";
import type { ApiResponse, PaginatedResult } from "./types";

export type AuditLogRecord = {
  _id: string;
  timestamp: string;
  admin_email?: string;
  action: string;
  entity_type?: string;
  entity_id?: string;
  database_scope?: string;
  request_payload?: unknown;
  response_status?: number;
  ok: boolean;
  error_message?: string;
  request_id?: string;
  ip_address?: string;
  user_agent?: string;
};

export async function fetchAuditLog(filters: SerializableFilters): Promise<PaginatedResult<AuditLogRecord>> {
  const response = await fetch(`/api/audit-log${filtersToQueryString(filters)}`, {
    credentials: "include",
  });
  const payload = (await response.json()) as ApiResponse<PaginatedResult<AuditLogRecord>>;
  if (!response.ok || !payload.ok) {
    throw new Error(payload.ok ? response.statusText : payload.error);
  }
  return payload.data;
}
