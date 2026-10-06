"use client";
/** An error in plain words inside the section: the server's sentence, its remediation line, never a code or request id. */
import { RegistryApiError } from "@/lib/api/registryRequest";
import { isCplPreviewStaleError, isRegistryStaleRevisionError } from "@/lib/api/registryCpl";
import { LEAD_COSTS_COPY } from "./lead-costs-copy";

export function leadCostErrorLines(error: unknown, staleRevisionCopy: string): string[] {
  if (isRegistryStaleRevisionError(error)) return [staleRevisionCopy];
  if (isCplPreviewStaleError(error)) return [LEAD_COSTS_COPY.save.stalePreview];
  if (error instanceof RegistryApiError) {
    return [error.message, ...(error.remediation?.summary ? [error.remediation.summary] : [])];
  }
  return [error instanceof Error ? error.message : "Something went wrong. Try again."];
}

export function LeadCostError({ error, staleRevisionCopy }: { error: unknown; staleRevisionCopy: string }) {
  const lines = leadCostErrorLines(error, staleRevisionCopy);
  return (
    <div className="su-errors" role="alert">
      {lines.map((line) => (
        <p key={line} style={{ margin: 0 }}>
          {line}
        </p>
      ))}
    </div>
  );
}
