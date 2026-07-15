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

