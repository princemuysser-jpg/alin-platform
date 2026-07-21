// === modules/store/cart.js ===
/* ALIN v2.1.8 — authoritative cart module. Delivery uses area + landmark + GPS only. */
(function(){
  'use strict';

  const STORAGE_KEY='ALIN_CART';
  const aliases={booklet:'booklet',booklets:'booklet','ملزمة':'booklet','ملازم':'booklet',product:'product',products:'product',stationery:'product',stationary:'product',gift:'product',gifts:'product',deal:'product',booklet_product:'product'};
  const $=id=>document.getElementById(id);
  const num=value=>Number(value||0);
  const escText=value=>typeof window.esc==='function'?window.esc(value):String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const formatMoney=value=>typeof window.money==='function'?window.money(value):num(value).toLocaleString('ar-IQ');
  const same=(a,b)=>String(a??'')===String(b??'');

  function readStoredCart(){
    try{
      const rows=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');
      return Array.isArray(rows)?rows:[];
    }catch(_){return []}
  }

  if(!Array.isArray(window.cart))window.cart=readStoredCart();

  function rows(){return Array.isArray(window.cart)?window.cart:(window.cart=[])}
  function booklets(){return Array.isArray(window.db?.booklets)?window.db.booklets:[]}
  function products(){return Array.isArray(window.db?.products)?window.db.products:[]}
  function findBooklet(id){return booklets().find(item=>same(item.id,id))||null}
  function findProduct(id){return products().find(item=>same(item.id,id))||null}

  function normalizeKindAndId(kind,id){
    let rawKind=String(kind??'').trim().toLowerCase();
    let rawId=String(id??'').trim();
    let booklet=findBooklet(rawId),product=findProduct(rawId);
    if(!booklet&&!product&&rawKind){
      const swappedBooklet=findBooklet(rawKind),swappedProduct=findProduct(rawKind);
      if(swappedBooklet||swappedProduct){rawId=rawKind;rawKind=String(id??'').trim().toLowerCase();booklet=swappedBooklet;product=swappedProduct}
    }
    return {kind:booklet?'booklet':product?'product':aliases[rawKind]||'',id:rawId,item:booklet||product};
  }

  function normalizeLine(line,index=0){
    const normalized=normalizeKindAndId(line?.kind,line?.id);
    if(!normalized.kind||!normalized.id)return null;
    const source=normalized.item;
    return {
      kind:normalized.kind,
      id:normalized.id,
      title:String(source?.title||source?.name||line?.title||`العنصر ${index+1}`),
      price:num(source?.price??line?.price),
      qty:Math.max(1,Math.min(100,Math.floor(num(line?.qty)||1)))
    };
  }

  function normalizeCart(){
    const normalized=rows().map(normalizeLine).filter(Boolean);
    window.cart=normalized;
    return normalized;
  }

  function imageFor(item){
    const path=item?.cover_path||item?.image_path||item?.image||item?.image_url||item?.cover_url||item?.thumbnail||'';
    if(!path)return '';
    try{return typeof window.mediaUrl==='function'?window.mediaUrl(path):path}catch(_){return path}
  }

  function cartCount(){return rows().reduce((sum,line)=>sum+Math.max(1,num(line.qty)),0)}
  function cartTotal(){return rows().reduce((sum,line)=>sum+num(line.price)*Math.max(1,num(line.qty)),0)}
  function appliedCoupon(){return window.AlinCoupons?.getApplied?.()||null}
  function cartPricing(){
    const subtotal=cartTotal();
    const coupon=appliedCoupon();
    const discount=typeof window.AlinCoupons?.calculateCartDiscount==='function'
      ? window.AlinCoupons.calculateCartDiscount(coupon,rows())
      : rows().reduce((sum,line)=>sum+(typeof window.calculateCouponDiscount==='function'?window.calculateCouponDiscount(coupon,num(line.price)*Math.max(1,num(line.qty))):0),0);
    return {subtotal,discount:Math.min(subtotal,Math.max(0,num(discount))),total:Math.max(0,subtotal-Math.max(0,num(discount))),coupon};
  }
  function hasProducts(){return rows().some(line=>line.kind!=='booklet')}
  function activeLibraries(){return (window.db?.accounts?.libraries||[]).filter(item=>item.status==='active')}
  function libraryOpen(library){
    try{return typeof window.libIsOpen==='function'?!!window.libIsOpen(library):!(library?.is_open===false||String(library?.is_open)==='false'||library?.open_status==='closed')}catch(_){return true}
  }
  function libraryOptions(){
    return activeLibraries().map(library=>`<option value="${escText(library.id)}" ${libraryOpen(library)?'':'disabled'}>${escText(library.name||'مكتبة')} — ${libraryOpen(library)?'مفتوح':'مغلق'}${library.area?` — ${escText(library.area)}`:''}</option>`).join('');
  }
  function courierOptions(){
    try{
      const list=typeof window.activeCouriers==='function'?window.activeCouriers():[];
      return (Array.isArray(list)?list:[]).map(courier=>`<option value="${escText(courier.id)}">${escText(courier.name||'مندوب')}${courier.area?` — ${escText(courier.area)}`:''}</option>`).join('');
    }catch(_){return ''}
  }

  function deliveryAreaNames(){
    const cloud=window.db?.deliveryAreas||window.db?.delivery_areas||[];
    const fallback=Array.isArray(window.ALIN_KIRKUK_AREAS)?window.ALIN_KIRKUK_AREAS:[];
    return [...new Set((cloud.length?cloud.map(row=>row?.name):fallback).map(name=>String(name||'').trim()).filter(Boolean))];
  }
  function deliveryAreaOptions(){
    return `<option value="">اختر منطقة التوصيل</option>`+deliveryAreaNames().map(name=>`<option value="${escText(name)}">${escText(name)}</option>`).join('');
  }

  function dispatch(name,detail={}){document.dispatchEvent(new CustomEvent(name,{detail}))}

  function renderCartBadge(){
    const count=cartCount(),pricing=cartPricing();
    const ids=['cartCount','cartCountFab','desktopCartCount','mobileCartCount','mobileBottomCartCount'];
    ids.forEach(id=>{const element=$(id);if(!element)return;element.textContent=String(count);if('hidden'in element)element.hidden=!count});
    const summary=$('cartSummary');if(summary)summary.textContent=count?`${count} مادة في السلة`:'';
    dispatch('alin:cart-changed',{count,total:pricing.total,subtotal:pricing.subtotal,discount:pricing.discount,items:rows().map(item=>({...item}))});
    return count;
  }

  function cartSave(){
    normalizeCart();
    localStorage.setItem(STORAGE_KEY,JSON.stringify(rows()));
    if(!rows().length&&window.AlinCoupons?.getAppliedCode?.())window.AlinCoupons.clear();
    renderCartBadge();
  }

  function addToCart(kind,id,qty=1){
    const normalized=normalizeKindAndId(kind,id);
    if(!normalized.item){
      if(typeof window.toast==='function')window.toast('تعذر العثور على المادة في المتجر');
      return false;
    }
    const amount=Math.max(1,Math.min(100,Math.floor(num(qty)||1)));
    if(normalized.kind==='product'&&num(normalized.item.stock)<=0){alert('المنتج نافد');return false}
    const current=rows().find(line=>line.kind===normalized.kind&&same(line.id,normalized.id));
    const nextQty=(current?.qty||0)+amount;
    if(normalized.kind==='product'&&num(normalized.item.stock)<nextQty){alert('الكمية المطلوبة غير متوفرة');return false}
    if(current){current.qty=nextQty;current.title=normalized.item.title||normalized.item.name||current.title;current.price=num(normalized.item.price)}
    else rows().push({kind:normalized.kind,id:normalized.id,title:normalized.item.title||normalized.item.name||'مادة',price:num(normalized.item.price),qty:amount});
    cartSave();
    if(typeof window.toast==='function')window.toast('تمت الإضافة إلى السلة');
    return true;
  }

  function cartQty(index,delta){
    const line=rows()[index];if(!line)return;
    const next=Math.max(1,Math.min(100,num(line.qty)+num(delta)));
    const source=line.kind==='booklet'?findBooklet(line.id):findProduct(line.id);
    if(line.kind==='product'&&source&&num(source.stock)<next){alert('الكمية المطلوبة غير متوفرة');return}
    line.qty=next;cartSave();openCart({kind:line.kind,id:line.id});
  }

  function cartRemove(index){
    if(!rows()[index])return;
    rows().splice(index,1);cartSave();openCart();
  }

  function fulfillmentHtml(){
    if(hasProducts()){
      return `<section class="alin-fulfillment"><h4>طريقة الاستلام والدفع</h4><div class="alin-delivery-options"><label class="selected"><input type="radio" name="fulfillment" value="home_delivery" checked><span><b>توصيل للبيت</b><small>القرطاسية والهدايا تُسلّم عن طريق المندوب</small></span></label></div><div id="deliveryFields" class="alin-delivery-fields"><div class="form-grid"><select id="deliveryArea" required>${deliveryAreaOptions()}</select><input id="deliveryLandmark" placeholder="أقرب نقطة دالة" required><select id="courierSelect"><option value="">تحديد المندوب من الإدارة</option>${courierOptions()}</select></div></div></section>`;
    }
    return `<section class="alin-fulfillment"><h4>طريقة الاستلام والدفع</h4><div class="alin-delivery-options"><label class="selected"><input type="radio" name="fulfillment" value="pickup" checked onchange="toggleDeliveryFields()"><span><b>استلام من المكتبة</b><small>الدفع عند الاستلام</small></span></label><label><input type="radio" name="fulfillment" value="home_delivery" onchange="toggleDeliveryFields()"><span><b>توصيل للبيت</b><small>الدفع للمندوب</small></span></label></div><div id="pickupFields" class="alin-pickup-fields"><select id="libSelect" onchange="showLibInfo()"><option value="">اختر مكتبة الاستلام</option>${libraryOptions()}</select><div id="libInfo"></div></div><div id="deliveryFields" class="alin-delivery-fields hidden"><div class="form-grid"><select id="deliveryArea" required>${deliveryAreaOptions()}</select><input id="deliveryLandmark" placeholder="أقرب نقطة دالة" required><select id="courierSelect"><option value="">تحديد المندوب من الإدارة</option>${courierOptions()}</select></div></div></section>`;
  }

  function showLibInfo(){
    const select=$('libSelect'),box=$('libInfo');if(!select||!box)return;
    const library=activeLibraries().find(item=>same(item.id,select.value));
    if(!library){box.replaceChildren();return}
    box.innerHTML=`<div class="alin-library-status"><div><b>${escText(library.name||'مكتبة')}</b><small>${escText([library.area,library.landmark].filter(Boolean).join(' — '))}</small></div><span class="${libraryOpen(library)?'is-open':'is-closed'}">${libraryOpen(library)?'مفتوح':'مغلق'}</span></div>`;
  }

  function toggleDeliveryFields(){
    const fulfillment=document.querySelector('#checkoutBox input[name="fulfillment"]:checked')?.value||(hasProducts()?'home_delivery':'pickup');
    const pickup=$('pickupFields'),delivery=$('deliveryFields');
    if(pickup)pickup.classList.toggle('hidden',fulfillment!=='pickup');
    if(delivery)delivery.classList.toggle('hidden',fulfillment!=='home_delivery');
    document.querySelectorAll('#checkoutBox .alin-delivery-options label').forEach(label=>label.classList.toggle('selected',!!label.querySelector('input:checked')));
    dispatch('alin:fulfillment-changed',{fulfillment});
  }

  function itemIcon(kind){return kind==='booklet'?'📘':'🛍️'}

  function renderCartPricing(){
    const pricing=cartPricing();
    const subtotalElement=$('cartSubtotalValue');
    const discountElement=$('cartDiscountValue');
    const discountRow=$('cartDiscountRow');
    const finalElement=$('cartFinalValue');
    const input=$('couponInput');
    const message=$('couponMsg');
    if(subtotalElement)subtotalElement.textContent=`${formatMoney(pricing.subtotal)} د.ع`;
    if(discountElement)discountElement.textContent=`− ${formatMoney(pricing.discount)} د.ع`;
    if(discountRow)discountRow.hidden=pricing.discount<=0;
    if(finalElement)finalElement.textContent=`${formatMoney(pricing.total)} د.ع`;
    if(input&&pricing.coupon&&!input.value)input.value=pricing.coupon.code||'';
    if(message&&pricing.coupon&&pricing.discount>0&&!message.textContent){
      message.textContent=`تم تطبيق كوبون ${pricing.coupon.code} — الخصم ${formatMoney(pricing.discount)} د.ع`;
    }
    dispatch('alin:cart-pricing',{subtotal:pricing.subtotal,discount:pricing.discount,total:pricing.total,coupon:pricing.coupon});
    return pricing;
  }

  function openCart(context={}){
    normalizeCart();
    const box=window.checkoutBox||$('checkoutBox'),modal=window.checkoutModal||$('checkoutModal');
    if(!box||!modal)return;
    window.checkoutItem={kind:'cart'};
    const list=rows(),count=cartCount(),pricing=cartPricing(),total=pricing.subtotal;
    if(!list.length){
      box.innerHTML='<div class="alin-cart-shell"><div class="alin-cart-main"><div class="alin-cart-empty"><div class="alin-empty-icon">🛒</div><h3>السلة فارغة حالياً</h3><p>أضف ملازم أو قرطاسية أو هدايا ثم ارجع لإتمام الطلب.</p><button type="button" onclick="closeCheckout();document.getElementById(\'storeGrid\')?.scrollIntoView({behavior:\'smooth\'})">تصفح المتجر</button></div></div><aside class="alin-cart-side"><h3>ملخص الطلب</h3><div class="alin-summary-card"><div class="alin-summary-rows"><div><span>عدد المواد</span><b>0</b></div><div><span>الإجمالي</span><b>0 د.ع</b></div></div></div></aside></div>';
    }else{
      const itemsHtml=list.map((line,index)=>{
        const source=line.kind==='booklet'?findBooklet(line.id):findProduct(line.id),image=imageFor(source),lineTotal=num(line.price)*num(line.qty);
        return `<article class="alin-cart-item"><div class="alin-cart-thumb">${image?`<img src="${escText(image)}" alt="${escText(line.title)}">`:`<span>${itemIcon(line.kind)}</span>`}</div><div class="alin-cart-info"><h3 class="alin-cart-title">${escText(line.title)}</h3><div class="alin-cart-meta"><span class="alin-cart-chip">${line.kind==='booklet'?'ملزمة':'منتج'}</span><span class="alin-cart-chip">سعر القطعة: ${formatMoney(line.price)} د.ع</span></div><div class="alin-cart-price">${formatMoney(lineTotal)} د.ع</div></div><div class="alin-cart-controls"><div class="alin-qty-box"><button type="button" aria-label="تقليل الكمية" onclick="cartQty(${index},-1)">−</button><b>${line.qty}</b><button type="button" aria-label="زيادة الكمية" onclick="cartQty(${index},1)">+</button></div><button type="button" class="alin-remove-btn" onclick="cartRemove(${index})">حذف من السلة</button></div></article>`;
      }).join('');
      box.innerHTML=`<div class="alin-cart-shell"><section class="alin-cart-main"><div class="alin-cart-head"><div><h2>سلة آلين</h2><p>راجع المواد والكميات قبل تأكيد الطلب.</p></div><span class="alin-cart-badge">${count}</span></div><div class="alin-cart-list">${itemsHtml}</div></section><aside class="alin-cart-side"><h3>ملخص الطلب</h3><div class="alin-summary-card"><div class="alin-summary-rows"><div><span>عدد المواد</span><b>${count}</b></div><div><span>المجموع الفرعي</span><b id="cartSubtotalValue">${formatMoney(pricing.subtotal)} د.ع</b></div><div id="cartDiscountRow" ${pricing.discount>0?'':'hidden'}><span>خصم الكوبون</span><b id="cartDiscountValue">− ${formatMoney(pricing.discount)} د.ع</b></div></div><div class="alin-summary-total"><div>الإجمالي النهائي</div><b id="cartFinalValue">${formatMoney(pricing.total)} د.ع</b></div><div class="coupon-box"><input id="couponInput" value="${escText(pricing.coupon?.code||'')}" placeholder="أدخل كود الخصم"><button type="button" onclick="checkCoupon()">تطبيق</button></div><div id="couponMsg">${pricing.coupon&&pricing.discount>0?`تم تطبيق كوبون ${escText(pricing.coupon.code)} — الخصم ${formatMoney(pricing.discount)} د.ع`:''}</div><div class="alin-cart-form"><h4>بيانات الطالب والاستلام</h4><div class="form-grid"><input id="studentName" placeholder="اسم الطالب الكامل"><input id="studentPhone" placeholder="رقم الهاتف"></div>${fulfillmentHtml()}</div><button type="button" class="alin-cart-submit" onclick="confirmCartCheckout()">تأكيد الطلب الآن</button></div></aside></div>`;
    }
    modal.classList.remove('hidden');
    const close=modal.querySelector('.x');if(close){close.textContent='إغلاق';close.setAttribute('aria-label','إغلاق السلة')}
    setTimeout(()=>{toggleDeliveryFields();showLibInfo();renderCartPricing();dispatch('alin:cart-rendered',{kind:context.kind||'',id:context.id||'',count,subtotal:pricing.subtotal,discount:pricing.discount,total:pricing.total})},0);
  }

  function openCheckout(kind,id){
    const normalized=normalizeKindAndId(kind,id);
    if(!normalized.item)return alert('المادة غير موجودة');
    const pause=String(window.db?.settings?.order_pause_scope||'');
    const itemScope=String(normalized.item.type||normalized.item.category||'');
    if(pause&&(pause==='all'||pause===normalized.kind||pause===itemScope))return alert(window.db?.settings?.order_pause_reason||'الطلبات متوقفة مؤقتاً');
    if(addToCart(normalized.kind,normalized.id))openCart({kind:normalized.kind,id:normalized.id});
  }

  function closeCheckout(){
    const modal=window.checkoutModal||$('checkoutModal');if(modal)modal.classList.add('hidden');
    window.checkoutItem=null;
    const close=modal?.querySelector('.x');if(close){close.textContent='×';close.setAttribute('aria-label','إغلاق')}
    dispatch('alin:cart-closed');
  }

  function updateTotal(){return renderCartPricing().total}

  Object.assign(window,{cartSave,renderCartBadge,renderCartPricing,cartPricing,addToCart,cartQty,cartRemove,openCart,openCheckout,closeCheckout,showLibInfo,toggleDeliveryFields,updateTotal,alinCartQty:cartQty,alinCartRemove:cartRemove,alinApplyCoupon:()=>window.checkCoupon?.()});

  document.addEventListener('alin:coupon-changed',()=>renderCartPricing());

  function install(){normalizeCart();cartSave()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
