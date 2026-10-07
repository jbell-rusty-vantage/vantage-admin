"use client";
/**
 * Setup → People & access (`/setup/people`, doc 19 "One person, one card"). One card per Agent (active first), the parts
 * joined on the client by `people-model.ts`, a Logins without an Agent list at the bottom, and wide sheets held in the
 * URL: `?person=<agent id>&edit=roster|desk|login|extension|ringcentral`, `?new=agent|login|extension` (`?new=1` is the
 * older Add person link), and `?login=<id>` / `?ext=<id>` for any one login. The Owner can create each kind on its own
 * (an Agent with or without a Granot username, a dashboard login of any role, an extension login of any roles) and
 * connect it to the others from either side. Admin and Manager read the roster only; every write is the Owner's.
 */
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { LayoutDashboard, Puzzle, UserPlus, Users } from "lucide-react";
import { useDashboardRole } from "@/components/layout/dashboard-role-context";
import { useUrlState } from "@/components/records";
import { SetupSectionHead } from "@/components/setup/setup-shell";
import { Chip, Notice, ReadFailure, SearchBox, SkeletonLine } from "@/components/ui/crm/primitives";
import type { UrlStateUpdate } from "@/lib/api/url-state-update";
import { NotMatchedSection } from "./not-matched";
import { PEOPLE_COPY } from "./people-copy";
import { personMatches, type PeopleModel } from "./people-model";
import { PersonCard, type PersonEdit } from "./person-card";
import {
  AddExtensionSheet,
  AddLoginSheet,
  AddPersonSheet,
  agentOptionsOf,
  ExtensionSheet,
  LoginSheet,
  loginUsersOf,
  PersonSheet,
  type PeopleContext,
} from "./people-sheets";
import { usePeople } from "./use-people";

const c = PEOPLE_COPY;
const EDITS: readonly PersonEdit[] = ["roster", "desk", "login", "extension", "ringcentral"];
const passthrough = (patch: UrlStateUpdate) => patch;
const CLOSED: UrlStateUpdate = { person: null, edit: null, new: null, login: null, ext: null };

export type AddKind = "agent" | "login" | "extension";

/** `?new=` → what is being added; `1` is the older Add person link. */
export function addKindOf(value: string | null): AddKind | null {
  if (value === "1" || value === "agent") return "agent";
  return value === "login" || value === "extension" ? value : null;
}

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
  const adding = owner ? addKindOf(params.get("new")) : null;
  const loginId = owner ? params.get("login") : null;
  const extId = owner ? params.get("ext") : null;
  const target = personId ? (model.people.find((person) => person.agent.id === personId) ?? null) : null;
  // A deep link to an inactive person must show that card even when inactive people are hidden.
  const showInactive = includeInactive || Boolean(target && !target.agent.active);
  const visible = model.people.filter((person) => (showInactive || person.agent.active) && personMatches(person, term ?? ""));
  const context: PeopleContext = { model, directory, agentsFailed: errors.some((message) => message.startsWith("The roster")) };
  const closeSheet = () => update(CLOSED);
  const open = (patch: UrlStateUpdate) => update({ ...CLOSED, ...patch });

  return (
    <>
      <SetupSectionHead section="people" right={owner ? <AddButtons onAdd={(kind) => open({ new: kind })} /> : null} />
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
        <PeopleList model={model} visible={visible} readOnly={!owner} selectedId={personId} onEdit={(person, part) => open({ person, edit: part })} />
      )}
      {owner && !isPending ? (
        <NotMatchedSection
          model={model}
          agents={agentOptionsOf(model)}
          users={loginUsersOf(model)}
          onEditLogin={(id) => open({ login: id })}
          onEditExtension={(id) => open({ ext: id })}
        />
      ) : null}
      {owner && edit && personId ? <PersonSheet key={`${personId}-${edit}`} edit={edit} person={target} context={context} onClose={closeSheet} /> : null}
      {adding === "agent" ? <AddPersonSheet context={context} onClose={closeSheet} /> : null}
      {adding === "login" ? <AddLoginSheet context={context} onClose={closeSheet} /> : null}
      {adding === "extension" ? <AddExtensionSheet context={context} onClose={closeSheet} /> : null}
      {loginId ? <LoginSheet key={loginId} userId={loginId} context={context} onClose={closeSheet} /> : null}
      {extId ? <ExtensionSheet key={extId} extensionId={extId} context={context} onClose={closeSheet} /> : null}
    </>
  );
}

/** The Owner's three Add buttons: each kind can be created on its own. */
export function AddButtons({ onAdd }: { onAdd: (kind: AddKind) => void }) {
  return (
    <span className="pp-add" role="group" aria-label={c.addMenu.label}>
      <button type="button" className="crm-button crm-button--primary" title={c.addMenu.agentHint} onClick={() => onAdd("agent")}>
        <UserPlus aria-hidden="true" width={16} height={16} />
        {c.addMenu.agent}
      </button>
      <button type="button" className="crm-button" title={c.addMenu.loginHint} onClick={() => onAdd("login")}>
        <LayoutDashboard aria-hidden="true" width={16} height={16} />
        {c.addMenu.login}
      </button>
      <button type="button" className="crm-button" title={c.addMenu.extensionHint} onClick={() => onAdd("extension")}>
        <Puzzle aria-hidden="true" width={16} height={16} />
        {c.addMenu.extension}
      </button>
    </span>
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
