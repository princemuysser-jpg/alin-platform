/* ALIN 1.2.2 - reliable storefront notifications */
window.alinNotificationsV120Boot='loading';
(function(){
  'use strict';
  const URL='https://jyavewwlgiaibtdqyzpd.supabase.co';
  const KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5YXZld3dsZ2lhaWJ0ZHF5enBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0MTczMzcsImV4cCI6MjA5ODk5MzMzN30.fcjx4JrNdwd5Xrm_Nn1CaWWJoJLF6_DyYGakFPuGwGQ';
  const SEEN='alin_v120_seen_notifications';
  const state={rows:[],timer:null};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const seen=()=>{try{return new Set(JSON.parse(localStorage.getItem(SEEN)||'[]').map(String))}catch(_){return new Set()}};
  const saveSeen=s=>localStorage.setItem(SEEN,JSON.stringify([...s]));
  const visible=n=>{
    const role=String(n.target_role||n.recipient_role||'all').toLowerCase();
    return ['all','student','store'].includes(role)&&String(n.status||'active').toLowerCase()!=='inactive';
  };
  const unread=()=>{const s=seen();return state.rows.filter(n=>!s.has(String(n.id))).length};
  function updateBadge(){
    const count=unread();
    document.querySelectorAll('.alin-v94-notify-count,.alin98-notify-count,.mobile-action-count,.desktop-action-count').forEach(b=>{
      b.textContent=count>99?'99+':String(count);b.hidden=!count;
    });
    document.querySelectorAll('.alin-v94-notification-button,[data-desktop-control="notifications"]').forEach(b=>{
      b.classList.toggle('has-unread',!!count);b.setAttribute('aria-label',count?`الإشعارات، ${count} جديد`:'الإشعارات');
    });
  }
  function dateText(v){
    try{return new Intl.DateTimeFormat('ar-IQ',{timeZone:'Asia/Baghdad',dateStyle:'medium',timeStyle:'short'}).format(new Date(v))}catch(_){return ''}
  }
  function close(){document.getElementById('alinNotificationsV120')?.remove();document.body.classList.remove('alin-notifications-open')}
  function render(){
    close();
    const s=seen(),panel=document.createElement('div');
    panel.id='alinNotificationsV120';panel.className='alin-notifications-v120';
    panel.innerHTML=`<button class="alin-notifications-v120__backdrop" type="button" aria-label="إغلاق"></button>
      <section class="alin-notifications-v120__panel" role="dialog" aria-modal="true" aria-labelledby="alinNotificationsTitle">
        <header><div><h2 id="alinNotificationsTitle">الإشعارات</h2><p>${unread()?`${unread()} إشعار جديد`:'لا توجد إشعارات جديدة'}</p></div><div><button type="button" data-read-all>قراءة الكل</button><button type="button" data-close aria-label="إغلاق">×</button></div></header>
        <div class="alin-notifications-v120__list">${state.rows.length?state.rows.map(n=>{
          const isRead=s.has(String(n.id));
          return `<article class="${isRead?'read':'unread'}" data-id="${esc(n.id)}"><span class="alin-notifications-v120__dot"></span><div><div class="alin-notifications-v120__title"><h3>${esc(n.title||'إشعار')}</h3>${isRead?'':'<b>جديد</b>'}</div><p>${esc(n.message||n.text||'')}</p><time>${esc(dateText(n.created_at||n.sent_at))}</time></div></article>`;
        }).join(''):'<div class="alin-notifications-v120__empty"><span>🔕</span><b>لا توجد إشعارات حالياً</b><p>إشعارات الإدارة الجديدة ستظهر هنا.</p></div>'}</div>
      </section>`;
    document.body.appendChild(panel);document.body.classList.add('alin-notifications-open');
    panel.querySelector('[data-close]').onclick=close;
    panel.querySelector('.alin-notifications-v120__backdrop').onclick=close;
    panel.querySelector('[data-read-all]').onclick=()=>{const all=seen();state.rows.forEach(n=>all.add(String(n.id)));saveSeen(all);updateBadge();render()};
    panel.querySelectorAll('[data-id]').forEach(item=>item.onclick=()=>{const all=seen();all.add(String(item.dataset.id));saveSeen(all);updateBadge();item.classList.remove('unread');item.classList.add('read');item.querySelector('.alin-notifications-v120__title b')?.remove()});
  }
  async function refresh(){
    try{
      const res=await fetch(`${URL}/rest/v1/notifications?select=*&order=created_at.desc&limit=50`,{
        headers:{apikey:KEY,Authorization:`Bearer ${KEY}`},cache:'no-store'
      });
      if(!res.ok)throw new Error(`notifications ${res.status}`);
      state.rows=(await res.json()).filter(visible);updateBadge();
    }catch(e){console.warn('[Alin notifications 1.2.0]',e)}
  }
  function click(e){
    const b=e.target.closest('.alin-v94-notification-button,.alin-v78-notify-btn,[data-desktop-control="notifications"],.mobile-header-icon-btn[aria-label^="الإشعارات"]');
    if(!b)return;e.preventDefault();e.stopImmediatePropagation();render();
  }
  function start(){
    document.addEventListener('click',click,true);
    document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
    refresh();state.timer=setInterval(refresh,20000);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
  }
  window.alinRefreshNotifications=refresh;
  try{
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
    window.alinNotificationsV120Boot='ready';
  }catch(e){
    window.alinNotificationsV120Boot='error';
    window.alinNotificationsV120Error=String(e?.message||e);
    console.error('[Alin notifications boot]',e);
  }
})();
