"use client";
/**
 * The People sheets (`?person=<agent id>&edit=roster|login|extension|ringcentral`, and `?new=1`): each is a wide
 * `RecordDrawer` around the block that carries today's logic for that part. Add person is the short path of doc 19: the
 * Roster first (the card appears once it is saved), then three optional steps, each its own existing command.
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
import type { PeopleModel, Person } from "./people-model";
import { RingCentralBlock } from "./ringcentral-block";
import { RosterCreateBlock, RosterEditBlock } from "./roster-block";
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
  const title = edit === "roster" ? c.sheet.roster(agent.name) : edit === "login" ? c.sheet.login(agent.name) : edit === "extension" ? c.sheet.extension(agent.name) : c.sheet.ringcentral(agent.name);
  return (
    <RecordDrawer title={title} onClose={onClose} wide testId="person-sheet">
      {edit === "roster" ? <RosterEditBlock key={`${agent.id}-${agent.name}-${agent.active}`} agent={agent} onSaved={() => undefined} /> : null}
      {edit === "login" ? (
        <LoginBlock
          key={person.user?.id ?? "new"}
          agent={{ id: agent.id, name: agent.name, active: agent.active }}
          user={person.user}
          users={loginUsersOf(context.model)}
          agents={agentOptionsOf(context.model)}
          agentsFailed={context.agentsFailed}
        />
      ) : null}
      {edit === "extension" ? <ExtensionBlock extensionUser={person.extensionUser} defaultEmail={person.user?.email ?? ""} /> : null}
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

/** `?new=1`: Roster → dashboard login → Granot extension → RingCentral. */
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
              <ExtensionBlock extensionUser={person?.extensionUser ?? null} defaultEmail={loginEmail || person?.user?.email || ""} />
            </OptionalStep>
            <OptionalStep n={4} title={c.addPerson.steps.ringcentral}>
              <RingCentralBlock agent={agent} linked={person?.accounts ?? []} directory={context.directory?.accounts ?? null} />
            </OptionalStep>
            <div className="su-actions">
              <button type="button" className="crm-button crm-button--primary" onClick={onClose}>
                {c.sheet.done}
              </button>
            </div>
          </>
        ) : null}
      </div>
    </RecordDrawer>
  );
}
