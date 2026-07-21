// === courier/dashboard.js ===
/* ===== courier/js/courier.js ===== */
/* V111: actual courier code moved from core/js/platform-legacy.js */
window.AlinCourierModules=window.AlinCourierModules||{};
window.alinNormalizeDeliveryArea=window.alinNormalizeDeliveryArea||function(value){return String(value||'').replace(/[ـً-ٰٟ]/g,'').replace(/\s+/g,' ').trim().split(/\s*[—–-]\s*/)[0].trim()};
function activeCouriers(){ return (couriers||[]).filter(x=>x.status!=='inactive'); }

function renderCouriersAdmin(){
  adminContent.innerHTML=`<h2>المندوبين</h2><div class="form-grid"><input id="courierName" placeholder="اسم المندوب"><input id="courierPhone" placeholder="رقم الهاتف"><input id="courierArea" placeholder="المنطقة"><button onclick="addCourier()">إضافة مندوب</button></div>`+(couriers.map(c=>`<div class="row"><div><b>${esc(c.name)}</b><small>${esc(c.phone||'')} — ${esc(c.area||'')}</small></div><div class="row-actions"><span>${esc(c.status||'active')}</span><button onclick="toggleCourier('${c.id}')">تفعيل/إيقاف</button></div></div>`).join('')||emptyState('لا يوجد مندوبين'));
}

async function addCourier(){ if(!courierName.value.trim())return alert('اكتب اسم المندوب'); await insert('couriers',{id:uid('C'),name:courierName.value.trim(),phone:courierPhone.value.trim(),area:courierArea.value.trim(),status:'active'}); await audit('courier','إضافة مندوب'); await load(); renderCouriersAdmin(); }

async function toggleCourier(id){const c=couriers.find(x=>x.id===id); await update('couriers',{status:c.status==='inactive'?'active':'inactive'},{id}); await load(); renderCouriersAdmin();}

async function assignCourier(id){ await update('orders',{courier_id:document.getElementById('assign_'+id).value||null},{id}); await audit('courier','تعيين مندوب للطلب '+id); await load(); renderCourierSettlementsAdmin(); }

async function courierOrderStatus(id,status){ await update('orders',{status,payment_status:status==='completed'?'paid':'cod_pending'},{id}); if(status==='completed') await maybeCreateFinancialEntry(id); await audit('courier','تحديث حالة توصيل '+id); await load(); renderCourierSettlementsAdmin(); }

function alinCouriersOptions(){ try{return (typeof activeCouriers==='function'?activeCouriers():[]).map(c=>`<option value="${c.id}">${esc(c.name)}${c.area?' — '+esc(c.area):''}</option>`).join('');}catch(e){return '';} }
window.AlinCourierModules['activeCouriers']=typeof activeCouriers==='function'?activeCouriers:window['activeCouriers'];window['activeCouriers']=window.AlinCourierModules['activeCouriers'];
window.AlinCourierModules['renderCouriersAdmin']=typeof renderCouriersAdmin==='function'?renderCouriersAdmin:window['renderCouriersAdmin'];window['renderCouriersAdmin']=window.AlinCourierModules['renderCouriersAdmin'];
window.AlinCourierModules['addCourier']=typeof addCourier==='function'?addCourier:window['addCourier'];window['addCourier']=window.AlinCourierModules['addCourier'];
window.AlinCourierModules['toggleCourier']=typeof toggleCourier==='function'?toggleCourier:window['toggleCourier'];window['toggleCourier']=window.AlinCourierModules['toggleCourier'];
window.AlinCourierModules['assignCourier']=typeof assignCourier==='function'?assignCourier:window['assignCourier'];window['assignCourier']=window.AlinCourierModules['assignCourier'];
window.AlinCourierModules['courierOrderStatus']=typeof courierOrderStatus==='function'?courierOrderStatus:window['courierOrderStatus'];window['courierOrderStatus']=window.AlinCourierModules['courierOrderStatus'];
window.AlinCourierModules['alinCouriersOptions']=typeof alinCouriersOptions==='function'?alinCouriersOptions:window['alinCouriersOptions'];window['alinCouriersOptions']=window.AlinCourierModules['alinCouriersOptions'];

/* ===== courier/js/courier-v161.js ===== */
/* V161: Kirkuk courier area system + manual admin assignment */
(function(){
  'use strict';
  try{if(!('couriers' in window))Object.defineProperty(window,'couriers',{configurable:true,get:()=>couriers,set:v=>{couriers=v}})}catch(_){}
  try{if(!('courierSettlements' in window))Object.defineProperty(window,'courierSettlements',{configurable:true,get:()=>courierSettlements,set:v=>{courierSettlements=v}})}catch(_){}
  try{if(!('db' in window))Object.defineProperty(window,'db',{configurable:true,get:()=>db,set:v=>{db=v}})}catch(_){}
  const DEFAULT_AREAS=['القادسية','الحرية','الإسكان','عرفة','رحيم آوه','شوراو','طريق بغداد','الواسطي','دوميز','بنجا علي','تسعين','حي النصر','حي النداء','الخضراء','المصلى','القورية','الشورجة','واحد حزيران','الحي العسكري','حي المعلمين','حي الجامعة','حي عدن','حي الزوراء','حي الحسين','حي العمل الشعبي','غرناطة','المنصور','البلديات','الشرطة','النداء'];
  window.ALIN_KIRKUK_AREAS=DEFAULT_AREAS.slice();
  const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
  const escV=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const moneyV=v=>typeof money==='function'?money(v):Number(v||0).toLocaleString('ar-IQ');
  const uidV=p=>typeof uid==='function'?uid(p):(p+'-'+Date.now().toString(36));
  const notify=m=>typeof toast==='function'?toast(m):alert(m);
  const now=()=>new Date().toISOString();
  function areaRows(){
    const rows=(window.db?.delivery_areas||window.deliveryAreas||[]).filter(x=>x.active!==false&&String(x.status||'active')!=='inactive');
    return rows.length?rows:DEFAULT_AREAS.map((name,i)=>({id:'KA'+(i+1),name,active:true,sort_order:i+1}));
  }
  function areaNames(c){
    if(!c)return[];
    let raw=c.areas||c.area_ids||c.area||'';
    if(Array.isArray(raw))return raw.map(String);
    if(typeof raw==='string'){
      try{const p=JSON.parse(raw);if(Array.isArray(p))return p.map(String)}catch(_){ }
      return raw.split(/[,،|]/).map(x=>x.trim()).filter(Boolean);
    }
    return[];
  }
  function courierStatus(c){
    if(!c||c.status==='inactive')return'offline';
    const s=String(c.availability||c.work_status||'available');
    return ['available','busy','offline'].includes(s)?s:'available';
  }
  function currentLoad(c){
    return (window.db?.orders||[]).filter(o=>String(o.courier_id||o.delegate_id||'')===String(c.id)&&!['completed','cancelled','delivered'].includes(String(o.status))).length;
  }
  function statusArabic(s){return({available:'متاح',busy:'مشغول',offline:'غير متصل',active:'فعال',inactive:'موقوف'})[s]||s}
  function matchingCouriers(area){
    const target=window.alinNormalizeDeliveryArea(area);
    return (window.couriers||[]).filter(c=>c.status!=='inactive'&&areaNames(c).some(name=>window.alinNormalizeDeliveryArea(name)===target)).sort((a,b)=>currentLoad(a)-currentLoad(b));
  }
  function areasOptions(selected=''){return areaRows().map(a=>`<option value="${escV(a.name)}" ${a.name===selected?'selected':''}>${escV(a.name)}</option>`).join('')}
  window.alinV161AreasOptions=areasOptions;

  /* student checkout: fixed area list, courier always assigned by admin */
  function deliveryBlock(hidden=false){return `<div id="deliveryFields" class="${hidden?'hidden':''}"><div class="form-grid"><select id="deliveryArea" required><option value="">اختر منطقة التوصيل في كركوك</option>${areasOptions()}</select><input id="deliveryLandmark" placeholder="أقرب نقطة دالة"></div><div class="checkout-total">أجور التوصيل: <b>${moneyV(typeof alinDeliveryFee==='function'?alinDeliveryFee():0)} د.ع</b></div><p class="v161-delivery-note">بعد تأكيد الطلب يعرض النظام للمدير المندوبين العاملين في منطقتك، والمدير يعيّن المندوب المناسب يدوياً.</p></div>`}

  /* admin couriers */
  window.renderCouriersAdmin=function(){
    const rows=window.couriers||[];
    adminContent.innerHTML=`<section class="v161-admin"><header class="v161-title"><div><small>نظام التوصيل</small><h2>إدارة المندوبين</h2><p>إضافة المندوبين وربطهم بمناطق كركوك ومتابعة حالتهم والطلبات الحالية.</p></div><button onclick="alinV161CourierForm()">+ إضافة مندوب</button></header><div class="v161-stats"><article><b>${rows.length}</b><span>إجمالي المندوبين</span></article><article><b>${rows.filter(x=>x.status!=='inactive').length}</b><span>فعال</span></article><article><b>${rows.filter(x=>courierStatus(x)==='available').length}</b><span>متاح</span></article><article><b>${rows.reduce((a,c)=>a+currentLoad(c),0)}</b><span>طلبات جارية</span></article></div><div class="v161-toolbar"><input id="v161CourierSearch" placeholder="بحث باسم المندوب أو الهاتف أو المنطقة" oninput="alinV161FilterCouriers()"><select id="v161CourierStatus" onchange="alinV161FilterCouriers()"><option value="">كل الحالات</option><option value="available">متاح</option><option value="busy">مشغول</option><option value="offline">غير متصل</option><option value="inactive">موقوف</option></select></div><div id="v161CourierGrid" class="v161-courier-grid">${rows.map(c=>courierCard(c)).join('')||'<div class="empty">لا يوجد مندوبون بعد.</div>'}</div></section>`;
  };
  function courierCard(c){const areas=areaNames(c),st=c.status==='inactive'?'inactive':courierStatus(c),load=currentLoad(c);return `<article class="v161-courier-card" data-search="${escV((c.name||'')+' '+(c.phone||'')+' '+areas.join(' '))}" data-status="${escV(st)}"><div class="v161-avatar">${escV((c.name||'م').slice(0,1))}</div><div class="v161-courier-info"><div class="v161-card-head"><h3>${escV(c.name||'مندوب')}</h3><span class="v161-status ${st}">${statusArabic(st)}</span></div><p>${escV(c.phone||'بدون رقم هاتف')}</p><div class="v161-area-chips">${areas.map(a=>`<span>${escV(a)}</span>`).join('')||'<span>غير مرتبط بمنطقة</span>'}</div><div class="v161-load"><b>${load}</b> طلبات حالية</div></div><div class="v161-card-actions"><button onclick="alinV161CourierForm('${escV(c.id)}')">تعديل</button><button class="secondary" onclick="alinV161ToggleCourier('${escV(c.id)}')">${c.status==='inactive'?'تفعيل':'إيقاف'}</button></div></article>`}
  window.alinV161FilterCouriers=function(){const q=($('#v161CourierSearch')?.value||'').toLowerCase(),s=$('#v161CourierStatus')?.value||'';$$('.v161-courier-card').forEach(c=>c.hidden=!(c.dataset.search.toLowerCase().includes(q)&&(!s||c.dataset.status===s)))};
  window.alinV161CourierForm=function(id=''){
    const c=(window.couriers||[]).find(x=>String(x.id)===String(id))||{};const selected=areaNames(c);
    checkoutBox.innerHTML=`<div class="v161-form"><h2>${id?'تعديل مندوب':'إضافة مندوب'}</h2><div class="form-grid"><input id="v161CourierName" value="${escV(c.name||'')}" placeholder="اسم المندوب"><input id="v161CourierPhone" value="${escV(c.phone||'')}" placeholder="رقم الهاتف"><input id="v161CourierUsername" value="${escV(c.username||'')}" placeholder="اسم المستخدم"><input id="v161CourierPassword" type="password" value="" autocomplete="new-password" placeholder="${id?'كلمة مرور جديدة (اختياري)':'كلمة المرور'}"><select id="v161CourierAvailability"><option value="available" ${courierStatus(c)==='available'?'selected':''}>متاح</option><option value="busy" ${courierStatus(c)==='busy'?'selected':''}>مشغول</option><option value="offline" ${courierStatus(c)==='offline'?'selected':''}>غير متصل</option></select></div><p class="muted">كلمة المرور لا تُعرض ولا تُحفظ داخل جدول المندوبين. عند تعديل حساب قديم غير مربوط، اكتب كلمة مرور جديدة لترحيله إلى الدخول الآمن.</p><h3>مناطق العمل</h3><div class="v161-area-picker">${areaRows().map(a=>`<label><input type="checkbox" value="${escV(a.name)}" ${selected.includes(a.name)?'checked':''}> ${escV(a.name)}</label>`).join('')}</div><button onclick="alinV161SaveCourier('${escV(id)}')">حفظ المندوب</button></div>`;checkoutModal.classList.remove('hidden');
  };
  window.alinV161SaveCourier=async function(id=''){
    try{
      const name=$('#v161CourierName').value.trim(),username=$('#v161CourierUsername').value.trim(),password=$('#v161CourierPassword').value.trim();
      const phone=$('#v161CourierPhone').value.trim(),availability=$('#v161CourierAvailability').value;
      const areas=$$('.v161-area-picker input:checked').map(x=>x.value);
      if(!name||!username||(!id&&!password))throw new Error('أكمل الاسم واسم المستخدم وكلمة المرور للحساب الجديد');
      if(password&&password.length<8)throw new Error('كلمة المرور يجب أن تكون 8 أحرف أو أرقام على الأقل');
      if(!areas.length)throw new Error('اختر منطقة عمل واحدة على الأقل');
      const api=window.ALINAuth;if(!api)throw new Error('خدمة إدارة الحسابات الآمنة غير جاهزة');
      if(id){
        await api.updateAccountFromAdmin({account_id:id,role:'courier',name,username,status:'active',phone,area:areas[0],areas,availability,password:password||undefined});
      }else{
        await api.createAccount({role:'courier',name,username,password,phone,area:areas[0],areas,availability,status:'active'});
      }
      if(typeof audit==='function')await audit('courier',id?'تعديل حساب مندوب '+name:'إنشاء حساب مندوب آمن '+name);
      if(typeof load==='function')await load();closeCheckout();renderCouriersAdmin();notify('تم حفظ حساب المندوب الآمن');
    }catch(e){alert(e.message||'تعذر حفظ المندوب')}
  };
  window.alinV161ToggleCourier=async function(id){const c=(window.couriers||[]).find(x=>String(x.id)===String(id));if(!c)return;await update('couriers',{status:c.status==='inactive'?'active':'inactive'},{id});if(typeof load==='function')await load();renderCouriersAdmin()};

  /* admin areas */
  window.renderCourierAreasAdmin=function(){const rows=areaRows();adminContent.innerHTML=`<section class="v161-admin"><header class="v161-title"><div><small>كركوك</small><h2>إدارة المناطق</h2><p>قائمة ثابتة تمنع اختلاف كتابة أسماء المناطق، ويمكن تعديلها أو إضافة مناطق جديدة.</p></div><button onclick="alinV161AddArea()">+ إضافة منطقة</button></header><div class="v161-area-admin">${rows.map(a=>{const count=(window.couriers||[]).filter(c=>areaNames(c).includes(a.name)).length;return `<article><div><h3>${escV(a.name)}</h3><p>مرتبط بـ ${count} مندوب</p></div><div><button onclick="alinV161EditArea('${escV(a.id)}','${escV(a.name)}')">تعديل</button><button class="danger" onclick="alinV161DeleteArea('${escV(a.id)}','${escV(a.name)}')">حذف</button></div></article>`}).join('')}</div></section>`};
  window.alinV161AddArea=async function(){const name=(prompt('اسم المنطقة الجديدة')||'').trim();if(!name)return;try{await insert('delivery_areas',{id:uidV('A'),name,city:'كركوك',status:'active',sort_order:areaRows().length+1});if(typeof load==='function')await load();renderCourierAreasAdmin();notify('تمت إضافة المنطقة')}catch(e){alert(e?.message||'تعذر إضافة المنطقة')}};
  window.alinV161EditArea=async function(id,old){const name=(prompt('تعديل اسم المنطقة',old)||'').trim();if(!name||name===old)return;try{await update('delivery_areas',{name},{id});for(const c of (window.couriers||[])){const ar=areaNames(c);if(ar.includes(old))await update('couriers',{areas:ar.map(x=>x===old?name:x),area:(c.area===old?name:c.area)},{id:c.id})}if(typeof load==='function')await load();renderCourierAreasAdmin()}catch(e){alert('تعذر تعديل المنطقة')}};
  window.alinV161DeleteArea=async function(id,name){if((window.couriers||[]).some(c=>areaNames(c).includes(name)))return alert('لا يمكن حذف منطقة مرتبطة بمندوب. أزل الربط أولاً.');if(!confirm('حذف منطقة '+name+'؟'))return;try{await update('delivery_areas',{status:'inactive'},{id});if(typeof load==='function')await load();renderCourierAreasAdmin();notify('تم حذف المنطقة')}catch(e){alert(e?.message||'تعذر حذف المنطقة')}};

  /* manual delivery assignment */
  window.renderDeliveryOrdersAdmin=function(){const orders=(window.db?.orders||[]).filter(o=>o.fulfillment_type==='home_delivery'||o.delivery_area);adminContent.innerHTML=`<section class="v161-admin"><header class="v161-title"><div><small>تحويل يدوي</small><h2>طلبات التوصيل</h2><p>النظام يعرض فقط المندوبين المرتبطين بمنطقة الطلب، والمدير يختار المندوب المناسب.</p></div></header><div class="v161-stats"><article><b>${orders.length}</b><span>كل طلبات التوصيل</span></article><article><b>${orders.filter(o=>!o.courier_id&&!o.delegate_id).length}</b><span>بانتظار التحويل</span></article><article><b>${orders.filter(o=>['out_for_delivery','assigned'].includes(o.status)).length}</b><span>قيد التوصيل</span></article><article><b>${orders.filter(o=>['completed','delivered'].includes(o.status)).length}</b><span>مكتملة</span></article></div><div class="v161-delivery-list">${orders.map(deliveryCard).join('')||'<div class="empty">لا توجد طلبات توصيل.</div>'}</div></section>`};
  function deliveryCard(o){const area=o.delivery_area||'غير محددة',match=matchingCouriers(area),assigned=(window.couriers||[]).find(c=>String(c.id)===String(o.courier_id||o.delegate_id||''));return `<article class="v161-delivery-card"><div class="v161-order-head"><div><small>${escV(o.order_number||o.id)}</small><h3>${escV(o.title||'طلب توصيل')}</h3></div><span class="v161-order-area">${escV(area)}</span></div><div class="v161-order-details"><span>الطالب: <b>${escV(o.student_name||'')}</b></span><span>الهاتف: <b>${escV(o.student_phone||'')}</b></span><span>أقرب نقطة دالة: <b>${escV(o.delivery_landmark||'—')}</b></span><span>المبلغ: <b>${moneyV(o.total)} د.ع</b></span></div><div class="v161-match-box"><h4>المندوبون المناسبون (${match.length})</h4>${match.length?match.map(c=>`<label class="v161-match"><input type="radio" name="assign_${escV(o.id)}" value="${escV(c.id)}" ${assigned?.id===c.id?'checked':''}><span><b>${escV(c.name)}</b><small>${statusArabic(courierStatus(c))} • ${currentLoad(c)} طلبات حالية • ${escV(c.phone||'')}</small></span></label>`).join(''):'<p class="warning-text">لا يوجد مندوب مرتبط بهذه المنطقة حالياً.</p>'}</div><div class="v161-delivery-actions"><button ${!match.length?'disabled':''} onclick="alinV161AssignOrder('${escV(o.id)}')">تحويل للمندوب</button>${assigned?`<span>المندوب الحالي: <b>${escV(assigned.name)}</b></span>`:'<span>لم يتم تعيين مندوب بعد</span>'}</div></article>`}
  window.alinV161AssignOrder=async function(orderId){const selected=document.querySelector(`input[name="assign_${CSS.escape(orderId)}"]:checked`)?.value;if(!selected)return alert('اختر مندوباً مناسباً');try{await update('orders',{courier_id:selected,delegate_id:selected,assignment_status:'assigned',status:'assigned',assigned_at:now()},{id:orderId});if(typeof audit==='function')await audit('courier','تحويل الطلب '+orderId+' إلى مندوب');if(typeof load==='function')await load();renderDeliveryOrdersAdmin();notify('تم تحويل الطلب للمندوب')}catch(e){alert(e.message||'تعذر تحويل الطلب')}};

  /* courier login + page */
  // Courier login is handled only by the Supabase Auth adapter.
  // Courier page activation is handled centrally by modules/core/navigation.js.
  window.renderCourierDashboard=function(tab='current'){
    const c=(window.couriers||[]).find(x=>String(x.id)===String(current?.id));if(!c)return;const orders=(window.db?.orders||[]).filter(o=>String(o.courier_id||o.delegate_id||'')===String(c.id));const active=orders.filter(o=>!['completed','delivered','cancelled'].includes(o.status));const done=orders.filter(o=>['completed','delivered'].includes(o.status));const content=$('#courierV161Content');if(!content)return;$('#courierV161Name').textContent=c.name;$('#courierV161Areas').textContent=areaNames(c).join('، ')||'لا توجد مناطق';$$('[data-courier-tab]').forEach(b=>b.classList.toggle('active',b.dataset.courierTab===tab));if(tab==='current')content.innerHTML=courierOrdersHtml(active,true);else if(tab==='completed')content.innerHTML=courierOrdersHtml(done,false);else if(tab==='finance')content.innerHTML=courierFinanceHtml(c,orders);else content.innerHTML=courierProfileHtml(c);
  };
  function courierOrdersHtml(rows,actions){return `<div class="v161-courier-summary"><article><b>${rows.length}</b><span>${actions?'طلبات حالية':'طلبات مكتملة'}</span></article></div><div class="v161-courier-orders">${rows.map(o=>`<article><div><small>${escV(o.order_number||o.id)}</small><h3>${escV(o.title||'طلب')}</h3><p>${escV(o.student_name||'')} • ${escV(o.student_phone||'')}</p><p>${escV(window.alinNormalizeDeliveryArea(o.delivery_area)||'')} — ${escV(o.delivery_landmark||'')}</p><b>${moneyV(o.total)} د.ع</b></div>${actions?`<div class="v161-courier-order-actions"><button onclick="alinV161CourierStatus('${escV(o.id)}','out_for_delivery')">استلمت الطلب</button><button onclick="alinV161CourierStatus('${escV(o.id)}','completed')">تم التسليم</button></div>`:`<span class="v161-status available">تم التسليم</span>`}</article>`).join('')||'<div class="empty">لا توجد طلبات.</div>'}</div>`}
  function courierFinanceHtml(c,orders){const delivered=orders.filter(o=>['completed','delivered'].includes(o.status)),received=delivered.reduce((a,o)=>a+(+o.total||0),0),settled=(window.courierSettlements||[]).filter(s=>String(s.courier_id)===String(c.id)).reduce((a,s)=>a+(+s.amount||0),0);return `<div class="v161-stats"><article><b>${moneyV(received)}</b><span>مبالغ مستلمة</span></article><article><b>${moneyV(settled)}</b><span>تمت تسويتها</span></article><article><b>${moneyV(Math.max(0,received-settled))}</b><span>المبلغ بذمتك</span></article></div>`}
  function courierProfileHtml(c){return `<div class="v161-profile"><h2>${escV(c.name)}</h2><p>الهاتف: ${escV(c.phone||'')}</p><p>مناطق العمل: ${escV(areaNames(c).join('، '))}</p><label>حالة العمل<select id="v161MyAvailability"><option value="available" ${courierStatus(c)==='available'?'selected':''}>متاح</option><option value="busy" ${courierStatus(c)==='busy'?'selected':''}>مشغول</option><option value="offline" ${courierStatus(c)==='offline'?'selected':''}>غير متصل</option></select></label><button onclick="alinV161SaveMyStatus()">حفظ الحالة</button></div>`}
  window.alinV161CourierStatus=async function(id,status){await update('orders',{status,payment_status:status==='completed'?'paid':'cod_pending',status_updated_at:now()},{id});if(status==='completed'&&typeof maybeCreateFinancialEntry==='function')await maybeCreateFinancialEntry(id);if(typeof load==='function')await load();renderCourierDashboard('current')};
  window.alinV161SaveMyStatus=async function(){await update('couriers',{availability:$('#v161MyAvailability').value},{id:current.id});if(typeof load==='function')await load();renderCourierDashboard('profile');notify('تم تحديث حالتك')};

  /* admin tab extension */
  const oldAdminTab=adminTab; adminTab=function(t){if(t==='courierAreas')return renderCourierAreasAdmin();if(t==='deliveryOrders')return renderDeliveryOrdersAdmin();return oldAdminTab.apply(this,arguments)};

  /* load delivery areas when possible */
  const oldLoad=load; load=async function(){const r=await oldLoad.apply(this,arguments);try{window.db.delivery_areas=await query('delivery_areas')}catch(_){window.db.delivery_areas=[]}return r};
})();

/* ===== courier/js/courier-v164.js ===== */
/* V164: Courier page + admin courier management completion */
(function(){
  'use strict';
  const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
  const escv=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const moneyv=v=>typeof money==='function'?money(v):Number(v||0).toLocaleString('ar-IQ');
  const now=()=>new Date().toISOString();
  const couriers=()=>Array.isArray(window.couriers)?window.couriers:(Array.isArray(window.db?.accounts?.couriers)?window.db.accounts.couriers:[]);
  const orders=()=>Array.isArray(window.db?.orders)?window.db.orders:[];
  const settlements=()=>Array.isArray(window.courierSettlements)?window.courierSettlements:(Array.isArray(window.db?.courier_settlements)?window.db.courier_settlements:[]);
  const notify=m=>typeof toast==='function'?toast(m):alert(m);
  const roleCurrent=()=>{try{return window.current||current}catch(_){return null}};

  function areasOf(c){
    if(!c)return[];let raw=c.areas||c.area_ids||c.area||[];
    if(Array.isArray(raw))return raw.map(String).filter(Boolean);
    if(typeof raw==='string'){try{const x=JSON.parse(raw);if(Array.isArray(x))return x.map(String)}catch(_){}return raw.split(/[,،|]/).map(x=>x.trim()).filter(Boolean)}
    return[];
  }
  function statusOf(c){if(!c||c.status==='inactive')return'inactive';const s=String(c.availability||c.work_status||'available');return ['available','busy','offline'].includes(s)?s:'available'}
  function statusLabel(s){return({available:'متاح',busy:'مشغول',offline:'غير متصل',inactive:'موقوف'})[s]||s}
  function orderStatus(o){return String(o.status||'assigned')}
  function isDone(o){return ['completed','delivered'].includes(orderStatus(o))}
  function isCancelled(o){return ['cancelled','rejected'].includes(orderStatus(o))}
  function isActive(o){return !isDone(o)&&!isCancelled(o)}
  function courierOrders(c){return orders().filter(o=>String(o.courier_id||o.delegate_id||'')===String(c.id))}
  function activeLoad(c){return courierOrders(c).filter(isActive).length}
  function todayDone(c){const d=new Date().toISOString().slice(0,10);return courierOrders(c).filter(o=>isDone(o)&&String(o.delivered_at||o.completed_at||o.status_updated_at||o.updated_at||'').slice(0,10)===d).length}
  function courierFinancials(c){
    const done=courierOrders(c).filter(isDone);
    const collected=done.reduce((a,o)=>a+(+o.total||0),0);
    const earnings=done.reduce((a,o)=>a+(+o.courier_profit||+o.delivery_fee||0),0);
    const paid=settlements().filter(s=>String(s.courier_id)===String(c.id)&&String(s.status||'paid')!=='cancelled').reduce((a,s)=>a+(+s.amount||0),0);
    return {collected,earnings,paid,debt:Math.max(0,collected-earnings-paid)};
  }
  function phoneLink(phone){const p=String(phone||'').replace(/\D/g,'');return p?`tel:+${p.startsWith('964')?p:'964'+p.replace(/^0/,'')}`:'#'}
  function whatsappLink(phone){const p=String(phone||'').replace(/\D/g,'');return p?`https://wa.me/${p.startsWith('964')?p:'964'+p.replace(/^0/,'')}`:'#'}
  function mapLink(o){const lat=o.delivery_latitude||o.delivery_lat||o.latitude,lng=o.delivery_longitude||o.delivery_lng||o.longitude;return o.delivery_location_url||o.delivery_map_url||o.gps_url||(lat&&lng?`https://maps.google.com/?q=${lat},${lng}`:'')}
  function fmtDate(v){if(!v)return'—';try{return new Date(v).toLocaleString('ar-IQ')}catch(_){return String(v)}}

  /* Add stable courier notifications tab */
  function ensureCourierTab(){
    const nav=document.querySelector('.courier-v161-tabs');if(!nav)return;
    if(!nav.querySelector('[data-courier-tab="notifications"]')){
      const b=document.createElement('button');b.type='button';b.dataset.courierTab='notifications';b.textContent='الإشعارات';b.onclick=()=>window.renderCourierDashboard('notifications');nav.appendChild(b);
    }
  }

  window.renderCourierDashboard=function(tab='current'){
    const me=roleCurrent();const c=couriers().find(x=>String(x.id)===String(me?.id));if(!c)return;
    ensureCourierTab();
    const all=courierOrders(c),active=all.filter(isActive),done=all.filter(isDone),fin=courierFinancials(c),content=$('#courierV161Content');if(!content)return;
    $('#courierV161Name').textContent=c.name||'المندوب';$('#courierV161Areas').textContent=areasOf(c).join('، ')||'لا توجد مناطق';
    $$('.courier-v161-tabs [data-courier-tab]').forEach(b=>b.classList.toggle('active',b.dataset.courierTab===tab));
    const summary=`<section class="v164-courier-metrics"><article><small>الحالة</small><strong class="v164-status-text ${statusOf(c)}">${statusLabel(statusOf(c))}</strong></article><article><small>الطلبات الحالية</small><strong>${active.length}</strong></article><article><small>تم اليوم</small><strong>${todayDone(c)}</strong></article><article><small>أرباح التوصيل</small><strong>${moneyv(fin.earnings)} د.ع</strong></article><article><small>المبلغ بذمتك</small><strong>${moneyv(fin.debt)} د.ع</strong></article></section>`;
    if(tab==='current')content.innerHTML=summary+courierOrdersHTML(active,true);
    else if(tab==='completed')content.innerHTML=summary+courierOrdersHTML(done,false);
    else if(tab==='finance')content.innerHTML=summary+courierFinanceHTML(c,all);
    else if(tab==='notifications')content.innerHTML=summary+courierNotificationsHTML(c);
    else content.innerHTML=summary+courierProfileHTML(c);
  };

  function courierOrdersHTML(rows,actions){
    return `<section class="v164-section-head"><div><h2>${actions?'طلبات التوصيل الحالية':'الطلبات المكتملة'}</h2><p>${actions?'تابع الطلب من الاستلام حتى التسليم.':'سجل الطلبات التي تم تسليمها.'}</p></div><span>${rows.length}</span></section><div class="v164-courier-orders">${rows.map(o=>courierOrderCard(o,actions)).join('')||'<div class="empty">لا توجد طلبات حالياً.</div>'}</div>`;
  }
  function courierOrderCard(o,actions){
    const st=orderStatus(o),map=mapLink(o),phone=o.student_phone||'';
    const first=st==='assigned'||st==='new'; const moving=['accepted','picked_up','out_for_delivery','processing'].includes(st);
    return `<article class="v164-order-card"><header><div><small>${escv(o.order_number||o.id)}</small><h3>${escv(o.title||'طلب توصيل')}</h3></div><span class="v164-order-status ${escv(st)}">${escv(({assigned:'محوّل إليك',accepted:'تم القبول',picked_up:'تم الاستلام',out_for_delivery:'في الطريق',completed:'تم التسليم',delivered:'تم التسليم'})[st]||st)}</span></header><div class="v164-order-grid"><div><small>الطالب</small><b>${escv(o.student_name||'—')}</b></div><div><small>الهاتف</small><b>${escv(phone||'—')}</b></div><div><small>المنطقة</small><b>${escv(window.alinNormalizeDeliveryArea(o.delivery_area)||'—')}</b></div><div><small>المبلغ المطلوب</small><b>${moneyv(o.total)} د.ع</b></div><div class="wide"><small>أقرب نقطة دالة</small><b>${escv(o.delivery_landmark||'—')}</b></div></div><div class="v164-order-links">${phone?`<a href="${phoneLink(phone)}">اتصال</a><a href="${whatsappLink(phone)}" target="_blank" rel="noopener">واتساب</a>`:''}${map?`<a class="map" href="${escv(map)}" target="_blank" rel="noopener">فتح الموقع GPS</a>`:''}</div>${actions?`<div class="v164-order-actions">${first?`<button onclick="alinV164CourierStep('${escv(o.id)}','accepted')">قبول الطلب</button>`:''}${first||st==='accepted'?`<button onclick="alinV164CourierStep('${escv(o.id)}','picked_up')">استلمت الطلب</button>`:''}${moving?`<button onclick="alinV164CourierStep('${escv(o.id)}','out_for_delivery')">بدأت التوصيل</button>`:''}<button class="success" onclick="alinV164CourierComplete('${escv(o.id)}')">تم التسليم واستلام المبلغ</button><button class="secondary" onclick="alinV164ReportIssue('${escv(o.id)}')">مشكلة بالطلب</button></div>`:`<footer>تم التسليم: ${escv(fmtDate(o.delivered_at||o.completed_at||o.status_updated_at))}</footer>`}</article>`;
  }
  window.alinV164CourierStep=async function(id,status){try{await update('orders',{status,status_updated_at:now(),courier_note:null},{id});if(typeof audit==='function')await audit('courier',`تحديث الطلب ${id} إلى ${status}`);if(typeof load==='function')await load();renderCourierDashboard('current');notify('تم تحديث حالة الطلب')}catch(e){alert(e.message||'تعذر تحديث الطلب')}};
  window.alinV164CourierComplete=async function(id){if(!confirm('تأكيد تسليم الطلب واستلام المبلغ من الطالب؟'))return;try{await update('orders',{status:'completed',payment_status:'paid',delivered_at:now(),status_updated_at:now()},{id});if(typeof maybeCreateFinancialEntry==='function')await maybeCreateFinancialEntry(id);if(typeof audit==='function')await audit('courier',`تسليم الطلب ${id} واستلام المبلغ`);if(typeof load==='function')await load();renderCourierDashboard('current');notify('تم تسجيل التسليم بنجاح')}catch(e){alert(e.message||'تعذر إكمال الطلب')}};
  window.alinV164ReportIssue=async function(id){const note=(prompt('اكتب المشكلة أو سبب التعذر')||'').trim();if(!note)return;try{await update('orders',{courier_note:note,delivery_issue:true,status_updated_at:now()},{id});if(typeof audit==='function')await audit('courier',`مشكلة في الطلب ${id}: ${note}`);notify('تم إرسال المشكلة للإدارة');if(typeof load==='function')await load();renderCourierDashboard('current')}catch(e){alert(e.message||'تعذر إرسال الملاحظة')}};

  function courierFinanceHTML(c,all){const f=courierFinancials(c),done=all.filter(isDone);return `<section class="v164-finance-grid"><article><small>المبالغ المستلمة من الطلاب</small><strong>${moneyv(f.collected)} د.ع</strong></article><article><small>أرباح التوصيل</small><strong>${moneyv(f.earnings)} د.ع</strong></article><article><small>المبالغ المسددة للإدارة</small><strong>${moneyv(f.paid)} د.ع</strong></article><article class="debt"><small>المبلغ بذمتك</small><strong>${moneyv(f.debt)} د.ع</strong></article></section><section class="v164-table-card"><h2>كشف الطلبات المالية</h2><div class="v164-finance-list">${done.map(o=>`<div><span>${escv(o.order_number||o.id)}</span><span>${moneyv(o.total)} د.ع</span><span>أجرة التوصيل: ${moneyv(o.courier_profit||o.delivery_fee||0)} د.ع</span><span>${escv(fmtDate(o.delivered_at||o.completed_at))}</span></div>`).join('')||'<p class="empty">لا توجد حركات مالية بعد.</p>'}</div></section>`}
  function courierNotificationsHTML(c){const rows=(window.db?.notifications||[]).filter(n=>String(n.user_id||n.recipient_id||'')===String(c.id)||['courier','all'].includes(String(n.role||n.audience||''))).sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));return `<section class="v164-section-head"><div><h2>إشعارات المندوب</h2><p>طلبات جديدة ورسائل الإدارة والتسويات.</p></div><button onclick="alinV164CourierReadAll()">تحديد الكل كمقروء</button></section><div class="v164-notifications">${rows.map(n=>`<article class="${n.read_at||n.is_read?'read':''}"><div><h3>${escv(n.title||'إشعار')}</h3><p>${escv(n.message||n.body||'')}</p><small>${escv(fmtDate(n.created_at))}</small></div>${n.read_at||n.is_read?'':`<button onclick="alinV164CourierRead('${escv(n.id)}')">مقروء</button>`}</article>`).join('')||'<div class="empty">لا توجد إشعارات.</div>'}</div>`}
  window.alinV164CourierRead=async function(id){try{await update('notifications',{is_read:true,read_at:now()},{id});if(typeof load==='function')await load();renderCourierDashboard('notifications')}catch(e){alert('تعذر تحديث الإشعار')}};
  window.alinV164CourierReadAll=async function(){const me=roleCurrent();const rows=(window.db?.notifications||[]).filter(n=>!(n.read_at||n.is_read)&&(String(n.user_id||n.recipient_id||'')===String(me?.id)||['courier','all'].includes(String(n.role||n.audience||''))));for(const n of rows){try{await update('notifications',{is_read:true,read_at:now()},{id:n.id})}catch(_){}}if(typeof load==='function')await load();renderCourierDashboard('notifications')};
  function courierProfileHTML(c){return `<section class="v164-profile"><div class="v164-profile-head"><div class="v161-avatar">${escv((c.name||'م').slice(0,1))}</div><div><h2>${escv(c.name||'مندوب')}</h2><p>${escv(c.phone||'بدون هاتف')}</p></div><span class="v161-status ${statusOf(c)}">${statusLabel(statusOf(c))}</span></div><div class="v164-profile-fields"><label>حالة العمل<select id="v161MyAvailability"><option value="available" ${statusOf(c)==='available'?'selected':''}>متاح</option><option value="busy" ${statusOf(c)==='busy'?'selected':''}>مشغول</option><option value="offline" ${statusOf(c)==='offline'?'selected':''}>غير متصل</option></select></label><div><small>مناطق العمل</small><div class="v161-area-chips">${areasOf(c).map(a=>`<span>${escv(a)}</span>`).join('')||'<span>لا توجد مناطق</span>'}</div></div></div><button onclick="alinV161SaveMyStatus()">حفظ الحالة</button></section>`}

  /* Admin courier management */
  const adminState={q:'',status:'',area:''};
  window.renderCouriersAdmin=function(){
    const rows=couriers(),areaList=(window.db?.delivery_areas||[]).map(x=>x.name).filter(Boolean);const totalActive=rows.filter(c=>c.status!=='inactive').length;
    adminContent.innerHTML=`<section class="v164-admin-couriers"><header class="v164-admin-head"><div><small>نظام التوصيل</small><h2>إدارة المندوبين</h2><p>الحسابات، المناطق، الحالة، الحمل الحالي، الذمم والتواصل من مكان واحد.</p></div><div><button onclick="adminTab('deliveryOrders')">طلبات التوصيل</button><button onclick="adminTab('courierAreas')">إدارة المناطق</button><button onclick="alinV161CourierForm()">+ إضافة مندوب</button></div></header><section class="v164-admin-metrics"><article><small>إجمالي المندوبين</small><strong>${rows.length}</strong></article><article><small>حسابات فعالة</small><strong>${totalActive}</strong></article><article><small>متاحون الآن</small><strong>${rows.filter(c=>statusOf(c)==='available').length}</strong></article><article><small>طلبات جارية</small><strong>${rows.reduce((a,c)=>a+activeLoad(c),0)}</strong></article><article><small>ذمم المندوبين</small><strong>${moneyv(rows.reduce((a,c)=>a+courierFinancials(c).debt,0))} د.ع</strong></article></section><section class="v164-admin-tools"><input id="v164CourierQ" placeholder="بحث بالاسم أو الهاتف أو اسم الدخول أو المنطقة" value="${escv(adminState.q)}"><select id="v164CourierStatus"><option value="">كل الحالات</option>${['available','busy','offline','inactive'].map(s=>`<option value="${s}" ${adminState.status===s?'selected':''}>${statusLabel(s)}</option>`).join('')}</select><select id="v164CourierArea"><option value="">كل المناطق</option>${[...new Set([...areaList,...rows.flatMap(areasOf)])].map(a=>`<option value="${escv(a)}" ${adminState.area===a?'selected':''}>${escv(a)}</option>`).join('')}</select></section><div id="v164CourierGrid" class="v164-admin-grid">${rows.map(adminCourierCard).join('')||'<div class="empty">لا يوجد مندوبون بعد.</div>'}</div></section>`;
    ['v164CourierQ','v164CourierStatus','v164CourierArea'].forEach(id=>$('#'+id)?.addEventListener(id==='v164CourierQ'?'input':'change',()=>{adminState.q=$('#v164CourierQ')?.value||'';adminState.status=$('#v164CourierStatus')?.value||'';adminState.area=$('#v164CourierArea')?.value||'';filterAdminCouriers()}));
  };
  function adminCourierCard(c){const st=c.status==='inactive'?'inactive':statusOf(c),ar=areasOf(c),f=courierFinancials(c);return `<article class="v164-admin-card" data-q="${escv(((c.name||'')+' '+(c.phone||'')+' '+(c.username||'')+' '+ar.join(' ')).toLowerCase())}" data-status="${st}" data-areas="${escv(ar.join('|'))}"><header><div class="v161-avatar">${escv((c.name||'م').slice(0,1))}</div><div><h3>${escv(c.name||'مندوب')}</h3><p>${escv(c.phone||'بدون هاتف')} • ${escv(c.username||'بدون اسم دخول')}</p></div><span class="v161-status ${st}">${statusLabel(st)}</span></header><div class="v164-card-metrics"><div><small>الطلبات الحالية</small><b>${activeLoad(c)}</b></div><div><small>مكتملة اليوم</small><b>${todayDone(c)}</b></div><div><small>الذمة</small><b>${moneyv(f.debt)} د.ع</b></div></div><div class="v161-area-chips">${ar.map(a=>`<span>${escv(a)}</span>`).join('')||'<span>غير مرتبط بمنطقة</span>'}</div><footer><button onclick="alinV164CourierDetails('${escv(c.id)}')">التفاصيل</button><button onclick="alinV161CourierForm('${escv(c.id)}')">تعديل</button><button class="secondary" onclick="alinV164AdminStatus('${escv(c.id)}')">تغيير الحالة</button><button class="danger" onclick="alinV161ToggleCourier('${escv(c.id)}')">${c.status==='inactive'?'تفعيل':'إيقاف'}</button></footer></article>`}
  function filterAdminCouriers(){const q=adminState.q.toLowerCase();$$('.v164-admin-card').forEach(x=>x.hidden=!((!q||x.dataset.q.includes(q))&&(!adminState.status||x.dataset.status===adminState.status)&&(!adminState.area||x.dataset.areas.split('|').includes(adminState.area))))}
  window.alinV164CourierDetails=function(id){const c=couriers().find(x=>String(x.id)===String(id));if(!c)return;const all=courierOrders(c),f=courierFinancials(c);checkoutBox.innerHTML=`<section class="v164-details"><header><div class="v161-avatar">${escv((c.name||'م').slice(0,1))}</div><div><h2>${escv(c.name)}</h2><p>${escv(c.phone||'')} • ${escv(c.username||'')}</p></div><span class="v161-status ${statusOf(c)}">${statusLabel(statusOf(c))}</span></header><div class="v164-admin-metrics"><article><small>طلبات حالية</small><strong>${all.filter(isActive).length}</strong></article><article><small>طلبات مكتملة</small><strong>${all.filter(isDone).length}</strong></article><article><small>أرباحه</small><strong>${moneyv(f.earnings)} د.ع</strong></article><article><small>ذمته</small><strong>${moneyv(f.debt)} د.ع</strong></article></div><h3>مناطق العمل</h3><div class="v161-area-chips">${areasOf(c).map(a=>`<span>${escv(a)}</span>`).join('')}</div><h3>آخر الطلبات</h3><div class="v164-mini-orders">${all.slice(-8).reverse().map(o=>`<div><span>${escv(o.order_number||o.id)}</span><span>${escv(o.delivery_area||'')}</span><b>${moneyv(o.total)} د.ع</b><small>${escv(orderStatus(o))}</small></div>`).join('')||'<p class="empty">لا توجد طلبات.</p>'}</div></section>`;checkoutModal.classList.remove('hidden')};
  window.alinV164AdminStatus=async function(id){const c=couriers().find(x=>String(x.id)===String(id));if(!c)return;const value=prompt('اكتب الحالة: available أو busy أو offline',statusOf(c));if(!['available','busy','offline'].includes(String(value)))return;try{await update('couriers',{availability:value},{id});if(typeof load==='function')await load();renderCouriersAdmin()}catch(e){alert(e.message||'تعذر تحديث الحالة')}};

  /* Delivery admin improvements */
  const oldRenderDelivery=window.renderDeliveryOrdersAdmin;
  window.renderDeliveryOrdersAdmin=function(){
    const list=orders().filter(o=>o.fulfillment_type==='home_delivery'||o.delivery_area),pending=list.filter(o=>!o.courier_id&&!o.delegate_id),issues=list.filter(o=>o.delivery_issue);
    adminContent.innerHTML=`<section class="v164-admin-couriers"><header class="v164-admin-head"><div><small>التوزيع اليدوي</small><h2>طلبات التوصيل</h2><p>مطابقة المنطقة، حالة المندوب، الحمل الحالي، GPS ومشاكل التوصيل.</p></div><button onclick="renderCouriersAdmin()">إدارة المندوبين</button></header><section class="v164-admin-metrics"><article><small>كل طلبات التوصيل</small><strong>${list.length}</strong></article><article><small>بانتظار التحويل</small><strong>${pending.length}</strong></article><article><small>قيد التوصيل</small><strong>${list.filter(o=>isActive(o)&&(o.courier_id||o.delegate_id)).length}</strong></article><article><small>مشاكل مسجلة</small><strong>${issues.length}</strong></article></section><div class="v164-delivery-admin-list">${list.map(deliveryAdminCard).join('')||'<div class="empty">لا توجد طلبات توصيل.</div>'}</div></section>`;
  };
  function deliveryAdminCard(o){const area=window.alinNormalizeDeliveryArea(o.delivery_area)||'غير محددة',matches=couriers().filter(c=>c.status!=='inactive'&&areasOf(c).some(name=>window.alinNormalizeDeliveryArea(name)===area)).sort((a,b)=>activeLoad(a)-activeLoad(b)),assigned=couriers().find(c=>String(c.id)===String(o.courier_id||o.delegate_id||'')),map=mapLink(o);return `<article class="v164-delivery-admin-card ${o.delivery_issue?'has-issue':''}"><header><div><small>${escv(o.order_number||o.id)}</small><h3>${escv(o.title||'طلب توصيل')}</h3></div><span>${escv(area)}</span></header>${o.delivery_issue?`<div class="v164-issue">مشكلة المندوب: ${escv(o.courier_note||'بدون تفاصيل')}</div>`:''}<div class="v164-order-grid"><div><small>الطالب</small><b>${escv(o.student_name||'—')}</b></div><div><small>الهاتف</small><b>${escv(o.student_phone||'—')}</b></div><div class="wide"><small>أقرب نقطة دالة</small><b>${escv(o.delivery_landmark||'—')}</b></div><div><small>المبلغ</small><b>${moneyv(o.total)} د.ع</b></div><div><small>الحالة</small><b>${escv(orderStatus(o))}</b></div></div>${map?`<a class="v164-map-btn" href="${escv(map)}" target="_blank" rel="noopener">فتح موقع الطالب GPS</a>`:''}<div class="v164-match-list"><h4>المندوبون المطابقون للمنطقة (${matches.length})</h4>${matches.map(c=>`<label><input type="radio" name="v164assign_${escv(o.id)}" value="${escv(c.id)}" ${assigned&&String(assigned.id)===String(c.id)?'checked':''}><span><b>${escv(c.name)}</b><small>${statusLabel(statusOf(c))} • ${activeLoad(c)} طلب حالي • ذمة ${moneyv(courierFinancials(c).debt)} د.ع</small></span></label>`).join('')||'<p class="warning-text">لا يوجد مندوب مرتبط بهذه المنطقة.</p>'}</div><footer><button ${!matches.length?'disabled':''} onclick="alinV164Assign('${escv(o.id)}')">${assigned?'إعادة تحويل':'تحويل للمندوب'}</button>${assigned?`<span>المندوب الحالي: <b>${escv(assigned.name)}</b></span>`:'<span>لم يتم تعيين مندوب</span>'}</footer></article>`}
  window.alinV164Assign=async function(id){const selected=document.querySelector(`input[name="v164assign_${CSS.escape(id)}"]:checked`)?.value;if(!selected)return alert('اختر مندوباً');try{await update('orders',{courier_id:selected,delegate_id:selected,assignment_status:'assigned',status:'assigned',assigned_at:now(),delivery_issue:false,courier_note:null},{id});if(typeof audit==='function')await audit('courier',`تحويل الطلب ${id} إلى المندوب ${selected}`);if(typeof load==='function')await load();renderDeliveryOrdersAdmin();notify('تم تحويل الطلب للمندوب')}catch(e){alert(e.message||'تعذر تحويل الطلب')}};

  document.addEventListener('DOMContentLoaded',()=>{ensureCourierTab()});
})();

/* ===== courier/js/courier-response-timeout-v165.js ===== */
/* V165: one-minute courier acceptance window */
(function(){
  'use strict';
  const TIMEOUT_MS=60*1000;
  const checking=new Set();
  const escx=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
  const nowIso=()=>new Date().toISOString();
  const rows=()=>Array.isArray(window.db?.orders)?window.db.orders:[];
  const notify=m=>typeof toast==='function'?toast(m):console.log(m);
  const assignedAt=o=>new Date(o.assigned_at||o.status_updated_at||o.updated_at||0).getTime();
  const deadline=o=>assignedAt(o)+TIMEOUT_MS;
  const isAwaiting=o=>String(o.status||'')==='assigned' && !['accepted','picked_up','out_for_delivery','completed','delivered','cancelled'].includes(String(o.assignment_status||''));
  const leftMs=o=>Math.max(0,deadline(o)-Date.now());
  const fmt=s=>`00:${String(Math.max(0,s)).padStart(2,'0')}`;

  async function expireOrder(o){
    if(!o?.id||checking.has(String(o.id))||!isAwaiting(o))return;
    checking.add(String(o.id));
    try{
      await update('orders',{
        courier_id:null,
        delegate_id:null,
        status:'pending_admin',
        assignment_status:'expired',
        courier_note:'انتهت مهلة قبول المندوب خلال دقيقة',
        status_updated_at:nowIso()
      },{id:o.id});
      if(typeof audit==='function') await audit('courier',`انتهاء مهلة قبول المندوب للطلب ${o.id} وإعادته للمدير`);
      if(typeof load==='function') await load();
      refreshVisibleViews();
      notify('انتهت مهلة المندوب وأعيد الطلب للمدير');
    }catch(e){ console.error('V165 expire',e); }
    finally{checking.delete(String(o.id));}
  }

  function refreshVisibleViews(){
    try{
      if(document.querySelector('#courierPage:not(.hidden)')&&typeof renderCourierDashboard==='function') renderCourierDashboard('current');
      if(document.querySelector('#adminPage:not(.hidden)')&&typeof renderDeliveryOrdersAdmin==='function') renderDeliveryOrdersAdmin();
    }catch(_){ }
  }

  function checkAll(){
    rows().filter(isAwaiting).forEach(o=>{if(leftMs(o)<=0)expireOrder(o)});
    updateCountdowns();
  }

  function findCardForOrder(o,rootSelector){
    const root=document.querySelector(rootSelector); if(!root)return null;
    const token=String(o.order_number||o.id||'').trim();
    return Array.from(root.querySelectorAll('article')).find(a=>a.textContent.includes(token))||null;
  }

  function responseBox(o,mode){
    const sec=Math.ceil(leftMs(o)/1000);
    const cls=sec<=15?' danger':'';
    return `<div class="v165-response-timer${cls}" data-v165-order="${escx(o.id)}"><span>${mode==='courier'?'مهلة قبول الطلب':'بانتظار قبول المندوب'}</span><strong>${fmt(sec)}</strong><small>${mode==='courier'?'اقبل الطلب قبل انتهاء الوقت':'إذا لم يستجب خلال دقيقة يرجع الطلب تلقائياً للمدير'}</small></div>`;
  }

  function decorateCourier(){
    rows().filter(isAwaiting).forEach(o=>{
      const card=findCardForOrder(o,'#courierV161Content'); if(!card||card.querySelector('[data-v165-order]'))return;
      const actions=card.querySelector('.v164-order-actions')||card;
      actions.insertAdjacentHTML('beforebegin',responseBox(o,'courier'));
    });
  }
  function decorateAdmin(){
    rows().filter(isAwaiting).forEach(o=>{
      const card=findCardForOrder(o,'#adminContent'); if(!card||card.querySelector('[data-v165-order]'))return;
      const footer=card.querySelector('footer')||card;
      footer.insertAdjacentHTML('beforebegin',responseBox(o,'admin'));
    });
  }
  function updateCountdowns(){
    document.querySelectorAll('[data-v165-order]').forEach(box=>{
      const o=rows().find(x=>String(x.id)===String(box.dataset.v165Order));
      if(!o||!isAwaiting(o)){box.remove();return}
      const sec=Math.ceil(leftMs(o)/1000), strong=box.querySelector('strong');
      if(strong)strong.textContent=fmt(sec);
      box.classList.toggle('danger',sec<=15);
    });
    decorateCourier(); decorateAdmin();
  }

  const oldAssign=window.alinV161AssignOrder;
  window.alinV161AssignOrder=async function(orderId){
    const selected=document.querySelector(`input[name="assign_${CSS.escape(String(orderId))}"]:checked`)?.value;
    if(!selected)return alert('اختر مندوباً مناسباً');
    try{
      await update('orders',{
        courier_id:selected,
        delegate_id:selected,
        assignment_status:'awaiting_courier',
        status:'assigned',
        assigned_at:nowIso(),
        courier_note:null,
        status_updated_at:nowIso()
      },{id:orderId});
      if(typeof audit==='function')await audit('courier',`تحويل الطلب ${orderId} إلى مندوب بمهلة قبول دقيقة واحدة`);
      if(typeof load==='function')await load();
      if(typeof renderDeliveryOrdersAdmin==='function')renderDeliveryOrdersAdmin();
      notify('تم تحويل الطلب. أمام المندوب دقيقة واحدة للقبول');
    }catch(e){
      if(typeof oldAssign==='function')return oldAssign.apply(this,arguments);
      alert(e.message||'تعذر تحويل الطلب');
    }
  };

  const oldStep=window.alinV164CourierStep;
  window.alinV164CourierStep=async function(id,status){
    if(status!=='accepted') return typeof oldStep==='function'?oldStep.apply(this,arguments):undefined;
    const o=rows().find(x=>String(x.id)===String(id));
    if(!o)return alert('الطلب غير موجود');
    if(!isAwaiting(o)||leftMs(o)<=0){await expireOrder(o);return alert('انتهت مهلة قبول الطلب وتمت إعادته للمدير')}
    try{
      await update('orders',{status:'accepted',assignment_status:'accepted',status_updated_at:nowIso(),courier_note:null},{id});
      if(typeof audit==='function')await audit('courier',`قبول الطلب ${id} ضمن المهلة`);
      if(typeof load==='function')await load();
      if(typeof renderCourierDashboard==='function')renderCourierDashboard('current');
      notify('تم قبول الطلب بنجاح');
    }catch(e){alert(e.message||'تعذر قبول الطلب')}
  };

  const oldRenderCourier=window.renderCourierDashboard;
  if(typeof oldRenderCourier==='function') window.renderCourierDashboard=function(){const r=oldRenderCourier.apply(this,arguments);setTimeout(decorateCourier,0);return r};
  const oldRenderAdmin=window.renderDeliveryOrdersAdmin;
  if(typeof oldRenderAdmin==='function') window.renderDeliveryOrdersAdmin=function(){const r=oldRenderAdmin.apply(this,arguments);setTimeout(decorateAdmin,0);return r};

  setInterval(checkAll,1000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkAll()});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',checkAll);else checkAll();
})();

/* ===== courier/js/courier-v174-final.js ===== */
/* V174: final courier dashboard and rejection workflow */
(function(){
  'use strict';
  const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
  const escv=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const moneyv=v=>typeof money==='function'?money(v):Number(v||0).toLocaleString('ar-IQ');
  const now=()=>new Date().toISOString();
  const currentRole=()=>{try{return window.current||current}catch(_){return null}};
  const couriers=()=>Array.isArray(window.couriers)?window.couriers:(window.db?.accounts?.couriers||[]);
  const orders=()=>Array.isArray(window.db?.orders)?window.db.orders:[];
  const settlements=()=>Array.isArray(window.courierSettlements)?window.courierSettlements:(window.db?.courier_settlements||[]);
  const notify=m=>typeof toast==='function'?toast(m):alert(m);
  const done=o=>['completed','delivered'].includes(String(o.status||''));
  const cancelled=o=>['cancelled','rejected','assignment_expired'].includes(String(o.status||''));
  const active=o=>!done(o)&&!cancelled(o);
  const myCourier=()=>couriers().find(c=>String(c.id)===String(currentRole()?.id));
  const myOrders=c=>orders().filter(o=>String(o.courier_id||o.delegate_id||'')===String(c?.id));
  function areasOf(c){let x=c?.areas||c?.area_ids||c?.area||[];if(Array.isArray(x))return x;if(typeof x==='string'){try{const j=JSON.parse(x);if(Array.isArray(j))return j}catch(_){}return x.split(/[,،|]/).map(v=>v.trim()).filter(Boolean)}return[]}
  function statusOf(c){if(!c||c.status==='inactive')return'inactive';const s=String(c.availability||c.work_status||'available');return ['available','busy','offline'].includes(s)?s:'available'}
  function statusLabel(s){return({available:'متاح',busy:'مشغول',offline:'خارج الخدمة',inactive:'موقوف'})[s]||s}
  function financials(c){const rows=myOrders(c).filter(done),collected=rows.reduce((a,o)=>a+(+o.total||0),0),earnings=rows.reduce((a,o)=>a+(+o.courier_profit||+o.delivery_fee||0),0),paid=settlements().filter(s=>String(s.courier_id)===String(c.id)&&String(s.status||'paid')!=='cancelled').reduce((a,s)=>a+(+s.amount||0),0);return{collected,earnings,paid,debt:Math.max(0,collected-earnings-paid)}}
  function today(o){const x=o.delivered_at||o.completed_at||o.status_updated_at||o.updated_at||'';return String(x).slice(0,10)===new Date().toISOString().slice(0,10)}
  function orderState(st){return({assigned:'بانتظار القبول',new:'طلب جديد',accepted:'مقبول',picked_up:'تم الاستلام',out_for_delivery:'في الطريق',processing:'قيد التنفيذ',completed:'تم التسليم',delivered:'تم التسليم',cancelled:'ملغي',rejected:'مرفوض',assignment_expired:'انتهت المهلة'})[st]||st}
  function mapLink(o){const lat=o.delivery_latitude||o.delivery_lat||o.latitude,lng=o.delivery_longitude||o.delivery_lng||o.longitude;return o.delivery_location_url||o.delivery_map_url||o.gps_url||(lat&&lng?`https://maps.google.com/?q=${lat},${lng}`:'')}
  function phoneLink(p){p=String(p||'').replace(/\D/g,'');return p?`tel:+${p.startsWith('964')?p:'964'+p.replace(/^0/,'')}`:'#'}
  function waLink(p){p=String(p||'').replace(/\D/g,'');return p?`https://wa.me/${p.startsWith('964')?p:'964'+p.replace(/^0/,'')}`:'#'}
  function deadline(o){const raw=o.assignment_expires_at||o.acceptance_deadline||(o.assigned_at?new Date(new Date(o.assigned_at).getTime()+60000).toISOString():'');return raw?new Date(raw):null}
  function countdown(o){const d=deadline(o);if(!d||!['assigned','new'].includes(String(o.status||'')))return'';const ms=d-Date.now();if(ms<=0)return'<span class="v174-timeout expired">انتهت المهلة</span>';return `<span class="v174-timeout" data-v174-deadline="${escv(d.toISOString())}">متبقي ${Math.ceil(ms/1000)} ثانية</span>`}
  function ensureTabs(){const nav=$('.courier-v161-tabs');if(!nav)return;const wanted=[['home','الرئيسية'],['current','طلبات التوصيل'],['completed','المكتملة'],['finance','الحسابات'],['notifications','الإشعارات'],['profile','حسابي']];wanted.forEach(([key,label])=>{let b=nav.querySelector(`[data-courier-tab="${key}"]`);if(!b){b=document.createElement('button');b.type='button';b.dataset.courierTab=key;nav.appendChild(b)}b.textContent=label;b.onclick=()=>window.renderCourierDashboard(key)});const keep=new Set(wanted.map(x=>x[0]));[...nav.querySelectorAll('[data-courier-tab]')].forEach(b=>{if(!keep.has(b.dataset.courierTab))b.remove()})}
  function summary(c,rows){const f=financials(c),newRows=rows.filter(o=>['assigned','new'].includes(String(o.status||''))),accepted=rows.filter(o=>['accepted','picked_up','out_for_delivery','processing'].includes(String(o.status||'')));return `<section class="v174-metrics"><article><small>طلبات جديدة</small><strong>${newRows.length}</strong></article><article><small>طلبات مقبولة</small><strong>${accepted.length}</strong></article><article><small>تم التسليم اليوم</small><strong>${rows.filter(o=>done(o)&&today(o)).length}</strong></article><article><small>طلبات ملغاة</small><strong>${rows.filter(cancelled).length}</strong></article><article><small>رصيدك</small><strong>${moneyv(f.earnings-f.paid)} د.ع</strong></article><article class="debt"><small>ذمتك للإدارة</small><strong>${moneyv(f.debt)} د.ع</strong></article></section>`}
  function home(c,rows){const current=rows.filter(active).slice(0,5),alerts=(window.db?.notifications||[]).filter(n=>String(n.courier_id||n.user_id||n.target_id||'')===String(c.id)).slice(-4).reverse();return `${summary(c,rows)}<section class="v174-home-grid"><article class="v174-panel"><header><div><small>الحالة الحالية</small><h2>${statusLabel(statusOf(c))}</h2></div><span class="v174-status ${statusOf(c)}"></span></header><div class="v174-status-actions"><button onclick="alinV174QuickStatus('available')">متاح</button><button onclick="alinV174QuickStatus('busy')">مشغول</button><button onclick="alinV174QuickStatus('offline')">خارج الخدمة</button></div><p>مناطق العمل: ${escv(areasOf(c).join('، ')||'غير محددة')}</p></article><article class="v174-panel"><header><div><small>أقرب طلباتك</small><h2>طلبات تحتاج متابعة</h2></div><button onclick="renderCourierDashboard('current')">عرض الكل</button></header><div class="v174-mini-list">${current.map(o=>`<button onclick="renderCourierDashboard('current')"><b>${escv(o.order_number||o.id)}</b><span>${escv(o.delivery_area||'—')}</span><small>${escv(orderState(String(o.status||'')))}</small></button>`).join('')||'<p class="empty">لا توجد طلبات حالياً.</p>'}</div></article><article class="v174-panel wide"><header><div><small>آخر الإشعارات</small><h2>تنبيهات المندوب</h2></div><button onclick="renderCourierDashboard('notifications')">مركز الإشعارات</button></header><div class="v174-mini-list">${alerts.map(n=>`<div><b>${escv(n.title||'إشعار')}</b><span>${escv(n.message||n.body||'')}</span></div>`).join('')||'<p class="empty">لا توجد إشعارات جديدة.</p>'}</div></article></section>`}
  function orderCard(o){const st=String(o.status||'assigned'),phone=o.student_phone||'',map=mapLink(o),first=['assigned','new'].includes(st),moving=['accepted','picked_up','out_for_delivery','processing'].includes(st);return `<article class="v174-order"><header><div><small>${escv(o.order_number||o.id)}</small><h3>${escv(o.title||'طلب توصيل')}</h3></div><div>${countdown(o)}<span class="v174-order-state ${escv(st)}">${escv(orderState(st))}</span></div></header><div class="v174-order-data"><div><small>الطالب</small><b>${escv(o.student_name||'—')}</b></div><div><small>الهاتف</small><b>${escv(phone||'—')}</b></div><div><small>المنطقة</small><b>${escv(window.alinNormalizeDeliveryArea(o.delivery_area)||'—')}</b></div><div><small>المبلغ المستلم</small><b>${moneyv(o.total)} د.ع</b></div><div><small>أجرة التوصيل</small><b>${moneyv(o.courier_profit||o.delivery_fee||0)} د.ع</b></div><div class="wide"><small>أقرب نقطة دالة</small><b>${escv(o.delivery_landmark||'—')}</b></div></div><div class="v174-links">${phone?`<a href="${phoneLink(phone)}">اتصال</a><a href="${waLink(phone)}" target="_blank" rel="noopener">واتساب</a>`:''}${map?`<a class="map" href="${escv(map)}" target="_blank" rel="noopener">فتح Google Maps</a>`:''}</div><div class="v174-actions">${first?`<button onclick="alinV164CourierStep('${escv(o.id)}','accepted')">قبول الطلب</button><button class="reject" onclick="alinV174Reject('${escv(o.id)}')">رفض الطلب</button>`:''}${st==='accepted'?`<button onclick="alinV164CourierStep('${escv(o.id)}','picked_up')">استلمت الطلب</button>`:''}${moving?`<button onclick="alinV164CourierStep('${escv(o.id)}','out_for_delivery')">بدء التوصيل</button>`:''}<button class="success" onclick="alinV164CourierComplete('${escv(o.id)}')">تم التسليم</button><button class="secondary" onclick="alinV164ReportIssue('${escv(o.id)}')">تسجيل مشكلة</button></div></article>`}
  function currentOrders(rows){const a=rows.filter(active);return `${summary(myCourier(),rows)}<section class="v174-head"><div><small>طلبات التوصيل</small><h2>طلباتك الحالية</h2></div><span>${a.length}</span></section><div class="v174-orders">${a.map(orderCard).join('')||'<div class="empty">لا توجد طلبات توصيل حالياً.</div>'}</div>`}
  function completed(rows){const d=rows.filter(done);return `${summary(myCourier(),rows)}<section class="v174-head"><div><small>سجل الإنجاز</small><h2>الطلبات المكتملة</h2></div><span>${d.length}</span></section><div class="v174-orders">${d.map(orderCard).join('')||'<div class="empty">لا توجد طلبات مكتملة.</div>'}</div>`}
  const oldRender=window.renderCourierDashboard;
  window.renderCourierDashboard=function(tab='home'){
    const c=myCourier();if(!c){if(typeof oldRender==='function')return oldRender(tab);return}
    ensureTabs();const rows=myOrders(c),box=$('#courierV161Content');if(!box)return;
    $('#courierV161Name').textContent=c.name||'المندوب';$('#courierV161Areas').textContent=areasOf(c).join('، ')||'لا توجد مناطق';$$('.courier-v161-tabs [data-courier-tab]').forEach(b=>b.classList.toggle('active',b.dataset.courierTab===tab));
    if(tab==='home')box.innerHTML=home(c,rows);else if(tab==='current')box.innerHTML=currentOrders(rows);else if(tab==='completed')box.innerHTML=completed(rows);else if(typeof oldRender==='function')return oldRender(tab);
    updateCountdowns();
  };
  window.alinV174QuickStatus=async function(value){const c=myCourier();if(!c)return;try{await update('couriers',{availability:value},{id:c.id});if(typeof load==='function')await load();renderCourierDashboard('home');notify('تم تحديث حالة المندوب')}catch(e){alert(e.message||'تعذر تحديث الحالة')}};
  window.alinV174Reject=async function(id){const reasons=['خارج منطقة عملي','السيارة معطلة','مشغول حالياً','انتهاء الدوام','سبب آخر'];const choice=prompt('اختر رقم سبب الرفض:\n1- خارج منطقة عملي\n2- السيارة معطلة\n3- مشغول حالياً\n4- انتهاء الدوام\n5- سبب آخر','1');if(!choice)return;let reason=reasons[Math.max(0,Math.min(4,Number(choice)-1))]||reasons[0];if(choice==='5'){reason=(prompt('اكتب سبب الرفض')||'').trim();if(!reason)return}if(!confirm(`تأكيد رفض الطلب؟\nالسبب: ${reason}`))return;try{await update('orders',{courier_id:null,delegate_id:null,assignment_status:'pending_admin',status:'pending_admin',courier_rejection_reason:reason,courier_rejected_at:now(),assigned_at:null,assignment_expires_at:null,acceptance_deadline:null,delivery_issue:true,courier_note:reason,status_updated_at:now()},{id});if(typeof audit==='function')await audit('courier',`رفض الطلب ${id}: ${reason}`);if(typeof load==='function')await load();renderCourierDashboard('current');notify('أعيد الطلب إلى المدير لاختيار مندوب آخر')}catch(e){alert(e.message||'تعذر رفض الطلب')}};
  function updateCountdowns(){document.querySelectorAll('[data-v174-deadline]').forEach(el=>{const tick=()=>{const s=Math.max(0,Math.ceil((new Date(el.dataset.v174Deadline)-Date.now())/1000));el.textContent=s?`متبقي ${s} ثانية`:'انتهت المهلة';el.classList.toggle('expired',!s)};tick();const t=setInterval(()=>{if(!document.body.contains(el)||el.classList.contains('expired')){clearInterval(t);return}tick()},1000)})}
  document.addEventListener('DOMContentLoaded',()=>{ensureTabs();setTimeout(()=>{if($('#courierPage:not(.hidden)'))renderCourierDashboard('home')},100)});
})();


;
