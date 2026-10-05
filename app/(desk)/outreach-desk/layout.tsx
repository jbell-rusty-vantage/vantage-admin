import localFont from "next/font/local";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { QueryProvider } from "@/lib/query/client";
import { getAccessTokenCookie, getSessionUserFromAccessToken } from "@/server/auth";
import { isOutreachDeskRole } from "@/server/models/adminRoles";

// The desk's own typeface (route-scoped desk token set, SPECIFICATION §5): self-hosted like the app fonts.
const deskFont = localFont({
  src: "../../fonts/plus-jakarta-sans-latin-wght.woff2",
  variable: "--font-od",
  weight: "400 800",
  display: "swap",
});

/**
 * `/outreach-desk` (ADM-1/ADM-2): the "Lead outreach" app inside Admin, outside the dashboard shell. Open to the
 * Owner, a Manager and a Rep. A generic Admin gets no desk (P09c) and goes to the Admin home. The role comes from the
 * session, never from the URL; the server's capabilities decide what each frame may read.
 */
export default async function OutreachDeskLayout({ children }: { children: React.ReactNode }) {
  const accessToken = getAccessTokenCookie(await cookies());
  if (!accessToken) redirect("/login?next=/outreach-desk");
  const user = await getSessionUserFromAccessToken(accessToken);
  if (!user) redirect("/login?next=/outreach-desk");
  if (!isOutreachDeskRole(user.role)) redirect("/");
  return (
    <div className={`${deskFont.variable} flex h-full min-h-0 flex-col overflow-hidden`}>
      <QueryProvider>{children}</QueryProvider>
    </div>
  );
}
