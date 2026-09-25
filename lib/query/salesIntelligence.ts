"use client";
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';
export const salesIntelligenceKeys = { all:['sales-intelligence'] as const };
// Reconnect always refetches all active DTOs. No SSE payload mutates cached business data.
export type SalesIntelligenceLiveStatus = "connecting" | "live" | "reconnecting";
const prefixes = (...segments:string[]):readonly (readonly string[])[] => segments.map(segment => [...salesIntelligenceKeys.all, segment]);
/** Topic slug to the query-key prefixes that topic can change. The server sends slugs derived from
 *  the changed collection only, so this stays a display-layer routing table, never domain truth. */
export const salesIntelligenceTopicKeys:Readonly<Record<string, readonly (readonly string[])[]>> = {
 // The attention list is one published snapshot. Outreach, number, attachment,
 // review and restriction writes do not change it; only a new snapshot does.
 // Routing those writes here cancelled the in-flight list read, so Load more
 // stayed disabled for as long as production kept writing.
 // UI1-DATA: 'overview' and 'closed-history' read Outreach records directly (not the snapshot), so record writes refresh them.
 outreach: prefixes('outreach','outreach-by-lead','number','timeline','assessment','overview','closed-history'),
 attachment: prefixes('attachments','attachment-pair','number','outreach','outreach-by-lead'),
 analysis: prefixes('analysis-runs','analysis-run','analysis-evidence','analysis-evidence-content','analysis-presentation','analysis-output','assessment','assessment-artifact','assessment-evidence','assessment-output','number','coverage','findings','conversations','transcript'),
 number: prefixes('number','numbers','timeline','outreach','outreach-by-lead','coverage','conversations','transcript'),
 // A new snapshot also moves the Overview's Now block (C8) and can move rows out of the 90-day Closed partition.
 attention: prefixes('attention','overview','closed-history'),
 review: prefixes('reviews','number','outreach','outreach-by-lead','timeline','findings'),
 restriction: prefixes('number','outreach','outreach-by-lead','timeline'),
 rep: prefixes('reps','nudge-destinations'),
 // The Outreach detail read carries `nudges.items` (Work tab), so a nudge refreshes it too.
 nudge: prefixes('nudges','timeline','outreach'),
};
export type SalesIntelligenceFrame = { version?:unknown; reason?:unknown; topics?:unknown; as_of?:unknown };
/** Anything we cannot narrow honestly resyncs the whole tree: a version 1 payload, an "other" or
 *  unknown topic, a clock, and every connect/reconnect, which must close the gap the drop opened. */
export function salesIntelligenceInvalidationKeys(frame:SalesIntelligenceFrame):readonly (readonly string[])[] {
 const topics = frameTopics(frame);
 if (frame.version !== 2 || frame.reason !== 'change' || !topics.length) return [salesIntelligenceKeys.all];
 if (topics.some(topic => !salesIntelligenceTopicKeys[topic])) return [salesIntelligenceKeys.all];
 const unique = new Map<string, readonly string[]>();
 for (const topic of topics) for (const key of salesIntelligenceTopicKeys[topic]!) unique.set(key.join('\u0000'), key);
 return [...unique.values()];
}
function frameTopics(frame:SalesIntelligenceFrame):string[] {
 return Array.isArray(frame.topics) ? [...new Set(frame.topics.filter((topic):topic is string => typeof topic === 'string'))].sort() : [];
}
export type SalesIntelligencePulse = { topics:string[]; at:string|null };
/** ~6s so a "just changed" affordance fades on its own; the desk never renders a stale highlight. */
export const SALES_INTELLIGENCE_PULSE_MS = 6000;
let pulse:SalesIntelligencePulse = { topics:[], at:null };
let decay:ReturnType<typeof setTimeout>|undefined;
const pulseListeners = new Set<() => void>();
function emitPulse(next:SalesIntelligencePulse) { pulse = next; for (const listener of [...pulseListeners]) listener(); }
/** Change frames only. A clock, connect or reconnect carries no topics and must not pulse. */
export function publishSalesIntelligencePulse(topics:readonly string[], at:string) {
 if (!topics.length) return;
 if (decay) clearTimeout(decay);
 emitPulse({ topics:[...new Set(topics)].sort(), at });
 decay = setTimeout(() => { decay = undefined; emitPulse({ topics:[], at:pulse.at }); }, SALES_INTELLIGENCE_PULSE_MS);
}
export function readSalesIntelligencePulse():SalesIntelligencePulse { return pulse; }
export function subscribeSalesIntelligencePulse(listener:() => void) { pulseListeners.add(listener); return () => { pulseListeners.delete(listener); }; }
/** The most recent change frame, shared by every reader of the one EventSource. */
export function useSalesIntelligencePulse():SalesIntelligencePulse {
 return useSyncExternalStore(subscribeSalesIntelligencePulse, readSalesIntelligencePulse, readSalesIntelligencePulse);
}

/** UI1-LIVE (UI-0 §2.5): the header reads `Offline · Refresh` after this long without the stream. */
export const SALES_INTELLIGENCE_OFFLINE_MS = 30000;
/** UI1-LIVE (UI-0 §2.5): while the stream is down, active reads poll this often. */
export const SALES_INTELLIGENCE_FALLBACK_POLL_MS = 60000;
/**
 * UI1-LIVE, additive. With no options the hook behaves exactly as before (`_legacy/`): a full resync every 30 s
 * while the tab is visible, live or not. The new header passes `{ fallbackMs: 60000, fallbackWhileLive: false }`:
 * the timed resync then runs only while the stream is not open (the 60 s fallback poll).
 */
export type SalesIntelligenceLiveOptions = { fallbackMs?:number; fallbackWhileLive?:boolean };

export function useSalesIntelligenceLive(options:SalesIntelligenceLiveOptions = {}) {
  const client = useQueryClient();
  const [status,setStatus] = useState<SalesIntelligenceLiveStatus>("connecting");
  const fallbackMs = options.fallbackMs ?? 30000;
  const fallbackWhileLive = options.fallbackWhileLive ?? true;
  useEffect(() => {
    let connected = false;
    let timer:ReturnType<typeof setTimeout>|undefined;
    const queued = new Map<string, readonly string[]>();
    const flush = () => { timer=undefined; const keys=[...queued.values()]; queued.clear(); for (const queryKey of keys) void client.invalidateQueries({queryKey}); };
    // A frameless refresh (open, visibility, online, fallback) stays a full resync.
    const refresh = (frame:SalesIntelligenceFrame = {}) => { for (const key of salesIntelligenceInvalidationKeys(frame)) queued.set(key.join('\u0000'), key); if (!timer) timer = setTimeout(flush, 300); };
    const live = new EventSource('/api/sales-intelligence-live?scope=production');
    live.onopen = () => { connected = true; setStatus("live"); refresh(); };
    live.onerror = () => { connected = false; setStatus("reconnecting"); };
    live.addEventListener('invalidation',(event) => {
      let frame:SalesIntelligenceFrame = {};
      try { frame = JSON.parse((event as MessageEvent<string>).data) as SalesIntelligenceFrame; } catch { frame = {}; }
      refresh(frame);
      if (frame.reason === 'change') publishSalesIntelligencePulse(frameTopics(frame).length ? frameTopics(frame) : ['other'], typeof frame.as_of === 'string' ? frame.as_of : new Date().toISOString());
    });
    const restore = () => { if (document.visibilityState === 'visible') refresh(); };
    const online = () => refresh();
    document.addEventListener('visibilitychange',restore);
    window.addEventListener('online',online);
    const fallback = setInterval(() => { if (fallbackWhileLive || !connected) restore(); },fallbackMs);
    return () => { live.close(); clearTimeout(timer); clearInterval(fallback); document.removeEventListener('visibilitychange',restore); window.removeEventListener('online',online); };
  },[client,fallbackMs,fallbackWhileLive]);
  return status;
}
