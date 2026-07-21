/* ALIN v2.2.6 — storefront notification center backed by AlinNotifications. */
(function(){
  'use strict';

  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[char]));
  const context=()=>({role:'student',id:''});
  const service=()=>window.AlinNotifications;
  const rows=()=>service()?.visible?.(context())||[];
  const unread=()=>service()?.unreadCount?.(context())||0;

  function badges(){
    const count=unread();
    document.querySelectorAll('.alin98-notify-count,.alin-v94-notify-count').forEach(badge=>{
      badge.textContent=count>99?'99+':String(count);
      badge.hidden=count===0;
    });
    document.querySelectorAll('[data-desktop-control="notifications"],.mobile-header-icon-btn[aria-label^="الإشعارات"]').forEach(button=>{
      button.classList.toggle('has-unread',count>0);
    });
  }

  function close(){
    document.getElementById('alinNotificationsV120')?.remove();
    document.body.classList.remove('alin-notifications-open');
  }

  function itemHtml(row){
    const read=service()?.isRead?.(row,context())??true;
    return `<article class="${read?'read':'unread'}" data-notification-id="${escapeHtml(row.id)}"><span class="alin-notifications-v120__dot"></span><div><div class="alin-notifications-v120__title"><h3>${escapeHtml(row.title||'إشعار')}</h3>${read?'':'<b>جديد</b>'}</div><p>${escapeHtml(row.message||row.text||'')}</p><time>${escapeHtml(new Date(row.created_at||Date.now()).toLocaleString('ar-IQ'))}</time></div></article>`;
  }

  function open(){
    close();
    const box=document.createElement('div');
    box.id='alinNotificationsV120';
    box.className='alin-notifications-v120';
    const list=rows();
    box.innerHTML=`<button class="alin-notifications-v120__backdrop" type="button" aria-label="إغلاق"></button><section class="alin-notifications-v120__panel" role="dialog" aria-modal="true"><header><div><h2>الإشعارات</h2><p>${unread()?unread()+' إشعار جديد':'لا توجد إشعارات جديدة'}</p></div><div><button type="button" data-read-all>قراءة الكل</button><button type="button" data-close aria-label="إغلاق">×</button></div></header><div class="alin-notifications-v120__list">${list.map(itemHtml).join('')||'<div class="alin-notifications-v120__empty"><span>🔕</span><b>لا توجد إشعارات حالياً</b><p>إشعارات الإدارة الجديدة ستظهر هنا.</p></div>'}</div></section>`;
    document.body.appendChild(box);
    document.body.classList.add('alin-notifications-open');
    box.querySelector('[data-close]')?.addEventListener('click',close);
    box.querySelector('.alin-notifications-v120__backdrop')?.addEventListener('click',close);
    box.querySelector('[data-read-all]')?.addEventListener('click',async()=>{await service()?.markAll?.(context());open()});
    box.querySelectorAll('[data-notification-id]').forEach(item=>item.addEventListener('click',async()=>{
      await service()?.markRead?.(item.dataset.notificationId,context());
      open();
    }));
  }

  async function refresh(){
    await service()?.refresh?.();
    badges();
  }

  function install(){
    document.querySelectorAll('[data-desktop-control="notifications"],.mobile-header-icon-btn[aria-label^="الإشعارات"]').forEach(button=>{
      button.removeAttribute('onclick');
      if(button.dataset.alinNotificationsBound==='1')return;
      button.dataset.alinNotificationsBound='1';
      button.addEventListener('click',event=>{event.preventDefault();open()});
    });
    document.addEventListener('keydown',event=>{if(event.key==='Escape')close()});
    window.addEventListener('alin:notifications-updated',badges);
    window.addEventListener('alin:store-rendered',badges);
    refresh();
  }

  const api=Object.freeze({open,close,refresh,badges,rows});
  window.AlinStoreNotifications=api;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
