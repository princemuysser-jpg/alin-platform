// Alin module: admin/notifications.js | v2.0.3
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

