/**
 * Small presentational pieces every Lead sources sheet shares: a numbered block, a label/field row, the server's error
 * in words (message, request id and the remediation it names), and a reason field. No data, no hooks: the sheets own
 * their reads and writes. Styles are the shared `.su-*` classes of `components/setup/setup.css`.
 */
import type { ReactNode } from "react";
import { RegistryApiError } from "@/lib/api/registryRequest";

export function SheetBlock({
  step,
  title,
  id,
  children,
}: {
  step?: number;
  title: ReactNode;
  id: string;
  children: ReactNode;
}) {
  return (
    <section className="su-block" aria-labelledby={id}>
      <h3 id={id} className="su-block__head">
        {step ? <span className="su-step">{step}</span> : null}
        {title}
      </h3>
      {children}
    </section>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="su-row">
      <label className="su-row__label" htmlFor={htmlFor}>
        {label}
      </label>
      <div>{children}</div>
      {hint ? <p className="su-row__hint">{hint}</p> : null}
    </div>
  );
}

/** The server's refusal in the Owner's reading order: what happened, what to do, the request id for support. */
export function SheetError({ error }: { error: unknown }) {
  if (!error) return null;
  if (error instanceof RegistryApiError) {
    return (
      <div className="su-errors" role="alert">
        <p>{error.message}</p>
        {error.remediation?.summary ? <p className="su-quiet">{error.remediation.summary}</p> : null}
        {error.requestId ? <p className="su-quiet">Request {error.requestId}</p> : null}
      </div>
    );
  }
  return (
    <div className="su-errors" role="alert">
      <p>{error instanceof Error ? error.message : "Something went wrong."}</p>
    </div>
  );
}

/** A short in-sheet confirmation (the sheet stays open after a save). */
export function SheetSaved({ children }: { children: ReactNode }) {
  return (
    <p className="ls-saved" role="status">
      {children}
    </p>
  );
}

export const REASON_MIN = 10;

export function reasonOk(reason: string, min = REASON_MIN): boolean {
  return reason.trim().length >= min;
}

export function splitList(text: string): string[] {
  return text
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export type ReplacementOption = { id: string; label: string };

/**
 * The dependency preview the Registry shows before anything is turned off: what depends on it, in the Owner's words,
 * and (when the thing being turned off is a channel default) which feed becomes the default instead.
 */
export function DependencyPreviewPanel({
  title,
  none,
  lines,
  replacement,
  confirmLabel,
  cancelLabel,
  pending,
  onConfirm,
  onCancel,
}: {
  title: string;
  none: string;
  lines: readonly string[];
  replacement?: {
    legend: string;
    emptyNote: string;
    pick: string;
    options: readonly ReplacementOption[];
    value: string;
    onChange: (value: string) => void;
    removeLabel: string;
    removeChecked: boolean;
    onRemoveChange: (value: boolean) => void;
  };
  confirmLabel: string;
  cancelLabel: string;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="ls-preview" role="group" aria-label={title}>
      <p className="ls-preview__title">{title}</p>
      {lines.length === 0 ? (
        <p className="su-quiet">{none}</p>
      ) : (
        <ul className="ls-preview__list">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      {replacement ? (
        <div className="su-fields">
          <label className="su-row__label" htmlFor="ls-replacement">
            {replacement.legend}
          </label>
          {replacement.options.length === 0 ? (
            <p className="su-quiet">{replacement.emptyNote}</p>
          ) : (
            <select
              id="ls-replacement"
              className="su-input"
              value={replacement.value}
              onChange={(event) => replacement.onChange(event.target.value)}
            >
              <option value="">{replacement.pick}</option>
              {replacement.options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          )}
          <label className="su-choice">
            <input
              type="checkbox"
              checked={replacement.removeChecked}
              onChange={(event) => replacement.onRemoveChange(event.target.checked)}
            />
            <span className="su-choice__text">{replacement.removeLabel}</span>
          </label>
        </div>
      ) : null}
      <div className="su-actions">
        <button type="button" className="crm-button crm-button--sm" onClick={onCancel} disabled={pending}>
          {cancelLabel}
        </button>
        <button type="button" className="crm-button crm-button--danger crm-button--sm" onClick={onConfirm} disabled={pending}>
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
