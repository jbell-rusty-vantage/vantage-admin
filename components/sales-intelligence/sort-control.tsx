"use client";

import { useId } from "react";
import { ArrowDownUp } from "lucide-react";
import { Button } from "./atoms/button";
import { copy } from "./sales-intelligence-copy";
import { directionLabel, flipDirection, sortOption, type SortDirection, type SortOption } from "./lib/sort";

/**
 * The one inline `Sort by` control for a list: a labelled select plus a direction
 * toggle. It only writes the choice; the server produces the order.
 */
export function SortControl<Value extends string>({
  options,
  value,
  direction,
  onChange,
}: {
  options: readonly SortOption<Value>[];
  value: Value;
  direction: SortDirection;
  onChange: (next: { sort: Value; direction: SortDirection }) => void;
}) {
  const id = useId();
  const option = sortOption(options, value);
  const current = directionLabel(option, direction);
  const other = directionLabel(option, flipDirection(direction));
  return (
    <span className="si-sort">
      <label htmlFor={id} className="si-sort__label">{copy.sort.label}</label>
      <select
        id={id}
        className="si-select si-sort__select"
        value={value}
        onChange={(event) => {
          const next = sortOption(options, event.target.value);
          if (next) onChange({ sort: next.value, direction: next.defaultDirection });
        }}
      >
        {options.map((item) => (
          <option key={item.value} value={item.value}>{item.label}</option>
        ))}
      </select>
      {current && other && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="si-sort__direction"
          aria-label={`${copy.sort.direction}: ${current}, ${copy.sort.switchTo(other)}`}
          onClick={() => onChange({ sort: value, direction: flipDirection(direction) })}
        >
          <ArrowDownUp size={14} aria-hidden />
          {current}
        </Button>
      )}
    </span>
  );
}
