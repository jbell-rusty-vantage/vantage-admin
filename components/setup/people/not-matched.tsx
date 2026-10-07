"use client";
/**
 * Logins without an Agent (doc 19 "Not matched to a person", widened 2026-10-07): dashboard logins with no Agent,
 * extension logins no card claims, and RingCentral users with no Agent (not Excluded). Owner, Admin and Manager logins
 * live here by design. Every login has an Edit that opens its own sheet; a Rep login, an extension login and an account
 * also get a Connect to… picker that runs the matching command: `agent_id` on the dashboard login (`updateAdminUser`),
 * `agent_id` on the extension login (`updateExtensionUser`), or the RingCentral connect command for an account.
 */
import { useId, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { updateAdminUser, type AdminUser } from "@/components/operations-registry/users/users-api";
import { pickerAgents, type AgentOption } from "@/components/operations-registry/users/users-logic";
import { CrmCard, Pill } from "@/components/ui/crm/primitives";
import { formatExtensionRoleLabels, updateExtensionUser } from "@/lib/api/extensionUsers";
import { refusalState } from "./login-errors";
import { PEOPLE_COPY } from "./people-copy";
import { extensionUserFor, type ExtensionUser, type PeopleModel, type RingCentralAccount } from "./people-model";
import { accountName, connectBody, connectError, useConnectAccount } from "./ringcentral-block";
import { invalidatePeople } from "./use-people";

const c = PEOPLE_COPY.notMatched;

type Message = { tone: "done" | "refused"; text: string } | null;

function Row({ children, note, right }: { children: React.ReactNode; note?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="su-line" data-testid="not-matched-row">
      <span className="pp-value">{children}</span>
      {note ? <span className="su-quiet">{note}</span> : null}
      {right ? <span className="su-line__right">{right}</span> : null}
    </div>
  );
}

function EditButton({ name, onClick }: { name: string; onClick: () => void }) {
  return (
    <button type="button" className="crm-button crm-button--quiet crm-button--sm" onClick={onClick} aria-label={`${PEOPLE_COPY.edit}: ${name}`}>
      {PEOPLE_COPY.edit}
    </button>
  );
}

function MessageLine({ message }: { message: Message }) {
  if (!message) return null;
  return (
    <p className={message.tone === "refused" ? "su-errors" : "su-review"} role={message.tone === "refused" ? "alert" : "status"}>
      {message.text}
    </p>
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

function UserRow({
  user,
  users,
  agents,
  sameEmail,
  onEdit,
  onEditExtension,
}: {
  user: AdminUser;
  users: AdminUser[];
  agents: AgentOption[];
  sameEmail: ExtensionUser | null;
  onEdit: () => void;
  onEditExtension: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<Message>(null);
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
      <Row right={<EditButton name={user.email} onClick={onEdit} />}>
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
      {sameEmail ? (
        <div className="su-line" data-testid="same-email-extension">
          <span className="pp-value su-quiet">{c.sameEmailExtension(formatExtensionRoleLabels(sameEmail.roles))}</span>
          <span className="su-line__right">
            <EditButton name={sameEmail.email} onClick={() => onEditExtension(sameEmail.id)} />
          </span>
        </div>
      ) : null}
      <MessageLine message={message} />
    </>
  );
}

function ExtensionRow({ item, agents, onEdit }: { item: ExtensionUser; agents: AgentOption[]; onEdit: () => void }) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  async function connect(agentId: string) {
    setPending(true);
    try {
      await updateExtensionUser(item.id, { agent_id: agentId });
      await invalidatePeople(queryClient);
      setMessage({ tone: "done", text: c.connected });
    } catch (failure) {
      setMessage({ tone: "refused", text: failure instanceof Error && failure.message ? failure.message : PEOPLE_COPY.ringcentralSheet.failed(null) });
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Row note={c.extensionNote} right={<EditButton name={item.email} onClick={onEdit} />}>
        <span className="su-line__value">{item.email}</span> · {formatExtensionRoleLabels(item.roles)}
        {!item.active ? <> · {PEOPLE_COPY.extension.inactive}</> : null}
      </Row>
      <div className="su-line">
        <ConnectTo label={c.connectToLabel(item.email)} options={agents} pending={pending} onConnect={(agentId) => void connect(agentId)} />
      </div>
      <MessageLine message={message} />
    </>
  );
}

function AccountRow({ account, agents }: { account: RingCentralAccount; agents: AgentOption[] }) {
  const connect = useConnectAccount();
  const [message, setMessage] = useState<Message>(null);
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
      <MessageLine message={message} />
    </>
  );
}

export function NotMatchedSection({
  model,
  agents,
  users,
  onEditLogin = () => undefined,
  onEditExtension = () => undefined,
}: {
  model: PeopleModel;
  agents: AgentOption[];
  users: AdminUser[];
  onEditLogin?: (id: string) => void;
  onEditExtension?: (id: string) => void;
}) {
  const { notMatched, loaded } = model;
  const empty = notMatched.users.length + notMatched.extensionUsers.length + notMatched.accounts.length === 0;
  // An extension login can join an Agent whose card holds none yet.
  const extensionTargets = agents.filter((agent) => !model.people.some((person) => person.agent.id === agent.id && person.extensionUser));
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
              <UserRow
                key={user.id}
                user={user}
                users={users}
                agents={agents}
                sameEmail={extensionUserFor(user, model.extensionUsers)}
                onEdit={() => onEditLogin(user.id)}
                onEditExtension={onEditExtension}
              />
            ))}
          </section>
        ) : null}
        {notMatched.extensionUsers.length > 0 ? (
          <section aria-label={c.extensionUsers}>
            <h3 className="su-block__head">
              {c.extensionUsers} <Pill variant="neutral">{notMatched.extensionUsers.length}</Pill>
            </h3>
            {notMatched.extensionUsers.map((item) => (
              <ExtensionRow key={item.id} item={item} agents={extensionTargets} onEdit={() => onEditExtension(item.id)} />
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
