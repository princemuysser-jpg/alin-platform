import fs from 'node:fs';
import vm from 'node:vm';

const supabaseSource=fs.readFileSync('modules/core/supabase.js','utf8');
const uiSource=fs.readFileSync('modules/core/supabase-ui.js','utf8');
const platformSource=fs.readFileSync('modules/core/platform.js','utf8');
const storageSource=fs.readFileSync('modules/core/storage.js','utf8');
const configSource=fs.readFileSync('modules/core/config.js','utf8');
const failures=[];let checks=0;
const check=(value,label)=>{checks++;if(!value)failures.push(label)};

for(const pattern of [
  /window\.(?:query|insert|update|removeRow)\s*=/,
  /window\.AlinStorage\s*=/,
  /window\.ALIN_CONFIG\s*=/,
  /installMutationBridge|const\s+previous\s*=|oldQuery|oldInsert/
])check(!pattern.test(uiSource),`supabase-ui-no-owner:${pattern}`);
check(Buffer.byteLength(uiSource,'utf8')<4000,'supabase-ui-small-binding');
for(const token of [
  'async function query(','async function insert(','async function update(','async function removeRow(',
  'Object.assign(window,{query,insert,update,removeRow,load:loadCloudSnapshot})',
  'window.AlinRepository=Object.freeze','window.AlinCloud=Object.freeze',
  "const REFRESH_EVENT='alin:data-refreshed'","const MUTATION_EVENT='alin:cloud-mutation'"
])check(supabaseSource.includes(token),`supabase-owner:${token}`);
for(const pattern of [/async function query\(/,/async function insert\(/,/async function update\(/,/async function removeRow\(/])check(!pattern.test(platformSource),`platform-no-data-owner:${pattern}`);
check(storageSource.includes('window.AlinStorage=Object.freeze'),'storage-owns-alin-storage');
check(configSource.includes('window.ALIN_CONFIG=Object.freeze'),'config-owns-alin-config');

const listeners=new Map();
const events=[];
const rows={products:[]};
function builder(result){
  return {
    order(){return this},limit(){return this},eq(){return this},maybeSingle(){return Promise.resolve({data:null,error:null})},
    select(){return this},single(){return Promise.resolve(result)},
    then(resolve,reject){return Promise.resolve(result).then(resolve,reject)}
  };
}
const fakeClient={
  auth:{getUser:async()=>({data:{user:null}})},
  from(table){return{
    select(){return builder({data:rows[table]||[],error:null})},
    insert(row){rows[table]=[...(rows[table]||[]),row];return{select:()=>({single:async()=>({data:row,error:null})})}},
    update(values){return{eq(){return this},select:async()=>({data:[values],error:null})}},
    delete(){return{eq(){return this},then(resolve){return Promise.resolve({error:null}).then(resolve)}}}
  }}
};
const document={documentElement:{dataset:{}},addEventListener(type,handler){listeners.set(type,handler)}};
const local=new Map();
const context={
  console,document,navigator:{onLine:true},performance:{now:()=>10},
  localStorage:{getItem:key=>local.get(key)||null,setItem:(key,value)=>local.set(key,value),removeItem:key=>local.delete(key)},
  setTimeout:()=>1,clearTimeout(){},CustomEvent:class{constructor(type,init){this.type=type;this.detail=init?.detail}},
  window:null,db:{accounts:{all:[],teachers:[],libraries:[],couriers:[],accountants:[]},products:[],settings:{storeType:'booklet'}},
  sb:fakeClient,init:()=>true,ALIN_CONFIG:Object.freeze({authEnabled:false}),renderAll(){context.renderCount=(context.renderCount||0)+1}
};
context.window=context;context.globalThis=context;
context.addEventListener=(type,handler)=>listeners.set(`window:${type}`,handler);
context.dispatchEvent=event=>{events.push(event);listeners.get(`window:${event.type}`)?.(event)};
vm.runInNewContext(supabaseSource,context,{filename:'supabase.js'});
const queryRef=context.query,insertRef=context.insert,updateRef=context.update,removeRef=context.removeRow;
vm.runInNewContext(uiSource,context,{filename:'supabase-ui.js'});
check(context.query===queryRef&&context.insert===insertRef&&context.update===updateRef&&context.removeRow===removeRef,'ui-does-not-replace-mutations');
check(context.ALIN_CONFIG.authEnabled===false,'ui-does-not-replace-config');
check(typeof context.AlinRepository?.refresh==='function','repository-exposed');
check(typeof context.AlinRepositoryUI?.status==='function','repository-ui-exposed');
const loaded=await context.load({render:false,force:true});
check(loaded&&Array.isArray(loaded.products),'cloud-load-returns-db');
check(events.some(event=>event.type==='alin:data-refreshed'),'cloud-load-emits-refresh');
const inserted=await context.insert('products',{id:'P1',name:'قلم'});
check(inserted.id==='P1'&&context.db.products.some(row=>row.id==='P1'),'insert-updates-local-db');
await context.update('products',{name:'قلم أزرق'},{id:'P1'});
check(context.db.products.find(row=>row.id==='P1')?.name==='قلم أزرق','update-updates-local-db');
await context.removeRow('products',{id:'P1'});
check(!context.db.products.some(row=>row.id==='P1'),'delete-updates-local-db');
check(events.filter(event=>event.type==='alin:cloud-mutation').length===3,'single-mutation-event-per-write');

if(failures.length){console.error(JSON.stringify({ok:false,checks,failures},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,checks,supabaseUiBytes:Buffer.byteLength(uiSource,'utf8'),supabaseBytes:Buffer.byteLength(supabaseSource,'utf8')},null,2));
