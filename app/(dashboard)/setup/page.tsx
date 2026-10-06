import { redirect } from "next/navigation";
import { SETUP_ROUTES } from "@/lib/setup/setup-links";

/** `/setup` keeps the hub for one release as a redirect to Lead sources (doc 19 "Routes"). */
export default function SetupPage() {
  redirect(SETUP_ROUTES.leadSources);
}
