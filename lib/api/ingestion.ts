type ApiEnvelope<T> = { ok: true; data: T } | { ok: false; error: string };

export type IngestionConnection = {
  _id: string;
  key: "best_relocation";
  application_enabled: boolean;
  cadence_hours: 24 | 48;
  next_due_at?: string | null;
  last_checked_at?: string | null;
  last_successful_run_at?: string | null;
  bootstrap_completed_at?: string | null;
  env_gate_enabled: boolean;
  configured_sources: {
    leads: { configured: boolean; masked_id: string | null };
    booked: { configured: boolean; masked_id: string | null };
  };
  health?: Record<string, unknown>;
};

export type IngestionRun = {
  _id: string;
  trigger: string;
  status: string;
  plan_checksum?: string | null;
  counters?: Record<string, number>;
  failure?: { summary?: string } | null;
  createdAt: string;
  completed_at?: string | null;
};

export type IngestionConflict = {
  _id: string;
  type: string;
  severity: string;
  status: string;
  dataset_key: string;
  provenance?: { tab?: string; row?: number };
  createdAt: string;
};

export type IngestionInspection = {
  healthy: boolean;
  checked_at: string;
  checks: Array<{
    key: string;
    status: "healthy" | "warning" | "blocking";
    summary: string;
  }>;
};

const proxy = (path: string) =>
  `/api/proxy/api/v1/admin/ingestion/${path}`;

function unwrapEnvelope<T>(value: unknown): T {
  let current = value;
  for (let depth = 0; depth < 2; depth += 1) {
    if (
      current &&
      typeof current === "object" &&
      "ok" in current &&
      (current as { ok: unknown }).ok === true &&
      "data" in current
    ) {
      current = (current as { data: unknown }).data;
      continue;
    }
    break;
  }
  return current as T;
}

export function asIngestionList<T>(data: unknown): T[] {
  const page = unwrapEnvelope(data);
  if (Array.isArray(page)) {
    return page as T[];
  }
  if (page && typeof page === "object") {
    const record = page as Record<string, unknown>;
    for (const key of ["items", "runs", "conflicts"] as const) {
      const candidate = record[key];
      if (Array.isArray(candidate)) {
        return candidate as T[];
      }
    }
  }
  return [];
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(proxy(path), {
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
      envelope.ok ? `Request failed (${response.status})` : envelope.error,
    );
  }
  return unwrapEnvelope(envelope.data);
}

export function fetchBestRelocationConnection(): Promise<IngestionConnection> {
  return request("connections/best-relocation");
}

export function updateBestRelocationConnection(input: {
  application_enabled?: boolean;
  cadence_hours?: 24 | 48;
}): Promise<IngestionConnection> {
  return request("connections/best-relocation", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function inspectBestRelocation(): Promise<IngestionInspection> {
  return request("connections/best-relocation/inspect", {
    method: "POST",
    body: JSON.stringify({ repair_identity: false }),
  });
}

export function previewBestRelocation(
  bootstrap = false,
): Promise<{ run_id: string; status: string; approval_required: boolean }> {
  return request("connections/best-relocation/preview", {
    method: "POST",
    body: JSON.stringify({ bootstrap }),
  });
}

export function approveBestRelocationRun(input: {
  run_id: string;
  plan_checksum: string;
}): Promise<{ run_id: string; status: string }> {
  return request("connections/best-relocation/run", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function fetchIngestionRuns(): Promise<IngestionRun[]> {
  return request("runs?limit=50").then((data) => asIngestionList<IngestionRun>(data));
}

export function retryIngestionRun(
  runId: string,
): Promise<{ run_id: string; status: string }> {
  return request(`runs/${encodeURIComponent(runId)}/retry`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function fetchIngestionConflicts(): Promise<IngestionConflict[]> {
  return request("conflicts?status=open").then((data) =>
    asIngestionList<IngestionConflict>(data),
  );
}

export function dismissIngestionConflict(
  conflictId: string,
  note: string,
): Promise<IngestionConflict> {
  return request(`conflicts/${encodeURIComponent(conflictId)}/resolve`, {
    method: "POST",
    body: JSON.stringify({ disposition: "dismiss", note }),
  });
}
