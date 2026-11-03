'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Database, RefreshCw, Search, ShieldCheck, ChevronRight } from 'lucide-react';
import { fetchMongoCollections, fetchMongoSummary, mongoHealthKeys } from '@/lib/api/mongoHealth';
import type { MongoCollection, MongoSummary } from '@/lib/mongo-health';
import { MongoIndexDetails } from './mongo-index-details';

export function formatBytes(n: number | null | undefined) {
  if (n == null) return 'Unavailable';
  const power = n >= 1024 ** 3 ? 3 : n >= 1024 ** 2 ? 2 : n >= 1024 ? 1 : 0;
  return `${(n / 1024 ** power).toLocaleString('en-US', { maximumFractionDigits: power ? 1 : 0 })} ${['B', 'KiB', 'MiB', 'GiB'][power]}`;
}
export const metricCount = (n: number | null | undefined) => n == null ? 'Unavailable' : n.toLocaleString('en-US');
function sampled(iso: string) { return new Date(iso).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', second: '2-digit' }) + ' ET'; }
function Metric({ label, value, note, percent }: { label: string; value: string; note: string; percent?: number | null }) {
  return <div className="mh-metric"><span>{label}</span><strong>{value}</strong><small>{note}</small>{percent != null ? <meter min={0} max={100} value={percent} aria-label={label} /> : null}</div>;
}
export function MongoSummaryCards({ data }: { data: MongoSummary }) {
  const storage = data.storage.status === 'available' ? data.storage.value : null;
  const server = data.server.status === 'available' ? data.server.value : null;
  const members = data.replica.status === 'available' ? data.replica.value.members : null;
  const healthy = members?.filter(m => m.healthy && ['PRIMARY', 'SECONDARY'].includes(m.state)).length;
  const lags = members?.filter(m => m.state === 'SECONDARY').map(m => m.lagSeconds);
  const lag = lags?.length && lags.every(n => n != null) ? Math.max(...lags as number[]) : null;
  const disk = storage?.diskUsedBytes != null && storage.diskTotalBytes ? storage.diskUsedBytes / storage.diskTotalBytes * 100 : null;
  const connections = server?.connections;
  const slots = connections?.current != null && connections.available != null ? connections.current + connections.available : null;
  return <>
    <div className="mh-metrics">
      <Metric label="Replica members" value={members ? `${healthy} / ${members.length} healthy` : 'Unavailable'} note={lag == null ? 'Replication lag unavailable' : `Secondary lag up to ${lag} s`} />
      <Metric label="Disk on selected node" value={disk == null ? 'Unavailable' : `${disk.toFixed(1)}% used`} note={`${formatBytes(storage?.diskUsedBytes)} of ${formatBytes(storage?.diskTotalBytes)}`} percent={disk} />
      <Metric label="Connections on node" value={connections?.current == null ? 'Unavailable' : metricCount(connections.current)} note={slots == null ? 'Connection limit unavailable' : `${metricCount(slots)} slots · ${metricCount(connections?.active)} active`} percent={slots && connections?.current != null ? connections.current / slots * 100 : null} />
      <Metric label="Database round trip" value={data.ping.status === 'available' && data.ping.value.milliseconds != null ? `${data.ping.value.milliseconds} ms` : 'Unavailable'} note="One reading from Operations" />
    </div>
    <div className="mh-facts"><span><b>{storage?.storageBytes != null && storage.indexBytes != null ? formatBytes(storage.storageBytes + storage.indexBytes) : 'Unavailable'}</b> allocated to this database</span><span><b>{metricCount(storage?.documents)}</b> documents ≈</span><span><b>{metricCount(storage?.indexes)}</b> indexes · {formatBytes(storage?.indexBytes)}</span><span>Cache <b>{formatBytes(server?.cacheBytes)}</b> / {formatBytes(server?.cacheLimitBytes)}</span></div>
    <details className="mh-scope"><summary>What this reading covers</summary><p>{data.scope} Disk includes other databases, replication logs and system files. MongoDB {server?.version ?? 'version unavailable'}; node uptime {server?.uptimeSeconds == null ? 'unavailable' : `${(server.uptimeSeconds / 3600).toFixed(1)} hours`}. Connections rejected since startup: {metricCount(connections?.rejectedSinceStart)}.</p><p>CPU history, Atlas alerts and backup status are not connected. This snapshot does not certify collection integrity.</p>{members ? <ul>{members.map(m => <li key={m.member}>Member {m.member}: {m.state.toLowerCase()} · {m.healthy ? 'reachable' : 'unreachable'} · lag {m.lagSeconds == null ? 'unavailable' : `${m.lagSeconds} s`}</li>)}</ul> : null}</details>
  </>;
}
function CollectionRow({ row }: { row: MongoCollection }) {
  const [expanded, setExpanded] = useState(false);
  const v = row.storage.status === 'available' ? row.storage.value : null;
  return <>
    <tr><th scope="row"><button className="mh-collection" type="button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} aria-label={`${expanded ? 'Collapse' : 'Expand'} ${row.name}`}><ChevronRight size={15} aria-hidden="true" className={expanded ? 'mh-chevron-open' : ''} />{row.name}</button></th><td>{metricCount(v?.documents)}</td><td>{formatBytes(v?.storageBytes)}</td><td>{formatBytes(v?.indexBytes)}</td><td>{formatBytes(v?.reusableBytes)}</td><td>{metricCount(v?.indexCount)}</td></tr>
    {expanded ? <tr><td colSpan={6} className="mh-expanded"><div className="mh-detail-grid"><div><b>Collection detail</b><p>Logical document size: {formatBytes(v?.logicalBytes)}.</p><p>Average read: {v?.reads?.averageMs == null ? 'Unavailable' : `${v.reads.averageMs.toFixed(2)} ms`} across {metricCount(v?.reads?.operations)} operations.</p><p>Average write: {v?.writes?.averageMs == null ? 'Unavailable' : `${v.writes.averageMs.toFixed(2)} ms`} across {metricCount(v?.writes?.operations)} operations.</p><p>Collection scans since reset: {metricCount(v?.collectionScansSinceStart)}.</p><small>Latency and scan counters are cumulative since reset, not current rates. Reusable storage remains inside allocated files.</small>{row.storage.status === 'unavailable' ? <p role="status">{row.storage.reason}</p> : null}</div><MongoIndexDetails name={row.name} /></div></td></tr> : null}
  </>;
}
export function MongoHealth() {
  const client = useQueryClient();
  const summary = useQuery({ queryKey: mongoHealthKeys.summary, queryFn: ({ signal }) => fetchMongoSummary(signal), staleTime: 60_000, refetchInterval: 60_000, retry: 1 });
  const collections = useQuery({ queryKey: mongoHealthKeys.collections, queryFn: ({ signal }) => fetchMongoCollections(signal), staleTime: 300_000, refetchInterval: 300_000, retry: 1 });
  const [search, setSearch] = useState('');
  const rows = collections.data?.collections.filter(c => c.name.toLowerCase().includes(search.trim().toLowerCase())) ?? [];
  const fetching = summary.isFetching || collections.isFetching;
  const refresh = () => void client.invalidateQueries({ queryKey: mongoHealthKeys.all });
  const stale = summary.data && (summary.isError || summary.dataUpdatedAt - Date.parse(summary.data.sampledAt) > 120_000);
  return <section className="mh-panel crm-card" aria-labelledby="mongo-health-title" data-testid="mongo-health">
    <header className="mh-header"><div className="mh-title"><div className="mh-icon"><Database aria-hidden="true" size={23} /></div><div><h2 id="mongo-health-title">Mongo Health</h2><p>Live database and collection readings from Operations</p></div></div><button type="button" className="crm-button sy-action" onClick={refresh} disabled={fetching}><RefreshCw size={15} aria-hidden="true" className={fetching ? 'sy-spin' : ''} />{fetching ? 'Checking…' : 'Check again'}</button></header>
    <div className="mh-meta"><span className="mh-badge"><ShieldCheck size={13} aria-hidden="true" />Read only</span><span>{summary.data?.database ?? 'MongoDB'}{summary.data ? ` · ${stale ? 'Last successful reading' : 'Checked'} ${sampled(summary.data.sampledAt)}` : ''}</span><span>Summary cached 1 min · collections 5 min</span></div>
    {summary.isPending ? <p className="mh-loading" role="status">Checking replica members, storage and connections…</p> : summary.data ? <MongoSummaryCards data={summary.data} /> : null}
    {summary.isError ? <p className="mh-error" role="alert">{summary.error.message}{summary.data ? ' The last successful reading is shown above.' : ''}</p> : null}
    <div className="mh-inventory"><div className="mh-inventory-head"><div><h3>Collections</h3><p>{collections.data ? `${collections.data.available} of ${collections.data.total} storage readings available · checked ${sampled(collections.data.sampledAt)}` : 'Reading the collection inventory…'}</p></div><label className="mh-search"><Search size={16} aria-hidden="true" /><span className="sr-only">Search collections</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Find a collection…" /></label></div>
    {collections.isError ? <p className="mh-error" role="alert">{collections.error.message}{collections.data ? ' Showing the last successful inventory.' : ''}</p> : null}
    {collections.isPending ? <p className="mh-loading" role="status">Reading collection metadata. The first check may take a few seconds…</p> : collections.data ? <><div className="mh-table-scroll"><table className="mh-table"><caption className="sr-only">Collections ordered by allocated data plus index size, largest first</caption><thead><tr><th scope="col">Collection</th><th scope="col">Documents ≈</th><th scope="col">Allocated data</th><th scope="col">Index size</th><th scope="col">Reusable data</th><th scope="col">Indexes</th></tr></thead><tbody>{rows.map(row => <CollectionRow key={row.name} row={row} />)}</tbody></table></div>{rows.length === 0 ? <p className="mh-loading">No collections match your search.</p> : null}<p className="mh-footnote">Largest allocated collections first. Expand a collection for latency and index details. Counts are metadata estimates; no customer documents are read.</p></> : null}</div>
  </section>;
}
