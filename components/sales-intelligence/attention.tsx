"use client";
import type { AttentionRow as Row } from '@/lib/api/salesIntelligence';
import { Badge } from './atoms/badge';
import { Button } from './atoms/button';
import { OwnershipSplit } from './ownership';
import { cx,label,formatDateTime } from './lib/format';
// Adapted export AttentionRow: supplied order/reasons only; no invented chips or outcomes.
export function AttentionRow({row,selected,onOpen}:{row:Row;selected:boolean;onOpen:()=>void}) {
 const record=row.outreach;
 return <li className={cx('si-row',selected && 'is-selected',row.derived.overdue && 'is-overdue')} aria-current={selected || undefined}>
 <div className="si-row__identity"><strong>{record?.primary_number?.e164 ?? (row.subject.kind==='number_review' ? 'Number review' : row.subject.model==='FormLead' ? 'Form Lead' : 'Call Lead')}</strong><span>{record ? label(record.state) : 'Needs review'}</span></div>
 {record?.lead_display&&<p>{record.lead_display.name??'Name not observed'} · {record.lead_display.source_company??'Source Company not observed'}{record.lead_display.job_no?` · Job ${record.lead_display.job_no}`:''}</p>}
 {record?.latest_number_call&&<p>Latest number activity: {record.latest_number_call.provider_result??'Outcome unknown'} · {label(record.latest_number_call.contact_type)}</p>}
 <div className="si-row__reason">{row.derived.reasons.map(reason=><span key={reason} className="si-row__reasontext">{label(reason)}</span>)}{!row.derived.reasons.length && <span>Needs review</span>}</div>
 <div className="si-row__last"><span>Last human contact</span><span>{formatDateTime(record?.last_meaningful_contact_at)}</span></div>
 <div className="si-row__owner"><OwnershipSplit overallOwner={record?.assignment.agent ?? null}/></div>
 <div className="si-row__secondary si-chiprow">{row.derived.review_badges?.map(reason=><Badge tone="amber" key={reason}>{label(reason)}</Badge>)}{row.derived.call_blockers.map(reason=><Badge key={reason}>{label(reason)}</Badge>)}</div>
 <div className="si-row__actions"><Button onClick={onOpen} aria-label={`Open ${record?.primary_number?.e164 ?? row.subject_key}`}>Open detail</Button></div>
 </li>;
}

