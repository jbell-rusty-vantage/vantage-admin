"use client";
/**
 * The RingCentral part of a person: connect an account from the directory, change its role, disconnect. This is the Desk's
 * own command (`POST accounts/:extension_id/agent`) with the same `link_revision` optimistic lock: a stale revision is a
 * conflict and says the same words as the Desk's Accounts view. The Desk keeps its own Accounts view; this is the same
 * Owner write from Setup.
 */
import { useId, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ACCOUNT_ROLES,
  accountCommandSchema,
  allNumbersCommand,
  allNumbersPaths,
  type Account,
  type AccountRole,
  type ConnectAgentRequest,
} from "@/lib/api/allNumbers";
import { isSalesOutreachApiError, newIdempotencyKey } from "@/lib/api/salesOutreach";
import { PEOPLE_COPY } from "./people-copy";
import { accountReviewed } from "./people-model";
import { invalidatePeople } from "./use-people";

const c = PEOPLE_COPY.ringcentralSheet;
const roleWord = (role: string | null) => (role ? (PEOPLE_COPY.ringcentral.roleWord[role] ?? role) : PEOPLE_COPY.ringcentral.noRole);

export const accountName = (account: Pick<Account, "name">): string => account.name ?? c.unnamed;

/** The `POST accounts/:extension_id/agent` body: the Agent (or null to disconnect), the role when chosen, and the revision the Owner read. */
export function connectBody(account: Pick<Account, "link_revision">, agentId: string | null, role?: AccountRole | null): ConnectAgentRequest {
  return { agent_id: agentId, ...(role ? { role } : {}), ...(account.link_revision !== null ? { link_revision: account.link_revision } : {}) };
}

/** The directory accounts the Owner can connect: in the directory and not connected yet; the server's suggestion for this Agent first. */
export function connectableAccounts(accounts: Account[], agentId: string): Account[] {
  const rank = (account: Account) => (account.suggestion?.agent_id === agentId ? 0 : 1);
  return accounts
    .filter((account) => account.in_directory && !account.agent)
    .sort((a, b) => rank(a) - rank(b) || accountName(a).localeCompare(accountName(b)));
}

/** The sentence for a refused write: a stale link revision says the Desk's words. */
export function connectError(error: unknown): string {
  if (isSalesOutreachApiError(error) && error.code === "REVISION_CONFLICT") return c.conflict;
  return c.failed(isSalesOutreachApiError(error) ? error.message : error instanceof Error ? error.message : null);
}

type Flash = { tone: "done" | "refused"; text: string } | null;

export function useConnectAccount() {
  const queryClient = useQueryClient();
  const last = useRef<{ payload: string; key: string } | null>(null);
  return useMutation({
    mutationFn: ({ extensionId, body }: { extensionId: string; body: ConnectAgentRequest }) => {
      const payload = JSON.stringify({ extensionId, body });
      if (last.current?.payload !== payload) last.current = { payload, key: newIdempotencyKey("account-agent") };
      return allNumbersCommand(allNumbersPaths.accountAgent(extensionId), body, last.current.key, accountCommandSchema);
    },
    onSuccess: () => {
      last.current = null;
    },
    // The link decides call credit and rep names everywhere: refresh the directory and the Desk's number reads, success or not (a conflict loads the latest).
    onSettled: () => invalidatePeople(queryClient),
  });
}

export function RingCentralBlock({
  agent,
  linked,
  directory,
  onChanged,
}: {
  agent: { id: string; name: string };
  /** The accounts connected to this Agent now. */
  linked: Account[];
  /** The whole directory read, or null when it is not loaded. */
  directory: Account[] | null;
  onChanged?: () => void;
}) {
  const [flash, setFlash] = useState<Flash>(null);
  const connect = useConnectAccount();

  const run = (account: Account, agentId: string | null, role?: AccountRole | null) => {
    setFlash(null);
    connect.mutate(
      { extensionId: account.extension_id, body: connectBody(account, agentId, role) },
      {
        onSuccess: (result) => {
          const connected = result.data.account.agent;
          setFlash({ tone: "done", text: connected ? c.connected(connected.name, accountName(account)) : c.disconnected(accountName(account)) });
          onChanged?.();
        },
        onError: (error) => setFlash({ tone: "refused", text: connectError(error) }),
      },
    );
  };

  return (
    <div className="su-sheet">
      {flash ? (
        <p className={flash.tone === "refused" ? "su-errors" : "su-review"} role={flash.tone === "refused" ? "alert" : "status"}>
          {flash.text}
        </p>
      ) : null}
      {linked.length > 0 ? (
        <section className="su-block">
          <h4 className="su-block__head">{c.connectedNow}</h4>
          {linked.map((account) => (
            <LinkedAccount key={`${account.extension_id}-${account.link_revision}`} account={account} agentName={agent.name} pending={connect.isPending} onSave={(role) => run(account, agent.id, role)} onDisconnect={() => run(account, null)} />
          ))}
        </section>
      ) : null}
      <section className="su-block">
        {directory === null ? <p className="su-errors">{c.directoryMissing}</p> : <ConnectPicker agentId={agent.id} accounts={directory} pending={connect.isPending} onConnect={(account, role) => run(account, agent.id, role)} />}
      </section>
    </div>
  );
}

function RoleSelect({ id, value, onChange, placeholder }: { id: string; value: AccountRole | ""; onChange: (role: AccountRole | "") => void; placeholder?: string }) {
  return (
    <select id={id} className="su-input" value={value} onChange={(event) => onChange(event.target.value as AccountRole | "")}>
      {placeholder ? <option value="">{placeholder}</option> : null}
      {ACCOUNT_ROLES.map((role) => (
        <option key={role} value={role}>
          {roleWord(role)}
        </option>
      ))}
    </select>
  );
}

function LinkedAccount({ account, agentName, pending, onSave, onDisconnect }: { account: Account; agentName: string; pending: boolean; onSave: (role: AccountRole | null) => void; onDisconnect: () => void }) {
  const id = useId();
  const [role, setRole] = useState<AccountRole | "">(account.role ?? "");
  const [confirming, setConfirming] = useState(false);
  const reviewed = accountReviewed(account);
  return (
    <div className="su-fields" data-testid="linked-account">
      <p className="su-review">
        {accountName(account)} · {PEOPLE_COPY.ringcentral.ext(account.extension_number)} · {reviewed ? PEOPLE_COPY.ringcentral.reviewed : PEOPLE_COPY.ringcentral.notReviewed}
      </p>
      <div className="su-row">
        <label className="su-row__label" htmlFor={id}>
          {c.role}
        </label>
        <RoleSelect id={id} value={role} onChange={setRole} placeholder={c.rolePlaceholder} />
      </div>
      {confirming ? (
        <>
          <p className="su-quiet">{c.disconnectConfirm(agentName, accountName(account))}</p>
          <div className="su-actions">
            <button type="button" className="crm-button crm-button--danger" disabled={pending} onClick={onDisconnect}>
              {c.disconnect}
            </button>
            <button type="button" className="crm-button crm-button--quiet" onClick={() => setConfirming(false)}>
              {c.keep}
            </button>
          </div>
        </>
      ) : (
        <div className="su-actions">
          <button type="button" className="crm-button crm-button--quiet" disabled={pending} onClick={() => setConfirming(true)}>
            {c.disconnect}
          </button>
          <button type="button" className="crm-button crm-button--primary" disabled={pending || role === (account.role ?? "")} onClick={() => onSave(role === "" ? null : role)}>
            {c.saveRole}
          </button>
        </div>
      )}
    </div>
  );
}

function ConnectPicker({ agentId, accounts, pending, onConnect }: { agentId: string; accounts: Account[]; pending: boolean; onConnect: (account: Account, role: AccountRole | null) => void }) {
  const ids = { pick: useId(), role: useId() };
  const options = connectableAccounts(accounts, agentId);
  const [extensionId, setExtensionId] = useState("");
  const [role, setRole] = useState<AccountRole | "">("");
  const chosen = options.find((account) => account.extension_id === extensionId) ?? null;

  if (options.length === 0) return <p className="su-quiet">{c.noneFree}</p>;
  return (
    <div className="su-fields">
      <div className="su-row">
        <label className="su-row__label" htmlFor={ids.pick}>
          {c.pick}
        </label>
        <select id={ids.pick} className="su-input" value={extensionId} onChange={(event) => setExtensionId(event.target.value)}>
          <option value="">{c.pickPlaceholder}</option>
          {options.map((account) => (
            <option key={account.extension_id} value={account.extension_id}>
              {accountName(account)}
              {account.extension_number ? ` · ext ${account.extension_number}` : ""}
              {account.suggestion?.agent_id === agentId ? " · suggested" : ""}
            </option>
          ))}
        </select>
        <p className="su-row__hint">{chosen?.suggestion?.agent_id === agentId ? c.suggested(chosen.suggestion.agent_name, chosen.extension_number) : c.connectHint}</p>
      </div>
      <div className="su-row">
        <label className="su-row__label" htmlFor={ids.role}>
          {c.role}
        </label>
        <RoleSelect id={ids.role} value={role} onChange={setRole} placeholder={c.rolePlaceholder} />
      </div>
      <div className="su-actions">
        <button type="button" className="crm-button crm-button--primary" disabled={!chosen || pending} onClick={() => (chosen ? onConnect(chosen, role === "" ? null : role) : undefined)}>
          {c.connect}
        </button>
      </div>
    </div>
  );
}
