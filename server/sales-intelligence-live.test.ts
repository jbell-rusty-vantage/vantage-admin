import { test } from 'node:test';
import assert from 'node:assert/strict';
import { salesIntelligenceLive } from './sales-intelligence-live';
process.env.MONGODB_URI='mongodb://127.0.0.1:27189';process.env.ADMIN_AUTH_DB_NAME='unit';process.env.ADMIN_ACCESS_TOKEN_SECRET='x'.repeat(32);process.env.ADMIN_REFRESH_TOKEN_SECRET='y'.repeat(32);process.env.VANTAGE_API_BASE_URL='http://127.0.0.1:3107';process.env.VANTAGE_API_SECRET='local-unit';process.env.VANTAGE_ADMIN_PROXY_SIGNING_SECRET='z'.repeat(32);
const owner={id:'owner',email:'owner@example.test',role:'owner' as const};
test('SSE BFF denies anonymous/Admin/non-current scope before contacting API',async()=>{
 for(const [admin,url,status] of [[null,'http://local/api/live',401],[{...owner,role:'admin' as const},'http://local/api/live',403],[owner,'http://local/api/live?scope=historical',403]] as const){
 let calls=0;const result=await salesIntelligenceLive(new Request(url),{admin,url:'http://127.0.0.1:3107',apiSecret:'unit',fetch:async()=>{calls++;throw Error();}});assert.equal(result.status,status);assert.equal(calls,0);}
});
test('SSE BFF passes bytes immediately, forwards cursor/trusted identity and cancels upstream',async()=>{
 let cancelled=false;let signal:AbortSignal|null|undefined;
 const result=await salesIntelligenceLive(new Request('http://local/api/live',{headers:{'last-event-id':'old-cursor','x-vantage-admin-user-id':'spoof'}}),{
 admin:owner,url:'http://127.0.0.1:3107',apiSecret:'unit',fetch:async(_url,init)=>{signal=init?.signal;const headers=new Headers(init?.headers);assert.equal(headers.get('last-event-id'),'old-cursor');assert.equal(headers.get('x-vantage-admin-user-id'),'owner');return new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('event: invalidation\n\n'));},cancel(){cancelled=true;}}),{headers:{'content-type':'text/event-stream'}});}});
 assert.equal(result.headers.get('x-accel-buffering'),'no');const reader=result.body!.getReader();assert.match(new TextDecoder().decode((await reader.read()).value),/invalidation/);await reader.cancel();assert.equal(cancelled,true);assert.equal(signal?.aborted,true);
});
