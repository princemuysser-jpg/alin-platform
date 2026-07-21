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
  async function toggleOpen(){const lib=getLibrary();if(!lib)return alert('تعذر تحديد حساب المكتبة');const open=!isOpen(lib);try{if(typeof update==='function')await update('accounts',{is_open:open,open_status:open?'open':'closed'},{id:lib.id});lib.is_open=open;lib.open_status=open?'open':'closed';if(typeof audit==='function')await audit('library',open?'فتح المكتبة':'إغلاق المكتبة');if(typeof load==='function')await load();render()}catch(e){console.error(e);alert('تعذر تحديث حالة المكتبة') }}
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
  function markAllRead(){notifications().forEach(n=>n.read_at=n.read_at||new Date().toISOString());render()}
  window.AlinLibraryV116={render,toggleOpen,setStatus,cancel,details,filter:k=>{state.filter=k;render()},search:q=>{state.search=q;render()},markAllRead};
  window.renderLibrary=render;window.AlinLibraryModules.renderLibrary=render;window.setLibraryOpen=toggleOpen;window.AlinLibraryModules.setLibraryOpen=toggleOpen;
  document.addEventListener('click',e=>{const b=e.target.closest('[data-library-tab]');if(!b)return;state.tab=b.dataset.libraryTab;render()});
  const boot=()=>{if(currentUser()?.role==='library')setTimeout(render,20)};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();


;
