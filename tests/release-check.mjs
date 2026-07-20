import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const failures=[];
const required=[
  'index.html','store-desktop.html','store-mobile.html','service-worker.js','VERSION',
  'RUN_ON_SUPABASE_v2_0_12_COMPLETE.sql','CHECK_SUPABASE_READINESS_v2_0_12.sql',
  'modules/module-order.json','modules/core/config.js','modules/core/platform.js','modules/admin/orders.js',
  'store/banners.js','store/notifications.js','core/finance-runtime.js'
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

const run=fs.readFileSync(path.join(root,'RUN_ON_SUPABASE_v2_0_12_COMPLETE.sql'),'utf8');
const check=fs.readFileSync(path.join(root,'CHECK_SUPABASE_READINESS_v2_0_12.sql'),'utf8');
if((run.match(/\bbegin\s*;/gi)||[]).length!==(run.match(/\bcommit\s*;/gi)||[]).length)failures.push('sql:transaction-count');
for(const name of ['alin_current_account_id','alin_current_role','alin_is_admin','alin_create_store_orders','alin_validate_coupon','alin_track_order','alin_repair_auth_links','alin_notification_visible','alin_order_visible','alin_protect_order_update']){
  if(!run.includes(name))failures.push(`sql:function:${name}`);
  if(!check.includes(name))failures.push(`check:function:${name}`);
}
for(const name of ['alin-files','banners_public_read','alin_files_public_read']){
  if(!run.includes(name)||!check.includes(name))failures.push(`sql:readiness:${name}`);
}
if(!check.includes('ALIN v2.0.12 readiness check passed.'))failures.push('check:success-message');


if(!run.includes('alin_v204_notifications_user_read'))failures.push('security:notifications-rls');
if(!run.includes('alin_v204_orders_read')||!run.includes('alin_track_order'))failures.push('security:orders-tracking');
if(!run.includes("'ledger','financial_entries','financial_payouts'")||!run.includes('public.alin_row_owner_match'))failures.push('security:finance-rls');
if(!run.includes('alin_public_accounts')||!run.includes('alin_public_settings'))failures.push('security:public-views');
const moduleOrder=JSON.parse(fs.readFileSync(path.join(root,'modules/module-order.json'),'utf8'));
const moduleFiles=[...moduleOrder.early,...moduleOrder.app];
const appBundle=moduleFiles.map(rel=>fs.readFileSync(path.join(root,rel),'utf8')).join('\n');
if(moduleOrder.early.length!==9||moduleOrder.app.length!==32)failures.push('modules:unexpected-count');
for(const rel of moduleFiles){if(!fs.existsSync(path.join(root,rel)))failures.push(`modules:missing:${rel}`)}
if(!appBundle.includes("c.rpc('alin_track_order'"))failures.push('app:secure-tracking-rpc');
if(!appBundle.includes('alin-copy-tracking')||!appBundle.includes('navigator.clipboard?.writeText')||!appBundle.includes('document.execCommand(\'copy\')'))failures.push('checkout:tracking-copy');

if(!appBundle.includes('headers:{Authorization:`Bearer ${session.access_token}`}'))failures.push('accounts:explicit-session-token');
if(!appBundle.includes('async function adminSession(forceRefresh=false)'))failures.push('accounts:session-refresh');
if(!appBundle.includes("c.rpc('alin_repair_auth_links'")||!appBundle.includes('await repairAuthLink(accountId)'))failures.push('accounts:auth-link-repair-rpc');
if(!appBundle.includes("const canonical=arr(window.db?.accounts?.all)"))failures.push('accounts:canonical-list');
const updateFn=fs.readFileSync(path.join(root,'supabase/functions/admin-update-account/index.ts'),'utf8');
const resetFn=fs.readFileSync(path.join(root,'supabase/functions/admin-reset-password/index.ts'),'utf8');
if(updateFn.includes('الحساب غير مربوط بخدمة الدخول. اكتب كلمة مرور جديدة لإكمال الربط'))failures.push('accounts:legacy-status-blocked');
if(!resetFn.includes('ensureAuthUserForAccount')||resetFn.includes('admin.auth.admin.createUser'))failures.push('accounts:legacy-password-relink');
const sharedAdmin=fs.readFileSync(path.join(root,'supabase/functions/_shared/admin.ts'),'utf8');
if(!sharedAdmin.includes('findAuthUserByEmail')||!sharedAdmin.includes('listUsers({ page, perPage })'))failures.push('accounts:orphan-auth-lookup');

for(const htmlName of ['store-desktop.html','store-mobile.html']){
  const html=fs.readFileSync(path.join(root,htmlName),'utf8');
  if(!html.includes('version-badge">v2.0.12'))failures.push(`version-badge:${htmlName}`);
}
for(const obsolete of ['dist/js/shared.early.bundle.js','dist/js/shared.app.bundle.js','options.css']){if(fs.existsSync(path.join(root,obsolete)))failures.push(`obsolete:${obsolete}`)}
for(const htmlName of ['store-desktop.html','store-mobile.html']){
  const html=fs.readFileSync(path.join(root,htmlName),'utf8');
  const positions=moduleFiles.map(rel=>html.indexOf(`./${rel}?v=2.0.12`));
  if(positions.some(pos=>pos<0))failures.push(`modules:not-loaded:${htmlName}`);
  if(positions.some((pos,index)=>index>0&&pos<positions[index-1]))failures.push(`modules:wrong-order:${htmlName}`);
}

const financeRuntime=fs.readFileSync(path.join(root,'core/finance-runtime.js'),'utf8');
for(const token of ['canonicalLedger','librarySummary','teacherSummary',"settlement_status:'pending'","settlement_status:'settled'"]){
  if(!financeRuntime.includes(token))failures.push(`finance:${token}`);
}
for(const htmlName of ['store-desktop.html','store-mobile.html']){
  const html=fs.readFileSync(path.join(root,htmlName),'utf8');
  if(!html.includes('core/finance-runtime.js?v=2.0.12'))failures.push(`finance-script:${htmlName}`);
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
