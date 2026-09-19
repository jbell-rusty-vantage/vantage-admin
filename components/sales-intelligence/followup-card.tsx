import type { Followup,Agent } from '@/lib/api/salesIntelligence';
import { Badge } from './atoms/badge';
import { OwnershipSplit } from './ownership';
import { cx,formatDateTime,label } from './lib/format';
// Adapted supplied FollowupCard presentation; unavailable command controls intentionally absent.
export function FollowupCard({followup:f,overallOwner}:{followup:Followup;overallOwner:Agent|null}) {
 return <article className={cx('si-followup-card',!f.due_at && 'si-followup-card--undated',f.overdue && 'si-followup-card--overdue')}>
 <header className="si-followup-card__header"><h4 className="si-followup-card__kind">{label(f.kind)}</h4><Badge>{label(f.origin)} · {label(f.status)}</Badge></header>
 <p className="si-followup-card__desc">{f.description}</p>
 <p className={cx('si-snooze-due',!f.due_at && 'is-needed')}>{f.due_at ? `Due ${formatDateTime(f.due_at)}` : f.status==='open'?'Due date needed':'No due date recorded'}{f.overdue && ' · Contractually overdue'}</p>
 {f.snoozed_until && <p>Snoozed until {formatDateTime(f.snoozed_until)} — original date preserved</p>}
 {f.paused_channels.map(channel=><Badge key={channel} tone="amber">{label(channel)} paused</Badge>)}
 {f.disposition&&<p>Outcome: {label(f.disposition)}{f.completion_basis?` · ${label(f.completion_basis)}`:''}</p>}
 <OwnershipSplit promisedBy={f.origin==='rep_promise'?f.promised_by:undefined} assignedTo={f.assignment.agent} overallOwner={overallOwner}/>
 </article>;
}
