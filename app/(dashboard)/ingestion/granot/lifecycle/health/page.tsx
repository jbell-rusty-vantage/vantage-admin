import { permanentRedirect } from "next/navigation";
import { GRANOT_LIFECYCLE_HEALTH_HREF } from "@/components/granot-lifecycle/granot-lifecycle-copy";

export default function GranotLifecycleHealthRedirect() {
  permanentRedirect(GRANOT_LIFECYCLE_HEALTH_HREF);
}
