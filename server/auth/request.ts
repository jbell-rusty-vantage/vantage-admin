import { headers } from "next/headers";

export type RequestMetadata = {
  ip_address?: string;
  user_agent?: string;
};

export async function getRequestMetadata(): Promise<RequestMetadata> {
  const headerStore = await headers();
  return {
    ip_address:
      headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      headerStore.get("x-real-ip") ??
      undefined,
    user_agent: headerStore.get("user-agent") ?? undefined,
  };
}
