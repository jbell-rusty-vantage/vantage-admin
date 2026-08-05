type ApiEnvelope<T> = { ok: true; data: T } | { ok: false; error: string; issues?: unknown };

const root = "/api/proxy/api/v1/admin/reporting/destinations";

export type ReportingDestinationStrategy = "replace_tab" | "snapshot";
export type ReportingDestinationAccessStatus = "verified" | "unverified" | "unhealthy";

export type ReportingDestinationArtifact = {
  id: string;
  name: string;
  url: string;
};

export type ReportingDestinationSummary = {
  id: string;
  _id?: string;
  provider: "google_sheets";
  owner_identity_snapshot: {
    stable_owner_id: string;
    masked_email: string;
  };
  folder: ReportingDestinationArtifact;
  strategy: ReportingDestinationStrategy;
  workbook?: ReportingDestinationArtifact | null;
  managed_tab?: {
    immutable_sheet_id: number;
    name: string;
    ownership_marker_version?: number;
  } | null;
  destination_type: string;
  ownership_policy: string;
  access_status: ReportingDestinationAccessStatus;
  health_verified_at?: string | null;
  denylist_checked_at?: string | null;
  capacity: {
    provider_max_cells: number;
    destination_available_cells: number;
  };
  state: "active" | "archived";
  version: number;
  snapshot_checksum?: string;
  created_at?: string;
  updated_at?: string;
};

export type CreateReportingDestinationInput = {
  strategy: ReportingDestinationStrategy;
  folder_selection_reference?: string;
  create_folder_name?: string;
  workbook_selection_reference?: string;
  create_workbook_name?: string;
  managed_tab_name?: string;
};

type WireDestination = Record<string, unknown> & {
  _id: string;
  strategy: ReportingDestinationStrategy;
  access_status: ReportingDestinationAccessStatus;
  state: "active" | "archived";
  version: number;
  folder: ReportingDestinationArtifact;
  owner_identity_snapshot: ReportingDestinationSummary["owner_identity_snapshot"];
  capacity: ReportingDestinationSummary["capacity"];
  snapshot_checksum?: string;
};

function normalizeDestination(value: WireDestination): ReportingDestinationSummary {
  return {
    id: String(value._id),
    _id: String(value._id),
    provider: "google_sheets",
    owner_identity_snapshot: value.owner_identity_snapshot,
    folder: value.folder,
    strategy: value.strategy,
    workbook: (value.workbook as ReportingDestinationArtifact | null | undefined) ?? null,
    managed_tab:
      (value.managed_tab as ReportingDestinationSummary["managed_tab"]) ?? null,
    destination_type: String(value.destination_type ?? "owner_drive"),
    ownership_policy: String(value.ownership_policy ?? "vantage_managed_tab"),
    access_status: value.access_status,
    health_verified_at:
      value.health_verified_at instanceof Date
        ? value.health_verified_at.toISOString()
        : typeof value.health_verified_at === "string"
          ? value.health_verified_at
          : null,
    denylist_checked_at:
      value.denylist_checked_at instanceof Date
        ? value.denylist_checked_at.toISOString()
        : typeof value.denylist_checked_at === "string"
          ? value.denylist_checked_at
          : null,
    capacity: value.capacity,
    state: value.state,
    version: value.version,
    snapshot_checksum:
      typeof value.snapshot_checksum === "string" ? value.snapshot_checksum : undefined,
    created_at:
      typeof value.created_at === "string"
        ? value.created_at
        : value.created_at instanceof Date
          ? value.created_at.toISOString()
          : undefined,
    updated_at:
      typeof value.updated_at === "string"
        ? value.updated_at
        : value.updated_at instanceof Date
          ? value.updated_at.toISOString()
          : undefined,
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${root}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const envelope = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || !envelope.ok) {
    throw new Error(
      envelope.ok ? `Reporting destination request failed (${response.status}).` : envelope.error,
    );
  }
  return envelope.data;
}

export const fetchReportingDestinations = (state: "active" | "archived" = "active") =>
  request<WireDestination[]>(`?state=${state}`).then((items) => items.map(normalizeDestination));

export const fetchReportingDestination = (id: string) =>
  request<WireDestination>(`/${encodeURIComponent(id)}`).then(normalizeDestination);

export const createReportingDestination = (input: CreateReportingDestinationInput) =>
  request<WireDestination>("", {
    method: "POST",
    body: JSON.stringify(input),
  }).then(normalizeDestination);

export const updateReportingDestination = (
  id: string,
  input: { expected_version: number; managed_tab_name: string },
) =>
  request<WireDestination>(`/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  }).then(normalizeDestination);

export const verifyReportingDestination = (id: string) =>
  request<WireDestination>(`/${encodeURIComponent(id)}/verify`, {
    method: "POST",
    body: JSON.stringify({}),
  }).then(normalizeDestination);

export const archiveReportingDestination = (id: string, expectedVersion: number) =>
  request<WireDestination>(`/${encodeURIComponent(id)}`, {
    method: "DELETE",
    body: JSON.stringify({ expected_version: expectedVersion }),
  }).then(normalizeDestination);

export { normalizeDestination as normalizeReportingDestination };
