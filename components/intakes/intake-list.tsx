import Link from "next/link";
import { Fragment } from "react";
import { formatDateTime } from "@/components/data-table/formatters";
import { StatusBadge } from "@/components/data-table/status-badge";
import type { GranotLifecycleCaseListItem } from "@/lib/api/granotLifecycle";
import { cn } from "@/lib/utils";
import { GranotBookingStatementAccordion } from "./granot-booking-statement";
import {
  granotUpdateCountLine,
  intakeActionLabel,
  intakeCaseHref,
  intakeJobHref,
  intakeKindFromCase,
  intakeKindLabel,
  intakeNextStep,
  intakePairingLine,
  intakeStatusLabel,
  intakeWhatVantageHas,
  intakeWhyHere,
  type IntakeKind,
} from "./intake-copy";

function ageLabel(value: string, now = Date.now()): string {
  const elapsed = Math.max(0, now - new Date(value).getTime());
  const hours = Math.floor(elapsed / 3_600_000);
  if (hours < 1) return `${Math.floor(elapsed / 60_000)}m`;
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function IntakeList({
  items,
  kind,
  emptyMessage,
  now,
  selectedCaseId,
  listQuery,
}: {
  items?: GranotLifecycleCaseListItem[];
  kind: IntakeKind;
  emptyMessage: string;
  now?: number;
  selectedCaseId?: string;
  listQuery?: { state?: "open" | "resolved"; job?: string };
}) {
  const rows = (items ?? []).filter((item) => intakeKindFromCase(item.kind) === kind);
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2">Job</th>
            <th scope="col" className="px-3 py-2">Why it is here</th>
            <th scope="col" className="px-3 py-2">What Vantage has</th>
            <th scope="col" className="px-3 py-2">Next step</th>
            <th scope="col" className="px-3 py-2">Customer</th>
            <th scope="col" className="px-3 py-2">Source</th>
            <th scope="col" className="px-3 py-2">Last update</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((item) => {
            const href = intakeCaseHref(item.case_id, {
              tab: kind,
              state: listQuery?.state,
              job: listQuery?.job,
            });
            const selected = selectedCaseId === item.case_id;
            return (
              <Fragment key={`${item.kind}:${item.case_id}`}>
              <tr
                className={cn(selected && "bg-steel-100")}
              >
                <td className="px-3 py-3 align-top">
                  <Link
                    className="font-semibold text-trust-blue hover:underline"
                    href={href}
                  >
                    {item.job_no}
                  </Link>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <StatusBadge tone={item.state === "open" ? "warning" : "muted"}>
                      {intakeStatusLabel(item.state)}
                    </StatusBadge>
                    <StatusBadge>{intakeKindLabel(intakeKindFromCase(item.kind))}</StatusBadge>
                  </div>
                  <p className="mt-2">
                    <Link
                      className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-semibold text-white hover:bg-navy"
                      href={href}
                    >
                      {intakeActionLabel(kind)}
                    </Link>
                  </p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    <Link className="hover:underline" href={intakeJobHref(item.normalized_job_no)}>
                      Open job history
                    </Link>
                  </p>
                </td>
                <td className="px-3 py-3 align-top">
                  <p>{intakeWhyHere(item.latest_action)}</p>
                  {(() => {
                    const pairing = intakePairingLine(item.priority_pairing);
                    if (!pairing) return null;
                    return (
                      <p className={cn(
                        "mt-1 text-xs",
                        pairing.tone === "warning" ? "font-medium text-amber-800" : "text-muted-foreground",
                      )}>
                        {pairing.text}
                      </p>
                    );
                  })()}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {granotUpdateCountLine(item.evidence_count)} on this job
                  </p>
                </td>
                <td className="px-3 py-3 align-top">{intakeWhatVantageHas(item)}</td>
                <td className="px-3 py-3 align-top">{intakeNextStep(item)}</td>
                <td className="px-3 py-3 align-top">{item.customer_label || "—"}</td>
                <td className="px-3 py-3 align-top">{item.source.label ?? item.source.id ?? "—"}</td>
                <td className="px-3 py-3 align-top">
                  <span aria-label={`Age ${ageLabel(item.last_evidence_at, now)}`}>
                    {formatDateTime(item.last_evidence_at)}
                  </span>
                  <p className="text-xs text-muted-foreground">{ageLabel(item.last_evidence_at, now)} ago</p>
                </td>
              </tr>
              <tr className={cn(selected && "bg-steel-100")}>
                <td className="px-3 pb-4 pt-0" colSpan={7}>
                  <GranotBookingStatementAccordion caseId={item.case_id} kind={kind} />
                </td>
              </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
