// Alin mobile app bundle

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

// === teacher/finance.js ===
/* ===== teacher/js/finance.js ===== */
/* V111: actual teacher code moved from core/js/platform-legacy.js */
window.AlinTeacherModules=window.AlinTeacherModules||{};
function teacherAccountPaid(id){ return (db.teacherPayouts||[]).filter(x=>x.teacher_id===id && x.status==='paid').reduce((a,x)=>a+(+x.amount||0),0) + (db.withdrawals||[]).filter(x=>x.role==='teacher'&&x.account_id===id&&x.status==='paid').reduce((a,x)=>a+(+x.amount||0),0); }

function printTeacherStatement(){
  const {teacher,ledger}=teacherData();
  const from=tFrom.value, to=tTo.value;
  const rows=ledger.filter(x=>(!from||(x.created_at||'').slice(0,10)>=from)&&(!to||(x.created_at||'').slice(0,10)<=to));
  checkoutBox.innerHTML=`<div class="receipt"><h2>كشف حساب المدرس</h2><p>${esc(teacher.name||current.name)}</p>${rows.map(x=>`<div class="receipt-line"><b>${esc(x.order_id)}</b><span>${money(x.teacher)} د.ع</span></div>`).join('')}<h3>المجموع: ${money(rows.reduce((a,x)=>a+(+x.teacher||0),0))} د.ع</h3></div><div class="row-actions no-print"><button onclick="window.print()">طباعة</button><button class="secondary" onclick="closeCheckout()">إغلاق</button></div>`;
  checkoutModal.classList.remove('hidden');
}

function addTeacherPayoutPrompt(teacherId){
  const amount=+(prompt('مبلغ الدفع للمدرس')||0); if(amount<=0)return;
  insert('teacher_payouts',{id:uid('TP'),teacher_id:teacherId,amount,note:'تسديد من الإدارة',status:'paid'}).then(load);
}

function alinV67SumTeacherBalances(){
  return (db.accounts?.teachers||[]).reduce((a,t)=>a+(+alinV65Balance('teacher',t.id).remaining||0),0);
}
window.AlinTeacherModules['teacherAccountPaid']=typeof teacherAccountPaid==='function'?teacherAccountPaid:window['teacherAccountPaid'];window['teacherAccountPaid']=window.AlinTeacherModules['teacherAccountPaid'];
window.AlinTeacherModules['printTeacherStatement']=typeof printTeacherStatement==='function'?printTeacherStatement:window['printTeacherStatement'];window['printTeacherStatement']=window.AlinTeacherModules['printTeacherStatement'];
window.AlinTeacherModules['addTeacherPayoutPrompt']=typeof addTeacherPayoutPrompt==='function'?addTeacherPayoutPrompt:window['addTeacherPayoutPrompt'];window['addTeacherPayoutPrompt']=window.AlinTeacherModules['addTeacherPayoutPrompt'];
window.AlinTeacherModules['alinV67SumTeacherBalances']=typeof alinV67SumTeacherBalances==='function'?alinV67SumTeacherBalances:window['alinV67SumTeacherBalances'];window['alinV67SumTeacherBalances']=window.AlinTeacherModules['alinV67SumTeacherBalances'];

/* ===== teacher/js/teacher-sales-finance-v154.js ===== */
/* V154 — dedicated teacher sales and finance views */
(function(){
  const escSafe=v=>typeof esc==='function'?esc(v):String(v??'');
  const moneySafe=v=>typeof money==='function'?money(v):Number(v||0).toLocaleString('ar-IQ');
  const dateOnly=v=>String(v||'').slice(0,10)||'-';
  const completed=new Set(['delivered','completed','done','received']);
  const cancelled=new Set(['cancelled','canceled','rejected']);
  function statusText(s){s=String(s||'new').toLowerCase();return ({new:'جديد',pending:'قيد الانتظار',processing:'قيد التجهيز',printing:'قيد الطباعة',ready:'جاهز',delivered:'تم التسليم',completed:'مكتمل',done:'مكتمل',cancelled:'ملغي',canceled:'ملغي'}[s]||s)}
  function statusClass(s){s=String(s||'').toLowerCase();return completed.has(s)?'done':cancelled.has(s)?'cancelled':'active'}
  function data(){
    const id=window.current?.role==='teacher'?current.id:'';
    const teacher=(window.db?.accounts?.teachers||[]).find(x=>String(x.id)===String(id))||{};
    const books=(window.db?.booklets||[]).filter(x=>String(x.teacher_id)===String(id));
    const ids=new Set(books.map(x=>String(x.id)));
    const orders=(window.db?.orders||[]).filter(x=>x.kind==='booklet'&&ids.has(String(x.item_id)));
    const ledger=(window.db?.ledger||[]).filter(x=>String(x.teacher_id)===String(id));
    const payouts=[...(window.db?.teacherPayouts||[]).filter(x=>String(x.teacher_id)===String(id)),...(window.db?.withdrawals||[]).filter(x=>x.role==='teacher'&&String(x.account_id)===String(id))];
    return {id,teacher,books,orders,ledger,payouts};
  }
  function paidAmount(d){return d.payouts.filter(x=>String(x.status||'').toLowerCase()==='paid').reduce((a,x)=>a+(+x.amount||0),0)}
  function orderFiltersHtml(d){
    const libs=[...new Set(d.orders.map(o=>o.library_id).filter(Boolean))];
    return `<div class="teacher-v154-tools"><input id="tv154OrderSearch" placeholder="ابحث برقم الطلب أو اسم الملزمة" oninput="teacherV154FilterOrders()"><select id="tv154OrderStatus" onchange="teacherV154FilterOrders()"><option value="">كل الحالات</option><option value="active">قيد التنفيذ</option><option value="done">مكتمل</option><option value="cancelled">ملغي</option></select><select id="tv154OrderLibrary" onchange="teacherV154FilterOrders()"><option value="">كل المكتبات</option>${libs.map(id=>{const l=(db.accounts?.libraries||[]).find(x=>String(x.id)===String(id));return `<option value="${escSafe(id)}">${escSafe(l?.name||id)}</option>`}).join('')}</select><select id="tv154OrderPeriod" onchange="teacherV154FilterOrders()"><option value="">كل الفترات</option><option value="today">اليوم</option><option value="month">هذا الشهر</option></select></div>`
  }
  function renderOrders(){
    const d=data(),today=new Date().toISOString().slice(0,10),month=today.slice(0,7);
    const totalQty=d.orders.reduce((a,o)=>a+(+o.qty||0),0),done=d.orders.filter(o=>completed.has(String(o.status||'').toLowerCase())),active=d.orders.filter(o=>!completed.has(String(o.status||'').toLowerCase())&&!cancelled.has(String(o.status||'').toLowerCase()));
    const cards=d.orders.slice().sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))).map(o=>{const book=d.books.find(b=>String(b.id)===String(o.item_id)),lib=(db.accounts?.libraries||[]).find(l=>String(l.id)===String(o.library_id));const st=statusClass(o.status);return `<article class="teacher-v154-order" data-search="${escSafe(((o.order_number||o.id)+' '+(o.title||book?.title||'')).toLowerCase())}" data-status="${st}" data-library="${escSafe(o.library_id||'')}" data-date="${escSafe(dateOnly(o.created_at))}"><div><h4>${escSafe(o.order_number||o.id)} — ${escSafe(o.title||book?.title||'ملزمة')}</h4><small>عدد النسخ: ${+o.qty||1} • المكتبة: ${escSafe(lib?.name||'-')} • تاريخ الطلب: ${dateOnly(o.created_at)}</small></div><div class="teacher-v154-order-side"><span class="teacher-v154-status ${st}">${escSafe(statusText(o.status))}</span><b>${moneySafe(o.total)} د.ع</b></div></article>`}).join('')||'<div class="teacher-v154-empty">لا توجد طلبات مرتبطة بملازمك.</div>';
    teacherContent.innerHTML=`<div class="teacher-v154-shell"><div class="teacher-v154-head"><div><h3>مبيعات وطلبات ملازمي</h3><p>تابع الطلبات وعدد النسخ وحالة التجهيز والتسليم.</p></div></div><div class="teacher-v154-summary"><div class="teacher-v154-stat"><small>إجمالي الطلبات</small><b>${d.orders.length}</b></div><div class="teacher-v154-stat"><small>قيد التنفيذ</small><b>${active.length}</b></div><div class="teacher-v154-stat"><small>مكتملة</small><b>${done.length}</b></div><div class="teacher-v154-stat gold"><small>إجمالي النسخ</small><b>${totalQty}</b></div></div>${orderFiltersHtml(d)}<div id="teacherV154Orders" class="teacher-v154-list">${cards}</div></div>`;
  }
  window.teacherV154FilterOrders=function(){
    const q=(document.getElementById('tv154OrderSearch')?.value||'').trim().toLowerCase(),st=document.getElementById('tv154OrderStatus')?.value||'',lib=document.getElementById('tv154OrderLibrary')?.value||'',period=document.getElementById('tv154OrderPeriod')?.value||'',today=new Date().toISOString().slice(0,10),month=today.slice(0,7);
    document.querySelectorAll('#teacherV154Orders .teacher-v154-order').forEach(c=>{const date=c.dataset.date||'';c.hidden=!!((q&&!c.dataset.search.includes(q))||(st&&c.dataset.status!==st)||(lib&&c.dataset.library!==lib)||(period==='today'&&date!==today)||(period==='month'&&!date.startsWith(month)))});
  };
  function renderFinance(){
    const d=data(),paid=paidAmount(d),earned=d.ledger.reduce((a,x)=>a+(+x.teacher||0),0),remaining=Math.max(0,earned-paid),month=new Date().toISOString().slice(0,7),monthEarn=d.ledger.filter(x=>String(x.created_at||'').slice(0,7)===month).reduce((a,x)=>a+(+x.teacher||0),0);
    const rows=d.ledger.slice().sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))).map(x=>{const o=d.orders.find(o=>String(o.id)===String(x.order_id)||String(o.order_number)===String(x.order_id));return `<tr><td>${escSafe(x.order_id||'-')}</td><td>${escSafe(o?.title||'-')}</td><td>${dateOnly(x.created_at)}</td><td>${moneySafe(x.teacher)} د.ع</td><td>${escSafe(statusText(o?.status||'completed'))}</td></tr>`}).join('')||'<tr><td colspan="5">لا توجد أرباح مسجلة.</td></tr>';
    const payouts=d.payouts.slice().sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))).map(p=>`<div class="teacher-v154-payout"><div><b>${moneySafe(p.amount)} د.ع</b><small>${dateOnly(p.created_at)} • ${escSafe(p.note||'تسوية أرباح')}</small></div><span class="teacher-v154-status ${String(p.status).toLowerCase()==='paid'?'done':'active'}">${String(p.status).toLowerCase()==='paid'?'مدفوعة':'قيد الانتظار'}</span></div>`).join('')||'<div class="teacher-v154-empty">لا توجد تسويات سابقة.</div>';
    teacherContent.innerHTML=`<div class="teacher-v154-shell"><div class="teacher-v154-head"><div><h3>الأرباح والتسويات</h3><p>كشف واضح لأرباح كل طلب والمبالغ المدفوعة والمتبقية.</p></div><div class="teacher-v154-actions"><button onclick="printTeacherStatement()">طباعة كشف حساب</button><button class="secondary" onclick="teacherV154ExportFinance()">تصدير Excel</button></div></div><div class="teacher-v154-summary"><div class="teacher-v154-stat gold"><small>إجمالي الأرباح</small><b>${moneySafe(earned)} د.ع</b></div><div class="teacher-v154-stat"><small>أرباح هذا الشهر</small><b>${moneySafe(monthEarn)} د.ع</b></div><div class="teacher-v154-stat"><small>المبلغ المدفوع</small><b>${moneySafe(paid)} د.ع</b></div><div class="teacher-v154-stat gold"><small>الرصيد الحالي</small><b>${moneySafe(remaining)} د.ع</b></div></div><section><div class="teacher-v154-head"><div><h3>كشف الأرباح</h3><p>تفاصيل الأرباح الناتجة من الطلبات المكتملة.</p></div></div><div class="teacher-v154-ledger"><table class="teacher-v154-table"><thead><tr><th>رقم الطلب</th><th>الملزمة</th><th>التاريخ</th><th>ربح المدرس</th><th>حالة الطلب</th></tr></thead><tbody>${rows}</tbody></table></div></section><section><div class="teacher-v154-head"><div><h3>التسويات السابقة</h3><p>المدير وحده يثبت التسوية المالية.</p></div></div><div class="teacher-v154-payouts">${payouts}</div></section></div>`;
  }
  window.teacherV154ExportFinance=function(){
    const d=data(),lines=[['رقم الطلب','التاريخ','ربح المدرس']].concat(d.ledger.map(x=>[x.order_id||'',dateOnly(x.created_at),+x.teacher||0]));
    const csv='\ufeff'+lines.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='teacher-finance.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  };
  const previousTab=window.teacherTab;
  window.teacherTab=function(tab){
    if(tab==='orders'){window.__teacherV154Tab='orders';renderOrders();document.querySelectorAll('#teacherPage .teacher-tabs button').forEach(b=>b.classList.toggle('active-teacher-tab',(b.getAttribute('onclick')||'').includes("'orders'")));return}
    if(tab==='finance'){window.__teacherV154Tab='finance';renderFinance();document.querySelectorAll('#teacherPage .teacher-tabs button').forEach(b=>b.classList.toggle('active-teacher-tab',(b.getAttribute('onclick')||'').includes("'finance'")));return}
    window.__teacherV154Tab=tab;return typeof previousTab==='function'?previousTab(tab):undefined;
  };
  window.AlinTeacherModules=window.AlinTeacherModules||{};window.AlinTeacherModules.teacherTab=window.teacherTab;
})();


;

// === teacher/dashboard.js ===
/* ===== teacher/js/teacher-dashboard-v148.js ===== */
/* V148 — الرئيسية وملازمي */
(function(){
  const escSafe=v=>typeof esc==='function'?esc(v):String(v??'');
  const moneySafe=v=>typeof money==='function'?money(v):Number(v||0).toLocaleString('ar-IQ');
  const dateOnly=v=>String(v||'').slice(0,10);
  const monthOnly=v=>String(v||'').slice(0,7);
  const statusName=s=>({published:'منشورة',active:'منشورة',hidden:'مخفية',draft:'مسودة',pending:'قيد المراجعة',review:'قيد المراجعة',rejected:'مرفوضة',approved:'منشورة'}[String(s||'').toLowerCase()]||s||'غير محددة');
  const statusClass=s=>{s=String(s||'').toLowerCase();if(['published','active','approved'].includes(s))return'published';if(['pending','review','new'].includes(s))return'pending';if(s==='rejected')return'rejected';return'hidden'};
  function data(){
    const id=window.current?.role==='teacher'?current.id:'';
    const teacher=(window.db?.accounts?.teachers||[]).find(x=>String(x.id)===String(id))||current||{};
    const books=(window.db?.booklets||[]).filter(x=>String(x.teacher_id)===String(id));
    const ids=new Set(books.map(x=>String(x.id)));
    const orders=(window.db?.orders||[]).filter(x=>ids.has(String(x.item_id))&&x.kind==='booklet');
    const ledger=(window.db?.ledger||[]).filter(x=>String(x.teacher_id)===String(id));
    const notices=(window.v19Notifications||window.db?.notifications||[]).filter(n=>n.status!=='deleted'&&(['all','teacher'].includes(n.target_role||n.audience||'all')||String(n.account_id||n.target_id||'')===String(id)));
    const paid=typeof teacherAccountPaid==='function'?teacherAccountPaid(id):0;
    return{id,teacher,books,orders,ledger,notices,paid};
  }
  function header(d){
    let head=document.querySelector('#teacherPage .teacher-v148-head');
    if(!head){head=document.createElement('div');head.className='teacher-v148-head';document.querySelector('#teacherPage')?.insertBefore(head,document.querySelector('#teacherStats'))}
    const avatar=d.teacher.avatar_path||d.teacher.image_path||'';
    head.innerHTML=`<div><h1>أهلاً ${escSafe(d.teacher.name||current?.name||'أستاذنا')}</h1><p>تابع ملازمك ومبيعاتك وأرباحك من مكان واحد.</p></div><div class="teacher-v148-avatar">${avatar?`<img src="${typeof mediaUrl==='function'?mediaUrl(avatar):avatar}" alt="">`:'م'}</div>`;
  }
  function stats(d){
    const today=new Date().toISOString().slice(0,10),month=today.slice(0,7);
    const published=d.books.filter(b=>['published','active','approved'].includes(String(b.status||'').toLowerCase())).length;
    const pending=d.books.filter(b=>['pending','review','new'].includes(String(b.status||'').toLowerCase())).length;
    const completed=d.orders.filter(o=>['delivered','completed','done'].includes(String(o.status||'').toLowerCase()));
    const daySales=completed.filter(o=>dateOnly(o.delivered_at||o.updated_at||o.created_at)===today).reduce((a,o)=>a+(+o.total||0),0);
    const monthSales=completed.filter(o=>monthOnly(o.delivered_at||o.updated_at||o.created_at)===month).reduce((a,o)=>a+(+o.total||0),0);
    const due=d.ledger.reduce((a,x)=>a+(+x.teacher||0),0),remaining=Math.max(0,due-d.paid);
    teacherStats.innerHTML=`<div><b>الملازم المنشورة</b><span>${published}</span></div><div><b>قيد المراجعة</b><span>${pending}</span></div><div><b>مبيعات اليوم</b><span>${moneySafe(daySales)} د.ع</span></div><div><b>مبيعات الشهر</b><span>${moneySafe(monthSales)} د.ع</span></div><div><b>الرصيد الحالي</b><span>${moneySafe(remaining)} د.ع</span></div><div><b>المستلم سابقاً</b><span>${moneySafe(d.paid)} د.ع</span></div>`;
  }
  function setActive(tab){document.querySelectorAll('#teacherPage .teacher-tabs button').forEach(b=>b.classList.toggle('active-teacher-tab',(b.getAttribute('onclick')||'').includes(`'${tab}'`)))}
  function dashboard(d){
    const recent=d.orders.slice().sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))).slice(0,6);
    const notes=d.notices.slice().sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))).slice(0,5);
    const orderHtml=recent.map(o=>`<div class="teacher-v148-order"><div><b>${escSafe(o.order_number||o.id)} — ${escSafe(o.title||'طلب ملزمة')}</b><small>${escSafe(statusName(o.status))} • ${+o.qty||1} نسخة • ${dateOnly(o.created_at)||'-'}</small></div><strong>${moneySafe(o.total)} د.ع</strong></div>`).join('')||'<div class="teacher-v148-empty">لا توجد طلبات حديثة.</div>';
    const noteHtml=notes.map(n=>`<div class="teacher-v148-notice"><b>${escSafe(n.title||'إشعار')}</b><p>${escSafe(n.message||n.text||'')}</p></div>`).join('')||'<div class="teacher-v148-empty">لا توجد إشعارات جديدة.</div>';
    return `<div class="teacher-v148-grid"><section class="teacher-v148-card"><div class="teacher-v148-card-head"><h3>آخر الطلبات</h3><button class="teacher-v148-link" onclick="teacherTab('orders')">عرض الكل</button></div><div class="teacher-v148-orders">${orderHtml}</div></section><aside class="teacher-v148-card"><div class="teacher-v148-card-head"><h3>آخر الإشعارات</h3><button class="teacher-v148-link" onclick="teacherTab('profile')">الإعدادات</button></div><div class="teacher-v148-notices">${noteHtml}</div></aside></div>`;
  }
  function booklets(d){
    const cards=d.books.map(b=>{
      const relevant=d.orders.filter(o=>String(o.item_id)===String(b.id));
      const qty=relevant.reduce((a,o)=>a+(+o.qty||0),0),profit=d.ledger.filter(x=>String(x.item_id||x.booklet_id||'')===String(b.id)).reduce((a,x)=>a+(+x.teacher||0),0);
      const cover=b.cover_path||b.image_path||b.cover_url||'';
      return `<article class="teacher-v148-book" data-title="${escSafe((b.title||'').toLowerCase())}" data-status="${escSafe(statusClass(b.status))}" data-subject="${escSafe(b.subject||'')}"><div class="teacher-v148-cover">${cover?`<img src="${typeof mediaUrl==='function'?mediaUrl(cover):cover}" alt="${escSafe(b.title)}">`:'آلين'}</div><div class="teacher-v148-book-body"><span class="teacher-v148-status ${statusClass(b.status)}">${escSafe(statusName(b.status))}</span><h3>${escSafe(b.title)}</h3><div class="teacher-v148-meta"><span class="teacher-v148-chip">${escSafe(b.subject||'بدون مادة')}</span><span class="teacher-v148-chip">${escSafe(b.grade||'بدون صف')}</span></div><div class="teacher-v148-book-stats"><div><small>السعر</small><b>${moneySafe(b.price)} د.ع</b></div><div><small>المبيعات</small><b>${qty} نسخة</b></div><div><small>الأرباح</small><b>${moneySafe(profit)} د.ع</b></div></div><div class="teacher-v148-actions">${b.file_path?`<button onclick="openTeacherPdf('${escSafe(b.id)}')">عرض</button>`:''}<button class="secondary" onclick="teacherTab('requests')">طلب تحديث</button></div></div></article>`;
    }).join('')||'<div class="teacher-v148-empty">لا توجد ملازم مرتبطة بحسابك.</div>';
    const subjects=[...new Set(d.books.map(x=>x.subject).filter(Boolean))];
    return `<section class="teacher-v148-card"><div class="teacher-v148-card-head"><h3>ملازمي</h3><button onclick="teacherTab('requests')">رفع طلب ملزمة</button></div><div class="teacher-v148-book-toolbar"><input id="teacherBookSearch" placeholder="ابحث باسم الملزمة" oninput="filterTeacherBooks()"><select id="teacherBookStatus" onchange="filterTeacherBooks()"><option value="">كل الحالات</option><option value="published">منشورة</option><option value="pending">قيد المراجعة</option><option value="hidden">مخفية/مسودة</option><option value="rejected">مرفوضة</option></select><select id="teacherBookSubject" onchange="filterTeacherBooks()"><option value="">كل المواد</option>${subjects.map(s=>`<option>${escSafe(s)}</option>`).join('')}</select><select id="teacherBookSort" onchange="filterTeacherBooks()"><option value="name">ترتيب بالاسم</option><option value="sales">الأحدث أولاً</option></select></div><div id="teacherV148BookGrid" class="teacher-v148-book-grid">${cards}</div></section>`;
  }
  window.filterTeacherBooks=function(){
    const q=(document.getElementById('teacherBookSearch')?.value||'').trim().toLowerCase(),s=document.getElementById('teacherBookStatus')?.value||'',sub=document.getElementById('teacherBookSubject')?.value||'';
    document.querySelectorAll('#teacherV148BookGrid .teacher-v148-book').forEach(c=>{c.hidden=!!((q&&!c.dataset.title.includes(q))||(s&&c.dataset.status!==s)||(sub&&c.dataset.subject!==sub))});
  };
  const oldRender=window.renderTeacher;
  const oldTeacherTab=window.teacherTab;
  let v148TeacherTab='dashboard';

  window.renderTeacher=function(){
    if(!window.teacherStats||!window.teacherContent)return typeof oldRender==='function'?oldRender():undefined;
    const d=data();
    header(d);stats(d);
    const tab=v148TeacherTab||'dashboard';
    if(tab==='dashboard'){
      teacherContent.innerHTML=dashboard(d);
    }else if(tab==='booklets'){
      teacherContent.innerHTML=booklets(d);
    }else if(typeof oldRender==='function'){
      oldRender();
    }
    setActive(tab);
  };

  window.teacherTab=function(tab){
    v148TeacherTab=tab||'dashboard';
    if(v148TeacherTab==='dashboard'||v148TeacherTab==='booklets'){
      window.renderTeacher();
      return;
    }
    if(typeof oldTeacherTab==='function'){
      oldTeacherTab(v148TeacherTab);
      setActive(v148TeacherTab);
      return;
    }
    window.renderTeacher();
  };

  window.AlinTeacherModules=window.AlinTeacherModules||{};
  window.AlinTeacherModules.renderTeacher=window.renderTeacher;
  window.AlinTeacherModules.teacherTab=window.teacherTab;
})();


;

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

// === teacher/notifications.js ===
/* ===== teacher/js/teacher-notifications-v155.js ===== */

/* V155 — إشعارات المدرس */
(function(){
  const escx=v=>typeof esc==='function'?esc(v):String(v??'');
  const arr=v=>Array.isArray(v)?v:[];
  const currentTeacher=()=>window.current?.role==='teacher'?window.current:null;
  const key=()=>`alin_teacher_seen_notifications_${currentTeacher()?.id||'guest'}`;
  const seen=()=>{try{return new Set(JSON.parse(localStorage.getItem(key())||'[]').map(String))}catch(_){return new Set()}};
  const saveSeen=s=>localStorage.setItem(key(),JSON.stringify([...s]));
  function all(){
    const t=currentTeacher(); if(!t)return[];
    const rows=[...arr(window.v19Notifications),...arr(window.db?.notifications)];
    const map=new Map(); rows.forEach(n=>{if(n?.id!=null)map.set(String(n.id),n)});
    return [...map.values()].filter(n=>{
      if(n.status==='deleted'||n.status==='inactive')return false;
      const role=n.target_role||n.audience||'all';
      const target=String(n.target_id||n.account_id||n.teacher_id||'');
      return ['all','teacher','teachers'].includes(role)||target===String(t.id);
    }).sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));
  }
  const icon=n=>{const x=String(n.type||n.priority||n.category||'').toLowerCase();if(x.includes('sale')||x.includes('order'))return'🛍️';if(x.includes('settle')||x.includes('pay')||x.includes('finance'))return'💰';if(x.includes('reject'))return'❌';if(x.includes('approve')||x.includes('publish'))return'✅';if(x.includes('edit')||x.includes('review'))return'✏️';return'🔔'};
  function isRead(n,s){return !!n.read_at||s.has(String(n.id))}
  function updateBadge(){
    const s=seen(),unread=all().filter(n=>!isRead(n,s)).length;
    document.querySelectorAll('#teacherV155Badge').forEach(b=>{b.textContent=unread;b.hidden=!unread});
  }
  function render(){
    if(!currentTeacher()||!window.teacherContent)return;
    const rows=all(),s=seen(),unread=rows.filter(n=>!isRead(n,s)).length,today=new Date().toISOString().slice(0,10),todayCount=rows.filter(n=>String(n.created_at||'').slice(0,10)===today).length;
    teacherContent.innerHTML=`<section class="teacher-v155-notifications"><div class="teacher-v155-head"><div><h2>إشعاراتي</h2><p>تابع الموافقات والمبيعات والتسويات ورسائل الإدارة.</p></div><div class="teacher-v155-actions"><button type="button" onclick="TeacherV155.markAll()">تحديد الكل كمقروء</button><button type="button" class="secondary" onclick="TeacherV155.refresh()">تحديث</button></div></div><div class="teacher-v155-stats"><div class="teacher-v155-stat"><small>كل الإشعارات</small><b>${rows.length}</b></div><div class="teacher-v155-stat"><small>غير المقروء</small><b>${unread}</b></div><div class="teacher-v155-stat"><small>اليوم</small><b>${todayCount}</b></div></div><div class="teacher-v155-toolbar"><input id="teacherV155Search" placeholder="ابحث بعنوان الإشعار أو محتواه" oninput="TeacherV155.filter()"><select id="teacherV155Filter" onchange="TeacherV155.filter()"><option value="all">الكل</option><option value="unread">غير المقروء</option><option value="read">المقروء</option></select></div><div id="teacherV155List" class="teacher-v155-list">${rows.map(n=>`<article class="teacher-v155-card ${isRead(n,s)?'':'unread'}" data-text="${escx(((n.title||'')+' '+(n.message||n.text||'')).toLowerCase())}" data-read="${isRead(n,s)?'1':'0'}"><div class="teacher-v155-icon">${icon(n)}</div><div><h3>${escx(n.title||'إشعار')}</h3><p>${escx(n.message||n.text||'')}</p><small>${escx(n.created_at||'')}</small></div><div class="teacher-v155-card-actions">${isRead(n,s)?'':`<button type="button" onclick="TeacherV155.mark('${escx(n.id)}')">مقروء</button>`}<button type="button" class="secondary" onclick="TeacherV155.copy('${escx(n.id)}')">نسخ</button></div></article>`).join('')||'<div class="teacher-v155-empty">لا توجد إشعارات حالياً.</div>'}</div></section>`;
    document.querySelectorAll('#teacherPage .teacher-tabs button').forEach(b=>b.classList.toggle('active-teacher-tab',(b.getAttribute('onclick')||'').includes("'notifications'")));
    updateBadge();
  }
  async function mark(id){
    const s=seen();s.add(String(id));saveSeen(s);
    const n=all().find(x=>String(x.id)===String(id));if(n)n.read_at=n.read_at||new Date().toISOString();
    try{if(typeof update==='function')await update('notifications',{read_at:new Date().toISOString()},{id})}catch(_){ }
    render();
  }
  async function markAll(){
    const s=seen();all().forEach(n=>s.add(String(n.id)));saveSeen(s);
    const now=new Date().toISOString();all().forEach(n=>n.read_at=n.read_at||now);
    render();
  }
  function filter(){const q=(document.getElementById('teacherV155Search')?.value||'').trim().toLowerCase(),f=document.getElementById('teacherV155Filter')?.value||'all';document.querySelectorAll('#teacherV155List .teacher-v155-card').forEach(c=>{c.hidden=!!((q&&!c.dataset.text.includes(q))||(f==='unread'&&c.dataset.read==='1')||(f==='read'&&c.dataset.read==='0'))})}
  function copy(id){const n=all().find(x=>String(x.id)===String(id));if(!n)return;const text=`${n.title||'إشعار'}\n${n.message||n.text||''}`;navigator.clipboard?.writeText(text).then(()=>typeof toast==='function'&&toast('تم نسخ الإشعار')).catch(()=>{});}
  function refresh(){render();typeof toast==='function'&&toast('تم تحديث الإشعارات')}
  window.TeacherV155={render,mark,markAll,filter,copy,refresh,updateBadge};
  const previousTab=window.teacherTab;
  window.teacherTab=function(tab){if(tab==='notifications'){render();return}return typeof previousTab==='function'?previousTab(tab):undefined};
  window.AlinTeacherModules=window.AlinTeacherModules||{};window.AlinTeacherModules.teacherTab=window.teacherTab;
  document.addEventListener('DOMContentLoaded',updateBadge);
})();

/* ===== teacher/js/teacher-notifications-visible-v158.js ===== */
/* V158 — تثبيت ظهور تبويب إشعارات المدرس وربطه كآخر متحكم */
(function(){
  const previousTeacherTab = window.teacherTab;

  function ensureNotificationTab(){
    const tabs = document.querySelector('#teacherPage .teacher-tabs');
    if(!tabs) return null;
    let button = [...tabs.querySelectorAll('button')].find(b => (b.getAttribute('onclick')||'').includes("'notifications'") || b.dataset.teacherTab === 'notifications');
    if(!button){
      button = document.createElement('button');
      button.type = 'button';
      button.dataset.teacherTab = 'notifications';
      button.innerHTML = 'الإشعارات <span id="teacherV155Badge" class="teacher-v155-badge" hidden>0</span>';
      const profileButton = [...tabs.querySelectorAll('button')].find(b => (b.getAttribute('onclick')||'').includes("'profile'"));
      tabs.insertBefore(button, profileButton || null);
    }
    button.setAttribute('onclick', "teacherTab('notifications')");
    return button;
  }

  function setActive(tab){
    document.querySelectorAll('#teacherPage .teacher-tabs button').forEach(b => {
      const target = b.dataset.teacherTab || ((b.getAttribute('onclick')||'').match(/teacherTab\('([^']+)'\)/)||[])[1] || '';
      b.classList.toggle('active-teacher-tab', target === tab);
    });
  }

  function openNotifications(){
    ensureNotificationTab();
    if(window.TeacherV155 && typeof window.TeacherV155.render === 'function'){
      window.activeTeacherTab = 'notifications';
      window.TeacherV155.render();
      setActive('notifications');
      return true;
    }
    const host = document.getElementById('teacherContent');
    if(host){
      host.innerHTML = '<section class="teacher-v155-notifications"><div class="teacher-v155-empty">تعذر تحميل مركز الإشعارات. حدّث الصفحة وحاول مرة أخرى.</div></section>';
      setActive('notifications');
    }
    return false;
  }

  window.teacherTab = function(tab){
    if(tab === 'notifications'){
      openNotifications();
      return;
    }
    return typeof previousTeacherTab === 'function' ? previousTeacherTab(tab) : undefined;
  };

  window.AlinTeacherModules = window.AlinTeacherModules || {};
  window.AlinTeacherModules.teacherTab = window.teacherTab;
  window.openTeacherNotificationsV158 = openNotifications;

  function init(){
    ensureNotificationTab();
    if(window.TeacherV155 && typeof window.TeacherV155.updateBadge === 'function') window.TeacherV155.updateBadge();
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

/* ===== teacher/js/teacher-notifications-v159.js ===== */

/* V159 — تثبيت مركز إشعارات المدرس نهائياً */
(function(){
  function teacherCurrent(){
    try{ if(typeof current!=='undefined' && current && current.role==='teacher') return current; }catch(_){ }
    return window.current && window.current.role==='teacher' ? window.current : null;
  }
  function rows(){
    const t=teacherCurrent(); if(!t) return [];
    const all=[...(Array.isArray(window.v19Notifications)?window.v19Notifications:[]),...(Array.isArray(window.db?.notifications)?window.db.notifications:[])];
    const map=new Map(); all.forEach(n=>{if(n&&n.id!=null)map.set(String(n.id),n)});
    return [...map.values()].filter(n=>{
      if(n.status==='deleted'||n.status==='inactive') return false;
      const role=String(n.target_role||n.audience||'all').toLowerCase();
      const target=String(n.target_id||n.account_id||n.teacher_id||'');
      return ['all','teacher','teachers'].includes(role)||target===String(t.id);
    });
  }
  function seenSet(){
    const t=teacherCurrent();
    try{return new Set(JSON.parse(localStorage.getItem(`alin_teacher_seen_notifications_${t?.id||'guest'}`)||'[]').map(String))}catch(_){return new Set()}
  }
  function unreadCount(){const s=seenSet();return rows().filter(n=>!n.read_at&&!s.has(String(n.id))).length}
  function updateBadges(){
    const n=unreadCount();
    document.querySelectorAll('#teacherV155Badge,#teacherV159MainBadge').forEach(b=>{b.textContent=n;b.hidden=!n});
  }
  function ensureVisible(){
    const tabs=document.querySelector('#teacherPage .teacher-tabs');
    if(!tabs)return;
    let b=tabs.querySelector('[data-teacher-tab="notifications"]');
    if(!b){
      b=document.createElement('button');b.type='button';b.dataset.teacherTab='notifications';b.className='teacher-notifications-tab';b.setAttribute('onclick',"teacherTab('notifications')");b.innerHTML='🔔 الإشعارات <span id="teacherV155Badge" class="teacher-v155-badge" hidden>0</span>';
      tabs.insertBefore(b,tabs.children[1]||null);
    }
  }
  const previous=window.teacherTab;
  window.teacherTab=function(tab){
    if(tab==='notifications'){
      ensureVisible();
      if(window.TeacherV155&&typeof window.TeacherV155.render==='function'){
        window.activeTeacherTab='notifications';window.TeacherV155.render();
      }else{
        const host=document.getElementById('teacherContent');if(host)host.innerHTML='<section class="teacher-v155-notifications"><div class="teacher-v155-empty">مركز الإشعارات غير محمّل. أعد تحديث الصفحة.</div></section>';
      }
      document.querySelectorAll('#teacherPage .teacher-tabs button').forEach(x=>x.classList.toggle('active-teacher-tab',x.dataset.teacherTab==='notifications'||(x.getAttribute('onclick')||'').includes("'notifications'")));
      updateBadges();return;
    }
    return typeof previous==='function'?previous(tab):undefined;
  };
  window.AlinTeacherModules=window.AlinTeacherModules||{};window.AlinTeacherModules.teacherTab=window.teacherTab;
  function init(){ensureVisible();updateBadges()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
  window.setInterval(updateBadges,5000);
})();

/* ===== teacher/js/teacher-notifications-v160.js ===== */

/* V160 — تثبيت قسم إشعارات المدرس بشكل نهائي */
(function(){
  function targetTabs(){return document.querySelector('#teacherPage .teacher-tabs')}
  function currentTeacher(){try{return (typeof current!=='undefined'&&current&&current.role==='teacher')?current:(window.current&&window.current.role==='teacher'?window.current:null)}catch(_){return null}}
  function notifications(){
    const t=currentTeacher(); if(!t)return [];
    const all=[...(Array.isArray(window.v19Notifications)?window.v19Notifications:[]),...(Array.isArray(window.db&&window.db.notifications)?window.db.notifications:[])];
    const seen=new Set(), out=[];
    all.forEach(n=>{if(!n||n.status==='deleted'||n.status==='inactive')return;const id=String(n.id||Math.random());if(seen.has(id))return;seen.add(id);const role=String(n.target_role||n.audience||'all').toLowerCase();const target=String(n.target_id||n.account_id||n.teacher_id||'');if(['all','teacher','teachers'].includes(role)||target===String(t.id))out.push(n)});
    return out;
  }
  function unread(){
    const t=currentTeacher();let local=new Set();try{local=new Set(JSON.parse(localStorage.getItem(`alin_teacher_seen_notifications_${t&&t.id||'guest'}`)||'[]').map(String))}catch(_){}
    return notifications().filter(n=>!n.read_at&&!local.has(String(n.id))).length;
  }
  function ensureTab(){
    const tabs=targetTabs();if(!tabs)return null;
    // Remove stale duplicates, preserve one final button.
    [...tabs.querySelectorAll('[data-teacher-tab="notifications"],.teacher-notifications-tab')].forEach(x=>{if(x.id!=='teacherNotificationsTabV160')x.remove()});
    let btn=document.getElementById('teacherNotificationsTabV160');
    if(!btn){
      btn=document.createElement('button');btn.type='button';btn.id='teacherNotificationsTabV160';btn.dataset.teacherTab='notifications';btn.innerHTML='<span aria-hidden="true">🔔</span><span>الإشعارات</span><span id="teacherNotificationsBadgeV160" class="teacher-v160-badge" hidden>0</span>';
      const raise=[...tabs.querySelectorAll('button')].find(b=>(b.getAttribute('onclick')||'').includes("'requests'"));
      tabs.insertBefore(btn,raise||null);
    }
    btn.onclick=function(){window.teacherTab('notifications')};
    btn.style.display='inline-flex';btn.hidden=false;
    const badge=btn.querySelector('#teacherNotificationsBadgeV160');const n=unread();if(badge){badge.textContent=n;badge.hidden=!n}
    return btn;
  }
  function setActive(){document.querySelectorAll('#teacherPage .teacher-tabs button').forEach(b=>b.classList.toggle('active-teacher-tab',b.id==='teacherNotificationsTabV160'))}
  const previous=window.teacherTab;
  window.teacherTab=function(tab){
    ensureTab();
    if(tab==='notifications'){
      window.activeTeacherTab='notifications';
      if(window.TeacherV155&&typeof window.TeacherV155.render==='function')window.TeacherV155.render();
      else{const host=document.getElementById('teacherContent');if(host)host.innerHTML='<section class="teacher-v155-notifications"><div class="teacher-v155-empty">لا توجد إشعارات حالياً.</div></section>'}
      setActive();return;
    }
    return typeof previous==='function'?previous(tab):undefined;
  };
  window.AlinTeacherModules=window.AlinTeacherModules||{};window.AlinTeacherModules.teacherTab=window.teacherTab;
  function init(){ensureTab();let tries=0;const timer=setInterval(()=>{ensureTab();if(++tries>20)clearInterval(timer)},500)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();


;

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
    host.innerHTML=`<section class="teacher-v156-profile"><header class="teacher-v156-hero"><div class="teacher-v156-hero-info"><div class="teacher-v156-avatar">${avatar?`<img src="${escx(avatar)}" alt="صورة المدرس">`:escx(initial)}</div><div><h2>${escx(t.name||'ملف المدرس')}</h2><p>${escx(t.specialty||'مدرس في منصة آلين')}</p></div></div><span class="teacher-v156-status">الحساب فعال</span></header><div class="teacher-v156-grid"><article class="teacher-v156-card"><h3>البيانات الشخصية</h3><div class="teacher-v156-form"><div class="teacher-v156-field"><label>الاسم</label><input value="${escx(t.name||'')}" disabled></div><div class="teacher-v156-field"><label>اسم الدخول</label><input id="v156Username" value="${escx(t.username||'')}"></div><div class="teacher-v156-field"><label>رقم الهاتف</label><input id="v156Phone" value="${escx(t.phone||t.mobile||'')}" placeholder="07xxxxxxxxx"></div><div class="teacher-v156-field"><label>المنطقة</label><input id="v156Area" value="${escx(t.area||'')}" placeholder="المنطقة"></div><div class="teacher-v156-field full"><label>الاختصاص</label><input id="v156Specialty" value="${escx(t.specialty||'')}" placeholder="مثال: مدرس رياضيات"></div><div class="teacher-v156-field full"><label>نبذة قصيرة</label><textarea id="v156Bio" placeholder="نبذة تظهر في ملفك">${escx(t.bio||'')}</textarea></div><div class="teacher-v156-field full"><label>الصورة الشخصية</label><div class="teacher-v156-upload"><div id="v156AvatarPreview" class="teacher-v156-upload-preview">${avatar?`<img src="${escx(avatar)}" alt="">`:'📷'}</div><input id="v156Avatar" type="file" accept="image/png,image/jpeg,image/webp" onchange="v156PreviewAvatar(this)"></div></div></div><div class="teacher-v156-actions"><button class="teacher-v156-save" onclick="v156SaveTeacherProfile()">حفظ التعديلات</button></div></article><aside class="teacher-v156-card"><h3>ملخص الحساب</h3><div class="teacher-v156-stat-list"><div class="teacher-v156-stat"><span>الملازم</span><b>${s.books}</b></div><div class="teacher-v156-stat"><span>الطلبات</span><b>${s.orders}</b></div><div class="teacher-v156-stat"><span>النسخ المباعة</span><b>${s.sales}</b></div></div><h3 style="margin-top:20px">الأمان</h3><div class="teacher-v156-security"><input id="v156NewPassword" type="password" placeholder="كلمة المرور الجديدة"><input id="v156ConfirmPassword" type="password" placeholder="تأكيد كلمة المرور"><button onclick="v156ChangeTeacherPassword()">تغيير كلمة المرور</button></div><div class="teacher-v156-note">اسم المدرس وربط الملازم يبقى من صلاحية الإدارة، بينما تستطيع تعديل بيانات التواصل والصورة وكلمة المرور.</div><div class="teacher-v156-danger"><button onclick="logout()">تسجيل الخروج</button></div></aside></div></section>`;
  }
  window.v156PreviewAvatar=function(input){const f=input?.files?.[0],box=document.getElementById('v156AvatarPreview');if(!f||!box)return;if(!/^image\/(png|jpeg|webp)$/.test(f.type))return alert('اختر صورة PNG أو JPG أو WEBP');const r=new FileReader();r.onload=()=>box.innerHTML=`<img src="${r.result}" alt="معاينة">`;r.readAsDataURL(f)};
  window.v156SaveTeacherProfile=async function(){
    const c=cur(),t=teacher();if(!c?.id)return alert('تعذر تحديد حساب المدرس');
    const payload={username:document.getElementById('v156Username')?.value.trim()||t.username||'',phone:document.getElementById('v156Phone')?.value.trim()||'',area:document.getElementById('v156Area')?.value.trim()||'',specialty:document.getElementById('v156Specialty')?.value.trim()||'',bio:document.getElementById('v156Bio')?.value.trim()||'',updated_at:new Date().toISOString()};
    try{
      const file=document.getElementById('v156Avatar')?.files?.[0];if(file)payload.avatar_path=await uploadFile('teachers',file,{type:'image'});
      if(!payload.username)return alert('اسم الدخول مطلوب');
      await update('accounts',payload,{id:c.id});if(typeof audit==='function')await audit('teacher_profile','تحديث ملف المدرس');if(typeof load==='function')await load();
      if(typeof current!=='undefined'){current.username=payload.username;current.name=t.name||current.name}if(window.current)window.current.username=payload.username;
      if(typeof toast==='function')toast('تم حفظ الملف الشخصي');render();
    }catch(e){alert('تعذر حفظ الملف: '+e.message)}
  };
  window.v156ChangeTeacherPassword=async function(){
    const c=cur(),p=document.getElementById('v156NewPassword')?.value||'',p2=document.getElementById('v156ConfirmPassword')?.value||'';
    if(p.length<4)return alert('كلمة المرور يجب أن تكون 4 أحرف أو أرقام على الأقل');if(p!==p2)return alert('كلمتا المرور غير متطابقتين');
    try{await update('accounts',{password_hash:p,updated_at:new Date().toISOString()},{id:c.id});if(typeof audit==='function')await audit('teacher_security','تغيير كلمة مرور المدرس');document.getElementById('v156NewPassword').value='';document.getElementById('v156ConfirmPassword').value='';if(typeof toast==='function')toast('تم تغيير كلمة المرور')}catch(e){alert('تعذر تغيير كلمة المرور: '+e.message)}
  };
  const oldTab=window.teacherTab;
  window.teacherTab=function(tab){if(tab==='profile'){window.activeTeacherTab='profile';document.querySelectorAll('#teacherPage .teacher-tabs button').forEach(b=>b.classList.toggle('active-teacher-tab',(b.getAttribute('onclick')||'').includes("'profile'")));render();return;}return typeof oldTab==='function'?oldTab(tab):undefined};
  window.AlinTeacherModules=window.AlinTeacherModules||{};window.AlinTeacherModules.teacherTab=window.teacherTab;window.renderTeacherProfileV156=render;
})();


;

// === library/dashboard.js ===
/* ===== library/js/library-shell.js ===== */
/* V113: stable library dashboard rendering */
(function(){
  window.AlinLibraryModules=window.AlinLibraryModules||{};
  const arr=v=>Array.isArray(v)?v:[];
  const eq=(a,b)=>String(a??'')===String(b??'');
  const safeEsc=v=>typeof esc==='function'?esc(v):String(v??'');
  const safeMoney=v=>typeof money==='function'?money(v):Number(v||0).toLocaleString('ar-IQ');
  const fallbackEmpty=t=>`<div class="empty">${safeEsc(t)}</div>`;
  function libraryId(){
    const libs=arr(window.db?.accounts?.libraries);
    if(window.current?.role!=='library') return '';
    const ids=[current.id,current.library_id,current.account_id,current.user_id].filter(Boolean);
    let lib=libs.find(x=>ids.some(id=>eq(x.id,id)||eq(x.account_id,id)||eq(x.user_id,id)));
    if(!lib&&current.username) lib=libs.find(x=>eq(x.username,current.username));
    if(!lib&&current.name) lib=libs.find(x=>eq(x.name,current.name));
    return String(lib?.id||current.id||'');
  }
  function isOpen(lib){
    try{return typeof libIsOpen==='function'?!!libIsOpen(lib):!(lib?.is_open===false||String(lib?.is_open)==='false'||lib?.open_status==='closed')}catch(_){return true}
  }
  function libraryOrders(id){
    return arr(window.db?.orders).filter(o=>eq(o.library_id,id)||eq(o.pickup_library_id,id)||eq(o.assigned_library_id,id));
  }

  function openLibraryJoinPortal(){
    try{
      if(typeof window.showLogin==='function'){
        window.showLogin('library');
        const loginSection=document.getElementById('login');
        const appSection=document.getElementById('app');
        if(loginSection) loginSection.classList.remove('hidden');
        if(appSection) appSection.classList.add('hidden');
        const form=document.getElementById('loginForm');
        if(form) form.classList.remove('hidden');
        const user=document.getElementById('loginU');
        if(user) setTimeout(()=>user.focus(),0);
        return;
      }
    }catch(e){ console.error('[Alin library login]',e); }
    alert('تعذر فتح تسجيل دخول المكتبة. حدّث الصفحة وحاول مرة أخرى.');
  }
  function renderLibraryStable(){
    const stats=document.getElementById('libraryStats'), permits=document.getElementById('libraryPermits'), history=document.getElementById('libraryHistory');
    if(!stats||!permits||!history) return;
    const id=libraryId();
    const libs=arr(window.db?.accounts?.libraries);
    const lib=libs.find(x=>eq(x.id,id));
    const orders=libraryOrders(id);
    const led=arr(window.db?.ledger).filter(x=>eq(x.library_id,id));
    const notifications=arr(window.v19Notifications||window.db?.notifications).filter(n=>n.status!=='inactive'&&(['all','library'].includes(n.target_role||n.audience)));
    stats.innerHTML=`<div><b>طلبات المكتبة</b><span>${orders.length}</span></div><div><b>الجديدة</b><span>${orders.filter(x=>['new','pending'].includes(x.status)).length}</span></div><div><b>الجاهزة</b><span>${orders.filter(x=>x.status==='ready').length}</span></div><div><b>المستحقات</b><span>${safeMoney(led.reduce((a,x)=>a+(+x.library||0),0))} د.ع</span></div>`;
    const status=lib?`<div class="library-status-card ${isOpen(lib)?'open':'closed'}"><div><b>${safeEsc(lib.name||'المكتبة')}</b><small>${safeEsc([lib.area,lib.landmark].filter(Boolean).join(' — '))}</small></div><span class="${isOpen(lib)?'status-open':'status-closed'}">${isOpen(lib)?'مفتوح':'مغلق'}</span><div class="row-actions"><button onclick="setLibraryOpen(true)">فتح المكتبة</button><button class="warning" onclick="setLibraryOpen(false)">إغلاق المكتبة</button></div></div>`:`<div class="notice">تعذر تحديد حساب المكتبة الحالي. سجّل الخروج ثم ادخل بحساب المكتبة من جديد.</div>`;
    const noticeHtml=notifications.map(n=>`<div class="notice"><b>${safeEsc(n.title||'إشعار')}</b><div>${safeEsc(n.message||n.text||'')}</div></div>`).join('');
    const rows=orders.map(o=>{
      const b=o.kind==='booklet'?arr(window.db?.booklets).find(x=>eq(x.id,o.item_id)):null;
      return `<article class="library-order-card"><div class="library-order-main"><b>${safeEsc(o.order_number||o.id)} — ${safeEsc(o.title||'طلب')}</b><small>${safeEsc(o.student_name||'')} • ${safeEsc(o.student_phone||'')} • ×${o.qty||1} • ${safeMoney(o.total||0)} د.ع</small><div class="timeline">${arr(o.status_history).map(h=>`<span class="done">${safeEsc(h.status)}</span>`).join('')}</div></div><div class="row-actions">${b?.file_path?`<button onclick="openLibraryBookletPdf('${safeEsc(o.id)}')">طباعة</button>`:''}<button onclick="libraryOrderStatus('${safeEsc(o.id)}','processing')">استلام</button><button onclick="libraryOrderStatus('${safeEsc(o.id)}','ready')">جاهز</button><button onclick="libraryOrderStatus('${safeEsc(o.id)}','completed')">تسليم</button></div></article>`;
    }).join('');
    permits.innerHTML=status+noticeHtml+(rows||fallbackEmpty('لا توجد طلبات مرتبطة بهذه المكتبة'));
    history.innerHTML=orders.filter(x=>x.status==='completed').map(o=>`<div class="row"><b>${safeEsc(o.order_number||o.id)}</b><span>${safeMoney(o.total||0)} د.ع</span></div>`).join('')||fallbackEmpty('لا يوجد سجل تسليم');
  }
  window.renderLibrary=renderLibraryStable;
  window.openLibraryJoinPortal=openLibraryJoinPortal;
  window.AlinLibraryModules.renderLibrary=renderLibraryStable;
  window.AlinLibraryModules.openLibraryJoinPortal=openLibraryJoinPortal;
  const oldOpen=window.openPage;
  if(typeof oldOpen==='function') window.openPage=function(role){const r=oldOpen.apply(this,arguments);if(role==='library')setTimeout(renderLibraryStable,0);return r};
  const oldLoad=window.load;
  if(typeof oldLoad==='function') window.load=async function(){const r=await oldLoad.apply(this,arguments);if(window.current?.role==='library')renderLibraryStable();return r};
  function boot(){if(window.current?.role==='library')setTimeout(renderLibraryStable,0)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();

/* ===== library/js/library-entry-fix-v114.js ===== */
/* V114: library entry bootstrap */
(function(){
  function openLibrary(){
    if(typeof window.showLogin==='function'){
      window.showLogin('library');
      document.getElementById('login')?.classList.remove('hidden');
      document.getElementById('app')?.classList.add('hidden');
      document.getElementById('loginForm')?.classList.remove('hidden');
      setTimeout(()=>document.getElementById('loginU')?.focus(),0);
      return;
    }
    alert('تعذر فتح تسجيل دخول المكتبة.');
  }
  window.AlinLibraryModules=window.AlinLibraryModules||{};
  window.AlinLibraryModules.openLibraryJoinPortal=openLibrary;
  window.openLibraryJoinPortal=openLibrary;
  const oldOpen=window.openPage;
  if(typeof oldOpen==='function'){
    window.openPage=function(page){
      const r=oldOpen.apply(this,arguments);
      if(page==='library') setTimeout(()=>window.renderLibrary?.(),0);
      return r;
    };
  }
})();

/* ===== library/js/library-complete-fix-v115.js ===== */
/* V115: complete library entry and dashboard repair */
(function(){
  const getCurrent=()=>window.current||null;
  const getDb=()=>window.db||{accounts:{libraries:[]},orders:[],ledger:[]};
  function markLibraryLogin(){
    const form=document.getElementById('loginForm');
    const msg=document.getElementById('loginMsg');
    if(form) form.classList.remove('hidden');
    if(msg){msg.textContent='دخول المكتبة';msg.dataset.role='library';}
    const u=document.getElementById('loginU');
    if(u){u.placeholder='اسم دخول المكتبة';setTimeout(()=>u.focus(),0)}
    const p=document.getElementById('loginPass');
    if(p)p.placeholder='الرمز السري للمكتبة';
  }
  function openLibrary(){
    try{
      if(typeof window.showLogin!=='function') throw new Error('showLogin missing');
      window.showLogin('library');
      window.pendingRole='library';
      document.getElementById('login')?.classList.remove('hidden');
      document.getElementById('app')?.classList.add('hidden');
      markLibraryLogin();
    }catch(e){
      console.error('[Alin V115 library open]',e);
      alert('تعذر فتح دخول المكتبة. أعد تحميل الصفحة ثم حاول مرة أخرى.');
    }
  }
  function renderWhenReady(){
    const c=getCurrent();
    if(c?.role!=='library') return;
    const page=document.getElementById('libraryPage');
    if(page){
      document.querySelectorAll('.page').forEach(x=>x.classList.add('hidden'));
      page.classList.remove('hidden');
    }
    try{window.AlinLibraryModules?.renderLibrary?.()}catch(e){console.error('[Alin V115 library render module]',e)}
    try{if(typeof window.renderLibrary==='function')window.renderLibrary()}catch(e){console.error('[Alin V115 library render]',e)}
  }
  window.openLibraryJoinPortal=openLibrary;
  window.AlinLibraryModules=window.AlinLibraryModules||{};
  window.AlinLibraryModules.openLibraryJoinPortal=openLibrary;

  const oldDoLogin=window.doLogin;
  if(typeof oldDoLogin==='function'){
    window.doLogin=async function(){
      const role=window.pendingRole;
      const r=await oldDoLogin.apply(this,arguments);
      if(role==='library') setTimeout(renderWhenReady,50);
      return r;
    };
  }
  const oldOpenPage=window.openPage;
  if(typeof oldOpenPage==='function'){
    window.openPage=function(page){
      const r=oldOpenPage.apply(this,arguments);
      if(page==='library') setTimeout(renderWhenReady,30);
      return r;
    };
  }
  const oldLoad=window.load;
  if(typeof oldLoad==='function'){
    window.load=async function(){
      const r=await oldLoad.apply(this,arguments);
      if(getCurrent()?.role==='library') setTimeout(renderWhenReady,0);
      return r;
    };
  }
  document.addEventListener('click',e=>{
    const b=e.target.closest('button');
    if(!b)return;
    const t=(b.textContent||'').trim();
    if(t==='لوحة المكتبة'||t==='المكتبة'){
      const oc=b.getAttribute('onclick')||'';
      if(oc.includes('openLibraryJoinPortal')){e.preventDefault();openLibrary();}
    }
  },true);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{if(getCurrent()?.role==='library')renderWhenReady()});
  else if(getCurrent()?.role==='library')renderWhenReady();
})();

/* ===== library/js/library-dashboard-v116.js ===== */
/* V116 - organized library dashboard */
(function(){
  window.AlinLibraryModules=window.AlinLibraryModules||{};
  const state={tab:'home',filter:'all',search:''};
  const arr=v=>Array.isArray(v)?v:[];
  const eq=(a,b)=>String(a??'')===String(b??'');
  const escx=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const moneyx=v=>typeof money==='function'?money(v):Number(v||0).toLocaleString('ar-IQ');
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
  function notifications(){return arr(window.v19Notifications||dbx().notifications).filter(n=>n.status!=='inactive'&&(['all','library'].includes(n.target_role||n.audience)||eq(n.library_id,libId()))) }
  function updateHeader(){
    const lib=getLibrary(),name=document.getElementById('libraryV116Name'),loc=document.getElementById('libraryV116Location'),status=document.getElementById('libraryV116Status');
    if(name)name.textContent=lib?.name||currentUser()?.name||'المكتبة';
    if(loc)loc.textContent=[lib?.area,lib?.landmark].filter(Boolean).join(' — ')||'إدارة الطلبات والطباعة والتسليم';
    if(status){const open=isOpen(lib);status.innerHTML=`<div class="library-v116-status-card ${open?'open':'closed'}"><span class="library-v116-status-dot"></span><div><b>${open?'المكتبة مفتوحة':'المكتبة مغلقة'}</b><small>${open?'تستقبل طلبات جديدة':'لا تستقبل طلبات جديدة'}</small></div><button type="button" onclick="AlinLibraryV116.toggleOpen()">${open?'إغلاق':'فتح'}</button></div>`}
    const ob=document.getElementById('libraryV116OrdersBadge'),nb=document.getElementById('libraryV116NotifyBadge');
    const oc=orders().filter(o=>statusKey(o)==='new').length,nc=notifications().length;
    if(ob){ob.textContent=oc;ob.hidden=!oc} if(nb){nb.textContent=nc;nb.hidden=!nc}
  }
  function statsHtml(){const os=orders();return `<section class="library-v116-stats"><article class="library-v116-stat"><small>طلبات جديدة</small><strong>${os.filter(o=>statusKey(o)==='new').length}</strong></article><article class="library-v116-stat"><small>قيد الطباعة</small><strong>${os.filter(o=>statusKey(o)==='processing').length}</strong></article><article class="library-v116-stat"><small>جاهزة للتسليم</small><strong>${os.filter(o=>statusKey(o)==='ready').length}</strong></article><article class="library-v116-stat"><small>تسليمات اليوم</small><strong>${todayCount()}</strong></article><article class="library-v116-stat"><small>طلبات ملغاة</small><strong>${os.filter(o=>statusKey(o)==='cancelled').length}</strong></article><article class="library-v116-stat accent"><small>المبلغ بذمة المكتبة</small><strong>${moneyx(due())} د.ع</strong></article></section>`}
  function orderCard(o){const s=statusKey(o);return `<article class="library-v116-order"><div><div style="display:flex;justify-content:space-between;gap:10px;align-items:center"><h4>${escx(o.order_number||o.id)} — ${escx(o.title||'طلب')}</h4><span class="library-v116-status ${s}">${statusLabel(s)}</span></div><p>${escx(o.student_name||'بدون اسم')} • ${escx(o.student_phone||'بدون رقم')} • الكمية ${o.qty||1}</p><div class="library-v116-order-meta"><span class="library-v116-chip">${o.kind==='booklet'?'ملزمة':'منتج'}</span><span class="library-v116-chip">${moneyx(o.total||0)} د.ع</span><span class="library-v116-chip">${escx(o.fulfillment_type==='delivery'?'توصيل':'استلام من المكتبة')}</span></div></div><div class="library-v116-actions"><button class="secondary" onclick="AlinLibraryV116.details('${escx(o.id)}')">التفاصيل</button>${o.kind==='booklet'?`<button onclick="openLibraryBookletPdf('${escx(o.id)}')">طباعة</button>`:''}${s==='new'?`<button onclick="AlinLibraryV116.setStatus('${escx(o.id)}','processing')">بدء الطباعة</button>`:''}${s==='processing'?`<button onclick="AlinLibraryV116.setStatus('${escx(o.id)}','ready')">جاهز للتسليم</button>`:''}${s==='ready'?`<button class="success" onclick="AlinLibraryV116.setStatus('${escx(o.id)}','completed')">تم التسليم</button>`:''}${!['completed','cancelled'].includes(s)?`<button class="danger" onclick="AlinLibraryV116.cancel('${escx(o.id)}')">إلغاء</button>`:''}</div></article>`}
  function home(){const os=orders().filter(o=>!['completed','cancelled'].includes(statusKey(o))).slice(0,5);return `${statsHtml()}<section class="library-v116-grid"><div class="library-v116-panel"><h3>آخر الطلبات التي تحتاج إجراء</h3><div class="library-v116-order-list">${os.map(orderCard).join('')||'<div class="library-v116-empty">لا توجد طلبات تحتاج إجراء حالياً</div>'}</div></div><aside class="library-v116-panel"><h3>ملخص اليوم</h3><div class="library-v116-list"><div class="library-v116-row"><div><b>الطلبات الجاهزة</b><small>بانتظار استلام الطالب</small></div><span>${orders().filter(o=>statusKey(o)==='ready').length}</span></div><div class="library-v116-row"><div><b>تم التسليم اليوم</b><small>طلبات مكتملة اليوم</small></div><span>${todayCount()}</span></div><div class="library-v116-row"><div><b>المبلغ المطلوب تسليمه</b><small>حصة المنصة والمدرس بعد خصم ربح المكتبة</small></div><span class="library-v116-money debt">${moneyx(due())} د.ع</span></div></div></aside></section>`}
  function ordersView(){let list=orders();if(state.filter!=='all')list=list.filter(o=>statusKey(o)===state.filter);const q=state.search.trim().toLowerCase();if(q)list=list.filter(o=>[o.order_number,o.id,o.title,o.student_name,o.student_phone].some(v=>String(v||'').toLowerCase().includes(q)));return `<section class="library-v116-panel"><div class="library-v116-toolbar"><input id="libraryV116Search" value="${escx(state.search)}" placeholder="ابحث برقم الطلب أو اسم الطالب" oninput="AlinLibraryV116.search(this.value)"><div class="library-v116-filter-row">${[['all','الكل'],['new','جديد'],['processing','قيد الطباعة'],['ready','جاهز'],['completed','تم التسليم'],['cancelled','ملغي']].map(([k,l])=>`<button class="${state.filter===k?'active':''}" onclick="AlinLibraryV116.filter('${k}')">${l}</button>`).join('')}</div></div><div class="library-v116-order-list">${list.map(orderCard).join('')||'<div class="library-v116-empty">لا توجد طلبات مطابقة</div>'}</div></section>`}
  function financeView(){
    const f=financeSummary();
    const movements=f.rows.slice(0,30).map(x=>`<div class="library-v120-movement"><div><b>${escx(x.order_number||x.order_id)}</b><small>${escx(x.title||'طلب مكتمل')} — استلمت المكتبة ${moneyx(x.gross)} د.ع</small></div><div class="library-v120-split"><span class="profit">ربح المكتبة +${moneyx(x.libraryProfit)} د.ع</span><span class="debt">بذمة المكتبة ${moneyx(x.debt)} د.ع</span></div></div>`).join('')||'<div class="library-v116-empty">لا توجد حركات مالية بعد</div>';
    const settlements=f.settlements.slice(0,15).map(x=>`<div class="library-v116-row"><div><b>${escx(x.receipt_number||x.id||'تسوية')}</b><small>${escx(x.created_at||'')} — ${escx(x.payment_method||'')}</small></div><span class="library-v116-money settled">-${moneyx(x.amount)} د.ع</span></div>`).join('')||'<div class="library-v116-empty">لا توجد تسويات مثبتة بعد</div>';
    return `<section class="library-v120-finance-cards"><article><small>إجمالي المبالغ المستلمة من الطلبات</small><strong>${moneyx(f.gross)} د.ع</strong></article><article class="profit"><small>أرباح المكتبة المتراكمة</small><strong>${moneyx(f.libraryProfit)} د.ع</strong></article><article><small>أرباح هذا الشهر</small><strong>${moneyx(f.monthProfit)} د.ع</strong></article><article class="debt"><small>المبلغ بذمة المكتبة</small><strong>${moneyx(f.debtRemaining)} د.ع</strong></article><article class="settled"><small>المبالغ المسددة للمدير</small><strong>${moneyx(f.settled)} د.ع</strong></article></section><section class="library-v116-grid library-v120-grid"><div class="library-v116-panel"><h3>تفاصيل الطلبات المالية</h3><p class="library-v120-help">عند تسليم الطلب يُثبت ربح المكتبة، ويُسجل باقي المبلغ بذمتها لحين تصفية المدير.</p><div class="library-v120-movements">${movements}</div></div><aside class="library-v116-panel"><h3>التسويات مع الإدارة</h3><div class="library-v120-debt-box"><small>المطلوب تسليمه حالياً</small><strong>${moneyx(f.debtRemaining)} د.ع</strong><span>إجمالي الذمة ${moneyx(f.debtTotal)} د.ع — المسدد ${moneyx(f.settled)} د.ع</span></div><div class="library-v116-list">${settlements}</div><div class="library-v116-note" style="margin-top:12px">التصفية يثبتها المدير فقط. بعد تسجيل كامل المبلغ تصبح الذمة صفراً، وتبقى أرباح المكتبة وسجل الحركات محفوظة.</div></aside></section>`
  }
  function notificationsView(){const ns=notifications();return `<section class="library-v116-panel"><div class="library-v116-toolbar"><h3>إشعارات المكتبة</h3><button onclick="AlinLibraryV116.markAllRead()">تحديد الكل كمقروء</button></div><div class="library-v116-list">${ns.map(n=>`<article class="library-v116-notification ${n.read_at?'':'unread'}"><b>${escx(n.title||'إشعار')}</b><p>${escx(n.message||n.text||'')}</p><small>${escx(n.created_at||'')}</small></article>`).join('')||'<div class="library-v116-empty">لا توجد إشعارات</div>'}</div></section>`}
  function settingsView(){const l=getLibrary()||{};return `<section class="library-v116-panel"><h3>إعدادات المكتبة</h3><div class="library-v116-settings"><div class="library-v116-field"><small>اسم المكتبة</small><b>${escx(l.name||'—')}</b></div><div class="library-v116-field"><small>المنطقة</small><b>${escx(l.area||'—')}</b></div><div class="library-v116-field"><small>أقرب نقطة دالة</small><b>${escx(l.landmark||'—')}</b></div><div class="library-v116-field"><small>واتساب</small><b>${escx(l.whatsapp||l.phone||'—')}</b></div><div class="library-v116-field"><small>اسم الدخول</small><b>${escx(l.username||currentUser()?.username||'—')}</b></div><div class="library-v116-field"><small>حالة المكتبة</small><b>${isOpen(l)?'مفتوحة':'مغلقة'}</b></div><div class="library-v116-settings-actions"><button onclick="AlinLibraryV116.toggleOpen()">${isOpen(l)?'إغلاق المكتبة':'فتح المكتبة'}</button><button class="secondary" onclick="alert('تغيير كلمة المرور يكون من إدارة الحسابات حالياً')">تغيير كلمة المرور</button><button class="logout" onclick="logout()">تسجيل الخروج</button></div></div></section>`}
  function render(){if(currentUser()?.role!=='library')return;updateHeader();document.querySelectorAll('.library-v116-tabs button').forEach(b=>b.classList.toggle('active',b.dataset.libraryTab===state.tab));const c=document.getElementById('libraryV116Content');if(!c)return;c.innerHTML=state.tab==='orders'?ordersView():state.tab==='finance'?financeView():state.tab==='notifications'?notificationsView():state.tab==='settings'?settingsView():home()}
  async function toggleOpen(){const lib=getLibrary();if(!lib)return alert('تعذر تحديد حساب المكتبة');const open=!isOpen(lib);try{if(typeof update==='function')await update('libraries',{is_open:open,open_status:open?'open':'closed'},{id:lib.id});lib.is_open=open;lib.open_status=open?'open':'closed';if(typeof audit==='function')await audit('library',open?'فتح المكتبة':'إغلاق المكتبة');if(typeof load==='function')await load();render()}catch(e){console.error(e);alert('تعذر تحديث حالة المكتبة') }}
  async function setStatus(id,status){try{if(typeof libraryOrderStatus==='function')await libraryOrderStatus(id,status);if(typeof load==='function')await load();render()}catch(e){console.error(e);alert('تعذر تحديث حالة الطلب')}}
  async function cancel(id){const reason=prompt('اكتب سبب الإلغاء');if(!reason)return;try{if(typeof update==='function')await update('orders',{status:'cancelled',cancel_reason:reason},{id});if(typeof audit==='function')await audit('order','المكتبة ألغت الطلب '+id+' — '+reason);if(typeof load==='function')await load();render()}catch(e){console.error(e);alert('تعذر إلغاء الطلب')}}
  function details(id){const o=orders().find(x=>eq(x.id,id));if(!o)return;const html=`<h2>تفاصيل الطلب</h2><div class="library-v116-list"><div class="library-v116-row"><b>رقم الطلب</b><span>${escx(o.order_number||o.id)}</span></div><div class="library-v116-row"><b>الطالب</b><span>${escx(o.student_name||'—')}</span></div><div class="library-v116-row"><b>الهاتف</b><span>${escx(o.student_phone||'—')}</span></div><div class="library-v116-row"><b>الطلب</b><span>${escx(o.title||'—')}</span></div><div class="library-v116-row"><b>الكمية</b><span>${o.qty||1}</span></div><div class="library-v116-row"><b>المبلغ</b><span>${moneyx(o.total||0)} د.ع</span></div><div class="library-v116-row"><b>الملاحظات</b><span>${escx(o.notes||o.note||'لا توجد')}</span></div></div>`;if(window.checkoutBox&&window.checkoutModal){checkoutBox.innerHTML=html;checkoutModal.classList.remove('hidden')}}
  function markAllRead(){notifications().forEach(n=>n.read_at=n.read_at||new Date().toISOString());render()}
  window.AlinLibraryV116={render,toggleOpen,setStatus,cancel,details,filter:k=>{state.filter=k;render()},search:q=>{state.search=q;render()},markAllRead};
  window.renderLibrary=render;window.AlinLibraryModules.renderLibrary=render;window.setLibraryOpen=toggleOpen;window.AlinLibraryModules.setLibraryOpen=toggleOpen;
  document.addEventListener('click',e=>{const b=e.target.closest('[data-library-tab]');if(!b)return;state.tab=b.dataset.libraryTab;render()});
  const boot=()=>{if(currentUser()?.role==='library')setTimeout(render,20)};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();


;

// === library/orders.js ===
/* ===== library/js/orders.js ===== */
/* V111: actual library code moved from core/js/platform-legacy.js */
window.AlinLibraryModules=window.AlinLibraryModules||{};
async function libraryOrderStatus(id,status){const o=db.orders.find(x=>x.id===id);const h=[...(o?.status_history||[]),{status,at:new Date().toISOString()}];await update('orders',{status,status_history:h},{id});await audit('order','المكتبة حدثت '+id+' إلى '+status);await load()}

libraryOrderStatus=async function(id,status){
  const o=db.orders.find(x=>x.id===id); if(!o)return;
  if(['processing','ready','completed'].includes(status)) await ensureOrderFinancials(o);
  const h=[...(o.status_history||[]),{status,at:new Date().toISOString()}];
  await update('orders',{status,status_history:h},{id});
  await audit('order','المكتبة حدثت '+id+' إلى '+status);
  await load();
};

libraryOrderStatus=async function(id,status){
  const o=db.orders.find(x=>x.id===id); if(!o)return;
  const h=[...(o.status_history||[]),{status,at:new Date().toISOString()}];
  await update('orders',{status,status_history:h},{id});
  o.status=status; o.status_history=h;
  if(status==='completed') await ensureOrderFinancials(o);
  await audit('order','المكتبة غيرت حالة الطلب '+(o.order_number||id)+' إلى '+status); await load(); renderLibrary();
};

async function openLibraryBookletPdf(orderId){
  const o=(db.orders||[]).find(x=>x.id===orderId);
  if(!o || o.kind!=='booklet') return alert('هذا الطلب لا يحتوي ملزمة PDF');
  const b=(db.booklets||[]).find(x=>x.id===o.item_id);
  if(!b?.file_path) return alert('لا يوجد ملف PDF لهذه الملزمة');
  const cleanUrl=mediaUrl(b.file_path);
  checkoutBox.innerHTML=`<h2>PDF الملزمة للمكتبة</h2><div class="print-only-note">جاري فحص رابط الملف...</div><div class="pdf-viewer loading-box">انتظر قليلاً</div><div class="row-actions no-print"><button class="secondary" onclick="closeCheckout()">إغلاق</button></div>`;
  checkoutModal.classList.remove('hidden');
  const ok=await checkPublicFile(cleanUrl);
  if(!ok){
    checkoutBox.innerHTML=`<h2>ملف الملزمة غير متاح</h2><div class="print-only-note">رابط الملف القديم غير صالح أو الملف غير مرفوع داخل alin-files. احذف الملزمة من لوحة المدير وارفع ملف PDF الحقيقي من جديد.</div><div class="empty">لن تظهر رسالة Bucket not found بعد الآن، لكن يجب إعادة رفع الملف الصحيح.</div><div class="row-actions no-print"><button class="secondary" onclick="closeCheckout()">إغلاق</button></div>`;
    return;
  }
  const url=cleanUrl+'#toolbar=0&navpanes=0&scrollbar=1';
  checkoutBox.innerHTML=`<h2>PDF الملزمة للمكتبة</h2><div class="print-only-note">هذا الملف يظهر للمكتبة فقط لغرض الطباعة. لا يظهر في المتجر للطالب.</div><div class="pdf-viewer"><iframe id="pdfFrame" src="${url}" oncontextmenu="return false"></iframe></div><div class="row-actions no-print"><button onclick="printPdfFrame()">طباعة</button><button class="secondary" onclick="closeCheckout()">إغلاق</button></div>`;
}

function selectedLibraryLine(){ const lib=db.accounts.libraries.find(x=>x.id===libSelect?.value); if(!lib){libInfo.innerHTML='';return;} libInfo.innerHTML=`<div class="library-one-line"><b>${esc(lib.name)}</b><span class="${libIsOpen(lib)?'open-badge':'closed-badge'}">${libIsOpen(lib)?'مفتوح':'مغلق'}</span><small>${esc(lib.area||'')} ${lib.landmark?'— '+esc(lib.landmark):''}</small></div>`; }

function alinLibraryOptions(){
  return alinOpenLibraries().map(x=>`<option value="${x.id}" ${alinLibOpen(x)?'':'disabled'}>${esc(x.name)} - ${alinLibOpen(x)?'مفتوح':'مغلق'}</option>`).join('');
}
window.AlinLibraryModules['libraryOrderStatus']=typeof libraryOrderStatus==='function'?libraryOrderStatus:window['libraryOrderStatus'];window['libraryOrderStatus']=window.AlinLibraryModules['libraryOrderStatus'];
window.AlinLibraryModules['openLibraryBookletPdf']=typeof openLibraryBookletPdf==='function'?openLibraryBookletPdf:window['openLibraryBookletPdf'];window['openLibraryBookletPdf']=window.AlinLibraryModules['openLibraryBookletPdf'];
window.AlinLibraryModules['selectedLibraryLine']=typeof selectedLibraryLine==='function'?selectedLibraryLine:window['selectedLibraryLine'];window['selectedLibraryLine']=window.AlinLibraryModules['selectedLibraryLine'];
window.AlinLibraryModules['alinLibraryOptions']=typeof alinLibraryOptions==='function'?alinLibraryOptions:window['alinLibraryOptions'];window['alinLibraryOptions']=window.AlinLibraryModules['alinLibraryOptions'];


;

// === library/finance.js ===
/* ===== library/js/finance.js ===== */
/* V111: actual library code moved from core/js/platform-legacy.js */
window.AlinLibraryModules=window.AlinLibraryModules||{};
async function recordLibrarySettlement(libraryId){
  const lib=(db.accounts.libraries||[]).find(x=>x.id===libraryId); if(!lib)return;
  const d=libDebt(libraryId);
  const amount=+(prompt('المتبقي على '+lib.name+' هو '+money(d.remaining)+' د.ع\nاكتب مبلغ التسوية المستلم من المكتبة')||0);
  if(amount<=0||amount>d.remaining)return alert('المبلغ غير صحيح أو أكبر من المتبقي');
  const method=prompt('طريقة الاستلام: نقدي / تحويل / زين كاش / آسيا حوالة','نقدي')||'نقدي';
  const periodFrom=prompt('من تاريخ اختياري YYYY-MM-DD','')||'';
  const periodTo=prompt('إلى تاريخ اختياري YYYY-MM-DD','')||'';
  const note=prompt('تفاصيل','')||'';
  const receipt=settlementNo();
  await insert('library_settlements',{id:uid('LS'),receipt_number:receipt,library_id:libraryId,amount,payment_method:method,period_from:periodFrom||null,period_to:periodTo||null,note,status:'received'});
  await audit('settlement','سند قبض تسوية مكتبة '+receipt);
  await load(); renderFinanceAdmin(); alert('تم تسجيل سند القبض '+receipt);
}

async function reverseLibrarySettlement(id){
  const s=librarySettlements.find(x=>x.id===id); if(!s||s.status==='reversed'||!confirm('إنشاء قيد عكسي لسند القبض؟'))return;
  await update('library_settlements',{status:'reversed'},{id});
  await insert('library_settlements',{id:uid('LS'),receipt_number:'RV-'+Date.now(),library_id:s.library_id,amount:s.amount,payment_method:s.payment_method,period_from:s.period_from,period_to:s.period_to,note:'قيد عكسي للسند '+s.receipt_number,status:'reversal',reversal_of:s.id});
  await audit('settlement','عكس سند قبض '+s.receipt_number);
  await load(); renderFinanceAdmin();
}

function printLibrarySettlement(id){
  const s=librarySettlements.find(x=>x.id===id); if(!s)return;
  const lib=(db.accounts.libraries||[]).find(x=>x.id===s.library_id)||{};
  const html=`<div dir="rtl" style="font-family:Arial;padding:24px"><h2>سند قبض تسوية مكتبة</h2><p><b>رقم السند:</b> ${esc(s.receipt_number)}</p><p><b>المكتبة:</b> ${esc(lib.name||'')}</p><p><b>المبلغ:</b> ${money(s.amount)} د.ع</p><p><b>طريقة الاستلام:</b> ${esc(s.payment_method||'')}</p><p><b>الفترة:</b> ${esc(s.period_from||'-')} إلى ${esc(s.period_to||'-')}</p><p><b>تفاصيل:</b> ${esc(s.note||'')}</p><hr><p>توقيع الإدارة: ____________</p><p>توقيع المكتبة: ____________</p></div>`;
  const w=window.open('','_blank'); w.document.write(html); w.document.close(); w.print();
}

function settlementRowsForLibrary(id){
  const entries=financialEntries.filter(x=>x.library_id===id);
  const gross=entries.reduce((a,x)=>a+(+x.gross||0),0);
  const libShare=entries.reduce((a,x)=>a+(+x.library_amount||0),0);
  const platform=entries.reduce((a,x)=>a+(+x.platform_amount||0),0);
  const teacher=entries.reduce((a,x)=>a+(+x.teacher_amount||0),0);
  const d=libDebt(id);
  return {gross,libShare,platform,teacher,owed:d.owed,paid:d.paid,remaining:d.remaining};
}

function printLibraryStatement(libraryId){
  const lib=(db.accounts.libraries||[]).find(x=>x.id===libraryId)||{};
  const r=settlementRowsForLibrary(libraryId);
  const rows=financialEntries.filter(x=>x.library_id===libraryId).map(x=>`<tr><td>${esc(x.order_number||x.order_id)}</td><td>${esc(x.title||'')}</td><td>${money(x.gross)}</td><td>${money(x.platform_amount)}</td><td>${money(x.teacher_amount)}</td><td>${money(x.library_amount)}</td></tr>`).join('');
  const html=`<div dir="rtl" style="font-family:Arial;padding:24px"><h2>كشف تسوية مكتبة</h2><p><b>المكتبة:</b> ${esc(lib.name||'')}</p><p><b>إجمالي المبيعات:</b> ${money(r.gross)} د.ع</p><p><b>حصة المكتبة:</b> ${money(r.libShare)} د.ع</p><p><b>المطلوب تسليمه:</b> ${money(r.owed)} د.ع | <b>المدفوع:</b> ${money(r.paid)} د.ع | <b>المتبقي:</b> ${money(r.remaining)} د.ع</p><table border="1" cellspacing="0" cellpadding="6" width="100%"><thead><tr><th>رقم الطلب</th><th>المادة</th><th>المبلغ</th><th>آلين</th><th>المدرس</th><th>المكتبة</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  const w=window.open('','_blank'); w.document.write(html); w.document.close(); w.print();
}

function alinV63LibraryDebt(libraryId){
  const ledgerRows=(db.ledger||[]).filter(x=>x.library_id===libraryId && x.settlement_status!=='cancelled');
  const owed=ledgerRows.reduce((a,x)=>a+(+x.admin||+x.alin||0)+(+x.teacher||0)+(+x.delegate||0),0);
  let paid=0;
  try{
    if(typeof librarySettlements!=='undefined'){
      paid=(librarySettlements||[]).filter(x=>x.library_id===libraryId && (x.status==='received'||x.status==='paid')).reduce((a,x)=>a+(+x.amount||0),0);
    }
  }catch(e){}
  try{
    const local=JSON.parse(localStorage.getItem('alin_v63_library_settlements')||'[]');
    paid += local.filter(x=>x.library_id===libraryId && x.status==='received').reduce((a,x)=>a+(+x.amount||0),0);
  }catch(e){}
  return {owed,paid,remaining:Math.max(0,owed-paid)};
}

async function alinV63PayLibrarySettlement(libraryId){
  const d=alinV63LibraryDebt(libraryId);
  if(d.remaining<=0) return toast('لا يوجد مبلغ بذمة المكتبة');
  const amount=+(prompt('المبلغ بذمة المكتبة: '+money(d.remaining)+' د.ع\nاكتب مبلغ التسوية المستلم من المكتبة', d.remaining)||0);
  if(!amount || amount<=0 || amount>d.remaining) return alert('المبلغ غير صحيح');
  const receipt='LS-'+new Date().toISOString().slice(0,10).replaceAll('-','')+'-'+Math.random().toString(36).slice(2,6).toUpperCase();
  const row={id:uid('LS'),receipt_number:receipt,library_id:libraryId,amount,status:'received',payment_method:'نقدي',created_at:new Date().toISOString(),note:'تسوية مكتبة من صفحة المكتبة'};
  let saved=false;
  try{
    await insert('library_settlements',row);
    if(typeof librarySettlements!=='undefined') librarySettlements.unshift(row);
    saved=true;
  }catch(e){
    try{
      const local=JSON.parse(localStorage.getItem('alin_v63_library_settlements')||'[]');
      local.unshift(row);
      localStorage.setItem('alin_v63_library_settlements',JSON.stringify(local));
      saved=true;
    }catch(_){}
  }
  await audit('finance','استلام تسوية مكتبة '+receipt+' بمبلغ '+amount);
  toast(saved?'تم تثبيت التسوية':'تعذر حفظ التسوية');
  await load();
  renderLibrary();
}

function alinV64LibraryDebt(libraryId){
  const ledgerRows=(db.ledger||[]).filter(x=>x.library_id===libraryId && x.settlement_status!=='cancelled');
  const owed=ledgerRows.reduce((a,x)=>a+(+x.admin||+x.alin||0)+(+x.teacher||0)+(+x.delegate||0),0);
  const paid=alinV64AllSettlements().filter(x=>x.library_id===libraryId && (x.status==='received'||x.status==='paid')).reduce((a,x)=>a+(+x.amount||0),0);
  return {owed,paid,remaining:Math.max(0,owed-paid)};
}

async function alinV64AdminSettleLibrary(libraryId){
  const lib=(db.accounts?.libraries||[]).find(x=>x.id===libraryId)||{};
  const d=alinV64LibraryDebt(libraryId);
  if(d.remaining<=0) return toast('لا يوجد مبلغ بذمة هذه المكتبة');
  const amount=+(prompt('تسوية مكتبة: '+(lib.name||'')+'\nالمتبقي بذمتها: '+money(d.remaining)+' د.ع\nاكتب المبلغ المستلم', d.remaining)||0);
  if(!amount || amount<=0 || amount>d.remaining) return alert('المبلغ غير صحيح');
  const method=prompt('طريقة الاستلام','نقدي')||'نقدي';
  const receipt='LS-'+new Date().toISOString().slice(0,10).replaceAll('-','')+'-'+Math.random().toString(36).slice(2,6).toUpperCase();
  const row={id:uid('LS'),receipt_number:receipt,library_id:libraryId,amount,status:'received',payment_method:method,note:'تثبيت تسوية من لوحة المدير',created_at:new Date().toISOString()};
  try{
    await insert('library_settlements',row);
    if(typeof librarySettlements!=='undefined') librarySettlements.unshift(row);
  }catch(e){
    const local=alinV64LocalSettlements();
    local.unshift(row);
    alinV64SaveLocalSettlements(local);
  }
  await audit('finance','تثبيت تسوية مكتبة '+(lib.name||libraryId)+' سند '+receipt+' مبلغ '+amount);
  toast('تم تثبيت التسوية وتحديث حساب المكتبة');
  await load();
  renderFinanceAdmin();
}

function alinV67SumLibraryProfitBalances(){
  return (db.accounts?.libraries||[]).reduce((a,l)=>a+(+alinV65Balance('library',l.id).remaining||0),0);
}

function alinV67SumLibrarySettlementDebt(){
  return (db.accounts?.libraries||[]).reduce((a,l)=>a+(+alinV64LibraryDebt(l.id).remaining||0),0);
}

function alinV67LibrarySettlementRows(){
  const libs=(db.accounts?.libraries||[]);
  return libs.map(l=>{
    const d=alinV64LibraryDebt(l.id);
    return `<div class="row settlement-row"><div><b>${esc(l.name||'مكتبة')}</b>
      <small>إجمالي المطلوب ${money(d.owed)} د.ع — المسدد ${money(d.paid)} د.ع — المتبقي ${money(d.remaining)} د.ع</small></div>
      <div class="row-actions"><button ${d.remaining<=0?'disabled':''} onclick="alinV64AdminSettleLibrary('${l.id}')">تثبيت تسوية</button></div></div>`;
  }).join('') || emptyState('لا توجد مكتبات');
}
window.AlinLibraryModules['recordLibrarySettlement']=typeof recordLibrarySettlement==='function'?recordLibrarySettlement:window['recordLibrarySettlement'];window['recordLibrarySettlement']=window.AlinLibraryModules['recordLibrarySettlement'];
window.AlinLibraryModules['reverseLibrarySettlement']=typeof reverseLibrarySettlement==='function'?reverseLibrarySettlement:window['reverseLibrarySettlement'];window['reverseLibrarySettlement']=window.AlinLibraryModules['reverseLibrarySettlement'];
window.AlinLibraryModules['printLibrarySettlement']=typeof printLibrarySettlement==='function'?printLibrarySettlement:window['printLibrarySettlement'];window['printLibrarySettlement']=window.AlinLibraryModules['printLibrarySettlement'];
window.AlinLibraryModules['settlementRowsForLibrary']=typeof settlementRowsForLibrary==='function'?settlementRowsForLibrary:window['settlementRowsForLibrary'];window['settlementRowsForLibrary']=window.AlinLibraryModules['settlementRowsForLibrary'];
window.AlinLibraryModules['printLibraryStatement']=typeof printLibraryStatement==='function'?printLibraryStatement:window['printLibraryStatement'];window['printLibraryStatement']=window.AlinLibraryModules['printLibraryStatement'];
window.AlinLibraryModules['alinV63LibraryDebt']=typeof alinV63LibraryDebt==='function'?alinV63LibraryDebt:window['alinV63LibraryDebt'];window['alinV63LibraryDebt']=window.AlinLibraryModules['alinV63LibraryDebt'];
window.AlinLibraryModules['alinV63PayLibrarySettlement']=typeof alinV63PayLibrarySettlement==='function'?alinV63PayLibrarySettlement:window['alinV63PayLibrarySettlement'];window['alinV63PayLibrarySettlement']=window.AlinLibraryModules['alinV63PayLibrarySettlement'];
window.AlinLibraryModules['alinV64LibraryDebt']=typeof alinV64LibraryDebt==='function'?alinV64LibraryDebt:window['alinV64LibraryDebt'];window['alinV64LibraryDebt']=window.AlinLibraryModules['alinV64LibraryDebt'];
window.AlinLibraryModules['alinV64AdminSettleLibrary']=typeof alinV64AdminSettleLibrary==='function'?alinV64AdminSettleLibrary:window['alinV64AdminSettleLibrary'];window['alinV64AdminSettleLibrary']=window.AlinLibraryModules['alinV64AdminSettleLibrary'];
window.AlinLibraryModules['alinV67SumLibraryProfitBalances']=typeof alinV67SumLibraryProfitBalances==='function'?alinV67SumLibraryProfitBalances:window['alinV67SumLibraryProfitBalances'];window['alinV67SumLibraryProfitBalances']=window.AlinLibraryModules['alinV67SumLibraryProfitBalances'];
window.AlinLibraryModules['alinV67SumLibrarySettlementDebt']=typeof alinV67SumLibrarySettlementDebt==='function'?alinV67SumLibrarySettlementDebt:window['alinV67SumLibrarySettlementDebt'];window['alinV67SumLibrarySettlementDebt']=window.AlinLibraryModules['alinV67SumLibrarySettlementDebt'];
window.AlinLibraryModules['alinV67LibrarySettlementRows']=typeof alinV67LibrarySettlementRows==='function'?alinV67LibrarySettlementRows:window['alinV67LibrarySettlementRows'];window['alinV67LibrarySettlementRows']=window.AlinLibraryModules['alinV67LibrarySettlementRows'];

/* ===== library/js/library-finance-v120.js ===== */
/* V120 - library collected cash, profit, debt and admin settlement */
(function(){
  const arr=v=>Array.isArray(v)?v:[];
  const n=v=>Number(v||0);
  const eq=(a,b)=>String(a??'')===String(b??'');
  const escx=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const moneyx=v=>typeof money==='function'?money(v):Number(v||0).toLocaleString('ar-IQ');

  function dbx(){return window.db||{accounts:{libraries:[]},orders:[],ledger:[]}}
  function allSettlements(){
    let rows=[];
    try{ if(typeof librarySettlements!=='undefined' && Array.isArray(librarySettlements)) rows=rows.concat(librarySettlements); }catch(_){ }
    rows=rows.concat(arr(dbx().library_settlements));
    try{ rows=rows.concat(JSON.parse(localStorage.getItem('alin_v63_library_settlements')||'[]')); }catch(_){ }
    const seen=new Set();
    return rows.filter(x=>{const k=String(x.id||x.receipt_number||JSON.stringify(x));if(seen.has(k))return false;seen.add(k);return true});
  }
  function validSettlementAmount(x){
    const s=String(x.status||'received').toLowerCase();
    if(['reversed','cancelled','rejected'].includes(s))return 0;
    if(s==='reversal')return -Math.abs(n(x.amount));
    if(['received','paid','completed','approved'].includes(s))return Math.abs(n(x.amount));
    return 0;
  }
  function isLibraryPickupLedger(row){
    const o=arr(dbx().orders).find(x=>eq(x.id,row.order_id));
    const f=String(o?.fulfillment_type||row.delivery_type||'pickup').toLowerCase();
    return !['delivery','home_delivery','courier','delegate'].includes(f);
  }
  function rowGross(row){
    if(n(row.total)>0)return n(row.total);
    return n(row.gross)||n(row.admin||row.alin)+n(row.teacher)+n(row.library||row.library_amount)+n(row.delegate);
  }
  function rowLibraryProfit(row){return n(row.library||row.library_amount)}
  function rowDebt(row){return Math.max(0,rowGross(row)-rowLibraryProfit(row))}

  function summary(libraryId){
    const rows=arr(dbx().ledger)
      .filter(x=>eq(x.library_id,libraryId)&&String(x.settlement_status||'')!=='cancelled'&&isLibraryPickupLedger(x))
      .map(x=>{
        const order=arr(dbx().orders).find(o=>eq(o.id,x.order_id))||{};
        return {...x,title:x.title||order.title||'',gross:rowGross(x),libraryProfit:rowLibraryProfit(x),debt:rowDebt(x),created_at:x.created_at||order.updated_at||order.created_at||''};
      })
      .sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));
    const settlements=allSettlements().filter(x=>eq(x.library_id,libraryId));
    const gross=rows.reduce((a,x)=>a+x.gross,0);
    const libraryProfit=rows.reduce((a,x)=>a+x.libraryProfit,0);
    const debtTotal=rows.reduce((a,x)=>a+x.debt,0);
    const settled=Math.max(0,settlements.reduce((a,x)=>a+validSettlementAmount(x),0));
    const month=new Date().toISOString().slice(0,7);
    const monthProfit=rows.filter(x=>String(x.created_at||'').slice(0,7)===month).reduce((a,x)=>a+x.libraryProfit,0);
    return {gross,libraryProfit,debtTotal,settled,debtRemaining:Math.max(0,debtTotal-settled),monthProfit,rows,settlements:settlements.sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')))};
  }

  async function settleLibrary(libraryId){
    const lib=arr(dbx().accounts?.libraries).find(x=>eq(x.id,libraryId))||{};
    const f=summary(libraryId);
    if(f.debtRemaining<=0)return alert('لا يوجد مبلغ بذمة هذه المكتبة');
    const raw=prompt(`المتبقي بذمة ${lib.name||'المكتبة'} هو ${moneyx(f.debtRemaining)} د.ع\nاكتب مبلغ التسوية المستلم`,String(f.debtRemaining));
    if(raw===null)return;
    const amount=n(String(raw).replace(/[,،]/g,''));
    if(amount<=0||amount>f.debtRemaining)return alert('المبلغ غير صحيح أو أكبر من المتبقي');
    const method=prompt('طريقة الاستلام','نقدي')||'نقدي';
    const receipt='LS-'+new Date().toISOString().slice(0,10).replaceAll('-','')+'-'+Math.random().toString(36).slice(2,6).toUpperCase();
    const row={id:typeof uid==='function'?uid('LS'):'LS-'+Date.now(),receipt_number:receipt,library_id:libraryId,amount,payment_method:method,status:'received',note:'تصفية ذمة مكتبة من لوحة المدير',created_at:new Date().toISOString()};
    let saved=false;
    try{ if(typeof insert==='function'){await insert('library_settlements',row);saved=true;} }catch(e){console.warn('library_settlements insert failed',e)}
    if(!saved){
      try{const local=JSON.parse(localStorage.getItem('alin_v63_library_settlements')||'[]');local.unshift(row);localStorage.setItem('alin_v63_library_settlements',JSON.stringify(local));saved=true;}catch(_){ }
    }
    try{if(typeof librarySettlements!=='undefined'&&Array.isArray(librarySettlements))librarySettlements.unshift(row)}catch(_){ }
    dbx().library_settlements=dbx().library_settlements||[];dbx().library_settlements.unshift(row);
    if(typeof audit==='function')await audit('finance',`تصفية مكتبة ${lib.name||libraryId} بمبلغ ${amount} — سند ${receipt}`);
    if(typeof load==='function')try{await load()}catch(_){ }
    alert(amount===f.debtRemaining?'تمت تصفية الحساب وأصبحت ذمة المكتبة صفراً':'تم تسجيل التسوية وتحديث المبلغ المتبقي');
    if(typeof renderFinanceAdmin==='function')renderFinanceAdmin();
  }

  async function completeLibraryOrder(id,status){
    const o=arr(dbx().orders).find(x=>eq(x.id,id));if(!o)return;
    const hist=[...(o.status_history||[]),{status,at:new Date().toISOString()}];
    const basic={status,status_history:hist};
    if(['completed','delivered','تم التسليم'].includes(status))basic.payment_status='paid';
    if(typeof update==='function')await update('orders',basic,{id});
    Object.assign(o,basic);
    if(['completed','delivered','تم التسليم'].includes(status)){
      try{
        if(typeof window.alinV57SettleOrder==='function')await window.alinV57SettleOrder(o);
        else if(typeof ensureOrderFinancials==='function')await ensureOrderFinancials(o);
      }catch(e){console.error('financial settlement failed',e)}
      const optional={cash_collected_by:'library',cash_collected_at:new Date().toISOString(),library_cash_collected:n(o.total)};
      try{if(typeof update==='function')await update('orders',optional,{id});Object.assign(o,optional)}catch(_){ }
    }
    if(typeof audit==='function')await audit('order',`المكتبة حدثت الطلب ${o.order_number||id} إلى ${status}`);
    if(typeof load==='function')await load();
    if(typeof renderLibrary==='function')renderLibrary();
  }

  function adminSection(){
    const libs=arr(dbx().accounts?.libraries);
    return `<section class="admin-v120-library-settlements"><div class="admin-v120-head"><div><h3>تسويات ذمم المكتبات</h3><p>عند تسليم الطلب تحتفظ المكتبة بربحها، ويبقى باقي المبلغ بذمتها حتى تثبيت التصفية.</p></div></div><div class="admin-v120-settlement-list">${libs.map(l=>{const f=summary(l.id);return `<article><div><b>${escx(l.name||'مكتبة')}</b><small>مبيعات مستلمة ${moneyx(f.gross)} د.ع — ربح المكتبة ${moneyx(f.libraryProfit)} د.ع</small></div><div class="admin-v120-values"><span>الذمة الأصلية <b>${moneyx(f.debtTotal)}</b></span><span>المسدد <b>${moneyx(f.settled)}</b></span><span class="remain">المتبقي <b>${moneyx(f.debtRemaining)}</b></span></div><button ${f.debtRemaining<=0?'disabled':''} onclick="AlinV120Finance.settle('${escx(l.id)}')">${f.debtRemaining<=0?'الحساب مصفّى':'تصفية الحساب'}</button></article>`}).join('')||'<div class="empty">لا توجد مكتبات</div>'}</div></section>`;
  }

  const oldRenderFinance=window.renderFinanceAdmin;
  if(typeof oldRenderFinance==='function'){
    window.renderFinanceAdmin=renderFinanceAdmin=function(){
      oldRenderFinance.apply(this,arguments);
      const root=document.getElementById('adminContent');
      if(root&&!root.querySelector('.admin-v120-library-settlements'))root.insertAdjacentHTML('beforeend',adminSection());
    };
  }

  window.AlinV120Finance={summary,settle:settleLibrary};
  window.libraryOrderStatus=completeLibraryOrder;
  window.AlinLibraryModules=window.AlinLibraryModules||{};
  window.AlinLibraryModules.libraryOrderStatus=completeLibraryOrder;
})();

/* ===== library/js/library-finance-v121.js ===== */

/* V121 - complete library finance suite */
(function(){
  const arr=v=>Array.isArray(v)?v:[]; const n=v=>Number(v||0); const eq=(a,b)=>String(a??'')===String(b??'');
  const escx=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const moneyx=v=>typeof money==='function'?money(v):n(v).toLocaleString('ar-IQ'); const dbx=()=>window.db||{};
  const localGet=(k,d=[])=>{try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(d))}catch(_){return d}};
  const localSet=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  function settlements(){const rows=[...arr(dbx().library_settlements),...localGet('alin_v63_library_settlements')];const seen=new Set();return rows.filter(x=>{const k=String(x.id||x.receipt_number);if(seen.has(k))return false;seen.add(k);return true})}
  function ledgerRows(libraryId){return arr(dbx().ledger).filter(x=>eq(x.library_id,libraryId)&&String(x.settlement_status||'')!=='cancelled').map(x=>{const o=arr(dbx().orders).find(y=>eq(y.id,x.order_id))||{};const gross=n(x.total)||n(x.gross)||n(x.admin||x.alin)+n(x.teacher)+n(x.library||x.library_amount)+n(x.delegate);const profit=n(x.library||x.library_amount);const reversal=n(x.reversal_amount||0);return {...x,order:o,gross,profit,debt:Math.max(0,gross-profit),reversal,at:x.created_at||o.updated_at||o.created_at||''}}).sort((a,b)=>String(b.at).localeCompare(String(a.at)))}
  function settlementValue(s){const st=String(s.status||'received').toLowerCase();if(['cancelled','rejected','reversed'].includes(st))return 0;if(st==='reversal')return -Math.abs(n(s.amount));return Math.abs(n(s.amount))}
  function summary(libraryId,period='all'){
    let rows=ledgerRows(libraryId); const now=new Date(); if(period==='day')rows=rows.filter(x=>String(x.at).slice(0,10)===now.toISOString().slice(0,10)); if(period==='month')rows=rows.filter(x=>String(x.at).slice(0,7)===now.toISOString().slice(0,7));
    const ss=settlements().filter(x=>eq(x.library_id,libraryId));const gross=rows.reduce((a,x)=>a+x.gross-x.reversal,0),profit=rows.reduce((a,x)=>a+x.profit-Math.min(x.profit,x.reversal),0),debt=rows.reduce((a,x)=>a+x.debt-Math.max(0,x.reversal-Math.min(x.profit,x.reversal)),0),paid=ss.reduce((a,x)=>a+settlementValue(x),0);return {rows,settlements:ss,gross,profit,debtTotal:Math.max(0,debt),settled:Math.max(0,paid),remaining:Math.max(0,debt-paid)}
  }
  function libraryId(){try{const c=window.current||{};const libs=arr(dbx().accounts?.libraries);const l=libs.find(x=>eq(x.id,c.library_id||c.id)||eq(x.username,c.username));return l?.id||c.library_id||c.id||''}catch(_){return''}}
  function libraryName(id){return arr(dbx().accounts?.libraries).find(x=>eq(x.id,id))?.name||'المكتبة'}
  function threshold(){return Math.max(0,n(localStorage.getItem('alin_v121_debt_threshold')||500000))}
  function auditLocal(action,details,meta={}){const rows=localGet('alin_v121_finance_audit');rows.unshift({id:'FA-'+Date.now(),action,details,actor:window.alinAccountantSession?'المحاسب':(window.current?.name||window.current?.role||'مستخدم'),created_at:new Date().toISOString(),...meta});localSet('alin_v121_finance_audit',rows.slice(0,1000));try{if(typeof audit==='function')audit('finance',details)}catch(_){}}
  function download(name,content,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},400)}
  function exportExcel(id,period='all'){const f=summary(id,period), rows=[['رقم الطلب','التاريخ','المبلغ المستلم','ربح المكتبة','الذمة','الحالة']];f.rows.forEach(x=>rows.push([x.order.order_number||x.order_id,x.at,x.gross,x.profit,x.debt,x.order.status||'']));rows.push([]);rows.push(['إجمالي المستلم',f.gross]);rows.push(['إجمالي الربح',f.profit]);rows.push(['الذمة',f.debtTotal]);rows.push(['المسدد',f.settled]);rows.push(['المتبقي',f.remaining]);const html='<html><meta charset="utf-8"><table>'+rows.map(r=>'<tr>'+r.map(c=>'<td>'+escx(c)+'</td>').join('')+'</tr>').join('')+'</table></html>';download('كشف-حساب-'+libraryName(id)+'.xls',html,'application/vnd.ms-excel;charset=utf-8');auditLocal('export_excel','تصدير كشف حساب Excel للمكتبة '+libraryName(id),{library_id:id})}
  function printReport(id,period='all'){const f=summary(id,period),w=window.open('','_blank','width=900,height=800');if(!w)return alert('اسمح بالنوافذ المنبثقة للطباعة');w.document.write(`<html dir="rtl"><head><meta charset="utf-8"><title>كشف حساب</title><style>body{font-family:Tahoma;padding:30px}h1{text-align:center}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;text-align:right}.sum{margin-top:20px;padding:15px;border:2px solid #111}</style></head><body><h1>كشف حساب ${escx(libraryName(id))}</h1><table><thead><tr><th>الطلب</th><th>التاريخ</th><th>المستلم</th><th>الربح</th><th>الذمة</th></tr></thead><tbody>${f.rows.map(x=>`<tr><td>${escx(x.order.order_number||x.order_id)}</td><td>${escx(x.at)}</td><td>${moneyx(x.gross)}</td><td>${moneyx(x.profit)}</td><td>${moneyx(x.debt)}</td></tr>`).join('')}</tbody></table><div class="sum">الإجمالي المستلم: ${moneyx(f.gross)} د.ع<br>ربح المكتبة: ${moneyx(f.profit)} د.ع<br>المتبقي بذمتها: ${moneyx(f.remaining)} د.ع</div><script>window.onload=()=>window.print()<\/script></body></html>`);w.document.close();auditLocal('export_pdf','طباعة/حفظ PDF لكشف حساب المكتبة '+libraryName(id),{library_id:id})}
  function receiptHtml(row){const remain=summary(row.library_id).remaining;return `<div class="v121-receipt"><div class="v121-receipt-head"><h2>منصة آلين</h2><p>سند قبض تسوية مكتبة</p></div><div class="v121-receipt-grid"><div class="v121-receipt-line"><span>رقم السند</span><b>${escx(row.receipt_number)}</b></div><div class="v121-receipt-line"><span>التاريخ</span><b>${escx(new Date(row.created_at).toLocaleString('ar-IQ'))}</b></div><div class="v121-receipt-line"><span>المكتبة</span><b>${escx(libraryName(row.library_id))}</b></div><div class="v121-receipt-line"><span>طريقة الاستلام</span><b>${escx(row.payment_method||'نقدي')}</b></div></div><div class="v121-receipt-line"><span>المبلغ المستلم</span><b>${moneyx(row.amount)} د.ع</b></div><div class="v121-receipt-line"><span>الرصيد المتبقي</span><b>${moneyx(remain)} د.ع</b></div><p>${escx(row.note||'تسوية ذمة المكتبة')}</p><button class="no-print" onclick="window.print()">طباعة السند</button></div>`}
  function showReceipt(row){if(window.checkoutBox&&window.checkoutModal){checkoutBox.innerHTML=receiptHtml(row);checkoutModal.classList.remove('hidden')}}
  async function settle(id){const f=summary(id);if(f.remaining<=0)return alert('لا توجد ذمة مستحقة');const raw=prompt(`المتبقي ${moneyx(f.remaining)} د.ع\nاكتب مبلغ التسوية الجزئية أو الكاملة`,String(f.remaining));if(raw===null)return;const amount=n(String(raw).replace(/[,،]/g,''));if(amount<=0||amount>f.remaining)return alert('المبلغ غير صحيح');const method=prompt('طريقة الاستلام','نقدي')||'نقدي';const row={id:'LS-'+Date.now(),receipt_number:'LS-'+new Date().toISOString().slice(0,10).replaceAll('-','')+'-'+Math.random().toString(36).slice(2,6).toUpperCase(),library_id:id,amount,payment_method:method,status:'received',note:'تسوية '+(amount===f.remaining?'كاملة':'جزئية')+' لذمة المكتبة',created_at:new Date().toISOString()};let saved=false;try{if(typeof insert==='function'){await insert('library_settlements',row);saved=true}}catch(e){console.warn(e)}if(!saved){const ls=localGet('alin_v63_library_settlements');ls.unshift(row);localSet('alin_v63_library_settlements',ls)}dbx().library_settlements=dbx().library_settlements||[];dbx().library_settlements.unshift(row);auditLocal('settlement',`تسوية ${libraryName(id)} بمبلغ ${amount}`,{library_id:id,amount,receipt_number:row.receipt_number});showReceipt(row);try{if(typeof load==='function')await load()}catch(_){}}
  function reverseOrder(id,reason){const o=arr(dbx().orders).find(x=>eq(x.id,id));if(!o)return;const rows=arr(dbx().ledger).filter(x=>eq(x.order_id,id));if(!rows.length)return;rows.forEach(x=>{if(x.reversal_amount)return;const rev={...x,id:'REV-'+Date.now()+'-'+Math.random().toString(36).slice(2,5),gross:-Math.abs(n(x.gross||x.total)),total:-Math.abs(n(x.total||x.gross)),admin:-Math.abs(n(x.admin||x.alin)),alin:-Math.abs(n(x.alin||x.admin)),teacher:-Math.abs(n(x.teacher)),library:-Math.abs(n(x.library||x.library_amount)),library_amount:-Math.abs(n(x.library_amount||x.library)),delegate:-Math.abs(n(x.delegate)),settlement_status:'reversal',reversal_of:x.id,note:'عكس مالي بسبب إلغاء/استرجاع: '+reason,created_at:new Date().toISOString()};dbx().ledger.push(rev);try{if(typeof insert==='function')insert('ledger',rev)}catch(_){}});auditLocal('reversal','عكس مالي للطلب '+(o.order_number||id)+' — '+reason,{order_id:id})}
  function enhanceLibrary(){const root=document.getElementById('libraryV116Content');if(!root||!root.querySelector('.library-v120-finance-cards')||root.querySelector('.v121-toolbar'))return;const id=libraryId(),f=summary(id),limit=threshold();const alert=f.remaining>=limit&&limit>0?`<div class="v121-alert">تنبيه: ذمة المكتبة بلغت ${moneyx(f.remaining)} د.ع وتجاوزت الحد المحدد ${moneyx(limit)} د.ع.</div>`:`<div class="v121-alert v121-ok">الوضع المالي ضمن الحد المحدد.</div>`;const rows=f.rows.map(x=>`<tr><td>${escx(x.order.order_number||x.order_id)}</td><td>${escx(String(x.at).slice(0,10))}</td><td>${moneyx(x.gross)}</td><td class="v121-positive">${moneyx(x.profit)}</td><td class="v121-negative">${moneyx(x.debt)}</td><td>${escx(x.order.status||'')}</td></tr>`).join('');root.insertAdjacentHTML('afterbegin',`<div class="v121-toolbar"><div><b>كشف الحساب المالي</b><small> تفاصيل كل طلب وتسوية محفوظة</small></div><div class="actions"><button onclick="AlinV121.exportExcel('${escx(id)}')">تصدير Excel</button><button onclick="AlinV121.printReport('${escx(id)}')">طباعة / PDF</button></div></div>${alert}<section class="library-v116-panel"><h3>كشف حساب مفصل</h3><div class="v121-statement"><table><thead><tr><th>الطلب</th><th>التاريخ</th><th>المستلم</th><th>ربح المكتبة</th><th>الذمة</th><th>الحالة</th></tr></thead><tbody>${rows||'<tr><td colspan="6">لا توجد حركات</td></tr>'}</tbody></table></div></section>`)}
  function adminSuite(){const root=document.getElementById('adminContent');if(!root||root.querySelector('.v121-admin-suite'))return;const libs=arr(dbx().accounts?.libraries),limit=threshold();const warnings=libs.filter(l=>summary(l.id).remaining>=limit&&limit>0);const auditRows=localGet('alin_v121_finance_audit').slice(0,30);root.insertAdjacentHTML('beforeend',`<section class="v121-admin-suite"><div class="v121-admin-card"><h3>إعدادات الذمم والتنبيهات</h3>${warnings.length?`<div class="v121-alert">${warnings.length} مكتبة تجاوزت حد الذمة المحدد.</div>`:'<div class="v121-alert v121-ok">لا توجد مكتبات متجاوزة للحد.</div>'}<div class="v121-setting-row"><label>حد تنبيه ذمة المكتبة<input id="v121Threshold" type="number" value="${limit}"></label><button onclick="AlinV121.saveThreshold()">حفظ الحد</button></div></div><div class="v121-admin-card"><h3>تقارير المكتبات</h3><div class="v121-statement"><table><thead><tr><th>المكتبة</th><th>اليوم</th><th>الشهر</th><th>الذمة الحالية</th><th>الإجراءات</th></tr></thead><tbody>${libs.map(l=>{const d=summary(l.id,'day'),m=summary(l.id,'month'),a=summary(l.id);return `<tr><td>${escx(l.name)}</td><td>${moneyx(d.gross)}</td><td>${moneyx(m.gross)}</td><td class="${a.remaining? 'v121-negative':'v121-positive'}">${moneyx(a.remaining)}</td><td><button onclick="AlinV121.settle('${escx(l.id)}')">تسوية جزئية</button> <button onclick="AlinV121.exportExcel('${escx(l.id)}')">Excel</button> <button onclick="AlinV121.printReport('${escx(l.id)}')">PDF</button></td></tr>`}).join('')}</tbody></table></div></div><div class="v121-admin-card"><h3>صلاحية المحاسب</h3><p class="v121-accountant-note">حساب المحاسب يعرض القسم المالي والتسويات والتقارير فقط.</p><div class="form-grid"><input id="v121AccUser" value="${escx(localStorage.getItem('alin_v121_accountant_user')||'accountant')}" placeholder="اسم دخول المحاسب"><input id="v121AccPass" type="password" placeholder="رمز جديد للمحاسب"></div><button onclick="AlinV121.saveAccountant()">حفظ حساب المحاسب</button></div><div class="v121-admin-card"><h3>سجل التدقيق المالي</h3><div class="v121-audit-list">${auditRows.map(x=>`<div class="v121-audit-row"><div><b>${escx(x.details)}</b><small>${escx(x.actor)} — ${escx(x.created_at)}</small></div><span>${escx(x.action)}</span></div>`).join('')||'لا توجد حركات بعد'}</div></div></section>`)}
  function saveThreshold(){const el=document.getElementById('v121Threshold');localStorage.setItem('alin_v121_debt_threshold',String(Math.max(0,n(el?.value))));auditLocal('settings','تحديث حد تنبيه ذمة المكتبات');alert('تم حفظ الحد');if(typeof renderFinanceAdmin==='function')renderFinanceAdmin()}
  function saveAccountant(){const u=document.getElementById('v121AccUser')?.value.trim(),p=document.getElementById('v121AccPass')?.value;if(!u)return alert('اكتب اسم الدخول');localStorage.setItem('alin_v121_accountant_user',u);if(p)localStorage.setItem('alin_v121_accountant_pass',p);auditLocal('settings','تحديث حساب المحاسب');alert('تم حفظ حساب المحاسب')}
  function accountantLogin(){const u=prompt('اسم دخول المحاسب');if(u===null)return;const p=prompt('الرمز السري');if(u===(localStorage.getItem('alin_v121_accountant_user')||'accountant')&&p===(localStorage.getItem('alin_v121_accountant_pass')||'1234')){window.alinAccountantSession=true;try{openPage('admin');adminTab('finance');setTimeout(()=>{document.querySelectorAll('.admin-tabs button').forEach(b=>b.style.display=b.textContent.includes('الأرباح')?'':'none');adminSuite()},100)}catch(e){console.error(e)}}else alert('بيانات المحاسب غير صحيحة')}
  function install(){
    document.querySelectorAll('.login-actions').forEach(box=>{if(!box.querySelector('[data-v121-accountant]')){const b=document.createElement('button');b.type='button';b.dataset.v121Accountant='1';b.textContent='دخول المحاسب';b.onclick=accountantLogin;box.appendChild(b)}});
    const oldRF=window.renderFinanceAdmin;if(typeof oldRF==='function')window.renderFinanceAdmin=function(){oldRF.apply(this,arguments);adminSuite()};
    if(window.AlinV120Finance)window.AlinV120Finance.settle=settle;
    if(window.AlinLibraryV116?.cancel){const old=window.AlinLibraryV116.cancel;window.AlinLibraryV116.cancel=async function(id){const o=arr(dbx().orders).find(x=>eq(x.id,id));const before=String(o?.status||'');await old(id);if(['completed','delivered'].includes(before)&&String(o?.status)==='cancelled')reverseOrder(id,o.cancel_reason||'إلغاء طلب')}}
    document.addEventListener('click',e=>{if(e.target.closest('[data-library-tab]'))setTimeout(enhanceLibrary,60)});setTimeout(enhanceLibrary,100);
  }
  window.AlinV121={summary,settle,exportExcel,printReport,showReceipt,saveThreshold,saveAccountant,accountantLogin,reverseOrder};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();


;

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
    try{
      if(typeof alinResolveStoredFile==='function'){
        const r=await alinResolveStoredFile(path,'booklets');
        if(r?.url) return r.url;
      }
    }catch(_){ }
    try{return typeof mediaUrl==='function'?mediaUrl(path):String(path||'');}catch(_){return String(path||'');}
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
      const canvas=document.createElement('canvas');
      canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
      canvas.setAttribute('aria-label',`صفحة ${n}`);
      wrap.append(label,canvas);pages.appendChild(wrap);
      await page.render({canvasContext:canvas.getContext('2d',{alpha:false}),viewport}).promise;
    }
    status.hidden=true;
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
      console.error('[Alin V119] preview error',err);
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
      console.error('[Alin V119] print error',err);
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

// === store/order-routing.js ===
/* ===== store/js/order-routing-v112.js ===== */
/* V113: reliable cart routing to library/courier */
(function(){
  const el=id=>document.getElementById(id);
  const val=id=>(el(id)?.value||'').trim();
  const num=v=>Number(v||0);
  const arr=v=>Array.isArray(v)?v:[];
  const eq=(a,b)=>String(a??'')===String(b??'');
  const orderNo=()=> 'AL-'+Date.now().toString().slice(-8)+'-'+Math.floor(Math.random()*90+10);
  function items(){ return typeof cart!=='undefined'&&Array.isArray(cart)?cart:[]; }
  function hasProducts(){ return items().some(x=>x.kind!=='booklet'); }
  function fulfillment(){ return document.querySelector('#checkoutBox input[name="fulfillment"]:checked')?.value||(hasProducts()?'home_delivery':'pickup'); }
  function libraryOpen(id){
    const lib=arr(window.db?.accounts?.libraries).find(x=>eq(x.id,id));
    if(!lib)return false;
    try{return typeof libIsOpen==='function'?!!libIsOpen(lib):!(lib.is_open===false||String(lib.is_open)==='false'||lib.open_status==='closed')}catch(_){return true}
  }
  function route(){
    const type=fulfillment();
    if(type==='pickup'){
      const libraryId=val('libSelect');
      if(!libraryId) throw new Error('اختر مكتبة الاستلام');
      if(!libraryOpen(libraryId)) throw new Error('المكتبة المختارة مغلقة حالياً');
      return {fulfillment_type:'pickup',delivery_type:'library',library_id:libraryId,pickup_library_id:libraryId,courier_id:null,delegate_id:null,delivery_area:null,delivery_address:null,delivery_landmark:null,delivery_fee:0,payment_method:'cash_at_library',payment_status:'cod_pending'};
    }
    const area=val('deliveryArea'), address=val('deliveryAddress'), landmark=val('deliveryLandmark');
    const latitude=val('deliveryLatitude'),longitude=val('deliveryLongitude'),locationUrl=val('deliveryLocationUrl'),locationAccuracy=val('deliveryLocationAccuracy');
    if(!area||!address) throw new Error('اختر المنطقة وأكمل العنوان الكامل');
    if(!landmark&&!latitude) throw new Error('حدد موقع GPS أو اكتب أقرب نقطة دالة بوضوح');
    let fee=0;try{if(typeof deliveryFee==='function')fee=num(deliveryFee())}catch(_){}
    return {fulfillment_type:'home_delivery',delivery_type:'courier',library_id:null,pickup_library_id:null,courier_id:null,delegate_id:null,delivery_area:area,delivery_address:address,delivery_landmark:landmark,delivery_latitude:latitude?num(latitude):null,delivery_longitude:longitude?num(longitude):null,delivery_location_url:locationUrl||null,delivery_location_accuracy:locationAccuracy?Math.round(num(locationAccuracy)):null,delivery_location_source:latitude?'student_device':'manual_address',delivery_fee:fee,payment_method:'cash_to_courier',payment_status:'cod_pending',assignment_status:'pending_admin'};
  }
  async function insertCompatible(payload){
    try{return await insert('orders',payload)}catch(e){
      const msg=String(e?.message||'').toLowerCase();
      if(!(msg.includes('column')||msg.includes('schema')||msg.includes('cache')))throw e;
      const fallback={id:payload.id,order_number:payload.order_number,kind:payload.kind,item_id:payload.item_id,title:payload.title,student_name:payload.student_name,student_phone:payload.student_phone,library_id:payload.library_id,courier_id:payload.courier_id,qty:payload.qty,unit_price:payload.unit_price,total:payload.total,discount:payload.discount||0,coupon_code:payload.coupon_code||null,status:payload.status,payment_status:payload.payment_status};
      return await insert('orders',fallback);
    }
  }
  async function create(){
    const submit=document.querySelector('#checkoutBox .alin-cart-submit');
    const oldText=submit?.textContent;
    try{
      if(submit){submit.disabled=true;submit.textContent='جاري إنشاء الطلب...'}
      const basket=items();
      if(!basket.length)throw new Error('السلة فارغة');
      const name=val('studentName'),phone=val('studentPhone');
      if(!name||!phone)throw new Error('أكمل اسم الطالب ورقم الهاتف');
      const routing=route(),coupon=typeof validCoupon==='function'?validCoupon(val('couponInput')):null,numbers=[];
      let deliveryAdded=false;
      for(const item of basket){
        const product=item.kind==='booklet'?null:arr(window.db?.products).find(p=>eq(p.id,item.id));
        const qty=Math.max(1,num(item.qty));
        if(product&&num(product.stock)<qty)throw new Error('الكمية غير متوفرة: '+item.title);
        const raw=num(item.price)*qty;
        let discount=0;if(coupon)discount=coupon.discount_type==='fixed'?Math.min(raw,num(coupon.discount_value)):Math.round(raw*(num(coupon.discount_value)/100));
        const extra={...routing};if(extra.fulfillment_type==='home_delivery'){extra.delivery_fee=deliveryAdded?0:routing.delivery_fee;deliveryAdded=true}
        const payload={id:uid('O'),order_number:orderNo(),kind:item.kind,item_id:item.id,title:item.title,student_name:name,student_phone:phone,qty,unit_price:num(item.price),total:raw-discount+num(extra.delivery_fee),discount,coupon_code:coupon?.code||null,status:'new',status_history:[{status:'new',at:new Date().toISOString()}],...extra};
        const saved=await insertCompatible(payload);numbers.push(saved?.order_number||payload.order_number);
      }
      if(coupon){try{await update('coupons',{used_count:num(coupon.used_count)+1},{id:coupon.id})}catch(_){}}
      try{await audit('order',routing.fulfillment_type==='pickup'?'إنشاء طلب وربطه بالمكتبة':'إنشاء طلب وربطه بالمندوب')}catch(_){}
      basket.splice(0,basket.length);if(typeof cartSave==='function')cartSave();try{sessionStorage.removeItem('alin_v162_checkout_gps')}catch(_){}
      try{await load()}catch(_){}
      if(window.current?.role==='library'&&typeof renderLibrary==='function')renderLibrary();
      checkoutBox.innerHTML=`<div class="alin-cart-success"><h2>تم إنشاء الطلب بنجاح</h2><p>${routing.fulfillment_type==='pickup'?'وصل الطلب إلى المكتبة المختارة.':'تم إرسال الطلب إلى قسم التوصيل.'}</p><div class="alin-order-numbers">${numbers.map(n=>`<b>${n}</b>`).join('')}</div><button onclick="closeCheckout()">إغلاق</button></div>`;
      if(typeof renderCartBadge==='function')renderCartBadge();
    }catch(e){
      const box=document.getElementById('alinCartError')||document.createElement('div');box.id='alinCartError';box.className='notice';box.textContent=e.message||'تعذر إنشاء الطلب';document.querySelector('#checkoutBox .alin-cart-side')?.prepend(box);
    }finally{if(submit){submit.disabled=false;submit.textContent=oldText||'تأكيد الطلب الآن'}}
  }
  window.confirmCartCheckout=create;window.alinConfirmRoutedCart=create;
  document.addEventListener('click',e=>{const b=e.target.closest('.alin-cart-submit');if(!b)return;e.preventDefault();e.stopImmediatePropagation();create()},true);
})();


;

// === store/delivery.js ===
/* ===== store/js/delivery-gps-v162.js ===== */
/* V162: student GPS point for delivery + map actions for admin/courier */
(function(){
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const areas=()=>Array.isArray(window.ALIN_KIRKUK_AREAS)&&window.ALIN_KIRKUK_AREAS.length?window.ALIN_KIRKUK_AREAS:[];
  const mapUrl=(lat,lng)=>lat&&lng?`https://www.google.com/maps?q=${encodeURIComponent(lat)},${encodeURIComponent(lng)}`:'';

  function areaOptions(selected=''){
    return `<option value="">اختر منطقة التوصيل في كركوك</option>`+areas().map(a=>`<option value="${esc(a)}" ${String(a)===String(selected)?'selected':''}>${esc(a)}</option>`).join('');
  }
  function gpsMarkup(){
    return `<section class="v162-gps-box" id="v162GpsBox">
      <div class="v162-gps-head"><div><b>نقطة موقع التوصيل GPS</b><small>تساعد المدير والمندوب على الوصول للعنوان بدقة.</small></div><span id="v162GpsStatus" class="v162-gps-status">غير محدد</span></div>
      <div class="v162-gps-actions">
        <button type="button" class="v162-gps-primary" onclick="alinV162UseCurrentLocation()"><span aria-hidden="true">⌖</span> استخدام موقعي الحالي</button>
        <button type="button" id="v162OpenMapBtn" class="secondary" onclick="alinV162OpenSelectedMap()" disabled>فتح الموقع على الخريطة</button>
        <button type="button" id="v162ClearGpsBtn" class="secondary" onclick="alinV162ClearGps()" hidden>مسح الموقع</button>
      </div>
      <div id="v162GpsDetails" class="v162-gps-details" hidden></div>
      <input type="hidden" id="deliveryLatitude"><input type="hidden" id="deliveryLongitude"><input type="hidden" id="deliveryLocationUrl"><input type="hidden" id="deliveryLocationAccuracy">
      <p class="v162-gps-note">يلزم السماح للموقع من المتصفح. إذا تعذر تحديد GPS، اكتب العنوان الكامل وأقرب نقطة دالة بدقة.</p>
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
      if(typeof toast==='function')toast('تعذر تحديد GPS. اسمح للموقع أو اكتب العنوان ونقطة الدلالة بدقة.');
    },{enableHighAccuracy:true,timeout:15000,maximumAge:30000});
  };
  window.alinV162OpenSelectedMap=function(){const u=$('#deliveryLocationUrl')?.value;if(u)window.open(u,'_blank','noopener')};
  window.alinV162ClearGps=function(){['deliveryLatitude','deliveryLongitude','deliveryLocationUrl','deliveryLocationAccuracy'].forEach(id=>{const e=document.getElementById(id);if(e)e.value=''});try{sessionStorage.removeItem(stateKey)}catch(_){};const st=$('#v162GpsStatus'),dt=$('#v162GpsDetails'),op=$('#v162OpenMapBtn'),cl=$('#v162ClearGpsBtn');if(st){st.textContent='غير محدد';st.classList.remove('is-set')}if(dt)dt.hidden=true;if(op)op.disabled=true;if(cl)cl.hidden=true};

  function installCartHook(){
    if(typeof window.openCart==='function'){
      const old=window.openCart;window.openCart=function(){const r=old.apply(this,arguments);setTimeout(enhanceDeliveryFields,0);return r};
    }
    if(typeof window.toggleDeliveryFields==='function'){
      const oldToggle=window.toggleDeliveryFields;window.toggleDeliveryFields=function(){const r=oldToggle.apply(this,arguments);setTimeout(enhanceDeliveryFields,0);return r};
    }
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

// === admin/dashboard.js ===
/* ===== admin/js/admin-dashboard-v122.js ===== */

(function(){
  const escv=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const moneyv=v=>typeof money==='function'?money(v):Number(v||0).toLocaleString('ar-IQ');
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
  function mark(tab){document.querySelectorAll('#adminPage .admin-tabs button').forEach(b=>{const m=(b.getAttribute('onclick')||'').match(/adminTab\('([^']+)'\)/);b.classList.toggle('active-admin-tab',m?.[1]===tab)})}
  function install(){
    const base=window.adminTab;
    if(typeof base==='function'&&!base.__v122){const wrapped=function(tab){window.activeAdminTab=tab;if(tab==='dashboard'){mark(tab);render();return}const result=base.apply(this,arguments);const content=document.getElementById('adminContent');if(content)delete content.dataset.adminV122;mark(tab);return result};wrapped.__v122=true;window.adminTab=wrapped;}
    const oldOpen=window.openPage;
    if(typeof oldOpen==='function'&&!oldOpen.__v122){const wrappedOpen=function(page){const r=oldOpen.apply(this,arguments);if(page==='admin'&&(!window.activeAdminTab||window.activeAdminTab==='accounts'))setTimeout(()=>window.adminTab?.('dashboard'),0);return r};wrappedOpen.__v122=true;window.openPage=wrappedOpen;}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();


;

// === admin/orders.js ===
/* ===== admin/js/admin-orders-v126.js ===== */
(function(){
  'use strict';
  const escv=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const moneyv=v=>typeof money==='function'?money(v):Number(v||0).toLocaleString('ar-IQ');
  const statusLabels={new:'جديد',payment_pending:'بانتظار الدفع',paid:'مدفوع',processing:'قيد التجهيز',printing:'قيد الطباعة',ready:'جاهز',completed:'مكتمل',delivered:'تم التسليم',cancelled:'ملغي'};
  const state={q:'',status:'',library:'',courier:'',kind:'',period:'all',from:'',to:''};
  const storeKey='alin_admin_order_meta_v126';
  const orders=()=>Array.isArray(window.db?.orders)?window.db.orders:[];
  const libraries=()=>Array.isArray(window.db?.accounts?.libraries)?window.db.accounts.libraries:[];
  const couriers=()=>Array.isArray(window.db?.accounts?.couriers)?window.db.accounts.couriers:(Array.isArray(window.db?.couriers)?window.db.couriers:[]);
  const libName=id=>libraries().find(x=>String(x.id)===String(id))?.name||'غير محددة';
  const courierName=id=>couriers().find(x=>String(x.id)===String(id))?.name||'غير معيّن';
  const statusOf=o=>o.status||o.payment_status||'new';
  const labelOf=o=>statusLabels[statusOf(o)]||statusOf(o)||'غير محدد';
  const dateOf=o=>new Date(o.created_at||o.createdAt||Date.now());
  const dateText=o=>{const d=dateOf(o);return isNaN(d)?'—':d.toLocaleString('ar-IQ')};
  const metaLoad=()=>{try{return JSON.parse(localStorage.getItem(storeKey)||'{}')}catch(_){return {}}};
  const metaSave=x=>localStorage.setItem(storeKey,JSON.stringify(x));
  function orderMeta(id){return metaLoad()[String(id)]||{notes:[],history:[]}}
  function addMeta(id,patch){const all=metaLoad(),key=String(id),old=all[key]||{notes:[],history:[]};all[key]={...old,...patch};metaSave(all);return all[key]}
  function addHistory(id,action,details=''){
    const m=orderMeta(id),actor=(window.current?.name||window.current?.username||'المدير');
    m.history=[...(m.history||[]),{at:new Date().toISOString(),actor,action,details}];addMeta(id,m);
  }
  function range(){
    const now=new Date(),start=new Date(now),end=new Date(now);
    start.setHours(0,0,0,0);end.setHours(23,59,59,999);
    if(state.period==='today')return [start,end];
    if(state.period==='week'){start.setDate(start.getDate()-6);return [start,end]}
    if(state.period==='month'){start.setDate(1);return [start,end]}
    if(state.period==='custom'){
      const f=state.from?new Date(state.from+'T00:00:00'):null,t=state.to?new Date(state.to+'T23:59:59'):null;return [f,t]
    }
    return [null,null];
  }
  function filtered(){
    const q=state.q.trim().toLowerCase(),[from,to]=range();
    return orders().filter(o=>{
      const d=dateOf(o),hay=[o.order_number,o.id,o.title,o.student_name,o.student_phone,libName(o.library_id||o.pickup_library_id),courierName(o.courier_id),o.delivery_address,o.address].join(' ').toLowerCase();
      return (!q||hay.includes(q))&&(!state.status||statusOf(o)===state.status)&&(!state.library||String(o.library_id||o.pickup_library_id||'')===state.library)&&(!state.courier||String(o.courier_id||'')===state.courier)&&(!state.kind||String(o.kind||'')===state.kind)&&(!from||d>=from)&&(!to||d<=to);
    }).sort((a,b)=>dateOf(b)-dateOf(a));
  }
  function overdue(o){const st=statusOf(o);return !['ready','completed','delivered','cancelled'].includes(st)&&Date.now()-dateOf(o).getTime()>24*60*60*1000}
  function render(){
    const content=document.getElementById('adminContent');if(!content)return;
    const all=orders(),list=filtered(),count=s=>all.filter(o=>statusOf(o)===s).length;
    const revenue=all.filter(o=>['completed','delivered'].includes(statusOf(o))).reduce((a,o)=>a+Number(o.total||0),0);
    content.innerHTML=`<section class="admin-orders-v126"><header class="admin-orders-v126-head"><div><h2>إدارة الطلبات</h2><p>متابعة كاملة للطلب، التعيين، السجل، الطباعة والتصدير.</p></div><div class="admin-orders-v126-head-actions"><button type="button" class="secondary" onclick="adminOrdersV126Export()">تصدير Excel</button><span>${list.length}</span></div></header>
    <section class="admin-orders-v126-stats"><article><small>كل الطلبات</small><strong>${all.length}</strong></article><article><small>جديدة</small><strong>${count('new')}</strong></article><article><small>قيد التنفيذ</small><strong>${count('processing')+count('printing')}</strong></article><article><small>متأخرة</small><strong>${all.filter(overdue).length}</strong></article><article><small>المبيعات المكتملة</small><strong>${moneyv(revenue)} د.ع</strong></article></section>
    <section class="admin-orders-v126-tools"><input id="adminOrderSearch" value="${escv(state.q)}" placeholder="رقم الطلب، اسم الطالب أو الهاتف"><select id="adminOrderStatus"><option value="">كل الحالات</option>${Object.entries(statusLabels).map(([k,v])=>`<option value="${k}" ${state.status===k?'selected':''}>${v}</option>`).join('')}</select><select id="adminOrderLibrary"><option value="">كل المكتبات</option>${libraries().map(x=>`<option value="${escv(x.id)}" ${state.library===String(x.id)?'selected':''}>${escv(x.name)}</option>`).join('')}</select><select id="adminOrderCourier"><option value="">كل المندوبين</option>${couriers().map(x=>`<option value="${escv(x.id)}" ${state.courier===String(x.id)?'selected':''}>${escv(x.name)}</option>`).join('')}</select><select id="adminOrderKind"><option value="">كل الأنواع</option><option value="booklet" ${state.kind==='booklet'?'selected':''}>ملازم</option><option value="stationery" ${state.kind==='stationery'?'selected':''}>قرطاسية</option><option value="gift" ${state.kind==='gift'?'selected':''}>هدايا</option><option value="product" ${state.kind==='product'?'selected':''}>منتج</option></select><select id="adminOrderPeriod"><option value="all" ${state.period==='all'?'selected':''}>كل التواريخ</option><option value="today" ${state.period==='today'?'selected':''}>اليوم</option><option value="week" ${state.period==='week'?'selected':''}>آخر 7 أيام</option><option value="month" ${state.period==='month'?'selected':''}>هذا الشهر</option><option value="custom" ${state.period==='custom'?'selected':''}>فترة مخصصة</option></select><input id="adminOrderFrom" type="date" value="${escv(state.from)}" ${state.period==='custom'?'':'hidden'}><input id="adminOrderTo" type="date" value="${escv(state.to)}" ${state.period==='custom'?'':'hidden'}><button type="button" onclick="adminOrdersV126Clear()">مسح</button></section>
    <section class="admin-orders-v126-list">${list.length?list.map(orderCard).join(''):'<div class="admin-orders-v126-empty">لا توجد طلبات مطابقة.</div>'}</section></section>`;
    bind();
  }
  function orderCard(o){
    const st=statusOf(o),late=overdue(o),m=orderMeta(o.id),notes=(m.notes||[]).length;
    return `<article class="admin-order-v126 ${late?'is-overdue':''}"><div class="admin-order-v126-main"><div class="admin-order-v126-title"><span>${escv(o.order_number||o.id)}</span><b>${escv(o.title||'طلب')} × ${Number(o.qty||1)}</b>${late?'<em>متأخر</em>':''}</div><small>${escv(o.student_name||'بدون اسم')} • ${escv(o.student_phone||'بدون هاتف')}</small></div><div class="admin-order-v126-meta"><span>المبلغ <b>${moneyv(o.total||0)} د.ع</b></span><span>المكتبة <b>${escv(libName(o.library_id||o.pickup_library_id))}</b></span><span>المندوب <b>${escv(courierName(o.courier_id))}</b></span></div><div class="admin-order-v126-state"><span class="pill ${escv(st)}">${escv(labelOf(o))}</span><small>${escv(dateText(o))}</small>${notes?`<small>ملاحظات الإدارة: ${notes}</small>`:''}</div><div class="admin-order-v126-actions"><button class="secondary" onclick="adminOrdersV126Details('${escv(o.id)}')">تفاصيل</button><button class="secondary" onclick="adminOrdersV126Print('${escv(o.id)}')">وصل</button>${o.student_phone?`<button class="whatsapp" onclick="adminOrdersV126Whatsapp('${escv(o.id)}')">واتساب</button>`:''}</div></article>`;
  }
  function bind(){
    const map={adminOrderSearch:['q','input'],adminOrderStatus:['status','change'],adminOrderLibrary:['library','change'],adminOrderCourier:['courier','change'],adminOrderKind:['kind','change'],adminOrderPeriod:['period','change'],adminOrderFrom:['from','change'],adminOrderTo:['to','change']};
    Object.entries(map).forEach(([id,[key,event]])=>{const el=document.getElementById(id);if(el)el.addEventListener(event,()=>{state[key]=el.value;render()})});
  }
  window.adminOrdersV126Clear=()=>{Object.assign(state,{q:'',status:'',library:'',courier:'',kind:'',period:'all',from:'',to:''});render()};
  async function safeUpdate(id,patch){
    if(typeof update!=='function')throw new Error('دالة التحديث غير متاحة');
    try{await update('orders',patch,{id})}catch(e){
      const safe={};['status','library_id','pickup_library_id','courier_id'].forEach(k=>{if(k in patch)safe[k]=patch[k]});
      if(!Object.keys(safe).length)throw e;await update('orders',safe,{id});
    }
    if(typeof load==='function')await load();
  }
  window.adminOrdersV126Status=async(id,status,reason='')=>{try{await safeUpdate(id,{status,cancellation_reason:reason||null});addHistory(id,'تغيير الحالة',`${labelOf({status})}${reason?' — '+reason:''}`);if(typeof audit==='function')await audit('order',`تحديث الطلب ${id} إلى ${status}${reason?' بسبب: '+reason:''}`);render();if(typeof toast==='function')toast('تم تحديث حالة الطلب')}catch(e){alert('تعذر تحديث الطلب: '+e.message)}};
  window.adminOrdersV126Assign=async(id)=>{const lib=document.getElementById('v126AssignLibrary')?.value||null,courier=document.getElementById('v126AssignCourier')?.value||null;try{await safeUpdate(id,{library_id:lib,pickup_library_id:lib,courier_id:courier});addHistory(id,'تعيين الطلب',`المكتبة: ${libName(lib)}، المندوب: ${courierName(courier)}`);if(typeof audit==='function')await audit('order',`تعيين الطلب ${id}`);render();adminOrdersV126Details(id);if(typeof toast==='function')toast('تم حفظ التعيين')}catch(e){alert('تعذر حفظ التعيين: '+e.message)}};
  window.adminOrdersV126AddNote=id=>{const input=document.getElementById('v126AdminNote'),text=input?.value.trim();if(!text)return alert('اكتب الملاحظة أولاً');const m=orderMeta(id);m.notes=[...(m.notes||[]),{at:new Date().toISOString(),actor:window.current?.name||'المدير',text}];addMeta(id,m);addHistory(id,'ملاحظة إدارية',text);if(input)input.value='';adminOrdersV126Details(id)};
  window.adminOrdersV126Cancel=id=>{const reason=prompt('اكتب سبب إلغاء الطلب:');if(reason===null)return;if(!reason.trim())return alert('سبب الإلغاء مطلوب');adminOrdersV126Status(id,'cancelled',reason.trim());document.getElementById('adminOrderDetailsModal')?.classList.add('hidden')};
  window.adminOrdersV126Whatsapp=id=>{const o=orders().find(x=>String(x.id)===String(id));if(!o?.student_phone)return alert('لا يوجد رقم هاتف');let phone=String(o.student_phone).replace(/\D/g,'');if(phone.startsWith('0'))phone='964'+phone.slice(1);const text=encodeURIComponent(`مرحباً ${o.student_name||''}، بخصوص طلبك رقم ${o.order_number||o.id} في منصة آلين، حالته الحالية: ${labelOf(o)}.`);window.open(`https://wa.me/${phone}?text=${text}`,'_blank','noopener')};
  window.adminOrdersV126Print=id=>{const o=orders().find(x=>String(x.id)===String(id));if(!o)return;const w=window.open('','_blank','width=760,height=900');if(!w)return alert('اسمح بالنوافذ المنبثقة للطباعة');w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>وصل طلب ${escv(o.order_number||o.id)}</title><style>body{font-family:Tahoma;padding:36px;color:#102b50}.receipt{max-width:680px;margin:auto;border:1px solid #dbe3ed;border-radius:24px;padding:28px}.brand{text-align:center;border-bottom:2px solid #d9a72d;padding-bottom:16px}.brand h1{margin:0}.row{display:flex;justify-content:space-between;padding:11px 0;border-bottom:1px dashed #dbe3ed}.total{font-size:22px;font-weight:bold;color:#96680f}.note{margin-top:20px;color:#667085;text-align:center}@media print{button{display:none}}</style></head><body><div class="receipt"><div class="brand"><h1>منصة آلين</h1><p>وصل طلب</p></div><div class="row"><span>رقم الطلب</span><b>${escv(o.order_number||o.id)}</b></div><div class="row"><span>الطالب</span><b>${escv(o.student_name||'—')}</b></div><div class="row"><span>الهاتف</span><b>${escv(o.student_phone||'—')}</b></div><div class="row"><span>العنصر</span><b>${escv(o.title||'—')} × ${Number(o.qty||1)}</b></div><div class="row"><span>المكتبة</span><b>${escv(libName(o.library_id||o.pickup_library_id))}</b></div><div class="row"><span>المندوب</span><b>${escv(courierName(o.courier_id))}</b></div><div class="row"><span>الحالة</span><b>${escv(labelOf(o))}</b></div><div class="row total"><span>الإجمالي</span><b>${moneyv(o.total||0)} د.ع</b></div><p class="note">تاريخ الطباعة: ${new Date().toLocaleString('ar-IQ')}</p><button onclick="print()">طباعة</button></div></body></html>`);w.document.close();w.focus()};
  window.adminOrdersV126Export=()=>{const list=filtered(),rows=[['رقم الطلب','الطالب','الهاتف','العنصر','الكمية','الإجمالي','الحالة','المكتبة','المندوب','التاريخ'],...list.map(o=>[o.order_number||o.id,o.student_name||'',o.student_phone||'',o.title||'',o.qty||1,o.total||0,labelOf(o),libName(o.library_id||o.pickup_library_id),courierName(o.courier_id),dateText(o)])];const csv='\ufeff'+rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`alin-orders-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(a.href)};
  window.adminOrdersV126Details=id=>{
    const o=orders().find(x=>String(x.id)===String(id));if(!o)return;const m=orderMeta(id);
    let modal=document.getElementById('adminOrderDetailsModal');if(!modal){modal=document.createElement('div');modal.id='adminOrderDetailsModal';modal.className='modal hidden';modal.innerHTML='<div class="modal-card"><button class="x" onclick="document.getElementById(\'adminOrderDetailsModal\').classList.add(\'hidden\')">×</button><div id="adminOrderDetailsBox"></div></div>';document.body.appendChild(modal)}
    const box=document.getElementById('adminOrderDetailsBox');
    box.innerHTML=`<div class="v126-detail-head"><div><small>رقم الطلب</small><h2>${escv(o.order_number||o.id)}</h2></div><span class="pill ${escv(statusOf(o))}">${escv(labelOf(o))}</span></div><section class="v126-detail-grid"><div><small>الطالب</small><b>${escv(o.student_name||'—')}</b></div><div><small>الهاتف</small><b>${escv(o.student_phone||'—')}</b></div><div><small>العنصر</small><b>${escv(o.title||'—')}</b></div><div><small>الكمية</small><b>${Number(o.qty||1)}</b></div><div><small>الإجمالي</small><b>${moneyv(o.total||0)} د.ع</b></div><div><small>طريقة الاستلام</small><b>${escv(o.fulfillment_type||o.delivery_type||'استلام من المكتبة')}</b></div><div><small>العنوان</small><b>${escv(o.delivery_address||o.address||'—')}</b></div><div><small>ملاحظات الطالب</small><b>${escv(o.notes||'—')}</b></div></section><section class="v126-assign"><h3>تعيين الطلب</h3><select id="v126AssignLibrary"><option value="">بدون مكتبة</option>${libraries().map(x=>`<option value="${escv(x.id)}" ${String(o.library_id||o.pickup_library_id||'')===String(x.id)?'selected':''}>${escv(x.name)}</option>`).join('')}</select><select id="v126AssignCourier"><option value="">بدون مندوب</option>${couriers().map(x=>`<option value="${escv(x.id)}" ${String(o.courier_id||'')===String(x.id)?'selected':''}>${escv(x.name)}</option>`).join('')}</select><button onclick="adminOrdersV126Assign('${escv(o.id)}')">حفظ التعيين</button></section><section class="v126-notes"><h3>ملاحظات الإدارة</h3><div class="v126-note-form"><textarea id="v126AdminNote" placeholder="اكتب ملاحظة داخلية على الطلب"></textarea><button onclick="adminOrdersV126AddNote('${escv(o.id)}')">إضافة</button></div>${(m.notes||[]).slice().reverse().map(n=>`<article><b>${escv(n.actor||'المدير')}</b><small>${escv(new Date(n.at).toLocaleString('ar-IQ'))}</small><p>${escv(n.text)}</p></article>`).join('')||'<p class="muted">لا توجد ملاحظات إدارية.</p>'}</section><section class="v126-history"><h3>سجل حركة الطلب</h3>${(m.history||[]).slice().reverse().map(h=>`<article><b>${escv(h.action)}</b><span>${escv(h.actor||'المدير')}</span><small>${escv(new Date(h.at).toLocaleString('ar-IQ'))}</small><p>${escv(h.details||'')}</p></article>`).join('')||'<p class="muted">لا توجد حركة مسجلة بعد.</p>'}</section><div class="v126-detail-actions"><button onclick="adminOrdersV126Status('${escv(o.id)}','processing')">قيد التجهيز</button><button onclick="adminOrdersV126Status('${escv(o.id)}','ready')">جاهز</button><button onclick="adminOrdersV126Status('${escv(o.id)}','completed')">مكتمل</button><button class="secondary" onclick="adminOrdersV126Print('${escv(o.id)}')">طباعة وصل</button>${o.student_phone?`<button class="whatsapp" onclick="adminOrdersV126Whatsapp('${escv(o.id)}')">واتساب</button>`:''}<button class="danger" onclick="adminOrdersV126Cancel('${escv(o.id)}')">إلغاء مع سبب</button></div>`;
    modal.classList.remove('hidden');
  };
  const boot=()=>{window.renderOrdersAdmin=render;const oldTab=window.adminTab;if(typeof oldTab==='function'&&!oldTab.__v126){const wrapped=function(t){if(t==='orders'){if(typeof markAdminTab==='function')markAdminTab(t);if(typeof adminStatsRender==='function')adminStatsRender();return render()}return oldTab.apply(this,arguments)};wrapped.__v126=true;window.adminTab=wrapped}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();


;

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

// === admin/products.js ===
/* ===== admin/js/admin-products-v129.js ===== */
(function(){
  const state={q:'',type:'',status:'',stock:'',price:'',sort:'newest'};
  const $=s=>document.querySelector(s);
  const escv=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const moneyv=v=>typeof money==='function'?money(v):Number(v||0).toLocaleString('ar-IQ');
  const products=()=>Array.isArray(window.db?.products)?window.db.products:(typeof db!=='undefined'&&Array.isArray(db.products)?db.products:[]);
  const categories=()=>Array.isArray(window.db?.categories)?window.db.categories:(typeof db!=='undefined'&&Array.isArray(db.categories)?db.categories:[]);
  const statusLabel=s=>({published:'منشور',hidden:'مخفي',draft:'مسودة',inactive:'غير فعال',archived:'مؤرشف'}[String(s||'published').toLowerCase()]||'منشور');
  const typeLabel=t=>String(t)==='gift'?'هدايا':'قرطاسية';
  const imageUrl=p=>{const x=p?.image_path||p?.image_url||p?.image||'';try{return x&&typeof mediaUrl==='function'?mediaUrl(x):x}catch(_){return x}};
  const lowLimit=p=>Number(p?.low_stock_limit||window.db?.settings?.low_stock_default||5);
  function filterList(){
    let list=[...products()];
    const q=state.q.trim().toLowerCase();
    if(q)list=list.filter(p=>[p.name,p.title,p.category,p.description].some(v=>String(v||'').toLowerCase().includes(q)));
    if(state.type)list=list.filter(p=>String(p.type||'stationery')===state.type);
    if(state.status)list=list.filter(p=>String(p.status||'published')===state.status);
    if(state.stock==='out')list=list.filter(p=>Number(p.stock)<=0);
    if(state.stock==='low')list=list.filter(p=>Number(p.stock)>0&&Number(p.stock)<=lowLimit(p));
    if(state.stock==='available')list=list.filter(p=>Number(p.stock)>lowLimit(p));
    if(state.price==='under10')list=list.filter(p=>Number(p.price)<10000);
    if(state.price==='10to25')list=list.filter(p=>Number(p.price)>=10000&&Number(p.price)<=25000);
    if(state.price==='over25')list=list.filter(p=>Number(p.price)>25000);
    if(state.sort==='name')list.sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'ar'));
    else if(state.sort==='priceAsc')list.sort((a,b)=>Number(a.price)-Number(b.price));
    else if(state.sort==='priceDesc')list.sort((a,b)=>Number(b.price)-Number(a.price));
    else if(state.sort==='stock')list.sort((a,b)=>Number(a.stock)-Number(b.stock));
    else list.sort((a,b)=>String(b.created_at||b.id||'').localeCompare(String(a.created_at||a.id||'')));
    return list;
  }
  function stats(){const all=products();return {all:all.length,published:all.filter(x=>String(x.status||'published')==='published').length,hidden:all.filter(x=>String(x.status)==='hidden').length,out:all.filter(x=>Number(x.stock)<=0).length,low:all.filter(x=>Number(x.stock)>0&&Number(x.stock)<=lowLimit(x)).length}}
  function stockClass(p){const n=Number(p.stock);return n<=0?'out':n<=lowLimit(p)?'low':'ok'}
  function productCard(p){
    const img=imageUrl(p),st=stockClass(p),published=String(p.status||'published')==='published';
    return `<article class="admin-product-v129-card">
      <div class="admin-product-v129-image">${img?`<img src="${escv(img)}" alt="${escv(p.name||'منتج')}">`:`<span>${String(p.type)==='gift'?'🎁':'✏️'}</span>`}<em class="status ${escv(String(p.status||'published'))}">${statusLabel(p.status)}</em></div>
      <div class="admin-product-v129-body">
        <div class="admin-product-v129-title"><div><small>${typeLabel(p.type)} • ${escv(p.category||'عام')}</small><h3>${escv(p.name||p.title||'منتج')}</h3></div><strong>${moneyv(p.price)} د.ع</strong></div>
        <div class="admin-product-v129-meta"><span class="stock ${st}">${st==='out'?'نافد':st==='low'?'مخزون قليل':'متوفر'}: ${moneyv(p.stock||0)}</span><span>الرمز: ${escv(p.id||'—')}</span></div>
        <div class="admin-product-v129-actions">
          <button type="button" class="secondary" onclick="adminProductsV129Preview('${escv(p.id)}')">معاينة</button>
          <button type="button" class="secondary" onclick="editProduct('${escv(p.id)}')">تعديل</button>
          <button type="button" onclick="setProductStatus('${escv(p.id)}','${published?'hidden':'published'}')">${published?'إخفاء':'نشر'}</button>
          <button type="button" class="danger" onclick="deleteProduct('${escv(p.id)}')">حذف</button>
        </div>
      </div>
    </article>`;
  }
  function existingForm(){
    return `<details class="admin-products-v129-add"><summary>إضافة منتج جديد</summary><form id="productForm" class="form-grid"><select name="type" id="productType" onchange="refreshProductCategories()"><option value="stationery">قرطاسية</option><option value="gift">هدايا</option></select><input name="name" placeholder="اسم المنتج"><select name="category" id="productCategory"></select><input name="price" type="number" min="0" placeholder="السعر"><input name="stock" type="number" min="0" placeholder="المخزون"><label>صورة المنتج<input name="image" type="file" accept="image/*"></label><button type="button" onclick="addProduct()">إضافة المنتج</button></form></details>`;
  }
  function render(){
    const root=document.getElementById('adminContent');if(!root)return;
    const s=stats(),list=filterList();
    root.innerHTML=`<section class="admin-products-v129">
      <header class="admin-products-v129-head"><div><h2>إدارة المنتجات</h2><p>متابعة القرطاسية والهدايا والمخزون وحالة ظهورها في المتجر.</p></div><span>${list.length} منتج</span></header>
      <section class="admin-products-v129-stats"><article><small>إجمالي المنتجات</small><strong>${s.all}</strong></article><article><small>المنشورة</small><strong>${s.published}</strong></article><article><small>المخفية</small><strong>${s.hidden}</strong></article><article class="warn"><small>قليل المخزون</small><strong>${s.low}</strong></article><article class="danger"><small>النافدة</small><strong>${s.out}</strong></article></section>
      <section class="admin-products-v129-tools"><input id="adminProductSearch" value="${escv(state.q)}" placeholder="ابحث باسم المنتج أو القسم"><select id="adminProductType"><option value="">كل الأقسام</option><option value="stationery" ${state.type==='stationery'?'selected':''}>قرطاسية</option><option value="gift" ${state.type==='gift'?'selected':''}>هدايا</option></select><select id="adminProductStatus"><option value="">كل الحالات</option><option value="published" ${state.status==='published'?'selected':''}>منشور</option><option value="hidden" ${state.status==='hidden'?'selected':''}>مخفي</option><option value="draft" ${state.status==='draft'?'selected':''}>مسودة</option></select><select id="adminProductStock"><option value="">كل المخزون</option><option value="available" ${state.stock==='available'?'selected':''}>متوفر</option><option value="low" ${state.stock==='low'?'selected':''}>قليل المخزون</option><option value="out" ${state.stock==='out'?'selected':''}>نافد</option></select><select id="adminProductPrice"><option value="">كل الأسعار</option><option value="under10" ${state.price==='under10'?'selected':''}>أقل من 10 آلاف</option><option value="10to25" ${state.price==='10to25'?'selected':''}>10–25 ألف</option><option value="over25" ${state.price==='over25'?'selected':''}>أكثر من 25 ألف</option></select><select id="adminProductSort"><option value="newest" ${state.sort==='newest'?'selected':''}>الأحدث</option><option value="name" ${state.sort==='name'?'selected':''}>الاسم</option><option value="priceAsc" ${state.sort==='priceAsc'?'selected':''}>السعر تصاعدي</option><option value="priceDesc" ${state.sort==='priceDesc'?'selected':''}>السعر تنازلي</option><option value="stock" ${state.sort==='stock'?'selected':''}>الأقل مخزوناً</option></select><button type="button" onclick="adminProductsV129Clear()">مسح</button></section>
      ${existingForm()}
      <section class="admin-products-v129-grid">${list.length?list.map(productCard).join(''):'<div class="admin-products-v129-empty">لا توجد منتجات مطابقة للفلاتر الحالية.</div>'}</section>
    </section>`;
    try{if(typeof refreshProductCategories==='function')refreshProductCategories()}catch(_){ }
    ['adminProductSearch','adminProductType','adminProductStatus','adminProductStock','adminProductPrice','adminProductSort'].forEach(id=>{const el=document.getElementById(id);if(!el)return;el.addEventListener(id==='adminProductSearch'?'input':'change',()=>{state[{adminProductSearch:'q',adminProductType:'type',adminProductStatus:'status',adminProductStock:'stock',adminProductPrice:'price',adminProductSort:'sort'}[id]]=el.value;render()})});
  }
  window.adminProductsV129Clear=function(){Object.assign(state,{q:'',type:'',status:'',stock:'',price:'',sort:'newest'});render()};
  window.adminProductsV129Preview=function(id){const p=products().find(x=>String(x.id)===String(id));if(!p)return;const img=imageUrl(p);const html=`<div class="admin-products-v129-preview"><div class="preview-image">${img?`<img src="${escv(img)}" alt="${escv(p.name)}">`:'<span>🛍️</span>'}</div><div><small>${typeLabel(p.type)} • ${escv(p.category||'عام')}</small><h2>${escv(p.name||'منتج')}</h2><p>${escv(p.description||'لا يوجد وصف مضاف لهذا المنتج.')}</p><div class="preview-grid"><span>السعر <b>${moneyv(p.price)} د.ع</b></span><span>المخزون <b>${moneyv(p.stock||0)}</b></span><span>الحالة <b>${statusLabel(p.status)}</b></span></div></div></div>`;if(window.checkoutBox&&window.checkoutModal){checkoutBox.innerHTML=html;checkoutModal.classList.remove('hidden')}else alert((p.name||'منتج')+' — '+moneyv(p.price)+' د.ع')};
  function install(){window.renderProductsAdmin=render;try{if(window.AlinAdminModules)AlinAdminModules.register('products',render)}catch(_){}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();

/* ===== admin/js/admin-products-v130.js ===== */
(function(){
  const state={editing:null,images:[],removed:[]};
  const escv=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const products=()=>Array.isArray(window.db?.products)?window.db.products:(typeof db!=='undefined'&&Array.isArray(db.products)?db.products:[]);
  const orders=()=>Array.isArray(window.db?.orders)?window.db.orders:(typeof db!=='undefined'&&Array.isArray(db.orders)?db.orders:[]);
  const cats=()=>Array.isArray(window.db?.categories)?window.db.categories:(typeof db!=='undefined'&&Array.isArray(db.categories)?db.categories:[]);
  const media=x=>{try{return x&&typeof mediaUrl==='function'?mediaUrl(x):x}catch(_){return x||''}};
  const historyKey=id=>'alin_product_history_'+id;
  function history(id){try{return JSON.parse(localStorage.getItem(historyKey(id))||'[]')}catch(_){return []}}
  function addHistory(id,action,details=''){const rows=history(id);rows.unshift({at:new Date().toISOString(),action,details,user:(window.current?.name||window.current?.username||'المدير')});localStorage.setItem(historyKey(id),JSON.stringify(rows.slice(0,100)))}
  function field(p,n,fallback=''){return p&&p[n]!=null?p[n]:fallback}
  function imagesFor(p){let a=[];if(Array.isArray(p?.image_paths))a=p.image_paths;else if(typeof p?.image_paths==='string'){try{a=JSON.parse(p.image_paths)}catch(_){a=[]}}if(p?.image_path&&!a.includes(p.image_path))a.unshift(p.image_path);return a.filter(Boolean)}
  function categoryOptions(type,current){const list=cats().filter(c=>String(c.type||'stationery')===String(type)&&String(c.status||'active')==='active');return (list.length?list:[{name:'عام'}]).map(c=>`<option value="${escv(c.name)}" ${String(c.name)===String(current)?'selected':''}>${escv(c.name)}</option>`).join('')}
  function editorHtml(p){const edit=!!p,type=field(p,'type','stationery'),imgs=imagesFor(p);state.images=[...imgs];state.removed=[];return `<section id="adminProductV130Editor" class="admin-products-v130-editor">
    <header class="admin-products-v130-editor-head"><div><h3>${edit?'تعديل المنتج':'إضافة منتج جديد'}</h3><p>أدخل التفاصيل والصور والسعر والمخزون، ثم احفظ المنتج.</p></div><button type="button" class="admin-products-v130-close" onclick="adminProductV130Close()">إغلاق</button></header>
    <form id="adminProductV130Form" class="admin-products-v130-form" onsubmit="return adminProductV130Save(event)">
      <label>نوع المنتج<select name="type" id="adminProductV130Type" onchange="adminProductV130RefreshCategories()"><option value="stationery" ${type==='stationery'?'selected':''}>قرطاسية</option><option value="gift" ${type==='gift'?'selected':''}>هدايا</option></select></label>
      <label class="span-2">اسم المنتج<input name="name" value="${escv(field(p,'name',field(p,'title','')))}" required placeholder="اسم واضح للمنتج"></label>
      <label>القسم<select name="category" id="adminProductV130Category">${categoryOptions(type,field(p,'category','عام'))}</select></label>
      <label>السعر الأساسي<input name="price" type="number" min="0" value="${Number(field(p,'price',0))}" required></label>
      <label>سعر العرض<input name="discount_price" type="number" min="0" value="${Number(field(p,'discount_price',field(p,'sale_price',0))||0)}" placeholder="اختياري"></label>
      <label>المخزون<input name="stock" type="number" min="0" value="${Number(field(p,'stock',0))}" required></label>
      <label>حد تنبيه المخزون<input name="low_stock_limit" type="number" min="0" value="${Number(field(p,'low_stock_limit',5))}"><span class="field-note">يظهر تنبيه عند الوصول لهذا العدد.</span></label>
      <label>حالة الظهور<select name="status"><option value="published" ${field(p,'status','published')==='published'?'selected':''}>منشور</option><option value="hidden" ${field(p,'status')==='hidden'?'selected':''}>مخفي</option><option value="draft" ${field(p,'status')==='draft'?'selected':''}>مسودة</option></select></label>
      <label class="span-4">وصف المنتج<textarea name="description" placeholder="اكتب وصفاً مرتباً ومختصراً">${escv(field(p,'description',''))}</textarea></label>
      <label class="span-2">صور المنتج<input id="adminProductV130Images" type="file" accept="image/*" multiple onchange="adminProductV130PreviewFiles(this)"><span class="field-note">يمكن اختيار عدة صور، وأول صورة تكون الرئيسية.</span></label>
      <div class="admin-products-v130-gallery"><b>معرض الصور</b><div id="adminProductV130Gallery" class="admin-products-v130-gallery-grid">${imgs.map((x,i)=>galleryItem(x,i)).join('')||'<span class="field-note">لم تتم إضافة صور بعد.</span>'}</div></div>
      <div class="admin-products-v130-form-actions"><button type="button" class="secondary" onclick="adminProductV130Close()">إلغاء</button><button type="submit" class="admin-products-v130-save">${edit?'حفظ التعديلات':'إضافة المنتج'}</button></div>
    </form></section>`}
  function galleryItem(x,i,local=false){const src=local?x:media(x);return `<div class="admin-products-v130-gallery-item"><img src="${escv(src)}" alt="صورة المنتج"><button type="button" onclick="adminProductV130RemoveImage(${i})">×</button>${i===0?'<span class="admin-products-v130-primary">الرئيسية</span>':''}</div>`}
  function appendEditor(p){const root=document.querySelector('.admin-products-v129');if(!root)return;document.getElementById('adminProductV130Editor')?.remove();root.querySelector('.admin-products-v129-tools')?.insertAdjacentHTML('afterend',editorHtml(p));document.querySelector('.admin-products-v129-add')?.setAttribute('hidden','');document.getElementById('adminProductV130Editor')?.scrollIntoView({behavior:'smooth',block:'start'})}
  window.adminProductV130Open=function(id){state.editing=id||null;appendEditor(id?products().find(x=>String(x.id)===String(id)):null)};
  window.adminProductV130Close=function(){state.editing=null;document.getElementById('adminProductV130Editor')?.remove();document.querySelector('.admin-products-v129-add')?.removeAttribute('hidden')};
  window.adminProductV130RefreshCategories=function(){const t=document.getElementById('adminProductV130Type'),c=document.getElementById('adminProductV130Category');if(c)c.innerHTML=categoryOptions(t?.value||'stationery','')};
  window.adminProductV130PreviewFiles=function(input){const files=[...(input.files||[])];const gallery=document.getElementById('adminProductV130Gallery');if(!gallery)return;const old=state.images.map((x,i)=>galleryItem(x,i)).join('');Promise.all(files.map(f=>new Promise(r=>{const rd=new FileReader();rd.onload=()=>r(rd.result);rd.readAsDataURL(f)}))).then(previews=>{gallery.innerHTML=old+previews.map((x,j)=>galleryItem(x,state.images.length+j,true)).join('')})};
  window.adminProductV130RemoveImage=function(i){if(i<state.images.length){state.removed.push(state.images[i]);state.images.splice(i,1)}const gallery=document.getElementById('adminProductV130Gallery');if(gallery)gallery.innerHTML=state.images.map((x,j)=>galleryItem(x,j)).join('')||'<span class="field-note">لم تتم إضافة صور بعد.</span>'};
  async function uploadNewFiles(){const input=document.getElementById('adminProductV130Images'),files=[...(input?.files||[])],out=[];for(const f of files){if(!f.size)continue;out.push(await uploadFile('products',f,{type:'image'}))}return out.filter(Boolean)}
  async function safeInsert(payload){try{return await insert('products',payload)}catch(e){const basic={id:payload.id,type:payload.type,name:payload.name,category:payload.category,price:payload.price,stock:payload.stock,image_path:payload.image_path,status:payload.status};return await insert('products',basic)}}
  async function safeUpdate(id,payload){try{return await update('products',payload,{id})}catch(e){const basic={type:payload.type,name:payload.name,category:payload.category,price:payload.price,stock:payload.stock,image_path:payload.image_path,status:payload.status};return await update('products',basic,{id})}}
  window.adminProductV130Save=async function(ev){ev.preventDefault();const form=ev.currentTarget,fd=new FormData(form),name=String(fd.get('name')||'').trim(),price=Number(fd.get('price')||0),stock=Number(fd.get('stock')||0),discount=Number(fd.get('discount_price')||0);if(!name)return alert('اكتب اسم المنتج');if(price<0||stock<0||discount<0)return alert('تحقق من السعر والمخزون');if(discount&&discount>=price)return alert('سعر العرض يجب أن يكون أقل من السعر الأساسي');const btn=form.querySelector('[type=submit]');btn.disabled=true;btn.textContent='جاري الحفظ...';try{const uploaded=await uploadNewFiles(),all=[...state.images,...uploaded];const id=state.editing||uid('PR');const payload={id,type:fd.get('type'),name,category:fd.get('category')||'عام',price,discount_price:discount||null,sale_price:discount||null,stock,low_stock_limit:Number(fd.get('low_stock_limit')||5),description:String(fd.get('description')||'').trim(),image_path:all[0]||null,image_paths:all,status:fd.get('status')||'published',updated_at:new Date().toISOString()};if(state.editing){delete payload.id;await safeUpdate(id,payload);addHistory(id,'تعديل المنتج',`السعر ${price}، المخزون ${stock}`);await audit?.('product','تعديل منتج '+id)}else{payload.created_at=new Date().toISOString();await safeInsert(payload);addHistory(id,'إضافة المنتج',name);await audit?.('product','إضافة منتج '+name)}await load();state.editing=null;renderProductsAdmin();toast?.(state.editing?'تم حفظ التعديلات':'تم حفظ المنتج')}catch(e){alert(e.message||'تعذر حفظ المنتج')}finally{btn.disabled=false;btn.textContent=state.editing?'حفظ التعديلات':'إضافة المنتج'}};
  window.editProduct=function(id){adminProductV130Open(id)};
  window.addProduct=function(){adminProductV130Open(null)};
  window.adminProductV130History=function(id){const p=products().find(x=>String(x.id)===String(id)),rows=history(id);const html=`<h2>سجل تعديلات المنتج</h2><p>${escv(p?.name||'المنتج')}</p><div class="admin-products-v130-history">${rows.length?rows.map(r=>`<article><b>${escv(r.action)}</b><small>${new Date(r.at).toLocaleString('ar-IQ')} • ${escv(r.user)}</small>${r.details?`<p>${escv(r.details)}</p>`:''}</article>`).join(''):'<div class="empty">لا يوجد سجل تعديلات بعد.</div>'}</div>`;if(window.checkoutBox&&window.checkoutModal){checkoutBox.innerHTML=html;checkoutModal.classList.remove('hidden')}};
  window.deleteProduct=async function(id){const p=products().find(x=>String(x.id)===String(id));if(!p)return;const linked=orders().filter(o=>String(o.item_id||o.product_id||'')===String(id)&&(String(o.kind||o.item_kind||'product')!=='booklet'));if(linked.length){if(confirm(`هذا المنتج مرتبط بـ ${linked.length} طلب ولا يمكن حذفه. هل تريد إخفاءه من المتجر بدلاً من الحذف؟`)){await setProductStatus(id,'hidden');addHistory(id,'إخفاء بدل الحذف',`مرتبط بـ ${linked.length} طلب`)}return}if(!confirm('هل تريد حذف المنتج نهائياً؟'))return;try{await removeRow('products',{id});await audit?.('product','حذف منتج '+id);await load();renderProductsAdmin();toast?.('تم حذف المنتج')}catch(e){alert(e.message||'تعذر حذف المنتج')}};
  function patchCards(){document.querySelectorAll('.admin-product-v129-card').forEach(card=>{const edit=card.querySelector('button[onclick^="editProduct"]');if(!edit)return;const id=(edit.getAttribute('onclick').match(/'([^']+)'/)||[])[1];if(!id)return;edit.setAttribute('onclick',`adminProductV130Open('${id}')`);const actions=card.querySelector('.admin-product-v129-actions');if(actions&&!actions.querySelector('.history-btn'))actions.insertAdjacentHTML('beforeend',`<button type="button" class="history-btn" onclick="adminProductV130History('${id}')">السجل</button>`)});const details=document.querySelector('.admin-products-v129-add');if(details){details.innerHTML='<summary onclick="setTimeout(()=>adminProductV130Open(null),0)">إضافة منتج جديد</summary>';details.removeAttribute('open')}}
  const oldRender=window.renderProductsAdmin;
  function install(){if(typeof oldRender==='function')window.renderProductsAdmin=function(){const r=oldRender.apply(this,arguments);setTimeout(patchCards,0);return r};try{if(window.AlinAdminModules)AlinAdminModules.register('products',()=>setTimeout(patchCards,0))}catch(_){}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();

/* ===== admin/js/admin-products-visible-v134.js ===== */
(function(){
  function renderProducts(){
    try{
      if(typeof window.adminStatsRender==='function') window.adminStatsRender();
      if(typeof window.markAdminTab==='function') window.markAdminTab('products');
      window.activeAdminTab='products';
      if(typeof window.renderProductsAdmin==='function'){
        const result=window.renderProductsAdmin();
        document.getElementById('adminContent')?.setAttribute('data-admin-products-visible','v134');
        return result;
      }
    }catch(error){
      console.error('تعذر عرض إدارة المنتجات',error);
      const root=document.getElementById('adminContent');
      if(root) root.innerHTML='<div class="notice">تعذر تحميل واجهة المنتجات الجديدة. أعد تحميل الصفحة.</div>';
    }
  }
  function install(){
    if(typeof window.adminTab!=='function') return;
    if(window.adminTab.__productsVisibleV134) return;
    const previous=window.adminTab;
    const wrapped=function(tab){
      if(tab==='products') return renderProducts();
      return previous.apply(this,arguments);
    };
    wrapped.__productsVisibleV134=true;
    window.adminTab=wrapped;
    if(window.AlinAdminModules && typeof window.AlinAdminModules.register==='function'){
      window.AlinAdminModules.register('products',renderProducts);
    }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',install); else install();
})();

/* ===== admin/js/admin-products-v135.js ===== */

(function(){
  const state={q:'',type:'',status:'',stock:'',sort:'newest',editing:null};
  const escv=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const moneyv=v=>typeof money==='function'?money(v):Number(v||0).toLocaleString('ar-IQ');
  const list=()=>Array.isArray(window.db?.products)?window.db.products:(typeof db!=='undefined'&&Array.isArray(db.products)?db.products:[]);
  const limit=p=>Number(p.low_stock_limit||window.db?.settings?.low_stock_default||5);
  const statusLabel=s=>({published:'منشور',hidden:'مخفي',draft:'مسودة'}[String(s||'published')]||'منشور');
  const img=p=>{const x=p.image_path||p.image_url||p.image||'';try{return x&&typeof mediaUrl==='function'?mediaUrl(x):x}catch(_){return x}};
  function filtered(){let a=[...list()];const q=state.q.trim().toLowerCase();if(q)a=a.filter(p=>[p.name,p.title,p.category,p.description].some(v=>String(v||'').toLowerCase().includes(q)));if(state.type)a=a.filter(p=>String(p.type||'stationery')===state.type);if(state.status)a=a.filter(p=>String(p.status||'published')===state.status);if(state.stock==='low')a=a.filter(p=>+p.stock>0&&+p.stock<=limit(p));if(state.stock==='out')a=a.filter(p=>+p.stock<=0);if(state.stock==='ok')a=a.filter(p=>+p.stock>limit(p));if(state.sort==='name')a.sort((x,y)=>String(x.name||'').localeCompare(String(y.name||''),'ar'));else if(state.sort==='price')a.sort((x,y)=>+x.price-+y.price);else if(state.sort==='stock')a.sort((x,y)=>+x.stock-+y.stock);else a.sort((x,y)=>String(y.created_at||y.id||'').localeCompare(String(x.created_at||x.id||'')));return a}
  function editor(p){return `<section class="admin-products-v135-editor" id="adminProductsV135Editor"><h3>${p?'تعديل المنتج':'إضافة منتج جديد'}</h3><form class="form-grid" onsubmit="adminProductsV135Save(event)"><select name="type"><option value="stationery" ${p?.type==='stationery'?'selected':''}>قرطاسية</option><option value="gift" ${p?.type==='gift'?'selected':''}>هدايا</option></select><input name="name" value="${escv(p?.name||'')}" placeholder="اسم المنتج" required><input name="category" value="${escv(p?.category||'')}" placeholder="القسم"><input name="price" type="number" min="0" value="${Number(p?.price||0)}" placeholder="السعر"><input name="stock" type="number" min="0" value="${Number(p?.stock||0)}" placeholder="المخزون"><input name="low_stock_limit" type="number" min="0" value="${Number(p?.low_stock_limit||5)}" placeholder="حد التنبيه"><select name="status"><option value="published" ${String(p?.status||'published')==='published'?'selected':''}>منشور</option><option value="hidden" ${p?.status==='hidden'?'selected':''}>مخفي</option><option value="draft" ${p?.status==='draft'?'selected':''}>مسودة</option></select><label>صورة المنتج<input name="image" type="file" accept="image/*"></label><textarea class="full" name="description" placeholder="تفاصيل المنتج">${escv(p?.description||'')}</textarea><div class="editor-actions full"><button type="button" class="secondary" onclick="adminProductsV135Close()">إلغاء</button><button type="submit">${p?'حفظ التعديلات':'إضافة المنتج'}</button></div></form></section>`}
  function card(p){const n=+p.stock||0,sc=n<=0?'out':n<=limit(p)?'low':'ok',photo=img(p);return `<article class="admin-product-v135-card"><div class="admin-product-v135-image">${photo?`<img src="${escv(photo)}" alt="${escv(p.name||'منتج')}">`:`<span>${p.type==='gift'?'🎁':'🛍️'}</span>`}<em class="admin-product-v135-status ${escv(p.status||'published')}">${statusLabel(p.status)}</em></div><div class="admin-product-v135-body"><small class="admin-product-v135-kicker">${p.type==='gift'?'هدايا':'قرطاسية'} • ${escv(p.category||'عام')}</small><div class="admin-product-v135-title"><h3>${escv(p.name||p.title||'منتج')}</h3><strong>${moneyv(p.price)} د.ع</strong></div><div class="admin-product-v135-meta"><span class="${sc}">${sc==='out'?'نافد':sc==='low'?'قليل المخزون':'متوفر'}: ${moneyv(n)}</span><span>${statusLabel(p.status)}</span></div><div class="admin-product-v135-actions"><button class="secondary" onclick="adminProductsV135Edit('${escv(p.id)}')">تعديل</button><button onclick="adminProductsV135Toggle('${escv(p.id)}','${String(p.status||'published')==='published'?'hidden':'published'}')">${String(p.status||'published')==='published'?'إخفاء':'نشر'}</button><button class="secondary" onclick="adminProductsV129Preview?.('${escv(p.id)}')">معاينة</button><button class="danger" onclick="adminProductsV135Delete('${escv(p.id)}')">حذف</button></div></div></article>`}
  function cleanup(){document.querySelectorAll('.alin-v84-admin-shortcuts,.alin-v85-shortcuts,.alin-v98-admin-shortcuts,[class*="admin-shortcuts"]').forEach(x=>x.remove());document.querySelectorAll('#adminContent button').forEach(b=>{const t=(b.textContent||'').trim();if(t.includes('مركز تشغيل المتجر')||t==='التقارير'||t.includes('📊 التقارير'))b.remove()})}
  function render(){const root=document.getElementById('adminContent');if(!root)return;const all=list(),a=filtered(),published=all.filter(x=>String(x.status||'published')==='published').length,hidden=all.filter(x=>String(x.status)==='hidden').length,low=all.filter(x=>+x.stock>0&&+x.stock<=limit(x)).length,out=all.filter(x=>+x.stock<=0).length;root.dataset.adminModule='products';root.innerHTML=`<section class="admin-products-v135"><header class="admin-products-v135-head"><div><h2>إدارة المنتجات</h2><p>إدارة القرطاسية والهدايا والأسعار والمخزون من مكان واحد.</p></div><button onclick="adminProductsV135Add()">+ إضافة منتج</button></header><section class="admin-products-v135-stats"><article><small>إجمالي المنتجات</small><strong>${all.length}</strong></article><article><small>المنشورة</small><strong>${published}</strong></article><article><small>المخفية</small><strong>${hidden}</strong></article><article class="warn"><small>قليل المخزون</small><strong>${low}</strong></article><article class="danger"><small>النافدة</small><strong>${out}</strong></article></section><section class="admin-products-v135-tools"><input id="v135ProductQ" value="${escv(state.q)}" placeholder="ابحث باسم المنتج أو القسم"><select id="v135ProductType"><option value="">كل الأنواع</option><option value="stationery" ${state.type==='stationery'?'selected':''}>قرطاسية</option><option value="gift" ${state.type==='gift'?'selected':''}>هدايا</option></select><select id="v135ProductStatus"><option value="">كل الحالات</option><option value="published" ${state.status==='published'?'selected':''}>منشور</option><option value="hidden" ${state.status==='hidden'?'selected':''}>مخفي</option><option value="draft" ${state.status==='draft'?'selected':''}>مسودة</option></select><select id="v135ProductStock"><option value="">كل المخزون</option><option value="ok" ${state.stock==='ok'?'selected':''}>متوفر</option><option value="low" ${state.stock==='low'?'selected':''}>قليل المخزون</option><option value="out" ${state.stock==='out'?'selected':''}>نافد</option></select><select id="v135ProductSort"><option value="newest" ${state.sort==='newest'?'selected':''}>الأحدث</option><option value="name" ${state.sort==='name'?'selected':''}>الاسم</option><option value="price" ${state.sort==='price'?'selected':''}>السعر</option><option value="stock" ${state.sort==='stock'?'selected':''}>المخزون</option></select><button onclick="adminProductsV135Clear()">مسح</button></section>${state.editing!==null?editor(state.editing?all.find(x=>String(x.id)===String(state.editing)):null):''}<section class="admin-products-v135-grid">${a.length?a.map(card).join(''):'<div class="admin-products-v135-empty">لا توجد منتجات مطابقة.</div>'}</section></section>`;cleanup();const map={v135ProductQ:'q',v135ProductType:'type',v135ProductStatus:'status',v135ProductStock:'stock',v135ProductSort:'sort'};Object.keys(map).forEach(id=>{const el=document.getElementById(id);if(el)el.addEventListener(id==='v135ProductQ'?'input':'change',()=>{state[map[id]]=el.value;render()})})}
  window.adminProductsV135Add=()=>{state.editing='';render();setTimeout(()=>document.getElementById('adminProductsV135Editor')?.scrollIntoView({behavior:'smooth'}),0)};
  window.adminProductsV135Edit=id=>{state.editing=id;render();setTimeout(()=>document.getElementById('adminProductsV135Editor')?.scrollIntoView({behavior:'smooth'}),0)};
  window.adminProductsV135Close=()=>{state.editing=null;render()};
  window.adminProductsV135Clear=()=>{Object.assign(state,{q:'',type:'',status:'',stock:'',sort:'newest'});render()};
  window.adminProductsV135Toggle=async(id,status)=>{try{await update('products',{status},{id});await load();render()}catch(e){alert(e.message||'تعذر تغيير الحالة')}};
  window.adminProductsV135Delete=async id=>{if(typeof window.deleteProduct==='function')return window.deleteProduct(id);if(!confirm('حذف المنتج؟'))return;await removeRow('products',{id});await load();render()};
  window.adminProductsV135Save=async ev=>{ev.preventDefault();const f=new FormData(ev.currentTarget),p=list().find(x=>String(x.id)===String(state.editing));try{let image=p?.image_path||null;const file=f.get('image');if(file&&file.size)image=await uploadFile('products',file,{type:'image'});const payload={type:f.get('type'),name:String(f.get('name')||'').trim(),category:String(f.get('category')||'عام'),price:+f.get('price')||0,stock:+f.get('stock')||0,low_stock_limit:+f.get('low_stock_limit')||5,status:f.get('status')||'published',description:String(f.get('description')||''),image_path:image,updated_at:new Date().toISOString()};if(state.editing){await update('products',payload,{id:state.editing})}else{payload.id=uid('PR');payload.created_at=new Date().toISOString();await insert('products',payload)}await load();state.editing=null;render();toast?.('تم حفظ المنتج')}catch(e){alert(e.message||'تعذر حفظ المنتج')}};
  function install(){window.renderProductsAdmin=render;const base=window.adminTab;if(typeof base==='function'&&!base.__v135){const wrap=function(t){if(t==='products')return render();return base.apply(this,arguments)};wrap.__v135=true;window.adminTab=wrap}window.AlinAdminModules?.register?.('products',render);cleanup()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();


;

// === admin/accounts-advanced.js ===
/* ===== admin/js/admin-accounts-v132.js ===== */

(function(){
  const escx=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
  const arr=v=>Array.isArray(v)?v:[];
  const roleLabel={teacher:'مدرس',library:'مكتبة',courier:'مندوب',accountant:'محاسب',admin:'مدير'};
  const permissionLabels={dashboard:'الرئيسية',orders:'الطلبات',booklets:'الملازم',products:'المنتجات',accounts:'الحسابات',finance:'المالية',settlements:'التسويات',reports:'التقارير',notifications:'الإشعارات',settings:'الإعدادات'};
  let editingId=null;
  function allAccounts(){
    const teachers=arr(window.db?.accounts?.teachers).map(x=>({...x,role:'teacher'}));
    const libraries=arr(window.db?.accounts?.libraries).map(x=>({...x,role:'library'}));
    const couriers=arr(window.db?.accounts?.couriers||window.db?.couriers).map(x=>({...x,role:'courier'}));
    return [...teachers,...libraries,...couriers];
  }
  function account(id){return allAccounts().find(x=>String(x.id)===String(id))}
  function ordersFor(x){return arr(window.db?.orders).filter(o=>String(o.teacher_id||'')===String(x.id)||String(o.library_id||o.pickup_library_id||'')===String(x.id)||String(o.courier_id||'')===String(x.id))}
  function settlementsFor(x){return [...arr(window.db?.settlements),...arr(window.db?.library_settlements),...arr(window.db?.courier_settlements)].filter(s=>String(s.account_id||s.teacher_id||s.library_id||s.courier_id||'')===String(x.id))}
  function permsFor(x){
    try{return JSON.parse(localStorage.getItem('alin_permissions_'+x.id)||'null')||defaultPerms(x.role)}catch(_){return defaultPerms(x.role)}
  }
  function defaultPerms(role){
    if(role==='teacher')return ['dashboard','booklets','orders','finance'];
    if(role==='library')return ['dashboard','orders','finance','settlements','notifications'];
    if(role==='courier')return ['dashboard','orders','finance','settlements'];
    return ['dashboard'];
  }
  function history(id){try{return JSON.parse(localStorage.getItem('alin_account_activity_'+id)||'[]')}catch(_){return []}}
  function log(id,action,details=''){const rows=history(id);rows.unshift({at:new Date().toISOString(),action,details,by:window.current?.name||'المدير'});localStorage.setItem('alin_account_activity_'+id,JSON.stringify(rows.slice(0,80)))}
  function renderEditor(x){
    const host=document.getElementById('v132AccountEditorHost');if(!host)return;
    const os=ordersFor(x), ss=settlementsFor(x), perms=permsFor(x), role=x.role||'teacher';
    host.innerHTML=`<section class="v132-account-editor"><header class="v132-editor-head"><div><h3>تعديل حساب ${escx(x.name||'')}</h3><p>تعديل بيانات الدخول والصلاحيات والربط بدون حذف السجلات المرتبطة.</p></div><button class="v132-editor-close" onclick="v132CloseAccountEditor()">إغلاق</button></header><div class="v132-account-form"><label>نوع الحساب<select id="v132Role"><option value="teacher" ${role==='teacher'?'selected':''}>مدرس</option><option value="library" ${role==='library'?'selected':''}>مكتبة</option><option value="courier" ${role==='courier'?'selected':''}>مندوب</option></select></label><label class="span-2">الاسم الكامل<input id="v132Name" value="${escx(x.name||'')}"></label><label>الحالة<select id="v132Status"><option value="active" ${String(x.status||'active')==='active'?'selected':''}>فعال</option><option value="inactive" ${String(x.status||'')==='inactive'?'selected':''}>موقوف</option><option value="pending" ${String(x.status||'')==='pending'?'selected':''}>قيد المراجعة</option></select></label><label>اسم الدخول<input id="v132Username" value="${escx(x.username||'')}"></label><label>رقم الهاتف<input id="v132Phone" value="${escx(x.phone||x.mobile||'')}"></label><label>المنطقة<input id="v132Area" value="${escx(x.area||'')}"></label><label>أقرب نقطة دالة<input id="v132Landmark" value="${escx(x.landmark||'')}"></label><label class="span-4">ملاحظات الحساب<textarea id="v132Notes">${escx(x.notes||'')}</textarea></label><section class="v132-password-box"><h4>إعادة تعيين كلمة المرور</h4><div class="v132-password-row"><input id="v132NewPassword" type="password" placeholder="اكتب كلمة مرور جديدة"><button onclick="v132ResetPassword()">حفظ كلمة المرور</button></div></section><section class="v132-permissions"><h4>الصلاحيات</h4><div class="v132-permission-grid">${Object.entries(permissionLabels).map(([k,v])=>`<label><input type="checkbox" data-v132-permission="${k}" ${perms.includes(k)?'checked':''}>${v}</label>`).join('')}</div></section><section class="v132-link-summary"><article><small>الطلبات المرتبطة</small><b>${os.length}</b></article><article><small>التسويات المرتبطة</small><b>${ss.length}</b></article><article><small>سجل النشاط</small><b>${history(x.id).length}</b></article></section><div class="v132-form-actions"><button class="secondary" onclick="v132OpenActivity('${escx(x.id)}')">سجل النشاط</button><button class="v132-save" onclick="v132SaveAccount()">حفظ التعديلات</button></div></div></section>`;
    host.scrollIntoView({behavior:'smooth',block:'start'});
  }
  window.v132OpenAccountEditor=id=>{const x=account(id);if(!x)return alert('تعذر العثور على الحساب');editingId=id;renderEditor(x)};
  window.v132CloseAccountEditor=()=>{editingId=null;const h=document.getElementById('v132AccountEditorHost');if(h)h.innerHTML=''};
  window.v132SaveAccount=async()=>{const x=account(editingId);if(!x)return;const payload={role:v132Role.value,name:v132Name.value.trim(),username:v132Username.value.trim(),status:v132Status.value,phone:v132Phone.value.trim(),area:v132Area.value.trim(),landmark:v132Landmark.value.trim(),notes:v132Notes.value.trim(),updated_at:new Date().toISOString()};if(!payload.name||!payload.username)return alert('أكمل الاسم واسم الدخول');try{await update('accounts',payload,{id:x.id});const perms=[...document.querySelectorAll('[data-v132-permission]:checked')].map(el=>el.dataset.v132Permission);localStorage.setItem('alin_permissions_'+x.id,JSON.stringify(perms));log(x.id,'تعديل الحساب','تم تحديث البيانات والصلاحيات');if(typeof audit==='function')await audit('account','تعديل كامل لحساب '+x.id);if(typeof load==='function')await load();if(typeof renderAccountsAdmin==='function')renderAccountsAdmin();if(typeof toast==='function')toast('تم حفظ تعديلات الحساب');}catch(e){alert('تعذر حفظ الحساب: '+e.message)}};
  window.v132ResetPassword=async()=>{const x=account(editingId),pass=document.getElementById('v132NewPassword')?.value.trim();if(!x||!pass)return alert('اكتب كلمة المرور الجديدة');if(pass.length<4)return alert('كلمة المرور قصيرة');try{await update('accounts',{password_hash:pass,updated_at:new Date().toISOString()},{id:x.id});log(x.id,'إعادة تعيين كلمة المرور');if(typeof audit==='function')await audit('account','إعادة تعيين كلمة مرور '+x.id);document.getElementById('v132NewPassword').value='';if(typeof toast==='function')toast('تم تغيير كلمة المرور');}catch(e){alert('تعذر تغيير كلمة المرور: '+e.message)}};
  window.v132ToggleAccount=async(id,status)=>{const x=account(id);if(!x)return;try{await update('accounts',{status,updated_at:new Date().toISOString()},{id});log(id,status==='active'?'تفعيل الحساب':'إيقاف الحساب');if(typeof audit==='function')await audit('account',(status==='active'?'تفعيل ':'إيقاف ')+id);if(typeof load==='function')await load();if(typeof renderAccountsAdmin==='function')renderAccountsAdmin();if(typeof toast==='function')toast(status==='active'?'تم تفعيل الحساب':'تم إيقاف الحساب');}catch(e){alert('تعذر تحديث الحالة: '+e.message)}};
  window.v132SafeDeleteAccount=async id=>{const x=account(id);if(!x)return;const os=ordersFor(x),ss=settlementsFor(x);if(os.length||ss.length){alert(`لا يمكن حذف الحساب لأنه مرتبط بـ ${os.length} طلب و${ss.length} تسوية. سيتم فتح خيار إيقاف الحساب بدلاً من الحذف.`);return v132ToggleAccount(id,'inactive')}if(!confirm('حذف الحساب نهائياً؟'))return;try{await removeRow('accounts',{id});log(id,'حذف الحساب');if(typeof audit==='function')await audit('account','حذف حساب '+id);if(typeof load==='function')await load();if(typeof renderAccountsAdmin==='function')renderAccountsAdmin();if(typeof toast==='function')toast('تم حذف الحساب');}catch(e){alert('تعذر حذف الحساب: '+e.message)}};
  window.v132OpenActivity=id=>{const x=account(id);if(!x)return;const rows=history(id);const host=document.getElementById('v132AccountEditorHost');if(!host)return;host.innerHTML=`<section class="v132-account-editor"><header class="v132-editor-head"><div><h3>سجل نشاط ${escx(x.name||'')}</h3><p>آخر التعديلات والإجراءات المسجلة على الحساب.</p></div><button class="v132-editor-close" onclick="v132CloseAccountEditor()">إغلاق</button></header><div class="v132-activity">${rows.map(r=>`<article><b>${escx(r.action)}</b><small>${new Date(r.at).toLocaleString('ar-IQ')} — ${escx(r.by||'المدير')}${r.details?' — '+escx(r.details):''}</small></article>`).join('')||'<div class="v132-warning">لا يوجد نشاط مسجل لهذا الحساب بعد.</div>'}</div></section>`;host.scrollIntoView({behavior:'smooth',block:'start'})};
})();


;

// === admin/finance.js ===
/* ===== admin/js/admin-finance-v137.js ===== */

(function(){
  const escx=v=>(typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])));
  const moneyx=v=>(typeof money==='function'?money(v):Number(v||0).toLocaleString('ar-IQ'));
  const arr=v=>Array.isArray(v)?v:[];
  const n=v=>Number(v||0);
  function payouts(){try{return arr(window.financialPayouts).concat(arr(window.db?.financial_payouts)).concat(JSON.parse(localStorage.getItem('alin_v68_financial_payouts')||'[]'))}catch(e){return arr(window.db?.financial_payouts)}}
  function ledger(){return arr(window.db?.ledger)}
  function orders(){return arr(window.db?.orders)}
  function libraries(){return arr(window.db?.accounts?.libraries)}
  function teachers(){return arr(window.db?.accounts?.teachers)}
  function couriers(){return arr(window.db?.delegates||window.db?.couriers)}
  function completed(){return orders().filter(o=>['completed','delivered','received'].includes(String(o.status||'').toLowerCase()))}
  function totalSales(){return completed().reduce((a,o)=>a+n(o.total),0)}
  function platformIncome(){return ledger().reduce((a,x)=>a+n(x.alin||x.admin||x.platform||x.platform_share),0)}
  function teacherIncome(){return ledger().reduce((a,x)=>a+n(x.teacher||x.teacher_amount),0)}
  function libraryIncome(){return ledger().reduce((a,x)=>a+n(x.library||x.library_amount),0)}
  function courierIncome(){return ledger().reduce((a,x)=>a+n(x.delegate||x.courier||x.courier_amount),0)}
  function paidTotal(){return payouts().filter(x=>!['reversed','cancelled'].includes(String(x.status||'').toLowerCase())).reduce((a,x)=>a+n(x.amount),0)}
  function libDebt(){return libraries().reduce((sum,l)=>{try{return sum+n(window.AlinV121?.summary?.(l.id)?.remaining||window.AlinV120Finance?.summary?.(l.id)?.debtRemaining)}catch(e){return sum}},0)}
  function partyBalance(role,id){try{if(typeof window.alinV68Balance==='function')return window.alinV68Balance(role,id)}catch(e){}return {earned:0,paid:0,remaining:0}}
  function recentLedger(){return ledger().slice().sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))).slice(0,8)}
  function recentPayouts(){return payouts().slice().sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))).slice(0,8)}
  function parties(){return [{role:'admin',id:'admin',name:'المدير',label:'ربح المنصة'}].concat(teachers().map(x=>({role:'teacher',id:x.id,name:x.name,label:'مدرس'})),libraries().map(x=>({role:'library',id:x.id,name:x.name,label:'مكتبة'})),couriers().map(x=>({role:'delegate',id:x.id,name:x.name,label:'مندوب'})))}
  function partyRows(){return parties().map(p=>{const b=partyBalance(p.role,p.id);return `<article class="admin-v137-party-card" data-role="${escx(p.role)}" data-search="${escx((p.name||'')+' '+p.label)}"><div><b>${escx(p.name||p.label)}</b><small>${escx(p.label)} — الإجمالي ${moneyx(b.earned)} د.ع</small></div><div class="admin-v137-party-values"><span>المسدد <b>${moneyx(b.paid)}</b></span><span class="remain">المتبقي <b>${moneyx(b.remaining)}</b></span>${b.remaining>0?`<button onclick="alinV68PayBalance('${escx(p.role)}','${escx(p.id)}')">تسديد</button>`:''}</div></article>`}).join('')}
  function dashboard(legacyHtml){
    const recent=recentLedger().map(x=>`<div class="admin-v137-finance-row"><div><b>${escx(x.order_number||x.order_id||'حركة مالية')}</b><small>منصة ${moneyx(x.alin||x.admin)} • مدرس ${moneyx(x.teacher)} • مكتبة ${moneyx(x.library)} • مندوب ${moneyx(x.delegate||x.courier)}</small></div><span class="admin-v137-finance-amount">${moneyx(n(x.total)||n(x.gross)||n(x.alin)+n(x.teacher)+n(x.library)+n(x.delegate||x.courier))} د.ع</span></div>`).join('')||'<div class="admin-v137-empty">لا توجد حركات مالية بعد.</div>';
    const pays=recentPayouts().map(x=>`<div class="admin-v137-finance-row"><div><b>${escx(x.party_name||x.party_role||'تسوية')}</b><small>${escx(x.voucher_number||'')} — ${escx(x.payment_method||'نقدي')}</small></div><span class="admin-v137-finance-amount">${moneyx(x.amount)} د.ع</span></div>`).join('')||'<div class="admin-v137-empty">لا توجد سندات أو تسويات بعد.</div>';
    return `<section class="admin-v137-finance"><header class="admin-v137-finance-head"><div><h2>المالية والتسويات</h2><p>متابعة أرباح المنصة والمدرسين والمكتبات والمندوبين، مع الأرصدة والتسويات الحالية.</p></div><span class="admin-v137-finance-date">${new Date().toLocaleDateString('ar-IQ')}</span></header><section class="admin-v137-finance-metrics"><article class="admin-v137-finance-metric gold"><small>إجمالي المبيعات المكتملة</small><strong>${moneyx(totalSales())} د.ع</strong><span>${completed().length} طلب مكتمل</span></article><article class="admin-v137-finance-metric green"><small>حصة المنصة المسجلة</small><strong>${moneyx(platformIncome())} د.ع</strong><span>بحسب دفتر القيود الحالي</span></article><article class="admin-v137-finance-metric"><small>أرباح المدرسين</small><strong>${moneyx(teacherIncome())} د.ع</strong><span>${teachers().length} مدرس</span></article><article class="admin-v137-finance-metric"><small>أرباح المكتبات</small><strong>${moneyx(libraryIncome())} د.ع</strong><span>${libraries().length} مكتبة</span></article><article class="admin-v137-finance-metric"><small>أرباح المندوبين</small><strong>${moneyx(courierIncome())} د.ع</strong><span>${couriers().length} مندوب</span></article><article class="admin-v137-finance-metric red"><small>ذمم المكتبات الحالية</small><strong>${moneyx(libDebt())} د.ع</strong><span>المتبقي غير المسوّى</span></article><article class="admin-v137-finance-metric"><small>إجمالي التسديدات</small><strong>${moneyx(paidTotal())} د.ع</strong><span>السندات غير الملغاة</span></article><article class="admin-v137-finance-metric"><small>الحركات المالية</small><strong>${ledger().length}</strong><span>قيد مالي مسجل</span></article></section><nav class="admin-v137-finance-tabs"><button class="active" data-v137-tab="overview">نظرة عامة</button><button data-v137-tab="balances">الأرصدة</button><button data-v137-tab="settlements">التسويات والسندات</button><button data-v137-tab="legacy">كل التفاصيل</button></nav><section data-v137-panel="overview" class="admin-v137-finance-grid"><article class="admin-v137-finance-panel"><h3>أحدث الحركات المالية</h3><div class="admin-v137-finance-list">${recent}</div></article><aside class="admin-v137-finance-panel"><h3>وصول سريع</h3><div class="admin-v137-finance-actions"><div class="admin-v137-finance-action"><span>ذمم المكتبات</span><button onclick="adminTab('finance');setTimeout(()=>document.querySelector('[data-v137-tab=\'balances\']')?.click(),50)">فتح</button></div><div class="admin-v137-finance-action"><span>سندات التسوية</span><button onclick="document.querySelector('[data-v137-tab=\'settlements\']')?.click()">عرض</button></div><div class="admin-v137-finance-action"><span>طلبات السحب</span><button onclick="document.querySelector('[data-v137-tab=\'legacy\']')?.click()">إدارة</button></div></div></aside></section><section data-v137-panel="balances" class="admin-v137-hidden"><div class="admin-v137-finance-panel"><div class="admin-v137-finance-search"><input id="adminV137FinanceSearch" placeholder="ابحث باسم المدرس أو المكتبة أو المندوب"><select id="adminV137FinanceRole"><option value="">كل الحسابات</option><option value="teacher">المدرسون</option><option value="library">المكتبات</option><option value="delegate">المندوبون</option><option value="admin">المنصة</option></select></div><div id="adminV137PartyList" class="admin-v137-finance-list">${partyRows()}</div></div></section><section data-v137-panel="settlements" class="admin-v137-hidden"><div class="admin-v137-finance-panel"><h3>أحدث التسويات والسندات</h3><div class="admin-v137-finance-list">${pays}</div></div></section><section data-v137-panel="legacy" class="admin-v137-hidden admin-v137-legacy"><details open><summary>التفاصيل والتسويات الحالية</summary><div class="admin-v137-legacy-body">${legacyHtml}</div></details></section></section>`
  }
  function installTabs(){document.querySelectorAll('[data-v137-tab]').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('[data-v137-tab]').forEach(x=>x.classList.toggle('active',x===btn));document.querySelectorAll('[data-v137-panel]').forEach(p=>p.classList.toggle('admin-v137-hidden',p.dataset.v137Panel!==btn.dataset.v137Tab))}));const apply=()=>{const q=(document.getElementById('adminV137FinanceSearch')?.value||'').toLowerCase(),role=document.getElementById('adminV137FinanceRole')?.value||'';document.querySelectorAll('#adminV137PartyList .admin-v137-party-card').forEach(c=>c.hidden=!((!q||c.dataset.search.toLowerCase().includes(q))&&(!role||c.dataset.role===role)))};document.getElementById('adminV137FinanceSearch')?.addEventListener('input',apply);document.getElementById('adminV137FinanceRole')?.addEventListener('change',apply)}
  function install(){const base=window.renderFinanceAdmin;if(typeof base!=='function'||base.__v137)return;const wrapped=function(){base.apply(this,arguments);const root=document.getElementById('adminContent');if(!root)return;const legacy=root.innerHTML;root.innerHTML=dashboard(legacy);installTabs()};wrapped.__v137=true;window.renderFinanceAdmin=window.renderFinanceAdmin?wrapped:wrapped;if(window.activeAdminTab==='finance')wrapped()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();

/* ===== admin/js/admin-finance-v138.js ===== */

(function(){
  const arr=v=>Array.isArray(v)?v:[];
  const n=v=>Number(v||0);
  const escx=v=>(typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])));
  const moneyx=v=>(typeof money==='function'?money(v):n(v).toLocaleString('ar-IQ'));
  const dbx=()=>window.db||{};
  const payouts=()=>{try{return [...arr(window.financialPayouts),...arr(dbx().financial_payouts),...JSON.parse(localStorage.getItem('alin_v68_financial_payouts')||'[]')]}catch(_){return arr(dbx().financial_payouts)}};
  const ledger=()=>arr(dbx().ledger);
  const libs=()=>arr(dbx().accounts?.libraries);
  const teachers=()=>arr(dbx().accounts?.teachers);
  const couriers=()=>arr(dbx().delegates||dbx().couriers);
  function balance(role,id){try{if(typeof window.alinV68Balance==='function')return window.alinV68Balance(role,id)}catch(_){}return {earned:0,paid:0,remaining:0}}
  function libSummary(id){try{return window.AlinV121?.summary?.(id)||window.AlinV120Finance?.summary?.(id)||{gross:0,profit:0,debtTotal:0,settled:0,remaining:0}}catch(_){return {gross:0,profit:0,debtTotal:0,settled:0,remaining:0}}}
  function roleLabel(r){return ({teacher:'مدرس',library:'مكتبة',delegate:'مندوب',courier:'مندوب',admin:'المنصة'})[r]||r||'تسوية'}
  function partyName(role,id){const list=role==='teacher'?teachers():role==='library'?libs():couriers();return list.find(x=>String(x.id)===String(id))?.name||roleLabel(role)}
  function rows(){return payouts().filter(x=>!['cancelled','reversed'].includes(String(x.status||'').toLowerCase())).sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')))}
  function settlementsHtml(){const r=rows();return `<div class="admin-v138-toolbar"><div class="admin-v138-filters"><input id="v138SettleSearch" placeholder="ابحث باسم المستفيد أو رقم السند"><select id="v138SettleRole"><option value="">كل الجهات</option><option value="teacher">المدرسون</option><option value="library">المكتبات</option><option value="delegate">المندوبون</option><option value="admin">المنصة</option></select><select id="v138SettleStatus"><option value="">كل الحالات</option><option value="received">مستلم</option><option value="paid">مدفوع</option><option value="pending">معلق</option></select></div><div class="admin-v138-toolbar-actions"><button onclick="AlinV138Finance.exportSettlements()">تصدير Excel</button><button class="secondary" onclick="AlinV138Finance.printSettlements()">طباعة / PDF</button></div></div><div id="v138SettlementList" class="admin-v138-settlement-list">${r.map(x=>{const role=String(x.party_role||x.role||x.account_type||'');const id=x.party_id||x.account_id||x.teacher_id||x.library_id||x.courier_id||x.delegate_id||'';const name=x.party_name||partyName(role,id);const voucher=x.voucher_number||x.receipt_number||x.id||'';return `<article class="admin-v138-settlement" data-role="${escx(role)}" data-status="${escx(String(x.status||'received').toLowerCase())}" data-search="${escx((name+' '+voucher).toLowerCase())}"><div><b>${escx(name)}</b><small>${roleLabel(role)} • ${escx(voucher)} • ${escx(String(x.created_at||'').slice(0,10))}</small></div><div class="admin-v138-settlement-end"><strong>${moneyx(x.amount)} د.ع</strong><span>${escx(x.payment_method||'نقدي')}</span><button onclick="AlinV138Finance.receipt('${escx(voucher)}')">السند</button></div></article>`}).join('')||'<div class="admin-v137-empty">لا توجد تسويات مسجلة.</div>'}</div>`}
  function balancesHtml(){const libRows=libs().map(l=>{const f=libSummary(l.id);return `<article class="admin-v138-balance"><div><b>${escx(l.name)}</b><small>مكتبة • المستلم ${moneyx(f.gross)} • الربح ${moneyx(f.profit)}</small></div><div><span>الذمة <b>${moneyx(f.remaining)} د.ع</b></span>${f.remaining>0?`<button onclick="AlinV121?.settle('${escx(l.id)}')">تسوية جزئية/كاملة</button>`:'<em>مصفّى</em>'}</div></article>`}).join('');const other=[...teachers().map(x=>({role:'teacher',...x})),...couriers().map(x=>({role:'delegate',...x}))].map(p=>{const b=balance(p.role,p.id);return `<article class="admin-v138-balance"><div><b>${escx(p.name)}</b><small>${roleLabel(p.role)} • الإجمالي ${moneyx(b.earned)} • المسدد ${moneyx(b.paid)}</small></div><div><span>المتبقي <b>${moneyx(b.remaining)} د.ع</b></span>${b.remaining>0?`<button onclick="alinV68PayBalance('${p.role}','${escx(p.id)}')">تسديد</button>`:'<em>مصفّى</em>'}</div></article>`}).join('');return `<div class="admin-v138-balance-head"><h3>الأرصدة والذمم</h3><p>التسوية الجزئية أو الكاملة مع بقاء السجل المالي محفوظاً.</p></div><div class="admin-v138-balance-grid">${libRows+other||'<div class="admin-v137-empty">لا توجد أرصدة.</div>'}</div>`}
  function auditHtml(){let local=[];try{local=JSON.parse(localStorage.getItem('alin_v121_finance_audit')||'[]')}catch(_){}const combined=[...local,...arr(dbx().audit_log).filter(x=>String(x.type||x.category||'').includes('finance'))].sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))).slice(0,100);return `<div class="admin-v138-audit-tools"><button onclick="AlinV138Finance.exportAudit()">تصدير السجل</button></div><div class="admin-v138-audit-list">${combined.map(x=>`<div><b>${escx(x.details||x.action||'حركة مالية')}</b><small>${escx(x.actor||x.user||'النظام')} • ${escx(String(x.created_at||''))}</small><span>${escx(x.action||x.type||'')}</span></div>`).join('')||'<div class="admin-v137-empty">لا توجد حركات تدقيق.</div>'}</div>`}
  function addPanels(){const root=document.querySelector('.admin-v137-finance');if(!root||root.dataset.v138)return;root.dataset.v138='1';const tabs=root.querySelector('.admin-v137-finance-tabs');if(!tabs)return;tabs.insertAdjacentHTML('beforeend','<button data-v137-tab="settlementsV138">التسويات المتقدمة</button><button data-v137-tab="auditV138">سجل التدقيق</button>');root.insertAdjacentHTML('beforeend',`<section data-v137-panel="settlementsV138" class="admin-v137-hidden"><div class="admin-v137-finance-panel">${settlementsHtml()}</div><div class="admin-v137-finance-panel admin-v138-balance-section">${balancesHtml()}</div></section><section data-v137-panel="auditV138" class="admin-v137-hidden"><div class="admin-v137-finance-panel"><h3>سجل التدقيق المالي</h3>${auditHtml()}</div></section>`);root.querySelectorAll('[data-v137-tab]').forEach(btn=>{if(btn.dataset.v138Bound)return;btn.dataset.v138Bound='1';btn.addEventListener('click',()=>{root.querySelectorAll('[data-v137-tab]').forEach(x=>x.classList.toggle('active',x===btn));root.querySelectorAll('[data-v137-panel]').forEach(p=>p.classList.toggle('admin-v137-hidden',p.dataset.v137Panel!==btn.dataset.v137Tab))})});const filter=()=>{const q=(document.getElementById('v138SettleSearch')?.value||'').toLowerCase(),role=document.getElementById('v138SettleRole')?.value||'',status=document.getElementById('v138SettleStatus')?.value||'';document.querySelectorAll('#v138SettlementList .admin-v138-settlement').forEach(x=>x.hidden=!((!q||x.dataset.search.includes(q))&&(!role||x.dataset.role===role)&&(!status||x.dataset.status===status)))};['v138SettleSearch','v138SettleRole','v138SettleStatus'].forEach(id=>document.getElementById(id)?.addEventListener(id.includes('Search')?'input':'change',filter))}
  function csv(name,data){const text='\ufeff'+data.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
  window.AlinV138Finance={
    exportSettlements(){csv('تسويات-آلين.csv',[['المستفيد','الدور','المبلغ','الطريقة','السند','التاريخ','الحالة'],...rows().map(x=>{const role=x.party_role||x.role||'';const id=x.party_id||x.library_id||x.teacher_id||x.courier_id||'';return [x.party_name||partyName(role,id),roleLabel(role),x.amount,x.payment_method||'',x.voucher_number||x.receipt_number||x.id||'',x.created_at||'',x.status||'']})])},
    printSettlements(){const w=window.open('','_blank');if(!w)return alert('اسمح بالنوافذ المنبثقة للطباعة');w.document.write(`<html dir="rtl"><head><title>تقرير التسويات</title><style>body{font-family:Tahoma;padding:30px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:9px;text-align:right}h1{color:#102c53}</style></head><body><h1>تقرير تسويات منصة آلين</h1><table><tr><th>المستفيد</th><th>المبلغ</th><th>الطريقة</th><th>السند</th><th>التاريخ</th></tr>${rows().map(x=>`<tr><td>${escx(x.party_name||'')}</td><td>${moneyx(x.amount)}</td><td>${escx(x.payment_method||'')}</td><td>${escx(x.voucher_number||x.receipt_number||'')}</td><td>${escx(String(x.created_at||'').slice(0,10))}</td></tr>`).join('')}</table><script>print()<\/script></body></html>`);w.document.close()},
    receipt(v){const x=rows().find(r=>String(r.voucher_number||r.receipt_number||r.id)===String(v));if(!x)return alert('السند غير موجود');if(typeof window.showReceipt==='function')try{return window.showReceipt(x)}catch(_){}const w=window.open('','_blank');if(!w)return;w.document.write(`<html dir="rtl"><head><title>سند قبض</title><style>body{font-family:Tahoma;padding:40px}.box{max-width:600px;margin:auto;border:2px solid #102c53;border-radius:20px;padding:28px}.line{display:flex;justify-content:space-between;border-bottom:1px dashed #ccc;padding:12px 0}h1{text-align:center;color:#102c53}</style></head><body><div class="box"><h1>سند قبض — منصة آلين</h1><div class="line"><span>رقم السند</span><b>${escx(v)}</b></div><div class="line"><span>المستفيد</span><b>${escx(x.party_name||'')}</b></div><div class="line"><span>المبلغ</span><b>${moneyx(x.amount)} د.ع</b></div><div class="line"><span>طريقة الدفع</span><b>${escx(x.payment_method||'نقدي')}</b></div><div class="line"><span>التاريخ</span><b>${escx(String(x.created_at||'').slice(0,10))}</b></div><button onclick="print()">طباعة</button></div></body></html>`);w.document.close()},
    exportAudit(){let a=[];try{a=JSON.parse(localStorage.getItem('alin_v121_finance_audit')||'[]')}catch(_){}csv('سجل-التدقيق-المالي.csv',[['العملية','التفاصيل','المنفذ','التاريخ'],...a.map(x=>[x.action,x.details,x.actor,x.created_at])])}
  };
  function install(){const base=window.renderFinanceAdmin;if(typeof base!=='function'||base.__v138)return;const wrap=function(){base.apply(this,arguments);setTimeout(addPanels,0)};wrap.__v138=true;window.renderFinanceAdmin=wrap;if(window.activeAdminTab==='finance')wrap()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();


;

// === admin/marketing.js ===
/* ===== admin/js/admin-marketing-v140.js ===== */
(function(){
  let editingBannerId=null, editingCouponId=null;
  const E=v=>typeof esc==='function'?esc(v):String(v??'');
  const M=v=>typeof money==='function'?money(v):Number(v||0).toLocaleString('ar-IQ');
  const D=v=>{if(!v)return 'غير محدد';try{return new Date(v).toLocaleDateString('ar-IQ')}catch(_){return v}};
  const banners=()=>Array.isArray(db?.banners)?db.banners:[];
  const coupons=()=>Array.isArray(v19Coupons)?v19Coupons:[];
  const activeBanner=b=>b.active===true||b.active===1||b.active==='1';
  const couponUsed=c=>Number(c.used_count??c.usage_count??0);
  const couponLimit=c=>Number(c.max_uses??c.usage_limit??0);
  const couponActive=c=>String(c.status||'active')==='active' && (!c.expires_at || new Date(c.expires_at)>=new Date());

  function bannerPreviewSync(){
    const box=document.getElementById('v140BannerPreview');if(!box)return;
    const title=document.getElementById('v140AdTitle')?.value||'عنوان الإعلان';
    const text=document.getElementById('v140AdText')?.value||'سيظهر نص الإعلان هنا';
    const file=document.getElementById('v140AdImage')?.files?.[0];
    box.querySelector('b').textContent=title;box.querySelector('span').textContent=text;
    const old=box.querySelector('img');if(old)old.remove();
    if(file){const img=document.createElement('img');img.src=URL.createObjectURL(file);box.prepend(img)}
  }

  window.renderAdsAdminV140=function(){
    const rows=banners(), active=rows.filter(activeBanner).length;
    adminContent.innerHTML=`<section class="admin-v140"><header class="admin-v140-head"><div><h2>الإعلانات والبنرات</h2><p>إدارة البنرات التي تظهر في المتجر، مع تحديد فترة العرض والرابط وحالة النشر.</p></div><div class="admin-v140-badges"><span class="admin-v140-badge">${rows.length} إعلان</span><span class="admin-v140-badge">${active} نشط</span></div></header><div class="admin-v140-grid"><article class="admin-v140-card"><h3>${editingBannerId?'تعديل الإعلان':'إضافة إعلان جديد'}</h3><div class="admin-v140-preview" id="v140BannerPreview"><div class="admin-v140-preview-copy"><b>عنوان الإعلان</b><span>سيظهر نص الإعلان هنا</span></div></div><form id="v140BannerForm" class="admin-v140-form" onsubmit="return false"><label>عنوان الإعلان<input id="v140AdTitle" required placeholder="مثال: عروض العودة للمدارس" oninput="bannerPreviewSyncV140()"></label><label>النص المختصر<textarea id="v140AdText" placeholder="اكتب وصفاً مختصراً" oninput="bannerPreviewSyncV140()"></textarea></label><label>صورة البنر<input id="v140AdImage" type="file" accept="image/*" onchange="bannerPreviewSyncV140()"></label><label>رابط عند الضغط<input id="v140AdLink" type="url" placeholder="https://..."></label><div class="admin-v140-form-row"><label>بداية العرض<input id="v140AdStart" type="date"></label><label>نهاية العرض<input id="v140AdEnd" type="date"></label></div><label>الحالة<select id="v140AdActive"><option value="1">نشط</option><option value="0">متوقف</option></select></label><div class="admin-v140-actions"><button onclick="saveBannerV140()">${editingBannerId?'حفظ التعديل':'إضافة الإعلان'}</button>${editingBannerId?'<button class="secondary" onclick="cancelBannerEditV140()">إلغاء التعديل</button>':''}</div></form></article><article class="admin-v140-card"><div class="admin-v140-toolbar"><h3>الإعلانات الحالية</h3><input id="v140AdSearch" placeholder="بحث بالعنوان" oninput="filterAdsV140()"></div><div id="v140AdsList" class="admin-v140-list">${bannerRowsHtml(rows)}</div></article></div></section>`;
    if(editingBannerId){const b=rows.find(x=>String(x.id)===String(editingBannerId));if(b){v140AdTitle.value=b.title||'';v140AdText.value=b.text||'';v140AdLink.value=b.link_url||'';v140AdStart.value=(b.start_date||'').slice(0,10);v140AdEnd.value=(b.end_date||'').slice(0,10);v140AdActive.value=activeBanner(b)?'1':'0';bannerPreviewSync()}}
  };
  function bannerRowsHtml(rows){return rows.length?rows.map(b=>`<div class="admin-v140-item" data-search="${E((b.title||'')+' '+(b.text||''))}"><div class="admin-v140-thumb">${b.image_path?`<img src="${E(typeof mediaUrl==='function'?mediaUrl(b.image_path):b.image_path)}" alt="">`:'📣'}</div><div><h4>${E(b.title||'بدون عنوان')}</h4><p>${E(b.text||'')}</p><div class="admin-v140-meta"><span class="admin-v140-pill ${activeBanner(b)?'active':'off'}">${activeBanner(b)?'نشط':'متوقف'}</span><span class="admin-v140-pill">${D(b.start_date)} — ${D(b.end_date)}</span></div></div><div class="admin-v140-item-actions"><button class="secondary" onclick="editBannerV140('${E(b.id)}')">تعديل</button><button onclick="toggleBannerV140('${E(b.id)}',${activeBanner(b)?0:1})">${activeBanner(b)?'إيقاف':'تشغيل'}</button><button class="danger" onclick="deleteBannerV140('${E(b.id)}')">حذف</button></div></div>`).join(''):'<div class="admin-v140-empty">لا توجد إعلانات حتى الآن</div>'}
  window.bannerPreviewSyncV140=bannerPreviewSync;
  window.filterAdsV140=function(){const q=(v140AdSearch.value||'').trim().toLowerCase();document.querySelectorAll('#v140AdsList .admin-v140-item').forEach(x=>x.hidden=!x.dataset.search.toLowerCase().includes(q))};
  window.editBannerV140=id=>{editingBannerId=id;renderAdsAdminV140();adminContent.scrollIntoView({behavior:'smooth'})};
  window.cancelBannerEditV140=()=>{editingBannerId=null;renderAdsAdminV140()};
  window.saveBannerV140=async function(){try{const title=v140AdTitle.value.trim();if(!title)throw Error('اكتب عنوان الإعلان');const file=v140AdImage.files?.[0];let image=null;if(file&&file.name)image=await uploadFile('banners',file,{type:'image'});const payload={title,text:v140AdText.value.trim(),link_url:v140AdLink.value.trim()||null,start_date:v140AdStart.value||null,end_date:v140AdEnd.value||null,active:v140AdActive.value==='1',updated_at:new Date().toISOString()};if(image)payload.image_path=image;if(editingBannerId)await update('banners',payload,{id:editingBannerId});else await insert('banners',{id:uid('AD'),...payload});if(typeof audit==='function')await audit('banner',(editingBannerId?'تعديل':'إضافة')+' إعلان '+title);editingBannerId=null;await load();renderAdsAdminV140();toast('تم حفظ الإعلان')}catch(e){alert(e.message)}};
  window.toggleBannerV140=async(id,on)=>{await update('banners',{active:!!on,updated_at:new Date().toISOString()},{id});await load();renderAdsAdminV140()};
  window.deleteBannerV140=async id=>{if(!confirm('حذف الإعلان نهائياً؟'))return;try{await removeRow('banners',{id});await load();renderAdsAdminV140();toast('تم حذف الإعلان')}catch(e){alert(e.message)}};

  window.renderCouponsAdminV140=function(){
    const rows=coupons(), active=rows.filter(couponActive).length, used=rows.reduce((a,c)=>a+couponUsed(c),0), expired=rows.filter(c=>c.expires_at&&new Date(c.expires_at)<new Date()).length;
    adminContent.innerHTML=`<section class="admin-v140"><header class="admin-v140-head"><div><h2>العروض والكوبونات</h2><p>إنشاء أكواد خصم وتحديد القيمة، عدد الاستخدامات، القسم المستهدف وتاريخ الانتهاء.</p></div></header><div class="admin-v140-stats"><div class="admin-v140-stat"><span>${rows.length}</span><small>إجمالي الكوبونات</small></div><div class="admin-v140-stat"><span>${active}</span><small>نشطة</small></div><div class="admin-v140-stat"><span>${used}</span><small>مرات الاستخدام</small></div><div class="admin-v140-stat"><span>${expired}</span><small>منتهية</small></div></div><div class="admin-v140-grid"><article class="admin-v140-card"><h3>${editingCouponId?'تعديل الكوبون':'إضافة كوبون'}</h3><form class="admin-v140-form" onsubmit="return false"><label>كود الخصم<input id="v140CpCode" placeholder="ALIN20" maxlength="24"></label><div class="admin-v140-form-row"><label>نوع الخصم<select id="v140CpType"><option value="percent">نسبة مئوية</option><option value="fixed">مبلغ ثابت</option></select></label><label>قيمة الخصم<input id="v140CpValue" type="number" min="1"></label></div><div class="admin-v140-form-row"><label>عدد الاستخدامات<input id="v140CpLimit" type="number" min="0" placeholder="0 = بلا حد"></label><label>تاريخ الانتهاء<input id="v140CpExpiry" type="date"></label></div><label>يطبق على<select id="v140CpApplies"><option value="all">كل المتجر</option><option value="booklet">الملازم</option><option value="stationery">القرطاسية</option><option value="gift">الهدايا</option></select></label><label>الحالة<select id="v140CpStatus"><option value="active">نشط</option><option value="disabled">متوقف</option></select></label><div class="admin-v140-actions"><button onclick="saveCouponV140()">${editingCouponId?'حفظ التعديل':'إضافة الكوبون'}</button>${editingCouponId?'<button class="secondary" onclick="cancelCouponEditV140()">إلغاء</button>':''}</div></form></article><article class="admin-v140-card"><div class="admin-v140-toolbar"><h3>قائمة الكوبونات</h3><input id="v140CouponSearch" placeholder="بحث بالكود" oninput="filterCouponsV140()"></div><div id="v140CouponsList" class="admin-v140-list">${couponRowsHtml(rows)}</div></article></div></section>`;
    if(editingCouponId){const c=rows.find(x=>String(x.id)===String(editingCouponId));if(c){v140CpCode.value=c.code||'';v140CpType.value=c.discount_type||'percent';v140CpValue.value=c.discount_value||0;v140CpLimit.value=c.max_uses??c.usage_limit??0;v140CpExpiry.value=(c.expires_at||'').slice(0,10);v140CpApplies.value=c.applies_to||'all';v140CpStatus.value=c.status||'active'}}
  };
  function couponRowsHtml(rows){return rows.length?rows.map(c=>{const limit=couponLimit(c),used=couponUsed(c),active=couponActive(c);return `<div class="admin-v140-item coupon-v140-item" data-search="${E(c.code||'')}"><div><h4 class="coupon-code">${E(c.code)}</h4><p>${c.discount_type==='fixed'?M(c.discount_value)+' د.ع':M(c.discount_value)+'%'} خصم — ${E(c.applies_to||'كل المتجر')}</p><div class="admin-v140-meta"><span class="admin-v140-pill ${active?'active':'off'}">${active?'نشط':'متوقف/منتهي'}</span><span class="admin-v140-pill">استخدام ${used}/${limit||'∞'}</span><span class="admin-v140-pill">ينتهي ${D(c.expires_at)}</span></div></div><div class="admin-v140-item-actions"><button class="coupon-copy" onclick="copyCouponV140('${E(c.code)}')">نسخ</button><button class="secondary" onclick="editCouponV140('${E(c.id)}')">تعديل</button><button onclick="toggleCouponV140('${E(c.id)}','${String(c.status||'active')==='active'?'disabled':'active'}')">${String(c.status||'active')==='active'?'إيقاف':'تشغيل'}</button><button class="danger" onclick="deleteCouponV140('${E(c.id)}')">حذف</button></div></div>`}).join(''):'<div class="admin-v140-empty">لا توجد كوبونات</div>'}
  window.filterCouponsV140=()=>{const q=(v140CouponSearch.value||'').trim().toLowerCase();document.querySelectorAll('#v140CouponsList .admin-v140-item').forEach(x=>x.hidden=!x.dataset.search.toLowerCase().includes(q))};
  window.copyCouponV140=async code=>{try{await navigator.clipboard.writeText(code);toast('تم نسخ الكود')}catch(_){prompt('انسخ الكود',code)}};
  window.editCouponV140=id=>{editingCouponId=id;renderCouponsAdminV140();adminContent.scrollIntoView({behavior:'smooth'})};
  window.cancelCouponEditV140=()=>{editingCouponId=null;renderCouponsAdminV140()};
  window.saveCouponV140=async function(){try{const code=v140CpCode.value.trim().toUpperCase(),value=Number(v140CpValue.value||0);if(!code||value<=0)throw Error('أكمل كود وقيمة الخصم');const payload={code,discount_type:v140CpType.value,discount_value:value,max_uses:Number(v140CpLimit.value||0),usage_limit:Number(v140CpLimit.value||0),expires_at:v140CpExpiry.value?new Date(v140CpExpiry.value+'T23:59:59').toISOString():null,applies_to:v140CpApplies.value,status:v140CpStatus.value};if(editingCouponId)await update('coupons',payload,{id:editingCouponId});else await insert('coupons',{id:uid('CP'),used_count:0,usage_count:0,...payload});if(typeof audit==='function')await audit('coupon',(editingCouponId?'تعديل':'إضافة')+' كوبون '+code);editingCouponId=null;await load();renderCouponsAdminV140();toast('تم حفظ الكوبون')}catch(e){alert(e.message)}};
  window.toggleCouponV140=async(id,status)=>{await update('coupons',{status},{id});await load();renderCouponsAdminV140()};
  window.deleteCouponV140=async id=>{if(!confirm('حذف الكوبون؟'))return;try{await removeRow('coupons',{id});await load();renderCouponsAdminV140();toast('تم حذف الكوبون')}catch(e){alert(e.message)}};

  const oldAdminTab=window.adminTab;
  window.adminTab=function(t){if(t==='ads'){if(typeof markAdminTab==='function')markAdminTab(t);return renderAdsAdminV140()}if(t==='coupons'){if(typeof markAdminTab==='function')markAdminTab(t);return renderCouponsAdminV140()}return oldAdminTab.apply(this,arguments)};
})();


;

// === admin/reports.js ===
/* ===== admin/js/admin-reports-v143.js ===== */
(function(){
  const escx=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const moneyx=v=>typeof money==='function'?money(v):Number(v||0).toLocaleString('ar-IQ');
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
  function install(){ensureButton();const previous=window.adminTab;const router=function(tab){if(tab==='reports'){render();return}return typeof previous==='function'?previous.apply(this,arguments):undefined};router.__v143Reports=true;window.adminTab=router;document.addEventListener('click',e=>{const b=e.target.closest('#adminPage .admin-tabs button');if(!b)return;if((b.getAttribute('onclick')||'').includes("adminTab('reports')")){e.preventDefault();e.stopImmediatePropagation();render()}},true)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();


;

// === admin/settings.js ===
/* ===== admin/js/admin-settings-v144.js ===== */
(function(){
  const escv=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const state=()=>{try{return typeof db!=='undefined'?(db.settings||{}):{}}catch(e){return {}}};
  const val=(k,d='')=>state()[k]??d;
  const brandUrl=path=>{if(!path)return '';if(String(path).startsWith('http')||String(path).startsWith('blob:')||String(path).startsWith('data:'))return String(path);try{return typeof mediaUrl==='function'?mediaUrl(path):String(path)}catch(e){return String(path)}};
  function brandPreview(kind){const s=state(),path=kind==='logo'?(s.platform_logo_path||s.platform_logo_url):(s.platform_icon_path||s.platform_icon_url),url=brandUrl(path);return url?`<img src="${escv(url)}" alt="${kind==='logo'?'شعار المنصة':'أيقونة التطبيق'}">`:'<span>آ</span>'}
  function updateBrandPreview(box,file){if(!box)return;if(!file){box.innerHTML='<span>آ</span>';return}const url=URL.createObjectURL(file);box.innerHTML=`<img src="${url}" alt="معاينة">`;box.dataset.previewUrl=url}
  async function uploadIdentity(file,kind){if(!file)return '';const allowed=kind==='logo'?['image/png','image/jpeg','image/webp','image/svg+xml']:['image/png','image/jpeg','image/webp'];if(!allowed.includes(file.type))throw new Error('صيغة الصورة غير مدعومة');if(file.size>2*1024*1024)throw new Error('حجم الصورة يجب أن يكون أقل من 2MB');if(typeof uploadBrandFile==='function')return uploadBrandFile(file,kind);if(typeof uploadFile==='function')return uploadFile('brand/'+kind,file);throw new Error('وظيفة رفع الصور غير متاحة')}
  function applyIdentityNow(){try{if(typeof applyBrandV28==='function')applyBrandV28();const s=state(),logo=brandUrl(s.platform_logo_path||s.platform_logo_url),icon=brandUrl(s.platform_icon_path||s.platform_icon_url);document.querySelectorAll('.alin98-logo').forEach(el=>{if(logo){el.innerHTML=`<img src="${logo}" alt="شعار آلين">`;el.classList.add('as145-has-image')}else{el.textContent='آ';el.classList.remove('as145-has-image')}});document.querySelectorAll('link[rel="icon"],link[rel="apple-touch-icon"]').forEach(el=>{if(icon)el.href=icon})}catch(e){}}
  async function saveOne(key,value){
    if(typeof settingsSet==='function') return settingsSet(key,String(value));
    if(typeof alinV57SaveSetting==='function') return alinV57SaveSetting(key,String(value));
    if(typeof sb!=='undefined'&&sb?.from){const {error}=await sb.from('settings').upsert({key,value:String(value)});if(error)throw error;return}
    throw new Error('تعذر الوصول إلى إعدادات قاعدة البيانات');
  }
  async function saveMany(obj,msgEl){
    msgEl.className='as144-status';msgEl.textContent='جارٍ الحفظ...';
    try{for(const [k,v] of Object.entries(obj))await saveOne(k,v);try{if(typeof audit==='function')await audit('settings','تحديث إعدادات لوحة المدير')}catch(e){};try{if(typeof load==='function')await load()}catch(e){};msgEl.className='as144-status ok';msgEl.textContent='تم حفظ الإعدادات بنجاح';if(typeof toast==='function')toast('تم حفظ الإعدادات')}
    catch(e){msgEl.className='as144-status err';msgEl.textContent=e.message||'تعذر حفظ الإعدادات'}
  }
  function render(root){
    if(!root)return;root.className='panel admin-settings-v144';
    root.innerHTML=`
      <div class="as144-head"><div><h2>إعدادات المنصة</h2><p>إدارة الهوية والأرباح والتوصيل والطلبات وحساب المدير من مكان واحد.</p></div><span class="as144-version">V145</span></div>
      <div class="as144-tabs" role="tablist">
        <button class="active" data-as144-tab="general">عام</button><button data-as144-tab="profits">الأرباح</button><button data-as144-tab="orders">الطلبات والتوصيل</button><button data-as144-tab="brand">الهوية والتواصل</button><button data-as144-tab="security">أمان المدير</button>
      </div>
      <section class="as144-panel active" data-as144-panel="general">
        <div class="as144-card"><h3>الإعدادات العامة</h3><div class="as144-grid">
          <div class="as144-field"><label>اسم المنصة</label><input id="as144PlatformName" value="${escv(val('platform_name','منصة آلين'))}"></div>
          <div class="as144-field"><label>رقم الإصدار</label><input id="as144Version" value="${escv(val('app_version','V145'))}"></div>
          <div class="as144-field"><label>حد تنبيه المخزون</label><input id="as144LowStock" type="number" min="0" value="${escv(val('low_stock_default','5'))}"></div>
          <div class="as144-field"><label>حد تنبيه ذمة المكتبة</label><input id="as144DebtLimit" type="number" min="0" value="${escv(val('library_debt_alert_limit','500000'))}"></div>
          <div class="as144-field full"><label>ملاحظة إدارية داخلية</label><textarea id="as144AdminNote">${escv(val('admin_internal_note',''))}</textarea></div>
        </div><div class="as144-actions"><button class="as144-save" data-as144-save="general">حفظ الإعدادات العامة</button></div><div id="as144GeneralMsg" class="as144-status"></div></div>
      </section>
      <section class="as144-panel" data-as144-panel="profits">
        <div class="as144-card"><h3>نسب الأرباح الافتراضية</h3><div class="as144-grid">
          <div class="as144-field"><label>حصة المنصة %</label><input id="as144AdminProfit" type="number" min="0" max="100" value="${escv(val('admin_profit_percent','20'))}"></div>
          <div class="as144-field"><label>حصة المدرس %</label><input id="as144TeacherProfit" type="number" min="0" max="100" value="${escv(val('teacher_profit_percent','50'))}"></div>
          <div class="as144-field"><label>حصة المكتبة %</label><input id="as144LibraryProfit" type="number" min="0" max="100" value="${escv(val('library_profit_percent','30'))}"></div>
          <div class="as144-field"><label>عمولة المندوب %</label><input id="as144CourierProfit" type="number" min="0" max="100" value="${escv(val('delegate_profit_percent','30'))}"></div>
        </div><div id="as144ProfitTotal" class="as144-profit-total"></div><div class="as144-note">تُستخدم هذه النسب كإعدادات افتراضية، ويمكن أن تبقى بعض الملازم مرتبطة بتوزيع خاص بها.</div><div class="as144-actions"><button class="as144-save" data-as144-save="profits">حفظ نسب الأرباح</button></div><div id="as144ProfitsMsg" class="as144-status"></div></div>
      </section>
      <section class="as144-panel" data-as144-panel="orders">
        <div class="as144-card"><h3>الطلبات والتوصيل</h3><div class="as144-grid">
          <div class="as144-field"><label>أجور التوصيل الافتراضية</label><input id="as144DeliveryFee" type="number" min="0" value="${escv(val('delivery_fee','0'))}"></div>
          <div class="as144-field"><label>حالة استقبال الطلبات</label><select id="as144PauseScope"><option value="" ${val('order_pause_scope','')===''?'selected':''}>الطلبات مفتوحة</option><option value="all" ${val('order_pause_scope','')==='all'?'selected':''}>إيقاف الكل</option><option value="booklet" ${val('order_pause_scope','')==='booklet'?'selected':''}>إيقاف الملازم</option><option value="stationery" ${val('order_pause_scope','')==='stationery'?'selected':''}>إيقاف القرطاسية</option><option value="gift" ${val('order_pause_scope','')==='gift'?'selected':''}>إيقاف الهدايا</option></select></div>
          <div class="as144-field full"><label>سبب إيقاف الطلبات</label><textarea id="as144PauseReason">${escv(val('order_pause_reason',''))}</textarea></div>
        </div><div class="as144-toggle"><div><b>إظهار التوصيل للبيت</b><small style="display:block;color:#667085">السماح للطالب باختيار المندوب أو التوصيل.</small></div><input id="as144DeliveryEnabled" type="checkbox" ${String(val('delivery_enabled','true'))!=='false'?'checked':''}></div><div class="as144-actions"><button class="as144-save" data-as144-save="orders">حفظ إعدادات الطلبات</button></div><div id="as144OrdersMsg" class="as144-status"></div></div>
      </section>
      <section class="as144-panel" data-as144-panel="brand">
        <div class="as144-card as145-brand-card"><h3>شعار المنصة وأيقونة التطبيق</h3><p class="as145-brand-intro">ارفع شعار المنصة وأيقونة التطبيق وشاهد المعاينة قبل الحفظ.</p>
          <div class="as145-brand-previews">
            <div><small>الشعار الحالي</small><div id="as145LogoPreview" class="as145-preview as145-preview-wide">${brandPreview('logo')}</div></div>
            <div><small>أيقونة التطبيق</small><div id="as145IconPreview" class="as145-preview">${brandPreview('icon')}</div></div>
          </div>
          <div class="as144-grid">
            <div class="as144-field"><label>رفع شعار المنصة</label><input id="as145LogoFile" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"><small>يفضل شعار أفقي بخلفية شفافة.</small></div>
            <div class="as144-field"><label>رفع أيقونة التطبيق</label><input id="as145IconFile" type="file" accept="image/png,image/jpeg,image/webp"><small>يفضل صورة مربعة 512×512.</small></div>
            <div class="as144-field"><label>الاسم المختصر للتطبيق</label><input id="as145ShortName" value="${escv(val('platform_short_name','آلين'))}" maxlength="20"></div>
          </div>
          <div class="as144-actions"><button class="as145-reset" id="as145BrandReset">استعادة الافتراضي</button><button class="as144-save" id="as145BrandSave">حفظ الشعار والأيقونة</button></div><div id="as145BrandMsg" class="as144-status"></div>
          <div class="as144-note">بعد تغيير أيقونة التطبيق قد تحتاج حذف اختصار المنصة من الهاتف وإضافته من جديد بسبب كاش الجهاز.</div>
        </div>
        <div class="as144-card"><h3>الواجهة والتواصل</h3><div class="as144-grid">
          <div class="as144-field"><label>عنوان الواجهة</label><input id="as144HeroTitle" value="${escv(val('hero_title','كل ما تحتاجه للدراسة بمكان واحد'))}"></div>
          <div class="as144-field"><label>رقم واتساب المنصة</label><input id="as144Whatsapp" value="${escv(val('whatsapp',val('platform_phone','')))}"></div>
          <div class="as144-field full"><label>نص الواجهة</label><textarea id="as144HeroText">${escv(val('hero_text','اختر ملزمتك أو قرطاسيتك واطلبها بسهولة.'))}</textarea></div>
          <div class="as144-field"><label>عنوان قسم عن المنصة</label><input id="as144AboutTitle" value="${escv(val('about_title','عن المنصة'))}"></div>
          <div class="as144-field"><label>عنوان التواصل</label><input id="as144ContactTitle" value="${escv(val('contact_title','تواصل معنا'))}"></div>
          <div class="as144-field full"><label>نص عن المنصة</label><textarea id="as144AboutText">${escv(val('about_text','منصة آلين تجمع الملازم والقرطاسية والهدايا في مكان واحد.'))}</textarea></div>
          <div class="as144-field full"><label>نص التواصل</label><textarea id="as144ContactText">${escv(val('contact_text','للاستفسار أو الانضمام، تواصل مع إدارة منصة آلين.'))}</textarea></div>
        </div><div class="as144-actions"><button class="as144-save" data-as144-save="brand">حفظ الهوية والتواصل</button></div><div id="as144BrandMsg" class="as144-status"></div></div>
      </section>
      <section class="as144-panel" data-as144-panel="security">
        <div class="as144-card as144-danger"><h3>أمان حساب المدير</h3><div class="as144-grid">
          <div class="as144-field"><label>اسم دخول المدير</label><input id="adminLoginName" value="${escv(typeof adminUser==='function'?adminUser():val('admin_username','admin'))}"></div>
          <div class="as144-field"><label>الرمز الحالي</label><input id="adminCurrentPass" type="password"></div>
          <div class="as144-field"><label>الرمز الجديد</label><input id="adminNewPass" type="password"></div>
          <div class="as144-field"><label>تأكيد الرمز الجديد</label><input id="adminNewPass2" type="password"></div>
        </div><div class="as144-note">اترك حقول الرمز الجديد فارغة إذا كنت تريد تغيير اسم الدخول فقط.</div><div class="as144-actions"><button class="as144-save" id="as144SecuritySave">حفظ بيانات المدير</button></div><div id="adminSecurityMsg" class="as144-status"></div></div>
      </section>`;
    root.querySelectorAll('[data-as144-tab]').forEach(b=>b.onclick=()=>{root.querySelectorAll('[data-as144-tab]').forEach(x=>x.classList.toggle('active',x===b));root.querySelectorAll('[data-as144-panel]').forEach(x=>x.classList.toggle('active',x.dataset.as144Panel===b.dataset.as144Tab))});
    const profitInputs=['as144AdminProfit','as144TeacherProfit','as144LibraryProfit'];
    const updateTotal=()=>{const total=profitInputs.reduce((a,id)=>a+(+document.getElementById(id).value||0),0);document.getElementById('as144ProfitTotal').textContent=`مجموع نسب المنصة والمدرس والمكتبة: ${total}%`};profitInputs.forEach(id=>document.getElementById(id).addEventListener('input',updateTotal));updateTotal();
    root.querySelector('[data-as144-save="general"]').onclick=()=>saveMany({platform_name:as144PlatformName.value.trim(),app_version:as144Version.value.trim(),low_stock_default:as144LowStock.value||5,library_debt_alert_limit:as144DebtLimit.value||0,admin_internal_note:as144AdminNote.value.trim()},as144GeneralMsg);
    root.querySelector('[data-as144-save="profits"]').onclick=()=>saveMany({admin_profit_percent:as144AdminProfit.value||20,teacher_profit_percent:as144TeacherProfit.value||50,library_profit_percent:as144LibraryProfit.value||30,delegate_profit_percent:as144CourierProfit.value||30},as144ProfitsMsg);
    root.querySelector('[data-as144-save="orders"]').onclick=()=>saveMany({delivery_fee:as144DeliveryFee.value||0,order_pause_scope:as144PauseScope.value,order_pause_reason:as144PauseReason.value.trim(),delivery_enabled:as144DeliveryEnabled.checked?'true':'false'},as144OrdersMsg);
    root.querySelector('[data-as144-save="brand"]').onclick=()=>saveMany({hero_title:as144HeroTitle.value.trim(),hero_text:as144HeroText.value.trim(),whatsapp:as144Whatsapp.value.trim(),platform_phone:as144Whatsapp.value.trim(),about_title:as144AboutTitle.value.trim(),about_text:as144AboutText.value.trim(),contact_title:as144ContactTitle.value.trim(),contact_text:as144ContactText.value.trim()},as144BrandMsg);
    const logoFile=root.querySelector('#as145LogoFile'),iconFile=root.querySelector('#as145IconFile'),logoBox=root.querySelector('#as145LogoPreview'),iconBox=root.querySelector('#as145IconPreview');
    logoFile.onchange=()=>updateBrandPreview(logoBox,logoFile.files[0]);iconFile.onchange=()=>updateBrandPreview(iconBox,iconFile.files[0]);
    root.querySelector('#as145BrandSave').onclick=async()=>{const m=root.querySelector('#as145BrandMsg');m.className='as144-status';m.textContent='جارٍ رفع الهوية وحفظها...';try{const data={platform_short_name:root.querySelector('#as145ShortName').value.trim()||'آلين'};if(logoFile.files[0])data.platform_logo_path=await uploadIdentity(logoFile.files[0],'logo');if(iconFile.files[0])data.platform_icon_path=await uploadIdentity(iconFile.files[0],'icon');await saveMany(data,m);try{if(typeof load==='function')await load()}catch(e){}applyIdentityNow();m.className='as144-status ok';m.textContent='تم تحديث الشعار والأيقونة بنجاح'}catch(e){m.className='as144-status err';m.textContent=e.message||'تعذر حفظ الهوية'}};
    root.querySelector('#as145BrandReset').onclick=async()=>{if(!confirm('استعادة الشعار والأيقونة الافتراضية؟'))return;const m=root.querySelector('#as145BrandMsg');await saveMany({platform_logo_path:'',platform_icon_path:'',platform_short_name:'آلين'},m);try{if(typeof load==='function')await load()}catch(e){}logoBox.innerHTML='<span>آ</span>';iconBox.innerHTML='<span>آ</span>';applyIdentityNow()};
    root.querySelector('#as144SecuritySave').onclick=async()=>{const m=document.getElementById('adminSecurityMsg');if(typeof saveAdminSecurity==='function'){try{await saveAdminSecurity()}catch(e){m.className='as144-status err';m.textContent=e.message||'تعذر حفظ بيانات المدير'}}else m.textContent='وظيفة أمان المدير غير متاحة في هذه النسخة'};
  }
  function ensureButton(){const tabs=document.querySelector('#adminPage .admin-tabs');if(!tabs)return;const btn=[...tabs.querySelectorAll('button')].find(b=>(b.getAttribute('onclick')||'').includes("adminTab('settings')"));if(btn){btn.textContent='الإعدادات';btn.dataset.adminTab='settings'}}
  function install(){ensureButton();if(window.AlinAdminModules)AlinAdminModules.register('settings',render);const base=window.adminTab;if(typeof base==='function'&&!base.__v144Settings){const wrapped=function(tab){const r=base.apply(this,arguments);if(tab==='settings')requestAnimationFrame(()=>render(document.getElementById('adminContent')));return r};wrapped.__v144Settings=true;window.adminTab=wrapped}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();


;

// === admin/notifications.js ===
/* ===== admin/js/admin-notifications-v146.js ===== */
(function(){
  'use strict';
  const esc = v => String(v ?? '').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const roleLabel = r => ({all:'الجميع',teacher:'المدرسون',library:'المكتبات',student:'الطلبة والمتجر',courier:'المندوبون',accountant:'المحاسب'})[r] || 'الجميع';
  const state={q:'',role:''};
  function rows(){try{return Array.isArray(window.db?.notifications)?window.db.notifications:[]}catch(_){return []}}
  function users(){try{return [...(db.accounts?.teachers||[]),...(db.accounts?.libraries||[]),...(db.accounts?.couriers||[]),...(db.accounts?.accountants||[])];}catch(_){return []}}
  function dateText(v){try{return new Date(v).toLocaleString('ar-IQ')}catch(_){return ''}}
  function filtered(){return rows().filter(n=>{const text=`${n.title||''} ${n.message||n.text||''}`.toLowerCase();const role=n.target_role||n.audience||'all';return(!state.q||text.includes(state.q.toLowerCase()))&&(!state.role||role===state.role)})}
  function ensureButton(){
    const tabs=document.querySelector('#adminPage .admin-tabs');
    if(!tabs)return null;
    let btn=tabs.querySelector('[data-admin-tab="notifications"]');
    if(!btn){
      btn=[...tabs.querySelectorAll('button')].find(b=>(b.getAttribute('onclick')||'').includes("adminTab('notifications')"));
    }
    if(!btn){
      btn=document.createElement('button');
      const settings=[...tabs.querySelectorAll('button')].find(b=>(b.getAttribute('onclick')||'').includes("adminTab('settings')"));
      tabs.insertBefore(btn,settings||null);
    }
    btn.type='button';
    btn.dataset.adminTab='notifications';
    btn.classList.add('admin-notifications-tab-v146');
    btn.innerHTML='<span class="admin-notifications-tab-icon">🔔</span><span>مركز الإشعارات</span>';
    btn.removeAttribute('onclick');
    btn.onclick=function(e){e.preventDefault();e.stopPropagation();openNotifications();};
    btn.hidden=false;
    btn.style.display='inline-flex';
    return btn;
  }
  function mark(){document.querySelectorAll('#adminPage .admin-tabs button').forEach(b=>b.classList.toggle('active-admin-tab',b.dataset.adminTab==='notifications'))}
  function render(){
    const root=document.getElementById('adminContent');
    if(!root)return;
    const list=filtered(),all=rows(),week=all.filter(n=>Date.now()-new Date(n.created_at||0).getTime()<=7*864e5).length;
    const options=users().map(u=>`<option value="${esc(u.id)}">${esc(u.name||u.username||u.email||'حساب')}</option>`).join('');
    root.innerHTML=`<section class="admin-v146-notifications">
      <header class="admin-v146-head"><div><h2>مركز الإشعارات</h2><p>قسم مستقل لإرسال الإشعارات وإدارة السجل.</p></div><div class="admin-v146-bell">🔔</div></header>
      <div class="admin-v146-grid">
        <article class="admin-v146-card"><h3>إرسال إشعار جديد</h3><div class="admin-v146-form">
          <select id="v146Audience"><option value="all">الجميع</option><option value="teacher">المدرسون</option><option value="library">المكتبات</option><option value="student">الطلبة والمتجر</option><option value="courier">المندوبون</option><option value="accountant">المحاسب</option></select>
          <select id="v146Priority"><option value="normal">عادي</option><option value="important">مهم</option><option value="urgent">عاجل</option></select>
          <select id="v146Target" class="full"><option value="">بدون حساب محدد</option>${options}</select>
          <input id="v146Title" class="full" placeholder="عنوان الإشعار">
          <textarea id="v146Message" class="full" placeholder="اكتب نص الإشعار"></textarea>
          <button class="admin-v146-send" type="button" onclick="alinV146Send()">إرسال الإشعار</button><div id="v146Status" class="admin-v146-status"></div>
        </div></article>
        <article class="admin-v146-card"><div class="admin-v146-list-head"><h3>سجل الإشعارات</h3><button type="button" onclick="alinV146Refresh()">تحديث</button></div>
          <div class="admin-v146-stats"><div><small>الإجمالي</small><b>${all.length}</b></div><div><small>آخر 7 أيام</small><b>${week}</b></div><div><small>النتائج</small><b>${list.length}</b></div></div>
          <div class="admin-v146-tools"><input placeholder="بحث" value="${esc(state.q)}" oninput="alinV146Filter('q',this.value)"><select onchange="alinV146Filter('role',this.value)"><option value="">كل الفئات</option>${['all','teacher','library','student','courier','accountant'].map(r=>`<option value="${r}" ${state.role===r?'selected':''}>${roleLabel(r)}</option>`).join('')}</select></div>
          <div class="admin-v146-list">${list.length?list.map(n=>`<div class="admin-v146-item"><div><h4>${esc(n.title||'إشعار')}</h4><p>${esc(n.message||n.text||'')}</p><div class="admin-v146-meta"><span>${roleLabel(n.target_role||n.audience||'all')}</span><span>${esc(n.priority||'normal')}</span><span>${dateText(n.created_at)}</span></div></div><button type="button" class="danger" onclick="alinV146Delete('${esc(n.id)}')">حذف</button></div>`).join(''):'<div class="admin-v146-empty">لا توجد إشعارات حالياً.</div>'}</div>
        </article>
      </div>
    </section>`;
  }
  function openNotifications(){ensureButton();window.activeAdminTab='notifications';mark();render()}
  window.alinV146Filter=(k,v)=>{state[k]=v;render()};
  window.alinV146Refresh=async()=>{try{if(typeof query==='function'){const fresh=await query('notifications');if(window.db)window.db.notifications=fresh}}catch(_){}render()};
  window.alinV146Send=async()=>{
    const status=document.getElementById('v146Status'),title=document.getElementById('v146Title')?.value.trim(),message=document.getElementById('v146Message')?.value.trim(),audience=document.getElementById('v146Audience')?.value||'all',priority=document.getElementById('v146Priority')?.value||'normal',target=document.getElementById('v146Target')?.value||'';
    if(!title||!message){if(status)status.textContent='اكتب العنوان ونص الإشعار.';return}
    const row={id:'NT-'+Date.now(),title,message,text:message,target_role:audience,audience,priority,target_id:target||null,created_at:new Date().toISOString()};
    try{if(typeof insert==='function')await insert('notifications',row);if(window.db){window.db.notifications=Array.isArray(window.db.notifications)?window.db.notifications:[];window.db.notifications.unshift(row)}if(status)status.textContent='تم إرسال الإشعار بنجاح.';setTimeout(render,250)}catch(e){console.error(e);if(status)status.textContent='تعذر الإرسال. تأكد من جدول notifications في Supabase.'}
  };
  window.alinV146Delete=async id=>{if(!confirm('حذف هذا الإشعار؟'))return;try{if(typeof removeRow==='function')await removeRow('notifications',{id});if(window.db&&Array.isArray(window.db.notifications))window.db.notifications=window.db.notifications.filter(n=>String(n.id)!==String(id));render()}catch(e){alert('تعذر حذف الإشعار')}};
  function install(){
    ensureButton();
    const previous=window.adminTab;
    const router=function(tab){if(tab==='notifications'){openNotifications();return}return typeof previous==='function'?previous.apply(this,arguments):undefined};
    router.__v146Notifications=true;window.adminTab=router;
    document.addEventListener('click',e=>{const b=e.target.closest('#adminPage .admin-tabs [data-admin-tab="notifications"]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();openNotifications()},true);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
  window.addEventListener('load',()=>setTimeout(ensureButton,50));
})();


;

// === admin/couriers.js ===
/* ===== admin/js/admin-courier-account-link-v163.js ===== */
(function(){
  'use strict';
  const $ = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
  const escx = v => typeof esc==='function' ? esc(v) : String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const oldAddAccount = window.addAccount;
  const oldRenderAccounts = window.renderAccountsAdmin;
  const oldAdminTab = window.adminTab;

  function areaRows(){
    const rows = Array.isArray(window.db?.delivery_areas) ? window.db.delivery_areas.filter(x=>x.active!==false) : [];
    if(rows.length) return rows.map(x=>({id:x.id||x.name,name:x.name}));
    return ['القادسية','الحرية','الإسكان','عرفة','رحيم آوه','شوراو','طريق بغداد','الواسطي','دوميز','بنجا علي','تسعين','حي النصر','حي النداء','الخضراء','المصلى','القورية','الشورجة','واحد حزيران','الحي العسكري','حي المعلمين','حي الجامعة','حي عدن','حي الزوراء'].map((name,i)=>({id:'K'+i,name}));
  }

  function patchAccountForm(){
    const form = $('#v131AccountForm');
    const role = $('#aRole');
    if(!form || !role) return;

    if(!role.querySelector('option[value="courier"]')){
      const option=document.createElement('option');
      option.value='courier';
      option.textContent='مندوب';
      role.appendChild(option);
    }

    const grid=form.querySelector('.form-grid');
    if(grid && !$('#v163CourierAccountFields')){
      const box=document.createElement('div');
      box.id='v163CourierAccountFields';
      box.className='v163-courier-account-fields';
      box.hidden=true;
      box.innerHTML=`
        <div class="v163-courier-fields-title">
          <div><b>بيانات المندوب</b><small>الحساب يُربط مباشرة بصفحة المندوب ونظام طلبات التوصيل.</small></div>
          <span>صفحة المندوب</span>
        </div>
        <div class="form-grid v163-courier-fields-grid">
          <input id="v163CourierPhone" inputmode="tel" placeholder="رقم هاتف المندوب">
          <select id="v163CourierAvailability">
            <option value="available">متاح</option>
            <option value="busy">مشغول</option>
            <option value="offline">غير متصل</option>
          </select>
        </div>
        <h4>مناطق العمل في كركوك</h4>
        <div id="v163CourierAreaPicker" class="v163-area-picker">
          ${areaRows().map(a=>`<label><input type="checkbox" value="${escx(a.name)}"><span>${escx(a.name)}</span></label>`).join('')}
        </div>
        <p class="v163-account-note">بعد الحفظ يستطيع المندوب تسجيل الدخول من صفحة المندوب بنفس اسم المستخدم والرقم السري.</p>`;
      grid.insertAdjacentElement('afterend',box);
    }

    const sync=()=>{
      const courier=role.value==='courier';
      const courierBox=$('#v163CourierAccountFields');
      if(courierBox) courierBox.hidden=!courier;
      const area=$('#aArea'), landmark=$('#aLandmark');
      if(area){ area.hidden=courier; area.required=!courier; }
      if(landmark){ landmark.hidden=courier; landmark.required=false; }
      const title=form.querySelector('h3');
      if(title) title.textContent=courier?'إضافة حساب مندوب':'إضافة حساب';
    };
    role.onchange=sync;
    sync();
  }

  async function saveCourierFromAccount(){
    try{
      const name=$('#aName')?.value.trim()||'';
      const username=$('#aUser')?.value.trim()||'';
      const password=$('#aPass')?.value.trim()||'';
      const phone=$('#v163CourierPhone')?.value.trim()||'';
      const availability=$('#v163CourierAvailability')?.value||'available';
      const areas=$$('#v163CourierAreaPicker input:checked').map(x=>x.value);
      if(!name || !username || !password) throw new Error('أكمل اسم المندوب واسم الدخول والرقم السري');
      if(!phone) throw new Error('أدخل رقم هاتف المندوب');
      if(!areas.length) throw new Error('اختر منطقة عمل واحدة على الأقل');
      const duplicate=[...(window.couriers||[]),...(window.db?.accounts?.teachers||[]),...(window.db?.accounts?.libraries||[])].some(x=>String(x.username||'').trim().toLowerCase()===username.toLowerCase());
      if(duplicate) throw new Error('اسم الدخول مستخدم مسبقاً');
      const id=typeof uid==='function'?uid('C'):'C'+Date.now();
      const payload={id,name,phone,username,password_hash:password,areas,area:areas[0],availability,status:'active',created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
      if(typeof insert!=='function') throw new Error('تعذر الوصول إلى قاعدة البيانات');
      await insert('couriers',payload);
      if(typeof audit==='function') await audit('courier','إضافة حساب مندوب '+name+' من إدارة الحسابات');
      if(typeof load==='function') await load();
      if(typeof toast==='function') toast('تم إنشاء حساب المندوب وربطه بصفحة المندوب');
      else if(typeof notify==='function') notify('تم إنشاء حساب المندوب وربطه بصفحة المندوب');
      if(typeof window.renderAccountsAdmin==='function') window.renderAccountsAdmin();
      patchAccountForm();
    }catch(e){ alert(e?.message||'تعذر حفظ حساب المندوب'); }
  }

  window.addAccount=async function(){
    if($('#aRole')?.value==='courier') return saveCourierFromAccount();
    if(typeof oldAddAccount==='function') return oldAddAccount.apply(this,arguments);
  };

  window.renderAccountsAdmin=function(){
    const r=typeof oldRenderAccounts==='function'?oldRenderAccounts.apply(this,arguments):undefined;
    patchAccountForm();
    return r;
  };

  window.adminTab=function(tab){
    const r=typeof oldAdminTab==='function'?oldAdminTab.apply(this,arguments):undefined;
    if(tab==='accounts') patchAccountForm();
    return r;
  };

  document.addEventListener('click',e=>{
    const b=e.target.closest('.v131-add-account');
    if(b) setTimeout(patchAccountForm,0);
  });

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',patchAccountForm);
  else patchAccountForm();
})();


;

// === courier/dashboard.js ===
/* ===== courier/js/courier.js ===== */
/* V111: actual courier code moved from core/js/platform-legacy.js */
window.AlinCourierModules=window.AlinCourierModules||{};
function activeCouriers(){ return (couriers||[]).filter(x=>x.status!=='inactive'); }

function renderCouriersAdmin(){
  adminContent.innerHTML=`<h2>المندوبين</h2><div class="form-grid"><input id="courierName" placeholder="اسم المندوب"><input id="courierPhone" placeholder="رقم الهاتف"><input id="courierArea" placeholder="المنطقة"><button onclick="addCourier()">إضافة مندوب</button></div>`+(couriers.map(c=>`<div class="row"><div><b>${esc(c.name)}</b><small>${esc(c.phone||'')} — ${esc(c.area||'')}</small></div><div class="row-actions"><span>${esc(c.status||'active')}</span><button onclick="toggleCourier('${c.id}')">تفعيل/إيقاف</button></div></div>`).join('')||emptyState('لا يوجد مندوبين'));
}

async function addCourier(){ if(!courierName.value.trim())return alert('اكتب اسم المندوب'); await insert('couriers',{id:uid('C'),name:courierName.value.trim(),phone:courierPhone.value.trim(),area:courierArea.value.trim(),status:'active'}); await audit('courier','إضافة مندوب'); await load(); renderCouriersAdmin(); }

async function toggleCourier(id){const c=couriers.find(x=>x.id===id); await update('couriers',{status:c.status==='inactive'?'active':'inactive'},{id}); await load(); renderCouriersAdmin();}

async function assignCourier(id){ await update('orders',{courier_id:document.getElementById('assign_'+id).value||null},{id}); await audit('courier','تعيين مندوب للطلب '+id); await load(); renderCourierSettlementsAdmin(); }

async function courierOrderStatus(id,status){ await update('orders',{status,payment_status:status==='completed'?'paid':'cod_pending'},{id}); if(status==='completed') await maybeCreateFinancialEntry(id); await audit('courier','تحديث حالة توصيل '+id); await load(); renderCourierSettlementsAdmin(); }

function alinCouriersOptions(){ try{return (typeof activeCouriers==='function'?activeCouriers():[]).map(c=>`<option value="${c.id}">${esc(c.name)}${c.area?' — '+esc(c.area):''}</option>`).join('');}catch(e){return '';} }
window.AlinCourierModules['activeCouriers']=typeof activeCouriers==='function'?activeCouriers:window['activeCouriers'];window['activeCouriers']=window.AlinCourierModules['activeCouriers'];
window.AlinCourierModules['renderCouriersAdmin']=typeof renderCouriersAdmin==='function'?renderCouriersAdmin:window['renderCouriersAdmin'];window['renderCouriersAdmin']=window.AlinCourierModules['renderCouriersAdmin'];
window.AlinCourierModules['addCourier']=typeof addCourier==='function'?addCourier:window['addCourier'];window['addCourier']=window.AlinCourierModules['addCourier'];
window.AlinCourierModules['toggleCourier']=typeof toggleCourier==='function'?toggleCourier:window['toggleCourier'];window['toggleCourier']=window.AlinCourierModules['toggleCourier'];
window.AlinCourierModules['assignCourier']=typeof assignCourier==='function'?assignCourier:window['assignCourier'];window['assignCourier']=window.AlinCourierModules['assignCourier'];
window.AlinCourierModules['courierOrderStatus']=typeof courierOrderStatus==='function'?courierOrderStatus:window['courierOrderStatus'];window['courierOrderStatus']=window.AlinCourierModules['courierOrderStatus'];
window.AlinCourierModules['alinCouriersOptions']=typeof alinCouriersOptions==='function'?alinCouriersOptions:window['alinCouriersOptions'];window['alinCouriersOptions']=window.AlinCourierModules['alinCouriersOptions'];

/* ===== courier/js/courier-v161.js ===== */
/* V161: Kirkuk courier area system + manual admin assignment */
(function(){
  'use strict';
  try{if(!('couriers' in window))Object.defineProperty(window,'couriers',{configurable:true,get:()=>couriers,set:v=>{couriers=v}})}catch(_){}
  try{if(!('courierSettlements' in window))Object.defineProperty(window,'courierSettlements',{configurable:true,get:()=>courierSettlements,set:v=>{courierSettlements=v}})}catch(_){}
  try{if(!('db' in window))Object.defineProperty(window,'db',{configurable:true,get:()=>db,set:v=>{db=v}})}catch(_){}
  const DEFAULT_AREAS=['القادسية','الحرية','الإسكان','عرفة','رحيم آوه','شوراو','طريق بغداد','الواسطي','دوميز','بنجا علي','تسعين','حي النصر','حي النداء','الخضراء','المصلى','القورية','الشورجة','واحد حزيران','الحي العسكري','حي المعلمين','حي الجامعة','حي عدن','حي الزوراء','حي الحسين','حي العمل الشعبي','غرناطة','المنصور','البلديات','الشرطة','النداء'];
  window.ALIN_KIRKUK_AREAS=DEFAULT_AREAS.slice();
  const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
  const escV=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const moneyV=v=>typeof money==='function'?money(v):Number(v||0).toLocaleString('ar-IQ');
  const uidV=p=>typeof uid==='function'?uid(p):(p+'-'+Date.now().toString(36));
  const notify=m=>typeof toast==='function'?toast(m):alert(m);
  const now=()=>new Date().toISOString();
  function areaRows(){
    const rows=(window.db?.delivery_areas||window.deliveryAreas||[]).filter(x=>x.active!==false&&String(x.status||'active')!=='inactive');
    return rows.length?rows:DEFAULT_AREAS.map((name,i)=>({id:'KA'+(i+1),name,active:true,sort_order:i+1}));
  }
  function areaNames(c){
    if(!c)return[];
    let raw=c.areas||c.area_ids||c.area||'';
    if(Array.isArray(raw))return raw.map(String);
    if(typeof raw==='string'){
      try{const p=JSON.parse(raw);if(Array.isArray(p))return p.map(String)}catch(_){ }
      return raw.split(/[,،|]/).map(x=>x.trim()).filter(Boolean);
    }
    return[];
  }
  function courierStatus(c){
    if(!c||c.status==='inactive')return'offline';
    const s=String(c.availability||c.work_status||'available');
    return ['available','busy','offline'].includes(s)?s:'available';
  }
  function currentLoad(c){
    return (window.db?.orders||[]).filter(o=>String(o.courier_id||o.delegate_id||'')===String(c.id)&&!['completed','cancelled','delivered'].includes(String(o.status))).length;
  }
  function statusArabic(s){return({available:'متاح',busy:'مشغول',offline:'غير متصل',active:'فعال',inactive:'موقوف'})[s]||s}
  function matchingCouriers(area){
    return (window.couriers||[]).filter(c=>c.status!=='inactive'&&areaNames(c).includes(area)).sort((a,b)=>currentLoad(a)-currentLoad(b));
  }
  function areasOptions(selected=''){return areaRows().map(a=>`<option value="${escV(a.name)}" ${a.name===selected?'selected':''}>${escV(a.name)}</option>`).join('')}
  window.alinV161AreasOptions=areasOptions;

  /* student checkout: fixed area list, courier always assigned by admin */
  function deliveryBlock(hidden=false){return `<div id="deliveryFields" class="${hidden?'hidden':''}"><div class="form-grid"><select id="deliveryArea" required><option value="">اختر منطقة التوصيل في كركوك</option>${areasOptions()}</select><input id="deliveryAddress" placeholder="العنوان الكامل للبيت"><input id="deliveryLandmark" placeholder="أقرب نقطة دالة"></div><div class="checkout-total">أجور التوصيل: <b>${moneyV(typeof alinDeliveryFee==='function'?alinDeliveryFee():0)} د.ع</b></div><p class="v161-delivery-note">بعد تأكيد الطلب يعرض النظام للمدير المندوبين العاملين في منطقتك، والمدير يعيّن المندوب المناسب يدوياً.</p></div>`}
  window.alinDeliveryChoiceHtml=function(){
    const products=typeof alinCartHasProducts==='function'?alinCartHasProducts():false;
    if(products)return `<h3>طريقة التسليم</h3><div class="delivery-choice"><label><input type="radio" name="fulfillment" value="home_delivery" checked> توصيل للبيت والدفع للمندوب</label></div>${deliveryBlock(false)}`;
    return `<h3>طريقة التسليم والدفع</h3><div class="delivery-choice"><label><input type="radio" name="fulfillment" value="pickup" checked onchange="toggleDeliveryFields()"> استلام من المكتبة</label><label><input type="radio" name="fulfillment" value="home_delivery" onchange="toggleDeliveryFields()"> توصيل للبيت</label></div><div id="pickupFields"><select id="libSelect" onchange="showLibInfo()"><option value="">اختر مكتبة الاستلام</option>${typeof alinLibraryOptions==='function'?alinLibraryOptions():''}</select><div id="libInfo"></div></div>${deliveryBlock(true)}`;
  };
  window.alinOrderExtra=function(){
    const forced=typeof alinCartHasProducts==='function'?alinCartHasProducts():false;
    const f=forced?'home_delivery':(document.querySelector('input[name="fulfillment"]:checked')?.value||'pickup');
    if(f==='pickup'){
      const lib=$('#libSelect')?.value||''; if(!lib)throw new Error('اختر مكتبة الاستلام');
      return {fulfillment_type:'pickup',library_id:lib,courier_id:null,delivery_area:null,delivery_address:null,delivery_landmark:null,delivery_fee:0,payment_method:'cash_at_library',payment_status:'cod_pending'};
    }
    const area=$('#deliveryArea')?.value||'',address=($('#deliveryAddress')?.value||'').trim(),landmark=($('#deliveryLandmark')?.value||'').trim();
    if(!area||!address||!landmark)throw new Error('اختر المنطقة وأكمل عنوان التوصيل ونقطة الدلالة');
    return {fulfillment_type:'home_delivery',library_id:null,courier_id:null,delegate_id:null,delivery_area:area,delivery_address:address,delivery_landmark:landmark,delivery_fee:typeof alinDeliveryFee==='function'?alinDeliveryFee():0,payment_method:'cash_to_courier',payment_status:'cod_pending',assignment_status:'pending_admin'};
  };

  /* admin couriers */
  window.renderCouriersAdmin=function(){
    const rows=window.couriers||[];
    adminContent.innerHTML=`<section class="v161-admin"><header class="v161-title"><div><small>نظام التوصيل</small><h2>إدارة المندوبين</h2><p>إضافة المندوبين وربطهم بمناطق كركوك ومتابعة حالتهم والطلبات الحالية.</p></div><button onclick="alinV161CourierForm()">+ إضافة مندوب</button></header><div class="v161-stats"><article><b>${rows.length}</b><span>إجمالي المندوبين</span></article><article><b>${rows.filter(x=>x.status!=='inactive').length}</b><span>فعال</span></article><article><b>${rows.filter(x=>courierStatus(x)==='available').length}</b><span>متاح</span></article><article><b>${rows.reduce((a,c)=>a+currentLoad(c),0)}</b><span>طلبات جارية</span></article></div><div class="v161-toolbar"><input id="v161CourierSearch" placeholder="بحث باسم المندوب أو الهاتف أو المنطقة" oninput="alinV161FilterCouriers()"><select id="v161CourierStatus" onchange="alinV161FilterCouriers()"><option value="">كل الحالات</option><option value="available">متاح</option><option value="busy">مشغول</option><option value="offline">غير متصل</option><option value="inactive">موقوف</option></select></div><div id="v161CourierGrid" class="v161-courier-grid">${rows.map(c=>courierCard(c)).join('')||'<div class="empty">لا يوجد مندوبون بعد.</div>'}</div></section>`;
  };
  function courierCard(c){const areas=areaNames(c),st=c.status==='inactive'?'inactive':courierStatus(c),load=currentLoad(c);return `<article class="v161-courier-card" data-search="${escV((c.name||'')+' '+(c.phone||'')+' '+areas.join(' '))}" data-status="${escV(st)}"><div class="v161-avatar">${escV((c.name||'م').slice(0,1))}</div><div class="v161-courier-info"><div class="v161-card-head"><h3>${escV(c.name||'مندوب')}</h3><span class="v161-status ${st}">${statusArabic(st)}</span></div><p>${escV(c.phone||'بدون رقم هاتف')}</p><div class="v161-area-chips">${areas.map(a=>`<span>${escV(a)}</span>`).join('')||'<span>غير مرتبط بمنطقة</span>'}</div><div class="v161-load"><b>${load}</b> طلبات حالية</div></div><div class="v161-card-actions"><button onclick="alinV161CourierForm('${escV(c.id)}')">تعديل</button><button class="secondary" onclick="alinV161ToggleCourier('${escV(c.id)}')">${c.status==='inactive'?'تفعيل':'إيقاف'}</button></div></article>`}
  window.alinV161FilterCouriers=function(){const q=($('#v161CourierSearch')?.value||'').toLowerCase(),s=$('#v161CourierStatus')?.value||'';$$('.v161-courier-card').forEach(c=>c.hidden=!(c.dataset.search.toLowerCase().includes(q)&&(!s||c.dataset.status===s)))};
  window.alinV161CourierForm=function(id=''){
    const c=(window.couriers||[]).find(x=>String(x.id)===String(id))||{};const selected=areaNames(c);
    checkoutBox.innerHTML=`<div class="v161-form"><h2>${id?'تعديل مندوب':'إضافة مندوب'}</h2><div class="form-grid"><input id="v161CourierName" value="${escV(c.name||'')}" placeholder="اسم المندوب"><input id="v161CourierPhone" value="${escV(c.phone||'')}" placeholder="رقم الهاتف"><input id="v161CourierUsername" value="${escV(c.username||'')}" placeholder="اسم المستخدم"><input id="v161CourierPassword" type="password" value="${escV(c.password_hash||'')}" placeholder="الرقم السري"><select id="v161CourierAvailability"><option value="available" ${courierStatus(c)==='available'?'selected':''}>متاح</option><option value="busy" ${courierStatus(c)==='busy'?'selected':''}>مشغول</option><option value="offline" ${courierStatus(c)==='offline'?'selected':''}>غير متصل</option></select></div><h3>مناطق العمل</h3><div class="v161-area-picker">${areaRows().map(a=>`<label><input type="checkbox" value="${escV(a.name)}" ${selected.includes(a.name)?'checked':''}> ${escV(a.name)}</label>`).join('')}</div><button onclick="alinV161SaveCourier('${escV(id)}')">حفظ المندوب</button></div>`;checkoutModal.classList.remove('hidden');
  };
  window.alinV161SaveCourier=async function(id=''){
    try{const name=$('#v161CourierName').value.trim(),username=$('#v161CourierUsername').value.trim(),password=$('#v161CourierPassword').value.trim();if(!name||!username||!password)throw new Error('أكمل الاسم واسم المستخدم والرقم السري');const areas=$$('.v161-area-picker input:checked').map(x=>x.value);if(!areas.length)throw new Error('اختر منطقة عمل واحدة على الأقل');const payload={name,phone:$('#v161CourierPhone').value.trim(),username,password_hash:password,areas,area:areas[0],availability:$('#v161CourierAvailability').value,status:'active',updated_at:now()};if(id)await update('couriers',payload,{id});else await insert('couriers',{id:uidV('C'),...payload,created_at:now()});if(typeof audit==='function')await audit('courier',id?'تعديل مندوب '+name:'إضافة مندوب '+name);if(typeof load==='function')await load();closeCheckout();renderCouriersAdmin();notify('تم حفظ بيانات المندوب')}catch(e){alert(e.message||'تعذر حفظ المندوب')}};
  window.alinV161ToggleCourier=async function(id){const c=(window.couriers||[]).find(x=>String(x.id)===String(id));if(!c)return;await update('couriers',{status:c.status==='inactive'?'active':'inactive'},{id});if(typeof load==='function')await load();renderCouriersAdmin()};

  /* admin areas */
  window.renderCourierAreasAdmin=function(){const rows=areaRows();adminContent.innerHTML=`<section class="v161-admin"><header class="v161-title"><div><small>كركوك</small><h2>إدارة المناطق</h2><p>قائمة ثابتة تمنع اختلاف كتابة أسماء المناطق، ويمكن تعديلها أو إضافة مناطق جديدة.</p></div><button onclick="alinV161AddArea()">+ إضافة منطقة</button></header><div class="v161-area-admin">${rows.map(a=>{const count=(window.couriers||[]).filter(c=>areaNames(c).includes(a.name)).length;return `<article><div><h3>${escV(a.name)}</h3><p>مرتبط بـ ${count} مندوب</p></div><div><button onclick="alinV161EditArea('${escV(a.id)}','${escV(a.name)}')">تعديل</button><button class="danger" onclick="alinV161DeleteArea('${escV(a.id)}','${escV(a.name)}')">حذف</button></div></article>`}).join('')}</div></section>`};
  window.alinV161AddArea=async function(){const name=(prompt('اسم المنطقة الجديدة')||'').trim();if(!name)return;try{await insert('delivery_areas',{id:uidV('A'),name,city:'كركوك',status:'active',sort_order:areaRows().length+1});if(typeof load==='function')await load();renderCourierAreasAdmin();notify('تمت إضافة المنطقة')}catch(e){alert(e?.message||'تعذر إضافة المنطقة')}};
  window.alinV161EditArea=async function(id,old){const name=(prompt('تعديل اسم المنطقة',old)||'').trim();if(!name||name===old)return;try{await update('delivery_areas',{name},{id});for(const c of (window.couriers||[])){const ar=areaNames(c);if(ar.includes(old))await update('couriers',{areas:ar.map(x=>x===old?name:x),area:(c.area===old?name:c.area)},{id:c.id})}if(typeof load==='function')await load();renderCourierAreasAdmin()}catch(e){alert('تعذر تعديل المنطقة')}};
  window.alinV161DeleteArea=async function(id,name){if((window.couriers||[]).some(c=>areaNames(c).includes(name)))return alert('لا يمكن حذف منطقة مرتبطة بمندوب. أزل الربط أولاً.');if(!confirm('حذف منطقة '+name+'؟'))return;try{await update('delivery_areas',{status:'inactive'},{id});if(typeof load==='function')await load();renderCourierAreasAdmin();notify('تم حذف المنطقة')}catch(e){alert(e?.message||'تعذر حذف المنطقة')}};

  /* manual delivery assignment */
  window.renderDeliveryOrdersAdmin=function(){const orders=(window.db?.orders||[]).filter(o=>o.fulfillment_type==='home_delivery'||o.delivery_area);adminContent.innerHTML=`<section class="v161-admin"><header class="v161-title"><div><small>تحويل يدوي</small><h2>طلبات التوصيل</h2><p>النظام يعرض فقط المندوبين المرتبطين بمنطقة الطلب، والمدير يختار المندوب المناسب.</p></div></header><div class="v161-stats"><article><b>${orders.length}</b><span>كل طلبات التوصيل</span></article><article><b>${orders.filter(o=>!o.courier_id&&!o.delegate_id).length}</b><span>بانتظار التحويل</span></article><article><b>${orders.filter(o=>['out_for_delivery','assigned'].includes(o.status)).length}</b><span>قيد التوصيل</span></article><article><b>${orders.filter(o=>['completed','delivered'].includes(o.status)).length}</b><span>مكتملة</span></article></div><div class="v161-delivery-list">${orders.map(deliveryCard).join('')||'<div class="empty">لا توجد طلبات توصيل.</div>'}</div></section>`};
  function deliveryCard(o){const area=o.delivery_area||'غير محددة',match=matchingCouriers(area),assigned=(window.couriers||[]).find(c=>String(c.id)===String(o.courier_id||o.delegate_id||''));return `<article class="v161-delivery-card"><div class="v161-order-head"><div><small>${escV(o.order_number||o.id)}</small><h3>${escV(o.title||'طلب توصيل')}</h3></div><span class="v161-order-area">${escV(area)}</span></div><div class="v161-order-details"><span>الطالب: <b>${escV(o.student_name||'')}</b></span><span>الهاتف: <b>${escV(o.student_phone||'')}</b></span><span>العنوان: <b>${escV((o.delivery_address||'')+' — '+(o.delivery_landmark||''))}</b></span><span>المبلغ: <b>${moneyV(o.total)} د.ع</b></span></div><div class="v161-match-box"><h4>المندوبون المناسبون (${match.length})</h4>${match.length?match.map(c=>`<label class="v161-match"><input type="radio" name="assign_${escV(o.id)}" value="${escV(c.id)}" ${assigned?.id===c.id?'checked':''}><span><b>${escV(c.name)}</b><small>${statusArabic(courierStatus(c))} • ${currentLoad(c)} طلبات حالية • ${escV(c.phone||'')}</small></span></label>`).join(''):'<p class="warning-text">لا يوجد مندوب مرتبط بهذه المنطقة حالياً.</p>'}</div><div class="v161-delivery-actions"><button ${!match.length?'disabled':''} onclick="alinV161AssignOrder('${escV(o.id)}')">تحويل للمندوب</button>${assigned?`<span>المندوب الحالي: <b>${escV(assigned.name)}</b></span>`:'<span>لم يتم تعيين مندوب بعد</span>'}</div></article>`}
  window.alinV161AssignOrder=async function(orderId){const selected=document.querySelector(`input[name="assign_${CSS.escape(orderId)}"]:checked`)?.value;if(!selected)return alert('اختر مندوباً مناسباً');try{await update('orders',{courier_id:selected,delegate_id:selected,assignment_status:'assigned',status:'assigned',assigned_at:now()},{id:orderId});if(typeof audit==='function')await audit('courier','تحويل الطلب '+orderId+' إلى مندوب');if(typeof load==='function')await load();renderDeliveryOrdersAdmin();notify('تم تحويل الطلب للمندوب')}catch(e){alert(e.message||'تعذر تحويل الطلب')}};

  /* courier login + page */
  const oldDoLogin=doLogin; doLogin=async function(){if(pendingRole!=='courier')return oldDoLogin.apply(this,arguments);const u=loginU.value.trim(),p=loginPass.value.trim();const c=(window.couriers||[]).find(x=>x.username===u&&x.password_hash===p&&x.status!=='inactive');if(!c){loginMsg.textContent='بيانات الدخول غير صحيحة أو الحساب موقوف';return}current={role:'courier',id:c.id,name:c.name,username:c.username};openPage('courier');};
  const oldOpenPage=openPage; openPage=function(page){const r=oldOpenPage.apply(this,arguments);if(page==='courier'){activeNav.innerHTML='<button>المندوب</button>';renderCourierDashboard()}return r};
  window.renderCourierDashboard=function(tab='current'){
    const c=(window.couriers||[]).find(x=>String(x.id)===String(current?.id));if(!c)return;const orders=(window.db?.orders||[]).filter(o=>String(o.courier_id||o.delegate_id||'')===String(c.id));const active=orders.filter(o=>!['completed','delivered','cancelled'].includes(o.status));const done=orders.filter(o=>['completed','delivered'].includes(o.status));const content=$('#courierV161Content');if(!content)return;$('#courierV161Name').textContent=c.name;$('#courierV161Areas').textContent=areaNames(c).join('، ')||'لا توجد مناطق';$$('[data-courier-tab]').forEach(b=>b.classList.toggle('active',b.dataset.courierTab===tab));if(tab==='current')content.innerHTML=courierOrdersHtml(active,true);else if(tab==='completed')content.innerHTML=courierOrdersHtml(done,false);else if(tab==='finance')content.innerHTML=courierFinanceHtml(c,orders);else content.innerHTML=courierProfileHtml(c);
  };
  function courierOrdersHtml(rows,actions){return `<div class="v161-courier-summary"><article><b>${rows.length}</b><span>${actions?'طلبات حالية':'طلبات مكتملة'}</span></article></div><div class="v161-courier-orders">${rows.map(o=>`<article><div><small>${escV(o.order_number||o.id)}</small><h3>${escV(o.title||'طلب')}</h3><p>${escV(o.student_name||'')} • ${escV(o.student_phone||'')}</p><p>${escV(o.delivery_area||'')} — ${escV(o.delivery_address||'')} — ${escV(o.delivery_landmark||'')}</p><b>${moneyV(o.total)} د.ع</b></div>${actions?`<div class="v161-courier-order-actions"><button onclick="alinV161CourierStatus('${escV(o.id)}','out_for_delivery')">استلمت الطلب</button><button onclick="alinV161CourierStatus('${escV(o.id)}','completed')">تم التسليم</button></div>`:`<span class="v161-status available">تم التسليم</span>`}</article>`).join('')||'<div class="empty">لا توجد طلبات.</div>'}</div>`}
  function courierFinanceHtml(c,orders){const delivered=orders.filter(o=>['completed','delivered'].includes(o.status)),received=delivered.reduce((a,o)=>a+(+o.total||0),0),settled=(window.courierSettlements||[]).filter(s=>String(s.courier_id)===String(c.id)).reduce((a,s)=>a+(+s.amount||0),0);return `<div class="v161-stats"><article><b>${moneyV(received)}</b><span>مبالغ مستلمة</span></article><article><b>${moneyV(settled)}</b><span>تمت تسويتها</span></article><article><b>${moneyV(Math.max(0,received-settled))}</b><span>المبلغ بذمتك</span></article></div>`}
  function courierProfileHtml(c){return `<div class="v161-profile"><h2>${escV(c.name)}</h2><p>الهاتف: ${escV(c.phone||'')}</p><p>مناطق العمل: ${escV(areaNames(c).join('، '))}</p><label>حالة العمل<select id="v161MyAvailability"><option value="available" ${courierStatus(c)==='available'?'selected':''}>متاح</option><option value="busy" ${courierStatus(c)==='busy'?'selected':''}>مشغول</option><option value="offline" ${courierStatus(c)==='offline'?'selected':''}>غير متصل</option></select></label><button onclick="alinV161SaveMyStatus()">حفظ الحالة</button></div>`}
  window.alinV161CourierStatus=async function(id,status){await update('orders',{status,payment_status:status==='completed'?'paid':'cod_pending',status_updated_at:now()},{id});if(status==='completed'&&typeof maybeCreateFinancialEntry==='function')await maybeCreateFinancialEntry(id);if(typeof load==='function')await load();renderCourierDashboard('current')};
  window.alinV161SaveMyStatus=async function(){await update('couriers',{availability:$('#v161MyAvailability').value},{id:current.id});if(typeof load==='function')await load();renderCourierDashboard('profile');notify('تم تحديث حالتك')};

  /* admin tab extension */
  const oldAdminTab=adminTab; adminTab=function(t){if(t==='courierAreas')return renderCourierAreasAdmin();if(t==='deliveryOrders')return renderDeliveryOrdersAdmin();return oldAdminTab.apply(this,arguments)};

  /* load delivery areas when possible */
  const oldLoad=load; load=async function(){const r=await oldLoad.apply(this,arguments);try{window.db.delivery_areas=await query('delivery_areas')}catch(_){window.db.delivery_areas=[]}return r};
})();

/* ===== courier/js/courier-v164.js ===== */
/* V164: Courier page + admin courier management completion */
(function(){
  'use strict';
  const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
  const escv=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const moneyv=v=>typeof money==='function'?money(v):Number(v||0).toLocaleString('ar-IQ');
  const now=()=>new Date().toISOString();
  const couriers=()=>Array.isArray(window.couriers)?window.couriers:(Array.isArray(window.db?.accounts?.couriers)?window.db.accounts.couriers:[]);
  const orders=()=>Array.isArray(window.db?.orders)?window.db.orders:[];
  const settlements=()=>Array.isArray(window.courierSettlements)?window.courierSettlements:(Array.isArray(window.db?.courier_settlements)?window.db.courier_settlements:[]);
  const notify=m=>typeof toast==='function'?toast(m):alert(m);
  const roleCurrent=()=>{try{return window.current||current}catch(_){return null}};

  function areasOf(c){
    if(!c)return[];let raw=c.areas||c.area_ids||c.area||[];
    if(Array.isArray(raw))return raw.map(String).filter(Boolean);
    if(typeof raw==='string'){try{const x=JSON.parse(raw);if(Array.isArray(x))return x.map(String)}catch(_){}return raw.split(/[,،|]/).map(x=>x.trim()).filter(Boolean)}
    return[];
  }
  function statusOf(c){if(!c||c.status==='inactive')return'inactive';const s=String(c.availability||c.work_status||'available');return ['available','busy','offline'].includes(s)?s:'available'}
  function statusLabel(s){return({available:'متاح',busy:'مشغول',offline:'غير متصل',inactive:'موقوف'})[s]||s}
  function orderStatus(o){return String(o.status||'assigned')}
  function isDone(o){return ['completed','delivered'].includes(orderStatus(o))}
  function isCancelled(o){return ['cancelled','rejected'].includes(orderStatus(o))}
  function isActive(o){return !isDone(o)&&!isCancelled(o)}
  function courierOrders(c){return orders().filter(o=>String(o.courier_id||o.delegate_id||'')===String(c.id))}
  function activeLoad(c){return courierOrders(c).filter(isActive).length}
  function todayDone(c){const d=new Date().toISOString().slice(0,10);return courierOrders(c).filter(o=>isDone(o)&&String(o.delivered_at||o.completed_at||o.status_updated_at||o.updated_at||'').slice(0,10)===d).length}
  function courierFinancials(c){
    const done=courierOrders(c).filter(isDone);
    const collected=done.reduce((a,o)=>a+(+o.total||0),0);
    const earnings=done.reduce((a,o)=>a+(+o.courier_profit||+o.delivery_fee||0),0);
    const paid=settlements().filter(s=>String(s.courier_id)===String(c.id)&&String(s.status||'paid')!=='cancelled').reduce((a,s)=>a+(+s.amount||0),0);
    return {collected,earnings,paid,debt:Math.max(0,collected-earnings-paid)};
  }
  function phoneLink(phone){const p=String(phone||'').replace(/\D/g,'');return p?`tel:+${p.startsWith('964')?p:'964'+p.replace(/^0/,'')}`:'#'}
  function whatsappLink(phone){const p=String(phone||'').replace(/\D/g,'');return p?`https://wa.me/${p.startsWith('964')?p:'964'+p.replace(/^0/,'')}`:'#'}
  function mapLink(o){return o.delivery_map_url||o.gps_url||(o.delivery_lat&&o.delivery_lng?`https://maps.google.com/?q=${o.delivery_lat},${o.delivery_lng}`:'')}
  function fmtDate(v){if(!v)return'—';try{return new Date(v).toLocaleString('ar-IQ')}catch(_){return String(v)}}

  /* Add stable courier notifications tab */
  function ensureCourierTab(){
    const nav=document.querySelector('.courier-v161-tabs');if(!nav)return;
    if(!nav.querySelector('[data-courier-tab="notifications"]')){
      const b=document.createElement('button');b.type='button';b.dataset.courierTab='notifications';b.textContent='الإشعارات';b.onclick=()=>window.renderCourierDashboard('notifications');nav.appendChild(b);
    }
  }

  window.renderCourierDashboard=function(tab='current'){
    const me=roleCurrent();const c=couriers().find(x=>String(x.id)===String(me?.id));if(!c)return;
    ensureCourierTab();
    const all=courierOrders(c),active=all.filter(isActive),done=all.filter(isDone),fin=courierFinancials(c),content=$('#courierV161Content');if(!content)return;
    $('#courierV161Name').textContent=c.name||'المندوب';$('#courierV161Areas').textContent=areasOf(c).join('، ')||'لا توجد مناطق';
    $$('.courier-v161-tabs [data-courier-tab]').forEach(b=>b.classList.toggle('active',b.dataset.courierTab===tab));
    const summary=`<section class="v164-courier-metrics"><article><small>الحالة</small><strong class="v164-status-text ${statusOf(c)}">${statusLabel(statusOf(c))}</strong></article><article><small>الطلبات الحالية</small><strong>${active.length}</strong></article><article><small>تم اليوم</small><strong>${todayDone(c)}</strong></article><article><small>أرباح التوصيل</small><strong>${moneyv(fin.earnings)} د.ع</strong></article><article><small>المبلغ بذمتك</small><strong>${moneyv(fin.debt)} د.ع</strong></article></section>`;
    if(tab==='current')content.innerHTML=summary+courierOrdersHTML(active,true);
    else if(tab==='completed')content.innerHTML=summary+courierOrdersHTML(done,false);
    else if(tab==='finance')content.innerHTML=summary+courierFinanceHTML(c,all);
    else if(tab==='notifications')content.innerHTML=summary+courierNotificationsHTML(c);
    else content.innerHTML=summary+courierProfileHTML(c);
  };

  function courierOrdersHTML(rows,actions){
    return `<section class="v164-section-head"><div><h2>${actions?'طلبات التوصيل الحالية':'الطلبات المكتملة'}</h2><p>${actions?'تابع الطلب من الاستلام حتى التسليم.':'سجل الطلبات التي تم تسليمها.'}</p></div><span>${rows.length}</span></section><div class="v164-courier-orders">${rows.map(o=>courierOrderCard(o,actions)).join('')||'<div class="empty">لا توجد طلبات حالياً.</div>'}</div>`;
  }
  function courierOrderCard(o,actions){
    const st=orderStatus(o),map=mapLink(o),phone=o.student_phone||'';
    const first=st==='assigned'||st==='new'; const moving=['accepted','picked_up','out_for_delivery','processing'].includes(st);
    return `<article class="v164-order-card"><header><div><small>${escv(o.order_number||o.id)}</small><h3>${escv(o.title||'طلب توصيل')}</h3></div><span class="v164-order-status ${escv(st)}">${escv(({assigned:'محوّل إليك',accepted:'تم القبول',picked_up:'تم الاستلام',out_for_delivery:'في الطريق',completed:'تم التسليم',delivered:'تم التسليم'})[st]||st)}</span></header><div class="v164-order-grid"><div><small>الطالب</small><b>${escv(o.student_name||'—')}</b></div><div><small>الهاتف</small><b>${escv(phone||'—')}</b></div><div><small>المنطقة</small><b>${escv(o.delivery_area||'—')}</b></div><div><small>المبلغ المطلوب</small><b>${moneyv(o.total)} د.ع</b></div><div class="wide"><small>العنوان</small><b>${escv(o.delivery_address||'—')}</b></div><div class="wide"><small>أقرب نقطة دالة</small><b>${escv(o.delivery_landmark||'—')}</b></div></div><div class="v164-order-links">${phone?`<a href="${phoneLink(phone)}">اتصال</a><a href="${whatsappLink(phone)}" target="_blank" rel="noopener">واتساب</a>`:''}${map?`<a class="map" href="${escv(map)}" target="_blank" rel="noopener">فتح الموقع GPS</a>`:''}</div>${actions?`<div class="v164-order-actions">${first?`<button onclick="alinV164CourierStep('${escv(o.id)}','accepted')">قبول الطلب</button>`:''}${first||st==='accepted'?`<button onclick="alinV164CourierStep('${escv(o.id)}','picked_up')">استلمت الطلب</button>`:''}${moving?`<button onclick="alinV164CourierStep('${escv(o.id)}','out_for_delivery')">بدأت التوصيل</button>`:''}<button class="success" onclick="alinV164CourierComplete('${escv(o.id)}')">تم التسليم واستلام المبلغ</button><button class="secondary" onclick="alinV164ReportIssue('${escv(o.id)}')">مشكلة بالطلب</button></div>`:`<footer>تم التسليم: ${escv(fmtDate(o.delivered_at||o.completed_at||o.status_updated_at))}</footer>`}</article>`;
  }
  window.alinV164CourierStep=async function(id,status){try{await update('orders',{status,status_updated_at:now(),courier_note:null},{id});if(typeof audit==='function')await audit('courier',`تحديث الطلب ${id} إلى ${status}`);if(typeof load==='function')await load();renderCourierDashboard('current');notify('تم تحديث حالة الطلب')}catch(e){alert(e.message||'تعذر تحديث الطلب')}};
  window.alinV164CourierComplete=async function(id){if(!confirm('تأكيد تسليم الطلب واستلام المبلغ من الطالب؟'))return;try{await update('orders',{status:'completed',payment_status:'paid',delivered_at:now(),status_updated_at:now()},{id});if(typeof maybeCreateFinancialEntry==='function')await maybeCreateFinancialEntry(id);if(typeof audit==='function')await audit('courier',`تسليم الطلب ${id} واستلام المبلغ`);if(typeof load==='function')await load();renderCourierDashboard('current');notify('تم تسجيل التسليم بنجاح')}catch(e){alert(e.message||'تعذر إكمال الطلب')}};
  window.alinV164ReportIssue=async function(id){const note=(prompt('اكتب المشكلة أو سبب التعذر')||'').trim();if(!note)return;try{await update('orders',{courier_note:note,delivery_issue:true,status_updated_at:now()},{id});if(typeof audit==='function')await audit('courier',`مشكلة في الطلب ${id}: ${note}`);notify('تم إرسال المشكلة للإدارة');if(typeof load==='function')await load();renderCourierDashboard('current')}catch(e){alert(e.message||'تعذر إرسال الملاحظة')}};

  function courierFinanceHTML(c,all){const f=courierFinancials(c),done=all.filter(isDone);return `<section class="v164-finance-grid"><article><small>المبالغ المستلمة من الطلاب</small><strong>${moneyv(f.collected)} د.ع</strong></article><article><small>أرباح التوصيل</small><strong>${moneyv(f.earnings)} د.ع</strong></article><article><small>المبالغ المسددة للإدارة</small><strong>${moneyv(f.paid)} د.ع</strong></article><article class="debt"><small>المبلغ بذمتك</small><strong>${moneyv(f.debt)} د.ع</strong></article></section><section class="v164-table-card"><h2>كشف الطلبات المالية</h2><div class="v164-finance-list">${done.map(o=>`<div><span>${escv(o.order_number||o.id)}</span><span>${moneyv(o.total)} د.ع</span><span>أجرة التوصيل: ${moneyv(o.courier_profit||o.delivery_fee||0)} د.ع</span><span>${escv(fmtDate(o.delivered_at||o.completed_at))}</span></div>`).join('')||'<p class="empty">لا توجد حركات مالية بعد.</p>'}</div></section>`}
  function courierNotificationsHTML(c){const rows=(window.db?.notifications||[]).filter(n=>String(n.user_id||n.recipient_id||'')===String(c.id)||['courier','all'].includes(String(n.role||n.audience||''))).sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));return `<section class="v164-section-head"><div><h2>إشعارات المندوب</h2><p>طلبات جديدة ورسائل الإدارة والتسويات.</p></div><button onclick="alinV164CourierReadAll()">تحديد الكل كمقروء</button></section><div class="v164-notifications">${rows.map(n=>`<article class="${n.read_at||n.is_read?'read':''}"><div><h3>${escv(n.title||'إشعار')}</h3><p>${escv(n.message||n.body||'')}</p><small>${escv(fmtDate(n.created_at))}</small></div>${n.read_at||n.is_read?'':`<button onclick="alinV164CourierRead('${escv(n.id)}')">مقروء</button>`}</article>`).join('')||'<div class="empty">لا توجد إشعارات.</div>'}</div>`}
  window.alinV164CourierRead=async function(id){try{await update('notifications',{is_read:true,read_at:now()},{id});if(typeof load==='function')await load();renderCourierDashboard('notifications')}catch(e){alert('تعذر تحديث الإشعار')}};
  window.alinV164CourierReadAll=async function(){const me=roleCurrent();const rows=(window.db?.notifications||[]).filter(n=>!(n.read_at||n.is_read)&&(String(n.user_id||n.recipient_id||'')===String(me?.id)||['courier','all'].includes(String(n.role||n.audience||''))));for(const n of rows){try{await update('notifications',{is_read:true,read_at:now()},{id:n.id})}catch(_){}}if(typeof load==='function')await load();renderCourierDashboard('notifications')};
  function courierProfileHTML(c){return `<section class="v164-profile"><div class="v164-profile-head"><div class="v161-avatar">${escv((c.name||'م').slice(0,1))}</div><div><h2>${escv(c.name||'مندوب')}</h2><p>${escv(c.phone||'بدون هاتف')}</p></div><span class="v161-status ${statusOf(c)}">${statusLabel(statusOf(c))}</span></div><div class="v164-profile-fields"><label>حالة العمل<select id="v161MyAvailability"><option value="available" ${statusOf(c)==='available'?'selected':''}>متاح</option><option value="busy" ${statusOf(c)==='busy'?'selected':''}>مشغول</option><option value="offline" ${statusOf(c)==='offline'?'selected':''}>غير متصل</option></select></label><div><small>مناطق العمل</small><div class="v161-area-chips">${areasOf(c).map(a=>`<span>${escv(a)}</span>`).join('')||'<span>لا توجد مناطق</span>'}</div></div></div><button onclick="alinV161SaveMyStatus()">حفظ الحالة</button></section>`}

  /* Admin courier management */
  const adminState={q:'',status:'',area:''};
  window.renderCouriersAdmin=function(){
    const rows=couriers(),areaList=(window.db?.delivery_areas||[]).map(x=>x.name).filter(Boolean);const totalActive=rows.filter(c=>c.status!=='inactive').length;
    adminContent.innerHTML=`<section class="v164-admin-couriers"><header class="v164-admin-head"><div><small>نظام التوصيل</small><h2>إدارة المندوبين</h2><p>الحسابات، المناطق، الحالة، الحمل الحالي، الذمم والتواصل من مكان واحد.</p></div><div><button onclick="adminTab('deliveryOrders')">طلبات التوصيل</button><button onclick="adminTab('courierAreas')">إدارة المناطق</button><button onclick="alinV161CourierForm()">+ إضافة مندوب</button></div></header><section class="v164-admin-metrics"><article><small>إجمالي المندوبين</small><strong>${rows.length}</strong></article><article><small>حسابات فعالة</small><strong>${totalActive}</strong></article><article><small>متاحون الآن</small><strong>${rows.filter(c=>statusOf(c)==='available').length}</strong></article><article><small>طلبات جارية</small><strong>${rows.reduce((a,c)=>a+activeLoad(c),0)}</strong></article><article><small>ذمم المندوبين</small><strong>${moneyv(rows.reduce((a,c)=>a+courierFinancials(c).debt,0))} د.ع</strong></article></section><section class="v164-admin-tools"><input id="v164CourierQ" placeholder="بحث بالاسم أو الهاتف أو اسم الدخول أو المنطقة" value="${escv(adminState.q)}"><select id="v164CourierStatus"><option value="">كل الحالات</option>${['available','busy','offline','inactive'].map(s=>`<option value="${s}" ${adminState.status===s?'selected':''}>${statusLabel(s)}</option>`).join('')}</select><select id="v164CourierArea"><option value="">كل المناطق</option>${[...new Set([...areaList,...rows.flatMap(areasOf)])].map(a=>`<option value="${escv(a)}" ${adminState.area===a?'selected':''}>${escv(a)}</option>`).join('')}</select></section><div id="v164CourierGrid" class="v164-admin-grid">${rows.map(adminCourierCard).join('')||'<div class="empty">لا يوجد مندوبون بعد.</div>'}</div></section>`;
    ['v164CourierQ','v164CourierStatus','v164CourierArea'].forEach(id=>$('#'+id)?.addEventListener(id==='v164CourierQ'?'input':'change',()=>{adminState.q=$('#v164CourierQ')?.value||'';adminState.status=$('#v164CourierStatus')?.value||'';adminState.area=$('#v164CourierArea')?.value||'';filterAdminCouriers()}));
  };
  function adminCourierCard(c){const st=c.status==='inactive'?'inactive':statusOf(c),ar=areasOf(c),f=courierFinancials(c);return `<article class="v164-admin-card" data-q="${escv(((c.name||'')+' '+(c.phone||'')+' '+(c.username||'')+' '+ar.join(' ')).toLowerCase())}" data-status="${st}" data-areas="${escv(ar.join('|'))}"><header><div class="v161-avatar">${escv((c.name||'م').slice(0,1))}</div><div><h3>${escv(c.name||'مندوب')}</h3><p>${escv(c.phone||'بدون هاتف')} • ${escv(c.username||'بدون اسم دخول')}</p></div><span class="v161-status ${st}">${statusLabel(st)}</span></header><div class="v164-card-metrics"><div><small>الطلبات الحالية</small><b>${activeLoad(c)}</b></div><div><small>مكتملة اليوم</small><b>${todayDone(c)}</b></div><div><small>الذمة</small><b>${moneyv(f.debt)} د.ع</b></div></div><div class="v161-area-chips">${ar.map(a=>`<span>${escv(a)}</span>`).join('')||'<span>غير مرتبط بمنطقة</span>'}</div><footer><button onclick="alinV164CourierDetails('${escv(c.id)}')">التفاصيل</button><button onclick="alinV161CourierForm('${escv(c.id)}')">تعديل</button><button class="secondary" onclick="alinV164AdminStatus('${escv(c.id)}')">تغيير الحالة</button><button class="danger" onclick="alinV161ToggleCourier('${escv(c.id)}')">${c.status==='inactive'?'تفعيل':'إيقاف'}</button></footer></article>`}
  function filterAdminCouriers(){const q=adminState.q.toLowerCase();$$('.v164-admin-card').forEach(x=>x.hidden=!((!q||x.dataset.q.includes(q))&&(!adminState.status||x.dataset.status===adminState.status)&&(!adminState.area||x.dataset.areas.split('|').includes(adminState.area))))}
  window.alinV164CourierDetails=function(id){const c=couriers().find(x=>String(x.id)===String(id));if(!c)return;const all=courierOrders(c),f=courierFinancials(c);checkoutBox.innerHTML=`<section class="v164-details"><header><div class="v161-avatar">${escv((c.name||'م').slice(0,1))}</div><div><h2>${escv(c.name)}</h2><p>${escv(c.phone||'')} • ${escv(c.username||'')}</p></div><span class="v161-status ${statusOf(c)}">${statusLabel(statusOf(c))}</span></header><div class="v164-admin-metrics"><article><small>طلبات حالية</small><strong>${all.filter(isActive).length}</strong></article><article><small>طلبات مكتملة</small><strong>${all.filter(isDone).length}</strong></article><article><small>أرباحه</small><strong>${moneyv(f.earnings)} د.ع</strong></article><article><small>ذمته</small><strong>${moneyv(f.debt)} د.ع</strong></article></div><h3>مناطق العمل</h3><div class="v161-area-chips">${areasOf(c).map(a=>`<span>${escv(a)}</span>`).join('')}</div><h3>آخر الطلبات</h3><div class="v164-mini-orders">${all.slice(-8).reverse().map(o=>`<div><span>${escv(o.order_number||o.id)}</span><span>${escv(o.delivery_area||'')}</span><b>${moneyv(o.total)} د.ع</b><small>${escv(orderStatus(o))}</small></div>`).join('')||'<p class="empty">لا توجد طلبات.</p>'}</div></section>`;checkoutModal.classList.remove('hidden')};
  window.alinV164AdminStatus=async function(id){const c=couriers().find(x=>String(x.id)===String(id));if(!c)return;const value=prompt('اكتب الحالة: available أو busy أو offline',statusOf(c));if(!['available','busy','offline'].includes(String(value)))return;try{await update('couriers',{availability:value},{id});if(typeof load==='function')await load();renderCouriersAdmin()}catch(e){alert(e.message||'تعذر تحديث الحالة')}};

  /* Delivery admin improvements */
  const oldRenderDelivery=window.renderDeliveryOrdersAdmin;
  window.renderDeliveryOrdersAdmin=function(){
    const list=orders().filter(o=>o.fulfillment_type==='home_delivery'||o.delivery_area),pending=list.filter(o=>!o.courier_id&&!o.delegate_id),issues=list.filter(o=>o.delivery_issue);
    adminContent.innerHTML=`<section class="v164-admin-couriers"><header class="v164-admin-head"><div><small>التوزيع اليدوي</small><h2>طلبات التوصيل</h2><p>مطابقة المنطقة، حالة المندوب، الحمل الحالي، GPS ومشاكل التوصيل.</p></div><button onclick="renderCouriersAdmin()">إدارة المندوبين</button></header><section class="v164-admin-metrics"><article><small>كل طلبات التوصيل</small><strong>${list.length}</strong></article><article><small>بانتظار التحويل</small><strong>${pending.length}</strong></article><article><small>قيد التوصيل</small><strong>${list.filter(o=>isActive(o)&&(o.courier_id||o.delegate_id)).length}</strong></article><article><small>مشاكل مسجلة</small><strong>${issues.length}</strong></article></section><div class="v164-delivery-admin-list">${list.map(deliveryAdminCard).join('')||'<div class="empty">لا توجد طلبات توصيل.</div>'}</div></section>`;
  };
  function deliveryAdminCard(o){const area=o.delivery_area||'غير محددة',matches=couriers().filter(c=>c.status!=='inactive'&&areasOf(c).includes(area)).sort((a,b)=>activeLoad(a)-activeLoad(b)),assigned=couriers().find(c=>String(c.id)===String(o.courier_id||o.delegate_id||'')),map=mapLink(o);return `<article class="v164-delivery-admin-card ${o.delivery_issue?'has-issue':''}"><header><div><small>${escv(o.order_number||o.id)}</small><h3>${escv(o.title||'طلب توصيل')}</h3></div><span>${escv(area)}</span></header>${o.delivery_issue?`<div class="v164-issue">مشكلة المندوب: ${escv(o.courier_note||'بدون تفاصيل')}</div>`:''}<div class="v164-order-grid"><div><small>الطالب</small><b>${escv(o.student_name||'—')}</b></div><div><small>الهاتف</small><b>${escv(o.student_phone||'—')}</b></div><div class="wide"><small>العنوان</small><b>${escv((o.delivery_address||'')+' — '+(o.delivery_landmark||''))}</b></div><div><small>المبلغ</small><b>${moneyv(o.total)} د.ع</b></div><div><small>الحالة</small><b>${escv(orderStatus(o))}</b></div></div>${map?`<a class="v164-map-btn" href="${escv(map)}" target="_blank" rel="noopener">فتح موقع الطالب GPS</a>`:''}<div class="v164-match-list"><h4>المندوبون المطابقون للمنطقة (${matches.length})</h4>${matches.map(c=>`<label><input type="radio" name="v164assign_${escv(o.id)}" value="${escv(c.id)}" ${assigned&&String(assigned.id)===String(c.id)?'checked':''}><span><b>${escv(c.name)}</b><small>${statusLabel(statusOf(c))} • ${activeLoad(c)} طلب حالي • ذمة ${moneyv(courierFinancials(c).debt)} د.ع</small></span></label>`).join('')||'<p class="warning-text">لا يوجد مندوب مرتبط بهذه المنطقة.</p>'}</div><footer><button ${!matches.length?'disabled':''} onclick="alinV164Assign('${escv(o.id)}')">${assigned?'إعادة تحويل':'تحويل للمندوب'}</button>${assigned?`<span>المندوب الحالي: <b>${escv(assigned.name)}</b></span>`:'<span>لم يتم تعيين مندوب</span>'}</footer></article>`}
  window.alinV164Assign=async function(id){const selected=document.querySelector(`input[name="v164assign_${CSS.escape(id)}"]:checked`)?.value;if(!selected)return alert('اختر مندوباً');try{await update('orders',{courier_id:selected,delegate_id:selected,assignment_status:'assigned',status:'assigned',assigned_at:now(),delivery_issue:false,courier_note:null},{id});if(typeof audit==='function')await audit('courier',`تحويل الطلب ${id} إلى المندوب ${selected}`);if(typeof load==='function')await load();renderDeliveryOrdersAdmin();notify('تم تحويل الطلب للمندوب')}catch(e){alert(e.message||'تعذر تحويل الطلب')}};

  document.addEventListener('DOMContentLoaded',()=>{ensureCourierTab()});
})();

/* ===== courier/js/courier-response-timeout-v165.js ===== */
/* V165: one-minute courier acceptance window */
(function(){
  'use strict';
  const TIMEOUT_MS=60*1000;
  const checking=new Set();
  const escx=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
  const nowIso=()=>new Date().toISOString();
  const rows=()=>Array.isArray(window.db?.orders)?window.db.orders:[];
  const notify=m=>typeof toast==='function'?toast(m):console.log(m);
  const assignedAt=o=>new Date(o.assigned_at||o.status_updated_at||o.updated_at||0).getTime();
  const deadline=o=>assignedAt(o)+TIMEOUT_MS;
  const isAwaiting=o=>String(o.status||'')==='assigned' && !['accepted','picked_up','out_for_delivery','completed','delivered','cancelled'].includes(String(o.assignment_status||''));
  const leftMs=o=>Math.max(0,deadline(o)-Date.now());
  const fmt=s=>`00:${String(Math.max(0,s)).padStart(2,'0')}`;

  async function expireOrder(o){
    if(!o?.id||checking.has(String(o.id))||!isAwaiting(o))return;
    checking.add(String(o.id));
    try{
      await update('orders',{
        courier_id:null,
        delegate_id:null,
        status:'pending_admin',
        assignment_status:'expired',
        courier_note:'انتهت مهلة قبول المندوب خلال دقيقة',
        status_updated_at:nowIso()
      },{id:o.id});
      if(typeof audit==='function') await audit('courier',`انتهاء مهلة قبول المندوب للطلب ${o.id} وإعادته للمدير`);
      if(typeof load==='function') await load();
      refreshVisibleViews();
      notify('انتهت مهلة المندوب وأعيد الطلب للمدير');
    }catch(e){ console.error('V165 expire',e); }
    finally{checking.delete(String(o.id));}
  }

  function refreshVisibleViews(){
    try{
      if(document.querySelector('#courierPage:not(.hidden)')&&typeof renderCourierDashboard==='function') renderCourierDashboard('current');
      if(document.querySelector('#adminPage:not(.hidden)')&&typeof renderDeliveryOrdersAdmin==='function') renderDeliveryOrdersAdmin();
    }catch(_){ }
  }

  function checkAll(){
    rows().filter(isAwaiting).forEach(o=>{if(leftMs(o)<=0)expireOrder(o)});
    updateCountdowns();
  }

  function findCardForOrder(o,rootSelector){
    const root=document.querySelector(rootSelector); if(!root)return null;
    const token=String(o.order_number||o.id||'').trim();
    return Array.from(root.querySelectorAll('article')).find(a=>a.textContent.includes(token))||null;
  }

  function responseBox(o,mode){
    const sec=Math.ceil(leftMs(o)/1000);
    const cls=sec<=15?' danger':'';
    return `<div class="v165-response-timer${cls}" data-v165-order="${escx(o.id)}"><span>${mode==='courier'?'مهلة قبول الطلب':'بانتظار قبول المندوب'}</span><strong>${fmt(sec)}</strong><small>${mode==='courier'?'اقبل الطلب قبل انتهاء الوقت':'إذا لم يستجب خلال دقيقة يرجع الطلب تلقائياً للمدير'}</small></div>`;
  }

  function decorateCourier(){
    rows().filter(isAwaiting).forEach(o=>{
      const card=findCardForOrder(o,'#courierV161Content'); if(!card||card.querySelector('[data-v165-order]'))return;
      const actions=card.querySelector('.v164-order-actions')||card;
      actions.insertAdjacentHTML('beforebegin',responseBox(o,'courier'));
    });
  }
  function decorateAdmin(){
    rows().filter(isAwaiting).forEach(o=>{
      const card=findCardForOrder(o,'#adminContent'); if(!card||card.querySelector('[data-v165-order]'))return;
      const footer=card.querySelector('footer')||card;
      footer.insertAdjacentHTML('beforebegin',responseBox(o,'admin'));
    });
  }
  function updateCountdowns(){
    document.querySelectorAll('[data-v165-order]').forEach(box=>{
      const o=rows().find(x=>String(x.id)===String(box.dataset.v165Order));
      if(!o||!isAwaiting(o)){box.remove();return}
      const sec=Math.ceil(leftMs(o)/1000), strong=box.querySelector('strong');
      if(strong)strong.textContent=fmt(sec);
      box.classList.toggle('danger',sec<=15);
    });
    decorateCourier(); decorateAdmin();
  }

  const oldAssign=window.alinV161AssignOrder;
  window.alinV161AssignOrder=async function(orderId){
    const selected=document.querySelector(`input[name="assign_${CSS.escape(String(orderId))}"]:checked`)?.value;
    if(!selected)return alert('اختر مندوباً مناسباً');
    try{
      await update('orders',{
        courier_id:selected,
        delegate_id:selected,
        assignment_status:'awaiting_courier',
        status:'assigned',
        assigned_at:nowIso(),
        courier_note:null,
        status_updated_at:nowIso()
      },{id:orderId});
      if(typeof audit==='function')await audit('courier',`تحويل الطلب ${orderId} إلى مندوب بمهلة قبول دقيقة واحدة`);
      if(typeof load==='function')await load();
      if(typeof renderDeliveryOrdersAdmin==='function')renderDeliveryOrdersAdmin();
      notify('تم تحويل الطلب. أمام المندوب دقيقة واحدة للقبول');
    }catch(e){
      if(typeof oldAssign==='function')return oldAssign.apply(this,arguments);
      alert(e.message||'تعذر تحويل الطلب');
    }
  };

  const oldStep=window.alinV164CourierStep;
  window.alinV164CourierStep=async function(id,status){
    if(status!=='accepted') return typeof oldStep==='function'?oldStep.apply(this,arguments):undefined;
    const o=rows().find(x=>String(x.id)===String(id));
    if(!o)return alert('الطلب غير موجود');
    if(!isAwaiting(o)||leftMs(o)<=0){await expireOrder(o);return alert('انتهت مهلة قبول الطلب وتمت إعادته للمدير')}
    try{
      await update('orders',{status:'accepted',assignment_status:'accepted',status_updated_at:nowIso(),courier_note:null},{id});
      if(typeof audit==='function')await audit('courier',`قبول الطلب ${id} ضمن المهلة`);
      if(typeof load==='function')await load();
      if(typeof renderCourierDashboard==='function')renderCourierDashboard('current');
      notify('تم قبول الطلب بنجاح');
    }catch(e){alert(e.message||'تعذر قبول الطلب')}
  };

  const oldRenderCourier=window.renderCourierDashboard;
  if(typeof oldRenderCourier==='function') window.renderCourierDashboard=function(){const r=oldRenderCourier.apply(this,arguments);setTimeout(decorateCourier,0);return r};
  const oldRenderAdmin=window.renderDeliveryOrdersAdmin;
  if(typeof oldRenderAdmin==='function') window.renderDeliveryOrdersAdmin=function(){const r=oldRenderAdmin.apply(this,arguments);setTimeout(decorateAdmin,0);return r};

  setInterval(checkAll,1000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkAll()});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',checkAll);else checkAll();
})();

/* ===== courier/js/courier-v174-final.js ===== */
/* V174: final courier dashboard and rejection workflow */
(function(){
  'use strict';
  const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
  const escv=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const moneyv=v=>typeof money==='function'?money(v):Number(v||0).toLocaleString('ar-IQ');
  const now=()=>new Date().toISOString();
  const currentRole=()=>{try{return window.current||current}catch(_){return null}};
  const couriers=()=>Array.isArray(window.couriers)?window.couriers:(window.db?.accounts?.couriers||[]);
  const orders=()=>Array.isArray(window.db?.orders)?window.db.orders:[];
  const settlements=()=>Array.isArray(window.courierSettlements)?window.courierSettlements:(window.db?.courier_settlements||[]);
  const notify=m=>typeof toast==='function'?toast(m):alert(m);
  const done=o=>['completed','delivered'].includes(String(o.status||''));
  const cancelled=o=>['cancelled','rejected','assignment_expired'].includes(String(o.status||''));
  const active=o=>!done(o)&&!cancelled(o);
  const myCourier=()=>couriers().find(c=>String(c.id)===String(currentRole()?.id));
  const myOrders=c=>orders().filter(o=>String(o.courier_id||o.delegate_id||'')===String(c?.id));
  function areasOf(c){let x=c?.areas||c?.area_ids||c?.area||[];if(Array.isArray(x))return x;if(typeof x==='string'){try{const j=JSON.parse(x);if(Array.isArray(j))return j}catch(_){}return x.split(/[,،|]/).map(v=>v.trim()).filter(Boolean)}return[]}
  function statusOf(c){if(!c||c.status==='inactive')return'inactive';const s=String(c.availability||c.work_status||'available');return ['available','busy','offline'].includes(s)?s:'available'}
  function statusLabel(s){return({available:'متاح',busy:'مشغول',offline:'خارج الخدمة',inactive:'موقوف'})[s]||s}
  function financials(c){const rows=myOrders(c).filter(done),collected=rows.reduce((a,o)=>a+(+o.total||0),0),earnings=rows.reduce((a,o)=>a+(+o.courier_profit||+o.delivery_fee||0),0),paid=settlements().filter(s=>String(s.courier_id)===String(c.id)&&String(s.status||'paid')!=='cancelled').reduce((a,s)=>a+(+s.amount||0),0);return{collected,earnings,paid,debt:Math.max(0,collected-earnings-paid)}}
  function today(o){const x=o.delivered_at||o.completed_at||o.status_updated_at||o.updated_at||'';return String(x).slice(0,10)===new Date().toISOString().slice(0,10)}
  function orderState(st){return({assigned:'بانتظار القبول',new:'طلب جديد',accepted:'مقبول',picked_up:'تم الاستلام',out_for_delivery:'في الطريق',processing:'قيد التنفيذ',completed:'تم التسليم',delivered:'تم التسليم',cancelled:'ملغي',rejected:'مرفوض',assignment_expired:'انتهت المهلة'})[st]||st}
  function mapLink(o){return o.delivery_map_url||o.gps_url||(o.delivery_lat&&o.delivery_lng?`https://maps.google.com/?q=${o.delivery_lat},${o.delivery_lng}`:'')}
  function phoneLink(p){p=String(p||'').replace(/\D/g,'');return p?`tel:+${p.startsWith('964')?p:'964'+p.replace(/^0/,'')}`:'#'}
  function waLink(p){p=String(p||'').replace(/\D/g,'');return p?`https://wa.me/${p.startsWith('964')?p:'964'+p.replace(/^0/,'')}`:'#'}
  function deadline(o){const raw=o.assignment_expires_at||o.acceptance_deadline||(o.assigned_at?new Date(new Date(o.assigned_at).getTime()+60000).toISOString():'');return raw?new Date(raw):null}
  function countdown(o){const d=deadline(o);if(!d||!['assigned','new'].includes(String(o.status||'')))return'';const ms=d-Date.now();if(ms<=0)return'<span class="v174-timeout expired">انتهت المهلة</span>';return `<span class="v174-timeout" data-v174-deadline="${escv(d.toISOString())}">متبقي ${Math.ceil(ms/1000)} ثانية</span>`}
  function ensureTabs(){const nav=$('.courier-v161-tabs');if(!nav)return;const wanted=[['home','الرئيسية'],['current','طلبات التوصيل'],['completed','المكتملة'],['finance','الحسابات'],['notifications','الإشعارات'],['profile','حسابي']];wanted.forEach(([key,label])=>{let b=nav.querySelector(`[data-courier-tab="${key}"]`);if(!b){b=document.createElement('button');b.type='button';b.dataset.courierTab=key;nav.appendChild(b)}b.textContent=label;b.onclick=()=>window.renderCourierDashboard(key)});const keep=new Set(wanted.map(x=>x[0]));[...nav.querySelectorAll('[data-courier-tab]')].forEach(b=>{if(!keep.has(b.dataset.courierTab))b.remove()})}
  function summary(c,rows){const f=financials(c),newRows=rows.filter(o=>['assigned','new'].includes(String(o.status||''))),accepted=rows.filter(o=>['accepted','picked_up','out_for_delivery','processing'].includes(String(o.status||'')));return `<section class="v174-metrics"><article><small>طلبات جديدة</small><strong>${newRows.length}</strong></article><article><small>طلبات مقبولة</small><strong>${accepted.length}</strong></article><article><small>تم التسليم اليوم</small><strong>${rows.filter(o=>done(o)&&today(o)).length}</strong></article><article><small>طلبات ملغاة</small><strong>${rows.filter(cancelled).length}</strong></article><article><small>رصيدك</small><strong>${moneyv(f.earnings-f.paid)} د.ع</strong></article><article class="debt"><small>ذمتك للإدارة</small><strong>${moneyv(f.debt)} د.ع</strong></article></section>`}
  function home(c,rows){const current=rows.filter(active).slice(0,5),alerts=(window.db?.notifications||[]).filter(n=>String(n.courier_id||n.user_id||n.target_id||'')===String(c.id)).slice(-4).reverse();return `${summary(c,rows)}<section class="v174-home-grid"><article class="v174-panel"><header><div><small>الحالة الحالية</small><h2>${statusLabel(statusOf(c))}</h2></div><span class="v174-status ${statusOf(c)}"></span></header><div class="v174-status-actions"><button onclick="alinV174QuickStatus('available')">متاح</button><button onclick="alinV174QuickStatus('busy')">مشغول</button><button onclick="alinV174QuickStatus('offline')">خارج الخدمة</button></div><p>مناطق العمل: ${escv(areasOf(c).join('، ')||'غير محددة')}</p></article><article class="v174-panel"><header><div><small>أقرب طلباتك</small><h2>طلبات تحتاج متابعة</h2></div><button onclick="renderCourierDashboard('current')">عرض الكل</button></header><div class="v174-mini-list">${current.map(o=>`<button onclick="renderCourierDashboard('current')"><b>${escv(o.order_number||o.id)}</b><span>${escv(o.delivery_area||'—')}</span><small>${escv(orderState(String(o.status||'')))}</small></button>`).join('')||'<p class="empty">لا توجد طلبات حالياً.</p>'}</div></article><article class="v174-panel wide"><header><div><small>آخر الإشعارات</small><h2>تنبيهات المندوب</h2></div><button onclick="renderCourierDashboard('notifications')">مركز الإشعارات</button></header><div class="v174-mini-list">${alerts.map(n=>`<div><b>${escv(n.title||'إشعار')}</b><span>${escv(n.message||n.body||'')}</span></div>`).join('')||'<p class="empty">لا توجد إشعارات جديدة.</p>'}</div></article></section>`}
  function orderCard(o){const st=String(o.status||'assigned'),phone=o.student_phone||'',map=mapLink(o),first=['assigned','new'].includes(st),moving=['accepted','picked_up','out_for_delivery','processing'].includes(st);return `<article class="v174-order"><header><div><small>${escv(o.order_number||o.id)}</small><h3>${escv(o.title||'طلب توصيل')}</h3></div><div>${countdown(o)}<span class="v174-order-state ${escv(st)}">${escv(orderState(st))}</span></div></header><div class="v174-order-data"><div><small>الطالب</small><b>${escv(o.student_name||'—')}</b></div><div><small>الهاتف</small><b>${escv(phone||'—')}</b></div><div><small>المنطقة</small><b>${escv(o.delivery_area||'—')}</b></div><div><small>المبلغ المستلم</small><b>${moneyv(o.total)} د.ع</b></div><div><small>أجرة التوصيل</small><b>${moneyv(o.courier_profit||o.delivery_fee||0)} د.ع</b></div><div class="wide"><small>العنوان ونقطة الدلالة</small><b>${escv((o.delivery_address||'—')+' — '+(o.delivery_landmark||'—'))}</b></div></div><div class="v174-links">${phone?`<a href="${phoneLink(phone)}">اتصال</a><a href="${waLink(phone)}" target="_blank" rel="noopener">واتساب</a>`:''}${map?`<a class="map" href="${escv(map)}" target="_blank" rel="noopener">فتح Google Maps</a>`:''}</div><div class="v174-actions">${first?`<button onclick="alinV164CourierStep('${escv(o.id)}','accepted')">قبول الطلب</button><button class="reject" onclick="alinV174Reject('${escv(o.id)}')">رفض الطلب</button>`:''}${st==='accepted'?`<button onclick="alinV164CourierStep('${escv(o.id)}','picked_up')">استلمت الطلب</button>`:''}${moving?`<button onclick="alinV164CourierStep('${escv(o.id)}','out_for_delivery')">بدء التوصيل</button>`:''}<button class="success" onclick="alinV164CourierComplete('${escv(o.id)}')">تم التسليم</button><button class="secondary" onclick="alinV164ReportIssue('${escv(o.id)}')">تسجيل مشكلة</button></div></article>`}
  function currentOrders(rows){const a=rows.filter(active);return `${summary(myCourier(),rows)}<section class="v174-head"><div><small>طلبات التوصيل</small><h2>طلباتك الحالية</h2></div><span>${a.length}</span></section><div class="v174-orders">${a.map(orderCard).join('')||'<div class="empty">لا توجد طلبات توصيل حالياً.</div>'}</div>`}
  function completed(rows){const d=rows.filter(done);return `${summary(myCourier(),rows)}<section class="v174-head"><div><small>سجل الإنجاز</small><h2>الطلبات المكتملة</h2></div><span>${d.length}</span></section><div class="v174-orders">${d.map(orderCard).join('')||'<div class="empty">لا توجد طلبات مكتملة.</div>'}</div>`}
  const oldRender=window.renderCourierDashboard;
  window.renderCourierDashboard=function(tab='home'){
    const c=myCourier();if(!c){if(typeof oldRender==='function')return oldRender(tab);return}
    ensureTabs();const rows=myOrders(c),box=$('#courierV161Content');if(!box)return;
    $('#courierV161Name').textContent=c.name||'المندوب';$('#courierV161Areas').textContent=areasOf(c).join('، ')||'لا توجد مناطق';$$('.courier-v161-tabs [data-courier-tab]').forEach(b=>b.classList.toggle('active',b.dataset.courierTab===tab));
    if(tab==='home')box.innerHTML=home(c,rows);else if(tab==='current')box.innerHTML=currentOrders(rows);else if(tab==='completed')box.innerHTML=completed(rows);else if(typeof oldRender==='function')return oldRender(tab);
    updateCountdowns();
  };
  window.alinV174QuickStatus=async function(value){const c=myCourier();if(!c)return;try{await update('couriers',{availability:value},{id:c.id});if(typeof load==='function')await load();renderCourierDashboard('home');notify('تم تحديث حالة المندوب')}catch(e){alert(e.message||'تعذر تحديث الحالة')}};
  window.alinV174Reject=async function(id){const reasons=['خارج منطقة عملي','السيارة معطلة','مشغول حالياً','انتهاء الدوام','سبب آخر'];const choice=prompt('اختر رقم سبب الرفض:\n1- خارج منطقة عملي\n2- السيارة معطلة\n3- مشغول حالياً\n4- انتهاء الدوام\n5- سبب آخر','1');if(!choice)return;let reason=reasons[Math.max(0,Math.min(4,Number(choice)-1))]||reasons[0];if(choice==='5'){reason=(prompt('اكتب سبب الرفض')||'').trim();if(!reason)return}if(!confirm(`تأكيد رفض الطلب؟\nالسبب: ${reason}`))return;try{await update('orders',{courier_id:null,delegate_id:null,assignment_status:'pending_admin',status:'pending_admin',courier_rejection_reason:reason,courier_rejected_at:now(),assigned_at:null,assignment_expires_at:null,acceptance_deadline:null,delivery_issue:true,courier_note:reason,status_updated_at:now()},{id});if(typeof audit==='function')await audit('courier',`رفض الطلب ${id}: ${reason}`);if(typeof load==='function')await load();renderCourierDashboard('current');notify('أعيد الطلب إلى المدير لاختيار مندوب آخر')}catch(e){alert(e.message||'تعذر رفض الطلب')}};
  function updateCountdowns(){document.querySelectorAll('[data-v174-deadline]').forEach(el=>{const tick=()=>{const s=Math.max(0,Math.ceil((new Date(el.dataset.v174Deadline)-Date.now())/1000));el.textContent=s?`متبقي ${s} ثانية`:'انتهت المهلة';el.classList.toggle('expired',!s)};tick();const t=setInterval(()=>{if(!document.body.contains(el)||el.classList.contains('expired')){clearInterval(t);return}tick()},1000)})}
  document.addEventListener('DOMContentLoaded',()=>{ensureTabs();setTimeout(()=>{if($('#courierPage:not(.hidden)'))renderCourierDashboard('home')},100)});
})();


;

// === courier/finance.js ===
/* ===== courier/js/settlements.js ===== */
/* V111: actual courier code moved from core/js/platform-legacy.js */
window.AlinCourierModules=window.AlinCourierModules||{};
function renderCourierSettlementsAdmin(){
  const deliveryOrders=(db.orders||[]).filter(o=>o.fulfillment_type==='home_delivery');
  adminContent.innerHTML='<h2>تسويات المندوبين</h2><p class="muted">المندوب يستلم مبلغ الطلب من الطالب عند التسليم، ثم يسلم المبلغ للإدارة بسند قبض.</p>'+deliveryOrders.map(o=>`<div class="row"><div><b>${esc(o.order_number||o.id)} — ${esc(o.title)}</b><small>الطالب: ${esc(o.student_name)} • العنوان: ${esc(o.delivery_area||'')} ${esc(o.delivery_address||'')} • المبلغ ${money(o.total)} د.ع • الحالة ${esc(o.status||'')}</small></div><div class="row-actions"><select id="assign_${o.id}"><option value="">مندوب</option>${couriers.map(c=>`<option value="${c.id}" ${o.courier_id===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select><button onclick="assignCourier('${o.id}')">حفظ</button><button onclick="courierOrderStatus('${o.id}','out_for_delivery')">قيد التوصيل</button><button onclick="courierOrderStatus('${o.id}','completed')">تم التسليم</button></div></div>`).join('')+(deliveryOrders.length?'':'لا توجد طلبات توصيل')+'<h3>سندات تسوية المندوبين</h3>'+(courierSettlements.map(s=>`<div class="row"><b>${esc(s.receipt_number)}</b><span>${money(s.amount)} د.ع</span></div>`).join('')||emptyState('لا توجد تسويات'));
}

async function recordCourierSettlementForOrder(orderId){
  const o=(db.orders||[]).find(x=>x.id===orderId); if(!o)return;
  const amount=+(prompt('مبلغ تسوية المندوب', String(o.total||0))||0); if(amount<=0)return alert('المبلغ غير صحيح');
  const method=prompt('طريقة التسوية','نقدي')||'نقدي';
  const receipt='CR-'+new Date().toISOString().slice(0,10).replaceAll('-','')+'-'+Math.random().toString(36).slice(2,6).toUpperCase();
  await insert('courier_settlements',{id:uid('CS'),receipt_number:receipt,courier_id:o.courier_id||'',amount,payment_method:method,note:'تسوية طلب '+(o.order_number||o.id),status:'received'});
  await audit('courier','تسوية مندوب للطلب '+(o.order_number||o.id)); await load(); renderCourierSettlementsAdmin();
}
window.AlinCourierModules['renderCourierSettlementsAdmin']=typeof renderCourierSettlementsAdmin==='function'?renderCourierSettlementsAdmin:window['renderCourierSettlementsAdmin'];window['renderCourierSettlementsAdmin']=window.AlinCourierModules['renderCourierSettlementsAdmin'];
window.AlinCourierModules['recordCourierSettlementForOrder']=typeof recordCourierSettlementForOrder==='function'?recordCourierSettlementForOrder:window['recordCourierSettlementForOrder'];window['recordCourierSettlementForOrder']=window.AlinCourierModules['recordCourierSettlementForOrder'];


;

// === core/security.js ===
/* ===== core/js/auth-security-v167.js ===== */
/* ALIN V167 — login throttling, session expiry, and role guards. */
(function(){
  'use strict';
  const KEY='alin_security_login_attempts_v167';
  const SESSION='alin_secure_session_v167';
  const MAX_ATTEMPTS=5;
  const LOCK_MS=10*60*1000;
  const IDLE_BY_ROLE={admin:15,accountant:15,teacher:30,library:30,courier:30,student:60,store:60};
  const WARN_MS=2*60*1000;
  let idleTimer=null, warningTimer=null, lastActivity=Date.now(), warningBox=null;

  function readJSON(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'')||fallback}catch(_){return fallback}}
  function writeJSON(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch(_){}}
  function cleanId(value){return String(value||'').trim().toLowerCase().slice(0,80)}
  function attemptKey(role,user){return cleanId(role)+':'+cleanId(user)}
  function attempts(){return readJSON(KEY,{})}
  function getState(role,user){const all=attempts(),k=attemptKey(role,user),s=all[k]||{count:0,first:0,lockedUntil:0};if(s.lockedUntil&&s.lockedUntil<=Date.now()){delete all[k];writeJSON(KEY,all);return {count:0,first:0,lockedUntil:0}}return s}
  function remainingMs(role,user){return Math.max(0,Number(getState(role,user).lockedUntil||0)-Date.now())}
  function registerFailure(role,user){const all=attempts(),k=attemptKey(role,user),now=Date.now(),old=all[k]||{count:0,first:now,lockedUntil:0};if(now-old.first>LOCK_MS){old.count=0;old.first=now}old.count+=1;if(old.count>=MAX_ATTEMPTS)old.lockedUntil=now+LOCK_MS;all[k]=old;writeJSON(KEY,all);return old}
  function clearFailures(role,user){const all=attempts();delete all[attemptKey(role,user)];writeJSON(KEY,all)}
  function formatTime(ms){const sec=Math.ceil(ms/1000),m=Math.floor(sec/60),s=sec%60;return m?`${m} دقيقة و${s} ثانية`:`${s} ثانية`}
  function loginElements(){return {u:window.loginU||document.getElementById('loginU'),p:window.loginPass||document.getElementById('loginPass'),msg:window.loginMsg||document.getElementById('loginMsg')}}
  function roleNow(){try{return String(window.pendingRole||'')}catch(_){return ''}}
  function currentNow(){try{return window.current||null}catch(_){return null}}

  function setSession(user){
    if(!user||!user.role)return;
    const data={role:user.role,id:user.id||'',username:user.username||'',startedAt:Date.now(),lastActivity:Date.now()};
    try{sessionStorage.setItem(SESSION,JSON.stringify(data))}catch(_){}
    lastActivity=Date.now();scheduleIdle();
  }
  function clearSession(){try{sessionStorage.removeItem(SESSION)}catch(_){};clearTimers();hideWarning()}
  function clearTimers(){if(idleTimer)clearTimeout(idleTimer);if(warningTimer)clearTimeout(warningTimer);idleTimer=warningTimer=null}
  function idleLimit(){const role=String(currentNow()?.role||'');return (IDLE_BY_ROLE[role]||30)*60*1000}
  function touch(){if(!currentNow())return;lastActivity=Date.now();try{const d=JSON.parse(sessionStorage.getItem(SESSION)||'{}');d.lastActivity=lastActivity;sessionStorage.setItem(SESSION,JSON.stringify(d))}catch(_){};hideWarning();scheduleIdle()}
  function scheduleIdle(){
    clearTimers();if(!currentNow())return;
    const limit=idleLimit(),elapsed=Date.now()-lastActivity,remain=Math.max(0,limit-elapsed);
    if(remain<=0){expireSession();return}
    warningTimer=setTimeout(showWarning,Math.max(0,remain-WARN_MS));
    idleTimer=setTimeout(expireSession,remain);
  }
  function showWarning(){
    if(!currentNow())return;
    if(!warningBox){warningBox=document.createElement('div');warningBox.className='alin-session-warning';warningBox.innerHTML='<strong>ستنتهي الجلسة قريباً</strong><span>اضغط استمرار حتى تبقى داخل الحساب.</span><button type="button">استمرار</button>';warningBox.querySelector('button').addEventListener('click',touch);document.body.appendChild(warningBox)}
    warningBox.hidden=false;
  }
  function hideWarning(){if(warningBox)warningBox.hidden=true}
  function expireSession(){
    if(!currentNow())return;clearSession();
    try{if(typeof window.toast==='function')window.toast('انتهت الجلسة لعدم النشاط')}catch(_){}
    try{window.logout()}catch(_){location.reload()}
  }

  const allowed={
    admin:new Set(['admin']),accountant:new Set(['admin']),teacher:new Set(['teacher']),library:new Set(['library']),courier:new Set(['courier']),student:new Set(['store']),store:new Set(['store'])
  };
  function canOpen(page){const c=currentNow();if(page==='store')return true;if(!c)return false;return (allowed[c.role]||new Set()).has(page)}

  function install(){
    const oldLogin=window.doLogin;
    if(typeof oldLogin==='function'){
      window.doLogin=async function(){
        const el=loginElements(),role=roleNow(),user=cleanId(el.u?.value),left=remainingMs(role,user);
        if(left>0){if(el.msg)el.msg.textContent='تم إيقاف المحاولات مؤقتاً. حاول بعد '+formatTime(left);return}
        const before=currentNow();
        try{await oldLogin.apply(this,arguments)}catch(e){if(el.msg)el.msg.textContent=e?.message||'تعذّر تسجيل الدخول'}
        const after=currentNow();
        if(after&&after!==before){clearFailures(role,user);if(el.p)el.p.value='';setSession(after);return}
        const state=registerFailure(role,user),tries=Math.max(0,MAX_ATTEMPTS-state.count);
        if(el.msg){el.msg.textContent=state.lockedUntil>Date.now()?'تم إيقاف المحاولات لمدة 10 دقائق بسبب تكرار الخطأ.':`بيانات الدخول غير صحيحة. المحاولات المتبقية: ${tries}`}
        if(el.p)el.p.value='';
      };
    }
    const oldLogout=window.logout;
    if(typeof oldLogout==='function')window.logout=function(){clearSession();const el=loginElements();if(el.p)el.p.value='';return oldLogout.apply(this,arguments)};
    const oldOpen=window.openPage;
    if(typeof oldOpen==='function')window.openPage=function(page){if(!canOpen(page)){try{if(typeof window.toast==='function')window.toast('ليس لديك صلاحية لفتح هذه الصفحة');else alert('ليس لديك صلاحية لفتح هذه الصفحة')}catch(_){};return}const r=oldOpen.apply(this,arguments);if(currentNow())setSession(currentNow());return r};

    ['click','keydown','touchstart','pointerdown'].forEach(ev=>document.addEventListener(ev,touch,{passive:true}));
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)touch()});
    if(currentNow())setSession(currentNow());
    window.ALINSecureSession=Object.freeze({version:'167.1',touch,expire:expireSession,remainingMs});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();

/* ===== core/js/file-security-v168.js ===== */
/* ALIN V168 — file upload and URL safety without changing current auth. */
(function(){
  'use strict';
  const RULES={
    image:{ext:['png','jpg','jpeg','webp'],mime:['image/png','image/jpeg','image/webp'],max:8*1024*1024},
    pdf:{ext:['pdf'],mime:['application/pdf'],max:50*1024*1024},
    word:{ext:['docx'],mime:['application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/octet-stream'],max:50*1024*1024}
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

/* ===== core/js/legacy-auth-stabilizer-v173.js ===== */
(function(){
  "use strict";
  // V173: keep the proven username/password login until final Supabase migration.
  // This intentionally prevents experimental email-auth adapters from replacing legacy handlers.
  const legacyDoLogin = window.doLogin;
  const legacyLogout = window.logout;
  if (typeof legacyDoLogin === "function") window.doLogin = legacyDoLogin;
  if (typeof legacyLogout === "function") window.logout = legacyLogout;
  window.ALIN_AUTH_MODE = "legacy";
})();


;

// === core/design.js ===
/* ===== core/design/design-system.js ===== */
(function(){
  document.documentElement.classList.add('alin-design-v175');
  function ready(){document.body?.classList.add('alin-ui-ready')}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
  document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.disabled)return;b.classList.add('alin-click');setTimeout(()=>b.classList.remove('alin-click'),180)});
})();


;

// === admin/branding.js ===
/* ===== admin/js/admin-brand-identity-v176.js ===== */
(function(){
  const defaults={theme:'education',primary:'#0b2345',secondary:'#e1aa32',background:'#f5f7fb',card:'#ffffff',success:'#15803d',warning:'#b7791f',danger:'#b42318',font:'Cairo',radius:18,shadow:'soft'};
  const templates={classic:{primary:'#1d4ed8',secondary:'#f59e0b',background:'#f8fafc',card:'#ffffff',font:'Cairo',radius:16,shadow:'soft'},dark:{primary:'#171717',secondary:'#d4a72c',background:'#f3f4f6',card:'#ffffff',font:'Tajawal',radius:18,shadow:'medium'},education:{primary:'#0b2345',secondary:'#e1aa32',background:'#f5f7fb',card:'#ffffff',font:'Cairo',radius:20,shadow:'soft'}};
  const escv=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const getSettings=()=>{try{return db?.settings||{}}catch(e){return {}}};
  const getStored=()=>{try{return JSON.parse(localStorage.getItem('alin_visual_identity_v176')||'{}')}catch(e){return {}}};
  function current(){const s=getSettings(),l=getStored();return {...defaults,...l,theme:s.visual_theme||l.theme||defaults.theme,primary:s.visual_primary||l.primary||defaults.primary,secondary:s.visual_secondary||l.secondary||defaults.secondary,background:s.visual_background||l.background||defaults.background,card:s.visual_card||l.card||defaults.card,success:s.visual_success||l.success||defaults.success,warning:s.visual_warning||l.warning||defaults.warning,danger:s.visual_danger||l.danger||defaults.danger,font:s.visual_font||l.font||defaults.font,radius:Number(s.visual_radius||l.radius||defaults.radius),shadow:s.visual_shadow||l.shadow||defaults.shadow,logo:s.platform_logo_path||s.platform_logo_url||l.logo||'',logoDark:s.platform_logo_dark_path||l.logoDark||'',icon:s.platform_icon_path||s.platform_icon_url||l.icon||''}}
  const urlOf=p=>{if(!p)return '';if(/^(https?:|data:|blob:)/.test(String(p)))return String(p);try{return typeof mediaUrl==='function'?mediaUrl(p):String(p)}catch(e){return String(p)}};
  async function upload(file,kind){if(!file)return '';if(file.size>3*1024*1024)throw new Error('حجم الصورة يجب أن يكون أقل من 3MB');if(typeof uploadBrandFile==='function')return uploadBrandFile(file,kind);if(typeof uploadFile==='function')return uploadFile('brand/'+kind,file);return await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error('تعذر قراءة الصورة'));r.readAsDataURL(file)})}
  function shadowValue(name){return name==='none'?'none':name==='medium'?'0 14px 34px rgba(7,26,55,.11)':'0 8px 24px rgba(7,26,55,.07)'}
  function applyTheme(v){const d=document.documentElement.style;d.setProperty('--alin-primary',v.primary);d.setProperty('--alin-primary-2',v.primary);d.setProperty('--alin-primary-3',v.primary);d.setProperty('--alin-gold',v.secondary);d.setProperty('--alin-gold-2',v.secondary);d.setProperty('--alin-bg',v.background);d.setProperty('--alin-surface',v.card);d.setProperty('--alin-surface-2',v.card);d.setProperty('--alin-success',v.success);d.setProperty('--alin-warning',v.warning);d.setProperty('--alin-danger',v.danger);d.setProperty('--alin-radius-lg',v.radius+'px');d.setProperty('--alin-radius-md',Math.max(10,v.radius-4)+'px');d.setProperty('--alin-shadow-md',shadowValue(v.shadow));document.body.style.fontFamily=`"${v.font}",Tahoma,"Segoe UI",sans-serif`;document.documentElement.dataset.alinTheme=v.theme||'custom';const logo=urlOf(v.logo),icon=urlOf(v.icon);document.querySelectorAll('.alin98-logo,.logo,.brand .logo').forEach(el=>{if(logo){el.innerHTML=`<img src="${escv(logo)}" alt="شعار آلين" style="width:100%;height:100%;object-fit:contain">`} });if(icon)document.querySelectorAll('link[rel="icon"],link[rel="apple-touch-icon"]').forEach(l=>l.href=icon)}
  async function saveOne(k,v){if(typeof settingsSet==='function')return settingsSet(k,String(v));if(typeof alinV57SaveSetting==='function')return alinV57SaveSetting(k,String(v));if(typeof sb!=='undefined'&&sb?.from){const {error}=await sb.from('settings').upsert({key:k,value:String(v)});if(error)throw error;return}try{if(db?.settings)db.settings[k]=String(v);localStorage.setItem('alin_db',JSON.stringify(db))}catch(e){}}
  function previewImage(box,file){if(!file)return;const u=URL.createObjectURL(file);box.innerHTML=`<img src="${u}" alt="معاينة">`}
  function render(root){const v=current();root.className='admin-brand-v176';root.innerHTML=`
    <div class="ab176-head"><div><h2>الهوية البصرية</h2><p>تحكم بألوان وشعار وخط وتصميم منصة آلين من مكان واحد.</p></div><span class="ab176-badge">V176</span></div>
    <div class="ab176-layout"><div class="ab176-stack">
      <section class="ab176-card"><h3>القوالب الجاهزة</h3><p>اختر قالباً ثم عدّل التفاصيل حسب رغبتك.</p><div class="ab176-templates">
        <button class="ab176-template ${v.theme==='classic'?'active':''}" data-theme="classic"><span class="ab176-swatches"><i style="background:#1d4ed8"></i><i style="background:#f59e0b"></i><i style="background:#f8fafc"></i></span><b>Alin Classic</b><small>أزرق وأبيض</small></button>
        <button class="ab176-template ${v.theme==='dark'?'active':''}" data-theme="dark"><span class="ab176-swatches"><i style="background:#171717"></i><i style="background:#d4a72c"></i><i style="background:#f3f4f6"></i></span><b>Dark Pro</b><small>فحمي وذهبي</small></button>
        <button class="ab176-template ${v.theme==='education'?'active':''}" data-theme="education"><span class="ab176-swatches"><i style="background:#0b2345"></i><i style="background:#e1aa32"></i><i style="background:#f5f7fb"></i></span><b>Education</b><small>هوية آلين التعليمية</small></button>
      </div></section>
      <section class="ab176-card"><h3>الشعار والأيقونة</h3><p>ارفع هوية واضحة بخلفية شفافة، والأيقونة يفضل أن تكون مربعة.</p><div class="ab176-grid">
        <div class="ab176-upload"><div id="ab176LogoPreview" class="ab176-upload-preview">${v.logo?`<img src="${escv(urlOf(v.logo))}" alt="الشعار">`:'آ'}</div><div class="ab176-field"><label>الشعار الأساسي</label><input id="ab176Logo" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"></div></div>
        <div class="ab176-upload"><div id="ab176DarkLogoPreview" class="ab176-upload-preview">${v.logoDark?`<img src="${escv(urlOf(v.logoDark))}" alt="الشعار الأبيض">`:'آ'}</div><div class="ab176-field"><label>شعار الوضع الداكن</label><input id="ab176DarkLogo" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"></div></div>
        <div class="ab176-upload full"><div id="ab176IconPreview" class="ab176-upload-preview icon">${v.icon?`<img src="${escv(urlOf(v.icon))}" alt="الأيقونة">`:'آ'}</div><div class="ab176-field"><label>أيقونة التطبيق 512×512</label><input id="ab176Icon" type="file" accept="image/png,image/jpeg,image/webp"></div></div>
      </div></section>
      <section class="ab176-card"><h3>الألوان والخط</h3><p>التغييرات تظهر مباشرة في المعاينة قبل الحفظ.</p><div class="ab176-grid">
        ${[['primary','اللون الأساسي'],['secondary','اللون الثانوي'],['background','الخلفية'],['card','البطاقات'],['success','النجاح'],['warning','التحذير'],['danger','الخطأ']].map(([k,l])=>`<div class="ab176-field"><label>${l}</label><input data-color="${k}" type="color" value="${escv(v[k])}"></div>`).join('')}
        <div class="ab176-field"><label>الخط العربي</label><select id="ab176Font"><option ${v.font==='Cairo'?'selected':''}>Cairo</option><option ${v.font==='Tajawal'?'selected':''}>Tajawal</option><option ${v.font==='IBM Plex Sans Arabic'?'selected':''}>IBM Plex Sans Arabic</option><option ${v.font==='Noto Kufi Arabic'?'selected':''}>Noto Kufi Arabic</option></select></div>
        <div class="ab176-field"><label>الظلال</label><select id="ab176Shadow"><option value="none" ${v.shadow==='none'?'selected':''}>بدون ظل</option><option value="soft" ${v.shadow==='soft'?'selected':''}>خفيف</option><option value="medium" ${v.shadow==='medium'?'selected':''}>متوسط</option></select></div>
        <div class="ab176-field full"><label>استدارة البطاقات والأزرار</label><div class="ab176-slider"><input id="ab176Radius" type="range" min="8" max="30" value="${v.radius}"><output>${v.radius}px</output></div></div>
      </div></section>
      <div class="ab176-actions"><button id="ab176Reset" class="ab176-reset">استعادة الافتراضي</button><button id="ab176Save" class="ab176-save">حفظ وتطبيق الهوية</button></div><div id="ab176Status" class="ab176-status"></div>
    </div><aside class="ab176-preview-wrap"><div class="ab176-card"><h3>معاينة مباشرة</h3><p>نموذج مصغر للمتجر ولوحات المنصة.</p><div id="ab176Preview" class="ab176-preview"><div class="ab176-preview-top"><div class="ab176-preview-brand"><span id="ab176PreviewLogo" class="ab176-preview-logo">آ</span><div><b>منصة آلين</b><small style="display:block;opacity:.75">للملازم والقرطاسية</small></div></div><span>•••</span></div><div class="ab176-preview-body"><div class="ab176-preview-hero"><h4>كل ما تحتاجه للدراسة</h4><p>هوية موحدة وجذابة لكل صفحات المنصة.</p><button>تصفح المتجر</button></div><div class="ab176-preview-cards"><div class="ab176-preview-card"><b>الطلبات</b><small>24 طلباً</small></div><div class="ab176-preview-card"><b>الأرباح</b><small>125,000 د.ع</small></div></div><div class="ab176-preview-note">هذه المعاينة لا تحفظ أي تغيير إلا بعد الضغط على حفظ وتطبيق الهوية.</div></div></div></div></aside></div>`;
    let draft={...v};const sync=()=>{const p=root.querySelector('#ab176Preview');p.style.setProperty('--ab-primary',draft.primary);p.style.setProperty('--ab-secondary',draft.secondary);p.style.setProperty('--ab-bg',draft.background);p.style.setProperty('--ab-card',draft.card);p.style.setProperty('--ab-font',`"${draft.font}",Tahoma,sans-serif`);p.style.setProperty('--ab-radius',draft.radius+'px');p.style.setProperty('--ab-shadow',shadowValue(draft.shadow));root.querySelector('#ab176PreviewLogo').innerHTML=draft.logo?`<img src="${escv(urlOf(draft.logo))}" alt="الشعار">`:'آ'};sync();
    root.querySelectorAll('[data-theme]').forEach(b=>b.onclick=()=>{root.querySelectorAll('[data-theme]').forEach(x=>x.classList.toggle('active',x===b));draft={...draft,...templates[b.dataset.theme],theme:b.dataset.theme};root.querySelectorAll('[data-color]').forEach(i=>i.value=draft[i.dataset.color]);root.querySelector('#ab176Font').value=draft.font;root.querySelector('#ab176Radius').value=draft.radius;root.querySelector('#ab176Radius').nextElementSibling.textContent=draft.radius+'px';root.querySelector('#ab176Shadow').value=draft.shadow;sync()});
    root.querySelectorAll('[data-color]').forEach(i=>i.oninput=()=>{draft[i.dataset.color]=i.value;draft.theme='custom';sync()});root.querySelector('#ab176Font').onchange=e=>{draft.font=e.target.value;sync()};root.querySelector('#ab176Shadow').onchange=e=>{draft.shadow=e.target.value;sync()};root.querySelector('#ab176Radius').oninput=e=>{draft.radius=Number(e.target.value);e.target.nextElementSibling.textContent=draft.radius+'px';sync()};
    const logo=root.querySelector('#ab176Logo'),dark=root.querySelector('#ab176DarkLogo'),icon=root.querySelector('#ab176Icon');logo.onchange=()=>{if(logo.files[0]){previewImage(root.querySelector('#ab176LogoPreview'),logo.files[0]);const u=URL.createObjectURL(logo.files[0]);draft.logo=u;sync()}};dark.onchange=()=>{if(dark.files[0])previewImage(root.querySelector('#ab176DarkLogoPreview'),dark.files[0])};icon.onchange=()=>{if(icon.files[0])previewImage(root.querySelector('#ab176IconPreview'),icon.files[0])};
    root.querySelector('#ab176Reset').onclick=()=>{if(!confirm('استعادة هوية آلین الافتراضية؟'))return;draft={...defaults};render(root)};
    root.querySelector('#ab176Save').onclick=async()=>{const msg=root.querySelector('#ab176Status');msg.className='ab176-status';msg.textContent='جارٍ حفظ الهوية...';try{if(logo.files[0])draft.logo=await upload(logo.files[0],'logo');if(dark.files[0])draft.logoDark=await upload(dark.files[0],'logo-dark');if(icon.files[0])draft.icon=await upload(icon.files[0],'icon');const map={visual_theme:draft.theme,visual_primary:draft.primary,visual_secondary:draft.secondary,visual_background:draft.background,visual_card:draft.card,visual_success:draft.success,visual_warning:draft.warning,visual_danger:draft.danger,visual_font:draft.font,visual_radius:draft.radius,visual_shadow:draft.shadow,platform_logo_path:draft.logo||'',platform_logo_dark_path:draft.logoDark||'',platform_icon_path:draft.icon||''};for(const [k,val] of Object.entries(map))await saveOne(k,val);localStorage.setItem('alin_visual_identity_v176',JSON.stringify(draft));try{if(db?.settings)Object.assign(db.settings,map)}catch(e){}applyTheme(draft);msg.className='ab176-status ok';msg.textContent='تم حفظ وتطبيق الهوية البصرية بنجاح';if(typeof toast==='function')toast('تم تطبيق الهوية البصرية')}catch(e){msg.className='ab176-status err';msg.textContent=e.message||'تعذر حفظ الهوية'}}
  }
  function install(){applyTheme(current());if(window.AlinAdminModules)AlinAdminModules.register('brandIdentity',render);const base=window.adminTab;if(typeof base==='function'&&!base.__brandV176){const w=function(t){if(t==='brandIdentity'){window.activeAdminTab=t;render(document.getElementById('adminContent'));document.querySelectorAll('#adminPage .admin-tabs button').forEach(b=>{const isBrand=(b.getAttribute('onclick')||'').includes("'brandIdentity'");b.classList.toggle('active-admin-tab',isBrand)});return}return base.apply(this,arguments)};w.__brandV176=true;window.adminTab=w}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();window.AlinVisualIdentityV176={apply:()=>applyTheme(current()),render};
})();


;

// === admin/backup.js ===
/* ===== admin/js/admin-backup-rc1.js ===== */
(function(){
  const VERSION='RC1';
  const LOG_KEY='alin_backup_log_rc1';
  let pending=null;
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const size=x=>{const n=Number(x||0);if(n<1024)return n+' B';if(n<1048576)return (n/1024).toFixed(1)+' KB';return (n/1048576).toFixed(1)+' MB'};
  const nowName=()=>`Alin_Backup_${new Date().toISOString().replace(/[:T]/g,'-').slice(0,19)}.json`;
  const clone=v=>JSON.parse(JSON.stringify(v??{}));
  function logs(){try{return JSON.parse(localStorage.getItem(LOG_KEY)||'[]')}catch(_){return[]}}
  function saveLogs(rows){localStorage.setItem(LOG_KEY,JSON.stringify(rows.slice(0,20)))}
  function snapshot(){
    const data=clone(window.db||{});
    const local={};
    Object.keys(localStorage).filter(k=>k.startsWith('alin_')||k.startsWith('ALIN_')).forEach(k=>{if(k!==LOG_KEY)local[k]=localStorage.getItem(k)});
    return {app:'ALIN',backup_version:VERSION,created_at:new Date().toISOString(),source_version:'V177',data,local_settings:local};
  }
  function downloadObject(obj,name){const blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);return blob.size}
  function addLog(name,bytes,type='manual'){const rows=logs();rows.unshift({id:Date.now(),name,size:bytes,created_at:new Date().toISOString(),type});saveLogs(rows)}
  function stats(){const d=window.db||{};return {orders:(d.orders||[]).length,accounts:[...(d.accounts?.teachers||[]),...(d.accounts?.libraries||[])].length,booklets:(d.booklets||[]).length,products:(d.products||[]).length}}
  function render(){
    const root=document.getElementById('adminContent');if(!root)return;
    const s=stats(),l=logs();
    root.dataset.adminModule='backup';
    root.innerHTML=`<section class="admin-backup-rc1"><header class="admin-backup-head"><div><h2>النسخ الاحتياطي والاستعادة</h2><p>حفظ نسخة محلية من بيانات المنصة واستعادتها عند الحاجة.</p></div><span class="status">${VERSION}</span></header><section class="admin-backup-summary"><article class="admin-backup-stat"><small>الطلبات</small><b>${s.orders}</b></article><article class="admin-backup-stat"><small>الحسابات</small><b>${s.accounts}</b></article><article class="admin-backup-stat"><small>الملازم</small><b>${s.booklets}</b></article><article class="admin-backup-stat"><small>المنتجات</small><b>${s.products}</b></article></section><section class="admin-backup-grid"><article class="admin-backup-card"><h3>إنشاء نسخة احتياطية</h3><p>تنزيل ملف JSON يحتوي على البيانات والإعدادات المحلية الحالية.</p><div class="admin-backup-actions"><button onclick="alinCreateBackup()">إنشاء وتنزيل النسخة</button></div></article><article class="admin-backup-card"><h3>استعادة نسخة</h3><p>اختر ملف نسخة آلين، افحصه ثم نفّذ الاستعادة بعد التأكيد.</p><div class="admin-backup-file"><input id="alinBackupFile" type="file" accept=".json,application/json" onchange="alinReadBackup(this.files[0])"><div id="alinBackupStatus" class="admin-backup-warning">لم يتم اختيار ملف.</div><div id="alinBackupPreview"></div><div class="admin-backup-actions"><button id="alinRestoreBtn" class="admin-backup-danger" disabled onclick="alinRestoreBackup()">استعادة البيانات</button></div></div></article></section><article class="admin-backup-card"><h3>سجل النسخ</h3><div class="admin-backup-log">${l.length?l.map(x=>`<article><div><b>${esc(x.name)}</b><small>${new Date(x.created_at).toLocaleString('ar-IQ')} — ${size(x.size)}</small></div><span>${x.type==='auto'?'تلقائية':'يدوية'}</span></article>`).join(''):'<p class="muted">لا توجد نسخ مسجلة بعد.</p>'}</div></article></section>`;
  }
  window.alinCreateBackup=function(){const obj=snapshot(),name=nowName(),bytes=downloadObject(obj,name);addLog(name,bytes);render();if(typeof toast==='function')toast('تم إنشاء النسخة الاحتياطية')};
  window.alinReadBackup=async function(file){pending=null;const status=document.getElementById('alinBackupStatus'),preview=document.getElementById('alinBackupPreview'),btn=document.getElementById('alinRestoreBtn');if(!file){status.textContent='لم يتم اختيار ملف.';btn.disabled=true;return}try{const text=await file.text();const obj=JSON.parse(text);if(obj.app!=='ALIN'||!obj.data||typeof obj.data!=='object')throw new Error('الملف ليس نسخة احتياطية صالحة لمنصة آلين');pending=obj;status.className='admin-backup-ok';status.textContent=`الملف صالح — ${file.name} — ${size(file.size)}`;preview.innerHTML=`<pre class="admin-backup-preview">${esc(JSON.stringify({created_at:obj.created_at,backup_version:obj.backup_version,orders:(obj.data.orders||[]).length,booklets:(obj.data.booklets||[]).length,products:(obj.data.products||[]).length},null,2))}</pre>`;btn.disabled=false}catch(e){status.className='admin-backup-warning';status.textContent=e.message||'تعذر قراءة الملف';preview.innerHTML='';btn.disabled=true}};
  window.alinRestoreBackup=function(){if(!pending)return alert('اختر نسخة صالحة أولاً');if(!confirm('سيتم استبدال البيانات الحالية بالنسخة المختارة. هل تريد المتابعة؟'))return;try{const auto=snapshot(),name='Alin_Auto_Before_Restore_'+Date.now()+'.json',bytes=downloadObject(auto,name);addLog(name,bytes,'auto');window.db=clone(pending.data);Object.entries(pending.local_settings||{}).forEach(([k,v])=>localStorage.setItem(k,String(v)));if(typeof renderAll==='function')renderAll();render();alert('تمت الاستعادة. أعد تحميل الصفحة لتطبيق كل البيانات.')}catch(e){alert('تعذرت الاستعادة: '+(e.message||e))}};
  function addButton(){document.querySelectorAll('#adminPage .admin-tabs').forEach(tabs=>{if(tabs.querySelector('[data-admin-tab="backup"],button[onclick*="backup"]'))return;const b=document.createElement('button');b.textContent='النسخ الاحتياطي';b.dataset.adminTab='backup';b.setAttribute('onclick',"adminTab('backup')");const settings=[...tabs.querySelectorAll('button')].find(x=>(x.getAttribute('onclick')||'').includes("'settings'"));settings?tabs.insertBefore(b,settings):tabs.appendChild(b)})}
  function install(){addButton();const base=window.adminTab;if(typeof base==='function'&&!base.__backupRC1){const wrapped=function(tab){window.activeAdminTab=tab;if(tab==='backup'){render();document.querySelectorAll('#adminPage .admin-tabs button').forEach(b=>b.classList.toggle('active-admin-tab',b.dataset.adminTab==='backup'||(b.getAttribute('onclick')||'').includes("'backup'")));return}return base.apply(this,arguments)};wrapped.__backupRC1=true;window.adminTab=wrapped}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();


;

// === admin/system-health.js ===
/* ===== admin/js/admin-system-health-rc2.js ===== */
(function(){
  'use strict';
  const VERSION='RC2';
  const ERR_KEY='alin_system_errors_rc2';
  const SUPABASE_URL='https://jyavewwlgiaibtdqyzpd.supabase.co';
  const ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5YXZld3dsZ2lhaWJ0ZHF5enBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0MTczMzcsImV4cCI6MjA5ODk5MzMzN30.fcjx4JrNdwd5Xrm_Nn1CaWWJoJLF6_DyYGakFPuGwGQ';
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
  function backupInfo(){let logs=[];try{logs=JSON.parse(localStorage.getItem('alin_backup_log_rc1')||'[]')}catch(_){}return {count:logs.length,last:logs[0]?.created_at||null}}
  async function runChecks(){if(checking)return lastReport;checking=true;renderLoading();const started=new Date().toISOString();const checks=await Promise.all([
    timed('database',pingDatabase),timed('storage',pingStorage),timed('internet',async()=>{if(!navigator.onLine)throw new Error('الجهاز غير متصل بالإنترنت');return {detail:'متصل'}}),timed('localData',async()=>({detail:'البيانات المحلية جاهزة'}))
  ]);const stats=localStats(),backup=backupInfo();const errors=readErrors();lastReport={version:'ALIN RC2',started,finished:new Date().toISOString(),checks,stats,backup,error_count:errors.length,url:location.href,user_agent:navigator.userAgent};checking=false;render();return lastReport}
  function statusOf(c){if(c.status==='bad')return['bad','غير متصل'];if(c.value?.restricted)return['warn','متصل بصلاحية مقيدة'];return['ok','يعمل']}
  function card(title,c,detail){const [cls,label]=statusOf(c);return `<article class="admin-health-card ${cls}"><small>${esc(title)}</small><strong><i class="health-dot"></i>${esc(label)}</strong><span>${esc(detail||c.value?.detail||c.error||'')} • ${c.ms||0}ms</span></article>`}
  function renderLoading(){const root=document.getElementById('adminContent');if(root)root.innerHTML='<section class="admin-health-rc2"><div class="admin-health-empty">جاري فحص صحة النظام...</div></section>'}
  function render(){const root=document.getElementById('adminContent');if(!root)return;const r=lastReport,checks=Object.fromEntries((r?.checks||[]).map(x=>[x.name,x]));const stats=r?.stats||localStats(),backup=r?.backup||backupInfo(),errs=readErrors();const bad=(r?.checks||[]).filter(x=>x.status==='bad').length,warn=(r?.checks||[]).filter(x=>x.value?.restricted).length;const overall=!r?'warn':bad?'bad':warn?'warn':'ok';const overallText=!r?'لم يتم الفحص بعد':bad?'توجد خدمات تحتاج متابعة':warn?'النظام يعمل مع قيود صلاحيات':'جميع الخدمات الأساسية تعمل';root.dataset.adminModule='systemHealth';root.innerHTML=`<section class="admin-health-rc2"><header class="admin-health-head"><div><h2>صحة النظام</h2><p>مراقبة الاتصال والخدمات والبيانات الأساسية لمنصة آلين.</p></div><span class="admin-health-status ${overall}">${esc(overallText)}</span></header><div class="admin-health-actions"><button type="button" onclick="alinRunSystemHealth()">فحص النظام الآن</button><button type="button" class="secondary" onclick="alinRefreshSystemHealth()">تحديث الحالة</button><button type="button" class="secondary" onclick="alinExportSystemHealth()" ${r?'':'disabled'}>تصدير التقرير</button></div><section class="admin-health-grid">${card('قاعدة البيانات',checks.database||{status:'bad',error:'لم يتم الفحص'},'')}${card('التخزين',checks.storage||{status:'bad',error:'لم يتم الفحص'},'')}${card('اتصال الإنترنت',checks.internet||{status:navigator.onLine?'ok':'bad',value:{detail:navigator.onLine?'متصل':'غير متصل'},ms:0},'')}${card('النسخ الاحتياطي',{status:backup.count?'ok':'warn',value:{restricted:!backup.count,detail:backup.count?`${backup.count} نسخة مسجلة`:'لا توجد نسخة مسجلة'},ms:0},'')}</section><section class="admin-health-panels"><article class="admin-health-panel"><h3>إحصائيات النظام الحالية</h3><div class="admin-health-list"><div class="admin-health-row"><span>الطلبات</span><b>${stats.orders}</b></div><div class="admin-health-row"><span>الملازم والمنتجات</span><b>${stats.booklets+stats.products}</b></div><div class="admin-health-row"><span>المدرسون</span><b>${stats.teachers}</b></div><div class="admin-health-row"><span>المكتبات</span><b>${stats.libraries}</b></div><div class="admin-health-row"><span>المندوبون</span><b>${stats.couriers}</b></div><div class="admin-health-row"><span>الحركات المالية</span><b>${stats.ledger}</b></div></div></article><article class="admin-health-panel"><h3>معلومات الإصدار</h3><div class="admin-health-list"><div class="admin-health-row"><span>الإصدار</span><b>RC2</b></div><div class="admin-health-row"><span>آخر فحص</span><b>${r?new Date(r.finished).toLocaleString('ar-IQ'):'—'}</b></div><div class="admin-health-row"><span>آخر نسخة احتياطية</span><b>${backup.last?new Date(backup.last).toLocaleString('ar-IQ'):'لا توجد'}</b></div><div class="admin-health-row"><span>حالة الإنترنت</span><b>${navigator.onLine?'متصل':'غير متصل'}</b></div></div></article></section><article class="admin-health-panel"><h3>آخر الأخطاء المسجلة</h3><div class="admin-health-errors">${errs.length?errs.slice(0,10).map(e=>`<div class="admin-health-error"><b>${esc(e.type)}</b><div>${esc(e.message)}</div><small>${new Date(e.at).toLocaleString('ar-IQ')} — ${esc(e.page)}</small></div>`).join(''):'<div class="admin-health-empty">لا توجد أخطاء مسجلة في هذه الجلسات.</div>'}</div></article>${r?`<details class="admin-health-panel"><summary>عرض التقرير التقني</summary><pre class="admin-health-report">${esc(JSON.stringify(r,null,2))}</pre></details>`:''}</section>`}
  window.alinRunSystemHealth=runChecks;window.alinRefreshSystemHealth=runChecks;window.alinExportSystemHealth=function(){if(!lastReport)return;const blob=new Blob([JSON.stringify(lastReport,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`Alin_System_Health_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
  function addButton(){document.querySelectorAll('#adminPage .admin-tabs').forEach(tabs=>{let b=tabs.querySelector('[data-admin-tab="systemHealth"],button[onclick*="systemHealth"]');if(!b){b=document.createElement('button');b.textContent='صحة النظام';b.dataset.adminTab='systemHealth';b.className='admin-health-tab-rc2';b.setAttribute('onclick',"adminTab('systemHealth')");const settings=[...tabs.querySelectorAll('button')].find(x=>(x.getAttribute('onclick')||'').includes("'settings'"));settings?tabs.insertBefore(b,settings):tabs.appendChild(b)}})}
  function install(){addButton();if(window.AlinAdminModules)window.AlinAdminModules.register('systemHealth',render);const base=window.adminTab;if(typeof base==='function'&&!base.__systemHealthRC2){const wrapped=function(tab){window.activeAdminTab=tab;if(tab==='systemHealth'){render();document.querySelectorAll('#adminPage .admin-tabs button').forEach(b=>b.classList.toggle('active-admin-tab',b.dataset.adminTab==='systemHealth'||(b.getAttribute('onclick')||'').includes("'systemHealth'")));return}return base.apply(this,arguments)};wrapped.__systemHealthRC2=true;window.adminTab=wrapped}}
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
  function install(){addTab();if(window.AlinAdminModules)window.AlinAdminModules.register('supabaseReadiness',render);const base=window.adminTab;if(typeof base==='function'&&!base.__rc54){const wrapped=function(tab){window.activeAdminTab=tab;if(tab==='supabaseReadiness'){render();document.querySelectorAll('#adminPage .admin-tabs button').forEach(b=>b.classList.toggle('active-admin-tab',b.dataset.adminTab==='supabaseReadiness'));return}return base.apply(this,arguments)};wrapped.__rc54=true;window.adminTab=wrapped}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();


;

// === core/supabase-ui.js ===
/* ===== core/js/supabase-ui-binding-rc5-3.js ===== */
/* منصة آلين RC5.3 - ربط الواجهة النهائي مع Supabase
   هذه الطبقة تُحمّل بعد جميع وحدات المنصة حتى تكون آخر طبقة مسؤولة عن:
   1) مزامنة البيانات السحابية مع نموذج db المستخدم في الواجهات القديمة.
   2) تحديث الواجهة بعد الإضافة والتعديل والحذف.
   3) توحيد رفع الملفات والروابط.
   4) منع الرجوع الصامت إلى بيانات تجريبية عند نجاح الاتصال.
*/
(function(){
  'use strict';

  const VERSION='RC5.3';
  const ESSENTIAL_TABLES=[
    'settings','accounts','delivery_areas','couriers','courier_areas','categories',
    'booklets','teacher_requests','teacher_request_versions','products','orders',
    'order_items','order_timeline','financial_entries','financial_payouts',
    'library_settlements','teacher_settlements','delegate_settlements','notifications',
    'banners','coupons','audit','backup_logs','system_health_logs'
  ];
  const REFRESH_EVENT='alin:data-refreshed';
  const MUTATION_EVENT='alin:cloud-mutation';
  let refreshTimer=null;
  let refreshing=null;
  let installed=false;

  const now=()=>new Date().toISOString();
  const uid=(p='ID')=>`${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2,9)}`;
  const errText=e=>e?.message||String(e||'خطأ غير معروف');
  const client=()=>window.AlinCloud?.client?.()||window.sb||null;
  const online=()=>navigator.onLine&&!!client();

  function ensureDb(){
    if(!window.db||typeof window.db!=='object') window.db={};
    const d=window.db;
    d.accounts=d.accounts||{teachers:[],libraries:[]};
    d.accounts.teachers=d.accounts.teachers||[];
    d.accounts.libraries=d.accounts.libraries||[];
    ['booklets','products','categories','banners','orders','permits','ledger','withdrawals','audit','couriers','deliveryAreas','notifications','teacherRequests','orderItems','orderTimeline','financialEntries','financialPayouts','librarySettlements','teacherSettlements','courierSettlements','coupons','backupLogs','systemHealthLogs'].forEach(k=>{if(!Array.isArray(d[k]))d[k]=[]});
    d.settings=d.settings||{storeType:'booklet'};
    return d;
  }

  function settingsToObject(rows){
    const out={storeType:'booklet'};
    (rows||[]).forEach(s=>{
      if(s.id==='main'||s.key==='__main__'){
        if(s.data&&typeof s.data==='object') Object.assign(out,s.data);
        ['platform_name','platform_phone','hero_title','hero_text','version'].forEach(k=>{if(s[k]!=null)out[k]=s[k]});
      }
      if(s.key&&s.key!=='__main__') out[s.key]=s.value;
    });
    return out;
  }

  function rowsToDb(rows){
    const d=ensureDb();
    const accounts=(rows.accounts||[]).filter(x=>!x.deleted_at);
    d.accounts.teachers=accounts.filter(x=>x.role==='teacher');
    d.accounts.libraries=accounts.filter(x=>x.role==='library');
    d.accounts.all=accounts;
    d.booklets=(rows.booklets||[]).filter(x=>!x.deleted_at);
    d.products=(rows.products||[]).filter(x=>!x.deleted_at);
    d.categories=rows.categories||[];
    d.banners=rows.banners||[];
    d.orders=(rows.orders||[]).slice().sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));
    d.audit=(rows.audit||[]).slice().sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));
    d.settings={...d.settings,...settingsToObject(rows.settings||[])};
    d.couriers=(rows.couriers||[]).filter(x=>!x.deleted_at);
    d.deliveryAreas=rows.delivery_areas||[];
    d.courierAreas=rows.courier_areas||[];
    d.notifications=rows.notifications||[];
    d.teacherRequests=rows.teacher_requests||[];
    d.teacherRequestVersions=rows.teacher_request_versions||[];
    d.orderItems=rows.order_items||[];
    d.orderTimeline=rows.order_timeline||[];
    d.financialEntries=rows.financial_entries||[];
    d.financialPayouts=rows.financial_payouts||[];
    d.librarySettlements=rows.library_settlements||[];
    d.teacherSettlements=rows.teacher_settlements||[];
    d.courierSettlements=rows.delegate_settlements||[];
    d.coupons=rows.coupons||[];
    d.backupLogs=rows.backup_logs||[];
    d.systemHealthLogs=rows.system_health_logs||[];
    return d;
  }

  async function fetchTable(table){
    const c=client();
    if(!c) throw new Error('اتصال Supabase غير متوفر');
    let q=c.from(table).select('*');
    if(['orders','notifications','audit','order_timeline','financial_entries'].includes(table)) q=q.order('created_at',{ascending:false});
    const {data,error}=await q;
    if(error) throw error;
    return data||[];
  }

  async function refresh(options={}){
    if(refreshing&&!options.force) return refreshing;
    refreshing=(async()=>{
      const rows={},errors=[];
      if(!online()) throw new Error('لا يوجد اتصال فعّال بقاعدة البيانات');
      await Promise.all(ESSENTIAL_TABLES.map(async table=>{
        try{rows[table]=await fetchTable(table)}catch(e){rows[table]=[];errors.push({table,error:errText(e)})}
      }));
      const d=rowsToDb(rows);
      localStorage.setItem('alin_rc5_3_snapshot',JSON.stringify({at:now(),db:d}));
      window.dispatchEvent(new CustomEvent(REFRESH_EVENT,{detail:{version:VERSION,errors,at:now()}}));
      try{ if(typeof window.renderAll==='function') window.renderAll(); }catch(e){console.warn('[RC5.3 renderAll]',e)}
      return {db:d,errors};
    })();
    try{return await refreshing}finally{refreshing=null}
  }

  function scheduleRefresh(delay=350){
    clearTimeout(refreshTimer);
    refreshTimer=setTimeout(()=>refresh({force:true}).catch(e=>console.warn('[RC5.3 refresh]',e)),delay);
  }

  function collectionFor(table){
    const d=ensureDb();
    const map={
      booklets:'booklets',products:'products',categories:'categories',banners:'banners',orders:'orders',audit:'audit',
      couriers:'couriers',delivery_areas:'deliveryAreas',notifications:'notifications',teacher_requests:'teacherRequests',
      teacher_request_versions:'teacherRequestVersions',order_items:'orderItems',order_timeline:'orderTimeline',
      financial_entries:'financialEntries',financial_payouts:'financialPayouts',library_settlements:'librarySettlements',
      teacher_settlements:'teacherSettlements',delegate_settlements:'courierSettlements',coupons:'coupons',
      backup_logs:'backupLogs',system_health_logs:'systemHealthLogs'
    };
    if(table==='accounts') return d.accounts.all||(d.accounts.all=[]);
    const k=map[table]; return k?(d[k]||(d[k]=[])):null;
  }

  function applyLocalInsert(table,row){
    if(!row)return;
    if(table==='settings'){
      if(row.key&&row.key!=='__main__') ensureDb().settings[row.key]=row.value;
      if(row.data&&typeof row.data==='object')Object.assign(ensureDb().settings,row.data);
      return;
    }
    const list=collectionFor(table); if(!list)return;
    const i=list.findIndex(x=>String(x.id)===String(row.id));
    if(i>=0) list[i]={...list[i],...row}; else list.unshift(row);
    if(table==='accounts') rowsToDb({accounts:list});
  }
  function applyLocalUpdate(table,values,match){
    if(table==='settings'){
      if(match?.key)ensureDb().settings[match.key]=values.value;
      if(values.data&&typeof values.data==='object')Object.assign(ensureDb().settings,values.data);
      return;
    }
    const list=collectionFor(table); if(!list)return;
    list.forEach((x,i)=>{if(Object.entries(match||{}).every(([k,v])=>String(x[k])===String(v)))list[i]={...x,...values}});
    if(table==='accounts') rowsToDb({accounts:list});
  }
  function applyLocalDelete(table,match){
    const list=collectionFor(table);if(!list)return;
    for(let i=list.length-1;i>=0;i--)if(Object.entries(match||{}).every(([k,v])=>String(list[i][k])===String(v)))list.splice(i,1);
    if(table==='accounts')rowsToDb({accounts:list});
  }

  function installMutationBridge(){
    const previous={insert:window.insert,update:window.update,removeRow:window.removeRow,query:window.query};
    if(typeof previous.query==='function') window.query=async function(table){
      if(online())try{return await fetchTable(table)}catch(e){console.warn('[RC5.3 query]',table,e)}
      return typeof previous.query==='function'?previous.query.apply(this,arguments):[];
    };
    if(typeof previous.insert==='function') window.insert=async function(table,row){
      const payload={...row};
      if(!payload.id&&table!=='settings'&&table!=='courier_areas')payload.id=uid(table.slice(0,2).toUpperCase());
      const result=await previous.insert.call(this,table,payload);
      applyLocalInsert(table,result||payload);
      window.dispatchEvent(new CustomEvent(MUTATION_EVENT,{detail:{type:'insert',table,row:result||payload}}));
      scheduleRefresh();
      return result||payload;
    };
    if(typeof previous.update==='function') window.update=async function(table,values,match){
      const result=await previous.update.call(this,table,values,match);
      applyLocalUpdate(table,values,match);
      window.dispatchEvent(new CustomEvent(MUTATION_EVENT,{detail:{type:'update',table,values,match}}));
      scheduleRefresh();
      return result;
    };
    if(typeof previous.removeRow==='function') window.removeRow=async function(table,match){
      const result=await previous.removeRow.call(this,table,match);
      applyLocalDelete(table,match);
      window.dispatchEvent(new CustomEvent(MUTATION_EVENT,{detail:{type:'delete',table,match}}));
      scheduleRefresh();
      return result;
    };
  }

  const BUCKET_BY_KIND={
    teacherWord:'teacher-word',finalPdf:'final-pdf',productImage:'product-images',banner:'banners',logo:'logos',profile:'profile-images',backup:'backups',generic:'alin-files'
  };
  async function upload(kind,file,folder=''){
    if(!file?.name)throw new Error('اختر ملفاً أولاً');
    const c=client();if(!c)throw new Error('Supabase غير متصل');
    const bucket=BUCKET_BY_KIND[kind]||kind||'alin-files';
    const ext=(file.name.split('.').pop()||'bin').toLowerCase().replace(/[^a-z0-9]/g,'')||'bin';
    const safeFolder=String(folder||'').replace(/[^a-z0-9_\-/]/gi,'').replace(/^\/+|\/+$/g,'');
    const path=`${safeFolder?safeFolder+'/':''}${Date.now()}_${crypto.randomUUID().replace(/-/g,'').slice(0,20)}.${ext}`;
    const {data,error}=await c.storage.from(bucket).upload(path,file,{upsert:false,cacheControl:'3600',contentType:file.type||undefined});
    if(error)throw error;
    return {bucket,path:data?.path||path};
  }
  async function fileUrl(ref,expires=900){
    if(!ref)return '';
    if(/^https?:\/\//i.test(String(ref)))return String(ref);
    const bucket=ref.bucket||'alin-files',path=ref.path||String(ref);
    const c=client();if(!c)return '';
    const {data,error}=await c.storage.from(bucket).createSignedUrl(path,expires);
    if(!error&&data?.signedUrl)return data.signedUrl;
    return c.storage.from(bucket).getPublicUrl(path).data?.publicUrl||'';
  }

  async function verify(){
    const report={version:VERSION,at:now(),online:navigator.onLine,client:!!client(),tables:{},ok:true};
    if(!client()){report.ok=false;report.error='Supabase client غير متوفر';return report}
    for(const t of ['settings','accounts','orders','booklets','products','notifications']){
      try{const c=await fetchTable(t);report.tables[t]={ok:true,count:c.length}}catch(e){report.tables[t]={ok:false,error:errText(e)};report.ok=false}
    }
    return report;
  }

  function install(){
    if(installed)return;installed=true;
    ensureDb();
    installMutationBridge();
    window.AlinRepository={version:VERSION,refresh,verify,fetchTable,online};
    window.AlinStorage={version:VERSION,upload,fileUrl,buckets:{...BUCKET_BY_KIND}};
    window.ALIN_CONFIG={...(window.ALIN_CONFIG||{}),version:VERSION,databaseVersion:'RC5.2'};
    window.addEventListener('online',()=>refresh({force:true}).catch(()=>{}));
    if(online()) setTimeout(()=>refresh({force:true}).catch(e=>console.warn('[RC5.3 startup]',e)),250);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();


;

// === core/cloud-status-ui.js ===
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

/* ALIN 1.0.9 - Supabase Auth adapter. */
(function(){
  'use strict';
  const cfg=()=>window.ALIN_CONFIG||{};
  const enabled=()=>cfg().authEnabled===true;
  const client=()=>window.sb||(window.AlinCloud&&window.AlinCloud.client?.())||null;
  const emailFor=value=>{
    const raw=String(value||'').trim().toLowerCase();
    if(raw.includes('@'))return raw;
    const safe=raw.replace(/[^a-z0-9._-]/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');
    return `${safe}@${cfg().authEmailDomain||'users.alin.local'}`;
  };
  const msg=text=>{const el=window.loginMsg||document.getElementById('loginMsg');if(el)el.textContent=text};

  async function accountForUser(user){
    const c=client();if(!c||!user)return null;
    const {data,error}=await c.from('accounts').select('id,role,name,username,status,auth_user_id').eq('auth_user_id',user.id).maybeSingle();
    if(error)throw error;
    return data||null;
  }

  async function login(){
    const c=client();if(!c)throw new Error('خدمة تسجيل الدخول غير متاحة');
    const username=(window.loginU||document.getElementById('loginU'))?.value||'';
    const password=(window.loginPass||document.getElementById('loginPass'))?.value||'';
    if(!username.trim()||!password)throw new Error('اكتب اسم الدخول وكلمة المرور');
    const {data,error}=await c.auth.signInWithPassword({email:emailFor(username),password});
    if(error)throw new Error('بيانات الدخول غير صحيحة');
    const account=await accountForUser(data.user);
    if(!account||account.status!=='active'){
      await c.auth.signOut();
      throw new Error('الحساب غير مربوط أو غير فعال');
    }
    const requested=String(window.pendingRole||'');
    if(requested&&requested!=='store'&&account.role!==requested&&account.role!=='admin'){
      await c.auth.signOut();
      throw new Error('نوع الحساب لا يطابق البوابة المختارة');
    }
    window.current={role:account.role,id:account.id,name:account.name,username:account.username,auth_user_id:data.user.id};
    if(typeof window.load==='function')await window.load();
    if(typeof window.openPage==='function')window.openPage(account.role);
    const passEl=window.loginPass||document.getElementById('loginPass');if(passEl)passEl.value='';
    return account;
  }

  async function secureCheckout(){
    try{
      if(typeof cart==='undefined'||!Array.isArray(cart)||!cart.length)throw new Error('السلة فارغة');
      const name=(document.getElementById('studentName')?.value||'').trim();
      const phone=(document.getElementById('studentPhone')?.value||'').trim();
      if(!name||!phone)throw new Error('أكمل اسم الطالب ورقم الهاتف');
      const fulfillment=typeof alinOrderExtra==='function'?alinOrderExtra():{};
      const coupon=(document.getElementById('couponInput')?.value||'').trim();
      const items=cart.map(x=>({kind:x.kind,id:x.id,qty:Number(x.qty)||1}));
      const {data,error}=await client().rpc('alin_create_store_orders',{
        p_items:items,p_customer:{name,phone},p_fulfillment:fulfillment,p_coupon_code:coupon||null
      });
      if(error)throw error;
      const numbers=Array.isArray(data)?data.map(x=>x.order_number):[];
      cart=[];if(typeof cartSave==='function')cartSave();
      if(typeof load==='function')await load();
      const box=window.checkoutBox||document.getElementById('checkoutBox');
      if(box)box.innerHTML=`<h2>تم استلام طلبك</h2><p>أرقام التتبع: ${numbers.join(' — ')}</p><button onclick="closeCheckout()">إغلاق</button>`;
    }catch(e){alert(e.message||'تعذر إنشاء الطلب')}
  }

  async function createAccountFromAdmin(){
    try{
      const role=document.getElementById('aRole')?.value||'';
      const name=document.getElementById('aName')?.value?.trim()||'';
      const username=document.getElementById('aUser')?.value?.trim()||'';
      const password=document.getElementById('aPass')?.value||'';
      const area=document.getElementById('aArea')?.value?.trim()||'';
      const landmark=document.getElementById('aLandmark')?.value?.trim()||'';
      if(!name||!username||!password)throw new Error('أكمل الاسم واسم الدخول وكلمة المرور');
      const {data,error}=await client().functions.invoke('admin-create-account',{
        body:{role,name,username,password,area,landmark}
      });
      if(error){
        let message=error.message;
        try{message=(await error.context?.json())?.error||message}catch(_){}
        throw new Error(message||'تعذر إنشاء الحساب');
      }
      if(!data?.ok)throw new Error(data?.error||'تعذر إنشاء الحساب');
      if(document.getElementById('aPass'))document.getElementById('aPass').value='';
      if(typeof load==='function')await load();
      if(typeof renderAccountsAdmin==='function')renderAccountsAdmin();
      if(typeof toast==='function')toast(`تم إنشاء الحساب: ${data.account.username}`);
      else alert(`تم إنشاء الحساب بنجاح: ${data.account.username}`);
      return data.account;
    }catch(e){alert(e.message||'تعذر إنشاء الحساب');throw e}
  }

  function install(){
    if(!enabled()){window.ALIN_AUTH_MODE='legacy';return}
    window.ALIN_AUTH_MODE='supabase';
    window.doLogin=async function(){try{msg('جارٍ التحقق...');await login();msg('')}catch(e){msg(e.message||'تعذر تسجيل الدخول')}};
    window.confirmCartCheckout=secureCheckout;
    window.addAccount=createAccountFromAdmin;
    const oldLogout=window.logout;
    window.logout=async function(){try{await client()?.auth?.signOut()}catch(_){};window.current=null;return typeof oldLogout==='function'?oldLogout.apply(this,arguments):location.reload()};
    client()?.auth?.onAuthStateChange?.((event)=>{if(event==='SIGNED_OUT')window.current=null});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  window.ALINAuth=Object.freeze({enabled,emailFor,login,accountForUser,secureCheckout,createAccountFromAdmin});
})();
