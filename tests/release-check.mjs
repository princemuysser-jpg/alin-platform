import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const failures=[];
const required=[
  'index.html','store-desktop.html','store-mobile.html','service-worker.js','VERSION',
  'RUN_ON_SUPABASE_v2_0_4_COMPLETE.sql','CHECK_SUPABASE_READINESS_v2_0_4.sql',
  'dist/js/shared.early.bundle.js','dist/js/shared.app.bundle.js',
  'store/banners.js','store/notifications.js'
];
for(const rel of required){if(!fs.existsSync(path.join(root,rel)))failures.push(`missing:${rel}`)}

const textFiles=[];
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  const full=path.join(dir,entry.name);
  if(entry.isDirectory())walk(full);
  else if(/\.(?:html|js|css|json|webmanifest|sql|txt|md)$/i.test(entry.name))textFiles.push(full);
}}
walk(root);
const combined=textFiles.map(f=>fs.readFileSync(f,'utf8')).join('\n');
for(const stale of ['RUN_ON_SUPABASE_v2_0_1_COMPLETE.sql','CHECK_SUPABASE_READINESS_v2_0_1.sql','RUN_ON_SUPABASE_v2_0_3_COMPLETE.sql','CHECK_SUPABASE_READINESS_v2_0_3.sql','public.alin_raise']){
  if(combined.includes(stale))failures.push(`stale:${stale}`);
}

const run=fs.readFileSync(path.join(root,'RUN_ON_SUPABASE_v2_0_4_COMPLETE.sql'),'utf8');
const check=fs.readFileSync(path.join(root,'CHECK_SUPABASE_READINESS_v2_0_4.sql'),'utf8');
if((run.match(/\bbegin\s*;/gi)||[]).length!==(run.match(/\bcommit\s*;/gi)||[]).length)failures.push('sql:transaction-count');
for(const name of ['alin_current_account_id','alin_current_role','alin_is_admin','alin_create_store_orders','alin_validate_coupon','alin_track_order','alin_notification_visible','alin_order_visible','alin_protect_order_update']){
  if(!run.includes(name))failures.push(`sql:function:${name}`);
  if(!check.includes(name))failures.push(`check:function:${name}`);
}
for(const name of ['alin-files','banners_public_read','alin_files_public_read']){
  if(!run.includes(name)||!check.includes(name))failures.push(`sql:readiness:${name}`);
}
if(!check.includes('ALIN v2.0.4 readiness check passed.'))failures.push('check:success-message');


if(!run.includes('alin_v204_notifications_user_read'))failures.push('security:notifications-rls');
if(!run.includes('alin_v204_orders_read')||!run.includes('alin_track_order'))failures.push('security:orders-tracking');
if(!run.includes("'ledger','financial_entries','financial_payouts'")||!run.includes('public.alin_row_owner_match'))failures.push('security:finance-rls');
if(!run.includes('alin_public_accounts')||!run.includes('alin_public_settings'))failures.push('security:public-views');
const appBundle=fs.readFileSync(path.join(root,'dist/js/shared.app.bundle.js'),'utf8');
if(!appBundle.includes("c.rpc('alin_track_order'"))failures.push('app:secure-tracking-rpc');
for(const htmlName of ['store-desktop.html','store-mobile.html']){
  const html=fs.readFileSync(path.join(root,htmlName),'utf8');
  if(!html.includes('version-badge">v2.0.4'))failures.push(`version-badge:${htmlName}`);
}

for(const htmlName of ['index.html','store-desktop.html','store-mobile.html']){
  const html=fs.readFileSync(path.join(root,htmlName),'utf8');
  for(const match of html.matchAll(/(?:src|href)=["'](\.\/?[^"'#?]+)(?:\?[^"']*)?["']/g)){
    const rel=match[1].replace(/^\.\//,'');
    if(!fs.existsSync(path.join(root,rel)))failures.push(`asset:${htmlName}:${rel}`);
  }
}

if(failures.length){console.error(JSON.stringify({ok:false,failures},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,version:fs.readFileSync(path.join(root,'VERSION'),'utf8').trim(),checks:textFiles.length},null,2));
