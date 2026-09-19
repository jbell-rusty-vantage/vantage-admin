/** Run from vantage-admin: node scripts/csi07-local.mjs. No existing .env is read. */
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir,writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
const admin=process.cwd(),server=path.resolve(admin,'../vantage-main-server');
if(!admin.endsWith('vantage-admin')) throw new Error('Run from vantage-admin');
const local=path.join(tmpdir(),'vantage-csi07-local');await mkdir(local,{recursive:true});
const key=()=>randomBytes(32).toString('hex');
// Allowlist OS runtime inputs. No inherited provider configuration or production credentials.
const env={};for(const name of ['PATH','Path','SystemRoot','SYSTEMROOT','WINDIR','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA','COMSPEC','PATHEXT']) if(process.env[name]) env[name]=process.env[name];
Object.assign(env,{__NEXT_PROCESSED_ENV:'true',NODE_ENV:'development',TEST_MODE:'true',TEST_MONGO_DATABASE_NAME:'testvantagemovers_csi07preview',MONGO_URI:'mongodb://127.0.0.1:27189/?replicaSet=csi01',
 MONGODB_URI:'mongodb://127.0.0.1:27189/?replicaSet=csi01',ADMIN_AUTH_DB_NAME:'vantage_admin_csi07_preview',ADMIN_ACCESS_TOKEN_SECRET:key(),ADMIN_REFRESH_TOKEN_SECRET:key(),
 VANTAGE_API_BASE_URL:'http://127.0.0.1:3107',VANTAGE_API_SECRET:key(),VANTAGE_ADMIN_PROXY_SIGNING_SECRET:key(),SALES_INTELLIGENCE_DEPLOYMENT_ID:'csi07-local-preview',
 SALES_INTELLIGENCE_ENABLED:'true',SALES_INTELLIGENCE_OUTREACH_ENSURE:'true',SHEET_SYNC_MODE:'disabled',OBSERVABILITY_ENABLED:'false',OBSERVABILITY_WRITE_MODE:'disabled',EMAIL_NOTIFICATIONS_ENABLED:'false',EMAIL_NOTIFICATIONS_MODE:'disabled',NEXT_TELEMETRY_DISABLED:'1'});
for(const name of ['CAPTURE_CALL_LOG','CAPTURE_WEBHOOK','DIRECTORY_SYNC','MEDIA_ENABLED','ATTACHMENT_REFRESH','STT_ENABLED','EXTRACTION_ENABLED','NUDGE_ENABLED']) env[`SALES_INTELLIGENCE_${name}`]='false';
env.SALES_INTELLIGENCE_ATTACHMENT_REFRESH='true'; // CSI-08 Owner attachment commands, isolated preview only; no capture/provider worker.
const password=key();
await mongoose.connect(env.MONGODB_URI,{dbName:env.ADMIN_AUTH_DB_NAME});
if((await mongoose.connection.db.admin().command({hello:1})).setName!=='csi01') throw new Error('Expected local replica');
for(const role of ['owner','admin']) await mongoose.connection.db.collection('admin_users').updateOne({email:`${role}@csi07.example.test`},{$set:{password_hash:await bcrypt.hash(password,10),role,active:true,token_version:0,updated_at:new Date(),password_changed_at:new Date()}},{upsert:true});
await mongoose.disconnect();
// Private local material is outside the repository, never written into evidence.
await writeFile(path.join(local,'session.json'),JSON.stringify({password,env}),{mode:0o600});
const output=await import('node:fs');
const apiLog=output.openSync(path.join(local,'api.log'),'a');
const children=[spawn(process.execPath,['--import','tsx','scripts/csi07-local.ts'],{cwd:server,env,stdio:['ignore',apiLog,apiLog],windowsHide:true}),
 spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port','3108'],{cwd:admin,env,stdio:'inherit',windowsHide:true})];
console.log('Local preview: http://127.0.0.1:3108/sales-intelligence');
console.log('Disposable login details and API log are in the OS temp directory / vantage-csi07-local. No production configuration loaded.');
const stop=()=>children.forEach(child=>child.kill());process.once('SIGINT',stop);process.once('SIGTERM',stop);
for(const child of children) child.once('exit',code=>{if(code)console.error('Preview process exited',code);stop();});

