"use client";

import type { ApiResponse } from "./types";

export type ConversationLeadModel = "FormLead" | "CallLead";

export type ConversationCostCents = {
  stt: number;
  summary: number;
};

export type ConversationListItem = {
  id: string;
  state: string;
  direction: string;
  started_at: string;
  duration_seconds: number;
  match_method: string;
  match_confidence: string;
  normalized_job_no: string | null;
  receiver_agent_name_snapshot: string | null;
  lead_ref: { model: ConversationLeadModel; id: string } | null;
  booking_ref: string | null;
  has_transcript: boolean;
  has_summary: boolean;
  has_mismatch: boolean;
  cost_cents: ConversationCostCents | null;
};

export type ConversationSummarySections = {
  overview: string | null;
  customer_wanted: string | null;
  money_dates: string | null;
  outcome: string | null;
  promised: string | null;
  mismatch: string | null;
};

export type ConversationDetail = ConversationListItem & {
  rc_result: string;
  telephony_session_id: string | null;
  call_log_id: string;
  from_phone_masked: string;
  to_phone_masked: string;
  match_evidence: Record<string, unknown> | null;
  media: {
    blob_pathname: string | null;
    bytes: number | null;
    content_type: string | null;
    stored_at: string | null;
    purged_at: string | null;
  } | null;
  transcript: {
    text: string;
    model: string;
    chars: number;
    redactions: number;
    created_at: string;
  } | null;
  summary: {
    text: string;
    model: string;
    prompt_version: string;
    created_at: string;
    sections: ConversationSummarySections;
  } | null;
};

export type ConversationAudioUrl = {
  url: string;
  expires_at: string;
  ttl_ms: number;
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

export function fetchConversations(): Promise<ConversationListItem[]> {
  return requestJson(proxyUrl("api/v1/admin/conversations"));
}

export function fetchConversation(id: string): Promise<ConversationDetail> {
  return requestJson(proxyUrl(`api/v1/admin/conversations/${id}`));
}

export function fetchConversationAudioUrl(id: string): Promise<ConversationAudioUrl> {
  return requestJson(proxyUrl(`api/v1/admin/conversations/${id}/audio-url`));
}
