"use client";
/**
 * Deactivate with its dependency preview and Reactivate, for an Agent (Roster sheet) or a Merchant (Money sheet): the
 * Registry's own rule, kept. Deactivating always reads what depends on the record first and shows it with the reason the
 * Owner typed; nothing is deleted. The preview's keys are engineering names, so they are said in words here.
 */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invalidatePeople } from "@/components/setup/people/use-people";
import { formatRegistryError } from "@/lib/api/registryRequest";
import {
  previewRegistryCatalogDependencies,
  setRegistryCatalogActivation,
  type RegistryCatalogItem,
  type RegistryCatalogKind,
  type RegistryDependencyPreview,
} from "@/lib/api/registryAgents";

export type ActivationCopy = {
  deactivate: string;
  reactivate: string;
  previewTitle: string;
  previewTotal: (n: number) => string;
  previewNone: string;
  previewFailed: string;
  confirmDeactivate: string;
  keepActive: string;
  deactivated: string;
  reactivated: string;
  saving: string;
};

const KEY_WORDS: Array<[RegExp, string]> = [
  [/source[_ ]?granularit(y|ies)/i, "feeds"],
  [/granularit(y|ies)/i, "feeds"],
  [/lifecycle/i, "Granot updates"],
];

/** A dependency key in words: `lead_cost_rows` → "lead cost rows"; engineering names become Owner words. */
export function dependencyLabel(key: string): string {
  let text = key;
  for (const [pattern, word] of KEY_WORDS) text = text.replace(pattern, word);
  return text.replace(/[_-]+/g, " ").trim();
}

/** The count a preview reports for the key `keys` name first found (a Merchant's recorded deposits), or null. */
export function dependencyCount(preview: RegistryDependencyPreview | undefined, pattern: RegExp): number | null {
  if (!preview) return null;
  const hit = Object.entries(preview.dependencies).find(([key]) => pattern.test(key));
  return hit ? hit[1] : null;
}

export function DependencyList({ preview, copy }: { preview: RegistryDependencyPreview; copy: Pick<ActivationCopy, "previewTotal" | "previewNone"> }) {
  const entries = Object.entries(preview.dependencies);
  return (
    <>
      <p className="su-review">{preview.total > 0 ? copy.previewTotal(preview.total) : copy.previewNone}</p>
      {entries.length > 0 ? (
        <ul className="su-quiet">
          {entries.map(([key, count]) => (
            <li key={key}>
              {dependencyLabel(key)}: {count}
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

export function ActivationBlock({
  kind,
  item,
  reason,
  copy,
  onChanged,
}: {
  kind: RegistryCatalogKind;
  item: Pick<RegistryCatalogItem, "id" | "active">;
  reason: string;
  copy: ActivationCopy;
  onChanged: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  const [preview, setPreview] = useState<RegistryDependencyPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const activation = useMutation({
    mutationFn: (active: boolean) => setRegistryCatalogActivation(kind, item.id, { active, ...(reason.trim() ? { reason: reason.trim() } : {}) }),
    onSuccess: async (_saved, active) => {
      await invalidatePeople(queryClient);
      setPreview(null);
      setError(null);
      onChanged(active ? copy.reactivated : copy.deactivated);
    },
    onError: (failure) => setError(formatRegistryError(failure)),
  });

  async function startPreview() {
    setLoading(true);
    setError(null);
    try {
      setPreview(await previewRegistryCatalogDependencies(kind, item.id));
    } catch (failure) {
      setError(`${copy.previewFailed} ${formatRegistryError(failure)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="su-fields">
      {error ? (
        <p className="su-errors" role="alert">
          {error}
        </p>
      ) : null}
      {!item.active ? (
        <div className="su-actions" style={{ justifyContent: "flex-start" }}>
          <button type="button" className="crm-button" disabled={activation.isPending} onClick={() => activation.mutate(true)}>
            {activation.isPending ? copy.saving : copy.reactivate}
          </button>
        </div>
      ) : preview ? (
        <div className="su-block" data-testid="dependency-preview">
          <h4 className="su-block__head">{copy.previewTitle}</h4>
          <DependencyList preview={preview} copy={copy} />
          <div className="su-actions" style={{ justifyContent: "flex-start" }}>
            <button type="button" className="crm-button crm-button--danger" disabled={activation.isPending} onClick={() => activation.mutate(false)}>
              {activation.isPending ? copy.saving : copy.confirmDeactivate}
            </button>
            <button type="button" className="crm-button crm-button--quiet" onClick={() => setPreview(null)}>
              {copy.keepActive}
            </button>
          </div>
        </div>
      ) : (
        <div className="su-actions" style={{ justifyContent: "flex-start" }}>
          <button type="button" className="crm-button crm-button--danger" disabled={loading} onClick={() => void startPreview()}>
            {loading ? copy.saving : copy.deactivate}
          </button>
        </div>
      )}
    </div>
  );
}
