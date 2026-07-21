// === core/ui.js ===
/* ALIN v2.3.1 — authoritative shared UI helpers. */
(function(){
  'use strict';

  const escapeHtml=value=>String(value??'').replace(/[&<>'"]/g,char=>({
    '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
  }[char]));
  const formatMoney=value=>(Number(value)||0).toLocaleString('ar-IQ');
  const createId=(prefix='ID')=>`${prefix}${Math.random().toString(16).slice(2,10)}${Date.now().toString(16).slice(-6)}`;

  function emptyState(text){return `<div class="empty">${escapeHtml(text)}</div>`}
  function toast(text,options={}){
    const old=document.querySelector('.toast');
    if(old)old.remove();
    const element=document.createElement('div');
    element.className=`toast${options.kind?` ${options.kind}`:''}`;
    element.textContent=String(text||'');
    document.body.appendChild(element);
    setTimeout(()=>element.remove(),Number(options.duration)||2200);
    return element;
  }
  async function copyText(text){
    const value=String(text??'');
    try{
      if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(value);toast('تم النسخ');return true}
      const area=document.createElement('textarea');area.value=value;area.style.position='fixed';area.style.opacity='0';document.body.appendChild(area);area.select();const ok=document.execCommand('copy');area.remove();if(ok){toast('تم النسخ');return true}
    }catch(error){console.warn('[ALIN copy]',error)}
    alert(value);return false;
  }

  Object.assign(window,{
    esc:escapeHtml,
    money:formatMoney,
    uid:createId,
    emptyState,
    toast,
    copyText
  });
  window.AlinUI=Object.freeze({escapeHtml,formatMoney,createId,emptyState,toast,copyText});
})();

;
