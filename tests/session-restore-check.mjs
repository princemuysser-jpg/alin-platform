import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=fs.readFileSync(new URL('../modules/core/cloud-status-ui.js',import.meta.url),'utf8');
const start=source.indexOf('/* ALIN 2.0.1 - hardened Supabase Auth and admin account adapter. */');
const end=source.indexOf('/* ALIN 2.0.1 — backend readiness diagnostics */',start);
assert.ok(start>=0&&end>start,'auth adapter block not found');
const block=source.slice(start,end);

const classes=()=>{const set=new Set(['hidden']);return {add(...x){x.forEach(v=>set.add(v))},remove(...x){x.forEach(v=>set.delete(v))},contains(x){return set.has(x)}}};
const elements={
  app:{classList:classes()},login:{classList:classes()},libraryPage:{classList:classes()}
};
elements.login.classList.remove('hidden');
let bootRemoved=0,opened='',loaded=0,libraryShown=0,restoredEvent=0;
const account={id:'LIB1',role:'library',name:'مكتبة الاختبار',username:'lib1',status:'active'};
const session={access_token:'token',user:{id:'AUTH1'}};
const accountQuery={select(){return this},eq(){return this},async maybeSingle(){return {data:account,error:null}}};
const client={
  auth:{async getSession(){return {data:{session},error:null}},async refreshSession(){return {data:{session},error:null}},async getUser(){return {data:{user:session.user},error:null}},async signOut(){},onAuthStateChange(){}},
  from(){return Object.create(accountQuery)},functions:{async invoke(){return {data:{ok:true},error:null}}}
};
const storage={getItem(){return null},setItem(){},removeItem(){}};
const window={
  ALIN_CONFIG:{authEnabled:true,authEmailDomain:'users.alin.local'},sb:client,AlinCloud:{client:()=>client,loadCachedSnapshot(){}},
  current:null,pendingRole:'',load:async()=>{loaded++},openPage:page=>{opened=page},logout(){},
  AlinLibraryModules:{showLibraryPage(){libraryShown++}},dispatchEvent(){restoredEvent++}
};
const document={
  readyState:'complete',documentElement:{removeAttribute(name){if(name==='data-alin-auth-boot')bootRemoved++}},
  getElementById(id){return elements[id]||null},querySelector(){return null},querySelectorAll(){return []},addEventListener(){},body:{appendChild(){}}
};
const context=vm.createContext({window,document,localStorage:storage,sessionStorage:storage,TextEncoder,URL,console,alert(){},setTimeout,clearTimeout,CustomEvent:class{constructor(type,init){this.type=type;this.detail=init?.detail}},location:{reload(){}}});
vm.runInContext(block,context,{filename:'auth-session-restore.js'});
const ok=await window.ALINAuth.restoreSession();
assert.equal(ok,true);
assert.equal(window.current.role,'library');
assert.equal(window.current.id,'LIB1');
assert.equal(opened,'library');
assert.ok(loaded>=1);
assert.ok(libraryShown>=2);
assert.ok(bootRemoved>=1);
assert.ok(restoredEvent>=1);
console.log(JSON.stringify({ok:true,checks:8}));
