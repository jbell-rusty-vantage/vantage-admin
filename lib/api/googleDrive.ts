import { assertPickerBootstrapAllowlist } from "@/lib/google/picker";

type ApiEnvelope<T> = { ok: true; data: T } | { ok: false; error: string; issues?: unknown };

const root = "/api/proxy/api/v1/admin/google-drive";

export type GoogleDrivePublicConfig = {
  clientId: string;
  redirectUri: string;
  ownerEmailConfigured: boolean;
  exportFolderConfigured: boolean;
  pickerConfigured: boolean;
  reportingDeliveryEnabled: boolean;
};

export type GoogleDriveConnectionStatus = {
  connected: boolean;
  owner_email?: string;
  google_email?: string;
  scopes?: string[];
  connected_at?: string;
  updated_at?: string;
  last_used_at?: string;
  config: GoogleDrivePublicConfig;
};

export type GooglePickerBootstrap = {
  picker_api_key: string;
  picker_app_id: string;
  access_token: string;
  access_token_expires_at: string;
  flow: "folder" | "spreadsheet";
  views: Array<{ mime_type: string; mode: "folder" | "spreadsheet" }>;
  selection_nonce: string;
  connection_health: {
    connected: boolean;
    token_healthy: boolean;
    google_email?: string;
  };
};

export type GooglePickerVerifiedSelection = {
  selection_reference: string;
  expires_at: string;
  flow: "folder" | "spreadsheet";
  file: {
    id: string;
    name: string;
    mime_type: string;
    url: string;
    parent_folder_id?: string;
  };
};

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
      envelope.ok ? `Google Drive request failed (${response.status}).` : envelope.error,
    );
  }
  return envelope.data;
}

export const fetchGoogleDriveStatus = () =>
  request<GoogleDriveConnectionStatus>("/status");

export const beginGoogleDriveOAuth = () =>
  request<{ authorization_url: string; expires_at: string }>("/oauth/authorize", {
    method: "POST",
    body: JSON.stringify({}),
  });

export const disconnectGoogleDrive = () =>
  request<Record<string, unknown>>("/connection", { method: "DELETE" });

export const bootstrapGooglePicker = async (flow: "folder" | "spreadsheet") => {
  const bootstrap = await request<GooglePickerBootstrap>("/picker/bootstrap", {
    method: "POST",
    body: JSON.stringify({ flow }),
  });
  assertPickerBootstrapAllowlist(bootstrap as unknown as Record<string, unknown>);
  return bootstrap;
};

export const verifyGooglePickerSelection = (input: {
  selection_nonce: string;
  file_id: string;
  display_name?: string;
  display_url?: string;
  parent_folder_id?: string;
}) =>
  request<GooglePickerVerifiedSelection>("/picker/selections/verify", {
    method: "POST",
    body: JSON.stringify(input),
  });

export const createGoogleDriveFolder = (input: {
  name: string;
  parent_folder_id?: string;
}) =>
  request<{ id: string; name: string; url: string }>("/folders", {
    method: "POST",
    body: JSON.stringify(input),
  });
