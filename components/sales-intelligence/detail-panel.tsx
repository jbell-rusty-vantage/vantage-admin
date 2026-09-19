"use client";
import { useEffect,useRef,type ReactNode } from 'react';
import { Button } from './atoms/button';
import { copy } from "./sales-intelligence-copy";
// Adapted export SidePanel template, native dialog supplies focus trap/Escape and host Button.
export function DetailPanel({children,onClose}:{children:ReactNode;onClose:()=>void}) {
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const dialog=ref.current;const opener=document.activeElement;dialog?.showModal();return ()=>{dialog?.close();if(opener instanceof HTMLElement && opener.isConnected) opener.focus();};},[]);
 return <dialog ref={ref} className="si-root si-local-dialog" onCancel={onClose} aria-labelledby="si-detail-title">
 <header className="si-panel__header"><h2 id="si-detail-title">{copy.page.detailTitle}</h2><Button variant="ghost" onClick={onClose} aria-label={copy.actions.closePanel}>{copy.actions.closePanel}</Button></header>
 <div className="si-panel__body">{children}</div>
 </dialog>;
}
