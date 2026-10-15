/** Phase 1 real BFF/browser proof; local replica fixtures only. */
import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {signIn} from './helpers';
import {salesOutreachRepMetricsSchema,salesOutreachQueueSchema} from '../../lib/api/salesOutreach';
const BFF='/api/proxy/api/v1/admin/sales-outreach';
const A='d9e98cc15237c848c5c8732b',B='360f2f6456d420c391c73535';
const evidence=path.join(process.cwd(),'docs/rep-desk-and-pool/phase1-local-evidence');
test.skip(process.env.E2E_PHASE1!=='1','requires isolated real replica Phase1 fixtures');
test.setTimeout(180_000);
test.beforeAll(()=>mkdirSync(evidence,{recursive:true}));

function mutate(restore=false){
  execFileSync(process.execPath,['--import','tsx','ops/local-integration/phase1-browser-mutation.ts','--database=testvantagemovers_phase1',...(restore?['--restore']:[])],{cwd:path.resolve(process.cwd(),'../vantage-movers-server'),stdio:'pipe'});
}

test('Rep booked binder, calendar filters, relative labels and URL refresh',async({page})=>{
  await signIn(page,'rep');
  const metrics=await page.request.get(`${BFF}/rep-metrics`);expect(metrics.status()).toBe(200);
  const data=salesOutreachRepMetricsSchema.parse((await metrics.json()).data);
  expect(data.official_binder).toMatchObject({today:85.01,last_week:75,last_month:125,all_time:495.01});
  expect(data.assigned_potential).toMatchObject({known_binder_total:1000.01,coverage:'partial',missing_amount_count:1,dangling_link_count:1,mismatched_link_count:1});
  expect((await page.request.get(`${BFF}/rep-metrics?agent_id=${B}`)).status()).toBe(403);
  await page.goto('/outreach-desk?view=my&workflow=all&state=all_active&sort=move_date');
  await page.addStyleTag({content:'nextjs-portal {display:none!important}'});
  const card=page.getByTestId('binder-card');await expect(card.getByTestId('binder-all_time')).toHaveText('$495.01');
  await expect(page.getByTestId('binder-potential')).toHaveCount(0);
  for(const label of ['Today','Last Week','Last Month','All Time'])await expect(card.getByText(label,{exact:true})).toBeVisible();
  const rows=page.locator('.od-table--queue tbody tr[data-subject]');await expect(rows).toHaveCount(7);
  await expect(rows.first()).toContainText('JOB-2004');await expect(rows.last()).toContainText('JOB-2007');
  await expect(rows.filter({hasText:'JOB-2001'})).toContainText(/Today/);
  await expect(rows.filter({hasText:'JOB-2004'})).toContainText(/days ago/);
  await expect(rows.filter({hasText:'JOB-2007'})).toContainText('No interaction');
  await page.screenshot({path:path.join(evidence,'rep-metrics-and-queue.png'),fullPage:true});
  await page.getByTestId('queue').screenshot({path:path.join(evidence,'rep-queue-relative-labels.png')});
  await page.getByRole('combobox',{name:'Move date',exact:true}).selectOption('upcoming');
  await expect(page).toHaveURL(/move=upcoming/);await expect(rows).toHaveCount(5);
  await expect(rows.first()).toContainText('JOB-2001');
  await page.reload();await expect(page.getByRole('combobox',{name:'Move date',exact:true})).toHaveValue('upcoming');await expect(rows).toHaveCount(5);
  await page.getByRole('combobox',{name:'Move date',exact:true}).selectOption('past');await expect(rows).toHaveCount(1);await expect(rows.first()).toContainText('JOB-2004');
  await page.addStyleTag({content:'nextjs-portal {display:none!important}'});
  await page.screenshot({path:path.join(evidence,'rep-past-filter.png'),fullPage:true});
  await page.getByRole('combobox',{name:'Move date',exact:true}).selectOption('unknown');await expect(rows).toHaveCount(1);await expect(rows.first()).toContainText('JOB-2007');
  await page.reload();await expect(page.getByRole('combobox',{name:'Move date',exact:true})).toHaveValue('unknown');
  await page.addStyleTag({content:'nextjs-portal {display:none!important}'});
  await page.screenshot({path:path.join(evidence,'rep-unknown-filter.png'),fullPage:true});
  const q=await page.request.get(`${BFF}/queue?sort=move_date&state=all_active&limit=2`);expect(q.status()).toBe(200);
  let parsed=salesOutreachQueueSchema.parse((await q.json()).data);
  const ids=parsed.rows.map(r=>r.subject_id),dates=parsed.rows.map(r=>r.move_date);
  while(parsed.next_cursor){const response=await page.request.get(`${BFF}/queue?sort=move_date&state=all_active&limit=2&cursor=${encodeURIComponent(parsed.next_cursor)}`);expect(response.status()).toBe(200);parsed=salesOutreachQueueSchema.parse((await response.json()).data);ids.push(...parsed.rows.map(r=>r.subject_id));dates.push(...parsed.rows.map(r=>r.move_date));}
  expect(new Set(ids).size).toBe(7);expect(dates).toEqual([...dates.filter(Boolean).sort(),null]);
  const composed=await page.request.get(`${BFF}/queue?sort=move_date&state=all_active&search=JOB-2004&priority=0&workflow=new&move_date_to=2026-10-12&limit=2`);
  expect(composed.status()).toBe(200);expect(salesOutreachQueueSchema.parse((await composed.json()).data).rows.map(r=>r.job_no)).toEqual(['JOB-2004']);
});

test('Owner and Manager view a selected Rep; generic Admin denied',async({page})=>{
  for(const role of ['owner','manager'] as const){
    await page.context().clearCookies();await signIn(page,role);
    expect((await page.request.get(`${BFF}/rep-metrics?agent_id=${A}`)).status()).toBe(200);
    await page.goto(`/outreach-desk?view=my&agent=${A}&workflow=all&state=all_active&sort=move_date&move=past`);
    await page.addStyleTag({content:'nextjs-portal {display:none!important}'});
    await expect(page.getByTestId('binder-all_time')).toHaveText('$495.01');
    await expect(page.locator('.od-table--queue tbody tr[data-subject]')).toHaveCount(1);
    await page.screenshot({path:path.join(evidence,`${role}-selected-rep.png`),fullPage:true});
    await page.goto(`/outreach-desk?view=team&agent=${A}&workflow=all&state=all_active&sort=move_date&move=past`);
    await expect(page.getByRole('combobox',{name:'Move date',exact:true})).toHaveValue('past');
    await expect(page.locator('.od-table--attention tbody tr')).toHaveCount(1);
  }
  await page.context().clearCookies();await signIn(page,'admin');expect((await page.request.get(`${BFF}/rep-metrics?agent_id=${A}`)).status()).toBe(403);
});

test('Committed metric hint refreshes the card and stream reopen refetches missed changes',async({page})=>{
  test.setTimeout(150_000);
  await signIn(page,'rep');await page.goto('/outreach-desk?view=my&workflow=all&state=all_active');
  await page.addStyleTag({content:'nextjs-portal {display:none!important}'});
  const allTime=page.getByTestId('binder-all_time');await expect(allTime).toHaveText('$495.01');
  await expect(page.getByTestId('binder-card')).not.toContainText('Refresh reconnecting',{timeout:30_000});
  async function expectMetricsRefresh(action:()=>void){
    const refreshed=page.waitForResponse(response=>response.url().includes(`${BFF}/rep-metrics`)&&response.status()===200,{timeout:30_000});
    action();
    const data=salesOutreachRepMetricsSchema.parse((await (await refreshed).json()).data);
    await expect(allTime).toHaveText(new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(data.official_binder.all_time));
  }
  try{
    await expectMetricsRefresh(()=>mutate());
    await expectMetricsRefresh(()=>mutate(true));
    // Trigger the app's hidden-page lifecycle; it closes the real SSE, then reopens/refetches on return.
    await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});document.dispatchEvent(new Event('visibilitychange'));});
    mutate();
    const reopened=page.waitForResponse(response=>response.url().includes(`${BFF}/rep-metrics`)&&response.status()===200,{timeout:30_000});
    await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'visible'});document.dispatchEvent(new Event('visibilitychange'));});
    const data=salesOutreachRepMetricsSchema.parse((await (await reopened).json()).data);
    await expect(allTime).toHaveText(new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(data.official_binder.all_time));
    await page.screenshot({path:path.join(evidence,'rep-live-reconnected.png'),fullPage:true});
  }finally{mutate(true);}
});
