"use client";
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
export const salesIntelligenceKeys = { all:['sales-intelligence'] as const };
// Reconnect always refetches all active DTOs. No SSE payload mutates cached business data.
export function useSalesIntelligenceLive() {
  const client = useQueryClient();
  const [status,setStatus] = useState('Connecting');
  useEffect(() => {
    let timer:ReturnType<typeof setTimeout>|undefined;
    const refresh = () => { if (!timer) timer = setTimeout(() => { timer=undefined; void client.invalidateQueries({queryKey:salesIntelligenceKeys.all}); }, 300); };
    const live = new EventSource('/api/sales-intelligence-live?scope=production');
    live.onopen = () => { setStatus('Live'); refresh(); };
    live.onerror = () => setStatus('Reconnecting — reads will refresh');
    live.addEventListener('invalidation',refresh);
    const restore = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange',restore);
    window.addEventListener('online',refresh);
    const fallback = setInterval(restore,30000);
    return () => { live.close(); clearTimeout(timer); clearInterval(fallback); document.removeEventListener('visibilitychange',restore); window.removeEventListener('online',refresh); };
  },[client]);
  return status;
}
