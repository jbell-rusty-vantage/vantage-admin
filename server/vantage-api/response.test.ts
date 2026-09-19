import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseVantageApiResponse } from './response';
test('CSI keeps authoritative as_of and unknown coverage through buffered JSON proxy',async()=>{
 const body={ok:true,as_of:'2026-09-19T00:00:00Z',coverage:{known_through:null},data:{status:'pending_projection',total_items:null}};
 const response=await parseVantageApiResponse(Response.json(body),'api/v1/admin/sales-intelligence/attention');
 assert.equal(response.kind,'json');if(response.kind==='json'){assert.deepEqual(response.data,body.data);assert.deepEqual(response.metadata,{as_of:body.as_of,coverage:body.coverage});}
});
