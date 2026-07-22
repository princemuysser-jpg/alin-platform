import fs from 'node:fs';
const sql=fs.readFileSync(new URL('../ORDERS_LIBRARY_WORKFLOW_SYNC_v2_4_2_R4.sql',import.meta.url),'utf8');
const library=fs.readFileSync(new URL('../modules/library/orders.js',import.meta.url),'utf8');
const required=[
  'processing_at','ready_at','status_history','payment_status','cancellation_reason',
  'proof_path','handoff_token','alin_orders_protect_update'
];
for(const token of required){
  if(!sql.includes(token))throw new Error(`Missing workflow token: ${token}`);
}
if(library.includes("cancel_reason:text"))throw new Error('Legacy cancel_reason is still written by library runtime');
if(!library.includes("cancellation_reason:text"))throw new Error('Library runtime must write cancellation_reason');
if(!sql.includes("'status','status_history','updated_at','processing_at'"))throw new Error('Library trigger does not allow status_history/processing_at');
if(!sql.includes("new.payment_status:='paid'"))throw new Error('Completed library orders must be marked paid server-side');
console.log('Order library workflow sync checks passed.');
