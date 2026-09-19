/** Adapted export display helpers; no ticking, ranking, deadlines or staffed-clock calculation. */
export const cx = (...values:(string|false|null|undefined)[]) => values.filter(Boolean).join(' ');
const date = new Intl.DateTimeFormat('en-US',{ timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short' });
export const formatDateTime = (value:string|null|undefined) => value ? date.format(new Date(value)) : 'Not observed';
export const labels:Record<string,string> = {
 promised_callback_overdue:'Promised callback overdue',no_call_yet:'No call yet after form submission',missed_call_no_callback:'Missed call with no callback',followups_due:'Follow-ups due',no_next_step:'Being worked, but no next step',missing_responsibility:'Open work nobody owns',going_cold:'Going cold',
 missing_date:'Due date needed',identity:'Identity needs review',restriction:'Calling paused',closed:'Closed',review_only:'Review only',suppressed:'Contact suppressed',open:'Open',unworked:'Unworked',waiting_on_customer:'Waiting on customer',identity_review:'Identity review',rep_promise:'Rep promise',customer_request:'Customer request',customer_wait:'Customer wait',system_default:'System default',owner:'Owner',send_estimate:'Send estimate',call:'Call',text:'Text',wait:'Wait',review:'Review',other:'Other',check_availability:'Check availability',reconcile_identity:'Reconcile identity',owner_confirmed:'Confirmed by you',likely:'Likely',exact:'Exact',unsure:'Unsure',rejected:'Rejected',attached:'Attached',candidate:'Candidate',ambiguous:'Ambiguous'
};
export const label = (value:string) => labels[value] ?? value.replaceAll('_',' ');
export const reviewCauseLabel = (value:string) => value==='restriction'?'Contact restriction review':label(value);
