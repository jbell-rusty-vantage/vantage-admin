"use client";

import { registryRequestJson } from "./registryRequest";

export type EmptySection<T> = {
  empty: boolean;
  items: T[];
};

export type FeedReadiness = {
  lead_source_active: boolean;
  feed_active: boolean;
  lead_cost: "ready" | "missing" | "invalid";
  live: boolean;
};

export type AcceptedLabelItem = {
  id: string;
  label: string;
  namespace: string;
  active: boolean;
};

export type GranotLandingItem = {
  id: string;
  name_received_from_granot: string;
  when_lead_arrives: "watch_only" | "existing_only" | "create_if_missing";
  when_lead_arrives_copy: string;
  text_state: "on" | "off" | "not_available";
  live: boolean;
  route:
    | { shape: "one_feed"; lands_in_this_feed: true }
    | {
        shape: "form_by_move_type";
        lands_in_this_feed: true;
        selection_rule: string;
        local_feed_id: string;
        long_distance_feed_id: string;
      };
};

export type InboundNumberItem = {
  id: string;
  phone_number: string;
  nickname: string;
  effective_from: string;
};

export type LeadSourceFeedProjection = {
  id: string;
  granularity_key: string;
  channel: "form" | "call";
  display_name: string;
  crm_label: string;
  move_type?: "local" | "long_distance";
  active: boolean;
  readiness: FeedReadiness;
  accepted_label_count?: number;
  granot_name_count?: number;
  inbound_number_count?: number;
  accepted_labels?: EmptySection<AcceptedLabelItem>;
  granot_names?: EmptySection<GranotLandingItem>;
  inbound_numbers?: EmptySection<InboundNumberItem>;
};

export type OwnerFinding = {
  code: string;
  severity: "blocking" | "reviewable";
  owner_message: string;
  owner_action: string;
  deep_link: string;
  scope: { lead_source_id: string; source_granularity_id?: string };
  advanced: { raw_code: string };
};

export type OwnerReadinessAction =
  | "open_lead_costs"
  | "activate_lead_source"
  | "activate_feed"
  | "switch_granot_name_live"
  | "turn_on_customer_text"
  | "connect_granot_name";

export type OwnerReadinessPlanRow = {
  gate: string;
  action: OwnerReadinessAction;
  status: "done" | "ready" | "blocked" | "suggested";
  blocked_until?: string;
};

export type LeadSourceListItem = {
  id: string;
  company_slug: string;
  name: string;
  owner_label: string;
  active: boolean;
  aliases: string[];
  sheet_config: {
    spreadsheet_id?: string;
    has_bad_tabs: boolean;
    projection_mode: "derived_import" | "direct_write";
  };
  feeds: EmptySection<LeadSourceFeedProjection>;
  blocking_finding_count: number;
};

export type LeadSourceDetail = LeadSourceListItem & {
  findings: OwnerFinding[];
  readiness_plan: OwnerReadinessPlanRow[];
  advanced: {
    raw_findings: Array<{
      code: string;
      summary: string;
      entity_type?: string;
      entity_id?: string;
    }>;
  };
};

export type LeadSourceListResult = {
  generated_at: string;
  items: LeadSourceListItem[];
};

export type LeadSourceDetailResult = LeadSourceDetail & {
  generated_at: string;
};

export type LeadSourceSetupCommand = {
  name: string;
  owner_label?: string;
  aliases?: string[];
  channel: "form" | "call";
  feed_display_name?: string;
  crm_label: string;
  move_type?: "local" | "long_distance";
  feed_aliases?: string[];
  source_sites?: string[];
  granot?: {
    name_received_from_granot: string;
    when_lead_arrives: "watch_only" | "existing_only" | "create_if_missing";
  } | null;
  reason: string;
};

export type SetupCollision = {
  field: string;
  message: string;
  existing_id?: string;
  existing_kind?: "lead_source" | "feed" | "granot_name";
  existing_name?: string;
};

export type LeadSourceSetupDerived = {
  company_slug: string;
  granularity_key: string;
  owner_label: string;
  feed_display_name: string;
  normalized_granot_label?: string;
  workspace_slug?: string;
};

export type LeadSourceSetupPreview = {
  valid: boolean;
  derived: LeadSourceSetupDerived;
  collisions: SetupCollision[];
  readiness_plan: Array<{
    gate: string;
    command: string;
    blocked_until?: string;
    suggested?: boolean;
  }>;
};

export type LeadSourceSetupResult = {
  lead_source: {
    id: string;
    company_slug: string;
    name: string;
    owner_label: string;
    active: boolean;
    aliases: string[];
  };
  feed: {
    id: string;
    granularity_key: string;
    channel: "form" | "call";
    display_name: string;
    crm_label: string;
    move_type?: "local" | "long_distance";
    active: boolean;
  };
  granot_name: {
    id: string;
    name_received_from_granot: string;
    when_lead_arrives: "watch_only" | "existing_only" | "create_if_missing";
    when_lead_arrives_copy: string;
    text_state: "off";
  } | null;
  readiness_plan: LeadSourceSetupPreview["readiness_plan"];
};

export type OwnerGranotNameCommand = {
  name_received_from_granot: string;
  handling: "our_lead_source" | "referral_booking" | "watch_only";
  lead_source_id?: string;
  destination:
    | { kind: "one_feed"; feed_id: string }
    | { kind: "form_by_move_type"; local_feed_id: string; long_distance_feed_id: string }
    | null;
  when_lead_arrives: "watch_only" | "existing_only" | "create_if_missing";
  reason: string;
};

export async function fetchLeadSources(): Promise<LeadSourceListResult> {
  return registryRequestJson<LeadSourceListResult>(
    "api/v1/admin/operations-registry/lead-sources",
  );
}

export async function fetchLeadSource(id: string): Promise<LeadSourceDetailResult> {
  return registryRequestJson<LeadSourceDetailResult>(
    `api/v1/admin/operations-registry/lead-sources/${encodeURIComponent(id)}`,
  );
}

export async function previewLeadSourceSetup(
  body: LeadSourceSetupCommand,
): Promise<LeadSourceSetupPreview> {
  return registryRequestJson<LeadSourceSetupPreview>(
    "api/v1/admin/operations-registry/lead-source-setups/preview",
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

export async function createLeadSourceSetup(
  body: LeadSourceSetupCommand,
): Promise<LeadSourceSetupResult> {
  return registryRequestJson<LeadSourceSetupResult>(
    "api/v1/admin/operations-registry/lead-source-setups",
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

export async function createGranotNameFromOwnerIntent(
  body: OwnerGranotNameCommand,
): Promise<unknown> {
  return registryRequestJson("api/v1/admin/granot-crm-sources", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
