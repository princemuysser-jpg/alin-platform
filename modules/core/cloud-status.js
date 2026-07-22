// === core/cloud-status.js ===
/* ===== core/js/cloud-status-ui-rc5-3.js ===== */
(function(){
  function mount(){
    if(document.getElementById('alinCloudRc53'))return;
    const el=document.createElement('div');el.id='alinCloudRc53';el.className='alin-cloud-rc53';el.dataset.status=navigator.onLine?'loading':'offline';el.textContent=navigator.onLine?'جاري ربط البيانات':'غير متصل';document.body.appendChild(el);
    const set=(s,t)=>{el.dataset.status=s;el.textContent=t};
    window.addEventListener('alin:cloud-status',e=>{const s=e.detail?.status||'loading';const map={online:'متصل ومزامن',realtime:'تحديث مباشر',loading:'جاري تحميل البيانات',syncing:'جاري المزامنة',offline:'غير متصل',error:'خطأ في الربط','offline-queued':'محفوظ للمزامنة'};set(s,map[s]||'حالة الاتصال: '+s)});
    window.addEventListener('alin:data-refreshed',e=>set(e.detail?.errors?.length?'error':'online',e.detail?.errors?.length?'اتصال جزئي':'متصل ومزامن'));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
