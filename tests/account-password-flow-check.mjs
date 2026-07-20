import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=fs.readFileSync(new URL('../modules/core/cloud-status-ui.js',import.meta.url),'utf8');
const marker=source.indexOf('hardened Supabase Auth and admin account adapter.');
const start=source.lastIndexOf('/*',marker);
const diag=source.indexOf('backend readiness diagnostics',start);
const end=source.lastIndexOf('/*',diag);
assert.ok(start>=0&&end>start,'auth adapter block not found');
const block=source.slice(start,end);

const calls=[];
const session={access_token:'admin-token',user:{id:'ADMIN-AUTH'}};
const client={
  auth:{
    async getSession(){return {data:{session},error:null}},
    async refreshSession(){return {data:{session},error:null}},
    async getUser(){return {data:{user:session.user},error:null}},
    onAuthStateChange(){},async signOut(){}
  },
  async rpc(name,args){calls.push({kind:'rpc',name,args});return {data:1,error:null}},
  functions:{async invoke(name,options){calls.push({kind:'function',name,options});return {data:{ok:true,account:{id:'L1'}},error:null}}}
};
const accountQuery={select(){return this},eq(){return this},async maybeSingle(){return {data:{id:'A1',role:'admin',status:'active'},error:null}}};
client.from=()=>Object.create(accountQuery);
const storage={getItem(){return null},setItem(){},removeItem(){}};
const window={ALIN_CONFIG:{authEnabled:true,authEmailDomain:'users.alin.local'},sb:client,AlinCloud:{client:()=>client},current:{role:'admin',id:'A1'},load:async()=>{},openPage(){},logout(){},dispatchEvent(){}};
const document={readyState:'complete',documentElement:{removeAttribute(){}},getElementById(){return null},querySelector(){return null},querySelectorAll(){return []},addEventListener(){},body:{appendChild(){}}};
const context=vm.createContext({window,document,localStorage:storage,sessionStorage:storage,TextEncoder,URL,console,alert(){},setTimeout,clearTimeout,CustomEvent:class{constructor(type,init){this.type=type;this.detail=init?.detail}},location:{reload(){}}});
vm.runInContext(block,context,{filename:'password-flow.js'});

await window.ALINAuth.resetPasswordFromAdmin('L1','12345678');
assert.deepEqual(calls.map(x=>[x.kind,x.name]),[['rpc','alin_repair_auth_links'],['function','admin-reset-password']]);
assert.equal(calls[0].args.p_account_id,'L1');
assert.equal(calls[1].options.headers.Authorization,'Bearer admin-token');

calls.length=0;
await window.ALINAuth.updateAccountFromAdmin({account_id:'L1',password:'abcdefgh',status:'active'});
assert.deepEqual(calls.map(x=>[x.kind,x.name]),[['rpc','alin_repair_auth_links'],['function','admin-update-account']]);

console.log(JSON.stringify({ok:true,checks:6}));
