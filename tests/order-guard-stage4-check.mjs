import fs from 'node:fs';
const sql=fs.readFileSync('ANTI_DUPLICATE_STOCK_GUARD_v2_7_0_STAGE4.sql','utf8');
const complete=fs.readFileSync('RUN_ON_SUPABASE_v2_1_8_COMPLETE.sql','utf8');
const checkout=fs.readFileSync('modules/core/checkout-service.js','utf8');
const backend=fs.readFileSync('modules/core/backend-check.js','utf8');
const checks=[
  ['guarded rpc',sql.includes('alin_create_store_orders_guarded')],
  ['core rpc revoked',sql.includes('revoke all on function public.alin_create_store_orders(jsonb,jsonb,jsonb,text)')],
  ['request key unique',sql.includes('request_key text not null unique')],
  ['same payload dedupe',sql.includes("r.created_at>now()-interval '2 minutes'")],
  ['phone short rate',sql.includes("v_count>=4")&&sql.includes("interval '5 minutes'")],
  ['phone daily rate',sql.includes('v_count>=20')],
  ['device rate',sql.includes('v_count>=8')&&sql.includes('v_count>=50')],
  ['stock reservation columns',sql.includes('stock_reserved boolean not null default false')&&sql.includes('stock_restored_at timestamptz')],
  ['stock cancel trigger',sql.includes('alin_orders_stock_cancel_guard')&&sql.includes('set stock=coalesce(p.stock,0)+v_qty')],
  ['cancel reactivation blocked',sql.includes('لا يمكن إعادة تفعيل طلب ملغي بعد إرجاع المخزون')],
  ['client guarded rpc',checkout.includes("c.rpc('alin_create_store_orders_guarded'")],
  ['client request key',checkout.includes('p_request_key:attempt.requestKey')&&checkout.includes('checkoutAttempt(fingerprint)')],
  ['client device id',checkout.includes('p_device_id:deviceId()')&&checkout.includes("alin_device_id_v1")],
  ['backend guarded probe',backend.includes("c.rpc('alin_create_store_orders_guarded'" )],
  ['complete migration includes stage4',complete.includes('ALIN v2.7.0 — Stage 4')]
];
for(const [name,ok] of checks){if(!ok)throw new Error(`FAILED ${name}`)}
console.log(`Order guard Stage 4: ${checks.length}/${checks.length} passed`);
