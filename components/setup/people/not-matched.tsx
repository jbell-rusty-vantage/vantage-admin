"use client";
/**
 * Not matched to a person (doc 19): dashboard logins with no Agent, extension logins with no matching dashboard email,
 * and RingCentral users with no Agent (not Excluded), each with a Connect to… picker. The picker runs the matching
 * command: `agent_id` on the login through `updateAdminUser`, or the RingCentral connect command for an account. An
 * extension login has no Agent field, so it gets its row and an honest note, nothing else.
 */
import { useId, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { updateAdminUser, type AdminUser } from "@/components/operations-registry/users/users-api";
import { pickerAgents, type AgentOption } from "@/components/operations-registry/users/users-logic";
import { CrmCard, Pill } from "@/components/ui/crm/primitives";
import { formatExtensionRoleLabels } from "@/lib/api/extensionUsers";
import { refusalState } from "./login-errors";
import { PEOPLE_COPY } from "./people-copy";
import type { PeopleModel, RingCentralAccount } from "./people-model";
import { accountName, connectBody, connectError, useConnectAccount } from "./ringcentral-block";
import { invalidatePeople } from "./use-people";

const c = PEOPLE_COPY.notMatched;

function Row({ children, note }: { children: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div className="su-line" data-testid="not-matched-row">
      <span className="pp-value">{children}</span>
      {note ? <span className="su-quiet">{note}</span> : null}
    </div>
  );
}

/** The Connect to… picker: an Agent select and a Connect button. */
function ConnectTo({ label, options, pending, onConnect }: { label: string; options: AgentOption[]; pending: boolean; onConnect: (agentId: string) => void }) {
  const id = useId();
  const [agentId, setAgentId] = useState("");
  return (
    <span className="pp-pick su-line__right">
      <label className="su-sr" htmlFor={id} style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
        {label}
      </label>
      <select id={id} className="su-input" value={agentId} onChange={(event) => setAgentId(event.target.value)}>
        <option value="">{c.connectTo}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.active ? option.name : `${option.name} (inactive)`}
          </option>
        ))}
      </select>
      <button type="button" className="crm-button crm-button--sm" disabled={!agentId || pending} onClick={() => onConnect(agentId)}>
        {c.connectButton}
      </button>
    </span>
  );
}

function UserRow({ user, users, agents }: { user: AdminUser; users: AdminUser[]; agents: AgentOption[] }) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: "done" | "refused"; text: string } | null>(null);
  const word = PEOPLE_COPY.loginRoleWord[user.role] ?? user.role;

  async function connect(agentId: string) {
    setPending(true);
    try {
      await updateAdminUser(user.id, { agent_id: agentId });
      await invalidatePeople(queryClient);
      setMessage({ tone: "done", text: c.connected });
    } catch (failure) {
      setMessage({ tone: "refused", text: refusalState(failure).sentence });
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Row>
        <span className="su-line__value">{user.email}</span> · {word}
        {!user.active ? <> · {PEOPLE_COPY.dashboard.deactivated}</> : null}
      </Row>
      {user.role === "rep" ? (
        <div className="su-line">
          <ConnectTo label={c.connectToLabel(user.email)} options={pickerAgents(agents, users, user.id)} pending={pending} onConnect={(agentId) => void connect(agentId)} />
        </div>
      ) : (
        <div className="su-line">
          <span className="su-quiet">{c.noAgentRole(word)}</span>
        </div>
      )}
      {message ? (
        <p className={message.tone === "refused" ? "su-errors" : "su-review"} role={message.tone === "refused" ? "alert" : "status"}>
          {message.text}
        </p>
      ) : null}
    </>
  );
}

function AccountRow({ account, agents }: { account: RingCentralAccount; agents: AgentOption[] }) {
  const connect = useConnectAccount();
  const [message, setMessage] = useState<{ tone: "done" | "refused"; text: string } | null>(null);
  return (
    <>
      <Row note={account.suggestion ? PEOPLE_COPY.ringcentralSheet.suggested(account.suggestion.agent_name, null) : undefined}>
        <span className="su-line__value">{accountName(account)}</span> · {PEOPLE_COPY.ringcentral.ext(account.extension_number)}
        {account.role ? <> · {PEOPLE_COPY.ringcentral.roleWord[account.role] ?? account.role}</> : null}
      </Row>
      <div className="su-line">
        <ConnectTo
          label={c.connectToLabel(accountName(account))}
          options={agents.filter((agent) => agent.active)}
          pending={connect.isPending}
          onConnect={(agentId) => {
            setMessage(null);
            connect.mutate(
              { extensionId: account.extension_id, body: connectBody(account, agentId) },
              {
                onSuccess: () => setMessage({ tone: "done", text: c.connected }),
                onError: (error) => setMessage({ tone: "refused", text: connectError(error) }),
              },
            );
          }}
        />
      </div>
      {message ? (
        <p className={message.tone === "refused" ? "su-errors" : "su-review"} role={message.tone === "refused" ? "alert" : "status"}>
          {message.text}
        </p>
      ) : null}
    </>
  );
}

export function NotMatchedSection({ model, agents, users }: { model: PeopleModel; agents: AgentOption[]; users: AdminUser[] }) {
  const { notMatched, loaded } = model;
  const empty = notMatched.users.length + notMatched.extensionUsers.length + notMatched.accounts.length === 0;
  return (
    <CrmCard title={c.title} subtitle={c.purpose} testId="not-matched">
      <div className="crm-stack">
        {empty ? <p className="su-quiet">{c.none}</p> : null}
        {notMatched.users.length > 0 ? (
          <section aria-label={c.users}>
            <h3 className="su-block__head">
              {c.users} <Pill variant="neutral">{notMatched.users.length}</Pill>
            </h3>
            {notMatched.users.map((user) => (
              <UserRow key={user.id} user={user} users={users} agents={agents} />
            ))}
          </section>
        ) : null}
        {notMatched.extensionUsers.length > 0 ? (
          <section aria-label={c.extensionUsers}>
            <h3 className="su-block__head">
              {c.extensionUsers} <Pill variant="neutral">{notMatched.extensionUsers.length}</Pill>
            </h3>
            {notMatched.extensionUsers.map((item) => (
              <Row key={item.id} note={c.extensionNote}>
                <span className="su-line__value">{item.email}</span> · {formatExtensionRoleLabels(item.roles)}
              </Row>
            ))}
          </section>
        ) : null}
        {notMatched.accounts.length > 0 ? (
          <section aria-label={c.accounts}>
            <h3 className="su-block__head">
              {c.accounts} <Pill variant="neutral">{notMatched.accounts.length}</Pill>
            </h3>
            {notMatched.accounts.map((account) => (
              <AccountRow key={account.extension_id} account={account} agents={agents} />
            ))}
          </section>
        ) : null}
        {!loaded.users || !loaded.extensionUsers || !loaded.accounts ? <p className="su-quiet">{c.notLoaded}</p> : null}
      </div>
    </CrmCard>
  );
}
