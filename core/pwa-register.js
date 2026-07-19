/* ALIN 2.0.1 — safe PWA registration */
(function(){
  'use strict';
try{localStorage.removeItem('alin_v121_accountant_pass');localStorage.removeItem('alin_v121_accountant_user')}catch(_){}

  if(!('serviceWorker' in navigator))return;
  if(!/^https?:$/.test(location.protocol))return;
  window.addEventListener('load',async()=>{
    try{
      const registration=await navigator.serviceWorker.register('./service-worker.js',{scope:'./'});
      registration.update().catch(()=>{});
    }catch(error){console.warn('[ALIN PWA]',error)}
  },{once:true});
})();
