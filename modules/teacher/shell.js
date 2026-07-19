// Alin module: teacher/shell.js | v2.0.1
/* ===== teacher/js/teacher-shell.js ===== */
/* V111: actual teacher code moved from core/js/platform-legacy.js */
window.AlinTeacherModules=window.AlinTeacherModules||{};
function renderTeacher(){ if(!window.teacherStats||!db.ledger)return; const teacherId=current?.role==='teacher'?current.id:(db.accounts.teachers[0]?.id||''); const books=db.booklets.filter(x=>x.teacher_id===teacherId), ledger=db.ledger.filter(x=>x.teacher_id===teacherId); teacherStats.innerHTML=`<div><b>الملازم</b><span>${books.length}</span></div><div><b>المبيعات</b><span>${ledger.length}</span></div><div><b>الرصيد</b><span>${money(ledger.reduce((a,x)=>a+(+x.teacher||0),0))} د.ع</span></div>`; teacherBooks.innerHTML=books.map(x=>`<div class="row"><b>${x.title}</b><span class="status">${x.status}</span></div>`).join('')||'لا توجد ملازم'; teacherSales.innerHTML=ledger.map(x=>`<div class="row"><b>${x.order_id}</b><span>${money(x.teacher)} د.ع</span></div>`).join('')||'لا توجد مبيعات'; }

renderTeacher=function(){if(!window.teacherStats)return;const id=current?.role==='teacher'?current.id:'';const books=db.booklets.filter(x=>x.teacher_id===id),led=db.ledger.filter(x=>x.teacher_id===id),bookIds=new Set(books.map(x=>x.id)),orders=db.orders.filter(x=>bookIds.has(x.item_id));const notices=v19Notifications.filter(n=>n.status==='active'&&((n.target_role||n.audience)==='all'||(n.target_role||n.audience)==='teacher'));teacherStats.innerHTML=`<div><b>ملازمي</b><span>${books.length}</span></div><div><b>الطلبات</b><span>${orders.length}</span></div><div><b>النسخ المطلوبة</b><span>${orders.reduce((a,x)=>a+(+x.qty||0),0)}</span></div><div><b>المستحقات</b><span>${money(led.reduce((a,x)=>a+(+x.teacher||0),0))} د.ع</span></div>`;teacherBooks.innerHTML=notices.map(n=>`<div class="notice"><b>${esc(n.title)}</b><div>${esc(n.message||n.text||'')}</div></div>`).join('')+books.map(x=>`<div class="row"><b>${esc(x.title)}</b><span class="status">${esc(x.status)}</span></div>`).join('');teacherSales.innerHTML=orders.map(x=>`<div class="row"><div><b>${esc(x.order_number||x.id)}</b><small>${esc(x.title)} × ${x.qty}</small></div><span>${money(x.total)} د.ع</span></div>`).join('')||emptyState('لا توجد مبيعات');}

renderTeacher=function(){
  if(!window.teacherStats || !window.teacherContent)return;
  const {id,teacher,books,orders,ledger,payouts,requests}=teacherData();
  const today=new Date().toISOString().slice(0,10), month=today.slice(0,7);
  const due=ledger.reduce((a,x)=>a+(+x.teacher||0),0), paid=teacherAccountPaid(id), remaining=Math.max(0,due-paid);
  const notices=(v19Notifications||[]).filter(n=>n.status==='active'&&((n.target_role||n.audience)==='all'||(n.target_role||n.audience)==='teacher'));
  teacherStats.innerHTML=`<div><b>الملازم</b><span>${books.length}</span></div><div><b>طلبات اليوم</b><span>${orders.filter(x=>(x.created_at||'').slice(0,10)===today).length}</span></div><div><b>النسخ المباعة</b><span>${orders.reduce((a,x)=>a+(+x.qty||0),0)}</span></div><div><b>المتبقي</b><span>${money(remaining)} د.ع</span></div>`;
  let html='';
  if(notices.length) html += notices.map(n=>`<div class="notice"><b>${esc(n.title)}</b><div>${esc(n.message||n.text||'')}</div></div>`).join('');
  if(activeTeacherTab==='dashboard'){
    html += `<h3>الرئيسية</h3><div class="stats"><div><b>أرباح مستحقة</b><span>${money(due)} د.ع</span></div><div><b>مدفوع</b><span>${money(paid)} د.ع</span></div><div><b>هذا الشهر</b><span>${orders.filter(x=>(x.created_at||'').slice(0,7)===month).length}</span></div><div><b>أكثر ملزمة</b><span>${bestTeacherBook(books,orders)}</span></div></div>`;
  } else if(activeTeacherTab==='booklets'){
    html += `<h3>ملازمي المصممة من الإدارة</h3>${books.map(b=>{const qty=orders.filter(o=>o.item_id===b.id).reduce((a,o)=>a+(+o.qty||0),0);return `<div class="row"><div><b>${esc(b.title)}</b><small>${esc(b.subject||'')} — ${esc(b.grade||'')} — ${money(b.price)} د.ع — ${qty} نسخة</small></div><div class="row-actions">${b.file_path?`<button onclick="openTeacherPdf('${b.id}')">مشاهدة الملزمة</button>`:''}<span class="status">${esc(b.status||'')}</span></div></div>`}).join('')||emptyState('لا توجد ملازم')}`;
  } else if(activeTeacherTab==='orders'){
    html += `<h3>طلبات ملازمي</h3>${orders.map(o=>`<div class="row"><div><b>${esc(o.order_number||o.id)} — ${esc(o.title)}</b><small>العدد ${o.qty} • المكتبة: ${esc((db.accounts.libraries.find(l=>l.id===o.library_id)||{}).name||'-')} • الحالة: ${esc(o.status||'')}</small></div><span>${money(o.total)} د.ع</span></div>`).join('')||emptyState('لا توجد طلبات')}`;
  } else if(activeTeacherTab==='finance'){
    html += `<h3>الأرباح والمستحقات</h3><div class="stats"><div><b>الإجمالي</b><span>${money(due)} د.ع</span></div><div><b>المدفوع</b><span>${money(paid)} د.ع</span></div><div><b>المتبقي</b><span>${money(remaining)} د.ع</span></div></div><div class="form-grid"><input id="tFrom" type="date"><input id="tTo" type="date"><button onclick="printTeacherStatement()">طباعة كشف حساب</button><input id="teacherWithdrawAmount" type="number" placeholder="مبلغ السحب"><button onclick="requestWithdraw('teacher')">طلب سحب</button></div>${ledger.map(x=>`<div class="row"><b>${esc(x.order_id)}</b><span>${money(x.teacher)} د.ع</span></div>`).join('')||emptyState('لا توجد أرباح مسجلة')}`;
  } else if(activeTeacherTab==='requests'){
    html += `<h3>طلب إضافة ملزمة</h3><p>ارفع طلب الملزمة للإدارة. الإدارة تصممها وتراجعها ثم ترفع النسخة النهائية في صفحة المدرس للمشاهدة فقط.</p><form id="teacherRequestForm" class="form-grid"><input name="title" placeholder="اسم الملزمة"><input name="subject" placeholder="المادة"><input name="grade" placeholder="المرحلة/الصف"><textarea name="note" placeholder="تفاصيل إضافية للإدارة"></textarea><label>ملف أولي اختياري PDF<input name="source" type="file" accept=".pdf"></label><button type="button" onclick="sendTeacherBookRequest()">إرسال الطلب</button></form><h3>طلباتي</h3>${requests.map(r=>`<div class="row"><div><b>${esc(r.title)}</b><small>${esc(r.subject||'')} — ${esc(r.grade||'')} — ${esc(r.status||'')}</small></div></div>`).join('')||emptyState('لا توجد طلبات')}`;
  } else if(activeTeacherTab==='profile'){
    html += `<h3>ملف المدرس</h3><div class="form-grid"><input id="tpPhone" value="${esc(teacher.phone||'')}" placeholder="رقم الهاتف"><input id="tpSpecialty" value="${esc(teacher.specialty||'')}" placeholder="الاختصاص"><textarea id="tpBio" placeholder="نبذة قصيرة">${esc(teacher.bio||'')}</textarea><label>الصورة الشخصية<input id="tpAvatar" type="file" accept="image/*"></label><button onclick="saveTeacherProfile()">حفظ الملف</button></div><p class="print-only-note">الاسم وربط الملازم يتحكم بهما المدير فقط.</p>`;
  }
  teacherContent.innerHTML=html;
};

function teacherData(){
  const id=current?.role==='teacher'?current.id:'';
  const teacher=db.accounts.teachers.find(x=>x.id===id)||{};
  const books=db.booklets.filter(x=>x.teacher_id===id);
  const bookIds=new Set(books.map(x=>x.id));
  const orders=db.orders.filter(x=>x.kind==='booklet' && bookIds.has(x.item_id));
  const ledger=db.ledger.filter(x=>x.teacher_id===id);
  const payouts=(db.teacherPayouts||[]).filter(x=>x.teacher_id===id);
  const requests=(db.teacherRequests||[]).filter(x=>x.teacher_id===id);
  return {id,teacher,books,bookIds,orders,ledger,payouts,requests};
}

function teacherTab(tab){ activeTeacherTab=tab; renderTeacher(); }

async function saveTeacherProfile(){
  try{
    const avatar=tpAvatar.files&&tpAvatar.files[0]?await uploadFile('teachers',tpAvatar.files[0],{type:'image'}):(teacherData().teacher.avatar_path||'');
    await update('accounts',{phone:tpPhone.value.trim(),specialty:tpSpecialty.value.trim(),bio:tpBio.value.trim(),avatar_path:avatar},{id:current.id});
    await audit('teacher','تحديث ملف مدرس'); await load(); toast('تم حفظ ملف المدرس');
  }catch(e){alert(e.message)}
}

function teacherObj(id){ return (db.accounts?.teachers||[]).find(x=>x.id===id)||{}; }
window.AlinTeacherModules['renderTeacher']=typeof renderTeacher==='function'?renderTeacher:window['renderTeacher'];window['renderTeacher']=window.AlinTeacherModules['renderTeacher'];
window.AlinTeacherModules['teacherData']=typeof teacherData==='function'?teacherData:window['teacherData'];window['teacherData']=window.AlinTeacherModules['teacherData'];
window.AlinTeacherModules['teacherTab']=typeof teacherTab==='function'?teacherTab:window['teacherTab'];window['teacherTab']=window.AlinTeacherModules['teacherTab'];
window.AlinTeacherModules['saveTeacherProfile']=typeof saveTeacherProfile==='function'?saveTeacherProfile:window['saveTeacherProfile'];window['saveTeacherProfile']=window.AlinTeacherModules['saveTeacherProfile'];
window.AlinTeacherModules['teacherObj']=typeof teacherObj==='function'?teacherObj:window['teacherObj'];window['teacherObj']=window.AlinTeacherModules['teacherObj'];


;
