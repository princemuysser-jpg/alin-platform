import fs from 'node:fs';
const sql=fs.readFileSync('SECURE_CHECKOUT_PRICING_DELIVERY_v2_6_0_STAGE3.sql','utf8');
const complete=fs.readFileSync('RUN_ON_SUPABASE_v2_1_8_COMPLETE.sql','utf8');
const route=fs.readFileSync('modules/store/order-routing.js','utf8');
const checkout=fs.readFileSync('modules/core/checkout-service.js','utf8');
const checks=[
  ['server delivery setting',sql.includes("public.alin_setting_numeric('delivery_fee',0)")],
  ['server delivery area',sql.includes("from public.delivery_areas d")&&sql.includes("منطقة التوصيل غير معتمدة")],
  ['server library open validation',sql.includes("المكتبة المختارة غير متاحة حالياً")&&sql.includes("from public.accounts a")],
  ['server product price',sql.includes("v_price:=public.alin_jsonb_numeric(v_source,array['sale_price','price'],0)")],
  ['forced payment status',sql.includes("'payment_status','cod_pending'")],
  ['forced assignment status',sql.includes("'assignment_status','pending_admin'")],
  ['direct insert blocked',sql.includes('revoke insert on public.orders from public,anon,authenticated')],
  ['coupon row lock',sql.includes('limit 1 for update')&&sql.includes('انتهى عدد استخدامات الكوبون')],
  ['fixed coupon once',sql.includes('v_fixed_remaining:=v_fixed_remaining-v_discount')],
  ['client intent only',!route.includes("delivery_fee:")&&!route.includes("payment_status:")&&!route.includes("assignment_status:")],
  ['no direct fallback',route.includes('خدمة إنشاء الطلب الآمنة غير جاهزة')&&!route.includes("window.insert('orders'")],
  ['fulfillment allowlist',checkout.includes('function normalizeFulfillment(raw={})')&&checkout.includes("const fulfillment=normalizeFulfillment")],
  ['client strips payment fields',!checkout.includes('payment_status:')&&!checkout.includes('delivery_fee:')],
  ['complete migration includes stage3',complete.includes('SECURE_CHECKOUT')||complete.includes('v2.6.0 — Stage 3')]
];
for(const [name,ok] of checks){if(!ok)throw new Error(`FAILED ${name}`)}
console.log(`Secure checkout Stage 3: ${checks.length}/${checks.length} passed`);
