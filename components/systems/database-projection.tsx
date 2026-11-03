'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Database } from 'lucide-react';
import { fetchSystemsCapacity, type DatabaseCapacity } from '@/lib/api/systems';
import { fetchMongoSummary, mongoHealthKeys } from '@/lib/api/mongoHealth';
import { queryKeys } from '@/lib/query/keys';
import { checkedTime, formatBytes } from './systems-model';

export function DatabaseProjectionView({ database }: { database: DatabaseCapacity }) {
  const runway = database.until_full;
  const rate = database.growth_per_day_bytes;
  const measured = runway?.basis === 'measured';
  const sentence = !runway || rate == null ? 'The storage projection is unavailable until growth readings can be returned.'
    : runway.days_left === 0 ? 'The current disk capacity has already been reached.'
    : rate <= 0 ? 'Storage is not currently growing, so no date for reaching capacity is projected.'
    : `${measured ? 'At the current measured' : 'Using the provisional estimated'} net storage growth of ${formatBytes(rate)}/day, the current disk capacity is projected to be reached in ${runway.label}.`;
  return <div className="sy-projection" data-testid="database-storage-projection">
    <h3>Storage projection</h3>
    <p className="sy-projection__statement">{sentence}</p>
    {database.error ? <p className="sy-muted" role="status">The latest capacity read failed; this projection uses the last available reading.</p> : null}
    {runway ? <p className="sy-muted">{measured ? `Based on ${runway.points} daily measurements` : `Provisional estimate · ${runway.points} of 7 daily measurements available`}{database.until_90 ? ` · 90% full: ${database.until_90.label}` : ''}{database.read_at ? ` · Checked ${checkedTime(database.read_at)} ET` : ''}</p> : null}
    <p className="sy-muted">Assumes the current disk size stays fixed. Atlas storage auto-scaling is not verified. This uses net storage growth after updates and retention, rather than the total volume received.</p>
  </div>;
}

/** The main server owns daily growth history and its projection policy; both views reuse that authority. */
export function DatabaseProjection() {
  const capacity = useQuery({ queryKey: queryKeys.systems.capacity(), queryFn: () => fetchSystemsCapacity(), staleTime: 5 * 60_000, refetchInterval: 5 * 60_000 });
  if (capacity.isPending) return <p className="sy-muted" role="status">Reading the storage growth projection…</p>;
  if (capacity.isError) return <p className="sy-muted" role="status">The storage projection could not be refreshed. Try again shortly.</p>;
  return <DatabaseProjectionView database={capacity.data.database} />;
}

/** Compact database card for System locations; uses the same live source as the Mongo Health tab. */
export function DatabaseStorageCard() {
  const summary = useQuery({ queryKey: mongoHealthKeys.summary, queryFn: ({ signal }) => fetchMongoSummary(signal), staleTime: 60_000, refetchInterval: 60_000, retry: 1 });
  const data = summary.data;
  const storage = data?.storage.status === 'available' ? data.storage.value : null;
  const percentage = storage?.diskUsedBytes != null && storage.diskTotalBytes ? storage.diskUsedBytes / storage.diskTotalBytes * 100 : null;
  return <section className="crm-card sy-card" data-testid="systems-database-storage">
    <header className="sy-card__head"><h2 className="sy-card__title"><Database size={18} aria-hidden="true" /> Database (MongoDB Atlas)</h2><Link className="crm-link" href="/systems?tab=mongo">Open Mongo Health</Link></header>
    {summary.isPending ? <p className="sy-muted" role="status">Reading current disk usage…</p> : null}
    {percentage != null ? <p className="sy-projection__usage">{percentage.toFixed(1)}% used · {formatBytes(storage?.diskUsedBytes)} of {formatBytes(storage?.diskTotalBytes)} on the selected node{data ? ` · Checked ${checkedTime(data.sampledAt)} ET` : ''}</p> : !summary.isPending ? <p className="sy-muted">Current disk usage is unavailable.</p> : null}
    {summary.isError ? <p role="alert" className="sy-muted">Live database readings could not be refreshed.{data ? ' The last successful reading is shown.' : ''}</p> : null}
    <DatabaseProjection />
  </section>;
}
