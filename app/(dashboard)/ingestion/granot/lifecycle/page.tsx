import { permanentRedirect } from "next/navigation";
import { GRANOT_LIFECYCLE_COPY } from "@/components/granot-lifecycle/granot-lifecycle-copy";

export default function GranotLifecycleQueueRedirect() {
  permanentRedirect(GRANOT_LIFECYCLE_COPY.backToIntakesHref);
}
