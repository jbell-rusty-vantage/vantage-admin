"use client";
/**
 * One person (doc 19 "One person, one card"): the Agent's head, then one `.su-line` per part the card joins: Roster,
 * Outreach Desk, Dashboard login, Extension login, RingCentral (one sub-line per account), Pay. A part whose read was not
 * allowed or failed says "not loaded", never "none". Admin and Manager see the head, Roster and Outreach Desk, read-only.
 */
import type { ReactNode } from "react";
import { BadgeDollarSign, Headset, Puzzle, LayoutDashboard, Phone, UserRound, type LucideIcon } from "lucide-react";
import { formatRelative } from "@/components/ui/crm/format";
import { Avatar, EvidenceChip, Pill } from "@/components/ui/crm/primitives";
import { PEOPLE_COPY } from "./people-copy";
import { accountReviewed, deskState, type PeopleModel, type Person } from "./people-model";
import { formatExtensionRoleLabels } from "@/lib/api/extensionUsers";

const c = PEOPLE_COPY;

export type PersonEdit = "roster" | "desk" | "login" | "extension" | "ringcentral";

function Line({ icon: Icon, label, children, right, testId }: { icon: LucideIcon; label: string | null; children: ReactNode; right?: ReactNode; testId?: string }) {
  return (
    <div className="su-line" data-testid={testId}>
      <Icon aria-hidden="true" />
      <span className="su-line__label pp-label">{label ?? ""}</span>
      <span className="pp-value">{children}</span>
      {right ? <span className="su-line__right">{right}</span> : null}
    </div>
  );
}

function EditButton({ label, name, onClick }: { label: string; name: string; onClick: () => void }) {
  return (
    <button type="button" className="crm-button crm-button--quiet crm-button--sm" onClick={onClick} aria-label={`${label}: ${name}`}>
      {label}
    </button>
  );
}

const NotLoaded = () => <span className="su-quiet">{c.notLoaded}</span>;

export function PersonCard({ person, loaded, readOnly, selected = false, onEdit }: { person: Person; loaded: PeopleModel["loaded"]; readOnly: boolean; selected?: boolean; onEdit: (edit: PersonEdit) => void }) {
  const { agent, user, extensionUser, accounts } = person;
  const name = agent.name;
  const roleWord = user ? (c.roleWord[user.role] ?? user.role) : null;
  const desk = deskState(agent);

  return (
    <article className={selected ? "crm-card crm-card--selected pp-card" : "crm-card pp-card"} id={`person-${agent.id}`} data-testid="person-card" aria-label={name}>
      <div className="crm-card__head">
        <span className="pp-head">
          <Avatar name={name} size="lg" />
          <h3 className="crm-card__title">{name}</h3>
        </span>
        <span className="pp-pills">
          <Pill variant={agent.active ? "green" : "gray"}>{agent.active ? c.active : c.inactive}</Pill>
          {roleWord ? <Pill variant="blue">{roleWord}</Pill> : null}
          {desk.on ? <Pill variant="green">{c.desk.on}</Pill> : null}
        </span>
      </div>

      <Line icon={UserRound} label={c.lines.roster} testId="line-roster" right={readOnly ? null : <EditButton label={c.edit} name={name} onClick={() => onEdit("roster")} />}>
        {agent.granot_crm_username ? <span className="su-line__value">{c.roster.granot(agent.granot_crm_username)}</span> : <span className="su-quiet">{c.roster.noGranot}</span>}
      </Line>

      <Line icon={Headset} label={c.lines.desk} testId="line-desk" right={readOnly ? null : <EditButton label={c.edit} name={name} onClick={() => onEdit("desk")} />}>
        {desk.on === null ? (
          <NotLoaded />
        ) : (
          <>
            <span className={desk.on ? "su-line__value" : "su-quiet"}>{desk.on ? c.desk.on : c.desk.off}</span> · {desk.reason ? (c.desk.reason[desk.reason] ?? desk.reason) : null}
          </>
        )}
      </Line>

      {readOnly ? null : (
        <>
          <Line
            icon={LayoutDashboard}
            label={c.lines.dashboard}
            testId="line-dashboard"
            right={loaded.users ? <EditButton label={user ? c.edit : c.addPart} name={name} onClick={() => onEdit("login")} /> : null}
          >
            {!loaded.users ? (
              <NotLoaded />
            ) : user ? (
              <>
                <span className="su-line__value">{user.email}</span> · {c.loginRoleWord[user.role] ?? user.role}
                {!user.active ? <> · {c.dashboard.deactivated}</> : null} ·{" "}
                {user.last_login_at ? c.dashboard.lastSignIn(formatRelative(user.last_login_at)) : c.dashboard.neverSignedIn}
              </>
            ) : (
              <span className="su-quiet">{c.dashboard.noLogin}</span>
            )}
          </Line>

          <Line
            icon={Puzzle}
            label={c.lines.extension}
            testId="line-extension"
            right={loaded.extensionUsers && loaded.users ? <EditButton label={extensionUser ? c.edit : c.addPart} name={name} onClick={() => onEdit("extension")} /> : null}
          >
            {!loaded.extensionUsers ? (
              <NotLoaded />
            ) : extensionUser ? (
              <>
                <span className="su-line__value">{extensionUser.email}</span> · {formatExtensionRoleLabels(extensionUser.roles)}
                {!extensionUser.active ? <> · {c.extension.inactive}</> : null}
              </>
            ) : (
              <span className="su-quiet">{c.extension.none}</span>
            )}
          </Line>

          {!loaded.accounts ? (
            <Line icon={Phone} label={c.lines.ringcentral} testId="line-ringcentral">
              <NotLoaded />
            </Line>
          ) : accounts.length === 0 ? (
            <Line icon={Phone} label={c.lines.ringcentral} testId="line-ringcentral" right={<EditButton label={c.connect} name={name} onClick={() => onEdit("ringcentral")} />}>
              <span className="su-quiet">{c.ringcentral.none}</span>
            </Line>
          ) : (
            accounts.map((account, index) => (
              <Line
                key={account.extension_id}
                icon={Phone}
                label={index === 0 ? c.lines.ringcentral : null}
                testId="line-ringcentral"
                right={
                  <>
                    <EditButton label={c.change} name={name} onClick={() => onEdit("ringcentral")} />
                    <EditButton label={c.disconnect} name={name} onClick={() => onEdit("ringcentral")} />
                  </>
                }
              >
                <span className="su-line__value">{c.ringcentral.ext(account.extension_number)}</span> · {account.role ? (c.ringcentral.roleWord[account.role] ?? account.role) : c.ringcentral.noRole} ·{" "}
                <EvidenceChip state={accountReviewed(account) ? "ok" : "none"}>{accountReviewed(account) ? c.ringcentral.reviewed : c.ringcentral.notReviewed}</EvidenceChip>
              </Line>
            ))
          )}

          <Line icon={BadgeDollarSign} label={c.lines.pay} testId="line-pay">
            <span className="su-quiet">{c.pay}</span>
          </Line>
        </>
      )}
    </article>
  );
}
