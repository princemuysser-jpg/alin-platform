// === core/navigation.js ===
/* ALIN V214 — one owner for login shell, page navigation, role guards and logout UI. */
(function(){
  'use strict';
  const labels={store:'المتجر',teacher:'المدرس',library:'المكتبة',courier:'المندوب',admin:'الإدارة'};
  const allowed={
    admin:new Set(['admin','store']),accountant:new Set(['admin','store']),teacher:new Set(['teacher','store']),
    library:new Set(['library','store']),courier:new Set(['courier','store']),student:new Set(['store']),store:new Set(['store'])
  };
  let logoutPromise=null;
  const el=id=>document.getElementById(id);
  const user=()=>window.current||null;
  function notify(message){try{return window.toast?.(message)}catch(_){}alert(message)}
  function canOpen(page){if(page==='store')return true;const role=String(user()?.role||'');return Boolean(role&&(allowed[role]||new Set()).has(page))}
  function decorate(){
    const name=String(window.db?.settings?.platform_name||'منصة آلين');
    document.title=name;
    document.querySelectorAll('.version-badge').forEach(node=>node.textContent='منصة آلين');
    try{window.applyBrandV28?.()}catch(error){console.warn('[ALIN navigation brand]',error)}
  }
  function showLogin(role){
    window.pendingRole=String(role||'');
    el('loginForm')?.classList.remove('hidden');
    const message=el('loginMsg');if(message)message.textContent='';
    const username=el('loginU'),password=el('loginPass');if(username)username.value='';if(password)password.value='';
    username?.focus?.();
  }
  async function doLogin(){
    if(window.ALIN_CONFIG?.authEnabled!==true){const message=el('loginMsg');if(message)message.textContent='تسجيل الدخول الآمن غير مفعل';return false}
    if(!window.ALINAuth?.loginFromUI){const message=el('loginMsg');if(message)message.textContent='خدمة تسجيل الدخول غير جاهزة';return false}
    try{await window.ALINAuth.loginFromUI();return true}catch(_){return false}
  }
  function openPage(page,options={}){
    page=String(page||'store');
    if(!canOpen(page)){notify('ليس لديك صلاحية لفتح هذه الصفحة');return false}
    el('login')?.classList.add('hidden');
    el('app')?.classList.remove('hidden');
    el('app')?.classList.toggle('store-mode',page==='store');
    document.querySelectorAll('.page').forEach(node=>node.classList.add('hidden'));
    const target=el(page+'Page');if(!target){notify('الصفحة المطلوبة غير موجودة');return false}target.classList.remove('hidden');
    const nav=el('activeNav');if(nav)nav.innerHTML=`<button>${labels[page]||page}</button>`;
    if(options.render!==false&&typeof window.renderAll==='function')window.renderAll();
    if(page==='admin'&&typeof window.adminTab==='function'){
      const role=String(user()?.role||'');
      const requested=role==='accountant'?'finance':(!window.activeAdminTab||window.activeAdminTab==='accounts'?'dashboard':window.activeAdminTab);
      window.adminTab(requested);
      if(role==='accountant')document.querySelectorAll('.admin-tabs button').forEach(button=>{button.style.display=(button.textContent||'').includes('الأرباح')?'':'none'});
    }
    if(page==='courier'&&typeof window.renderCourierDashboard==='function')window.renderCourierDashboard();
    decorate();
    window.dispatchEvent(new CustomEvent('alin:page-open',{detail:{page,account:user(),rendered:options.render!==false}}));
    return true;
  }
  function showSignedOut(){
    window.current=null;
    el('app')?.classList.remove('store-mode');
    el('app')?.classList.add('hidden');
    el('login')?.classList.remove('hidden');
    el('loginForm')?.classList.add('hidden');
    const password=el('loginPass');if(password)password.value='';
  }
  async function logout(){
    if(logoutPromise)return logoutPromise;
    logoutPromise=(async()=>{
      try{await window.ALINAuth?.signOut?.()}catch(error){console.error('[ALIN logout]',error)}
      showSignedOut();
      window.dispatchEvent(new CustomEvent('alin:logout',{detail:{source:'user'}}));
      return true;
    })().finally(()=>{logoutPromise=null});
    return logoutPromise;
  }
  window.showLogin=showLogin;
  window.doLogin=doLogin;
  window.openPage=openPage;
  window.logout=logout;
  window.ALINNavigation=Object.freeze({version:'214.1',showLogin,doLogin,openPage,logout,showSignedOut,canOpen});
})();
