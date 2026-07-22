import fs from 'node:fs';
const hotfix=fs.readFileSync('ORDERS_STOCK_RESERVED_HOTFIX_v2_7_2.sql','utf8');
const stage3=fs.readFileSync('SECURE_CHECKOUT_PRICING_DELIVERY_v2_6_0_STAGE3.sql','utf8');
const complete=fs.readFileSync('RUN_ON_SUPABASE_v2_1_8_COMPLETE.sql','utf8');
const assignment=fs.readFileSync('ORDERS_ASSIGNMENT_STATUS_HOTFIX_v2_4_2_R3.sql','utf8');
const stage4=fs.readFileSync('ANTI_DUPLICATE_STOCK_GUARD_v2_7_0_STAGE4.sql','utf8');
const checks=[
 ['default set',hotfix.includes('alter column stock_reserved set default false')],
 ['null rows repaired',hotfix.includes('where stock_reserved is null')],
 ['not null retained',hotfix.includes('alter column stock_reserved set not null')],
 ['defensive function',hotfix.includes('alin_fill_stock_reserved_default')&&hotfix.includes('new.stock_reserved:=false')],
 ['defensive trigger',hotfix.includes('alin_orders_stock_reserved_default')&&hotfix.includes('before insert or update of stock_reserved')],
 ['stage4 defensive trigger',stage4.includes('alin_orders_stock_reserved_default')&&stage4.includes('alin_fill_stock_reserved_default')],
 ['stage3 payload fixed',stage3.includes("'stock_reserved',false,'stock_restored_at',null")],
 ['complete installer fixed',complete.includes("'stock_reserved',false,'stock_restored_at',null")],
 ['assignment installer fixed',assignment.includes("'stock_reserved',false,'stock_restored_at',null")],
];
for(const [name,ok] of checks){ if(!ok){console.error('FAIL',name);process.exit(1);} }
console.log(`stock-reserved hotfix checks passed ${checks.length}/${checks.length}`);
