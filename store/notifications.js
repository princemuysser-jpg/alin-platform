/* ALIN 2.0.0 - storefront notification center */
(function(){
  'use strict';
  const api='https://jyavewwlgiaibtdqyzpd.supabase.co';
  const key='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5YXZld3dsZ2lhaWJ0ZHF5enBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0MTczMzcsImV4cCI6MjA5ODk5MzMzN30.fcjx4JrNdwd5Xrm_Nn1CaWWJoJLF6_DyYGakFPuGwGQ';
  const storageKey='alin_v123_seen_notifications',state={rows:[]};
  const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const seen=()=>{try{return new Set(JSON.parse(localStorage.getItem(storageKey)||'[]').map(String))}catch(_){return new Set()}};
  const save=s=>localStorage.setItem(storageKey,JSON.stringify([...s]));
  const unread=()=>{const s=seen();return state.rows.filter(n=>!s.has(String(n.id))).length};
  function badges(){
    const n=unread();
    document.querySelectorAll('.alin-v94-notify-count,.alin98-notify-count').forEach(x=>{x.textContent=n>99?'99+':String(n);x.hidden=!n});
    document.querySelectorAll('.alin-v94-notification-button,[data-desktop-control="notifications"]').forEach(x=>x.classList.toggle('has-unread',!!n));
  }
  function close(){document.getElementById('alinNotificationsV120')?.remove();document.body.classList.remove('alin-notifications-open')}
  function open(){
    close();const s=seen(),box=document.createElement('div');box.id='alinNotificationsV120';box.className='alin-notifications-v120';
    const items=state.rows.map(n=>{const read=s.has(String(n.id));return `<article class="${read?'read':'unread'}" data-notification-id="${escapeHtml(n.id)}"><span class="alin-notifications-v120__dot"></span><div><div class="alin-notifications-v120__title"><h3>${escapeHtml(n.title||'إشعار')}</h3>${read?'':'<b>جديد</b>'}</div><p>${escapeHtml(n.message||n.text||'')}</p><time>${new Date(n.created_at||Date.now()).toLocaleString('ar-IQ')}</time></div></article>`}).join('');
    box.innerHTML=`<button class="alin-notifications-v120__backdrop" type="button" aria-label="إغلاق"></button><section class="alin-notifications-v120__panel" role="dialog" aria-modal="true"><header><div><h2>الإشعارات</h2><p>${unread()?unread()+' إشعار جديد':'لا توجد إشعارات جديدة'}</p></div><div><button type="button" data-read-all>قراءة الكل</button><button type="button" data-close aria-label="إغلاق">×</button></div></header><div class="alin-notifications-v120__list">${items||'<div class="alin-notifications-v120__empty"><span>🔕</span><b>لا توجد إشعارات حالياً</b><p>إشعارات الإدارة الجديدة ستظهر هنا.</p></div>'}</div></section>`;
    document.body.appendChild(box);document.body.classList.add('alin-notifications-open');
    box.querySelector('[data-close]').onclick=close;box.querySelector('.alin-notifications-v120__backdrop').onclick=close;
    box.querySelector('[data-read-all]').onclick=()=>{const a=seen();state.rows.forEach(n=>a.add(String(n.id)));save(a);badges();open()};
    box.querySelectorAll('[data-notification-id]').forEach(x=>x.onclick=()=>{const a=seen();a.add(String(x.dataset.notificationId));save(a);badges();x.classList.remove('unread');x.classList.add('read');x.querySelector('.alin-notifications-v120__title b')?.remove()});
  }
  async function loadNotifications(){
    try{
      const r=await fetch(`${api}/rest/v1/notifications?select=*&order=created_at.desc&limit=50`,{headers:{apikey:key,Authorization:`Bearer ${key}`},cache:'no-store'});
      if(!r.ok)throw Error('notifications '+r.status);
      state.rows=(await r.json()).filter(n=>['all','student','store'].includes(String(n.target_role||n.recipient_role||'all').toLowerCase())&&String(n.status||'active')!=='inactive');
      badges();
    }catch(e){console.warn('[Alin notifications 1.2.3]',e)}
  }
  function installNotifications(){
    const decorateBell=()=>document.querySelectorAll('.alin-v94-notification-button .alin-v94-bell').forEach(bell=>{
      if(bell.querySelector('svg'))return;
      bell.textContent='';
      bell.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>';
    });
    decorateBell();
    setTimeout(decorateBell,100);
    setTimeout(decorateBell,900);
    setTimeout(decorateBell,2200);
    document.addEventListener('click',e=>{
      const b=e.target.closest('.alin-v94-notification-button,.alin-v78-notify-btn,[data-desktop-control="notifications"],.mobile-header-icon-btn[aria-label^="الإشعارات"]');
      if(!b)return;
      const store=document.getElementById('storePage');
      if(store&&(store.hidden||getComputedStyle(store).display==='none'))return;
      e.preventDefault();e.stopImmediatePropagation();open();
    },true);
    document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
    loadNotifications();setInterval(loadNotifications,20000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)loadNotifications()});
    window.alinRefreshNotifications=loadNotifications;window.alinNotificationsReady=true;
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installNotifications);else installNotifications();
})();
