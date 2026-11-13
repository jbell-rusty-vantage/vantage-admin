"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cmsRequest, type CmsHistory as HistoryEntry, type CmsPage } from "@/lib/api/sitePreviewCms";

export function CmsHistory({ revision, disabled, onRestore }: { revision: number; disabled: boolean; onRestore: (revision: number) => Promise<void> }) {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<number | null>(null);
  const query = useQuery({ queryKey: ["site-preview-cms", "history", revision, page], queryFn: () => cmsRequest<CmsPage<HistoryEntry>>(`admin/history?page=${page}&limit=20`) });
  return <div className="cms-history"><p>Restore earlier copy, images and review settings together. A restore creates a new revision.</p>
    {query.isPending && <p role="status">Loading history…</p>}{query.error && <div className="cms-error" role="alert">{query.error.message}<button className="cms-link" onClick={() => void query.refetch()}>Retry</button></div>}
    {selected !== null && <div className="cms-panel cms-restore" role="alert"><strong>Restore revision {selected}?</strong><p>This replaces the current preview content and review settings. You can restore this version again from history.</p><div className="cms-actions"><button className="cms-button cms-button--primary" disabled={disabled} onClick={() => void onRestore(selected).then(() => setSelected(null))}>Restore preview content</button><button className="cms-button" disabled={disabled} onClick={() => setSelected(null)}>Cancel</button></div></div>}
    {query.data?.items.map(entry => <article className="cms-panel cms-history-row" key={entry.revision}><div><strong>Revision {entry.revision}{entry.revision === revision ? " · Current" : ""}</strong><p>{new Date(entry.updatedAt).toLocaleString()} · {typeof entry.updatedBy === "string" ? entry.updatedBy : entry.updatedBy?.email ?? "Owner"}</p><small>{entry.action === "restore" ? "Restored earlier content" : `${entry.changedKeys.length} content fields changed`}</small></div><button className="cms-button" disabled={disabled || entry.revision === revision} onClick={() => setSelected(entry.revision)}>Restore</button></article>)}
    {query.data?.items.length === 0 && <p>No saved changes yet.</p>}
    {query.data && <div className="cms-pager"><button className="cms-button" disabled={page === 1 || query.isFetching} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page}</span><button className="cms-button" disabled={!query.data.has_next_page || query.isFetching} onClick={() => setPage(page + 1)}>Next</button></div>}
  </div>;
}
