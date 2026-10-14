/** Real local Phase1 browser proof with the environment's existing Chromium, no browser download. */
import {defineConfig} from '@playwright/test';
import base from '../../playwright.config';
export default defineConfig({
  ...base,
  testDir:'.',
  testMatch:/phase1\.integration\.spec\.ts$/,
  globalSetup:'./global-setup.ts',
  outputDir:'../../work/phase1-browser-results',
  projects:[{name:'chromium',use:{...base.use,browserName:'chromium',launchOptions:{executablePath:process.env.E2E_CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox']}}}],
});
