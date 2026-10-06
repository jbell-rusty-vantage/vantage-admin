"use client";
/**
 * The four reads behind People & access (doc 19), run with TanStack Query. A read the role may not make (the admin's own
 * `/api/admin-users`, the extension logins and the RingCentral accounts are Owner only) is not made and reaches the join as
 * `null`; so does a read that failed, because failed means unknown. The sub-navigation badge calls this hook too.
 */
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { fetchAdminUsers, usersQueryKey } from "@/components/operations-registry/users/users-api";
import { accountsSchema, allNumbersPaths, allNumbersRead, type AccountsData } from "@/lib/api/allNumbers";
import { fetchExtensionUsers } from "@/lib/api/extensionUsers";
import { invalidateRegistryQueries } from "@/lib/api/registryInvalidation";
import { fetchRegistryCatalog } from "@/lib/api/registryAgents";
import { numbersKeys } from "@/lib/query/allNumbers";
import { queryKeys } from "@/lib/query/keys";
import { buildPeople, type PeopleModel } from "./people-model";

export type PeopleRole = "owner" | "admin" | "manager" | null;

export const peopleAccountsKey = [...queryKeys.operationsRegistry.all, "setup", "people", "accounts"] as const;

export type PeopleReads = {
  model: PeopleModel;
  /** True until the Roster read and every read this role may make has answered once. */
  isPending: boolean;
  /** One entry per read that failed, in words for the Owner. */
  errors: string[];
  /** The raw account directory (its `agents` list and each account's suggestion) for the RingCentral picker. */
  directory: AccountsData | null;
  refetch: () => void;
};

export function usePeople(role: PeopleRole): PeopleReads {
  const owner = role === "owner";
  const agents = useQuery({
    queryKey: queryKeys.operationsRegistry.agents(true),
    queryFn: () => fetchRegistryCatalog("agents", { includeInactive: true }),
    enabled: role !== null,
  });
  const users = useQuery({ queryKey: usersQueryKey, queryFn: fetchAdminUsers, enabled: owner, retry: false });
  const extension = useQuery({ queryKey: queryKeys.extensionUsers.list(), queryFn: fetchExtensionUsers, enabled: owner, retry: false });
  const accounts = useQuery({
    queryKey: peopleAccountsKey,
    queryFn: ({ signal }) => allNumbersRead(allNumbersPaths.accounts(), accountsSchema, signal).then((result) => result.data),
    enabled: owner,
    retry: false,
  });

  const model = buildPeople({
    agents: agents.data ?? [],
    users: users.data ?? null,
    extensionUsers: extension.data ?? null,
    accounts: accounts.data?.accounts ?? null,
  });
  const failed: Array<[boolean, string]> = [
    [agents.isError, "The roster"],
    [users.isError, "Dashboard logins"],
    [extension.isError, "Extension logins"],
    [accounts.isError, "RingCentral users"],
  ];
  return {
    model,
    isPending: role === null || agents.isPending || (owner && (users.isLoading || extension.isLoading || accounts.isLoading)),
    errors: failed.filter(([isError]) => isError).map(([, what]) => `${what} couldn't load.`),
    directory: accounts.data ?? null,
    refetch: () => {
      void agents.refetch();
      if (owner) {
        void users.refetch();
        void extension.refetch();
        void accounts.refetch();
      }
    },
  };
}

/** After any People write: the Registry roots (Agents, logins and accounts sit under them), the extension logins and the Desk's numbers. */
export async function invalidatePeople(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    invalidateRegistryQueries(queryClient),
    queryClient.invalidateQueries({ queryKey: queryKeys.extensionUsers.all }),
    queryClient.invalidateQueries({ queryKey: numbersKeys.all }),
    queryClient.invalidateQueries({ queryKey: numbersKeys.accounts() }),
  ]);
}

export function usePeopleRefresh(): () => Promise<void> {
  const queryClient = useQueryClient();
  return () => invalidatePeople(queryClient);
}
