// === core/features.js ===
/* ALIN v2.2.6 — shared non-store helpers only. Store favorites, banners and notifications have dedicated owners. */
(function(){
  'use strict';

  window.alin98WhatsAppOrder=function(orderId){
    const order=(window.db?.orders||[]).find(row=>String(row.id)===String(orderId));
    if(!order)return alert('الطلب غير موجود');
    const library=(window.db?.accounts?.libraries||[]).find(row=>String(row.id)===String(order.library_id));
    const phone=String(library?.whatsapp||library?.phone||window.db?.settings?.whatsapp||'').replace(/\D/g,'');
    if(!phone)return alert('رقم واتساب غير محدد');
    const message=encodeURIComponent(`السلام عليكم، بخصوص طلبي في منصة آلين\nرقم الطلب: ${order.order_number||order.id}\nالطلب: ${order.title||''}`);
    window.open(`https://wa.me/${phone}?text=${message}`,'_blank','noopener');
  };

  function bindBottomNavigation(){
    document.querySelectorAll('.alin98-bottom button').forEach(button=>{
      if(button.dataset.alinFeatureBound==='1')return;
      button.dataset.alinFeatureBound='1';
      button.addEventListener('click',()=>{
        document.querySelectorAll('.alin98-bottom button').forEach(item=>item.classList.remove('active'));
        button.classList.add('active');
      });
    });
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bindBottomNavigation,{once:true});
  else bindBottomNavigation();
})();
