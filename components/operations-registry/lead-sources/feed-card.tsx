import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LeadSourceFeedProjection } from "@/lib/api/leadSources";
import { formatUsPhone } from "@/lib/operations-registry/inboundNumberStatus";
import { ConnectionLine } from "./connection-line";
import { LeadCostLine, ReadinessBadge } from "./readiness-badge";

function textStateCopy(state: "on" | "off" | "not_available"): string {
  if (state === "on") return "create if missing; text on";
  if (state === "off") return "create if missing; text off";
  return "text off";
}

export function FeedCard({
  feed,
  leadSourceName,
}: {
  feed: LeadSourceFeedProjection;
  leadSourceName: string;
}) {
  const labels = feed.accepted_labels;
  const granotNames = feed.granot_names;
  const numbers = feed.inbound_numbers;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <CardTitle className="text-base">{feed.display_name}</CardTitle>
        <ReadinessBadge readiness={feed.readiness} />
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {feed.channel === "form" ? (
          <p>
            Sheet names accepted:{" "}
            {labels?.empty
              ? "This feed has no accepted sheet names."
              : (labels?.items ?? []).map((item) => item.label).join(", ")}
          </p>
        ) : null}
        {feed.channel === "call" ? (
          numbers?.empty ? (
            <p>This call feed has no inbound number.</p>
          ) : (
            (numbers?.items ?? []).map((number) => (
              <div key={number.id}>
                <p>Phone number: {formatUsPhone(number.phone_number)}</p>
                <p>Number nickname: {number.nickname}</p>
              </div>
            ))
          )
        ) : null}
        <p>What Vantage sends to Granot: {feed.crm_label}</p>
        {granotNames?.empty ? (
          <p>No Granot names land in this feed yet.</p>
        ) : (
          <div className="space-y-1">
            <p>
              Granot names landing here:{" "}
              {(granotNames?.items ?? [])
                .map(
                  (item) =>
                    `${item.name_received_from_granot} (${textStateCopy(item.text_state)})`,
                )
                .join("; ")}
            </p>
            {(granotNames?.items ?? []).map((item) => (
              <div key={`${feed.id}-${item.id}`}>
                <ConnectionLine leadSourceName={leadSourceName} feedName={feed.display_name} />
                {item.route.shape === "form_by_move_type" ? (
                  <p className="text-xs text-muted-foreground">{item.route.selection_rule}</p>
                ) : null}
              </div>
            ))}
          </div>
        )}
        <p>
          <LeadCostLine value={feed.readiness.lead_cost} />
        </p>
      </CardContent>
    </Card>
  );
}
