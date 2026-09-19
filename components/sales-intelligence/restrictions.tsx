"use client";
import { useState } from 'react';
import type { NumberRead } from '@/lib/api/salesIntelligence';
import { EvidenceCommand } from './evidence-command';
import { Button } from './atoms/button';
import { formatDateTime, label } from './lib/format';

export function Restrictions({rows}:{rows:NumberRead['data']['restrictions']}) {
 const [selection,setSelection]=useState<{id:string;resolution:'confirm'|'lift'}|null>(null);
 const row=rows.find(item=>item.id===selection?.id);
 return <section className="si-local-stack"><h3>Contact restrictions</h3>
 {!rows.length&&<p>No temporary contact restrictions recorded.</p>}
 {rows.map(item=><article key={item.id}><p>{item.channels.join(', ')} · {label(item.state)} · {item.until?`Until ${formatDateTime(item.until)}`:'No end date recorded'}</p>
 {item.allowed_actions.some(action=>action.action==='resolve_restriction'&&action.enabled)&&<div className="si-local-filters"><Button onClick={()=>setSelection({id:item.id,resolution:'confirm'})}>Confirm restriction</Button><Button onClick={()=>setSelection({id:item.id,resolution:'lift'})}>Lift restriction</Button></div>}</article>)}
 {row&&selection&&<EvidenceCommand title={selection.resolution==='lift'?'Lift contact restriction':'Confirm contact restriction'} revision={row.revision} enabled={row.allowed_actions.some(a=>a.action==='resolve_restriction'&&a.enabled)} context={<p>{row.channels.join(', ')} · {label(row.state)} · {row.until?`Until ${formatDateTime(row.until)}`:'No end date recorded'}. This decision does not change permanent suppression or complete a follow-up.</p>} onClose={()=>setSelection(null)} build={(reason,revision)=>({method:'POST',path:`restrictions/${row.id}/resolve`,body:{command:'resolve_restriction',expected_revision:revision,resolution:selection.resolution,channels:row.channels,until:row.until,reason}})}/>}
 </section>;
}
