// === admin/shell.js ===
/* ALIN v2.2.6 — authoritative admin shell and one admin router. */
(function(){
  'use strict';

  const registry=new Map();
  const fallbackRenderers={
    dashboard:'renderAdminDashboard',
    accounts:'renderAccountsAdmin',
    booklets:'renderBookletsAdmin',
    teacherRequests:'renderTeacherRequestsAdmin',
    libraryRequests:'renderLibraryRequestsAdmin',
    products:'renderProductsAdmin',
    categories:'renderCategoriesAdmin',
    orders:'renderOrdersAdmin',
    couriers:'renderCouriersAdmin',
    courierAreas:'renderCourierAreasAdmin',
    deliveryOrders:'renderDeliveryOrdersAdmin',
    courierSettlements:'renderCourierSettlementsAdmin',
    finance:'renderFinanceAdmin',
    ads:'renderAdsAdmin',
    coupons:'renderCouponsAdmin',
    notifications:'renderNotificationsAdmin',
    settings:'renderSettingsAdmin'
  };

  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[m]));
  const arr=v=>Array.isArray(v)?v:[];
  const num=v=>Number(v||0);
  const moneyv=v=>typeof window.money==='function'?window.money(v):num(v).toLocaleString(window.AlinI18n?.locale?.()||'ar-IQ');
  const root=()=>document.getElementById('adminContent');

  function parseTab(button){
    if(!button)return'';
    if(button.dataset.adminTab)return button.dataset.adminTab;
    const match=(button.getAttribute('onclick')||'').match(/adminTab\('([^']+)'\)/);
    return match?.[1]||'';
  }

  function prepareTabs(){
    document.querySelectorAll('#adminPage .admin-tabs button').forEach(button=>{
      const tab=parseTab(button);
      if(tab)button.dataset.adminTab=tab;
    });
  }

  function markTabs(tab){
    prepareTabs();
    document.querySelectorAll('#adminPage .admin-tabs button').forEach(button=>{
      button.classList.toggle('active-admin-tab',parseTab(button)===tab);
    });
  }

  function allAccounts(dbx){
    const accounts=dbx?.accounts||{};
    if(Array.isArray(accounts.all))return accounts.all;
    return [
      ...arr(accounts.teachers),
      ...arr(accounts.libraries),
      ...arr(accounts.couriers),
      ...arr(accounts.accountants)
    ];
  }

  function platformIncome(dbx){
    const rows=arr(window.financialEntries||dbx?.financialEntries||dbx?.financial_entries||dbx?.ledger);
    return rows.reduce((sum,row)=>sum+num(row.platform_amount||row.alin||row.platform_profit),0);
  }

  function renderStats(){
    const host=document.getElementById('adminStats');
    if(!host)return;
    const dbx=window.db||{};
    const orders=arr(dbx.orders);
    const products=arr(dbx.products);
    const today=new Date().toISOString().slice(0,10);
    const month=today.slice(0,7);
    const todayOrders=orders.filter(order=>String(order.created_at||order.date||'').slice(0,10)===today);
    const monthOrders=orders.filter(order=>String(order.created_at||order.date||'').slice(0,7)===month);
    const low=products.filter(product=>num(product.stock)<=num(product.low_stock_limit||dbx.settings?.low_stock_default||5));
    host.innerHTML=`
      <div><b>طلبات اليوم</b><span>${todayOrders.length}</span></div>
      <div><b>مبيعات الشهر</b><span>${moneyv(monthOrders.reduce((sum,order)=>sum+num(order.total||order.total_amount||order.amount),0))} د.ع</span></div>
      <div><b>الحسابات</b><span>${allAccounts(dbx).length}</span></div>
      <div><b>حصة المنصة</b><span>${moneyv(platformIncome(dbx))} د.ع</span></div>
      <div><b>مخزون منخفض</b><span>${low.length}</span><small class="metric-note">${esc(low.slice(0,2).map(item=>item.name||item.title).filter(Boolean).join('، '))}</small></div>`;
    document.querySelectorAll('.version-badge').forEach(node=>node.textContent='منصة آلين');
  }

  function renderAudit(content=root()){
    if(!content)return;
    const rows=[...arr(window.db?.audit)].sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));
    content.innerHTML=`<section class="admin-audit-module"><header><h2>سجل العمليات</h2><p>آخر العمليات المسجلة داخل المنصة.</p></header>${rows.length?rows.map(row=>`<article class="row"><div><b>${esc(row.text||row.action||row.kind||'عملية')}</b><small>${esc(row.details||'')}${row.created_at?' — '+esc(new Date(row.created_at).toLocaleString(window.AlinI18n?.locale?.()||'ar-IQ')):''}</small></div><span>${esc(row.kind||'سجل')}</span></article>`).join(''):'<div class="empty">لا توجد عمليات مسجلة.</div>'}</section>`;
  }

  function resolveRenderer(tab){
    if(registry.has(tab))return registry.get(tab);
    const globalName=fallbackRenderers[tab];
    if(globalName&&typeof window[globalName]==='function')return window[globalName];
    if(tab==='audit')return renderAudit;
    return null;
  }

  function showMissing(tab){
    const content=root();
    if(!content)return;
    content.innerHTML=`<section class="notice"><b>القسم غير جاهز</b><div>تعذر تحميل قسم ${esc(tab)}. حدّث الصفحة مرة واحدة.</div></section>`;
  }

  function route(tab='dashboard'){
    tab=String(tab||'dashboard');
    window.activeAdminTab=tab;
    const page=document.getElementById('adminPage');
    const content=root();
    if(page)page.dataset.activeAdminTab=tab;
    if(content){
      content.dataset.adminModule=tab;
      content.classList.add('admin-module-ready');
    }
    markTabs(tab);
    renderStats();
    const renderer=resolveRenderer(tab);
    if(!renderer){showMissing(tab);return false}
    try{
      const result=renderer(content,tab);
      Promise.resolve(result).catch(error=>{
        console.error(`[ALIN admin ${tab}]`,error);
        showMissing(tab);
      });
      window.dispatchEvent(new CustomEvent('alin:admin-tab',{detail:{tab}}));
      return result;
    }catch(error){
      console.error(`[ALIN admin ${tab}]`,error);
      showMissing(tab);
      return false;
    }
  }

  const api={
    register(name,renderer){
      if(typeof name!=='string'||!name.trim()||typeof renderer!=='function')return false;
      registry.set(name.trim(),renderer);
      return true;
    },
    unregister(name){return registry.delete(String(name||''))},
    has(name){return registry.has(String(name||''))},
    list(){return [...registry.keys()]},
    render(name){return route(name)},
    route,
    refresh(){return route(window.activeAdminTab||'dashboard')},
    renderStats
  };

  api.register('audit',renderAudit);
  window.AlinAdminModules=api;
  window.AlinAdmin=api;
  window.adminTab=route;
  window.adminStatsRender=renderStats;
  window.renderAdmin=()=>route(window.activeAdminTab||'dashboard');

  function boot(){
    prepareTabs();
    renderStats();
    const content=root();
    const page=document.getElementById('adminPage');
    if(page&&!page.classList.contains('hidden')&&content&&!content.innerHTML.trim())route(window.activeAdminTab||'dashboard');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.addEventListener('alin:data-refreshed',()=>{
    renderStats();
    const page=document.getElementById('adminPage');
    if(page&&!page.classList.contains('hidden')&&window.current?.role&&['admin','accountant'].includes(window.current.role))api.refresh();
  });
})();

;
