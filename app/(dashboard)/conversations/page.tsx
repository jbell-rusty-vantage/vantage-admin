import { Suspense } from "react";
import { ConversationsPage } from "@/components/conversations/conversations-page";

export default function LeadConversationsRoute() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading Lead Conversations…</p>}>
      <ConversationsPage />
    </Suspense>
  );
}
