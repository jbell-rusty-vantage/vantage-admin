// Synthetic component-browser acceptance for the Owner pricing flow (edit → Save → toast). No Next auth routes,
// credentials or remote calls: a stateful in-page fake of the operations pricing API answers every request.
// Run: node tests/transportation-pricing-visual.mjs [chrome-executable]
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const root = process.cwd();
const output = await mkdtemp(path.join(tmpdir(), 'vantage-pricing-visual-'));
const esbuildFolder = (await readdir(path.join(root, 'node_modules/.pnpm'))).find(name => name.startsWith('esbuild@'));
const { build } = await import(pathToFileURL(path.join(root, 'node_modules/.pnpm', esbuildFolder, 'node_modules/esbuild/lib/main.js')).href);
await build({ stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import {TransportationPricingSection} from './components/setup/transportation-pricing-section'; import {DashboardRoleProvider} from './components/layout/dashboard-role-context'; import {Toaster} from './components/ui/toaster'; createRoot(document.getElementById('root')).render(<DashboardRoleProvider role="owner"><TransportationPricingSection/><Toaster/></DashboardRoleProvider>);`, resolveDir: root, loader: 'tsx' }, bundle: true, outfile: path.join(output, 'app.js'), platform: 'browser', jsx: 'automatic', banner:{js:'globalThis.process={env:{NODE_ENV:"development"}};'}, define: { 'process.env.NODE_ENV': '"development"' }, tsconfig: path.join(root, 'tsconfig.json') });
const css = (await Promise.all(['app/globals.css', 'app/crm.css', 'components/setup/setup.css', 'components/setup/transportation-pricing.css'].map(file => readFile(path.join(root, file), 'utf8')))).join('\n').replace(/^@import[^;]+;/gm, '');
await writeFile(path.join(output, 'app.css'), css);
const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/app.css"><style>:root{--font-plus-jakarta:Arial,sans-serif}*{box-sizing:border-box}body{margin:0;background:var(--crm-page);font-family:Arial,sans-serif}#root{max-width:914px;margin:auto;padding:32px}button,input{font:inherit}@media(max-width:600px){#root{padding:16px}}</style></head><body data-ui="crm"><main id="root"></main><script src="/app.js"></script></body></html>`;
const server = createServer(async (req, res) => {
  const asset = req.url === '/app.js' ? 'app.js' : req.url === '/app.css' ? 'app.css' : null;
  res.setHeader('Content-Type', asset === 'app.js' ? 'text/javascript' : asset === 'app.css' ? 'text/css' : 'text/html');
  res.end(asset ? await readFile(path.join(output, asset)) : html);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, ...(process.argv[2] ? {executablePath:path.resolve(process.argv[2])} : {}) });
const mileage = ['MI_0_100','MI_101_300','MI_301_750','MI_751_1250','MI_1251_1800','MI_1801_2500','MI_2501_3000','MI_3000_PLUS'];
const volume = ['MIN_300','CF_301_500','CF_501_1000','CF_1001_1500','CF_1501_2000','CF_2001_3000','CF_3001_PLUS'];
const emptyConfiguration = () => ({currency:'USD',base_rates:Object.fromEntries(mileage.map(band=>[band,Object.fromEntries(volume.map(tier=>[tier,null]))])),surcharge_groups:[]});
const complete = c => volume.every(t => mileage.every(b => c.base_rates[b][t] !== null) && c.surcharge_groups.every(g => g.rates[t] !== null));
const screenshots = [];
const toast = (page, text) => page.locator('[data-sonner-toast]').filter({ hasText: text }).first().waitFor();

try {
  for (const [name, viewport] of [['desktop',{width:1440,height:1050}], ['mobile',{width:390,height:844}]]) {
    const page = await browser.newPage({viewport});
    const errors = [];
    page.on('pageerror', e => {errors.push(e.message); console.error(e.message);});
    // Fake operations store: one control row, immutable revisions, drafts.
    const control = {activation_version:0,active_revision_id:null,calculation_enabled:false};
    const revisions = []; const drafts = new Map(); const notes = []; let requests = 0;
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      if (!url.pathname.startsWith('/api/operations-pricing/')) return route.continue();
      requests++;
      const endpoint = url.pathname.replace('/api/operations-pricing/','');
      const method = route.request().method();
      const body = method === 'GET' ? null : route.request().postDataJSON();
      const revision = revisions.find(r => r._id === control.active_revision_id) ?? null;
      let data;
      if (endpoint === 'configuration') data = {control:structuredClone(control),revision:structuredClone(revision)};
      else if (endpoint.startsWith('revisions')) data = {items:[...revisions].reverse().map(({configuration,...rest})=>rest),next_cursor:null};
      else if (endpoint === 'drafts') { const id = (drafts.size + 1).toString(16).padStart(24,'d'); drafts.set(id,{_id:id,draft_version:1,status:'editing',configuration:structuredClone(revision?.configuration ?? emptyConfiguration())}); data = drafts.get(id); }
      else if (/^drafts\/\w+$/.test(endpoint) && method === 'PUT') { const d = drafts.get(endpoint.split('/')[1]); assert.equal(body.expected_draft_version,d.draft_version); d.configuration = body.configuration; d.configuration.surcharge_groups.forEach((g,i)=>{ g.group_id ??= `00000000-0000-4000-8000-${String(revisions.length*100+i).padStart(12,'0')}`; }); d.draft_version++; data = d; }
      else if (endpoint.endsWith('/preview')) { const d = drafts.get(endpoint.split('/')[1]); data = {draft_id:d._id,draft_version:d.draft_version,activation_version:control.activation_version,complete:complete(d.configuration),warning_hash:'b'.repeat(64),configuration_hash:'a'.repeat(64),findings:complete(d.configuration)?[]:[{code:'MISSING',path:'base_rates',message:'Missing rate'}],warnings:[{code:'TOTAL_DECREASE',mileage_band:'MI_0_100',volume_boundary:'500',old_price:'2000',new_price:'1500',message:'Synthetic'}],results:[]}; }
      else if (endpoint.endsWith('/publish')) { const d = drafts.get(endpoint.split('/')[1]); assert.equal(body.acknowledged_warning_hash,'b'.repeat(64)); assert.ok(body.change_note); notes.push(body.change_note); const id = (revisions.length + 1).toString(16).padStart(24,'a'); revisions.push({_id:id,configuration:structuredClone(d.configuration),created_at:new Date().toISOString(),change_note:body.change_note}); Object.assign(control,{active_revision_id:id,activation_version:control.activation_version+1}); data = {revision_id:id,activation_version:control.activation_version,calculation_enabled:control.calculation_enabled}; }
      else if (endpoint === 'enabled') { notes.push(body.change_note); Object.assign(control,{calculation_enabled:body.calculation_enabled,activation_version:control.activation_version+1}); data = {calculation_enabled:control.calculation_enabled}; }
      else if (endpoint === 'activate') { notes.push(body.change_note); Object.assign(control,{active_revision_id:body.revision_id,activation_version:control.activation_version+1}); data = {}; }
      else throw new Error(`Unexpected synthetic endpoint: ${method} ${endpoint}`);
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,data})});
    });
    const shot = async label => { await page.screenshot({path:path.join(output,`${name}-${label}.png`),fullPage:true}); screenshots.push(`${name}-${label}.png`); };
    await page.goto(origin);

    // First time: the base rate editor is already open; agent pricing can't be turned on yet.
    await page.getByRole('heading',{name:'Agent pricing is off'}).waitFor();
    assert.equal(await page.getByRole('switch').first().isDisabled(), true);
    await shot('first-time');
    const cells = page.locator('.tp-table input');
    assert.equal(await cells.count(), 56);
    // Saving with empty boxes explains itself and sends nothing.
    const before = requests;
    await page.getByRole('button',{name:'Save base rates'}).click();
    await toast(page,'56 rates are empty');
    assert.equal(requests, before);
    for (let i = 0; i < 56; i++) await cells.nth(i).fill(String(2 + (i % 7) * 0.25));
    await page.getByRole('button',{name:'Save base rates'}).click();
    await toast(page,'Base rates saved');
    await toast(page,'a bigger move can cost less');
    await page.getByRole('button',{name:'Edit base rates'}).waitFor();
    assert.equal(notes.at(-1), 'Updated base rates');
    await shot('saved');

    // Edit one cell later: Cancel discards, Save goes live.
    await page.getByRole('button',{name:'Edit base rates'}).click();
    await cells.first().fill('abc');
    await page.getByRole('button',{name:'Save base rates'}).click();
    await toast(page,"isn't a number");
    await cells.first().fill('3.10');
    await page.getByRole('button',{name:'Save base rates'}).click();
    await page.getByRole('button',{name:'Edit base rates'}).waitFor();
    assert.equal(revisions.at(-1).configuration.base_rates.MI_0_100.MIN_300, '3.10');
    assert.ok(await page.locator('.tp-table').getByText('$3.10').count());

    // Add a surcharge group: it starts On.
    await page.getByRole('button',{name:'Add surcharge group'}).click();
    assert.equal(await page.locator('.tp-group-editing').getByRole('switch').getAttribute('aria-checked'), 'true');
    await page.getByLabel('Group name').fill('Mountain states');
    for (const state of ['MT','WY','CO']) await page.getByRole('button',{name:state,exact:true}).click();
    const groupRates = page.locator('.tp-group-editing .tp-group-rate-inputs input');
    for (let i = 0; i < 7; i++) await groupRates.nth(i).fill('0.5');
    await shot('group-editing');
    await page.getByRole('button',{name:'Add group'}).click();
    await toast(page,'Surcharge group “Mountain states” added');
    const saved = revisions.at(-1).configuration.surcharge_groups;
    assert.equal(saved.length, 1); assert.equal(saved[0].active, true); assert.deepEqual(saved[0].states, ['CO','MT','WY']);

    // Turn the group off from its card, then agent pricing on.
    await page.locator('.tp-group').getByRole('switch').click();
    await toast(page,'“Mountain states” is off');
    assert.equal(revisions.at(-1).configuration.surcharge_groups[0].active, false);
    await page.getByRole('switch').first().click();
    await toast(page,'Agent pricing is on');
    await page.getByRole('heading',{name:'Agent pricing is on'}).waitFor();
    assert.equal(control.calculation_enabled, true);

    // Earlier versions: restore the first saved rates.
    await page.getByText('Earlier versions').click();
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button',{name:'Use these rates'}).last().click();
    await toast(page,'Restored the rates');
    assert.equal(control.active_revision_id, revisions[0]._id);
    await shot('final');

    const wide = await page.evaluate(()=>[...document.querySelectorAll("body *")].filter(el=>!el.closest(".tp-table-scroll,[data-sonner-toaster]")&&el.getBoundingClientRect().right>window.innerWidth+1).slice(0,6).map(el=>el.tagName+"."+el.className+" "+Math.round(el.getBoundingClientRect().right)));
    assert.deepEqual(wide, [], `${name}: elements past the viewport`);
    assert.deepEqual(errors,[]);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth),true,`${name}: page-level horizontal overflow`);
    await page.close();
  }
  console.log(JSON.stringify({passed:true,output,screenshots},null,2));
} finally { await browser.close(); await new Promise(resolve=>server.close(resolve)); }
