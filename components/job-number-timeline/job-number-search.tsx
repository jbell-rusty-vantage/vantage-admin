"use client";

import { useId } from "react";
import { ArrowRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Adapted from 21st.dev Origin UI search input (demo 159):
 * typed search field with leading icon and submit control.
 * No typeahead / catalog of Job Numbers.
 */
export function JobNumberSearch({
  value,
  granularityId,
  onValueChange,
  onGranularityChange,
  onSubmit,
  disabled,
}: {
  value: string;
  granularityId: string;
  onValueChange: (value: string) => void;
  onGranularityChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}) {
  const jobId = useId();
  const granularityFieldId = useId();

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="space-y-2">
        <Label htmlFor={jobId}>Job number</Label>
        <div className="relative">
          <Input
            id={jobId}
            type="search"
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            placeholder="Job number"
            autoComplete="off"
            spellCheck={false}
            disabled={disabled}
            className={cn(
              "peer h-11 pe-12 ps-10",
              "[&::-webkit-search-cancel-button]:appearance-none",
              "[&::-webkit-search-decoration]:appearance-none",
            )}
          />
          <div className="pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center ps-3 text-steel peer-disabled:opacity-50">
            <Search size={16} strokeWidth={2} aria-hidden="true" />
          </div>
          <button
            className="absolute inset-y-0 end-0 flex h-full w-11 items-center justify-center rounded-e-md text-navy outline-offset-2 transition-colors hover:text-trust-blue focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
            aria-label="Search Job Number"
            type="submit"
            disabled={disabled}
          >
            <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1 space-y-2">
          <Label htmlFor={granularityFieldId}>Source Granularity (optional)</Label>
          <Input
            id={granularityFieldId}
            value={granularityId}
            onChange={(event) => onGranularityChange(event.target.value)}
            placeholder="Filter by granularity id"
            autoComplete="off"
            spellCheck={false}
            disabled={disabled}
          />
        </div>
        <Button type="submit" variant="gold" disabled={disabled}>
          Search
        </Button>
      </div>
    </form>
  );
}
