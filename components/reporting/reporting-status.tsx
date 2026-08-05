import { AlertTriangle, CheckCircle2, HelpCircle } from "lucide-react";

export function RunStatusBadge({ value }: { value: string }) {
  const tone =
    value === "completed"
      ? "bg-emerald-100 text-emerald-900"
      : value === "failed"
        ? "bg-red-100 text-red-900"
        : value === "cancelled"
          ? "bg-steel-100 text-steel"
          : "bg-amber-100 text-amber-900";
  return (
    <span className={`rounded-full px-2 py-1 text-xs font-bold uppercase ${tone}`}>{value}</span>
  );
}

export function DestinationStatusBadge({
  status,
}: {
  status: "verified" | "unverified" | "unhealthy";
}) {
  const tone =
    status === "verified"
      ? "bg-emerald-100 text-emerald-900"
      : status === "unhealthy"
        ? "bg-red-100 text-red-900"
        : "bg-amber-100 text-amber-900";
  return <span className={`rounded-full px-2 py-1 text-xs font-bold uppercase ${tone}`}>{status}</span>;
}

export function HealthIcon({ ok }: { ok: boolean }) {
  return ok ? (
    <CheckCircle2 className="h-4 w-4 text-emerald-700" aria-hidden="true" />
  ) : (
    <AlertTriangle className="h-4 w-4 text-amber-700" aria-hidden="true" />
  );
}

export function UnknownHealthIcon() {
  return <HelpCircle className="h-4 w-4 text-steel" aria-hidden="true" />;
}
