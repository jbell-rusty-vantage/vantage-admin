"use client";

import type { ReactNode } from "react";
import { useId } from "react";
import { cx } from "../lib/format";

export function CircleCheck({
  checked,
  onChange,
  label,
  hint,
  className,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cx("si-circlecheck", className)}>
      <div className={cx("si-circlecheck__btn", checked && "is-checked")}>
        <button
          type="button"
          id={id}
          role="checkbox"
          aria-checked={checked}
          aria-labelledby={`${id}-label`}
          className="si-circlecheck__control"
          onClick={() => onChange(!checked)}
        >
          <span className="si-circlecheck__mark" aria-hidden />
        </button>
        <span id={`${id}-label`} className="si-circlecheck__label" onClick={() => onChange(!checked)}>
          {label}
        </span>
      </div>
      {hint && <p className="si-field__hint">{hint}</p>}
    </div>
  );
}
