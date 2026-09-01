import { permanentRedirect } from "next/navigation";

export default function SettingsRedirectPage() {
  permanentRedirect("/operations-registry?tab=moving-carriers");
}
