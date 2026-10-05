"use client";
/**
 * RingCentral Accounts (Owner; all-numbers/CONTRACT.md §4.5–4.7, §6): every RingCentral User in the directory (plus a
 * connected extension that left it, flagged) and the Agent each one is connected to. Connect or Change (Agent + role),
 * Disconnect (confirmed), a one-click "Connect {name}" for the server's suggestion, "Suggest matches", and Message (the
 * existing nudge flow). A change takes effect on the server immediately; there is no review step here.
 */
import { useEffect, useId, useState, type ReactNode } from "react";
import { Link2, Link2Off, MessageSquare, RefreshCw, Sparkles, UserCheck, UserX } from "lucide-react";
import { ACCOUNT_ROLES, type Account, type AccountRole, type AgentRef } from "@/lib/api/allNumbers";
import { isSalesOutreachApiError } from "@/lib/api/salesOutreach";
import { isRevisionConflict, useAccounts, useConnectAgentCommand, useSuggestMatchesCommand } from "../data/use-numbers";
import { absoluteTime, relativeDay } from "../lib/format";
import { deskCopy } from "../outreach-desk-copy";
import { Avatar, DeskHeader, Notice, Pill, SkeletonLine, SummaryCard } from "../primitives";
import { MessagePanel } from "./message-panel";

const c = deskCopy.accounts;

type Flash = { tone: "green" | "red"; text: string } | null;

function commandError(error: unknown): string {
  if (isRevisionConflict(error)) return c.conflict;
  return deskCopy.errors.failed(isSalesOutreachApiError(error) ? error.message : null);
}

function AgentEditor({
  account,
  agents,
  pending,
  onSave,
  onCancel,
}: {
  account: Account;
  agents: AgentRef[];
  pending: boolean;
  onSave: (agentId: string, role: AccountRole) => void;
  onCancel: () => void;
}) {
  const agentId = useId();
  const roleId = useId();
  const [agent, setAgent] = useState(account.agent?.id ?? account.suggestion?.agent_id ?? "");
  const [role, setRole] = useState<AccountRole>(account.role ?? "sales_rep");
  const options = account.agent && !agents.some((row) => row.id === account.agent!.id) ? [...agents, account.agent] : agents;
  const unchanged = agent === (account.agent?.id ?? "") && role === (account.role ?? "sales_rep");
  return (
    <form
      className="od-editor"
      aria-label={c.editor.title(account.name ?? c.unnamed)}
      onSubmit={(event) => {
        event.preventDefault();
        if (agent) onSave(agent, role);
      }}
    >
      <div className="od-lead__control">
        <label htmlFor={agentId} className="od-lead__label">
          {c.editor.agent}
        </label>
        <select id={agentId} className="od-select od-select--plain" value={agent} onChange={(event) => setAgent(event.target.value)} autoFocus>
          <option value="">{c.editor.chooseAgent}</option>
          {options.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </select>
      </div>
      <div className="od-lead__control">
        <label htmlFor={roleId} className="od-lead__label">
          {c.editor.role}
        </label>
        <select id={roleId} className="od-select od-select--plain" value={role} onChange={(event) => setRole(event.target.value as AccountRole)}>
          {ACCOUNT_ROLES.map((value) => (
            <option key={value} value={value}>
              {c.roles[value]}
            </option>
          ))}
        </select>
      </div>
      <div className="od-editor__actions">
        <button type="submit" className="od-button od-button--primary" disabled={!agent || unchanged || pending}>
          {pending ? c.editor.saving : c.editor.save}
        </button>
        <button type="button" className="od-button od-button--quiet" onClick={onCancel} disabled={pending}>
          {c.editor.cancel}
        </button>
      </div>
      <p className="od-editor__hint">{c.editor.hint}</p>
    </form>
  );
}

function UserCell({ account }: { account: Account }) {
  const name = account.name ?? c.unnamed;
  return (
    <div className="od-person">
      <Avatar name={name} />
      <div className="od-person__text">
        <span className="od-strong">{name}</span>
        <span className="od-cell__sub">
          {account.extension_number ? c.ext(account.extension_number) : c.noExt}
          {!account.in_directory ? (
            <>
              {" "}
              <Pill variant="amber">{c.notInDirectory}</Pill>
            </>
          ) : account.status && account.status !== "Enabled" ? (
            <>
              {" "}
              <Pill variant="neutral">{account.status}</Pill>
            </>
          ) : null}
        </span>
      </div>
    </div>
  );
}

function AccountRow({
  account,
  pending,
  onConnectSuggested,
  onEdit,
  onDisconnect,
  onMessage,
  below,
}: {
  account: Account;
  pending: boolean;
  onConnectSuggested: () => void;
  onEdit: () => void;
  onDisconnect: () => void;
  onMessage: () => void;
  below: ReactNode;
}) {
  const name = account.name ?? c.unnamed;
  return (
    <>
      <tr data-extension={account.extension_id} data-connected={account.agent ? "true" : "false"}>
        <td data-label={c.columns.user}>
          <UserCell account={account} />
        </td>
        <td data-label={c.columns.direct}>
          {account.direct_numbers.length ? (
            <>
              <span className="od-nowrap">{account.direct_numbers[0]}</span>
              {account.direct_numbers.length > 1 ? <span className="od-cell__sub">+{account.direct_numbers.length - 1}</span> : null}
            </>
          ) : (
            <span className="od-text-muted">{c.noDirect}</span>
          )}
        </td>
        <td data-label={c.columns.agent}>
          {account.agent ? (
            <span className="od-person od-person--sm">
              <Avatar name={account.agent.name} size="sm" />
              <span className="od-strong">{account.agent.name}</span>
            </span>
          ) : (
            <span className="od-agentcell">
              <Pill variant="amber">{c.notConnected}</Pill>
              {account.suggestion ? (
                <button type="button" className="od-chip od-chip--suggest" disabled={pending} onClick={onConnectSuggested}>
                  <Sparkles aria-hidden="true" />
                  {c.connectSuggested(account.suggestion.agent_name)}
                </button>
              ) : null}
            </span>
          )}
        </td>
        <td data-label={c.columns.role}>{account.role ? <Pill variant="neutral">{c.roles[account.role]}</Pill> : <span className="od-text-muted">{c.noRole}</span>}</td>
        <td data-label={c.columns.actions}>
          <div className="od-rowactions">
            <button type="button" className="od-button" disabled={pending} onClick={onEdit} aria-label={`${account.agent ? c.change : c.connect}: ${name}`}>
              <Link2 aria-hidden="true" />
              {account.agent ? c.change : c.connect}
            </button>
            {account.agent ? (
              <button type="button" className="od-button od-button--quiet" disabled={pending} onClick={onDisconnect} aria-label={`${c.disconnect}: ${name}`}>
                <Link2Off aria-hidden="true" />
                {c.disconnect}
              </button>
            ) : null}
            {account.can_message ? (
              <button type="button" className="od-button od-button--quiet od-button--icon" onClick={onMessage} aria-label={`${c.message}: ${name}`} title={c.message}>
                <MessageSquare aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </td>
      </tr>
      {below ? (
        <tr className="od-row-editor">
          <td colSpan={5}>{below}</td>
        </tr>
      ) : null}
    </>
  );
}

export function AccountsView() {
  const accounts = useAccounts();
  const connect = useConnectAgentCommand();
  const suggest = useSuggestMatchesCommand();
  const [editing, setEditing] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [messaging, setMessaging] = useState<string | null>(null);
  const [flash, setFlash] = useState<Flash>(null);
  const data = accounts.data?.data ?? null;
  const asOf = accounts.data?.as_of ?? null;
  const rows = data?.accounts ?? [];
  const messageAccount = messaging ? (rows.find((row) => row.extension_id === messaging) ?? null) : null;

  useEffect(() => {
    if (!messaging) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMessaging(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [messaging]);

  const run = (account: Account, agentId: string | null, role?: AccountRole) => {
    setFlash(null);
    const name = account.name ?? c.unnamed;
    connect.mutate(
      {
        extensionId: account.extension_id,
        body: { agent_id: agentId, ...(role ? { role } : {}), ...(account.link_revision !== null ? { link_revision: account.link_revision } : {}) },
      },
      {
        onSuccess: (result) => {
          setEditing(null);
          setConfirming(null);
          const agent = result.data.account.agent;
          setFlash({ tone: "green", text: agent ? c.connected(agent.name, name) : c.disconnected(name) });
        },
        onError: (error) => setFlash({ tone: "red", text: commandError(error) }),
      },
    );
  };

  const runSuggest = () => {
    setFlash(null);
    const before = rows.filter((row) => row.suggestion).length;
    suggest.mutate(undefined, {
      onSuccess: (result) => {
        const found = result.data.accounts.filter((row) => row.suggestion).length - before;
        setFlash({ tone: "green", text: found > 0 ? c.suggested(found) : c.suggestedNone });
      },
      onError: (error) => setFlash({ tone: "red", text: commandError(error) }),
    });
  };

  const inDirectory = rows.filter((row) => row.in_directory);
  const connectedCount = inDirectory.filter((row) => row.agent).length;
  const notConnected = inDirectory.length - connectedCount;
  const suggestions = rows.filter((row) => !row.agent && row.suggestion).length;

  return (
    <>
      <div className="od-scroll" data-testid="accounts-scroll">
        <div className="od-page">
          <DeskHeader
            title={deskCopy.titles.accounts}
            subtitle={c.subtitle}
            right={
              <div className="od-header__actions">
                <span className="od-text-muted od-small" title={data?.directory_at ? absoluteTime(data.directory_at) : undefined}>
                  {data ? (data.directory_at && asOf ? c.directoryAt(relativeDay(data.directory_at, asOf)) : c.noDirectory) : null}
                </span>
                <button type="button" className="od-button od-button--primary" onClick={runSuggest} disabled={suggest.isPending || !data}>
                  <Sparkles aria-hidden="true" />
                  {suggest.isPending ? c.suggesting : c.suggest}
                </button>
              </div>
            }
          />
          <div className="od-summary-row od-summary-row--3">
            <SummaryCard
              testId="card-connected"
              icon={UserCheck}
              tone="green"
              title={c.cards.connected}
              value={data ? String(connectedCount) : <SkeletonLine width={40} height={22} />}
              caption={data ? c.cards.connectedCaption(inDirectory.length) : null}
            />
            <SummaryCard
              testId="card-not-connected"
              icon={UserX}
              tone={notConnected ? "amber" : "gray"}
              title={c.cards.notConnected}
              value={data ? String(notConnected) : <SkeletonLine width={40} height={22} />}
              caption={data ? c.cards.notConnectedCaption : null}
            />
            <SummaryCard
              testId="card-suggestions"
              icon={Sparkles}
              tone="blue"
              title={c.cards.suggestions}
              value={data ? String(suggestions) : <SkeletonLine width={40} height={22} />}
              caption={data ? c.cards.suggestionsCaption : null}
            />
          </div>
          {flash ? (
            <p className={flash.tone === "red" ? "od-flash od-flash--red" : "od-flash"} role={flash.tone === "red" ? "alert" : "status"}>
              {flash.text}
            </p>
          ) : null}
          {accounts.isError && !data ? (
            <Notice icon={RefreshCw} title={c.error}>
              <button type="button" className="od-button" onClick={() => void accounts.refetch()}>
                {c.retry}
              </button>
            </Notice>
          ) : (
            <section className="od-card" aria-labelledby="od-accounts-title" data-testid="accounts-list">
              <div className="od-card__head">
                <h2 id="od-accounts-title" className="od-card__title">
                  {c.listTitle}
                </h2>
              </div>
              <div className="od-table-wrap">
                <table className="od-table od-table--accounts od-table--cards" aria-busy={accounts.isFetching}>
                  <thead>
                    <tr>
                      <th scope="col">{c.columns.user}</th>
                      <th scope="col">{c.columns.direct}</th>
                      <th scope="col">{c.columns.agent}</th>
                      <th scope="col">{c.columns.role}</th>
                      <th scope="col">
                        <span className="od-sr-only">{c.columns.actions}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {!data ? (
                      [0, 1, 2, 3].map((index) => (
                        <tr key={index}>
                          <td colSpan={5}>
                            <SkeletonLine />
                          </td>
                        </tr>
                      ))
                    ) : rows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="od-empty">
                          {c.empty}
                        </td>
                      </tr>
                    ) : (
                      rows.map((account) => (
                        <AccountRow
                          key={account.extension_id}
                          account={account}
                          pending={connect.isPending}
                          onConnectSuggested={() => account.suggestion && run(account, account.suggestion.agent_id)}
                          onEdit={() => {
                            setConfirming(null);
                            setEditing(editing === account.extension_id ? null : account.extension_id);
                          }}
                          onDisconnect={() => {
                            setEditing(null);
                            setConfirming(account.extension_id);
                          }}
                          onMessage={() => setMessaging(account.extension_id)}
                          below={
                            editing === account.extension_id ? (
                              <AgentEditor
                                account={account}
                                agents={data.agents}
                                pending={connect.isPending}
                                onSave={(agentId, role) => run(account, agentId, role)}
                                onCancel={() => setEditing(null)}
                              />
                            ) : confirming === account.extension_id && account.agent ? (
                              <div className="od-confirm" role="group" aria-label={c.disconnect}>
                                <p>{c.confirm.text(account.agent.name, account.name ?? c.unnamed)}</p>
                                <div className="od-editor__actions">
                                  <button type="button" className="od-button od-button--danger" disabled={connect.isPending} onClick={() => run(account, null)}>
                                    {c.confirm.yes}
                                  </button>
                                  <button type="button" className="od-button od-button--quiet" disabled={connect.isPending} onClick={() => setConfirming(null)}>
                                    {c.confirm.no}
                                  </button>
                                </div>
                              </div>
                            ) : null
                          }
                        />
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      </div>
      {messageAccount ? (
        <div className="od-drawer od-drawer--wide" role="dialog" aria-modal="false" aria-label={deskCopy.message.region}>
          <MessagePanel key={messageAccount.extension_id} account={messageAccount} onClose={() => setMessaging(null)} />
        </div>
      ) : null}
    </>
  );
}
