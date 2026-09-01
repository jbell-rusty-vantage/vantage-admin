"use client";

import type { ReactNode } from "react";
import { FilterField } from "@/components/filters/filter-field";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/components/data-table/formatters";
import { splitBinderEvenly } from "@/lib/booking/splitBinderEvenly";

const MONEY = /^\d+(?:\.\d{1,2})?$/;

export function OfficialBinderAgentsFields({
  idPrefix,
  binder,
  onBinderChange,
  primaryAgentId,
  secondaryAgentId,
  onPrimaryAgentChange,
  onSecondaryAgentChange,
  agents,
  afterBinder,
}: {
  idPrefix: string;
  binder: string;
  onBinderChange: (value: string) => void;
  primaryAgentId: string;
  secondaryAgentId: string;
  onPrimaryAgentChange: (value: string) => void;
  onSecondaryAgentChange: (value: string) => void;
  agents: Array<{ id: string; name: string }>;
  afterBinder?: ReactNode;
}) {
  const primary = agents.find((item) => item.id === primaryAgentId);
  const secondary = agents.find((item) => item.id === secondaryAgentId);
  const amounts = MONEY.test(binder) && primary
    ? splitBinderEvenly(Number(binder), secondaryAgentId ? 2 : 1)
    : undefined;

  return (
    <>
      <FilterField label="Binder amount">
        <Input
          id={`${idPrefix}-binder`}
          inputMode="decimal"
          value={binder}
          onChange={(event) => onBinderChange(event.target.value)}
        />
      </FilterField>
      {afterBinder}
      <FilterField label="Primary Agent">
        <select
          id={`${idPrefix}-primary-agent`}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={primaryAgentId}
          onChange={(event) => onPrimaryAgentChange(event.target.value)}
        >
          <option value="">Choose agent</option>
          {agents.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
      </FilterField>
      <FilterField label="Secondary Agent">
        <select
          id={`${idPrefix}-secondary-agent`}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={secondaryAgentId}
          onChange={(event) => onSecondaryAgentChange(event.target.value)}
        >
          <option value="">No split</option>
          {agents.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
      </FilterField>
      <p className="text-sm text-muted-foreground sm:col-span-2 md:col-span-3">
        {amounts && primary
          ? secondary
            ? `${primary.name} ${formatMoney(amounts[0])} · ${secondary.name} ${formatMoney(amounts[1])}`
            : `${primary.name} ${formatMoney(amounts[0])}`
          : "One binder amount. A second agent splits it evenly; the primary agent receives the leftover cent."}
      </p>
    </>
  );
}
