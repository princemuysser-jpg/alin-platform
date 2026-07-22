import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const storage=read('modules/core/storage.js');
const sql=read('STAGE1_PRIVATE_DOCUMENTS_v2_4_2.sql');
const teacher=read('modules/teacher/booklets.js');
const publishing=read('modules/teacher/publishing.js');
const admin=read('modules/admin/booklets.js');
const library=read('modules/library/printing.js');
const libraryDashboard=read('modules/library/dashboard.js');
const failures=[];let checks=0;
const check=(condition,label)=>{checks++;if(!condition)failures.push(label)};

check(storage.includes("const PRIVATE_ROOTS=new Set(['booklets','teacher-requests'])"),'private roots exact');
check(!storage.includes("'teachers']);")&&!storage.includes("['booklets','teacher-requests','teachers']"),'teacher avatars stay public');
check(storage.includes('.storage.from(PRIVATE_BUCKET).download(ref.path)'),'private documents use authenticated download');
check(!storage.includes('createSignedUrl'),'no shareable signed URLs');
check(storage.includes("if(ref.bucket===PRIVATE_BUCKET||isDocumentPath(ref.path))return ''"),'public URL blocked for document paths');
check(storage.includes('booklets/${entityId}/${randomId}.pdf'),'booklet path binds entity id');
check(storage.includes('teacher-requests/${ownerId}/${entityId}/${randomId}.docx'),'teacher request path binds owner and request');
check(storage.includes('fileHeader(file,16)')&&storage.includes('0x25,0x50,0x44,0x46,0x2d'),'PDF magic bytes validated');
check(storage.includes('0x50,0x4b,0x03,0x04'),'DOCX ZIP signature validated');
check(storage.includes("throw new Error('التخزين العام مخصص للصور فقط')"),'public bucket rejects documents');

check(teacher.includes("type:'docx'")&&teacher.includes('ownerId:current.id')&&teacher.includes('entityId:requestId'),'new teacher request owner binding');
check(publishing.includes("type:'docx'")&&publishing.includes('ownerId:cur().id')&&publishing.includes('entityId:id'),'teacher resubmission owner binding');
check(admin.includes("entityId:bookletId")&&admin.includes("type:'pdf'"),'admin booklet id binding');
check(!library.includes("mediaUrl(path)"),'library has no public document fallback');
check(teacher.includes("await secureFileUrl(b.file_path,300,'booklets')"),'teacher booklet uses private resolver');
check(!teacher.includes('resolved?.url||mediaUrl(r.source_file_path)'),'teacher DOCX has no public fallback');

check(sql.includes("'alin-private','alin-private',false"),'private bucket is non-public');
check(sql.includes("allowed_mime_types=array[\n      'image/jpeg','image/png','image/webp'"),'public bucket image-only MIME list');
check(sql.includes("(storage.foldername(name))[1]='teachers'")&&!sql.includes("in ('teacher-requests','teachers')"),'teacher public upload limited to avatar folder');
check(sql.includes('alin_library_has_booklet_order'),'library order access function present');
check(sql.includes("v_parts[2]=v_account")&&sql.includes('r.teacher_id::text=v_account'),'teacher owner checks present');
check(sql.includes("policy alin_private_select_exact")&&sql.includes('public.alin_private_can_select(name)'),'exact select policy present');
check(sql.includes("policy alin_private_insert_exact")&&sql.includes('public.alin_private_can_insert(name)'),'exact insert policy present');
check(!sql.includes('alin_private_library_read')&&!sql.includes('alin_private_teacher_read'),'broad prior policies removed');
check(sql.includes("in ('new','pending','pending_admin','assigned','accepted','processing','printing','ready'"),'only active print workflow can access booklet');
check(libraryDashboard.includes("!['completed','cancelled'].includes(s)"),'library hides print after completion or cancellation');
check(sql.includes("roles::text like '%anon%'")&&sql.includes('no_anon_policy_ok'),'anonymous access readiness check');

// Runtime guard: even a legacy public PDF reference must not produce a public URL.
let publicUrlCalls=0;
const context={
  window:{
    init(){},
    sb:{
      auth:{getSession:async()=>({data:{session:{user:{id:'u1'}}},error:null})},
      storage:{from:()=>({getPublicUrl:()=>{publicUrlCalls++;return {data:{publicUrl:'PUBLIC'}}}})}
    },
    addEventListener(){},setTimeout(){return 1}
  },
  URL,crypto,File,Blob,fetch,console,setTimeout,clearTimeout
};
context.globalThis=context;
vm.runInNewContext(storage,context,{filename:'modules/core/storage.js'});
check(context.window.mediaUrl('alin-files/booklets/legacy.pdf')==='','legacy public PDF URL is blocked');
check(publicUrlCalls===0,'legacy PDF never calls getPublicUrl');
check(context.window.mediaUrl('covers/x.jpg')==='PUBLIC','public image still resolves');
check(publicUrlCalls===1,'public image calls getPublicUrl once');

if(failures.length){console.error(JSON.stringify({ok:false,checks,failures},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,checks,version:'2.4.2-stage1-r2'},null,2));
