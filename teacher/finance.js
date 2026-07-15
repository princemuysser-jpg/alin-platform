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

