"use client";

import { InviteResultDialog } from "@/components/operations-registry/users/invite-result";
import { DeactivateDialog, SetPasswordDialog } from "@/components/operations-registry/users/user-dialogs";
import { UserFormDialog } from "@/components/operations-registry/users/user-form-dialog";
import { UsersHeader, UsersLoadError } from "@/components/operations-registry/users/users-tab";
import { UsersTableSkeleton, UsersTableView } from "@/components/operations-registry/users/users-table";
import { copy } from "@/components/sales-intelligence/sales-intelligence-copy";
import { AGENT_TAKEN, GALLERY_AGENTS, GALLERY_USERS, INVITE_NOT_EMAILED, INVITE_SENT, LAST_OWNER, MARCUS_AGENT } from "./users-fixtures";
import { GallerySection, Sample, Subhead } from "./section";

// UI2-USERS gallery samples (UI-2 §8). Sample labels are dev-only gallery text (not Owner-facing copy).
// Dialogs render inline (`inline`), so they show without a DOM `showModal()`; nothing here calls the API.

const noop = () => {};
const reject = async () => { throw AGENT_TAKEN; };

export function UsersSection() {
  const [owner, dana, , marcus] = GALLERY_USERS;
  return (
    <GallerySection id="users" title={copy.ui2.gallery.sections.users}>
      <p className="si-gallery__note">
        Rendered from S8/admin-users/list__after.json (+ last_invite) and a seed-named Agent list. At 390 px the table stacks and the three secondary actions move under More actions.
      </p>
      <Subhead>Tab</Subhead>
      <div className="si-root si-users" data-users-sample="table">
        <UsersHeader onAdd={noop} />
        <div className="si-region si-users__region">
          <UsersTableView users={GALLERY_USERS} agents={GALLERY_AGENTS} onAction={noop} />
        </div>
      </div>
      <Subhead>390 px</Subhead>
      <div className="si-gallery__frame" data-frame="390" data-users-sample="phone">
        <div className="si-root si-users">
          <UsersHeader onAdd={noop} />
          <div className="si-region si-users__region">
            <UsersTableView users={GALLERY_USERS} agents={GALLERY_AGENTS} onAction={noop} />
          </div>
        </div>
      </div>
      <Subhead>Loading, error, empty</Subhead>
      <div className="si-root si-users" data-users-sample="states">
        <Sample label="Skeleton (shown after 150 ms)" copyKey="UsersTableSkeleton" wide><div className="si-users__region"><UsersTableSkeleton /></div></Sample>
        <Sample label="Load error" copyKey="copy.ui2.users.loadError" wide><UsersLoadError code="forbidden" onRetry={noop} /></Sample>
        <Sample label="Empty" copyKey="copy.ui2.users.empty" wide><div className="si-users__region"><UsersTableView users={[]} agents={GALLERY_AGENTS} onAction={noop} /></div></Sample>
      </div>
      <Subhead>Dialogs</Subhead>
      <div className="si-root si-users" data-users-sample="dialogs">
        <Sample label="Add user · rep · invite (picker hides Marcus: held by an active rep)" copyKey="copy.ui2.users.form" wide>
          <UserFormDialog inline mode="add" users={GALLERY_USERS} agents={GALLERY_AGENTS} onSubmit={reject} onClose={noop} />
        </Sample>
        <Sample label="Add user · agent_taken refusal" copyKey="copy.ui2.users.errors.agent_taken" wide>
          <UserFormDialog
            inline
            mode="add"
            users={GALLERY_USERS}
            agents={GALLERY_AGENTS}
            initialDraft={{ email: "second.marcus@example.invalid", role: "rep", agentId: MARCUS_AGENT, active: true, access: "password", password: "" }}
            initialError={AGENT_TAKEN}
            onSubmit={reject}
            onClose={noop}
          />
        </Sample>
        <Sample label="Edit a rep (their own Agent stays in the picker)" copyKey="copy.ui2.users.form.editTitle" wide>
          <UserFormDialog inline mode="edit" user={marcus!} users={GALLERY_USERS} agents={GALLERY_AGENTS} onSubmit={reject} onClose={noop} />
        </Sample>
        <Sample label="Set password" copyKey="copy.ui2.users.setPassword" wide>
          <SetPasswordDialog inline user={dana!} onSubmit={reject} onClose={noop} />
        </Sample>
        <Sample label="Deactivate · last_owner refusal" copyKey="copy.ui2.users.deactivate · errors.last_owner" wide>
          <DeactivateDialog inline user={owner!} initialError={LAST_OWNER} onConfirm={reject} onClose={noop} />
        </Sample>
      </div>
      <Subhead>Invite result</Subhead>
      <div className="si-root si-users" data-users-sample="invite">
        <Sample label="delivery: not_configured (invite__rep-not-emailed.json)" copyKey="copy.ui2.users.inviteResult.notEmailed" wide>
          <InviteResultDialog inline email="dana@example.invalid" result={INVITE_NOT_EMAILED} onClose={noop} />
        </Sample>
        <Sample label="delivery: sent (synthetic)" copyKey="copy.ui2.users.inviteResult.sent" wide>
          <InviteResultDialog inline email="marcus@example.invalid" result={INVITE_SENT} onClose={noop} />
        </Sample>
      </div>
    </GallerySection>
  );
}
