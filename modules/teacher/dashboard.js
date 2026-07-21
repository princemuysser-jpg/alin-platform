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
