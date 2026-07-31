"use client";

import { FeedbackMessage } from "@/components/ui/feedback";
import { RegistryApiError } from "@/lib/api/registryRequest";

export function RegistryApiErrorMessage({ error }: { error: unknown }) {
  if (!(error instanceof RegistryApiError)) {
    return (
      <FeedbackMessage tone="error">
        {error instanceof Error ? error.message : "Unexpected registry error."}
      </FeedbackMessage>
    );
  }

  return (
    <FeedbackMessage tone="error">
      <p>{error.message}</p>
      {error.registryCode ? (
        <p className="mt-1 text-xs opacity-90">Code: {error.registryCode}</p>
      ) : null}
      {error.remediation?.summary ? (
        <p className="mt-1 text-xs opacity-90">{error.remediation.summary}</p>
      ) : null}
      {error.requestId ? (
        <p className="mt-1 text-xs opacity-75">Request {error.requestId}</p>
      ) : null}
    </FeedbackMessage>
  );
}
