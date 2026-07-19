/* ALIN v2.0.3 — visible startup and connection health */
(function(){
  'use strict';
  let bar;
  function ensureBar(){
    if(bar?.isConnected)return bar;
    bar=document.createElement('div');
    bar.id='alinHealthBar';
    bar.setAttribute('role','status');
    bar.setAttribute('aria-live','polite');
    bar.style.cssText='position:fixed;inset:auto 12px 12px 12px;z-index:2147483647;display:none;padding:12px 16px;border-radius:14px;background:#7f1d1d;color:#fff;font:700 14px/1.6 system-ui;box-shadow:0 12px 30px #0003;text-align:center';
    document.body.appendChild(bar);
    return bar;
  }
  function show(message){const el=ensureBar();el.textContent=message;el.style.display='block'}
  function hide(){if(bar)bar.style.display='none'}
  function check(){
    if(!navigator.onLine){show('لا يوجد اتصال بالإنترنت. يمكنك تصفح المحتوى المحفوظ، لكن الطلبات وتسجيل الدخول تحتاج اتصالاً.');return}
    if(window.__ALIN_CDN_ERROR__ || typeof window.supabase==='undefined'){
      show('تعذر تحميل خدمة الاتصال بقاعدة البيانات. حدّث الصفحة أو تحقق من الإنترنت.');return
    }
    hide();
  }
  addEventListener('online',()=>setTimeout(check,300));
  addEventListener('offline',check);
  addEventListener('load',()=>setTimeout(check,1200));
  window.AlinHealth=Object.freeze({check,show,hide});
})();
