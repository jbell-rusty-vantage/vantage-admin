"use client";
/**
 * Setup → Money (`/setup/money`, doc 19 "Money"): Merchants that take deposits, as a card list with rename, deactivate
 * (dependency preview and reason) and reactivate in a small sheet. The Registry's rules are kept: records are never
 * deleted, and deactivating reads what depends on the Merchant first. Rep compensation is server work; one line says so
 * and links to Today → Money.
 */
import Link from "next/link";
import { useId, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Landmark, Plus } from "lucide-react";
import { RecordDrawer } from "@/components/records";
import { SetupSectionHead, useSetupReadOnly } from "@/components/setup/setup-shell";
import { ActivationBlock, dependencyCount } from "@/components/setup/people/catalog-activation";
import { invalidatePeople } from "@/components/setup/people/use-people";
import { Chip, IconBadge, Notice, Pill, ReadFailure, SkeletonLine } from "@/components/ui/crm/primitives";
import {
  createRegistryCatalogItem,
  fetchRegistryCatalog,
  previewRegistryCatalogDependencies,
  updateRegistryCatalogItem,
  type CatalogUpdateInput,
  type RegistryCatalogItem,
} from "@/lib/api/registryAgents";
import { formatRegistryError } from "@/lib/api/registryRequest";
import { queryKeys } from "@/lib/query/keys";
import { MONEY_COPY as c } from "./money-copy";

/** The PATCH body for a rename: the new name and the reason; null when the name did not change. Pure so a test covers it. */
export function merchantUpdateBody(merchant: Pick<RegistryCatalogItem, "name">, draft: { name: string; reason: string }): CatalogUpdateInput | null {
  if (draft.name.trim() === merchant.name || !draft.name.trim()) return null;
  return { name: draft.name.trim(), ...(draft.reason.trim() ? { reason: draft.reason.trim() } : {}) };
}

/** Names the Merchant used to go by (the read's aliases from renames), without the current name. */
export function merchantAliases(merchant: Pick<RegistryCatalogItem, "name" | "name_aliases">): string[] {
  return (merchant.name_aliases ?? []).filter((alias) => alias.trim() && alias.trim().toLowerCase() !== merchant.name.trim().toLowerCase());
}

export function MerchantCards({ items, readOnly, onEdit }: { items: RegistryCatalogItem[]; readOnly: boolean; onEdit: (id: string) => void }) {
  if (items.length === 0) return <Notice icon={Landmark} title={c.empty} testId="merchants-empty" />;
  return (
    <div className="mn-list" data-testid="merchant-list">
      {items.map((merchant) => {
        const aliases = merchantAliases(merchant);
        return (
          <article key={merchant.id} className="crm-card mn-card" data-testid="merchant-card" aria-label={merchant.name}>
            <div className="crm-card__head">
              <span className="mn-head">
                <IconBadge icon={Landmark} tone={merchant.active ? "blue" : "gray"} />
                <span>
                  <h3 className="crm-card__title">{merchant.name}</h3>
                  {aliases.length > 0 ? <p className="crm-card__subtitle">{c.alsoKnownAs(aliases.join(", "))}</p> : null}
                </span>
              </span>
              <span className="mn-pills">
                <Pill variant={merchant.active ? "green" : "gray"}>{merchant.active ? c.active : c.inactive}</Pill>
                {readOnly ? null : (
                  <button type="button" className="crm-button crm-button--quiet crm-button--sm" onClick={() => onEdit(merchant.id)} aria-label={`${c.edit}: ${merchant.name}`}>
                    {c.edit}
                  </button>
                )}
              </span>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function MerchantSheet({ merchant, onClose }: { merchant: RegistryCatalogItem; onClose: () => void }) {
  const ids = { name: useId(), reason: useId() };
  const queryClient = useQueryClient();
  const [name, setName] = useState(merchant.name);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<{ tone: "done" | "refused"; text: string } | null>(null);
  const body = merchantUpdateBody(merchant, { name, reason });

  const preview = useQuery({
    queryKey: queryKeys.operationsRegistry.dependencies("merchants", merchant.id),
    queryFn: () => previewRegistryCatalogDependencies("merchants", merchant.id),
  });
  const deposits = dependencyCount(preview.data, /deposit/i);

  const save = useMutation({
    mutationFn: (input: CatalogUpdateInput) => updateRegistryCatalogItem("merchants", merchant.id, input),
    onSuccess: async () => {
      await invalidatePeople(queryClient);
      setReason("");
      setMessage({ tone: "done", text: c.saved });
    },
    onError: (failure) => setMessage({ tone: "refused", text: formatRegistryError(failure) }),
  });

  return (
    <RecordDrawer title={c.editTitle(merchant.name)} onClose={onClose} testId="merchant-sheet">
      <div className="su-sheet">
        <section className="su-block">
          {message ? (
            <p className={message.tone === "refused" ? "su-errors" : "su-review"} role={message.tone === "refused" ? "alert" : "status"}>
              {message.text}
            </p>
          ) : null}
          <p className="su-review" data-testid="deposits-recorded">
            {preview.isPending ? <SkeletonLine width={160} /> : preview.isError ? c.previewFailed : deposits !== null ? c.depositsRecorded(deposits) : c.previewTotal(preview.data.total)}
          </p>
          <div className="su-fields">
            <div className="su-row">
              <label className="su-row__label" htmlFor={ids.name}>
                {c.name}
              </label>
              <input id={ids.name} className="su-input" value={name} onChange={(event) => setName(event.target.value)} />
              <p className="su-row__hint">{c.nameHint}</p>
            </div>
            <div className="su-row">
              <label className="su-row__label" htmlFor={ids.reason}>
                {c.reason}
              </label>
              <input id={ids.reason} className="su-input" value={reason} onChange={(event) => setReason(event.target.value)} placeholder={c.reasonPlaceholder} />
            </div>
          </div>
          {merchant.deactivation_reason ? <p className="su-quiet">{c.deactivationReason(merchant.deactivation_reason)}</p> : null}
          <div className="su-actions">
            <button type="button" className="crm-button crm-button--primary" disabled={!body || save.isPending} onClick={() => (body ? save.mutate(body) : undefined)}>
              {save.isPending ? c.saving : c.save}
            </button>
          </div>
        </section>
        <section className="su-block">
          <ActivationBlock kind="merchants" item={merchant} reason={reason} copy={c} onChanged={(text) => setMessage({ tone: "done", text })} />
        </section>
      </div>
    </RecordDrawer>
  );
}

function AddMerchantSheet({ onClose }: { onClose: () => void }) {
  const id = useId();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [message, setMessage] = useState<{ tone: "done" | "refused"; text: string } | null>(null);
  const create = useMutation({
    mutationFn: () => createRegistryCatalogItem("merchants", { name: name.trim() }),
    onSuccess: async () => {
      await invalidatePeople(queryClient);
      setName("");
      setMessage({ tone: "done", text: c.created });
    },
    onError: (failure) => setMessage({ tone: "refused", text: formatRegistryError(failure) }),
  });
  return (
    <RecordDrawer title={c.addTitle} onClose={onClose} testId="add-merchant-sheet">
      <form
        className="su-sheet su-fields"
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) {
            setMessage({ tone: "refused", text: c.nameRequired });
            return;
          }
          create.mutate();
        }}
      >
        {message ? (
          <p className={message.tone === "refused" ? "su-errors" : "su-review"} role={message.tone === "refused" ? "alert" : "status"}>
            {message.text}
          </p>
        ) : null}
        <div className="su-row">
          <label className="su-row__label" htmlFor={id}>
            {c.name}
          </label>
          <input id={id} className="su-input" value={name} onChange={(event) => setName(event.target.value)} placeholder={c.namePlaceholder} autoComplete="off" />
        </div>
        <div className="su-actions">
          <button type="submit" className="crm-button crm-button--primary" disabled={create.isPending}>
            {create.isPending ? c.saving : c.create}
          </button>
        </div>
      </form>
    </RecordDrawer>
  );
}

export function MoneySection() {
  const readOnly = useSetupReadOnly();
  const [includeInactive, setIncludeInactive] = useState(false);
  const [open, setOpen] = useState<string | "new" | null>(null);
  const merchants = useQuery({
    queryKey: queryKeys.operationsRegistry.merchants(true),
    queryFn: () => fetchRegistryCatalog("merchants", { includeInactive: true }),
  });
  const items = (merchants.data ?? []).filter((merchant) => includeInactive || merchant.active).sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));
  const opened = open && open !== "new" ? ((merchants.data ?? []).find((merchant) => merchant.id === open) ?? null) : null;

  return (
    <>
      <SetupSectionHead
        section="money"
        right={
          readOnly ? null : (
            <button type="button" className="crm-button crm-button--primary" onClick={() => setOpen("new")}>
              <Plus aria-hidden="true" width={16} height={16} />
              {c.add}
            </button>
          )
        }
      />
      {readOnly ? <p className="su-quiet">{c.readOnlyNote}</p> : null}
      <div className="mn-toolbar">
        <h3 className="mn-title">{c.merchants}</h3>
        <Chip active={includeInactive} onClick={() => setIncludeInactive(!includeInactive)}>
          {c.includeInactive}
        </Chip>
      </div>
      {merchants.isPending ? (
        <div className="crm-card crm-stack" aria-busy="true" style={{ padding: 16 }}>
          <SkeletonLine width="40%" height={18} />
          <SkeletonLine width="70%" />
        </div>
      ) : merchants.isError ? (
        <ReadFailure what={c.readFailed} error={merchants.error} onRetry={() => void merchants.refetch()} />
      ) : (
        <MerchantCards items={items} readOnly={readOnly} onEdit={setOpen} />
      )}
      <p className="su-quiet" data-testid="rep-pay-note">
        {c.repPay} <Link className="crm-link" href="/?tab=money">{c.repPayLink}</Link>
      </p>
      {!readOnly && opened ? <MerchantSheet key={opened.id} merchant={opened} onClose={() => setOpen(null)} /> : null}
      {!readOnly && open === "new" ? <AddMerchantSheet onClose={() => setOpen(null)} /> : null}
    </>
  );
}

