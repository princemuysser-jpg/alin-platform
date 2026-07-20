/* ALIN 2.0.1 step 1.4 — deployment-safe PWA updater */
(function(){
  'use strict';
  try{localStorage.removeItem('alin_v121_accountant_pass');localStorage.removeItem('alin_v121_accountant_user')}catch(_){ }
  if(!('serviceWorker' in navigator))return;
  if(!/^https?:$/.test(location.protocol))return;

  let reloading=false;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    if(reloading)return;
    reloading=true;
    location.reload();
  });

  window.addEventListener('load',async()=>{
    try{
      const registration=await navigator.serviceWorker.register('./service-worker.js?v=2.0.4',{scope:'./',updateViaCache:'none'});
      await registration.update().catch(()=>{});
      if(registration.waiting)registration.waiting.postMessage({type:'SKIP_WAITING'});
      registration.addEventListener('updatefound',()=>{
        const worker=registration.installing;
        if(!worker)return;
        worker.addEventListener('statechange',()=>{
          if(worker.state==='installed'&&navigator.serviceWorker.controller){
            worker.postMessage({type:'SKIP_WAITING'});
          }
        });
      });
    }catch(error){console.warn('[ALIN PWA]',error)}
  },{once:true});
})();
