/* ALIN 1.1.6 - standalone public storefront banner */
(function(){
  'use strict';
  const URL='https://jyavewwlgiaibtdqyzpd.supabase.co';
  const KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5YXZld3dsZ2lhaWJ0ZHF5enBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0MTczMzcsImV4cCI6MjA5ODk5MzMzN30.fcjx4JrNdwd5Xrm_Nn1CaWWJoJLF6_DyYGakFPuGwGQ';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const valid=b=>{
    const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Baghdad',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(x=>[x.type,x.value]));
    const d=`${parts.year}-${parts.month}-${parts.day}`;
    return (b.active===true||b.active===1||String(b.active).toLowerCase()==='true')
      && (!b.start_date||String(b.start_date).slice(0,10)<=d)
      && (!b.end_date||String(b.end_date).slice(0,10)>=d);
  };
  function host(){
    let h=document.getElementById('alinStoreBannersV115');
    if(h)return h;
    h=document.createElement('section');h.id='alinStoreBannersV115';h.className='alin-store-banners-v115';h.hidden=true;
    const anchor=document.querySelector('.alin98-hero,.alin-hero,.hero,#bannerBox,.store-hero');
    if(anchor?.parentNode)anchor.parentNode.insertBefore(h,anchor);
    else (document.querySelector('main,#storePage')||document.body).prepend(h);
    return h;
  }
  function imageCandidates(path){
    const raw=String(path||'').trim(); if(!raw)return [];
    if(/^https?:\/\//i.test(raw))return [raw];
    const clean=raw.replace(/^\/+/,'');
    const name=clean.replace(/^banners\//i,'');
    return [
      `${URL}/storage/v1/object/public/banners/${encodeURIComponent(name)}`,
      `${URL}/storage/v1/object/public/alin-files/${clean.split('/').map(encodeURIComponent).join('/')}`,
      `${URL}/storage/v1/object/public/alin-files/banners/${encodeURIComponent(name)}`
    ];
  }
  window.alinBanner116Fallback=function(img){
    const list=JSON.parse(img.dataset.sources||'[]'),n=(Number(img.dataset.index)||0)+1;
    if(n<list.length){img.dataset.index=String(n);img.src=list[n]}else img.remove();
  };
  async function refresh(){
    const h=host();
    try{
      const response=await fetch(`${URL}/rest/v1/banners?select=*&order=created_at.desc`,{
        headers:{apikey:KEY,Authorization:`Bearer ${KEY}`},cache:'no-store'
      });
      if(!response.ok)throw new Error(`banners ${response.status}`);
      const b=(await response.json()).find(valid);
      if(!b){h.hidden=true;h.innerHTML='';return}
      const images=imageCandidates(b.image_path||b.image_url);
      const sources=esc(JSON.stringify(images));
      const stripText=b.text||b.title||'';
      h.innerHTML=`<article class="alin-store-banner-v115">${images.length
        ? `<img src="${esc(images[0])}" data-sources='${sources}' data-index="0" onerror="window.alinBanner116Fallback(this)" alt="${esc(b.title||'إعلان منصة آلين')}">${stripText?`<div class="alin-store-banner-v115__strip">${esc(stripText)}</div>`:''}`
        : `<div class="alin-store-banner-v115__copy"><span>إعلان منصة آلين</span><h2>${esc(b.title||'')}</h2>${b.text?`<p>${esc(b.text)}</p>`:''}</div>`
      }</article>`;
      h.hidden=false;
    }catch(e){console.warn('[Alin banner 1.1.6]',e)}
  }
  function start(){refresh();setTimeout(refresh,1500);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();

/* ALIN 1.2.3 - storefront notification center, bundled with the proven banner bridge */
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
    document.querySelectorAll('.alin-v94-notify-count,.alin98-notify-count,.mobile-action-count,.desktop-action-count').forEach(x=>{x.textContent=n>99?'99+':String(n);x.hidden=!n});
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
    document.addEventListener('click',e=>{const b=e.target.closest('.alin-v94-notification-button,.alin-v78-notify-btn,[data-desktop-control="notifications"],.mobile-header-icon-btn[aria-label^="الإشعارات"]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();open()},true);
    document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
    loadNotifications();setInterval(loadNotifications,20000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)loadNotifications()});
    window.alinRefreshNotifications=loadNotifications;window.alinNotificationsReady=true;
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installNotifications);else installNotifications();
})();
