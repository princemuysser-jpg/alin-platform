/* ALIN v2.0.1 — runtime stability and path guard */
(function(){
  'use strict';
  const report=(kind,error)=>{
    const message=error?.message||String(error||'خطأ غير معروف');
    console.error('[ALIN]',kind,message,error||'');
    window.__ALIN_RUNTIME_ERRORS__=window.__ALIN_RUNTIME_ERRORS__||[];
    window.__ALIN_RUNTIME_ERRORS__.push({kind,message,at:new Date().toISOString()});
    if(window.__ALIN_RUNTIME_ERRORS__.length>50)window.__ALIN_RUNTIME_ERRORS__.shift();
  };
  addEventListener('error',e=>report('error',e.error||e.message));
  addEventListener('unhandledrejection',e=>{report('promise',e.reason);e.preventDefault()});
  document.addEventListener('click',e=>{
    const a=e.target.closest('a[href]');if(!a)return;
    const href=a.getAttribute('href')||'';
    if(/^javascript:/i.test(href)){e.preventDefault();report('blocked-link','تم منع رابط javascript غير آمن')}
  },true);
  addEventListener('online',()=>document.documentElement.classList.remove('alin-offline'));
  addEventListener('offline',()=>document.documentElement.classList.add('alin-offline'));
  if(!navigator.onLine)document.documentElement.classList.add('alin-offline');
  window.AlinRuntime=Object.freeze({version:'2.0.1',errors:()=>[...(window.__ALIN_RUNTIME_ERRORS__||[])]});
})();
