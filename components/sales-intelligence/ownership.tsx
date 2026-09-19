import type { Agent } from '@/lib/api/salesIntelligence';
// Adapted export OwnershipSplit, using server Agent {id,name}; assignment stays distinct.
export function OwnershipSplit({promisedBy,assignedTo,overallOwner}:{promisedBy?:Agent|null;assignedTo?:Agent|null;overallOwner:Agent|null}) {
 return <span className="si-ownership">
 {promisedBy !== undefined && <span className="si-ownership__item"><span className="si-ownership__label">Promised by</span> {promisedBy?.name ?? 'Unknown'}</span>}
 {assignedTo !== undefined && <span className="si-ownership__item"><span className="si-ownership__label">Action assigned to</span> {assignedTo?.name ?? 'Unassigned'}</span>}
 <span className="si-ownership__item"><span className="si-ownership__label">Outreach owned by</span> {overallOwner?.name ?? 'Unassigned'}</span>
 </span>;
}
