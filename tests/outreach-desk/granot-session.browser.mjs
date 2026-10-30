/** Hydrated production components; synthetic API/provider responses. Run: node tests/outreach-desk/granot-session.browser.mjs */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';
const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve('tsx/package.json'))('esbuild');
const root = fileURLToPath(new URL('../../', import.meta.url));
const contextId = '11111111-2222-3333-4444-555555555555';
const jobContext = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const appUrl = 'https://outreach-probe.invalid/outreach-desk';
const jobUrl = `https://eagle.hellomoving.com/wc.dll?mpcharge~chargeswc~${jobContext}`;
const { outputFiles } = await build({
  stdin: { resolveDir: root, loader: 'tsx', contents: `
    import React from 'react'; import {createRoot} from 'react-dom/client';
    import {GranotSessionPilot} from './components/outreach-desk/views/granot-session-pilot';
    import {GranotLinkButton} from './components/outreach-desk/views/granot-link-button';
    createRoot(document.getElementById('root')).render(<GranotSessionPilot viewer={{role:'rep',agentId:'6a1dc03e419f58fdad44944f'}}><GranotLinkButton subjectId="111111111111111111111111" jobNo="P5550001" /></GranotSessionPilot>);
  ` }, bundle: true, write: false, format: 'iife', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' },
});

class PilotPage {
  constructor(page) { this.page = page; }
  async prepare() {
    await this.page.goto(appUrl);
    await this.page.getByLabel('Your signed-in Granot job URL').fill(`https://eagle.hellomoving.com/wc.dll?mpcharge~chargeswc~${contextId}`);
    await this.page.getByRole('button', { name: 'Use my Granot session' }).click();
    await expect(this.page.getByText('URL prepared.', { exact: false })).toBeVisible();
  }
  async open() { await this.page.getByRole('button', { name: 'Open in Granot · test' }).click(); }
}

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
try {
  for (const scenario of ['success', 'wrong_account', 'blocked', 'closed']) {
    const context = await browser.newContext();
    await context.addCookies([{ name: 'GranotCookie', value: 'synthetic', domain: 'eagle.hellomoving.com', path: '/', sameSite: 'Lax' }]);
    const page = await context.newPage();
    const pilot = new PilotPage(page);
    const calls = [];
    await context.route('https://outreach-probe.invalid/**', async route => {
      const request = route.request();
      if (request.url().includes('/api/')) {
        assert.ok(request.url().endsWith('/granot-session-link'));
        assert.equal(request.method(), 'POST');
        assert.deepEqual(request.postDataJSON(), { session_context: contextId });
        calls.push('verified_lookup');
        await route.fulfill({ status: scenario === 'wrong_account' ? 503 : 200, json: scenario === 'wrong_account'
          ? { ok: false, code: 'SERVICE_UNAVAILABLE', issues: [{ path: 'granot_link', code: 'account_mismatch' }] }
          : { ok: true, data: { url: jobUrl, job_no: 'P5550001', account_verified: true, captured_at: '2026-10-30T21:00:00Z' } } });
      } else await route.fulfill({ contentType: 'text/html', body: `<div id="root"></div><script>${outputFiles[0].text}</script>` });
    });
    await context.route('https://eagle.hellomoving.com/**', async route => {
      assert.equal(route.request().method(), 'GET');
      assert.ok((await route.request().allHeaders()).cookie?.includes('GranotCookie='));
      calls.push('granot_get');
      await route.fulfill({ contentType: 'text/html', body: scenario === 'closed' ? '<body onload="window.close()"></body>' : '<p>Job No: P5550001</p>' });
    });
    if (scenario === 'blocked') await page.addInitScript(() => { window.open = () => null; });
    await pilot.prepare();
    assert.deepEqual(calls, []);
    const popupPromise = scenario === 'blocked' ? null : context.waitForEvent('page');
    await pilot.open();
    const popup = popupPromise ? await popupPromise : null;
    if (scenario === 'success') {
      await expect(popup).toHaveURL(jobUrl);
      await expect(popup.getByText('Job No: P5550001')).toBeVisible();
      assert.equal(await popup.evaluate(() => window.opener === null), true);
      assert.equal(await popup.evaluate(() => document.referrer), '');
      await expect(page.getByText('Granot username matched your desk.', { exact: false })).toBeVisible();
      assert.deepEqual(calls, ['verified_lookup', 'granot_get']);
    } else if (scenario === 'wrong_account') {
      await expect(page.getByText('That URL belongs to a different Granot account.', { exact: false })).toBeVisible();
      await expect(page.getByLabel('Your signed-in Granot job URL')).toBeVisible();
      assert.deepEqual(calls, ['verified_lookup']);
      await expect.poll(() => popup.isClosed()).toBe(true);
    } else if (scenario === 'blocked') {
      await expect(page.getByText('Chrome blocked the new tab.', { exact: false })).toBeVisible();
      assert.deepEqual(calls, []);
    } else {
      await expect(page.getByText('The Granot tab closed before the test could be confirmed.', { exact: false })).toBeVisible();
      assert.deepEqual(calls, ['verified_lookup', 'granot_get']);
    }
    assert.equal(page.url(), appUrl);
    await context.close();
    console.log(`PASS ${scenario}: hydrated Granot handoff`);
  }
} finally { await browser.close(); }
