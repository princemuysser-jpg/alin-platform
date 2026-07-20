import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=fs.readFileSync(new URL('../dist/js/shared.app.bundle.js',import.meta.url),'utf8');
const start=source.indexOf('/* ALIN 2.0.1 - hardened Supabase Auth and admin account adapter. */');
const end=source.indexOf('/* ALIN 2.0.1 — backend readiness diagnostics */',start);
assert.ok(start>=0&&end>start,'auth adapter block not found');
const block=source.slice(start,end);

function makeContext({firstInvalid=false}={}){
  let invokeCount=0,refreshCount=0;
  const calls=[];
  const client={
    auth:{
      async getSession(){return {data:{session:{access_token:'token-1'}}}},
      async refreshSession(){refreshCount++;return {data:{session:{access_token:'token-2'}}}},
      async getUser(token){return {data:{user:{id:'admin-user',token}},error:null}},
      onAuthStateChange(){},async signOut(){}
    },
    functions:{
      async invoke(name,options){
        invokeCount++;calls.push({name,options});
        if(firstInvalid&&invokeCount===1)return {data:{ok:false,error:'جلسة الدخول غير صالحة'},error:null};
        return {data:{ok:true,account:{id:'T1'}},error:null};
      }
    }
  };
  const window={
    ALIN_CONFIG:{authEnabled:true,authEmailDomain:'users.alin.local'},
    sb:client,AlinCloud:{client:()=>client},current:{role:'admin',id:'A1'},
    load:async()=>{},renderAccountsAdmin(){},toast(){},openPage(){},logout(){},
  };
  const document={readyState:'complete',addEventListener(){},getElementById(){return null},querySelector(){return null},querySelectorAll(){return []}};
  const localStorage={getItem(){return null},setItem(){},removeItem(){}};
  const context=vm.createContext({window,document,localStorage,sessionStorage:localStorage,TextEncoder,URL,console,alert(){},setTimeout,clearTimeout,location:{reload(){}}});
  vm.runInContext(block,context,{filename:'auth-adapter.js'});
  return {window,calls,get invokeCount(){return invokeCount},get refreshCount(){return refreshCount}};
}

{
  const t=makeContext();
  await t.window.ALINAuth.updateAccountFromAdmin({account_id:'T1',status:'active'});
  assert.equal(t.calls.length,1);
  assert.equal(t.calls[0].options.headers.Authorization,'Bearer token-1');
}
{
  const t=makeContext({firstInvalid:true});
  await t.window.ALINAuth.resetPasswordFromAdmin('T1','12345678');
  assert.equal(t.calls.length,2);
  assert.equal(t.calls[1].options.headers.Authorization,'Bearer token-2');
  assert.equal(t.refreshCount,1);
}
console.log(JSON.stringify({ok:true,checks:5}));
