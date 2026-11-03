import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
export default defineConfig({
 testDir:'./tests/browser', fullyParallel:false, workers:1, retries:0,
 reporter:'list', use:{baseURL:'http://127.0.0.1:3000',headless:true,launchOptions:{executablePath:process.env.PLAYWRIGHT_CHROMIUM_PATH||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']},trace:'retain-on-failure'},
 webServer:{command:'npm start',url:'http://127.0.0.1:3000',reuseExistingServer:!process.env.CI,timeout:60000}
});
