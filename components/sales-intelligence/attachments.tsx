"use client";
import { useState } from "react";
import Link from "next/link";
import { useInfiniteQuery } from "@tanstack/react-query";
import {
  attachmentsSchema,
  readSalesIntelligence,
} from "@/lib/api/salesIntelligence";
import { salesIntelligenceKeys } from "@/lib/query/salesIntelligence";
import { officialRecordHref } from "./lib/official-record";
import { Button } from "./atoms/button";
import { Badge } from "./atoms/badge";
import { TooltipCard } from "./atoms/tooltip-card";
import { copy } from "./sales-intelligence-copy";
import { EvidenceCommand } from "./evidence-command";
import { formatDateTime, label } from "./lib/format";

/** The server's stored reason for an automatic high-confidence attach. */
const AUTOMATIC = "automatic_high_confidence";

const titles: Record<string, string> = {
  attach_lead: "Confirm attachment",
  reject_attachment: "Reject attachment",
  detach_attachment: "Detach Lead",
  find_lead: "Find another Lead",
};

const explains: Record<string, string> = {
  attach_lead: copy.commandExplain.confirm_attachment,
  reject_attachment: copy.commandExplain.reject_attachment,
  detach_attachment: copy.commandExplain.detach,
  find_lead: copy.commandExplain.find_lead,
};

export function Attachments({
  numberId,
  lead,
  onNumber,
  returnTo,
}: {
  numberId?: string;
  lead?: { model: string; id: string };
  onNumber?: (id: string) => void;
  returnTo?: string;
}) {
  const [editing, setEditing] = useState<{
    id: string;
    command: string;
  } | null>(null);
  const filter = numberId
    ? `contact_number_id=${encodeURIComponent(numberId)}`
    : `lead_model=${encodeURIComponent(lead!.model)}&lead_id=${encodeURIComponent(lead!.id)}`;
  const list = useInfiniteQuery({
    queryKey: [...salesIntelligenceKeys.all, "attachments", filter],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      readSalesIntelligence(
        `attachments?${filter}&limit=25${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ""}`,
        attachmentsSchema,
        signal,
      ),
    getNextPageParam: (page) => page.data.next_cursor ?? undefined,
    retry: false,
  });
  const edges = list.data?.pages.flatMap((page) => page.data.items) ?? [],
    selected = edges.find((e) => e.id === editing?.id);
  return (
    <section className="si-local-stack">
      <h3>Number↔Lead attachments</h3>
      {list.isPending && <p role="status">Loading attachment evidence…</p>}
      {list.error && (
        <p role="alert">
          Attachment evidence could not refresh.{" "}
          <Button onClick={() => void list.refetch()}>Retry attachments</Button>
        </p>
      )}
      {list.isSuccess && !edges.length && (
        <p>No attachments recorded. Searching does not attach a Lead.</p>
      )}
      {edges.map((edge) => (
        <article key={edge.id} className="si-local-stack">
          <h4>
            {edge.lead_snapshot?.name ??
              (edge.lead_ref.model === "FormLead"
                ? "Form Lead"
                : "Call Lead")}{" "}
            · {edge.certainty_label ?? label(edge.state)}
          </h4>
          <p>
            {label(edge.state)} · Job Number{" "}
            {edge.lead_snapshot?.job_no ?? "not observed"} ·{" "}
            {edge.lead_snapshot?.source_label ?? "Source Company not observed"}
          </p>
          {edge.decision_reason === AUTOMATIC && (
            <TooltipCard
              title={copy.provenance.state.attached_automatically}
              guideTopic="provenance"
              label={<Badge tone="blue">{copy.provenance.state.attached_automatically}</Badge>}
            >
              {copy.provenance.soWhat.attached_automatically}
            </TooltipCard>
          )}
          {edge.decided_at && (
            <p className="si-text--sm si-text--subtle">{copy.provenance.decidedAt(formatDateTime(edge.decided_at))}</p>
          )}
          {edge.lead_snapshot && (
            <p>
              {[
                edge.lead_snapshot.booked ? "Booked" : null,
                edge.lead_snapshot.cancelled ? "Cancelled" : null,
                edge.lead_snapshot.duplicate ? "Duplicate Lead" : null,
                edge.lead_snapshot.bad_lead ? "Bad Lead" : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          <Link
            href={officialRecordHref(edge.lead_ref.model, edge.lead_ref.id, returnTo)}
          >
            Open official Lead
          </Link>
          {onNumber && (
            <Button onClick={() => onNumber(edge.contact_number_id)}>
              Open connected Number Activity
            </Button>
          )}
          <details>
            <summary>Evidence and decision history</summary>
            {edge.evidence.map((e, index) => (
              <p key={`${e.source}:${index}`}>
                {label(e.source)} · {e.field_path} · Observed{" "}
                {formatDateTime(e.observed_at)} · Window{" "}
                {formatDateTime(e.window_from)} to {formatDateTime(e.window_to)}
              </p>
            ))}
            {edge.history.map((h, index) => (
              <p key={index}>
                {h.from} → {h.to} · {formatDateTime(h.at)} · {h.reason}
              </p>
            ))}
          </details>
          <div className="si-local-filters">
            {edge.allowed_actions?.map((action) => {
              const title = titles[action.action] ?? label(action.action);
              const explain = explains[action.action];
              const blockers = action.blocker_codes.map(label).filter(Boolean).join(", ");
              return (
                <TooltipCard
                  key={action.action}
                  title={title}
                  label={
                    <Button
                      disabled={!action.enabled}
                      onClick={() =>
                        setEditing({ id: edge.id, command: action.action })
                      }
                    >
                      {title}
                    </Button>
                  }
                >
                  {[explain, !action.enabled && blockers ? blockers : null]
                    .filter(Boolean)
                    .join(" ")}
                </TooltipCard>
              );
            })}
          </div>
        </article>
      ))}
      {list.hasNextPage && (
        <Button
          disabled={list.isFetching}
          onClick={() => void list.fetchNextPage()}
        >
          More attachments
        </Button>
      )}
      {editing && selected && (
        <EvidenceCommand
          key={`${editing.id}:${editing.command}`}
          title={titles[editing.command]}
          revision={selected.revision}
          enabled={
            selected.allowed_actions?.find((a) => a.action === editing.command)
              ?.enabled === true
          }
          context={
            <p>
              {selected.lead_snapshot?.name ?? "Lead"} · {label(selected.state)}{" "}
              · {selected.certainty_label ?? "Rejected"}. This changes the
              attachment evidence, not the official Lead.
            </p>
          }
          onClose={() => setEditing(null)}
          build={(reason, revision) => ({
            method: "POST",
            path:
              editing.command === "attach_lead"
                ? "attachments/attach"
                : `attachments/${selected.id}/${editing.command === "reject_attachment" ? "reject" : "detach"}`,
            body: {
              command: editing.command,
              expected_revision: revision,
              reason,
              ...(editing.command === "attach_lead"
                ? {
                    contact_number_id: selected.contact_number_id,
                    lead_ref: selected.lead_ref,
                  }
                : {}),
            },
          })}
        />
      )}
    </section>
  );
}
