import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const platform=read('modules/core/platform.js');
const notifications=read('modules/core/notifications.js');
const adminNotifications=read('modules/admin/notifications.js');
const storeNotifications=read('store/notifications.js');
const banners=read('store/banners.js');
const features=read('modules/core/features.js');
const discovery=read('modules/store/discovery.js');
const teacher=read('modules/teacher/notifications.js');
const library=read('modules/library/dashboard.js');
const courier=read('modules/courier/dashboard.js');
const order=JSON.parse(read('modules/module-order.json'));
const desktop=read('store-desktop.html');
const mobile=read('store-mobile.html');
const failures=[];let checks=0;
const check=(condition,label)=>{checks++;if(!condition)failures.push(label)};

check(Buffer.byteLength(platform,'utf8')<95000,'platform-size-below-95kb');
for(const pattern of [
  /function\s+renderAdsAdmin\s*\(/,
  /function\s+(?:addAd|toggleAd|editAd|deleteAd)\s*\(/,
  /function\s+renderNotificationsAdmin\s*\(/,
  /function\s+(?:sendNotification|deleteNotification)\s*\(/,
  /\bv19Notifications\b/,
  /\balinV71Notify\b/,
  /\balinV78(?:Open|Read|ReadAll|NotificationRows|VisibleNotifications|EnsureButtons)\b/,
  /ALIN V94 SINGLE NOTIFICATION BUTTON/
])check(!pattern.test(platform),`platform legacy ${pattern}`);
check(platform.includes('PLATFORM STEP 11: banner administration lives in store/banners.js.'),'platform banner marker');
check(platform.includes('notifications are owned by modules/core/notifications.js'),'platform notification marker');

for(const token of ['window.AlinNotifications=api','visible,matches,isRead,unreadCount,refresh,send,markRead,markAll,remove','alin:notifications-updated'])check(notifications.includes(token),`notification service ${token}`);
check(!notifications.includes('supabase.co'),'notification service no hardcoded project');
check(!notifications.includes('apikey'),'notification service no embedded key');

check(adminNotifications.includes("AlinAdminModules?.register?.('notifications',render)"),'admin notifications direct registration');
check(!/window\.adminTab\s*=|previous\s*=\s*window\.adminTab|stopImmediatePropagation/.test(adminNotifications),'admin notifications no router wrapper');
check(storeNotifications.includes('window.AlinStoreNotifications=api'),'store notification UI owner');
check(storeNotifications.includes('window.AlinNotifications'),'store notifications use central service');
check(!/fetch\(|supabase\.co|Authorization|apikey|setInterval/.test(storeNotifications),'store notifications no parallel backend client');

check(banners.includes("AlinAdminModules.register('ads',renderAdmin)"),'banner direct registration');
check(banners.includes('window.renderAdsAdmin=renderAdmin'),'banner renderer exposed');
check(!/window\.adminTab\s*=|oldAdmin|apply\(this,arguments\)/.test(banners),'banner no router wrapper');

for(const pattern of [/alin98ToggleFavorite/,/alin98ShowFavorites/,/function\s+renderBanners/,/notificationCount\(/,/decorateNotificationButton/])check(!pattern.test(features),`features duplicate ${pattern}`);
check((discovery.match(/window\.v99ToggleFavorite=/g)||[]).length===1,'favorite toggle owner once');
check((discovery.match(/window\.v99ShowFavorites=/g)||[]).length===1,'favorite page owner once');
check(!discovery.includes('alin98ShowFavorites'),'favorite legacy call removed');

for(const [name,text] of [['teacher',teacher],['library',library],['courier',courier]]){
  check(!text.includes('v19Notifications'),`${name} no v19 source`);
  check(text.includes('AlinNotifications'),`${name} uses central service`);
}

const all=[...order.early,...order.app];
check(all.includes('modules/core/notifications.js'),'module order notification service');
check(all.includes('store/banners.js'),'module order banner owner');
check(!all.includes('modules/admin/marketing.js'),'retired marketing not loaded');
check(all.indexOf('modules/core/notifications.js')<all.indexOf('modules/admin/notifications.js'),'service before admin notifications');
check(all.indexOf('modules/core/notifications.js')<all.indexOf('modules/teacher/notifications.js'),'service before teacher notifications');
for(const [name,html] of [['desktop',desktop],['mobile',mobile]]){
  check((html.match(/\.\/store\/banners\.js\?v=2\.2\.7/g)||[]).length===1,`${name} banner loaded once`);
  check((html.match(/\.\/modules\/core\/notifications\.js\?v=2\.2\.7/g)||[]).length===1,`${name} service loaded once`);
  check(!html.includes('modules/admin/marketing.js'),`${name} retired marketing absent`);
  check(html.includes('AlinStoreNotifications?.open?.()'),`${name} notification control direct`);
}

// Small runtime check for role filtering and per-user local read state.
const storage=new Map();
const context={
  window:{db:{notifications:[
    {id:'all-1',target_role:'all',title:'عام',message:'عام',created_at:'2026-01-03'},
    {id:'teacher-1',target_role:'teacher',title:'مدرس',message:'مدرس',created_at:'2026-01-02'},
    {id:'teacher-2',target_role:'teacher',target_id:'T2',title:'خاص',message:'خاص',created_at:'2026-01-01'}
  ]},current:{role:'teacher',id:'T1'},addEventListener(){},dispatchEvent(){}},
  localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},
  CustomEvent:class{constructor(type,init){this.type=type;this.detail=init?.detail}},
  console,Date,setTimeout,clearTimeout
};
context.globalThis=context;
vm.runInNewContext(notifications,context,{filename:'modules/core/notifications.js'});
const visible=context.window.AlinNotifications.visible({role:'teacher',id:'T1'});
check(visible.map(row=>row.id).join(',')==='all-1,teacher-1','runtime role filtering');
check(context.window.AlinNotifications.unreadCount({role:'teacher',id:'T1'})===2,'runtime unread count');
await context.window.AlinNotifications.markRead('teacher-1',{role:'teacher',id:'T1'});
check(context.window.AlinNotifications.unreadCount({role:'teacher',id:'T1'})===1,'runtime local read state');

if(failures.length){console.error(JSON.stringify({ok:false,checks,failures},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,checks,platformBytes:Buffer.byteLength(platform,'utf8'),notificationServiceBytes:Buffer.byteLength(notifications,'utf8')},null,2));
