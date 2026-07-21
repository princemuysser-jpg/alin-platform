import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const platform=read('modules/core/platform.js');
const shell=read('modules/admin/shell.js');
const dashboard=read('modules/admin/dashboard.js');
const accounts=read('modules/admin/accounts.js');
const order=JSON.parse(read('modules/module-order.json'));
const failures=[];
let checks=0;
const check=(condition,label)=>{checks++;if(!condition)failures.push(label)};

for(const pattern of [
  /function\s+adminTab\s*\(/,
  /(?:window\.)?adminTab\s*=\s*function/,
  /function\s+adminStatsRender\s*\(/,
  /adminStatsRender\s*=\s*function/,
  /function\s+renderAccountsAdmin\s*\(/,
  /renderAccountsAdmin\s*=\s*function/,
  /function\s+(?:editAccount|toggleAccount|deleteAccount)\s*\(/,
  /v21OldRenderAccountsAdmin/,
  /alinAdminTabBeforeV47/,
  /alinV71RenderAdminTools/,
  /alinV71RenderAdminBase/
])check(!pattern.test(platform),`platform legacy: ${pattern}`);
check(platform.includes('PLATFORM STEP 9: admin routing is owned by modules/admin/shell.js.'),'platform routing marker');
check(platform.includes('PLATFORM STEP 9: account administration is owned by modules/admin/accounts.js.'),'platform accounts marker');
check(Buffer.byteLength(platform,'utf8')<235000,'platform size reduced below 235 KB');

for(const token of [
  'window.adminTab=route',
  'window.adminStatsRender=renderStats',
  'window.renderAdmin=()=>route',
  "api.register('audit',renderAudit)",
  "dashboard:'renderAdminDashboard'",
  "accounts:'renderAccountsAdmin'",
  "courierAreas:'renderCourierAreasAdmin'",
  "deliveryOrders:'renderDeliveryOrdersAdmin'",
  "notifications:'renderNotificationsAdmin'"
])check(shell.includes(token),`shell token: ${token}`);
check(!/const\s+(?:base|previous|oldAdminTab)\s*=\s*window\.adminTab/.test(shell),'shell has no router wrapper');
check(dashboard.includes('window.renderAdminDashboard=render'),'dashboard exposes renderer');
check(dashboard.includes("AlinAdminModules.register('dashboard',render)"),'dashboard direct registration');
check(!dashboard.includes('window.adminTab=')&&!dashboard.includes('__v122'),'dashboard has no router wrapper');
check((accounts.match(/AlinAdminModules\.register\('accounts'/g)||[]).length===1,'accounts registered once');
check(accounts.includes('window.renderAccountsAdmin=render'),'accounts exposes renderer');
check(accounts.includes("adminContent.classList.add('admin-accounts-module')"),'accounts owns module class');

const all=[...order.early,...order.app];
check(all.indexOf('modules/admin/shell.js')<all.indexOf('modules/admin/accounts.js'),'shell loads before accounts');
check(all.indexOf('modules/admin/shell.js')<all.indexOf('modules/admin/dashboard.js'),'shell loads before dashboard');

function classList(){const set=new Set();return{add:(...x)=>x.forEach(v=>set.add(v)),remove:(...x)=>x.forEach(v=>set.delete(v)),toggle:(v,on)=>{if(on===undefined)on=!set.has(v);on?set.add(v):set.delete(v);return on},contains:v=>set.has(v),values:()=>[...set]}}
const buttons=['dashboard','accounts'].map(tab=>({dataset:{adminTab:tab},classList:classList(),getAttribute:name=>name==='onclick'?`adminTab('${tab}')`:''}));
const content={innerHTML:'',dataset:{},classList:classList()};
const stats={innerHTML:''};
const page={dataset:{},classList:{contains:()=>true}};
const document={
  readyState:'complete',
  getElementById:id=>({adminContent:content,adminStats:stats,adminPage:page}[id]||null),
  querySelectorAll:selector=>selector.includes('.admin-tabs button')?buttons:selector==='.version-badge'?[]:[],
  addEventListener:()=>{}
};
const events=[];
const windowObj={
  db:{accounts:{all:[{id:'1'}]},orders:[],products:[],financialEntries:[]},
  current:{role:'admin'},
  addEventListener:()=>{},
  dispatchEvent:event=>events.push(event)
};
const context={window:windowObj,document,console,CustomEvent:class{constructor(type,init){this.type=type;this.detail=init?.detail}},Promise,Date,Intl,setTimeout,clearTimeout};
context.globalThis=context;
vm.runInNewContext(shell,context,{filename:'modules/admin/shell.js'});
let rendered=0;
windowObj.AlinAdminModules.register('dashboard',rootNode=>{rendered++;rootNode.innerHTML='dashboard-ok'});
windowObj.adminTab('dashboard');
check(rendered===1,'runtime router calls registered renderer once');
check(windowObj.activeAdminTab==='dashboard','runtime stores active tab');
check(content.innerHTML==='dashboard-ok','runtime writes through renderer');
check(content.dataset.adminModule==='dashboard','runtime marks content module');
check(buttons[0].classList.contains('active-admin-tab')&&!buttons[1].classList.contains('active-admin-tab'),'runtime marks one active tab');
check(stats.innerHTML.includes('طلبات اليوم')&&stats.innerHTML.includes('الحسابات'),'runtime renders admin statistics');
check(events.some(event=>event.type==='alin:admin-tab'&&event.detail.tab==='dashboard'),'runtime emits admin tab event');

if(failures.length){console.error(JSON.stringify({ok:false,checks,failures},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,checks,platformBytes:Buffer.byteLength(platform,'utf8'),shellBytes:Buffer.byteLength(shell,'utf8')},null,2));
