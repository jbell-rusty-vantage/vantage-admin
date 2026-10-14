/** Disposable Phase1 browser server: loopback auth/API only, no .env files or provider credentials. */
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
for(const file of ['.env','.env.local','.env.development','.env.development.local'])
  if(existsSync(file))throw new Error(`Refusing local proof startup while ${file} exists; use an isolated checkout.`);
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!/RINGCENTRAL|^RC_|BLOB|GATEWAY|OPENAI|ANTHROPIC|VERCEL|REDIS|UPSTASH|QSTASH|GOOGLE|MONGO|DOTENV|^ADMIN_|^VANTAGE_|OUTREACH_DESK_MOCK|TWILIO|SENDGRID|POSTMAN|GRANOT/i.test(key)));
Object.assign(env,{
  MONGODB_URI:'mongodb://127.0.0.1:27189/?directConnection=true',
  ADMIN_AUTH_DB_NAME:'testvantage_admin_phase1_e2e',
  ADMIN_ACCESS_TOKEN_SECRET:'access-secret-for-local-e2e-access-secret-0001',
  ADMIN_REFRESH_TOKEN_SECRET:'refresh-secret-for-local-e2e-refresh-secret-01',
  VANTAGE_API_BASE_URL:'http://127.0.0.1:3107',
  VANTAGE_API_SECRET:'local-e2e-api-secret',
  VANTAGE_ADMIN_PROXY_SIGNING_SECRET:'local-e2e-proxy-signing-secret-32ch',
  NEXT_TELEMETRY_DISABLED:'1',
});
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','-H','127.0.0.1','-p','3100'],{env,stdio:'inherit'});
child.on('exit',code=>process.exit(code??1));
