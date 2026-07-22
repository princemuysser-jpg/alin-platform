import fs from 'node:fs';
const sql=fs.readFileSync('RUN_ON_SUPABASE_v2_1_8_COMPLETE.sql','utf8');
const patch=fs.readFileSync('ORDERS_ASSIGNMENT_STATUS_HOTFIX_v2_4_2_R3.sql','utf8');
const stage3=fs.readFileSync('SECURE_CHECKOUT_PRICING_DELIVERY_v2_6_0_STAGE3.sql','utf8');
const route=fs.readFileSync('modules/store/order-routing.js','utf8');
const checks=[
  [sql.includes("'status','new','assignment_status','pending_admin'"),'complete SQL RPC does not set assignment_status'],
  [patch.includes("'status','new','assignment_status','pending_admin'"),'standalone patch RPC does not set assignment_status'],
  [patch.includes('where assignment_status is null'),'standalone patch does not repair old null rows'],
  [stage3.includes("'assignment_status','pending_admin'"),'stage3 server does not force assignment_status'],
  [!route.includes('assignment_status:'),'client must not control assignment_status'],
  [!route.includes('payment_status:'),'client must not control payment_status']
];
for(const [ok,msg] of checks){if(!ok)throw new Error(msg)}
console.log(`order-assignment-status-hotfix: ${checks.length}/${checks.length} passed`);
