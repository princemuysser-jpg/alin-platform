// === admin/notifications.js ===
/* ALIN v2.2.6 — admin notification center registered directly in the admin shell. */
(function(){
  'use strict';

  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[char]));
  const roleLabel=role=>({
    all:'الجميع',teacher:'المدرسون',library:'المكتبات',student:'الطلبة والمتجر',courier:'المندوبون',accountant:'المحاسب'
  })[String(role||'all')]||'الجميع';
  const state={query:'',role:'',sending:false};

  function service(){return window.AlinNotifications}
  function rows(){return service()?.rows?.()||[]}
  function users(){
    const accounts=window.db?.accounts||{};
    return [
      ...(accounts.teachers||[]),
      ...(accounts.libraries||[]),
      ...(accounts.couriers||[]),
      ...(accounts.accountants||[])
    ];
  }
  function dateText(value){
    try{return new Date(value).toLocaleString(window.AlinI18n?.locale?.()||'ar-IQ')}
    catch(_){return ''}
  }
  function filteredRows(){
    const query=state.query.trim().toLowerCase();
    return rows().filter(row=>{
      const searchable=`${row.title||''} ${row.message||row.text||''}`.toLowerCase();
      const role=String(row.target_role||row.audience||'all');
      return (!query||searchable.includes(query))&&(!state.role||role===state.role);
    });
  }

  function render(){
    const root=document.getElementById('adminContent');
    if(!root)return false;
    const all=rows();
    const list=filteredRows();
    const week=all.filter(row=>Date.now()-new Date(row.created_at||0).getTime()<=7*864e5).length;
    const accountOptions=users().map(account=>`<option value="${escapeHtml(account.id)}">${escapeHtml(account.name||account.username||account.email||'حساب')}</option>`).join('');
    root.innerHTML=`<section class="admin-v146-notifications">
      <header class="admin-v146-head"><div><h2>مركز الإشعارات</h2><p>إرسال الإشعارات ومراجعة السجل من مصدر واحد.</p></div><div class="admin-v146-bell">🔔</div></header>
      <div class="admin-v146-grid">
        <article class="admin-v146-card"><h3>إرسال إشعار جديد</h3><div class="admin-v146-form">
          <select id="v146Audience"><option value="all">الجميع</option><option value="teacher">المدرسون</option><option value="library">المكتبات</option><option value="student">الطلبة والمتجر</option><option value="courier">المندوبون</option><option value="accountant">المحاسب</option></select>
          <select id="v146Priority"><option value="normal">عادي</option><option value="important">مهم</option><option value="urgent">عاجل</option></select>
          <select id="v146Target" class="full"><option value="">بدون حساب محدد</option>${accountOptions}</select>
          <input id="v146Title" class="full" placeholder="عنوان الإشعار">
          <textarea id="v146Message" class="full" placeholder="اكتب نص الإشعار"></textarea>
          <button id="v146SendButton" class="admin-v146-send" type="button" onclick="AlinAdminNotifications.send()">إرسال الإشعار</button>
          <div id="v146Status" class="admin-v146-status"></div>
        </div></article>
        <article class="admin-v146-card"><div class="admin-v146-list-head"><h3>سجل الإشعارات</h3><button type="button" onclick="AlinAdminNotifications.refresh()">تحديث</button></div>
          <div class="admin-v146-stats"><div><small>الإجمالي</small><b>${all.length}</b></div><div><small>آخر 7 أيام</small><b>${week}</b></div><div><small>النتائج</small><b>${list.length}</b></div></div>
          <div class="admin-v146-tools"><input placeholder="بحث" value="${escapeHtml(state.query)}" oninput="AlinAdminNotifications.filter('query',this.value)"><select onchange="AlinAdminNotifications.filter('role',this.value)"><option value="">كل الفئات</option>${['all','teacher','library','student','courier','accountant'].map(role=>`<option value="${role}" ${state.role===role?'selected':''}>${roleLabel(role)}</option>`).join('')}</select></div>
          <div class="admin-v146-list">${list.length?list.map(row=>`<div class="admin-v146-item"><div><h4>${escapeHtml(row.title||'إشعار')}</h4><p>${escapeHtml(row.message||row.text||'')}</p><div class="admin-v146-meta"><span>${roleLabel(row.target_role||row.audience||'all')}</span><span>${escapeHtml(row.priority||'normal')}</span><span>${escapeHtml(dateText(row.created_at))}</span></div></div><button type="button" class="danger" onclick="AlinAdminNotifications.remove('${escapeHtml(row.id)}')">حذف</button></div>`).join(''):'<div class="admin-v146-empty">لا توجد إشعارات حالياً.</div>'}</div>
        </article>
      </div>
    </section>`;
    return true;
  }

  async function send(){
    if(state.sending)return;
    const status=document.getElementById('v146Status');
    const button=document.getElementById('v146SendButton');
    const title=document.getElementById('v146Title')?.value.trim()||'';
    const message=document.getElementById('v146Message')?.value.trim()||'';
    const role=document.getElementById('v146Audience')?.value||'all';
    const priority=document.getElementById('v146Priority')?.value||'normal';
    const targetId=document.getElementById('v146Target')?.value||'';
    if(!title||!message){if(status)status.textContent='اكتب العنوان ونص الإشعار.';return false}
    if(!service()?.send){if(status)status.textContent='خدمة الإشعارات غير جاهزة.';return false}
    state.sending=true;
    if(button){button.disabled=true;button.textContent='جارٍ الإرسال...'}
    try{
      const result=await service().send({title,message,role,target_id:targetId||null,priority,from_user:'admin'});
      if(typeof window.audit==='function')await window.audit('notification',`إرسال إشعار ${title}`);
      if(status)status.textContent=result.remote?'تم إرسال الإشعار بنجاح.':'تم حفظ الإشعار محليًا، وتعذر رفعه إلى الخادم.';
      render();
      return true;
    }catch(error){
      console.error('[ALIN admin notifications]',error);
      if(status)status.textContent=error?.message||'تعذر إرسال الإشعار.';
      return false;
    }finally{
      state.sending=false;
      if(button){button.disabled=false;button.textContent='إرسال الإشعار'}
    }
  }

  async function refresh(){
    await service()?.refresh?.();
    render();
  }

  async function remove(id){
    if(!confirm('حذف هذا الإشعار؟'))return false;
    try{await service()?.remove?.(id);render();return true}
    catch(error){console.error(error);alert(error?.message||'تعذر حذف الإشعار');return false}
  }

  function filter(key,value){state[key]=value;render()}

  const api=Object.freeze({render,send,refresh,remove,filter});
  window.AlinAdminNotifications=api;
  window.renderNotificationsAdmin=render;
  window.AlinAdminModules?.register?.('notifications',render);

  window.addEventListener('alin:notifications-updated',()=>{
    if(window.activeAdminTab==='notifications')render();
  });
})();
