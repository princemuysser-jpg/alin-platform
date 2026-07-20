/* ALIN v2.0.15 — silent PWA updater without forced page reloads. */
(function(){
  'use strict';
  try{localStorage.removeItem('alin_v121_accountant_pass');localStorage.removeItem('alin_v121_accountant_user')}catch(_){ }
  if(!('serviceWorker' in navigator))return;
  if(!/^https?:$/.test(location.protocol))return;

  window.addEventListener('load',async()=>{
    try{
      const registration=await navigator.serviceWorker.register('./service-worker.js?v=2.0.15',{scope:'./',updateViaCache:'none'});
      registration.addEventListener('updatefound',()=>{
        const worker=registration.installing;
        if(!worker)return;
        worker.addEventListener('statechange',()=>{
          if(worker.state==='installed'&&navigator.serviceWorker.controller){
            worker.postMessage({type:'SKIP_WAITING'});
          }
        });
      });
      if(registration.waiting)registration.waiting.postMessage({type:'SKIP_WAITING'});
      registration.update().catch(()=>{});
    }catch(error){console.warn('[ALIN PWA]',error)}
  },{once:true});
})();
