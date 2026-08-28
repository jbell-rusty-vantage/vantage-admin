import { permanentRedirect } from "next/navigation";
import { LIVE_EVENTS_HREF } from "@/lib/api/granotLiveReceipts";

export default function GranotLiveWebhooksRedirect() {
  permanentRedirect(LIVE_EVENTS_HREF);
}
