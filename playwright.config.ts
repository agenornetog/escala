import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
import { testAuthEnv } from './tests/auth-fixture';
export default defineConfig({
 testDir:'./tests/browser', timeout:60000, expect:{timeout:15000}, fullyParallel:false, workers:1, retries:0,
 reporter:'list', use:{baseURL:'http://127.0.0.1:3105',headless:true,launchOptions:{executablePath:process.env.PLAYWRIGHT_CHROMIUM_PATH||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']},trace:'retain-on-failure'},
 webServer:[{command:'npm start',url:'http://127.0.0.1:3105',reuseExistingServer:false,timeout:60000,env:{...testAuthEnv,PORT:'3105'}},{command:'npm start',url:'http://127.0.0.1:3106/login',reuseExistingServer:false,timeout:60000,env:{ESCALA_REQUIRE_LOGIN:'true',ESCALA_ADMIN_EMAIL:'',ESCALA_ADMIN_PASSWORD:'',ESCALA_ADMIN_PASSWORD_HASH:'',ESCALA_SESSION_SECRET:'',PORT:'3106'}},{command:'npm start',url:'http://127.0.0.1:3107/login',reuseExistingServer:false,timeout:60000,env:{ESCALA_REQUIRE_LOGIN:'false',ESCALA_ADMIN_EMAIL:'',ESCALA_ADMIN_PASSWORD:'',ESCALA_ADMIN_PASSWORD_HASH:'',ESCALA_SESSION_SECRET:'',PORT:'3107'}},{command:'npm start',url:'http://127.0.0.1:3108/login',reuseExistingServer:false,timeout:60000,env:{...testAuthEnv,PORT:'3108',SUPABASE_URL:'https://employee-fixture.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test-only-service-role',ESCALA_WORKSPACE_ID:'browser-fixture',NODE_OPTIONS:`${process.env.NODE_OPTIONS??''} --import ./tests/fixtures/employee-db-preload.mjs`}}]
});
