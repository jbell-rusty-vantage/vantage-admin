"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback";
import { OPERATIONAL_COPY } from "@/components/operational/operational-copy";
import { invalidateOperationalMutations } from "@/components/operational/operational-helpers";
import {
  getRecordId,
  updateLeadNoSync,
  type AdminRecord,
  type UiResource,
} from "@/lib/api/admin";

type LeadResource = Extract<UiResource, "form-leads" | "call-leads">;

export function HideFromMasterLeadsControl({
  record,
  resource,
  onSaved,
}: {
  record: AdminRecord;
  resource: LeadResource;
  onSaved?: () => void;
}) {
  const queryClient = useQueryClient();
  const hidden = record.no_sync === true;
  const copy = OPERATIONAL_COPY.hideFromMasterLeads;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: (nextHidden: boolean) =>
      updateLeadNoSync<AdminRecord>(resource, getRecordId(record), nextHidden),
    onSuccess: async (_data, nextHidden) => {
      await invalidateOperationalMutations(queryClient);
      setMessage(nextHidden ? copy.successHide : copy.successShow);
      setConfirmOpen(false);
      onSaved?.();
    },
    onError: () => {
      setConfirmOpen(false);
      setMessage(copy.failure);
    },
  });

  return (
    <div className="space-y-3">
      {message ? (
        <FeedbackMessage tone={mutation.isError ? "error" : "success"}>
          {message}
        </FeedbackMessage>
      ) : null}
      <p className="text-sm text-muted-foreground">{copy.helper}</p>
      <Button
        type="button"
        variant={hidden ? "outline" : "default"}
        disabled={mutation.isPending}
        onClick={() => {
          setMessage(null);
          setConfirmOpen(true);
        }}
      >
        {hidden ? copy.showAction : copy.hideAction}
      </Button>
      {confirmOpen ? (
        <HideFromMasterLeadsConfirmDialog
          hidden={hidden}
          pending={mutation.isPending}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => mutation.mutate(!hidden)}
        />
      ) : null}
    </div>
  );
}

function HideFromMasterLeadsConfirmDialog({
  hidden,
  pending,
  onCancel,
  onConfirm,
}: {
  hidden: boolean;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const copy = OPERATIONAL_COPY.hideFromMasterLeads;
  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label={copy.confirmCancel}
        className="absolute inset-0 bg-background/75 backdrop-blur-sm"
        onClick={pending ? undefined : onCancel}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="hide-from-master-leads-title"
        className="relative w-full max-w-lg rounded-xl border bg-background p-5 shadow-2xl"
      >
        <h2 id="hide-from-master-leads-title" className="text-lg font-semibold text-navy">
          {hidden ? copy.confirmShowTitle : copy.confirmHideTitle}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {hidden ? copy.confirmShowBody : copy.confirmHideBody}
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onCancel} disabled={pending}>
            {copy.confirmCancel}
          </Button>
          <Button onClick={onConfirm} disabled={pending}>
            {hidden ? copy.confirmShowButton : copy.confirmHideButton}
          </Button>
        </div>
      </section>
    </div>
  );
}
