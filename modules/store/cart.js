// Alin module: store/cart.js | v2.0.3
/* ===== store/js/cart-icons-ui.js ===== */

(function(){
  const $ = s => document.querySelector(s);
  const byId = id => document.getElementById(id);
  const escf = v => (typeof esc==='function' ? esc(v) : String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])));
  const moneyf = v => (typeof money==='function' ? money(v) : Number(v||0).toLocaleString('ar-IQ'));
  const num = v => Number(v||0);

  const ICONS={
    filter:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/><circle cx="8" cy="6" r="1.8" fill="#e4ad31" stroke="none"/><circle cx="15" cy="12" r="1.8" fill="#e4ad31" stroke="none"/><circle cx="12" cy="18" r="1.8" fill="#e4ad31" stroke="none"/></svg>`,
    heart:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.7a5.4 5.4 0 0 0-7.7 0L12 5.8l-1.1-1.1a5.4 5.4 0 0 0-7.7 7.7L12 21l8.8-8.6a5.4 5.4 0 0 0 0-7.7Z"/></svg>`,
    account:`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/></svg>`,
    cart:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.2 10.1a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L20.5 8H7"/><circle cx="10" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/></svg>`,
    exit:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 17l5-5-5-5M15 12H3"/><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/></svg>`,
    bell:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M14 21h-4"/></svg>`,
    home:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11l9-8 9 8"/><path d="M5 10v11h14V10M9 21v-6h6v6"/></svg>`,
    categories:`<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`
  };
  function installRealIcons(){
    const map={
      '.desktop-filter-icon,.mobile-filter-icon':'filter',
      '.desktop-heart-icon,.mobile-heart-icon':'heart',
      '.desktop-account-icon,.mobile-account-icon':'account',
      '.desktop-cart-icon,.mobile-cart-icon':'cart',
      '.desktop-exit-icon,.mobile-exit-icon':'exit',
      '.v99-icon-bell':'bell',
      '.mobile-home-icon':'home',
      '.mobile-categories-icon':'categories'
    };
    Object.entries(map).forEach(([sel,key])=>document.querySelectorAll(sel).forEach(el=>{el.classList.add('alin-real-icon');el.innerHTML=ICONS[key]}));
  }
  function itemLookup(line){
    try{
      if(!window.db) return null;
      if(line.kind==='booklet') return (db.booklets||[]).find(x=>String(x.id)===String(line.id)) || null;
      return (db.products||[]).find(x=>String(x.id)===String(line.id)) || null;
    }catch(e){ return null; }
  }
  function imageFor(item){
    if(!item) return '';
    const candidate = item.cover_path || item.image_path || item.image || item.photo || item.image_url || item.cover_url || item.thumbnail;
    if(!candidate) return '';
    try{ return typeof mediaUrl==='function' ? mediaUrl(candidate) : candidate; }catch(e){ return candidate; }
  }
  function kindLabel(kind){ return kind==='booklet' ? 'ملزمة' : 'منتج'; }
  function kindIcon(kind){ return kind==='booklet' ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v16h4.5a2.5 2.5 0 0 1 2.5 2.5z"/></svg>` : `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8h12l1 12H5L6 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></svg>`; }
  function cartTotal(){ const items=(typeof cart !== 'undefined' && Array.isArray(cart))?cart:[]; return items.reduce((a,x)=>a + num(x.price) * Math.max(1,num(x.qty)),0); }
  function checkoutButtonName(){ return 'confirmCartCheckout()'; }
  function paymentHtml(){
    try{
      if(typeof fulfillmentHtml==='function') return fulfillmentHtml();
      if(typeof alinDeliveryChoiceHtml==='function') return alinDeliveryChoiceHtml();
      if(typeof deliveryChoiceCartHtml==='function') return deliveryChoiceCartHtml();
      if(typeof paymentChoiceHtml==='function') return paymentChoiceHtml();
    }catch(e){}
    return '';
  }
  function activeLibraryRows(){
    try{
      const rows=(window.db?.accounts?.libraries||[]).filter(x=>x.status==='active');
      return rows;
    }catch(e){ return []; }
  }
  function libraryOpen(lib){
    try{ return typeof libIsOpen==='function' ? !!libIsOpen(lib) : lib?.is_open!==false; }catch(e){ return true; }
  }
  function compactLibraryOptions(){
    return activeLibraryRows().map(lib=>{
      const open=libraryOpen(lib), label=`${lib.name||'مكتبة'} — ${open?'مفتوح':'مغلق'}`;
      return `<option value="${escf(lib.id)}" ${open?'':'disabled'}>${escf(label)}</option>`;
    }).join('');
  }
  function cartHasProducts(){
    const items=(typeof cart!=='undefined'&&Array.isArray(cart))?cart:[];
    return items.some(x=>x.kind!=='booklet');
  }
  function compactFulfillmentHtml(){
    if(cartHasProducts()){
      let couriers='';
      try{ if(typeof activeCouriers==='function') couriers=activeCouriers().map(c=>`<option value="${escf(c.id)}">${escf(c.name)}${c.area?` — ${escf(c.area)}`:''}</option>`).join(''); }catch(e){}
      return `<section class="alin-fulfillment"><h4>طريقة الاستلام والدفع</h4><div class="alin-delivery-options"><label class="selected"><input type="radio" name="fulfillment" value="home_delivery" checked><span><b>توصيل للبيت</b><small>الدفع للمندوب عند التسليم</small></span></label></div><div id="deliveryFields" class="alin-delivery-fields"><div class="form-grid"><input id="deliveryArea" placeholder="المنطقة"><input id="deliveryAddress" placeholder="العنوان الكامل"><input id="deliveryLandmark" placeholder="أقرب نقطة دالة"><select id="courierSelect"><option value="">تحديد المندوب من الإدارة</option>${couriers}</select></div></div></section>`;
    }
    return `<section class="alin-fulfillment"><h4>طريقة الاستلام والدفع</h4><div class="alin-delivery-options"><label class="selected"><input type="radio" name="fulfillment" value="pickup" checked onchange="toggleDeliveryFields();alinSyncDeliveryCards()"><span><b>استلام من المكتبة</b><small>الدفع عند الاستلام</small></span></label><label><input type="radio" name="fulfillment" value="home_delivery" onchange="toggleDeliveryFields();alinSyncDeliveryCards()"><span><b>توصيل للبيت</b><small>الدفع للمندوب</small></span></label></div><div id="pickupFields" class="alin-pickup-fields"><select id="libSelect" onchange="alinShowLibraryStatus()"><option value="">اختر مكتبة الاستلام</option>${compactLibraryOptions()}</select><div id="libInfo"></div></div><div id="deliveryFields" class="alin-delivery-fields hidden"><div class="form-grid"><input id="deliveryArea" placeholder="المنطقة"><input id="deliveryAddress" placeholder="العنوان الكامل"><input id="deliveryLandmark" placeholder="أقرب نقطة دالة"><select id="courierSelect"><option value="">تحديد المندوب من الإدارة</option>${(()=>{try{return typeof activeCouriers==='function'?activeCouriers().map(c=>`<option value="${escf(c.id)}">${escf(c.name)}${c.area?` — ${escf(c.area)}`:''}</option>`).join(''):''}catch(e){return ''}})()}</select></div></div></section>`;
  }
  window.alinSyncDeliveryCards=function(){
    document.querySelectorAll('#checkoutBox .alin-delivery-options label').forEach(label=>label.classList.toggle('selected',!!label.querySelector('input:checked')));
  };
  window.alinShowLibraryStatus=function(){
    const select=byId('libSelect'), box=byId('libInfo');
    if(!select||!box) return;
    const lib=activeLibraryRows().find(x=>String(x.id)===String(select.value));
    if(!lib){box.innerHTML='';return;}
    const open=libraryOpen(lib);
    box.innerHTML=`<div class="alin-library-status"><div><b>${escf(lib.name||'مكتبة')}</b><small>${escf([lib.area,lib.landmark].filter(Boolean).join(' — '))}</small></div><span class="${open?'is-open':'is-closed'}">${open?'مفتوح':'مغلق'}</span></div>`;
  };
  function librarySection(){
    return `<div class="form-grid"><input id="studentName" placeholder="اسم الطالب الكامل"><input id="studentPhone" placeholder="رقم الهاتف"></div>${compactFulfillmentHtml()}`;
  }
  function emptyCartHtml(){
    return `<div class="alin-cart-main"><div class="alin-cart-empty"><div class="alin-empty-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.2 10.1a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L20.5 8H7"/><circle cx="10" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/></svg></div><h3>السلة فارغة حالياً</h3><p>أضف ملازمك أو قرطاسيتك المفضلة، وبعدها ارجع هنا لإتمام الطلب بسرعة.</p><button type="button" onclick="closeCheckout();document.getElementById('storeGrid')?.scrollIntoView({behavior:'smooth'})">تصفح المتجر</button></div></div><aside class="alin-cart-side"><h3>ملخص الطلب</h3><div class="alin-summary-card"><div class="alin-summary-rows"><div><span>عدد المواد</span><b>0</b></div><div><span>الإجمالي</span><b>0 د.ع</b></div></div><div class="alin-cart-note">عند إضافة أي مادة ستظهر هنا تفاصيل الطلب والكوبون وبيانات الاستلام.</div></div></aside>`;
  }
  function renderProfessionalCart(){
    if(!window.checkoutBox || !window.checkoutModal) return;
    const items = (typeof cart !== 'undefined' && Array.isArray(cart)) ? cart : [];
    const total = cartTotal();
    const count = items.reduce((a,x)=>a + Math.max(1,num(x.qty)),0);
    const itemsHtml = items.map((line,i)=>{
      const source = itemLookup(line), img = imageFor(source), qty = Math.max(1,num(line.qty)), lineTotal = num(line.price) * qty;
      return `<article class="alin-cart-item"><div class="alin-cart-thumb" data-kind="${escf(line.kind)}">${img ? `<img src="${escf(img)}" alt="${escf(line.title)}">` : `${kindIcon(line.kind)}`}</div><div class="alin-cart-info"><h3 class="alin-cart-title">${escf(line.title)}</h3><div class="alin-cart-meta"><span class="alin-cart-chip">${kindLabel(line.kind)}</span><span class="alin-cart-chip">سعر القطعة: ${moneyf(line.price)} د.ع</span></div><div class="alin-cart-price">${moneyf(lineTotal)} د.ع</div></div><div class="alin-cart-controls"><div class="alin-qty-box"><button type="button" aria-label="تقليل الكمية" onclick="alinCartQty(${i},-1)">−</button><b>${qty}</b><button type="button" aria-label="زيادة الكمية" onclick="alinCartQty(${i},1)">+</button></div><button type="button" class="alin-remove-btn" onclick="alinCartRemove(${i})">حذف من السلة</button></div></article>`;
    }).join('');
    const html = `<div class="alin-cart-shell"><section class="alin-cart-main"><div class="alin-cart-head"><div><h2>سلة آلين</h2><p>راجع المواد والكميات قبل تأكيد الطلب.</p></div><span class="alin-cart-badge">${count}</span></div><div class="alin-cart-list">${itemsHtml}</div></section><aside class="alin-cart-side"><h3>ملخص الطلب</h3><div class="alin-summary-card"><div class="alin-summary-rows"><div><span>عدد المواد</span><b>${count}</b></div><div><span>المجموع الفرعي</span><b>${moneyf(total)} د.ع</b></div></div><div class="alin-summary-total"><div>الإجمالي النهائي</div><b>${moneyf(total)} د.ع</b></div><div class="coupon-box"><input id="couponInput" placeholder="أدخل كود الخصم"><button type="button" onclick="alinApplyCoupon()">تطبيق</button></div><div id="couponMsg"></div><div class="alin-cart-form"><h4>بيانات الطالب والاستلام</h4>${librarySection()}</div><button type="button" class="alin-cart-submit" onclick="${checkoutButtonName()}">تأكيد الطلب الآن</button></div></aside></div>`;
    checkoutBox.innerHTML = items.length ? html : `<div class="alin-cart-shell">${emptyCartHtml()}</div>`;
    checkoutModal.classList.remove('hidden');
    const close = document.querySelector('#checkoutModal .x');
    if(close){ close.textContent='إغلاق'; close.setAttribute('aria-label','إغلاق السلة'); }
    setTimeout(()=>{ try{ alinSyncDeliveryCards(); alinShowLibraryStatus(); }catch(e){} },0);
  }
  window.alinCartQty = function(i,d){ if(typeof window.cartQty==='function'){ window.cartQty(i,d); } else { const items=(typeof cart !== 'undefined'&&Array.isArray(cart))?cart:[]; if(!items[i]) return; items[i].qty=Math.max(1,num(items[i].qty)+d); if(typeof cartSave==='function') cartSave(); updateCartCounters(); renderProfessionalCart(); } };
  window.alinCartRemove = function(i){ if(typeof window.cartRemove==='function'){ window.cartRemove(i); } else { const items=(typeof cart !== 'undefined'&&Array.isArray(cart))?cart:[]; if(!items[i]) return; items.splice(i,1); if(typeof cartSave==='function') cartSave(); updateCartCounters(); renderProfessionalCart(); } };
  window.alinApplyCoupon = function(){ if(typeof window.checkCoupon==='function') window.checkCoupon(); };

  function updateCartCounters(){
    const items=(typeof cart !== 'undefined'&&Array.isArray(cart))?cart:[];
    const count=items.reduce((a,x)=>a+Math.max(1,num(x.qty)),0);
    ['desktopCartCount','mobileCartCount','mobileBottomCartCount'].forEach(id=>{const el=byId(id);if(!el)return;el.textContent=String(count);el.hidden=!count;});
  }

  function install(){
    installRealIcons();
    if(typeof window.openCart === 'function') window.openCart = renderProfessionalCart;
    if(typeof window.addToCart === 'function'){
      const originalAdd=window.addToCart;
      window.addToCart=function(){const r=originalAdd.apply(this,arguments);updateCartCounters();return r;};
    }
    updateCartCounters();
    const oldClose = window.closeCheckout;
    if(typeof oldClose === 'function') window.closeCheckout = function(){ const r = oldClose.apply(this,arguments); const close = document.querySelector('#checkoutModal .x'); if(close){ close.textContent='×'; close.setAttribute('aria-label','إغلاق'); } return r; };
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();
})();


;

