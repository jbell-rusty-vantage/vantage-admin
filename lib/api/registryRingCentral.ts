"use client";

import { registryRequestJson } from "./registryRequest";

export type RingCentralValidationStatus = "unvalidated" | "valid" | "invalid";

export type RingCentralRouteAssignment = {
  id: string;
  route_id: string;
  source_company_id: string;
  source_granularity_id: string;
  effective_from: string;
  effective_until?: string;
  active: boolean;
  change_reason?: string;
};

export type RingCentralRoute = {
  id: string;
  provider: "ringcentral";
  phone_number: string;
  phone_locked: boolean;
  display_label: string;
  active: boolean;
  ever_activated: boolean;
  archived_at?: string;
  deactivation_reason?: string;
  ringcentral_phone_number_id?: string;
  ringcentral_extension_id?: string;
  ringcentral_queue_id?: string;
  ringcentral_queue_name?: string;
  observed_target_names: string[];
  validation_status: RingCentralValidationStatus;
  validation_code?: string;
  validation_message?: string;
  validated_at?: string;
  last_seen_in_call_log_at?: string;
  last_seen_in_webhook_at?: string;
  created_from: string;
  current_assignment?: RingCentralRouteAssignment;
  assignment_history?: RingCentralRouteAssignment[];
};

export type RingCentralRouteDependencies = {
  route_id: string;
  active_assignment_count: number;
  assignment_history_count: number;
  call_lead_count: number;
  can_deactivate: boolean;
};

export type RingCentralRouteCreateInput = {
  phone_number: string;
  display_label: string;
  created_from?: string;
  reason?: string;
};

export type RingCentralRouteUpdateInput = {
  phone_number?: string;
  display_label?: string;
  reason?: string;
};

export type RingCentralRouteAssignmentInput = {
  source_granularity_id: string;
  reason?: string;
};

export type RingCentralRouteReasonInput = {
  reason?: string;
};

export type RingCentralRouteListOptions = {
  includeInactive?: boolean;
  includeHistory?: boolean;
};

/** UI lifecycle label derived from route fields (server remains authority). */
export type RingCentralRouteUiState =
  | "draft_unvalidated"
  | "validation_unavailable"
  | "invalid"
  | "valid_inactive"
  | "valid_active";

const UNAVAILABLE_CODE = "RINGCENTRAL_VALIDATION_UNAVAILABLE";

export function deriveRingCentralRouteUiState(route: RingCentralRoute): RingCentralRouteUiState {
  if (route.validation_code === UNAVAILABLE_CODE && route.validation_status !== "valid") {
    return "validation_unavailable";
  }
  if (route.validation_status === "invalid") {
    return "invalid";
  }
  if (route.validation_status === "valid" && route.active) {
    return "valid_active";
  }
  if (route.validation_status === "valid") {
    return "valid_inactive";
  }
  return "draft_unvalidated";
}

export function canActivateRingCentralRoute(route: RingCentralRoute): boolean {
  return route.validation_status === "valid" && !route.active;
}

export function canReassignRingCentralRoute(route: RingCentralRoute): boolean {
  return route.active === true && Boolean(route.current_assignment);
}

export function isPhoneEditable(route: RingCentralRoute): boolean {
  return !route.phone_locked && !route.ever_activated;
}

export function ringCentralRouteUiLabel(state: RingCentralRouteUiState): string {
  switch (state) {
    case "draft_unvalidated":
      return "Draft / unvalidated";
    case "validation_unavailable":
      return "Validation unavailable";
    case "invalid":
      return "Invalid";
    case "valid_inactive":
      return "Valid / inactive";
    case "valid_active":
      return "Valid / active";
  }
}

function listSearch(options: RingCentralRouteListOptions): string {
  const params = new URLSearchParams();
  if (options.includeInactive) params.set("include_inactive", "true");
  if (options.includeHistory) params.set("include_history", "true");
  const search = params.toString();
  return search ? `?${search}` : "";
}

export async function fetchRingCentralRoutes(
  options: RingCentralRouteListOptions = {},
): Promise<RingCentralRoute[]> {
  const data = await registryRequestJson<RingCentralRoute[] | { items: RingCentralRoute[] }>(
    `api/v1/admin/ringcentral/inbound-routes${listSearch(options)}`,
  );
  return Array.isArray(data) ? data : data.items;
}

export async function fetchRingCentralRoute(id: string): Promise<RingCentralRoute> {
  return registryRequestJson<RingCentralRoute>(
    `api/v1/admin/ringcentral/inbound-routes/${encodeURIComponent(id)}`,
  );
}

export async function createRingCentralRoute(
  body: RingCentralRouteCreateInput,
): Promise<RingCentralRoute> {
  return registryRequestJson<RingCentralRoute>("api/v1/admin/ringcentral/inbound-routes", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateRingCentralRoute(
  id: string,
  body: RingCentralRouteUpdateInput,
): Promise<RingCentralRoute> {
  return registryRequestJson<RingCentralRoute>(
    `api/v1/admin/ringcentral/inbound-routes/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    },
  );
}

export async function validateRingCentralRoute(
  id: string,
  body: RingCentralRouteReasonInput = {},
): Promise<RingCentralRoute> {
  return registryRequestJson<RingCentralRoute>(
    `api/v1/admin/ringcentral/inbound-routes/${encodeURIComponent(id)}/validate`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

export async function activateRingCentralRoute(
  id: string,
  body: RingCentralRouteAssignmentInput,
): Promise<RingCentralRoute> {
  return registryRequestJson<RingCentralRoute>(
    `api/v1/admin/ringcentral/inbound-routes/${encodeURIComponent(id)}/activate`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

export async function deactivateRingCentralRoute(
  id: string,
  body: RingCentralRouteReasonInput = {},
): Promise<RingCentralRoute> {
  return registryRequestJson<RingCentralRoute>(
    `api/v1/admin/ringcentral/inbound-routes/${encodeURIComponent(id)}/deactivate`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

export async function reassignRingCentralRoute(
  id: string,
  body: RingCentralRouteAssignmentInput,
): Promise<RingCentralRoute> {
  return registryRequestJson<RingCentralRoute>(
    `api/v1/admin/ringcentral/inbound-routes/${encodeURIComponent(id)}/reassign`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

export async function previewRingCentralRouteDependencies(
  id: string,
): Promise<RingCentralRouteDependencies> {
  return registryRequestJson<RingCentralRouteDependencies>(
    `api/v1/admin/ringcentral/inbound-routes/${encodeURIComponent(id)}/dependencies`,
  );
}
