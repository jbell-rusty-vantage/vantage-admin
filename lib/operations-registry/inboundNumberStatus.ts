export const INBOUND_NICKNAME_HELPER =
  "Only helps you recognize this number in Vantage. It does not decide where the call goes.";

export const INBOUND_STALE_VALIDATION_COPY =
  "This number was checked against RingCentral more than 24 hours ago. Check it again before activating.";

export const INBOUND_STOPPED_FILING_COPY =
  "This number has stopped filing calls. RingCentral no longer recognizes it. Calls are still arriving but are not being attributed to any lead source. Check it against RingCentral again.";

export const INBOUND_DEACTIVATION_COPY =
  "New calls to this number will stop being filed. Calls already recorded and the leads created from them keep the lead source and feed they were filed under.";

export const INBOUND_REASSIGN_COPY =
  "New calls use the new feed immediately. Old calls and leads keep the lead source and feed they were filed under.";

const VALIDATION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type InboundNumberStatusKind =
  | "unfinished"
  | "stale_validation"
  | "ready_to_activate"
  | "filing_calls"
  | "stopped_filing_calls";

export type InboundNumberEvidence = {
  active: boolean;
  validation_status: "unvalidated" | "valid" | "invalid";
  validated_at?: string;
  last_seen_in_call_log_at?: string;
  current_assignment?: {
    lead_source_name?: string;
    feed_display_name?: string;
    effective_from?: string;
  };
};

const LOOKS_LIKE_OBJECT_ID = /^[a-f0-9]{24}$/i;

export function isOwnerDisplayName(value?: string): value is string {
  const trimmed = value?.trim();
  return Boolean(trimmed && !LOOKS_LIKE_OBJECT_ID.test(trimmed));
}

export type InboundLabelCatalogs = {
  companies?: Array<{
    id?: string;
    _id?: string;
    name?: string;
    owner_label?: string;
  }>;
  feeds?: Array<{
    id?: string;
    _id?: string;
    source_company?: string;
    owner_label?: string;
  }>;
};

function catalogId(row?: { id?: string; _id?: string }): string {
  return String(row?.id || row?._id || "");
}

function companyDisplayName(company?: {
  name?: string;
  owner_label?: string;
}): string | undefined {
  if (isOwnerDisplayName(company?.owner_label)) return company.owner_label.trim();
  if (isOwnerDisplayName(company?.name)) return company.name.trim();
  return undefined;
}

export function resolveInboundAssignmentLabels(
  assignment:
    | {
        source_company_id?: string;
        source_granularity_id?: string;
        lead_source_name?: string;
        feed_display_name?: string;
      }
    | undefined,
  catalogs: InboundLabelCatalogs = {},
): { lead_source_name?: string; feed_display_name?: string } {
  const feeds = catalogs.feeds ?? [];
  const companies = catalogs.companies ?? [];
  const feed = feeds.find(
    (item) => catalogId(item) && catalogId(item) === assignment?.source_granularity_id,
  );
  // The feed is the filing target. Prefer its parent Lead Source when the
  // stored assignment company id is stale or disagrees with the feed.
  const companyId = feed?.source_company || assignment?.source_company_id;
  const company = companies.find((item) => catalogId(item) && catalogId(item) === companyId);
  const leadSourceName = isOwnerDisplayName(assignment?.lead_source_name)
    ? assignment.lead_source_name.trim()
    : companyDisplayName(company);
  const feedDisplayName = isOwnerDisplayName(assignment?.feed_display_name)
    ? assignment.feed_display_name.trim()
    : isOwnerDisplayName(feed?.owner_label)
      ? feed.owner_label.trim()
      : undefined;
  return {
    ...(leadSourceName ? { lead_source_name: leadSourceName } : {}),
    ...(feedDisplayName ? { feed_display_name: feedDisplayName } : {}),
  };
}

export function inboundConnectionLabel(assignment?: {
  lead_source_name?: string;
  feed_display_name?: string;
}): string | null {
  if (!isOwnerDisplayName(assignment?.lead_source_name) || !isOwnerDisplayName(assignment?.feed_display_name)) {
    return null;
  }
  return `${assignment.lead_source_name.trim()} → ${assignment.feed_display_name.trim()}`;
}

export function inboundPreActivationCopy(connection: string): string {
  return [
    `Once you activate this number, calls to it are read from RingCentral's call log and filed under ${connection}. The first sync normally runs within 30 minutes. Calls that came in before now will not be back-filled.`,
    "Activating locks the phone number. If it is wrong, you will need to add a new number instead of editing this one.",
  ].join(" ");
}

export function formatInboundDate(iso?: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "America/New_York",
  }).format(date);
}

export function formatInboundRelative(iso?: string, now = Date.now()): string {
  if (!iso) return "not yet";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "not yet";
  const minutes = Math.max(0, Math.round((now - then) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes === 1) return "1 minute ago";
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours === 1) return "1 hour ago";
  if (hours < 48) return `${hours} hours ago`;
  return formatInboundDate(iso);
}

export function deriveInboundNumberStatus(
  route: InboundNumberEvidence,
  now = Date.now(),
): {
  kind: InboundNumberStatusKind;
  message: string;
} {
  const connection = inboundConnectionLabel(route.current_assignment);
  if (route.active && route.validation_status === "invalid") {
    return { kind: "stopped_filing_calls", message: INBOUND_STOPPED_FILING_COPY };
  }
  if (route.active && route.validation_status === "valid" && connection) {
    const lastSeen = formatInboundRelative(route.last_seen_in_call_log_at, now);
    const since = formatInboundDate(route.current_assignment?.effective_from);
    return {
      kind: "filing_calls",
      message: `Filing calls. Last call seen ${lastSeen}. Calls to this number are filed under ${connection}${since ? `, effective since ${since}` : ""}.`,
    };
  }
  const validatedAt = route.validated_at ? new Date(route.validated_at).getTime() : NaN;
  const stale =
    route.validation_status === "valid" &&
    Number.isFinite(validatedAt) &&
    now - validatedAt > VALIDATION_MAX_AGE_MS;
  if (stale) {
    return { kind: "stale_validation", message: INBOUND_STALE_VALIDATION_COPY };
  }
  if (route.validation_status === "valid" && !route.active) {
    return {
      kind: "ready_to_activate",
      message: "Checked against RingCentral. Choose the call feed, then activate.",
    };
  }
  return {
    kind: "unfinished",
    message:
      "This number is not created from the Owner's point of view until RingCentral confirms it and it is mapped to a call feed.",
  };
}

export function formatUsPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return value;
}
