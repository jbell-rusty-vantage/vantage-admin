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
 // An attachment write moves the Number's attached Lead, its search terms and its counts.
 attachment: prefixes('attachments','attachment-pair','number','numbers'),
 number: prefixes('number','numbers','timeline','coverage'),
 restriction: prefixes('number'),
 // Call attribution is resolved from the Rep Identity Link at read time, so a link change moves the timeline too.
 rep: prefixes('reps','timeline'),
 nudge: prefixes('reps'),
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
 * Opens the one Sales Intelligence invalidation stream. Every connect and reconnect refetches every active read; while
 * the stream is not open, active reads are refetched every `SALES_INTELLIGENCE_FALLBACK_POLL_MS`.
 */
export function useSalesIntelligenceLive() {
  const client = useQueryClient();
  const [status,setStatus] = useState<SalesIntelligenceLiveStatus>("connecting");
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
    const fallback = setInterval(() => { if (!connected) restore(); },SALES_INTELLIGENCE_FALLBACK_POLL_MS);
    return () => { live.close(); clearTimeout(timer); clearInterval(fallback); document.removeEventListener('visibilitychange',restore); window.removeEventListener('online',online); };
  },[client]);
  return status;
}
