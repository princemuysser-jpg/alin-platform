import fs from 'node:fs';
const stage4=fs.readFileSync('ANTI_DUPLICATE_STOCK_GUARD_v2_7_0_STAGE4.sql','utf8');
const complete=fs.readFileSync('RUN_ON_SUPABASE_v2_1_8_COMPLETE.sql','utf8');
const hotfix=fs.readFileSync('PGCRYPTO_DIGEST_HOTFIX_v2_7_1.sql','utf8');
const checks=[
  ['stage4 creates extensions schema',stage4.includes('create schema if not exists extensions;')],
  ['stage4 installs pgcrypto in extensions',stage4.includes('create extension if not exists pgcrypto with schema extensions;')],
  ['stage4 guarded search path',/alin_create_store_orders_guarded[\s\S]*?set search_path=public,extensions,pg_temp/.test(stage4)],
  ['complete guarded search path',/alin_create_store_orders_guarded[\s\S]*?set search_path=public,extensions,pg_temp/.test(complete)],
  ['hotfix alters guarded rpc',hotfix.includes('alter function public.alin_create_store_orders_guarded(jsonb,jsonb,jsonb,text,text,text)')],
  ['hotfix verifies digest',hotfix.includes("digest(text,text)")&&hotfix.includes('guarded_rpc_path_fixed')]
];
for(const [name,ok] of checks){if(!ok)throw new Error(`FAILED ${name}`)}
console.log(`pgcrypto digest hotfix: ${checks.length}/${checks.length} passed`);
