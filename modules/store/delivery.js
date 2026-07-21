// === store/delivery.js ===
/* ===== store/js/delivery-gps-v162.js ===== */
/* ALIN v2.1.6: delivery area dropdown + landmark + GPS, without free-text address. */
(function(){
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const areas=()=>{const cloud=window.db?.deliveryAreas||window.db?.delivery_areas||[];const source=cloud.length?cloud.map(row=>row?.name):(Array.isArray(window.ALIN_KIRKUK_AREAS)?window.ALIN_KIRKUK_AREAS:[]);return [...new Set(source.map(name=>String(name||'').trim()).filter(Boolean))]};
  const mapUrl=(lat,lng)=>lat&&lng?`https://www.google.com/maps?q=${encodeURIComponent(lat)},${encodeURIComponent(lng)}`:'';

  function areaOptions(selected=''){
    return `<option value="">اختر منطقة التوصيل في كركوك</option>`+areas().map(a=>`<option value="${esc(a)}" ${String(a)===String(selected)?'selected':''}>${esc(a)}</option>`).join('');
  }
  function gpsMarkup(){
    return `<section class="v162-gps-box" id="v162GpsBox">
      <div class="v162-gps-head"><div><b>نقطة موقع التوصيل GPS</b><small>تساعد المدير والمندوب على الوصول لنقطة التسليم بدقة.</small></div><span id="v162GpsStatus" class="v162-gps-status">غير محدد</span></div>
      <div class="v162-gps-actions">
        <button type="button" class="v162-gps-primary" onclick="alinV162UseCurrentLocation()"><span aria-hidden="true">⌖</span> استخدام موقعي الحالي</button>
        <button type="button" id="v162OpenMapBtn" class="secondary" onclick="alinV162OpenSelectedMap()" disabled>فتح الموقع على الخريطة</button>
        <button type="button" id="v162ClearGpsBtn" class="secondary" onclick="alinV162ClearGps()" hidden>مسح الموقع</button>
      </div>
      <div id="v162GpsDetails" class="v162-gps-details" hidden></div>
      <input type="hidden" id="deliveryLatitude"><input type="hidden" id="deliveryLongitude"><input type="hidden" id="deliveryLocationUrl"><input type="hidden" id="deliveryLocationAccuracy">
      <p class="v162-gps-note">يمكن تحديد الموقع من المتصفح، وأقرب نقطة دالة تكفي عند عدم استخدام GPS.</p>
    </section>`;
  }
  function enhanceDeliveryFields(){
    const root=$('#checkoutBox'); if(!root)return;
    const fields=$('#deliveryFields',root); if(!fields)return;
    const oldArea=$('#deliveryArea',root);
    if(oldArea && oldArea.tagName!=='SELECT'){
      const select=document.createElement('select');select.id='deliveryArea';select.required=true;select.innerHTML=areaOptions(oldArea.value);
      oldArea.replaceWith(select);
    } else if(oldArea && oldArea.tagName==='SELECT' && oldArea.options.length<2){ oldArea.innerHTML=areaOptions(oldArea.value); }
    const oldAddress=$('#deliveryAddress',root);if(oldAddress)oldAddress.remove();
    const courier=$('#courierSelect',root); if(courier) courier.closest('label')?.remove(),courier.remove();
    if(!$('#v162GpsBox',root)){
      const grid=$('.form-grid',fields);
      if(grid) grid.insertAdjacentHTML('afterend',gpsMarkup()); else fields.insertAdjacentHTML('beforeend',gpsMarkup());
    }
    restoreGpsState();
  }
  const stateKey='alin_v162_checkout_gps';
  function saveGpsState(data){try{sessionStorage.setItem(stateKey,JSON.stringify(data))}catch(_){}}
  function readGpsState(){try{return JSON.parse(sessionStorage.getItem(stateKey)||'null')}catch(_){return null}}
  function restoreGpsState(){const s=readGpsState();if(s?.lat&&s?.lng)setGps(s.lat,s.lng,s.accuracy,false)}
  function setGps(lat,lng,accuracy,store=true){
    const la=$('#deliveryLatitude'),lo=$('#deliveryLongitude'),url=$('#deliveryLocationUrl'),acc=$('#deliveryLocationAccuracy');if(!la||!lo)return;
    la.value=Number(lat).toFixed(7);lo.value=Number(lng).toFixed(7);url.value=mapUrl(la.value,lo.value);if(acc)acc.value=Math.round(Number(accuracy||0));
    const status=$('#v162GpsStatus'),details=$('#v162GpsDetails'),open=$('#v162OpenMapBtn'),clear=$('#v162ClearGpsBtn');
    if(status){status.textContent='تم تحديد الموقع';status.classList.add('is-set')}
    if(details){details.hidden=false;details.innerHTML=`<span>خط العرض: <b>${esc(la.value)}</b></span><span>خط الطول: <b>${esc(lo.value)}</b></span>${accuracy?`<span>الدقة التقريبية: <b>${Math.round(accuracy)} متر</b></span>`:''}`}
    if(open)open.disabled=false;if(clear)clear.hidden=false;if(store)saveGpsState({lat:la.value,lng:lo.value,accuracy:Number(accuracy||0)});
  }
  window.alinV162UseCurrentLocation=function(){
    const status=$('#v162GpsStatus');
    if(!navigator.geolocation){if(status)status.textContent='المتصفح لا يدعم GPS';return}
    if(status){status.textContent='جاري تحديد الموقع...';status.classList.remove('is-set')}
    navigator.geolocation.getCurrentPosition(p=>setGps(p.coords.latitude,p.coords.longitude,p.coords.accuracy),e=>{
      if(status)status.textContent=e.code===1?'لم يتم السماح بالموقع':'تعذر تحديد الموقع';
      if(typeof toast==='function')toast('تعذر تحديد GPS. اكتب أقرب نقطة دالة أو حاول مرة أخرى.');
    },{enableHighAccuracy:true,timeout:15000,maximumAge:30000});
  };
  window.alinV162OpenSelectedMap=function(){const u=$('#deliveryLocationUrl')?.value;if(u)window.open(u,'_blank','noopener')};
  window.alinV162ClearGps=function(){['deliveryLatitude','deliveryLongitude','deliveryLocationUrl','deliveryLocationAccuracy'].forEach(id=>{const e=document.getElementById(id);if(e)e.value=''});try{sessionStorage.removeItem(stateKey)}catch(_){};const st=$('#v162GpsStatus'),dt=$('#v162GpsDetails'),op=$('#v162OpenMapBtn'),cl=$('#v162ClearGpsBtn');if(st){st.textContent='غير محدد';st.classList.remove('is-set')}if(dt)dt.hidden=true;if(op)op.disabled=true;if(cl)cl.hidden=true};

  function installCartHook(){
    document.addEventListener('alin:cart-rendered',()=>setTimeout(enhanceDeliveryFields,0));
    document.addEventListener('alin:fulfillment-changed',()=>setTimeout(enhanceDeliveryFields,0));
    document.addEventListener('change',e=>{if(e.target?.name==='fulfillment')setTimeout(enhanceDeliveryFields,0)});
  }

  function orderMapLink(o){
    const lat=o.delivery_latitude||o.latitude||o.delivery_lat,lng=o.delivery_longitude||o.longitude||o.delivery_lng;
    return o.delivery_location_url||o.location_url||mapUrl(lat,lng);
  }
  function decorateAdminDelivery(){
    const rows=(window.db?.orders||[]).filter(o=>o.fulfillment_type==='home_delivery'||o.delivery_area);
    $$('.v161-delivery-card').forEach((card,i)=>{const o=rows[i];if(!o)return;const url=orderMapLink(o);if(!url||$('.v162-map-link',card))return;const actions=$('.v161-delivery-actions',card)||card;actions.insertAdjacentHTML('afterbegin',`<a class="v162-map-link" href="${esc(url)}" target="_blank" rel="noopener">فتح موقع الطالب GPS</a>`)});
  }
  function decorateCourierOrders(){
    const currentId=window.current?.id;
    const rows=(window.db?.orders||[]).filter(o=>String(o.courier_id||o.delegate_id||'')===String(currentId));
    $$('.v161-courier-orders>article').forEach(card=>{
      const numText=$('small',card)?.textContent||'';const o=rows.find(x=>String(x.order_number||x.id)===numText.trim());if(!o)return;const url=orderMapLink(o);if(!url||$('.v162-map-link',card))return;const target=$('.v161-courier-order-actions',card)||card;target.insertAdjacentHTML('afterbegin',`<a class="v162-map-link" href="${esc(url)}" target="_blank" rel="noopener">فتح موقع الطالب</a>`)});
  }
  function installDashboardHooks(){
    if(typeof window.renderDeliveryOrdersAdmin==='function'){const old=window.renderDeliveryOrdersAdmin;window.renderDeliveryOrdersAdmin=function(){const r=old.apply(this,arguments);setTimeout(decorateAdminDelivery,0);return r}}
    if(typeof window.renderCourierDashboard==='function'){const old=window.renderCourierDashboard;window.renderCourierDashboard=function(){const r=old.apply(this,arguments);setTimeout(decorateCourierOrders,0);return r}}
  }
  function install(){installCartHook();installDashboardHooks();setTimeout(enhanceDeliveryFields,100)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();


;
