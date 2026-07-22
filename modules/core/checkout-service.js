// === core/checkout-service.js ===
/* ALIN v2.7.0 Stage 4 — guarded checkout, idempotency and device rate limits. */
(function(){
  'use strict';
  const client=()=>window.ALINAuthRuntime?.client?.()||window.sb||window.AlinCloud?.client?.()||null;
  function normalizeCheckoutItems(lines){
    const booklets=Array.isArray(window.db?.booklets)?window.db.booklets:[];
    const products=Array.isArray(window.db?.products)?window.db.products:[];
    const same=(a,b)=>String(a??'')===String(b??'');
    const findBooklet=id=>booklets.find(x=>same(x.id,id))||null;
    const findProduct=id=>products.find(x=>same(x.id,id))||null;
    const aliases={booklet:'booklet',booklets:'booklet','ملزمة':'booklet','ملازم':'booklet',product:'product',products:'product',stationery:'product',stationary:'product',gift:'product',gifts:'product',deal:'product',booklet_product:'product'};
    return lines.map((line,index)=>{
      let id=String(line?.id??'').trim();
      let kind=String(line?.kind??'').trim().toLowerCase();
      let booklet=findBooklet(id),product=findProduct(id);
      // بعض الأكواد القديمة كانت تستدعي addToCart(id, kind) بالعكس.
      if(!booklet&&!product&&kind){
        const swappedBooklet=findBooklet(kind),swappedProduct=findProduct(kind);
        if(swappedBooklet||swappedProduct){id=kind;kind=String(line?.id??'').trim().toLowerCase();booklet=swappedBooklet;product=swappedProduct}
      }
      const canonical=booklet?'booklet':product?'product':aliases[kind]||'';
      if(!id||!canonical||(!booklet&&!product&&booklets.length+products.length>0)){
        const title=String(line?.title||`العنصر ${index+1}`).trim();
        throw new Error(`العنصر «${title}» لم يعد موجوداً في المتجر. احذفه من السلة وأضفه من جديد`);
      }
      // إصلاح السلة القديمة محلياً حتى لا يتكرر الخطأ في الطلب التالي.
      line.id=id;line.kind=canonical;
      return {kind:canonical,id,qty:Math.max(1,Math.min(100,Number(line?.qty)||1))};
    });
  }


  function normalizeFulfillment(raw={}){
    const type=String(raw?.fulfillment_type||raw?.delivery_type||'').trim().toLowerCase();
    if(['pickup','library'].includes(type)){
      const libraryId=String(raw?.library_id||raw?.pickup_library_id||'').trim();
      if(!libraryId)throw new Error('اختر مكتبة الاستلام');
      return {fulfillment_type:'pickup',library_id:libraryId,pickup_library_id:libraryId};
    }
    if(['home_delivery','courier','delivery'].includes(type)){
      const area=String(raw?.delivery_area||'').trim();
      const landmark=String(raw?.delivery_landmark||'').trim().slice(0,300);
      const latitude=raw?.delivery_latitude==null||raw.delivery_latitude===''?null:Number(raw.delivery_latitude);
      const longitude=raw?.delivery_longitude==null||raw.delivery_longitude===''?null:Number(raw.delivery_longitude);
      const accuracy=raw?.delivery_location_accuracy==null||raw.delivery_location_accuracy===''?null:Math.round(Number(raw.delivery_location_accuracy));
      if(!area)throw new Error('اختر منطقة التوصيل');
      if(!landmark&&!Number.isFinite(latitude))throw new Error('حدد الموقع أو اكتب أقرب نقطة دالة');
      return {
        fulfillment_type:'home_delivery',delivery_area:area,delivery_landmark:landmark,
        delivery_latitude:Number.isFinite(latitude)?latitude:null,
        delivery_longitude:Number.isFinite(longitude)?longitude:null,
        delivery_location_accuracy:Number.isFinite(accuracy)?accuracy:null
      };
    }
    throw new Error('اختر طريقة استلام صحيحة');
  }


  function randomId(){
    if(globalThis.crypto?.randomUUID)return globalThis.crypto.randomUUID();
    const bytes=new Uint8Array(16);globalThis.crypto?.getRandomValues?.(bytes);
    if(!bytes.some(Boolean)){for(let i=0;i<bytes.length;i++)bytes[i]=Math.floor(Math.random()*256)}
    bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
    return [...bytes].map((b,i)=>([4,6,8,10].includes(i)?'-':'')+b.toString(16).padStart(2,'0')).join('');
  }
  function deviceId(){
    const key='alin_device_id_v1';
    try{
      let value=localStorage.getItem(key);
      if(!value||value.length<16){value=randomId();localStorage.setItem(key,value)}
      return value;
    }catch(_){return randomId()}
  }
  function checkoutAttempt(fingerprint){
    const key='alin_checkout_attempt_v1';
    const now=Date.now();
    try{
      const saved=JSON.parse(sessionStorage.getItem(key)||'null');
      if(saved?.fingerprint===fingerprint&&saved?.requestKey&&now-Number(saved.createdAt||0)<15*60*1000)return saved;
      const next={fingerprint,requestKey:randomId(),createdAt:now};
      sessionStorage.setItem(key,JSON.stringify(next));return next;
    }catch(_){return {fingerprint,requestKey:randomId(),createdAt:now}}
  }
  function clearCheckoutAttempt(){try{sessionStorage.removeItem('alin_checkout_attempt_v1')}catch(_){}}

  let checkoutPending=false;
  async function secureCheckout(){
    if(checkoutPending)return;
    const button=document.querySelector('[onclick*="confirmCartCheckout"],#confirmCheckoutButton,[data-confirm-checkout]');
    try{
      checkoutPending=true;
      if(button){button.disabled=true;button.setAttribute('aria-busy','true');button.dataset.originalText=button.textContent;button.textContent='جارٍ إرسال الطلب...'}
      const c=client();if(!c?.rpc)throw new Error('تعذر الاتصال بالخدمة. تحقق من الإنترنت وحاول مجدداً');
      if(typeof cart==='undefined'||!Array.isArray(cart)||!cart.length)throw new Error('السلة فارغة');
      const name=(document.getElementById('studentName')?.value||'').trim();
      const phone=(document.getElementById('studentPhone')?.value||'').trim().replace(/\s+/g,'');
      if(name.length<2)throw new Error('اكتب اسم الطالب بصورة صحيحة');
      if(!/^\+?[0-9٠-٩]{7,15}$/.test(phone))throw new Error('اكتب رقم هاتف صحيح');
      const fulfillment=normalizeFulfillment(typeof alinOrderExtra==='function'?alinOrderExtra():{});
      const coupon=(window.AlinCoupons?.getAppliedCode?.()||document.getElementById('couponInput')?.value||'').trim();
      const cartSnapshot=cart.map(item=>({...item}));
      const items=normalizeCheckoutItems(cart);
      const fingerprint=JSON.stringify({items,customer:{name,phone},fulfillment,coupon:coupon.toLowerCase()});
      const attempt=checkoutAttempt(fingerprint);
      if(typeof cartSave==='function')cartSave();
      const {data,error}=await c.rpc('alin_create_store_orders_guarded',{
        p_items:items,p_customer:{name,phone},p_fulfillment:fulfillment,p_coupon_code:coupon||null,
        p_request_key:attempt.requestKey,p_device_id:deviceId()
      });
      if(error){
        const message=String(error.message||'');
        if(/PGRST202|Could not find the function|schema cache/i.test(message))throw new Error('خدمة حماية الطلبات غير محدثة. نفّذ ملف المرحلة الرابعة ثم حدّث الصفحة.');
        throw error;
      }
      const numbers=Array.isArray(data)?data.map(x=>String(x.order_number||'')).filter(Boolean):[];
      if(!numbers.length)throw new Error('لم يرجع الخادم رقم تتبع للطلب');
      clearCheckoutAttempt();
      cart=[];if(typeof cartSave==='function')cartSave();
      if(typeof load==='function')await load();
      const box=window.checkoutBox||document.getElementById('checkoutBox');
      if(box){
        const copyTrackingCode=async(code,button)=>{
          let copied=false;
          try{
            if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(code);copied=true}
          }catch(_){}
          if(!copied){
            const field=document.createElement('textarea');
            field.value=code;field.setAttribute('readonly','');field.style.position='fixed';field.style.opacity='0';
            document.body.appendChild(field);field.select();
            try{copied=document.execCommand('copy')}catch(_){}
            field.remove();
          }
          if(!copied){window.prompt('انسخ رقم التتبع',code);return}
          const label=button.querySelector('span');
          button.classList.add('is-copied');
          if(label)label.textContent='تم النسخ';
          if(typeof window.toast==='function')window.toast('تم نسخ رقم التتبع');
          setTimeout(()=>{button.classList.remove('is-copied');if(label)label.textContent='نسخ'},1800);
        };
        box.replaceChildren();
        const success=document.createElement('section');success.className='alin-order-success';
        const icon=document.createElement('div');icon.className='alin-order-success__icon';icon.setAttribute('aria-hidden','true');icon.textContent='✓';
        const h=document.createElement('h2');h.textContent='تم استلام طلبك';
        const note=document.createElement('p');note.textContent='احتفظ برقم التتبع لمتابعة حالة طلبك.';
        const codes=document.createElement('div');codes.className='alin-order-success__codes';
        numbers.forEach(number=>{
          const row=document.createElement('div');row.className='alin-tracking-code';
          const code=document.createElement('b');code.dir='ltr';code.textContent=number;code.title='رقم التتبع';
          const copy=document.createElement('button');copy.type='button';copy.className='alin-copy-tracking';copy.setAttribute('aria-label',`نسخ رقم التتبع ${number}`);copy.title='نسخ رقم التتبع';
          copy.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2"></rect><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"></path></svg><span>نسخ</span>';
          copy.addEventListener('click',()=>copyTrackingCode(number,copy));
          code.addEventListener('click',()=>copyTrackingCode(number,copy));code.tabIndex=0;code.setAttribute('role','button');code.setAttribute('aria-label',`نسخ رقم التتبع ${number}`);
          code.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();copyTrackingCode(number,copy)}});
          row.append(code,copy);codes.append(row);
        });
        const close=document.createElement('button');close.type='button';close.className='alin-order-success__close';close.textContent='إغلاق';close.addEventListener('click',()=>window.closeCheckout?.());
        success.append(icon,h,note,codes,close);box.append(success);
        document.dispatchEvent(new CustomEvent('alin:order-created',{detail:{numbers,fulfillment:fulfillment.fulfillment_type||fulfillment.delivery_type||'',items:cartSnapshot}}));
      }
    }catch(e){alert(e?.message||'تعذر إنشاء الطلب')}
    finally{checkoutPending=false;if(button){button.disabled=false;button.removeAttribute('aria-busy');button.textContent=button.dataset.originalText||'تأكيد الطلب'}}
  }
  window.ALINAuth=Object.assign(window.ALINAuth||{},{secureCheckout});
  window.ALINCheckout=Object.freeze({normalizeCheckoutItems,normalizeFulfillment,secureCheckout});
})();
