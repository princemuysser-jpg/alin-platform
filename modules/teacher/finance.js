/* ALIN v2.2.6 — teacher orders and finance views backed only by AlinFinance. */
(function(){
  'use strict';
  if(!window.TeacherApp)throw new Error('TeacherApp must load before teacher/finance.js');
  window.AlinTeacherModules=window.AlinTeacherModules||{};
  const arr=value=>Array.isArray(value)?value:[];
  const same=(a,b)=>String(a??'')===String(b??'');
  const escv=value=>typeof window.esc==='function'?window.esc(value):String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const moneyv=value=>typeof window.money==='function'?window.money(value):Math.round(Number(value)||0).toLocaleString('ar-IQ');
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
