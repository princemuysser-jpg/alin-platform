/* ===== store/js/order-routing-v112.js ===== */
/* V113: reliable cart routing to library/courier */
(function(){
  const el=id=>document.getElementById(id);
  const val=id=>(el(id)?.value||'').trim();
  const num=v=>Number(v||0);
  const arr=v=>Array.isArray(v)?v:[];
  const eq=(a,b)=>String(a??'')===String(b??'');
  const orderNo=()=> 'AL-'+Date.now().toString().slice(-8)+'-'+Math.floor(Math.random()*90+10);
  function items(){ return typeof cart!=='undefined'&&Array.isArray(cart)?cart:[]; }
  function hasProducts(){ return items().some(x=>x.kind!=='booklet'); }
  function fulfillment(){ return document.querySelector('#checkoutBox input[name="fulfillment"]:checked')?.value||(hasProducts()?'home_delivery':'pickup'); }
  function libraryOpen(id){
    const lib=arr(window.db?.accounts?.libraries).find(x=>eq(x.id,id));
    if(!lib)return false;
    try{return typeof libIsOpen==='function'?!!libIsOpen(lib):!(lib.is_open===false||String(lib.is_open)==='false'||lib.open_status==='closed')}catch(_){return true}
  }
  function route(){
    const type=fulfillment();
    if(type==='pickup'){
      const libraryId=val('libSelect');
      if(!libraryId) throw new Error('اختر مكتبة الاستلام');
      if(!libraryOpen(libraryId)) throw new Error('المكتبة المختارة مغلقة حالياً');
      return {fulfillment_type:'pickup',delivery_type:'library',library_id:libraryId,pickup_library_id:libraryId,courier_id:null,delegate_id:null,delivery_area:null,delivery_address:null,delivery_landmark:null,delivery_fee:0,payment_method:'cash_at_library',payment_status:'cod_pending'};
    }
    const area=val('deliveryArea'), address=val('deliveryAddress'), landmark=val('deliveryLandmark');
    const latitude=val('deliveryLatitude'),longitude=val('deliveryLongitude'),locationUrl=val('deliveryLocationUrl'),locationAccuracy=val('deliveryLocationAccuracy');
    if(!area||!address) throw new Error('اختر المنطقة وأكمل العنوان الكامل');
    if(!landmark&&!latitude) throw new Error('حدد موقع GPS أو اكتب أقرب نقطة دالة بوضوح');
    let fee=0;try{if(typeof deliveryFee==='function')fee=num(deliveryFee())}catch(_){}
    return {fulfillment_type:'home_delivery',delivery_type:'courier',library_id:null,pickup_library_id:null,courier_id:null,delegate_id:null,delivery_area:area,delivery_address:address,delivery_landmark:landmark,delivery_latitude:latitude?num(latitude):null,delivery_longitude:longitude?num(longitude):null,delivery_location_url:locationUrl||null,delivery_location_accuracy:locationAccuracy?Math.round(num(locationAccuracy)):null,delivery_location_source:latitude?'student_device':'manual_address',delivery_fee:fee,payment_method:'cash_to_courier',payment_status:'cod_pending',assignment_status:'pending_admin'};
  }
  async function insertCompatible(payload){
    try{return await insert('orders',payload)}catch(e){
      const msg=String(e?.message||'').toLowerCase();
      if(!(msg.includes('column')||msg.includes('schema')||msg.includes('cache')))throw e;
      const fallback={id:payload.id,order_number:payload.order_number,kind:payload.kind,item_id:payload.item_id,title:payload.title,student_name:payload.student_name,student_phone:payload.student_phone,library_id:payload.library_id,courier_id:payload.courier_id,qty:payload.qty,unit_price:payload.unit_price,total:payload.total,discount:payload.discount||0,coupon_code:payload.coupon_code||null,status:payload.status,payment_status:payload.payment_status};
      return await insert('orders',fallback);
    }
  }
  async function create(){
    const submit=document.querySelector('#checkoutBox .alin-cart-submit');
    const oldText=submit?.textContent;
    try{
      if(submit){submit.disabled=true;submit.textContent='جاري إنشاء الطلب...'}
      const basket=items();
      if(!basket.length)throw new Error('السلة فارغة');
      const name=val('studentName'),phone=val('studentPhone');
      if(!name||!phone)throw new Error('أكمل اسم الطالب ورقم الهاتف');
      const routing=route(),coupon=typeof validCoupon==='function'?validCoupon(val('couponInput')):null,numbers=[];
      let deliveryAdded=false;
      for(const item of basket){
        const product=item.kind==='booklet'?null:arr(window.db?.products).find(p=>eq(p.id,item.id));
        const qty=Math.max(1,num(item.qty));
        if(product&&num(product.stock)<qty)throw new Error('الكمية غير متوفرة: '+item.title);
        const raw=num(item.price)*qty;
        let discount=0;if(coupon)discount=coupon.discount_type==='fixed'?Math.min(raw,num(coupon.discount_value)):Math.round(raw*(num(coupon.discount_value)/100));
        const extra={...routing};if(extra.fulfillment_type==='home_delivery'){extra.delivery_fee=deliveryAdded?0:routing.delivery_fee;deliveryAdded=true}
        const payload={id:uid('O'),order_number:orderNo(),kind:item.kind,item_id:item.id,title:item.title,student_name:name,student_phone:phone,qty,unit_price:num(item.price),total:raw-discount+num(extra.delivery_fee),discount,coupon_code:coupon?.code||null,status:'new',status_history:[{status:'new',at:new Date().toISOString()}],...extra};
        const saved=await insertCompatible(payload);numbers.push(saved?.order_number||payload.order_number);
      }
      if(coupon){try{await update('coupons',{used_count:num(coupon.used_count)+1},{id:coupon.id})}catch(_){}}
      try{await audit('order',routing.fulfillment_type==='pickup'?'إنشاء طلب وربطه بالمكتبة':'إنشاء طلب وربطه بالمندوب')}catch(_){}
      basket.splice(0,basket.length);if(typeof cartSave==='function')cartSave();try{sessionStorage.removeItem('alin_v162_checkout_gps')}catch(_){}
      try{await load()}catch(_){}
      if(window.current?.role==='library'&&typeof renderLibrary==='function')renderLibrary();
      checkoutBox.innerHTML=`<div class="alin-cart-success"><h2>تم إنشاء الطلب بنجاح</h2><p>${routing.fulfillment_type==='pickup'?'وصل الطلب إلى المكتبة المختارة.':'تم إرسال الطلب إلى قسم التوصيل.'}</p><div class="alin-order-numbers">${numbers.map(n=>`<b>${n}</b>`).join('')}</div><button onclick="closeCheckout()">إغلاق</button></div>`;
      if(typeof renderCartBadge==='function')renderCartBadge();
    }catch(e){
      const box=document.getElementById('alinCartError')||document.createElement('div');box.id='alinCartError';box.className='notice';box.textContent=e.message||'تعذر إنشاء الطلب';document.querySelector('#checkoutBox .alin-cart-side')?.prepend(box);
    }finally{if(submit){submit.disabled=false;submit.textContent=oldText||'تأكيد الطلب الآن'}}
  }
  window.confirmCartCheckout=create;window.alinConfirmRoutedCart=create;
  document.addEventListener('click',e=>{const b=e.target.closest('.alin-cart-submit');if(!b)return;e.preventDefault();e.stopImmediatePropagation();create()},true);
})();

