/* core/lazy-libs.js */
/* ALIN 2.0.1 - Load optional libraries only when a feature needs them. */
(function(){
  const MAMMOTH_URL='https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js';
  let mammothPromise=null;

  window.AlinLoadMammoth=function(){
    if(window.mammoth) return Promise.resolve(window.mammoth);
    if(mammothPromise) return mammothPromise;

    mammothPromise=new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src=MAMMOTH_URL;
      script.async=true;
      script.crossOrigin='anonymous';
      script.onload=()=>window.mammoth
        ? resolve(window.mammoth)
        : reject(new Error('تعذر تشغيل مكتبة معاينة Word'));
      script.onerror=()=>reject(new Error('تعذر تحميل مكتبة معاينة Word. تحقق من الإنترنت ثم حاول مجدداً.'));
      document.head.appendChild(script);
    }).catch(error=>{
      mammothPromise=null;
      throw error;
    });

    return mammothPromise;
  };
})();

;
/* modules/teacher/booklets.js */
// === teacher/booklets.js ===
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
    const requestId=uid('TR');
    const path=await uploadFile('teacher-requests',sourceFile,{type:'docx',required:true,ownerId:current.id,entityId:requestId,maxBytes:20*1024*1024});
    await insert('teacher_requests',{
      id:requestId,teacher_id:current.id,teacher_name:current.name,
      title:String(f.get('title')).trim(),subject:String(f.get('subject')||''),grade:String(f.get('grade')||''),
      note:String(f.get('note')||''),source_file_path:path||'',source_file_name:sourceFile.name||'',
      source_file_type:'docx',source_mime_type:sourceFile.type||'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      status:'new'
    });
    await audit('teacher_request','رفع ملف Word لطلب ملزمة من '+current.name);
    await load(); teacherTab('requests'); toast('تم إرسال ملف Word للإدارة للمراجعة');
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
  let cleanUrl='';
  try{cleanUrl=await secureFileUrl(b.file_path,300,'booklets');}catch(e){return alert(e.message||'تعذر فتح ملف الملزمة');}
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
    const url=resolved?.url;
    if(!url)throw new Error('ملف Word غير محمي أو غير متاح');
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
window.AlinTeacherModules['teacherRequestStatus']=typeof teacherRequestStatus==='function'?teacherRequestStatus:window['teacherRequestStatus'];window['teacherRequestStatus']=window.AlinTeacherModules['teacherRequestStatus'];
window.AlinTeacherModules['openTeacherRequestSource']=typeof openTeacherRequestSource==='function'?openTeacherRequestSource:window['openTeacherRequestSource'];window['openTeacherRequestSource']=window.AlinTeacherModules['openTeacherRequestSource'];

async function approveTeacherBooklet(id){
  const booklet=(db.booklets||[]).find(row=>String(row.id)===String(id));
  if(!booklet)throw new Error('الملزمة غير موجودة');
  if(!window.sb?.rpc)throw new Error('خدمة الموافقة الآمنة غير متاحة');
  const {data,error}=await window.sb.rpc('alin_teacher_approve_booklet',{p_booklet_id:String(booklet.id)});
  if(error)throw error;
  const payload={teacher_approved:true,teacher_approved_at:new Date().toISOString()};
  Object.assign(booklet,payload);
  if(typeof audit==='function')await audit('booklet','موافقة المدرس على نشر '+(booklet.title||booklet.id));
  if(typeof load==='function')await load();
  teacherTab('booklets');
  if(typeof toast==='function')toast('تم إرسال الموافقة إلى الإدارة');
}

async function publishTeacherBooklet(id){
  const booklet=(db.booklets||[]).find(row=>String(row.id)===String(id));
  if(!booklet)throw new Error('الملزمة غير موجودة');
  if(!booklet.teacher_approved&&!confirm('المدرس لم يوافق بعد. هل تريد النشر رغم ذلك؟'))return;
  const payload={status:'published',publish_status:'published',published_at:new Date().toISOString(),updated_at:new Date().toISOString()};
  await update('booklets',payload,{id:booklet.id});
  Object.assign(booklet,payload);
  if(typeof audit==='function')await audit('booklet','نشر ملزمة '+(booklet.title||booklet.id));
  if(typeof load==='function')await load();
  if(typeof renderTeacherRequestsAdmin==='function')renderTeacherRequestsAdmin();
}

async function unpublishTeacherBooklet(id){
  const booklet=(db.booklets||[]).find(row=>String(row.id)===String(id));
  if(!booklet)throw new Error('الملزمة غير موجودة');
  const payload={status:'hidden',publish_status:'hidden',updated_at:new Date().toISOString()};
  await update('booklets',payload,{id:booklet.id});
  Object.assign(booklet,payload);
  if(typeof audit==='function')await audit('booklet','إخفاء ملزمة '+(booklet.title||booklet.id));
  if(typeof load==='function')await load();
}

window.approveTeacherBooklet=approveTeacherBooklet;
window.alinTeacherApproveBookletV56=approveTeacherBooklet;
window.publishTeacherBooklet=publishTeacherBooklet;
window.alinAdminPublishBookletV56=publishTeacherBooklet;
window.unpublishTeacherBooklet=unpublishTeacherBooklet;
window.alinUnpublishBookletV56=unpublishTeacherBooklet;
window.AlinTeacherModules.approveTeacherBooklet=approveTeacherBooklet;
window.AlinTeacherModules.publishTeacherBooklet=publishTeacherBooklet;
window.AlinTeacherModules.unpublishTeacherBooklet=unpublishTeacherBooklet;


;

;
/* modules/teacher/finance.js */
/* ALIN v2.2.6 — teacher orders and finance views backed only by AlinFinance. */
(function(){
  'use strict';
  if(!window.TeacherApp)throw new Error('TeacherApp must load before teacher/finance.js');
  window.AlinTeacherModules=window.AlinTeacherModules||{};
  const arr=value=>Array.isArray(value)?value:[];
  const same=(a,b)=>String(a??'')===String(b??'');
  const escv=value=>typeof window.esc==='function'?window.esc(value):String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const moneyv=value=>typeof window.money==='function'?window.money(value):Math.round(Number(value)||0).toLocaleString(window.AlinI18n?.locale?.()||'ar-IQ');
  const dateOnly=value=>String(value||'').slice(0,10)||'-';
  const done=new Set(['delivered','completed','done','received','settled']);
  const cancelled=new Set(['cancelled','canceled','rejected']);
  const finance=()=>window.AlinFinance;

  function data(){return window.TeacherApp.data()}
  function statusText(value){const key=String(value||'new').toLowerCase();return({new:'جديد',pending:'قيد الانتظار',assigned:'تم التحويل',accepted:'مقبول',processing:'قيد التجهيز',printing:'قيد الطباعة',ready:'جاهز',picked_up:'تم الاستلام',out_for_delivery:'قيد التوصيل',delivered:'تم التسليم',completed:'مكتمل',done:'مكتمل',cancelled:'ملغي',canceled:'ملغي',rejected:'مرفوض'})[key]||key}
  function statusGroup(value){const key=String(value||'').toLowerCase();return done.has(key)?'done':cancelled.has(key)?'cancelled':'active'}

  function teacherSummary(id){
    return finance()?.teacherSummary?.(id)||{earned:0,paid:0,remaining:0,monthEarn:0,rows:[],payouts:[]};
  }

  function teacherAccountPaid(id){return teacherSummary(id).paid}
  function alinV67SumTeacherBalances(){return arr(window.db?.accounts?.teachers).reduce((sum,row)=>sum+Number(teacherSummary(row.id).remaining||0),0)}
  function addTeacherPayoutPrompt(id){return finance()?.payBalance?.('teacher',id)}

  function renderOrders(){
    const d=data();
    const totalQty=d.orders.reduce((sum,row)=>sum+(Number(row.qty)||1),0);
    const active=d.orders.filter(row=>statusGroup(row.status)==='active').length;
    const completed=d.orders.filter(row=>statusGroup(row.status)==='done').length;
    const libraries=arr(window.db?.accounts?.libraries);
    const cards=d.orders.slice().sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))).map(order=>{
      const book=d.books.find(row=>same(row.id,order.item_id||order.booklet_id));
      const library=libraries.find(row=>same(row.id,order.library_id));
      const group=statusGroup(order.status);
      return `<article class="teacher-v154-order" data-search="${escv(`${order.order_number||order.id} ${order.title||book?.title||''}`.toLowerCase())}" data-status="${group}" data-library="${escv(order.library_id||'')}" data-date="${escv(dateOnly(order.created_at))}"><div><h4>${escv(order.order_number||order.id)} — ${escv(order.title||book?.title||'ملزمة')}</h4><small>النسخ: ${Number(order.qty)||1} • المكتبة: ${escv(library?.name||'-')} • ${dateOnly(order.created_at)}</small></div><div class="teacher-v154-order-side"><span class="teacher-v154-status ${group}">${escv(statusText(order.status))}</span><b>${moneyv(order.total)} د.ع</b></div></article>`;
    }).join('')||'<div class="teacher-v154-empty">لا توجد طلبات مرتبطة بملازمك.</div>';
    window.teacherContent.innerHTML=`<div class="teacher-v154-shell"><div class="teacher-v154-head"><div><h3>مبيعات وطلبات ملازمي</h3><p>عرض الطلبات من مصدر واحد بدون احتساب الطلبات الملغاة كأرباح.</p></div></div><div class="teacher-v154-summary"><div class="teacher-v154-stat"><small>إجمالي الطلبات</small><b>${d.orders.length}</b></div><div class="teacher-v154-stat"><small>قيد التنفيذ</small><b>${active}</b></div><div class="teacher-v154-stat"><small>مكتملة</small><b>${completed}</b></div><div class="teacher-v154-stat gold"><small>إجمالي النسخ</small><b>${totalQty}</b></div></div><div class="teacher-v154-tools"><input id="tv154OrderSearch" placeholder="ابحث برقم الطلب أو اسم الملزمة" oninput="teacherV154FilterOrders()"><select id="tv154OrderStatus" onchange="teacherV154FilterOrders()"><option value="">كل الحالات</option><option value="active">قيد التنفيذ</option><option value="done">مكتمل</option><option value="cancelled">ملغي</option></select></div><div id="teacherV154Orders" class="teacher-v154-list">${cards}</div></div>`;
  }

  function teacherV154FilterOrders(){
    const q=(document.getElementById('tv154OrderSearch')?.value||'').trim().toLowerCase();
    const status=document.getElementById('tv154OrderStatus')?.value||'';
    document.querySelectorAll('#teacherV154Orders .teacher-v154-order').forEach(card=>{card.hidden=Boolean((q&&!String(card.dataset.search||'').includes(q))||(status&&card.dataset.status!==status))});
  }

  function financeRows(id){
    const d=data();
    return teacherSummary(id).rows.slice().sort((a,b)=>String(b.settled_at||b.created_at||'').localeCompare(String(a.settled_at||a.created_at||''))).map(row=>{
      const order=d.orders.find(item=>same(item.id,row.order_id)||same(item.order_number,row.order_number||row.order_id));
      return `<tr><td>${escv(row.order_number||row.order_id)}</td><td>${escv(order?.title||'-')}</td><td>${dateOnly(row.settled_at||row.created_at)}</td><td>${moneyv(row.teacher||row.teacher_amount)} د.ع</td></tr>`;
    }).join('')||'<tr><td colspan="4">لا توجد أرباح من طلبات مسلّمة.</td></tr>';
  }

  function renderFinance(){
    const d=data(),summary=teacherSummary(d.id);
    const payouts=summary.payouts.slice().sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))).map(row=>`<div class="teacher-v154-payout"><div><b>${moneyv(row.amount)} د.ع</b><small>${dateOnly(row.created_at)} • ${escv(row.note||'تسوية أرباح')}</small></div><span class="teacher-v154-status ${String(row.status||'').toLowerCase()==='paid'?'done':'active'}">${String(row.status||'').toLowerCase()==='paid'?'مدفوعة':'قيد الانتظار'}</span></div>`).join('')||'<div class="teacher-v154-empty">لا توجد تسويات سابقة.</div>';
    window.teacherContent.innerHTML=`<div class="teacher-v154-shell"><div class="teacher-v154-head"><div><h3>الأرباح والتسويات</h3><p>تُحتسب الأرباح من الطلبات المسلّمة فقط.</p></div><div class="teacher-v154-actions"><button onclick="printTeacherStatement()">طباعة كشف الحساب</button><button class="secondary" onclick="teacherV154ExportFinance()">تصدير CSV</button></div></div><div class="teacher-v154-summary"><div class="teacher-v154-stat gold"><small>إجمالي الأرباح</small><b>${moneyv(summary.earned)} د.ع</b></div><div class="teacher-v154-stat"><small>أرباح هذا الشهر</small><b>${moneyv(summary.monthEarn)} د.ع</b></div><div class="teacher-v154-stat"><small>المبلغ المدفوع</small><b>${moneyv(summary.paid)} د.ع</b></div><div class="teacher-v154-stat gold"><small>الرصيد الحالي</small><b>${moneyv(summary.remaining)} د.ع</b></div></div><section><h3>كشف الأرباح</h3><div class="teacher-v154-ledger"><table class="teacher-v154-table"><thead><tr><th>رقم الطلب</th><th>الملزمة</th><th>التاريخ</th><th>ربح المدرس</th></tr></thead><tbody>${financeRows(d.id)}</tbody></table></div></section><section><h3>التسويات السابقة</h3><div class="teacher-v154-payouts">${payouts}</div></section></div>`;
  }

  function printTeacherStatement(){
    const d=data(),summary=teacherSummary(d.id);
    if(!window.checkoutBox||!window.checkoutModal)return false;
    window.checkoutBox.innerHTML=`<div class="receipt"><h2>كشف حساب المدرس</h2><p>${escv(d.teacher.name||window.current?.name||'المدرس')}</p><table><thead><tr><th>الطلب</th><th>التاريخ</th><th>الربح</th></tr></thead><tbody>${summary.rows.map(row=>`<tr><td>${escv(row.order_number||row.order_id)}</td><td>${dateOnly(row.settled_at||row.created_at)}</td><td>${moneyv(row.teacher||row.teacher_amount)} د.ع</td></tr>`).join('')||'<tr><td colspan="3">لا توجد حركات</td></tr>'}</tbody></table><h3>الإجمالي: ${moneyv(summary.earned)} د.ع</h3><h3>المدفوع: ${moneyv(summary.paid)} د.ع</h3><h3>المتبقي: ${moneyv(summary.remaining)} د.ع</h3></div><div class="row-actions no-print"><button onclick="window.print()">طباعة</button><button class="secondary" onclick="closeCheckout()">إغلاق</button></div>`;
    window.checkoutModal.classList.remove('hidden');return true;
  }

  function teacherV154ExportFinance(){
    const d=data(),summary=teacherSummary(d.id);
    const rows=[['رقم الطلب','التاريخ','ربح المدرس'],...summary.rows.map(row=>[row.order_number||row.order_id,dateOnly(row.settled_at||row.created_at),row.teacher||row.teacher_amount||0]),[],['الإجمالي',summary.earned],['المدفوع',summary.paid],['المتبقي',summary.remaining]];
    const csv='\ufeff'+rows.map(row=>row.map(value=>`"${String(value??'').replace(/"/g,'""')}"`).join(',')).join('\n');
    const link=document.createElement('a');link.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));link.download='teacher-finance.csv';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);
  }

  window.teacherAccountPaid=teacherAccountPaid;
  window.alinV67SumTeacherBalances=alinV67SumTeacherBalances;
  window.addTeacherPayoutPrompt=addTeacherPayoutPrompt;
  window.printTeacherStatement=printTeacherStatement;
  window.teacherV154FilterOrders=teacherV154FilterOrders;
  window.teacherV154ExportFinance=teacherV154ExportFinance;
  window.AlinTeacherModules.teacherAccountPaid=teacherAccountPaid;
  window.AlinTeacherModules.printTeacherStatement=printTeacherStatement;
  window.TeacherApp.registerTab('orders',renderOrders);
  window.TeacherApp.registerTab('finance',renderFinance);
  window.TeacherFinanceV154={renderOrders,renderFinance,data};
})();

;
/* modules/teacher/dashboard.js */
// === teacher/dashboard.js ===
/* ALIN v2.2.6 — teacher dashboard and booklets tabs. */
(function(){
  'use strict';
  const app=window.TeacherApp;
  if(!app)throw new Error('TeacherApp must load before teacher/dashboard.js');

  const escSafe=value=>typeof esc==='function'?esc(value):String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const moneySafe=value=>typeof money==='function'?money(value):Number(value||0).toLocaleString(window.AlinI18n?.locale?.()||'ar-IQ');
  const dateOnly=value=>String(value||'').slice(0,10);
  const monthOnly=value=>String(value||'').slice(0,7);
  const statusName=status=>({published:'منشورة',active:'منشورة',hidden:'مخفية',draft:'مسودة',pending:'قيد المراجعة',review:'قيد المراجعة',rejected:'مرفوضة',approved:'منشورة'}[String(status||'').toLowerCase()]||status||'غير محددة');
  const statusClass=status=>{
    const value=String(status||'').toLowerCase();
    if(['published','active','approved'].includes(value))return'published';
    if(['pending','review','new'].includes(value))return'pending';
    if(value==='rejected')return'rejected';
    return'hidden';
  };

  function paidAmount(context){
    return context.payouts.filter(row=>String(row.status||'').toLowerCase()==='paid').reduce((sum,row)=>sum+(+row.amount||0),0);
  }

  function renderChrome(context){
    const page=document.getElementById('teacherPage');
    const statsBox=document.getElementById('teacherStats');
    if(!page||!statsBox)return;
    let header=page.querySelector('.teacher-v148-head');
    if(!header){
      header=document.createElement('div');
      header.className='teacher-v148-head';
      page.insertBefore(header,statsBox);
    }
    const avatar=context.teacher.avatar_path||context.teacher.image_path||'';
    header.innerHTML=`<div><h1>أهلاً ${escSafe(context.teacher.name||window.current?.name||'أستاذنا')}</h1><p>تابع ملازمك ومبيعاتك وأرباحك من مكان واحد.</p></div><div class="teacher-v148-avatar">${avatar?`<img src="${escSafe(typeof mediaUrl==='function'?mediaUrl(avatar):avatar)}" alt="">`:'م'}</div>`;

    const today=new Date().toISOString().slice(0,10);
    const month=today.slice(0,7);
    const published=context.books.filter(book=>['published','active','approved'].includes(String(book.status||'').toLowerCase())).length;
    const pending=context.books.filter(book=>['pending','review','new','draft'].includes(String(book.status||'').toLowerCase())).length;
    const completed=context.orders.filter(order=>['delivered','completed','done','received'].includes(String(order.status||'').toLowerCase()));
    const daySales=completed.filter(order=>dateOnly(order.delivered_at||order.updated_at||order.created_at)===today).reduce((sum,order)=>sum+(+order.total||0),0);
    const monthSales=completed.filter(order=>monthOnly(order.delivered_at||order.updated_at||order.created_at)===month).reduce((sum,order)=>sum+(+order.total||0),0);
    const earned=context.ledger.reduce((sum,row)=>sum+(+row.teacher||0),0);
    const paid=paidAmount(context);
    statsBox.innerHTML=`<div><b>الملازم المنشورة</b><span>${published}</span></div><div><b>قيد المراجعة</b><span>${pending}</span></div><div><b>مبيعات اليوم</b><span>${moneySafe(daySales)} د.ع</span></div><div><b>مبيعات الشهر</b><span>${moneySafe(monthSales)} د.ع</span></div><div><b>الرصيد الحالي</b><span>${moneySafe(Math.max(0,earned-paid))} د.ع</span></div><div><b>المستلم سابقاً</b><span>${moneySafe(paid)} د.ع</span></div>`;
  }

  function renderDashboard(context){
    const host=document.getElementById('teacherContent');
    if(!host)return;
    const recent=context.orders.slice().sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))).slice(0,6);
    const notices=context.notifications.slice().sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))).slice(0,5);
    const orderHtml=recent.map(order=>`<div class="teacher-v148-order"><div><b>${escSafe(order.order_number||order.id)} — ${escSafe(order.title||'طلب ملزمة')}</b><small>${escSafe(statusName(order.status))} • ${+order.qty||1} نسخة • ${dateOnly(order.created_at)||'-'}</small></div><strong>${moneySafe(order.total)} د.ع</strong></div>`).join('')||'<div class="teacher-v148-empty">لا توجد طلبات حديثة.</div>';
    const noticeHtml=notices.map(row=>`<div class="teacher-v148-notice"><b>${escSafe(row.title||'إشعار')}</b><p>${escSafe(row.message||row.text||'')}</p></div>`).join('')||'<div class="teacher-v148-empty">لا توجد إشعارات جديدة.</div>';
    host.innerHTML=`<div class="teacher-v148-grid"><section class="teacher-v148-card"><div class="teacher-v148-card-head"><h3>آخر الطلبات</h3><button class="teacher-v148-link" onclick="teacherTab('orders')">عرض الكل</button></div><div class="teacher-v148-orders">${orderHtml}</div></section><aside class="teacher-v148-card"><div class="teacher-v148-card-head"><h3>آخر الإشعارات</h3><button class="teacher-v148-link" onclick="teacherTab('notifications')">عرض الكل</button></div><div class="teacher-v148-notices">${noticeHtml}</div></aside></div>`;
  }

  function renderBooklets(context){
    const host=document.getElementById('teacherContent');
    if(!host)return;
    const subjects=[...new Set(context.books.map(book=>book.subject).filter(Boolean))];
    const cards=context.books.map(book=>{
      const orders=context.orders.filter(order=>String(order.item_id)===String(book.id));
      const qty=orders.reduce((sum,order)=>sum+(+order.qty||0),0);
      const profit=context.ledger.filter(row=>String(row.item_id||row.booklet_id||'')===String(book.id)).reduce((sum,row)=>sum+(+row.teacher||0),0);
      const cover=book.cover_path||book.image_path||book.cover_url||'';
      return `<article class="teacher-v148-book" data-title="${escSafe((book.title||'').toLowerCase())}" data-status="${escSafe(statusClass(book.status))}" data-subject="${escSafe(book.subject||'')}"><div class="teacher-v148-cover">${cover?`<img src="${escSafe(typeof mediaUrl==='function'?mediaUrl(cover):cover)}" alt="${escSafe(book.title)}">`:'آلين'}</div><div class="teacher-v148-book-body"><span class="teacher-v148-status ${statusClass(book.status)}">${escSafe(statusName(book.status))}</span><h3>${escSafe(book.title)}</h3><div class="teacher-v148-meta"><span class="teacher-v148-chip">${escSafe(book.subject||'بدون مادة')}</span><span class="teacher-v148-chip">${escSafe(book.grade||'بدون صف')}</span></div><div class="teacher-v148-book-stats"><div><small>السعر</small><b>${moneySafe(book.price)} د.ع</b></div><div><small>المبيعات</small><b>${qty} نسخة</b></div><div><small>الأرباح</small><b>${moneySafe(profit)} د.ع</b></div></div><div class="teacher-v148-actions">${book.file_path?`<button onclick="openTeacherPdf('${escSafe(book.id)}')">عرض</button>`:''}${!book.teacher_approved&&!['published','active'].includes(String(book.status||'').toLowerCase())?`<button class="success" onclick="approveTeacherBooklet('${escSafe(book.id)}')">موافقة للنشر</button>`:''}<button class="secondary" onclick="teacherTab('requests')">طلب تحديث</button></div></div></article>`;
    }).join('')||'<div class="teacher-v148-empty">لا توجد ملازم مرتبطة بحسابك.</div>';
    host.innerHTML=`<section class="teacher-v148-card"><div class="teacher-v148-card-head"><h3>ملازمي</h3><button onclick="teacherTab('requests')">رفع طلب ملزمة</button></div><div class="teacher-v148-book-toolbar"><input id="teacherBookSearch" placeholder="ابحث باسم الملزمة" oninput="filterTeacherBooks()"><select id="teacherBookStatus" onchange="filterTeacherBooks()"><option value="">كل الحالات</option><option value="published">منشورة</option><option value="pending">قيد المراجعة</option><option value="hidden">مخفية/مسودة</option><option value="rejected">مرفوضة</option></select><select id="teacherBookSubject" onchange="filterTeacherBooks()"><option value="">كل المواد</option>${subjects.map(subject=>`<option>${escSafe(subject)}</option>`).join('')}</select></div><div id="teacherV148BookGrid" class="teacher-v148-book-grid">${cards}</div></section>`;
  }

  window.filterTeacherBooks=function(){
    const query=(document.getElementById('teacherBookSearch')?.value||'').trim().toLowerCase();
    const status=document.getElementById('teacherBookStatus')?.value||'';
    const subject=document.getElementById('teacherBookSubject')?.value||'';
    document.querySelectorAll('#teacherV148BookGrid .teacher-v148-book').forEach(card=>{
      card.hidden=Boolean((query&&!card.dataset.title.includes(query))||(status&&card.dataset.status!==status)||(subject&&card.dataset.subject!==subject));
    });
  };

  app.registerChrome(renderChrome);
  app.registerTab('dashboard',renderDashboard);
  app.registerTab('booklets',renderBooklets);
  window.TeacherDashboardV148={renderChrome,renderDashboard,renderBooklets};
})();

;
/* modules/teacher/publishing.js */
// === teacher/publishing.js ===
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
    preview.innerHTML=`<h4>معاينة الطلب</h4><div class="teacher-v150-preview-grid"><div><small>الملزمة</small><b>${escSafe(title)}</b></div><div><small>المادة</small><b>${escSafe(subject)}</b></div><div><small>الصف</small><b>${escSafe(grade)}</b></div><div><small>الفصل</small><b>${escSafe(chapter)}</b></div><div><small>الإصدار</small><b>${escSafe(year)}</b></div><div><small>السعر المقترح</small><b>${Number(price||0).toLocaleString(window.AlinI18n?.locale?.()||'ar-IQ')} د.ع</b></div></div>`;preview.classList.add('show');
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
  if(!window.TeacherApp)throw new Error('TeacherApp must load before teacher/publishing.js');
  window.TeacherApp.registerTab('requests',()=>renderPublishing());
  window.AlinTeacherModules=window.AlinTeacherModules||{};
  window.AlinTeacherModules.renderPublishingV150=renderPublishing;
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
    const s=String(r.status||'new').toLowerCase(),n=step(s),hist=parseHistory(r),note=r.admin_note||r.review_note||r.rejection_reason||'',created=r.created_at?new Date(r.created_at).toLocaleDateString(window.AlinI18n?.locale?.()||'ar-IQ'):'-';
    return `<article class="teacher-v152-card" data-title="${safeEsc((r.title||'')+' '+(r.subject||'')+' '+(r.grade||''))}" data-status="${safeEsc(s)}"><div class="teacher-v152-top"><div><h3>${safeEsc(r.title||'طلب ملزمة')}</h3><small>${safeEsc(r.subject||'بدون مادة')} • ${safeEsc(r.grade||'بدون صف')}</small></div><span class="teacher-v152-status ${statusClass(s)}">${safeEsc(label(s))}</span></div><div class="teacher-v152-meta"><span class="teacher-v152-chip">تاريخ الإرسال: ${safeEsc(created)}</span><span class="teacher-v152-chip">الإصدار: ${Math.max(1,hist.length+1)}</span>${r.source_file_name?`<span class="teacher-v152-chip">${safeEsc(r.source_file_name)}</span>`:''}</div><div class="teacher-v152-steps">${['الإرسال','المراجعة','التعديل','الموافقة','النشر'].map((x,i)=>`<span class="teacher-v152-step ${i+1<=n?'done':''}">${x}</span>`).join('')}</div>${note?`<div class="teacher-v152-note"><strong>ملاحظة الإدارة:</strong> ${safeEsc(note)}</div>`:''}${r.note?`<div class="teacher-v152-note"><strong>ملاحظتك:</strong> ${safeEsc(r.note)}</div>`:''}<div class="teacher-v152-actions">${r.source_file_path?`<button type="button" class="secondary" onclick="openTeacherRequestSource('${safeEsc(r.id)}')">مشاهدة النسخة الحالية</button>`:''}${canReupload(s)?`<button type="button" class="warning" onclick="alinV152ToggleReupload('${safeEsc(r.id)}')">رفع نسخة معدلة</button>`:''}${s==='approved'||s==='ready'?`<button type="button" class="success" disabled>بانتظار نشر الإدارة</button>`:''}</div>${canReupload(s)?`<div id="v152Reupload-${safeEsc(r.id)}" class="teacher-v152-upload-box hidden"><b>رفع نسخة Word معدلة</b><input id="v152File-${safeEsc(r.id)}" type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"><textarea id="v152Note-${safeEsc(r.id)}" placeholder="اكتب ما تم تعديله"></textarea><button type="button" onclick="alinV152Resubmit('${safeEsc(r.id)}')">إعادة الإرسال للإدارة</button></div>`:''}<details class="teacher-v152-history"><summary>سجل النسخ والمراجعات (${hist.length})</summary><div class="teacher-v152-history-list">${hist.length?hist.slice().reverse().map((h,i)=>`<div class="teacher-v152-history-item"><span>${safeEsc(h.file_name||h.status||'نسخة سابقة')}</span><span>${safeEsc(h.at?new Date(h.at).toLocaleString(window.AlinI18n?.locale?.()||'ar-IQ'):'')}</span></div>`).join(''):'<div class="teacher-v152-history-item"><span>لا يوجد سجل سابق</span></div>'}</div></details></article>`;
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
      const path=await uploadFile('teacher-requests',file,{type:'docx',required:true,ownerId:cur().id,entityId:id,maxBytes:20*1024*1024});const hist=parseHistory(r);hist.push({file_name:r.source_file_name||'',file_path:r.source_file_path||'',status:r.status||'',at:new Date().toISOString()});
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
  if(!window.TeacherApp)throw new Error('TeacherApp must load before teacher/publishing.js');
  window.TeacherApp.registerTab('review',()=>renderTeacherReview());
  window.TeacherApp.registerTab('publishing',()=>renderTeacherReview());
  window.TeacherApp.registerTab('publication',()=>renderTeacherReview());
  window.renderTeacherRequestsAdmin=renderAdminReview;
  window.AlinTeacherModules=window.AlinTeacherModules||{};
  window.AlinTeacherModules.renderTeacherRequestsAdmin=renderAdminReview;
  window.AlinTeacherModules.renderReviewV152=renderTeacherReview;
  window.AlinTeacherModules.renderAdminReviewV152=renderAdminReview;
})();


;

;
/* modules/teacher/notifications.js */
// === teacher/notifications.js ===
/* ALIN v2.0.2 — مركز إشعارات المدرس الموحد */
(function(){
  'use strict';

  const BUTTON_ID='teacherNotificationsTabV160';
  const BADGE_ID='teacherNotificationsBadgeV160';

  const array=value=>Array.isArray(value)?value:[];
  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[char]));

  function teacher(){
    try{
      if(typeof current!=='undefined'&&current?.role==='teacher')return current;
    }catch(_){ }
    return window.current?.role==='teacher'?window.current:null;
  }

  function host(){return document.getElementById('teacherContent')}
  function teacherId(){return String(teacher()?.id||'')}
  function storageKey(){return `alin_teacher_seen_notifications_${teacherId()||'guest'}`}

  function localSeen(){
    try{return new Set(JSON.parse(localStorage.getItem(storageKey())||'[]').map(String))}
    catch(_){return new Set()}
  }

  function saveLocalSeen(values){
    try{localStorage.setItem(storageKey(),JSON.stringify([...values]))}
    catch(error){console.warn('[ALIN teacher notifications] local state',error)}
  }

  function matchesTeacher(notification){
    const id=teacherId();
    if(!id||!notification)return false;
    if(['deleted','inactive','hidden'].includes(String(notification.status||'').toLowerCase()))return false;

    const role=String(notification.target_role||notification.audience||notification.role||'all').toLowerCase();
    const target=String(notification.target_id||notification.account_id||notification.teacher_id||'').trim();

    // إذا كان الإشعار موجهاً إلى حساب محدد فلا يظهر لبقية المدرسين.
    if(target)return target===id;
    return ['all','teacher','teachers'].includes(role);
  }

  function rows(){
    const serviceRows=window.AlinNotifications?.visible?.({role:'teacher',id:teacherId()});
    if(Array.isArray(serviceRows))return serviceRows;
    const unique=new Map();
    array(window.db?.notifications).forEach((notification,index)=>{
      if(!notification)return;
      const id=String(notification.id??`local-${index}`);
      if(!unique.has(id))unique.set(id,notification);
    });
    return [...unique.values()].filter(matchesTeacher).sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));
  }

  function isRead(notification,seen=localSeen()){
    if(window.AlinNotifications?.isRead)return window.AlinNotifications.isRead(notification,{role:'teacher',id:teacherId()});
    return Boolean(notification?.read_at)||seen.has(String(notification?.id));
  }

  function unreadCount(){
    const seen=localSeen();
    return rows().filter(notification=>!isRead(notification,seen)).length;
  }

  function icon(notification){
    const type=String(notification?.type||notification?.priority||notification?.category||'').toLowerCase();
    if(type.includes('sale')||type.includes('order'))return '🛍️';
    if(type.includes('settle')||type.includes('pay')||type.includes('finance'))return '💰';
    if(type.includes('reject'))return '❌';
    if(type.includes('approve')||type.includes('publish'))return '✅';
    if(type.includes('edit')||type.includes('review'))return '✏️';
    return '🔔';
  }

  function formatDate(value){
    if(!value)return 'بدون تاريخ';
    try{return new Intl.DateTimeFormat('ar-IQ',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value))}
    catch(_){return String(value)}
  }

  function ensureTab(){
    const tabs=document.querySelector('#teacherPage .teacher-tabs');
    if(!tabs)return null;

    const candidates=[...tabs.querySelectorAll('[data-teacher-tab="notifications"],.teacher-notifications-tab')];
    let button=document.getElementById(BUTTON_ID)||candidates[0]||null;
    candidates.forEach(candidate=>{if(candidate!==button)candidate.remove()});

    if(!button){
      button=document.createElement('button');
      const before=[...tabs.querySelectorAll('button')].find(item=>(item.getAttribute('onclick')||'').includes("'requests'"));
      tabs.insertBefore(button,before||null);
    }

    button.type='button';
    button.id=BUTTON_ID;
    button.dataset.teacherTab='notifications';
    button.classList.add('teacher-notifications-tab');
    button.setAttribute('onclick',"teacherTab('notifications')");
    button.innerHTML=`<span aria-hidden="true">🔔</span><span>الإشعارات</span><span id="${BADGE_ID}" class="teacher-v160-badge" hidden>0</span>`;
    button.hidden=false;
    return button;
  }

  function updateBadge(){
    const button=ensureTab();
    if(!button)return;
    const badge=button.querySelector(`#${BADGE_ID}`);
    const count=unreadCount();
    if(badge){badge.textContent=String(count);badge.hidden=count===0}
  }

  function setActive(){
    document.querySelectorAll('#teacherPage .teacher-tabs button').forEach(button=>{
      const target=button.dataset.teacherTab||((button.getAttribute('onclick')||'').match(/teacherTab\('([^']+)'\)/)||[])[1]||'';
      button.classList.toggle('active-teacher-tab',target==='notifications');
    });
  }

  function card(notification,seen){
    const read=isRead(notification,seen);
    const id=escapeHtml(notification.id??'');
    const title=escapeHtml(notification.title||'إشعار');
    const message=escapeHtml(notification.message||notification.text||'');
    const searchable=escapeHtml(`${notification.title||''} ${notification.message||notification.text||''}`.toLowerCase());
    return `<article class="teacher-v155-card ${read?'':'unread'}" data-notification-id="${id}" data-text="${searchable}" data-read="${read?'1':'0'}"><div class="teacher-v155-icon">${icon(notification)}</div><div><h3>${title}</h3><p>${message}</p><small>${escapeHtml(formatDate(notification.created_at))}</small></div><div class="teacher-v155-card-actions">${read?'':`<button type="button" onclick="TeacherNotifications.mark('${id}')">مقروء</button>`}<button type="button" class="secondary" onclick="TeacherNotifications.copy('${id}')">نسخ</button></div></article>`;
  }

  function render(){
    const container=host();
    if(!container)return false;

    const currentTeacher=teacher();
    if(!currentTeacher){
      container.innerHTML='<section class="teacher-v155-notifications"><div class="teacher-v155-empty">تعذر تحديد حساب المدرس.</div></section>';
      return false;
    }

    const notifications=rows();
    const seen=localSeen();
    const unread=notifications.filter(notification=>!isRead(notification,seen)).length;
    const today=new Date().toISOString().slice(0,10);
    const todayCount=notifications.filter(notification=>String(notification.created_at||'').slice(0,10)===today).length;

    container.innerHTML=`<section class="teacher-v155-notifications"><div class="teacher-v155-head"><div><h2>إشعاراتي</h2><p>تابع الموافقات والمبيعات والتسويات ورسائل الإدارة.</p></div><div class="teacher-v155-actions"><button type="button" onclick="TeacherNotifications.markAll()">تحديد الكل كمقروء</button><button type="button" class="secondary" onclick="TeacherNotifications.refresh()">تحديث</button></div></div><div class="teacher-v155-stats"><div class="teacher-v155-stat"><small>كل الإشعارات</small><b>${notifications.length}</b></div><div class="teacher-v155-stat"><small>غير المقروء</small><b>${unread}</b></div><div class="teacher-v155-stat"><small>اليوم</small><b>${todayCount}</b></div></div><div class="teacher-v155-toolbar"><input id="teacherNotificationSearch" placeholder="ابحث بعنوان الإشعار أو محتواه" oninput="TeacherNotifications.filter()"><select id="teacherNotificationFilter" onchange="TeacherNotifications.filter()"><option value="all">الكل</option><option value="unread">غير المقروء</option><option value="read">المقروء</option></select></div><div id="teacherNotificationList" class="teacher-v155-list">${notifications.map(notification=>card(notification,seen)).join('')||'<div class="teacher-v155-empty">لا توجد إشعارات حالياً.</div>'}</div></section>`;

    window.activeTeacherTab='notifications';
    setActive();
    updateBadge();
    return true;
  }

  async function mark(id){
    const notification=rows().find(item=>String(item.id)===String(id));
    if(!notification)return;
    if(window.AlinNotifications?.markRead)await window.AlinNotifications.markRead(id,{role:'teacher',id:teacherId()});
    else{
      const seen=localSeen();seen.add(String(id));saveLocalSeen(seen);
      notification.read_at=notification.read_at||new Date().toISOString();
    }
    render();
  }

  async function markAll(){
    if(window.AlinNotifications?.markAll)await window.AlinNotifications.markAll({role:'teacher',id:teacherId()});
    else{const seen=localSeen();rows().forEach(notification=>seen.add(String(notification.id)));saveLocalSeen(seen)}
    render();
  }

  function filter(){
    const query=(document.getElementById('teacherNotificationSearch')?.value||'').trim().toLowerCase();
    const mode=document.getElementById('teacherNotificationFilter')?.value||'all';
    document.querySelectorAll('#teacherNotificationList .teacher-v155-card').forEach(card=>{
      card.hidden=Boolean(
        (query&&!String(card.dataset.text||'').includes(query))||
        (mode==='unread'&&card.dataset.read==='1')||
        (mode==='read'&&card.dataset.read==='0')
      );
    });
  }

  async function copy(id){
    const notification=rows().find(item=>String(item.id)===String(id));
    if(!notification)return;
    const text=`${notification.title||'إشعار'}\n${notification.message||notification.text||''}`;
    try{
      await navigator.clipboard.writeText(text);
      if(typeof toast==='function')toast('تم نسخ الإشعار');
    }catch(_){ }
  }

  function refresh(){
    render();
    if(typeof toast==='function')toast('تم تحديث الإشعارات');
  }

  window.TeacherNotifications={render,mark,markAll,filter,copy,refresh,updateBadge,rows};
  // إبقاء الاسم السابق فقط للتوافق مع أي استدعاء قائم، بدون نظام إشعارات ثانٍ.
  window.TeacherV155=window.TeacherNotifications;

  if(!window.TeacherApp)throw new Error('TeacherApp must load before teacher/notifications.js');
  window.TeacherApp.registerTab('notifications',()=>render());
  window.AlinTeacherModules=window.AlinTeacherModules||{};
  window.AlinTeacherModules.renderNotifications=render;

  function init(){
    ensureTab();
    updateBadge();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();


;

;
/* modules/teacher/profile.js */
// === teacher/profile.js ===
/* ===== teacher/js/teacher-profile-v156.js ===== */
(function(){
  const escx=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const cur=()=>typeof current!=='undefined'?current:(window.current||{});
  const database=()=>typeof db!=='undefined'?db:(window.db||{});
  const teacher=()=>{
    const c=cur(),d=database();
    return (d.accounts?.teachers||[]).find(x=>String(x.id)===String(c.id))||c||{};
  };
  const avatarUrl=t=>{const p=t.avatar_path||t.avatar||t.photo||'';if(!p)return'';try{return typeof mediaUrl==='function'?mediaUrl(p):p}catch(_){return p}};
  function stats(){
    const c=cur(),d=database(),books=(d.booklets||[]).filter(x=>String(x.teacher_id)===String(c.id));
    const ids=new Set(books.map(x=>String(x.id))),orders=(d.orders||[]).filter(x=>x.kind==='booklet'&&ids.has(String(x.item_id)));
    return {books:books.length,orders:orders.length,sales:orders.reduce((a,x)=>a+(+x.qty||0),0)};
  }
  function render(){
    const host=document.getElementById('teacherContent');if(!host)return;
    const t=teacher(),s=stats(),avatar=avatarUrl(t),initial=(t.name||'م').trim().charAt(0)||'م';
    host.innerHTML=`<section class="teacher-v156-profile"><header class="teacher-v156-hero"><div class="teacher-v156-hero-info"><div class="teacher-v156-avatar">${avatar?`<img src="${escx(avatar)}" alt="صورة المدرس">`:escx(initial)}</div><div><h2>${escx(t.name||'ملف المدرس')}</h2><p>${escx(t.specialty||'مدرس في منصة آلين')}</p></div></div><span class="teacher-v156-status">الحساب فعال</span></header><div class="teacher-v156-grid"><article class="teacher-v156-card"><h3>البيانات الشخصية</h3><div class="teacher-v156-form"><div class="teacher-v156-field"><label>الاسم</label><input value="${escx(t.name||'')}" disabled></div><div class="teacher-v156-field"><label>اسم الدخول</label><input id="v156Username" value="${escx(t.username||'')}" disabled title="يُغيّر اسم الدخول من الإدارة الآمنة"></div><div class="teacher-v156-field"><label>رقم الهاتف</label><input id="v156Phone" value="${escx(t.phone||t.mobile||'')}" placeholder="07xxxxxxxxx"></div><div class="teacher-v156-field"><label>المنطقة</label><input id="v156Area" value="${escx(t.area||'')}" placeholder="المنطقة"></div><div class="teacher-v156-field full"><label>الاختصاص</label><input id="v156Specialty" value="${escx(t.specialty||'')}" placeholder="مثال: مدرس رياضيات"></div><div class="teacher-v156-field full"><label>نبذة قصيرة</label><textarea id="v156Bio" placeholder="نبذة تظهر في ملفك">${escx(t.bio||'')}</textarea></div><div class="teacher-v156-field full"><label>الصورة الشخصية</label><div class="teacher-v156-upload"><div id="v156AvatarPreview" class="teacher-v156-upload-preview">${avatar?`<img src="${escx(avatar)}" alt="">`:'📷'}</div><input id="v156Avatar" type="file" accept="image/png,image/jpeg,image/webp" onchange="v156PreviewAvatar(this)"></div></div></div><div class="teacher-v156-actions"><button class="teacher-v156-save" onclick="v156SaveTeacherProfile()">حفظ التعديلات</button></div></article><aside class="teacher-v156-card"><h3>ملخص الحساب</h3><div class="teacher-v156-stat-list"><div class="teacher-v156-stat"><span>الملازم</span><b>${s.books}</b></div><div class="teacher-v156-stat"><span>الطلبات</span><b>${s.orders}</b></div><div class="teacher-v156-stat"><span>النسخ المباعة</span><b>${s.sales}</b></div></div><h3 style="margin-top:20px">الأمان</h3><div class="teacher-v156-security"><input id="v156NewPassword" type="password" placeholder="كلمة المرور الجديدة"><input id="v156ConfirmPassword" type="password" placeholder="تأكيد كلمة المرور"><button onclick="v156ChangeTeacherPassword()">تغيير كلمة المرور</button></div><div class="teacher-v156-note">اسم المدرس وربط الملازم يبقى من صلاحية الإدارة، بينما تستطيع تعديل بيانات التواصل والصورة وكلمة المرور.</div><div class="teacher-v156-danger"><button onclick="logout()">تسجيل الخروج</button></div></aside></div></section>`;
  }
  window.v156PreviewAvatar=function(input){const f=input?.files?.[0],box=document.getElementById('v156AvatarPreview');if(!f||!box)return;if(!/^image\/(png|jpeg|webp)$/.test(f.type))return alert('اختر صورة PNG أو JPG أو WEBP');const r=new FileReader();r.onload=()=>box.innerHTML=`<img src="${r.result}" alt="معاينة">`;r.readAsDataURL(f)};
  window.v156SaveTeacherProfile=async function(){
    const c=cur(),t=teacher();if(!c?.id)return alert('تعذر تحديد حساب المدرس');
    const payload={phone:document.getElementById('v156Phone')?.value.trim()||'',area:document.getElementById('v156Area')?.value.trim()||'',specialty:document.getElementById('v156Specialty')?.value.trim()||'',bio:document.getElementById('v156Bio')?.value.trim()||'',updated_at:new Date().toISOString()};
    try{
      const file=document.getElementById('v156Avatar')?.files?.[0];if(file)payload.avatar_path=await uploadFile('teachers',file,{type:'image'});
      await update('accounts',payload,{id:c.id});if(typeof audit==='function')await audit('teacher_profile','تحديث ملف المدرس');if(typeof load==='function')await load();
      if(typeof current!=='undefined')current.name=t.name||current.name;
      if(typeof toast==='function')toast('تم حفظ الملف الشخصي');render();
    }catch(e){alert('تعذر حفظ الملف: '+e.message)}
  };
  window.v156ChangeTeacherPassword=async function(){
    const c=cur(),p=document.getElementById('v156NewPassword')?.value||'',p2=document.getElementById('v156ConfirmPassword')?.value||'';
    if(p.length<4)return alert('كلمة المرور يجب أن تكون 4 أحرف أو أرقام على الأقل');if(p!==p2)return alert('كلمتا المرور غير متطابقتين');
    try{const client=window.sb||(window.AlinCloud&&window.AlinCloud.client?.());if(!client?.auth)throw new Error('خدمة الدخول الآمن غير متاحة');const {error}=await client.auth.updateUser({password:p});if(error)throw error;if(typeof audit==='function')await audit('teacher_security','تغيير كلمة مرور المدرس');document.getElementById('v156NewPassword').value='';document.getElementById('v156ConfirmPassword').value='';if(typeof toast==='function')toast('تم تغيير كلمة المرور')}catch(e){alert('تعذر تغيير كلمة المرور: '+e.message)}
  };
  if(!window.TeacherApp)throw new Error('TeacherApp must load before teacher/profile.js');
  window.TeacherApp.registerTab('profile',()=>render());
  window.AlinTeacherModules=window.AlinTeacherModules||{};
  window.AlinTeacherModules.renderProfile=render;
  window.renderTeacherProfileV156=render;
})();


;

;
/* modules/library/dashboard.js */
// === library/dashboard.js ===
/* ALIN v2.0.9 — single library entry and dashboard runtime. */
(function(){
  'use strict';
  window.AlinLibraryModules=window.AlinLibraryModules||{};

  function openLibraryJoinPortal(){
    try{
      window.pendingRole='library';
      if(typeof window.showLogin!=='function')throw new Error('login unavailable');
      window.showLogin('library');
      document.getElementById('login')?.classList.remove('hidden');
      document.getElementById('app')?.classList.add('hidden');
      document.getElementById('loginForm')?.classList.remove('hidden');
      const user=document.getElementById('loginU');
      const pass=document.getElementById('loginPass');
      const msg=document.getElementById('loginMsg');
      if(user){user.placeholder='اسم دخول المكتبة';setTimeout(()=>user.focus(),0)}
      if(pass)pass.placeholder='الرمز السري للمكتبة';
      if(msg){msg.textContent='دخول المكتبة';msg.dataset.role='library'}
    }catch(error){
      console.error('[ALIN library entry]',error);
      alert('تعذر فتح دخول المكتبة. حدّث الصفحة وحاول مرة أخرى.');
    }
  }

  function showLibraryPage(){
    if(window.current?.role!=='library')return false;
    const login=document.getElementById('login');
    const app=document.getElementById('app');
    const page=document.getElementById('libraryPage');
    if(!app||!page)return false;
    login?.classList.add('hidden');
    app.classList.remove('hidden','store-mode');
    document.querySelectorAll('.page').forEach(node=>node.classList.add('hidden'));
    page.classList.remove('hidden');
    const nav=document.getElementById('activeNav');
    if(nav)nav.innerHTML='<button type="button">المكتبة</button>';
    requestAnimationFrame(()=>window.AlinLibraryModules.renderLibrary?.());
    return true;
  }

  window.openLibraryJoinPortal=openLibraryJoinPortal;
  window.AlinLibraryModules.openLibraryJoinPortal=openLibraryJoinPortal;
  window.AlinLibraryModules.showLibraryPage=showLibraryPage;
  window.addEventListener('alin:auth-restored',event=>{
    if(event.detail?.account?.role==='library')showLibraryPage();
  });
  window.addEventListener('alin:data-refreshed',()=>{
    if(window.current?.role==='library')window.AlinLibraryModules.renderLibrary?.();
  });
})();

/* ===== library/js/library-dashboard-v116.js ===== */
/* ALIN v2.0.9 - organized library dashboard */
(function(){
  window.AlinLibraryModules=window.AlinLibraryModules||{};
  const state={tab:'home',filter:'all',search:''};
  const arr=v=>Array.isArray(v)?v:[];
  const eq=(a,b)=>String(a??'')===String(b??'');
  const escx=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const moneyx=v=>typeof money==='function'?money(v):Number(v||0).toLocaleString(window.AlinI18n?.locale?.()||'ar-IQ');
  const currentUser=()=>window.current||null;
  const dbx=()=>window.db||{accounts:{libraries:[]},orders:[],ledger:[],notifications:[]};
  function getLibrary(){
    const c=currentUser(); if(c?.role!=='library') return null;
    const libs=arr(dbx().accounts?.libraries); const ids=[c.id,c.library_id,c.account_id,c.user_id].filter(Boolean);
    return libs.find(x=>ids.some(id=>eq(x.id,id)||eq(x.account_id,id)||eq(x.user_id,id)))||libs.find(x=>c.username&&eq(x.username,c.username))||libs.find(x=>c.name&&eq(x.name,c.name))||null;
  }
  function libId(){const l=getLibrary(),c=currentUser();return String(l?.id||c?.library_id||c?.id||'')}
  function orders(){const id=libId();return arr(dbx().orders).filter(o=>eq(o.library_id,id)||eq(o.pickup_library_id,id)||eq(o.assigned_library_id,id))}
  function statusKey(o){const s=String(o?.status||'new');if(['pending','new'].includes(s))return'new';if(['processing','printing','accepted'].includes(s))return'processing';if(s==='ready')return'ready';if(['completed','delivered'].includes(s))return'completed';if(['cancelled','canceled'].includes(s))return'cancelled';return s}
  function statusLabel(s){return({new:'جديد',processing:'قيد الطباعة',ready:'جاهز',completed:'تم التسليم',cancelled:'ملغي'})[s]||s}
  function isOpen(lib){return !(lib?.is_open===false||String(lib?.is_open)==='false'||lib?.open_status==='closed'||lib?.status==='closed')}
  function ledger(){const id=libId();return arr(dbx().ledger).filter(x=>eq(x.library_id,id))}
  function financeSummary(){return window.AlinV120Finance?.summary?.(libId())||{gross:0,libraryProfit:0,debtTotal:0,settled:0,debtRemaining:0,monthProfit:0,rows:[],settlements:[]}}
  function due(){return financeSummary().debtRemaining}
  function todayCount(){const d=new Date().toISOString().slice(0,10);return orders().filter(o=>statusKey(o)==='completed'&&String(o.updated_at||o.created_at||'').slice(0,10)===d).length}
  function notifications(){return window.AlinNotifications?.visible?.({role:'library',id:libId()})||arr(dbx().notifications).filter(n=>n.status!=='inactive'&&((n.target_id||n.library_id)?eq(n.target_id||n.library_id,libId()):['all','library'].includes(n.target_role||n.audience))) }
  function updateHeader(){
    const lib=getLibrary(),name=document.getElementById('libraryV116Name'),loc=document.getElementById('libraryV116Location'),status=document.getElementById('libraryV116Status');
    if(name)name.textContent=lib?.name||currentUser()?.name||'المكتبة';
    if(loc)loc.textContent=[lib?.area,lib?.landmark].filter(Boolean).join(' — ')||'إدارة الطلبات والطباعة والتسليم';
    if(status){const open=isOpen(lib);status.innerHTML=`<div class="library-v116-status-card ${open?'open':'closed'}"><span class="library-v116-status-dot"></span><div><b>${open?'المكتبة مفتوحة':'المكتبة مغلقة'}</b><small>${open?'تستقبل طلبات جديدة':'لا تستقبل طلبات جديدة'}</small></div><button type="button" onclick="AlinLibraryV116.toggleOpen()">${open?'إغلاق':'فتح'}</button></div>`}
    const ob=document.getElementById('libraryV116OrdersBadge'),nb=document.getElementById('libraryV116NotifyBadge');
    const oc=orders().filter(o=>statusKey(o)==='new').length,nc=window.AlinNotifications?.unreadCount?.({role:'library',id:libId()})??notifications().filter(n=>!(n.read_at||n.is_read)).length;
    if(ob){ob.textContent=oc;ob.hidden=!oc} if(nb){nb.textContent=nc;nb.hidden=!nc}
  }
  function statsHtml(){const os=orders();return `<section class="library-v116-stats"><article class="library-v116-stat"><small>طلبات جديدة</small><strong>${os.filter(o=>statusKey(o)==='new').length}</strong></article><article class="library-v116-stat"><small>قيد الطباعة</small><strong>${os.filter(o=>statusKey(o)==='processing').length}</strong></article><article class="library-v116-stat"><small>جاهزة للتسليم</small><strong>${os.filter(o=>statusKey(o)==='ready').length}</strong></article><article class="library-v116-stat"><small>تسليمات اليوم</small><strong>${todayCount()}</strong></article><article class="library-v116-stat"><small>طلبات ملغاة</small><strong>${os.filter(o=>statusKey(o)==='cancelled').length}</strong></article><article class="library-v116-stat accent"><small>المبلغ بذمة المكتبة</small><strong>${moneyx(due())} د.ع</strong></article></section>`}
  function orderCard(o){const s=statusKey(o);return `<article class="library-v116-order"><div><div style="display:flex;justify-content:space-between;gap:10px;align-items:center"><h4>${escx(o.order_number||o.id)} — ${escx(o.title||'طلب')}</h4><span class="library-v116-status ${s}">${statusLabel(s)}</span></div><p>${escx(o.student_name||'بدون اسم')} • ${escx(o.student_phone||'بدون رقم')} • الكمية ${o.qty||1}</p><div class="library-v116-order-meta"><span class="library-v116-chip">${o.kind==='booklet'?'ملزمة':'منتج'}</span><span class="library-v116-chip">${moneyx(o.total||0)} د.ع</span><span class="library-v116-chip">${escx(o.fulfillment_type==='delivery'?'توصيل':'استلام من المكتبة')}</span></div></div><div class="library-v116-actions"><button class="secondary" onclick="AlinLibraryV116.details('${escx(o.id)}')">التفاصيل</button>${o.kind==='booklet'&&!['completed','cancelled'].includes(s)?`<button onclick="openLibraryBookletPdf('${escx(o.id)}')">طباعة</button>`:''}${s==='new'?`<button onclick="AlinLibraryV116.setStatus('${escx(o.id)}','processing')">بدء الطباعة</button>`:''}${s==='processing'?`<button onclick="AlinLibraryV116.setStatus('${escx(o.id)}','ready')">جاهز للتسليم</button>`:''}${s==='ready'?`<button class="success" onclick="AlinLibraryV116.setStatus('${escx(o.id)}','completed')">تم التسليم</button>`:''}${!['completed','cancelled'].includes(s)?`<button class="danger" onclick="AlinLibraryV116.cancel('${escx(o.id)}')">إلغاء</button>`:''}</div></article>`}
  function home(){const os=orders().filter(o=>!['completed','cancelled'].includes(statusKey(o))).slice(0,5);return `${statsHtml()}<section class="library-v116-grid"><div class="library-v116-panel"><h3>آخر الطلبات التي تحتاج إجراء</h3><div class="library-v116-order-list">${os.map(orderCard).join('')||'<div class="library-v116-empty">لا توجد طلبات تحتاج إجراء حالياً</div>'}</div></div><aside class="library-v116-panel"><h3>ملخص اليوم</h3><div class="library-v116-list"><div class="library-v116-row"><div><b>الطلبات الجاهزة</b><small>بانتظار استلام الطالب</small></div><span>${orders().filter(o=>statusKey(o)==='ready').length}</span></div><div class="library-v116-row"><div><b>تم التسليم اليوم</b><small>طلبات مكتملة اليوم</small></div><span>${todayCount()}</span></div><div class="library-v116-row"><div><b>المبلغ المطلوب تسليمه</b><small>حصة المنصة والمدرس بعد خصم ربح المكتبة</small></div><span class="library-v116-money debt">${moneyx(due())} د.ع</span></div></div></aside></section>`}
  function ordersView(){let list=orders();if(state.filter!=='all')list=list.filter(o=>statusKey(o)===state.filter);const q=state.search.trim().toLowerCase();if(q)list=list.filter(o=>[o.order_number,o.id,o.title,o.student_name,o.student_phone].some(v=>String(v||'').toLowerCase().includes(q)));return `<section class="library-v116-panel"><div class="library-v116-toolbar"><input id="libraryV116Search" value="${escx(state.search)}" placeholder="ابحث برقم الطلب أو اسم الطالب" oninput="AlinLibraryV116.search(this.value)"><div class="library-v116-filter-row">${[['all','الكل'],['new','جديد'],['processing','قيد الطباعة'],['ready','جاهز'],['completed','تم التسليم'],['cancelled','ملغي']].map(([k,l])=>`<button class="${state.filter===k?'active':''}" onclick="AlinLibraryV116.filter('${k}')">${l}</button>`).join('')}</div></div><div class="library-v116-order-list">${list.map(orderCard).join('')||'<div class="library-v116-empty">لا توجد طلبات مطابقة</div>'}</div></section>`}
  function financeView(){
    const f=financeSummary();
    const movements=f.rows.slice(0,30).map(x=>`<div class="library-v120-movement"><div><b>${escx(x.order_number||x.order_id)}</b><small>${escx(x.title||'طلب مكتمل')} — استلمت المكتبة ${moneyx(x.gross)} د.ع</small></div><div class="library-v120-split"><span class="profit">ربح المكتبة +${moneyx(x.libraryProfit)} د.ع</span><span class="debt">بذمة المكتبة ${moneyx(x.debt)} د.ع</span></div></div>`).join('')||'<div class="library-v116-empty">لا توجد حركات مالية بعد</div>';
    const settlements=f.settlements.slice(0,15).map(x=>`<div class="library-v116-row"><div><b>${escx(x.receipt_number||x.id||'تسوية')}</b><small>${escx(x.created_at||'')} — ${escx(x.payment_method||'')}</small></div><span class="library-v116-money settled">-${moneyx(x.amount)} د.ع</span></div>`).join('')||'<div class="library-v116-empty">لا توجد تسويات مثبتة بعد</div>';
    return `<section class="library-v120-finance-cards"><article><small>إجمالي المبالغ المستلمة من الطلبات</small><strong>${moneyx(f.gross)} د.ع</strong></article><article class="profit"><small>أرباح المكتبة المتراكمة</small><strong>${moneyx(f.libraryProfit)} د.ع</strong></article><article><small>أرباح هذا الشهر</small><strong>${moneyx(f.monthProfit)} د.ع</strong></article><article class="debt"><small>المبلغ بذمة المكتبة</small><strong>${moneyx(f.debtRemaining)} د.ع</strong></article><article class="settled"><small>المبالغ المسددة للمدير</small><strong>${moneyx(f.settled)} د.ع</strong></article></section><section class="library-v116-grid library-v120-grid"><div class="library-v116-panel"><h3>تفاصيل الطلبات المالية</h3><p class="library-v120-help">عند تسليم الطلب يُثبت ربح المكتبة، ويُسجل باقي المبلغ بذمتها لحين تصفية المدير.</p><div class="library-v120-movements">${movements}</div></div><aside class="library-v116-panel"><h3>التسويات مع الإدارة</h3><div class="library-v120-debt-box"><small>المطلوب تسليمه حالياً</small><strong>${moneyx(f.debtRemaining)} د.ع</strong><span>إجمالي الذمة ${moneyx(f.debtTotal)} د.ع — المسدد ${moneyx(f.settled)} د.ع</span></div><div class="library-v116-list">${settlements}</div><div class="library-v116-note" style="margin-top:12px">التصفية يثبتها المدير فقط. بعد تسجيل كامل المبلغ تصبح الذمة صفراً، وتبقى أرباح المكتبة وسجل الحركات محفوظة.</div></aside></section>`
  }
  function notificationsView(){const ns=notifications();return `<section class="library-v116-panel"><div class="library-v116-toolbar"><h3>إشعارات المكتبة</h3><button onclick="AlinLibraryV116.markAllRead()">تحديد الكل كمقروء</button></div><div class="library-v116-list">${ns.map(n=>{const read=window.AlinNotifications?.isRead?.(n,{role:'library',id:libId()})??Boolean(n.read_at||n.is_read);return `<article class="library-v116-notification ${read?'':'unread'}"><b>${escx(n.title||'إشعار')}</b><p>${escx(n.message||n.text||'')}</p><small>${escx(n.created_at||'')}</small></article>`}).join('')||'<div class="library-v116-empty">لا توجد إشعارات</div>'}</div></section>`}
  function settingsView(){const l=getLibrary()||{};return `<section class="library-v116-panel"><h3>إعدادات المكتبة</h3><div class="library-v116-settings"><div class="library-v116-field"><small>اسم المكتبة</small><b>${escx(l.name||'—')}</b></div><div class="library-v116-field"><small>المنطقة</small><b>${escx(l.area||'—')}</b></div><div class="library-v116-field"><small>أقرب نقطة دالة</small><b>${escx(l.landmark||'—')}</b></div><div class="library-v116-field"><small>واتساب</small><b>${escx(l.whatsapp||l.phone||'—')}</b></div><div class="library-v116-field"><small>اسم الدخول</small><b>${escx(l.username||currentUser()?.username||'—')}</b></div><div class="library-v116-field"><small>حالة المكتبة</small><b>${isOpen(l)?'مفتوحة':'مغلقة'}</b></div><div class="library-v116-settings-actions"><button onclick="AlinLibraryV116.toggleOpen()">${isOpen(l)?'إغلاق المكتبة':'فتح المكتبة'}</button><button class="secondary" onclick="alert('تغيير كلمة المرور يكون من إدارة الحسابات حالياً')">تغيير كلمة المرور</button><button class="logout" onclick="logout()">تسجيل الخروج</button></div></div></section>`}
  function render(){if(currentUser()?.role!=='library')return;updateHeader();document.querySelectorAll('.library-v116-tabs button').forEach(b=>b.classList.toggle('active',b.dataset.libraryTab===state.tab));const c=document.getElementById('libraryV116Content');if(!c)return;c.innerHTML=state.tab==='orders'?ordersView():state.tab==='finance'?financeView():state.tab==='notifications'?notificationsView():state.tab==='settings'?settingsView():home()}
  async function toggleOpen(){
    const lib=getLibrary();if(!lib)return alert('تعذر تحديد حساب المكتبة');
    const open=!isOpen(lib);
    try{
      const client=window.ALINAuthRuntime?.client?.()||window.sb||window.AlinCloud?.client?.()||null;
      if(!client?.rpc)throw new Error('خدمة Supabase غير متاحة. سجل الدخول من جديد وحاول مرة أخرى.');
      const {data,error}=await client.rpc('alin_set_library_open',{p_open:open});
      if(error){
        const message=String(error.message||'');
        if(/alin_set_library_open|function .* does not exist|schema cache/i.test(message))throw new Error('خدمة حالة المكتبة غير محدثة. نفّذ ملف LIBRARY_FINANCE_STATUS_FIX_v2_4_2_R6.sql.');
        throw error;
      }
      if(!data?.ok)throw new Error('لم يؤكد الخادم تحديث حالة المكتبة');
      const updated=data.library||{};
      Object.assign(lib,updated,{is_open:open,open_status:open?'open':'closed'});
      if(typeof audit==='function')await audit('library',open?'فتح المكتبة':'إغلاق المكتبة');
      if(typeof load==='function')await load({force:true,reason:'library-open-status'});
      render();
      if(typeof toast==='function')toast(open?'تم فتح المكتبة واستقبال الطلبات':'تم إغلاق المكتبة وإيقاف الطلبات الجديدة');
    }catch(e){console.error(e);alert(e?.message||'تعذر تحديث حالة المكتبة')}
  }
  async function setStatus(id,status){
    try{
      const action=window.AlinLibraryModules?.libraryOrderStatus||window.libraryOrderStatus;
      if(typeof action!=='function')throw new Error('خدمة تحديث الطلب غير جاهزة');
      await action(id,status);
      render();
    }catch(error){console.error(error);alert(error?.message||'تعذر تحديث حالة الطلب')}
  }
  async function cancel(id){
    const reason=prompt('اكتب سبب الإلغاء');
    if(!reason)return;
    try{
      const action=window.AlinLibraryModules?.cancelLibraryOrder||window.cancelLibraryOrder;
      if(typeof action!=='function')throw new Error('خدمة إلغاء الطلب غير جاهزة');
      await action(id,reason);
      render();
    }catch(error){console.error(error);alert(error?.message||'تعذر إلغاء الطلب')}
  }
  function details(id){const o=orders().find(x=>eq(x.id,id));if(!o)return;const html=`<h2>تفاصيل الطلب</h2><div class="library-v116-list"><div class="library-v116-row"><b>رقم الطلب</b><span>${escx(o.order_number||o.id)}</span></div><div class="library-v116-row"><b>الطالب</b><span>${escx(o.student_name||'—')}</span></div><div class="library-v116-row"><b>الهاتف</b><span>${escx(o.student_phone||'—')}</span></div><div class="library-v116-row"><b>الطلب</b><span>${escx(o.title||'—')}</span></div><div class="library-v116-row"><b>الكمية</b><span>${o.qty||1}</span></div><div class="library-v116-row"><b>المبلغ</b><span>${moneyx(o.total||0)} د.ع</span></div><div class="library-v116-row"><b>الملاحظات</b><span>${escx(o.notes||o.note||'لا توجد')}</span></div></div>`;if(window.checkoutBox&&window.checkoutModal){checkoutBox.innerHTML=html;checkoutModal.classList.remove('hidden')}}
  async function markAllRead(){if(window.AlinNotifications?.markAll)await window.AlinNotifications.markAll({role:'library',id:libId()});else notifications().forEach(n=>n.read_at=n.read_at||new Date().toISOString());render()}
  window.AlinLibraryV116={render,toggleOpen,setStatus,cancel,details,filter:k=>{state.filter=k;render()},search:q=>{state.search=q;render()},markAllRead};
  window.renderLibrary=render;window.AlinLibraryModules.renderLibrary=render;window.setLibraryOpen=toggleOpen;window.AlinLibraryModules.setLibraryOpen=toggleOpen;
  document.addEventListener('click',e=>{const b=e.target.closest('[data-library-tab]');if(!b)return;state.tab=b.dataset.libraryTab;render()});
  const boot=()=>{if(currentUser()?.role==='library')setTimeout(render,20)};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();


;

;
/* modules/library/orders.js */
// === library/orders.js ===
/* ALIN v2.8.0 Stage 5 — atomic library workflow and finance RPC. */
(function(){
  'use strict';
  const modules=window.AlinLibraryModules=window.AlinLibraryModules||{};
  const allowed={
    new:['processing','cancelled'],
    pending:['processing','cancelled'],
    pending_admin:['processing','cancelled'],
    accepted:['processing','cancelled'],
    processing:['ready','cancelled'],
    printing:['ready','cancelled'],
    ready:['completed','delivered','cancelled'],
    completed:[],
    delivered:[],
    cancelled:[],
    canceled:[]
  };
  const normalize=status=>String(status||'new').toLowerCase()==='canceled'?'cancelled':String(status||'new').toLowerCase();
  const client=()=>window.ALINAuthRuntime?.client?.()||window.sb||window.AlinCloud?.client?.()||null;

  function findOrder(id){return (window.db?.orders||[]).find(row=>String(row.id)===String(id));}
  function currentLibraryId(){return String(window.current?.role==='library'?(window.current.id||window.current.library_id||''):'');}
  function orderLibraryId(order){return String(order?.library_id||order?.pickup_library_id||order?.assigned_library_id||'');}
  function ownsOrder(order){
    const id=currentLibraryId();
    if(!id)return false;
    return [order?.library_id,order?.pickup_library_id,order?.assigned_library_id].some(value=>String(value||'')===id);
  }
  function canMove(from,to){
    const source=normalize(from),target=normalize(to);
    return source===target||Boolean(allowed[source]?.includes(target));
  }
  function serviceError(error){
    const message=String(error?.message||error||'').trim();
    if(/alin_order_transition_atomic|function .* does not exist|schema cache/i.test(message)){
      return new Error('خدمة الطلبات والحسابات غير محدثة. نفّذ ملف المرحلة الخامسة ثم حدّث الصفحة.');
    }
    return error instanceof Error?error:new Error(message||'تعذر تحديث الطلب');
  }

  async function callOrderRpc(order,target,reason=''){
    const c=client();
    if(!c?.rpc)throw new Error('خدمة Supabase غير متاحة. تحقق من الاتصال وسجل الدخول من جديد.');
    const {data,error}=await c.rpc('alin_library_set_order_status',{
      p_order_id:String(order.id),
      p_status:target,
      p_reason:reason||null
    });
    if(error)throw serviceError(error);
    if(!data?.ok)throw new Error('لم يؤكد الخادم تحديث الطلب');
    if(data.order&&typeof data.order==='object')Object.assign(order,data.order);
    else Object.assign(order,{status:target,updated_at:new Date().toISOString()});
    return data;
  }

  async function libraryOrderStatus(id,status){
    const order=findOrder(id);
    if(!order)throw new Error('الطلب غير موجود');
    if(window.current?.role==='library'&&!ownsOrder(order))throw new Error('هذا الطلب غير مسند إلى مكتبتك');
    const target=normalize(status),source=normalize(order.status);
    if(!canMove(source,target))throw new Error('لا يمكن نقل الطلب من '+source+' إلى '+target);
    if(source===target)return order;

    await callOrderRpc(order,target);
    if(typeof audit==='function')await audit('order',`المكتبة حدثت الطلب ${order.order_number||order.id} من ${source} إلى ${target}`);
    if(typeof load==='function')await load({force:true,reason:'library-order-status'});
    else modules.renderLibrary?.();
    return order;
  }

  async function cancelLibraryOrder(id,reason){
    const text=String(reason||'').trim();
    if(!text)throw new Error('اكتب سبب الإلغاء');
    const order=findOrder(id);
    if(!order)throw new Error('الطلب غير موجود');
    if(window.current?.role==='library'&&!ownsOrder(order))throw new Error('هذا الطلب غير مسند إلى مكتبتك');
    await callOrderRpc(order,'cancelled',text);
    if(typeof audit==='function')await audit('order',`المكتبة ألغت الطلب ${order.order_number||order.id}: ${text}`);
    if(typeof load==='function')await load({force:true,reason:'library-order-cancel'});
    else modules.renderLibrary?.();
    return order;
  }

  function selectedLibraryLine(){
    const select=document.getElementById('libSelect');
    const info=document.getElementById('libInfo');
    if(!select||!info)return;
    const library=(window.db?.accounts?.libraries||[]).find(row=>String(row.id)===String(select.value));
    if(!library){info.innerHTML='';return;}
    const open=typeof libIsOpen==='function'?libIsOpen(library):library.is_open!==false;
    const escape=value=>typeof esc==='function'?esc(value):String(value??'');
    info.innerHTML=`<div class="library-one-line"><b>${escape(library.name)}</b><span class="${open?'open-badge':'closed-badge'}">${open?'مفتوح':'مغلق'}</span><small>${escape(library.area||'')}${library.landmark?' — '+escape(library.landmark):''}</small></div>`;
  }

  function alinLibraryOptions(){
    const libraries=typeof alinOpenLibraries==='function'?alinOpenLibraries():(window.db?.accounts?.libraries||[]).filter(row=>row.status!=='disabled'&&row.is_open!==false);
    const escape=value=>typeof esc==='function'?esc(value):String(value??'');
    return libraries.map(row=>`<option value="${escape(row.id)}">${escape(row.name)} - مفتوح</option>`).join('');
  }

  window.libraryOrderStatus=libraryOrderStatus;
  window.cancelLibraryOrder=cancelLibraryOrder;
  window.selectedLibraryLine=selectedLibraryLine;
  window.alinLibraryOptions=alinLibraryOptions;
  window.AlinLibraryOrderService=Object.freeze({libraryOrderStatus,cancelLibraryOrder,callOrderRpc,orderLibraryId});
  modules.libraryOrderStatus=libraryOrderStatus;
  modules.cancelLibraryOrder=cancelLibraryOrder;
  modules.selectedLibraryLine=selectedLibraryLine;
  modules.alinLibraryOptions=alinLibraryOptions;
})();

;
/* modules/library/finance.js */
/* ALIN v2.2.6 — library finance views backed only by AlinFinance. */
(function(){
  'use strict';
  window.AlinLibraryModules=window.AlinLibraryModules||{};
  const arr=value=>Array.isArray(value)?value:[];
  const same=(a,b)=>String(a??'')===String(b??'');
  const escv=value=>typeof window.esc==='function'?window.esc(value):String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const moneyv=value=>typeof window.money==='function'?window.money(value):Math.round(Number(value)||0).toLocaleString(window.AlinI18n?.locale?.()||'ar-IQ');
  const database=()=>window.db||{};
  const finance=()=>window.AlinFinance;

  function currentLibraryId(){
    const account=window.current||{};
    const libraries=arr(database().accounts?.libraries);
    const row=libraries.find(item=>[account.id,account.library_id,account.account_id,account.user_id].filter(Boolean).some(id=>same(item.id,id)||same(item.account_id,id)||same(item.user_id,id)))
      ||libraries.find(item=>account.username&&same(item.username,account.username));
    return String(row?.id||account.library_id||account.id||'');
  }

  function summary(libraryId=currentLibraryId()){
    return finance()?.librarySummary?.(libraryId)||{rows:[],settlements:[],gross:0,profit:0,libraryProfit:0,debtTotal:0,settled:0,remaining:0,debtRemaining:0,monthProfit:0};
  }

  function libraryName(id){return arr(database().accounts?.libraries).find(row=>same(row.id,id))?.name||window.current?.name||'المكتبة'}

  function statementRows(id){
    return summary(id).rows.map(row=>`<tr><td>${escv(row.order?.order_number||row.order_number||row.order_id)}</td><td>${escv(String(row.at||'').slice(0,10)||'-')}</td><td>${moneyv(row.gross)} د.ع</td><td>${moneyv(row.profit)} د.ع</td><td>${moneyv(row.debt)} د.ع</td></tr>`).join('')||'<tr><td colspan="5">لا توجد حركات مالية.</td></tr>';
  }

  function printLibraryStatement(libraryId=currentLibraryId()){
    const data=summary(libraryId);
    const html=`<div class="receipt"><h2>كشف حساب المكتبة</h2><p>${escv(libraryName(libraryId))}</p><table><thead><tr><th>الطلب</th><th>التاريخ</th><th>المبلغ</th><th>ربح المكتبة</th><th>الذمة</th></tr></thead><tbody>${statementRows(libraryId)}</tbody></table><h3>ربح المكتبة: ${moneyv(data.libraryProfit)} د.ع</h3><h3>المسدد: ${moneyv(data.settled)} د.ع</h3><h3>المتبقي بذمة المكتبة: ${moneyv(data.debtRemaining)} د.ع</h3></div><div class="row-actions no-print"><button onclick="window.print()">طباعة</button><button class="secondary" onclick="closeCheckout()">إغلاق</button></div>`;
    if(window.checkoutBox&&window.checkoutModal){window.checkoutBox.innerHTML=html;window.checkoutModal.classList.remove('hidden');return true}
    return false;
  }

  function exportLibraryStatement(libraryId=currentLibraryId()){
    const data=summary(libraryId);
    const rows=[['رقم الطلب','التاريخ','المبلغ','ربح المكتبة','الذمة'],...data.rows.map(row=>[row.order?.order_number||row.order_number||row.order_id,String(row.at||'').slice(0,10),row.gross,row.profit,row.debt]),[],['ربح المكتبة',data.libraryProfit],['المسدد',data.settled],['المتبقي',data.debtRemaining]];
    const csv='\ufeff'+rows.map(row=>row.map(value=>`"${String(value??'').replace(/"/g,'""')}"`).join(',')).join('\n');
    const link=document.createElement('a');link.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));link.download=`library-finance-${libraryId}.csv`;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);
  }

  function printLibrarySettlement(id){
    const row=summary().settlements.find(item=>same(item.id,id)||same(item.receipt_number,id));if(!row)return false;
    const html=`<div class="receipt"><h2>منصة آلين</h2><h3>سند قبض تسوية مكتبة</h3><p>رقم السند: ${escv(row.receipt_number||row.id)}</p><p>المكتبة: ${escv(libraryName(row.library_id))}</p><p>المبلغ: ${moneyv(row.amount)} د.ع</p><p>طريقة الاستلام: ${escv(row.payment_method||'نقدي')}</p><p>التاريخ: ${escv(String(row.created_at||'').slice(0,10))}</p></div><div class="row-actions no-print"><button onclick="window.print()">طباعة</button><button class="secondary" onclick="closeCheckout()">إغلاق</button></div>`;
    if(window.checkoutBox&&window.checkoutModal){window.checkoutBox.innerHTML=html;window.checkoutModal.classList.remove('hidden');return true}return false;
  }

  async function reverseLibrarySettlement(id){
    const row=summary().settlements.find(item=>same(item.id,id)||same(item.receipt_number,id));
    if(!row||!window.confirm('إلغاء أثر سند التسوية؟'))return false;
    const reason=(window.prompt('اكتب سبب عكس سند التسوية')||'').trim();if(!reason)return false;
    if(!window.AlinFinance?.reverseSettlement)throw new Error('خدمة عكس التسوية غير جاهزة');
    await window.AlinFinance.reverseSettlement('library',row.id,reason);
    if(typeof window.audit==='function')await window.audit('finance',`عكس سند تسوية ${row.receipt_number||row.id}: ${reason}`);
    return true;
  }

  function renderLibraryFinance(){
    const root=document.getElementById('libraryV116Content')||document.getElementById('libraryContent');if(!root)return false;
    const id=currentLibraryId(),data=summary(id);
    root.innerHTML=`<section class="library-v116-finance"><div class="library-v116-finance-cards"><article><small>المبيعات المستلمة</small><b>${moneyv(data.gross)} د.ع</b></article><article><small>ربح المكتبة</small><b>${moneyv(data.libraryProfit)} د.ع</b></article><article><small>المسدد للإدارة</small><b>${moneyv(data.settled)} د.ع</b></article><article><small>المتبقي بذمة المكتبة</small><b>${moneyv(data.debtRemaining)} د.ع</b></article></div><div class="row-actions"><button onclick="printLibraryStatement('${escv(id)}')">طباعة كشف الحساب</button><button class="secondary" onclick="exportLibraryStatement('${escv(id)}')">تصدير CSV</button></div><div class="library-v116-panel"><h3>تفاصيل الحركات</h3><table><thead><tr><th>الطلب</th><th>التاريخ</th><th>المبلغ</th><th>ربح المكتبة</th><th>الذمة</th></tr></thead><tbody>${statementRows(id)}</tbody></table></div></section>`;
    return true;
  }

  window.printLibraryStatement=printLibraryStatement;
  window.exportLibraryStatement=exportLibraryStatement;
  window.printLibrarySettlement=printLibrarySettlement;
  window.reverseLibrarySettlement=reverseLibrarySettlement;
  window.renderLibraryFinance=renderLibraryFinance;
  window.AlinLibraryModules.printLibraryStatement=printLibraryStatement;
  window.AlinLibraryModules.renderLibraryFinance=renderLibraryFinance;
  window.AlinV120Finance=window.AlinV120Finance||{summary,settle:id=>finance()?.settleLibrary?.(id)};
})();

;
/* modules/library/printing.js */
// === library/printing.js ===
/* ===== library/js/print-canvas-v119.js ===== */
/* V119: protected in-app PDF canvas preview. No native PDF viewer and no download toolbar. */
(function(){
  'use strict';
  let activeOrder=null;
  let activePdf=null;
  let activeBytes=null;
  let rendering=false;

  const toastSafe=(m)=>typeof toast==='function'?toast(m):alert(m);
  const escSafe=(v)=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const copies=(o)=>Math.max(1,Number(o?.qty||o?.quantity||1));
  function findOrder(id){try{return (db.orders||[]).find(x=>String(x.id)===String(id));}catch(_){return null;}}
  function findBooklet(order){
    try{
      if(typeof alinV59OrderBooklet==='function') return alinV59OrderBooklet(order);
      return (db.booklets||[]).find(x=>String(x.id)===String(order?.item_id));
    }catch(_){return null;}
  }
  async function resolveSource(path){
    if(typeof alinResolveStoredFile!=='function')throw new Error('خدمة المستندات الخاصة غير متاحة');
    const resolved=await alinResolveStoredFile(path,'booklets');
    if(!resolved?.url)throw new Error('ملف الملزمة غير محمي أو غير مرتبط بهذا الطلب');
    return resolved.url;
  }
  async function ensurePdfJs(){
    if(window.pdfjsLib) return window.pdfjsLib;
    await new Promise((resolve,reject)=>{
      const old=document.querySelector('script[data-alin-pdfjs]');
      if(old){old.addEventListener('load',resolve,{once:true});old.addEventListener('error',reject,{once:true});return;}
      const s=document.createElement('script');
      s.src='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
      s.dataset.alinPdfjs='1';s.onload=resolve;s.onerror=reject;document.head.appendChild(s);
    });
    if(!window.pdfjsLib) throw new Error('PDF.js unavailable');
    window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
    return window.pdfjsLib;
  }
  function renderShell(order){
    const qty=copies(order);
    checkoutBox.innerHTML=`
      <section class="alin-print-v119">
        <header class="alin-print-v119-head">
          <div><small>عرض آمن للطباعة فقط</small><h2>${escSafe(order?.title||'ملزمة')}</h2><p>رقم الطلب: <b>${escSafe(order?.order_number||order?.id||'—')}</b> • الطالب: <b>${escSafe(order?.student_name||'—')}</b></p></div>
          <span class="alin-print-v119-copies">المطلوب ${qty} نسخة</span>
        </header>
        <div class="alin-print-v119-toolbar no-print">
          <div><b>معاينة داخل المنصة</b><span>الملف لا يفتح في عارض PDF الأصلي ولا يظهر زر تنزيل.</span></div>
          <button type="button" class="alin-print-v119-print" onclick="printLibraryCanvasV119()">طباعة ${qty} نسخة</button>
          <button type="button" class="secondary" onclick="closeCheckout()">إغلاق</button>
        </div>
        <div id="alinPrintCanvasStatus" class="alin-print-v119-status"><span></span><b>جاري تجهيز صفحات الملزمة...</b></div>
        <div id="alinPrintCanvasPages" class="alin-print-v119-pages" aria-label="معاينة صفحات الملزمة"></div>
      </section>`;
  }
  async function renderPreview(pdf){
    const pages=document.getElementById('alinPrintCanvasPages');
    const status=document.getElementById('alinPrintCanvasStatus');
    if(!pages||!status) return;
    pages.innerHTML='';
    const maxWidth=Math.min(900,Math.max(320,pages.clientWidth-24));
    for(let n=1;n<=pdf.numPages;n++){
      const page=await pdf.getPage(n);
      const base=page.getViewport({scale:1});
      const scale=Math.min(1.45,maxWidth/base.width);
      const viewport=page.getViewport({scale});
      const wrap=document.createElement('article');
      wrap.className='alin-print-v119-page';
      const label=document.createElement('small');label.textContent=`صفحة ${n} من ${pdf.numPages}`;
      const surface=document.createElement('div');
      surface.className='alin-print-v119-surface';
      surface.style.maxWidth=`${Math.ceil(viewport.width)}px`;
      surface.style.aspectRatio=`${viewport.width} / ${viewport.height}`;
      const canvas=document.createElement('canvas');
      canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
      canvas.setAttribute('aria-label',`صفحة ${n}`);
      surface.appendChild(canvas);wrap.append(label,surface);pages.appendChild(wrap);
      await page.render({canvasContext:canvas.getContext('2d',{alpha:false}),viewport}).promise;
    }
    status.hidden=true;
    status.style.display='none';
  }
  async function openPreview(orderId){
    if(rendering) return;
    const order=findOrder(orderId);
    if(!order||order.kind!=='booklet') return toastSafe('هذا الطلب لا يحتوي ملف PDF');
    const booklet=findBooklet(order);
    if(!booklet?.file_path) return toastSafe('لا يوجد ملف PDF لهذه الملزمة');
    activeOrder=order; activePdf=null; activeBytes=null; rendering=true;
    checkoutModal.classList.remove('hidden');
    const close=document.querySelector('#checkoutModal .x');
    if(close){close.textContent='إغلاق';close.setAttribute('aria-label','إغلاق المعاينة');}
    renderShell(order);
    try{
      const pdfjs=await ensurePdfJs();
      const source=await resolveSource(booklet.file_path);
      const response=await fetch(String(source).split('#')[0],{cache:'no-store'});
      if(!response.ok) throw new Error('PDF '+response.status);
      activeBytes=await response.arrayBuffer();
      activePdf=await pdfjs.getDocument({data:activeBytes.slice(0)}).promise;
      await renderPreview(activePdf);
    }catch(err){
      console.error('[ALIN preview error]',err);
      const status=document.getElementById('alinPrintCanvasStatus');
      if(status) status.innerHTML='<div class="alin-print-v119-error"><h3>تعذر تجهيز المعاينة</h3><p>تأكد من ملف الملزمة واتصال الإنترنت ثم أعد المحاولة.</p></div>';
      toastSafe('تعذر عرض ملف الملزمة');
    }finally{rendering=false;}
  }
  async function printPreview(){
    if(!activePdf||!activeBytes) return toastSafe('انتظر حتى تكتمل معاينة الملف');
    const qty=copies(activeOrder);
    const button=document.querySelector('.alin-print-v119-print');
    if(button){button.disabled=true;button.textContent='جاري تجهيز الطباعة...';}
    try{
      const images=[];
      for(let n=1;n<=activePdf.numPages;n++){
        const page=await activePdf.getPage(n);
        const viewport=page.getViewport({scale:2});
        const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
        await page.render({canvasContext:canvas.getContext('2d',{alpha:false}),viewport}).promise;
        images.push(canvas.toDataURL('image/jpeg',0.96));
      }
      let frame=document.getElementById('alinPrintFrameV119');
      if(frame) frame.remove();
      frame=document.createElement('iframe');frame.id='alinPrintFrameV119';frame.style.position='fixed';frame.style.left='-10000px';frame.style.width='1px';frame.style.height='1px';frame.style.border='0';document.body.appendChild(frame);
      const doc=frame.contentDocument;
      doc.open();
      doc.write(`<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>طباعة ملزمة</title><style>@page{size:auto;margin:8mm}html,body{margin:0;padding:0;background:#fff}.page{page-break-after:always;break-after:page;text-align:center}.page:last-child{page-break-after:auto;break-after:auto}img{display:block;width:100%;height:auto;max-width:100%;margin:0 auto}</style></head><body>${images.map(src=>`<div class="page"><img src="${src}"></div>`).join('')}</body></html>`);
      doc.close();
      await new Promise(resolve=>setTimeout(resolve,500));
      frame.contentWindow.focus();
      frame.contentWindow.print();
      toastSafe(`اختر الطابعة واضبط عدد النسخ على ${qty}`);
    }catch(err){
      console.error('[ALIN print error]',err);
      toastSafe('تعذر تجهيز الطباعة، أعد المحاولة');
    }finally{
      if(button){button.disabled=false;button.textContent=`طباعة ${qty} نسخة`;}
    }
  }
  window.openLibraryBookletPdf=openPreview;
  window.openOrderPdf=openPreview;
  window.printLibraryBookletDirect=openPreview;
  window.printLibraryPreviewV118=printPreview;
  window.printLibraryCanvasV119=printPreview;
  window.AlinLibraryModules=window.AlinLibraryModules||{};
  window.AlinLibraryModules.openLibraryBookletPdf=openPreview;
})();


;

;
/* modules/store/order-routing.js */
// === modules/store/order-routing.js ===
/* ALIN v2.6.0 Stage 3 — checkout routing intent only. Prices, fees and payment state are server-owned. */
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const value=id=>String($(id)?.value||'').trim();
  const num=input=>Number(input||0);
  const same=(a,b)=>String(a??'')===String(b??'');
  let pending=false;

  function cartRows(){return Array.isArray(window.cart)?window.cart:[]}
  function hasProducts(){return cartRows().some(line=>line.kind!=='booklet')}
  function activeLibraries(){return window.db?.accounts?.libraries||[]}
  function libraryOpen(id){
    const library=activeLibraries().find(item=>same(item.id,id));if(!library)return false;
    try{return typeof window.libIsOpen==='function'?!!window.libIsOpen(library):!(library.is_open===false||String(library.is_open)==='false'||library.open_status==='closed')}catch(_){return true}
  }
  function fulfillmentType(){return document.querySelector('#checkoutBox input[name="fulfillment"]:checked')?.value||(hasProducts()?'home_delivery':'pickup')}

  // هذه الدالة ترسل نية الاستلام فقط. الخادم يعيد التحقق من المكتبة والمنطقة ويحسب الأجرة.
  function alinOrderExtra(){
    const type=hasProducts()?'home_delivery':fulfillmentType();
    if(type==='pickup'){
      const libraryId=value('libSelect');
      if(!libraryId)throw new Error('اختر مكتبة الاستلام');
      if(!libraryOpen(libraryId))throw new Error('المكتبة المختارة مغلقة حالياً');
      return {fulfillment_type:'pickup',library_id:libraryId,pickup_library_id:libraryId};
    }
    const area=value('deliveryArea'),landmark=value('deliveryLandmark');
    const latitude=value('deliveryLatitude'),longitude=value('deliveryLongitude'),accuracy=value('deliveryLocationAccuracy');
    if(!area)throw new Error('اختر منطقة التوصيل من القائمة');
    if(!landmark&&!latitude)throw new Error('حدد الموقع أو اكتب أقرب نقطة دالة');
    return {
      fulfillment_type:'home_delivery',
      delivery_area:area,
      delivery_landmark:landmark,
      delivery_latitude:latitude?num(latitude):null,
      delivery_longitude:longitude?num(longitude):null,
      delivery_location_accuracy:accuracy?Math.round(num(accuracy)):null
    };
  }

  function emitCreated(numbers,fulfillment,items=[]){document.dispatchEvent(new CustomEvent('alin:order-created',{detail:{numbers,fulfillment,items}}))}

  // لا يوجد إدخال مباشر احتياطي إلى orders. هذا مقصود حتى لا يمكن تجاوز التسعير الآمن.
  async function createFallback(){
    throw new Error('خدمة إنشاء الطلب الآمنة غير جاهزة. حدّث الصفحة وحاول مرة أخرى');
  }

  async function confirmCartCheckout(){
    if(pending)return;
    const button=document.querySelector('#checkoutBox .alin-cart-submit');const oldText=button?.textContent;
    try{
      pending=true;if(button){button.disabled=true;button.textContent='جاري إنشاء الطلب...'}
      if(typeof window.ALINAuth?.secureCheckout!=='function')return await createFallback();
      return await window.ALINAuth.secureCheckout();
    }catch(error){
      const box=$('alinCartError')||document.createElement('div');box.id='alinCartError';box.className='notice';box.textContent=error?.message||'تعذر إنشاء الطلب';document.querySelector('#checkoutBox .alin-cart-side')?.prepend(box);throw error;
    }finally{pending=false;if(button){button.disabled=false;button.textContent=oldText||'تأكيد الطلب الآن'}}
  }

  Object.assign(window,{alinOrderExtra,confirmCartCheckout,confirmCheckout:confirmCartCheckout,alinConfirmRoutedCart:confirmCartCheckout,alinLegacyCreateOrder:createFallback,alinEmitOrderCreated:emitCreated});
})();

;
/* modules/store/delivery.js */
// === store/delivery.js ===
/* ===== store/js/delivery-gps-v162.js ===== */
/* ALIN v2.1.8: delivery area dropdown + landmark + GPS, without free-text address. */
(function(){
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const areas=()=>{const cloud=window.db?.deliveryAreas||window.db?.delivery_areas||[];const source=cloud.length?cloud.map(row=>row?.name):(Array.isArray(window.ALIN_KIRKUK_AREAS)?window.ALIN_KIRKUK_AREAS:[]);return [...new Set(source.map(name=>String(name||'').trim()).filter(Boolean))]};
  const mapUrl=(lat,lng)=>lat&&lng?`https://www.google.com/maps?q=${encodeURIComponent(lat)},${encodeURIComponent(lng)}`:'';

  function areaOptions(selected=''){
    return `<option value="">اختر منطقة التوصيل في كركوك</option>`+areas().map(a=>`<option value="${esc(a)}" ${String(a)===String(selected)?'selected':''}>${esc(a)}</option>`).join('');
  }
  function gpsMarkup(){
    return `<section class="v162-gps-box" id="v162GpsBox">
      <div class="v162-gps-head"><div><b>نقطة موقع التوصيل GPS</b><small>تساعد المدير والمندوب على الوصول لنقطة التسليم بدقة.</small></div><span id="v162GpsStatus" class="v162-gps-status">غير محدد</span></div>
      <div class="v162-gps-actions">
        <button type="button" class="v162-gps-primary" onclick="alinV162UseCurrentLocation()"><span aria-hidden="true">⌖</span> استخدام موقعي الحالي</button>
        <button type="button" id="v162OpenMapBtn" class="secondary" onclick="alinV162OpenSelectedMap()" disabled>فتح الموقع على الخريطة</button>
        <button type="button" id="v162ClearGpsBtn" class="secondary" onclick="alinV162ClearGps()" hidden>مسح الموقع</button>
      </div>
      <div id="v162GpsDetails" class="v162-gps-details" hidden></div>
      <input type="hidden" id="deliveryLatitude"><input type="hidden" id="deliveryLongitude"><input type="hidden" id="deliveryLocationUrl"><input type="hidden" id="deliveryLocationAccuracy">
      <p class="v162-gps-note">يمكن تحديد الموقع من المتصفح، وأقرب نقطة دالة تكفي عند عدم استخدام GPS.</p>
    </section>`;
  }
  function enhanceDeliveryFields(){
    const root=$('#checkoutBox'); if(!root)return;
    const fields=$('#deliveryFields',root); if(!fields)return;
    const oldArea=$('#deliveryArea',root);
    if(oldArea && oldArea.tagName!=='SELECT'){
      const select=document.createElement('select');select.id='deliveryArea';select.required=true;select.innerHTML=areaOptions(oldArea.value);
      oldArea.replaceWith(select);
    } else if(oldArea && oldArea.tagName==='SELECT' && oldArea.options.length<2){ oldArea.innerHTML=areaOptions(oldArea.value); }
    const oldAddress=$('#deliveryAddress',root);if(oldAddress)oldAddress.remove();
    const courier=$('#courierSelect',root); if(courier) courier.closest('label')?.remove(),courier.remove();
    if(!$('#v162GpsBox',root)){
      const grid=$('.form-grid',fields);
      if(grid) grid.insertAdjacentHTML('afterend',gpsMarkup()); else fields.insertAdjacentHTML('beforeend',gpsMarkup());
    }
    restoreGpsState();
  }
  const stateKey='alin_v162_checkout_gps';
  function saveGpsState(data){try{sessionStorage.setItem(stateKey,JSON.stringify(data))}catch(_){}}
  function readGpsState(){try{return JSON.parse(sessionStorage.getItem(stateKey)||'null')}catch(_){return null}}
  function restoreGpsState(){const s=readGpsState();if(s?.lat&&s?.lng)setGps(s.lat,s.lng,s.accuracy,false)}
  function setGps(lat,lng,accuracy,store=true){
    const la=$('#deliveryLatitude'),lo=$('#deliveryLongitude'),url=$('#deliveryLocationUrl'),acc=$('#deliveryLocationAccuracy');if(!la||!lo)return;
    la.value=Number(lat).toFixed(7);lo.value=Number(lng).toFixed(7);url.value=mapUrl(la.value,lo.value);if(acc)acc.value=Math.round(Number(accuracy||0));
    const status=$('#v162GpsStatus'),details=$('#v162GpsDetails'),open=$('#v162OpenMapBtn'),clear=$('#v162ClearGpsBtn');
    if(status){status.textContent='تم تحديد الموقع';status.classList.add('is-set')}
    if(details){details.hidden=false;details.innerHTML=`<span>خط العرض: <b>${esc(la.value)}</b></span><span>خط الطول: <b>${esc(lo.value)}</b></span>${accuracy?`<span>الدقة التقريبية: <b>${Math.round(accuracy)} متر</b></span>`:''}`}
    if(open)open.disabled=false;if(clear)clear.hidden=false;if(store)saveGpsState({lat:la.value,lng:lo.value,accuracy:Number(accuracy||0)});
  }
  window.alinV162UseCurrentLocation=function(){
    const status=$('#v162GpsStatus');
    if(!navigator.geolocation){if(status)status.textContent='المتصفح لا يدعم GPS';return}
    if(status){status.textContent='جاري تحديد الموقع...';status.classList.remove('is-set')}
    navigator.geolocation.getCurrentPosition(p=>setGps(p.coords.latitude,p.coords.longitude,p.coords.accuracy),e=>{
      if(status)status.textContent=e.code===1?'لم يتم السماح بالموقع':'تعذر تحديد الموقع';
      if(typeof toast==='function')toast('تعذر تحديد GPS. اكتب أقرب نقطة دالة أو حاول مرة أخرى.');
    },{enableHighAccuracy:true,timeout:15000,maximumAge:30000});
  };
  window.alinV162OpenSelectedMap=function(){const u=$('#deliveryLocationUrl')?.value;if(u)window.open(u,'_blank','noopener')};
  window.alinV162ClearGps=function(){['deliveryLatitude','deliveryLongitude','deliveryLocationUrl','deliveryLocationAccuracy'].forEach(id=>{const e=document.getElementById(id);if(e)e.value=''});try{sessionStorage.removeItem(stateKey)}catch(_){};const st=$('#v162GpsStatus'),dt=$('#v162GpsDetails'),op=$('#v162OpenMapBtn'),cl=$('#v162ClearGpsBtn');if(st){st.textContent='غير محدد';st.classList.remove('is-set')}if(dt)dt.hidden=true;if(op)op.disabled=true;if(cl)cl.hidden=true};

  function installCartHook(){
    document.addEventListener('alin:cart-rendered',()=>setTimeout(enhanceDeliveryFields,0));
    document.addEventListener('alin:fulfillment-changed',()=>setTimeout(enhanceDeliveryFields,0));
    document.addEventListener('change',e=>{if(e.target?.name==='fulfillment')setTimeout(enhanceDeliveryFields,0)});
  }

  function orderMapLink(o){
    const lat=o.delivery_latitude||o.latitude||o.delivery_lat,lng=o.delivery_longitude||o.longitude||o.delivery_lng;
    return o.delivery_location_url||o.location_url||mapUrl(lat,lng);
  }
  function decorateAdminDelivery(){
    const rows=(window.db?.orders||[]).filter(o=>o.fulfillment_type==='home_delivery'||o.delivery_area);
    $$('.v161-delivery-card').forEach((card,i)=>{const o=rows[i];if(!o)return;const url=orderMapLink(o);if(!url||$('.v162-map-link',card))return;const actions=$('.v161-delivery-actions',card)||card;actions.insertAdjacentHTML('afterbegin',`<a class="v162-map-link" href="${esc(url)}" target="_blank" rel="noopener">فتح موقع الطالب GPS</a>`)});
  }
  function decorateCourierOrders(){
    const currentId=window.current?.id;
    const rows=(window.db?.orders||[]).filter(o=>String(o.courier_id||o.delegate_id||'')===String(currentId));
    $$('.v161-courier-orders>article').forEach(card=>{
      const numText=$('small',card)?.textContent||'';const o=rows.find(x=>String(x.order_number||x.id)===numText.trim());if(!o)return;const url=orderMapLink(o);if(!url||$('.v162-map-link',card))return;const target=$('.v161-courier-order-actions',card)||card;target.insertAdjacentHTML('afterbegin',`<a class="v162-map-link" href="${esc(url)}" target="_blank" rel="noopener">فتح موقع الطالب</a>`)});
  }
  function installDashboardHooks(){
    if(typeof window.renderDeliveryOrdersAdmin==='function'){const old=window.renderDeliveryOrdersAdmin;window.renderDeliveryOrdersAdmin=function(){const r=old.apply(this,arguments);setTimeout(decorateAdminDelivery,0);return r}}
    if(typeof window.renderCourierDashboard==='function'){const old=window.renderCourierDashboard;window.renderCourierDashboard=function(){const r=old.apply(this,arguments);setTimeout(decorateCourierOrders,0);return r}}
  }
  function install(){installCartHook();installDashboardHooks();setTimeout(enhanceDeliveryFields,100)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();


;

;
/* modules/admin/dashboard.js */
// === admin/dashboard.js ===
/* ===== admin/js/admin-dashboard-v122.js ===== */

(function(){
  const escv=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const moneyv=v=>typeof money==='function'?money(v):Number(v||0).toLocaleString(window.AlinI18n?.locale?.()||'ar-IQ');
  const arr=v=>Array.isArray(v)?v:[];
  const num=v=>Number(v||0);
  function database(){try{return window.db||db||{}}catch(_){return window.db||{}}}
  function statusText(s){const map={new:'جديد',pending:'جديد',printing:'قيد الطباعة',processing:'قيد التجهيز',ready:'جاهز',delivered:'تم التسليم',completed:'مكتمل',cancelled:'ملغي',canceled:'ملغي'};return map[String(s||'').toLowerCase()]||s||'غير محدد'}
  function orderDate(o){return String(o?.created_at||o?.date||'').slice(0,10)}
  function orderTotal(o){return num(o?.total||o?.total_amount||o?.amount||o?.price)*Math.max(1,num(o?.qty||1))}
  function platformIncome(dbx){
    const rows=arr(window.financialEntries||dbx.financial_entries||dbx.ledger);
    return rows.reduce((a,x)=>a+num(x.platform_amount||x.alin||x.platform_profit),0);
  }
  function libraryDebt(dbx){
    try{
      if(typeof window.alinV121LibraryDebtTotal==='function') return num(window.alinV121LibraryDebtTotal());
      return arr(dbx.accounts?.libraries).reduce((sum,l)=>{try{return sum+(typeof libDebt==='function'?num(libDebt(l.id)?.remaining):0)}catch(_){return sum}},0);
    }catch(_){return 0}
  }
  function render(){
    const content=document.getElementById('adminContent'); if(!content)return;
    const dbx=database(),orders=arr(dbx.orders),products=arr(dbx.products),booklets=arr(dbx.booklets),teachers=arr(dbx.accounts?.teachers),libraries=arr(dbx.accounts?.libraries),couriers=arr(dbx.accounts?.couriers||dbx.couriers);
    const today=new Date().toISOString().slice(0,10),month=today.slice(0,7);
    const todayOrders=orders.filter(o=>orderDate(o)===today),monthOrders=orders.filter(o=>orderDate(o).startsWith(month));
    const newOrders=orders.filter(o=>['new','pending',''].includes(String(o.status||'').toLowerCase()));
    const delivered=monthOrders.filter(o=>['delivered','completed'].includes(String(o.status||'').toLowerCase()));
    const low=products.filter(p=>num(p.stock)<=num(p.low_stock_limit||dbx.settings?.low_stock_default||5));
    const inactiveLibraries=libraries.filter(l=>String(l.status||'').toLowerCase()!=='active'||l.is_open===false||String(l.open_status||'').toLowerCase()==='closed');
    const recent=[...orders].sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))).slice(0,6);
    const monthSales=monthOrders.reduce((a,o)=>a+orderTotal(o),0),income=platformIncome(dbx),debt=libraryDebt(dbx);
    const dateText=new Intl.DateTimeFormat('ar-IQ',{weekday:'long',year:'numeric',month:'long',day:'numeric'}).format(new Date());
    const recentHtml=recent.length?recent.map(o=>`<article class="admin-v122-order"><div><b>#${escv(o.order_no||o.code||o.id||'طلب')}</b><small>${escv(o.student_name||o.customer_name||'طالب')} • ${escv(orderDate(o)||'بدون تاريخ')}</small><span class="admin-v122-status">${escv(statusText(o.status))}</span></div><div class="admin-v122-order-total">${moneyv(orderTotal(o))} د.ع</div></article>`).join(''):'<div class="admin-v122-empty">لا توجد طلبات بعد.</div>';
    const alerts=[];
    if(newOrders.length)alerts.push(`<article class="admin-v122-alert"><div><b>طلبات تحتاج متابعة</b><small>طلبات جديدة لم يبدأ تجهيزها بعد.</small></div><em>${newOrders.length}</em></article>`);
    if(low.length)alerts.push(`<article class="admin-v122-alert danger"><div><b>مخزون منخفض</b><small>${escv(low.slice(0,3).map(x=>x.name||x.title).join('، '))}</small></div><em>${low.length}</em></article>`);
    if(debt>0)alerts.push(`<article class="admin-v122-alert"><div><b>ذمم مكتبات غير مسوّاة</b><small>تحتاج مراجعة من قسم المالية.</small></div><em>${moneyv(debt)}</em></article>`);
    if(inactiveLibraries.length)alerts.push(`<article class="admin-v122-alert"><div><b>مكتبات غير متاحة</b><small>مغلقة أو غير مفعلة حالياً.</small></div><em>${inactiveLibraries.length}</em></article>`);
    content.dataset.adminV122='dashboard';
    content.innerHTML=`<section class="admin-v122-dashboard"><header class="admin-v122-welcome"><div><h2>أهلاً بك في إدارة منصة آلين</h2><p>ملخص سريع لحالة المنصة والطلبات والحسابات المهمة.</p></div><span class="admin-v122-date">${escv(dateText)}</span></header><section class="admin-v122-metrics"><article class="admin-v122-metric"><small>طلبات اليوم</small><strong>${todayOrders.length}</strong><span>${newOrders.length} طلب جديد بانتظار المتابعة</span></article><article class="admin-v122-metric gold"><small>مبيعات الشهر</small><strong>${moneyv(monthSales)} د.ع</strong><span>${monthOrders.length} طلب خلال الشهر</span></article><article class="admin-v122-metric green"><small>طلبات مكتملة هذا الشهر</small><strong>${delivered.length}</strong><span>تم التسليم أو الإكمال</span></article><article class="admin-v122-metric red"><small>ذمم المكتبات</small><strong>${moneyv(debt)} د.ع</strong><span>الرصيد غير المسوّى</span></article><article class="admin-v122-metric"><small>الملازم والمنتجات</small><strong>${booklets.length+products.length}</strong><span>${booklets.length} ملزمة • ${products.length} منتج</span></article><article class="admin-v122-metric"><small>الشركاء</small><strong>${teachers.length+libraries.length+couriers.length}</strong><span>${teachers.length} مدرس • ${libraries.length} مكتبة • ${couriers.length} مندوب</span></article><article class="admin-v122-metric gold"><small>حصة المنصة المسجلة</small><strong>${moneyv(income)} د.ع</strong><span>بحسب السجلات المالية الحالية</span></article><article class="admin-v122-metric ${low.length?'red':''}"><small>مخزون منخفض</small><strong>${low.length}</strong><span>${low.length?escv(low.slice(0,2).map(x=>x.name||x.title).join('، ')):'لا توجد تنبيهات مخزون'}</span></article></section><section class="admin-v122-grid"><article class="admin-v122-card"><div class="admin-v122-card-head"><h3>أحدث الطلبات</h3><button type="button" onclick="adminTab('orders')">عرض الكل</button></div><div class="admin-v122-orders">${recentHtml}</div></article><aside class="admin-v122-card"><div class="admin-v122-card-head"><h3>تنبيهات تحتاج انتباهك</h3></div><div class="admin-v122-alerts">${alerts.join('')||'<div class="admin-v122-empty">كل الأمور مستقرة حالياً.</div>'}</div></aside></section><section class="admin-v122-card"><div class="admin-v122-card-head"><h3>وصول سريع</h3></div><div class="admin-v122-actions"><button class="admin-v122-action" onclick="adminTab('orders')"><i>🧾</i><span>إدارة الطلبات</span></button><button class="admin-v122-action" onclick="adminTab('products')"><i>🛍️</i><span>إضافة منتج</span></button><button class="admin-v122-action" onclick="adminTab('booklets')"><i>📘</i><span>إدارة الملازم</span></button><button class="admin-v122-action" onclick="adminTab('finance')"><i>💳</i><span>المالية والتسويات</span></button></div></section></section>`;
  }
  window.renderAdminDashboard=render;
  if(window.AlinAdminModules?.register)window.AlinAdminModules.register('dashboard',render);
})();


;

;
/* modules/admin/orders.js */
// === admin/orders.js ===
// Authoritative admin order management. No adminTab wrapping and no legacy fallbacks.
(function(){
  'use strict';

  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const moneyText=v=>typeof window.money==='function'?window.money(v):Number(v||0).toLocaleString(window.AlinI18n?.locale?.()||'ar-IQ');
  const arr=v=>Array.isArray(v)?v:[];
  const now=()=>new Date().toISOString();
  const dbx=()=>window.db||{};
  const orders=()=>arr(dbx().orders);
  const libraries=()=>arr(dbx().accounts?.libraries);
  const couriers=()=>arr(dbx().accounts?.couriers).length?arr(dbx().accounts?.couriers):arr(dbx().couriers);
  const products=()=>arr(dbx().products);
  const statusLabels={
    pending:'قيد الانتظار',new:'جديد',pending_admin:'بانتظار الإدارة',payment_pending:'بانتظار الدفع',paid:'مدفوع',
    assigned:'محول للمندوب',accepted:'مقبول من المندوب',picked_up:'استلمه المندوب',out_for_delivery:'قيد التوصيل',out_delivery:'قيد التوصيل',
    processing:'قيد التجهيز',printing:'قيد الطباعة',ready:'جاهز',completed:'مكتمل',delivered:'تم التسليم',cancelled:'ملغي',rejected:'مرفوض',receipt_rejected:'وصل مرفوض'
  };
  const state={q:'',status:'',library:'',courier:'',kind:'',period:'all',from:'',to:''};
  const metaKey='alin_admin_order_meta_v220';
  let busy=false;

  function normalizeArea(value){
    if(typeof window.alinNormalizeDeliveryArea==='function')return window.alinNormalizeDeliveryArea(value);
    return String(value||'').trim().replace(/\s+/g,' ').split(/[-–—]/)[0].trim().toLowerCase();
  }
  function courierAreas(c){
    let raw=c?.areas??c?.area_ids??c?.area??[];
    if(typeof raw==='string'){try{const parsed=JSON.parse(raw);raw=Array.isArray(parsed)?parsed:raw.split(/[,،|]/)}catch(_){raw=raw.split(/[,،|]/)}}
    return arr(raw).map(x=>typeof x==='object'?(x.name||x.area||x.id||''):x).map(x=>String(x).trim()).filter(Boolean);
  }
  function matchingCouriers(area){
    const target=normalizeArea(area);
    if(!target)return couriers().filter(c=>String(c.status||'active')!=='inactive');
    return couriers().filter(c=>String(c.status||'active')!=='inactive'&&courierAreas(c).some(a=>normalizeArea(a)===target));
  }
  function libraryName(id){return libraries().find(x=>String(x.id)===String(id))?.name||'غير محددة'}
  function courierName(id){return couriers().find(x=>String(x.id)===String(id))?.name||'غير معيّن'}
  function statusOf(o){return String(o?.status||o?.payment_status||'new')}
  function labelOf(value){const s=typeof value==='object'?statusOf(value):String(value||'new');return statusLabels[s]||s}
  function orderDate(o){const d=new Date(o?.created_at||o?.createdAt||Date.now());return Number.isNaN(d.getTime())?new Date(0):d}
  function dateText(o){const d=orderDate(o);return d.getTime()?d.toLocaleString(window.AlinI18n?.locale?.()||'ar-IQ'):'—'}
  function homeDelivery(o){return ['home_delivery','delivery','courier'].includes(String(o?.fulfillment_type||o?.delivery_type||''))}
  function metaLoad(){try{return JSON.parse(localStorage.getItem(metaKey)||'{}')}catch(_){return {}}}
  function metaSave(value){try{localStorage.setItem(metaKey,JSON.stringify(value))}catch(_){}}
  function orderMeta(id){return metaLoad()[String(id)]||{notes:[],history:[]}}
  function saveMeta(id,value){const all=metaLoad();all[String(id)]=value;metaSave(all)}
  function addHistory(id,action,details=''){
    const m=orderMeta(id);m.history=[...(m.history||[]),{at:now(),actor:window.current?.name||window.current?.username||'المدير',action,details}];saveMeta(id,m);
  }
  function notify(message,type='success'){
    if(typeof window.toast==='function')return window.toast(message);
    const old=document.querySelector('.alin-order-toast');if(old)old.remove();
    const el=document.createElement('div');el.className=`toast alin-order-toast ${type}`;el.textContent=message;document.body.appendChild(el);setTimeout(()=>el.remove(),2500);
  }
  function friendlyError(error){
    const text=String(error?.message||error||'');
    if(text.includes('orders_status_valid'))return 'حالة الطلب غير مسموحة في قاعدة البيانات.';
    if(text.includes('schema cache'))return 'قاعدة البيانات تحتاج تحديث المخطط ثم إعادة المحاولة.';
    if(text.includes('غير مسموح بتعديل الطلب'))return 'الحساب الحالي لا يملك صلاحية تعديل هذا الطلب.';
    if(text.includes('تم منع تعديل بيانات حساسة'))return 'تم منع تعديل حقول حساسة في الطلب.';
    return text||'تعذر تنفيذ العملية.';
  }
  function range(){
    const end=new Date();end.setHours(23,59,59,999);const start=new Date(end);start.setHours(0,0,0,0);
    if(state.period==='today')return[start,end];
    if(state.period==='week'){start.setDate(start.getDate()-6);return[start,end]}
    if(state.period==='month'){start.setDate(1);return[start,end]}
    if(state.period==='custom')return[state.from?new Date(state.from+'T00:00:00'):null,state.to?new Date(state.to+'T23:59:59'):null];
    return[null,null];
  }
  function filtered(){
    const q=state.q.trim().toLowerCase(),[from,to]=range();
    return orders().filter(o=>{
      const d=orderDate(o),hay=[o.order_number,o.id,o.title,o.student_name,o.student_phone,libraryName(o.library_id||o.pickup_library_id),courierName(o.courier_id||o.delegate_id),o.delivery_area,o.delivery_landmark].join(' ').toLowerCase();
      return(!q||hay.includes(q))&&(!state.status||statusOf(o)===state.status)&&(!state.library||String(o.library_id||o.pickup_library_id||'')===state.library)&&(!state.courier||String(o.courier_id||o.delegate_id||'')===state.courier)&&(!state.kind||String(o.kind||'')===state.kind)&&(!from||d>=from)&&(!to||d<=to);
    }).sort((a,b)=>orderDate(b)-orderDate(a));
  }
  function overdue(o){return !['ready','completed','delivered','cancelled','rejected'].includes(statusOf(o))&&Date.now()-orderDate(o).getTime()>86400000}
  function markTab(){
    window.activeAdminTab='orders';
    if(typeof window.markAdminTab==='function')window.markAdminTab('orders');
    document.querySelectorAll('#adminPage .admin-tabs button').forEach(b=>{const m=(b.getAttribute('onclick')||'').match(/adminTab\('([^']+)'\)/);b.classList.toggle('active-admin-tab',m?.[1]==='orders')});
  }
  function render(){
    const content=$('adminContent');if(!content)return;
    markTab();if(typeof window.adminStatsRender==='function')window.adminStatsRender();
    const all=orders(),list=filtered(),count=s=>all.filter(o=>statusOf(o)===s).length;
    const revenue=all.filter(o=>['completed','delivered'].includes(statusOf(o))).reduce((a,o)=>a+Number(o.total||0),0);
    content.dataset.adminModule='orders';
    content.innerHTML=`<section class="admin-orders-v126"><header class="admin-orders-v126-head"><div><h2>إدارة الطلبات</h2><p>متابعة الطلب من إنشائه إلى التحويل والتسليم.</p></div><div class="admin-orders-v126-head-actions"><button type="button" class="secondary" onclick="adminOrdersExport()">تصدير Excel</button><span>${list.length}</span></div></header>
    <section class="admin-orders-v126-stats"><article><small>كل الطلبات</small><strong>${all.length}</strong></article><article><small>جديدة</small><strong>${count('new')+count('pending_admin')}</strong></article><article><small>قيد التنفيذ</small><strong>${count('processing')+count('printing')+count('assigned')+count('accepted')+count('picked_up')+count('out_for_delivery')}</strong></article><article><small>متأخرة</small><strong>${all.filter(overdue).length}</strong></article><article><small>المبيعات المكتملة</small><strong>${moneyText(revenue)} د.ع</strong></article></section>
    <section class="admin-orders-v126-tools"><input id="adminOrderSearch" value="${esc(state.q)}" placeholder="رقم الطلب، اسم الطالب أو الهاتف"><select id="adminOrderStatus"><option value="">كل الحالات</option>${Object.entries(statusLabels).map(([k,v])=>`<option value="${k}" ${state.status===k?'selected':''}>${v}</option>`).join('')}</select><select id="adminOrderLibrary"><option value="">كل المكتبات</option>${libraries().map(x=>`<option value="${esc(x.id)}" ${state.library===String(x.id)?'selected':''}>${esc(x.name)}</option>`).join('')}</select><select id="adminOrderCourier"><option value="">كل المندوبين</option>${couriers().map(x=>`<option value="${esc(x.id)}" ${state.courier===String(x.id)?'selected':''}>${esc(x.name)}</option>`).join('')}</select><select id="adminOrderKind"><option value="">كل الأنواع</option><option value="booklet" ${state.kind==='booklet'?'selected':''}>ملازم</option><option value="stationery" ${state.kind==='stationery'?'selected':''}>قرطاسية</option><option value="gift" ${state.kind==='gift'?'selected':''}>هدايا</option><option value="product" ${state.kind==='product'?'selected':''}>منتج</option></select><select id="adminOrderPeriod"><option value="all" ${state.period==='all'?'selected':''}>كل التواريخ</option><option value="today" ${state.period==='today'?'selected':''}>اليوم</option><option value="week" ${state.period==='week'?'selected':''}>آخر 7 أيام</option><option value="month" ${state.period==='month'?'selected':''}>هذا الشهر</option><option value="custom" ${state.period==='custom'?'selected':''}>فترة مخصصة</option></select><input id="adminOrderFrom" type="date" value="${esc(state.from)}" ${state.period==='custom'?'':'hidden'}><input id="adminOrderTo" type="date" value="${esc(state.to)}" ${state.period==='custom'?'':'hidden'}><button type="button" onclick="adminOrdersClear()">مسح</button></section>
    <section class="admin-orders-v126-list">${list.length?list.map(orderCard).join(''):'<div class="admin-orders-v126-empty">لا توجد طلبات مطابقة.</div>'}</section></section>`;
    bind();
  }
  function orderCard(o){
    const st=statusOf(o),late=overdue(o),m=orderMeta(o.id),assigned=o.courier_id||o.delegate_id;
    return `<article class="admin-order-v126 ${late?'is-overdue':''}"><div class="admin-order-v126-main"><div class="admin-order-v126-title"><span>${esc(o.order_number||o.id)}</span><b>${esc(o.title||'طلب')} × ${Number(o.qty||1)}</b>${late?'<em>متأخر</em>':''}</div><small>${esc(o.student_name||'بدون اسم')} • ${esc(o.student_phone||'بدون هاتف')}</small></div><div class="admin-order-v126-meta"><span>المبلغ <b>${moneyText(o.total||0)} د.ع</b></span><span>${homeDelivery(o)?'المنطقة':'المكتبة'} <b>${esc(homeDelivery(o)?(normalizeArea(o.delivery_area)||'غير محددة'):libraryName(o.library_id||o.pickup_library_id))}</b></span><span>المندوب <b>${esc(courierName(assigned))}</b></span></div><div class="admin-order-v126-state"><span class="pill ${esc(st)}">${esc(labelOf(st))}</span><small>${esc(dateText(o))}</small>${(m.notes||[]).length?`<small>ملاحظات الإدارة: ${(m.notes||[]).length}</small>`:''}</div><div class="admin-order-v126-actions"><button class="secondary" onclick="adminOrderDetails('${esc(o.id)}')">تفاصيل</button><button class="secondary" onclick="adminOrderPrint('${esc(o.id)}')">وصل</button>${o.student_phone?`<button class="whatsapp" onclick="adminOrderWhatsapp('${esc(o.id)}')">واتساب</button>`:''}</div></article>`;
  }
  function bind(){
    const map={adminOrderSearch:['q','input'],adminOrderStatus:['status','change'],adminOrderLibrary:['library','change'],adminOrderCourier:['courier','change'],adminOrderKind:['kind','change'],adminOrderPeriod:['period','change'],adminOrderFrom:['from','change'],adminOrderTo:['to','change']};
    Object.entries(map).forEach(([id,[key,event]])=>{const el=$(id);if(el)el.addEventListener(event,()=>{state[key]=el.value;render()})});
  }
  async function updateOrder(id,patch){
    if(busy)throw new Error('العملية قيد التنفيذ');busy=true;
    try{
      if(typeof window.update!=='function')throw new Error('دالة تحديث الطلب غير متاحة');
      await window.update('orders',{...patch,updated_at:now()},{id});
      if(typeof window.load==='function')await window.load();
    }finally{busy=false}
  }
  function statusPatch(order,status,reason=''){
    const history=[...arr(order.status_history),{status,at:now(),by:window.current?.name||window.current?.username||'المدير'}];
    const patch={status,status_history:history};
    if(status==='cancelled'){patch.assignment_status='cancelled';patch.cancelled_at=now();patch.cancellation_reason=reason||null}
    if(status==='assigned'){patch.assignment_status='assigned';patch.assigned_at=order.assigned_at||now()}
    if(status==='accepted'){patch.assignment_status='accepted';patch.accepted_at=now()}
    if(status==='picked_up')patch.picked_up_at=now();
    if(status==='out_for_delivery')patch.out_for_delivery_at=now();
    if(status==='completed'||status==='delivered'){patch.assignment_status='completed';patch.completed_at=now();patch.delivered_at=now()}
    return patch;
  }
  async function changeStatus(id,status,reason=''){
    const order=orders().find(x=>String(x.id)===String(id));if(!order)return alert('الطلب غير موجود');
    try{
      if(!window.AlinFinance?.transitionOrder)throw new Error('خدمة الانتقال الذري غير جاهزة');
      await window.AlinFinance.transitionOrder(id,status,reason);
      addHistory(id,'تغيير الحالة',`${labelOf(status)}${reason?' — '+reason:''}`);
      if(typeof window.audit==='function')await window.audit('order',`تحديث الطلب ${order.order_number||id} إلى ${status}${reason?' بسبب: '+reason:''}`);
      if((status==='completed'||status==='delivered')&&window.AlinNotifications?.send)await window.AlinNotifications.send({role:'admin',title:'طلب مسلّم',message:`تم تسليم الطلب ${order.order_number||id}`});
      render();notify('تم تحديث حالة الطلب والحسابات');
    }catch(error){alert('تعذر تحديث الطلب: '+friendlyError(error))}
  }
  async function assign(id){
    const order=orders().find(x=>String(x.id)===String(id));if(!order)return;
    const libraryId=$('v220AssignLibrary')?.value||null,courierId=$('v220AssignCourier')?.value||null;
    if(homeDelivery(order)&&!courierId)return alert('اختر مندوبًا مطابقًا للمنطقة');
    try{
      const patch={library_id:libraryId,pickup_library_id:libraryId,courier_id:courierId,delegate_id:courierId};
      if(courierId){Object.assign(patch,statusPatch(order,'assigned'))}else{patch.assignment_status='pending_admin';patch.assigned_at=null}
      await updateOrder(id,patch);
      addHistory(id,'تعيين الطلب',`المكتبة: ${libraryName(libraryId)}، المندوب: ${courierName(courierId)}`);
      if(typeof window.audit==='function')await window.audit('order',`تعيين الطلب ${order.order_number||id}`);
      render();details(id);notify('تم حفظ التعيين');
    }catch(error){alert('تعذر حفظ التعيين: '+friendlyError(error))}
  }
  function details(id){
    const o=orders().find(x=>String(x.id)===String(id));if(!o)return;const m=orderMeta(id),matches=homeDelivery(o)?matchingCouriers(o.delivery_area):couriers(),assigned=String(o.courier_id||o.delegate_id||'');
    if(assigned&&!matches.some(c=>String(c.id)===assigned)){const current=couriers().find(c=>String(c.id)===assigned);if(current)matches.unshift(current)}
    let modal=$('adminOrderDetailsModal');if(!modal){modal=document.createElement('div');modal.id='adminOrderDetailsModal';modal.className='modal hidden';modal.innerHTML='<div class="modal-card"><button class="x" onclick="document.getElementById(\'adminOrderDetailsModal\').classList.add(\'hidden\')">×</button><div id="adminOrderDetailsBox"></div></div>';document.body.appendChild(modal)}
    $('adminOrderDetailsBox').innerHTML=`<div class="v126-detail-head"><div><small>رقم الطلب</small><h2>${esc(o.order_number||o.id)}</h2></div><span class="pill ${esc(statusOf(o))}">${esc(labelOf(o))}</span></div><section class="v126-detail-grid"><div><small>الطالب</small><b>${esc(o.student_name||'—')}</b></div><div><small>الهاتف</small><b>${esc(o.student_phone||'—')}</b></div><div><small>العنصر</small><b>${esc(o.title||'—')}</b></div><div><small>الكمية</small><b>${Number(o.qty||1)}</b></div><div><small>المجموع الفرعي</small><b>${moneyText(Number(o.total||0)+Number(o.discount||0)-Number(o.delivery_fee||0))} د.ع</b></div><div><small>الخصم</small><b>${moneyText(o.discount||0)} د.ع</b></div><div><small>أجرة التوصيل</small><b>${moneyText(o.delivery_fee||0)} د.ع</b></div><div><small>الإجمالي</small><b>${moneyText(o.total||0)} د.ع</b></div><div><small>طريقة الاستلام</small><b>${homeDelivery(o)?'عن طريق المندوب':'استلام من المكتبة'}</b></div><div><small>المنطقة</small><b>${esc(normalizeArea(o.delivery_area)||'—')}</b></div><div><small>أقرب نقطة دالة</small><b>${esc(o.delivery_landmark||'—')}</b></div><div><small>ملاحظات الطالب</small><b>${esc(o.notes||'—')}</b></div></section><section class="v126-assign"><h3>تعيين الطلب</h3><select id="v220AssignLibrary" ${homeDelivery(o)?'disabled':''}><option value="">بدون مكتبة</option>${libraries().map(x=>`<option value="${esc(x.id)}" ${String(o.library_id||o.pickup_library_id||'')===String(x.id)?'selected':''}>${esc(x.name)}</option>`).join('')}</select><select id="v220AssignCourier" ${homeDelivery(o)?'':'disabled'}><option value="">بدون مندوب</option>${matches.map(x=>`<option value="${esc(x.id)}" ${assigned===String(x.id)?'selected':''}>${esc(x.name)}${courierAreas(x).length?' — '+esc(courierAreas(x).join('، ')):''}</option>`).join('')}</select><button onclick="adminOrderAssign('${esc(o.id)}')">حفظ التعيين</button>${homeDelivery(o)?`<small>المندوبون المطابقون لمنطقة ${esc(normalizeArea(o.delivery_area)||'غير محددة')}: ${matches.length}</small>`:''}</section><section class="v126-notes"><h3>ملاحظات الإدارة</h3><div class="v126-note-form"><textarea id="v220AdminNote" placeholder="اكتب ملاحظة داخلية على الطلب"></textarea><button onclick="adminOrderAddNote('${esc(o.id)}')">إضافة</button></div>${arr(m.notes).slice().reverse().map(n=>`<article><b>${esc(n.actor||'المدير')}</b><small>${esc(new Date(n.at).toLocaleString(window.AlinI18n?.locale?.()||'ar-IQ'))}</small><p>${esc(n.text)}</p></article>`).join('')||'<p class="muted">لا توجد ملاحظات إدارية.</p>'}</section><section class="v126-history"><h3>سجل حركة الطلب</h3>${[...arr(o.status_history).map(h=>({at:h.at,actor:h.by||'النظام',action:'حالة الطلب',details:labelOf(h.status)})),...arr(m.history)].sort((a,b)=>String(b.at||'').localeCompare(String(a.at||''))).map(h=>`<article><b>${esc(h.action)}</b><span>${esc(h.actor||'المدير')}</span><small>${esc(h.at?new Date(h.at).toLocaleString(window.AlinI18n?.locale?.()||'ar-IQ'):'—')}</small><p>${esc(h.details||'')}</p></article>`).join('')||'<p class="muted">لا توجد حركة مسجلة بعد.</p>'}</section><div class="v126-detail-actions"><button onclick="adminOrderStatus('${esc(o.id)}','processing')">قيد التجهيز</button><button onclick="adminOrderStatus('${esc(o.id)}','ready')">جاهز</button><button onclick="adminOrderStatus('${esc(o.id)}','completed')">مكتمل</button><button class="secondary" onclick="adminOrderPrint('${esc(o.id)}')">طباعة وصل</button>${o.student_phone?`<button class="whatsapp" onclick="adminOrderWhatsapp('${esc(o.id)}')">واتساب</button>`:''}<button class="danger" onclick="adminOrderCancel('${esc(o.id)}')">إلغاء مع سبب</button></div>`;
    modal.classList.remove('hidden');
  }
  function printOrder(id){
    const o=orders().find(x=>String(x.id)===String(id));if(!o)return;const w=window.open('','_blank','width=760,height=900');if(!w)return alert('اسمح بالنوافذ المنبثقة للطباعة');
    w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>وصل طلب ${esc(o.order_number||o.id)}</title><style>body{font-family:Tahoma;padding:36px;color:#102b50}.receipt{max-width:680px;margin:auto;border:1px solid #dbe3ed;border-radius:24px;padding:28px}.brand{text-align:center;border-bottom:2px solid #d9a72d;padding-bottom:16px}.row{display:flex;justify-content:space-between;padding:11px 0;border-bottom:1px dashed #dbe3ed}.total{font-size:22px;font-weight:bold;color:#96680f}.note{margin-top:20px;color:#667085;text-align:center}@media print{button{display:none}}</style></head><body><div class="receipt"><div class="brand"><h1>منصة آلين</h1><p>وصل طلب</p></div><div class="row"><span>رقم الطلب</span><b>${esc(o.order_number||o.id)}</b></div><div class="row"><span>الطالب</span><b>${esc(o.student_name||'—')}</b></div><div class="row"><span>الهاتف</span><b>${esc(o.student_phone||'—')}</b></div><div class="row"><span>العنصر</span><b>${esc(o.title||'—')} × ${Number(o.qty||1)}</b></div><div class="row"><span>المنطقة/المكتبة</span><b>${esc(homeDelivery(o)?(normalizeArea(o.delivery_area)||'—'):libraryName(o.library_id||o.pickup_library_id))}</b></div><div class="row"><span>المندوب</span><b>${esc(courierName(o.courier_id||o.delegate_id))}</b></div><div class="row"><span>الخصم</span><b>${moneyText(o.discount||0)} د.ع</b></div><div class="row"><span>أجرة التوصيل</span><b>${moneyText(o.delivery_fee||0)} د.ع</b></div><div class="row"><span>الحالة</span><b>${esc(labelOf(o))}</b></div><div class="row total"><span>الإجمالي</span><b>${moneyText(o.total||0)} د.ع</b></div><p class="note">تاريخ الطباعة: ${new Date().toLocaleString(window.AlinI18n?.locale?.()||'ar-IQ')}</p><button onclick="print()">طباعة</button></div></body></html>`);w.document.close();w.focus();
  }

  window.renderOrdersAdmin=render;
  window.adminOrdersClear=()=>{Object.assign(state,{q:'',status:'',library:'',courier:'',kind:'',period:'all',from:'',to:''});render()};
  window.adminOrderStatus=changeStatus;
  window.orderStatus=changeStatus;
  window.adminOrderAssign=assign;
  window.adminOrderDetails=details;
  window.adminOrderAddNote=id=>{const input=$('v220AdminNote'),text=input?.value.trim();if(!text)return alert('اكتب الملاحظة أولاً');const m=orderMeta(id);m.notes=[...arr(m.notes),{at:now(),actor:window.current?.name||'المدير',text}];saveMeta(id,m);addHistory(id,'ملاحظة إدارية',text);details(id)};
  window.adminOrderCancel=id=>{const reason=prompt('اكتب سبب إلغاء الطلب:');if(reason===null)return;if(!reason.trim())return alert('سبب الإلغاء مطلوب');changeStatus(id,'cancelled',reason.trim());$('adminOrderDetailsModal')?.classList.add('hidden')};
  window.adminOrderWhatsapp=id=>{const o=orders().find(x=>String(x.id)===String(id));if(!o?.student_phone)return alert('لا يوجد رقم هاتف');let phone=String(o.student_phone).replace(/\D/g,'');if(phone.startsWith('0'))phone='964'+phone.slice(1);const text=encodeURIComponent(`مرحباً ${o.student_name||''}، بخصوص طلبك رقم ${o.order_number||o.id} في منصة آلين، حالته الحالية: ${labelOf(o)}.`);window.open(`https://wa.me/${phone}?text=${text}`,'_blank','noopener')};
  window.adminOrderPrint=printOrder;
  window.adminOrdersExport=()=>{const rows=[['رقم الطلب','الطالب','الهاتف','العنصر','الكمية','الإجمالي','الخصم','أجرة التوصيل','الحالة','المكتبة','المندوب','المنطقة','التاريخ'],...filtered().map(o=>[o.order_number||o.id,o.student_name||'',o.student_phone||'',o.title||'',o.qty||1,o.total||0,o.discount||0,o.delivery_fee||0,labelOf(o),libraryName(o.library_id||o.pickup_library_id),courierName(o.courier_id||o.delegate_id),normalizeArea(o.delivery_area),dateText(o)])];const csv='\ufeff'+rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`alin-orders-${new Date().toISOString().slice(0,10)}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),250)};
})();

;
/* modules/admin/booklets.js */
// ALIN Admin Booklets — single implementation (v2.2.6)
(function(){
  'use strict';

  const state={q:'',status:'all',grade:'all',subject:'all',teacher:'all'};
  const escv=value=>typeof window.esc==='function'?window.esc(value):String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const moneyv=value=>typeof window.money==='function'?window.money(value):Number(value||0).toLocaleString(window.AlinI18n?.locale?.()||'ar-IQ');
  const books=()=>Array.isArray(window.db?.booklets)?window.db.booklets:[];
  const teachers=()=>Array.isArray(window.db?.accounts?.teachers)?window.db.accounts.teachers:[];
  const orders=()=>Array.isArray(window.db?.orders)?window.db.orders:[];
  const root=()=>window.adminContent||document.getElementById('adminContent');
  const statusValue=book=>String(book?.publish_status||book?.status||'draft').toLowerCase();
  const statusLabel=status=>({published:'منشورة',hidden:'مخفية',draft:'مسودة',review:'قيد المراجعة',pending:'قيد المراجعة',archived:'مؤرشفة'}[String(status||'draft').toLowerCase()]||String(status||'مسودة'));
  const teacherName=id=>teachers().find(item=>String(item.id)===String(id))?.name||'مدرس غير محدد';
  const unique=values=>[...new Set(values.map(value=>String(value||'').trim()).filter(Boolean))];
  const orderCount=id=>orders().filter(order=>{
    const itemId=order.item_id||order.booklet_id||order.item?.id;
    const kind=String(order.kind||order.item_kind||order.item_type||'booklet').toLowerCase();
    return String(itemId)===String(id)&&kind==='booklet';
  }).length;
  const coverUrl=book=>{
    const value=book?.cover_path||book?.cover_url||book?.cover||'';
    if(!value)return '';
    try{return typeof window.mediaUrl==='function'?window.mediaUrl(value):value}catch(_){return value}
  };
  const upload=async(bucket,file,options)=>{
    if(!file||!file.name)return '';
    const uploader=window.uploadFileV52||window.uploadFile;
    if(typeof uploader!=='function')throw new Error('خدمة رفع الملفات غير متاحة');
    return uploader(bucket,file,options);
  };
  const statusPayload=status=>{
    const normalized=String(status||'draft');
    return {
      status:normalized,
      publish_status:normalized,
      published:normalized==='published',
      is_published:normalized==='published'
    };
  };

  async function reloadAndRender(){
    if(typeof window.load==='function')await window.load();
    renderBookletsAdmin();
  }

  function filteredBooks(){
    let list=[...books()];
    const q=state.q.trim().toLowerCase();
    if(q)list=list.filter(book=>[book.title,book.subject,book.grade,teacherName(book.teacher_id)].some(value=>String(value||'').toLowerCase().includes(q)));
    if(state.status!=='all')list=list.filter(book=>statusValue(book)===state.status||(state.status==='review'&&statusValue(book)==='pending'));
    if(state.grade!=='all')list=list.filter(book=>String(book.grade||'')===state.grade);
    if(state.subject!=='all')list=list.filter(book=>String(book.subject||'')===state.subject);
    if(state.teacher!=='all')list=list.filter(book=>String(book.teacher_id||'')===state.teacher);
    return list.sort((a,b)=>String(b.updated_at||b.created_at||b.id||'').localeCompare(String(a.updated_at||a.created_at||a.id||'')));
  }

  function ensureModal(){
    let modal=document.getElementById('alinBookletEditorModal');
    if(modal)return modal;
    modal=document.createElement('div');
    modal.id='alinBookletEditorModal';
    modal.className='modal hidden';
    modal.innerHTML='<div class="modal-card"><button class="x" type="button" onclick="closeBookletEditor()">×</button><div id="alinBookletEditorBody"></div></div>';
    document.body.appendChild(modal);
    return modal;
  }

  function formHtml(book={}){
    return `<form id="alinBookletEditorForm" class="form-grid" data-id="${escv(book.id||'')}">
      <input name="title" value="${escv(book.title||'')}" placeholder="اسم الملزمة" required>
      <select name="teacherId" required><option value="">اختر المدرس</option>${teachers().filter(item=>String(item.status||'active')==='active'||String(item.id)===String(book.teacher_id)).map(item=>`<option value="${escv(item.id)}" ${String(item.id)===String(book.teacher_id)?'selected':''}>${escv(item.name)}</option>`).join('')}</select>
      <input name="subject" value="${escv(book.subject||'')}" placeholder="المادة">
      <input name="grade" value="${escv(book.grade||'')}" placeholder="الصف">
      <input name="term" value="${escv(book.term||'')}" placeholder="الفصل">
      <input name="edition" value="${escv(book.edition||book.year||'')}" placeholder="الإصدار أو السنة">
      <input name="price" type="number" min="0" value="${Number(book.price||0)}" placeholder="السعر" required>
      <input name="teacherShare" type="number" min="0" max="100" value="${Number(book.teacher_share_percent||0)}" placeholder="نسبة المدرس %">
      <label>غلاف الملزمة<input name="cover" type="file" accept="image/*"></label>
      <label>ملف PDF ${book.file_path?'(اتركه فارغًا للاحتفاظ بالحالي)':''}<input name="bookletFile" type="file" accept=".pdf,application/pdf" ${book.file_path?'':'required'}></label>
      <textarea name="adminNote" rows="3" placeholder="ملاحظة داخلية">${escv(book.admin_note||'')}</textarea>
      <div class="row-actions"><button type="button" class="secondary" onclick="saveBooklet('draft')">حفظ مسودة</button><button type="button" class="warning" onclick="saveBooklet('review')">قيد المراجعة</button><button type="button" onclick="saveBooklet('published')">حفظ ونشر</button></div>
    </form>`;
  }

  function openBookletEditor(id=''){
    const book=id?books().find(item=>String(item.id)===String(id)):{};
    if(id&&!book)return;
    const modal=ensureModal();
    modal.querySelector('#alinBookletEditorBody').innerHTML=`<h2>${id?'تعديل الملزمة':'إضافة ملزمة'}</h2>${formHtml(book||{})}`;
    modal.classList.remove('hidden');
    modal.hidden=false;
  }

  function closeBookletEditor(){
    const modal=document.getElementById('alinBookletEditorModal');
    if(!modal)return;
    modal.classList.add('hidden');
    modal.hidden=true;
  }

  async function saveBooklet(status='published'){
    const form=document.getElementById('alinBookletEditorForm')||document.getElementById('bookForm');
    if(!form)return;
    const data=new FormData(form);
    const id=String(form.dataset.id||'');
    const existing=id?books().find(item=>String(item.id)===id):null;
    const bookletId=existing?.id||(typeof window.uid==='function'?window.uid('B'):`B-${Date.now()}`);
    const title=String(data.get('title')||'').trim();
    const teacherId=String(data.get('teacherId')||'').trim();
    const price=Number(data.get('price')||0);
    if(!title)return alert('اكتب اسم الملزمة');
    if(!teacherId)return alert('اختر المدرس');
    if(!Number.isFinite(price)||price<0)return alert('السعر غير صحيح');
    try{
      const coverFile=data.get('cover');
      const pdfFile=data.get('bookletFile');
      let coverPath=existing?.cover_path||'';
      let filePath=existing?.file_path||'';
      let fileName=existing?.file_name||'';
      if(coverFile&&coverFile.name)coverPath=await upload('covers',coverFile,{type:'image'});
      if(pdfFile&&pdfFile.name){filePath=await upload('booklets',pdfFile,{type:'pdf',required:true,entityId:bookletId,maxBytes:25*1024*1024});fileName=pdfFile.name}
      if(!filePath)throw new Error('ملف PDF مطلوب');
      const payload={
        title,teacher_id:teacherId,
        subject:String(data.get('subject')||'').trim(),
        grade:String(data.get('grade')||'').trim(),
        term:String(data.get('term')||'').trim(),
        edition:String(data.get('edition')||'').trim(),
        year:String(data.get('edition')||'').trim(),
        price,
        teacher_share_percent:Math.max(0,Math.min(100,Number(data.get('teacherShare')||0))),
        admin_note:String(data.get('adminNote')||'').trim(),
        cover_path:coverPath,file_path:filePath,file_name:fileName,
        updated_at:new Date().toISOString(),
        ...statusPayload(status)
      };
      if(existing){
        await window.update('booklets',payload,{id:existing.id});
        if(typeof window.audit==='function')await window.audit('booklet',`تعديل الملزمة ${title} وحفظها بحالة ${statusLabel(status)}`);
      }else{
        payload.id=bookletId;
        payload.created_at=new Date().toISOString();
        await window.insert('booklets',payload);
        if(typeof window.audit==='function')await window.audit('booklet',`إضافة الملزمة ${title} بحالة ${statusLabel(status)}`);
      }
      closeBookletEditor();
      await reloadAndRender();
      if(typeof window.renderStore==='function')window.renderStore();
      if(typeof window.toast==='function')window.toast(existing?'تم تحديث الملزمة':'تمت إضافة الملزمة');
    }catch(error){
      console.error('[ALIN booklet save]',error);
      alert(error?.message||'تعذر حفظ الملزمة');
    }
  }

  async function setBookStatus(id,status){
    const book=books().find(item=>String(item.id)===String(id));if(!book)return;
    try{
      await window.update('booklets',{...statusPayload(status),updated_at:new Date().toISOString()},{id:book.id});
      if(typeof window.audit==='function')await window.audit('booklet',`تغيير حالة الملزمة ${book.title||book.id} إلى ${statusLabel(status)}`);
      await reloadAndRender();
      if(typeof window.renderStore==='function')window.renderStore();
      if(typeof window.toast==='function')window.toast(`تم تغيير الحالة إلى ${statusLabel(status)}`);
    }catch(error){alert(error?.message||'تعذر تغيير حالة الملزمة')}
  }

  async function deleteBooklet(id){
    const book=books().find(item=>String(item.id)===String(id));if(!book)return;
    const count=orderCount(id);
    if(count>0){
      if(confirm(`الملزمة مرتبطة بـ ${count} طلب ولا يمكن حذفها. هل تريد إخفاءها؟`))await setBookStatus(id,'hidden');
      return;
    }
    if(!confirm(`حذف الملزمة ${book.title||''} نهائيًا؟`))return;
    try{
      await window.removeRow('booklets',{id:book.id});
      if(typeof window.audit==='function')await window.audit('booklet',`حذف الملزمة ${book.title||book.id}`);
      await reloadAndRender();
      if(typeof window.renderStore==='function')window.renderStore();
      if(typeof window.toast==='function')window.toast('تم حذف الملزمة');
    }catch(error){alert(error?.message||'تعذر حذف الملزمة')}
  }

  async function previewBooklet(id){
    const book=books().find(item=>String(item.id)===String(id));if(!book?.file_path)return alert('ملف PDF غير متاح');
    const preview=window.open('about:blank','_blank');
    if(preview){preview.opener=null;preview.document.write('<p dir="rtl" style="font-family:Arial;padding:24px">جاري تجهيز المعاينة الآمنة...</p>');}
    try{
      const resolved=await window.alinResolveStoredFile(book.file_path,'booklets');
      if(!resolved?.url)throw new Error('الملف غير محمي أو غير متاح');
      if(preview)preview.location.replace(resolved.url);else window.location.href=resolved.url;
    }catch(error){
      try{preview?.close();}catch(_){ }
      alert(error?.message||'تعذر فتح المعاينة أو لا توجد صلاحية');
    }
  }

  function card(book){
    const status=statusValue(book);
    const cover=coverUrl(book);
    return `<article class="admin-v128-card"><div class="admin-v128-cover">${cover?`<img src="${escv(cover)}" alt="غلاف ${escv(book.title||'الملزمة')}">`:'<span>آ</span>'}<em class="admin-v128-status ${escv(status)}">${statusLabel(status)}</em></div><div class="admin-v128-card-body"><h3>${escv(book.title||'ملزمة بدون اسم')}</h3><div class="admin-v128-card-meta"><div><small>المدرس</small><b>${escv(teacherName(book.teacher_id))}</b></div><div><small>المادة / الصف</small><b>${escv(book.subject||'—')} • ${escv(book.grade||'—')}</b></div><div><small>الإصدار</small><b>${escv(book.edition||book.year||'—')}</b></div><div><small>الطلبات</small><b>${orderCount(book.id)}</b></div><div><small>السعر</small><b class="price">${moneyv(book.price)} د.ع</b></div></div><div class="admin-v128-card-actions"><button type="button" class="secondary" onclick="previewBooklet('${escv(book.id)}')">معاينة</button><button type="button" class="secondary" onclick="editBooklet('${escv(book.id)}')">تعديل</button><button type="button" class="warning" onclick="setBookStatus('${escv(book.id)}','${status==='published'?'hidden':'published'}')">${status==='published'?'إخفاء':'نشر'}</button><button type="button" class="danger" onclick="deleteBooklet('${escv(book.id)}')">حذف</button></div></div></article>`;
  }

  function renderBookletsAdmin(){
    const container=root();if(!container)return;
    const all=books();
    const list=filteredBooks();
    const grades=unique(all.map(item=>item.grade));
    const subjects=unique(all.map(item=>item.subject));
    const counts={published:0,hidden:0,draft:0,review:0};
    all.forEach(item=>{const status=statusValue(item)==='pending'?'review':statusValue(item);if(Object.prototype.hasOwnProperty.call(counts,status))counts[status]++});
    container.innerHTML=`<section class="admin-v128-booklets"><header class="admin-v128-head"><div><h2>إدارة الملازم</h2><p>إضافة وتعديل ونشر الملازم من تنفيذ واحد مستقل عن platform.js.</p></div><button type="button" onclick="uploadBooklet()">إضافة ملزمة</button></header><section class="admin-v128-stats"><article><small>الإجمالي</small><strong>${all.length}</strong></article><article class="green"><small>المنشورة</small><strong>${counts.published}</strong></article><article class="gray"><small>المخفية</small><strong>${counts.hidden}</strong></article><article class="gold"><small>المسودات والمراجعة</small><strong>${counts.draft+counts.review}</strong></article></section><section class="admin-v128-toolbar"><input id="alinBookletSearch" value="${escv(state.q)}" placeholder="بحث باسم الملزمة أو المدرس أو المادة"><select id="alinBookletStatus"><option value="all">كل الحالات</option><option value="published" ${state.status==='published'?'selected':''}>منشورة</option><option value="hidden" ${state.status==='hidden'?'selected':''}>مخفية</option><option value="draft" ${state.status==='draft'?'selected':''}>مسودة</option><option value="review" ${state.status==='review'?'selected':''}>قيد المراجعة</option><option value="archived" ${state.status==='archived'?'selected':''}>مؤرشفة</option></select><select id="alinBookletGrade"><option value="all">كل الصفوف</option>${grades.map(value=>`<option value="${escv(value)}" ${state.grade===value?'selected':''}>${escv(value)}</option>`).join('')}</select><select id="alinBookletSubject"><option value="all">كل المواد</option>${subjects.map(value=>`<option value="${escv(value)}" ${state.subject===value?'selected':''}>${escv(value)}</option>`).join('')}</select><select id="alinBookletTeacher"><option value="all">كل المدرسين</option>${teachers().map(item=>`<option value="${escv(item.id)}" ${state.teacher===String(item.id)?'selected':''}>${escv(item.name)}</option>`).join('')}</select></section><div class="admin-v128-results"><span>تم العثور على <b>${list.length}</b> ملزمة</span></div>${list.length?`<section class="admin-v128-grid">${list.map(card).join('')}</section>`:'<div class="empty">لا توجد ملازم مطابقة.</div>'}</section>`;
    const bind=(id,key,event='change')=>document.getElementById(id)?.addEventListener(event,eventObject=>{state[key]=eventObject.target.value;renderBookletsAdmin()});
    bind('alinBookletSearch','q','input');bind('alinBookletStatus','status');bind('alinBookletGrade','grade');bind('alinBookletSubject','subject');bind('alinBookletTeacher','teacher');
  }

  window.renderBookletsAdmin=renderBookletsAdmin;
  window.uploadBooklet=()=>openBookletEditor('');
  window.editBooklet=openBookletEditor;
  window.saveBooklet=saveBooklet;
  window.closeBookletEditor=closeBookletEditor;
  window.setBookStatus=setBookStatus;
  window.deleteBooklet=deleteBooklet;
  window.archiveBooklet=id=>setBookStatus(id,'archived');
  window.previewBooklet=previewBooklet;
  window.AlinAdminModules?.register?.('booklets',renderBookletsAdmin);
})();

;
/* modules/admin/products.js */
// ALIN Admin Products & Categories — single implementation (v2.2.6)
(function(){
  'use strict';

  const state={q:'',type:'',status:'',stock:'',sort:'newest'};
  const escv=value=>typeof window.esc==='function'?window.esc(value):String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const moneyv=value=>typeof window.money==='function'?window.money(value):Number(value||0).toLocaleString(window.AlinI18n?.locale?.()||'ar-IQ');
  const products=()=>Array.isArray(window.db?.products)?window.db.products:[];
  const categories=()=>Array.isArray(window.db?.categories)?window.db.categories:[];
  const orders=()=>Array.isArray(window.db?.orders)?window.db.orders:[];
  const root=()=>window.adminContent||document.getElementById('adminContent');
  const normalizeType=value=>{
    const type=String(value||'stationery').trim().toLowerCase();
    if(type==='gift'||type==='gifts')return 'gift';
    if(type==='stationary'||type==='stationery')return 'stationery';
    return type||'stationery';
  };
  const typeLabel=value=>normalizeType(value)==='gift'?'هدايا':'قرطاسية';
  const statusLabel=value=>({published:'منشور',hidden:'مخفي',draft:'مسودة',archived:'مؤرشف',inactive:'غير فعال'}[String(value||'published').toLowerCase()]||'منشور');
  const categoryList=type=>categories().filter(item=>normalizeType(item.type)===normalizeType(type)&&String(item.status||'active')==='active');
  const uploadImage=async file=>{
    if(!file||!file.name)return '';
    const uploader=window.uploadFileV52||window.uploadFile;
    if(typeof uploader!=='function')throw new Error('خدمة رفع الصور غير متاحة');
    return uploader('products',file,{type:'image'});
  };
  const imageUrl=item=>{
    const value=item?.image_path||item?.image_url||item?.image||'';
    if(!value)return '';
    try{return typeof window.mediaUrl==='function'?window.mediaUrl(value):value}catch(_){return value}
  };
  const lowStockLimit=item=>Number(item?.low_stock_limit||window.db?.settings?.low_stock_default||5);
  const linkedOrders=id=>orders().filter(order=>{
    const itemId=order.item_id||order.product_id||order.item?.id;
    const kind=String(order.kind||order.item_kind||order.item_type||'product').toLowerCase();
    return String(itemId)===String(id)&&kind!=='booklet';
  });

  async function reloadAndRender(renderFn){
    if(typeof window.load==='function')await window.load();
    if(typeof renderFn==='function')renderFn();
  }

  function filteredProducts(){
    let list=[...products()];
    const q=state.q.trim().toLowerCase();
    if(q)list=list.filter(item=>[item.name,item.title,item.category,item.description,item.details].some(value=>String(value||'').toLowerCase().includes(q)));
    if(state.type)list=list.filter(item=>normalizeType(item.type||item.category_id)===state.type);
    if(state.status)list=list.filter(item=>String(item.status||'published')===state.status);
    if(state.stock==='available')list=list.filter(item=>Number(item.stock)>lowStockLimit(item));
    if(state.stock==='low')list=list.filter(item=>Number(item.stock)>0&&Number(item.stock)<=lowStockLimit(item));
    if(state.stock==='out')list=list.filter(item=>Number(item.stock)<=0);
    if(state.sort==='name')list.sort((a,b)=>String(a.name||a.title||'').localeCompare(String(b.name||b.title||''),'ar'));
    else if(state.sort==='priceAsc')list.sort((a,b)=>Number(a.price)-Number(b.price));
    else if(state.sort==='priceDesc')list.sort((a,b)=>Number(b.price)-Number(a.price));
    else if(state.sort==='stock')list.sort((a,b)=>Number(a.stock)-Number(b.stock));
    else list.sort((a,b)=>String(b.created_at||b.id||'').localeCompare(String(a.created_at||a.id||'')));
    return list;
  }

  function categoryOptions(type,selected=''){
    const list=categoryList(type);
    const options=list.map(item=>`<option value="${escv(item.name)}" ${String(selected)===String(item.name)?'selected':''}>${escv(item.name)}</option>`).join('');
    return options||`<option value="${escv(selected||'عام')}">${escv(selected||'عام')}</option>`;
  }

  function productForm(item={}){
    const editing=Boolean(item.id);
    const type=normalizeType(item.type||item.category_id||'stationery');
    return `<form id="alinProductEditorForm" class="form-grid admin-product-editor" data-id="${escv(item.id||'')}">
      <select name="type" id="alinProductType" onchange="refreshProductCategories()"><option value="stationery" ${type==='stationery'?'selected':''}>قرطاسية</option><option value="gift" ${type==='gift'?'selected':''}>هدايا</option></select>
      <input name="name" value="${escv(item.name||item.title||'')}" placeholder="اسم المنتج" required>
      <select name="category" id="alinProductCategory">${categoryOptions(type,item.category||'')}</select>
      <input name="price" type="number" min="0" value="${Number(item.price||0)}" placeholder="السعر" required>
      <input name="stock" type="number" min="0" value="${Number(item.stock||0)}" placeholder="المخزون" required>
      <input name="lowStockLimit" type="number" min="0" value="${Number(item.low_stock_limit||window.db?.settings?.low_stock_default||5)}" placeholder="حد تنبيه المخزون">
      <textarea name="description" rows="3" placeholder="تفاصيل المنتج">${escv(item.description||item.details||'')}</textarea>
      <label>صورة المنتج<input name="image" type="file" accept="image/*"></label>
      <div class="row-actions"><button type="button" onclick="saveProduct()">${editing?'حفظ التعديل':'إضافة المنتج'}</button><button type="button" class="secondary" onclick="closeProductEditor()">إلغاء</button></div>
    </form>`;
  }

  function ensureEditor(){
    let modal=document.getElementById('alinProductEditorModal');
    if(modal)return modal;
    modal=document.createElement('div');
    modal.id='alinProductEditorModal';
    modal.className='modal hidden';
    modal.innerHTML='<div class="modal-card"><button class="x" type="button" onclick="closeProductEditor()">×</button><div id="alinProductEditorBody"></div></div>';
    document.body.appendChild(modal);
    return modal;
  }

  function openProductEditor(id=''){
    const item=id?products().find(row=>String(row.id)===String(id)):{};
    if(id&&!item)return;
    const modal=ensureEditor();
    modal.querySelector('#alinProductEditorBody').innerHTML=`<h2>${id?'تعديل المنتج':'إضافة منتج جديد'}</h2>${productForm(item||{})}`;
    modal.classList.remove('hidden');
    modal.hidden=false;
  }

  function closeProductEditor(){
    const modal=document.getElementById('alinProductEditorModal');
    if(!modal)return;
    modal.classList.add('hidden');
    modal.hidden=true;
  }

  async function saveProduct(){
    const form=document.getElementById('alinProductEditorForm');
    if(!form)return;
    const data=new FormData(form);
    const id=String(form.dataset.id||'');
    const existing=id?products().find(item=>String(item.id)===id):null;
    const name=String(data.get('name')||'').trim();
    const type=normalizeType(data.get('type'));
    const category=String(data.get('category')||'عام').trim()||'عام';
    const price=Number(data.get('price')||0);
    const stock=Number(data.get('stock')||0);
    const lowStockLimit=Number(data.get('lowStockLimit')||5);
    const description=String(data.get('description')||'').trim();
    if(!name)return alert('اكتب اسم المنتج');
    if(!Number.isFinite(price)||price<0)return alert('السعر غير صحيح');
    if(!Number.isFinite(stock)||stock<0)return alert('المخزون غير صحيح');
    try{
      const imageFile=data.get('image');
      const uploaded=imageFile&&imageFile.name?await uploadImage(imageFile):'';
      const payload={
        name,title:name,type,category,category_id:category,price,stock,
        low_stock_limit:Math.max(0,lowStockLimit||0),description,details:description,
        status:existing?.status||'published',updated_at:new Date().toISOString()
      };
      if(uploaded)payload.image_path=uploaded;
      if(existing){
        await window.update('products',payload,{id});
        if(typeof window.audit==='function')await window.audit('product',`تعديل المنتج ${name}`);
      }else{
        payload.id=typeof window.uid==='function'?window.uid('PR'):`PR-${Date.now()}`;
        payload.created_at=new Date().toISOString();
        await window.insert('products',payload);
        if(typeof window.audit==='function')await window.audit('product',`إضافة المنتج ${name}`);
      }
      closeProductEditor();
      await reloadAndRender(renderProductsAdmin);
      if(typeof window.renderStore==='function')window.renderStore();
      if(typeof window.toast==='function')window.toast(existing?'تم تعديل المنتج':'تمت إضافة المنتج وظهر في المتجر');
    }catch(error){
      console.error('[ALIN products save]',error);
      alert(error?.message||'تعذر حفظ المنتج');
    }
  }

  async function setProductStatus(id,status){
    const item=products().find(row=>String(row.id)===String(id));
    if(!item)return;
    try{
      await window.update('products',{status,updated_at:new Date().toISOString()},{id:item.id});
      if(typeof window.audit==='function')await window.audit('product',`تغيير حالة المنتج ${item.name||item.id} إلى ${statusLabel(status)}`);
      await reloadAndRender(renderProductsAdmin);
      if(typeof window.renderStore==='function')window.renderStore();
      if(typeof window.toast==='function')window.toast(status==='published'?'تم إظهار المنتج':'تم إخفاء المنتج');
    }catch(error){alert(error?.message||'تعذر تغيير حالة المنتج')}
  }

  async function deleteProduct(id){
    const item=products().find(row=>String(row.id)===String(id));
    if(!item)return;
    const linked=linkedOrders(id);
    if(linked.length){
      if(confirm(`هذا المنتج مرتبط بـ ${linked.length} طلب ولا يمكن حذفه. هل تريد إخفاءه من المتجر؟`))await setProductStatus(id,'hidden');
      return;
    }
    if(!confirm(`حذف المنتج ${item.name||''} نهائيًا؟`))return;
    try{
      await window.removeRow('products',{id:item.id});
      if(typeof window.audit==='function')await window.audit('product',`حذف المنتج ${item.name||item.id}`);
      await reloadAndRender(renderProductsAdmin);
      if(typeof window.renderStore==='function')window.renderStore();
      if(typeof window.toast==='function')window.toast('تم حذف المنتج');
    }catch(error){alert(error?.message||'تعذر حذف المنتج')}
  }

  function productCard(item){
    const image=imageUrl(item);
    const status=String(item.status||'published');
    const stock=Number(item.stock||0);
    const low=lowStockLimit(item);
    const stockClass=stock<=0?'out':stock<=low?'low':'ok';
    const stockText=stock<=0?'نافد':stock<=low?'مخزون قليل':'متوفر';
    return `<article class="admin-product-v129-card">
      <div class="admin-product-v129-image">${image?`<img src="${escv(image)}" alt="${escv(item.name||'منتج')}">`:`<span>${normalizeType(item.type)==='gift'?'🎁':'✏️'}</span>`}<em class="status ${escv(status)}">${statusLabel(status)}</em></div>
      <div class="admin-product-v129-body">
        <div class="admin-product-v129-title"><div><small>${typeLabel(item.type)} • ${escv(item.category||'عام')}</small><h3>${escv(item.name||item.title||'منتج')}</h3></div><strong>${moneyv(item.price)} د.ع</strong></div>
        <p>${escv(item.description||item.details||'')}</p>
        <div class="admin-product-v129-meta"><span class="stock ${stockClass}">${stockText}: ${moneyv(stock)}</span><span>الرمز: ${escv(item.id||'—')}</span></div>
        <div class="admin-product-v129-actions"><button type="button" class="secondary" onclick="editProduct('${escv(item.id)}')">تعديل</button><button type="button" onclick="setProductStatus('${escv(item.id)}','${status==='published'?'hidden':'published'}')">${status==='published'?'إخفاء':'نشر'}</button><button type="button" class="danger" onclick="deleteProduct('${escv(item.id)}')">حذف</button></div>
      </div>
    </article>`;
  }

  function renderProductsAdmin(){
    const container=root();if(!container)return;
    const list=filteredProducts();
    const all=products();
    const published=all.filter(item=>String(item.status||'published')==='published').length;
    const hidden=all.filter(item=>String(item.status)==='hidden').length;
    const low=all.filter(item=>Number(item.stock)>0&&Number(item.stock)<=lowStockLimit(item)).length;
    const out=all.filter(item=>Number(item.stock)<=0).length;
    container.innerHTML=`<section class="admin-products-v129">
      <header class="admin-products-v129-head"><div><h2>إدارة المنتجات</h2><p>إدارة القرطاسية والهدايا والمخزون من تنفيذ واحد مستقل عن platform.js.</p></div><button type="button" onclick="addProduct()">إضافة منتج</button></header>
      <section class="admin-products-v129-stats"><article><small>الإجمالي</small><strong>${all.length}</strong></article><article><small>المنشورة</small><strong>${published}</strong></article><article><small>المخفية</small><strong>${hidden}</strong></article><article class="warn"><small>قليل المخزون</small><strong>${low}</strong></article><article class="danger"><small>النافدة</small><strong>${out}</strong></article></section>
      <section class="admin-products-v129-tools"><input id="alinProductSearch" value="${escv(state.q)}" placeholder="بحث بالاسم أو القسم"><select id="alinProductFilterType"><option value="">كل الأنواع</option><option value="stationery" ${state.type==='stationery'?'selected':''}>قرطاسية</option><option value="gift" ${state.type==='gift'?'selected':''}>هدايا</option></select><select id="alinProductFilterStatus"><option value="">كل الحالات</option><option value="published" ${state.status==='published'?'selected':''}>منشور</option><option value="hidden" ${state.status==='hidden'?'selected':''}>مخفي</option></select><select id="alinProductFilterStock"><option value="">كل المخزون</option><option value="available" ${state.stock==='available'?'selected':''}>متوفر</option><option value="low" ${state.stock==='low'?'selected':''}>قليل</option><option value="out" ${state.stock==='out'?'selected':''}>نافد</option></select><select id="alinProductSort"><option value="newest" ${state.sort==='newest'?'selected':''}>الأحدث</option><option value="name" ${state.sort==='name'?'selected':''}>الاسم</option><option value="priceAsc" ${state.sort==='priceAsc'?'selected':''}>السعر تصاعدي</option><option value="priceDesc" ${state.sort==='priceDesc'?'selected':''}>السعر تنازلي</option><option value="stock" ${state.sort==='stock'?'selected':''}>الأقل مخزونًا</option></select></section>
      <section class="admin-products-v129-grid">${list.length?list.map(productCard).join(''):'<div class="empty">لا توجد منتجات مطابقة.</div>'}</section>
    </section>`;
    const bind=(id,key,event='change')=>document.getElementById(id)?.addEventListener(event,eventObject=>{state[key]=eventObject.target.value;renderProductsAdmin()});
    bind('alinProductSearch','q','input');bind('alinProductFilterType','type');bind('alinProductFilterStatus','status');bind('alinProductFilterStock','stock');bind('alinProductSort','sort');
  }

  function refreshProductCategories(){
    const type=document.getElementById('alinProductType')?.value||'stationery';
    const select=document.getElementById('alinProductCategory');
    if(!select)return;
    const previous=select.value;
    select.innerHTML=categoryOptions(type,previous);
  }

  function renderCategoriesAdmin(){
    const container=root();if(!container)return;
    const labels={booklet:'ملازم',stationery:'قرطاسية',gift:'هدايا'};
    container.innerHTML=`<section class="admin-categories"><header><h2>إدارة الأقسام</h2><p>الأقسام المستخدمة في المتجر ونماذج المنتجات.</p></header><form id="alinCategoryForm" class="form-grid"><select name="type"><option value="booklet">ملازم</option><option value="stationery">قرطاسية</option><option value="gift">هدايا</option></select><input name="name" placeholder="اسم القسم" required><button type="button" onclick="addCategory()">إضافة قسم</button></form>${categories().length?categories().map(item=>`<div class="row"><div><b>${escv(item.name)}</b><small>${labels[normalizeType(item.type)]||labels[item.type]||escv(item.type)}</small></div><div class="row-actions"><button type="button" class="secondary" onclick="editCategory('${escv(item.id)}')">تعديل</button><button type="button" onclick="toggleCategory('${escv(item.id)}','${String(item.status||'active')==='active'?'hidden':'active'}')">${String(item.status||'active')==='active'?'إخفاء':'إظهار'}</button><button type="button" class="danger" onclick="deleteCategory('${escv(item.id)}')">حذف</button></div></div>`).join(''):'<div class="empty">لا توجد أقسام.</div>'}</section>`;
  }

  async function addCategory(){
    const form=document.getElementById('alinCategoryForm');if(!form)return;
    const data=new FormData(form),name=String(data.get('name')||'').trim(),type=normalizeType(data.get('type'));
    if(!name)return alert('اكتب اسم القسم');
    if(categories().some(item=>normalizeType(item.type)===type&&String(item.name||'').trim().toLowerCase()===name.toLowerCase()))return alert('هذا القسم موجود مسبقًا');
    try{
      await window.insert('categories',{id:typeof window.uid==='function'?window.uid('C'):`C-${Date.now()}`,type,name,status:'active',created_at:new Date().toISOString()});
      if(typeof window.audit==='function')await window.audit('category',`إضافة القسم ${name}`);
      await reloadAndRender(renderCategoriesAdmin);
      if(typeof window.toast==='function')window.toast('تمت إضافة القسم');
    }catch(error){alert(error?.message||'تعذر إضافة القسم')}
  }

  async function editCategory(id){
    const item=categories().find(row=>String(row.id)===String(id));if(!item)return;
    const name=prompt('اسم القسم',item.name||'');if(name===null||!name.trim())return;
    try{await window.update('categories',{name:name.trim(),updated_at:new Date().toISOString()},{id:item.id});if(typeof window.audit==='function')await window.audit('category',`تعديل القسم ${item.name} إلى ${name.trim()}`);await reloadAndRender(renderCategoriesAdmin);if(typeof window.toast==='function')window.toast('تم تعديل القسم')}catch(error){alert(error?.message||'تعذر تعديل القسم')}
  }

  async function toggleCategory(id,status){
    try{await window.update('categories',{status,updated_at:new Date().toISOString()},{id});await reloadAndRender(renderCategoriesAdmin)}catch(error){alert(error?.message||'تعذر تغيير حالة القسم')}
  }

  async function deleteCategory(id){
    const item=categories().find(row=>String(row.id)===String(id));if(!item)return;
    const linked=products().filter(product=>String(product.category||'')===String(item.name||''));
    if(linked.length)return alert(`لا يمكن حذف القسم لأنه مرتبط بـ ${linked.length} منتج. أخفِ القسم بدلًا من حذفه.`);
    if(!confirm(`حذف القسم ${item.name||''}؟`))return;
    try{await window.removeRow('categories',{id:item.id});if(typeof window.audit==='function')await window.audit('category',`حذف القسم ${item.name||item.id}`);await reloadAndRender(renderCategoriesAdmin);if(typeof window.toast==='function')window.toast('تم حذف القسم')}catch(error){alert(error?.message||'تعذر حذف القسم')}
  }

  window.renderProductsAdmin=renderProductsAdmin;
  window.renderCategoriesAdmin=renderCategoriesAdmin;
  window.refreshProductCategories=refreshProductCategories;
  window.addProduct=()=>openProductEditor('');
  window.editProduct=openProductEditor;
  window.saveProduct=saveProduct;
  window.closeProductEditor=closeProductEditor;
  window.setProductStatus=setProductStatus;
  window.deleteProduct=deleteProduct;
  window.addCategory=addCategory;
  window.editCategory=editCategory;
  window.toggleCategory=toggleCategory;
  window.deleteCategory=deleteCategory;
  // Compatibility aliases point to the same implementation, not wrappers.
  window.alinV73AddProduct=window.addProduct;
  window.alinV73EditProduct=window.editProduct;
  window.alinV73DeleteProduct=window.deleteProduct;
  window.alinV79ToggleProduct=id=>{const item=products().find(row=>String(row.id)===String(id));return item?setProductStatus(id,String(item.status||'published')==='published'?'hidden':'published'):undefined};
  window.AlinAdminModules?.register?.('products',renderProductsAdmin);
  window.AlinAdminModules?.register?.('categories',renderCategoriesAdmin);
})();

;
/* modules/admin/accounts-advanced.js */
// === admin/accounts-advanced.js ===
/* ===== admin/js/admin-accounts-v133.js ===== */

(function(){
  'use strict';
  const escx=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const arr=v=>Array.isArray(v)?v:[];
  const roleLabel={teacher:'مدرس',library:'مكتبة',courier:'مندوب',accountant:'محاسب',admin:'مدير'};
  const permissionLabels={dashboard:'الرئيسية',orders:'الطلبات',booklets:'الملازم',products:'المنتجات',accounts:'الحسابات',finance:'المالية',settlements:'التسويات',reports:'التقارير',notifications:'الإشعارات',settings:'الإعدادات'};
  const canEditPermissions=()=>window.current?.admin_level==='super_admin';
  let editingId=null;

  function parseAreas(v){return window.AlinCourierAreas?.parse?.(v)||[]}
  function areaList(){return window.AlinCourierAreas?.list?.()||[]}
  function accountAreas(x){return window.AlinCourierAreas?.forAccount?.(x)||parseAreas(x?.areas||x?.area)}
  function allAccounts(){
    const canonical=arr(window.db?.accounts?.all);
    const courierRows=arr(window.db?.couriers||window.db?.accounts?.couriers);
    if(canonical.length){
      const couriersById=new Map(courierRows.map(x=>[String(x.id),x]));
      return canonical.map(x=>{
        if(x.role!=='courier')return {...x};
        const courier=couriersById.get(String(x.id))||{};
        return {...x,...courier,id:x.id,role:'courier',auth_user_id:x.auth_user_id,status:x.status||courier.status};
      });
    }
    const teachers=arr(window.db?.accounts?.teachers).map(x=>({...x,role:'teacher'}));
    const libraries=arr(window.db?.accounts?.libraries).map(x=>({...x,role:'library'}));
    const couriers=courierRows.map(x=>({...x,role:'courier'}));
    const accountants=arr(window.db?.accounts?.accountants).map(x=>({...x,role:'accountant'}));
    return [...teachers,...libraries,...couriers,...accountants];
  }
  function account(id){return allAccounts().find(x=>String(x.id)===String(id))}
  function ordersFor(x){return arr(window.db?.orders).filter(o=>String(o.teacher_id||'')===String(x.id)||String(o.library_id||o.pickup_library_id||'')===String(x.id)||String(o.courier_id||o.delegate_id||'')===String(x.id))}
  function settlementsFor(x){return [...arr(window.db?.settlements),...arr(window.db?.library_settlements),...arr(window.db?.courier_settlements),...arr(window.db?.librarySettlements),...arr(window.db?.courierSettlements)].filter(s=>String(s.account_id||s.teacher_id||s.library_id||s.courier_id||'')===String(x.id))}
  function permsFor(x){const rows=arr(window.db?.accountPermissions).filter(row=>String(row.account_id)===String(x.id)&&row.granted!==false).map(row=>row.permission);return rows.length?rows:defaultPerms(x.role)}
  function defaultPerms(role){if(role==='teacher')return ['dashboard','booklets','orders','finance'];if(role==='library')return ['dashboard','orders','finance','settlements','notifications'];if(role==='courier')return ['dashboard','orders','finance','settlements'];return ['dashboard']}
  function history(id){return arr(window.db?.audit).filter(row=>String(row.entity_id||row.meta?.account_id||'')===String(id)).slice(0,80).map(row=>({at:row.created_at,action:row.summary||row.action,details:row.meta?.details||'',by:row.actor_account_id||row.actor_role||'النظام'}))}
  function log(id,action,details=''){if(typeof window.audit==='function')Promise.resolve(window.audit('account_activity',action,{entity_type:'accounts',entity_id:String(id),details})).catch(()=>{})}
  function strongPassword(value){return String(value||'').length>=12&&/[A-Za-z؀-ۿ]/.test(value)&&/[0-9]/.test(value)}
  function areaPicker(x){
    const selected=new Set(accountAreas(x));
    const names=[...new Set([...areaList(),...selected])].sort((a,b)=>a.localeCompare(b,'ar'));
    return `<section id="v132CourierFields" class="v132-courier-fields" ${x.role==='courier'?'':'hidden'}>
      <div class="v163-area-toolbar"><div><h4>مناطق عمل المندوب</h4><small>يمكن تحديد أكثر من منطقة ويظهر المندوب فقط للطلبات المطابقة.</small></div><div><button type="button" class="secondary" onclick="v132CourierAreasSelectAll()">تحديد الكل</button><button type="button" class="secondary" onclick="v132CourierAreasClear()">إلغاء التحديد</button></div></div>
      <div id="v132CourierAreaPicker" class="v163-area-picker">${names.map(name=>`<label><input type="checkbox" value="${escx(name)}" ${selected.has(name)?'checked':''} onchange="v132CourierAreaCount()"><span>${escx(name)}</span></label>`).join('')}</div>
      <div class="v132-courier-meta"><label>حالة توفر المندوب<select id="v132Availability"><option value="available" ${String(x.availability||'available')==='available'?'selected':''}>متاح</option><option value="busy" ${String(x.availability||'')==='busy'?'selected':''}>مشغول</option><option value="offline" ${String(x.availability||'')==='offline'?'selected':''}>غير متصل</option></select></label><p><b id="v132CourierAreaCount">${selected.size}</b> منطقة محددة</p></div>
    </section>`;
  }
  function renderEditor(x){
    const host=document.getElementById('v132AccountEditorHost');if(!host)return;
    const os=ordersFor(x),ss=settlementsFor(x),perms=permsFor(x),role=x.role||'teacher',linked=Boolean(x.auth_user_id);
    host.innerHTML=`<section class="v132-account-editor"><header class="v132-editor-head"><div><h3>تعديل حساب ${escx(x.name||'')}</h3><p>${linked?'الحساب مربوط بخدمة الدخول ويمكن تحديث بياناته وكلمة مروره.':'الحساب قديم وغير مربوط؛ تعيين كلمة مرور جديدة يربطه تلقائياً.'}</p></div><span class="v131-status ${linked?'active':'pending'}">${linked?'مربوط':'يحتاج ربط'}</span><button class="v132-editor-close" onclick="v132CloseAccountEditor()">إغلاق</button></header><div class="v132-account-form"><label>نوع الحساب<select id="v132Role" onchange="v132SyncRoleFields()"><option value="teacher" ${role==='teacher'?'selected':''}>مدرس</option><option value="library" ${role==='library'?'selected':''}>مكتبة</option><option value="courier" ${role==='courier'?'selected':''}>مندوب</option></select></label><label class="span-2">الاسم الكامل<input id="v132Name" value="${escx(x.name||'')}"></label><label>الحالة<select id="v132Status"><option value="active" ${String(x.status||'active')==='active'?'selected':''}>فعال</option><option value="inactive" ${String(x.status||'')==='inactive'?'selected':''}>موقوف</option><option value="pending" ${String(x.status||'')==='pending'?'selected':''}>قيد المراجعة</option></select></label><label>اسم الدخول<input id="v132Username" value="${escx(x.username||'')}"></label><label>رقم الهاتف<input id="v132Phone" value="${escx(x.phone||x.mobile||'')}"></label><label id="v132AreaLabel">المنطقة<input id="v132Area" value="${escx(x.area||'')}"></label><label id="v132LandmarkLabel">أقرب نقطة دالة<input id="v132Landmark" value="${escx(x.landmark||'')}"></label>${areaPicker(x)}<label class="span-4">ملاحظات الحساب<textarea id="v132Notes">${escx(x.notes||'')}</textarea></label><section class="v132-password-box"><h4>${linked?'إعادة تعيين كلمة المرور':'ربط الحساب وتعيين كلمة المرور'}</h4><div class="v132-password-row"><input id="v132NewPassword" type="password" placeholder="اكتب كلمة مرور من 12 حرفاً تتضمن حروفاً وأرقاماً"><button onclick="v132ResetPassword()">${linked?'تغيير كلمة المرور':'ربط وحفظ'}</button></div></section><section class="v132-permissions"><h4>الصلاحيات</h4><div class="v132-permission-grid">${Object.entries(permissionLabels).map(([k,v])=>`<label><input type="checkbox" data-v132-permission="${k}" ${perms.includes(k)?'checked':''} ${canEditPermissions()?'':'disabled'}>${v}</label>`).join('')}</div></section><section class="v132-link-summary"><article><small>الطلبات المرتبطة</small><b>${os.length}</b></article><article><small>التسويات المرتبطة</small><b>${ss.length}</b></article><article><small>سجل النشاط</small><b>${history(x.id).length}</b></article></section><div class="v132-form-actions"><button class="secondary" onclick="v132OpenActivity('${escx(x.id)}')">سجل النشاط</button><button class="v132-save" onclick="v132SaveAccount()">حفظ التعديلات</button></div></div></section>`;
    window.v132SyncRoleFields();
    host.scrollIntoView({behavior:'smooth',block:'start'});
  }

  window.v132SyncRoleFields=()=>{
    const courier=document.getElementById('v132Role')?.value==='courier';
    const fields=document.getElementById('v132CourierFields');if(fields)fields.hidden=!courier;
    const area=document.getElementById('v132AreaLabel'),landmark=document.getElementById('v132LandmarkLabel');
    if(area)area.hidden=courier;if(landmark)landmark.hidden=courier;
    window.v132CourierAreaCount();
  };
  window.v132CourierAreaCount=()=>{const count=document.querySelectorAll('#v132CourierAreaPicker input:checked').length;const el=document.getElementById('v132CourierAreaCount');if(el)el.textContent=String(count);return count};
  window.v132CourierAreasSelectAll=()=>{document.querySelectorAll('#v132CourierAreaPicker input').forEach(x=>x.checked=true);window.v132CourierAreaCount()};
  window.v132CourierAreasClear=()=>{document.querySelectorAll('#v132CourierAreaPicker input').forEach(x=>x.checked=false);window.v132CourierAreaCount()};
  window.v132OpenAccountEditor=id=>{const x=account(id);if(!x)return alert('تعذر العثور على الحساب');editingId=id;renderEditor(x)};
  window.v132CloseAccountEditor=()=>{editingId=null;const h=document.getElementById('v132AccountEditorHost');if(h)h.innerHTML=''};
  window.v132SaveAccount=async()=>{
    const x=account(editingId);if(!x)return;
    const role=document.getElementById('v132Role')?.value||x.role;
    const typedPassword=document.getElementById('v132NewPassword')?.value.trim()||'';
    const selectedAreas=[...document.querySelectorAll('#v132CourierAreaPicker input:checked')].map(el=>String(el.value||'').trim()).filter(Boolean);
    const payload={account_id:x.id,role,name:document.getElementById('v132Name')?.value.trim()||'',username:document.getElementById('v132Username')?.value.trim()||'',status:document.getElementById('v132Status')?.value||'active',phone:document.getElementById('v132Phone')?.value.trim()||'',area:role==='courier'?(selectedAreas[0]||''):(document.getElementById('v132Area')?.value.trim()||''),areas:role==='courier'?selectedAreas:undefined,availability:role==='courier'?(document.getElementById('v132Availability')?.value||'available'):undefined,landmark:role==='courier'?'':(document.getElementById('v132Landmark')?.value.trim()||''),notes:document.getElementById('v132Notes')?.value.trim()||'',password:typedPassword||undefined};
    if(!payload.name||!payload.username)return alert('أكمل الاسم واسم الدخول');
    if(role==='courier'&&!selectedAreas.length)return alert('اختر منطقة عمل واحدة على الأقل للمندوب');
    if(role==='courier'&&!payload.phone)return alert('أدخل رقم هاتف المندوب');
    if(typedPassword&&!strongPassword(typedPassword))return alert('كلمة المرور يجب أن تكون 12 حرفاً على الأقل وتتضمن حروفاً وأرقاماً');
    try{
      if(!window.ALINAuth?.updateAccountFromAdmin)throw new Error('خدمة تعديل الحساب الآمن غير جاهزة');
      await window.ALINAuth.updateAccountFromAdmin(payload);
      if(canEditPermissions()){
        const perms=[...document.querySelectorAll('[data-v132-permission]:checked')].map(el=>el.dataset.v132Permission);
        const client=window.sb||window.AlinCloud?.client?.();if(!client?.rpc)throw new Error('خدمة الصلاحيات غير متاحة');const {error:permError}=await client.rpc('alin_admin_set_account_permissions',{p_account_id:String(x.id),p_permissions:perms});if(permError)throw permError;
      }
      log(x.id,'تعديل الحساب',role==='courier'?`تم تحديث البيانات ومناطق العمل: ${selectedAreas.join('، ')}`:'تم تحديث البيانات والصلاحيات');
      if(typeof audit==='function')await audit('account','تعديل آمن لحساب '+x.id);
      if(typeof load==='function')await load();
      if(typeof renderAccountsAdmin==='function')renderAccountsAdmin();
      if(typeof toast==='function')toast(role==='courier'?'تم حفظ حساب المندوب ومناطق عمله':'تم حفظ تعديلات الحساب');
    }catch(e){alert('تعذر حفظ الحساب: '+e.message)}
  };
  window.v132ResetPassword=async()=>{const x=account(editingId),pass=document.getElementById('v132NewPassword')?.value.trim();if(!x||!pass)return alert('اكتب كلمة المرور الجديدة');if(!strongPassword(pass))return alert('كلمة المرور يجب أن تكون 12 حرفاً على الأقل وتتضمن حروفاً وأرقاماً');try{if(!window.ALINAuth?.resetPasswordFromAdmin)throw new Error('خدمة تغيير كلمة المرور غير متاحة');await window.ALINAuth.resetPasswordFromAdmin(x.id,pass);log(x.id,x.auth_user_id?'إعادة تعيين كلمة المرور':'ربط الحساب الموجود وتعيين كلمة المرور');if(typeof audit==='function')await audit('account','تحديث كلمة مرور '+x.id);if(typeof load==='function')await load();if(typeof renderAccountsAdmin==='function')renderAccountsAdmin();if(typeof toast==='function')toast('تم تغيير كلمة المرور وربط الحساب بنجاح')}catch(e){alert('تعذر تغيير كلمة المرور: '+e.message)}};
  window.v132ToggleAccount=async(id,status)=>{const x=account(id);if(!x)return;try{if(!window.ALINAuth?.updateAccountFromAdmin)throw new Error('خدمة تحديث الحساب الآمنة غير جاهزة');await window.ALINAuth.updateAccountFromAdmin({account_id:id,status});log(id,status==='active'?'تفعيل الحساب':'إيقاف الحساب');if(typeof audit==='function')await audit('account',(status==='active'?'تفعيل ':'إيقاف ')+id);if(typeof load==='function')await load();if(typeof renderAccountsAdmin==='function')renderAccountsAdmin();if(typeof toast==='function')toast(status==='active'?'تم تفعيل الحساب':'تم إيقاف الحساب')}catch(e){alert('تعذر تحديث الحالة: '+e.message)}};
  window.v132SafeDeleteAccount=async id=>{const x=account(id);if(!x)return;const os=ordersFor(x),ss=settlementsFor(x);const details=os.length||ss.length?`\nسيبقى مرتبطاً بـ ${os.length} طلب و${ss.length} تسوية محفوظة.`:'';if(!confirm(`أرشفة الحساب وإيقاف دخوله؟${details}\nلن تُحذف طلباته أو حساباته القديمة.`))return;try{if(!window.ALINAuth?.deleteAccountFromAdmin)throw new Error('خدمة أرشفة الحساب الآمنة غير جاهزة');await window.ALINAuth.deleteAccountFromAdmin(id);log(id,'أرشفة الحساب');if(typeof audit==='function')await audit('account','أرشفة حساب '+id);if(typeof load==='function')await load();if(typeof renderAccountsAdmin==='function')renderAccountsAdmin();if(typeof toast==='function')toast('تمت أرشفة الحساب وإيقاف دخوله')}catch(e){alert('تعذر أرشفة الحساب: '+e.message)}};
  window.v132OpenActivity=id=>{const x=account(id);if(!x)return;const rows=history(id);const host=document.getElementById('v132AccountEditorHost');if(!host)return;host.innerHTML=`<section class="v132-account-editor"><header class="v132-editor-head"><div><h3>سجل نشاط ${escx(x.name||'')}</h3><p>آخر التعديلات والإجراءات المسجلة على الحساب.</p></div><button class="v132-editor-close" onclick="v132CloseAccountEditor()">إغلاق</button></header><div class="v132-activity">${rows.map(r=>`<article><b>${escx(r.action)}</b><small>${new Date(r.at).toLocaleString(window.AlinI18n?.locale?.()||'ar-IQ')} — ${escx(r.by||'المدير')}${r.details?' — '+escx(r.details):''}</small></article>`).join('')||'<div class="v132-warning">لا يوجد نشاط مسجل لهذا الحساب بعد.</div>'}</div></section>`;host.scrollIntoView({behavior:'smooth',block:'start'})};
})();

;

;
/* modules/admin/finance.js */
// === admin/finance.js ===
/* ALIN v2.2.6 — authoritative admin finance UI. No wrapper chains. */
(function(){
  'use strict';
  const arr=value=>Array.isArray(value)?value:[];
  const num=value=>Number.isFinite(Number(value))?Number(value):0;
  const escv=value=>typeof window.esc==='function'?window.esc(value):String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const moneyv=value=>typeof window.money==='function'?window.money(value):Math.round(num(value)).toLocaleString(window.AlinI18n?.locale?.()||'ar-IQ');
  const finance=()=>window.AlinFinance;
  const database=()=>window.db||{};

  function parties(){
    const accounts=database().accounts||{};
    return [
      {role:'admin',id:'admin',name:'منصة آلين',label:'ربح المنصة'},
      ...arr(accounts.teachers).map(row=>({role:'teacher',id:row.id,name:row.name,label:'مدرس'})),
      ...arr(accounts.libraries).map(row=>({role:'library',id:row.id,name:row.name,label:'مكتبة'})),
      ...arr(database().delegates||accounts.couriers||database().couriers).map(row=>({role:'delegate',id:row.id,name:row.name,label:'مندوب'}))
    ];
  }

  function totals(){
    return (finance()?.canonicalLedger?.()||[]).reduce((out,row)=>{
      out.sales+=num(row.total);out.admin+=num(row.admin||row.alin);out.teacher+=num(row.teacher);out.library+=num(row.library);out.delegate+=num(row.delegate||row.courier);return out;
    },{sales:0,admin:0,teacher:0,library:0,delegate:0});
  }

  function balanceCards(){
    return parties().map(p=>{
      const summary=finance()?.partySummary?.(p.role,p.id)||{earned:0,paid:0,remaining:0};
      const libraryDebt=p.role==='library'?(summary.debt||finance()?.librarySummary?.(p.id)):null;
      const delegateDebt=p.role==='delegate'?(finance()?.delegateSummary?.(p.id)||summary):null;
      const payoutRole=['admin','teacher'].includes(p.role);
      return `<article class="admin-v137-party-card" data-role="${escv(p.role)}" data-search="${escv(`${p.name||''} ${p.label}`.toLowerCase())}">
        <div><b>${escv(p.name||p.label)}</b><small>${escv(p.label)} — الإجمالي ${moneyv(summary.earned||summary.earnings)} د.ع</small></div>
        ${payoutRole?`<div class="admin-v137-party-values"><span>المسدد <b>${moneyv(summary.paid)}</b></span><span class="remain">المتبقي <b>${moneyv(summary.remaining)}</b></span>${summary.remaining>0?`<button onclick="AlinFinance.payBalance('${escv(p.role)}','${escv(p.id)}')">${p.role==='admin'?'استلام الربح':'تسديد الأرباح'}</button>`:'<em>مصفّى</em>'}</div>`:''}
        ${libraryDebt?`<div class="admin-v223-library-debt"><span>ربح المكتبة <b>${moneyv(libraryDebt.libraryProfit)} د.ع</b> • ذمتها للإدارة <b>${moneyv(libraryDebt.remaining)} د.ع</b></span>${libraryDebt.remaining>0?`<button class="secondary" onclick="AlinFinance.settleLibrary('${escv(p.id)}')">تثبيت التسوية</button>`:'<em>الذمة مصفّاة</em>'}</div>`:''}
        ${delegateDebt?`<div class="admin-v223-library-debt"><span>ربح المندوب <b>${moneyv(delegateDebt.earnings||delegateDebt.earned)} د.ع</b> • ذمته للإدارة <b>${moneyv(delegateDebt.debt||delegateDebt.remaining)} د.ع</b></span>${(delegateDebt.debt||delegateDebt.remaining)>0?`<button class="secondary" onclick="AlinFinance.settleDelegate('${escv(p.id)}')">تثبيت تسوية المندوب</button>`:'<em>الذمة مصفّاة</em>'}</div>`:''}
      </article>`;
    }).join('');
  }

  function withdrawals(){
    const rows=arr(database().withdrawals).slice().sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));
    return rows.map(row=>`<div class="admin-v137-finance-row"><div><b>${escv(row.role||'حساب')} — ${moneyv(row.amount)} د.ع</b><small>${escv(row.account_id||'')} • ${escv(String(row.created_at||'').slice(0,10))}</small></div><div class="row-actions"><span>${escv(row.status||'pending')}</span>${row.status==='pending'?`<button onclick="withdrawStatus('${escv(row.id)}','approved')">موافقة</button><button onclick="withdrawStatus('${escv(row.id)}','paid')">دفع</button><button class="danger" onclick="withdrawStatus('${escv(row.id)}','rejected')">رفض</button>`:''}</div></div>`).join('')||'<div class="empty">لا توجد طلبات سحب.</div>';
  }

  function settlementRows(){
    const payouts=finance()?.payoutRows?.()||[];
    const librarySettlements=arr(database().library_settlements).length?arr(database().library_settlements):arr(database().librarySettlements);
    const delegateSettlements=arr(database().delegate_settlements).length?arr(database().delegate_settlements):arr(database().courierSettlements);
    const rows=[
      ...payouts.map(row=>({kind:'payout',id:row.id||row.voucher_number,number:row.voucher_number||row.id,name:row.party_name||finance()?.partyName?.(row.party_role,row.party_id),amount:row.amount,method:row.payment_method,status:row.status,created_at:row.created_at})),
      ...librarySettlements.map(row=>({kind:'library',id:row.id||row.receipt_number,number:row.receipt_number||row.id,name:finance()?.partyName?.('library',row.library_id),amount:row.amount,method:row.payment_method,status:row.status,created_at:row.created_at})),
      ...delegateSettlements.map(row=>({kind:'delegate',id:row.id||row.receipt_number,number:row.receipt_number||row.id,name:finance()?.partyName?.('delegate',row.delegate_id||row.courier_id),amount:row.amount,method:row.payment_method,status:row.status,created_at:row.created_at}))
    ].sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));
    return rows.map(row=>`<div class="admin-v137-finance-row"><div><b>${escv(row.name||row.kind)}</b><small>${escv(row.number||'')} • ${escv(String(row.created_at||'').slice(0,10))} • ${escv(row.method||'نقدي')}</small></div><div><strong>${moneyv(row.amount)} د.ع</strong><span>${escv(row.status||'')}</span></div></div>`).join('')||'<div class="empty">لا توجد سندات أو تسويات.</div>';
  }

  function ledgerRows(){
    const rows=finance()?.canonicalLedger?.()||[];
    return rows.slice().sort((a,b)=>String(b.settled_at||b.created_at||'').localeCompare(String(a.settled_at||a.created_at||''))).map(row=>`<div class="admin-v137-finance-row"><div><b>${escv(row.order_number||row.order_id)}</b><small>منصة ${moneyv(row.admin||row.alin)} • مدرس ${moneyv(row.teacher)} • مكتبة ${moneyv(row.library)} • مندوب ${moneyv(row.delegate||row.courier)}</small></div><span>${moneyv(row.total)} د.ع</span></div>`).join('')||'<div class="empty">لا توجد طلبات مسلّمة محتسبة.</div>';
  }

  function renderFinanceAdmin(){
    const root=document.getElementById('adminContent');if(!root)return false;
    const t=totals();
    const libraryDebt=arr(database().accounts?.libraries).reduce((sum,row)=>sum+num(finance()?.librarySummary?.(row.id)?.remaining),0);
    const delegateDebt=arr(database().delegates||database().accounts?.couriers||database().couriers).reduce((sum,row)=>sum+num(finance()?.delegateSummary?.(row.id)?.debt),0);
    const debt=libraryDebt+delegateDebt;
    root.innerHTML=`<section class="admin-v137-finance">
      <header class="admin-v137-finance-head"><div><h2>المالية والتسويات</h2><p>مسار مالي واحد للطلبات المسلّمة، الأرباح، ذمم المكتبات وسندات التسديد.</p></div><span class="admin-v137-finance-date">${new Date().toLocaleDateString(window.AlinI18n?.locale?.()||'ar-IQ')}</span></header>
      <section class="admin-v137-finance-metrics">
        <article class="admin-v137-finance-metric gold"><small>المبيعات المسلّمة</small><strong>${moneyv(t.sales)} د.ع</strong></article>
        <article class="admin-v137-finance-metric green"><small>ربح المنصة</small><strong>${moneyv(t.admin)} د.ع</strong></article>
        <article class="admin-v137-finance-metric"><small>أرباح المدرسين</small><strong>${moneyv(t.teacher)} د.ع</strong></article>
        <article class="admin-v137-finance-metric"><small>أرباح المكتبات</small><strong>${moneyv(t.library)} د.ع</strong></article>
        <article class="admin-v137-finance-metric"><small>أرباح المندوبين</small><strong>${moneyv(t.delegate)} د.ع</strong></article>
        <article class="admin-v137-finance-metric red"><small>ذمم المكتبات والمندوبين</small><strong>${moneyv(debt)} د.ع</strong></article>
      </section>
      <nav class="admin-v137-finance-tabs"><button class="active" data-finance-tab="balances">الأرصدة</button><button data-finance-tab="ledger">القيود</button><button data-finance-tab="settlements">السندات والتسويات</button><button data-finance-tab="withdrawals">طلبات السحب</button></nav>
      <section data-finance-panel="balances"><div class="admin-v137-finance-panel"><div class="admin-v137-finance-search"><input id="financeSearch" placeholder="ابحث باسم الحساب"><select id="financeRole"><option value="">كل الحسابات</option><option value="teacher">المدرسون</option><option value="library">المكتبات</option><option value="delegate">المندوبون</option><option value="admin">المنصة</option></select></div><div id="financeBalances" class="admin-v137-finance-list">${balanceCards()}</div></div></section>
      <section data-finance-panel="ledger" hidden><div class="admin-v137-finance-panel"><div class="row-actions"><button onclick="AlinAdminFinance.exportLedger()">تصدير CSV</button></div>${ledgerRows()}</div></section>
      <section data-finance-panel="settlements" hidden><div class="admin-v137-finance-panel">${settlementRows()}</div></section>
      <section data-finance-panel="withdrawals" hidden><div class="admin-v137-finance-panel">${withdrawals()}</div></section>
    </section>`;
    bind();return true;
  }

  function bind(){
    const tabs=[...document.querySelectorAll('[data-finance-tab]')];
    tabs.forEach(button=>button.addEventListener('click',()=>{
      tabs.forEach(item=>item.classList.toggle('active',item===button));
      document.querySelectorAll('[data-finance-panel]').forEach(panel=>panel.hidden=panel.dataset.financePanel!==button.dataset.financeTab);
    }));
    const filter=()=>{
      const q=(document.getElementById('financeSearch')?.value||'').trim().toLowerCase();
      const role=document.getElementById('financeRole')?.value||'';
      document.querySelectorAll('#financeBalances .admin-v137-party-card').forEach(card=>card.hidden=!((!q||card.dataset.search.includes(q))&&(!role||card.dataset.role===role)));
    };
    document.getElementById('financeSearch')?.addEventListener('input',filter);
    document.getElementById('financeRole')?.addEventListener('change',filter);
  }

  function csvEscape(value){return `"${String(value??'').replace(/"/g,'""')}"`}
  function exportLedger(){
    const rows=finance()?.canonicalLedger?.()||[];
    const csv='\ufeff'+[['الطلب','الإجمالي','المنصة','المدرس','المكتبة','المندوب','التاريخ'],...rows.map(row=>[row.order_number||row.order_id,row.total,row.admin||row.alin,row.teacher,row.library,row.delegate||row.courier,row.settled_at||row.created_at])].map(row=>row.map(csvEscape).join(',')).join('\n');
    const link=document.createElement('a');link.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));link.download=`alin-finance-${new Date().toISOString().slice(0,10)}.csv`;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);
  }

  window.renderFinanceAdmin=renderFinanceAdmin;
  window.AlinAdminFinance=Object.freeze({render:renderFinanceAdmin,exportLedger});
  window.AlinAdminModules?.register?.('finance',()=>{});
})();

;
/* modules/admin/coupons.js */
// === admin/coupons.js ===
/* ALIN v2.1.0: single admin coupon implementation. */

let alinEditingCouponId = null;
let alinCouponSaving = false;

function alinCouponAdminEscape(value){
  return typeof window.esc === 'function' ? window.esc(value) : String(value ?? '');
}
function alinCouponAdminMoney(value){
  return typeof window.money === 'function' ? window.money(value) : Number(value || 0).toLocaleString(window.AlinI18n?.locale?.()||'ar-IQ');
}
function alinCouponAdminDate(value){
  if(!value) return 'غير محدد';
  try{return new Date(value).toLocaleDateString(window.AlinI18n?.locale?.()||'ar-IQ')}catch(_){return String(value)}
}
function alinCouponAdminRows(){
  return Array.isArray(window.db?.coupons) ? window.db.coupons : [];
}
function alinCouponUsed(coupon){return Number(coupon.used_count ?? coupon.usage_count ?? 0)}
function alinCouponLimit(coupon){return Number(coupon.max_uses ?? coupon.usage_limit ?? 0)}
function alinCouponIsActive(coupon){
  return String(coupon.status || 'active') === 'active' && (!coupon.expires_at || new Date(coupon.expires_at).getTime() >= Date.now());
}
function alinCouponDuplicate(rows, code, ignoreId = null){
  return rows.find(coupon => window.AlinCoupons.normalizeCode(coupon.code) === code && String(coupon.id) !== String(ignoreId ?? ''));
}
function alinCouponDuplicateMessage(){
  return 'هذا كود الخصم موجود مسبقًا. اختره من القائمة واضغط تعديل بدل إضافته مرة ثانية.';
}
function alinCouponRowsHtml(rows){
  if(!rows.length) return '<div class="admin-v140-empty">لا توجد كوبونات</div>';
  return rows.map(coupon => {
    const limit = alinCouponLimit(coupon);
    const used = alinCouponUsed(coupon);
    const active = alinCouponIsActive(coupon);
    const code = alinCouponAdminEscape(coupon.code);
    const value = coupon.discount_type === 'fixed'
      ? `${alinCouponAdminMoney(coupon.discount_value)} د.ع`
      : `${alinCouponAdminMoney(coupon.discount_value)}%`;
    return `<div class="admin-v140-item coupon-v140-item" data-search="${code}"><div><h4 class="coupon-code">${code}</h4><p>${value} خصم — ${alinCouponAdminEscape(coupon.applies_to || 'كل المتجر')}</p><div class="admin-v140-meta"><span class="admin-v140-pill ${active?'active':'off'}">${active?'نشط':'متوقف/منتهي'}</span><span class="admin-v140-pill">استخدام ${used}/${limit || '∞'}</span><span class="admin-v140-pill">ينتهي ${alinCouponAdminDate(coupon.expires_at)}</span></div></div><div class="admin-v140-item-actions"><button class="coupon-copy" onclick="copyCoupon('${code}')">نسخ</button><button class="secondary" onclick="editCoupon('${alinCouponAdminEscape(coupon.id)}')">تعديل</button><button onclick="toggleCoupon('${alinCouponAdminEscape(coupon.id)}','${String(coupon.status || 'active') === 'active' ? 'disabled' : 'active'}')">${String(coupon.status || 'active') === 'active' ? 'إيقاف' : 'تشغيل'}</button><button class="danger" onclick="deleteCoupon('${alinCouponAdminEscape(coupon.id)}')">حذف</button></div></div>`;
  }).join('');
}

function renderCouponsAdmin(){
  const rows = alinCouponAdminRows();
  const active = rows.filter(alinCouponIsActive).length;
  const used = rows.reduce((sum,coupon)=>sum+alinCouponUsed(coupon),0);
  const expired = rows.filter(coupon=>coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now()).length;
  const content = document.getElementById('adminContent');
  if(!content) return;
  content.innerHTML = `<section class="admin-v140"><header class="admin-v140-head"><div><h2>العروض والكوبونات</h2><p>إنشاء أكواد خصم وتحديد القيمة، عدد الاستخدامات، القسم المستهدف وتاريخ الانتهاء.</p></div></header><div class="admin-v140-stats"><div class="admin-v140-stat"><span>${rows.length}</span><small>إجمالي الكوبونات</small></div><div class="admin-v140-stat"><span>${active}</span><small>نشطة</small></div><div class="admin-v140-stat"><span>${used}</span><small>مرات الاستخدام</small></div><div class="admin-v140-stat"><span>${expired}</span><small>منتهية</small></div></div><div class="admin-v140-grid"><article class="admin-v140-card"><h3>${alinEditingCouponId?'تعديل الكوبون':'إضافة كوبون'}</h3><form class="admin-v140-form" onsubmit="return false"><label>كود الخصم<input id="couponAdminCode" placeholder="ALIN20" maxlength="24"></label><div class="admin-v140-form-row"><label>نوع الخصم<select id="couponAdminType"><option value="percent">نسبة مئوية</option><option value="fixed">مبلغ ثابت</option></select></label><label>قيمة الخصم<input id="couponAdminValue" type="number" min="1"></label></div><div class="admin-v140-form-row"><label>عدد الاستخدامات<input id="couponAdminLimit" type="number" min="0" placeholder="0 = بلا حد"></label><label>تاريخ الانتهاء<input id="couponAdminExpiry" type="date"></label></div><label>يطبق على<select id="couponAdminApplies"><option value="all">كل المتجر</option><option value="booklet">الملازم</option><option value="stationery">القرطاسية</option><option value="gift">الهدايا</option></select></label><label>الحالة<select id="couponAdminStatus"><option value="active">نشط</option><option value="disabled">متوقف</option></select></label><div class="admin-v140-actions"><button id="couponAdminSave" onclick="saveCoupon()">${alinEditingCouponId?'حفظ التعديل':'إضافة الكوبون'}</button>${alinEditingCouponId?'<button class="secondary" onclick="cancelCouponEdit()">إلغاء</button>':''}</div></form></article><article class="admin-v140-card"><div class="admin-v140-toolbar"><h3>قائمة الكوبونات</h3><input id="couponAdminSearch" placeholder="بحث بالكود" oninput="filterCoupons()"></div><div id="couponAdminList" class="admin-v140-list">${alinCouponRowsHtml(rows)}</div></article></div></section>`;
  if(alinEditingCouponId){
    const coupon = rows.find(row=>String(row.id)===String(alinEditingCouponId));
    if(coupon){
      document.getElementById('couponAdminCode').value = coupon.code || '';
      document.getElementById('couponAdminType').value = coupon.discount_type || 'percent';
      document.getElementById('couponAdminValue').value = coupon.discount_value || 0;
      document.getElementById('couponAdminLimit').value = coupon.max_uses ?? coupon.usage_limit ?? 0;
      document.getElementById('couponAdminExpiry').value = String(coupon.expires_at || '').slice(0,10);
      document.getElementById('couponAdminApplies').value = coupon.applies_to || 'all';
      document.getElementById('couponAdminStatus').value = coupon.status || 'active';
    }
  }
}

function filterCoupons(){
  const queryText = String(document.getElementById('couponAdminSearch')?.value || '').trim().toLowerCase();
  document.querySelectorAll('#couponAdminList .admin-v140-item').forEach(item=>{
    item.hidden = !String(item.dataset.search || '').toLowerCase().includes(queryText);
  });
}
async function copyCoupon(code){
  try{await navigator.clipboard.writeText(code); if(typeof window.toast==='function')window.toast('تم نسخ الكود')}
  catch(_){window.prompt('انسخ الكود',code)}
}
function editCoupon(id){
  alinEditingCouponId = id;
  renderCouponsAdmin();
  document.getElementById('adminContent')?.scrollIntoView({behavior:'smooth'});
}
function cancelCouponEdit(){
  alinEditingCouponId = null;
  renderCouponsAdmin();
}
async function saveCoupon(){
  if(alinCouponSaving) return;
  const button = document.getElementById('couponAdminSave');
  try{
    alinCouponSaving = true;
    if(button){button.disabled=true;button.textContent='جارٍ الحفظ...'}
    const codeInput = document.getElementById('couponAdminCode');
    const code = window.AlinCoupons.normalizeCode(codeInput?.value || '');
    const value = Number(document.getElementById('couponAdminValue')?.value || 0);
    if(codeInput) codeInput.value = code;
    if(!code || value <= 0) throw new Error('أكمل كود وقيمة الخصم');
    if(!/^[\p{L}\p{N}_-]{2,24}$/u.test(code)) throw new Error('كود الخصم يقبل حروفًا وأرقامًا وشرطة فقط، بدون مسافات');
    let rows = alinCouponAdminRows();
    try{rows = await window.AlinCoupons.refresh()}catch(error){console.warn('[ALIN coupons] pre-save refresh failed',error)}
    if(alinCouponDuplicate(rows,code,alinEditingCouponId)) throw new Error(alinCouponDuplicateMessage());
    const payload = {
      code,
      discount_type: document.getElementById('couponAdminType')?.value || 'percent',
      discount_value: value,
      max_uses: Number(document.getElementById('couponAdminLimit')?.value || 0),
      usage_limit: Number(document.getElementById('couponAdminLimit')?.value || 0),
      expires_at: document.getElementById('couponAdminExpiry')?.value ? new Date(document.getElementById('couponAdminExpiry').value+'T23:59:59').toISOString() : null,
      applies_to: document.getElementById('couponAdminApplies')?.value || 'all',
      status: document.getElementById('couponAdminStatus')?.value || 'active',
    };
    const editedId = alinEditingCouponId;
    if(editedId) await window.update('coupons',payload,{id:editedId});
    else await window.insert('coupons',{id:window.uid('CP'),used_count:0,usage_count:0,...payload});
    if(typeof window.audit === 'function') await window.audit('coupon',(editedId?'تعديل':'إضافة')+' كوبون '+code);
    await window.AlinCoupons.refresh();
    alinEditingCouponId = null;
    renderCouponsAdmin();
    if(typeof window.toast === 'function') window.toast('تم حفظ الكوبون وظهر في القائمة');
  }catch(error){
    const message = String(error?.message || error || 'تعذر حفظ الكوبون');
    window.alert(/coupons_code_key|duplicate key|23505/i.test(message) ? alinCouponDuplicateMessage() : message);
  }finally{
    alinCouponSaving = false;
    if(button && document.body.contains(button)){
      button.disabled = false;
      button.textContent = alinEditingCouponId ? 'حفظ التعديل' : 'إضافة الكوبون';
    }
  }
}
async function toggleCoupon(id,status){
  try{
    await window.update('coupons',{status},{id});
    await window.AlinCoupons.refresh();
    renderCouponsAdmin();
  }catch(error){window.alert(error?.message || 'تعذر تحديث الكوبون')}
}
async function deleteCoupon(id){
  if(!window.confirm('حذف الكوبون؟')) return;
  try{
    await window.removeRow('coupons',{id});
    await window.AlinCoupons.refresh();
    renderCouponsAdmin();
    if(typeof window.toast === 'function') window.toast('تم حذف الكوبون');
  }catch(error){window.alert(error?.message || 'تعذر حذف الكوبون')}
}

window.renderCouponsAdmin = renderCouponsAdmin;
window.filterCoupons = filterCoupons;
window.copyCoupon = copyCoupon;
window.editCoupon = editCoupon;
window.cancelCouponEdit = cancelCouponEdit;
window.saveCoupon = saveCoupon;
window.toggleCoupon = toggleCoupon;
window.deleteCoupon = deleteCoupon;

;
/* store/banners.js */
/* ALIN 2.0.1 — single authoritative banner module (admin + storefront). */
(function(){
  'use strict';

  const state={rows:[],index:0,timer:null,installed:false,saving:false};
  const q=(selector,root=document)=>root.querySelector(selector);
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[char]));
  const today=()=>new Date().toISOString().slice(0,10);
  const truthy=value=>value===true||value===1||value==='1'||String(value).toLowerCase()==='true';
  const rows=()=>Array.isArray(window.db?.banners)?window.db.banners:state.rows;
  const client=()=>window.AlinCloud?.client?.()||window.sb||window.supabaseClient||null;

  function enabled(banner){return truthy(banner?.active) && banner?.status!=='hidden'}

  function active(banner){
    const date=today();
    return enabled(banner) &&
      (!banner?.start_date||String(banner.start_date).slice(0,10)<=date) &&
      (!banner?.end_date||String(banner.end_date).slice(0,10)>=date);
  }

  function safeLink(value){
    if(!value)return '';
    try{
      const url=new URL(String(value),location.href);
      return ['http:','https:'].includes(url.protocol)?url.href:'';
    }catch(_){return ''}
  }

  function imageUrl(banner){
    const ref=banner?.image_path||banner?.image_url||banner?.cover_path||'';
    if(!ref)return '';
    try{
      if(typeof window.mediaUrl==='function')return window.mediaUrl(ref);
    }catch(error){console.warn('[ALIN banners] media URL',error)}
    if(/^https?:\/\//i.test(String(ref)))return String(ref);
    try{return client()?.storage?.from('alin-files').getPublicUrl(String(ref).replace(/^\/+|^alin-files\//g,'')).data?.publicUrl||''}
    catch(_){return ''}
  }

  function host(){
    return document.getElementById('alinStoreBanners');
  }

  function sortedActiveRows(){
    return rows().filter(active).sort((a,b)=>
      (Number(a.sort_order)||0)-(Number(b.sort_order)||0) ||
      String(b.created_at||'').localeCompare(String(a.created_at||''))
    );
  }

  function renderStorefront(){
    const box=host();
    if(!box)return;
    const visible=sortedActiveRows();
    if(!visible.length){
      box.replaceChildren();
      box.hidden=true;
      clearInterval(state.timer);
      state.timer=null;
      return;
    }

    state.index=Math.min(state.index,visible.length-1);
    const banner=visible[state.index];
    const image=imageUrl(banner);
    const link=safeLink(banner.link_url);
    box.hidden=false;
    const hasText=Boolean(String(banner.title||'').trim()||String(banner.text||'').trim());
    box.innerHTML=`
      <article class="alin-store-banner${link?' is-clickable':''}${hasText?' has-copy':' no-copy'}" ${link?'role="link" tabindex="0"':''}>
        <div class="alin-store-banner__media">
          ${image?`<img class="alin-store-banner__image" src="${esc(image)}" alt="${esc(banner.title||'إعلان منصة آلين')}" loading="eager" decoding="async">`:`<span class="alin-store-banner__placeholder" aria-hidden="true">آ</span>`}
        </div>
        ${hasText?`<div class="alin-store-banner__content">
          <div class="alin-store-banner__copy">
            <span class="alin-store-banner__label">إعلان منصة آلين</span>
            ${banner.title?`<h2>${esc(banner.title)}</h2>`:''}
            ${banner.text?`<p>${esc(banner.text)}</p>`:''}
          </div>
          ${link?`<span class="alin-store-banner__cta" aria-hidden="true">عرض الإعلان <b>←</b></span>`:''}
        </div>`:''}
      </article>
      ${visible.length>1?`<div class="alin-store-banner__dots" aria-label="اختيار الإعلان">${visible.map((_,index)=>`<button type="button" class="${index===state.index?'active':''}" data-banner-index="${index}" aria-label="الإعلان ${index+1}"></button>`).join('')}</div>`:''}`;

    const article=q('.alin-store-banner',box);
    if(article&&link){
      const open=()=>window.open(link,'_blank','noopener,noreferrer');
      article.addEventListener('click',open);
      article.addEventListener('keydown',event=>{
        if(event.key==='Enter'||event.key===' '){event.preventDefault();open()}
      });
    }
    q('.alin-store-banner__image',box)?.addEventListener('error',event=>{
      console.warn('[ALIN banners] image failed',event.currentTarget.src);
      const media=event.currentTarget.closest('.alin-store-banner__media');
      event.currentTarget.remove();
      if(media)media.innerHTML='<span class="alin-store-banner__placeholder" aria-hidden="true">آ</span>';
      article?.classList.add('without-image');
    },{once:true});
    box.querySelectorAll('[data-banner-index]').forEach(button=>button.addEventListener('click',()=>{
      state.index=Number(button.dataset.bannerIndex)||0;
      renderStorefront();
      restartRotation();
    }));
  }

  function restartRotation(){
    clearInterval(state.timer);
    state.timer=null;
    if(sortedActiveRows().length>1){
      state.timer=setInterval(()=>{
        const count=sortedActiveRows().length;
        if(!count)return;
        state.index=(state.index+1)%count;
        renderStorefront();
      },6500);
    }
  }

  async function refresh(){
    try{
      if(typeof window.query==='function'){
        const data=await window.query('banners');
        if(Array.isArray(data)){
          state.rows=data;
          if(window.db)window.db.banners=data;
        }
      }else state.rows=rows();
    }catch(error){
      console.warn('[ALIN banners] refresh failed; using loaded rows',error);
      state.rows=rows();
    }
    renderStorefront();
    restartRotation();
  }

  function bannerById(id){return rows().find(item=>String(item.id)===String(id))}
  function value(id){return document.getElementById(id)?.value?.trim()||''}
  function setValue(id,next){const element=document.getElementById(id);if(element)element.value=next??''}
  function notify(message){if(typeof window.toast==='function')window.toast(message);else alert(message)}

  function clearForm(){
    ['alinBannerId','alinBannerTitle','alinBannerText','alinBannerLink','alinBannerStart','alinBannerEnd','alinBannerSort']
      .forEach(id=>setValue(id,''));
    const file=document.getElementById('alinBannerFile');if(file)file.value='';
    const save=document.getElementById('alinBannerSave');if(save)save.textContent='إضافة البنر';
  }

  async function uploadImage(file){
    if(!file)return '';
    if(typeof window.uploadFile!=='function')throw new Error('خدمة رفع الصور غير جاهزة');
    const result=await window.uploadFile('banners',file,{type:'image',required:true});
    if(!result)throw new Error('لم يتم استلام مسار الصورة بعد الرفع');
    return typeof result==='string'?result:(result.path||result.url||'');
  }

  async function removeStoredImage(path){
    const clean=String(path||'').replace(/^\/+|^alin-files\//g,'');
    if(!clean.startsWith('banners/'))return;
    try{
      const c=client();
      if(c?.storage){const {error}=await c.storage.from('alin-files').remove([clean]);if(error)console.warn('[ALIN banners] storage cleanup',error)}
    }catch(error){console.warn('[ALIN banners] storage cleanup',error)}
  }

  async function save(){
    if(state.saving)return;
    const id=value('alinBannerId');
    const title=value('alinBannerTitle');
    const text=value('alinBannerText');
    const link=value('alinBannerLink');
    const start=value('alinBannerStart')||null;
    const end=value('alinBannerEnd')||null;
    const sort=Number(value('alinBannerSort')||0);
    const file=document.getElementById('alinBannerFile')?.files?.[0];
    if(!title)return alert('اكتب عنوان البنر');
    if(start&&end&&start>end)return alert('تاريخ النهاية يجب أن يكون بعد تاريخ البداية');
    if(link&&!safeLink(link))return alert('رابط البنر يجب أن يبدأ بـ http أو https');

    state.saving=true;
    const button=document.getElementById('alinBannerSave');
    if(button){button.disabled=true;button.textContent='جارٍ الحفظ...'}
    let newlyUploaded='';
    try{
      const old=bannerById(id);
      newlyUploaded=file?await uploadImage(file):'';
      const payload={
        title,text,link_url:link||null,
        image_path:newlyUploaded||(old?.image_path||null),
        start_date:start,end_date:end,sort_order:sort,
        active:old?enabled(old):true,updated_at:new Date().toISOString()
      };
      if(id){
        if(typeof window.update!=='function')throw new Error('خدمة تعديل البنر غير جاهزة');
        await window.update('banners',payload,{id});
        if(newlyUploaded&&old?.image_path&&old.image_path!==newlyUploaded)await removeStoredImage(old.image_path);
      }else{
        if(typeof window.insert!=='function')throw new Error('خدمة إضافة البنر غير جاهزة');
        await window.insert('banners',{
          id:typeof window.uid==='function'?window.uid('BN'):`BN-${Date.now()}`,
          ...payload,created_at:new Date().toISOString()
        });
      }
      if(typeof window.audit==='function')await window.audit('banner',`${id?'تعديل':'إضافة'} البنر ${title}`);
      await refresh();
      renderAdmin();
      clearForm();
      notify(id?'تم تعديل البنر والصورة':'تمت إضافة البنر والصورة');
    }catch(error){
      if(newlyUploaded)await removeStoredImage(newlyUploaded);
      console.error('[ALIN banners] save',error);
      alert(error?.message||'تعذر حفظ البنر');
    }finally{
      state.saving=false;
      if(button){button.disabled=false;button.textContent=id?'حفظ التعديل':'إضافة البنر'}
    }
  }

  function edit(id){
    const banner=bannerById(id);if(!banner)return;
    setValue('alinBannerId',banner.id);
    setValue('alinBannerTitle',banner.title);
    setValue('alinBannerText',banner.text);
    setValue('alinBannerLink',banner.link_url);
    setValue('alinBannerStart',String(banner.start_date||'').slice(0,10));
    setValue('alinBannerEnd',String(banner.end_date||'').slice(0,10));
    setValue('alinBannerSort',banner.sort_order||0);
    const save=document.getElementById('alinBannerSave');if(save)save.textContent='حفظ التعديل';
    document.getElementById('alinBannerTitle')?.scrollIntoView({behavior:'smooth',block:'center'});
  }

  async function toggle(id){
    const banner=bannerById(id);if(!banner)return;
    const next=!enabled(banner);
    try{
      await window.update('banners',{active:next,updated_at:new Date().toISOString()},{id});
      await refresh();renderAdmin();notify(next?'تم إظهار البنر':'تم إخفاء البنر');
    }catch(error){alert(error?.message||'تعذر تغيير حالة البنر')}
  }

  async function remove(id){
    const banner=bannerById(id);if(!banner)return;
    if(!confirm(`حذف البنر ${banner.title||''}؟`))return;
    try{
      await window.removeRow('banners',{id});
      await removeStoredImage(banner.image_path);
      if(typeof window.audit==='function')await window.audit('banner',`حذف البنر ${banner.title||''}`);
      await refresh();renderAdmin();notify('تم حذف البنر وصورته');
    }catch(error){alert(error?.message||'تعذر حذف البنر')}
  }

  function renderAdmin(){
    const container=document.getElementById('adminContent');
    if(!container)return;
    const list=rows().slice().sort((a,b)=>(Number(a.sort_order)||0)-(Number(b.sort_order)||0));
    container.innerHTML=`
      <section class="alin-banner-admin">
        <header class="alin-banner-admin__heading"><div><h2>الإعلانات والبنرات</h2><p>البنر المنشور يظهر مباشرة أعلى واجهة المتجر.</p></div><strong>${list.length} بنر</strong></header>
        <input id="alinBannerId" type="hidden">
        <div class="alin-banner-form">
          <label><span>عنوان البنر</span><input id="alinBannerTitle" maxlength="120" placeholder="مثال: عروض العودة إلى المدارس"></label>
          <label><span>نص الإعلان</span><textarea id="alinBannerText" maxlength="500" placeholder="وصف مختصر وواضح"></textarea></label>
          <label><span>رابط عند الضغط — اختياري</span><input id="alinBannerLink" inputmode="url" placeholder="https://..."></label>
          <label class="alin-banner-file"><span>صورة البنر</span><input id="alinBannerFile" type="file" accept="image/png,image/jpeg,image/webp"><small>المقاس المقترح للكمبيوتر 1600 × 500. النص يظهر تلقائيًا أسفل الصورة، وعلى الموبايل تتكيف القطعة دون تشويه الصورة.</small></label>
          <label><span>تاريخ البداية</span><input id="alinBannerStart" type="date"></label>
          <label><span>تاريخ النهاية</span><input id="alinBannerEnd" type="date"></label>
          <label><span>ترتيب الظهور</span><input id="alinBannerSort" type="number" min="0" value="0"></label>
          <div class="alin-banner-form__actions"><button id="alinBannerSave" type="button">إضافة البنر</button><button id="alinBannerClear" class="secondary" type="button">تفريغ الحقول</button></div>
        </div>
        <div class="alin-banner-list">${list.map(banner=>{
          const image=imageUrl(banner);
          return `<article class="alin-banner-row">
            <div class="alin-banner-preview">${image?`<img src="${esc(image)}" alt="${esc(banner.title||'بنر')}">`:'<span>لا توجد صورة</span>'}</div>
            <div class="alin-banner-info"><div><h3>${esc(banner.title||'بدون عنوان')}</h3><em class="${enabled(banner)?'active':'hidden'}">${enabled(banner)?'ظاهر':'مخفي'}</em></div><p>${esc(banner.text||'')}</p><small>${banner.start_date||'بدون بداية'} — ${banner.end_date||'بدون نهاية'} • ترتيب ${Number(banner.sort_order)||0}</small></div>
            <div class="alin-banner-actions"><button type="button" data-banner-action="edit" data-id="${esc(banner.id)}">تعديل</button><button type="button" class="secondary" data-banner-action="toggle" data-id="${esc(banner.id)}">${enabled(banner)?'إخفاء':'إظهار'}</button><button type="button" class="danger" data-banner-action="delete" data-id="${esc(banner.id)}">حذف</button></div>
          </article>`;
        }).join('')||'<div class="alin-banner-empty">لا توجد بنرات مضافة حالياً.</div>'}</div>
      </section>`;
    document.getElementById('alinBannerSave')?.addEventListener('click',save);
    document.getElementById('alinBannerClear')?.addEventListener('click',clearForm);
    container.querySelectorAll('[data-banner-action]').forEach(button=>button.addEventListener('click',()=>{
      const {bannerAction,id}=button.dataset;
      if(bannerAction==='edit')edit(id);
      else if(bannerAction==='toggle')toggle(id);
      else if(bannerAction==='delete')remove(id);
    }));
  }

  function registerAdmin(){
    window.renderAdsAdmin=renderAdmin;
    if(window.AlinAdminModules?.register)window.AlinAdminModules.register('ads',renderAdmin);
  }

  function install(){
    if(state.installed)return;state.installed=true;
    registerAdmin();
    document.addEventListener('alin:store-rendered',()=>setTimeout(renderStorefront,0));
    window.addEventListener('alin:data-mutated',event=>{if(event.detail?.table==='banners')refresh()});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
    refresh();
  }

  window.AlinBanners=Object.freeze({refresh,renderStorefront,renderAdmin});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();

;
/* modules/admin/reports.js */
// === admin/reports.js ===
/* ===== admin/js/admin-reports-v143.js ===== */
(function(){
  const escx=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const moneyx=v=>typeof money==='function'?money(v):Number(v||0).toLocaleString(window.AlinI18n?.locale?.()||'ar-IQ');
  const arr=v=>Array.isArray(v)?v:[];
  const num=v=>Number(v||0);
  const state={period:'month',from:'',to:'',kind:'all',q:''};
  function dbx(){try{return window.db||db||{}}catch(_){return window.db||{}}}
  function orderDate(o){return String(o?.created_at||o?.date||o?.updated_at||'').slice(0,10)}
  function statusKey(v){const s=String(v||'').toLowerCase();if(['delivered','completed','done'].includes(s))return'done';if(['cancelled','canceled','refunded'].includes(s))return'cancelled';if(['ready'].includes(s))return'ready';if(['printing','processing','preparing'].includes(s))return'processing';return'new'}
  function statusLabel(v){return({done:'مكتمل',cancelled:'ملغي',ready:'جاهز',processing:'قيد التنفيذ',new:'جديد'})[statusKey(v)]}
  function itemKind(o){const k=String(o?.kind||o?.item_type||o?.type||'').toLowerCase();return k.includes('book')||k==='booklet'?'booklet':'product'}
  function orderQty(o){return Math.max(1,num(o?.qty||o?.quantity||1))}
  function orderTotal(o){const explicit=num(o?.total||o?.total_amount||o?.grand_total||o?.amount);return explicit||num(o?.price||o?.unit_price)*orderQty(o)}
  function dateRange(){
    const now=new Date(),today=now.toISOString().slice(0,10);let from='',to=today;
    if(state.period==='today')from=today;
    else if(state.period==='week'){const d=new Date(now);d.setDate(d.getDate()-6);from=d.toISOString().slice(0,10)}
    else if(state.period==='month')from=today.slice(0,8)+'01';
    else if(state.period==='custom'){from=state.from||'';to=state.to||today}
    return{from,to};
  }
  function accountsByRole(role){const d=dbx();return arr(d.accounts?.[role+'s']||d.accounts?.[role]||d[role+'s'])}
  function accountName(role,id){if(!id)return'غير محدد';const rows=accountsByRole(role);const x=rows.find(a=>String(a.id)===String(id));return x?.name||x?.title||x?.username||'غير محدد'}
  function filteredOrders(){const d=dbx(),range=dateRange();return arr(d.orders).filter(o=>{const dt=orderDate(o),kind=itemKind(o),txt=`${o.order_no||o.code||o.id||''} ${o.student_name||o.customer_name||''} ${o.title||o.item_title||''}`.toLowerCase();return(!range.from||dt>=range.from)&&(!range.to||dt<=range.to)&&(state.kind==='all'||kind===state.kind)&&(!state.q||txt.includes(state.q.toLowerCase()))}).sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')))}
  function paidOrders(rows){return rows.filter(o=>statusKey(o.status)==='done')}
  function profits(rows){return rows.reduce((a,o)=>{a.platform+=num(o.platform_profit||o.admin_profit||o.platform_amount);a.teacher+=num(o.teacher_profit||o.teacher_amount);a.library+=num(o.library_profit||o.library_amount);a.courier+=num(o.courier_profit||o.delivery_fee||o.courier_amount);return a},{platform:0,teacher:0,library:0,courier:0})}
  function titleOf(o){return o.title||o.item_title||o.product_name||o.booklet_name||(itemKind(o)==='booklet'?'ملزمة':'منتج')}
  function rankBy(rows,keyFn,labelFn){const map=new Map();rows.forEach(o=>{const key=String(keyFn(o)||'unknown');const old=map.get(key)||{key,label:labelFn(o),qty:0,total:0};old.qty+=orderQty(o);old.total+=orderTotal(o);map.set(key,old)});return[...map.values()].sort((a,b)=>b.qty-a.qty||b.total-a.total)}
  function bestLibrary(rows){return rankBy(rows,o=>o.library_id||o.pickup_library_id,o=>accountName('library',o.library_id||o.pickup_library_id))}
  function bestTeacher(rows){return rankBy(rows,o=>o.teacher_id,o=>accountName('teacher',o.teacher_id))}
  function bestCourier(rows){return rankBy(rows,o=>o.courier_id,o=>accountName('courier',o.courier_id))}
  function rankHtml(rows,empty='لا توجد بيانات كافية'){if(!rows.length)return`<div class="admin-v143-empty">${empty}</div>`;return`<div class="admin-v143-rank-list">${rows.slice(0,5).map((r,i)=>`<div class="admin-v143-rank"><em>${i+1}</em><div><b>${escx(r.label||'غير محدد')}</b><small>${r.qty} قطعة أو نسخة</small></div><strong>${moneyx(r.total)} د.ع</strong></div>`).join('')}</div>`}
  function ensureButton(){const tabs=document.querySelector('#adminPage .admin-tabs');if(!tabs)return;let btn=[...tabs.querySelectorAll('button')].find(b=>(b.getAttribute('onclick')||'').includes("adminTab('reports')"));if(!btn){btn=document.createElement('button');btn.setAttribute('onclick',"adminTab('reports')");const settings=[...tabs.querySelectorAll('button')].find(b=>(b.getAttribute('onclick')||'').includes("adminTab('settings')"));tabs.insertBefore(btn,settings||null)}btn.textContent='التقارير';btn.dataset.adminTab='reports'}
  function markTab(){document.querySelectorAll('#adminPage .admin-tabs button').forEach(b=>b.classList.toggle('active-admin-tab',(b.dataset.adminTab==='reports')||(b.getAttribute('onclick')||'').includes("adminTab('reports')")))}
  function render(){
    ensureButton();markTab();window.activeAdminTab='reports';const root=document.getElementById('adminContent');if(!root)return;
    const rows=filteredOrders(),paid=paidOrders(rows),sales=paid.reduce((a,o)=>a+orderTotal(o),0),profit=profits(paid),cancelled=rows.filter(o=>statusKey(o.status)==='cancelled'),processing=rows.filter(o=>['new','processing','ready'].includes(statusKey(o.status)));
    const booklets=rankBy(paid.filter(o=>itemKind(o)==='booklet'),o=>o.item_id||o.booklet_id||titleOf(o),o=>titleOf(o));
    const products=rankBy(paid.filter(o=>itemKind(o)==='product'),o=>o.item_id||o.product_id||titleOf(o),o=>titleOf(o));
    const libraries=bestLibrary(paid),teachers=bestTeacher(paid),couriers=bestCourier(paid);
    const counts={new:0,processing:0,ready:0,done:0,cancelled:0};rows.forEach(o=>counts[statusKey(o.status)]++);const max=Math.max(1,...Object.values(counts));
    const statusHtml=Object.entries(counts).map(([k,v])=>`<div class="admin-v143-status"><span>${({new:'جديد',processing:'قيد التنفيذ',ready:'جاهز',done:'مكتمل',cancelled:'ملغي'})[k]}</span><div class="admin-v143-bar"><i style="width:${Math.round(v/max*100)}%"></i></div><b>${v}</b></div>`).join('');
    const table=rows.length?`<div class="admin-v143-table-wrap"><table class="admin-v143-table"><thead><tr><th>رقم الطلب</th><th>الطالب</th><th>العنصر</th><th>النوع</th><th>الجهة</th><th>الحالة</th><th>التاريخ</th><th>المبلغ</th></tr></thead><tbody>${rows.slice(0,300).map(o=>`<tr><td>#${escx(o.order_no||o.code||o.id||'—')}</td><td>${escx(o.student_name||o.customer_name||'—')}</td><td>${escx(titleOf(o))}</td><td>${itemKind(o)==='booklet'?'ملزمة':'منتج'}</td><td>${escx(accountName('library',o.library_id||o.pickup_library_id)||accountName('courier',o.courier_id))}</td><td><span class="admin-v143-status-pill ${statusKey(o.status)}">${statusLabel(o.status)}</span></td><td>${escx(orderDate(o)||'—')}</td><td>${moneyx(orderTotal(o))} د.ع</td></tr>`).join('')}</tbody></table></div>`:'<div class="admin-v143-empty">لا توجد طلبات ضمن الفترة المختارة.</div>';
    root.innerHTML=`<section class="admin-v143-reports"><header class="admin-v143-head"><div><h2>التقارير والتحليلات</h2><p>ملخص المبيعات والأرباح وأفضل العناصر والشركاء حسب الفترة المختارة.</p></div><div class="admin-v143-head-icon">📊</div></header><section class="admin-v143-toolbar"><input value="${escx(state.q)}" placeholder="بحث برقم الطلب أو اسم الطالب أو العنصر" oninput="alinV143ReportFilter('q',this.value)"><select onchange="alinV143ReportFilter('period',this.value)"><option value="today" ${state.period==='today'?'selected':''}>اليوم</option><option value="week" ${state.period==='week'?'selected':''}>آخر 7 أيام</option><option value="month" ${state.period==='month'?'selected':''}>هذا الشهر</option><option value="all" ${state.period==='all'?'selected':''}>كل الفترات</option><option value="custom" ${state.period==='custom'?'selected':''}>فترة مخصصة</option></select><input type="date" value="${escx(state.from)}" onchange="alinV143ReportFilter('from',this.value)" ${state.period==='custom'?'':'disabled'}><input type="date" value="${escx(state.to)}" onchange="alinV143ReportFilter('to',this.value)" ${state.period==='custom'?'':'disabled'}><select onchange="alinV143ReportFilter('kind',this.value)"><option value="all" ${state.kind==='all'?'selected':''}>كل الأنواع</option><option value="booklet" ${state.kind==='booklet'?'selected':''}>الملازم</option><option value="product" ${state.kind==='product'?'selected':''}>المنتجات</option></select><button class="secondary" onclick="alinV143ExportReports()">تصدير Excel</button><button class="gold" onclick="window.print()">طباعة / PDF</button></section><section class="admin-v143-metrics"><article class="admin-v143-metric gold"><small>إجمالي المبيعات</small><strong>${moneyx(sales)} د.ع</strong><span>${paid.length} طلب مكتمل</span></article><article class="admin-v143-metric"><small>عدد الطلبات</small><strong>${rows.length}</strong><span>${processing.length} طلب قيد المتابعة</span></article><article class="admin-v143-metric green"><small>حصة المنصة</small><strong>${moneyx(profit.platform)} د.ع</strong><span>حسب السجلات الحالية</span></article><article class="admin-v143-metric red"><small>الطلبات الملغاة</small><strong>${cancelled.length}</strong><span>${rows.length?Math.round(cancelled.length/rows.length*100):0}% من النتائج</span></article><article class="admin-v143-metric"><small>أرباح المدرسين</small><strong>${moneyx(profit.teacher)} د.ع</strong><span>من الطلبات المكتملة</span></article><article class="admin-v143-metric"><small>أرباح المكتبات</small><strong>${moneyx(profit.library)} د.ع</strong><span>من الطلبات المكتملة</span></article><article class="admin-v143-metric"><small>أرباح المندوبين</small><strong>${moneyx(profit.courier)} د.ع</strong><span>رسوم وعمولات التوصيل</span></article><article class="admin-v143-metric"><small>متوسط الطلب</small><strong>${moneyx(paid.length?sales/paid.length:0)} د.ع</strong><span>متوسط الطلب المكتمل</span></article></section><section class="admin-v143-grid"><article class="admin-v143-card"><div class="admin-v143-card-head"><h3>أفضل الملازم</h3><small>حسب عدد النسخ</small></div>${rankHtml(booklets,'لا توجد مبيعات ملازم ضمن الفترة.')}</article><article class="admin-v143-card"><div class="admin-v143-card-head"><h3>أفضل المنتجات</h3><small>حسب الكمية</small></div>${rankHtml(products,'لا توجد مبيعات منتجات ضمن الفترة.')}</article><article class="admin-v143-card"><div class="admin-v143-card-head"><h3>أفضل المكتبات</h3><small>حسب المبيعات</small></div>${rankHtml(libraries,'لا توجد بيانات مكتبات ضمن الفترة.')}</article><article class="admin-v143-card"><div class="admin-v143-card-head"><h3>أفضل المدرسين</h3><small>حسب مبيعات الملازم</small></div>${rankHtml(teachers,'لا توجد بيانات مدرسين ضمن الفترة.')}</article><article class="admin-v143-card"><div class="admin-v143-card-head"><h3>أفضل المندوبين</h3><small>حسب الطلبات المسلّمة</small></div>${rankHtml(couriers,'لا توجد بيانات مندوبين ضمن الفترة.')}</article><article class="admin-v143-card"><div class="admin-v143-card-head"><h3>حالات الطلبات</h3><small>توزيع النتائج</small></div><div class="admin-v143-statuses">${statusHtml}</div></article></section><article class="admin-v143-card"><div class="admin-v143-card-head"><h3>تفاصيل الطلبات</h3><small>يتم عرض أول 300 طلب مطابق</small></div>${table}</article></section>`;
  }
  window.alinV143ReportFilter=(k,v)=>{state[k]=v;if(k==='period'&&v!=='custom'){state.from='';state.to=''}render()};
  window.alinV143ExportReports=()=>{const rows=filteredOrders();const data=[['رقم الطلب','الطالب','العنصر','النوع','المكتبة','المندوب','الحالة','التاريخ','الكمية','المبلغ'],...rows.map(o=>[o.order_no||o.code||o.id||'',o.student_name||o.customer_name||'',titleOf(o),itemKind(o)==='booklet'?'ملزمة':'منتج',accountName('library',o.library_id||o.pickup_library_id),accountName('courier',o.courier_id),statusLabel(o.status),orderDate(o),orderQty(o),orderTotal(o)])];const csv='\ufeff'+data.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='alin-reports-'+new Date().toISOString().slice(0,10)+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500)};
  function install(){ensureButton();window.AlinAdminModules?.register?.('reports',render)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();


;

;
/* modules/admin/settings.js */
// === admin/settings.js ===
/* ALIN v2.4.2 — authoritative platform settings. No router wrapping. */
(function(){
  'use strict';

  const escv=value=>typeof window.esc==='function'?window.esc(value):String(value??'');
  const state=()=>window.db?.settings||{};
  const value=(key,fallback='')=>state()[key]??fallback;
  const root=()=>document.getElementById('adminContent');

  async function settingsSet(key,nextValue){
    const normalized=String(nextValue??'');
    const existing=typeof window.query==='function'?(await window.query('settings')).find(row=>String(row.key)===String(key)):null;
    if(existing&&typeof window.update==='function')await window.update('settings',{value:normalized},{key});
    else if(typeof window.insert==='function')await window.insert('settings',{key,value:normalized});
    else throw new Error('خدمة حفظ الإعدادات غير متاحة');
    window.db=window.db||{};window.db.settings=window.db.settings||{};window.db.settings[key]=normalized;
    return normalized;
  }

  async function saveMany(values,messageElement){
    if(messageElement){messageElement.className='as144-status';messageElement.textContent='جارٍ الحفظ...'}
    try{
      for(const [key,nextValue] of Object.entries(values))await settingsSet(key,nextValue);
      if(typeof window.audit==='function')await window.audit('settings','تحديث إعدادات المنصة');
      if(typeof window.applyBrand==='function')window.applyBrand();
      window.dispatchEvent(new CustomEvent('alin:settings-updated',{detail:{keys:Object.keys(values)}}));
      if(messageElement){messageElement.className='as144-status ok';messageElement.textContent='تم حفظ الإعدادات بنجاح'}
      window.toast?.('تم حفظ الإعدادات');
      return true;
    }catch(error){
      if(messageElement){messageElement.className='as144-status err';messageElement.textContent=error.message||'تعذر حفظ الإعدادات'}
      throw error;
    }
  }

  function currentAdmin(){
    if(window.current?.role==='admin')return window.current;
    return (window.db?.accounts?.all||[]).find(account=>account.role==='admin')||null;
  }
  function adminUser(){return currentAdmin()?.username||value('admin_username','admin')}
  async function saveAdminSecurity(){
    const message=document.getElementById('adminSecurityMsg');
    try{
      const account=currentAdmin();if(!account?.id)throw new Error('تعذر تحديد حساب المدير الحالي');
      const username=document.getElementById('adminLoginName')?.value.trim()||'';
      const password=document.getElementById('adminNewPass')?.value.trim()||'';
      const confirmPassword=document.getElementById('adminNewPass2')?.value.trim()||'';
      if(!username)throw new Error('اكتب اسم دخول المدير');
      if(password&&(password.length<12||!/[0-9]/.test(password)||!/[A-Za-z\u0600-\u06FF]/.test(password)))throw new Error('كلمة المرور يجب أن تكون 12 حرفاً على الأقل وتتضمن حروفاً وأرقاماً');
      if(password!==confirmPassword)throw new Error('تأكيد كلمة المرور غير مطابق');
      if(!window.ALINAuth?.updateAccountFromAdmin)throw new Error('خدمة الحسابات الآمنة غير جاهزة');
      await window.ALINAuth.updateAccountFromAdmin({account_id:account.id,role:'admin',name:account.name||'مدير المنصة',username,status:'active'});
      if(password){
        if(!window.ALINAuth?.resetPasswordFromAdmin)throw new Error('خدمة تغيير كلمة المرور غير متاحة');
        await window.ALINAuth.resetPasswordFromAdmin(account.id,password);
      }
      await settingsSet('admin_username',username);
      if(typeof window.audit==='function')await window.audit('security','تحديث بيانات دخول المدير عبر Supabase Auth');
      if(typeof window.load==='function')await window.load();
      if(message){message.className='as144-status ok';message.textContent='تم تحديث بيانات المدير وحساب الدخول بنجاح'}
      window.toast?.('تم تحديث حساب المدير');
      return true;
    }catch(error){
      if(message){message.className='as144-status err';message.textContent=error.message||'تعذر تحديث بيانات المدير'}
      throw error;
    }
  }

  function render(content=root()){
    if(!content)return;
    content.className='panel admin-settings-v144';
    const version=window.ALIN_CONFIG?.version||'2.4.2';
    content.innerHTML=`
      <div class="as144-head"><div><h2>إعدادات المنصة</h2><p>إدارة الإعدادات العامة والأرباح والطلبات والتواصل وأمان المدير.</p></div><span class="as144-version">v${escv(version)}</span></div>
      <div class="as144-tabs" role="tablist"><button class="active" data-as144-tab="general">عام</button><button data-as144-tab="profits">الأرباح</button><button data-as144-tab="orders">الطلبات</button><button data-as144-tab="contact">التواصل</button><button data-as144-tab="security">أمان المدير</button></div>
      <section class="as144-panel active" data-as144-panel="general"><div class="as144-card"><h3>الإعدادات العامة</h3><div class="as144-grid">
        <div class="as144-field"><label>اسم المنصة</label><input id="as144PlatformName" value="${escv(value('platform_name','منصة آلين'))}"></div>
        <div class="as144-field"><label>الاسم المختصر</label><input id="as144ShortName" value="${escv(value('platform_short_name','آلين'))}"></div>
        <div class="as144-field"><label>حد تنبيه المخزون</label><input id="as144LowStock" type="number" min="0" value="${escv(value('low_stock_default','5'))}"></div>
        <div class="as144-field"><label>حد تنبيه ذمة المكتبة</label><input id="as144DebtLimit" type="number" min="0" value="${escv(value('library_debt_alert_limit','500000'))}"></div>
        <div class="as144-field full"><label>ملاحظة إدارية داخلية</label><textarea id="as144AdminNote">${escv(value('admin_internal_note',''))}</textarea></div>
      </div><div class="as144-actions"><button class="as144-save" data-save="general">حفظ الإعدادات العامة</button><button class="secondary" onclick="adminTab('brandIdentity')">فتح الهوية البصرية</button></div><div id="as144GeneralMsg" class="as144-status"></div></div></section>
      <section class="as144-panel" data-as144-panel="profits"><div class="as144-card"><h3>نسب الأرباح الافتراضية</h3><div class="as144-grid">
        <div class="as144-field"><label>حصة المنصة %</label><input id="as144AdminProfit" type="number" min="0" max="100" value="${escv(value('admin_profit_percent','20'))}"></div>
        <div class="as144-field"><label>حصة المدرس %</label><input id="as144TeacherProfit" type="number" min="0" max="100" value="${escv(value('teacher_profit_percent','50'))}"></div>
        <div class="as144-field"><label>حصة المكتبة %</label><input id="as144LibraryProfit" type="number" min="0" max="100" value="${escv(value('library_profit_percent','30'))}"></div>
        <div class="as144-field"><label>عمولة المندوب %</label><input id="as144CourierProfit" type="number" min="0" max="100" value="${escv(value('delegate_profit_percent','30'))}"></div>
      </div><div id="as144ProfitTotal" class="as144-profit-total"></div><div class="as144-actions"><button class="as144-save" data-save="profits">حفظ نسب الأرباح</button></div><div id="as144ProfitsMsg" class="as144-status"></div></div></section>
      <section class="as144-panel" data-as144-panel="orders"><div class="as144-card"><h3>الطلبات والتوصيل</h3><div class="as144-grid">
        <div class="as144-field"><label>أجور التوصيل الافتراضية</label><input id="as144DeliveryFee" type="number" min="0" value="${escv(value('delivery_fee','0'))}"></div>
        <div class="as144-field"><label>حالة استقبال الطلبات</label><select id="as144PauseScope"><option value="" ${value('order_pause_scope','')===''?'selected':''}>الطلبات مفتوحة</option><option value="all" ${value('order_pause_scope','')==='all'?'selected':''}>إيقاف الكل</option><option value="booklet" ${value('order_pause_scope','')==='booklet'?'selected':''}>إيقاف الملازم</option><option value="stationery" ${value('order_pause_scope','')==='stationery'?'selected':''}>إيقاف القرطاسية</option><option value="gift" ${value('order_pause_scope','')==='gift'?'selected':''}>إيقاف الهدايا</option></select></div>
        <div class="as144-field full"><label>سبب إيقاف الطلبات</label><textarea id="as144PauseReason">${escv(value('order_pause_reason',''))}</textarea></div>
      </div><div class="as144-toggle"><div><b>التوصيل للبيت</b><small style="display:block;color:#667085">السماح للطالب باختيار التوصيل عن طريق المندوب.</small></div><input id="as144DeliveryEnabled" type="checkbox" ${String(value('delivery_enabled','true'))!=='false'?'checked':''}></div><div class="as144-actions"><button class="as144-save" data-save="orders">حفظ إعدادات الطلبات</button></div><div id="as144OrdersMsg" class="as144-status"></div></div></section>
      <section class="as144-panel" data-as144-panel="contact"><div class="as144-card"><h3>واجهة المتجر والتواصل</h3><div class="as144-grid">
        <div class="as144-field"><label>عنوان الواجهة</label><input id="as144HeroTitle" value="${escv(value('hero_title','كل ما تحتاجه للدراسة بمكان واحد'))}"></div>
        <div class="as144-field"><label>رقم واتساب المنصة</label><input id="as144Whatsapp" value="${escv(value('whatsapp',value('platform_phone','')))}"></div>
        <div class="as144-field full"><label>نص الواجهة</label><textarea id="as144HeroText">${escv(value('hero_text','اختر ملزمتك أو قرطاسيتك واطلبها بسهولة.'))}</textarea></div>
        <div class="as144-field"><label>عنوان قسم عن المنصة</label><input id="as144AboutTitle" value="${escv(value('about_title','عن المنصة'))}"></div>
        <div class="as144-field"><label>عنوان التواصل</label><input id="as144ContactTitle" value="${escv(value('contact_title','تواصل معنا'))}"></div>
        <div class="as144-field full"><label>نص عن المنصة</label><textarea id="as144AboutText">${escv(value('about_text','منصة آلين تجمع الملازم والقرطاسية والهدايا في مكان واحد.'))}</textarea></div>
        <div class="as144-field full"><label>نص التواصل</label><textarea id="as144ContactText">${escv(value('contact_text','للاستفسار أو الانضمام، تواصل مع إدارة منصة آلين.'))}</textarea></div>
      </div><div class="as144-actions"><button class="as144-save" data-save="contact">حفظ الواجهة والتواصل</button></div><div id="as144ContactMsg" class="as144-status"></div></div></section>
      <section class="as144-panel" data-as144-panel="security"><div class="as144-card as144-danger"><h3>أمان حساب المدير</h3><div class="as144-grid">
        <div class="as144-field"><label>اسم دخول المدير</label><input id="adminLoginName" value="${escv(adminUser())}"></div>
        <div class="as144-field"><label>كلمة المرور الجديدة</label><input id="adminNewPass" type="password" autocomplete="new-password"></div>
        <div class="as144-field"><label>تأكيد كلمة المرور</label><input id="adminNewPass2" type="password" autocomplete="new-password"></div>
      </div><div class="as144-note">يتم تحديث حساب المدير الحقيقي في Supabase Auth، وليس رمزاً محلياً داخل المتصفح.</div><div class="as144-actions"><button class="as144-save" id="as144SecuritySave">حفظ بيانات المدير</button></div><div id="adminSecurityMsg" class="as144-status"></div></div></section>`;

    content.querySelectorAll('[data-as144-tab]').forEach(button=>button.addEventListener('click',()=>{
      content.querySelectorAll('[data-as144-tab]').forEach(item=>item.classList.toggle('active',item===button));
      content.querySelectorAll('[data-as144-panel]').forEach(panel=>panel.classList.toggle('active',panel.dataset.as144Panel===button.dataset.as144Tab));
    }));
    const profitIds=['as144AdminProfit','as144TeacherProfit','as144LibraryProfit'];
    const updateTotal=()=>{const total=profitIds.reduce((sum,id)=>sum+(Number(document.getElementById(id)?.value)||0),0);const label=document.getElementById('as144ProfitTotal');if(label)label.textContent=`مجموع نسب المنصة والمدرس والمكتبة: ${total}%`};profitIds.forEach(id=>document.getElementById(id)?.addEventListener('input',updateTotal));updateTotal();
    content.querySelector('[data-save="general"]')?.addEventListener('click',()=>saveMany({platform_name:document.getElementById('as144PlatformName').value.trim(),platform_short_name:document.getElementById('as144ShortName').value.trim()||'آلين',low_stock_default:document.getElementById('as144LowStock').value||5,library_debt_alert_limit:document.getElementById('as144DebtLimit').value||0,admin_internal_note:document.getElementById('as144AdminNote').value.trim()},document.getElementById('as144GeneralMsg')).catch(()=>{}));
    content.querySelector('[data-save="profits"]')?.addEventListener('click',()=>saveMany({admin_profit_percent:document.getElementById('as144AdminProfit').value||20,teacher_profit_percent:document.getElementById('as144TeacherProfit').value||50,library_profit_percent:document.getElementById('as144LibraryProfit').value||30,delegate_profit_percent:document.getElementById('as144CourierProfit').value||30},document.getElementById('as144ProfitsMsg')).catch(()=>{}));
    content.querySelector('[data-save="orders"]')?.addEventListener('click',()=>saveMany({delivery_fee:document.getElementById('as144DeliveryFee').value||0,order_pause_scope:document.getElementById('as144PauseScope').value,order_pause_reason:document.getElementById('as144PauseReason').value.trim(),delivery_enabled:document.getElementById('as144DeliveryEnabled').checked?'true':'false'},document.getElementById('as144OrdersMsg')).catch(()=>{}));
    content.querySelector('[data-save="contact"]')?.addEventListener('click',()=>saveMany({hero_title:document.getElementById('as144HeroTitle').value.trim(),hero_text:document.getElementById('as144HeroText').value.trim(),whatsapp:document.getElementById('as144Whatsapp').value.trim(),platform_phone:document.getElementById('as144Whatsapp').value.trim(),about_title:document.getElementById('as144AboutTitle').value.trim(),about_text:document.getElementById('as144AboutText').value.trim(),contact_title:document.getElementById('as144ContactTitle').value.trim(),contact_text:document.getElementById('as144ContactText').value.trim()},document.getElementById('as144ContactMsg')).catch(()=>{}));
    document.getElementById('as144SecuritySave')?.addEventListener('click',()=>saveAdminSecurity().catch(()=>{}));
  }

  Object.assign(window,{settingsSet,adminUser,saveAdminSecurity,renderSettingsAdmin:render,saveSystemSettings:()=>Promise.resolve(true),openSystemSettings:()=>window.adminTab?.('settings')});
  function install(){const button=[...document.querySelectorAll('#adminPage .admin-tabs button')].find(item=>(item.getAttribute('onclick')||'').includes("'settings'"));if(button){button.textContent='الإعدادات';button.dataset.adminTab='settings'}window.AlinAdminModules?.register?.('settings',render)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  window.AlinSettings=Object.freeze({render,set:settingsSet,saveMany,saveAdminSecurity});
})();

;

;
/* modules/admin/notifications.js */
// === admin/notifications.js ===
/* ALIN v2.2.6 — admin notification center registered directly in the admin shell. */
(function(){
  'use strict';

  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[char]));
  const roleLabel=role=>({
    all:'الجميع',teacher:'المدرسون',library:'المكتبات',student:'الطلبة والمتجر',courier:'المندوبون',accountant:'المحاسب'
  })[String(role||'all')]||'الجميع';
  const state={query:'',role:'',sending:false};

  function service(){return window.AlinNotifications}
  function rows(){return service()?.rows?.()||[]}
  function users(){
    const accounts=window.db?.accounts||{};
    return [
      ...(accounts.teachers||[]),
      ...(accounts.libraries||[]),
      ...(accounts.couriers||[]),
      ...(accounts.accountants||[])
    ];
  }
  function dateText(value){
    try{return new Date(value).toLocaleString(window.AlinI18n?.locale?.()||'ar-IQ')}
    catch(_){return ''}
  }
  function filteredRows(){
    const query=state.query.trim().toLowerCase();
    return rows().filter(row=>{
      const searchable=`${row.title||''} ${row.message||row.text||''}`.toLowerCase();
      const role=String(row.target_role||row.audience||'all');
      return (!query||searchable.includes(query))&&(!state.role||role===state.role);
    });
  }

  function render(){
    const root=document.getElementById('adminContent');
    if(!root)return false;
    const all=rows();
    const list=filteredRows();
    const week=all.filter(row=>Date.now()-new Date(row.created_at||0).getTime()<=7*864e5).length;
    const accountOptions=users().map(account=>`<option value="${escapeHtml(account.id)}">${escapeHtml(account.name||account.username||account.email||'حساب')}</option>`).join('');
    root.innerHTML=`<section class="admin-v146-notifications">
      <header class="admin-v146-head"><div><h2>مركز الإشعارات</h2><p>إرسال الإشعارات ومراجعة السجل من مصدر واحد.</p></div><div class="admin-v146-bell">🔔</div></header>
      <div class="admin-v146-grid">
        <article class="admin-v146-card"><h3>إرسال إشعار جديد</h3><div class="admin-v146-form">
          <select id="v146Audience"><option value="all">الجميع</option><option value="teacher">المدرسون</option><option value="library">المكتبات</option><option value="student">الطلبة والمتجر</option><option value="courier">المندوبون</option><option value="accountant">المحاسب</option></select>
          <select id="v146Priority"><option value="normal">عادي</option><option value="important">مهم</option><option value="urgent">عاجل</option></select>
          <select id="v146Target" class="full"><option value="">بدون حساب محدد</option>${accountOptions}</select>
          <input id="v146Title" class="full" placeholder="عنوان الإشعار">
          <textarea id="v146Message" class="full" placeholder="اكتب نص الإشعار"></textarea>
          <button id="v146SendButton" class="admin-v146-send" type="button" onclick="AlinAdminNotifications.send()">إرسال الإشعار</button>
          <div id="v146Status" class="admin-v146-status"></div>
        </div></article>
        <article class="admin-v146-card"><div class="admin-v146-list-head"><h3>سجل الإشعارات</h3><button type="button" onclick="AlinAdminNotifications.refresh()">تحديث</button></div>
          <div class="admin-v146-stats"><div><small>الإجمالي</small><b>${all.length}</b></div><div><small>آخر 7 أيام</small><b>${week}</b></div><div><small>النتائج</small><b>${list.length}</b></div></div>
          <div class="admin-v146-tools"><input placeholder="بحث" value="${escapeHtml(state.query)}" oninput="AlinAdminNotifications.filter('query',this.value)"><select onchange="AlinAdminNotifications.filter('role',this.value)"><option value="">كل الفئات</option>${['all','teacher','library','student','courier','accountant'].map(role=>`<option value="${role}" ${state.role===role?'selected':''}>${roleLabel(role)}</option>`).join('')}</select></div>
          <div class="admin-v146-list">${list.length?list.map(row=>`<div class="admin-v146-item"><div><h4>${escapeHtml(row.title||'إشعار')}</h4><p>${escapeHtml(row.message||row.text||'')}</p><div class="admin-v146-meta"><span>${roleLabel(row.target_role||row.audience||'all')}</span><span>${escapeHtml(row.priority||'normal')}</span><span>${escapeHtml(dateText(row.created_at))}</span></div></div><button type="button" class="danger" onclick="AlinAdminNotifications.remove('${escapeHtml(row.id)}')">حذف</button></div>`).join(''):'<div class="admin-v146-empty">لا توجد إشعارات حالياً.</div>'}</div>
        </article>
      </div>
    </section>`;
    return true;
  }

  async function send(){
    if(state.sending)return;
    const status=document.getElementById('v146Status');
    const button=document.getElementById('v146SendButton');
    const title=document.getElementById('v146Title')?.value.trim()||'';
    const message=document.getElementById('v146Message')?.value.trim()||'';
    const role=document.getElementById('v146Audience')?.value||'all';
    const priority=document.getElementById('v146Priority')?.value||'normal';
    const targetId=document.getElementById('v146Target')?.value||'';
    if(!title||!message){if(status)status.textContent='اكتب العنوان ونص الإشعار.';return false}
    if(!service()?.send){if(status)status.textContent='خدمة الإشعارات غير جاهزة.';return false}
    state.sending=true;
    if(button){button.disabled=true;button.textContent='جارٍ الإرسال...'}
    try{
      const result=await service().send({title,message,role,target_id:targetId||null,priority,from_user:'admin'});
      if(typeof window.audit==='function')await window.audit('notification',`إرسال إشعار ${title}`);
      if(status)status.textContent=result.remote?'تم إرسال الإشعار بنجاح.':'تم حفظ الإشعار محليًا، وتعذر رفعه إلى الخادم.';
      render();
      return true;
    }catch(error){
      console.error('[ALIN admin notifications]',error);
      if(status)status.textContent=error?.message||'تعذر إرسال الإشعار.';
      return false;
    }finally{
      state.sending=false;
      if(button){button.disabled=false;button.textContent='إرسال الإشعار'}
    }
  }

  async function refresh(){
    await service()?.refresh?.();
    render();
  }

  async function remove(id){
    if(!confirm('حذف هذا الإشعار؟'))return false;
    try{await service()?.remove?.(id);render();return true}
    catch(error){console.error(error);alert(error?.message||'تعذر حذف الإشعار');return false}
  }

  function filter(key,value){state[key]=value;render()}

  const api=Object.freeze({render,send,refresh,remove,filter});
  window.AlinAdminNotifications=api;
  window.renderNotificationsAdmin=render;
  window.AlinAdminModules?.register?.('notifications',render);

  window.addEventListener('alin:notifications-updated',()=>{
    if(window.activeAdminTab==='notifications')render();
  });
})();

;
/* modules/admin/couriers.js */
// === admin/couriers.js ===
/*
  إدارة المندوبين ومناطقهم موجودة في modules/courier/admin.js و modules/courier/areas.js.
  نموذج إنشاء حساب المندوب أصبح جزءاً أصيلاً من modules/admin/accounts.js
  بدون تغليف renderAccountsAdmin أو addAccount.
*/
(function(){
  'use strict';
  window.AlinAdminModules?.register?.('couriers',root=>{
    if(root)root.dataset.courierAccountsIntegrated='true';
  });
})();

;

;
/* modules/courier/core.js */
// === courier/core.js ===
/* ALIN v2.4.2 — single courier data, areas, workflow, and refresh service. */
(function(){
  'use strict';

  const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
  const arr=v=>Array.isArray(v)?v:[];
  const escv=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const moneyv=v=>typeof money==='function'?money(v):Number(v||0).toLocaleString(window.AlinI18n?.locale?.()||'ar-IQ');
  const now=()=>new Date().toISOString();
  const notify=m=>typeof toast==='function'?toast(m):alert(m);
  const currentAccount=()=>{try{return window.current||current||null}catch(_){return window.current||null}};
  const dbx=()=>window.db||{};
  const DEFAULT_AREAS=['القادسية','الحرية','الإسكان','عرفة','رحيم آوه','شوراو','طريق بغداد','الواسطي','دوميز','بنجا علي','تسعين','حي النصر','حي النداء','الخضراء','المصلى','القورية','الشورجة','واحد حزيران','الحي العسكري','حي المعلمين','حي الجامعة','حي عدن','حي الزوراء','حي الحسين','حي العمل الشعبي','غرناطة','المنصور','البلديات','الشرطة','النداء'];
  let refreshPromise=null,lastRefresh=0;

  window.AlinCourierModules=window.AlinCourierModules||{};
  window.ALIN_KIRKUK_AREAS=DEFAULT_AREAS.slice();
  window.alinNormalizeDeliveryArea=window.alinNormalizeDeliveryArea||function(value){
    return String(value||'').replace(/[ـً-ٰٟ]/g,'').replace(/\s+/g,' ').trim().split(/\s*[—–-]\s*/)[0].trim();
  };

  function keyOf(row){return String(row?.id||row?.account_id||row?.auth_user_id||row?.username||'')}
  function allCouriers(){
    const database=dbx(),accounts=database.accounts||{};
    const sources=[...arr(accounts.couriers),...arr(accounts.all).filter(x=>x.role==='courier'),...arr(database.couriers),...arr(window.couriers)];
    const map=new Map();
    for(const row of sources){const key=keyOf(row);if(key)map.set(key,{...(map.get(key)||{}),...row,role:'courier'})}
    return [...map.values()];
  }
  function areasOf(c){
    if(!c)return[];let raw=c.areas||c.area_ids||c.area||[];
    if(Array.isArray(raw))return [...new Set(raw.map(String).map(x=>x.trim()).filter(Boolean))];
    if(typeof raw==='string'){
      try{const parsed=JSON.parse(raw);if(Array.isArray(parsed))return [...new Set(parsed.map(String).map(x=>x.trim()).filter(Boolean))]}catch(_){ }
      return [...new Set(raw.split(/[,،|]/).map(x=>x.trim()).filter(Boolean))];
    }
    return[];
  }
  function areaRows(){
    const rows=arr(dbx().delivery_areas||dbx().deliveryAreas).filter(x=>x.active!==false&&String(x.status||'active')!=='inactive');
    return rows.length?rows:DEFAULT_AREAS.map((name,index)=>({id:`KA${index+1}`,name,status:'active',sort_order:index+1}));
  }
  function statusOf(c){if(!c||c.status==='inactive')return'inactive';const s=String(c.availability||c.work_status||'available');return ['available','busy','offline'].includes(s)?s:'available'}
  function statusLabel(s){return({available:'متاح',busy:'مشغول',offline:'خارج الخدمة',inactive:'موقوف',active:'فعال'})[s]||s}
  function resolveCourier(){
    const me=currentAccount();if(!me||String(me.role)!=='courier')return null;
    const rows=allCouriers();
    const found=rows.find(c=>String(c.id||c.account_id||'')===String(me.id))
      ||rows.find(c=>me.auth_user_id&&String(c.auth_user_id||'')===String(me.auth_user_id))
      ||rows.find(c=>me.username&&String(c.username||'').toLowerCase()===String(me.username).toLowerCase());
    const merged={...me,...(found||{}),id:found?.id||me.id,role:'courier'};
    if(!merged.areas&&merged.area)merged.areas=[merged.area];
    return merged;
  }
  function allOrders(){return arr(dbx().orders)}
  function myOrders(c=resolveCourier()){
    if(!c)return[];
    const ids=new Set([c.id,c.account_id,currentAccount()?.id].filter(Boolean).map(String));
    return allOrders().filter(o=>ids.has(String(o.courier_id||o.delegate_id||o.courier_account_id||'')))
      .sort((a,b)=>String(b.created_at||b.updated_at||'').localeCompare(String(a.created_at||a.updated_at||'')));
  }
  function settlements(){return arr(window.courierSettlements).length?arr(window.courierSettlements):arr(dbx().courierSettlements||dbx().delegate_settlements)}
  function done(o){return ['completed','delivered'].includes(String(o.status||''))}
  function cancelled(o){return ['cancelled','rejected','assignment_expired'].includes(String(o.status||''))}
  function active(o){return !done(o)&&!cancelled(o)}
  function activeLoad(c){return myOrders(c).filter(active).length}
  function today(o){const x=o.delivered_at||o.completed_at||o.updated_at||o.created_at||'';return String(x).slice(0,10)===new Date().toISOString().slice(0,10)}
  function todayDone(c){return myOrders(c).filter(o=>done(o)&&today(o)).length}
  function financials(c){
    const serverSummary=window.AlinFinance?.delegateSummary?.(c?.id);
    if(serverSummary)return{collected:+serverSummary.collected||0,earnings:+serverSummary.earnings||+serverSummary.earned||0,paid:+serverSummary.settled||+serverSummary.paid||0,debt:+serverSummary.debt||+serverSummary.remaining||0,balance:+serverSummary.earned||0};
    const rows=myOrders(c).filter(done),collected=rows.reduce((a,o)=>a+(+o.total||0),0),earnings=rows.reduce((a,o)=>a+(+o.delegate_profit||+o.courier_profit||0),0);
    const paid=settlements().filter(s=>String(s.courier_id||s.delegate_id||s.party_id||'')===String(c.id)&&String(s.status||'paid')!=='cancelled').reduce((a,s)=>a+(+s.amount||0),0);
    return{collected,earnings,paid,debt:Math.max(0,collected-earnings-paid),balance:earnings};
  }
  const ORDER_STATUSES=Object.freeze({pending:'pending',new:'new',pending_admin:'pending_admin',assigned:'assigned',accepted:'accepted',picked_up:'picked_up',out_for_delivery:'out_for_delivery',processing:'processing',ready:'ready',completed:'completed',delivered:'delivered',cancelled:'cancelled',rejected:'rejected'});
  function orderState(st){return({pending:'جديد',pending_admin:'بانتظار التعيين',assigned:'بانتظار القبول',new:'طلب جديد',accepted:'مقبول',picked_up:'تم استلام الطلب',out_for_delivery:'في الطريق',out_delivery:'في الطريق',processing:'قيد التنفيذ',ready:'جاهز',completed:'تم التسليم',delivered:'تم التسليم',cancelled:'ملغي',rejected:'مرفوض'})[st]||st||'جديد'}
  function workflowValues(status){
    const value=String(status||'').trim();
    if(!Object.values(ORDER_STATUSES).includes(value))throw new Error('حالة الطلب المطلوبة غير معتمدة');
    const stamp=now(),values={status:value,updated_at:stamp};
    if(value==='assigned'){values.assignment_status='assigned';values.assigned_at=stamp}
    if(value==='accepted'){values.assignment_status='accepted';values.accepted_at=stamp}
    if(value==='picked_up'){values.picked_up_at=stamp}
    if(value==='out_for_delivery'){values.out_for_delivery_at=stamp}
    if(value==='completed'||value==='delivered'){values.assignment_status='completed';values.completed_at=stamp;values.delivered_at=stamp}
    if(value==='rejected'){values.assignment_status='rejected';values.rejected_at=stamp}
    if(value==='cancelled'){values.assignment_status='cancelled';values.cancelled_at=stamp}
    return values;
  }
  function friendlyOrderError(error){
    const msg=String(error?.message||error||'');
    if(msg.includes('orders_status_valid'))return 'تعذر تحديث الطلب لأن حالات الطلب في قاعدة البيانات تحتاج تحديث v2.1.8.';
    if(msg.includes("assigned_at")||msg.includes("accepted_at")||msg.includes("picked_up_at")||msg.includes("rejected_at"))return 'قاعدة البيانات تحتاج تشغيل تحديث طلبات المندوب v2.1.8.';
    if(msg.includes('schema cache'))return 'تم تحديث البرنامج لكن مخطط Supabase لم يتحدث بعد. شغّل ملف SQL v2.1.8 مرة واحدة.';
    return 'تعذر تحديث طلب المندوب. تحقق من الاتصال ثم أعد المحاولة.';
  }
  function mapLink(o){const lat=o.delivery_latitude||o.delivery_lat||o.latitude,lng=o.delivery_longitude||o.delivery_lng||o.longitude;return o.delivery_location_url||o.delivery_map_url||o.gps_url||(lat&&lng?`https://maps.google.com/?q=${lat},${lng}`:'')}
  function phoneLink(p){p=String(p||'').replace(/\D/g,'');return p?`tel:+${p.startsWith('964')?p:'964'+p.replace(/^0/,'')}`:'#'}
  function waLink(p){p=String(p||'').replace(/\D/g,'');return p?`https://wa.me/${p.startsWith('964')?p:'964'+p.replace(/^0/,'')}`:'#'}
  function fmtDate(v){if(!v)return'—';try{return new Date(v).toLocaleString(window.AlinI18n?.locale?.()||'ar-IQ')}catch(_){return String(v)}}
  function matchingCouriers(area){const target=window.alinNormalizeDeliveryArea(area);return allCouriers().filter(c=>c.status!=='inactive'&&areasOf(c).some(name=>window.alinNormalizeDeliveryArea(name)===target)).sort((a,b)=>activeLoad(a)-activeLoad(b))}
  function activeCouriers(){return allCouriers().filter(c=>c.status!=='inactive')}
  function alinCouriersOptions(){return activeCouriers().map(c=>`<option value="${escv(c.id)}">${escv(c.name||'مندوب')}${areasOf(c).length?' — '+escv(areasOf(c).join('، ')):''}</option>`).join('')}

  function mergeOwnRows(courierRow,orderRows){
    const database=dbx();
    if(courierRow){
      const rows=allCouriers().filter(x=>String(x.id)!==String(courierRow.id));rows.push(courierRow);
      database.couriers=rows;database.accounts=database.accounts||{};database.accounts.couriers=rows;
      try{window.couriers=rows}catch(_){ }
    }
    if(Array.isArray(orderRows)){
      const ownId=String(currentAccount()?.id||''),freshIds=new Set(orderRows.map(x=>String(x.id)));
      const retained=allOrders().filter(x=>!freshIds.has(String(x.id))&&String(x.courier_id||x.delegate_id||'')!==ownId);
      database.orders=[...orderRows,...retained];
    }
  }
  async function refreshCourierData(force=false){
    const me=currentAccount();if(!me||me.role!=='courier')return null;
    if(!force&&Date.now()-lastRefresh<2500)return resolveCourier();
    if(refreshPromise)return refreshPromise;
    refreshPromise=(async()=>{
      const client=window.sb||window.AlinCloud?.client?.();if(!client)return resolveCourier();
      const [courierResult,ordersResult]=await Promise.all([
        client.from('couriers').select('*').eq('id',me.id).maybeSingle(),
        client.from('orders').select('*').or(`courier_id.eq.${me.id},delegate_id.eq.${me.id}`).order('created_at',{ascending:false})
      ]);
      if(courierResult.error)console.warn('[ALIN courier row]',courierResult.error);
      if(ordersResult.error)console.warn('[ALIN courier orders]',ordersResult.error);
      mergeOwnRows(courierResult.data||null,ordersResult.error?null:(ordersResult.data||[]));lastRefresh=Date.now();return resolveCourier();
    })().catch(error=>{console.error('[ALIN courier refresh]',error);return resolveCourier()}).finally(()=>{refreshPromise=null});
    return refreshPromise;
  }


  function resetRefresh(){lastRefresh=0}

  window.AlinCourierCore=Object.freeze({
    $, $$, arr, escv, moneyv, now, notify, currentAccount, dbx,
    allCouriers, areasOf, areaRows, statusOf, statusLabel, resolveCourier,
    allOrders, myOrders, settlements, done, cancelled, active, activeLoad, today, todayDone, financials,
    orderState, workflowValues, friendlyOrderError, mapLink, phoneLink, waLink, fmtDate,
    matchingCouriers, activeCouriers, alinCouriersOptions, refreshCourierData, resetRefresh
  });
})();

;

;
/* modules/courier/admin.js */
// === courier/admin.js ===
/* ALIN v2.4.2 — courier account administration only. */
(function(){
  'use strict';
  const core=window.AlinCourierCore;if(!core)throw new Error('AlinCourierCore is required before courier/admin.js');
  const {$,$$,escv,moneyv,notify,now,allCouriers,areasOf,areaRows,statusOf,statusLabel,myOrders,financials,active,done,activeLoad,todayDone,orderState,activeCouriers,alinCouriersOptions}=core;
  function renderCouriersAdmin(){
    const rows=allCouriers(),areas=[...new Set([...areaRows().map(x=>x.name),...rows.flatMap(areasOf)])];
    const debt=rows.reduce((sum,c)=>sum+financials(c).debt,0);
    adminContent.innerHTML=`<section class="v164-admin-couriers"><header class="v164-admin-head"><div><small>نظام التوصيل</small><h2>إدارة المندوبين</h2><p>الحسابات والمناطق والحالة والطلبات والذمم من مكان واحد.</p></div><div><button onclick="adminTab('deliveryOrders')">طلبات التوصيل</button><button onclick="adminTab('courierAreas')">إدارة المناطق</button><button onclick="alinV161CourierForm()">+ إضافة مندوب</button></div></header><section class="v164-admin-metrics"><article><small>إجمالي المندوبين</small><strong>${rows.length}</strong></article><article><small>فعالون</small><strong>${rows.filter(c=>c.status!=='inactive').length}</strong></article><article><small>متاحون</small><strong>${rows.filter(c=>statusOf(c)==='available').length}</strong></article><article><small>طلبات جارية</small><strong>${rows.reduce((sum,c)=>sum+activeLoad(c),0)}</strong></article><article><small>إجمالي الذمم</small><strong>${moneyv(debt)} د.ع</strong></article></section><section class="v164-admin-tools"><input id="v216CourierQ" placeholder="بحث بالاسم أو الهاتف أو المنطقة" oninput="alinV216FilterCouriers()"><select id="v216CourierStatus" onchange="alinV216FilterCouriers()"><option value="">كل الحالات</option><option value="available">متاح</option><option value="busy">مشغول</option><option value="offline">خارج الخدمة</option><option value="inactive">موقوف</option></select><select id="v216CourierArea" onchange="alinV216FilterCouriers()"><option value="">كل المناطق</option>${areas.map(a=>`<option value="${escv(a)}">${escv(a)}</option>`).join('')}</select></section><div class="v164-admin-grid" id="v216CourierGrid">${rows.map(adminCourierCard).join('')||'<div class="empty">لا يوجد مندوبون بعد.</div>'}</div></section>`;
  }
  function adminCourierCard(c){const status=c.status==='inactive'?'inactive':statusOf(c),areas=areasOf(c),f=financials(c);return `<article class="v164-admin-card" data-search="${escv(((c.name||'')+' '+(c.phone||'')+' '+(c.username||'')+' '+areas.join(' ')).toLowerCase())}" data-status="${status}" data-areas="${escv(areas.join('|'))}"><header><div class="v161-avatar">${escv((c.name||'م').slice(0,1))}</div><div><h3>${escv(c.name||'مندوب')}</h3><p>${escv(c.phone||'بدون هاتف')} • ${escv(c.username||'بدون اسم دخول')}</p></div><span class="v161-status ${status}">${statusLabel(status)}</span></header><div class="v164-card-metrics"><div><small>الطلبات الحالية</small><b>${activeLoad(c)}</b></div><div><small>مكتملة اليوم</small><b>${todayDone(c)}</b></div><div><small>الذمة</small><b>${moneyv(f.debt)} د.ع</b></div></div><div class="v161-area-chips">${areas.map(a=>`<span>${escv(a)}</span>`).join('')||'<span>غير مرتبط بمنطقة</span>'}</div><footer><button onclick="alinV164CourierDetails('${escv(c.id)}')">التفاصيل</button><button onclick="alinV161CourierForm('${escv(c.id)}')">تعديل</button><button class="secondary" onclick="alinV164AdminStatus('${escv(c.id)}')">تغيير الحالة</button><button class="danger" onclick="alinV161ToggleCourier('${escv(c.id)}')">${c.status==='inactive'?'تفعيل':'إيقاف'}</button></footer></article>`}
  window.alinV216FilterCouriers=function(){const q=String($('#v216CourierQ')?.value||'').toLowerCase(),status=$('#v216CourierStatus')?.value||'',area=$('#v216CourierArea')?.value||'';$$('#v216CourierGrid .v164-admin-card').forEach(card=>card.hidden=!((!q||card.dataset.search.includes(q))&&(!status||card.dataset.status===status)&&(!area||card.dataset.areas.split('|').includes(area))))};
  window.alinV161CourierForm=function(id=''){
    const c=allCouriers().find(x=>String(x.id)===String(id))||{},selected=areasOf(c),box=window.checkoutBox||$('#checkoutBox'),modal=window.checkoutModal||$('#checkoutModal');if(!box||!modal)return;
    box.innerHTML=`<div class="v161-form"><h2>${id?'تعديل المندوب':'إضافة مندوب'}</h2><div class="form-grid"><input id="v161CourierName" value="${escv(c.name||'')}" placeholder="اسم المندوب"><input id="v161CourierPhone" value="${escv(c.phone||'')}" placeholder="رقم الهاتف"><input id="v161CourierUsername" value="${escv(c.username||'')}" placeholder="اسم المستخدم"><input id="v161CourierPassword" type="password" autocomplete="new-password" placeholder="${id?'كلمة مرور جديدة من 12 حرفاً (اختياري)':'كلمة مرور من 12 حرفاً وحروف وأرقام'}"><select id="v161CourierAvailability"><option value="available" ${statusOf(c)==='available'?'selected':''}>متاح</option><option value="busy" ${statusOf(c)==='busy'?'selected':''}>مشغول</option><option value="offline" ${statusOf(c)==='offline'?'selected':''}>خارج الخدمة</option></select></div><h3>مناطق العمل</h3><div class="v161-area-picker">${areaRows().map(a=>`<label><input type="checkbox" value="${escv(a.name)}" ${selected.includes(a.name)?'checked':''}> ${escv(a.name)}</label>`).join('')}</div><button onclick="alinV161SaveCourier('${escv(id)}')">حفظ المندوب</button></div>`;modal.classList.remove('hidden');
  };
  window.alinV161SaveCourier=async function(id=''){
    try{
      const name=$('#v161CourierName')?.value.trim()||'',phone=$('#v161CourierPhone')?.value.trim()||'',username=$('#v161CourierUsername')?.value.trim()||'',password=$('#v161CourierPassword')?.value||'',availability=$('#v161CourierAvailability')?.value||'available',areas=$$('.v161-area-picker input:checked').map(x=>x.value);
      if(!name||!username||(!id&&!password))throw new Error('أكمل الاسم واسم المستخدم وكلمة المرور');if(!phone)throw new Error('أدخل رقم هاتف المندوب');if(!areas.length)throw new Error('اختر منطقة عمل واحدة على الأقل');if(password&&(password.length<12||!/[0-9]/.test(password)||!/[A-Za-z\u0600-\u06FF]/.test(password)))throw new Error('كلمة المرور يجب أن تكون 12 حرفاً على الأقل وتتضمن حروفاً وأرقاماً');
      const api=window.ALINAuth;if(!api)throw new Error('خدمة الحسابات الآمنة غير جاهزة');
      const payload={role:'courier',name,username,phone,area:areas[0],areas,availability,status:'active'};if(password)payload.password=password;
      if(id)await api.updateAccountFromAdmin({account_id:id,...payload});else await api.createAccount(payload);
      if(typeof audit==='function')await audit('courier',`${id?'تعديل':'إضافة'} مندوب ${name}`);if(typeof load==='function')await load();if(typeof closeCheckout==='function')closeCheckout();renderCouriersAdmin();notify('تم حفظ حساب المندوب ومناطق عمله');
    }catch(error){alert(error.message||'تعذر حفظ المندوب')}
  };
  window.alinV161ToggleCourier=async function(id){const c=allCouriers().find(x=>String(x.id)===String(id));if(!c)return;const next=c.status==='inactive'?'active':'inactive';try{const api=window.ALINAuth;if(api?.updateAccountFromAdmin)await api.updateAccountFromAdmin({account_id:id,role:'courier',status:next,name:c.name,username:c.username,phone:c.phone,area:areasOf(c)[0]||'',areas:areasOf(c),availability:statusOf(c)});else await update('couriers',{status:next,updated_at:now()},{id});if(typeof load==='function')await load();renderCouriersAdmin()}catch(error){alert(error.message||'تعذر تحديث الحساب')}};
  window.alinV164AdminStatus=async function(id){const c=allCouriers().find(x=>String(x.id)===String(id));if(!c)return;const value=prompt('الحالة: available أو busy أو offline',statusOf(c));if(!['available','busy','offline'].includes(String(value)))return;try{await update('couriers',{availability:value,updated_at:now()},{id});if(typeof load==='function')await load();renderCouriersAdmin()}catch(error){alert(error.message||'تعذر تحديث الحالة')}};
  window.alinV164CourierDetails=function(id){const c=allCouriers().find(x=>String(x.id)===String(id)),box=window.checkoutBox||$('#checkoutBox'),modal=window.checkoutModal||$('#checkoutModal');if(!c||!box||!modal)return;const rows=myOrders(c),f=financials(c);box.innerHTML=`<section class="v164-details"><header><div class="v161-avatar">${escv((c.name||'م').slice(0,1))}</div><div><h2>${escv(c.name||'مندوب')}</h2><p>${escv(c.phone||'')} • ${escv(c.username||'')}</p></div><span class="v161-status ${statusOf(c)}">${statusLabel(statusOf(c))}</span></header><div class="v164-admin-metrics"><article><small>طلبات حالية</small><strong>${rows.filter(active).length}</strong></article><article><small>طلبات مكتملة</small><strong>${rows.filter(done).length}</strong></article><article><small>أرباحه</small><strong>${moneyv(f.earnings)} د.ع</strong></article><article><small>ذمته</small><strong>${moneyv(f.debt)} د.ع</strong></article></div><h3>مناطق العمل</h3><div class="v161-area-chips">${areasOf(c).map(a=>`<span>${escv(a)}</span>`).join('')}</div><h3>آخر الطلبات</h3><div class="v164-mini-orders">${rows.slice(0,8).map(o=>`<div><span>${escv(o.order_number||o.id)}</span><span>${escv(o.delivery_area||'')}</span><b>${moneyv(o.total)} د.ع</b><small>${escv(orderState(o.status))}</small></div>`).join('')||'<p class="empty">لا توجد طلبات.</p>'}</div></section>`;modal.classList.remove('hidden')};


  window.renderCouriersAdmin=renderCouriersAdmin;
  window.activeCouriers=activeCouriers;
  window.alinCouriersOptions=alinCouriersOptions;
  window.addCourier=()=>window.alinV161CourierForm();
  window.toggleCourier=window.alinV161ToggleCourier;
  Object.assign(window.AlinCourierModules,{activeCouriers,renderCouriersAdmin,addCourier:window.addCourier,toggleCourier:window.toggleCourier,alinCouriersOptions});
  window.AlinAdminModules?.register?.('couriers',renderCouriersAdmin);
})();

;

;
/* modules/courier/areas.js */
// === courier/areas.js ===
/* ALIN v2.4.2 — delivery area administration only. */
(function(){
  'use strict';
  const core=window.AlinCourierCore;if(!core)throw new Error('AlinCourierCore is required before courier/areas.js');
  const {escv,notify,now,allCouriers,areasOf,areaRows}=core;
  function renderCourierAreasAdmin(){const rows=areaRows();adminContent.innerHTML=`<section class="v161-admin"><header class="v161-title"><div><small>مناطق التوصيل</small><h2>إدارة المناطق</h2><p>هذه القائمة تظهر للطالب وعند تحديد مناطق عمل المندوب.</p></div><button onclick="alinV161AddArea()">+ إضافة منطقة</button></header><div class="v161-area-admin">${rows.map(a=>{const count=allCouriers().filter(c=>areasOf(c).includes(a.name)).length;return `<article><div><h3>${escv(a.name)}</h3><p>مرتبطة بـ ${count} مندوب</p></div><div><button onclick="alinV161EditArea('${escv(a.id)}','${escv(a.name)}')">تعديل</button><button class="danger" onclick="alinV161DeleteArea('${escv(a.id)}','${escv(a.name)}')">حذف</button></div></article>`}).join('')}</div></section>`}
  window.alinV161AddArea=async function(){const name=(prompt('اسم المنطقة الجديدة')||'').trim();if(!name)return;try{await insert('delivery_areas',{id:typeof uid==='function'?uid('A'):`A${Date.now()}`,name,city:'كركوك',status:'active',sort_order:areaRows().length+1});if(typeof load==='function')await load();renderCourierAreasAdmin();notify('تمت إضافة المنطقة')}catch(error){alert(error.message||'تعذر إضافة المنطقة')}};
  window.alinV161EditArea=async function(id,oldName){const name=(prompt('تعديل اسم المنطقة',oldName)||'').trim();if(!name||name===oldName)return;try{await update('delivery_areas',{name},{id});for(const c of allCouriers()){const areas=areasOf(c);if(areas.includes(oldName))await update('couriers',{areas:areas.map(x=>x===oldName?name:x),area:c.area===oldName?name:c.area,updated_at:now()},{id:c.id})}if(typeof load==='function')await load();renderCourierAreasAdmin();notify('تم تعديل المنطقة')}catch(error){alert(error.message||'تعذر تعديل المنطقة')}};
  window.alinV161DeleteArea=async function(id,name){if(allCouriers().some(c=>areasOf(c).includes(name)))return alert('لا يمكن حذف منطقة مرتبطة بمندوب');if(!confirm(`حذف منطقة ${name}؟`))return;try{await update('delivery_areas',{status:'inactive'},{id});if(typeof load==='function')await load();renderCourierAreasAdmin();notify('تم حذف المنطقة')}catch(error){alert(error.message||'تعذر حذف المنطقة')}};


  window.renderCourierAreasAdmin=renderCourierAreasAdmin;
  window.AlinAdminModules?.register?.('courierAreas',renderCourierAreasAdmin);
})();

;

;
/* modules/courier/assignment.js */
// === courier/assignment.js ===
/* ALIN v2.4.2 — delivery order assignment and admin workflow only. */
(function(){
  'use strict';
  const core=window.AlinCourierCore;if(!core)throw new Error('AlinCourierCore is required before courier/assignment.js');
  const {$,escv,moneyv,notify,now,allOrders,active,done,matchingCouriers,allCouriers,mapLink,orderState,statusLabel,statusOf,activeLoad,workflowValues,friendlyOrderError}=core;
  function deliveryOrders(){return allOrders().filter(o=>o.fulfillment_type==='home_delivery'||o.delivery_area)}
  function renderDeliveryOrdersAdmin(){const rows=deliveryOrders();adminContent.innerHTML=`<section class="v164-admin-couriers"><header class="v164-admin-head"><div><small>توزيع الطلبات</small><h2>طلبات التوصيل</h2><p>اختيار المندوب حسب المنطقة مع عرض الطالب ونقطة الدلالة والموقع.</p></div><button onclick="renderCouriersAdmin()">إدارة المندوبين</button></header><section class="v164-admin-metrics"><article><small>كل طلبات التوصيل</small><strong>${rows.length}</strong></article><article><small>بانتظار التعيين</small><strong>${rows.filter(o=>!o.courier_id&&!o.delegate_id).length}</strong></article><article><small>قيد التوصيل</small><strong>${rows.filter(o=>active(o)&&(o.courier_id||o.delegate_id)).length}</strong></article><article><small>مكتملة</small><strong>${rows.filter(done).length}</strong></article></section><div class="v164-delivery-admin-list">${rows.map(deliveryAdminCard).join('')||'<div class="empty">لا توجد طلبات توصيل.</div>'}</div></section>`}
  function deliveryAdminCard(o){const area=window.alinNormalizeDeliveryArea(o.delivery_area)||'غير محددة',matches=matchingCouriers(area),assigned=allCouriers().find(c=>String(c.id)===String(o.courier_id||o.delegate_id||'')),map=mapLink(o);return `<article class="v164-delivery-admin-card"><header><div><small>${escv(o.order_number||o.id)}</small><h3>${escv(o.title||'طلب توصيل')}</h3></div><span>${escv(area)}</span></header>${o.delivery_note?`<div class="v164-issue">ملاحظة المندوب: ${escv(o.delivery_note)}</div>`:''}<div class="v164-order-grid"><div><small>الطالب</small><b>${escv(o.student_name||'—')}</b></div><div><small>الهاتف</small><b>${escv(o.student_phone||'—')}</b></div><div class="wide"><small>أقرب نقطة دالة</small><b>${escv(o.delivery_landmark||'—')}</b></div><div><small>المبلغ</small><b>${moneyv(o.total)} د.ع</b></div><div><small>الحالة</small><b>${escv(orderState(o.status))}</b></div></div>${map?`<a class="v164-map-btn" href="${escv(map)}" target="_blank" rel="noopener">فتح موقع الطالب GPS</a>`:''}<div class="v164-match-list"><h4>المندوبون المطابقون للمنطقة (${matches.length})</h4>${matches.map(c=>`<label><input type="radio" name="v216assign_${escv(o.id)}" value="${escv(c.id)}" ${assigned&&String(assigned.id)===String(c.id)?'checked':''}><span><b>${escv(c.name)}</b><small>${statusLabel(statusOf(c))} • ${activeLoad(c)} طلب حالي • ${escv(c.phone||'')}</small></span></label>`).join('')||'<p class="warning-text">لا يوجد مندوب مرتبط بهذه المنطقة.</p>'}</div><footer><button ${!matches.length?'disabled':''} onclick="alinV164Assign('${escv(o.id)}')">${assigned?'إعادة تحويل':'تحويل للمندوب'}</button>${assigned?`<span>المندوب الحالي: <b>${escv(assigned.name)}</b></span>`:'<span>لم يتم تعيين مندوب</span>'}</footer></article>`}
  window.alinV164Assign=async function(id){
    const selected=document.querySelector(`input[name="v216assign_${CSS.escape(String(id))}"]:checked`)?.value;
    if(!selected)return notify('اختر مندوباً أولاً');
    try{
      await update('orders',{courier_id:selected,delegate_id:selected,...workflowValues('assigned'),delivery_note:null},{id});
      if(typeof audit==='function')await audit('courier',`تحويل الطلب ${id} إلى المندوب ${selected}`);
      if(typeof load==='function')await load();
      renderDeliveryOrdersAdmin();
      notify('تم تحويل الطلب للمندوب');
      return true;
    }catch(error){console.error('[ALIN assign courier]',error);notify(friendlyOrderError(error));return false}
  };
  window.alinV161AssignOrder=window.alinV164Assign;
  async function assignCourier(id){
    const selected=$(`#assign_${CSS.escape(String(id))}`)?.value||null;
    try{
      const values=selected?{courier_id:selected,delegate_id:selected,...workflowValues('assigned')}:{courier_id:null,delegate_id:null,assignment_status:'pending_admin',status:'pending_admin',assigned_at:null,updated_at:now()};
      await update('orders',values,{id});
      if(typeof load==='function')await load();
      if(typeof renderCourierSettlementsAdmin==='function')renderCourierSettlementsAdmin();
      return true;
    }catch(error){console.error('[ALIN assign courier legacy screen]',error);notify(friendlyOrderError(error));return false}
  }
  async function courierOrderStatus(id,status){
    try{
      if(!window.AlinFinance?.transitionOrder)throw new Error('خدمة الطلبات الذرية غير جاهزة');
      await window.AlinFinance.transitionOrder(id,status);
      if(typeof renderCourierSettlementsAdmin==='function')renderCourierSettlementsAdmin();
      return true;
    }catch(error){console.error('[ALIN courier status admin]',error);notify(friendlyOrderError(error));return false}
  }


  window.renderDeliveryOrdersAdmin=renderDeliveryOrdersAdmin;
  window.assignCourier=assignCourier;
  window.courierOrderStatus=courierOrderStatus;
  Object.assign(window.AlinCourierModules,{assignCourier,courierOrderStatus,renderDeliveryOrdersAdmin});
  window.AlinAdminModules?.register?.('deliveryOrders',renderDeliveryOrdersAdmin);
})();

;

;
/* modules/courier/dashboard.js */
// === courier/dashboard.js ===
/* ALIN v2.4.2 — courier-facing dashboard renderer and actions only. */
(function(){
  'use strict';
  const core=window.AlinCourierCore;if(!core)throw new Error('AlinCourierCore is required before courier/dashboard.js');
  const {$,$$,arr,escv,moneyv,now,notify,currentAccount,dbx,areasOf,statusOf,statusLabel,resolveCourier,allOrders,myOrders,done,active,today,financials,orderState,workflowValues,friendlyOrderError,mapLink,phoneLink,waLink,fmtDate,refreshCourierData,resetRefresh}=core;
  let renderSerial=0;
  function ensureTabs(){const nav=$('.courier-v161-tabs');if(!nav)return;const wanted=[['home','الرئيسية'],['current','طلبات التوصيل'],['completed','المكتملة'],['finance','الحسابات'],['notifications','الإشعارات'],['profile','حسابي']];nav.innerHTML=wanted.map(([key,label])=>`<button type="button" data-courier-tab="${key}" onclick="renderCourierDashboard('${key}')">${label}${key==='current'?'<span id="courierCurrentBadge" hidden>0</span>':''}${key==='notifications'?'<span id="courierNotifyBadge" hidden>0</span>':''}</button>`).join('')}
  function notificationsFor(c){return window.AlinNotifications?.visible?.({role:'courier',id:String(c?.id||'')})||arr(dbx().notifications).filter(n=>String(n.courier_id||n.user_id||n.recipient_id||n.target_id||'')===String(c?.id)||['courier','delegate','all'].includes(String(n.target_role||n.role||n.audience||''))).sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')))}
  function setHeader(c,tab){const name=$('#courierV161Name'),areas=$('#courierV161Areas');if(name)name.textContent=c?.name||currentAccount()?.name||'المندوب';if(areas)areas.textContent=areasOf(c).join('، ')||'غير محددة';$$('.courier-v161-tabs [data-courier-tab]').forEach(b=>b.classList.toggle('active',b.dataset.courierTab===tab));const cb=$('#courierCurrentBadge'),nb=$('#courierNotifyBadge'),activeCount=myOrders(c).filter(active).length,unread=window.AlinNotifications?.unreadCount?.({role:'courier',id:String(c?.id||'')})??notificationsFor(c).filter(n=>!(n.read_at||n.is_read)).length;if(cb){cb.textContent=activeCount;cb.hidden=!activeCount}if(nb){nb.textContent=unread;nb.hidden=!unread}}
  function summary(c,rows){const f=financials(c);return `<section class="v174-metrics"><article><small>طلبات جديدة</small><strong>${rows.filter(o=>['assigned','new'].includes(String(o.status||''))).length}</strong></article><article><small>قيد التوصيل</small><strong>${rows.filter(o=>['accepted','picked_up','out_for_delivery','processing'].includes(String(o.status||''))).length}</strong></article><article><small>تم التسليم اليوم</small><strong>${rows.filter(o=>done(o)&&today(o)).length}</strong></article><article><small>كل المكتملة</small><strong>${rows.filter(done).length}</strong></article><article><small>أرباح التوصيل</small><strong>${moneyv(f.earnings)} د.ع</strong></article><article class="debt"><small>ذمتك للإدارة</small><strong>${moneyv(f.debt)} د.ع</strong></article></section>`}
  function homeHtml(c,rows){const currentRows=rows.filter(active).slice(0,5),notes=notificationsFor(c).slice(0,4);return `${summary(c,rows)}<section class="v174-home-grid"><article class="v174-panel"><header><div><small>حالة العمل</small><h2>${statusLabel(statusOf(c))}</h2></div><span class="v174-status ${statusOf(c)}"></span></header><div class="v174-status-actions"><button onclick="alinV174QuickStatus('available')">متاح</button><button onclick="alinV174QuickStatus('busy')">مشغول</button><button onclick="alinV174QuickStatus('offline')">خارج الخدمة</button></div><p>مناطق العمل: ${escv(areasOf(c).join('، ')||'غير محددة')}</p></article><article class="v174-panel"><header><div><small>طلبات تحتاج متابعة</small><h2>طلباتك الحالية</h2></div><button onclick="renderCourierDashboard('current')">عرض الكل</button></header><div class="v174-mini-list">${currentRows.map(o=>`<button onclick="renderCourierDashboard('current')"><b>${escv(o.order_number||o.id)}</b><span>${escv(window.alinNormalizeDeliveryArea(o.delivery_area)||'—')}</span><small>${escv(orderState(String(o.status||'')))}</small></button>`).join('')||'<p class="empty">لا توجد طلبات حالياً.</p>'}</div></article><article class="v174-panel wide"><header><div><small>آخر الإشعارات</small><h2>تنبيهات المندوب</h2></div><button onclick="renderCourierDashboard('notifications')">عرض الإشعارات</button></header><div class="v174-mini-list">${notes.map(n=>`<div><b>${escv(n.title||'إشعار')}</b><span>${escv(n.message||n.body||'')}</span><small>${escv(fmtDate(n.created_at))}</small></div>`).join('')||'<p class="empty">لا توجد إشعارات جديدة.</p>'}</div></article></section>`}
  function orderCard(o,actions=true){const st=String(o.status||'assigned'),phone=o.student_phone||'',map=mapLink(o),first=['assigned','new'].includes(st),accepted=st==='accepted',picked=st==='picked_up',moving=['out_for_delivery','processing'].includes(st);return `<article class="v174-order"><header><div><small>${escv(o.order_number||o.id)}</small><h3>${escv(o.title||'طلب توصيل')}</h3></div><span class="v174-order-state ${escv(st)}">${escv(orderState(st))}</span></header><div class="v174-order-data"><div><small>الطالب</small><b>${escv(o.student_name||'—')}</b></div><div><small>الهاتف</small><b>${escv(phone||'—')}</b></div><div><small>المنطقة</small><b>${escv(window.alinNormalizeDeliveryArea(o.delivery_area)||'—')}</b></div><div><small>المبلغ المطلوب</small><b>${moneyv(o.total)} د.ع</b></div><div><small>ربح التوصيل</small><b>${moneyv(o.delegate_profit||o.courier_profit||window.AlinFinance?.shares?.(o)?.delegate||0)} د.ع</b></div><div class="wide"><small>أقرب نقطة دالة</small><b>${escv(o.delivery_landmark||'—')}</b></div></div><div class="v174-links">${phone?`<a href="${phoneLink(phone)}">اتصال</a><a href="${waLink(phone)}" target="_blank" rel="noopener">واتساب</a>`:''}${map?`<a class="map" href="${escv(map)}" target="_blank" rel="noopener">فتح الموقع GPS</a>`:''}</div>${actions?`<div class="v174-actions">${first?`<button onclick="alinV164CourierStep('${escv(o.id)}','accepted')">قبول الطلب</button><button class="reject" onclick="alinV174Reject('${escv(o.id)}')">رفض الطلب</button>`:''}${accepted?`<button onclick="alinV164CourierStep('${escv(o.id)}','picked_up')">استلمت الطلب</button>`:''}${picked?`<button onclick="alinV164CourierStep('${escv(o.id)}','out_for_delivery')">بدء التوصيل</button>`:''}${moving?`<button class="success" onclick="alinV164CourierComplete('${escv(o.id)}')">تم التسليم واستلام المبلغ</button>`:''}<button class="secondary" onclick="alinV164ReportIssue('${escv(o.id)}')">إرسال ملاحظة للإدارة</button></div>`:`<footer>تم التسليم: ${escv(fmtDate(o.delivered_at||o.completed_at||o.updated_at))}</footer>`}</article>`}
  function ordersHtml(c,rows,completed=false){const list=rows.filter(completed?done:active);return `${summary(c,rows)}<section class="v174-head"><div><small>${completed?'سجل الإنجاز':'طلبات التوصيل'}</small><h2>${completed?'الطلبات المكتملة':'طلباتك الحالية'}</h2></div><span>${list.length}</span></section><div class="v174-orders">${list.map(o=>orderCard(o,!completed)).join('')||`<div class="empty">${completed?'لا توجد طلبات مكتملة بعد.':'لا توجد طلبات مسندة إليك حالياً.'}</div>`}</div>`}
  function financeHtml(c,rows){const f=financials(c),doneRows=rows.filter(done);return `${summary(c,rows)}<section class="v164-finance-grid"><article><small>المبالغ المستلمة</small><strong>${moneyv(f.collected)} د.ع</strong></article><article><small>أرباح التوصيل</small><strong>${moneyv(f.earnings)} د.ع</strong></article><article><small>المسدّد للإدارة</small><strong>${moneyv(f.paid)} د.ع</strong></article><article class="debt"><small>المبلغ بذمتك</small><strong>${moneyv(f.debt)} د.ع</strong></article></section><section class="v164-table-card"><h2>كشف الطلبات المالية</h2><div class="v164-finance-list">${doneRows.map(o=>`<div><span>${escv(o.order_number||o.id)}</span><span>${moneyv(o.total)} د.ع</span><span>ربح التوصيل ${moneyv(o.delegate_profit||o.courier_profit||window.AlinFinance?.shares?.(o)?.delegate||0)} د.ع</span><span>${escv(fmtDate(o.delivered_at||o.updated_at))}</span></div>`).join('')||'<p class="empty">لا توجد حركات مالية بعد.</p>'}</div></section>`}
  function notificationsHtml(c,rows){const notes=notificationsFor(c);return `${summary(c,rows)}<section class="v164-section-head"><div><h2>إشعارات المندوب</h2><p>الطلبات الجديدة ورسائل الإدارة والتسويات.</p></div><button onclick="alinV164CourierReadAll()">تحديد الكل كمقروء</button></section><div class="v164-notifications">${notes.map(n=>{const read=window.AlinNotifications?.isRead?.(n,{role:'courier',id:String(c?.id||'')})??Boolean(n.read_at||n.is_read);return `<article class="${read?'read':''}"><div><h3>${escv(n.title||'إشعار')}</h3><p>${escv(n.message||n.body||'')}</p><small>${escv(fmtDate(n.created_at))}</small></div>${read?'':`<button onclick="alinV164CourierRead('${escv(n.id)}')">مقروء</button>`}</article>`}).join('')||'<div class="empty">لا توجد إشعارات.</div>'}</div>`}
  function profileHtml(c,rows){return `${summary(c,rows)}<section class="v164-profile"><div class="v164-profile-head"><div class="v161-avatar">${escv((c.name||'م').slice(0,1))}</div><div><h2>${escv(c.name||'مندوب')}</h2><p>${escv(c.phone||currentAccount()?.phone||'بدون هاتف')}</p></div><span class="v161-status ${statusOf(c)}">${statusLabel(statusOf(c))}</span></div><div class="v164-profile-fields"><label>حالة العمل<select id="v161MyAvailability"><option value="available" ${statusOf(c)==='available'?'selected':''}>متاح</option><option value="busy" ${statusOf(c)==='busy'?'selected':''}>مشغول</option><option value="offline" ${statusOf(c)==='offline'?'selected':''}>خارج الخدمة</option></select></label><div><small>مناطق العمل</small><div class="v161-area-chips">${areasOf(c).map(a=>`<span>${escv(a)}</span>`).join('')||'<span>غير محددة</span>'}</div></div></div><button onclick="alinV161SaveMyStatus()">حفظ الحالة</button></section>`}
  function unavailableHtml(){return `<section class="v174-panel"><h2>تعذر ربط صفحة المندوب بالحساب</h2><p>اضغط إعادة المحاولة. إذا استمرت الحالة افتح حساب المندوب من لوحة المدير واحفظه مرة واحدة.</p><button onclick="alinRefreshCourierPage()">إعادة تحميل بيانات المندوب</button></section>`}
  async function renderCourierDashboard(tab='home',options={}){const serial=++renderSerial,box=$('#courierV161Content');if(!box)return false;ensureTabs();let c=resolveCourier();setHeader(c,tab);if(!c){box.innerHTML=unavailableHtml();return false}let rows=myOrders(c);const paint=()=>{if(serial!==renderSerial)return;setHeader(c,tab);if(tab==='home')box.innerHTML=homeHtml(c,rows);else if(tab==='current')box.innerHTML=ordersHtml(c,rows,false);else if(tab==='completed')box.innerHTML=ordersHtml(c,rows,true);else if(tab==='finance')box.innerHTML=financeHtml(c,rows);else if(tab==='notifications')box.innerHTML=notificationsHtml(c,rows);else box.innerHTML=profileHtml(c,rows)};paint();if(options.refresh!==false){c=await refreshCourierData(Boolean(options.force));if(serial!==renderSerial)return true;if(!c){box.innerHTML=unavailableHtml();return false}rows=myOrders(c);paint()}return true}
  async function updateOrder(id,values,message){try{await update('orders',values,{id});const row=allOrders().find(x=>String(x.id)===String(id));if(row)Object.assign(row,values);await refreshCourierData(true);await renderCourierDashboard('current',{refresh:false});notify(message);return true}catch(error){console.error('[ALIN courier order]',error);notify(friendlyOrderError(error));return false}}
  async function transitionCourierOrder(id,status,reason=''){try{if(!window.AlinFinance?.transitionOrder)throw new Error('خدمة الطلبات الذرية غير جاهزة');await window.AlinFinance.transitionOrder(id,status,reason);await refreshCourierData(true);await renderCourierDashboard('current',{refresh:false});notify(status==='completed'?'تم تسجيل التسليم والحسابات':'تم تحديث حالة الطلب');return true}catch(error){console.error('[ALIN courier atomic transition]',error);notify(friendlyOrderError(error));return false}}
  window.alinV164CourierStep=async function(id,status){return transitionCourierOrder(id,status)};
  window.alinV164CourierComplete=async function(id){if(!confirm('تأكيد تسليم الطلب واستلام المبلغ من الطالب؟'))return false;return transitionCourierOrder(id,'completed')};
  window.alinV164ReportIssue=async function(id){const note=(prompt('اكتب الملاحظة أو المشكلة لإرسالها إلى الإدارة')||'').trim();if(!note)return false;return updateOrder(id,{delivery_note:note,updated_at:now()},'تم إرسال الملاحظة للإدارة')};
  window.alinV174Reject=async function(id){const reason=(prompt('اكتب سبب رفض الطلب')||'').trim();if(!reason)return false;if(!confirm('تأكيد رفض الطلب؟'))return false;return transitionCourierOrder(id,'rejected',reason)};
  window.alinV174QuickStatus=async function(value){const c=resolveCourier();if(!c)return false;try{await update('couriers',{availability:value,updated_at:now()},{id:c.id});c.availability=value;await refreshCourierData(true);await renderCourierDashboard('home',{refresh:false});notify('تم تحديث حالة المندوب');return true}catch(error){alert(error.message||'تعذر تحديث الحالة');return false}};
  window.alinV161SaveMyStatus=async function(){return window.alinV174QuickStatus($('#v161MyAvailability')?.value||'available')};
  window.alinV161CourierStatus=window.alinV164CourierStep;
  window.alinV164CourierRead=async function(id){try{const c=resolveCourier();if(window.AlinNotifications?.markRead)await window.AlinNotifications.markRead(id,{role:'courier',id:String(c?.id||'')});else await update('notifications',{is_read:true,read_at:now()},{id});await renderCourierDashboard('notifications',{refresh:false})}catch(error){alert(error.message||'تعذر تحديث الإشعار')}};
  window.alinV164CourierReadAll=async function(){const c=resolveCourier();if(window.AlinNotifications?.markAll)await window.AlinNotifications.markAll({role:'courier',id:String(c?.id||'')});await renderCourierDashboard('notifications',{refresh:false})};
  window.alinRefreshCourierPage=async function(){resetRefresh();const box=$('#courierV161Content');if(box)box.innerHTML='<div class="empty">جاري تحميل بيانات المندوب والطلبات...</div>';await refreshCourierData(true);return renderCourierDashboard('home',{refresh:false})};


  window.renderCourierDashboard=renderCourierDashboard;
  window.AlinCourierDashboard=Object.freeze({version:'2.4.2',resolveCourier,myOrders,workflowValues,refreshCourierData,render:renderCourierDashboard});

  window.addEventListener('alin:page-open',event=>{if(event.detail?.page==='courier')renderCourierDashboard('home',{force:true})});
  window.addEventListener('alin:data-refreshed',()=>{if($('#courierPage:not(.hidden)'))renderCourierDashboard($('.courier-v161-tabs .active')?.dataset.courierTab||'home',{refresh:false})});
  window.addEventListener('alin:auth-login',event=>{if(event.detail?.account?.role==='courier')setTimeout(()=>renderCourierDashboard('home',{force:true}),0)});
  window.addEventListener('alin:auth-restored',event=>{if(event.detail?.account?.role==='courier')setTimeout(()=>renderCourierDashboard('home',{force:true}),0)});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensureTabs,{once:true});else ensureTabs();
})();

;

;
/* modules/courier/finance.js */
// === courier/finance.js ===
/* ===== courier/js/settlements.js ===== */
/* V111: actual courier code moved from core/js/platform-legacy.js */
window.AlinCourierModules=window.AlinCourierModules||{};
function renderCourierSettlementsAdmin(){
  const deliveryOrders=(db.orders||[]).filter(o=>o.fulfillment_type==='home_delivery');
  adminContent.innerHTML='<h2>تسويات المندوبين</h2><p class="muted">المندوب يستلم مبلغ الطلب من الطالب عند التسليم، ثم يسلم المبلغ للإدارة بسند قبض.</p>'+deliveryOrders.map(o=>`<div class="row"><div><b>${esc(o.order_number||o.id)} — ${esc(o.title)}</b><small>الطالب: ${esc(o.student_name)} • المنطقة: ${esc(o.delivery_area||'')} • أقرب نقطة: ${esc(o.delivery_landmark||'')} • المبلغ ${money(o.total)} د.ع • الحالة ${esc(o.status||'')}</small></div><div class="row-actions"><select id="assign_${o.id}"><option value="">مندوب</option>${couriers.map(c=>`<option value="${c.id}" ${o.courier_id===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select><button onclick="assignCourier('${o.id}')">حفظ</button><button onclick="courierOrderStatus('${o.id}','out_for_delivery')">قيد التوصيل</button><button onclick="courierOrderStatus('${o.id}','completed')">تم التسليم</button></div></div>`).join('')+(deliveryOrders.length?'':'لا توجد طلبات توصيل')+'<h3>سندات تسوية المندوبين</h3>'+(courierSettlements.map(s=>`<div class="row"><b>${esc(s.receipt_number)}</b><span>${money(s.amount)} د.ع</span></div>`).join('')||emptyState('لا توجد تسويات'));
}

async function recordCourierSettlementForOrder(orderId){
  const o=(db.orders||[]).find(x=>x.id===orderId);if(!o)return false;
  const courierId=o.delegate_id||o.courier_id;if(!courierId)return alert('الطلب غير مرتبط بمندوب');
  if(!window.AlinFinance?.settleDelegate)throw new Error('خدمة تسوية المندوب غير جاهزة');
  const result=await window.AlinFinance.settleDelegate(courierId);
  if(result&&typeof audit==='function')await audit('courier','تسوية مندوب للطلب '+(o.order_number||o.id));
  if(typeof renderCourierSettlementsAdmin==='function')renderCourierSettlementsAdmin();
  return result;
}
window.AlinCourierModules['renderCourierSettlementsAdmin']=typeof renderCourierSettlementsAdmin==='function'?renderCourierSettlementsAdmin:window['renderCourierSettlementsAdmin'];window['renderCourierSettlementsAdmin']=window.AlinCourierModules['renderCourierSettlementsAdmin'];
window.AlinCourierModules['recordCourierSettlementForOrder']=typeof recordCourierSettlementForOrder==='function'?recordCourierSettlementForOrder:window['recordCourierSettlementForOrder'];window['recordCourierSettlementForOrder']=window.AlinCourierModules['recordCourierSettlementForOrder'];


;

;
/* modules/core/security.js */
// === core/security.js ===
/* ===== core/js/auth-security-v214.js ===== */
/* ALIN V214 — idle-session protection without replacing navigation or auth functions. */
(function(){
  'use strict';
  const SESSION='alin_secure_session_v214';
  const IDLE_BY_ROLE={admin:15,accountant:15,teacher:30,library:30,courier:30,student:60,store:60};
  const WARN_MS=2*60*1000;
  let idleTimer=null,warningTimer=null,lastActivity=Date.now(),warningBox=null;
  const currentNow=()=>{try{return window.current||null}catch(_){return null}};
  function setSession(user){
    if(!user?.role)return;
    const data={role:user.role,id:user.id||'',username:user.username||'',startedAt:Date.now(),lastActivity:Date.now()};
    try{sessionStorage.setItem(SESSION,JSON.stringify(data))}catch(_){}
    lastActivity=Date.now();scheduleIdle();
  }
  function clearTimers(){if(idleTimer)clearTimeout(idleTimer);if(warningTimer)clearTimeout(warningTimer);idleTimer=warningTimer=null}
  function hideWarning(){if(warningBox)warningBox.hidden=true}
  function clearSession(){try{sessionStorage.removeItem(SESSION)}catch(_){}clearTimers();hideWarning()}
  function idleLimit(){return (IDLE_BY_ROLE[String(currentNow()?.role||'')]||30)*60*1000}
  function touch(){
    if(!currentNow())return;
    lastActivity=Date.now();
    try{const data=JSON.parse(sessionStorage.getItem(SESSION)||'{}');data.lastActivity=lastActivity;sessionStorage.setItem(SESSION,JSON.stringify(data))}catch(_){}
    hideWarning();scheduleIdle();
  }
  function scheduleIdle(){
    clearTimers();if(!currentNow())return;
    const remain=Math.max(0,idleLimit()-(Date.now()-lastActivity));
    if(remain<=0)return expireSession();
    warningTimer=setTimeout(showWarning,Math.max(0,remain-WARN_MS));
    idleTimer=setTimeout(expireSession,remain);
  }
  function showWarning(){
    if(!currentNow())return;
    if(!warningBox){warningBox=document.createElement('div');warningBox.className='alin-session-warning';warningBox.innerHTML='<strong>ستنتهي الجلسة قريباً</strong><span>اضغط استمرار حتى تبقى داخل الحساب.</span><button type="button">استمرار</button>';warningBox.querySelector('button').addEventListener('click',touch);document.body.appendChild(warningBox)}
    warningBox.hidden=false;
  }
  function expireSession(){
    if(!currentNow())return;clearSession();
    try{window.toast?.('انتهت الجلسة لعدم النشاط')}catch(_){}
    Promise.resolve(window.logout?.()).catch(error=>console.error('[ALIN idle logout]',error));
  }
  function install(){
    window.addEventListener('alin:auth-login',event=>setSession(event.detail?.account||currentNow()));
    window.addEventListener('alin:auth-restored',event=>setSession(event.detail?.account||currentNow()));
    window.addEventListener('alin:page-open',()=>{if(currentNow())setSession(currentNow())});
    window.addEventListener('alin:logout',clearSession);
    ['click','keydown','touchstart','pointerdown'].forEach(ev=>document.addEventListener(ev,touch,{passive:true}));
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)touch()});
    if(currentNow())setSession(currentNow());
    window.ALINSecureSession=Object.freeze({version:'214.1',touch,expire:expireSession,clear:clearSession});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();

/* ===== core/js/file-security-v168.js ===== */
/* ALIN V168 — file upload and URL safety without changing current auth. */
(function(){
  'use strict';
  const RULES={
    image:{ext:['png','jpg','jpeg','webp'],mime:['image/png','image/jpeg','image/webp'],max:5*1024*1024},
    pdf:{ext:['pdf'],mime:['application/pdf'],max:25*1024*1024},
    word:{ext:['docx'],mime:['application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/octet-stream'],max:20*1024*1024}
  };
  const BLOCKED=['exe','msi','bat','cmd','com','scr','ps1','js','mjs','html','htm','svg','php','jar','apk','sh','dll'];
  const safeName=v=>String(v||'file').normalize('NFKC').replace(/[\\/:*?"<>|\u0000-\u001f]/g,'_').replace(/\s+/g,' ').trim().slice(0,120)||'file';
  const ext=n=>{const s=String(n||'').toLowerCase().split('.');return s.length>1?s.pop():''};
  function kindFor(input){
    const a=String(input.getAttribute('accept')||'').toLowerCase(),id=(input.id+' '+input.name+' '+input.className).toLowerCase();
    if(a.includes('pdf')||id.includes('pdf'))return 'pdf';
    if(a.includes('word')||a.includes('docx')||id.includes('word')||id.includes('source_file'))return 'word';
    if(a.includes('image')||id.includes('image')||id.includes('cover')||id.includes('logo')||id.includes('icon'))return 'image';
    return '';
  }
  function signatureOK(file,kind){
    return file.slice(0,8).arrayBuffer().then(b=>{
      const x=[...new Uint8Array(b)];
      if(kind==='pdf')return x[0]===0x25&&x[1]===0x50&&x[2]===0x44&&x[3]===0x46;
      if(kind==='word')return x[0]===0x50&&x[1]===0x4b&&x[2]===0x03&&x[3]===0x04;
      if(kind==='image')return (x[0]===0x89&&x[1]===0x50&&x[2]===0x4e&&x[3]===0x47)||(x[0]===0xff&&x[1]===0xd8&&x[2]===0xff)||(x[0]===0x52&&x[1]===0x49&&x[2]===0x46&&x[3]===0x46);
      return true;
    }).catch(()=>false);
  }
  async function validate(file,kind){
    const e=ext(file.name);
    if(BLOCKED.includes(e))return {ok:false,msg:'هذا النوع من الملفات محظور لأسباب أمنية.'};
    const rule=RULES[kind];
    if(!rule)return {ok:true,name:safeName(file.name)};
    if(!rule.ext.includes(e))return {ok:false,msg:'صيغة الملف غير مسموحة في هذا الحقل.'};
    if(file.size<=0||file.size>rule.max)return {ok:false,msg:`حجم الملف غير مسموح. الحد الأعلى ${Math.round(rule.max/1024/1024)} MB.`};
    if(file.type&&!rule.mime.includes(file.type))return {ok:false,msg:'نوع الملف لا يطابق الصيغة المطلوبة.'};
    if(!(await signatureOK(file,kind)))return {ok:false,msg:'محتوى الملف لا يطابق امتداده وقد يكون غير آمن.'};
    return {ok:true,name:safeName(file.name)};
  }
  function notify(msg){try{if(typeof window.toast==='function')return window.toast(msg)}catch(_){};alert(msg)}
  async function onFile(e){
    const input=e.target;if(!(input instanceof HTMLInputElement)||input.type!=='file'||!input.files?.length)return;
    const kind=kindFor(input),files=[...input.files];
    for(const file of files){const r=await validate(file,kind);if(!r.ok){input.value='';notify(r.msg);input.setCustomValidity(r.msg);return}}
    input.setCustomValidity('');input.dataset.alinValidated='true';
  }
  function safeURL(value){
    try{
      const u=new URL(value,location.href);
      if(!['https:','http:','blob:','data:'].includes(u.protocol))return false;
      if(u.protocol==='data:'&&!String(value).startsWith('data:image/'))return false;
      return true;
    }catch(_){return false}
  }
  function harden(root){
    (root||document).querySelectorAll('a[href]').forEach(a=>{if(!safeURL(a.href)){a.removeAttribute('href');a.setAttribute('aria-disabled','true')}});
    (root||document).querySelectorAll('iframe[src]').forEach(f=>{if(!safeURL(f.src)){f.removeAttribute('src')}f.setAttribute('referrerpolicy','no-referrer');if(!f.hasAttribute('sandbox'))f.setAttribute('sandbox','allow-scripts allow-same-origin allow-forms allow-modals')});
  }
  function install(){
    document.addEventListener('change',onFile,true);harden(document);
    window.ALINFileSecurity=Object.freeze({version:'168.1',validate,safeName,safeURL,harden});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();

/* ===== core/js/sensitive-operations-v169.js ===== */
(function(){
  'use strict';

  const state = {
    lastActionAt: new Map(),
    pending: new Set()
  };

  const now = () => Date.now();
  const safeText = value => String(value == null ? '' : value).replace(/[<>]/g, '');
  const getCurrentRole = () => {
    try {
      if (window.current && current.role) return String(current.role);
      if (window.currentUser && currentUser.role) return String(currentUser.role);
      const raw = sessionStorage.getItem('alin_current_user') || localStorage.getItem('alin_current_user');
      if (raw) return String(JSON.parse(raw)?.role || '');
    } catch (_) {}
    return '';
  };

  const toastMessage = message => {
    if (typeof window.toast === 'function') return window.toast(message);
    const node = document.createElement('div');
    node.className = 'toast';
    node.textContent = safeText(message);
    document.body.appendChild(node);
    setTimeout(() => node.remove(), 2800);
  };

  function rateLimit(key, milliseconds){
    const last = state.lastActionAt.get(key) || 0;
    if (now() - last < milliseconds) return false;
    state.lastActionAt.set(key, now());
    return true;
  }

  function requireRole(allowed){
    const role = getCurrentRole();
    if (!allowed.includes(role)) {
      toastMessage('هذه العملية غير مسموحة لهذا الحساب.');
      return false;
    }
    return true;
  }

  function confirmSensitiveAction(options){
    const title = safeText(options?.title || 'تأكيد العملية');
    const message = safeText(options?.message || 'هل أنت متأكد من تنفيذ هذه العملية؟');
    const phrase = safeText(options?.phrase || 'تأكيد');
    const input = window.prompt(`${title}\n\n${message}\n\nاكتب كلمة: ${phrase}`);
    return input === phrase;
  }

  async function guardedOperation(options, operation){
    const key = safeText(options?.key || 'operation');
    const allowedRoles = Array.isArray(options?.roles) ? options.roles : ['admin'];
    const cooldown = Number(options?.cooldown || 1500);

    if (!requireRole(allowedRoles)) return { ok:false, reason:'role' };
    if (!rateLimit(key, cooldown)) {
      toastMessage('انتظر قليلاً قبل تكرار العملية.');
      return { ok:false, reason:'rate_limit' };
    }
    if (state.pending.has(key)) {
      toastMessage('العملية قيد التنفيذ حالياً.');
      return { ok:false, reason:'pending' };
    }
    if (options?.confirm && !confirmSensitiveAction(options.confirm)) {
      return { ok:false, reason:'cancelled' };
    }

    state.pending.add(key);
    try {
      const result = await operation();
      return { ok:true, result };
    } catch (error) {
      console.error('[V169 guarded operation]', error);
      toastMessage('تعذّر إكمال العملية بأمان.');
      return { ok:false, reason:'error', error };
    } finally {
      state.pending.delete(key);
    }
  }

  function hardenDangerousButtons(){
    document.addEventListener('click', function(event){
      const button = event.target.closest('button,[role="button"]');
      if (!button) return;
      const text = (button.textContent || '').trim();
      const dangerous = /حذف نهائي|تصفية الحساب|تثبيت التسوية|إلغاء الطلب|تغيير النسب|تحويل للمندوب|إيقاف الحساب/.test(text);
      if (!dangerous) return;
      button.setAttribute('data-sensitive-operation', 'true');
      button.setAttribute('autocomplete', 'off');
    }, true);
  }

  function protectForms(){
    document.addEventListener('submit', function(event){
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      if (form.dataset.submitting === '1') {
        event.preventDefault();
        return;
      }
      form.dataset.submitting = '1';
      setTimeout(() => { form.dataset.submitting = '0'; }, 1800);
    }, true);
  }

  window.AlinSecurityV169 = Object.freeze({
    guardedOperation,
    requireRole,
    rateLimit,
    confirmSensitiveAction,
    getCurrentRole
  });

  hardenDangerousButtons();
  protectForms();
})();

/* Legacy auth stabilizer removed: navigation and Supabase Auth now have single owners. */



;

;
/* modules/core/design.js */
// === core/design.js ===
/* ===== core/design/design-system.js ===== */
(function(){
  document.documentElement.classList.add('alin-design-v175');
  function ready(){document.body?.classList.add('alin-ui-ready')}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
  document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.disabled)return;b.classList.add('alin-click');setTimeout(()=>b.classList.remove('alin-click'),180)});
})();


;

;
/* modules/admin/branding.js */
// === admin/branding.js ===
/* ALIN v2.4.2 — visual identity editor with calm presets and appearance-safe theming. */
(function(){
  'use strict';

  const STORAGE_KEY='alin_visual_identity_v235';
  const LEGACY_STORAGE_KEY='alin_visual_identity_v227';
  const defaults={
    theme:'alin-original',
    primary:'#0b3158',secondary:'#c9a24a',background:'#f6f8fb',card:'#ffffff',
    success:'#2f7d62',warning:'#b98532',danger:'#b44b4b',
    font:'Cairo',radius:18,shadow:'soft',logo:'',logoDark:'',icon:''
  };

  const templates={
    'alin-original':{
      label:'آلين الأصلي',description:'أزرق هادئ مع لمسة ذهبية',
      theme:'alin-original',primary:'#0b3158',secondary:'#c9a24a',background:'#f6f8fb',card:'#ffffff',success:'#2f7d62',warning:'#b98532',danger:'#b44b4b',font:'Cairo',radius:18,shadow:'soft'
    },
    'sky-calm':{
      label:'سماء هادئة',description:'أزرق ضبابي ومريح للعين',
      theme:'sky-calm',primary:'#315d7a',secondary:'#9eb9c9',background:'#f3f7f9',card:'#ffffff',success:'#4e806d',warning:'#b38a4e',danger:'#a95b5b',font:'Tajawal',radius:20,shadow:'soft'
    },
    'sage-calm':{
      label:'مريمي هادئ',description:'أخضر طبيعي بطابع دراسي',
      theme:'sage-calm',primary:'#456b5f',secondary:'#b9a878',background:'#f4f7f3',card:'#ffffff',success:'#3f7b5d',warning:'#a98045',danger:'#a95555',font:'Cairo',radius:20,shadow:'soft'
    },
    'sand-calm':{
      label:'رملي دافئ',description:'ألوان دافئة وخفيفة',
      theme:'sand-calm',primary:'#6f5948',secondary:'#c2a278',background:'#faf7f1',card:'#fffdfa',success:'#5f8067',warning:'#ad7b3c',danger:'#aa5952',font:'Tajawal',radius:18,shadow:'soft'
    },
    'lavender-calm':{
      label:'لافندر هادئ',description:'بنفسجي ناعم بدون إزعاج',
      theme:'lavender-calm',primary:'#5d5d7d',secondary:'#b8afca',background:'#f7f6fa',card:'#ffffff',success:'#5e806e',warning:'#a98652',danger:'#a95b67',font:'Cairo',radius:22,shadow:'soft'
    },
    'rose-calm':{
      label:'وردي ترابي',description:'لون راقٍ ومناسب للهدايا',
      theme:'rose-calm',primary:'#765861',secondary:'#d0aeb5',background:'#faf6f7',card:'#ffffff',success:'#5b7d6b',warning:'#aa8050',danger:'#a64f5a',font:'Tajawal',radius:22,shadow:'soft'
    },
    'graphite-calm':{
      label:'رمادي احترافي',description:'محايد وهادئ للوحات الإدارة',
      theme:'graphite-calm',primary:'#3f4b59',secondary:'#aeb7c0',background:'#f4f6f8',card:'#ffffff',success:'#4d7b69',warning:'#9e7d4e',danger:'#a65353',font:'Cairo',radius:16,shadow:'soft'
    }
  };

  const escv=value=>typeof window.esc==='function'?window.esc(value):String(value??'');
  const t=value=>window.AlinI18n?.t?.(value)||value;
  const settings=()=>window.db?.settings||{};
  const clamp=(value,min,max)=>Math.min(max,Math.max(min,Number(value)||min));
  const normalizeTheme=value=>value==='dark'?'graphite-calm':(templates[value]?value:'custom');
  const readJson=key=>{try{return JSON.parse(localStorage.getItem(key)||'{}')}catch(_){return{}}};
  const stored=()=>({...readJson(LEGACY_STORAGE_KEY),...readJson(STORAGE_KEY)});
  const urlOf=value=>{if(!value)return '';if(/^https?:|^blob:|^data:/i.test(String(value)))return String(value);try{return window.mediaUrl?.(value)||String(value)}catch(_){return String(value)}};
  const validHex=(value,fallback)=>/^#[0-9a-f]{6}$/i.test(String(value||''))?String(value):fallback;
  const hexToRgb=hex=>{const value=validHex(hex,'#000000').slice(1);return [0,2,4].map(index=>parseInt(value.slice(index,index+2),16))};
  const rgbToHex=rgb=>'#'+rgb.map(value=>Math.round(clamp(value,0,255)).toString(16).padStart(2,'0')).join('');
  const mix=(a,b,weight=.5)=>{const first=hexToRgb(a),second=hexToRgb(b);return rgbToHex(first.map((value,index)=>value+(second[index]-value)*weight))};
  const shadowValue=name=>name==='none'?'none':name==='medium'?'0 14px 34px rgba(7,26,55,.12)':'0 8px 24px rgba(7,26,55,.075)';

  function normalizeIdentity(identity={}){
    return {
      ...defaults,...identity,
      theme:normalizeTheme(identity.theme||defaults.theme),
      primary:validHex(identity.primary,defaults.primary),secondary:validHex(identity.secondary,defaults.secondary),
      background:validHex(identity.background,defaults.background),card:validHex(identity.card,defaults.card),
      success:validHex(identity.success,defaults.success),warning:validHex(identity.warning,defaults.warning),danger:validHex(identity.danger,defaults.danger),
      font:['Cairo','Tajawal','Arial'].includes(identity.font)?identity.font:defaults.font,
      radius:clamp(identity.radius,8,28),shadow:['none','soft','medium'].includes(identity.shadow)?identity.shadow:defaults.shadow,
      logo:String(identity.logo||''),logoDark:String(identity.logoDark||''),icon:String(identity.icon||'')
    };
  }

  function current(){
    const s=settings(),local=stored();
    return normalizeIdentity({
      ...local,
      theme:s.visual_theme||local.theme||defaults.theme,
      primary:s.visual_primary||local.primary||defaults.primary,
      secondary:s.visual_secondary||local.secondary||defaults.secondary,
      background:s.visual_background||local.background||defaults.background,
      card:s.visual_card||local.card||defaults.card,
      success:s.visual_success||local.success||defaults.success,
      warning:s.visual_warning||local.warning||defaults.warning,
      danger:s.visual_danger||local.danger||defaults.danger,
      font:s.visual_font||local.font||defaults.font,
      radius:s.visual_radius||local.radius||defaults.radius,
      shadow:s.visual_shadow||local.shadow||defaults.shadow,
      logo:s.platform_logo_path||s.platform_logo_url||local.logo||'',
      logoDark:s.platform_logo_dark_path||local.logoDark||'',
      icon:s.platform_icon_path||s.platform_icon_url||local.icon||''
    });
  }

  function setLogo(node,url,fallback='آ'){
    if(!node)return;
    if(url)node.innerHTML=`<img class="logo-img" src="${escv(url)}" alt="${escv(t('شعار منصة آلين'))}">`;
    else node.textContent=fallback;
  }

  function applyPalette(identity){
    const root=document.documentElement,style=root.style;
    const dark=root.dataset.alinTheme==='dark';
    const darkBg=mix(identity.primary,'#000000',.72);
    const darkSurface=mix(identity.primary,'#000000',.58);
    const darkSoft=mix(identity.primary,'#000000',.45);
    const border=dark?mix(identity.primary,'#ffffff',.22):mix(identity.primary,'#ffffff',.82);
    style.setProperty('--alin-primary',identity.primary);
    style.setProperty('--alin-primary-2',mix(identity.primary,'#ffffff',.12));
    style.setProperty('--alin-primary-3',mix(identity.primary,'#000000',.12));
    style.setProperty('--alin-gold',identity.secondary);
    style.setProperty('--alin-gold-2',mix(identity.secondary,'#ffffff',.14));
    style.setProperty('--alin-bg',dark?darkBg:identity.background);
    style.setProperty('--alin-surface',dark?darkSurface:identity.card);
    style.setProperty('--alin-surface-2',dark?darkSoft:mix(identity.card,identity.background,.45));
    style.setProperty('--alin-success',identity.success);
    style.setProperty('--alin-warning',identity.warning);
    style.setProperty('--alin-danger',identity.danger);
    style.setProperty('--alin-radius-lg',`${identity.radius}px`);
    style.setProperty('--alin-radius-md',`${Math.max(10,identity.radius-4)}px`);
    style.setProperty('--alin-shadow-md',shadowValue(identity.shadow));
    style.setProperty('--ao-ink',dark?'#f3f6f8':identity.primary);
    style.setProperty('--ao-gold',identity.secondary);
    style.setProperty('--ao-bg',dark?darkBg:identity.background);
    style.setProperty('--ao-surface',dark?darkSurface:identity.card);
    style.setProperty('--ao-soft',dark?darkSoft:mix(identity.background,identity.card,.5));
    style.setProperty('--ao-border',border);
    style.setProperty('--ao-muted',dark?'#b8c3cc':mix(identity.primary,'#ffffff',.42));
    style.setProperty('--ao-shadow',dark?'0 28px 80px rgba(0,0,0,.48)':shadowValue(identity.shadow));
  }

  function applyTheme(identity=current()){
    identity=normalizeIdentity(identity);
    applyPalette(identity);
    if(document.body)document.body.style.fontFamily=`"${identity.font}",Tahoma,"Segoe UI",sans-serif`;
    // Brand preset and light/dark appearance are separate. Never overwrite data-alin-theme here.
    document.documentElement.dataset.alinBrandTheme=identity.theme||'custom';
    const name=settings().platform_name||'منصة آلين';
    const useDarkLogo=document.documentElement.dataset.alinTheme==='dark'&&identity.logoDark;
    const logo=urlOf(useDarkLogo||identity.logo),icon=urlOf(identity.icon);
    document.title=name;
    document.querySelectorAll('.brand b').forEach(node=>node.textContent=name.replace('منصة ',''));
    document.querySelectorAll('.login-card .logo').forEach(node=>setLogo(node,logo,'آ'));
    document.querySelectorAll('.topbar .logo.small').forEach(node=>setLogo(node,icon||logo,'آ'));
    document.querySelectorAll('.alin98-logo').forEach(node=>setLogo(node,logo||icon,'آ'));
    if(icon)document.querySelectorAll('link[rel="icon"],link[rel="apple-touch-icon"]').forEach(link=>link.href=icon);
    const theme=document.querySelector('meta[name="theme-color"]');if(theme)theme.content=identity.primary;
    window.dispatchEvent(new CustomEvent('alin:brand-applied',{detail:{identity}}));
    return identity;
  }
  function applyBrand(){return applyTheme(current())}

  async function uploadBrandFile(file,kind){
    if(!file)return '';
    const allowed=kind==='icon'?['image/png','image/jpeg','image/webp']:['image/png','image/jpeg','image/webp','image/svg+xml'];
    if(!allowed.includes(file.type))throw new Error('صيغة الصورة غير مدعومة');
    if(file.size>3*1024*1024)throw new Error('حجم الصورة يجب أن يكون أقل من 3MB');
    if(typeof window.uploadFile!=='function')throw new Error('خدمة رفع الصور غير متاحة');
    return window.uploadFile(`brand/${kind}`,file,{required:true,type:'image',maxBytes:3*1024*1024});
  }

  async function saveIdentity(identity){
    identity=normalizeIdentity(identity);
    if(typeof window.settingsSet!=='function')throw new Error('خدمة الإعدادات غير جاهزة');
    const map={
      visual_theme:identity.theme,visual_primary:identity.primary,visual_secondary:identity.secondary,
      visual_background:identity.background,visual_card:identity.card,visual_success:identity.success,
      visual_warning:identity.warning,visual_danger:identity.danger,visual_font:identity.font,
      visual_radius:identity.radius,visual_shadow:identity.shadow,platform_logo_path:identity.logo||'',
      platform_logo_dark_path:identity.logoDark||'',platform_icon_path:identity.icon||''
    };
    for(const [key,value] of Object.entries(map))await window.settingsSet(key,value);
    localStorage.setItem(STORAGE_KEY,JSON.stringify(identity));
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    applyTheme(identity);
    window.dispatchEvent(new CustomEvent('alin:settings-updated',{detail:{keys:Object.keys(map)}}));
    if(typeof window.audit==='function')await window.audit('brand','تحديث الهوية البصرية للمنصة');
    return identity;
  }

  function imageMarkup(value,label){return value?`<img src="${escv(urlOf(value))}" alt="${escv(label)}">`:'<span aria-hidden="true">آ</span>'}
  function previewFile(box,file){
    if(!box||!file)return '';
    if(box.dataset.previewUrl)URL.revokeObjectURL(box.dataset.previewUrl);
    const url=URL.createObjectURL(file);box.dataset.previewUrl=url;box.innerHTML=`<img src="${url}" alt="${escv(t('معاينة'))}">`;return url;
  }

  function render(root=document.getElementById('adminContent')){
    if(!root)return;
    const base=current();let draft={...base};let busy=false;
    root.className='panel admin-brand-v235';
    const templateMarkup=Object.entries(templates).map(([key,preset])=>`
      <button type="button" class="ab235-template ${draft.theme===key?'active':''}" data-theme="${key}" aria-pressed="${draft.theme===key}">
        <span class="ab235-template-preview" style="--p:${preset.primary};--s:${preset.secondary};--b:${preset.background};--c:${preset.card}">
          <i></i><i></i><i></i><i></i>
        </span>
        <span><b>${escv(preset.label)}</b><small>${escv(preset.description)}</small></span>
        <em>${draft.theme===key?'مختار':'اختيار'}</em>
      </button>`).join('');

    root.innerHTML=`
      <header class="ab235-head">
        <div><span class="ab235-eyebrow">إعدادات المظهر</span><h2>الهوية البصرية</h2><p>غيّر هوية المنصة بأمان. القالب لا يغيّر الوضع النهاري أو الليلي.</p></div>
        <span class="ab235-version">v2.4.2</span>
      </header>
      <div class="ab235-layout">
        <main class="ab235-main">
          <section class="ab235-card">
            <div class="ab235-section-head"><div><h3>قوالب جاهزة هادئة</h3><p>اختر قالبًا ثم شاهد المعاينة قبل الحفظ.</p></div><span>${Object.keys(templates).length} قوالب</span></div>
            <div class="ab235-templates">${templateMarkup}</div>
          </section>

          <section class="ab235-card">
            <div class="ab235-section-head"><div><h3>الشعار والأيقونة</h3><p>PNG أو WebP أو JPG، والشعار يقبل SVG أيضًا. الحد الأعلى 3MB.</p></div></div>
            <div class="ab235-uploads">
              <article class="ab235-upload"><div id="ab235LogoPreview" class="ab235-upload-preview">${imageMarkup(draft.logo,'الشعار الأساسي')}</div><div><b>الشعار الأساسي</b><small>يظهر في الوضع النهاري وتسجيل الدخول.</small><label class="ab235-file">اختيار صورة<input id="ab235Logo" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"></label><button type="button" class="ab235-clear" data-clear="logo">إزالة</button></div></article>
              <article class="ab235-upload"><div id="ab235DarkLogoPreview" class="ab235-upload-preview">${imageMarkup(draft.logoDark,'شعار الوضع الليلي')}</div><div><b>شعار الوضع الليلي</b><small>اختياري، ويُستخدم فقط عند تفعيل الوضع الليلي.</small><label class="ab235-file">اختيار صورة<input id="ab235DarkLogo" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"></label><button type="button" class="ab235-clear" data-clear="logoDark">إزالة</button></div></article>
              <article class="ab235-upload"><div id="ab235IconPreview" class="ab235-upload-preview icon">${imageMarkup(draft.icon,'أيقونة التطبيق')}</div><div><b>أيقونة التطبيق</b><small>يفضل ملف مربع بدقة 512×512.</small><label class="ab235-file">اختيار صورة<input id="ab235Icon" type="file" accept="image/png,image/jpeg,image/webp"></label><button type="button" class="ab235-clear" data-clear="icon">إزالة</button></div></article>
            </div>
          </section>

          <section class="ab235-card">
            <div class="ab235-section-head"><div><h3>تخصيص الألوان</h3><p>يمكن تعديل أي قالب يدويًا قبل الحفظ.</p></div></div>
            <div class="ab235-colors">${[
              ['primary','اللون الأساسي'],['secondary','اللون الثانوي'],['background','الخلفية'],['card','البطاقات'],['success','النجاح'],['warning','التنبيه'],['danger','الخطر']
            ].map(([key,label])=>`<label><span>${label}</span><span class="ab235-color"><input type="color" data-color="${key}" value="${escv(draft[key])}"><output data-output="${key}">${escv(draft[key].toUpperCase())}</output></span></label>`).join('')}</div>
            <div class="ab235-controls">
              <label><span>الخط</span><select id="ab235Font"><option value="Cairo" ${draft.font==='Cairo'?'selected':''}>Cairo</option><option value="Tajawal" ${draft.font==='Tajawal'?'selected':''}>Tajawal</option><option value="Arial" ${draft.font==='Arial'?'selected':''}>Arial</option></select></label>
              <label><span>استدارة البطاقات</span><div class="ab235-range"><input id="ab235Radius" type="range" min="8" max="28" value="${draft.radius}"><output>${draft.radius}px</output></div></label>
              <label><span>الظل</span><select id="ab235Shadow"><option value="none" ${draft.shadow==='none'?'selected':''}>بدون</option><option value="soft" ${draft.shadow==='soft'?'selected':''}>خفيف</option><option value="medium" ${draft.shadow==='medium'?'selected':''}>متوسط</option></select></label>
            </div>
          </section>

          <div class="ab235-actions">
            <button type="button" id="ab235Reset" class="secondary">استعادة هوية آلين</button>
            <button type="button" id="ab235Save" class="primary">حفظ وتطبيق الهوية</button>
          </div>
          <div id="ab235Status" class="ab235-status" role="status" aria-live="polite"></div>
        </main>

        <aside class="ab235-preview-wrap">
          <section class="ab235-card ab235-sticky"><div class="ab235-section-head"><div><h3>معاينة مباشرة</h3><p>هذه المعاينة لا تغيّر المنصة إلا بعد الحفظ.</p></div></div>
            <div id="ab235Preview" class="ab235-preview">
              <div class="ab235-preview-top"><div class="ab235-preview-brand"><span id="ab235PreviewLogo" class="ab235-preview-logo">${imageMarkup(draft.logo,'شعار منصة آلين')}</span><div><b>منصة آلين</b><small>للملازم والقرطاسية والهدايا</small></div></div><span class="ab235-preview-bell">◌</span></div>
              <div class="ab235-preview-body"><div class="ab235-preview-hero"><small>كل ما يحتاجه الطالب</small><h4>دراسة أسهل بتصميم هادئ</h4><p>ملازم وقرطاسية وهدايا في مكان واحد.</p><button type="button">تصفح المتجر</button></div><div class="ab235-preview-cards"><article><span>الملازم</span><b>24</b></article><article><span>الطلبات</span><b>12</b></article><article><span>المكتبات</span><b>6</b></article></div></div>
            </div>
            <div class="ab235-note">الوضع النهاري والليلي يبقيان مستقلين عن القالب المختار.</div>
          </section>
        </aside>
      </div>`;

    const preview=root.querySelector('#ab235Preview');
    const status=root.querySelector('#ab235Status');
    const saveButton=root.querySelector('#ab235Save');
    const logoInput=root.querySelector('#ab235Logo');
    const darkLogoInput=root.querySelector('#ab235DarkLogo');
    const iconInput=root.querySelector('#ab235Icon');

    const sync=()=>{
      if(!preview)return;
      preview.style.setProperty('--ab-primary',draft.primary);preview.style.setProperty('--ab-secondary',draft.secondary);
      preview.style.setProperty('--ab-bg',draft.background);preview.style.setProperty('--ab-card',draft.card);
      preview.style.setProperty('--ab-font',`"${draft.font}",Tahoma,sans-serif`);preview.style.setProperty('--ab-radius',`${draft.radius}px`);
      preview.style.setProperty('--ab-shadow',shadowValue(draft.shadow));
      root.querySelector('#ab235PreviewLogo').innerHTML=imageMarkup(draft.logo,'شعار منصة آلين');
      root.querySelectorAll('.ab235-template').forEach(button=>{
        const active=button.dataset.theme===draft.theme;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
        const label=button.querySelector('em');if(label)label.textContent=active?'مختار':'اختيار';
      });
      root.querySelectorAll('[data-color]').forEach(input=>{if(input.value.toLowerCase()!==draft[input.dataset.color].toLowerCase())input.value=draft[input.dataset.color]});
      root.querySelectorAll('[data-output]').forEach(output=>output.textContent=String(draft[output.dataset.output]).toUpperCase());
      root.querySelector('#ab235Font').value=draft.font;root.querySelector('#ab235Shadow').value=draft.shadow;
      const radius=root.querySelector('#ab235Radius');radius.value=draft.radius;radius.nextElementSibling.textContent=`${draft.radius}px`;
    };

    root.querySelectorAll('.ab235-template').forEach(button=>button.addEventListener('click',()=>{
      const preset=templates[button.dataset.theme];if(!preset)return;draft=normalizeIdentity({...draft,...preset});sync();
    }));
    root.querySelectorAll('[data-color]').forEach(input=>input.addEventListener('input',()=>{draft[input.dataset.color]=input.value;draft.theme='custom';sync()}));
    root.querySelector('#ab235Font').addEventListener('change',event=>{draft.font=event.target.value;draft.theme='custom';sync()});
    root.querySelector('#ab235Shadow').addEventListener('change',event=>{draft.shadow=event.target.value;draft.theme='custom';sync()});
    root.querySelector('#ab235Radius').addEventListener('input',event=>{draft.radius=Number(event.target.value);draft.theme='custom';sync()});

    logoInput.addEventListener('change',()=>{if(logoInput.files[0]){draft.logo=previewFile(root.querySelector('#ab235LogoPreview'),logoInput.files[0]);sync()}});
    darkLogoInput.addEventListener('change',()=>{if(darkLogoInput.files[0]){draft.logoDark=previewFile(root.querySelector('#ab235DarkLogoPreview'),darkLogoInput.files[0])}});
    iconInput.addEventListener('change',()=>{if(iconInput.files[0]){draft.icon=previewFile(root.querySelector('#ab235IconPreview'),iconInput.files[0])}});
    root.querySelectorAll('[data-clear]').forEach(button=>button.addEventListener('click',()=>{
      const key=button.dataset.clear;draft[key]='';const map={logo:['#ab235LogoPreview',logoInput],logoDark:['#ab235DarkLogoPreview',darkLogoInput],icon:['#ab235IconPreview',iconInput]};
      const [selector,input]=map[key];input.value='';root.querySelector(selector).innerHTML='<span aria-hidden="true">آ</span>';sync();
    }));

    root.querySelector('#ab235Reset').addEventListener('click',async()=>{
      if(busy||!confirm('استعادة هوية آلين الافتراضية؟'))return;busy=true;saveButton.disabled=true;status.className='ab235-status';status.textContent='جارٍ استعادة الهوية...';
      try{await saveIdentity({...defaults});status.className='ab235-status ok';status.textContent='تمت استعادة هوية آلين الافتراضية';window.toast?.('تمت استعادة الهوية');render(root)}
      catch(error){status.className='ab235-status err';status.textContent=error.message||'تعذر الاستعادة'}finally{busy=false;saveButton.disabled=false}
    });

    saveButton.addEventListener('click',async()=>{
      if(busy)return;busy=true;saveButton.disabled=true;status.className='ab235-status';status.textContent='جارٍ رفع الصور وحفظ الهوية...';
      try{
        if(logoInput.files[0])draft.logo=await uploadBrandFile(logoInput.files[0],'logo');
        if(darkLogoInput.files[0])draft.logoDark=await uploadBrandFile(darkLogoInput.files[0],'logo-dark');
        if(iconInput.files[0])draft.icon=await uploadBrandFile(iconInput.files[0],'icon');
        draft=await saveIdentity(draft);status.className='ab235-status ok';status.textContent='تم حفظ وتطبيق الهوية على جميع صفحات المنصة';window.toast?.('تم تطبيق الهوية البصرية');sync();
      }catch(error){status.className='ab235-status err';status.textContent=error.message||'تعذر حفظ الهوية'}finally{busy=false;saveButton.disabled=false}
    });
    sync();
  }

  Object.assign(window,{applyBrand,applyBrandV28:applyBrand,uploadBrandFile,saveBrandIdentity:saveIdentity,resetBrandIdentity:()=>saveIdentity({...defaults})});
  function install(){applyBrand();window.AlinAdminModules?.register?.('brandIdentity',render)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  window.addEventListener('alin:data-refreshed',applyBrand);
  window.addEventListener('alin:settings-updated',applyBrand);
  window.addEventListener('alin:theme-changed',applyBrand);
  window.AlinBrand=Object.freeze({current,apply:applyBrand,render,save:saveIdentity,upload:uploadBrandFile,templates:Object.freeze({...templates})});
})();

;

;
/* modules/admin/backup.js */
// === admin/backup.js ===
/* ALIN v2.4.2 — authoritative backup owner. No admin router wrapping. */
(function(){
  'use strict';
  const VERSION='3.0.1';
  const LOG_KEY='alin_backup_log_v227';
  const RESTORABLE=['categories','products','booklets','banners','coupons'];
  let pending=null;
  const escv=value=>typeof window.esc==='function'?window.esc(value):String(value??'');
  const clone=value=>JSON.parse(JSON.stringify(value??{}));
  const bytesLabel=value=>{const n=Number(value||0);if(n<1024)return `${n} B`;if(n<1048576)return `${(n/1024).toFixed(1)} KB`;return `${(n/1048576).toFixed(1)} MB`};
  const filename=()=>`Alin_Backup_${new Date().toISOString().replace(/[:T]/g,'-').slice(0,19)}.json`;
  const rows=value=>Array.isArray(value)?value:[];
  function logs(){try{return JSON.parse(localStorage.getItem(LOG_KEY)||'[]')}catch(_){return[]}}
  function saveLogs(value){localStorage.setItem(LOG_KEY,JSON.stringify(rows(value).slice(0,30)))}
  function addLog(name,size,type='manual',status='created'){
    const value=logs();value.unshift({id:`B${Date.now()}`,name,size,type,status,created_at:new Date().toISOString()});saveLogs(value);
  }
  function snapshot(){
    const source=clone(window.db||{});
    const data={
      settings:source.settings||{},categories:rows(source.categories),products:rows(source.products),
      booklets:rows(source.booklets).map(({pdf_url,pdf_path,file_url,file_path,...row})=>row),
      banners:rows(source.banners),coupons:rows(source.coupons)
    };
    return {
      app:'ALIN',format:'alin-cloud-backup',backup_version:VERSION,created_at:new Date().toISOString(),
      schema:'catalog-settings-v2-no-personal-data',
      counts:{booklets:data.booklets.length,products:data.products.length,categories:data.categories.length,banners:data.banners.length,coupons:data.coupons.length},
      data
    };
  }
  function downloadObject(object,name){
    const blob=new Blob([JSON.stringify(object,null,2)],{type:'application/json;charset=utf-8'}),link=document.createElement('a');
    link.href=URL.createObjectURL(blob);link.download=name;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(link.href),1000);return blob.size;
  }
  function validate(object){
    if(!object||object.app!=='ALIN'||object.format!=='alin-cloud-backup'||!object.data||typeof object.data!=='object')throw new Error('الملف ليس نسخة احتياطية صالحة لمنصة آلين');
    if(!object.backup_version)throw new Error('نسخة الاحتياط غير معروفة الإصدار');
    return object;
  }
  function cleanRow(row){
    const result={};for(const [key,value] of Object.entries(row||{})){if(key.startsWith('_')||value===undefined)continue;result[key]=value}return result;
  }
  async function cloudUpsert(table,value){
    const list=rows(value).map(cleanRow);if(!list.length)return 0;
    const client=window.sb;if(!client)throw new Error('الاتصال بـ Supabase غير متاح');
    const {error}=await client.from(table).upsert(list);if(error)throw new Error(`تعذر استعادة ${table}: ${error.message||error}`);return list.length;
  }
  async function restoreSettings(settings){
    if(!settings||typeof settings!=='object')return 0;let count=0;
    for(const [key,value] of Object.entries(settings)){
      if(key==='storeType'||value===undefined||value===null||typeof value==='object')continue;
      await window.settingsSet(key,String(value));count++;
    }
    return count;
  }
  async function restoreSafe(object){
    validate(object);if(!window.current||window.current.role!=='admin')throw new Error('الاستعادة متاحة للمدير فقط');
    const result={settings:0};result.settings=await restoreSettings(object.data.settings||{});
    for(const table of RESTORABLE)result[table]=await cloudUpsert(table,object.data[table]);
    if(typeof window.audit==='function')await window.audit('backup_restore',`استعادة آمنة للكتالوج والإعدادات من نسخة ${object.created_at||''}`);
    if(typeof window.load==='function')await window.load();
    return result;
  }
  function render(){
    const root=document.getElementById('adminContent');if(!root)return;const data=window.db||{},history=logs();
    root.dataset.adminModule='backup';
    root.innerHTML=`<section class="admin-backup-rc1"><header class="admin-backup-head"><div><h2>النسخ الاحتياطي والاستعادة</h2><p>نسخة كتالوج آمنة لا تحتوي أرقام الطلاب أو الطلبات أو الحسابات أو القيود المالية أو روابط ملفات الملازم الخاصة.</p></div><span class="status">v${VERSION}</span></header>
      <section class="admin-backup-summary"><article class="admin-backup-stat"><small>الطلبات</small><b>${rows(data.orders).length}</b></article><article class="admin-backup-stat"><small>الحسابات</small><b>${rows(data.accounts?.all).length}</b></article><article class="admin-backup-stat"><small>الملازم</small><b>${rows(data.booklets).length}</b></article><article class="admin-backup-stat"><small>المنتجات</small><b>${rows(data.products).length}</b></article></section>
      <section class="admin-backup-grid"><article class="admin-backup-card"><h3>إنشاء نسخة</h3><p>ينزّل ملف JSON للكتالوج والإعدادات العامة فقط، بدون بيانات شخصية أو مالية.</p><div class="admin-backup-actions"><button type="button" onclick="alinCreateBackup()">إنشاء وتنزيل النسخة</button></div></article>
      <article class="admin-backup-card"><h3>استعادة آمنة</h3><p>لا يتم المساس بالطلبات والحسابات والمالية أثناء الاستعادة.</p><div class="admin-backup-file"><input id="alinBackupFile" type="file" accept=".json,application/json" onchange="alinReadBackup(this.files[0])"><div id="alinBackupStatus" class="admin-backup-warning">لم يتم اختيار ملف.</div><div id="alinBackupPreview"></div><div class="admin-backup-actions"><button id="alinRestoreBtn" class="admin-backup-danger" disabled type="button" onclick="alinRestoreBackup()">استعادة الكتالوج والإعدادات</button></div></div></article></section>
      <article class="admin-backup-card"><h3>سجل النسخ</h3><div class="admin-backup-log">${history.length?history.map(item=>`<article><div><b>${escv(item.name)}</b><small>${new Date(item.created_at).toLocaleString(window.AlinI18n?.locale?.()||'ar-IQ')} — ${bytesLabel(item.size)}</small></div><span>${item.type==='restore'?'استعادة':'نسخة'}</span></article>`).join(''):'<p class="muted">لا توجد عمليات مسجلة بعد.</p>'}</div></article></section>`;
  }
  function alinCreateBackup(){
    try{const object=snapshot(),name=filename(),size=downloadObject(object,name);addLog(name,size);render();window.toast?.('تم إنشاء النسخة الاحتياطية')}catch(error){alert(error.message||'تعذر إنشاء النسخة')}
  }
  async function alinReadBackup(file){
    pending=null;const status=document.getElementById('alinBackupStatus'),preview=document.getElementById('alinBackupPreview'),button=document.getElementById('alinRestoreBtn');if(!status||!preview||!button)return;
    if(!file){status.textContent='لم يتم اختيار ملف.';button.disabled=true;return}
    try{const object=validate(JSON.parse(await file.text()));pending=object;status.className='admin-backup-ok';status.textContent=`الملف صالح — ${file.name} — ${bytesLabel(file.size)}`;preview.innerHTML=`<pre class="admin-backup-preview">${escv(JSON.stringify({created_at:object.created_at,version:object.backup_version,settings:Object.keys(object.data.settings||{}).length,booklets:rows(object.data.booklets).length,products:rows(object.data.products).length,banners:rows(object.data.banners).length,coupons:rows(object.data.coupons).length},null,2))}</pre>`;button.disabled=false}catch(error){status.className='admin-backup-warning';status.textContent=error.message||'تعذر قراءة الملف';preview.innerHTML='';button.disabled=true}
  }
  async function alinRestoreBackup(){
    if(!pending)return alert('اختر نسخة صالحة أولاً');if(!confirm('سيتم تحديث الكتالوج والإعدادات من النسخة المختارة. الطلبات والحسابات والمالية لن تتغير. متابعة؟'))return;
    const status=document.getElementById('alinBackupStatus'),button=document.getElementById('alinRestoreBtn');if(button)button.disabled=true;if(status){status.className='admin-backup-warning';status.textContent='جارٍ الاستعادة الآمنة...'}
    try{const result=await restoreSafe(pending);addLog(`Restore_${Date.now()}.json`,0,'restore','completed');if(status){status.className='admin-backup-ok';status.textContent=`تمت الاستعادة: ${Object.values(result).reduce((sum,n)=>sum+Number(n||0),0)} سجل`};window.toast?.('تمت الاستعادة الآمنة');render()}catch(error){if(status){status.className='admin-backup-warning';status.textContent=error.message||'تعذرت الاستعادة'};if(button)button.disabled=false}
  }
  function addButton(){
    document.querySelectorAll('#adminPage .admin-tabs').forEach(tabs=>{let button=tabs.querySelector('[data-admin-tab="backup"]');if(button)return;button=document.createElement('button');button.type='button';button.textContent='النسخ الاحتياطي';button.dataset.adminTab='backup';button.setAttribute('onclick',"adminTab('backup')");const settings=tabs.querySelector('[data-admin-tab="settings"],button[onclick*="settings"]');settings?tabs.insertBefore(button,settings):tabs.appendChild(button)})
  }
  function install(){addButton();window.AlinAdminModules?.register?.('backup',render)}
  Object.assign(window,{alinCreateBackup,alinReadBackup,alinRestoreBackup});
  window.AlinBackup=Object.freeze({snapshot,validate,restoreSafe,render});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();

;

;
/* modules/admin/system-health.js */
// === admin/system-health.js ===
/* ===== admin/js/admin-system-health-rc2.js ===== */
(function(){
  'use strict';
  const VERSION='RC2';
  const ERR_KEY='alin_system_errors_rc2';
  const SUPABASE_URL=window.ALIN_CONFIG?.supabaseUrl||'';
  const ANON_KEY=window.ALIN_CONFIG?.supabaseAnonKey||'';
  let lastReport=null,checking=false;
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const dbv=()=>window.db||{};
  const arr=(v)=>Array.isArray(v)?v:[];
  const readErrors=()=>{try{return JSON.parse(localStorage.getItem(ERR_KEY)||'[]')}catch(_){return[]}};
  function logError(type,message,page){const a=readErrors();a.unshift({at:new Date().toISOString(),type,message:String(message||''),page:page||location.pathname});localStorage.setItem(ERR_KEY,JSON.stringify(a.slice(0,50)))}
  window.addEventListener('error',e=>logError('JavaScript',e.message,e.filename||location.pathname));
  window.addEventListener('unhandledrejection',e=>logError('Promise',e.reason?.message||e.reason,location.pathname));
  async function timed(name,fn){const t=performance.now();try{const value=await fn();return{name,status:'ok',ms:Math.round(performance.now()-t),value}}catch(e){return{name,status:'bad',ms:Math.round(performance.now()-t),error:e.message||String(e)}}}
  async function pingDatabase(){const r=await fetch(`${SUPABASE_URL}/rest/v1/accounts?select=id&limit=1`,{headers:{apikey:ANON_KEY,Authorization:`Bearer ${ANON_KEY}`},cache:'no-store'});if(!r.ok){const text=await r.text();if(r.status===401||r.status===403)return {restricted:true,detail:'متصل لكن الصلاحية مقيدة'};throw new Error(text.slice(0,140)||`HTTP ${r.status}`)}return {detail:'الاتصال متاح'}}
  async function pingStorage(){const r=await fetch(`${SUPABASE_URL}/storage/v1/bucket`,{headers:{apikey:ANON_KEY,Authorization:`Bearer ${ANON_KEY}`},cache:'no-store'});if(!r.ok){if(r.status===401||r.status===403)return {restricted:true,detail:'متصل لكن الصلاحية مقيدة'};throw new Error(`HTTP ${r.status}`)}const x=await r.json();return {detail:`${Array.isArray(x)?x.length:0} حاوية ظاهرة`}}
  function localStats(){const d=dbv(),accounts=d.accounts||{};return {orders:arr(d.orders).length,booklets:arr(d.booklets).length,products:arr(d.products).length,teachers:arr(accounts.teachers).length,libraries:arr(accounts.libraries).length,couriers:arr(d.couriers).length||arr(accounts.couriers).length,notifications:arr(d.notifications).length,ledger:arr(d.ledger).length}}
  function backupInfo(){let logs=[];try{logs=JSON.parse(localStorage.getItem('alin_backup_log_v227')||'[]')}catch(_){}return {count:logs.length,last:logs[0]?.created_at||null}}
  async function runChecks(){if(checking)return lastReport;checking=true;renderLoading();const started=new Date().toISOString();const checks=await Promise.all([
    timed('database',pingDatabase),timed('storage',pingStorage),timed('internet',async()=>{if(!navigator.onLine)throw new Error('الجهاز غير متصل بالإنترنت');return {detail:'متصل'}}),timed('localData',async()=>({detail:'البيانات المحلية جاهزة'}))
  ]);const stats=localStats(),backup=backupInfo();const errors=readErrors();lastReport={version:'ALIN RC2',started,finished:new Date().toISOString(),checks,stats,backup,error_count:errors.length,url:location.href,user_agent:navigator.userAgent};checking=false;render();return lastReport}
  function statusOf(c){if(c.status==='bad')return['bad','غير متصل'];if(c.value?.restricted)return['warn','متصل بصلاحية مقيدة'];return['ok','يعمل']}
  function card(title,c,detail){const [cls,label]=statusOf(c);return `<article class="admin-health-card ${cls}"><small>${esc(title)}</small><strong><i class="health-dot"></i>${esc(label)}</strong><span>${esc(detail||c.value?.detail||c.error||'')} • ${c.ms||0}ms</span></article>`}
  function renderLoading(){const root=document.getElementById('adminContent');if(root)root.innerHTML='<section class="admin-health-rc2"><div class="admin-health-empty">جاري فحص صحة النظام...</div></section>'}
  function render(){const root=document.getElementById('adminContent');if(!root)return;const r=lastReport,checks=Object.fromEntries((r?.checks||[]).map(x=>[x.name,x]));const stats=r?.stats||localStats(),backup=r?.backup||backupInfo(),errs=readErrors();const bad=(r?.checks||[]).filter(x=>x.status==='bad').length,warn=(r?.checks||[]).filter(x=>x.value?.restricted).length;const overall=!r?'warn':bad?'bad':warn?'warn':'ok';const overallText=!r?'لم يتم الفحص بعد':bad?'توجد خدمات تحتاج متابعة':warn?'النظام يعمل مع قيود صلاحيات':'جميع الخدمات الأساسية تعمل';root.dataset.adminModule='systemHealth';root.innerHTML=`<section class="admin-health-rc2"><header class="admin-health-head"><div><h2>صحة النظام</h2><p>مراقبة الاتصال والخدمات والبيانات الأساسية لمنصة آلين.</p></div><span class="admin-health-status ${overall}">${esc(overallText)}</span></header><div class="admin-health-actions"><button type="button" onclick="alinRunSystemHealth()">فحص النظام الآن</button><button type="button" class="secondary" onclick="alinRefreshSystemHealth()">تحديث الحالة</button><button type="button" class="secondary" onclick="alinExportSystemHealth()" ${r?'':'disabled'}>تصدير التقرير</button></div><section class="admin-health-grid">${card('قاعدة البيانات',checks.database||{status:'bad',error:'لم يتم الفحص'},'')}${card('التخزين',checks.storage||{status:'bad',error:'لم يتم الفحص'},'')}${card('اتصال الإنترنت',checks.internet||{status:navigator.onLine?'ok':'bad',value:{detail:navigator.onLine?'متصل':'غير متصل'},ms:0},'')}${card('النسخ الاحتياطي',{status:backup.count?'ok':'warn',value:{restricted:!backup.count,detail:backup.count?`${backup.count} نسخة مسجلة`:'لا توجد نسخة مسجلة'},ms:0},'')}</section><section class="admin-health-panels"><article class="admin-health-panel"><h3>إحصائيات النظام الحالية</h3><div class="admin-health-list"><div class="admin-health-row"><span>الطلبات</span><b>${stats.orders}</b></div><div class="admin-health-row"><span>الملازم والمنتجات</span><b>${stats.booklets+stats.products}</b></div><div class="admin-health-row"><span>المدرسون</span><b>${stats.teachers}</b></div><div class="admin-health-row"><span>المكتبات</span><b>${stats.libraries}</b></div><div class="admin-health-row"><span>المندوبون</span><b>${stats.couriers}</b></div><div class="admin-health-row"><span>الحركات المالية</span><b>${stats.ledger}</b></div></div></article><article class="admin-health-panel"><h3>معلومات الإصدار</h3><div class="admin-health-list"><div class="admin-health-row"><span>الإصدار</span><b>RC2</b></div><div class="admin-health-row"><span>آخر فحص</span><b>${r?new Date(r.finished).toLocaleString(window.AlinI18n?.locale?.()||'ar-IQ'):'—'}</b></div><div class="admin-health-row"><span>آخر نسخة احتياطية</span><b>${backup.last?new Date(backup.last).toLocaleString(window.AlinI18n?.locale?.()||'ar-IQ'):'لا توجد'}</b></div><div class="admin-health-row"><span>حالة الإنترنت</span><b>${navigator.onLine?'متصل':'غير متصل'}</b></div></div></article></section><article class="admin-health-panel"><h3>آخر الأخطاء المسجلة</h3><div class="admin-health-errors">${errs.length?errs.slice(0,10).map(e=>`<div class="admin-health-error"><b>${esc(e.type)}</b><div>${esc(e.message)}</div><small>${new Date(e.at).toLocaleString(window.AlinI18n?.locale?.()||'ar-IQ')} — ${esc(e.page)}</small></div>`).join(''):'<div class="admin-health-empty">لا توجد أخطاء مسجلة في هذه الجلسات.</div>'}</div></article>${r?`<details class="admin-health-panel"><summary>عرض التقرير التقني</summary><pre class="admin-health-report">${esc(JSON.stringify(r,null,2))}</pre></details>`:''}</section>`}
  window.alinRunSystemHealth=runChecks;window.alinRefreshSystemHealth=runChecks;window.alinExportSystemHealth=function(){if(!lastReport)return;const blob=new Blob([JSON.stringify(lastReport,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`Alin_System_Health_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
  function addButton(){document.querySelectorAll('#adminPage .admin-tabs').forEach(tabs=>{let b=tabs.querySelector('[data-admin-tab="systemHealth"],button[onclick*="systemHealth"]');if(!b){b=document.createElement('button');b.textContent='صحة النظام';b.dataset.adminTab='systemHealth';b.className='admin-health-tab-rc2';b.setAttribute('onclick',"adminTab('systemHealth')");const settings=[...tabs.querySelectorAll('button')].find(x=>(x.getAttribute('onclick')||'').includes("'settings'"));settings?tabs.insertBefore(b,settings):tabs.appendChild(b)}})}
  function install(){addButton();window.AlinAdminModules?.register?.('systemHealth',render)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();

/* ===== admin/js/admin-supabase-readiness-rc5-4.js ===== */
(function(){
  'use strict';
  const VERSION='RC5.4';
  const REQUIRED=['settings','accounts','orders','booklets','products','notifications','couriers','delivery_areas','financial_entries'];
  let report=null,running=false;
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const client=()=>window.supabaseClient||window.sb||window.supabase?.client||window.AlinRepository?.client?.();
  const now=()=>new Date().toISOString();
  const text=e=>e?.message||e?.error_description||String(e||'خطأ غير معروف');
  async function timed(name,fn){const t=performance.now();try{return{name,status:'ok',ms:Math.round(performance.now()-t),value:await fn()}}catch(e){return{name,status:'bad',ms:Math.round(performance.now()-t),error:text(e)}}}
  async function checkClient(){const c=client();if(!c)throw new Error('Supabase client غير متوفر في الصفحة');return {detail:'عميل Supabase محمل'}}
  async function checkDatabaseVersion(){const c=client();if(!c)throw new Error('Supabase غير متصل');const {data,error}=await c.from('settings').select('key,value,id,version').or('key.eq.alin_db_version,key.eq.__main__,id.eq.main').limit(5);if(error)throw error;const row=(data||[]).find(x=>x.key==='alin_db_version')||(data||[]).find(x=>x.id==='main'||x.key==='__main__');return {detail:row?.value||row?.version||'غير محدد',rows:data||[]}}
  async function checkTables(){const c=client();if(!c)throw new Error('Supabase غير متصل');const out=[];for(const table of REQUIRED){const {count,error}=await c.from(table).select('*',{count:'exact',head:true});out.push({table,ok:!error,count:count??0,error:error?text(error):''})}return {detail:`${out.filter(x=>x.ok).length}/${out.length} جداول جاهزة`,tables:out}}
  async function checkStorage(){const c=client();if(!c)throw new Error('Supabase غير متصل');const {data,error}=await c.storage.listBuckets();if(error)throw error;const names=(data||[]).map(x=>x.name);return {detail:`${names.length} حاويات`,buckets:names}}
  async function checkRealtime(){const c=client();if(!c)throw new Error('Supabase غير متصل');return await new Promise((resolve,reject)=>{let done=false;const channel=c.channel('alin_rc54_probe_'+Date.now());const timer=setTimeout(()=>{if(done)return;done=true;try{c.removeChannel(channel)}catch(_){}reject(new Error('انتهت مهلة اتصال Realtime'))},7000);channel.subscribe(status=>{if(done)return;if(status==='SUBSCRIBED'){done=true;clearTimeout(timer);try{c.removeChannel(channel)}catch(_){}resolve({detail:'Realtime متصل'})}else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED'){done=true;clearTimeout(timer);try{c.removeChannel(channel)}catch(_){}reject(new Error('Realtime: '+status))}})})}
  async function checkRepository(){if(!window.AlinRepository)throw new Error('طبقة AlinRepository غير محملة');const r=await window.AlinRepository.verify();if(!r?.ok)throw new Error(r?.error||'فحص المستودع لم ينجح');return {detail:'طبقة الربط تعمل',report:r}}
  async function safeWriteTest(){const c=client();if(!c)throw new Error('Supabase غير متصل');const id='health_'+Date.now()+'_'+Math.random().toString(36).slice(2,8),payload={id,status:'probe',details:{source:'RC5.4',safe_test:true},created_at:now()};const ins=await c.from('system_health_logs').insert(payload).select('id').single();if(ins.error)throw ins.error;const del=await c.from('system_health_logs').delete().eq('id',id);if(del.error)throw del.error;return {detail:'الكتابة والحذف يعملان بأمان',id}}
  function cls(c){if(!c)return'warn';if(c.status==='bad')return'bad';return'ok'}
  function card(title,c){return `<article class="admin-readiness-card ${cls(c)}"><small>${esc(title)}</small><strong><i class="admin-readiness-dot"></i>${esc(c?.status==='bad'?'فشل':'جاهز')}</strong><span>${esc(c?.value?.detail||c?.error||'لم يتم الفحص')} ${c?.ms!=null?'• '+c.ms+'ms':''}</span></article>`}
  function tableRows(){const x=report?.checks?.find(c=>c.name==='tables')?.value?.tables||[];return x.map(r=>`<tr><td><code>${esc(r.table)}</code></td><td><span class="admin-readiness-chip ${r.ok?'ok':'bad'}">${r.ok?'جاهز':'خطأ'}</span></td><td>${r.ok?esc(r.count):esc(r.error)}</td></tr>`).join('')||'<tr><td colspan="3">لم يتم فحص الجداول بعد.</td></tr>'}
  function renderLoading(){const root=document.getElementById('adminContent');if(root)root.innerHTML='<section class="admin-readiness"><div class="admin-readiness-empty">جاري فحص الربط النهائي مع Supabase...</div></section>'}
  function render(){const root=document.getElementById('adminContent');if(!root)return;const map=Object.fromEntries((report?.checks||[]).map(x=>[x.name,x]));const bad=(report?.checks||[]).filter(x=>x.status==='bad').length;const overall=!report?'warn':bad?'bad':'ok';const label=!report?'لم يتم الفحص':bad?`توجد ${bad} مشكلة`:'الربط جاهز';root.dataset.adminModule='supabaseReadiness';root.innerHTML=`<section class="admin-readiness"><header class="admin-readiness-head"><div><h2>جاهزية الربط مع Supabase</h2><p>فحص قاعدة البيانات والتخزين وRealtime وطبقة المزامنة قبل بدء الاختبار العملي.</p></div><span class="admin-readiness-state ${overall}">${esc(label)}</span></header><div class="admin-readiness-actions"><button type="button" onclick="alinRunSupabaseReadiness()">فحص الربط الآن</button><button type="button" class="secondary" onclick="alinRunSafeWriteTest()">اختبار كتابة آمن</button><button type="button" class="secondary" onclick="alinExportReadiness()" ${report?'':'disabled'}>تصدير التقرير</button></div><div class="admin-readiness-grid">${card('عميل Supabase',map.client)}${card('إصدار قاعدة البيانات',map.version)}${card('الجداول الأساسية',map.tables)}${card('Storage',map.storage)}${card('Realtime',map.realtime)}${card('طبقة المزامنة',map.repository)}${card('اختبار الكتابة',map.write)}${card('اتصال الإنترنت',{status:navigator.onLine?'ok':'bad',value:{detail:navigator.onLine?'متصل':'غير متصل'},ms:0})}</div><article class="admin-readiness-panel"><h3>تفاصيل الجداول</h3><table class="admin-readiness-table"><thead><tr><th>الجدول</th><th>الحالة</th><th>النتيجة</th></tr></thead><tbody>${tableRows()}</tbody></table></article>${report?`<details class="admin-readiness-panel"><summary>التقرير التقني</summary><pre class="admin-readiness-log">${esc(JSON.stringify(report,null,2))}</pre></details>`:''}</section>`}
  async function run(includeWrite=false){if(running)return report;running=true;renderLoading();const checks=await Promise.all([timed('client',checkClient),timed('version',checkDatabaseVersion),timed('tables',checkTables),timed('storage',checkStorage),timed('realtime',checkRealtime),timed('repository',checkRepository)]);if(includeWrite)checks.push(await timed('write',safeWriteTest));report={version:VERSION,at:now(),url:location.href,online:navigator.onLine,checks};running=false;render();return report}
  window.alinRunSupabaseReadiness=()=>run(false);
  window.alinRunSafeWriteTest=()=>run(true);
  window.alinExportReadiness=function(){if(!report)return;const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`Alin_RC5_4_Readiness_${new Date().toISOString().replace(/[:.]/g,'-')}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
  function addTab(){document.querySelectorAll('#adminPage .admin-tabs').forEach(tabs=>{let b=tabs.querySelector('[data-admin-tab="supabaseReadiness"]');if(!b){b=document.createElement('button');b.textContent='فحص الربط';b.dataset.adminTab='supabaseReadiness';b.setAttribute('onclick',"adminTab('supabaseReadiness')");const health=tabs.querySelector('[data-admin-tab="systemHealth"],button[onclick*="systemHealth"]');health?tabs.insertBefore(b,health.nextSibling):tabs.appendChild(b)}})}
  function install(){addTab();window.AlinAdminModules?.register?.('supabaseReadiness',render)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();


;

;
/* modules/core/supabase-ui.js */
// === core/supabase-ui.js ===
/* ALIN v2.4.2 — read-only UI binding for the authoritative Supabase service.
   Data access is owned only by modules/core/supabase.js.
   File storage is owned only by modules/core/storage.js.
*/
(function(){
  'use strict';

  const VERSION='2.4.2';
  let lastRefresh=null;
  let lastMutation=null;

  function setRootState(state){
    const root=document.documentElement;
    if(!root?.dataset)return;
    root.dataset.alinDataState=state;
    root.dataset.alinDataVersion=VERSION;
  }
  function onRefresh(event){
    lastRefresh={...(event?.detail||{}),received_at:new Date().toISOString()};
    setRootState(lastRefresh.errors?.length?'partial':'ready');
  }
  function onMutation(event){
    lastMutation={...(event?.detail||{}),received_at:new Date().toISOString()};
    setRootState('updating');
  }
  async function refresh(options={}){
    if(!window.AlinRepository?.refresh)throw new Error('خدمة البيانات غير جاهزة');
    return window.AlinRepository.refresh(options);
  }
  function status(){
    return Object.freeze({version:VERSION,lastRefresh,lastMutation,connected:!!window.AlinRepository?.online?.()});
  }

  window.addEventListener('alin:data-refreshed',onRefresh);
  window.addEventListener('alin:cloud-mutation',onMutation);
  window.AlinRepositoryUI=Object.freeze({version:VERSION,refresh,status});
  setRootState(window.AlinRepository?.online?.()?'loading':'offline');
})();

;

;
/* modules/core/cloud-status.js */
// === core/cloud-status.js ===
/* ===== core/js/cloud-status-ui-rc5-3.js ===== */
(function(){
  function mount(){
    if(document.getElementById('alinCloudRc53'))return;
    const el=document.createElement('div');el.id='alinCloudRc53';el.className='alin-cloud-rc53';el.dataset.status=navigator.onLine?'loading':'offline';el.textContent=navigator.onLine?'جاري ربط البيانات':'غير متصل';document.body.appendChild(el);
    const set=(s,t)=>{el.dataset.status=s;el.textContent=t};
    window.addEventListener('alin:cloud-status',e=>{const s=e.detail?.status||'loading';const map={online:'متصل ومزامن',realtime:'تحديث مباشر',loading:'جاري تحميل البيانات',syncing:'جاري المزامنة',offline:'غير متصل',error:'خطأ في الربط','offline-queued':'محفوظ للمزامنة'};set(s,map[s]||'حالة الاتصال: '+s)});
    window.addEventListener('alin:data-refreshed',e=>set(e.detail?.errors?.length?'error':'online',e.detail?.errors?.length?'اتصال جزئي':'متصل ومزامن'));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();

;
/* modules/core/auth-service.js */
/* ALIN v3.0.1 — fast cached boot with server-side attempt protection. */
(function(){
  'use strict';
  const ATTEMPT_KEY='alin_auth_attempts_v139',MAX_ATTEMPTS=5,LOCK_MS=10*60*1000;
  const cfg=()=>window.ALIN_CONFIG||{};
  const enabled=()=>cfg().authEnabled===true;
  const client=()=>window.sb||(window.AlinCloud&&window.AlinCloud.client?.())||null;
  const emailFor=value=>{
    const raw=String(value||'').trim().toLocaleLowerCase('en-US').replace(/\s+/g,'-');
    if(raw.includes('@'))return raw;
    const ascii=raw.replace(/[^a-z0-9._-]/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'')||'user';
    let hash=2166136261;for(const byte of new TextEncoder().encode(raw))hash=Math.imul(hash^byte,16777619);
    const key=`${ascii.slice(0,38)}-${(hash>>>0).toString(36)}`;
    return `${key}@${cfg().authEmailDomain||'users.alin.local'}`;
  };
  const msg=text=>{const el=window.loginMsg||document.getElementById('loginMsg');if(el)el.textContent=text};
  const DEVICE_KEY='alin_device_id_v3';
  function deviceId(){
    try{let value=localStorage.getItem(DEVICE_KEY);if(!value){value=crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`;localStorage.setItem(DEVICE_KEY,value)}return value}
    catch(_){return 'browser-session'}
  }
  async function secureSignIn(username,password){
    const c=client();if(!c?.functions||!c?.auth)throw new Error('خدمة تسجيل الدخول الآمنة غير متاحة');
    const {data,error}=await c.functions.invoke('secure-login',{body:{username:String(username||''),password:String(password||''),device_id:deviceId()}});
    if(error){let message=error.message||'تعذر تسجيل الدخول';try{message=(await error.context?.json())?.error||message}catch(_){}throw new Error(message)}
    if(!data?.ok||!data?.session?.access_token||!data?.session?.refresh_token)throw new Error(data?.error||'تعذر تسجيل الدخول');
    const applied=await c.auth.setSession({access_token:data.session.access_token,refresh_token:data.session.refresh_token});
    if(applied?.error||!applied?.data?.user)throw applied?.error||new Error('تعذر تثبيت جلسة الدخول');
    return applied.data;
  }
  const readAttempts=()=>{try{return JSON.parse(localStorage.getItem(ATTEMPT_KEY)||'{}')}catch(_){return{}}};
  const writeAttempts=x=>{try{localStorage.setItem(ATTEMPT_KEY,JSON.stringify(x))}catch(_){}};
  const attemptId=(role,user)=>`${String(role||'').toLowerCase()}:${String(user||'').trim().toLowerCase()}`;
  function lockRemaining(role,user){const all=readAttempts(),x=all[attemptId(role,user)];if(!x)return 0;if(x.lockedUntil<=Date.now()){delete all[attemptId(role,user)];writeAttempts(all);return 0}return x.lockedUntil-Date.now()}
  function failAttempt(role,user){const all=readAttempts(),k=attemptId(role,user),now=Date.now(),x=all[k]||{count:0,first:now,lockedUntil:0};if(now-x.first>LOCK_MS){x.count=0;x.first=now}x.count++;if(x.count>=MAX_ATTEMPTS)x.lockedUntil=now+LOCK_MS;all[k]=x;writeAttempts(all);return x}
  function clearAttempts(role,user){const all=readAttempts();delete all[attemptId(role,user)];writeAttempts(all)}
  const invokeError=async(error,fallback)=>{let message=error?.message||fallback;try{message=(await error?.context?.json())?.error||message}catch(_){}return new Error(message||fallback)};
  const friendlyAdminMessage=value=>{const text=String(value||'');if(/already (?:been )?registered|already exists|email.*registered/i.test(text))return 'الحساب موجود مسبقاً وسيتم ربطه بدلاً من إنشائه من جديد';if(/duplicate key.*username|اسم الدخول مستخدم/i.test(text))return 'اسم الدخول مستخدم مسبقاً';return text};
  const invalidSessionMessage=value=>/جلسة الدخول غير صالحة|انتهت جلسة|invalid(?:\s+)?jwt|jwt(?:\s+)?expired|session|user from sub claim/i.test(String(value||''));
  async function adminSession(forceRefresh=false){
    const c=client();if(!c?.auth)throw new Error('خدمة تسجيل الدخول غير متاحة');
    let response=forceRefresh?await c.auth.refreshSession():await c.auth.getSession();
    let session=response?.data?.session||null;
    if(!session&&!forceRefresh){response=await c.auth.refreshSession();session=response?.data?.session||null}
    if(!session?.access_token)throw new Error('انتهت جلسة المدير. سجل الخروج ثم ادخل مرة ثانية');
    const check=await c.auth.getUser(session.access_token);
    if(check?.error||!check?.data?.user){
      if(!forceRefresh)return adminSession(true);
      throw new Error('انتهت جلسة المدير. سجل الخروج ثم ادخل مرة ثانية');
    }
    return session;
  }
  async function invokeAdmin(name,body){
    const c=client();if(!c?.functions)throw new Error('خدمة الإدارة الآمنة غير متاحة');
    let lastError=null;
    for(let attempt=0;attempt<2;attempt++){
      const session=await adminSession(attempt===1);
      const {data,error}=await c.functions.invoke(name,{body,headers:{Authorization:`Bearer ${session.access_token}`}});
      if(error){lastError=await invokeError(error,'تعذر تنفيذ العملية');lastError=new Error(friendlyAdminMessage(lastError.message));if(attempt===0&&invalidSessionMessage(lastError.message))continue;throw lastError}
      if(!data?.ok){lastError=new Error(friendlyAdminMessage(data?.error||'تعذر تنفيذ العملية'));if(attempt===0&&invalidSessionMessage(lastError.message))continue;throw lastError}
      return data;
    }
    throw lastError||new Error('تعذر تنفيذ العملية');
  }

  async function accountForUser(user){
    const c=client();if(!c||!user)return null;
    const {data,error}=await c.from('accounts').select('id,role,name,username,status,auth_user_id,area,phone,landmark,admin_level,deleted_at').eq('auth_user_id',user.id).maybeSingle();
    if(error)throw error;
    return data||null;
  }

  async function login(){
    const c=client();if(!c)throw new Error('خدمة تسجيل الدخول غير متاحة');
    const username=(window.loginU||document.getElementById('loginU'))?.value||'';
    const password=(window.loginPass||document.getElementById('loginPass'))?.value||'';
    const requested=String(window.pendingRole||'');
    if(!username.trim()||!password)throw new Error('اكتب اسم الدخول وكلمة المرور');
    const left=lockRemaining(requested,username);
    if(left>0)throw new Error(`تم إيقاف المحاولات مؤقتاً. حاول بعد ${Math.ceil(left/60000)} دقيقة`);
    let data;
    try{data=await secureSignIn(username,password)}catch(error){const state=failAttempt(requested,username);throw new Error(error?.message||(state.lockedUntil>Date.now()?'تم إيقاف المحاولات مؤقتاً':'بيانات الدخول غير صحيحة'))}
    const account=await accountForUser(data.user);
    if(!account||account.status!=='active'){
      await c.auth.signOut();failAttempt(requested,username);throw new Error('الحساب غير مربوط أو غير فعال');
    }
    if(requested&&requested!=='store'&&account.role!==requested&&account.role!=='admin'){
      await c.auth.signOut();failAttempt(requested,username);throw new Error('نوع الحساب لا يطابق البوابة المختارة');
    }
    clearAttempts(requested,username);
    window.current={role:account.role,id:account.id,name:account.name,username:account.username,auth_user_id:data.user.id,area:account.area||'',phone:account.phone||'',landmark:account.landmark||'',admin_level:account.admin_level||'operator'};
    if(typeof window.load==='function')await window.load();
    const targetPage=account.role==='accountant'?'admin':account.role;
    if(typeof window.openPage==='function')window.openPage(targetPage,{render:false});
    const passEl=window.loginPass||document.getElementById('loginPass');if(passEl)passEl.value='';
    window.dispatchEvent(new CustomEvent('alin:auth-login',{detail:{account}}));
    return account;
  }


  let restorePromise=null,logoutPromise=null,explicitSignOut=false;
  function finishAuthBoot(){
    try{document.documentElement?.removeAttribute?.('data-alin-auth-boot')}catch(_){}
  }
  function showSignedOut(){
    if(window.current)return;
    if(window.ALINNavigation?.showSignedOut)return window.ALINNavigation.showSignedOut();
    document.getElementById('app')?.classList.add('hidden');
    document.getElementById('login')?.classList.remove('hidden');
  }
  function accountState(account,user){
    return {role:account.role,id:account.id,name:account.name,username:account.username,auth_user_id:user.id,area:account.area||'',phone:account.phone||'',landmark:account.landmark||'',admin_level:account.admin_level||'operator'};
  }
  async function openPublicStore(){
    try{window.AlinCloud?.loadCachedSnapshot?.()}catch(_){}
    if(typeof window.openPage==='function')window.openPage('store',{render:true});
    finishAuthBoot();
    try{if(typeof window.load==='function')await window.load({reason:'public-boot'})}catch(error){console.warn('[ALIN public data refresh]',error)}
    return false;
  }
  async function restoreSession(){
    if(!enabled()){if(typeof window.openPage==='function')window.openPage('store');finishAuthBoot();return false}
    if(restorePromise)return restorePromise;
    restorePromise=(async()=>{
      const c=client();
      if(!c?.auth)return openPublicStore();
      const response=await c.auth.getSession();
      const session=response?.data?.session||null;
      if(response?.error||!session?.user)return openPublicStore();
      const account=await accountForUser(session.user);
      if(!account||account.status!=='active'){
        explicitSignOut=true;
        try{await c.auth.signOut()}catch(_){}
        explicitSignOut=false;
        window.current=null;showSignedOut();finishAuthBoot();return false;
      }
      window.current=accountState(account,session.user);
      try{window.AlinCloud?.loadCachedSnapshot?.()}catch(_){}
      const target=account.role==='accountant'?'admin':account.role;
      if(typeof window.openPage==='function')window.openPage(target,{render:true});
      finishAuthBoot();
      try{if(typeof window.load==='function')await window.load({reason:'session-boot'})}catch(error){console.warn('[ALIN session data refresh]',error)}
      if(typeof window.openPage==='function')window.openPage(target,{render:false});
      if(account.role==='library')window.AlinLibraryModules?.showLibraryPage?.();
      window.dispatchEvent(new CustomEvent('alin:auth-restored',{detail:{account}}));
      return true;
    })().catch(error=>{
      console.error('[ALIN auth restore]',error);
      window.current=null;showSignedOut();finishAuthBoot();return false;
    }).finally(()=>{restorePromise=null});
    return restorePromise;
  }

  async function loginFromUI(){
    try{msg('جارٍ التحقق...');const account=await login();msg('');return account}
    catch(error){msg(error?.message||'تعذر تسجيل الدخول');throw error}
    finally{finishAuthBoot()}
  }
  async function signOut(){
    if(logoutPromise)return logoutPromise;
    logoutPromise=(async()=>{
      explicitSignOut=true;
      try{await client()?.auth?.signOut()}finally{explicitSignOut=false}
      try{window.AlinCloud?.clearPrivateCache?.()}catch(_){}
      finishAuthBoot();
      return true;
    })().finally(()=>{logoutPromise=null});
    return logoutPromise;
  }
  function install(){
    if(!enabled()){window.ALIN_AUTH_MODE='disabled';finishAuthBoot();return}
    window.ALIN_AUTH_MODE='supabase';
    if(typeof window.ALINAuth?.createAccountFromAdmin==='function')window.addAccount=window.ALINAuth.createAccountFromAdmin;
    client()?.auth?.onAuthStateChange?.((event)=>{
      if(event==='SIGNED_OUT'&&!explicitSignOut){window.current=null;showSignedOut();finishAuthBoot();window.dispatchEvent(new CustomEvent('alin:logout',{detail:{source:'external'}}))}
    });
    restoreSession();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();

  window.ALINAuthRuntime=Object.freeze({client,invokeAdmin,adminSession,finishAuthBoot,showSignedOut,deviceId,secureSignIn});
  window.ALINAuth=Object.assign(window.ALINAuth||{},{
    enabled,emailFor,login,loginFromUI,signOut,restoreSession,accountForUser,
    ensureAdminSession:()=>adminSession(false)
  });
})();

;
/* modules/core/account-admin-service.js */
// === core/account-admin-service.js ===
/* ALIN v2.4.2 — secure account administration adapter. */
(function(){
  'use strict';
  const runtime=()=>window.ALINAuthRuntime||{};
  const client=()=>runtime().client?.()||window.sb||window.AlinCloud?.client?.()||null;
  const strongPassword=value=>String(value||'').length>=12&&/[0-9]/.test(value)&&/[A-Za-z\u0600-\u06FF]/.test(value);
  const invokeAdmin=(name,body)=>{
    const invoke=runtime().invokeAdmin;
    if(typeof invoke!=='function')throw new Error('خدمة إدارة الحسابات غير جاهزة');
    return invoke(name,body);
  };
  async function createAccount(payload){
    if(!payload?.name||!payload?.username||!payload?.password)throw new Error('أكمل الاسم واسم الدخول وكلمة المرور');
    if(!strongPassword(payload.password))throw new Error('كلمة المرور يجب أن تكون 12 حرفاً على الأقل وتتضمن حروفاً وأرقاماً');
    const data=await invokeAdmin('admin-create-account',payload);
    if(typeof load==='function')await load();
    return data.account;
  }

  async function createAccountFromAdmin(){
    try{
      const role=document.getElementById('aRole')?.value||'';
      const selectedAreas=[...document.querySelectorAll('#v163CourierAreaPicker input:checked')].map(x=>String(x.value||'').trim()).filter(Boolean);
      const payload={
        role,
        name:document.getElementById('aName')?.value?.trim()||'',
        username:document.getElementById('aUser')?.value?.trim()||'',
        password:document.getElementById('aPass')?.value||'',
        area:role==='courier'?(selectedAreas[0]||''):(document.getElementById('aArea')?.value?.trim()||''),
        landmark:role==='courier'?'':(document.getElementById('aLandmark')?.value?.trim()||''),
        phone:document.getElementById('v163CourierPhone')?.value?.trim()||'',
        availability:document.getElementById('v163CourierAvailability')?.value||'available',
        areas:selectedAreas,
        status:'active'
      };
      if(role==='courier'&&!payload.areas.length)throw new Error('اختر منطقة عمل واحدة على الأقل');
      if(role==='courier'&&!payload.phone)throw new Error('أدخل رقم هاتف المندوب');
      const account=await createAccount(payload);
      const pass=document.getElementById('aPass');if(pass)pass.value='';
      if(typeof renderAccountsAdmin==='function')renderAccountsAdmin();
      if(typeof toast==='function')toast(`تم إنشاء الحساب: ${account.username}`);else alert(`تم إنشاء الحساب بنجاح: ${account.username}`);
      return account;
    }catch(e){alert(e.message||'تعذر إنشاء الحساب');throw e}
  }

  async function repairAuthLink(accountId){
    const c=client();if(!c?.rpc||!accountId)return 0;
    const {data,error}=await c.rpc('alin_repair_auth_links',{p_account_id:String(accountId)});
    if(error){
      const text=String(error.message||'');
      if(/PGRST202|Could not find the function|schema cache/i.test(text))throw new Error('تحديث ربط الحسابات غير منفذ. شغّل ملف RUN_ON_SUPABASE_v2_1_8_COMPLETE.sql مرة واحدة');
      throw error;
    }
    return Number(data||0);
  }
  async function updateAccountFromAdmin(payload){
    if(payload?.password&&payload?.account_id)await repairAuthLink(payload.account_id);
    const data=await invokeAdmin('admin-update-account',payload);
    if(typeof load==='function')await load();
    return data.account;
  }
  async function resetPasswordFromAdmin(accountId,password){
    if(!strongPassword(password))throw new Error('كلمة المرور يجب أن تكون 12 حرفاً على الأقل وتتضمن حروفاً وأرقاماً');
    await repairAuthLink(accountId);
    return invokeAdmin('admin-reset-password',{account_id:accountId,password});
  }
  async function deleteAccountFromAdmin(accountId){return invokeAdmin('admin-delete-account',{account_id:accountId})}
  window.ALINAuth=Object.assign(window.ALINAuth||{},
    {createAccount,createAccountFromAdmin,updateAccountFromAdmin,resetPasswordFromAdmin,repairAuthLink,deleteAccountFromAdmin});
  window.ALINAccountAdmin=Object.freeze({createAccount,createAccountFromAdmin,updateAccountFromAdmin,resetPasswordFromAdmin,repairAuthLink,deleteAccountFromAdmin});
})();

;
/* modules/core/checkout-service.js */
// === core/checkout-service.js ===
/* ALIN v2.7.0 Stage 4 — guarded checkout, idempotency and device rate limits. */
(function(){
  'use strict';
  const client=()=>window.ALINAuthRuntime?.client?.()||window.sb||window.AlinCloud?.client?.()||null;
  function normalizeCheckoutItems(lines){
    const booklets=Array.isArray(window.db?.booklets)?window.db.booklets:[];
    const products=Array.isArray(window.db?.products)?window.db.products:[];
    const same=(a,b)=>String(a??'')===String(b??'');
    const findBooklet=id=>booklets.find(x=>same(x.id,id))||null;
    const findProduct=id=>products.find(x=>same(x.id,id))||null;
    const aliases={booklet:'booklet',booklets:'booklet','ملزمة':'booklet','ملازم':'booklet',product:'product',products:'product',stationery:'product',stationary:'product',gift:'product',gifts:'product',deal:'product',booklet_product:'product'};
    return lines.map((line,index)=>{
      let id=String(line?.id??'').trim();
      let kind=String(line?.kind??'').trim().toLowerCase();
      let booklet=findBooklet(id),product=findProduct(id);
      // بعض الأكواد القديمة كانت تستدعي addToCart(id, kind) بالعكس.
      if(!booklet&&!product&&kind){
        const swappedBooklet=findBooklet(kind),swappedProduct=findProduct(kind);
        if(swappedBooklet||swappedProduct){id=kind;kind=String(line?.id??'').trim().toLowerCase();booklet=swappedBooklet;product=swappedProduct}
      }
      const canonical=booklet?'booklet':product?'product':aliases[kind]||'';
      if(!id||!canonical||(!booklet&&!product&&booklets.length+products.length>0)){
        const title=String(line?.title||`العنصر ${index+1}`).trim();
        throw new Error(`العنصر «${title}» لم يعد موجوداً في المتجر. احذفه من السلة وأضفه من جديد`);
      }
      // إصلاح السلة القديمة محلياً حتى لا يتكرر الخطأ في الطلب التالي.
      line.id=id;line.kind=canonical;
      return {kind:canonical,id,qty:Math.max(1,Math.min(100,Number(line?.qty)||1))};
    });
  }


  function normalizeFulfillment(raw={}){
    const type=String(raw?.fulfillment_type||raw?.delivery_type||'').trim().toLowerCase();
    if(['pickup','library'].includes(type)){
      const libraryId=String(raw?.library_id||raw?.pickup_library_id||'').trim();
      if(!libraryId)throw new Error('اختر مكتبة الاستلام');
      return {fulfillment_type:'pickup',library_id:libraryId,pickup_library_id:libraryId};
    }
    if(['home_delivery','courier','delivery'].includes(type)){
      const area=String(raw?.delivery_area||'').trim();
      const landmark=String(raw?.delivery_landmark||'').trim().slice(0,300);
      const latitude=raw?.delivery_latitude==null||raw.delivery_latitude===''?null:Number(raw.delivery_latitude);
      const longitude=raw?.delivery_longitude==null||raw.delivery_longitude===''?null:Number(raw.delivery_longitude);
      const accuracy=raw?.delivery_location_accuracy==null||raw.delivery_location_accuracy===''?null:Math.round(Number(raw.delivery_location_accuracy));
      if(!area)throw new Error('اختر منطقة التوصيل');
      if(!landmark&&!Number.isFinite(latitude))throw new Error('حدد الموقع أو اكتب أقرب نقطة دالة');
      return {
        fulfillment_type:'home_delivery',delivery_area:area,delivery_landmark:landmark,
        delivery_latitude:Number.isFinite(latitude)?latitude:null,
        delivery_longitude:Number.isFinite(longitude)?longitude:null,
        delivery_location_accuracy:Number.isFinite(accuracy)?accuracy:null
      };
    }
    throw new Error('اختر طريقة استلام صحيحة');
  }


  function randomId(){
    if(globalThis.crypto?.randomUUID)return globalThis.crypto.randomUUID();
    const bytes=new Uint8Array(16);globalThis.crypto?.getRandomValues?.(bytes);
    if(!bytes.some(Boolean)){for(let i=0;i<bytes.length;i++)bytes[i]=Math.floor(Math.random()*256)}
    bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
    return [...bytes].map((b,i)=>([4,6,8,10].includes(i)?'-':'')+b.toString(16).padStart(2,'0')).join('');
  }
  function deviceId(){
    const key='alin_device_id_v1';
    try{
      let value=localStorage.getItem(key);
      if(!value||value.length<16){value=randomId();localStorage.setItem(key,value)}
      return value;
    }catch(_){return randomId()}
  }
  function checkoutAttempt(fingerprint){
    const key='alin_checkout_attempt_v1';
    const now=Date.now();
    try{
      const saved=JSON.parse(sessionStorage.getItem(key)||'null');
      if(saved?.fingerprint===fingerprint&&saved?.requestKey&&now-Number(saved.createdAt||0)<15*60*1000)return saved;
      const next={fingerprint,requestKey:randomId(),createdAt:now};
      sessionStorage.setItem(key,JSON.stringify(next));return next;
    }catch(_){return {fingerprint,requestKey:randomId(),createdAt:now}}
  }
  function clearCheckoutAttempt(){try{sessionStorage.removeItem('alin_checkout_attempt_v1')}catch(_){}}

  let checkoutPending=false;
  async function secureCheckout(){
    if(checkoutPending)return;
    const button=document.querySelector('[onclick*="confirmCartCheckout"],#confirmCheckoutButton,[data-confirm-checkout]');
    try{
      checkoutPending=true;
      if(button){button.disabled=true;button.setAttribute('aria-busy','true');button.dataset.originalText=button.textContent;button.textContent='جارٍ إرسال الطلب...'}
      const c=client();if(!c?.rpc)throw new Error('تعذر الاتصال بالخدمة. تحقق من الإنترنت وحاول مجدداً');
      if(typeof cart==='undefined'||!Array.isArray(cart)||!cart.length)throw new Error('السلة فارغة');
      const name=(document.getElementById('studentName')?.value||'').trim();
      const phone=(document.getElementById('studentPhone')?.value||'').trim().replace(/\s+/g,'');
      if(name.length<2)throw new Error('اكتب اسم الطالب بصورة صحيحة');
      if(!/^\+?[0-9٠-٩]{7,15}$/.test(phone))throw new Error('اكتب رقم هاتف صحيح');
      const fulfillment=normalizeFulfillment(typeof alinOrderExtra==='function'?alinOrderExtra():{});
      const coupon=(window.AlinCoupons?.getAppliedCode?.()||document.getElementById('couponInput')?.value||'').trim();
      const cartSnapshot=cart.map(item=>({...item}));
      const items=normalizeCheckoutItems(cart);
      const fingerprint=JSON.stringify({items,customer:{name,phone},fulfillment,coupon:coupon.toLowerCase()});
      const attempt=checkoutAttempt(fingerprint);
      if(typeof cartSave==='function')cartSave();
      const {data,error}=await c.rpc('alin_create_store_orders_guarded',{
        p_items:items,p_customer:{name,phone},p_fulfillment:fulfillment,p_coupon_code:coupon||null,
        p_request_key:attempt.requestKey,p_device_id:deviceId()
      });
      if(error){
        const message=String(error.message||'');
        if(/PGRST202|Could not find the function|schema cache/i.test(message))throw new Error('خدمة حماية الطلبات غير محدثة. نفّذ ملف المرحلة الرابعة ثم حدّث الصفحة.');
        throw error;
      }
      const numbers=Array.isArray(data)?data.map(x=>String(x.order_number||'')).filter(Boolean):[];
      if(!numbers.length)throw new Error('لم يرجع الخادم رقم تتبع للطلب');
      clearCheckoutAttempt();
      cart=[];if(typeof cartSave==='function')cartSave();
      if(typeof load==='function')await load();
      const box=window.checkoutBox||document.getElementById('checkoutBox');
      if(box){
        const copyTrackingCode=async(code,button)=>{
          let copied=false;
          try{
            if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(code);copied=true}
          }catch(_){}
          if(!copied){
            const field=document.createElement('textarea');
            field.value=code;field.setAttribute('readonly','');field.style.position='fixed';field.style.opacity='0';
            document.body.appendChild(field);field.select();
            try{copied=document.execCommand('copy')}catch(_){}
            field.remove();
          }
          if(!copied){window.prompt('انسخ رقم التتبع',code);return}
          const label=button.querySelector('span');
          button.classList.add('is-copied');
          if(label)label.textContent='تم النسخ';
          if(typeof window.toast==='function')window.toast('تم نسخ رقم التتبع');
          setTimeout(()=>{button.classList.remove('is-copied');if(label)label.textContent='نسخ'},1800);
        };
        box.replaceChildren();
        const success=document.createElement('section');success.className='alin-order-success';
        const icon=document.createElement('div');icon.className='alin-order-success__icon';icon.setAttribute('aria-hidden','true');icon.textContent='✓';
        const h=document.createElement('h2');h.textContent='تم استلام طلبك';
        const note=document.createElement('p');note.textContent='احتفظ برقم التتبع لمتابعة حالة طلبك.';
        const codes=document.createElement('div');codes.className='alin-order-success__codes';
        numbers.forEach(number=>{
          const row=document.createElement('div');row.className='alin-tracking-code';
          const code=document.createElement('b');code.dir='ltr';code.textContent=number;code.title='رقم التتبع';
          const copy=document.createElement('button');copy.type='button';copy.className='alin-copy-tracking';copy.setAttribute('aria-label',`نسخ رقم التتبع ${number}`);copy.title='نسخ رقم التتبع';
          copy.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2"></rect><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"></path></svg><span>نسخ</span>';
          copy.addEventListener('click',()=>copyTrackingCode(number,copy));
          code.addEventListener('click',()=>copyTrackingCode(number,copy));code.tabIndex=0;code.setAttribute('role','button');code.setAttribute('aria-label',`نسخ رقم التتبع ${number}`);
          code.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();copyTrackingCode(number,copy)}});
          row.append(code,copy);codes.append(row);
        });
        const close=document.createElement('button');close.type='button';close.className='alin-order-success__close';close.textContent='إغلاق';close.addEventListener('click',()=>window.closeCheckout?.());
        success.append(icon,h,note,codes,close);box.append(success);
        document.dispatchEvent(new CustomEvent('alin:order-created',{detail:{numbers,fulfillment:fulfillment.fulfillment_type||fulfillment.delivery_type||'',items:cartSnapshot}}));
      }
    }catch(e){alert(e?.message||'تعذر إنشاء الطلب')}
    finally{checkoutPending=false;if(button){button.disabled=false;button.removeAttribute('aria-busy');button.textContent=button.dataset.originalText||'تأكيد الطلب'}}
  }
  window.ALINAuth=Object.assign(window.ALINAuth||{},{secureCheckout});
  window.ALINCheckout=Object.freeze({normalizeCheckoutItems,normalizeFulfillment,secureCheckout});
})();

;
/* modules/core/backend-check.js */
// === core/backend-check.js ===
/* ALIN 2.0.1 — backend readiness diagnostics */
(function(){
  'use strict';
  async function checkBackendReadiness(){
    const result={ok:true,auth:false,accounts:false,orderRpc:false,issues:[]};
    try{
      const c=window.sb||(window.AlinCloud&&window.AlinCloud.client?.());
      if(!c){result.ok=false;result.issues.push('Supabase client unavailable');return result}
      result.auth=!!c.auth;
      const probe=await c.from('accounts').select('id',{head:true,count:'exact'}).limit(1);
      if(probe.error){result.ok=false;result.issues.push('accounts: '+probe.error.message)}else result.accounts=true;
      const rpc=await c.rpc('alin_create_store_orders_guarded',{p_items:[],p_customer:{name:'',phone:''},p_fulfillment:{},p_coupon_code:null,p_request_key:'00000000-0000-4000-8000-000000000000',p_device_id:'alin-readiness-device-0001'});
      if(!rpc.error){result.orderRpc=true}
      else{
        const text=String(rpc.error.message||'')+' '+String(rpc.error.code||'');
        if(/PGRST202|Could not find the function|schema cache/i.test(text)){
          result.ok=false;result.issues.push('alin_create_store_orders_guarded RPC missing');
        }else result.orderRpc=true;
      }
    }catch(error){result.ok=false;result.issues.push(error?.message||String(error))}
    window.__ALIN_BACKEND_STATUS__=result;
    return result;
  }
  window.AlinBackendCheck=checkBackendReadiness;
})();

;
/* modules/store/tracking.js */
// === store/tracking.js ===
/* ALIN v2.0.6 — secure public order tracking through RPC. */
(function(){
  'use strict';
  const labels={pending:'تم استلام الطلب',new:'تم استلام الطلب',payment_pending:'بانتظار التأكيد',processing:'قيد التجهيز',ready:'جاهز بالمكتبة',out_delivery:'خرج للتوصيل',completed:'تم التسليم',delivered:'تم التسليم',cancelled:'ملغي'};
  const steps=['pending','processing','ready','out_delivery','completed'];
  const clean=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  window.trackOrder=async function(){
    const input=document.getElementById('trackOrderInput');
    const box=document.getElementById('trackOrderResult');
    if(!box)return;
    const code=String(input?.value||'').trim();
    box.className='track-result show';
    if(code.length<6){box.textContent='اكتب رقم الطلب الكامل أولاً';return}
    box.textContent='جارٍ التحقق من حالة الطلب...';
    try{
      const c=window.sb||(window.AlinCloud&&window.AlinCloud.client?.());
      if(!c?.rpc)throw new Error('خدمة التتبع غير متاحة');
      const {data,error}=await c.rpc('alin_track_order',{p_order_number:code});
      if(error)throw error;
      if(!data?.found){box.textContent='لم يتم العثور على الطلب. تأكد من رقم التتبع.';return}
      const status=String(data.status||'new');
      const normalized=status==='delivered'?'completed':status;
      const reached=steps.indexOf(normalized);
      box.innerHTML=`<b>${clean(data.order_number)} — ${clean(data.title||'طلب منصة آلين')}</b>${data.ready_eta?`<br><small>الجاهزية المتوقعة: ${clean(data.ready_eta)}</small>`:''}<div class="timeline v31">${steps.map((step,index)=>`<span class="${index<=Math.max(0,reached)?'done':''}">${labels[step]}</span>`).join('')}</div>`;
      document.dispatchEvent(new CustomEvent('alin:tracking-rendered',{detail:{code,data,status:normalized}}));
    }catch(error){
      console.error('[ALIN tracking]',error);
      box.textContent='تعذر التحقق الآن. أعد المحاولة بعد قليل.';
    }
  };
})();

;
/* modules/core/cloud-status-ui.js */
// === core/cloud-status-ui.js ===
/* ALIN v2.4.2 — final boot verification for modular cloud services. */
(function(){
  'use strict';
  const required=['enabled','loginFromUI','signOut','restoreSession','secureCheckout','createAccountFromAdmin','updateAccountFromAdmin','resetPasswordFromAdmin'];
  const auth=window.ALINAuth||{};
  const missing=required.filter(name=>typeof auth[name]!=='function');
  if(missing.length)console.error('[ALIN cloud modules missing]',missing);
  else window.dispatchEvent(new CustomEvent('alin:cloud-services-ready',{detail:{services:required.slice()}}));
})();

;
/* store/mobile-navigation.js */
/* ALIN 2.0.1 - mobile navigation controller */

(function(){
  const byId=id=>document.getElementById(id);
  function showSheet(id){
    const backdrop=byId('alinSheetBackdrop');
    ['alinAccountSheet','alinTrackingSheet'].forEach(x=>{const el=byId(x); if(el) el.hidden=x!==id;});
    if(backdrop) backdrop.hidden=false;
    document.body.style.overflow='hidden';
  }
  window.alinOpenAccountSheet=()=>showSheet('alinAccountSheet');
  window.alinOpenTrackingSheet=()=>showSheet('alinTrackingSheet');
  window.alinCloseMobileSheets=function(){
    ['alinAccountSheet','alinTrackingSheet'].forEach(x=>{const el=byId(x);if(el)el.hidden=true;});
    const backdrop=byId('alinSheetBackdrop'); if(backdrop)backdrop.hidden=true;
    document.body.style.overflow='';
  };
  window.alinAccountAction=function(action){
    if(action==='login'||action==='signup'){
      alinCloseMobileSheets();
      if(typeof openStudentAuth==='function') openStudentAuth(action);
      else document.getElementById('studentAuthBtn')?.click();
      return;
    }
    if(action==='about'){
      alinCloseMobileSheets();
      document.getElementById('storeAbout')?.scrollIntoView({behavior:'smooth',block:'start'});
    }
  };
  window.alinSubmitMobileTracking=function(){
    const source=byId('alinMobileTrackingInput');
    const target=byId('trackOrderInput');
    const result=byId('alinMobileTrackingResult');
    if(!source?.value.trim()){if(result)result.innerHTML='<div class="notice">اكتب رقم الطلب أولاً.</div>';return;}
    if(target)target.value=source.value.trim();
    try{ if(typeof trackOrder==='function') trackOrder(); }catch(e){}
    setTimeout(()=>{
      const original=byId('trackOrderResult');
      if(result&&original) result.innerHTML=original.innerHTML||'<div class="notice">جاري البحث عن الطلب...</div>';
    },300);
  };
  document.addEventListener('keydown',e=>{if(e.key==='Escape')alinCloseMobileSheets();});
})();

;
/* store/notifications.js */
/* ALIN v2.2.6 — storefront notification center backed by AlinNotifications. */
(function(){
  'use strict';

  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[char]));
  const context=()=>({role:'student',id:''});
  const service=()=>window.AlinNotifications;
  const rows=()=>service()?.visible?.(context())||[];
  const unread=()=>service()?.unreadCount?.(context())||0;

  function badges(){
    const count=unread();
    document.querySelectorAll('.alin98-notify-count,.alin-v94-notify-count').forEach(badge=>{
      badge.textContent=count>99?'99+':String(count);
      badge.hidden=count===0;
    });
    document.querySelectorAll('[data-desktop-control="notifications"],.mobile-header-icon-btn[aria-label^="الإشعارات"]').forEach(button=>{
      button.classList.toggle('has-unread',count>0);
    });
  }

  function close(){
    document.getElementById('alinNotificationsV120')?.remove();
    document.body.classList.remove('alin-notifications-open');
  }

  function itemHtml(row){
    const read=service()?.isRead?.(row,context())??true;
    return `<article class="${read?'read':'unread'}" data-notification-id="${escapeHtml(row.id)}"><span class="alin-notifications-v120__dot"></span><div><div class="alin-notifications-v120__title"><h3>${escapeHtml(row.title||'إشعار')}</h3>${read?'':'<b>جديد</b>'}</div><p>${escapeHtml(row.message||row.text||'')}</p><time>${escapeHtml(new Date(row.created_at||Date.now()).toLocaleString(window.AlinI18n?.locale?.()||'ar-IQ'))}</time></div></article>`;
  }

  function open(){
    close();
    const box=document.createElement('div');
    box.id='alinNotificationsV120';
    box.className='alin-notifications-v120';
    const list=rows();
    box.innerHTML=`<button class="alin-notifications-v120__backdrop" type="button" aria-label="إغلاق"></button><section class="alin-notifications-v120__panel" role="dialog" aria-modal="true"><header><div><h2>الإشعارات</h2><p>${unread()?unread()+' إشعار جديد':'لا توجد إشعارات جديدة'}</p></div><div><button type="button" data-read-all>قراءة الكل</button><button type="button" data-close aria-label="إغلاق">×</button></div></header><div class="alin-notifications-v120__list">${list.map(itemHtml).join('')||'<div class="alin-notifications-v120__empty"><span>🔕</span><b>لا توجد إشعارات حالياً</b><p>إشعارات الإدارة الجديدة ستظهر هنا.</p></div>'}</div></section>`;
    document.body.appendChild(box);
    document.body.classList.add('alin-notifications-open');
    box.querySelector('[data-close]')?.addEventListener('click',close);
    box.querySelector('.alin-notifications-v120__backdrop')?.addEventListener('click',close);
    box.querySelector('[data-read-all]')?.addEventListener('click',async()=>{await service()?.markAll?.(context());open()});
    box.querySelectorAll('[data-notification-id]').forEach(item=>item.addEventListener('click',async()=>{
      await service()?.markRead?.(item.dataset.notificationId,context());
      open();
    }));
  }

  async function refresh(){
    await service()?.refresh?.();
    badges();
  }

  function install(){
    document.querySelectorAll('[data-desktop-control="notifications"],.mobile-header-icon-btn[aria-label^="الإشعارات"]').forEach(button=>{
      button.removeAttribute('onclick');
      if(button.dataset.alinNotificationsBound==='1')return;
      button.dataset.alinNotificationsBound='1';
      button.addEventListener('click',event=>{event.preventDefault();open()});
    });
    document.addEventListener('keydown',event=>{if(event.key==='Escape')close()});
    window.addEventListener('alin:notifications-updated',badges);
    window.addEventListener('alin:store-rendered',badges);
    refresh();
  }

  const api=Object.freeze({open,close,refresh,badges,rows});
  window.AlinStoreNotifications=api;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();

;
/* options.js */
/* ALIN 2.0.1 - account, language, and appearance options */
(function () {
  'use strict';

  const LANG_KEY = 'alin_language_v110';
  const THEME_KEY = 'alin_theme_v234';
  const LEGACY_THEME_KEY = 'alin_theme_v110';
  const validLanguages = ['ar', 'ku', 'en'];
  const validThemes = ['light', 'dark'];
  let lastFocus = null;

  const copy = {
    ar: {
      options: 'الخيارات', subtitle: 'حسابك، اللغة ومظهر المنصة', account: 'حسابي',
      guest: 'غير مسجّل الدخول', signed: 'مسجّل باسم', accountHelp: 'تسجيل الدخول وإدارة حساب الطالب',
      local: 'بيانات حساب الطالب محفوظة على هذا الجهاز ما لم تُزامنها المنصة.',
      preferences: 'التفضيلات', language: 'اللغة', appearance: 'المظهر',
      light: 'نهاري', dark: 'ليلي', system: 'النظام', help: 'المساعدة',
      contact: 'تواصل معنا', about: 'عن منصة آلين', close: 'إغلاق',
      privacy: 'تُحفظ تفضيلات اللغة والمظهر على هذا الجهاز.',
      whatsapp: 'واتساب', phone: 'اتصال هاتفي', noPhone: 'رقم التواصل غير مضاف حاليًا. يرجى مراجعة إدارة المنصة.',
      contactTitle: 'تواصل مع آلين', search: 'ابحث عن ملزمة، مادة، مدرس أو منتج',
      cart: 'السلة', favorites: 'المفضلة', notifications: 'الإشعارات', exit: 'خروج',
      statusLanguage: 'تم تغيير اللغة', statusTheme: 'تم تغيير المظهر',
      brandSub:'ملازم • قرطاسية • هدايا',filter:'فلترة',login:'تسجيل الدخول',optional:'التسجيل اختياري',
      heroBadge:'منصة الطالب',heroTitle:'كل ما تحتاجه للدراسة<br>بمكان واحد',heroText:'اختر ملزمتك أو قرطاسيتك واطلبها بسهولة.',browse:'تصفح المتجر',trackOrder:'تتبع الطلب',
      booklet:'ملازم',bookletSub:'جميع المواد والمراحل',stationery:'قرطاسية',stationerySub:'أدوات الدراسة والكتب',gifts:'هدايا',giftsSub:'هدايا راقية ومميزة',deals:'عروض',dealsSub:'خصومات وعروض حصرية',
      catalog:'الكتالوج الكامل',allProducts:'كل المنتجات',showAll:'عرض الكل',trackTitle:'تتبع حالة الطلب',trackText:'اكتب رقم الطلب لمعرفة هل هو قيد التجهيز، جاهز بالمكتبة، أو تم التسليم.',trackPlaceholder:'مثال: ALIN-0001 أو رقم الطلب',track:'تتبع',
      available:'ملزمة متاحة',completed:'طلب مكتمل',teachers:'مدرس',libraries:'مكتبة',aboutTitle:'عن المنصة',aboutText:'منصة آلين تجمع الملازم والقرطاسية والهدايا في مكان واحد، مع طلب سريع وتواصل واضح بين الطالب والمكتبة والإدارة.',contactText:'للاستفسار أو الانضمام كمدرس أو مكتبة، تواصل مع إدارة منصة آلين.',partner:'بوابات الشركاء:',teacher:'المدرس',library:'المكتبة',admin:'الإدارة',footer:'منصة آلين للتصميم والملازم والقرطاسية'
    },
    ku: {
      options: 'هەڵبژاردەکان', subtitle: 'هەژمار، زمان و ڕووکار', account: 'هەژمارەکەم',
      guest: 'چوونەژوورەوە نەکراوە', signed: 'چوونەژوورەوە بە ناوی', accountHelp: 'چوونەژوورەوە و بەڕێوەبردنی هەژماری خوێندکار',
      local: 'زانیاری هەژمار لەم ئامێرەدا هەڵدەگیرێت، مەگەر پلاتفۆرمەکە هاوکاتی بکات.',
      preferences: 'هەڵبژاردەکان', language: 'زمان', appearance: 'ڕووکار',
      light: 'ڕووناک', dark: 'تاریک', system: 'سیستەم', help: 'یارمەتی',
      contact: 'پەیوەندیمان پێوە بکە', about: 'دەربارەی ئالین', close: 'داخستن',
      privacy: 'زمان و ڕووکار لەم ئامێرەدا هەڵدەگیرێن.',
      whatsapp: 'واتساپ', phone: 'پەیوەندی تەلەفۆنی', noPhone: 'ژمارەی پەیوەندی زیاد نەکراوە.',
      contactTitle: 'پەیوەندی بە ئالین', search: 'بگەڕێ بۆ ملزمە، وانە، مامۆستا یان بەرهەم',
      cart: 'سەبەتە', favorites: 'دڵخوازەکان', notifications: 'ئاگادارکردنەوە', exit: 'دەرچوون',
      statusLanguage: 'زمان گۆڕدرا', statusTheme: 'ڕووکار گۆڕدرا',
      brandSub:'ملزمە • کەرەستەی خوێندن • دیاری',filter:'پاڵاوتن',login:'چوونەژوورەوە',optional:'تۆمارکردن ئارەزوومەندانەیە',
      heroBadge:'پلاتفۆرمی خوێندکار',heroTitle:'هەموو ئەوەی بۆ خوێندن پێویستتە<br>لە یەک شوێن',heroText:'ملزمە یان کەرەستەی خوێندنت هەڵبژێرە و بە ئاسانی داوای بکە.',browse:'گەڕان بە فرۆشگا',trackOrder:'بەدواداچوونی داواکاری',
      booklet:'ملزمە',bookletSub:'هەموو وانە و قۆناغەکان',stationery:'کەرەستەی خوێندن',stationerySub:'کەرەستە و کتێب',gifts:'دیاری',giftsSub:'دیاری تایبەت و جوان',deals:'داشکاندن',dealsSub:'داشکاندن و ئۆفەری تایبەت',
      catalog:'کەتەلۆگی تەواو',allProducts:'هەموو بەرهەمەکان',showAll:'هەمووی پیشان بدە',trackTitle:'بەدواداچوونی دۆخی داواکاری',trackText:'ژمارەی داواکاری بنووسە بۆ زانینی دۆخەکەی.',trackPlaceholder:'نموونە: ALIN-0001 یان ژمارەی داواکاری',track:'بەدواداچوون',
      available:'ملزمەی بەردەست',completed:'داواکاری تەواو',teachers:'مامۆستا',libraries:'کتێبخانە',aboutTitle:'دەربارەی پلاتفۆرم',aboutText:'ئالین ملزمە و کەرەستەی خوێندن و دیاری لە یەک شوێن کۆدەکاتەوە.',contactText:'بۆ پرسیار یان بەشداریکردن وەک مامۆستا یان کتێبخانە، پەیوەندیمان پێوە بکە.',partner:'دەروازەی هاوبەشەکان:',teacher:'مامۆستا',library:'کتێبخانە',admin:'بەڕێوەبەرایەتی',footer:'پلاتفۆرمی ئالین بۆ دیزاین و ملزمە و کەرەستەی خوێندن'
    },
    en: {
      options: 'Options', subtitle: 'Your account, language and appearance', account: 'My account',
      guest: 'Not signed in', signed: 'Signed in as', accountHelp: 'Sign in and manage your student account',
      local: 'Student account data is stored on this device unless the platform syncs it.',
      preferences: 'Preferences', language: 'Language', appearance: 'Appearance',
      light: 'Light', dark: 'Dark', system: 'System', help: 'Help',
      contact: 'Contact us', about: 'About Alin', close: 'Close',
      privacy: 'Language and appearance preferences are saved on this device.',
      whatsapp: 'WhatsApp', phone: 'Phone call', noPhone: 'No contact number is configured. Please check with the platform administration.',
      contactTitle: 'Contact Alin', search: 'Search booklets, subjects, teachers or products',
      cart: 'Cart', favorites: 'Favorites', notifications: 'Notifications', exit: 'Exit',
      statusLanguage: 'Language changed', statusTheme: 'Appearance changed',
      brandSub:'Booklets • Stationery • Gifts',filter:'Filter',login:'Sign in',optional:'Registration is optional',
      heroBadge:'Student platform',heroTitle:'Everything you need to study<br>in one place',heroText:'Choose your booklets or stationery and order with ease.',browse:'Browse store',trackOrder:'Track order',
      booklet:'Booklets',bookletSub:'All subjects and stages',stationery:'Stationery',stationerySub:'Study tools and books',gifts:'Gifts',giftsSub:'Thoughtful premium gifts',deals:'Offers',dealsSub:'Exclusive discounts and offers',
      catalog:'Full catalog',allProducts:'All products',showAll:'Show all',trackTitle:'Track your order',trackText:'Enter the order number to see whether it is being prepared, ready at the library, or delivered.',trackPlaceholder:'Example: ALIN-0001 or order number',track:'Track',
      available:'Booklets available',completed:'Orders completed',teachers:'Teachers',libraries:'Libraries',aboutTitle:'About the platform',aboutText:'Alin brings booklets, stationery and gifts together with quick ordering and clear communication.',contactText:'For support or to join as a teacher or library, contact the Alin team.',partner:'Partner portals:',teacher:'Teacher',library:'Library',admin:'Administration',footer:'Alin platform for design, booklets and stationery'
    }
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const language = () => validLanguages.includes(localStorage.getItem(LANG_KEY)) ? localStorage.getItem(LANG_KEY) : 'ar';
  const themeMode = () => validThemes.includes(localStorage.getItem(THEME_KEY)) ? localStorage.getItem(THEME_KEY) : 'light';
  const resolvedTheme = mode => mode === 'dark' ? 'dark' : 'light';
  const text = (selector, value) => { const el = $(selector); if (el) el.textContent = value; };
  const escapeHtml = value => String(value??'').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

  function student() {
    try { return typeof window.currentStudent === 'function' ? window.currentStudent() : null; } catch (_) { return null; }
  }

  function accountName(value) {
    return value && (value.name || value.full_name || value.student_name || value.username || value.phone);
  }

  function icon(name) {
    const paths = {
      account: '<circle cx="12" cy="8" r="3.4"/><path d="M5 20c.6-4.2 2.9-6.2 7-6.2s6.4 2 7 6.2"/>',
      globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.4 3 14.6 0 18M12 3c-3 3.4-3 14.6 0 18"/>',
      theme: '<path d="M20 15.3A8.5 8.5 0 0 1 8.7 4a8.5 8.5 0 1 0 11.3 11.3Z"/>',
      contact: '<path d="M4 5.5h16v11H9l-5 3v-14Z"/><path d="M8 10h8M8 13h5"/>',
      about: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.3v.2"/>'
    };
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name]}</svg>`;
  }

  function optionsContent() {
    return `<div class="alin-options-sections">
      <button class="alin-account-card" type="button" data-alin-account>
        <span class="alin-option-icon">${icon('account')}</span>
        <span class="alin-account-copy"><b data-copy="account"></b><small data-account-status></small><em data-copy="accountHelp"></em></span>
        <span class="alin-option-chevron" aria-hidden="true">‹</span>
      </button>
      <p class="alin-local-note" data-copy="local"></p>
      <section class="alin-settings-section" aria-labelledby="alinPreferencesLabel">
        <h3 id="alinPreferencesLabel" data-copy="preferences"></h3>
        <div class="alin-setting-row"><span class="alin-option-icon">${icon('globe')}</span><div><b data-copy="language"></b>
          <div class="alin-segment" role="group" aria-label="Language">
            <button type="button" data-lang="ar">العربية</button><button type="button" data-lang="ku">کوردی</button><button type="button" data-lang="en">English</button>
          </div></div></div>
        <div class="alin-setting-row"><span class="alin-option-icon">${icon('theme')}</span><div><b data-copy="appearance"></b>
          <div class="alin-segment" role="group" aria-label="Theme">
            <button type="button" data-theme="light" data-copy="light"></button><button type="button" data-theme="dark" data-copy="dark"></button>
          </div></div></div>
      </section>
      <section class="alin-settings-section"><h3 data-copy="help"></h3>
        <button class="alin-help-row" type="button" data-alin-contact><span class="alin-option-icon">${icon('contact')}</span><b data-copy="contact"></b><span aria-hidden="true">‹</span></button>
        <button class="alin-help-row" type="button" data-alin-about><span class="alin-option-icon">${icon('about')}</span><b data-copy="about"></b><span aria-hidden="true">‹</span></button>
      </section>
      <p class="alin-privacy-note" data-copy="privacy"></p>
      <div class="alin-options-status" role="status" aria-live="polite"></div>
    </div>`;
  }

  function installUI() {
    const mobileSheet = $('#alinAccountSheet');
    if (mobileSheet) {
      mobileSheet.innerHTML = `<div class="alin-sheet-handle"></div><div class="alin-sheet-head"><div><h2 data-copy="options"></h2><p data-copy="subtitle"></p></div><button type="button" data-alin-close aria-label="إغلاق">×</button></div>${optionsContent()}`;
      mobileSheet.setAttribute('aria-labelledby', 'alinMobileOptionsTitle');
      $('[data-copy="options"]', mobileSheet).id = 'alinMobileOptionsTitle';
    }

    if (!$('.alin-desktop-options-button')) {
      const actions = $('.desktop-store-actions');
      if (actions) {
        const button = document.createElement('button');
        button.className = 'desktop-action alin-desktop-options-button';
        button.type = 'button';
        button.setAttribute('aria-label', 'الخيارات');
        button.innerHTML = `<span class="alin-desktop-options-icon" aria-hidden="true"></span><small data-copy="options">الخيارات</small>`;
        actions.prepend(button);
      }
    }

    if (!$('#alinOptionsDialog')) {
      document.body.insertAdjacentHTML('beforeend', `<div class="alin-options-backdrop" data-alin-backdrop hidden></div>
        <section class="alin-options-dialog" id="alinOptionsDialog" role="dialog" aria-modal="true" aria-labelledby="alinOptionsTitle" hidden>
          <header><div><h2 id="alinOptionsTitle" data-copy="options"></h2><p data-copy="subtitle"></p></div><button type="button" data-alin-close aria-label="إغلاق">×</button></header>
          ${optionsContent()}
        </section>
        <section class="alin-contact-dialog" id="alinContactDialog" role="dialog" aria-modal="true" aria-labelledby="alinContactTitle" hidden>
          <header><h2 id="alinContactTitle" data-copy="contactTitle"></h2><button type="button" data-contact-close aria-label="إغلاق">×</button></header>
          <div data-contact-content></div>
        </section>
        <section class="alin-contact-dialog alin-about-dialog" id="alinAboutDialog" role="dialog" aria-modal="true" aria-labelledby="alinAboutTitle" hidden>
          <header><h2 id="alinAboutTitle" data-copy="about"></h2><button type="button" data-about-close aria-label="إغلاق">×</button></header>
          <div data-about-content></div>
        </section>`);
    }
    bindUI();
  }

  function bindUI() {
    $('.alin-desktop-options-button')?.addEventListener('click', openOptions);
    $$('[data-alin-close]').forEach(el => el.addEventListener('click', closeOptions));
    $('[data-alin-backdrop]')?.addEventListener('click', () => {
      if (!$('#alinContactDialog')?.hidden) closeContact();
      else if (!$('#alinAboutDialog')?.hidden) closeAbout();
      else closeOptions();
    });
    $$('[data-alin-account]').forEach(el => el.addEventListener('click', openAccount));
    $$('[data-alin-contact]').forEach(el => el.addEventListener('click', openContact));
    $$('[data-alin-about]').forEach(el => el.addEventListener('click', openAbout));
    $$('[data-lang]').forEach(el => el.addEventListener('click', () => applyLanguage(el.dataset.lang, true)));
    $$('[data-theme]').forEach(el => el.addEventListener('click', () => applyTheme(el.dataset.theme, true)));
    $$('[data-contact-close]').forEach(el => el.addEventListener('click', closeContact));
    $$('[data-about-close]').forEach(el => el.addEventListener('click', closeAbout));
  }

  function announce(message) {
    $$('.alin-options-status').forEach(el => {
      el.textContent = message;
      clearTimeout(el._timer);
      el._timer = setTimeout(() => { el.textContent = ''; }, 1800);
    });
  }

  function applyLanguage(code, notify) {
    if (!validLanguages.includes(code)) code = 'ar';
    localStorage.setItem(LANG_KEY, code);
    document.documentElement.lang = code === 'ku' ? 'ckb' : code;
    document.documentElement.dir = code === 'en' ? 'ltr' : 'rtl';
    const t = copy[code];
    $$('[data-copy]').forEach(el => { const value = t[el.dataset.copy]; if (value) el.textContent = value; });
    $$('[data-lang]').forEach(el => {
      const active = el.dataset.lang === code;
      el.classList.toggle('active', active); el.setAttribute('aria-pressed', String(active));
    });
    const s = student(), name = accountName(s);
    $$('[data-account-status]').forEach(el => { el.textContent = name ? `${t.signed} ${name}` : t.guest; });
    const search = $('#searchInput'); if (search) search.placeholder = t.search;
    text('[data-desktop-control="cart"] small', t.cart);
    text('[data-desktop-control="favorites"] small', t.favorites);
    text('[data-desktop-control="notifications"] small', t.notifications);
    text('[data-desktop-control="exit"] small', t.exit);
    text('[data-mobile-control="cart"] small', t.cart);
    text('[data-mobile-control="favorites"] small', t.favorites);
    const shell = [
      ['.alin98-brand small','brandSub'],['[data-desktop-control="filter"] small','filter'],
      ['[data-desktop-control="account"] small','login'],['#studentAuthStatus','optional'],
      ['[data-v99-category="booklet"] strong','booklet'],['[data-v99-category="booklet"] small','bookletSub'],
      ['[data-v99-category="stationery"] strong','stationery'],['[data-v99-category="stationery"] small','stationerySub'],
      ['[data-v99-category="gift"] strong','gifts'],['[data-v99-category="gift"] small','giftsSub'],
      ['[data-v99-category="deal"] strong','deals'],['[data-v99-category="deal"] small','dealsSub'],
      ['#v99CatalogKicker','catalog'],['#v99CatalogTitle','allProducts'],['[data-v99-action="clearDesktopCategory"]','showAll'],
      ['#orderTrackBox h2','trackTitle'],['#orderTrackBox p','trackText'],['#orderTrackBox button','track'],
      ['#storeAbout>div:nth-child(1) small','available'],
      ['#storeAbout>div:nth-child(2) small','teachers'],['#storeAbout>div:nth-child(3) small','libraries'],
      ['.desktop-partner-access>span','partner'],['.desktop-partner-access button:nth-of-type(1)','teacher'],['.desktop-partner-access button:nth-of-type(2)','library'],['.desktop-partner-access button:nth-of-type(3)','admin'],['.alin-footer','footer']
    ];
    shell.forEach(([selector,key,html]) => $$(selector).forEach(el => { if (html) el.innerHTML=t[key]; else el.textContent=t[key]; }));
    const trackInput=$('#orderTrackInput'); if(trackInput) trackInput.placeholder=t.trackPlaceholder;
    if (notify) announce(t.statusLanguage);
    window.dispatchEvent(new CustomEvent('alin:language-changed', { detail: { language: code } }));
  }

  function applyTheme(mode, notify) {
    if (!validThemes.includes(mode)) mode = 'light';
    localStorage.setItem(THEME_KEY, mode);
    const resolved = resolvedTheme(mode);
    document.documentElement.dataset.alinTheme = resolved;
    document.documentElement.dataset.alinThemeMode = mode;
    $$('[data-theme]').forEach(el => {
      const active = el.dataset.theme === mode;
      el.classList.toggle('active', active); el.setAttribute('aria-pressed', String(active));
    });
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.content = resolved === 'dark' ? '#07182b' : '#f8f3e8';
    if (notify) announce(copy[language()].statusTheme);
    window.dispatchEvent(new CustomEvent('alin:theme-changed', { detail: { theme: mode, resolved } }));
  }

  function openOptions() {
    lastFocus = document.activeElement;
    const dialog = $('#alinOptionsDialog'), backdrop = $('[data-alin-backdrop]');
    if (!dialog) return;
    dialog.hidden = false; backdrop.hidden = false;
    document.body.classList.add('alin-options-open');
    setInert(dialog);
    updateAccount();
    requestAnimationFrame(() => $('[data-alin-close]', dialog)?.focus());
  }

  function closeOptions() {
    const dialog = $('#alinOptionsDialog'), backdrop = $('[data-alin-backdrop]');
    if (dialog) dialog.hidden = true;
    if (backdrop) backdrop.hidden = true;
    document.body.classList.remove('alin-options-open');
    clearInert();
    if ($('#alinAccountSheet') && !$('#alinAccountSheet').hidden && typeof window.alinCloseMobileSheets === 'function') window.alinCloseMobileSheets();
    lastFocus?.focus?.();
  }

  function updateAccount() { applyLanguage(language(), false); }

  function openAccount() {
    closeOptions();
    const s = student();
    if (typeof window.openStudentAuth === 'function') window.openStudentAuth(s ? 'profile' : 'login');
    else if (s && typeof window.showStudentAccount === 'function') window.showStudentAccount();
  }

  function getPhone() {
    try { return String(window.db?.settings?.whatsapp || window.db?.settings?.platform_phone || window.db?.settings?.contact_phone || '').trim(); }
    catch (_) { return ''; }
  }

  function whatsappNumber(phone) {
    let digits = phone.replace(/\D/g, '');
    if (digits.startsWith('00')) digits = digits.slice(2);
    if (digits.startsWith('0')) digits = `964${digits.slice(1)}`;
    if (!digits.startsWith('964') && digits.length === 10) digits = `964${digits}`;
    return digits;
  }

  function openContact() {
    const desktop=$('#alinOptionsDialog'), mobile=$('#alinAccountSheet');
    if (desktop && !desktop.hidden) desktop.hidden=true;
    if (mobile && !mobile.hidden) mobile.hidden=true;
    clearInert();
    const dialog = $('#alinContactDialog'), content = $('[data-contact-content]', dialog);
    const phone = getPhone(), t = copy[language()];
    if (!phone) content.innerHTML = `<p class="alin-contact-empty">${t.noPhone}</p>`;
    else {
      const wa = whatsappNumber(phone);
      content.innerHTML = `<p class="alin-contact-number" dir="ltr">${phone}</p><div class="alin-contact-actions">
        <a href="https://wa.me/${wa}" target="_blank" rel="noopener">${t.whatsapp}</a>
        <a href="tel:${phone.replace(/[^\d+]/g, '')}">${t.phone}</a></div>`;
    }
    dialog.hidden = false;
    $('[data-alin-backdrop]').hidden = false;
    setInert(dialog);
    requestAnimationFrame(() => $('[data-contact-close]', dialog)?.focus());
  }

  function closeContact() {
    $('#alinContactDialog').hidden = true;
    $('[data-alin-backdrop]').hidden = true;
    clearInert();
    lastFocus?.focus?.();
  }

  function openAbout() {
    const desktop=$('#alinOptionsDialog'), mobile=$('#alinAccountSheet');
    if (desktop && !desktop.hidden) desktop.hidden=true;
    if (mobile && !mobile.hidden) mobile.hidden=true;
    document.body.classList.remove('alin-options-open');
    clearInert();
    const dialog=$('#alinAboutDialog'), content=$('[data-about-content]',dialog), t=copy[language()];
    if(!dialog||!content)return;
    const settings=window.db?.settings||{};
    const title=String(settings.about_title||t.about||t.aboutTitle||'عن منصة آلين');
    const description=String(settings.about_text||t.aboutText||'منصة آلين تجمع الملازم والقرطاسية والهدايا في مكان واحد.');
    $('#alinAboutTitle').textContent=title;
    content.innerHTML=`<div class="alin-about-content"><div class="alin-about-mark" aria-hidden="true">آ</div><p>${escapeHtml(description)}</p></div>`;
    dialog.hidden=false;
    $('[data-alin-backdrop]').hidden=false;
    setInert(dialog);
    requestAnimationFrame(()=>$('[data-about-close]',dialog)?.focus());
  }

  function closeAbout() {
    const dialog=$('#alinAboutDialog');
    if(dialog)dialog.hidden=true;
    $('[data-alin-backdrop]').hidden=true;
    clearInert();
    lastFocus?.focus?.();
  }

  function trapKey(event) {
    if (event.key === 'Escape') {
      if (!$('#alinContactDialog')?.hidden) closeContact();
      else if (!$('#alinAboutDialog')?.hidden) closeAbout();
      else closeOptions();
      return;
    }
    const dialog = !$('#alinContactDialog')?.hidden ? $('#alinContactDialog') : (!$('#alinAboutDialog')?.hidden ? $('#alinAboutDialog') : (!$('#alinOptionsDialog')?.hidden ? $('#alinOptionsDialog') : (!$('#alinAccountSheet')?.hidden ? $('#alinAccountSheet') : null)));
    if (!dialog || event.key !== 'Tab') return;
    const focusable = $$('button:not([disabled]),a[href],input:not([disabled])', dialog);
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  window.alinSetLanguage = code => applyLanguage(code, true);
  window.alinSetTheme = mode => applyTheme(mode, true);
  window.alinOpenRealAccount = openAccount;
  window.alinContactUs = openContact;
  window.alinAboutPlatform = openAbout;

  function setInert(activeDialog) {
    Array.from(document.body.children).forEach(el => {
      if (el === activeDialog || el === $('[data-alin-backdrop]') || el.contains(activeDialog)) return;
      el.inert = true; el.dataset.alinInert = 'true';
    });
  }
  function clearInert() {
    $$('[data-alin-inert="true"]').forEach(el => { el.inert=false; delete el.dataset.alinInert; });
  }
  function mobileSheetChanged() {
    const sheet=$('#alinAccountSheet');
    if (!sheet) return;
    if (!sheet.hidden) {
      if (!lastFocus || !document.contains(lastFocus)) lastFocus=$('[data-mobile-control="account"]');
      setInert(sheet);
      requestAnimationFrame(() => $('[data-alin-close]',sheet)?.focus());
    } else {
      if (!$('#alinContactDialog')?.hidden || !$('#alinAboutDialog')?.hidden) return;
      clearInert();
      lastFocus?.focus?.();
    }
  }

  document.addEventListener('keydown', trapKey);
  document.addEventListener('DOMContentLoaded', () => {
    try { localStorage.removeItem(LEGACY_THEME_KEY); } catch (_) {}
    installUI();
    const mobileTrigger=$('[data-mobile-control="account"]');
    mobileTrigger?.addEventListener('click', () => { lastFocus=mobileTrigger; setTimeout(mobileSheetChanged,0); }, true);
    const mobileSheet=$('#alinAccountSheet');
    if(mobileSheet) new MutationObserver(mobileSheetChanged).observe(mobileSheet,{attributes:true,attributeFilter:['hidden']});
    applyTheme(themeMode(), false);
    applyLanguage(language(), false);
  });
})();

;
/* core/pwa-register.js */
/* ALIN v2.4.2 — silent PWA updater for animated store entry. */
(function(){
  'use strict';
  try{localStorage.removeItem('alin_v121_accountant_pass');localStorage.removeItem('alin_v121_accountant_user')}catch(_){ }
  if(!('serviceWorker' in navigator))return;
  if(!/^https?:$/.test(location.protocol))return;

  window.addEventListener('load',async()=>{
    try{
      const registration=await navigator.serviceWorker.register('./service-worker.js?v=3.0.1',{scope:'./',updateViaCache:'none'});
      registration.addEventListener('updatefound',()=>{
        const worker=registration.installing;
        if(!worker)return;
        worker.addEventListener('statechange',()=>{
          if(worker.state==='installed'&&navigator.serviceWorker.controller){
            worker.postMessage({type:'SKIP_WAITING'});
          }
        });
      });
      if(registration.waiting)registration.waiting.postMessage({type:'SKIP_WAITING'});
      registration.update().catch(()=>{});
    }catch(error){console.warn('[ALIN PWA]',error)}
  },{once:true});
})();

;
/* core/v2-runtime.js */
(()=>{
  'use strict';
  window.addEventListener('error',e=>console.error('[ALIN v2 runtime]',e.error||e.message));
  window.addEventListener('unhandledrejection',e=>console.error('[ALIN v2 promise]',e.reason));
})();

;
