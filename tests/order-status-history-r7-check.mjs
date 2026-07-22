import fs from 'node:fs';
const sql=fs.readFileSync(new URL('../ORDERS_STATUS_HISTORY_GUARD_v2_4_2_R7.sql',import.meta.url),'utf8');
const complete=fs.readFileSync(new URL('../RUN_ON_SUPABASE_v2_1_8_COMPLETE.sql',import.meta.url),'utf8');
const r3=fs.readFileSync(new URL('../ORDERS_ASSIGNMENT_STATUS_HOTFIX_v2_4_2_R3.sql',import.meta.url),'utf8');
for(const token of [
  "status_history jsonb",
  "alter column status_history set default '[]'::jsonb",
  'alin_orders_apply_insert_defaults',
  'before insert on public.orders',
  "new.status_history is null",
  "jsonb_array_length(new.status_history)=0",
  "null_status_history_rows"
]) if(!sql.includes(token)) throw new Error(`Missing R7 status-history guard token: ${token}`);
for(const body of [complete,r3]){
  if(!body.includes("'status_history',jsonb_build_array(jsonb_build_object('status','new','at',now(),'by','store'))")){
    throw new Error('Order RPC payload does not explicitly set status_history');
  }
}
console.log('Order status_history R7 checks passed.');
