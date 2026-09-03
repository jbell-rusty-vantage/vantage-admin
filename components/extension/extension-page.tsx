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
  createExtensionUser,
  fetchExtensionUsers,
  type ExtensionRole,
} from "@/lib/api/extensionUsers";
import { queryKeys } from "@/lib/query/keys";
import { EXTENSION_COPY } from "./extension-copy";

type FormMessage = {
  tone: "success" | "error";
  text: string;
};

const emptyDraft = {
  email: "",
  password: "",
  role: "employee" as ExtensionRole,
};

export function ExtensionPage() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(emptyDraft);
  const [message, setMessage] = useState<FormMessage | null>(null);
  const usersQuery = useQuery({
    queryKey: queryKeys.extensionUsers.list(),
    queryFn: fetchExtensionUsers,
  });

  const createMutation = useMutation({
    mutationFn: () => createExtensionUser(draft),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.extensionUsers.all });
      setDraft(emptyDraft);
      setMessage({ tone: "success", text: EXTENSION_COPY.created });
    },
    onError: (error: unknown) => {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Unable to create this Extension User.",
      });
    },
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    createMutation.mutate();
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
          <p>{EXTENSION_COPY.employeeRole}</p>
        </CardContent>
      </Card>

      <section className="rounded-lg border bg-background p-4">
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="extension-email">{EXTENSION_COPY.emailLabel}</Label>
            <Input
              id="extension-email"
              name="email"
              type="email"
              autoComplete="off"
              required
              value={draft.email}
              onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))}
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
              value={draft.password}
              onChange={(event) =>
                setDraft((current) => ({ ...current, password: event.target.value }))
              }
            />
            <p className="text-xs text-muted-foreground">{EXTENSION_COPY.passwordHint}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="extension-role">{EXTENSION_COPY.roleLabel}</Label>
            <select
              id="extension-role"
              name="role"
              className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={draft.role}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  role: event.target.value as ExtensionRole,
                }))
              }
            >
              <option value="employee">{EXTENSION_COPY.employeeOption}</option>
              <option value="owner">{EXTENSION_COPY.ownerOption}</option>
            </select>
          </div>
          {message ? <FeedbackMessage tone={message.tone}>{message.text}</FeedbackMessage> : null}
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? EXTENSION_COPY.creatingButton : EXTENSION_COPY.createButton}
          </Button>
        </form>
      </section>

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
              <li key={user.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div>
                  <p className="font-medium text-navy">{user.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {user.role === "owner" ? EXTENSION_COPY.roleOwner : EXTENSION_COPY.roleEmployee}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {user.active ? EXTENSION_COPY.active : EXTENSION_COPY.inactive}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
