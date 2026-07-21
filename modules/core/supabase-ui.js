// === core/supabase-ui.js ===
/* ALIN v2.3.4 — read-only UI binding for the authoritative Supabase service.
   Data access is owned only by modules/core/supabase.js.
   File storage is owned only by modules/core/storage.js.
*/
(function(){
  'use strict';

  const VERSION='2.3.4';
  let lastRefresh=null;
  let lastMutation=null;

  function setRootState(state){
    const root=document.documentElement;
    if(!root?.dataset)return;
    root.dataset.alinDataState=state;
    root.dataset.alinDataVersion=VERSION;
  }
  function onRefresh(event){
    lastRefresh={...(event?.detail||{}),received_at:new Date().toISOString()};
    setRootState(lastRefresh.errors?.length?'partial':'ready');
  }
  function onMutation(event){
    lastMutation={...(event?.detail||{}),received_at:new Date().toISOString()};
    setRootState('updating');
  }
  async function refresh(options={}){
    if(!window.AlinRepository?.refresh)throw new Error('خدمة البيانات غير جاهزة');
    return window.AlinRepository.refresh(options);
  }
  function status(){
    return Object.freeze({version:VERSION,lastRefresh,lastMutation,connected:!!window.AlinRepository?.online?.()});
  }

  window.addEventListener('alin:data-refreshed',onRefresh);
  window.addEventListener('alin:cloud-mutation',onMutation);
  window.AlinRepositoryUI=Object.freeze({version:VERSION,refresh,status});
  setRootState(window.AlinRepository?.online?.()?'loading':'offline');
})();

;
