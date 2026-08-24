"use client";

import { registryRequestJson } from "./registryRequest";

export type GranotLifecycleDisposition =
  | "source_scoped_lead"
  | "referral_booking"
  | "deferred";

export type GranotLeadCreatedPolicy =
  | "link_only"
  | "observation_only"
  | "create_if_missing";

export type OutboundSmsConsentBasis =
  | "not_attested"
  | "customer_submitted_form"
  | "existing_relationship";

export type GranotCrmSourceOutboundSms = {
  granot_crm_source_id: string;
  enabled: boolean;
  trigger: "granot_lead_created";
  body_template: string;
  template_version: number;
  consent_basis: OutboundSmsConsentBasis;
  daily_cap: number;
};

export type GranotCrmSourceRecentSms = {
  id: string;
  sent_at: string | null;
  status: string;
  provider_status: string | null;
  destination_masked: string;
  purpose: string;
  template_version: number | null;
};

export type GranotCrmSourceRoute = {
  route_key: string;
  lead_model: "FormLead" | "CallLead";
  move_type: "local" | "long_distance" | "any";
  source_granularity_id: string;
  source_granularity_key?: string;
  source_granularity_label?: string;
  source_granularity_status?:
    | "active"
    | "inactive"
    | "missing"
    | "wrong_channel"
    | "wrong_move_type";
};

export type GranotAutomationCompatibility = {
  granot_crm_source_id?: string;
  available_for_apply: boolean;
  status:
    | "ready"
    | "missing_reference"
    | "source_disabled"
    | "source_ambiguous"
    | "operation_not_permitted";
  issues: Array<{ code: string; message: string }>;
};

export type GranotCrmSourceItem = {
  id: string;
  granot_label: string;
  normalized_granot_label?: string;
  enabled: boolean;
  lifecycle_enabled: boolean;
  lifecycle_disposition: GranotLifecycleDisposition;
  lead_created_policy: GranotLeadCreatedPolicy | "create_if_missing";
  lead_source_company?: string;
  lead_source_company_label?: string;
  lead_source_company_status?: "active" | "inactive" | "missing";
  lifecycle_routes: GranotCrmSourceRoute[];
  lifecycle_policy_version: string;
  default_channel: "form" | "call" | "unknown";
  automation_sources: Array<{
    id: string;
    label: string;
    active: boolean;
    compatibility: GranotAutomationCompatibility;
  }>;
  outbound_sms?: GranotCrmSourceOutboundSms;
  latest_audit?: {
    id: string;
    action: string;
    actor_label: string;
    actor_role: string;
    reason?: string;
    created_at: string;
  };
};

export type GranotCrmSourceUpdateInput = {
  granot_label: string;
  default_channel?: "form" | "call" | "unknown";
  enabled?: boolean;
  notes?: string | null;
  lifecycle_enabled: boolean;
  lifecycle_disposition: GranotLifecycleDisposition;
  lead_created_policy: GranotLeadCreatedPolicy;
  lead_source_company?: string | null;
  lifecycle_routes: Array<{
    route_key: string;
    lead_model: "FormLead" | "CallLead";
    move_type: "local" | "long_distance" | "any";
    source_granularity_id: string;
  }>;
  lifecycle_policy_version?: string;
  reason: string;
};

export type GranotCrmSourceActivationInput = {
  lifecycle_enabled: boolean;
  reason: string;
};

type ListResponse<T> = { items: T[] } | T[];

function unwrapList<T>(data: ListResponse<T>): T[] {
  return Array.isArray(data) ? data : data.items;
}

export async function fetchGranotCrmSources(): Promise<GranotCrmSourceItem[]> {
  const data = await registryRequestJson<ListResponse<GranotCrmSourceItem>>(
    "api/v1/admin/granot-crm-sources",
  );
  return unwrapList(data);
}

export async function fetchGranotCrmSource(id: string): Promise<GranotCrmSourceItem> {
  return registryRequestJson<GranotCrmSourceItem>(
    `api/v1/admin/granot-crm-sources/${encodeURIComponent(id)}`,
  );
}

export async function updateGranotCrmSource(
  id: string,
  body: GranotCrmSourceUpdateInput,
): Promise<GranotCrmSourceItem> {
  return registryRequestJson<GranotCrmSourceItem>(
    `api/v1/admin/granot-crm-sources/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    },
  );
}

export async function setGranotCrmSourceOutboundSms(
  id: string,
  body: {
    enabled: boolean;
    body_template: string;
    consent_basis: OutboundSmsConsentBasis;
    daily_cap?: number;
    reason: string;
  },
): Promise<GranotCrmSourceOutboundSms> {
  return registryRequestJson<GranotCrmSourceOutboundSms>(
    `api/v1/admin/granot-crm-sources/${encodeURIComponent(id)}/outbound-sms`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    },
  );
}

export async function fetchGranotCrmSourceRecentSms(
  id: string,
): Promise<GranotCrmSourceRecentSms[]> {
  const data = await registryRequestJson<{ items: GranotCrmSourceRecentSms[] }>(
    `api/v1/admin/granot-crm-sources/${encodeURIComponent(id)}/outbound-sms/recent`,
  );
  return data.items;
}

export async function setGranotCrmSourceActivation(
  id: string,
  body: GranotCrmSourceActivationInput,
): Promise<GranotCrmSourceItem> {
  return registryRequestJson<GranotCrmSourceItem>(
    `api/v1/admin/granot-crm-sources/${encodeURIComponent(id)}/activation`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    },
  );
}
