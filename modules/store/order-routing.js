// === modules/store/order-routing.js ===
/* ALIN v2.6.0 Stage 3 — checkout routing intent only. Prices, fees and payment state are server-owned. */
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const value=id=>String($(id)?.value||'').trim();
  const num=input=>Number(input||0);
  const same=(a,b)=>String(a??'')===String(b??'');
  let pending=false;

  function cartRows(){return Array.isArray(window.cart)?window.cart:[]}
  function hasProducts(){return cartRows().some(line=>line.kind!=='booklet')}
  function activeLibraries(){return window.db?.accounts?.libraries||[]}
  function libraryOpen(id){
    const library=activeLibraries().find(item=>same(item.id,id));if(!library)return false;
    try{return typeof window.libIsOpen==='function'?!!window.libIsOpen(library):!(library.is_open===false||String(library.is_open)==='false'||library.open_status==='closed')}catch(_){return true}
  }
  function fulfillmentType(){return document.querySelector('#checkoutBox input[name="fulfillment"]:checked')?.value||(hasProducts()?'home_delivery':'pickup')}

  // هذه الدالة ترسل نية الاستلام فقط. الخادم يعيد التحقق من المكتبة والمنطقة ويحسب الأجرة.
  function alinOrderExtra(){
    const type=hasProducts()?'home_delivery':fulfillmentType();
    if(type==='pickup'){
      const libraryId=value('libSelect');
      if(!libraryId)throw new Error('اختر مكتبة الاستلام');
      if(!libraryOpen(libraryId))throw new Error('المكتبة المختارة مغلقة حالياً');
      return {fulfillment_type:'pickup',library_id:libraryId,pickup_library_id:libraryId};
    }
    const area=value('deliveryArea'),landmark=value('deliveryLandmark');
    const latitude=value('deliveryLatitude'),longitude=value('deliveryLongitude'),accuracy=value('deliveryLocationAccuracy');
    if(!area)throw new Error('اختر منطقة التوصيل من القائمة');
    if(!landmark&&!latitude)throw new Error('حدد الموقع أو اكتب أقرب نقطة دالة');
    return {
      fulfillment_type:'home_delivery',
      delivery_area:area,
      delivery_landmark:landmark,
      delivery_latitude:latitude?num(latitude):null,
      delivery_longitude:longitude?num(longitude):null,
      delivery_location_accuracy:accuracy?Math.round(num(accuracy)):null
    };
  }

  function emitCreated(numbers,fulfillment,items=[]){document.dispatchEvent(new CustomEvent('alin:order-created',{detail:{numbers,fulfillment,items}}))}

  // لا يوجد إدخال مباشر احتياطي إلى orders. هذا مقصود حتى لا يمكن تجاوز التسعير الآمن.
  async function createFallback(){
    throw new Error('خدمة إنشاء الطلب الآمنة غير جاهزة. حدّث الصفحة وحاول مرة أخرى');
  }

  async function confirmCartCheckout(){
    if(pending)return;
    const button=document.querySelector('#checkoutBox .alin-cart-submit');const oldText=button?.textContent;
    try{
      pending=true;if(button){button.disabled=true;button.textContent='جاري إنشاء الطلب...'}
      if(typeof window.ALINAuth?.secureCheckout!=='function')return await createFallback();
      return await window.ALINAuth.secureCheckout();
    }catch(error){
      const box=$('alinCartError')||document.createElement('div');box.id='alinCartError';box.className='notice';box.textContent=error?.message||'تعذر إنشاء الطلب';document.querySelector('#checkoutBox .alin-cart-side')?.prepend(box);throw error;
    }finally{pending=false;if(button){button.disabled=false;button.textContent=oldText||'تأكيد الطلب الآن'}}
  }

  Object.assign(window,{alinOrderExtra,confirmCartCheckout,confirmCheckout:confirmCartCheckout,alinConfirmRoutedCart:confirmCartCheckout,alinLegacyCreateOrder:createFallback,alinEmitOrderCreated:emitCreated});
})();
