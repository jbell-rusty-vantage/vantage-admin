import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ConversationsPage } from "@/components/conversations/conversations-page";
import { getAccessTokenCookie, getAdminFromAccessToken } from "@/server/auth";

export default async function LeadConversationsRoute() {
  const token = getAccessTokenCookie(await cookies());
  const admin = token ? await getAdminFromAccessToken(token) : null;
  if (!admin) redirect("/login");
  if (admin.role !== "owner") redirect("/");
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading Lead Conversations…</p>}>
      <ConversationsPage />
    </Suspense>
  );
}
