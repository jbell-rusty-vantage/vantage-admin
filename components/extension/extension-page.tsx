"use client";

import { type FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Puzzle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedbackMessage } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CURRENT_EXTENSION_ROLES,
  createExtensionUser,
  deleteExtensionUser,
  fetchExtensionUsers,
  formatExtensionRoleLabels,
  rolesSetsEqual,
  updateExtensionUser,
  type AdminExtensionUser,
  type CurrentExtensionRole,
  type UpdateExtensionUserInput,
} from "@/lib/api/extensionUsers";
import { queryKeys } from "@/lib/query/keys";
import { EXTENSION_COPY } from "./extension-copy";

type FormMessage = {
  tone: "success" | "error";
  text: string;
};

type RoleDraft = CurrentExtensionRole[];

const emptyCreateDraft = {
  email: "",
  password: "",
  roles: ["sales"] as RoleDraft,
};

type EditDraft = {
  email: string;
  password: string;
  roles: RoleDraft;
};

function roleOptionLabel(role: CurrentExtensionRole): string {
  switch (role) {
    case "owner":
      return EXTENSION_COPY.ownerOption;
    case "sales":
      return EXTENSION_COPY.salesOption;
    case "customer_service":
      return EXTENSION_COPY.customerServiceOption;
  }
}

function toggleRole(roles: RoleDraft, role: CurrentExtensionRole): RoleDraft {
  return roles.includes(role) ? roles.filter((item) => item !== role) : [...roles, role];
}

function normalizedEmail(value: string): string {
  return value.trim().toLowerCase();
}

function collectPatch(
  user: AdminExtensionUser,
  draft: EditDraft,
): UpdateExtensionUserInput | null {
  const patch: UpdateExtensionUserInput = {};
  const nextEmail = draft.email.trim();
  if (normalizedEmail(nextEmail) !== normalizedEmail(user.email)) {
    patch.email = nextEmail;
  }
  if (draft.password !== "") {
    patch.password = draft.password;
  }
  if (!rolesSetsEqual(draft.roles, user.roles)) {
    patch.roles = draft.roles;
  }
  return Object.keys(patch).length === 0 ? null : patch;
}

function RoleCheckboxes({
  idPrefix,
  roles,
  onChange,
}: {
  idPrefix: string;
  roles: RoleDraft;
  onChange: (roles: RoleDraft) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{EXTENSION_COPY.rolesLabel}</legend>
      {CURRENT_EXTENSION_ROLES.map((role) => {
        const id = `${idPrefix}-${role}`;
        const checked = roles.includes(role);
        return (
          <label key={role} htmlFor={id} className="flex items-center gap-2 text-sm">
            <input
              id={id}
              type="checkbox"
              className="mt-0.5"
              checked={checked}
              onChange={() => onChange(toggleRole(roles, role))}
            />
            {roleOptionLabel(role)}
          </label>
        );
      })}
    </fieldset>
  );
}

export function ExtensionPage() {
  const queryClient = useQueryClient();
  const [createDraft, setCreateDraft] = useState(emptyCreateDraft);
  const [editingUser, setEditingUser] = useState<AdminExtensionUser | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [deletingUser, setDeletingUser] = useState<AdminExtensionUser | null>(null);
  const [message, setMessage] = useState<FormMessage | null>(null);

  const usersQuery = useQuery({
    queryKey: queryKeys.extensionUsers.list(),
    queryFn: fetchExtensionUsers,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createExtensionUser({
        email: createDraft.email,
        password: createDraft.password,
        roles: createDraft.roles,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.extensionUsers.all });
      setCreateDraft(emptyCreateDraft);
      setMessage({ tone: "success", text: EXTENSION_COPY.created });
    },
    onError: (error: unknown) => {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Unable to create this Extension User.",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (input: { id: string; patch: UpdateExtensionUserInput }) =>
      updateExtensionUser(input.id, input.patch),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.extensionUsers.all });
      setEditingUser(null);
      setEditDraft(null);
      setMessage({ tone: "success", text: EXTENSION_COPY.updated });
    },
    onError: (error: unknown) => {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Unable to update this Extension User.",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteExtensionUser(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.extensionUsers.all });
      setDeletingUser(null);
      setMessage({ tone: "success", text: EXTENSION_COPY.deleted });
    },
    onError: (error: unknown) => {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Unable to delete this Extension User.",
      });
    },
  });

  function onCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    if (createDraft.roles.length === 0) {
      setMessage({ tone: "error", text: EXTENSION_COPY.rolesRequired });
      return;
    }
    createMutation.mutate();
  }

  function onEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingUser || !editDraft) {
      return;
    }
    setMessage(null);
    if (editDraft.roles.length === 0) {
      setMessage({ tone: "error", text: EXTENSION_COPY.rolesRequired });
      return;
    }
    const patch = collectPatch(editingUser, editDraft);
    if (!patch) {
      setEditingUser(null);
      setEditDraft(null);
      return;
    }
    updateMutation.mutate({ id: editingUser.id, patch });
  }

  function startEdit(user: AdminExtensionUser) {
    setDeletingUser(null);
    setEditingUser(user);
    setEditDraft({
      email: user.email,
      password: "",
      roles: [...user.roles],
    });
    setMessage(null);
  }

  function cancelEdit() {
    setEditingUser(null);
    setEditDraft(null);
  }

  function startDelete(user: AdminExtensionUser) {
    setEditingUser(null);
    setEditDraft(null);
    setDeletingUser(user);
    setMessage(null);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Puzzle className="h-6 w-6 text-navy" aria-hidden="true" />
            {EXTENSION_COPY.pageTitle}
          </CardTitle>
          <CardDescription>{EXTENSION_COPY.pageHint}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-navy">
          <p className="text-xs font-bold uppercase tracking-wide text-navy/70">
            {EXTENSION_COPY.rolesTitle}
          </p>
          <p>{EXTENSION_COPY.ownerRole}</p>
          <p>{EXTENSION_COPY.salesRole}</p>
          <p>{EXTENSION_COPY.customerServiceRole}</p>
        </CardContent>
      </Card>

      <section className="rounded-lg border bg-background p-4">
        <form className="space-y-4" onSubmit={onCreateSubmit}>
          <div className="space-y-2">
            <Label htmlFor="extension-email">{EXTENSION_COPY.emailLabel}</Label>
            <Input
              id="extension-email"
              name="email"
              type="email"
              autoComplete="off"
              required
              value={createDraft.email}
              onChange={(event) =>
                setCreateDraft((current) => ({ ...current, email: event.target.value }))
              }
            />
            <p className="text-xs text-muted-foreground">{EXTENSION_COPY.emailHint}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="extension-password">{EXTENSION_COPY.passwordLabel}</Label>
            <Input
              id="extension-password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={createDraft.password}
              onChange={(event) =>
                setCreateDraft((current) => ({ ...current, password: event.target.value }))
              }
            />
            <p className="text-xs text-muted-foreground">{EXTENSION_COPY.passwordHint}</p>
          </div>
          <RoleCheckboxes
            idPrefix="extension-create-role"
            roles={createDraft.roles}
            onChange={(roles) => setCreateDraft((current) => ({ ...current, roles }))}
          />
          {message && !editingUser ? (
            <FeedbackMessage tone={message.tone}>{message.text}</FeedbackMessage>
          ) : null}
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? EXTENSION_COPY.creatingButton : EXTENSION_COPY.createButton}
          </Button>
        </form>
      </section>

      {editingUser && editDraft ? (
        <section className="rounded-lg border bg-background p-4">
          <h2 className="text-sm font-semibold text-navy">{EXTENSION_COPY.editTitle}</h2>
          <form className="mt-4 space-y-4" onSubmit={onEditSubmit}>
            <div className="space-y-2">
              <Label htmlFor="extension-edit-email">{EXTENSION_COPY.emailLabel}</Label>
              <Input
                id="extension-edit-email"
                name="email"
                type="email"
                autoComplete="off"
                required
                value={editDraft.email}
                onChange={(event) =>
                  setEditDraft((current) =>
                    current ? { ...current, email: event.target.value } : current,
                  )
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="extension-edit-password">{EXTENSION_COPY.passwordLabel}</Label>
              <Input
                id="extension-edit-password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={editDraft.password}
                onChange={(event) =>
                  setEditDraft((current) =>
                    current ? { ...current, password: event.target.value } : current,
                  )
                }
              />
              <p className="text-xs text-muted-foreground">{EXTENSION_COPY.passwordEditHint}</p>
            </div>
            <RoleCheckboxes
              idPrefix="extension-edit-role"
              roles={editDraft.roles}
              onChange={(roles) =>
                setEditDraft((current) => (current ? { ...current, roles } : current))
              }
            />
            {message ? <FeedbackMessage tone={message.tone}>{message.text}</FeedbackMessage> : null}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? EXTENSION_COPY.savingButton : EXTENSION_COPY.saveButton}
              </Button>
              <Button type="button" variant="outline" onClick={cancelEdit}>
                {EXTENSION_COPY.cancelButton}
              </Button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="rounded-lg border bg-background p-4">
        <h2 className="text-sm font-semibold text-navy">{EXTENSION_COPY.listTitle}</h2>
        {usersQuery.isError ? (
          <FeedbackMessage tone="error" className="mt-3">
            {usersQuery.error instanceof Error
              ? usersQuery.error.message
              : "Unable to load Extension Users."}
          </FeedbackMessage>
        ) : null}
        {usersQuery.isLoading ? (
          <p className="mt-3 text-sm text-muted-foreground">Loading Extension Users…</p>
        ) : null}
        {usersQuery.data?.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">{EXTENSION_COPY.emptyList}</p>
        ) : null}
        {usersQuery.data && usersQuery.data.length > 0 ? (
          <ul className="mt-3 divide-y">
            {usersQuery.data.map((user) => (
              <li key={user.id} className="space-y-2 py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-navy">{user.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatExtensionRoleLabels(user.roles)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {user.active ? EXTENSION_COPY.active : EXTENSION_COPY.inactive}
                    </span>
                    <Button type="button" variant="outline" onClick={() => startEdit(user)}>
                      {EXTENSION_COPY.editButton}
                    </Button>
                    <Button type="button" variant="destructive" onClick={() => startDelete(user)}>
                      {EXTENSION_COPY.deleteButton}
                    </Button>
                  </div>
                </div>
                {deletingUser?.id === user.id ? (
                  <div className="space-y-3 rounded-lg border bg-background p-3">
                    <p className="text-sm text-navy">
                      {EXTENSION_COPY.deleteConfirm(user.email)}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="destructive"
                        disabled={deleteMutation.isPending}
                        onClick={() => deleteMutation.mutate(user.id)}
                      >
                        {EXTENSION_COPY.deleteConfirmButton}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setDeletingUser(null)}
                      >
                        {EXTENSION_COPY.cancelDeleteButton}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
