"use client";
import { useEffect,useId,useRef,useState,type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { sendSalesIntelligence,SalesIntelligenceError,type CommandIntent } from '@/lib/api/salesIntelligence';
import { salesIntelligenceKeys } from '@/lib/query/salesIntelligence';
import { Button } from './atoms/button';

/** Keeps one exact intent until its outcome is known; refreshed props never replace a draft. */
export function EvidenceCommand({title,revision,enabled,context,build,onClose}:{title:string;revision:number;enabled:boolean;context:ReactNode;build:(reason:string,revision:number)=>Omit<CommandIntent,'key'>;onClose:()=>void}) {
 const id=useId(),dialog=useRef<HTMLDialogElement>(null),client=useQueryClient(),intent=useRef<CommandIntent|null>(null),lock=useRef(false);
 const [base,setBase]=useState(revision),[reason,setReason]=useState(''),[pending,setPending]=useState(false),[unknown,setUnknown]=useState(false),[error,setError]=useState('');
 useEffect(()=>{const node=dialog.current,opener=document.activeElement,parent=opener?.closest('dialog');node?.showModal();return()=>{node?.close();if(opener instanceof HTMLElement&&opener.isConnected&&!opener.matches(':disabled'))opener.focus();else parent?.querySelector<HTMLElement>('button:not(:disabled),a[href]')?.focus();};},[]);
 async function submit() {
  if(lock.current)return;lock.current=true;setPending(true);setError('');
  try {intent.current??={...build(reason.trim(),base),key:crypto.randomUUID()};const result=await sendSalesIntelligence(intent.current);
   intent.current=null;setUnknown(false);await client.invalidateQueries({queryKey:salesIntelligenceKeys.all});
   if(result.response.blocked)setError(`The action was blocked: ${result.response.reason??result.response.blocked}.`);else onClose();
  }catch(error){const uncertain=!(error instanceof SalesIntelligenceError)||error.status>=500;setUnknown(uncertain);if(!uncertain)intent.current=null;
   setError(uncertain?'Outcome unknown. Retry the same request to recover the saved result.':`Request rejected: ${(error as SalesIntelligenceError).code}. Your reason is preserved.`);await client.invalidateQueries({queryKey:salesIntelligenceKeys.all});
  }finally{lock.current=false;setPending(false);}
 }
 return <dialog ref={dialog} className="si-root si-local-command" aria-labelledby={id} onCancel={e=>{e.stopPropagation();if(pending)e.preventDefault();else onClose();}}><form className="si-local-stack" onSubmit={e=>{e.preventDefault();void submit();}}>
 <h2 id={id}>{title}</h2>{context}
 {base!==revision&&<div role="status"><p>The server values changed. Review them before submitting again.</p>{!unknown&&<Button type="button" disabled={pending} onClick={()=>{setBase(revision);intent.current=null;}}>Use current revision and retain my reason</Button>}</div>}
 <label>Reason<textarea className="si-textarea" required maxLength={500} disabled={pending||unknown} value={reason} onChange={e=>{setReason(e.target.value);intent.current=null;}}/></label>
 {error&&<p role="alert">{error}</p>}
 {!enabled&&!unknown&&<p>This action is unavailable on the current record.</p>}
 <div className="si-local-filters"><Button type="submit" disabled={pending||!reason.trim()||(!unknown&&(!enabled||base!==revision))}>{pending?'Saving…':unknown?'Retry same request':'Confirm'}</Button><Button type="button" disabled={pending} onClick={onClose}>Cancel</Button></div>
 </form></dialog>;
}
