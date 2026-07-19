// Alin module: admin/dashboard.js | v2.0.3
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

