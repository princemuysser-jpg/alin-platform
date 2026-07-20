// === modules/store/order-routing.js ===
/* ALIN v2.1.3 — authoritative checkout routing and order creation. */
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
  function deliveryCost(){try{return typeof window.deliveryFee==='function'?num(window.deliveryFee()):num(window.db?.settings?.delivery_fee)}catch(_){return 0}}

  function alinOrderExtra(){
    const type=hasProducts()?'home_delivery':fulfillmentType();
    if(type==='pickup'){
      const libraryId=value('libSelect');
      if(!libraryId)throw new Error('اختر مكتبة الاستلام');
      if(!libraryOpen(libraryId))throw new Error('المكتبة المختارة مغلقة حالياً');
      return {fulfillment_type:'pickup',delivery_type:'library',library_id:libraryId,pickup_library_id:libraryId,courier_id:null,delegate_id:null,delivery_area:null,delivery_address:null,delivery_landmark:null,delivery_fee:0,payment_method:'cash_at_library',payment_status:'cod_pending'};
    }
    const area=value('deliveryArea'),address=value('deliveryAddress'),landmark=value('deliveryLandmark');
    const latitude=value('deliveryLatitude'),longitude=value('deliveryLongitude'),locationUrl=value('deliveryLocationUrl'),accuracy=value('deliveryLocationAccuracy');
    if(!area||!address)throw new Error('اختر المنطقة وأكمل العنوان الكامل');
    if(!landmark&&!latitude)throw new Error('حدد موقع GPS أو اكتب أقرب نقطة دالة بوضوح');
    return {fulfillment_type:'home_delivery',delivery_type:'courier',library_id:null,pickup_library_id:null,courier_id:null,delegate_id:null,delivery_area:area,delivery_address:address,delivery_landmark:landmark,delivery_latitude:latitude?num(latitude):null,delivery_longitude:longitude?num(longitude):null,delivery_location_url:locationUrl||null,delivery_location_accuracy:accuracy?Math.round(num(accuracy)):null,delivery_location_source:latitude?'student_device':'manual_address',delivery_fee:deliveryCost(),payment_method:'cash_to_courier',payment_status:'cod_pending',assignment_status:'pending_admin'};
  }

  function orderNumber(){return 'AL-'+Date.now().toString().slice(-8)+'-'+Math.floor(Math.random()*90+10)}
  async function insertCompatible(payload){
    try{return await window.insert('orders',payload)}catch(error){
      const message=String(error?.message||'').toLowerCase();
      if(!(message.includes('column')||message.includes('schema')||message.includes('cache')))throw error;
      const fallback={id:payload.id,order_number:payload.order_number,kind:payload.kind,item_id:payload.item_id,title:payload.title,student_name:payload.student_name,student_phone:payload.student_phone,library_id:payload.library_id,courier_id:payload.courier_id,qty:payload.qty,unit_price:payload.unit_price,total:payload.total,discount:payload.discount||0,coupon_code:payload.coupon_code||null,status:payload.status,payment_status:payload.payment_status};
      return window.insert('orders',fallback);
    }
  }

  function emitCreated(numbers,fulfillment,items=[]){document.dispatchEvent(new CustomEvent('alin:order-created',{detail:{numbers,fulfillment,items}}))}

  async function createFallback(){
    const basket=cartRows();if(!basket.length)throw new Error('السلة فارغة');
    const snapshot=basket.map(item=>({...item}));
    const name=value('studentName'),phone=value('studentPhone');if(!name||!phone)throw new Error('أكمل اسم الطالب ورقم الهاتف');
    const route=alinOrderExtra();
    const coupon=window.AlinCoupons?.getApplied?.()||(typeof window.validCoupon==='function'?window.validCoupon(value('couponInput')):null);
    const numbers=[];let deliveryAdded=false;
    for(const line of basket){
      const product=line.kind==='booklet'?null:(window.db?.products||[]).find(item=>same(item.id,line.id));
      const qty=Math.max(1,num(line.qty));if(product&&num(product.stock)<qty)throw new Error('الكمية غير متوفرة: '+line.title);
      const raw=num(line.price)*qty;
      const discount=coupon?(coupon.discount_type==='fixed'?Math.min(raw,num(coupon.discount_value)):Math.round(raw*(num(coupon.discount_value)/100))):0;
      const extra={...route};if(extra.fulfillment_type==='home_delivery'){extra.delivery_fee=deliveryAdded?0:route.delivery_fee;deliveryAdded=true}
      const payload={id:(typeof uid==='function'?uid('O'):'O'+Date.now()+Math.random().toString(16).slice(2)),order_number:orderNumber(),kind:line.kind,item_id:line.id,title:line.title,student_name:name,student_phone:phone,qty,unit_price:num(line.price),total:raw-discount+num(extra.delivery_fee),discount,coupon_code:coupon?.code||null,status:'new',status_history:[{status:'new',at:new Date().toISOString()}],...extra};
      const saved=await insertCompatible(payload);numbers.push(String(saved?.order_number||payload.order_number));
    }
    if(coupon){try{await window.update('coupons',{used_count:num(coupon.used_count)+1},{id:coupon.id})}catch(_){}}
    try{await window.audit('order',route.fulfillment_type==='pickup'?'إنشاء طلب وربطه بالمكتبة':'إنشاء طلب وربطه بالمندوب')}catch(_){}
    window.cart.splice(0,window.cart.length);window.cartSave?.();try{sessionStorage.removeItem('alin_v162_checkout_gps')}catch(_){}
    try{await window.load?.()}catch(_){}
    const box=window.checkoutBox||$('checkoutBox');
    if(box)box.innerHTML=`<div class="alin-cart-success"><h2>تم إنشاء الطلب بنجاح</h2><p>${route.fulfillment_type==='pickup'?'وصل الطلب إلى المكتبة المختارة.':'تم إرسال الطلب إلى قسم التوصيل.'}</p><div class="alin-order-numbers">${numbers.map(number=>`<b>${number}</b>`).join('')}</div><button onclick="closeCheckout()">إغلاق</button></div>`;
    emitCreated(numbers,route.fulfillment_type,snapshot);
    return numbers;
  }

  async function confirmCartCheckout(){
    if(pending)return;
    const button=document.querySelector('#checkoutBox .alin-cart-submit');const oldText=button?.textContent;
    try{
      pending=true;if(button){button.disabled=true;button.textContent='جاري إنشاء الطلب...'}
      if(window.ALINAuth?.secureCheckout)return await window.ALINAuth.secureCheckout();
      return await createFallback();
    }catch(error){
      const box=$('alinCartError')||document.createElement('div');box.id='alinCartError';box.className='notice';box.textContent=error?.message||'تعذر إنشاء الطلب';document.querySelector('#checkoutBox .alin-cart-side')?.prepend(box);throw error;
    }finally{pending=false;if(button){button.disabled=false;button.textContent=oldText||'تأكيد الطلب الآن'}}
  }

  Object.assign(window,{alinOrderExtra,confirmCartCheckout,confirmCheckout:confirmCartCheckout,alinConfirmRoutedCart:confirmCartCheckout,alinLegacyCreateOrder:createFallback});
})();
