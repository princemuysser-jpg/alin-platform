// === teacher/shell.js ===
/* ALIN v2.2.5 — authoritative teacher runtime. No wrapper chains. */
(function(){
  'use strict';

  const modules=window.AlinTeacherModules=window.AlinTeacherModules||{};
  const tabs=new Map();
  let active=String(window.activeTeacherTab||'dashboard');
  let chromeRenderer=null;

  const arr=value=>Array.isArray(value)?value:[];
  const same=(a,b)=>String(a??'')===String(b??'');

  function data(){
    const database=window.db||{};
    const account=window.current||{};
    const id=account.role==='teacher'?String(account.id||''):'';
    const teacher=arr(database.accounts?.teachers).find(row=>same(row.id,id))||account||{};
    const books=arr(database.booklets).filter(row=>same(row.teacher_id,id));
    const bookIds=new Set(books.map(row=>String(row.id)));
    const orders=arr(database.orders).filter(row=>row.kind==='booklet'&&bookIds.has(String(row.item_id||row.booklet_id||'')));
    const ledger=arr(database.ledger).filter(row=>same(row.teacher_id,id));
    const payouts=[
      ...arr(database.teacherPayouts).filter(row=>same(row.teacher_id,id)),
      ...arr(database.withdrawals).filter(row=>row.role==='teacher'&&same(row.account_id||row.user_id,id))
    ];
    const requests=arr(database.teacherRequests||database.teacher_requests).filter(row=>same(row.teacher_id,id));
    const notifications=arr(window.v19Notifications||database.notifications).filter(row=>{
      if(String(row.status||'active').toLowerCase()==='deleted')return false;
      const role=String(row.target_role||row.audience||'all').toLowerCase();
      const target=String(row.target_id||row.teacher_id||row.account_id||'');
      return ['all','teacher','teachers'].includes(role)||same(target,id);
    });
    return {id,teacher,books,bookIds,orders,ledger,payouts,requests,notifications};
  }

  function markActive(){
    document.querySelectorAll('#teacherPage .teacher-tabs button').forEach(button=>{
      const inline=button.getAttribute('onclick')||'';
      const target=button.dataset.teacherTab||(inline.match(/teacherTab\('([^']+)'\)/)||[])[1]||'';
      button.classList.toggle('active-teacher-tab',target===active);
    });
  }

  function registerTab(name,renderer){
    if(!name||typeof renderer!=='function')throw new Error('Teacher tab requires a name and renderer');
    tabs.set(String(name),renderer);
    if(window.current?.role==='teacher'&&active===String(name))queueMicrotask(render);
  }

  function registerChrome(renderer){
    chromeRenderer=typeof renderer==='function'?renderer:null;
  }

  function setTab(name){
    active=String(name||'dashboard');
    window.activeTeacherTab=active;
    render();
  }

  function render(){
    if(window.current?.role!=='teacher')return false;
    const host=document.getElementById('teacherContent');
    if(!host)return false;
    const context=data();
    try{chromeRenderer?.(context,active)}catch(error){console.error('[ALIN teacher chrome]',error)}
    const renderer=tabs.get(active)||tabs.get('dashboard');
    if(!renderer){
      host.innerHTML='<div class="empty">جاري تجهيز صفحة المدرس...</div>';
      markActive();
      return false;
    }
    try{
      renderer(context);
      markActive();
      window.dispatchEvent(new CustomEvent('alin:teacher-rendered',{detail:{tab:active}}));
      return true;
    }catch(error){
      console.error('[ALIN teacher render]',error);
      host.innerHTML='<div class="empty">تعذر عرض هذا القسم. حدّث الصفحة وحاول مرة أخرى.</div>';
      markActive();
      return false;
    }
  }

  function teacherObj(id){
    return arr(window.db?.accounts?.teachers).find(row=>same(row.id,id))||{};
  }

  const app={tabs,registerTab,registerChrome,setTab,render,data,get active(){return active}};
  window.TeacherApp=app;
  window.renderTeacher=render;
  window.teacherTab=setTab;
  window.teacherData=data;
  window.teacherObj=teacherObj;
  modules.renderTeacher=render;
  modules.teacherTab=setTab;
  modules.teacherData=data;
  modules.teacherObj=teacherObj;

  window.addEventListener('alin:auth-restored',event=>{
    if(event.detail?.account?.role==='teacher')requestAnimationFrame(render);
  });
  window.addEventListener('alin:data-refreshed',()=>{
    if(window.current?.role==='teacher')requestAnimationFrame(render);
  });
})();
