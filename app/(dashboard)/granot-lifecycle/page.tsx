import { permanentRedirect } from "next/navigation";
import { GRANOT_LIFECYCLE_HEALTH_HREF } from "@/components/granot-lifecycle/granot-lifecycle-copy";

export default function GranotLifecycleRedirect() {
  permanentRedirect(GRANOT_LIFECYCLE_HEALTH_HREF);
}
