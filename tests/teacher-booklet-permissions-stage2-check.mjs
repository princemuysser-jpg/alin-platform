import fs from 'node:fs';
const sql=fs.readFileSync('TEACHER_BOOKLET_PERMISSIONS_v2_5_0_STAGE2.sql','utf8');
const js=fs.readFileSync('modules/teacher/booklets.js','utf8');
const checks=[
 ['trigger',sql.includes('alin_guard_teacher_booklet_changes')],
 ['rpc',sql.includes('alin_teacher_approve_booklet')],
 ['price protected',sql.includes("'price'")],
 ['status protected',sql.includes("'status'")],
 ['share protected',sql.includes("'teacher_share_percent'")],
 ['anon revoked',sql.includes('revoke all on function public.alin_teacher_approve_booklet(text) from public, anon')],
 ['frontend rpc',js.includes("rpc('alin_teacher_approve_booklet'")],
 ['frontend no direct publish approval',!js.includes("publish_status:'approved',status:booklet.status")]
];
for(const [n,ok] of checks){if(!ok)throw new Error('FAILED '+n)}
console.log(`Teacher booklet permissions: ${checks.length}/${checks.length} passed`);
