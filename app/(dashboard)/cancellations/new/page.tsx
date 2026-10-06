import { cookies } from "next/headers";
import { Suspense } from "react";
import { RecordCancellationSheet } from "@/components/cancellations/record-cancellation-sheet";
import { getAccessTokenCookie, getSessionUserFromAccessToken } from "@/server/auth";

/** Record a cancellation (doc 03): one screen under the Bookings tabs' Cancellations. The session email picks the default Recorded by. */
export default async function NewCancellationPage() {
  const accessToken = getAccessTokenCookie(await cookies());
  const admin = accessToken ? await getSessionUserFromAccessToken(accessToken) : null;
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <RecordCancellationSheet adminEmail={admin?.email ?? null} />
    </Suspense>
  );
}
