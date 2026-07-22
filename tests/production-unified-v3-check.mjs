import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const failures=[];let checks=0;const check=(value,label)=>{checks++;if(!value)failures.push(label)};
const sql=read('ALIN_V3_PRODUCTION_MASTER.sql');
for(const token of [
  'public.audit_events','public.alin_audit_write','public.alin_audit_row_change',
  'public.auth_login_guard','public.alin_login_guard_check','public.alin_login_guard_fail','public.alin_login_guard_success',
  'public.account_permissions','public.alin_admin_set_account_permissions','public.alin_is_super_admin','public.alin_has_permission','public.alin_enforce_admin_permission',
  'public.student_accounts','public.student_sessions','public.alin_student_register','public.alin_student_login','public.alin_student_orders',
  'public.alin_teacher_orders','public.notification_reads','deleted_at timestamptz'
])check(sql.includes(token),`sql:${token}`);
check(sql.includes("revoke all on public.audit_events from anon, authenticated"),'audit:no-direct-write');
check(sql.includes("grant execute on function public.alin_login_guard_check(text,text) to service_role"),'login-guard:service-only-check');
check(sql.includes("grant execute on function public.alin_login_guard_fail(text,text) to service_role"),'login-guard:service-only-fail');
check(sql.includes("if not public.alin_is_super_admin()"),'permissions:super-admin-only');
check(sql.includes("create trigger alin_admin_permission_guard"),'permissions:write-trigger');
check(sql.includes("security_invoker=true"),'privacy:security-invoker-view');
check(sql.includes("student_phone','customer_phone'"),'privacy:teacher-sensitive-columns');
check(sql.includes("student-register"),'student:register-rate-limit');
check(sql.includes("public.alin_normalize_phone(coalesce(to_jsonb(o)->>'student_phone',''))"),'student:normalized-order-match');

const platform=read('modules/core/platform.js');
check(platform.includes("client.rpc('alin_audit_write'"),'client:audit-rpc');
check(!platform.includes("window.insert('audit'"),'client:no-direct-audit');
const auth=read('modules/core/auth-service.js');
check(auth.includes("functions.invoke('secure-login'"),'auth:edge-secure-login');
check(auth.includes('auth.setSession'),'auth:server-session-apply');
check(!auth.includes('auth.signInWithPassword'),'auth:no-browser-password-call');
check(auth.includes('admin_level'),'auth:admin-level-session');
const secureLogin=read('supabase/functions/secure-login/index.ts');
for(const token of ['signInWithPassword','alin_login_guard_check','alin_login_guard_fail','alin_login_guard_success','x-forwarded-for'])check(secureLogin.includes(token),`secure-login:${token}`);
check(secureLogin.includes('@supabase/supabase-js@2.110.7'),'secure-login:pin');
const student=read('modules/store/student-auth.js');
for(const token of ['alin_student_register','alin_student_login','alin_student_profile','alin_student_update','alin_student_logout','alin_student_orders'])check(student.includes(token),`student:${token}`);
check(!student.includes('password_hash'),'student:no-browser-hash');
check(!student.includes('ALIN_STUDENT_ACCOUNTS_V2'),'student:no-local-accounts');
check(student.includes('sessionStorage'),'student:session-storage');

const cloud=read('modules/core/supabase.js');
check(cloud.includes("c.from('alin_teacher_orders')"),'privacy:teacher-orders-view');
check(cloud.includes('SESSION_SNAPSHOT_KEY'),'privacy:session-snapshot');
check(cloud.includes('publicSnapshot(snapshot)'),'privacy:public-snapshot');
check(cloud.includes("audit_events:'audit'"),'audit:db-map');
check(cloud.includes("filter(row=>!row?.deleted_at)"),'accounts:hide-archived');

const backup=read('modules/admin/backup.js');
check(backup.includes('catalog-settings-v2-no-personal-data'),'backup:safe-schema');
check(!/counts:\{orders:/.test(backup),'backup:no-orders');
check(!backup.includes('student_phone'),'backup:no-student-phone');
const adminAccounts=read('modules/admin/accounts-advanced.js');
check(adminAccounts.includes('أرشفة الحساب'),'accounts:archive-ui');
check(adminAccounts.includes("admin_level==='super_admin'"),'accounts:permission-editor-super-only');
const deleteEdge=read('supabase/functions/admin-delete-account/index.ts');
check(deleteEdge.includes("status: 'inactive'"),'accounts:soft-disable');
check(deleteEdge.includes('deleted_at: now'),'accounts:archive-timestamp');
check(!deleteEdge.includes("from('accounts').delete()"),'accounts:no-hard-delete');

for(const rel of ['dist/alin-core.v3.js','dist/alin-app-desktop.v3.js','dist/alin-app-mobile.v3.js']){
  check(fs.existsSync(path.join(root,rel)),`bundle:missing:${rel}`);
  try{new Function(read(rel))}catch(error){failures.push(`bundle:syntax:${rel}:${error.message}`)}
}
for(const htmlName of ['store-desktop.html','store-mobile.html']){
  const html=read(htmlName);
  check(html.includes('Content-Security-Policy'),`${htmlName}:csp`);
  check(html.includes('@supabase/supabase-js@2.110.7'),`${htmlName}:supabase-pin`);
  check(html.includes("worker-src 'self' blob: https://cdn.jsdelivr.net"),`${htmlName}:pdf-worker-csp`);
  check(html.includes('./dist/alin-core.v3.js?v=3.0.0'),`${htmlName}:core-bundle`);
  check(html.includes(`./dist/${htmlName.includes('mobile')?'alin-app-mobile':'alin-app-desktop'}.v3.js?v=3.0.0`),`${htmlName}:app-bundle`);
  const localScripts=[...html.matchAll(/<script[^>]+src="(\.\/[^\"]+)"/g)].map(m=>m[1]);
  check(localScripts.length<=2,`${htmlName}:too-many-local-scripts:${localScripts.length}`);
}
const sw=read('service-worker.js');
check(sw.includes('alin-v3.0.0-production-unified'),'pwa:version');
for(const rel of ['./dist/alin-core.v3.js','./dist/alin-app-desktop.v3.js','./dist/alin-app-mobile.v3.js'])check(sw.includes(rel),`pwa:${rel}`);

const cors=read('supabase/functions/_shared/cors.ts');
check(!cors.includes("'Access-Control-Allow-Origin': '*'"),'edge:cors-wildcard');
check(cors.includes('ALIN_ALLOWED_ORIGINS'),'edge:cors-config');
const edge=[...fs.readdirSync(path.join(root,'supabase/functions'),{withFileTypes:true})].filter(x=>x.isDirectory()&&!x.name.startsWith('_')).map(x=>`supabase/functions/${x.name}/index.ts`);
for(const rel of edge){const src=read(rel);check(src.includes('publicError'),`edge:public-error:${rel}`);check(src.includes('corsHeaders(req)'),`edge:cors-request:${rel}`)}
const shared=read('supabase/functions/_shared/admin.ts');
check(shared.includes('assertStrongPassword'),'password:shared-validator');
check(shared.includes('password.length < 12'),'password:min-12');
check(shared.includes("permission = ''"),'admin:permission-aware-edge');
check(shared.includes('deleted_at'),'admin:archived-rejected');
check(shared.includes('@supabase/supabase-js@2.110.7'),'edge:supabase-pin');

if(failures.length){console.error(JSON.stringify({ok:false,checks,failures},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,version:'3.0.0',checks,bundles:3,edgeFunctions:edge.length},null,2));
