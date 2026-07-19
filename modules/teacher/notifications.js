// Alin module: teacher/notifications.js | v2.0.3
/* ===== teacher/js/teacher-notifications-v155.js ===== */

/* V155 — إشعارات المدرس */
(function(){
  const escx=v=>typeof esc==='function'?esc(v):String(v??'');
  const arr=v=>Array.isArray(v)?v:[];
  const currentTeacher=()=>window.current?.role==='teacher'?window.current:null;
  const key=()=>`alin_teacher_seen_notifications_${currentTeacher()?.id||'guest'}`;
  const seen=()=>{try{return new Set(JSON.parse(localStorage.getItem(key())||'[]').map(String))}catch(_){return new Set()}};
  const saveSeen=s=>localStorage.setItem(key(),JSON.stringify([...s]));
  function all(){
    const t=currentTeacher(); if(!t)return[];
    const rows=[...arr(window.v19Notifications),...arr(window.db?.notifications)];
    const map=new Map(); rows.forEach(n=>{if(n?.id!=null)map.set(String(n.id),n)});
    return [...map.values()].filter(n=>{
      if(n.status==='deleted'||n.status==='inactive')return false;
      const role=n.target_role||n.audience||'all';
      const target=String(n.target_id||n.account_id||n.teacher_id||'');
      return ['all','teacher','teachers'].includes(role)||target===String(t.id);
    }).sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));
  }
  const icon=n=>{const x=String(n.type||n.priority||n.category||'').toLowerCase();if(x.includes('sale')||x.includes('order'))return'🛍️';if(x.includes('settle')||x.includes('pay')||x.includes('finance'))return'💰';if(x.includes('reject'))return'❌';if(x.includes('approve')||x.includes('publish'))return'✅';if(x.includes('edit')||x.includes('review'))return'✏️';return'🔔'};
  function isRead(n,s){return !!n.read_at||s.has(String(n.id))}
  function updateBadge(){
    const s=seen(),unread=all().filter(n=>!isRead(n,s)).length;
    document.querySelectorAll('#teacherV155Badge').forEach(b=>{b.textContent=unread;b.hidden=!unread});
  }
  function render(){
    if(!currentTeacher()||!window.teacherContent)return;
    const rows=all(),s=seen(),unread=rows.filter(n=>!isRead(n,s)).length,today=new Date().toISOString().slice(0,10),todayCount=rows.filter(n=>String(n.created_at||'').slice(0,10)===today).length;
    teacherContent.innerHTML=`<section class="teacher-v155-notifications"><div class="teacher-v155-head"><div><h2>إشعاراتي</h2><p>تابع الموافقات والمبيعات والتسويات ورسائل الإدارة.</p></div><div class="teacher-v155-actions"><button type="button" onclick="TeacherV155.markAll()">تحديد الكل كمقروء</button><button type="button" class="secondary" onclick="TeacherV155.refresh()">تحديث</button></div></div><div class="teacher-v155-stats"><div class="teacher-v155-stat"><small>كل الإشعارات</small><b>${rows.length}</b></div><div class="teacher-v155-stat"><small>غير المقروء</small><b>${unread}</b></div><div class="teacher-v155-stat"><small>اليوم</small><b>${todayCount}</b></div></div><div class="teacher-v155-toolbar"><input id="teacherV155Search" placeholder="ابحث بعنوان الإشعار أو محتواه" oninput="TeacherV155.filter()"><select id="teacherV155Filter" onchange="TeacherV155.filter()"><option value="all">الكل</option><option value="unread">غير المقروء</option><option value="read">المقروء</option></select></div><div id="teacherV155List" class="teacher-v155-list">${rows.map(n=>`<article class="teacher-v155-card ${isRead(n,s)?'':'unread'}" data-text="${escx(((n.title||'')+' '+(n.message||n.text||'')).toLowerCase())}" data-read="${isRead(n,s)?'1':'0'}"><div class="teacher-v155-icon">${icon(n)}</div><div><h3>${escx(n.title||'إشعار')}</h3><p>${escx(n.message||n.text||'')}</p><small>${escx(n.created_at||'')}</small></div><div class="teacher-v155-card-actions">${isRead(n,s)?'':`<button type="button" onclick="TeacherV155.mark('${escx(n.id)}')">مقروء</button>`}<button type="button" class="secondary" onclick="TeacherV155.copy('${escx(n.id)}')">نسخ</button></div></article>`).join('')||'<div class="teacher-v155-empty">لا توجد إشعارات حالياً.</div>'}</div></section>`;
    document.querySelectorAll('#teacherPage .teacher-tabs button').forEach(b=>b.classList.toggle('active-teacher-tab',(b.getAttribute('onclick')||'').includes("'notifications'")));
    updateBadge();
  }
  async function mark(id){
    const s=seen();s.add(String(id));saveSeen(s);
    const n=all().find(x=>String(x.id)===String(id));if(n)n.read_at=n.read_at||new Date().toISOString();
    try{if(typeof update==='function')await update('notifications',{read_at:new Date().toISOString()},{id})}catch(_){ }
    render();
  }
  async function markAll(){
    const s=seen();all().forEach(n=>s.add(String(n.id)));saveSeen(s);
    const now=new Date().toISOString();all().forEach(n=>n.read_at=n.read_at||now);
    render();
  }
  function filter(){const q=(document.getElementById('teacherV155Search')?.value||'').trim().toLowerCase(),f=document.getElementById('teacherV155Filter')?.value||'all';document.querySelectorAll('#teacherV155List .teacher-v155-card').forEach(c=>{c.hidden=!!((q&&!c.dataset.text.includes(q))||(f==='unread'&&c.dataset.read==='1')||(f==='read'&&c.dataset.read==='0'))})}
  function copy(id){const n=all().find(x=>String(x.id)===String(id));if(!n)return;const text=`${n.title||'إشعار'}\n${n.message||n.text||''}`;navigator.clipboard?.writeText(text).then(()=>typeof toast==='function'&&toast('تم نسخ الإشعار')).catch(()=>{});}
  function refresh(){render();typeof toast==='function'&&toast('تم تحديث الإشعارات')}
  window.TeacherV155={render,mark,markAll,filter,copy,refresh,updateBadge};
  const previousTab=window.teacherTab;
  window.teacherTab=function(tab){if(tab==='notifications'){render();return}return typeof previousTab==='function'?previousTab(tab):undefined};
  window.AlinTeacherModules=window.AlinTeacherModules||{};window.AlinTeacherModules.teacherTab=window.teacherTab;
  document.addEventListener('DOMContentLoaded',updateBadge);
})();

/* ===== teacher/js/teacher-notifications-visible-v158.js ===== */
/* V158 — تثبيت ظهور تبويب إشعارات المدرس وربطه كآخر متحكم */
(function(){
  const previousTeacherTab = window.teacherTab;

  function ensureNotificationTab(){
    const tabs = document.querySelector('#teacherPage .teacher-tabs');
    if(!tabs) return null;
    let button = [...tabs.querySelectorAll('button')].find(b => (b.getAttribute('onclick')||'').includes("'notifications'") || b.dataset.teacherTab === 'notifications');
    if(!button){
      button = document.createElement('button');
      button.type = 'button';
      button.dataset.teacherTab = 'notifications';
      button.innerHTML = 'الإشعارات <span id="teacherV155Badge" class="teacher-v155-badge" hidden>0</span>';
      const profileButton = [...tabs.querySelectorAll('button')].find(b => (b.getAttribute('onclick')||'').includes("'profile'"));
      tabs.insertBefore(button, profileButton || null);
    }
    button.setAttribute('onclick', "teacherTab('notifications')");
    return button;
  }

  function setActive(tab){
    document.querySelectorAll('#teacherPage .teacher-tabs button').forEach(b => {
      const target = b.dataset.teacherTab || ((b.getAttribute('onclick')||'').match(/teacherTab\('([^']+)'\)/)||[])[1] || '';
      b.classList.toggle('active-teacher-tab', target === tab);
    });
  }

  function openNotifications(){
    ensureNotificationTab();
    if(window.TeacherV155 && typeof window.TeacherV155.render === 'function'){
      window.activeTeacherTab = 'notifications';
      window.TeacherV155.render();
      setActive('notifications');
      return true;
    }
    const host = document.getElementById('teacherContent');
    if(host){
      host.innerHTML = '<section class="teacher-v155-notifications"><div class="teacher-v155-empty">تعذر تحميل مركز الإشعارات. حدّث الصفحة وحاول مرة أخرى.</div></section>';
      setActive('notifications');
    }
    return false;
  }

  window.teacherTab = function(tab){
    if(tab === 'notifications'){
      openNotifications();
      return;
    }
    return typeof previousTeacherTab === 'function' ? previousTeacherTab(tab) : undefined;
  };

  window.AlinTeacherModules = window.AlinTeacherModules || {};
  window.AlinTeacherModules.teacherTab = window.teacherTab;
  window.openTeacherNotificationsV158 = openNotifications;

  function init(){
    ensureNotificationTab();
    if(window.TeacherV155 && typeof window.TeacherV155.updateBadge === 'function') window.TeacherV155.updateBadge();
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

/* ===== teacher/js/teacher-notifications-v159.js ===== */

/* V159 — تثبيت مركز إشعارات المدرس نهائياً */
(function(){
  function teacherCurrent(){
    try{ if(typeof current!=='undefined' && current && current.role==='teacher') return current; }catch(_){ }
    return window.current && window.current.role==='teacher' ? window.current : null;
  }
  function rows(){
    const t=teacherCurrent(); if(!t) return [];
    const all=[...(Array.isArray(window.v19Notifications)?window.v19Notifications:[]),...(Array.isArray(window.db?.notifications)?window.db.notifications:[])];
    const map=new Map(); all.forEach(n=>{if(n&&n.id!=null)map.set(String(n.id),n)});
    return [...map.values()].filter(n=>{
      if(n.status==='deleted'||n.status==='inactive') return false;
      const role=String(n.target_role||n.audience||'all').toLowerCase();
      const target=String(n.target_id||n.account_id||n.teacher_id||'');
      return ['all','teacher','teachers'].includes(role)||target===String(t.id);
    });
  }
  function seenSet(){
    const t=teacherCurrent();
    try{return new Set(JSON.parse(localStorage.getItem(`alin_teacher_seen_notifications_${t?.id||'guest'}`)||'[]').map(String))}catch(_){return new Set()}
  }
  function unreadCount(){const s=seenSet();return rows().filter(n=>!n.read_at&&!s.has(String(n.id))).length}
  function updateBadges(){
    const n=unreadCount();
    document.querySelectorAll('#teacherV155Badge,#teacherV159MainBadge').forEach(b=>{b.textContent=n;b.hidden=!n});
  }
  function ensureVisible(){
    const tabs=document.querySelector('#teacherPage .teacher-tabs');
    if(!tabs)return;
    let b=tabs.querySelector('[data-teacher-tab="notifications"]');
    if(!b){
      b=document.createElement('button');b.type='button';b.dataset.teacherTab='notifications';b.className='teacher-notifications-tab';b.setAttribute('onclick',"teacherTab('notifications')");b.innerHTML='🔔 الإشعارات <span id="teacherV155Badge" class="teacher-v155-badge" hidden>0</span>';
      tabs.insertBefore(b,tabs.children[1]||null);
    }
  }
  const previous=window.teacherTab;
  window.teacherTab=function(tab){
    if(tab==='notifications'){
      ensureVisible();
      if(window.TeacherV155&&typeof window.TeacherV155.render==='function'){
        window.activeTeacherTab='notifications';window.TeacherV155.render();
      }else{
        const host=document.getElementById('teacherContent');if(host)host.innerHTML='<section class="teacher-v155-notifications"><div class="teacher-v155-empty">مركز الإشعارات غير محمّل. أعد تحديث الصفحة.</div></section>';
      }
      document.querySelectorAll('#teacherPage .teacher-tabs button').forEach(x=>x.classList.toggle('active-teacher-tab',x.dataset.teacherTab==='notifications'||(x.getAttribute('onclick')||'').includes("'notifications'")));
      updateBadges();return;
    }
    return typeof previous==='function'?previous(tab):undefined;
  };
  window.AlinTeacherModules=window.AlinTeacherModules||{};window.AlinTeacherModules.teacherTab=window.teacherTab;
  function init(){ensureVisible();updateBadges()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
  window.setInterval(updateBadges,5000);
})();

/* ===== teacher/js/teacher-notifications-v160.js ===== */

/* V160 — تثبيت قسم إشعارات المدرس بشكل نهائي */
(function(){
  function targetTabs(){return document.querySelector('#teacherPage .teacher-tabs')}
  function currentTeacher(){try{return (typeof current!=='undefined'&&current&&current.role==='teacher')?current:(window.current&&window.current.role==='teacher'?window.current:null)}catch(_){return null}}
  function notifications(){
    const t=currentTeacher(); if(!t)return [];
    const all=[...(Array.isArray(window.v19Notifications)?window.v19Notifications:[]),...(Array.isArray(window.db&&window.db.notifications)?window.db.notifications:[])];
    const seen=new Set(), out=[];
    all.forEach(n=>{if(!n||n.status==='deleted'||n.status==='inactive')return;const id=String(n.id||Math.random());if(seen.has(id))return;seen.add(id);const role=String(n.target_role||n.audience||'all').toLowerCase();const target=String(n.target_id||n.account_id||n.teacher_id||'');if(['all','teacher','teachers'].includes(role)||target===String(t.id))out.push(n)});
    return out;
  }
  function unread(){
    const t=currentTeacher();let local=new Set();try{local=new Set(JSON.parse(localStorage.getItem(`alin_teacher_seen_notifications_${t&&t.id||'guest'}`)||'[]').map(String))}catch(_){}
    return notifications().filter(n=>!n.read_at&&!local.has(String(n.id))).length;
  }
  function ensureTab(){
    const tabs=targetTabs();if(!tabs)return null;
    // Remove stale duplicates, preserve one final button.
    [...tabs.querySelectorAll('[data-teacher-tab="notifications"],.teacher-notifications-tab')].forEach(x=>{if(x.id!=='teacherNotificationsTabV160')x.remove()});
    let btn=document.getElementById('teacherNotificationsTabV160');
    if(!btn){
      btn=document.createElement('button');btn.type='button';btn.id='teacherNotificationsTabV160';btn.dataset.teacherTab='notifications';btn.innerHTML='<span aria-hidden="true">🔔</span><span>الإشعارات</span><span id="teacherNotificationsBadgeV160" class="teacher-v160-badge" hidden>0</span>';
      const raise=[...tabs.querySelectorAll('button')].find(b=>(b.getAttribute('onclick')||'').includes("'requests'"));
      tabs.insertBefore(btn,raise||null);
    }
    btn.onclick=function(){window.teacherTab('notifications')};
    btn.style.display='inline-flex';btn.hidden=false;
    const badge=btn.querySelector('#teacherNotificationsBadgeV160');const n=unread();if(badge){badge.textContent=n;badge.hidden=!n}
    return btn;
  }
  function setActive(){document.querySelectorAll('#teacherPage .teacher-tabs button').forEach(b=>b.classList.toggle('active-teacher-tab',b.id==='teacherNotificationsTabV160'))}
  const previous=window.teacherTab;
  window.teacherTab=function(tab){
    ensureTab();
    if(tab==='notifications'){
      window.activeTeacherTab='notifications';
      if(window.TeacherV155&&typeof window.TeacherV155.render==='function')window.TeacherV155.render();
      else{const host=document.getElementById('teacherContent');if(host)host.innerHTML='<section class="teacher-v155-notifications"><div class="teacher-v155-empty">لا توجد إشعارات حالياً.</div></section>'}
      setActive();return;
    }
    return typeof previous==='function'?previous(tab):undefined;
  };
  window.AlinTeacherModules=window.AlinTeacherModules||{};window.AlinTeacherModules.teacherTab=window.teacherTab;
  function init(){ensureTab();let tries=0;const timer=setInterval(()=>{ensureTab();if(++tries>20)clearInterval(timer)},500)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();


;

