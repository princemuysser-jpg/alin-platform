import fs from 'node:fs';
const sql=fs.readFileSync(new URL('../ALIN_V3_PRODUCTION_MASTER.sql',import.meta.url),'utf8');
const failures=[];const check=(v,l)=>{if(!v)failures.push(l)};
check((sql.match(/^begin;$/gmi)||[]).length===1,'one-transaction-begin');
check((sql.match(/^commit;$/gmi)||[]).length===1,'one-transaction-commit');
const tags=[...sql.matchAll(/\$[A-Za-z0-9_]*\$/g)].map(m=>m[0]);
const counts=new Map();for(const tag of tags)counts.set(tag,(counts.get(tag)||0)+1);
for(const [tag,n] of counts)check(n%2===0,`unbalanced-dollar-quote:${tag}:${n}`);
check(!/grant execute on function public\.alin_login_guard_(?:check|fail)\([^;]+\) to (?:anon|authenticated)/i.test(sql),'guard-not-public');
check(/grant execute on function public\.alin_login_guard_check\(text,text\) to service_role/i.test(sql),'guard-check-service-role');
check(/grant execute on function public\.alin_login_guard_fail\(text,text\) to service_role/i.test(sql),'guard-fail-service-role');
check(sql.includes("if not public.alin_is_super_admin()"),'permission-change-super-admin');
check(sql.includes('deleted_at timestamptz'),'soft-delete-column');
check(sql.includes('student-register'),'student-register-throttle');
const definerBlocks=sql.split(/create or replace function/i).slice(1).filter(x=>/security definer/i.test(x));
for(let i=0;i<definerBlocks.length;i++)check(/set search_path\s*=/i.test(definerBlocks[i].slice(0,900)),`security-definer-search-path:${i+1}`);
check(sql.trimEnd().endsWith('as expired_student_sessions;'),'readiness-select-ending');
if(failures.length){console.error(JSON.stringify({ok:false,failures},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,securityDefinerFunctions:definerBlocks.length,dollarQuotePairs:tags.length/2},null,2));
