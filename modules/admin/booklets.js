// === admin/booklets.js ===
/* ===== admin/js/admin-booklets-v127.js ===== */

(function(){
  const state={q:'',status:'all',grade:'all',subject:'all',teacher:'all'};
  const escv=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const moneyv=v=>typeof money==='function'?money(v):Number(v||0).toLocaleString('ar-IQ');
  const arr=v=>Array.isArray(v)?v:[];
  const unique=a=>[...new Set(a.filter(Boolean).map(x=>String(x).trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
  function teachers(){return arr(window.db?.accounts?.teachers||window.db?.teachers)}
  function books(){return arr(window.db?.booklets)}
  function teacherOf(id){const t=teachers().find(x=>String(x.id)===String(id));return t?.name||'غير مرتبط'}
  function normStatus(b){
    const s=String(b.status||b.publish_status||'').toLowerCase();
    if(['published','active','approved'].includes(s))return 'published';
    if(['hidden','inactive','draft'].includes(s))return 'hidden';
    if(['archived','deleted'].includes(s))return 'archived';
    return 'review';
  }
  function statusLabel(s){return {published:'منشورة',hidden:'مخفية',review:'قيد المراجعة',archived:'مؤرشفة'}[s]||'قيد المراجعة'}
  function coverUrl(b){const x=b.cover_path||b.cover_url||b.cover||b.image_path||b.image_url;try{return x&&typeof mediaUrl==='function'?mediaUrl(x):x||''}catch(_){return x||''}}
  function filtered(){
    const q=state.q.trim().toLowerCase();
    return books().filter(b=>{
      const s=normStatus(b),teacher=teacherOf(b.teacher_id),hay=[b.title,b.subject,b.grade,teacher,b.file_name].join(' ').toLowerCase();
      return (!q||hay.includes(q))&&(state.status==='all'||s===state.status)&&(state.grade==='all'||String(b.grade||'')===state.grade)&&(state.subject==='all'||String(b.subject||'')===state.subject)&&(state.teacher==='all'||String(b.teacher_id||'')===state.teacher);
    });
  }
  function uploadForm(){return `<form id="bookForm" class="form-grid"><input name="title" placeholder="اسم الملزمة"><select name="teacherId"><option value="">اختر المدرس</option>${teachers().map(x=>`<option value="${escv(x.id)}">${escv(x.name)}</option>`).join('')}</select><input name="subject" placeholder="المادة"><input name="grade" placeholder="الصف"><input name="price" type="number" min="0" placeholder="السعر"><label>غلاف الملزمة<input name="cover" type="file" accept="image/*"></label><label>صورة المدرس<input name="teacherImage" type="file" accept="image/*"></label><label>ملف PDF<input name="bookletFile" type="file" accept=".pdf" required></label><button type="button" onclick="uploadBooklet()">رفع ونشر</button></form>`}
  function card(b){
    const s=normStatus(b),cover=coverUrl(b),canPreview=!!(b.file_path||b.file_url),isPublished=s==='published';
    return `<article class="admin-v127-card"><div class="admin-v127-cover">${cover?`<img src="${escv(cover)}" alt="غلاف ${escv(b.title||'الملزمة')}" onerror="this.remove();this.parentElement.insertAdjacentHTML('beforeend','<span class=&quot;admin-v127-cover-fallback&quot;>آ</span>')">`:`<span class="admin-v127-cover-fallback">آ</span>`}<span class="admin-v127-status ${s}">${statusLabel(s)}</span></div><div class="admin-v127-body"><h3 class="admin-v127-title">${escv(b.title||'ملزمة بدون اسم')}</h3><div class="admin-v127-meta"><div><span>المدرس</span><b>${escv(teacherOf(b.teacher_id))}</b></div><div><span>المادة / الصف</span><b>${escv(b.subject||'—')} • ${escv(b.grade||'—')}</b></div><div><span>السعر</span><b class="admin-v127-price">${moneyv(b.price||0)} د.ع</b></div></div><div class="admin-v127-actions">${canPreview?`<button class="secondary" type="button" onclick="alinV127PreviewBooklet('${escv(b.id)}')">معاينة</button>`:''}<button class="secondary" type="button" onclick="editBooklet('${escv(b.id)}')">تعديل</button><button class="warning" type="button" onclick="setBookStatus('${escv(b.id)}','${isPublished?'hidden':'published'}')">${isPublished?'إخفاء':'نشر'}</button><button class="danger" type="button" onclick="alinV127DeleteBooklet('${escv(b.id)}')">حذف</button></div></div></article>`;
  }
  function render(){
    const root=window.adminContent||document.getElementById('adminContent');if(!root)return;
    const all=books(),list=filtered(),published=all.filter(x=>normStatus(x)==='published').length,hidden=all.filter(x=>normStatus(x)==='hidden').length,review=all.filter(x=>normStatus(x)==='review').length;
    const grades=unique(all.map(x=>x.grade)),subjects=unique(all.map(x=>x.subject));
    root.innerHTML=`<section class="admin-v127-booklets"><header class="admin-v127-head"><div><h2>إدارة الملازم</h2><p>عرض وفرز ومتابعة حالة جميع الملازم من مكان واحد.</p></div><div class="admin-v127-head-actions"><button type="button" onclick="alinV127ToggleAdd()">إضافة ملزمة</button><button type="button" class="secondary" onclick="alinV127ClearFilters()">إعادة الضبط</button></div></header><section class="admin-v127-stats"><article class="admin-v127-stat"><small>إجمالي الملازم</small><strong>${all.length}</strong><span>جميع الحالات</span></article><article class="admin-v127-stat green"><small>المنشورة</small><strong>${published}</strong><span>ظاهرة في المتجر</span></article><article class="admin-v127-stat gray"><small>المخفية</small><strong>${hidden}</strong><span>غير ظاهرة للطلاب</span></article><article class="admin-v127-stat gold"><small>قيد المراجعة</small><strong>${review}</strong><span>بانتظار الإجراء</span></article></section><section class="admin-v127-toolbar"><input type="search" value="${escv(state.q)}" oninput="alinV127BookFilter('q',this.value)" placeholder="ابحث باسم الملزمة، المدرس أو المادة"><select onchange="alinV127BookFilter('status',this.value)"><option value="all">كل الحالات</option>${[['published','منشورة'],['hidden','مخفية'],['review','قيد المراجعة'],['archived','مؤرشفة']].map(x=>`<option value="${x[0]}" ${state.status===x[0]?'selected':''}>${x[1]}</option>`).join('')}</select><select onchange="alinV127BookFilter('grade',this.value)"><option value="all">كل الصفوف</option>${grades.map(x=>`<option value="${escv(x)}" ${state.grade===x?'selected':''}>${escv(x)}</option>`).join('')}</select><select onchange="alinV127BookFilter('subject',this.value)"><option value="all">كل المواد</option>${subjects.map(x=>`<option value="${escv(x)}" ${state.subject===x?'selected':''}>${escv(x)}</option>`).join('')}</select><select onchange="alinV127BookFilter('teacher',this.value)"><option value="all">كل المدرسين</option>${teachers().map(x=>`<option value="${escv(x.id)}" ${state.teacher===String(x.id)?'selected':''}>${escv(x.name)}</option>`).join('')}</select></section><div class="admin-v127-results"><span>تم العثور على <b>${list.length}</b> ملزمة</span><button type="button" onclick="alinV127ClearFilters()">مسح الفلاتر</button></div><section class="admin-v127-add"><button type="button" onclick="alinV127ToggleAdd()"><span>إضافة ملزمة جديدة</span><b>+</b></button><div id="alinV127AddPanel" class="admin-v127-add-panel" hidden>${uploadForm()}</div></section>${list.length?`<section class="admin-v127-grid">${list.map(card).join('')}</section>`:`<div class="admin-v127-empty"><strong>لا توجد ملازم مطابقة</strong><span>غيّر الفلاتر أو أضف ملزمة جديدة.</span></div>`}</section>`;
  }
  window.alinV127BookFilter=(k,v)=>{state[k]=String(v??'');render()};
  window.alinV127ClearFilters=()=>{Object.assign(state,{q:'',status:'all',grade:'all',subject:'all',teacher:'all'});render()};
  window.alinV127ToggleAdd=()=>{const p=document.getElementById('alinV127AddPanel');if(!p)return;p.hidden=!p.hidden;if(!p.hidden)p.scrollIntoView({behavior:'smooth',block:'center'})};
  window.alinV127PreviewBooklet=id=>{const b=books().find(x=>String(x.id)===String(id));if(!b)return; if(typeof openTeacherPdf==='function')return openTeacherPdf(id); const u=coverUrl(b); if(u)window.open(u,'_blank','noopener')};
  window.alinV127DeleteBooklet=id=>{if(!confirm('حذف هذه الملزمة؟ لا يمكن التراجع عن العملية.'))return;if(typeof deleteBooklet==='function')return deleteBooklet(id)};
  window.renderBookletsAdmin=render;
  if(window.AlinAdminModules?.register)AlinAdminModules.register('booklets',()=>{});
})();

/* ===== admin/js/admin-booklets-v128.js ===== */

(function(){
  const state={q:'',status:'all',grade:'all',subject:'all',teacher:'all'};
  const escv=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const moneyv=v=>typeof money==='function'?money(v):Number(v||0).toLocaleString('ar-IQ');
  const arr=v=>Array.isArray(v)?v:[];
  const unique=a=>[...new Set(a.filter(Boolean).map(x=>String(x).trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
  const books=()=>arr(window.db?.booklets);
  const teachers=()=>arr(window.db?.accounts?.teachers||window.db?.teachers);
  const orders=()=>arr(window.db?.orders);
  const teacherOf=id=>teachers().find(x=>String(x.id)===String(id))?.name||'غير مرتبط';
  const teacherOptions=selected=>teachers().map(x=>`<option value="${escv(x.id)}" ${String(selected||'')===String(x.id)?'selected':''}>${escv(x.name)}</option>`).join('');
  const nowIso=()=>new Date().toISOString();
  function normStatus(b){
    const s=String(b.publish_status||b.status||'').toLowerCase();
    if(['published','active'].includes(s)||b.published===true||b.is_published===true)return 'published';
    if(['hidden','inactive'].includes(s)||b.is_hidden===true)return 'hidden';
    if(['draft'].includes(s))return 'draft';
    if(['approved','review','pending','under_review'].includes(s)||b.teacher_approved===true)return 'review';
    if(['archived','deleted'].includes(s))return 'archived';
    return 'review';
  }
  const statusLabel=s=>({published:'منشورة',hidden:'مخفية',draft:'مسودة',review:'قيد المراجعة',archived:'مؤرشفة'}[s]||'قيد المراجعة');
  const statusPayload=s=>({
    published:{status:'published',publish_status:'published',published:true,is_published:true,is_hidden:false,published_at:nowIso()},
    hidden:{status:'hidden',publish_status:'hidden',published:false,is_published:false,is_hidden:true},
    draft:{status:'draft',publish_status:'draft',published:false,is_published:false,is_hidden:false,teacher_approved:false},
    review:{status:'review',publish_status:'review',published:false,is_published:false,is_hidden:false},
    archived:{status:'archived',publish_status:'archived',published:false,is_published:false,is_hidden:true}
  }[s]||{});
  function coverUrl(b){const x=b.cover_path||b.cover_url||b.cover||b.image_path||b.image_url;try{return x&&typeof mediaUrl==='function'?mediaUrl(x):x||''}catch(_){return x||''}}
  function filtered(){
    const q=state.q.trim().toLowerCase();
    return books().filter(b=>{
      const s=normStatus(b),hay=[b.title,b.subject,b.grade,b.term,b.edition,b.year,teacherOf(b.teacher_id),b.file_name].join(' ').toLowerCase();
      return (!q||hay.includes(q))&&(state.status==='all'||s===state.status)&&(state.grade==='all'||String(b.grade||'')===state.grade)&&(state.subject==='all'||String(b.subject||'')===state.subject)&&(state.teacher==='all'||String(b.teacher_id||'')===state.teacher);
    });
  }
  function ensureModal(){
    let m=document.getElementById('alinV128BookModal');
    if(m)return m;
    document.body.insertAdjacentHTML('beforeend',`<div id="alinV128BookModal" class="admin-v128-modal" hidden><div class="admin-v128-modal-card"><button class="admin-v128-modal-close" type="button" onclick="alinV128CloseModal()">×</button><div id="alinV128ModalBody"></div></div></div>`);
    m=document.getElementById('alinV128BookModal');
    m.addEventListener('click',e=>{if(e.target===m)alinV128CloseModal()});
    return m;
  }
  function formHtml(b={}){
    const editing=!!b.id;
    return `<section class="admin-v128-editor"><header><div><small>${editing?'تعديل ملزمة':'إضافة ملزمة جديدة'}</small><h2>${editing?escv(b.title||'الملزمة'):'بيانات الملزمة'}</h2><p>أكمل المعلومات ثم احفظها كمسودة أو أرسلها للمراجعة أو انشرها.</p></div><span class="admin-v128-step">${editing?'تعديل':'جديد'}</span></header><form id="alinV128BookForm" class="admin-v128-form" onsubmit="return false"><input type="hidden" name="id" value="${escv(b.id||'')}"><div class="admin-v128-field wide"><label>اسم الملزمة</label><input name="title" value="${escv(b.title||'')}" placeholder="مثال: ملزمة الرياضيات - الفصل الأول" required></div><div class="admin-v128-field"><label>المدرس</label><select name="teacherId" required><option value="">اختر المدرس</option>${teacherOptions(b.teacher_id)}</select></div><div class="admin-v128-field"><label>المادة</label><input name="subject" value="${escv(b.subject||'')}" placeholder="الرياضيات"></div><div class="admin-v128-field"><label>الصف</label><input name="grade" value="${escv(b.grade||'')}" placeholder="السادس الإعدادي"></div><div class="admin-v128-field"><label>الفصل</label><input name="term" value="${escv(b.term||b.chapter||'')}" placeholder="الفصل الأول"></div><div class="admin-v128-field"><label>السنة / الإصدار</label><input name="edition" value="${escv(b.edition||b.year||'')}" placeholder="2027"></div><div class="admin-v128-field"><label>السعر بالدينار</label><input name="price" type="number" min="0" value="${Number(b.price||0)}"></div><div class="admin-v128-field"><label>نسبة المدرس %</label><input name="teacherShare" type="number" min="0" max="100" value="${Number(b.teacher_share_percent??b.teacher_percent??0)}"></div><div class="admin-v128-field file"><label>غلاف الملزمة</label><input name="cover" type="file" accept="image/*"><small>${b.cover_path?'سيبقى الغلاف الحالي إذا لم تختر ملفاً جديداً.':'اختر صورة واضحة للغلاف.'}</small></div><div class="admin-v128-field file"><label>ملف PDF</label><input name="bookletFile" type="file" accept=".pdf,application/pdf" ${editing?'':'required'}><small>${b.file_path?'سيبقى الملف الحالي إذا لم تختر ملفاً جديداً.':'ملف PDF مطلوب.'}</small></div><div class="admin-v128-field wide"><label>ملاحظات داخلية</label><textarea name="adminNote" rows="3" placeholder="ملاحظة لا تظهر للطالب">${escv(b.admin_note||'')}</textarea></div><div class="admin-v128-form-actions wide"><button type="button" class="secondary" onclick="alinV128SaveBooklet('draft')">حفظ كمسودة</button><button type="button" class="warning" onclick="alinV128SaveBooklet('review')">إرسال للمراجعة</button><button type="button" onclick="alinV128SaveBooklet('published')">حفظ ونشر</button></div></form></section>`;
  }
  function openForm(id=''){
    const b=id?books().find(x=>String(x.id)===String(id)):{};
    ensureModal();
    document.getElementById('alinV128ModalBody').innerHTML=formHtml(b||{});
    document.getElementById('alinV128BookModal').hidden=false;
    document.body.classList.add('admin-v128-modal-open');
  }
  async function save(status){
    const form=document.getElementById('alinV128BookForm');if(!form)return;
    const f=new FormData(form),id=String(f.get('id')||''),title=String(f.get('title')||'').trim(),teacherId=String(f.get('teacherId')||'').trim();
    if(!title||!teacherId)return alert('أكمل اسم الملزمة والمدرس');
    const existing=id?books().find(x=>String(x.id)===id):null;
    try{
      const coverFile=f.get('cover'),pdfFile=f.get('bookletFile');
      let cover=existing?.cover_path||'',filePath=existing?.file_path||'',fileName=existing?.file_name||'';
      if(coverFile&&coverFile.name)cover=await uploadFileV52('covers',coverFile,{type:'image'});
      if(pdfFile&&pdfFile.name){filePath=await uploadFileV52('booklets',pdfFile,{required:true,type:'pdf'});fileName=pdfFile.name}
      if(!filePath)throw new Error('ملف PDF مطلوب');
      const payload={title,teacher_id:teacherId,subject:String(f.get('subject')||'').trim(),grade:String(f.get('grade')||'').trim(),term:String(f.get('term')||'').trim(),edition:String(f.get('edition')||'').trim(),year:String(f.get('edition')||'').trim(),price:Number(f.get('price')||0),teacher_share_percent:Number(f.get('teacherShare')||0),admin_note:String(f.get('adminNote')||'').trim(),cover_path:cover,file_path:filePath,file_name:fileName,updated_at:nowIso(),...statusPayload(status)};
      if(existing){await update('booklets',payload,{id});await audit('booklet',`تعديل ملزمة ${title} وحفظها بحالة ${statusLabel(status)}`)}
      else{payload.id=typeof uid==='function'?uid('B'):'B-'+Date.now();payload.created_at=nowIso();await insert('booklets',payload);await audit('booklet',`إضافة ملزمة ${title} بحالة ${statusLabel(status)}`)}
      await load();alinV128CloseModal();render();if(typeof toast==='function')toast(existing?'تم تحديث الملزمة':'تمت إضافة الملزمة');
    }catch(e){alert(e.message||'تعذر حفظ الملزمة')}
  }
  function preview(id){
    const b=books().find(x=>String(x.id)===String(id));if(!b)return;
    if(typeof openTeacherPdf==='function')return openTeacherPdf(id);
    try{const u=typeof mediaUrl==='function'?mediaUrl(b.file_path):b.file_path;if(u)window.open(u,'_blank','noopener')}catch(_){alert('تعذر فتح المعاينة')}
  }
  function orderCount(id){return orders().filter(o=>String(o.item_id||o.booklet_id)===String(id)&&String(o.kind||'booklet')==='booklet').length}
  async function remove(id){
    const b=books().find(x=>String(x.id)===String(id));if(!b)return;
    const count=orderCount(id);
    if(count>0){
      if(!confirm(`هذه الملزمة مرتبطة بـ ${count} طلب، لذلك لا يمكن حذفها. هل تريد إخفاءها بدلاً من الحذف؟`))return;
      return changeStatus(id,'hidden');
    }
    if(!confirm('حذف هذه الملزمة نهائياً؟ لا يمكن التراجع عن العملية.'))return;
    try{if(typeof removeRow!=='function')throw new Error('خدمة حذف الملازم غير متاحة');await removeRow('booklets',{id});await audit('booklet',`حذف ملزمة ${b.title||id}`);await load();render();if(typeof toast==='function')toast('تم حذف الملزمة')}catch(e){alert(e.message||'تعذر حذف الملزمة')}
  }
  async function changeStatus(id,status){
    const b=books().find(x=>String(x.id)===String(id));if(!b)return;
    try{await update('booklets',{...statusPayload(status),updated_at:nowIso()},{id});await audit('booklet',`تغيير حالة ملزمة ${b.title||id} إلى ${statusLabel(status)}`);await load();render();if(typeof toast==='function')toast(`تم تغيير الحالة إلى ${statusLabel(status)}`)}catch(e){alert(e.message||'تعذر تغيير الحالة')}
  }
  function history(id){
    const b=books().find(x=>String(x.id)===String(id));if(!b)return;
    const logs=[...arr(window.db?.audit),...arr(window.db?.auditLogs)].filter(x=>String(x.kind||'').includes('booklet')&&(String(x.text||'').includes(String(id))||String(x.text||'').includes(String(b.title||'')))).sort((a,z)=>String(z.created_at||'').localeCompare(String(a.created_at||'')));
    ensureModal();
    document.getElementById('alinV128ModalBody').innerHTML=`<section class="admin-v128-history"><header><small>سجل التعديلات</small><h2>${escv(b.title||'الملزمة')}</h2></header>${logs.length?logs.map(x=>`<article><span></span><div><b>${escv(x.text||'تعديل')}</b><small>${escv(x.created_at||'')}</small></div></article>`).join(''):`<div class="admin-v128-empty-history">لا توجد تعديلات مسجلة لهذه الملزمة حتى الآن.</div>`}</section>`;
    document.getElementById('alinV128BookModal').hidden=false;document.body.classList.add('admin-v128-modal-open');
  }
  function card(b){
    const s=normStatus(b),cover=coverUrl(b),count=orderCount(b.id),isPublished=s==='published';
    return `<article class="admin-v128-card"><div class="admin-v128-cover">${cover?`<img src="${escv(cover)}" alt="غلاف ${escv(b.title||'الملزمة')}">`:`<span>آ</span>`}<em class="admin-v128-status ${s}">${statusLabel(s)}</em></div><div class="admin-v128-card-body"><h3>${escv(b.title||'ملزمة بدون اسم')}</h3><div class="admin-v128-card-meta"><div><small>المدرس</small><b>${escv(teacherOf(b.teacher_id))}</b></div><div><small>المادة / الصف</small><b>${escv(b.subject||'—')} • ${escv(b.grade||'—')}</b></div><div><small>الإصدار</small><b>${escv(b.edition||b.year||'—')}</b></div><div><small>الطلبات</small><b>${count}</b></div><div><small>السعر</small><b class="price">${moneyv(b.price||0)} د.ع</b></div></div><div class="admin-v128-card-actions"><button class="secondary" type="button" onclick="alinV128PreviewBooklet('${escv(b.id)}')">معاينة</button><button class="secondary" type="button" onclick="alinV128OpenBookForm('${escv(b.id)}')">تعديل</button><button class="secondary" type="button" onclick="alinV128BookHistory('${escv(b.id)}')">السجل</button><button class="warning" type="button" onclick="alinV128SetStatus('${escv(b.id)}','${isPublished?'hidden':'published'}')">${isPublished?'إخفاء':'نشر'}</button><button class="danger" type="button" onclick="alinV128DeleteBooklet('${escv(b.id)}')">حذف</button></div></div></article>`;
  }
  function render(){
    const root=window.adminContent||document.getElementById('adminContent');if(!root)return;
    const all=books(),list=filtered(),counts={published:0,hidden:0,draft:0,review:0};all.forEach(x=>{const s=normStatus(x);if(counts[s]!==undefined)counts[s]++});
    const grades=unique(all.map(x=>x.grade)),subjects=unique(all.map(x=>x.subject));
    root.innerHTML=`<section class="admin-v128-booklets"><header class="admin-v128-head"><div><h2>إدارة الملازم</h2><p>إضافة وتعديل ونشر الملازم مع المعاينة وسجل التغييرات.</p></div><div><button type="button" onclick="alinV128OpenBookForm()">إضافة ملزمة</button><button type="button" class="secondary" onclick="alinV128ClearFilters()">إعادة الضبط</button></div></header><section class="admin-v128-stats"><article><small>إجمالي الملازم</small><strong>${all.length}</strong></article><article class="green"><small>المنشورة</small><strong>${counts.published}</strong></article><article class="gray"><small>المخفية</small><strong>${counts.hidden}</strong></article><article class="gold"><small>المسودات والمراجعة</small><strong>${counts.draft+counts.review}</strong></article></section><section class="admin-v128-toolbar"><input type="search" value="${escv(state.q)}" oninput="alinV128BookFilter('q',this.value)" placeholder="ابحث باسم الملزمة، المدرس أو المادة"><select onchange="alinV128BookFilter('status',this.value)"><option value="all">كل الحالات</option>${[['published','منشورة'],['hidden','مخفية'],['draft','مسودة'],['review','قيد المراجعة'],['archived','مؤرشفة']].map(x=>`<option value="${x[0]}" ${state.status===x[0]?'selected':''}>${x[1]}</option>`).join('')}</select><select onchange="alinV128BookFilter('grade',this.value)"><option value="all">كل الصفوف</option>${grades.map(x=>`<option value="${escv(x)}" ${state.grade===x?'selected':''}>${escv(x)}</option>`).join('')}</select><select onchange="alinV128BookFilter('subject',this.value)"><option value="all">كل المواد</option>${subjects.map(x=>`<option value="${escv(x)}" ${state.subject===x?'selected':''}>${escv(x)}</option>`).join('')}</select><select onchange="alinV128BookFilter('teacher',this.value)"><option value="all">كل المدرسين</option>${teachers().map(x=>`<option value="${escv(x.id)}" ${state.teacher===String(x.id)?'selected':''}>${escv(x.name)}</option>`).join('')}</select></section><div class="admin-v128-results"><span>تم العثور على <b>${list.length}</b> ملزمة</span></div>${list.length?`<section class="admin-v128-grid">${list.map(card).join('')}</section>`:`<div class="admin-v128-empty"><strong>لا توجد ملازم مطابقة</strong><span>غيّر الفلاتر أو أضف ملزمة جديدة.</span></div>`}</section>`;
  }
  window.alinV128BookFilter=(k,v)=>{state[k]=String(v??'');render()};
  window.alinV128ClearFilters=()=>{Object.assign(state,{q:'',status:'all',grade:'all',subject:'all',teacher:'all'});render()};
  window.alinV128OpenBookForm=openForm;
  window.alinV128SaveBooklet=save;
  window.alinV128CloseModal=()=>{const m=document.getElementById('alinV128BookModal');if(m)m.hidden=true;document.body.classList.remove('admin-v128-modal-open')};
  window.alinV128PreviewBooklet=preview;
  window.alinV128DeleteBooklet=remove;
  window.alinV128SetStatus=changeStatus;
  window.alinV128BookHistory=history;
  window.renderBookletsAdmin=render;
  if(window.AlinAdminModules?.register)AlinAdminModules.register('booklets',()=>{});
})();


;
