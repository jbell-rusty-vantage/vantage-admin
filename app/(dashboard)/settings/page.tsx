import { permanentRedirect } from "next/navigation";
import { SETUP_ROUTES } from "@/lib/setup/setup-links";

export default function SettingsRedirectPage() {
  permanentRedirect(SETUP_ROUTES.carriers);
}
