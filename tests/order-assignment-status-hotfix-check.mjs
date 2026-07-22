import fs from 'node:fs';
const sql=fs.readFileSync('RUN_ON_SUPABASE_v2_1_8_COMPLETE.sql','utf8');
const patch=fs.readFileSync('ORDERS_ASSIGNMENT_STATUS_HOTFIX_v2_4_2_R3.sql','utf8');
const route=fs.readFileSync('modules/store/order-routing.js','utf8');
const checks=[
  [sql.includes("'status','new','assignment_status','pending_admin'"),'complete SQL RPC does not set assignment_status'],
  [patch.includes("'status','new','assignment_status','pending_admin'"),'standalone patch RPC does not set assignment_status'],
  [patch.includes("where assignment_status is null"),'standalone patch does not repair old null rows'],
  [route.includes("payment_status:'cod_pending',assignment_status:'pending_admin'"),'pickup route omits assignment_status'],
  [route.includes("assignment_status:payload.assignment_status||'pending_admin'"),'fallback insert omits assignment_status']
];
for(const [ok,msg] of checks){if(!ok)throw new Error(msg)}
console.log(`order-assignment-status-hotfix: ${checks.length}/${checks.length} passed`);
