import { entityHref } from '@/components/observational/entity-link';

export function officialRecordHref(model: 'FormLead' | 'CallLead' | 'BookedLead' | 'CancelledLead', id: string) {
 const type = {FormLead:'form_lead',CallLead:'call_lead',BookedLead:'booked_lead',CancelledLead:'cancelled_lead'}[model];
 return `${entityHref(type,id)}&database_scope=production`;
}

export function salesIntelligenceLeadHref(model: 'FormLead' | 'CallLead', id: string) {
  return `/sales-intelligence?view=attention&lead=${encodeURIComponent(id)}&lead_model=${model}`;
}
