"use client";

import { useState } from "react";
import { FilterField } from "@/components/filters/filter-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  isPhoneEditable,
  type RingCentralRoute,
  type RingCentralRouteUpdateInput,
} from "@/lib/api/registryRingCentral";

export function RouteDraftCreateForm({
  disabled,
  isPending,
  onCreate,
}: {
  disabled: boolean;
  isPending: boolean;
  onCreate: (input: { phone_number: string; display_label: string; reason?: string }) => void;
}) {
  if (disabled) {
    return null;
  }

  return (
    <form
      className="grid gap-3 rounded-md border bg-background p-3 md:grid-cols-[1fr_1fr_1fr_auto]"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const formData = new FormData(form);
        const phone_number = String(formData.get("phone_number") ?? "").trim();
        const display_label = String(formData.get("display_label") ?? "").trim();
        const reason = String(formData.get("reason") ?? "").trim() || undefined;
        if (!phone_number || !display_label) {
          return;
        }
        onCreate({ phone_number, display_label, reason });
        form.reset();
      }}
    >
      <FilterField label="Phone number">
        <Input
          name="phone_number"
          placeholder="+18885551212"
          autoComplete="off"
          required
        />
      </FilterField>
      <FilterField label="Display label">
        <Input name="display_label" placeholder="Queue / campaign label" required />
      </FilterField>
      <FilterField label="Reason (optional)">
        <Input name="reason" placeholder="Audit reason" />
      </FilterField>
      <FilterField label="&nbsp;">
        <Button type="submit" disabled={isPending}>
          Create draft
        </Button>
      </FilterField>
      <p className="md:col-span-4 text-xs text-muted-foreground">
        Drafts start inactive and unvalidated. The server normalizes the phone number; submit the
        value as entered and use the canonical number returned after save.
      </p>
    </form>
  );
}

export function RouteEditor({
  route,
  readOnly,
  isPending,
  onSave,
}: {
  route: RingCentralRoute;
  readOnly: boolean;
  isPending: boolean;
  onSave: (body: RingCentralRouteUpdateInput) => void;
}) {
  const phoneEditable = isPhoneEditable(route);
  const [phoneNumber, setPhoneNumber] = useState(route.phone_number);
  const [displayLabel, setDisplayLabel] = useState(route.display_label);
  const [reason, setReason] = useState("");

  const phoneChanged = phoneEditable && phoneNumber.trim() !== route.phone_number;
  const labelChanged = displayLabel.trim() !== route.display_label;
  const changed = phoneChanged || labelChanged;

  if (readOnly) {
    return (
      <div className="space-y-1 text-sm">
        <p>
          <span className="text-muted-foreground">Phone:</span>{" "}
          <span className="font-mono">{route.phone_number}</span>
          {route.phone_locked ? (
            <span className="ml-2 text-xs text-muted-foreground">(locked after activation)</span>
          ) : null}
        </p>
        <p>
          <span className="text-muted-foreground">Label:</span> {route.display_label}
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <FilterField label="Phone number">
        <Input
          value={phoneNumber}
          onChange={(event) => setPhoneNumber(event.target.value)}
          disabled={!phoneEditable}
          className="font-mono"
          autoComplete="off"
        />
        {!phoneEditable ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Phone identity is immutable after first activation.
          </p>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">
            Editable until first activation. Changing the number clears validation.
          </p>
        )}
      </FilterField>
      <FilterField label="Display label">
        <Input value={displayLabel} onChange={(event) => setDisplayLabel(event.target.value)} />
      </FilterField>
      <FilterField label="Reason (optional)">
        <Input value={reason} onChange={(event) => setReason(event.target.value)} />
      </FilterField>
      <FilterField label="&nbsp;">
        <Button
          variant="outline"
          disabled={!changed || isPending || !displayLabel.trim()}
          onClick={() => {
            const body: RingCentralRouteUpdateInput = {
              ...(phoneChanged ? { phone_number: phoneNumber.trim() } : {}),
              ...(labelChanged ? { display_label: displayLabel.trim() } : {}),
              ...(reason.trim() ? { reason: reason.trim() } : {}),
            };
            onSave(body);
          }}
        >
          Save route
        </Button>
      </FilterField>
    </div>
  );
}
