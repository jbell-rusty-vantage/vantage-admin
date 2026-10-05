import { permanentRedirect } from "next/navigation";
import { legacySalesIntelligenceHref } from "@/components/sales-intelligence/desk/route-decision";

/** The old quarantined workspace's address: the same permanent redirect into the Outreach Desk as `/sales-intelligence`. */
export default async function SalesIntelligenceLegacyPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  permanentRedirect(legacySalesIntelligenceHref(await searchParams));
}
