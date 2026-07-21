import fs from 'node:fs';
import vm from 'node:vm';

const config=fs.readFileSync('modules/core/config.js','utf8');
const ui=fs.readFileSync('modules/core/ui.js','utf8');
const platform=fs.readFileSync('modules/core/platform.js','utf8');
const listeners=new Map();
const fakeClient={from:table=>({select:()=>Promise.resolve({data:[{table}],error:null}),insert:row=>({select:()=>({single:()=>Promise.resolve({data:row,error:null})})}),update:()=>({eq(){return this},select:()=>Promise.resolve({data:[],error:null})}),delete:()=>({eq(){return this},then:resolve=>resolve({error:null})})})};
const document={
  readyState:'loading',body:{appendChild(){}},documentElement:{},
  getElementById(){return null},querySelector(){return null},querySelectorAll(){return[]},
  createElement(){return{className:'',textContent:'',style:{},remove(){},select(){}}},
  addEventListener(type,handler){listeners.set(type,handler)},execCommand(){return true}
};
const context={console,document,navigator:{onLine:true,clipboard:{writeText:async()=>{}}},localStorage:{getItem(){return null},setItem(){},removeItem(){}},setTimeout:fn=>{fn();return 1},clearTimeout(){},alert(){},CustomEvent:class{constructor(type,init){this.type=type;this.detail=init?.detail}},crypto:{randomUUID:()=> '12345678-1234-1234-1234-123456789012'},window:null};
context.window=context;context.dispatchEvent=()=>{};context.addEventListener=()=>{};context.supabase={createClient:(url,key)=>{context.created={url,key};return fakeClient}};context.globalThis=context;
vm.runInNewContext(config,context,{filename:'config.js'});
vm.runInNewContext(ui,context,{filename:'ui.js'});
vm.runInNewContext(platform,context,{filename:'platform.js'});
const failures=[];const check=(value,label)=>{if(!value)failures.push(label)};
check(context.ALIN_CONFIG.version==='2.3.5','config-version');
check(typeof context.esc==='function'&&context.esc('<')==='&lt;','ui-escape');
check(typeof context.init==='function'&&context.init()===true,'runtime-init');
check(context.created?.url===context.ALIN_CONFIG.supabaseUrl,'runtime-central-url');
check(context.sb===fakeClient,'runtime-client-bridge');
check(Array.isArray(context.db.orders)&&Array.isArray(context.db.accounts.teachers),'runtime-db-shape');
context.current={id:'A1',role:'admin'};check(context.current.id==='A1','runtime-current-bridge');
check(typeof context.deliveryFee==='function'&&context.deliveryFee()===0,'runtime-delivery-fee');
check(!listeners.has('DOMContentLoaded'),'runtime-core-does-not-own-data-boot');
if(failures.length){console.error(JSON.stringify({ok:false,failures},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,checks:9,version:context.ALIN_VERSION},null,2));
