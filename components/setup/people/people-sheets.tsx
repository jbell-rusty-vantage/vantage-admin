"use client";
/**
 * The People sheets, each a wide `RecordDrawer` around the block that carries the logic for that part:
 * - `?person=<agent id>&edit=roster|desk|login|extension|ringcentral`: one part of an Agent's card;
 * - `?new=agent` (also the older `?new=1`): Add an Agent, then optional steps (dashboard login, extension login,
 *   RingCentral), each its own existing command;
 * - `?new=login` / `?new=extension`: a dashboard or extension login on its own; a Rep or Sales login can add the Agent it
 *   belongs to without leaving the sheet;
 * - `?login=<id>` / `?ext=<id>`: edit any dashboard or extension login, including one with no Agent.
 */
import { useState, type ReactNode } from "react";
import { RecordDrawer } from "@/components/records";
import type { AdminUser } from "@/components/operations-registry/users/users-api";
import type { AgentOption } from "@/components/operations-registry/users/users-logic";
import type { AccountsData } from "@/lib/api/allNumbers";
import type { RegistryCatalogItem } from "@/lib/api/registryAgents";
import { ExtensionBlock } from "./extension-block";
import { LoginBlock } from "./login-block";
import { PEOPLE_COPY } from "./people-copy";
import type { ExtensionUser, PeopleModel, Person } from "./people-model";
import { RingCentralBlock } from "./ringcentral-block";
import { DeskBlock, RosterCreateBlock, RosterEditBlock } from "./roster-block";
import type { PersonEdit } from "./person-card";

const c = PEOPLE_COPY;

/** What every sheet reads from the section: the live join and the raw directory. */
export type PeopleContext = {
  model: PeopleModel;
  directory: AccountsData | null;
  agentsFailed: boolean;
};

export function agentOptionsOf(model: PeopleModel): AgentOption[] {
  return model.people.map(({ agent }) => ({ id: agent.id, name: agent.name, active: agent.active }));
}

export const loginUsersOf = (model: PeopleModel): AdminUser[] => [...model.people.flatMap((person) => (person.user ? [person.user] : [])), ...model.notMatched.users];

/** The Agents an extension login may connect to: those whose card holds no extension login yet, plus `keep` (its own). */
export function extensionAgentOptions(model: PeopleModel, keep: string | null = null): AgentOption[] {
  return model.people
    .filter(({ agent, extensionUser }) => !extensionUser || agent.id === keep)
    .map(({ agent }) => ({ id: agent.id, name: agent.name, active: agent.active }));
}

const agentOptionFor = (model: PeopleModel, agentId: string | null | undefined): AgentOption | null => agentOptionsOf(model).find((option) => option.id === agentId) ?? null;

function SheetNotice({ children }: { children: ReactNode }) {
  return <p className="su-quiet">{children}</p>;
}

/** One edit sheet for an existing person. */
export function PersonSheet({ edit, person, context, onClose }: { edit: PersonEdit; person: Person | null; context: PeopleContext; onClose: () => void }) {
  if (!person) {
    return (
      <RecordDrawer title={c.sheet.addPerson} onClose={onClose} wide testId="person-sheet">
        <SheetNotice>{c.sheet.notFound}</SheetNotice>
      </RecordDrawer>
    );
  }
  const { agent } = person;
  const option = { id: agent.id, name: agent.name, active: agent.active };
  const titles: Record<PersonEdit, string> = {
    roster: c.sheet.roster(agent.name),
    desk: c.sheet.desk(agent.name),
    login: c.sheet.login(agent.name),
    extension: c.sheet.extension(agent.name),
    ringcentral: c.sheet.ringcentral(agent.name),
  };
  return (
    <RecordDrawer title={titles[edit]} onClose={onClose} wide testId="person-sheet">
      {edit === "roster" ? <RosterEditBlock key={`${agent.id}-${agent.name}-${agent.active}`} agent={agent} onSaved={() => undefined} /> : null}
      {edit === "desk" ? <DeskBlock key={agent.id} agent={agent} /> : null}
      {edit === "login" ? (
        <LoginBlock key={person.user?.id ?? "new"} agent={option} user={person.user} users={loginUsersOf(context.model)} agents={agentOptionsOf(context.model)} agentsFailed={context.agentsFailed} />
      ) : null}
      {edit === "extension" ? <ExtensionBlock extensionUser={person.extensionUser} defaultEmail={person.user?.email ?? ""} agent={option} /> : null}
      {edit === "ringcentral" ? <RingCentralBlock agent={agent} linked={person.accounts} directory={context.directory?.accounts ?? null} /> : null}
    </RecordDrawer>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="su-block" data-testid={`add-step-${n}`}>
      <h4 className="su-block__head">
        <span className="su-step">{n}</span>
        {title}
      </h4>
      {children}
    </section>
  );
}

/** A step the Owner may leave for later: Skip folds it away, and the card's own Edit still reaches it. */
function OptionalStep({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  const [skipped, setSkipped] = useState(false);
  return (
    <Step n={n} title={title}>
      {skipped ? (
        <SheetNotice>{c.sheet.skip}</SheetNotice>
      ) : (
        <>
          {children}
          <div className="su-actions" style={{ justifyContent: "flex-start" }}>
            <button type="button" className="crm-button crm-button--quiet crm-button--sm" onClick={() => setSkipped(true)}>
              {c.sheet.skip}
            </button>
          </div>
        </>
      )}
    </Step>
  );
}

function DoneButton({ onClose }: { onClose: () => void }) {
  return (
    <div className="su-actions">
      <button type="button" className="crm-button crm-button--primary" onClick={onClose}>
        {c.sheet.done}
      </button>
    </div>
  );
}

/** `?new=agent`: Roster (with the Outreach Desk choice) → dashboard login → extension login → RingCentral. */
export function AddPersonSheet({ context, onClose }: { context: PeopleContext; onClose: () => void }) {
  const [created, setCreated] = useState<RegistryCatalogItem | null>(null);
  const [loginEmail, setLoginEmail] = useState("");
  const person = created ? (context.model.people.find((item) => item.agent.id === created.id) ?? null) : null;
  const agent = person?.agent ?? created;

  return (
    <RecordDrawer title={c.sheet.addPerson} onClose={onClose} wide testId="add-person-sheet">
      <div className="su-sheet">
        <Step n={1} title={c.addPerson.steps.roster}>
          {created ? <p className="su-review">{PEOPLE_COPY.rosterSheet.created(created.name)}</p> : <RosterCreateBlock onCreated={setCreated} />}
        </Step>
        {agent ? (
          <>
            <SheetNotice>{c.addPerson.cardNote}</SheetNotice>
            <OptionalStep n={2} title={c.addPerson.steps.login}>
              <LoginBlock
                agent={{ id: agent.id, name: agent.name, active: agent.active }}
                user={person?.user ?? null}
                users={loginUsersOf(context.model)}
                agents={agentOptionsOf(context.model)}
                agentsFailed={context.agentsFailed}
                onChanged={(user) => setLoginEmail(user.email)}
              />
            </OptionalStep>
            <OptionalStep n={3} title={c.addPerson.steps.extension}>
              <ExtensionBlock extensionUser={person?.extensionUser ?? null} defaultEmail={loginEmail || person?.user?.email || ""} agent={{ id: agent.id, name: agent.name, active: agent.active }} />
            </OptionalStep>
            <OptionalStep n={4} title={c.addPerson.steps.ringcentral}>
              <RingCentralBlock agent={agent} linked={person?.accounts ?? []} directory={context.directory?.accounts ?? null} />
            </OptionalStep>
            <DoneButton onClose={onClose} />
          </>
        ) : null}
      </div>
    </RecordDrawer>
  );
}

/** Inline "Not on the roster yet?": adds the Agent a Rep login needs, then hands it back. */
function NewAgentForLogin({ onCreated }: { onCreated: (agent: AgentOption) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="su-block" data-testid="login-new-agent">
      <h4 className="su-block__head">{c.loginSheet.newAgentTitle}</h4>
      {open ? (
        <>
          <SheetNotice>{c.loginSheet.newAgentBody}</SheetNotice>
          <RosterCreateBlock
            compact
            onCreated={(agent) => {
              setOpen(false);
              onCreated({ id: agent.id, name: agent.name, active: agent.active });
            }}
          />
        </>
      ) : (
        <div className="su-actions" style={{ justifyContent: "flex-start" }}>
          <button type="button" className="crm-button crm-button--sm" onClick={() => setOpen(true)}>
            {c.rosterSheet.create}
          </button>
        </div>
      )}
    </section>
  );
}

/** `?new=login`: a dashboard login of any role on its own (a Rep picks or adds its Agent), then an optional extension login. */
export function AddLoginSheet({ context, onClose }: { context: PeopleContext; onClose: () => void }) {
  const [agent, setAgent] = useState<AgentOption | null>(null);
  const [made, setMade] = useState<AdminUser | null>(null);
  const linkedAgent = made?.agent_id ? (agentOptionFor(context.model, made.agent_id) ?? agent) : null;

  return (
    <RecordDrawer title={c.sheet.addLogin} onClose={onClose} wide testId="add-login-sheet">
      <div className="su-sheet">
        <Step n={1} title={c.loginSheet.stepTitle}>
          <LoginBlock
            agent={agent}
            user={null}
            users={loginUsersOf(context.model)}
            agents={agentOptionsOf(context.model)}
            agentsFailed={context.agentsFailed}
            onChanged={setMade}
          />
          {made || agent ? null : <NewAgentForLogin onCreated={setAgent} />}
        </Step>
        {made ? (
          <>
            <OptionalStep n={2} title={c.loginSheet.alsoExtension}>
              <ExtensionBlock extensionUser={null} defaultEmail={made.email} agent={linkedAgent} agents={linkedAgent ? null : extensionAgentOptions(context.model)} />
            </OptionalStep>
            <DoneButton onClose={onClose} />
          </>
        ) : null}
      </div>
    </RecordDrawer>
  );
}

/** `?new=extension`: an extension login of any roles on its own, connected to an Agent or to none. */
export function AddExtensionSheet({ context, onClose }: { context: PeopleContext; onClose: () => void }) {
  return (
    <RecordDrawer title={c.sheet.addExtension} onClose={onClose} wide testId="add-extension-sheet">
      <ExtensionBlock extensionUser={null} defaultEmail="" agents={extensionAgentOptions(context.model)} />
      <DoneButton onClose={onClose} />
    </RecordDrawer>
  );
}

/** `?login=<id>`: one dashboard login, wherever it sits (on a card or without an Agent). */
export function LoginSheet({ userId, context, onClose }: { userId: string; context: PeopleContext; onClose: () => void }) {
  const user = loginUsersOf(context.model).find((item) => item.id === userId) ?? null;
  return (
    <RecordDrawer title={user ? c.sheet.editLogin(user.email) : c.sheet.addLogin} onClose={onClose} wide testId="login-sheet">
      {user ? (
        <LoginBlock
          key={`${user.id}-${user.updated_at}`}
          agent={user.role === "rep" ? agentOptionFor(context.model, user.agent_id) : null}
          user={user}
          users={loginUsersOf(context.model)}
          agents={agentOptionsOf(context.model)}
          agentsFailed={context.agentsFailed}
        />
      ) : (
        <SheetNotice>{c.sheet.loginGone}</SheetNotice>
      )}
    </RecordDrawer>
  );
}

/** `?ext=<id>`: one extension login, with its Agent connection editable (or an Agent added for it). */
export function ExtensionSheet({ extensionId, context, onClose }: { extensionId: string; context: PeopleContext; onClose: () => void }) {
  const extensionUser: ExtensionUser | null = context.model.extensionUsers.find((item) => item.id === extensionId) ?? null;
  const holder = extensionUser ? context.model.people.find((person) => person.extensionUser?.id === extensionUser.id) : undefined;
  return (
    <RecordDrawer title={extensionUser ? c.sheet.editExtension(extensionUser.email) : c.sheet.addExtension} onClose={onClose} wide testId="extension-sheet">
      {extensionUser ? (
        <ExtensionBlock
          key={extensionUser.id}
          extensionUser={extensionUser}
          defaultEmail=""
          agents={extensionAgentOptions(context.model, extensionUser.agent_id ?? holder?.agent.id ?? null)}
        />
      ) : (
        <SheetNotice>{c.sheet.loginGone}</SheetNotice>
      )}
    </RecordDrawer>
  );
}
