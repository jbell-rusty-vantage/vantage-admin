import { permanentRedirect } from "next/navigation";
import { legacySalesIntelligenceHref } from "@/components/outreach-desk/data/desk-url";

/**
 * `/sales-intelligence` moved into the Outreach Desk (IMPL-02): a permanent redirect. `?number=<id>` opens
 * `?view=numbers&number=<id>` (All Numbers), `view=reps` opens `?view=accounts`, and any other old link opens the desk's default view
 * for the viewer. The desk page checks the role.
 */
export default async function SalesIntelligencePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  permanentRedirect(legacySalesIntelligenceHref(await searchParams));
}
