// Alin module: teacher/booklets.js | v2.0.3
/* ===== teacher/js/booklets.js ===== */
/* V111: actual teacher code moved from core/js/platform-legacy.js */
window.AlinTeacherModules=window.AlinTeacherModules||{};
function bestTeacherBook(books,orders){
  let counts={}; orders.forEach(o=>counts[o.item_id]=(counts[o.item_id]||0)+(+o.qty||0));
  const best=books.slice().sort((a,b)=>(counts[b.id]||0)-(counts[a.id]||0))[0];
  return best?`${esc(best.title)} (${counts[best.id]||0} نسخة)`:'-';
}

async function sendTeacherBookRequest(){
  try{
    const f=new FormData(teacherRequestForm);
    if(!String(f.get('title')||'').trim()) throw Error('اكتب اسم الملزمة');
    const sourceFile=f.get('source');
    if(!sourceFile || !sourceFile.name) throw Error('اختر ملف Word بصيغة DOCX');
    const ext=(sourceFile.name.split('.').pop()||'').toLowerCase();
    if(ext!=='docx') throw Error('صيغة الملف يجب أن تكون DOCX حتى يمكن عرضها داخل المنصة بدون تنزيل');
    const validMime=['application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/octet-stream',''];
    if(sourceFile.type && !validMime.includes(sourceFile.type)) throw Error('اختر ملف Word DOCX صحيح');
    const path=await uploadFile('teacher-requests',sourceFile,{type:'any',required:true});
    await insert('teacher_requests',{
      id:uid('TR'),teacher_id:current.id,teacher_name:current.name,
      title:String(f.get('title')).trim(),subject:String(f.get('subject')||''),grade:String(f.get('grade')||''),
      note:String(f.get('note')||''),source_file_path:path||'',source_file_name:sourceFile.name||'',
      source_file_type:'docx',source_mime_type:sourceFile.type||'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      status:'new'
    });
    await audit('teacher_request','رفع ملف Word لطلب ملزمة من '+current.name);
    await load(); activeTeacherTab='requests'; renderTeacher(); toast('تم إرسال ملف Word للإدارة للمراجعة');
  }catch(e){
    console.warn('teacher request error', e);
    if(isMissingTableError(e,'teacher_requests')){
      alert('تعذر إرسال طلب الملزمة حالياً. نفّذ تحديث قاعدة البيانات ثم حاول مرة أخرى.');
      return;
    }
    alert(e.message||'تعذر إرسال الطلب حالياً.');
  }
}

async function openTeacherPdf(bookletId){
  const b=db.booklets.find(x=>x.id===bookletId); if(!b?.file_path)return alert('لا يوجد ملف PDF لهذه الملزمة');
  const cleanUrl=mediaUrl(b.file_path);
  checkoutBox.innerHTML=`<h2>مشاهدة الملزمة</h2><div class="pdf-viewer"><div class="pdf-loading">جاري فتح الملزمة...</div></div><div class="row-actions no-print"><button class="secondary" onclick="closeCheckout()">إغلاق</button></div>`;
  checkoutModal.classList.remove('hidden');
  const ok=await checkPublicFile(cleanUrl);
  if(!ok){
    checkoutBox.innerHTML=`<h2>مشاهدة الملزمة</h2><div class="empty-state"><b>تعذر فتح ملف الملزمة</b><p>الملف القديم غير مرتبط بالتخزين الحالي. احذف الملزمة من لوحة المدير وارفع ملف PDF من جديد.</p></div><div class="row-actions no-print"><button class="secondary" onclick="closeCheckout()">إغلاق</button></div>`;
    return;
  }
  const url=cleanUrl+'#toolbar=0&navpanes=0&scrollbar=1';
  checkoutBox.innerHTML=`<h2>مشاهدة الملزمة</h2><div class="pdf-guard"><div class="watermark">${esc(current?.name||'منصة آلين')} — مشاهدة فقط</div><iframe src="${url}" oncontextmenu="return false"></iframe></div><div class="row-actions no-print"><button class="secondary" onclick="closeCheckout()">إغلاق</button></div>`;
}

function teacherPhoneForBooklet(b){ return b.teacher_phone || teacherObj(b.teacher_id).phone || ''; }

function teacherImageForBooklet(b){ return b.teacher_image_path || teacherObj(b.teacher_id).avatar_path || b.cover_path || ''; }

function alinBookletTeacher(b){ return teacherName(b.teacher_id); }

function alinV72TeacherName(item){
  return (db.accounts?.teachers||[]).find(t=>t.id===item.teacher_id)?.name||'';
}

function renderTeacherRequestsAdmin(){
  const list=db.teacherRequests||[];
  adminContent.innerHTML=`<h2>طلبات المدرسين للملازم</h2>${list.map(r=>`<div class="row"><div><b>${esc(r.title)}</b><small>${esc(r.teacher_name||teacherName(r.teacher_id))} — ${esc(r.subject||'')} — ${esc(r.grade||'')} — ${esc(r.status||'')}</small><p>${esc(r.note||'')}</p></div><div class="row-actions">${r.source_file_path?`<button onclick="openTeacherRequestSource('${r.id}')">عرض الملف الأولي</button>`:''}<button onclick="teacherRequestStatus('${r.id}','designing')">قيد التصميم</button><button onclick="teacherRequestStatus('${r.id}','ready')">جاهزة</button><button class="danger" onclick="teacherRequestStatus('${r.id}','rejected')">رفض</button></div></div>`).join('')||emptyState('لا توجد طلبات')}`;
}

async function teacherRequestStatus(id,status){ await update('teacher_requests',{status},{id}); await audit('teacher_request','تحديث طلب مدرس '+id+' إلى '+status); await load(); renderTeacherRequestsAdmin(); }

async function openTeacherRequestSource(id){
  const r=(db.teacherRequests||[]).find(x=>String(x.id)===String(id));
  if(!r?.source_file_path)return alert('لا يوجد ملف مرفوع لهذا الطلب');
  const fileName=String(r.source_file_name||r.source_file_path||'').toLowerCase();
  if(!fileName.endsWith('.docx') && String(r.source_file_type||'').toLowerCase()!=='docx'){
    return alert('هذا ملف قديم غير قابل للمعاينة الداخلية. اطلب من المدرس إعادة رفعه بصيغة DOCX.');
  }
  checkoutBox.innerHTML=`<section class="teacher-word-viewer"><div class="teacher-word-head"><div><h2>معاينة ملف Word</h2><p>${esc(r.title||'ملزمة')} — مشاهدة داخلية فقط</p></div><span>DOCX</span></div><div class="teacher-word-security">لا يوجد زر تنزيل داخل المعاينة. استخدم ملاحظات الإدارة لطلب أي تعديل من المدرس.</div><div id="teacherWordPreview" class="teacher-word-pages"><div class="teacher-word-loading">جاري تجهيز المعاينة...</div></div><div class="row-actions no-print"><button class="secondary" onclick="closeCheckout()">إغلاق</button></div></section>`;
  checkoutModal.classList.remove('hidden');
  try{
    if(typeof window.AlinLoadMammoth!=='function') throw new Error('محمل مكتبة معاينة Word غير متاح');
    await window.AlinLoadMammoth();
    const resolved=typeof alinResolveStoredFile==='function'?await alinResolveStoredFile(r.source_file_path,'teacher-requests'):null;
    const url=resolved?.url||mediaUrl(r.source_file_path);
    const response=await fetch(url,{cache:'no-store'});
    if(!response.ok) throw new Error('تعذر قراءة ملف Word');
    const arrayBuffer=await response.arrayBuffer();
    const result=await window.mammoth.convertToHtml({arrayBuffer},{includeDefaultStyleMap:true});
    const target=document.getElementById('teacherWordPreview');
    if(!target)return;
    target.innerHTML=`<article class="teacher-word-document" oncontextmenu="return false">${result.value||'<p>الملف لا يحتوي نصاً قابلاً للعرض.</p>'}</article>`;
    target.querySelectorAll('a').forEach(a=>{a.removeAttribute('href');a.removeAttribute('download');});
    target.querySelectorAll('img').forEach(img=>img.setAttribute('draggable','false'));
  }catch(e){
    const target=document.getElementById('teacherWordPreview');
    if(target)target.innerHTML=`<div class="teacher-word-error"><b>تعذرت معاينة الملف</b><p>${esc(e.message||'تأكد أن الملف DOCX صحيح وأن التخزين متاح.')}</p></div>`;
  }
}

window.AlinTeacherModules['bestTeacherBook']=typeof bestTeacherBook==='function'?bestTeacherBook:window['bestTeacherBook'];window['bestTeacherBook']=window.AlinTeacherModules['bestTeacherBook'];
window.AlinTeacherModules['sendTeacherBookRequest']=typeof sendTeacherBookRequest==='function'?sendTeacherBookRequest:window['sendTeacherBookRequest'];window['sendTeacherBookRequest']=window.AlinTeacherModules['sendTeacherBookRequest'];
window.AlinTeacherModules['openTeacherPdf']=typeof openTeacherPdf==='function'?openTeacherPdf:window['openTeacherPdf'];window['openTeacherPdf']=window.AlinTeacherModules['openTeacherPdf'];
window.AlinTeacherModules['teacherPhoneForBooklet']=typeof teacherPhoneForBooklet==='function'?teacherPhoneForBooklet:window['teacherPhoneForBooklet'];window['teacherPhoneForBooklet']=window.AlinTeacherModules['teacherPhoneForBooklet'];
window.AlinTeacherModules['teacherImageForBooklet']=typeof teacherImageForBooklet==='function'?teacherImageForBooklet:window['teacherImageForBooklet'];window['teacherImageForBooklet']=window.AlinTeacherModules['teacherImageForBooklet'];
window.AlinTeacherModules['alinBookletTeacher']=typeof alinBookletTeacher==='function'?alinBookletTeacher:window['alinBookletTeacher'];window['alinBookletTeacher']=window.AlinTeacherModules['alinBookletTeacher'];
window.AlinTeacherModules['alinV72TeacherName']=typeof alinV72TeacherName==='function'?alinV72TeacherName:window['alinV72TeacherName'];window['alinV72TeacherName']=window.AlinTeacherModules['alinV72TeacherName'];
window.AlinTeacherModules['renderTeacherRequestsAdmin']=typeof renderTeacherRequestsAdmin==='function'?renderTeacherRequestsAdmin:window['renderTeacherRequestsAdmin'];window['renderTeacherRequestsAdmin']=window.AlinTeacherModules['renderTeacherRequestsAdmin'];
window.AlinTeacherModules['teacherRequestStatus']=typeof teacherRequestStatus==='function'?teacherRequestStatus:window['teacherRequestStatus'];window['teacherRequestStatus']=window.AlinTeacherModules['teacherRequestStatus'];
window.AlinTeacherModules['openTeacherRequestSource']=typeof openTeacherRequestSource==='function'?openTeacherRequestSource:window['openTeacherRequestSource'];window['openTeacherRequestSource']=window.AlinTeacherModules['openTeacherRequestSource'];


;

