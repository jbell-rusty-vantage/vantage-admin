import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { JobTimelineDashboard } from "@/components/job-number-timeline/job-timeline-dashboard";
import { getAccessTokenCookie, getAdminFromAccessToken } from "@/server/auth";

/** The full Job Timeline page (doc 01: `/leads/timeline?job=…`; `/job-timeline` redirects here). Owner only. */
export default async function LeadsTimelinePage() {
  const cookieStore = await cookies();
  const accessToken = getAccessTokenCookie(cookieStore);
  const admin = accessToken ? await getAdminFromAccessToken(accessToken) : null;
  if (!admin) redirect("/login");
  if (admin.role !== "owner") redirect("/leads");

  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading Job timeline…</p>}>
      <JobTimelineDashboard />
    </Suspense>
  );
}
