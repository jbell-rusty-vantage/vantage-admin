"use client";
/**
 * Setup → People & access (`/setup/people`, doc 19 "One person, one card"). One card per Agent (active first), the four
 * parts joined on the client by `people-model.ts`, a Not matched to a person list at the bottom, and wide sheets held in
 * the URL: `?person=<agent id>&edit=roster|login|extension|ringcentral` and `?new=1`. Admin and Manager read the roster
 * only; every write is the Owner's.
 */
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { UserPlus, Users } from "lucide-react";
import { useDashboardRole } from "@/components/layout/dashboard-role-context";
import { useUrlState } from "@/components/records";
import { SetupSectionHead } from "@/components/setup/setup-shell";
import { Chip, Notice, ReadFailure, SearchBox, SkeletonLine } from "@/components/ui/crm/primitives";
import type { UrlStateUpdate } from "@/lib/api/url-state-update";
import { NotMatchedSection } from "./not-matched";
import { PEOPLE_COPY } from "./people-copy";
import { personMatches, type PeopleModel } from "./people-model";
import { PersonCard, type PersonEdit } from "./person-card";
import { AddPersonSheet, agentOptionsOf, loginUsersOf, PersonSheet, type PeopleContext } from "./people-sheets";
import { usePeople } from "./use-people";

const c = PEOPLE_COPY;
const EDITS: readonly PersonEdit[] = ["roster", "login", "extension", "ringcentral"];
const passthrough = (patch: UrlStateUpdate) => patch;

export function PeopleSection() {
  const role = useDashboardRole();
  const owner = role === "owner";
  const params = useSearchParams();
  const update = useUrlState<UrlStateUpdate>(passthrough);
  const { model, isPending, errors, directory, refetch } = usePeople(role);
  const [term, setTerm] = useState<string | null>(null);
  const [includeInactive, setIncludeInactive] = useState(false);

  const personId = params.get("person");
  const editParam = params.get("edit");
  const edit = EDITS.find((item) => item === editParam) ?? null;
  const adding = owner && params.get("new") === "1";
  const target = personId ? (model.people.find((person) => person.agent.id === personId) ?? null) : null;
  // A deep link to an inactive person must show that card even when inactive people are hidden.
  const showInactive = includeInactive || Boolean(target && !target.agent.active);
  const visible = model.people.filter((person) => (showInactive || person.agent.active) && personMatches(person, term ?? ""));
  const context: PeopleContext = { model, directory, agentsFailed: errors.some((message) => message.startsWith("The roster")) };
  const closeSheet = () => update({ person: null, edit: null, new: null });

  return (
    <>
      <SetupSectionHead
        section="people"
        right={
          owner ? (
            <button type="button" className="crm-button crm-button--primary" onClick={() => update({ new: "1", person: null, edit: null })}>
              <UserPlus aria-hidden="true" width={16} height={16} />
              {c.add}
            </button>
          ) : null
        }
      />
      {!owner ? <p className="su-quiet">{c.readOnlyNote}</p> : null}
      <div className="pp-toolbar">
        <SearchBox value={term} onSearch={setTerm} placeholder={c.searchPlaceholder} />
        <Chip active={showInactive} onClick={() => setIncludeInactive(!includeInactive)}>
          {c.includeInactive}
        </Chip>
        <span className="su-quiet">{c.count(visible.length)}</span>
      </div>
      {errors.map((message) => (
        <ReadFailure key={message} what={message} error="" onRetry={refetch} />
      ))}
      {isPending ? (
        <div className="crm-card crm-stack" aria-busy="true" style={{ padding: 16 }}>
          <SkeletonLine width="40%" height={18} />
          <SkeletonLine width="80%" />
          <SkeletonLine width="65%" />
        </div>
      ) : (
        <PeopleList model={model} visible={visible} readOnly={!owner} selectedId={personId} onEdit={(person, part) => update({ person, edit: part, new: null })} />
      )}
      {owner && !isPending ? <NotMatchedSection model={model} agents={agentOptionsOf(model)} users={loginUsersOf(model)} /> : null}
      {owner && edit && personId ? <PersonSheet key={`${personId}-${edit}`} edit={edit} person={target} context={context} onClose={closeSheet} /> : null}
      {adding ? <AddPersonSheet context={context} onClose={closeSheet} /> : null}
    </>
  );
}

export function PeopleList({
  model,
  visible,
  readOnly,
  selectedId = null,
  onEdit,
}: {
  model: PeopleModel;
  visible: PeopleModel["people"];
  readOnly: boolean;
  selectedId?: string | null;
  onEdit: (agentId: string, edit: PersonEdit) => void;
}) {
  if (visible.length === 0) {
    return (
      <Notice icon={Users} title={model.people.length === 0 ? c.emptyNone : c.empty} testId="people-empty" />
    );
  }
  return (
    <div className="pp-list" data-testid="people-list">
      {visible.map((person) => (
        <PersonCard key={person.agent.id} person={person} loaded={model.loaded} readOnly={readOnly} selected={selectedId === person.agent.id} onEdit={(part) => onEdit(person.agent.id, part)} />
      ))}
    </div>
  );
}
