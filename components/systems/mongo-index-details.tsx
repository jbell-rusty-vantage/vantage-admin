'use client';
import { useQuery } from '@tanstack/react-query';
import { fetchMongoIndexes, mongoHealthKeys } from '@/lib/api/mongoHealth';

export function MongoIndexDetails({ name }: { name: string }) {
  const query = useQuery({ queryKey: mongoHealthKeys.indexes(name), queryFn: ({ signal }) => fetchMongoIndexes(name, signal), staleTime: 300_000, retry: 1 });
  if (query.isPending) return <p role="status">Reading indexes…</p>;
  if (query.isError) return <div><p role="alert">Index details are unavailable.</p><button type="button" className="crm-button" onClick={() => void query.refetch()}>Retry indexes</button></div>;
  const { definitions, usage, sizes } = query.data;
  if (definitions.status !== 'available') return <p>{definitions.reason}</p>;
  return <div className="mh-indexes"><b>Indexes · {definitions.value.length}</b><p className="mh-footnote">Use counters are node-local since the date shown. Zero observed use does not mean an index can be removed.</p>{definitions.value.map(index => {
    const uses = usage.status === 'available' ? usage.value.filter(i => i.name === index.name) : null;
    const indexSize = sizes.status === 'available' && sizes.value.every(part => part[index.name] != null)
      ? sizes.value.reduce((total, part) => total + part[index.name], 0) : null;
    return <div className="mh-index" key={index.name}><strong>{index.name}</strong><code>{Object.entries(index.keys).map(([key, direction]) => `${key}: ${direction}`).join(', ')}</code><span>{indexSize == null ? 'Size unavailable' : `${(indexSize / 1048576).toFixed(2)} MiB`}{index.unique ? ' · unique' : ''}{index.ttlSeconds != null ? ` · expires after ${index.ttlSeconds} s` : ''}{index.hidden ? ' · hidden' : ''}{index.partial ? ' · partial' : ''}{index.sparse ? ' · sparse' : ''}</span>{uses?.length ? uses.map((u, i) => <small key={i}>{u.operations == null ? 'Usage unavailable' : `${u.operations.toLocaleString('en-US')} uses`}{u.since ? ` since ${new Date(u.since).toLocaleString('en-US', { timeZone: 'America/New_York' })} ET` : ''}</small>) : <small>Usage unavailable</small>}</div>;
  })}</div>;
}
