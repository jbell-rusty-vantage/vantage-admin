"use client";
/**
 * Owner delete of a booking or a cancellation from the panel's Production tab (the behaviour the retired
 * the retired operational list page carried): a confirmation target, the mutation, and the words for the result.
 */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { DeleteTarget } from "@/components/operational/operational-configs";
import { deleteSuccessCopy } from "@/components/operational/operational-copy";
import { hasAttachedCancellation, invalidateOperationalMutations } from "@/components/operational/operational-helpers";
import { deleteBookedLead, deleteCancelledLead, getRecordId } from "@/lib/api/admin";

export function useRecordDelete({ onDeleted }: { onDeleted: (id: string) => void }) {
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<DeleteTarget | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (next: DeleteTarget) => {
      const id = getRecordId(next.record);
      if (next.resource === "bookings") await deleteBookedLead(id, { cascade: hasAttachedCancellation(next.record) });
      else await deleteCancelledLead(id);
      return next;
    },
    onSuccess: async (next) => {
      await invalidateOperationalMutations(queryClient);
      onDeleted(getRecordId(next.record));
      setTarget(null);
      setError(null);
      setMessage(deleteSuccessCopy(next.resource, hasAttachedCancellation(next.record)));
    },
    onError: (failure) => setError(failure instanceof Error ? failure.message : "Delete failed."),
  });

  return {
    target,
    error,
    message,
    pending: mutation.isPending,
    request: (next: DeleteTarget) => {
      setMessage(null);
      setError(null);
      setTarget(next);
    },
    cancel: () => {
      if (!mutation.isPending) {
        setTarget(null);
        setError(null);
      }
    },
    confirm: () => {
      if (target) mutation.mutate(target);
    },
  };
}
