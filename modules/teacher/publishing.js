// Alin module: teacher/publishing.js | v2.0.1
/* ===== teacher/js/teacher-publishing-v150.js ===== */
/* V150 — رفع الملزمة وطلبات النشر */
(function(){
  const escSafe=v=>typeof esc==='function'?esc(v):String(v??'');
  const currentSafe=()=>typeof current!=='undefined'?current:(window.current||{});
  const dbSafe=()=>typeof db!=='undefined'?db:(window.db||{});
  const statusMap={new:'قيد الاستلام',pending:'قيد المراجعة',designing:'قيد التصميم',review:'قيد المراجعة',ready:'جاهزة للموافقة',approved:'تمت الموافقة',published:'منشورة',rejected:'مرفوضة'};
  const statusName=s=>statusMap[String(s||'new').toLowerCase()]||s||'قيد المراجعة';
  const statusStep=s=>{s=String(s||'new').toLowerCase();if(['rejected'].includes(s))return 1;if(['new','pending'].includes(s))return 1;if(['designing'].includes(s))return 2;if(['review','ready'].includes(s))return 3;if(['approved','published'].includes(s))return 4;return 1};
  function teacherRequests(){
    const cur=currentSafe(), database=dbSafe();
    return (database.teacherRequests||database.teacher_requests||[]).filter(r=>String(r.teacher_id)===String(cur.id)).sort((a,b)=>String(b.created_at||b.id||'').localeCompare(String(a.created_at||a.id||'')));
  }
  function requestCards(){
    const rows=teacherRequests();
    if(!rows.length)return '<div class="teacher-v150-empty">لا توجد طلبات رفع أو تحديث حتى الآن.</div>';
    return rows.map(r=>{
      const status=String(r.status||'new').toLowerCase(),step=statusStep(status);
      const adminNote=r.admin_note||r.review_note||r.rejection_reason||'';
      return `<article class="teacher-v150-request"><div class="teacher-v150-request-top"><div><h4>${escSafe(r.title||'طلب ملزمة')}</h4><small>${escSafe(r.subject||'بدون مادة')} • ${escSafe(r.grade||'بدون صف')}</small></div><span class="teacher-v150-status ${escSafe(status)}">${escSafe(statusName(status))}</span></div><div class="teacher-v150-progress">${[1,2,3,4].map(i=>`<span class="${i<=step?'done':''}"></span>`).join('')}</div>${r.note?`<small>${escSafe(r.note)}</small>`:''}${adminNote?`<div class="teacher-v150-note" style="margin-top:10px">ملاحظة الإدارة: ${escSafe(adminNote)}</div>`:''}<div class="teacher-v150-request-actions">${r.source_file_path?`<button type="button" onclick="openTeacherRequestSource('${escSafe(r.id)}')">عرض الملف المرسل</button>`:''}<button type="button" class="secondary" onclick="alinV150ReuseRequest('${escSafe(r.id)}')">إعادة استخدام البيانات</button></div></article>`;
    }).join('');
  }
  function renderPublishing(){
    const box=document.getElementById('teacherContent');if(!box)return;
    box.innerHTML=`<div class="teacher-v150-layout"><section class="teacher-v150-panel"><div class="teacher-v150-panel-head"><div><h3>رفع ملزمة جديدة</h3><p>ارفع ملف Word بصيغة DOCX حتى تراجعه الإدارة داخل المنصة. النسخة النهائية PDF يرفعها المدير عند النشر.</p></div><span class="teacher-v150-badge">مراجعة قبل النشر</span></div><form id="teacherRequestForm" class="teacher-v150-form"><div class="teacher-v150-field"><label>اسم الملزمة *</label><input name="title" id="v150Title" required placeholder="مثال: ملزمة الرياضيات"></div><div class="teacher-v150-field"><label>المادة</label><input name="subject" id="v150Subject" placeholder="الرياضيات، الفيزياء..."></div><div class="teacher-v150-field"><label>الصف أو المرحلة</label><input name="grade" id="v150Grade" placeholder="السادس الإعدادي"></div><div class="teacher-v150-field"><label>الفصل</label><input id="v150Chapter" placeholder="الفصل الأول"></div><div class="teacher-v150-field"><label>سنة الإصدار</label><input id="v150Year" type="number" min="2024" max="2100" value="${new Date().getFullYear()}"></div><div class="teacher-v150-field"><label>السعر المقترح</label><input id="v150Price" type="number" min="0" step="250" placeholder="بالدينار العراقي"></div><div class="teacher-v150-field full"><label>ملاحظات للإدارة</label><textarea name="note" id="v150Note" placeholder="اكتب تفاصيل التنضيد أو الغلاف أو أي ملاحظة مهمة"></textarea></div><div class="teacher-v150-field full"><label class="teacher-v150-upload"><input name="source" id="v150Word" type="file" accept="application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx" onchange="alinV150FileChanged(this)"><span class="teacher-v150-upload-icon">W</span><b>اختر ملف الملزمة بصيغة Word</b><small>ملف DOCX قابل للمراجعة، ولا يُنشر للطالب مباشرة</small></label><div id="v150FileInfo" class="teacher-v150-file-info"></div></div><div id="v150Preview" class="teacher-v150-preview"></div><div class="teacher-v150-note">بعد الإرسال يستطيع المدير مشاهدة محتوى Word داخل المنصة فقط وإرسال ملاحظاته. لا يظهر زر تنزيل في واجهة المعاينة.</div><div class="teacher-v150-actions"><button type="button" class="secondary" onclick="alinV150PreviewRequest()">معاينة البيانات</button><button type="button" id="v150SubmitBtn" onclick="alinV150SubmitRequest()">إرسال للإدارة</button></div></form></section><aside class="teacher-v150-panel"><div class="teacher-v150-panel-head"><div><h3>طلبات النشر والتحديث</h3><p>تابع حالة كل طلب وملاحظات الإدارة.</p></div><span class="teacher-v150-badge">${teacherRequests().length} طلب</span></div><div class="teacher-v150-requests">${requestCards()}</div></aside></div>`;
  }
  window.alinV150FileChanged=function(input){
    const file=input.files?.[0],info=document.getElementById('v150FileInfo');if(!info)return;
    if(!file){info.classList.remove('show');info.innerHTML='';return}
    const mb=(file.size/1024/1024).toFixed(1);info.innerHTML=`<span>${escSafe(file.name)}</span><b>${mb} MB</b>`;info.classList.add('show');
  };
  window.alinV150PreviewRequest=function(){
    const title=document.getElementById('v150Title')?.value.trim()||'غير محدد',subject=document.getElementById('v150Subject')?.value.trim()||'-',grade=document.getElementById('v150Grade')?.value.trim()||'-',chapter=document.getElementById('v150Chapter')?.value.trim()||'-',year=document.getElementById('v150Year')?.value||'-',price=document.getElementById('v150Price')?.value||'0',preview=document.getElementById('v150Preview');if(!preview)return;
    preview.innerHTML=`<h4>معاينة الطلب</h4><div class="teacher-v150-preview-grid"><div><small>الملزمة</small><b>${escSafe(title)}</b></div><div><small>المادة</small><b>${escSafe(subject)}</b></div><div><small>الصف</small><b>${escSafe(grade)}</b></div><div><small>الفصل</small><b>${escSafe(chapter)}</b></div><div><small>الإصدار</small><b>${escSafe(year)}</b></div><div><small>السعر المقترح</small><b>${Number(price||0).toLocaleString('ar-IQ')} د.ع</b></div></div>`;preview.classList.add('show');
  };
  window.alinV150SubmitRequest=async function(){
    const title=document.getElementById('v150Title')?.value.trim();if(!title)return alert('اكتب اسم الملزمة');
    const word=document.getElementById('v150Word')?.files?.[0];if(!word)return alert('اختر ملف Word بصيغة DOCX');const ext=(word.name.split('.').pop()||'').toLowerCase();if(ext!=='docx')return alert('احفظ الملف بصيغة DOCX ثم ارفعه. صيغة DOC القديمة لا يمكن معاينتها بأمان داخل المتصفح.');
    const noteParts=[];const chapter=document.getElementById('v150Chapter')?.value.trim(),year=document.getElementById('v150Year')?.value,price=document.getElementById('v150Price')?.value,note=document.getElementById('v150Note')?.value.trim();
    if(chapter)noteParts.push(`الفصل: ${chapter}`);if(year)noteParts.push(`الإصدار: ${year}`);if(price)noteParts.push(`السعر المقترح: ${price} د.ع`);if(note)noteParts.push(note);
    const noteField=document.getElementById('v150Note');if(noteField)noteField.value=noteParts.join(' | ');
    const btn=document.getElementById('v150SubmitBtn');if(btn){btn.disabled=true;btn.textContent='جاري الإرسال...'}
    try{if(typeof sendTeacherBookRequest!=='function')throw new Error('خدمة إرسال الطلب غير متاحة');await sendTeacherBookRequest();}
    finally{if(btn&&document.body.contains(btn)){btn.disabled=false;btn.textContent='إرسال للإدارة'}}
  };
  window.alinV150ReuseRequest=function(id){
    const r=teacherRequests().find(x=>String(x.id)===String(id));if(!r)return;
    renderPublishing();
    const set=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v||''};set('v150Title',r.title);set('v150Subject',r.subject);set('v150Grade',r.grade);set('v150Note',r.note);document.getElementById('v150Title')?.focus();
  };
  const previousTab=window.teacherTab,previousRender=window.renderTeacher;let active='';
  window.teacherTab=function(tab){active=tab||'dashboard';if(active==='requests'){renderPublishing();document.querySelectorAll('#teacherPage .teacher-tabs button').forEach(b=>b.classList.toggle('active-teacher-tab',(b.getAttribute('onclick')||'').includes("'requests'")));return}return typeof previousTab==='function'?previousTab(active):undefined};
  window.renderTeacher=function(){const result=typeof previousRender==='function'?previousRender():undefined;if(active==='requests')renderPublishing();return result};
  window.AlinTeacherModules=window.AlinTeacherModules||{};window.AlinTeacherModules.renderPublishingV150=renderPublishing;
})();

/* ===== teacher/js/teacher-review-v152.js ===== */
/* V152 — مسار مراجعة ونشر ملزمة المدرس */
(function(){
  const safeEsc=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const cur=()=>typeof current!=='undefined'?current:(window.current||{});
  const data=()=>typeof db!=='undefined'?db:(window.db||{});
  const statusLabels={new:'تم الإرسال',pending:'بانتظار المراجعة',review:'قيد المراجعة',changes_requested:'مطلوب تعديل',resubmitted:'أعيد الإرسال',approved:'تمت الموافقة',ready:'جاهزة للنشر',published:'منشورة',rejected:'مرفوضة',designing:'قيد التجهيز'};
  const label=s=>statusLabels[String(s||'new').toLowerCase()]||String(s||'قيد المراجعة');
  const step=s=>{s=String(s||'new').toLowerCase();if(s==='rejected')return 2;if(['new','pending'].includes(s))return 1;if(['review','designing'].includes(s))return 2;if(['changes_requested'].includes(s))return 3;if(['resubmitted','approved','ready'].includes(s))return 4;if(s==='published')return 5;return 1};
  const teacherRows=()=>((data().teacherRequests||data().teacher_requests||[]).filter(r=>String(r.teacher_id)===String(cur().id))).sort((a,b)=>String(b.updated_at||b.created_at||b.id||'').localeCompare(String(a.updated_at||a.created_at||a.id||'')));
  const allRows=()=>((data().teacherRequests||data().teacher_requests||[])).slice().sort((a,b)=>String(b.updated_at||b.created_at||b.id||'').localeCompare(String(a.updated_at||a.created_at||a.id||'')));
  function parseHistory(r){
    if(Array.isArray(r.version_history))return r.version_history;
    if(typeof r.version_history==='string'){try{return JSON.parse(r.version_history)||[]}catch(_){}}
    if(Array.isArray(r.history))return r.history;
    return [];
  }
  function statusClass(s){return String(s||'new').toLowerCase().replace(/[^a-z_]/g,'')}
  function canReupload(s){return ['changes_requested','rejected'].includes(String(s||'').toLowerCase())}
  function requestCard(r){
    const s=String(r.status||'new').toLowerCase(),n=step(s),hist=parseHistory(r),note=r.admin_note||r.review_note||r.rejection_reason||'',created=r.created_at?new Date(r.created_at).toLocaleDateString('ar-IQ'):'-';
    return `<article class="teacher-v152-card" data-title="${safeEsc((r.title||'')+' '+(r.subject||'')+' '+(r.grade||''))}" data-status="${safeEsc(s)}"><div class="teacher-v152-top"><div><h3>${safeEsc(r.title||'طلب ملزمة')}</h3><small>${safeEsc(r.subject||'بدون مادة')} • ${safeEsc(r.grade||'بدون صف')}</small></div><span class="teacher-v152-status ${statusClass(s)}">${safeEsc(label(s))}</span></div><div class="teacher-v152-meta"><span class="teacher-v152-chip">تاريخ الإرسال: ${safeEsc(created)}</span><span class="teacher-v152-chip">الإصدار: ${Math.max(1,hist.length+1)}</span>${r.source_file_name?`<span class="teacher-v152-chip">${safeEsc(r.source_file_name)}</span>`:''}</div><div class="teacher-v152-steps">${['الإرسال','المراجعة','التعديل','الموافقة','النشر'].map((x,i)=>`<span class="teacher-v152-step ${i+1<=n?'done':''}">${x}</span>`).join('')}</div>${note?`<div class="teacher-v152-note"><strong>ملاحظة الإدارة:</strong> ${safeEsc(note)}</div>`:''}${r.note?`<div class="teacher-v152-note"><strong>ملاحظتك:</strong> ${safeEsc(r.note)}</div>`:''}<div class="teacher-v152-actions">${r.source_file_path?`<button type="button" class="secondary" onclick="openTeacherRequestSource('${safeEsc(r.id)}')">مشاهدة النسخة الحالية</button>`:''}${canReupload(s)?`<button type="button" class="warning" onclick="alinV152ToggleReupload('${safeEsc(r.id)}')">رفع نسخة معدلة</button>`:''}${s==='approved'||s==='ready'?`<button type="button" class="success" disabled>بانتظار نشر الإدارة</button>`:''}</div>${canReupload(s)?`<div id="v152Reupload-${safeEsc(r.id)}" class="teacher-v152-upload-box hidden"><b>رفع نسخة Word معدلة</b><input id="v152File-${safeEsc(r.id)}" type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"><textarea id="v152Note-${safeEsc(r.id)}" placeholder="اكتب ما تم تعديله"></textarea><button type="button" onclick="alinV152Resubmit('${safeEsc(r.id)}')">إعادة الإرسال للإدارة</button></div>`:''}<details class="teacher-v152-history"><summary>سجل النسخ والمراجعات (${hist.length})</summary><div class="teacher-v152-history-list">${hist.length?hist.slice().reverse().map((h,i)=>`<div class="teacher-v152-history-item"><span>${safeEsc(h.file_name||h.status||'نسخة سابقة')}</span><span>${safeEsc(h.at?new Date(h.at).toLocaleString('ar-IQ'):'')}</span></div>`).join(''):'<div class="teacher-v152-history-item"><span>لا يوجد سجل سابق</span></div>'}</div></details></article>`;
  }
  function renderTeacherReview(){
    const box=document.getElementById('teacherContent');if(!box)return;const rows=teacherRows();
    box.innerHTML=`<section class="teacher-v152-wrap"><div class="teacher-v152-head"><div><h2>طلبات النشر والمراجعة</h2><p>تابع مراجعة الإدارة، اطلع على الملاحظات، وارفع نسخة Word معدلة عند الحاجة.</p></div><span class="teacher-v152-count">${rows.length}</span></div><div class="teacher-v152-filters"><input id="v152Search" placeholder="ابحث باسم الملزمة أو المادة" oninput="alinV152Filter()"><select id="v152Status" onchange="alinV152Filter()"><option value="">كل الحالات</option><option value="new">تم الإرسال</option><option value="review">قيد المراجعة</option><option value="changes_requested">مطلوب تعديل</option><option value="approved">تمت الموافقة</option><option value="published">منشورة</option><option value="rejected">مرفوضة</option></select><select id="v152Sort" onchange="alinV152Filter()"><option value="newest">الأحدث أولاً</option><option value="oldest">الأقدم أولاً</option></select></div><div id="v152List" class="teacher-v152-list">${rows.length?rows.map(requestCard).join(''):'<div class="teacher-v152-empty">لا توجد طلبات نشر أو مراجعة حتى الآن.</div>'}</div></section>`;
  }
  window.alinV152Filter=function(){
    const q=(document.getElementById('v152Search')?.value||'').trim().toLowerCase(),s=document.getElementById('v152Status')?.value||'';document.querySelectorAll('#v152List .teacher-v152-card').forEach(c=>{c.hidden=!!((q&&!String(c.dataset.title||'').toLowerCase().includes(q))||(s&&c.dataset.status!==s))});
  };
  window.alinV152ToggleReupload=id=>document.getElementById('v152Reupload-'+id)?.classList.toggle('hidden');
  window.alinV152Resubmit=async function(id){
    const file=document.getElementById('v152File-'+id)?.files?.[0],note=document.getElementById('v152Note-'+id)?.value.trim()||'';if(!file)return alert('اختر ملف DOCX المعدل');if((file.name.split('.').pop()||'').toLowerCase()!=='docx')return alert('الملف يجب أن يكون DOCX');
    const r=teacherRows().find(x=>String(x.id)===String(id));if(!r)return alert('الطلب غير موجود');
    const button=event?.currentTarget;if(button){button.disabled=true;button.textContent='جاري الرفع...'}
    try{
      const path=await uploadFile('teacher-requests',file,{type:'any',required:true});const hist=parseHistory(r);hist.push({file_name:r.source_file_name||'',file_path:r.source_file_path||'',status:r.status||'',at:new Date().toISOString()});
      await update('teacher_requests',{source_file_path:path,source_file_name:file.name,source_file_type:'docx',status:'resubmitted',note:note||r.note||'',version_history:hist,updated_at:new Date().toISOString()},{id});
      if(typeof audit==='function')await audit('teacher_request','إعادة رفع نسخة Word معدلة للطلب '+id);if(typeof load==='function')await load();renderTeacherReview();if(typeof toast==='function')toast('تم إرسال النسخة المعدلة للإدارة');
    }catch(e){console.warn(e);alert(e.message||'تعذر رفع النسخة المعدلة');}finally{if(button&&document.body.contains(button)){button.disabled=false;button.textContent='إعادة الإرسال للإدارة'}}
  };
  function adminCard(r){
    const s=String(r.status||'new').toLowerCase(),note=r.admin_note||r.review_note||r.rejection_reason||'';return `<article class="teacher-admin-v152-card"><div class="teacher-v152-top"><div><h3>${safeEsc(r.title||'طلب ملزمة')}</h3><small>${safeEsc(r.teacher_name||'مدرس')} • ${safeEsc(r.subject||'')} • ${safeEsc(r.grade||'')}</small></div><span class="teacher-v152-status ${statusClass(s)}">${safeEsc(label(s))}</span></div>${note?`<div class="teacher-v152-note"><strong>آخر ملاحظة:</strong> ${safeEsc(note)}</div>`:''}<div class="teacher-admin-v152-actions">${r.source_file_path?`<button onclick="openTeacherRequestSource('${safeEsc(r.id)}')">معاينة Word</button>`:''}<textarea id="v152AdminNote-${safeEsc(r.id)}" placeholder="ملاحظة للمدرس أو سبب طلب التعديل"></textarea><button class="secondary" onclick="alinV152AdminDecision('${safeEsc(r.id)}','review')">قيد المراجعة</button><button class="warning" onclick="alinV152AdminDecision('${safeEsc(r.id)}','changes_requested')">طلب تعديل</button><button class="success" onclick="alinV152AdminDecision('${safeEsc(r.id)}','approved')">موافقة</button><button class="danger" onclick="alinV152AdminDecision('${safeEsc(r.id)}','rejected')">رفض</button></div></article>`;
  }
  function renderAdminReview(){
    const rows=allRows();adminContent.innerHTML=`<section class="teacher-admin-v152"><div class="teacher-v152-head"><div><h2>طلبات المدرسين للمراجعة والنشر</h2><p>شاهد ملف Word داخل المنصة، أرسل ملاحظاتك، ثم اطلب تعديلاً أو وافق على الطلب.</p></div><span class="teacher-v152-count">${rows.length}</span></div><div class="teacher-admin-v152-toolbar"><input id="v152AdminSearch" placeholder="بحث بالمدرس أو الملزمة" oninput="alinV152AdminFilter()"><select id="v152AdminStatus" onchange="alinV152AdminFilter()"><option value="">كل الحالات</option><option value="new">جديد</option><option value="review">قيد المراجعة</option><option value="changes_requested">مطلوب تعديل</option><option value="resubmitted">أعيد الإرسال</option><option value="approved">موافق عليه</option><option value="rejected">مرفوض</option></select><select id="v152AdminTeacher" onchange="alinV152AdminFilter()"><option value="">كل المدرسين</option>${[...new Set(rows.map(x=>x.teacher_name||x.teacher_id).filter(Boolean))].map(x=>`<option>${safeEsc(x)}</option>`).join('')}</select></div><div id="v152AdminList">${rows.length?rows.map(r=>`<div data-q="${safeEsc(((r.teacher_name||'')+' '+(r.title||'')+' '+(r.subject||'')).toLowerCase())}" data-status="${safeEsc(String(r.status||'new').toLowerCase())}" data-teacher="${safeEsc(r.teacher_name||r.teacher_id||'')}">${adminCard(r)}</div>`).join(''):'<div class="teacher-v152-empty">لا توجد طلبات مدرسين.</div>'}</div></section>`;
  }
  window.alinV152AdminFilter=function(){const q=(document.getElementById('v152AdminSearch')?.value||'').toLowerCase(),s=document.getElementById('v152AdminStatus')?.value||'',t=document.getElementById('v152AdminTeacher')?.value||'';document.querySelectorAll('#v152AdminList>div').forEach(x=>x.hidden=!!((q&&!x.dataset.q.includes(q))||(s&&x.dataset.status!==s)||(t&&x.dataset.teacher!==t)))};
  window.alinV152AdminDecision=async function(id,status){const note=document.getElementById('v152AdminNote-'+id)?.value.trim()||'';if(['changes_requested','rejected'].includes(status)&&!note)return alert('اكتب ملاحظة أو سبب واضح للمدرس');try{await update('teacher_requests',{status,admin_note:note,reviewed_at:new Date().toISOString(),reviewed_by:cur().name||cur().username||'admin',updated_at:new Date().toISOString()},{id});if(typeof audit==='function')await audit('teacher_request',`تحديث طلب ${id} إلى ${status}`);if(typeof load==='function')await load();renderAdminReview();if(typeof toast==='function')toast('تم تحديث حالة الطلب')}catch(e){console.warn(e);alert(e.message||'تعذر تحديث الطلب')}};
  const oldTeacherTab=window.teacherTab;let activeTeacher='';
  window.teacherTab=function(tab){
    activeTeacher=tab||'dashboard';
    document.querySelectorAll('#teacherPage .teacher-tabs button').forEach(b=>b.classList.toggle('active-teacher-tab',(b.getAttribute('onclick')||'').includes("'"+activeTeacher+"'")));
    if(activeTeacher==='review'||activeTeacher==='publishing'||activeTeacher==='publication'){
      renderTeacherReview();
      return;
    }
    return typeof oldTeacherTab==='function'?oldTeacherTab(activeTeacher):undefined;
  };
  window.renderTeacherRequestsAdmin=renderAdminReview;
  window.AlinTeacherModules=window.AlinTeacherModules||{};window.AlinTeacherModules.renderReviewV152=renderTeacherReview;window.AlinTeacherModules.renderAdminReviewV152=renderAdminReview;
})();


;

