import assert from 'node:assert/strict';
import { test } from 'node:test';
import { proxyForwardHeaders,currentCsiScope } from './proxyForwardHeaders';
import { canAccessDashboardPath,canProxyVantagePath } from './authorization';
process.env.MONGODB_URI='mongodb://127.0.0.1:27189';process.env.ADMIN_AUTH_DB_NAME='unit';process.env.ADMIN_ACCESS_TOKEN_SECRET='x'.repeat(32);process.env.ADMIN_REFRESH_TOKEN_SECRET='y'.repeat(32);process.env.VANTAGE_API_BASE_URL='http://127.0.0.1:3107';process.env.VANTAGE_API_SECRET='local-unit';process.env.VANTAGE_ADMIN_PROXY_SIGNING_SECRET='z'.repeat(32);
const path='api/v1/admin/sales-intelligence/outreach/abc/commands?scope=production';
test('CSI command preserves idempotency but never accepts browser identity, API secret or cookies',()=>{
 const incoming=new Headers({'Idempotency-Key':'stable-key','x-vantage-admin-role':'admin','x-vantage-admin-user-id':'forged','x-api-secret':'forged','authorization':'forged','cookie':'forged'});
 for(const method of ['POST','PATCH']) { const {headers}=proxyForwardHeaders(incoming,{id:'real-owner',email:'owner@example.test',role:'owner'},method,path);
 assert.equal(headers.get('idempotency-key'),'stable-key');assert.equal(headers.get('x-vantage-admin-user-id'),'real-owner');assert.equal(headers.get('x-vantage-admin-role'),'owner');assert.ok(headers.get('x-vantage-admin-signature'));
 for(const name of ['x-api-secret','authorization','cookie']) assert.equal(headers.get(name),null); }
 assert.equal(proxyForwardHeaders(incoming,{id:'owner',email:'owner@example.test',role:'owner'},'POST','api/v1/form-leads').headers.get('idempotency-key'),null);
});
test('Owner-only CSI page and every proxy method; Current records only including duplicate/conflicting scope',()=>{
 assert.equal(canAccessDashboardPath('admin','/sales-intelligence'),false);assert.equal(canAccessDashboardPath('owner','/sales-intelligence'),true);
 for(const method of ['GET','POST','PATCH','PUT','DELETE'] as const) {assert.equal(canProxyVantagePath({role:'admin',method,path}),false);assert.equal(canProxyVantagePath({role:'owner',method,path}),true);}
 assert.equal(currentCsiScope(path),true);assert.equal(currentCsiScope(path,{scope:'production'}),true);
 for(const bad of ['historical','combined',null,['production']]) assert.equal(currentCsiScope(path,{scope:bad}),false);
 assert.equal(currentCsiScope(path+'&scope=historical'),false);assert.equal(currentCsiScope(path+'&database_scope=combined'),false);
});
