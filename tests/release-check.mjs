import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const failures=[];
const required=[
  'index.html','store-desktop.html','store-mobile.html','service-worker.js','VERSION','styles/alin-splash.css','core/splash.js','assets/images/alin-splash-desktop.webp','assets/images/alin-splash-mobile.webp',
  'RUN_ON_SUPABASE_v2_1_8_COMPLETE.sql','CHECK_SUPABASE_READINESS_v2_1_8.sql','LIBRARY_FINANCE_STATUS_FIX_v2_4_2_R6.sql',
  'modules/module-order.json','modules/courier/core.js','modules/courier/admin.js','modules/courier/areas.js','modules/courier/assignment.js','modules/courier/dashboard.js','modules/core/config.js','modules/core/i18n-en.js','modules/core/i18n-ku.js','modules/core/i18n.js','modules/core/ui.js','modules/core/platform.js','modules/core/storage.js','modules/core/navigation.js','modules/core/notifications.js','modules/core/cloud-status.js','modules/core/auth-service.js','modules/core/account-admin-service.js','modules/core/checkout-service.js','modules/core/backend-check.js','modules/core/cloud-status-ui.js','modules/store/tracking.js','modules/store/discovery-core.js','modules/store/discovery-catalog.js','modules/store/discovery-details.js','modules/store/discovery-growth.js','modules/store/student-auth.js','modules/admin/orders.js',
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

const run=fs.readFileSync(path.join(root,'RUN_ON_SUPABASE_v2_1_8_COMPLETE.sql'),'utf8');
const check=fs.readFileSync(path.join(root,'CHECK_SUPABASE_READINESS_v2_1_8.sql'),'utf8');
if((run.match(/\bbegin\s*;/gi)||[]).length!==(run.match(/\bcommit\s*;/gi)||[]).length)failures.push('sql:transaction-count');
for(const name of ['alin_current_account_id','alin_current_role','alin_is_admin','alin_create_store_orders','alin_validate_coupon','alin_track_order','alin_repair_auth_links','alin_notification_visible','alin_order_visible','alin_protect_order_update','alin_set_library_open','alin_library_set_order_status','alin_upsert_order_finance']){
  if(!run.includes(name))failures.push(`sql:function:${name}`);
  if(!check.includes(name))failures.push(`check:function:${name}`);
}
for(const name of ['alin-files','banners_public_read','alin_files_public_read']){
  if(!run.includes(name)||!check.includes(name))failures.push(`sql:readiness:${name}`);
}
if(!check.includes('ALIN v2.1.8 readiness check passed.'))failures.push('check:success-message');


if(!run.includes('alin_v204_notifications_user_read'))failures.push('security:notifications-rls');
if(!run.includes('alin_v204_orders_read')||!run.includes('alin_track_order'))failures.push('security:orders-tracking');
if(!run.includes("'ledger','financial_entries','financial_payouts'")||!run.includes('public.alin_row_owner_match'))failures.push('security:finance-rls');
if(!run.includes('alin_public_accounts')||!run.includes('alin_public_settings'))failures.push('security:public-views');
const moduleOrder=JSON.parse(fs.readFileSync(path.join(root,'modules/module-order.json'),'utf8'));
const moduleFiles=[...moduleOrder.early,...moduleOrder.app];
const appBundle=moduleFiles.map(rel=>fs.readFileSync(path.join(root,rel),'utf8')).join('\n');
if(moduleOrder.early.length!==23||moduleOrder.app.length!==43)failures.push('modules:unexpected-count');
for(const rel of moduleFiles){if(!fs.existsSync(path.join(root,rel)))failures.push(`modules:missing:${rel}`)}
if(!appBundle.includes("c.rpc('alin_track_order'"))failures.push('app:secure-tracking-rpc');
if(!appBundle.includes('alin-copy-tracking')||!appBundle.includes('navigator.clipboard?.writeText')||!appBundle.includes('document.execCommand(\'copy\')'))failures.push('checkout:tracking-copy');
if(!appBundle.includes('function normalizeCheckoutItems(lines)')||!appBundle.includes("gifts:'product'")||!appBundle.includes('const items=normalizeCheckoutItems(cart)'))failures.push('checkout:cart-kind-normalization');
if(!run.includes("when 'gifts' then 'gift'")||!run.includes("when 'stationary' then 'stationery'")||run.includes("v_kind not in ('booklet','product','stationery','gift')"))failures.push('checkout:server-kind-normalization');

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

const accountsModule=fs.readFileSync(path.join(root,'modules/admin/accounts.js'),'utf8');
const accountsAdvanced=fs.readFileSync(path.join(root,'modules/admin/accounts-advanced.js'),'utf8');
const accountAdminService=fs.readFileSync(path.join(root,'modules/core/account-admin-service.js'),'utf8');
const createAccountFn=fs.readFileSync(path.join(root,'supabase/functions/admin-create-account/index.ts'),'utf8');
if(!accountsModule.includes('v163CourierAreaPicker')||!accountsModule.includes('v131SyncAccountRole')||!accountsModule.includes('مناطق عمل المندوب'))failures.push('courier-areas:add-form');
if(!accountsAdvanced.includes('v132CourierAreaPicker')||!accountsAdvanced.includes("areas:role==='courier'?selectedAreas:undefined"))failures.push('courier-areas:edit-form');
if(!accountAdminService.includes("area:role==='courier'?(selectedAreas[0]||'')")||!accountAdminService.includes('areas:selectedAreas'))failures.push('courier-areas:create-payload');
if(!createAccountFn.includes('requestedAreas')||!createAccountFn.includes('areas,')||!updateFn.includes('requestedAreas'))failures.push('courier-areas:edge-functions');
if(!run.includes('add column areas text[]')||!run.includes("v_jwt_role='service_role'"))failures.push('courier-areas:database');

for(const column of ['assignment_status','assigned_at','accepted_at','picked_up_at','out_for_delivery_at','completed_at','delivered_at','rejected_at','cancelled_at','delivery_note']){
  if(!run.includes(`add column if not exists ${column}`))failures.push(`courier-workflow:column:${column}`);
  if(!check.includes(`'${column}'`))failures.push(`courier-workflow:readiness:${column}`);
}
for(const status of ["'assigned'","'accepted'","'picked_up'","'out_for_delivery'","'rejected'"]){
  if(!run.includes(status))failures.push(`courier-workflow:status:${status}`);
}
if(!run.includes('drop constraint if exists orders_status_valid')||!run.includes('add constraint orders_status_valid'))failures.push('courier-workflow:status-constraint');
const migrationTriggerDrop=run.indexOf('drop trigger if exists alin_orders_protect_update on public.orders;',run.indexOf('-- v2.1.8: ترقية آمنة لجدول الطلبات.'));
const migrationOrderUpdate=run.indexOf('update public.orders',migrationTriggerDrop);
const migrationTriggerRestore=run.indexOf('create trigger alin_orders_protect_update before update on public.orders',migrationOrderUpdate);
if(migrationTriggerDrop<0||migrationOrderUpdate<migrationTriggerDrop||migrationTriggerRestore<migrationOrderUpdate)failures.push('courier-workflow:migration-trigger-order');
if(!check.includes('trigger:public.orders.alin_orders_protect_update'))failures.push('courier-workflow:readiness-trigger');
if(!run.includes("'status','assignment_status','updated_at','accepted_at','picked_up_at'"))failures.push('courier-workflow:courier-update-fields');

for(const htmlName of ['store-desktop.html','store-mobile.html']){
  const html=fs.readFileSync(path.join(root,htmlName),'utf8');
  if(!html.includes('version-badge">v2.4.2'))failures.push(`version-badge:${htmlName}`);
}
for(const obsolete of ['dist/js/shared.early.bundle.js','dist/js/shared.app.bundle.js','options.css']){if(fs.existsSync(path.join(root,obsolete)))failures.push(`obsolete:${obsolete}`)}
for(const htmlName of ['store-desktop.html','store-mobile.html']){
  const html=fs.readFileSync(path.join(root,htmlName),'utf8');
  const positions=moduleFiles.map(rel=>html.indexOf(`./${rel}?v=2.4.2`));
  if(positions.some(pos=>pos<0))failures.push(`modules:not-loaded:${htmlName}`);
  if(positions.some((pos,index)=>index>0&&pos<positions[index-1]))failures.push(`modules:wrong-order:${htmlName}`);
}


const serviceWorker=fs.readFileSync(path.join(root,'service-worker.js'),'utf8');
if(!serviceWorker.includes("'./modules/core/navigation.js'"))failures.push('pwa:navigation-not-cached');
if(!serviceWorker.includes("'./styles/alin-splash.css'")||!serviceWorker.includes("'./core/splash.js'")||!serviceWorker.includes("'./assets/images/alin-splash-desktop.webp'")||!serviceWorker.includes("'./assets/images/alin-splash-mobile.webp'"))failures.push('pwa:splash-not-cached');
if(!fs.readFileSync(path.join(root,'index.html'),'utf8').includes('id="alinSplash"'))failures.push('entry:splash-markup');
for(const rel of ['./modules/core/cloud-status.js','./modules/core/auth-service.js','./modules/core/account-admin-service.js','./modules/core/checkout-service.js','./modules/core/backend-check.js','./modules/store/tracking.js','./modules/core/cloud-status-ui.js']){if(!serviceWorker.includes(`'${rel}'`))failures.push(`pwa:cloud-service-not-cached:${rel}`);}
for(const rel of ['./modules/store/discovery-core.js','./modules/store/discovery-catalog.js','./modules/store/discovery-details.js','./modules/store/discovery-growth.js']){if(!serviceWorker.includes(`'${rel}'`))failures.push(`pwa:discovery-not-cached:${rel}`);}
for(const rel of ['./modules/courier/core.js','./modules/courier/admin.js','./modules/courier/areas.js','./modules/courier/assignment.js','./modules/courier/dashboard.js']){if(!serviceWorker.includes(`'${rel}'`))failures.push(`pwa:courier-not-cached:${rel}`);}
if(!serviceWorker.includes("'./modules/core/i18n-en.js'")||!serviceWorker.includes("'./modules/core/i18n-ku.js'")||!serviceWorker.includes("'./modules/core/i18n.js'")||!serviceWorker.includes("'./styles/alin-i18n.css'"))failures.push('pwa:i18n-not-cached');

const r6Sql=fs.readFileSync(path.join(root,'LIBRARY_FINANCE_STATUS_FIX_v2_4_2_R6.sql'),'utf8');
const libraryOrdersR6=fs.readFileSync(path.join(root,'modules/library/orders.js'),'utf8');
const libraryDashboardR6=fs.readFileSync(path.join(root,'modules/library/dashboard.js'),'utf8');
for(const token of ['alin_library_set_order_status','alin_upsert_order_finance','alin_set_library_open','completed_orders_missing_finance']){
  if(!r6Sql.includes(token))failures.push(`r6:${token}`);
}
if(!libraryOrdersR6.includes("c.rpc('alin_library_set_order_status'"))failures.push('r6:library-order-rpc');
if(!libraryDashboardR6.includes("client.rpc('alin_set_library_open'"))failures.push('r6:library-status-rpc');

const financeRuntime=fs.readFileSync(path.join(root,'core/finance-runtime.js'),'utf8');
for(const token of ['canonicalLedger','librarySummary','teacherSummary',"settlement_status:'pending'","settlement_status:'settled'"]){
  if(!financeRuntime.includes(token))failures.push(`finance:${token}`);
}
for(const htmlName of ['store-desktop.html','store-mobile.html']){
  const html=fs.readFileSync(path.join(root,htmlName),'utf8');
  if(!html.includes('core/finance-runtime.js?v=2.4.2'))failures.push(`finance-script:${htmlName}`);
}

const cartModule=fs.readFileSync(path.join(root,'modules/store/cart.js'),'utf8');
const couponModule=fs.readFileSync(path.join(root,'modules/store/coupons.js'),'utf8');
for(const token of ['cartSubtotalValue','cartDiscountRow','cartDiscountValue','cartFinalValue','renderCartPricing','cartPricing']){
  if(!cartModule.includes(token))failures.push(`coupon-cart:${token}`);
}
for(const token of ['calculateCartDiscount','getApplied','ALIN_ACTIVE_COUPON','alin:coupon-changed']){
  if(!couponModule.includes(token))failures.push(`coupon-service:${token}`);
}

const adminOrdersModule=fs.readFileSync(path.join(root,'modules/admin/orders.js'),'utf8');
const platformModule=fs.readFileSync(path.join(root,'modules/core/platform.js'),'utf8');
for(const token of ['window.renderOrdersAdmin=render','window.adminOrderStatus=changeStatus','window.adminOrderAssign=assign','status_history','assignment_status','assigned_at','deductStockOnce','matchingCouriers','adminOrdersExport']){
  if(!adminOrdersModule.includes(token))failures.push(`admin-orders:${token}`);
}
if(/(?:oldTab|baseAdminTab|wrapped=function|window\.adminTab\s*=)/.test(adminOrdersModule))failures.push('admin-orders:tab-wrapper');
for(const pattern of [/function\s+renderOrdersAdmin\s*\(/,/(?:window\.)?renderOrdersAdmin\s*=\s*(?:renderOrdersAdmin\s*=\s*)?function/,/function\s+orderStatus\s*\(/,/(?:window\.)?orderStatus\s*=\s*(?:orderStatus\s*=\s*)?(?:async\s+)?function/,/alinV71RenderOrdersAdminBase/]){
  if(pattern.test(platformModule))failures.push(`platform:legacy-orders:${pattern}`);
}
if(Buffer.byteLength(platformModule,'utf8')>=370000)failures.push('platform:orders-extraction-size');

for(const htmlName of ['index.html','store-desktop.html','store-mobile.html']){
  const html=fs.readFileSync(path.join(root,htmlName),'utf8');
  for(const match of html.matchAll(/(?:src|href)=["'](\.\/?[^"'#?]+)(?:\?[^"']*)?["']/g)){
    const rel=match[1].replace(/^\.\//,'');
    if(!fs.existsSync(path.join(root,rel)))failures.push(`asset:${htmlName}:${rel}`);
  }
}

if(failures.length){console.error(JSON.stringify({ok:false,failures},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,version:fs.readFileSync(path.join(root,'VERSION'),'utf8').trim(),checks:textFiles.length},null,2));
