import fs from 'node:fs';
const sql=fs.readFileSync('RUN_ON_SUPABASE_v2_1_1_COMPLETE.sql','utf8');
const check=fs.readFileSync('CHECK_SUPABASE_READINESS_v2_1_1.sql','utf8');
const required=[
  "current_user in ('postgres','supabase_admin','service_role')",
  "v_jwt_role = 'service_role'",
  'create or replace function public.alin_repair_auth_links',
  'v_repaired := public.alin_repair_auth_links(null)',
  "new.auth_user_id := old.auth_user_id"
];
for(const token of required){if(!sql.includes(token))throw new Error(`missing auth-link fix token: ${token}`)}
if(!check.includes("ALIN v2.1.1 readiness check passed."))throw new Error('readiness version/result missing');
console.log('auth-link trigger check passed');
