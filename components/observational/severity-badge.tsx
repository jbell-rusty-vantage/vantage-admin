import { StatusBadge } from "@/components/data-table/status-badge";
import type {
  IncidentSeverity,
  IncidentStatus,
  ObservabilityLevel,
} from "@/lib/api/admin";

type BadgeTone = "default" | "success" | "warning" | "destructive" | "muted";

const LEVEL_TONES: Record<ObservabilityLevel, BadgeTone> = {
  debug: "muted",
  info: "default",
  warn: "warning",
  error: "destructive",
  critical: "destructive",
};

const INCIDENT_STATUS_TONES: Record<IncidentStatus, BadgeTone> = {
  open: "destructive",
  acknowledged: "warning",
  resolved: "success",
  auto_resolved: "success",
  ignored: "muted",
};

export function LevelBadge({ level }: { level?: ObservabilityLevel | string | null }) {
  if (!level) {
    return <StatusBadge tone="muted">-</StatusBadge>;
  }
  const tone = LEVEL_TONES[level as ObservabilityLevel] ?? "muted";
  return (
    <StatusBadge tone={tone} className={level === "critical" ? "font-bold uppercase" : undefined}>
      {level}
    </StatusBadge>
  );
}

export function SeverityBadge({ severity }: { severity?: IncidentSeverity | string | null }) {
  return <LevelBadge level={severity} />;
}

export function IncidentStatusBadge({ status }: { status?: IncidentStatus | string | null }) {
  if (!status) {
    return <StatusBadge tone="muted">-</StatusBadge>;
  }
  const tone = INCIDENT_STATUS_TONES[status as IncidentStatus] ?? "muted";
  return <StatusBadge tone={tone}>{status.replace(/_/g, " ")}</StatusBadge>;
}

export function NotificationStatusBadge({ status }: { status?: string | null }) {
  if (!status) {
    return <StatusBadge tone="muted">-</StatusBadge>;
  }
  const tone: BadgeTone =
    status === "sent"
      ? "success"
      : status === "failed"
        ? "destructive"
        : status === "suppressed" || status === "cancelled"
          ? "muted"
          : "warning";
  return <StatusBadge tone={tone}>{status}</StatusBadge>;
}
