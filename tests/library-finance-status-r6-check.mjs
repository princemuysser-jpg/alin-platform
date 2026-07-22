import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const sql=fs.readFileSync(new URL('../LIBRARY_FINANCE_STATUS_FIX_v2_4_2_R6.sql',import.meta.url),'utf8');
const ordersSource=fs.readFileSync(new URL('../modules/library/orders.js',import.meta.url),'utf8');
const dashboard=fs.readFileSync(new URL('../modules/library/dashboard.js',import.meta.url),'utf8');
const finance=fs.readFileSync(new URL('../core/finance-runtime.js',import.meta.url),'utf8');

for(const token of [
  'alin_library_set_order_status','alin_upsert_order_finance','alin_set_library_open',
  "nullif(v_order->>'pickup_library_id','')","nullif(v_order->>'assigned_library_id','')",
  "settlement_status','settled'",'completed_orders_missing_finance'
]) assert.ok(sql.includes(token),`R6 SQL missing ${token}`);
assert.ok(sql.includes("v_account not in ("),'RPC must verify library ownership');
assert.ok(sql.includes("revoke all on function public.alin_upsert_order_finance(text) from public,anon,authenticated"),'internal finance helper must not be client-executable');
assert.ok(dashboard.includes("client.rpc('alin_set_library_open'"),'library open/close must use secure RPC');
assert.ok(!dashboard.includes("update('accounts',{is_open:open"),'library must not update account status directly');
assert.ok(ordersSource.includes("c.rpc('alin_library_set_order_status'"),'library workflow must use atomic RPC');
assert.ok(!ordersSource.includes("ensureOrderFinancials(order)"),'library workflow must not split order and finance mutations');
assert.ok(finance.includes("order?.pickup_library_id||order?.assigned_library_id"),'finance fallback must resolve all library id aliases');

const calls=[];
const order={id:'O1',order_number:'AL-1',status:'ready',pickup_library_id:'L1',kind:'booklet',total:10000};
const window={
  current:{role:'library',id:'L1'},
  db:{orders:[order],accounts:{libraries:[]}},
  AlinLibraryModules:{},
  sb:{async rpc(name,args){
    calls.push([name,structuredClone(args)]);
    return {data:{ok:true,order:{...order,status:'completed',payment_status:'paid'},finance:{library_id:'L1',gross:10000,library:3000,debt:7000}},error:null};
  }},
  async audit(){},
  async load(){calls.push(['load']);},
  dispatchEvent(){},
};
const document={getElementById(){return null}};
const context=vm.createContext({window,document,console,structuredClone,Date,String,Array,Object,Boolean,Error,Promise,RegExp});
vm.runInContext(ordersSource,context,{filename:'modules/library/orders.js'});
await window.libraryOrderStatus('O1','completed');
assert.equal(calls[0][0],'alin_library_set_order_status');
assert.deepEqual(calls[0][1],{p_order_id:'O1',p_status:'completed',p_reason:null});
assert.equal(order.status,'completed');
assert.equal(calls.filter(x=>x[0]==='alin_library_set_order_status').length,1,'completion must call one atomic RPC');

console.log(JSON.stringify({ok:true,checks:16,rpcCalls:calls.length}));
