import fs from 'node:fs';
const sql=fs.readFileSync('ORDER_INTERNAL_FINALIZE_HOTFIX_v2_7_3.sql','utf8');
const stage4=fs.readFileSync('ANTI_DUPLICATE_STOCK_GUARD_v2_7_0_STAGE4.sql','utf8');
const workflow=fs.readFileSync('ORDERS_LIBRARY_WORKFLOW_SYNC_v2_4_2_R4.sql','utf8');
const checks=[
  ['transaction-local marker set',/set_config\('alin\.internal_order_update','stage4_checkout_finalize',true\)/.test(sql)],
  ['marker cleared',/set_config\('alin\.internal_order_update','',true\)/.test(sql)],
  ['trigger checks exact marker',/current_setting\('alin\.internal_order_update',true\)='stage4_checkout_finalize'/.test(sql)],
  ['allowed checkout request key',sql.includes("'checkout_request_key'")],
  ['allowed checkout group id',sql.includes("'checkout_group_id'")],
  ['allowed stock reserved',sql.includes("'stock_reserved'")],
  ['allowed stock restored timestamp',sql.includes("'stock_restored_at'")],
  ['internal change remains field-limited',sql.includes("to_jsonb(new)-v_allowed")],
  ['stage4 source patched',stage4.includes("stage4_checkout_finalize")],
  ['workflow source patched',workflow.includes("stage4_checkout_finalize")],
  ['ordinary unauthorized updates still blocked',workflow.includes("raise exception 'غير مسموح بتعديل الطلب'")],
];
for(const [name,ok] of checks){if(!ok) throw new Error(`FAIL: ${name}`);}
console.log(`Order internal finalize hotfix checks passed (${checks.length}/${checks.length}).`);
