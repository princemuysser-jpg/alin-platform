// === teacher/notifications.js ===
/* ALIN v2.0.2 — مركز إشعارات المدرس الموحد */
(function(){
  'use strict';

  const BUTTON_ID='teacherNotificationsTabV160';
  const BADGE_ID='teacherNotificationsBadgeV160';

  const array=value=>Array.isArray(value)?value:[];
  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[char]));

  function teacher(){
    try{
      if(typeof current!=='undefined'&&current?.role==='teacher')return current;
    }catch(_){ }
    return window.current?.role==='teacher'?window.current:null;
  }

  function host(){return document.getElementById('teacherContent')}
  function teacherId(){return String(teacher()?.id||'')}
  function storageKey(){return `alin_teacher_seen_notifications_${teacherId()||'guest'}`}

  function localSeen(){
    try{return new Set(JSON.parse(localStorage.getItem(storageKey())||'[]').map(String))}
    catch(_){return new Set()}
  }

  function saveLocalSeen(values){
    try{localStorage.setItem(storageKey(),JSON.stringify([...values]))}
    catch(error){console.warn('[ALIN teacher notifications] local state',error)}
  }

  function matchesTeacher(notification){
    const id=teacherId();
    if(!id||!notification)return false;
    if(['deleted','inactive','hidden'].includes(String(notification.status||'').toLowerCase()))return false;

    const role=String(notification.target_role||notification.audience||notification.role||'all').toLowerCase();
    const target=String(notification.target_id||notification.account_id||notification.teacher_id||'').trim();

    // إذا كان الإشعار موجهاً إلى حساب محدد فلا يظهر لبقية المدرسين.
    if(target)return target===id;
    return ['all','teacher','teachers'].includes(role);
  }

  function rows(){
    const merged=[...array(window.v19Notifications),...array(window.db?.notifications)];
    const unique=new Map();
    merged.forEach((notification,index)=>{
      if(!notification)return;
      const id=String(notification.id??`local-${index}`);
      if(!unique.has(id))unique.set(id,notification);
    });
    return [...unique.values()]
      .filter(matchesTeacher)
      .sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));
  }

  function isRead(notification,seen=localSeen()){
    return Boolean(notification?.read_at)||seen.has(String(notification?.id));
  }

  function unreadCount(){
    const seen=localSeen();
    return rows().filter(notification=>!isRead(notification,seen)).length;
  }

  function icon(notification){
    const type=String(notification?.type||notification?.priority||notification?.category||'').toLowerCase();
    if(type.includes('sale')||type.includes('order'))return '🛍️';
    if(type.includes('settle')||type.includes('pay')||type.includes('finance'))return '💰';
    if(type.includes('reject'))return '❌';
    if(type.includes('approve')||type.includes('publish'))return '✅';
    if(type.includes('edit')||type.includes('review'))return '✏️';
    return '🔔';
  }

  function formatDate(value){
    if(!value)return 'بدون تاريخ';
    try{return new Intl.DateTimeFormat('ar-IQ',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value))}
    catch(_){return String(value)}
  }

  function ensureTab(){
    const tabs=document.querySelector('#teacherPage .teacher-tabs');
    if(!tabs)return null;

    const candidates=[...tabs.querySelectorAll('[data-teacher-tab="notifications"],.teacher-notifications-tab')];
    let button=document.getElementById(BUTTON_ID)||candidates[0]||null;
    candidates.forEach(candidate=>{if(candidate!==button)candidate.remove()});

    if(!button){
      button=document.createElement('button');
      const before=[...tabs.querySelectorAll('button')].find(item=>(item.getAttribute('onclick')||'').includes("'requests'"));
      tabs.insertBefore(button,before||null);
    }

    button.type='button';
    button.id=BUTTON_ID;
    button.dataset.teacherTab='notifications';
    button.classList.add('teacher-notifications-tab');
    button.setAttribute('onclick',"teacherTab('notifications')");
    button.innerHTML=`<span aria-hidden="true">🔔</span><span>الإشعارات</span><span id="${BADGE_ID}" class="teacher-v160-badge" hidden>0</span>`;
    button.hidden=false;
    return button;
  }

  function updateBadge(){
    const button=ensureTab();
    if(!button)return;
    const badge=button.querySelector(`#${BADGE_ID}`);
    const count=unreadCount();
    if(badge){badge.textContent=String(count);badge.hidden=count===0}
  }

  function setActive(){
    document.querySelectorAll('#teacherPage .teacher-tabs button').forEach(button=>{
      const target=button.dataset.teacherTab||((button.getAttribute('onclick')||'').match(/teacherTab\('([^']+)'\)/)||[])[1]||'';
      button.classList.toggle('active-teacher-tab',target==='notifications');
    });
  }

  function card(notification,seen){
    const read=isRead(notification,seen);
    const id=escapeHtml(notification.id??'');
    const title=escapeHtml(notification.title||'إشعار');
    const message=escapeHtml(notification.message||notification.text||'');
    const searchable=escapeHtml(`${notification.title||''} ${notification.message||notification.text||''}`.toLowerCase());
    return `<article class="teacher-v155-card ${read?'':'unread'}" data-notification-id="${id}" data-text="${searchable}" data-read="${read?'1':'0'}"><div class="teacher-v155-icon">${icon(notification)}</div><div><h3>${title}</h3><p>${message}</p><small>${escapeHtml(formatDate(notification.created_at))}</small></div><div class="teacher-v155-card-actions">${read?'':`<button type="button" onclick="TeacherNotifications.mark('${id}')">مقروء</button>`}<button type="button" class="secondary" onclick="TeacherNotifications.copy('${id}')">نسخ</button></div></article>`;
  }

  function render(){
    const container=host();
    if(!container)return false;

    const currentTeacher=teacher();
    if(!currentTeacher){
      container.innerHTML='<section class="teacher-v155-notifications"><div class="teacher-v155-empty">تعذر تحديد حساب المدرس.</div></section>';
      return false;
    }

    const notifications=rows();
    const seen=localSeen();
    const unread=notifications.filter(notification=>!isRead(notification,seen)).length;
    const today=new Date().toISOString().slice(0,10);
    const todayCount=notifications.filter(notification=>String(notification.created_at||'').slice(0,10)===today).length;

    container.innerHTML=`<section class="teacher-v155-notifications"><div class="teacher-v155-head"><div><h2>إشعاراتي</h2><p>تابع الموافقات والمبيعات والتسويات ورسائل الإدارة.</p></div><div class="teacher-v155-actions"><button type="button" onclick="TeacherNotifications.markAll()">تحديد الكل كمقروء</button><button type="button" class="secondary" onclick="TeacherNotifications.refresh()">تحديث</button></div></div><div class="teacher-v155-stats"><div class="teacher-v155-stat"><small>كل الإشعارات</small><b>${notifications.length}</b></div><div class="teacher-v155-stat"><small>غير المقروء</small><b>${unread}</b></div><div class="teacher-v155-stat"><small>اليوم</small><b>${todayCount}</b></div></div><div class="teacher-v155-toolbar"><input id="teacherNotificationSearch" placeholder="ابحث بعنوان الإشعار أو محتواه" oninput="TeacherNotifications.filter()"><select id="teacherNotificationFilter" onchange="TeacherNotifications.filter()"><option value="all">الكل</option><option value="unread">غير المقروء</option><option value="read">المقروء</option></select></div><div id="teacherNotificationList" class="teacher-v155-list">${notifications.map(notification=>card(notification,seen)).join('')||'<div class="teacher-v155-empty">لا توجد إشعارات حالياً.</div>'}</div></section>`;

    window.activeTeacherTab='notifications';
    setActive();
    updateBadge();
    return true;
  }

  async function mark(id){
    const notification=rows().find(item=>String(item.id)===String(id));
    if(!notification)return;

    const seen=localSeen();
    seen.add(String(id));
    saveLocalSeen(seen);
    notification.read_at=notification.read_at||new Date().toISOString();

    const target=String(notification.target_id||notification.account_id||notification.teacher_id||'').trim();
    if(target===teacherId()){
      try{
        if(typeof update==='function')await update('notifications',{read_at:notification.read_at},{id:notification.id});
      }catch(error){console.warn('[ALIN teacher notifications] remote read state',error)}
    }
    render();
  }

  function markAll(){
    const seen=localSeen();
    rows().forEach(notification=>seen.add(String(notification.id)));
    saveLocalSeen(seen);
    render();
  }

  function filter(){
    const query=(document.getElementById('teacherNotificationSearch')?.value||'').trim().toLowerCase();
    const mode=document.getElementById('teacherNotificationFilter')?.value||'all';
    document.querySelectorAll('#teacherNotificationList .teacher-v155-card').forEach(card=>{
      card.hidden=Boolean(
        (query&&!String(card.dataset.text||'').includes(query))||
        (mode==='unread'&&card.dataset.read==='1')||
        (mode==='read'&&card.dataset.read==='0')
      );
    });
  }

  async function copy(id){
    const notification=rows().find(item=>String(item.id)===String(id));
    if(!notification)return;
    const text=`${notification.title||'إشعار'}\n${notification.message||notification.text||''}`;
    try{
      await navigator.clipboard.writeText(text);
      if(typeof toast==='function')toast('تم نسخ الإشعار');
    }catch(_){ }
  }

  function refresh(){
    render();
    if(typeof toast==='function')toast('تم تحديث الإشعارات');
  }

  window.TeacherNotifications={render,mark,markAll,filter,copy,refresh,updateBadge,rows};
  // إبقاء الاسم السابق فقط للتوافق مع أي استدعاء قائم، بدون نظام إشعارات ثانٍ.
  window.TeacherV155=window.TeacherNotifications;

  if(!window.TeacherApp)throw new Error('TeacherApp must load before teacher/notifications.js');
  window.TeacherApp.registerTab('notifications',()=>render());
  window.AlinTeacherModules=window.AlinTeacherModules||{};
  window.AlinTeacherModules.renderNotifications=render;

  function init(){
    ensureTab();
    updateBadge();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();


;
