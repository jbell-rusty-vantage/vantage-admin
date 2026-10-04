"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { readSalesIntelligence, repsSchema, reviewedNudgeChannels, type DirectoryUser } from "@/lib/api/salesIntelligence";
import { siKeys } from "./data/query-keys";
import { useReportAsOf } from "./data/live";
import { Button } from "./atoms/button";
import { EvidenceCommand } from "./evidence-command";
import { MessageAccountPanel } from "./message-account-panel";
import { copy } from "./sales-intelligence-copy";
import { formatDateTime, label } from "./lib/format";

/** RingCentral Accounts: the stored directory, reviewed Agent identity and directory `review_context` messages. */
export function Reps({ directoryCursor, onDirectoryCursor }: { directoryCursor: string | null; onDirectoryCursor: (cursor: string | null) => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messageUser, setMessageUser] = useState<DirectoryUser | null>(null);
  const query = new URLSearchParams({ limit: "50" });
  if (directoryCursor) query.set("directory_cursor", directoryCursor);
  const list = useQuery({
    queryKey: siKeys.reps(query.toString()),
    queryFn: ({ signal }) => readSalesIntelligence(`reps?${query}`, repsSchema, signal),
    retry: false,
  });
  useReportAsOf(list.data?.as_of);
  const selected = list.data?.data.items.find(row => row.id === selectedId);
  const users = list.data?.data.directory.users ?? [];
  const reviewedFor = (user: DirectoryUser) =>
    list.data?.data.items.find(item => item.rc_extension_id === user.extension_id && item.rc_account_id === (user.rc_account_id ?? item.rc_account_id) && item.status === "reviewed" && !item.effective_to);
  return (
    <section className="si-local-stack">
      <h2>{copy.reps.title}</h2>
      <p className="si-local-notice">{copy.page.viewIntro.reps}</p>
      {list.isPending && <p role="status">Loading RingCentral Accounts…</p>}
      {list.error && (
        <p role="alert">
          {copy.errors.repsFailed}{" "}
          <Button variant="link" onClick={() => void list.refetch()}>{copy.actions.retry}</Button>
        </p>
      )}
      {list.data && (
        <>
          <p>
            Directory {label(list.data.data.directory.status)}
            {list.data.data.directory.taken_at ? ` · Observed ${formatDateTime(list.data.data.directory.taken_at)}` : ""}.
            {" "}{copy.reps.excludedOwner}
          </p>
          <p>{copy.reps.metricsUnavailable}</p>
          {!users.length && <p>{copy.reps.none}</p>}
          {users.length > 0 && (
            <div className="si-accounts">
              <table className="si-accounts__table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Extension</th>
                    <th>Account</th>
                    <th>Status</th>
                    <th>Agent</th>
                    <th><span className="si-sr">Message</span></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => {
                    const link = reviewedFor(user);
                    const agent = user.attached_agent ?? (link ? { id: link.agent_id, name: link.agent_name } : null);
                    const enabled = (user.directory_status ?? user.status) === "Enabled";
                    return (
                      <tr key={`${user.rc_account_id ?? ""}:${user.extension_id}`}>
                        <td>{user.extension_name ?? user.extension_id}</td>
                        <td>{user.extension_number ?? "—"}</td>
                        <td>{user.rc_account_id ?? "—"}</td>
                        <td>{label(user.directory_status ?? user.status)}</td>
                        <td>{agent ? agent.name : copy.reps.noAgent}</td>
                        <td>
                          <div className="si-local-filters">
                            <Button disabled={!enabled} onClick={() => setMessageUser(user)}>{copy.reps.message}</Button>
                            {list.data?.data.items.filter(item => item.rc_extension_id === user.extension_id && item.status === "proposed").map(item => (
                              <Button key={item.id} onClick={() => setSelectedId(item.id)}>Review proposed identity</Button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {list.data.data.items.filter(item => !users.some(user => user.extension_id === item.rc_extension_id)).map(rep => (
            <article className="si-local-stack" key={rep.id}>
              <h3>{rep.agent_name} · {rep.rc_extension_name ?? rep.rc_extension_number ?? "Extension name unavailable"}</h3>
              <p>{label(rep.status)} · {label(rep.role_kind)} · Effective {formatDateTime(rep.effective_from)} through {rep.effective_to ? formatDateTime(rep.effective_to) : "ongoing"}</p>
              {rep.status === "proposed" && <Button onClick={() => setSelectedId(rep.id)}>Review proposed identity</Button>}
            </article>
          ))}
          <div className="si-local-filters">
            {directoryCursor && <Button onClick={() => onDirectoryCursor(null)}>First directory page</Button>}
            {list.data.data.directory.next_cursor && (
              <Button disabled={list.isFetching} onClick={() => onDirectoryCursor(list.data!.data.directory.next_cursor)}>Next directory entries</Button>
            )}
          </div>
        </>
      )}
      {messageUser && (
        <MessageAccountPanel
          user={messageUser}
          reviewedLinkId={reviewedFor(messageUser)?.id}
          reviewedRevision={reviewedFor(messageUser)?.revision}
          onClose={() => setMessageUser(null)}
        />
      )}
      {selected && (
        <EvidenceCommand
          title="Review proposed Rep identity"
          revision={selected.revision}
          enabled={selected.status === "proposed"}
          context={(
            <>
              <p>Confirm {selected.agent_name} is {selected.rc_extension_name ?? selected.rc_extension_id}, with role {label(selected.role_kind)}, from {formatDateTime(selected.effective_from)} through {selected.effective_to ? formatDateTime(selected.effective_to) : "ongoing"}.</p>
              <p>{reviewedNudgeChannels(selected.rc_direct_numbers).includes("sms_to_rep") ? copy.reps.channelsPagerSms : copy.reps.channelsPager}</p>
              <p>{copy.reps.reviewChannels}</p>
            </>
          )}
          onClose={() => setSelectedId(null)}
          build={(reason, revision) => ({
            method: "POST",
            path: `reps/${selected.id}/review`,
            body: {
              expected_revision: revision,
              reason,
              status: "reviewed",
              link: {
                agent_id: selected.agent_id,
                rc_account_id: selected.rc_account_id,
                rc_extension_id: selected.rc_extension_id,
                role_kind: selected.role_kind,
                effective_from: selected.effective_from,
                effective_to: selected.effective_to,
                nudge_channels_allowed: reviewedNudgeChannels(selected.rc_direct_numbers),
              },
            },
          })}
        />
      )}
    </section>
  );
}
